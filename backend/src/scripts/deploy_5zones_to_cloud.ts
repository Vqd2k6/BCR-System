import fs from 'fs';
import path from 'path';
import { Pool } from 'pg';

export const METRO_WAYPOINTS = [
  { code: 'S1', name: 'Ga S1 - Bến Thành', type: 'C&C', km: 'Km 0+000', lat: 10.770876, lng: 106.696946 },
  { code: 'S2', name: 'Ga S2 - Tao Đàn', type: 'C&C', km: 'Km 1+035', lat: 10.773237, lng: 106.690138 },
  { code: 'S3', name: 'Ga S3 - Dân Chủ', type: 'C&C', km: 'Km 2+000', lat: 10.780053, lng: 106.677596 },
  { code: 'S4', name: 'Ga S4 - Hòa Hưng', type: 'C&C', km: 'Km 3+078', lat: 10.782072, lng: 106.673679 },
  { code: 'S5', name: 'Ga S5 - Lê Thị Riêng', type: 'C&C', km: 'Km 4+090', lat: 10.786163, lng: 106.665623 },
  { code: 'S6', name: 'Ga S6 - Phạm Văn Hai', type: 'C&C', km: 'Km 4+808', lat: 10.789654, lng: 106.659742 },
  { code: 'S7', name: 'Ga S7 - Bảy Hiền', type: 'C&C', km: 'Km 5+500', lat: 10.798691, lng: 106.643181 },
  { code: 'S8', name: 'Ga S8 - Nguyễn Hồng Đào', type: 'C&C', km: 'Km 6+700', lat: 10.806360, lng: 106.634988 },
  { code: 'S9', name: 'Ga S9 - Bà Quẹo', type: 'C&C', km: 'Km 7+900', lat: 10.810154, lng: 106.633891 },
  { code: 'S10', name: 'Ga S10 - Phạm Văn Bạch', type: 'C&C', km: 'Km 9+050', lat: 10.822124, lng: 106.630160 },
  { code: 'S11', name: 'Ga S11 - Tân Bình', type: 'C&C', km: 'Km 10+100', lat: 10.822111, lng: 106.626127 },
  { code: 'DEP', name: 'Depot Tham Lương', type: 'DEP', km: 'Km 11+040', lat: 10.830600, lng: 106.618500 },
];

