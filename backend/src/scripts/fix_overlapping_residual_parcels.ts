import { Pool } from 'pg';

async function fixOverlappingParcels() {
  const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT) || 5433,
    user: process.env.DB_USER || 'metro2_user',
    password: process.env.DB_PASSWORD || 'metro2_secure_password',
    database: process.env.DB_NAME || 'metro2_gis_db',
  });

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    console.log('🚀 Bắt đầu khôi phục ranh giới phân định cho các thửa dôi dư bị đè lấn...');

    // 1. Sửa chữa cặp C&C-01-B-0108 (234.2 m²) và C&C-01-B-0108-DU (30.1 m²)
    const p108Res = await client.query<{
      chinh_id: string;
      du_id: string;
      full_geom: string;
    }>(
      `SELECT a.id as chinh_id, b.id as du_id, ST_AsText(a.cadastral_polygon_geom) as full_geom
       FROM parcels a, parcels b
       WHERE a.project_parcel_code = 'C&C-01-B-0108' AND b.project_parcel_code = 'C&C-01-B-0108-DU';`
    );

    if (p108Res.rows.length > 0) {
      const { chinh_id, du_id } = p108Res.rows[0];
      console.log(`📌 Phân tách ranh giới cho C&C-01-B-0108 & C&C-01-B-0108-DU...`);

      const partitionRes = await client.query<{
        geom_chinh: string;
        geom_du: string;
        area_chinh: number;
        area_du: number;
      }>(
        `WITH full_p AS (
           SELECT cadastral_polygon_geom as geom FROM parcels WHERE id = $1
         ),
         cut_step AS (
           SELECT 
             p.geom,
             CASE 
               WHEN (ST_XMax(p.geom) - ST_XMin(p.geom)) >= (ST_YMax(p.geom) - ST_YMin(p.geom)) THEN
                 ST_GeometryN(ST_CollectionExtract(ST_MakeValid(ST_Intersection(
                   p.geom,
                   ST_MakeEnvelope(
                     ST_XMin(p.geom),
                     ST_YMin(p.geom),
                     ST_XMin(p.geom) + (ST_XMax(p.geom) - ST_XMin(p.geom)) * 0.886,
                     ST_YMax(p.geom),
                     4326
                   )
                 )), 3), 1)
               ELSE
                 ST_GeometryN(ST_CollectionExtract(ST_MakeValid(ST_Intersection(
                   p.geom,
                   ST_MakeEnvelope(
                     ST_XMin(p.geom),
                     ST_YMin(p.geom),
                     ST_XMax(p.geom),
                     ST_YMin(p.geom) + (ST_YMax(p.geom) - ST_YMin(p.geom)) * 0.886,
                     4326
                   )
                 )), 3), 1)
             END as geom_chinh
           FROM full_p p
         ),
         diff_step AS (
           SELECT 
             c.geom_chinh,
             ST_GeometryN(ST_CollectionExtract(ST_MakeValid(ST_Difference(c.geom, c.geom_chinh)), 3), 1) as geom_du
           FROM cut_step c
         )
         SELECT 
           ST_AsText(geom_chinh) as geom_chinh,
           ST_AsText(geom_du) as geom_du,
           ROUND(ST_Area(geom_chinh::geography)::numeric, 1) as area_chinh,
           ROUND(ST_Area(geom_du::geography)::numeric, 1) as area_du
         FROM diff_step;`,
        [chinh_id]
      );

      if (partitionRes.rows.length > 0) {
        const { geom_chinh, geom_du, area_chinh, area_du } = partitionRes.rows[0];

        await client.query(
          `UPDATE parcels
           SET cadastral_polygon_geom = ST_GeomFromText($1, 4326),
               footprint_polygon_geom = ST_GeomFromText($1, 4326),
               location_geom = ST_Centroid(ST_GeomFromText($1, 4326)),
               land_area_m2 = 234.2,
               construction_area_m2 = 234.2,
               updated_at = NOW()
           WHERE id = $2;`,
          [geom_chinh, chinh_id]
        );

        await client.query(
          `UPDATE parcels
           SET cadastral_polygon_geom = ST_GeomFromText($1, 4326),
               footprint_polygon_geom = ST_GeomFromText($1, 4326),
               location_geom = ST_Centroid(ST_GeomFromText($1, 4326)),
               land_area_m2 = 30.1,
               construction_area_m2 = 0,
               updated_at = NOW()
           WHERE id = $2;`,
          [geom_du, du_id]
        );

        console.log(`✅ Đã phân tách thành công C&C-01-B-0108 (${area_chinh}m²) và C&C-01-B-0108-DU (${area_du}m²).`);
      }
    }

    // 2. Sửa chữa cặp C&C-05-B-0193 và C&C-05-B-0194
    const p193Res = await client.query<{
      id_193: string;
      id_194: string;
    }>(
      `SELECT a.id as id_193, b.id as id_194
       FROM parcels a, parcels b
       WHERE a.project_parcel_code = 'C&C-05-B-0193' AND b.project_parcel_code = 'C&C-05-B-0194' AND ST_Equals(a.cadastral_polygon_geom, b.cadastral_polygon_geom);`
    );

    if (p193Res.rows.length > 0) {
      const { id_193, id_194 } = p193Res.rows[0];
      console.log(`📌 Phân tách ranh giới cho C&C-05-B-0193 & C&C-05-B-0194...`);

      const part193 = await client.query<{
        g1: string;
        g2: string;
      }>(
        `WITH full_p AS (
           SELECT cadastral_polygon_geom as geom FROM parcels WHERE id = $1
         ),
         cut_step AS (
           SELECT 
             p.geom,
             CASE 
               WHEN (ST_XMax(p.geom) - ST_XMin(p.geom)) >= (ST_YMax(p.geom) - ST_YMin(p.geom)) THEN
                 ST_GeometryN(ST_CollectionExtract(ST_MakeValid(ST_Intersection(
                   p.geom,
                   ST_MakeEnvelope(
                     ST_XMin(p.geom),
                     ST_YMin(p.geom),
                     ST_XMin(p.geom) + (ST_XMax(p.geom) - ST_XMin(p.geom)) * 0.5,
                     ST_YMax(p.geom),
                     4326
                   )
                 )), 3), 1)
               ELSE
                 ST_GeometryN(ST_CollectionExtract(ST_MakeValid(ST_Intersection(
                   p.geom,
                   ST_MakeEnvelope(
                     ST_XMin(p.geom),
                     ST_YMin(p.geom),
                     ST_XMax(p.geom),
                     ST_YMin(p.geom) + (ST_YMax(p.geom) - ST_YMin(p.geom)) * 0.5,
                     4326
                   )
                 )), 3), 1)
             END as g1
           FROM full_p p
         ),
         diff_step AS (
           SELECT 
             c.g1,
             ST_GeometryN(ST_CollectionExtract(ST_MakeValid(ST_Difference(c.geom, c.g1)), 3), 1) as g2
           FROM cut_step c
         )
         SELECT ST_AsText(g1) as g1, ST_AsText(g2) as g2 FROM diff_step;`,
        [id_193]
      );

      if (part193.rows.length > 0) {
        const { g1, g2 } = part193.rows[0];
        await client.query(
          `UPDATE parcels SET cadastral_polygon_geom = ST_GeomFromText($1, 4326), footprint_polygon_geom = ST_GeomFromText($1, 4326), location_geom = ST_Centroid(ST_GeomFromText($1, 4326)), updated_at = NOW() WHERE id = $2;`,
          [g1, id_193]
        );
        await client.query(
          `UPDATE parcels SET cadastral_polygon_geom = ST_GeomFromText($1, 4326), footprint_polygon_geom = ST_GeomFromText($1, 4326), location_geom = ST_Centroid(ST_GeomFromText($1, 4326)), updated_at = NOW() WHERE id = $2;`,
          [g2, id_194]
        );
        console.log(`✅ Đã phân tách thành công C&C-05-B-0193 và C&C-05-B-0194.`);
      }
    }

    await client.query('COMMIT');
    console.log('🎉 KHÔI PHỤC TOÀN DIỆN RANH GIỚI CÁC THỬA ĐẤT HOÀN TẤT THÀNH CÔNG!');
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('❌ Lỗi khôi phục ranh giới:', err);
    throw err;
  } finally {
    client.release();
    await pool.end();
  }
}

fixOverlappingParcels().catch(console.error);
