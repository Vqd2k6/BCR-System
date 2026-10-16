-- ============================================================================
-- MIGRATION: 20261011_standardize_unit_identification_option_b.sql
-- Dự án: Hệ Thống Khảo Sát Hiện Trạng Công Trình Tuyến Metro Số 2 (BCS Platform)
--
-- Mục đích:
--   1. Hỗ trợ Tầng Lửng (MEZZ - floor_number = 0.5) và Bán Hầm (SB - floor_number = -0.5)
--      bằng cách chuyển kiểu cột floor_number sang NUMERIC(4,1).
--   2. Bổ sung cột display_code (Biển số phòng thực tế / Tên khu vực) trên building_units.
--   3. Tạo Index phục vụ tìm kiếm nhanh theo display_code.
--   4. Backfill an toàn dữ liệu 28 căn hộ hiện tại theo Phương án B:
--      Bảo toàn số tầng (02.04 -> 204, MEZZ.01 -> L.01), không cắt cụt làm mất tầng.
-- ============================================================================

-- 1. Chuyển đổi kiểu dữ liệu floor_number sang NUMERIC(4,1) để hỗ trợ tầng 0.5 (Tầng Lửng)
ALTER TABLE building_floor_plans 
  ALTER COLUMN floor_number TYPE NUMERIC(4,1);

ALTER TABLE building_units 
  ALTER COLUMN floor_number TYPE NUMERIC(4,1);

ALTER TABLE building_floor_plans 
  ALTER COLUMN applicable_floors TYPE NUMERIC(4,1)[];

-- 2. Đảm bảo cột display_code tồn tại trên building_units
ALTER TABLE building_units 
  ADD COLUMN IF NOT EXISTS display_code VARCHAR(64);

-- 3. Tạo Index phục vụ tìm kiếm theo display_code
CREATE INDEX IF NOT EXISTS idx_building_units_display_code 
  ON building_units(display_code) 
  WHERE deleted_at IS NULL;

-- 4. Backfill an toàn cho các bản ghi chưa có display_code theo Phương án B
UPDATE building_units
SET display_code = CASE
  -- Tầng lửng: MEZZ.01 -> L.01
  WHEN unit_code ~* '^MEZZ\.[0-9]+$' THEN 
    'L.' || LPAD(split_part(unit_code, '.', 2), 2, '0')

  -- Tầng trệt: G.01 hoặc 00.01 -> G.01
  WHEN unit_code ~* '^(G|00)\.[0-9]+$' THEN 
    'G.' || LPAD(split_part(unit_code, '.', 2), 2, '0')

  -- Tầng hầm: B01.01 -> B1-01
  WHEN unit_code ~* '^B([0-9]+)\.[0-9]+$' THEN 
    'B' || (regexp_match(unit_code, '^B([0-9]+)\.'))[1]::int || '-' || LPAD(split_part(unit_code, '.', 2), 2, '0')

  -- Lầu nổi chuẩn mm.nn: 02.04 -> 204, 03.01 -> 301, 10.05 -> 1005
  WHEN unit_code ~ '^[0-9]{2}\.[0-9]{2}$' THEN 
    (split_part(unit_code, '.', 1)::int * 100 + split_part(unit_code, '.', 2)::int)::text

  -- Trường hợp mã U-001 hoặc mã khác: giữ nguyên
  ELSE unit_code
END,
updated_at = NOW()
WHERE display_code IS NULL OR display_code = '';
