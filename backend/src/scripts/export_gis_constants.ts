import { pool } from '../database/db';
import fs from 'fs';
import path from 'path';

async function exportGisConstants() {
  try {
    const alignRes = await pool.query(`
      SELECT ST_AsGeoJSON(centerline_geom)::json AS centerline
      FROM metro_alignments LIMIT 1;
    `);

    const segsRes = await pool.query(`
      SELECT 
        zone_index, segment_code, segment_name, construction_type,
        start_chainage_km, end_chainage_km, zoi_buffer_meters,
        ST_AsGeoJSON(centerline_geom)::json AS centerline,
        ST_AsGeoJSON(zoi_polygon_geom)::json AS zoi_polygon,
        ST_Y(ST_Centroid(zoi_polygon_geom)) AS center_lat,
        ST_X(ST_Centroid(zoi_polygon_geom)) AS center_lng
      FROM metro_segments
      ORDER BY zone_index ASC;
    `);

    console.log('Exporting GIS constants from PostGIS...');
    const result = {
      centerline: alignRes.rows[0].centerline.coordinates.map(([lng, lat]: [number, number]) => [lat, lng]),
      segments: segsRes.rows.map(r => ({
        index: r.zone_index,
        code: r.segment_code,
        name: r.segment_name,
        type: r.construction_type,
        startKm: r.start_chainage_km,
        endKm: r.end_chainage_km,
        zoi: parseFloat(r.zoi_buffer_meters),
        center: [parseFloat(r.center_lat), parseFloat(r.center_lng)],
        lineCoords: r.centerline.coordinates.map(([lng, lat]: [number, number]) => [lat, lng]),
        polygonCoords: r.zoi_polygon.coordinates[0].map(([lng, lat]: [number, number]) => [lat, lng])
      }))
    };

    console.log(`Generated ${result.segments.length} segment polygons. Centerline has ${result.centerline.length} waypoints.`);
    const targetFile = path.resolve(__dirname, '../../../frontend/src/features/survey-phase1/constants/metroGisConstants.json');
    fs.writeFileSync(targetFile, JSON.stringify(result, null, 2), 'utf8');
    console.log(`Saved to: ${targetFile}`);
  } catch (e: any) {
    console.error('Error exporting GIS constants:', e);
  } finally {
    await pool.end();
  }
}

exportGisConstants();
