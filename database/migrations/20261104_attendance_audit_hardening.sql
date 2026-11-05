-- ============================================================================
-- MIGRATION: 20261104_attendance_audit_hardening.sql
-- MỤC ĐÍCH (GĐ 0 – Vá backend phân hệ Chấm công trước khi làm giao diện Admin):
--   1. Tách cờ hệ thống (anomaly_codes) khỏi trạng thái duyệt của Admin (verification_status)
--   2. Lưu snapshot tâm Zone + độ chính xác GPS lúc Check-in / Check-out (chứng cứ pháp lý)
--   3. Backfill dữ liệu cũ: cờ khoảng cách / thời lượng; ca FLAGGED_WARNING chưa ai duyệt -> PENDING
--   4. Ràng buộc 1 ca chính / KSV / ngày VN (chỉ tạo khi dữ liệu cũ không trùng; KHÔNG xóa dữ liệu)
--   5. Bảng kỳ công tháng (attendance_periods) + lịch sử snapshot SHA-256 (attendance_period_snapshots)
-- Idempotent: chạy lại nhiều lần không đổi kết quả.
-- ============================================================================

-- 1 & 2. Cột mới
ALTER TABLE timekeeping_checkins
  ADD COLUMN IF NOT EXISTS anomaly_codes TEXT[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS gps_accuracy_meters NUMERIC(10,2) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS checkout_gps_accuracy_meters NUMERIC(10,2) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS zone_center_lng DOUBLE PRECISION DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS zone_center_lat DOUBLE PRECISION DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS checkout_zone_center_lng DOUBLE PRECISION DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS checkout_zone_center_lat DOUBLE PRECISION DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS assigned_zone_at_checkin VARCHAR(32) DEFAULT NULL;

CREATE INDEX IF NOT EXISTS idx_checkins_zone_status_time
  ON timekeeping_checkins(zone_id, verification_status, checkin_time DESC)
  WHERE deleted_at IS NULL;

-- 3a. Backfill cờ hệ thống cho ca cũ chưa có cờ (tính lại từ số liệu đã lưu, không suy diễn)
UPDATE timekeeping_checkins t
SET anomaly_codes = ARRAY_REMOVE(ARRAY[
      CASE WHEN t.distance_to_zone_center_meters > 500 THEN 'DISTANCE_OVER_500M_IN' END,
      CASE WHEN t.checkout_distance_to_zone_center_meters > 500 THEN 'DISTANCE_OVER_500M_OUT' END,
      CASE WHEN t.work_duration_minutes IS NOT NULL AND t.work_duration_minutes < 30 THEN 'SHORT_DURATION' END
    ], NULL)
WHERE t.deleted_at IS NULL
  AND t.anomaly_codes = '{}'
  AND (
    t.distance_to_zone_center_meters > 500
    OR t.checkout_distance_to_zone_center_meters > 500
    OR (t.work_duration_minutes IS NOT NULL AND t.work_duration_minutes < 30)
  );

-- 3b. Ca bị hệ thống tự gán FLAGGED_WARNING lúc check-in (chưa có Admin nào duyệt) -> trả về PENDING.
--     Ghi audit cho từng ca được chuyển trạng thái.
WITH reverted AS (
  UPDATE timekeeping_checkins
  SET verification_status = 'PENDING_VERIFICATION'
  WHERE deleted_at IS NULL
    AND verification_status = 'FLAGGED_WARNING'
    AND verified_by_user_id IS NULL
  RETURNING id, anomaly_codes
)
INSERT INTO system_audit_logs (entity_type, entity_id, action, performed_by_user_id, client_ip, diff_payload)
SELECT 'TIMEKEEPING_CHECKIN', r.id, 'SYSTEM_BACKFILL_STATUS', NULL, NULL,
       jsonb_build_object(
         'previousStatus', 'FLAGGED_WARNING',
         'newStatus', 'PENDING_VERIFICATION',
         'reason', 'Tách cờ hệ thống khỏi trạng thái duyệt (migration 20261104)',
         'anomalyCodes', to_jsonb(r.anomaly_codes)
       )
FROM reverted r;

-- 4. 1 ca chính / KSV / ngày VN. Có dữ liệu trùng thì KHÔNG tạo index và KHÔNG xóa gì, chỉ báo.
DO $$
DECLARE
  dup_count INT;
BEGIN
  SELECT COUNT(*) INTO dup_count FROM (
    SELECT surveyor_id, (checkin_time AT TIME ZONE 'Asia/Ho_Chi_Minh')::date
    FROM timekeeping_checkins
    WHERE is_companion = FALSE AND deleted_at IS NULL
    GROUP BY 1, 2
    HAVING COUNT(*) > 1
  ) d;

  IF dup_count > 0 THEN
    RAISE WARNING '[20261104] Có % cặp (KSV, ngày) đang có >1 ca chính. Bỏ qua tạo uq_checkin_main_per_day; service vẫn chặn ca mới. Cần người dùng quyết định giữ ca nào.', dup_count;
  ELSE
    EXECUTE 'CREATE UNIQUE INDEX IF NOT EXISTS uq_checkin_main_per_day
             ON timekeeping_checkins(surveyor_id, ((checkin_time AT TIME ZONE ''Asia/Ho_Chi_Minh'')::date))
             WHERE is_companion = FALSE AND deleted_at IS NULL';
  END IF;
END $$;

-- 5. Kỳ công tháng
CREATE TABLE IF NOT EXISTS attendance_periods (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  zone_id VARCHAR(32) NOT NULL,
  period_month CHAR(7) NOT NULL CHECK (period_month ~ '^[0-9]{4}-[0-9]{2}$'),
  status VARCHAR(16) NOT NULL DEFAULT 'OPEN' CHECK (status IN ('OPEN', 'LOCKED')),
  current_snapshot_id UUID DEFAULT NULL,
  locked_by UUID REFERENCES users(id) ON DELETE SET NULL,
  locked_at TIMESTAMPTZ DEFAULT NULL,
  unlocked_by UUID REFERENCES users(id) ON DELETE SET NULL,
  unlocked_at TIMESTAMPTZ DEFAULT NULL,
  unlock_reason TEXT DEFAULT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT uq_attendance_period_zone_month UNIQUE (zone_id, period_month)
);

CREATE INDEX IF NOT EXISTS idx_attendance_periods_month_status
  ON attendance_periods(period_month, status);

CREATE TABLE IF NOT EXISTS attendance_period_snapshots (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  period_id UUID NOT NULL REFERENCES attendance_periods(id),
  zone_id VARCHAR(32) NOT NULL,
  period_month CHAR(7) NOT NULL,
  snapshot_json JSONB NOT NULL,
  snapshot_sha256 CHAR(64) NOT NULL,
  locked_by UUID REFERENCES users(id) ON DELETE SET NULL,
  locked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  unlocked_by UUID REFERENCES users(id) ON DELETE SET NULL,
  unlocked_at TIMESTAMPTZ DEFAULT NULL,
  unlock_reason TEXT DEFAULT NULL
);

CREATE INDEX IF NOT EXISTS idx_attendance_period_snapshots_period
  ON attendance_period_snapshots(period_id, locked_at DESC);
