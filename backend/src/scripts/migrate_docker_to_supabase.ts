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

    // 1. Lấy danh sách tất cả các bảng từ database local
    const { rows: tableRows } = await localClient.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
        AND table_type = 'BASE TABLE' 
        AND table_name != 'spatial_ref_sys';
    `);

    const allTables = tableRows.map(r => r.table_name);
    console.log(`📋 Found ${allTables.length} tables to synchronize.`);

    // 2. Vô hiệu hoá tạm thời ràng buộc khoá ngoại và trigger trên Supabase
    console.log('🔒 Bypassing foreign key constraints & triggers on Supabase...');
    await remoteClient.query("SET session_replication_role = 'replica';");

    // 3. Xoá dữ liệu cũ trên Supabase
    for (const table of allTables) {
      try {
        await remoteClient.query(`TRUNCATE TABLE public."${table}" CASCADE;`);
      } catch (err: any) {
        // Table might not exist or empty
      }
    }
    console.log('🧹 Cleaned existing tables on Supabase.');

    // 4. Di chuyển dữ liệu từng bảng bằng Bulk Multi-row Insert (Siêu tốc)
    let totalMigrated = 0;
    for (const table of allTables) {
      const { rows } = await localClient.query(`SELECT * FROM public."${table}";`);
      if (rows.length === 0) {
        continue;
      }

      const columns = Object.keys(rows[0]);
      const colNames = columns.map(c => `"${c}"`).join(', ');

      // Giới hạn số tham số dưới 65535 của PostgreSQL (khoảng 50-100 rows mỗi batch)
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
            flatValues.push(row[col]);
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

    // 5. Khôi phục lại ràng buộc khoá ngoại và trigger
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