export const ZONES_22_CONFIG = [
  { index: 1, code: 'ZONE_01', legacyCode: 'ZONE_S1', name: 'Zone 1: Ga S1 Bến Thành (C&C)', type: 'C&C', zoi: 50, startKm: 'Km 0+000', endKm: 'Km 0+350', lat: 10.770876, lng: 106.696946, nextLat: 10.771500, nextLng: 106.694800 },
  { index: 2, code: 'ZONE_02', legacyCode: null, name: 'Zone 2: Hầm TBM Bến Thành -> Tao Đàn (POR)', type: 'POR', zoi: 35, startKm: 'Km 0+350', endKm: 'Km 1+035', lat: 10.771500, lng: 106.694800, nextLat: 10.773237, nextLng: 106.690138 },
  { index: 3, code: 'ZONE_03', legacyCode: 'ZONE_S2', name: 'Zone 3: Ga S2 Tao Đàn (C&C)', type: 'C&C', zoi: 50, startKm: 'Km 1+035', endKm: 'Km 1+250', lat: 10.773237, lng: 106.690138, nextLat: 10.774500, nextLng: 106.687500 },
  { index: 4, code: 'ZONE_04', legacyCode: null, name: 'Zone 4: Hầm TBM Tao Đàn -> Dân Chủ (POR)', type: 'POR', zoi: 35, startKm: 'Km 1+250', endKm: 'Km 2+000', lat: 10.774500, lng: 106.687500, nextLat: 10.780053, nextLng: 106.677596 },
  { index: 5, code: 'ZONE_05', legacyCode: 'ZONE_S3', name: 'Zone 5: Ga S3 Dân Chủ (C&C)', type: 'C&C', zoi: 50, startKm: 'Km 2+000', endKm: 'Km 2+200', lat: 10.780053, lng: 106.677596, nextLat: 10.780800, nextLng: 106.676000 },
  { index: 6, code: 'ZONE_06', legacyCode: null, name: 'Zone 6: Hầm TBM Dân Chủ -> Hòa Hưng (POR)', type: 'POR', zoi: 35, startKm: 'Km 2+200', endKm: 'Km 3+078', lat: 10.780800, lng: 106.676000, nextLat: 10.782072, nextLng: 106.673679 },
  { index: 7, code: 'ZONE_07', legacyCode: 'ZONE_S4', name: 'Zone 7: Ga S4 Hòa Hưng (C&C)', type: 'C&C', zoi: 50, startKm: 'Km 3+078', endKm: 'Km 3+280', lat: 10.782072, lng: 106.673679, nextLat: 10.783000, nextLng: 106.671500 },
  { index: 8, code: 'ZONE_08', legacyCode: null, name: 'Zone 8: Hầm TBM Hòa Hưng -> Lê Thị Riêng (POR)', type: 'POR', zoi: 35, startKm: 'Km 3+280', endKm: 'Km 4+090', lat: 10.783000, lng: 106.671500, nextLat: 10.786163, nextLng: 106.665623 },
  { index: 9, code: 'ZONE_09', legacyCode: 'ZONE_S5', name: 'Zone 9: Ga S5 Lê Thị Riêng (C&C)', type: 'C&C', zoi: 50, startKm: 'Km 4+090', endKm: 'Km 4+300', lat: 10.786163, lng: 106.665623, nextLat: 10.787200, nextLng: 106.663500 },
  { index: 10, code: 'ZONE_10', legacyCode: null, name: 'Zone 10: Hầm TBM Lê Thị Riêng -> Phạm Văn Hai (POR)', type: 'POR', zoi: 35, startKm: 'Km 4+300', endKm: 'Km 4+808', lat: 10.787200, lng: 106.663500, nextLat: 10.789654, nextLng: 106.659742 },
  { index: 11, code: 'ZONE_11', legacyCode: 'ZONE_S6', name: 'Zone 11: Ga S6 Phạm Văn Hai (C&C)', type: 'C&C', zoi: 50, startKm: 'Km 4+808', endKm: 'Km 5+010', lat: 10.789654, lng: 106.659742, nextLat: 10.792500, nextLng: 106.654000 },
  { index: 12, code: 'ZONE_12', legacyCode: null, name: 'Zone 12: Hầm TBM Phạm Văn Hai -> Bảy Hiền (POR)', type: 'POR', zoi: 35, startKm: 'Km 5+010', endKm: 'Km 5+500', lat: 10.792500, lng: 106.654000, nextLat: 10.798691, nextLng: 106.643181 },
  { index: 13, code: 'ZONE_13', legacyCode: 'ZONE_S7', name: 'Zone 13: Ga S7 Bảy Hiền (C&C)', type: 'C&C', zoi: 50, startKm: 'Km 5+500', endKm: 'Km 5+750', lat: 10.798691, lng: 106.643181, nextLat: 10.801000, nextLng: 106.640500 },
  { index: 14, code: 'ZONE_14', legacyCode: null, name: 'Zone 14: Hầm TBM Bảy Hiền -> Nguyễn Hồng Đào (POR)', type: 'POR', zoi: 35, startKm: 'Km 5+750', endKm: 'Km 6+700', lat: 10.801000, lng: 106.640500, nextLat: 10.806360, nextLng: 106.634988 },
  { index: 15, code: 'ZONE_15', legacyCode: 'ZONE_S8', name: 'Zone 15: Ga S8 Nguyễn Hồng Đào (C&C)', type: 'C&C', zoi: 50, startKm: 'Km 6+700', endKm: 'Km 6+910', lat: 10.806360, lng: 106.634988, nextLat: 10.808000, nextLng: 106.634300 },
  { index: 16, code: 'ZONE_16', legacyCode: null, name: 'Zone 16: Hầm TBM Nguyễn Hồng Đào -> Bà Quẹo (POR)', type: 'POR', zoi: 35, startKm: 'Km 6+910', endKm: 'Km 7+900', lat: 10.808000, lng: 106.634300, nextLat: 10.810154, nextLng: 106.633891 },
  { index: 17, code: 'ZONE_17', legacyCode: 'ZONE_S9', name: 'Zone 17: Ga S9 Bà Quẹo (C&C)', type: 'C&C', zoi: 50, startKm: 'Km 7+900', endKm: 'Km 8+120', lat: 10.810154, lng: 106.633891, nextLat: 10.814000, nextLng: 106.632600 },
  { index: 18, code: 'ZONE_18', legacyCode: null, name: 'Zone 18: Hầm TBM Bà Quẹo -> Phạm Văn Bạch (POR)', type: 'POR', zoi: 35, startKm: 'Km 8+120', endKm: 'Km 9+050', lat: 10.814000, lng: 106.632600, nextLat: 10.822124, nextLng: 106.630160 },
  { index: 19, code: 'ZONE_19', legacyCode: 'ZONE_S10', name: 'Zone 19: Ga S10 Phạm Văn Bạch (C&C)', type: 'C&C', zoi: 50, startKm: 'Km 9+050', endKm: 'Km 9+260', lat: 10.822124, lng: 106.630160, nextLat: 10.822120, nextLng: 106.628500 },
  { index: 20, code: 'ZONE_20', legacyCode: null, name: 'Zone 20: Hầm TBM & Portal S10 -> S11 (POR)', type: 'POR', zoi: 35, startKm: 'Km 9+260', endKm: 'Km 10+100', lat: 10.822120, lng: 106.628500, nextLat: 10.822111, nextLng: 106.626127 },
  { index: 21, code: 'ZONE_21', legacyCode: 'ZONE_S11', name: 'Zone 21: Ga S11 Tân Bình (C&C)', type: 'C&C', zoi: 50, startKm: 'Km 10+100', endKm: 'Km 10+320', lat: 10.822111, lng: 106.626127, nextLat: 10.825000, nextLng: 106.623000 },
  { index: 22, code: 'ZONE_22', legacyCode: 'ZONE_DEP', name: 'Zone 22: Depot Tham Lương (DEP)', type: 'DEP', zoi: 15, startKm: 'Km 10+320', endKm: 'Km 11+040', lat: 10.830600, lng: 106.618500, nextLat: 10.832000, nextLng: 106.617000 },
];

