-- ============================================================================
-- MIGRATION: 20261011_cad_condo_integrity_and_soft_delete.sql
-- Dự án: Hệ Thống Khảo Sát Hiện Trạng Công Trình Tuyến Metro Số 2 (BCS Platform)
--
-- Mục đích:
--   1. Thêm cột deleted_at cho bảng building_units và building_floor_plans để hỗ trợ Soft Delete,
--      tuân thủ tuyệt đối Quy chuẩn Cấm Xóa Cứng (Zero Hard-Delete Mandate).
--   2. Thay thế UNIQUE constraints cũ bằng Partial Unique Index (WHERE deleted_at IS NULL).
--   3. Thêm các CHECK constraints cho unit_type, scope, resident_status để bảo đảm toàn vẹn CSDL.
--   4. Thêm Foreign Key từ building_units sang base_survey_reports.
-- ============================================================================

-- 1. Bổ sung cột deleted_at cho Soft Delete
ALTER TABLE building_units 
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;

ALTER TABLE building_floor_plans 
  ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;

CREATE INDEX IF NOT EXISTS idx_building_units_deleted_at ON building_units(deleted_at);
CREATE INDEX IF NOT EXISTS idx_building_floor_plans_deleted_at ON building_floor_plans(deleted_at);

-- 2. Chuyển đổi UNIQUE constraint sang Partial Unique Index
ALTER TABLE building_units 
  DROP CONSTRAINT IF EXISTS uq_parcel_unit;

CREATE UNIQUE INDEX IF NOT EXISTS idx_building_units_parcel_code_active 
  ON building_units(parcel_id, unit_code) 
  WHERE deleted_at IS NULL;

ALTER TABLE building_floor_plans 
  DROP CONSTRAINT IF EXISTS uq_parcel_floor_number;

CREATE UNIQUE INDEX IF NOT EXISTS idx_building_floor_plans_parcel_floor_active 
  ON building_floor_plans(parcel_id, floor_number) 
  WHERE deleted_at IS NULL;

-- 3. CHECK constraints an toàn dữ liệu
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_building_units_unit_type'
  ) THEN
    ALTER TABLE building_units 
      ADD CONSTRAINT chk_building_units_unit_type 
      CHECK (unit_type IN ('UNIT', 'MASTER'));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_building_floor_plans_scope'
  ) THEN
    ALTER TABLE building_floor_plans 
      ADD CONSTRAINT chk_building_floor_plans_scope 
      CHECK (scope IN ('UNIT', 'MASTER', 'BOTH'));
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_building_units_resident_status'
  ) THEN
    ALTER TABLE building_units 
      ADD CONSTRAINT chk_building_units_resident_status 
      CHECK (resident_status IN ('CHỦ_HỘ_Ở', 'CHO_THUÊ', 'ĐỂ_TRỐNG', 'TRANH_CHẤP'));
  END IF;
END $$;

-- 4. Foreign Key Constraints từ building_units sang base_survey_reports
-- 4.1 Làm sạch dữ liệu mồ côi (nếu có do mock/seed cũ) trước khi tạo ràng buộc
UPDATE building_units 
SET phase1_report_id = NULL 
WHERE phase1_report_id IS NOT NULL 
  AND phase1_report_id NOT IN (SELECT id FROM base_survey_reports);

UPDATE building_units 
SET phase2_report_id = NULL 
WHERE phase2_report_id IS NOT NULL 
  AND phase2_report_id NOT IN (SELECT id FROM base_survey_reports);

-- 4.2 Áp dụng ràng buộc khóa ngoại có ON DELETE SET NULL
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_building_units_phase1_report'
  ) THEN
    ALTER TABLE building_units 
      ADD CONSTRAINT fk_building_units_phase1_report 
      FOREIGN KEY (phase1_report_id) REFERENCES base_survey_reports(id) ON DELETE SET NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'fk_building_units_phase2_report'
  ) THEN
    ALTER TABLE building_units 
      ADD CONSTRAINT fk_building_units_phase2_report 
      FOREIGN KEY (phase2_report_id) REFERENCES base_survey_reports(id) ON DELETE SET NULL;
  END IF;
END $$;
