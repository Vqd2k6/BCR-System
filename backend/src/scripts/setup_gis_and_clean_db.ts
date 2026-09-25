import { pool } from '../database/db';

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

async function setupGisAndCleanDb() {
  const client = await pool.connect();
  try {
    console.log('🚀 Starting Clean DB & GIS Metro Setup...');
    await client.query('BEGIN;');

    // 1. Truncate parcels and all dependent tables (CLEAN SLATE)
    console.log('🧹 1. Truncating parcels and dependent tables CASCADE...');
    await client.query(`
      TRUNCATE TABLE parcels CASCADE;
    `);

    // Reset counts on metro_zones
    await client.query(`
      UPDATE metro_zones 
      SET total_parcels_count = 0, approved_parcels_count = 0;
    `);

    console.log('✅ All parcels and survey records cleaned! Current parcels count: 0.');

    // 2. Ensure metro_construction_type_enum exists
    await client.query(`
      DO $$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'metro_construction_type_enum') THEN
          CREATE TYPE metro_construction_type_enum AS ENUM ('C&C', 'POR', 'ELV', 'DEP');
        END IF;
      END $$;
    `);

    // 3. Update parcels table columns to match DB_GIS.md
    console.log('🛠️ 2. Updating parcels table schema...');
    await client.query(`
      ALTER TABLE parcels 
        ADD COLUMN IF NOT EXISTS segment_type metro_construction_type_enum NOT NULL DEFAULT 'C&C',
        ADD COLUMN IF NOT EXISTS code_slug VARCHAR(32);
      
      -- Ensure project_parcel_code has varchar(32)
      ALTER TABLE parcels ALTER COLUMN project_parcel_code TYPE VARCHAR(32);
      
      -- Ensure official_cadastral_code has unique constraint
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

    // 4. Create metro_segments table if not exists
    console.log('🛠️ 3. Creating metro_segments table...');
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

    // 5. Populate metro_alignments (Metro Line 2 Centerline)
    console.log('📍 4. Populating metro_alignments (Tim tuyến Metro 2)...');
    await client.query('DELETE FROM metro_alignments;');

    // Build LineString WKT from all 12 waypoints
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

    // 6. Populate metro_segments (22 Zones)
    console.log('🗺️ 5. Populating 22 Zones in metro_segments...');
    await client.query('DELETE FROM metro_segments;');

    for (const z of ZONES_22_CONFIG) {
      // Centerline for this segment: line connecting (lat, lng) to (nextLat, nextLng)
      const segLineWkt = `LINESTRING(${z.lng} ${z.lat}, ${z.nextLng} ${z.nextLat})`;
      
      // Buffer polygon calculated via ST_Buffer with meters (via geography cast)
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
        z.index,
        z.code,
        z.name,
        z.type,
        z.startKm,
        z.endKm,
        z.zoi,
        segLineWkt,
        z.zoi,
      ]);
    }

    // 7. Ensure metro_zones has records for ZONE_01 to ZONE_22 as well
    console.log('🏢 6. Synchronizing metro_zones table with 22 zones...');
    for (const z of ZONES_22_CONFIG) {
      await client.query(`
        INSERT INTO metro_zones (
          zone_code, zone_name, total_parcels_count, approved_parcels_count,
          center_geom, boundary_geom
        )
        SELECT 
          segment_code, segment_name, 0, 0,
          ST_SetSRID(ST_MakePoint($2, $3), 4326),
          zoi_polygon_geom
        FROM metro_segments WHERE segment_code = $1
        ON CONFLICT (zone_code) DO UPDATE 
        SET 
          zone_name = EXCLUDED.zone_name,
          center_geom = EXCLUDED.center_geom,
          boundary_geom = EXCLUDED.boundary_geom,
          total_parcels_count = 0,
          approved_parcels_count = 0;
      `, [z.code, z.lng, z.lat]);
    }

    await client.query('COMMIT;');
    console.log('🎉 SUCCESS: Clean DB completed! 0 parcels, 22 metro_segments, 1 metro_alignment.');
  } catch (err) {
    await client.query('ROLLBACK;');
    console.error('❌ Failed:', err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

setupGisAndCleanDb();
