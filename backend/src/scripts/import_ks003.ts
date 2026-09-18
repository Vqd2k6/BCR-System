import fs from 'fs';
import path from 'path';
import { Pool } from 'pg';

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5433'),
  user: process.env.DB_USER || 'metro2_user',
  password: process.env.DB_PASSWORD || 'metro2_secure_password',
  database: process.env.DB_NAME || 'metro2_gis_db',
  max: 10,
});

const STATIONS = [
  { code: 'ZONE_S1', name: 'Ga S1 - Bến Thành', lat: 10.7715, lng: 106.6983 },
  { code: 'ZONE_S2', name: 'Ga S2 - Tao Đàn', lat: 10.7761, lng: 106.6908 },
  { code: 'ZONE_S3', name: 'Ga S3 - Dân Chủ', lat: 10.7818, lng: 106.6811 },
  { code: 'ZONE_S4', name: 'Ga S4 - Hòa Hưng', lat: 10.7845, lng: 106.6734 },
  { code: 'ZONE_S5', name: 'Ga S5 - Lê Thị Riêng', lat: 10.7876, lng: 106.6662 },
  { code: 'ZONE_S6', name: 'Ga S6 - Phạm Văn Hai', lat: 10.7912, lng: 106.6578 },
  { code: 'ZONE_S7', name: 'Ga S7 - Bảy Hiền', lat: 10.7947, lng: 106.6515 },
  { code: 'ZONE_S8', name: 'Ga S8 - Nguyễn Hồng Đào', lat: 10.7988, lng: 106.6453 },
  { code: 'ZONE_S9', name: 'Ga S9 - Bà Quẹo', lat: 10.8034, lng: 106.6385 },
  { code: 'ZONE_S10', name: 'Ga S10 - Phạm Văn Bạch', lat: 10.8123, lng: 106.6301 },
  { code: 'ZONE_S11', name: 'Ga S11 - Tân Bình', lat: 10.8245, lng: 106.6192 },
];

function getClosestStation(lat: number, lng: number) {
  let minD = Infinity;
  let closest = STATIONS[0];
  for (const s of STATIONS) {
    const d = (s.lat - lat) ** 2 + (s.lng - lng) ** 2;
    if (d < minD) {
      minD = d;
      closest = s;
    }
  }
  return closest;
}

// Distance along corridor from S1 to S11 (for sequential chainage ordering)
function getCorridorProjection(lat: number, lng: number): number {
  const originLat = 10.7715;
  const originLng = 106.6983;
  // Direction vector towards S11 (approx northwest: dx < 0, dy > 0)
  const dLat = lat - originLat;
  const dLng = lng - originLng;
  return dLat * 0.7 - dLng * 0.7; // higher means further northwest along corridor
}

