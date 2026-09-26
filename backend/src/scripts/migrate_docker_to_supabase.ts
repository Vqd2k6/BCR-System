import { Pool } from 'pg';

async function migrate() {
  console.log('🚀 Starting direct data migration from Docker Local -> Supabase Cloud...');

  const localPool = new Pool({
    host: 'localhost',
    port: 5433,
    user: 'metro2_user',
    password: 'metro2_secure_password',
    database: 'metro2_gis_db',
  });

  const remotePool = new Pool({
    host: process.env.DB_HOST || 'aws-0-ap-southeast-1.pooler.supabase.com',
    port: parseInt(process.env.DB_PORT || '6543'),
    user: process.env.DB_USER || 'postgres.zmbydzpytqyjnnawdssd',
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME || 'postgres',
    ssl: { rejectUnauthorized: false },
    max: 5,
  });

  if (!process.env.DB_PASSWORD) {
    console.error('❌ Error: DB_PASSWORD is required. Ví dụ: DB_PASSWORD=your_password npm run migrate:docker-to-supabase');
    process.exit(1);
  }

  const localClient = await localPool.connect();
  const remoteClient = await remotePool.connect();

  try {
    // 0. Đồng bộ các giá trị ENUM mới sang Supabase
    try {
      await remoteClient.query("ALTER TYPE parcel_survey_status_enum ADD VALUE IF NOT EXISTS 'APPROVED_PHASE2';");
      await remoteClient.query("ALTER TYPE parcel_survey_status_enum ADD VALUE IF NOT EXISTS 'PHASE2_COMPLETED';");
      console.log('✅ Synchronized ENUM values on Supabase.');
    } catch (err: any) {
      // Ignored if already present
    }

    // 0b. Tạo enum metro_construction_type_enum nếu chưa có
    await remoteClient.query(`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'metro_construction_type_enum') THEN
          CREATE TYPE metro_construction_type_enum AS ENUM ('C&C', 'POR', 'ELV', 'DEP');
        END IF;
      END $$;
    `);

    // 0c. Cập nhật schema các bảng còn thiếu cột trên Supabase
    console.log('🛠️ Adding missing columns to Supabase schema...');
    await remoteClient.query(`
      ALTER TABLE parcels 
        ADD COLUMN IF NOT EXISTS segment_type metro_construction_type_enum NOT NULL DEFAULT 'C&C',
        ADD COLUMN IF NOT EXISTS code_slug VARCHAR(32);
      ALTER TABLE parcels ALTER COLUMN project_parcel_code TYPE VARCHAR(32);

      ALTER TABLE base_survey_reports
        ADD COLUMN IF NOT EXISTS export_revision INTEGER DEFAULT 1,
        ADD COLUMN IF NOT EXISTS survey_data_json JSONB;

      ALTER TABLE users
        ADD COLUMN IF NOT EXISTS created_by_user_id UUID,
        ADD COLUMN IF NOT EXISTS signature_image_url TEXT,
        ADD COLUMN IF NOT EXISTS surveyor_code VARCHAR(32);

      ALTER TABLE building_specifications
        ADD COLUMN IF NOT EXISTS construction_area_m2 NUMERIC,
        ADD COLUMN IF NOT EXISTS building_height_m NUMERIC,
        ADD COLUMN IF NOT EXISTS foundation_source VARCHAR(64),
        ADD COLUMN IF NOT EXISTS foundation_depth_m NUMERIC(6,2),
        ADD COLUMN IF NOT EXISTS foundation_density INT,
        ADD COLUMN IF NOT EXISTS foundation_spacing_m NUMERIC(6,2),
        ADD COLUMN IF NOT EXISTS foundation_notes TEXT,
        ADD COLUMN IF NOT EXISTS land_use_function VARCHAR(128);

      ALTER TABLE floor_surveys
        ADD COLUMN IF NOT EXISTS cad_structural_drawing_url TEXT,
        ADD COLUMN IF NOT EXISTS cad_element_pins_json JSONB DEFAULT '[]'::jsonb;
    `);

    // 0d. Tạo bảng metro_segments trên Supabase nếu chưa có
    console.log('🛠️ Initializing metro_segments table on Supabase...');
    await remoteClient.query(`
      CREATE TABLE IF NOT EXISTS metro_segments (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        zone_index INT UNIQUE NOT NULL,
        segment_code VARCHAR(32) UNIQUE NOT NULL,
        segment_name VARCHAR(128) NOT NULL,
        construction_type metro_construction_type_enum NOT NULL,
        start_chainage_km VARCHAR(16),
        end_chainage_km VARCHAR(16),
        zoi_buffer_meters NUMERIC(6,2) NOT NULL DEFAULT 50.0,
        centerline_geom GEOMETRY(LineString, 4326),
        zoi_polygon_geom GEOMETRY(Polygon, 4326),
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );
      CREATE INDEX IF NOT EXISTS idx_metro_segments_zone ON metro_segments(zone_index);
      CREATE INDEX IF NOT EXISTS idx_metro_segments_type ON metro_segments(construction_type);
      CREATE INDEX IF NOT EXISTS idx_metro_segments_zoi ON metro_segments USING GIST(zoi_polygon_geom);
    `);

    // 1. Lấy danh sách cột kiểu JSON/JSONB để serialize chuẩn xác
    const { rows: colTypeRows } = await localClient.query(`
      SELECT table_name, column_name, data_type, udt_name 
      FROM information_schema.columns 
      WHERE table_schema = 'public';
    `);

    const jsonCols = new Set(
      colTypeRows
        .filter(c => c.data_type === 'json' || c.data_type === 'jsonb' || c.udt_name === 'json' || c.udt_name === 'jsonb')
        .map(c => `${c.table_name}.${c.column_name}`)
    );

    // 2. Lấy danh sách tất cả các bảng từ database local
    const { rows: tableRows } = await localClient.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
        AND table_type = 'BASE TABLE' 
        AND table_name NOT IN ('spatial_ref_sys', 'geography_columns', 'geometry_columns');
    `);

    const allTables = tableRows.map(r => r.table_name);
    console.log(`📋 Found ${allTables.length} tables to synchronize.`);

    // 3. Vô hiệu hoá tạm thời ràng buộc khoá ngoại và trigger trên Supabase
    console.log('🔒 Bypassing foreign key constraints & triggers on Supabase...');
    await remoteClient.query("SET session_replication_role = 'replica';");

    // 4. Xoá dữ liệu cũ trên Supabase
    for (const table of allTables) {
      try {
        await remoteClient.query(`TRUNCATE TABLE public."${table}" CASCADE;`);
      } catch (err: any) {
        // Table might not exist or empty
      }
    }
    console.log('🧹 Cleaned existing tables on Supabase.');

    // 5. Di chuyển dữ liệu từng bảng bằng Bulk Multi-row Insert
    let totalMigrated = 0;
    for (const table of allTables) {
      const { rows } = await localClient.query(`SELECT * FROM public."${table}";`);
      if (rows.length === 0) {
        continue;
      }

      const columns = Object.keys(rows[0]);
      const colNames = columns.map(c => `"${c}"`).join(', ');

      // Giới hạn số tham số dưới 65535 của PostgreSQL
      const batchSize = Math.max(1, Math.floor(2000 / columns.length));
      let inserted = 0;

      for (let i = 0; i < rows.length; i += batchSize) {
        const chunk = rows.slice(i, i + batchSize);
        const valuePlaceholders: string[] = [];
        const flatValues: any[] = [];
        let pIndex = 1;

        for (const row of chunk) {
          const rowPlaceholders: string[] = [];
          for (const col of columns) {
            rowPlaceholders.push(`$${pIndex++}`);
            let val = row[col];
            if (val !== null && val !== undefined && jsonCols.has(`${table}.${col}`)) {
              val = typeof val === 'string' ? val : JSON.stringify(val);
            }
            flatValues.push(val);
          }
          valuePlaceholders.push(`(${rowPlaceholders.join(', ')})`);
        }

        const sql = `INSERT INTO public."${table}" (${colNames}) VALUES ${valuePlaceholders.join(', ')};`;
        await remoteClient.query(sql, flatValues);
        inserted += chunk.length;
      }

      console.log(`✅ Table "${table}": Migrated ${inserted}/${rows.length} records.`);
      totalMigrated += inserted;
    }

    // 6. Khôi phục lại ràng buộc khoá ngoại và trigger
    await remoteClient.query("SET session_replication_role = 'origin';");
    console.log(`\n🎉 HOÀN TẤT THÀNH CÔNG RỰC RỠ! Đã đồng bộ trọn vẹn ${totalMigrated} bản ghi từ Docker sang Supabase!`);
  } catch (error) {
    console.error('❌ Migration failed with error:', error);
  } finally {
    localClient.release();
    remoteClient.release();
    await localPool.end();
    await remotePool.end();
  }
}

migrate();
