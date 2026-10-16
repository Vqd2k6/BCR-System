-- ============================================================================
-- MIGRATION: 20261009_add_floor_plan_scope_and_area_type.sql
-- Dự án: Hệ Thống Khảo Sát Hiện Trạng Công Trình Tuyến Metro Số 2 (BCS Platform)
--
-- Mục đích:
--   1. Bổ sung các cột phân loại scope ('MASTER' | 'UNIT' | 'BOTH') và area_type
--      vào bảng building_floor_plans.
--   2. Phục vụ phân định rõ ràng giữa tầng căn hộ con (Unit) và khu vực dùng chung
--      toà nhà mẹ (Master: hầm B1/B2, sảnh trệt, tầng kỹ thuật, sân thượng/mái).
-- ============================================================================

ALTER TABLE building_floor_plans
  ADD COLUMN IF NOT EXISTS scope VARCHAR(32) DEFAULT 'UNIT',
  ADD COLUMN IF NOT EXISTS area_type VARCHAR(64) DEFAULT 'TYPICAL_UNIT';

CREATE INDEX IF NOT EXISTS idx_floor_plans_scope ON building_floor_plans(parcel_id, scope);
