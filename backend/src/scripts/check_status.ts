import { pool } from '../database/db';

async function cols() {
  try {
    const users = await pool.query(`SELECT username, role, status FROM users;`);
    console.log('Users in DB:');
    console.table(users.rows);

    const parcelCount = await pool.query(`
      SELECT zone_id, count(*), min(project_parcel_code) as min_code, max(project_parcel_code) as max_code 
      FROM parcels 
      GROUP BY zone_id 
      ORDER BY zone_id;
    `);
    console.log('\nParcels by zone_id in DB:');
    console.table(parcelCount.rows);

    const samples = await pool.query(`
      SELECT id, project_parcel_code, official_cadastral_code, zone_id, survey_status,
             ST_AsGeoJSON(cadastral_polygon_geom) as cadastral_geojson
      FROM parcels 
      LIMIT 2;
    `);
    console.log('\nSample parcels:');
    for (const s of samples.rows) {
      console.log(`- ${s.project_parcel_code} (${s.official_cadastral_code}), zone: ${s.zone_id}, hasGeo: ${!!s.cadastral_geojson}`);
    }
  } catch (err: any) {
    console.error(err);
  } finally {
    await pool.end();
  }
}

cols();