async function runImport() {
  console.log('🚀 Starting ETL Import for KS003 Cadastral Data into PostGIS...');
  const jsonPath = path.resolve(__dirname, '../../../data/KS003/ban_do_data.json');
  if (!fs.existsSync(jsonPath)) {
    console.error('File not found:', jsonPath);
    process.exit(1);
  }

  const raw = fs.readFileSync(jsonPath, 'utf8');
  const data = JSON.parse(raw);
  const rawParcels = Object.values(data.parcels || {}) as any[];
  console.log(`📦 Loaded ${rawParcels.length} raw parcels from KS003.`);

  // Filter valid parcels with ranh_coords
  const validParcels = rawParcels.filter(p => p.latitude && p.longitude && p.ranh_coords && p.ranh_coords.length >= 3);
  console.log(`✅ Valid parcels with geometry: ${validParcels.length}`);

  // Sort sequentially along the Metro 2 corridor from S1 to S11
  validParcels.sort((a, b) => getCorridorProjection(a.latitude, a.longitude) - getCorridorProjection(b.latitude, b.longitude));

  const client = await pool.connect();
  try {
    await client.query('BEGIN;');

    console.log('🧹 Cleaning old test parcels...');
    await client.query(`DELETE FROM parcels;`);

    console.log('📥 Inserting parcels in batch transactions...');
    let inserted = 0;
    const batchSize = 100;

    for (let i = 0; i < validParcels.length; i += batchSize) {
      const chunk = validParcels.slice(i, i + batchSize);
      for (const p of chunk) {
        const parcelIndex = inserted + 1;
        const projectParcelCode = `B-${String(parcelIndex).padStart(5, '0')}`;
        const closestStation = getClosestStation(p.latitude, p.longitude);
        const officialCadastralCode = `T${p.soto || '0'}-Th${p.sothua || '0'}-${p.mathuadat || parcelIndex}`;
        const houseNumber = p.sothua ? `${p.sothua}` : `${parcelIndex}`;
        const street = p.tenphuongxa ? `Đường chính, ${p.tenphuongxa}` : 'Đường Trường Chinh';
        const ward = p.tenphuongxa || 'Phường 15';
        const district = p.tenquanhuyen || 'Quận Tân Bình';
        const landArea = p.dientich || 65.0;
        const constructionArea = Math.round(landArea * 0.8 * 10) / 10;
        const floorCount = Math.min(5, Math.max(1, Math.floor((parcelIndex % 4) + 1)));

        // Distributed statuses for demo and testing
        let surveyStatus = 'NOT_SURVEYED';
        if (parcelIndex % 10 === 0) {
          surveyStatus = 'APPROVED_PHASE2';
        } else if (parcelIndex % 5 === 0) {
          surveyStatus = 'APPROVED';
        } else if (parcelIndex % 7 === 0) {
          surveyStatus = 'IN_PROGRESS';
        } else if (parcelIndex % 13 === 0) {
          surveyStatus = 'POSTPONED_ABSENT';
        }

        // Format PostGIS Polygon: POLYGON((lng lat, lng lat, ...))
        // Note: ranh_coords in ban_do_data.json is [lat, lng]
        let coordsList = p.ranh_coords.map(([lat, lng]: [number, number]) => `${lng} ${lat}`);
        // Ensure closed ring
        if (coordsList[0] !== coordsList[coordsList.length - 1]) {
          coordsList.push(coordsList[0]);
        }
        const wktPolygon = `POLYGON((${coordsList.join(', ')}))`;

        await client.query(
          `INSERT INTO parcels (
            zone_id,
            official_cadastral_code,
            project_parcel_code,
            field_survey_code,
            house_number,
            street,
            ward,
            district,
            owner_name,
            owner_phone,
            land_area_m2,
            construction_area_m2,
            floor_count,
            importance_group,
            adjacent_type,
            location_geom,
            cadastral_polygon_geom,
            footprint_polygon_geom,
            survey_status,
            lifecycle_status
          ) VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15,
            ST_SetSRID(ST_MakePoint($16, $17), 4326),
            ST_SetSRID(ST_PolygonFromText($18), 4326),
            ST_SetSRID(ST_PolygonFromText($18), 4326),
            $19, 'ACTIVE'
          );`,
          [
            closestStation.code,
            officialCadastralCode,
            projectParcelCode,
            `KS003-${p.mathuadat || parcelIndex}`,
            houseNumber,
            street,
            ward,
            district,
            `Chủ hộ thửa ${p.sothua || parcelIndex}`,
            '0908' + String(100000 + (parcelIndex % 900000)),
            landArea,
            constructionArea,
            floorCount,
            floorCount >= 4 ? 'IMPORTANT' : 'GENERAL',
            'TOWNHOUSE',
            p.longitude,
            p.latitude,
            wktPolygon,
            surveyStatus,
          ]
        );

        inserted++;
      }
      console.log(`... Inserted ${inserted}/${validParcels.length} parcels (${Math.round((inserted / validParcels.length) * 100)}%)`);
    }

    // Update metro_zones counts
    await client.query(`
      UPDATE metro_zones z
      SET total_parcels_count = (SELECT COUNT(*) FROM parcels p WHERE p.zone_id = z.zone_code),
          approved_parcels_count = (SELECT COUNT(*) FROM parcels p WHERE p.zone_id = z.zone_code AND p.survey_status = 'APPROVED');
    `);

    await client.query('COMMIT;');
    console.log(`🎉 SUCCESS: Fully imported ${inserted} parcels into PostGIS.`);
  } catch (err) {
    await client.query('ROLLBACK;');
    console.error('❌ Error importing parcels:', err);
  } finally {
    client.release();
    await pool.end();
  }
}

runImport();
