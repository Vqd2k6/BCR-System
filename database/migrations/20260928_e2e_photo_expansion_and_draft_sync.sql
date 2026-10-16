-- ============================================================================
-- MIGRATION: 20260928_e2e_photo_expansion_and_draft_sync.sql
-- Mục đích:
-- 1. Bổ sung các cột đồng bộ bản nháp và bàn giao ca vào base_survey_reports
-- 2. Bổ sung cột lưu trữ mảng ảnh lún chênh, nghiêng và bất thường vào deformation_assessments
-- 3. Bổ sung cột lưu trữ mảng ảnh bản vẽ hoàn công vào building_specifications
-- ============================================================================

-- 1. base_survey_reports
ALTER TABLE base_survey_reports
    ADD COLUMN IF NOT EXISTS sync_version INT NOT NULL DEFAULT 1,
    ADD COLUMN IF NOT EXISTS last_edited_by_id UUID REFERENCES users(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS handover_security_code VARCHAR(8),
    ADD COLUMN IF NOT EXISTS is_ready_for_handover BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS handover_history JSONB NOT NULL DEFAULT '[]'::jsonb;

CREATE INDEX IF NOT EXISTS idx_reports_draft_lookup 
    ON base_survey_reports(parcel_id, phase, status);

-- 2. deformation_assessments
ALTER TABLE deformation_assessments
    ADD COLUMN IF NOT EXISTS diff_settlement_photo_code VARCHAR(150),
    ADD COLUMN IF NOT EXISTS tilt_photo_code VARCHAR(150),
    ADD COLUMN IF NOT EXISTS abnormal_photo_code VARCHAR(150),
    ADD COLUMN IF NOT EXISTS diff_settlement_photos_json JSONB DEFAULT '[]'::jsonb,
    ADD COLUMN IF NOT EXISTS tilt_photos_json JSONB DEFAULT '[]'::jsonb,
    ADD COLUMN IF NOT EXISTS abnormal_photos_json JSONB DEFAULT '[]'::jsonb;

-- 3. building_specifications
ALTER TABLE building_specifications
    ADD COLUMN IF NOT EXISTS as_built_drawing_photos_json JSONB DEFAULT '[]'::jsonb;
