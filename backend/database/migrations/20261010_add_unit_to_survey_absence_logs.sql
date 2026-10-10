-- ============================================================================
-- MIGRATION: Bổ sung cột unit_id vào bảng survey_absence_logs
-- MỤC ĐÍCH: Cho phép ghi nhận vắng mặt / cửa khóa cho từng căn hộ con và khu vực master
-- TÍNH CHẤT: Lũy kế, an toàn, không phá hủy dữ liệu (Idempotent)
-- ============================================================================

ALTER TABLE survey_absence_logs 
ADD COLUMN IF NOT EXISTS unit_id UUID REFERENCES building_units(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_absence_unit ON survey_absence_logs(unit_id);
