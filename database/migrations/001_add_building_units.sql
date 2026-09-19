-- Migration: 001_add_building_units.sql
-- Thêm hỗ trợ Chung cư / Tòa nhà nhiều hộ (Parent-Child Hierarchy)

-- 1. Bổ sung trường kiểu tòa nhà và số lượng căn vào bảng parcels
ALTER TABLE parcels 
ADD COLUMN IF NOT EXISTS building_type VARCHAR(32) NOT NULL DEFAULT 'STANDALONE',
ADD COLUMN IF NOT EXISTS total_units INT NOT NULL DEFAULT 1;

CREATE INDEX IF NOT EXISTS idx_parcels_building_type ON parcels(building_type);

-- 2. Tạo bảng quản lý danh sách căn hộ thành viên
CREATE TABLE IF NOT EXISTS building_units (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    parcel_id UUID NOT NULL REFERENCES parcels(id) ON DELETE CASCADE,
    unit_code VARCHAR(32) NOT NULL,                  -- VD: 'P.402', 'A-12.05'
    floor_number INT NOT NULL DEFAULT 1,              -- Lầu 4
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

-- 3. Bổ sung liên kết phân cấp vào base_survey_reports
ALTER TABLE base_survey_reports
ADD COLUMN IF NOT EXISTS unit_id UUID REFERENCES building_units(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS parent_report_id UUID REFERENCES base_survey_reports(id) ON DELETE SET NULL,
ADD COLUMN IF NOT EXISTS report_type VARCHAR(32) NOT NULL DEFAULT 'STANDALONE';

CREATE INDEX IF NOT EXISTS idx_reports_unit ON base_survey_reports(unit_id);
CREATE INDEX IF NOT EXISTS idx_reports_parent ON base_survey_reports(parent_report_id);
CREATE INDEX IF NOT EXISTS idx_reports_type ON base_survey_reports(report_type);
