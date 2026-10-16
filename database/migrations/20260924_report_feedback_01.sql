-- ============================================================================
-- BCS REPORT FEEDBACK #01 - DATABASE MIGRATION SCRIPT
-- ============================================================================

-- 1. Bổ sung liên kết Super Admin tạo Zone Admin & Thuộc tính Chữ ký số / Mã Surveyor
ALTER TABLE users 
  ADD COLUMN IF NOT EXISTS created_by_user_id UUID REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS signature_image_url TEXT,
  ADD COLUMN IF NOT EXISTS surveyor_code VARCHAR(16);

-- Tự động sinh surveyor_code cho các Surveyor hiện có nếu có SĐT
UPDATE users 
SET surveyor_code = 'P-' || RIGHT(REGEXP_REPLACE(phone, '\D', '', 'g'), 4)
WHERE role = 'SURVEYOR' AND phone IS NOT NULL AND (surveyor_code IS NULL OR surveyor_code = '');

-- 2. Bổ sung trường Diện tích sàn, Chiều cao và Nguồn móng vào building_specifications
ALTER TABLE building_specifications
  ADD COLUMN IF NOT EXISTS construction_area_m2 NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS building_height_m NUMERIC(6,2),
  ADD COLUMN IF NOT EXISTS foundation_source VARCHAR(64);

-- 3. Bổ sung Revision Counter và Lưu trữ toàn vẹn JSON vào base_survey_reports
ALTER TABLE base_survey_reports
  ADD COLUMN IF NOT EXISTS export_revision INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS survey_data_json JSONB;
