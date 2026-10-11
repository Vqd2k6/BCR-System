-- ============================================================================
-- MIGRATION: 20261012_condo_unit_absentee_support.sql
-- MỤC ĐÍCH: Hỗ trợ kịch bản vắng mặt / khóa cửa cho Khảo sát Căn Hộ Con (Condo Unit)
--           Bổ sung trường thông tin người chứng kiến, giấy hẹn dán cửa, và bộ ảnh biên bản
-- TÍNH CHẤT: Lũy kế, an toàn (Idempotent), Zero Hard-Delete
-- ============================================================================

-- 1. Bổ sung các giá trị enum lý do vắng mặt mới cho absence_reason_enum
ALTER TYPE absence_reason_enum ADD VALUE IF NOT EXISTS 'UNOCCUPIED_EMPTY';
ALTER TYPE absence_reason_enum ADD VALUE IF NOT EXISTS 'LOCKED_SECURITY';
ALTER TYPE absence_reason_enum ADD VALUE IF NOT EXISTS 'OTHER';

-- 2. Bổ sung các cột chi tiết người chứng kiến và biên bản vào survey_absence_logs
ALTER TABLE survey_absence_logs ADD COLUMN IF NOT EXISTS custom_reason TEXT;
ALTER TABLE survey_absence_logs ADD COLUMN IF NOT EXISTS witness_name VARCHAR(255);
ALTER TABLE survey_absence_logs ADD COLUMN IF NOT EXISTS witness_role VARCHAR(100);
ALTER TABLE survey_absence_logs ADD COLUMN IF NOT EXISTS witness_phone VARCHAR(50);
ALTER TABLE survey_absence_logs ADD COLUMN IF NOT EXISTS notice_delivered BOOLEAN DEFAULT FALSE;
ALTER TABLE survey_absence_logs ADD COLUMN IF NOT EXISTS minutes_photos_json JSONB DEFAULT '[]'::jsonb;

-- 3. Tạo chỉ mục tối ưu truy vấn vắng mặt theo unit_id
CREATE INDEX IF NOT EXISTS idx_survey_absence_logs_unit_id ON survey_absence_logs(unit_id) WHERE unit_id IS NOT NULL;
