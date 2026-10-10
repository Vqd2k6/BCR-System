-- ============================================================================
-- MIGRATION: 20261008_add_floor_plans_and_unit_cad.sql
-- Dự án: Hệ Thống Khảo Sát Hiện Trạng Công Trình Tuyến Metro Số 2 (BCS Platform)
--
-- Mục đích:
--   1. Tạo bảng building_floor_plans để lưu trữ bản vẽ CAD kiến trúc các tầng của tòa nhà chung cư mẹ
--      (hỗ trợ cấu hình dải tầng điển hình applicable_floors).
--   2. Bổ sung các cột liên kết floor_plan_id, cad_bbox, cad_polygon, unit_cad_url và resident_status
--      vào bảng building_units phục vụ tính năng 1-Click CAD Import cho căn hộ con.
--   3. Đảm bảo tính Idempotent (IF NOT EXISTS), Metadata-only (không khoá bảng) và an toàn tuyệt đối 
--      trên mọi môi trường (Docker Local, Dev, Supabase, Render Production).
-- ============================================================================

-- 1. Bảng quản lý bản vẽ CAD mặt bằng tầng chung cư
CREATE TABLE IF NOT EXISTS building_floor_plans (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    parcel_id UUID NOT NULL REFERENCES parcels(id) ON DELETE CASCADE,
    floor_number INT NOT NULL,
    floor_name VARCHAR(64) NOT NULL,
    applicable_floors INT[] DEFAULT '{}',
    cad_photo_url TEXT NOT NULL,
    cad_photo_code VARCHAR(32),
    image_width INT,
    image_height INT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_parcel_floor_number UNIQUE (parcel_id, floor_number)
);

CREATE INDEX IF NOT EXISTS idx_floor_plans_parcel ON building_floor_plans(parcel_id);

-- 2. Bổ sung liên kết CAD tầng & phân vùng căn hộ vào bảng building_units
ALTER TABLE building_units
  ADD COLUMN IF NOT EXISTS floor_plan_id UUID REFERENCES building_floor_plans(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS cad_bbox JSONB,
  ADD COLUMN IF NOT EXISTS cad_polygon JSONB,
  ADD COLUMN IF NOT EXISTS unit_cad_url TEXT,
  ADD COLUMN IF NOT EXISTS resident_status VARCHAR(32) DEFAULT 'CHỦ_HỘ_Ở';

CREATE INDEX IF NOT EXISTS idx_building_units_floor_plan ON building_units(floor_plan_id);
