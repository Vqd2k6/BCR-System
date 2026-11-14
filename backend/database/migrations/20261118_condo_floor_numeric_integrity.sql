-- ============================================================================
-- Chung cư GĐ A (15/11/2026): đồng bộ kiểu số tầng thập phân.
-- 20261011 đã đổi building_floor_plans.floor_number / applicable_floors và
-- building_units.floor_number sang NUMERIC(4,1) để có Lửng 0.5, Bán hầm -0.5,
-- nhưng parcels.deleted_floors vẫn là INT[] nên xóa/khôi phục tầng 0.5 lỗi 22P02.
-- Đổi kiểu bảo toàn giá trị (INT -> NUMERIC không mất số). Không xóa dữ liệu.
-- Idempotent: chỉ đổi khi cột còn kiểu cũ.
-- ============================================================================

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'parcels' AND column_name = 'deleted_floors'
      AND udt_name <> '_numeric'
  ) THEN
    ALTER TABLE parcels
      ALTER COLUMN deleted_floors TYPE NUMERIC(4,1)[] USING deleted_floors::NUMERIC(4,1)[];
    ALTER TABLE parcels ALTER COLUMN deleted_floors SET DEFAULT '{}';
  END IF;

  -- Phòng khi CSDL dựng từ init_schema.sql cũ (còn INT) mà chưa qua 20261011.
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'building_floor_plans' AND column_name = 'floor_number' AND udt_name <> 'numeric'
  ) THEN
    ALTER TABLE building_floor_plans ALTER COLUMN floor_number TYPE NUMERIC(4,1);
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'building_floor_plans' AND column_name = 'applicable_floors' AND udt_name <> '_numeric'
  ) THEN
    ALTER TABLE building_floor_plans
      ALTER COLUMN applicable_floors TYPE NUMERIC(4,1)[] USING applicable_floors::NUMERIC(4,1)[];
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'building_units' AND column_name = 'floor_number' AND udt_name <> 'numeric'
  ) THEN
    ALTER TABLE building_units ALTER COLUMN floor_number TYPE NUMERIC(4,1);
  END IF;
END $$;

COMMENT ON COLUMN parcels.deleted_floors IS 'Các tầng (NUMERIC 4,1: -0.5 Bán hầm, 0.5 Lửng) Admin đã xóa khỏi cấu trúc tòa, chỉ ẩn, không xóa căn đã khảo sát';
