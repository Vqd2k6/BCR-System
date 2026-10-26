-- ============================================================================
-- Migration: 20261026_attendance_companion_and_zone_sync.sql
-- Purpose:
--   1. Add companion check-in columns and soft-delete support to timekeeping_checkins
--   2. Sync baseline metro_zones (ZONE_01..ZONE_09 & ZONE_S1..ZONE_S11) and compute
--      exact PostGIS parcel centroids where parcels exist
-- ============================================================================

-- 1. Mở rộng bảng timekeeping_checkins hỗ trợ Điểm danh Cán bộ đi kèm (Companion) & Soft Delete
ALTER TABLE timekeeping_checkins
  ADD COLUMN IF NOT EXISTS is_companion BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS companion_name VARCHAR(128),
  ADD COLUMN IF NOT EXISTS companion_role VARCHAR(128),
  ADD COLUMN IF NOT EXISTS companion_phone VARCHAR(32),
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;

CREATE INDEX IF NOT EXISTS idx_checkins_surveyor_companion_time
  ON timekeeping_checkins(surveyor_id, is_companion, checkin_time DESC)
  WHERE deleted_at IS NULL;

-- 2. Làm sạch khóa ngoại assigned_admin_id mồ côi (nếu có) trên metro_zones trước khi đồng bộ tọa độ
UPDATE metro_zones
SET assigned_admin_id = NULL
WHERE assigned_admin_id IS NOT NULL
  AND NOT EXISTS (SELECT 1 FROM users u WHERE u.id = metro_zones.assigned_admin_id);

-- 3. Đảm bảo đầy đủ các phân khu chuẩn (ZONE_01..ZONE_09 & ZONE_S1..ZONE_S11) trong bảng metro_zones
INSERT INTO metro_zones (zone_code, zone_name, center_geom, is_active)
VALUES
  ('ZONE_01', 'Zone 1: Ga S1 Bến Thành (C&C)', ST_SetSRID(ST_MakePoint(106.696946, 10.770876), 4326), TRUE),
  ('ZONE_02', 'Zone 2: Hầm TBM Bến Thành -> Tao Đàn (POR)', ST_SetSRID(ST_MakePoint(106.694800, 10.771500), 4326), TRUE),
  ('ZONE_03', 'Zone 3: Ga S2 Tao Đàn (C&C)', ST_SetSRID(ST_MakePoint(106.690138, 10.773237), 4326), TRUE),
  ('ZONE_04', 'Zone 4: Hầm TBM Tao Đàn -> Dân Chủ (POR)', ST_SetSRID(ST_MakePoint(106.687500, 10.774500), 4326), TRUE),
  ('ZONE_08', 'Zone 8: Hầm TBM Hòa Hưng -> Lê Thị Riêng (POR)', ST_SetSRID(ST_MakePoint(106.669262, 10.784328), 4326), TRUE),
  ('ZONE_09', 'Zone 9: Ga S5 Lê Thị Riêng (C&C)', ST_SetSRID(ST_MakePoint(106.665623, 10.786163), 4326), TRUE),
  ('ZONE_S1', 'Ga S1 - Bến Thành', ST_SetSRID(ST_MakePoint(106.696694, 10.770830), 4326), TRUE),
  ('ZONE_S2', 'Ga S2 - Tao Đàn', ST_SetSRID(ST_MakePoint(106.690134, 10.774130), 4326), TRUE),
  ('ZONE_S3', 'Ga S3 - Dân Chủ', ST_SetSRID(ST_MakePoint(106.678489, 10.777797), 4326), TRUE),
  ('ZONE_S4', 'Ga S4 - Hòa Hưng', ST_SetSRID(ST_MakePoint(106.672859, 10.782510), 4326), TRUE),
  ('ZONE_S5', 'Ga S5 - Lê Thị Riêng', ST_SetSRID(ST_MakePoint(106.665315, 10.786061), 4326), TRUE),
  ('ZONE_S6', 'Ga S6 - Phạm Văn Hai', ST_SetSRID(ST_MakePoint(106.658081, 10.790290), 4326), TRUE),
  ('ZONE_S7', 'Ga S7 - Bảy Hiền', ST_SetSRID(ST_MakePoint(106.652375, 10.793561), 4326), TRUE),
  ('ZONE_S8', 'Ga S8 - Nguyễn Hồng Đào', ST_SetSRID(ST_MakePoint(106.644632, 10.797605), 4326), TRUE),
  ('ZONE_S9', 'Ga S9 - Bà Quẹo', ST_SetSRID(ST_MakePoint(106.637211, 10.802564), 4326), TRUE),
  ('ZONE_S10', 'Ga S10 - Phạm Văn Bạch', ST_SetSRID(ST_MakePoint(106.630708, 10.815381), 4326), TRUE),
  ('ZONE_S11', 'Ga S11 - Tân Bình / Tham Lương', ST_SetSRID(ST_MakePoint(106.625132, 10.821594), 4326), TRUE)
ON CONFLICT (zone_code) DO UPDATE
SET center_geom = COALESCE(metro_zones.center_geom, EXCLUDED.center_geom);

-- 4. Cập nhật trọng tâm hình học thực tế từ các thửa đất trong bảng parcels (nếu phân khu đã có dữ liệu thửa đất)
WITH zone_parcel_centroids AS (
  SELECT
    p.zone_id,
    ST_SetSRID(ST_Centroid(ST_Union(COALESCE(p.cadastral_polygon_geom, p.location_geom))), 4326) AS computed_center
  FROM parcels p
  WHERE p.cadastral_polygon_geom IS NOT NULL OR p.location_geom IS NOT NULL
  GROUP BY p.zone_id
)
UPDATE metro_zones mz
SET center_geom = zpc.computed_center
FROM zone_parcel_centroids zpc
WHERE mz.zone_code = zpc.zone_id
  AND zpc.computed_center IS NOT NULL;