interface ZoneImportConfig {
  folder: string;
  zoneId: string;
  legacyCode: string;
  segmentType: 'C&C' | 'POR' | 'ELV' | 'DEP';
  name: string;
}

const ZONES_TO_IMPORT: ZoneImportConfig[] = [
  { folder: 'Zone_01', zoneId: 'ZONE_01', legacyCode: 'ZONE_S1', segmentType: 'C&C', name: 'Ga S1 Bến Thành' },
  { folder: 'Zone_02', zoneId: 'ZONE_02', legacyCode: 'ZONE_S2', segmentType: 'POR', name: 'Hầm TBM Bến Thành - Tao Đàn' },
  { folder: 'Zone_03', zoneId: 'ZONE_03', legacyCode: 'ZONE_S3', segmentType: 'C&C', name: 'Ga S2 Tao Đàn' },
  { folder: 'Zone_04', zoneId: 'ZONE_04', legacyCode: 'ZONE_S4', segmentType: 'POR', name: 'Hầm TBM Tao Đàn - Dân Chủ' },
  { folder: 'Zone_09', zoneId: 'ZONE_09', legacyCode: 'ZONE_S5', segmentType: 'C&C', name: 'Ga S5 Lê Thị Riêng' },
];

async function deploy5ZonesToCloud() {
  console.log('🚀 BẮT ĐẦU ĐỒNG BỘ BẢN ĐỒ 5 ZONE (ZONE 1, 2, 3, 4, 9) LÊN SUPABASE CLOUD...');

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
    console.error('❌ Error: DB_PASSWORD is required. Ví dụ: DB_PASSWORD=your_password npm run deploy:5zones-cloud');
    process.exit(1);
  }

  const client = await remotePool.connect();

  try {
    await client.query('BEGIN;');

    // 0. Bỏ qua ràng buộc khóa ngoại tạm thời
    await client.query("SET session_replication_role = 'replica';");

    // 1. Tạo Enum nếu chưa có
    await client.query(`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'metro_construction_type_enum') THEN
          CREATE TYPE metro_construction_type_enum AS ENUM ('C&C', 'POR', 'ELV', 'DEP');
        END IF;
      END $$;
    `);

    // 2. Cập nhật các cột bảng parcels
    console.log('🛠️ 1. Cập nhật schema bảng parcels...');
    await client.query(`
      ALTER TABLE parcels 
        ADD COLUMN IF NOT EXISTS segment_type metro_construction_type_enum NOT NULL DEFAULT 'C&C',
        ADD COLUMN IF NOT EXISTS code_slug VARCHAR(32);
      
      ALTER TABLE parcels ALTER COLUMN project_parcel_code TYPE VARCHAR(32);

      DO $$ BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'uq_parcels_official_cadastral_code'
        ) THEN
          ALTER TABLE parcels ADD CONSTRAINT uq_parcels_official_cadastral_code UNIQUE (official_cadastral_code);
        END IF;
      EXCEPTION WHEN OTHERS THEN
        NULL;
      END $$;
    `);

    // 3. Tạo bảng metro_segments nếu chưa có
    console.log('🛠️ 2. Khởi tạo bảng metro_segments...');
    await client.query(`
      CREATE TABLE IF NOT EXISTS metro_segments (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
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

    // 4. Xóa sạch dữ liệu cũ
    console.log('🧹 3. Xóa dữ liệu cũ của parcels và survey...');
    await client.query(`TRUNCATE TABLE parcels CASCADE;`);
    await client.query('DELETE FROM metro_alignments;');
    await client.query('DELETE FROM metro_segments;');

    // 5. Nạp Tim tuyến Metro 2
    console.log('📍 4. Nạp Tim tuyến Metro 2 (metro_alignments)...');
    const lineCoordsWkt = METRO_WAYPOINTS.map(w => `${w.lng} ${w.lat}`).join(', ');
    const lineWkt = `LINESTRING(${lineCoordsWkt})`;

    await client.query(`
      INSERT INTO metro_alignments (
        line_code, line_name, centerline_geom, zoi_buffer_meters, zoi_polygon_geom
      ) VALUES (
        'METRO_2',
        'Tuyến Metro Số 2 (Bến Thành - Tham Lương)',
        ST_SetSRID(ST_GeomFromText($1), 4326),
        50.0,
        ST_SetSRID(ST_Buffer(ST_GeomFromText($1)::geography, 50.0)::geometry, 4326)
      );
    `, [lineWkt]);

    // 6. Nạp 22 Segments và 22 Zones
    console.log('🗺️ 5. Nạp 22 Zones và Phân đoạn vào metro_segments & metro_zones...');
    for (const z of ZONES_22_CONFIG) {
      const segWkt = `LINESTRING(${z.lng} ${z.lat}, ${z.nextLng} ${z.nextLat})`;
      await client.query(`
        INSERT INTO metro_segments (
          zone_index, segment_code, segment_name, construction_type,
          start_chainage_km, end_chainage_km, zoi_buffer_meters,
          centerline_geom, zoi_polygon_geom
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7,
          ST_SetSRID(ST_GeomFromText($8), 4326),
          ST_SetSRID(ST_Buffer(ST_GeomFromText($8)::geography, $9)::geometry, 4326)
        );
      `, [
        z.index, z.code, z.name, z.type,
        z.startKm, z.endKm, z.zoi,
        segWkt, z.zoi
      ]);

      // Đảm bảo metro_zones có đủ 22 mã zone để foreign key không bị lỗi
      await client.query(`
        INSERT INTO metro_zones (id, zone_code, zone_name, center_geom, total_parcels_count, approved_parcels_count)
        VALUES (uuid_generate_v4(), $1, $2, ST_SetSRID(ST_MakePoint($3, $4), 4326), 0, 0)
        ON CONFLICT (zone_code) DO UPDATE SET 
          zone_name = EXCLUDED.zone_name,
          center_geom = EXCLUDED.center_geom,
          total_parcels_count = 0,
          approved_parcels_count = 0;
      `, [z.code, z.name, z.lng, z.lat]);
    }

    // 7. Nạp dữ liệu 5 Zone (Zone 01, 02, 03, 04, 09)
    console.log('\n📦 6. Bắt đầu nạp các thửa đất của 5 Zone chuẩn...');
    let globalSequence = 0;
    const summary: Record<string, { totalRaw: number; inserted: number; skipped: number; startCode: string; endCode: string }> = {};

    for (const z of ZONES_TO_IMPORT) {
      const filePath = path.resolve(__dirname, `../../../data/${z.folder}/ban_do_data.json`);
      if (!fs.existsSync(filePath)) {
        console.warn(`⚠️ Không tìm thấy file: ${filePath}`);
        continue;
      }

      const raw = JSON.parse(fs.readFileSync(filePath, 'utf8'));
      const rawParcels = Object.values(raw.parcels || {}) as any[];
      let insertedCount = 0;
      let skippedCount = 0;
      let startCode = '';
      let endCode = '';

      console.log(`   ├─ Đang xử lý ${z.zoneId} (${z.name}, ${z.segmentType}) - Tổng: ${rawParcels.length} thửa...`);

      for (const p of rawParcels) {
        const mathuadat = p.mathuadat;
        if (!mathuadat) continue;

        // Kiểm tra tồn tại
        const check = await client.query(
          `SELECT id FROM parcels WHERE official_cadastral_code = $1 LIMIT 1;`,
          [String(mathuadat)]
        );

        if (check.rows.length > 0) {
          skippedCount++;
          continue;
        }

        globalSequence++;
        const seqStr = String(globalSequence).padStart(5, '0');
        const projectParcelCode = `B-${seqStr}-${z.segmentType}`;
        const codeSlug = `B-${seqStr}-${z.segmentType.replace('&', '')}`;

        if (!startCode) startCode = projectParcelCode;
        endCode = projectParcelCode;

        const coords = (p.ranh_coords || []) as [number, number][];
        if (coords.length < 3) continue;

        const wktPoints = coords.map(([lat, lng]) => `${lng} ${lat}`);
        if (wktPoints[0] !== wktPoints[wktPoints.length - 1]) {
          wktPoints.push(wktPoints[0]);
        }
        const wkt = `POLYGON((${wktPoints.join(', ')}))`;

        const sothua = p.sothua ? String(p.sothua) : String(globalSequence);
        const soto = p.soto ? String(p.soto) : '1';
        const street = p.logioi_details?.[0]?.tenduong || p.tenphuongxa || 'Đường chính';
        const ward = p.tenphuongxa || 'Phường Bến Thành';
        const district = p.tenquanhuyen || 'Quận 1';
        const landArea = parseFloat(p.dientich) || 65.0;
        const constructionArea = Math.round(landArea * 0.85 * 10) / 10;

        await client.query(`
          INSERT INTO parcels (
            zone_id, segment_type, project_parcel_code, code_slug,
            official_cadastral_code, field_survey_code,
            house_number, street, ward, district,
            owner_name, owner_phone, land_area_m2, construction_area_m2,
            floor_count, building_type, total_units,
            survey_status, lifecycle_status,
            location_geom, cadastral_polygon_geom, footprint_polygon_geom
          ) VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
            $11, $12, $13, $14, $15, $16, $17, $18, $19,
            ST_SetSRID(ST_MakePoint($20, $21), 4326),
            ST_MakeValid(ST_SetSRID(ST_PolygonFromText($22), 4326)),
            ST_MakeValid(ST_SetSRID(ST_PolygonFromText($22), 4326))
          );
        `, [
          z.zoneId, z.segmentType, projectParcelCode, codeSlug,
          String(mathuadat), `KS-${z.folder}-${mathuadat}`,
          sothua, street, ward, district,
          `Chủ hộ thửa ${sothua} (Tờ ${soto})`,
          '090' + String(1000000 + (globalSequence % 9000000)),
          landArea, constructionArea, 2, 'STANDALONE', 1,
          'NOT_SURVEYED', 'ACTIVE',
          p.longitude, p.latitude, wkt,
        ]);

        insertedCount++;
      }

      summary[z.zoneId] = {
        totalRaw: rawParcels.length,
        inserted: insertedCount,
        skipped: skippedCount,
        startCode,
        endCode,
      };

      console.log(`   └─ ✅ ${z.zoneId}: Nạp ${insertedCount} thửa [${startCode} -> ${endCode}]`);
    }

    // 8. Cập nhật tổng số thửa trong metro_zones
    await client.query(`
      UPDATE metro_zones z
      SET total_parcels_count = (SELECT COUNT(*) FROM parcels p WHERE p.zone_id = z.zone_code),
          approved_parcels_count = 0;
    `);

    // 9. Bật lại ràng buộc khóa ngoại
    await client.query("SET session_replication_role = 'origin';");

    await client.query('COMMIT;');
    console.log('\n🎉 HOÀN TẤT THÀNH CÔNG RỰC RỠ! Bản đồ 5 Zone (Zone 1, 2, 3, 4, 9) đã đồng bộ lên Supabase Cloud!');
    console.table(summary);
    console.log(`📊 Tổng số thửa đất trên Cloud: ${globalSequence}`);
  } catch (err) {
    await client.query('ROLLBACK;');
    console.error('❌ Lỗi khi nạp dữ liệu lên Cloud:', err);
    process.exit(1);
  } finally {
    client.release();
    await remotePool.end();
  }
}

deploy5ZonesToCloud();
