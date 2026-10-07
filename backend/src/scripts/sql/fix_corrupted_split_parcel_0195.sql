-- SCRIPT KHẮC PHỤC DỮ LIỆU HÌNH HỌC GIS BỊ LỖI CO RÚT SAU KHI TÁCH THỬA
-- Khôi phục ranh đất chuẩn cho thửa cha C&C-05-B-0001 và thửa tách dôi dư C&C-05-B-0195 tại Ga S5 Lê Thị Riêng (Zone 9)

BEGIN;

WITH orig AS (
  SELECT ST_SetSRID('POLYGON((106.66576998434849 10.786514421496971,106.66572097454095 10.786423530173364,106.6656961422343 10.786436079304334,106.66574588186818 10.786526426052534,106.66576998434849 10.786514421496971))'::geometry, 4326) as geom
),
cut AS (
  SELECT 
    ST_Intersection(orig.geom, ST_MakeEnvelope(106.66568, 10.78641, 106.66578, 10.786485, 4326)) as geom_a,
    ST_Difference(orig.geom, ST_Intersection(orig.geom, ST_MakeEnvelope(106.66568, 10.78641, 106.66578, 10.786485, 4326))) as geom_b
  FROM orig
)
UPDATE parcels p
SET 
  cadastral_polygon_geom = c.geom_a,
  footprint_polygon_geom = c.geom_a,
  location_geom = ST_Centroid(c.geom_a),
  land_area_m2 = ROUND(ST_Area(c.geom_a::geography)::numeric, 1),
  construction_area_m2 = ROUND(ST_Area(c.geom_a::geography)::numeric, 1),
  updated_at = NOW()
FROM cut c
WHERE p.project_parcel_code = 'C&C-05-B-0001';

WITH orig AS (
  SELECT ST_SetSRID('POLYGON((106.66576998434849 10.786514421496971,106.66572097454095 10.786423530173364,106.6656961422343 10.786436079304334,106.66574588186818 10.786526426052534,106.66576998434849 10.786514421496971))'::geometry, 4326) as geom
),
cut AS (
  SELECT 
    ST_Intersection(orig.geom, ST_MakeEnvelope(106.66568, 10.78641, 106.66578, 10.786485, 4326)) as geom_a,
    ST_Difference(orig.geom, ST_Intersection(orig.geom, ST_MakeEnvelope(106.66568, 10.78641, 106.66578, 10.786485, 4326))) as geom_b
  FROM orig
)
UPDATE parcels p
SET 
  cadastral_polygon_geom = c.geom_b,
  footprint_polygon_geom = c.geom_b,
  location_geom = ST_Centroid(c.geom_b),
  land_area_m2 = ROUND(ST_Area(c.geom_b::geography)::numeric, 1),
  construction_area_m2 = 0,
  survey_status = 'NOT_SURVEYED',
  lifecycle_status = 'ACTIVE',
  updated_at = NOW()
FROM cut c
WHERE p.project_parcel_code = 'C&C-05-B-0195';

COMMIT;

-- Kiểm tra kết quả
SELECT 
  project_parcel_code, 
  house_number,
  owner_name,
  land_area_m2, 
  survey_status, 
  lifecycle_status, 
  ROUND(ST_Area(cadastral_polygon_geom::geography)::numeric, 1) as true_geom_area_m2,
  ST_GeometryType(cadastral_polygon_geom) as geom_type
FROM parcels 
WHERE project_parcel_code IN ('C&C-05-B-0001', 'C&C-05-B-0195')
ORDER BY project_parcel_code ASC;
