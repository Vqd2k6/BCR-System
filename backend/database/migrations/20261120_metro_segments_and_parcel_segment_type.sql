-- ============================================================================
-- MIGRATION: 20261120_metro_segments_and_parcel_segment_type.sql
-- Dự án: Hệ Thống Khảo Sát Hiện Trạng Công Trình Tuyến Metro Số 2 (BCS Platform)
--
-- Mục đích:
--   Đưa vào luồng migration chính thức các đối tượng đã có trên Production nhưng trước đây
--   chỉ được tạo bằng script chạy tay (deploy_5zones_to_cloud.ts, setup_gis_and_clean_db.ts):
--     1. Enum metro_construction_type_enum ('C&C', 'POR', 'ELV', 'DEP')
--     2. Bảng metro_segments (+ index)
--     3. Cột parcels.segment_type
--   App đọc metro_segments ở survey-base.repository, snapshot-builder, audit-review.service,
--   cadastral.repository ⇒ DB dựng mới thiếu bảng này sẽ lỗi 500 khi mở hồ sơ/report.
--
-- An toàn:
--   - Toàn bộ idempotent (IF NOT EXISTS). Trên Production (đã có đủ) migration không thay đổi gì.
--   - Định nghĩa khớp backup full 20261001 và các script tạo bảng.
--   - Không xoá, không cập nhật dữ liệu.
-- ============================================================================

-- 1. Enum loại hình thi công đoạn tuyến
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'metro_construction_type_enum') THEN
    CREATE TYPE metro_construction_type_enum AS ENUM ('C&C', 'POR', 'ELV', 'DEP');
  END IF;
END $$;

-- 2. Bảng phân đoạn tuyến Metro (mỗi Zone một đoạn)
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

-- 3. Loại hình thi công của thửa (giống Production: NOT NULL DEFAULT 'C&C')
ALTER TABLE parcels
  ADD COLUMN IF NOT EXISTS segment_type metro_construction_type_enum NOT NULL DEFAULT 'C&C';
