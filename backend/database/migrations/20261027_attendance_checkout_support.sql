-- ============================================================================
-- MIGRATION: 20261027_attendance_checkout_support.sql
-- MỤC ĐÍCH: Bổ sung các cột Check-out chấm công kết thúc ca làm việc thực địa
-- cho cả Khảo sát viên (KSV) và Cán bộ đi kèm (Companion) trong bảng timekeeping_checkins
-- ============================================================================

ALTER TABLE timekeeping_checkins
  ADD COLUMN IF NOT EXISTS checkout_time TIMESTAMPTZ DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS checkout_gps_location GEOMETRY(Point, 4326) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS checkout_distance_to_zone_center_meters NUMERIC(10,2) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS checkout_selfie_photo_url TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS checkout_notes TEXT DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS work_duration_minutes INT DEFAULT NULL;

CREATE INDEX IF NOT EXISTS idx_checkins_checkout_time
  ON timekeeping_checkins(surveyor_id, is_companion, checkout_time)
  WHERE deleted_at IS NULL;

