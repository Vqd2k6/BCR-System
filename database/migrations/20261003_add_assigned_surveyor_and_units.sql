-- ============================================================================
-- MIGRATION: 20261003_add_assigned_surveyor_and_units.sql
-- Dự án: Hệ Thống Khảo Sát Hiện Trạng Công Trình Tuyến Metro Số 2 (BCS Platform)
--
-- Mục đích:
--   Bổ sung các cột phân công khảo sát viên và thuộc tính công trình vào bảng parcels
--   cùng bảng building_units và quan hệ phân cấp base_survey_reports.
--   Đảm bảo tính tương thích và tự khôi phục trên môi trường Render / Supabase / Cloud Deploy.
-- ============================================================================

-- 1. Cột phân công khảo sát và trạng thái trên bảng parcels
ALTER TABLE parcels
  ADD COLUMN IF NOT EXISTS assigned_surveyor_id UUID REFERENCES users(id),
  ADD COLUMN IF NOT EXISTS assigned_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS assignment_notes TEXT,
  ADD COLUMN IF NOT EXISTS building_type VARCHAR(32) NOT NULL DEFAULT 'STANDALONE',
  ADD COLUMN IF NOT EXISTS total_units INT NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS code_slug VARCHAR(32),
  ADD COLUMN IF NOT EXISTS absence_attempt_count INT NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_parcels_assigned_surveyor ON parcels(assigned_surveyor_id);
CREATE INDEX IF NOT EXISTS idx_parcels_building_type ON parcels(building_type);

-- 2. Bảng quản lý căn hộ trong tòa nhà / chung cư
CREATE TABLE IF NOT EXISTS building_units (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    parcel_id UUID NOT NULL REFERENCES parcels(id) ON DELETE CASCADE,
    unit_code VARCHAR(32) NOT NULL,
    floor_number INT NOT NULL DEFAULT 1,
    owner_name VARCHAR(128),
    owner_phone VARCHAR(32),
    owner_id_card VARCHAR(32),
    status parcel_survey_status_enum NOT NULL DEFAULT 'NOT_SURVEYED',
    phase1_report_id UUID,
    phase2_report_id UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_parcel_unit UNIQUE (parcel_id, unit_code)
);

CREATE INDEX IF NOT EXISTS idx_building_units_parcel ON building_units(parcel_id);
CREATE INDEX IF NOT EXISTS idx_building_units_status ON building_units(status);

-- 3. Phân cấp báo cáo căn hộ thành viên
ALTER TABLE base_survey_reports
  ADD COLUMN IF NOT EXISTS unit_id UUID REFERENCES building_units(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS parent_report_id UUID REFERENCES base_survey_reports(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS report_type VARCHAR(32) NOT NULL DEFAULT 'STANDALONE';

CREATE INDEX IF NOT EXISTS idx_reports_unit ON base_survey_reports(unit_id);
CREATE INDEX IF NOT EXISTS idx_reports_parent ON base_survey_reports(parent_report_id);
CREATE INDEX IF NOT EXISTS idx_reports_type ON base_survey_reports(report_type);
