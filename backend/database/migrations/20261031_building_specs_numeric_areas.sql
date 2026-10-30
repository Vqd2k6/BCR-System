-- ============================================================================
-- Migration: 20261031_building_specs_numeric_areas.sql
-- Purpose:
--   Chuẩn hóa building_specifications.construction_area_m2 / total_floor_area_m2 về NUMERIC(10, 2).
--   Các migration trước dùng ADD COLUMN IF NOT EXISTS nên nếu cột đã tồn tại dạng VARCHAR
--   (tạo tay / script cũ) thì kiểu không đổi, gây lỗi lưu thẩm định
--   ("COALESCE types numeric and character varying cannot be matched").
--   Dùng ::text để migration chạy được cả khi cột đã là NUMERIC; giá trị không phải số → NULL.
-- ============================================================================

ALTER TABLE building_specifications
  ALTER COLUMN construction_area_m2 TYPE NUMERIC(10, 2)
    USING CASE
      WHEN BTRIM(construction_area_m2::text) ~ '^[0-9]+(\.[0-9]+)?$'
      THEN BTRIM(construction_area_m2::text)::numeric
      ELSE NULL
    END,
  ALTER COLUMN total_floor_area_m2 TYPE NUMERIC(10, 2)
    USING CASE
      WHEN BTRIM(total_floor_area_m2::text) ~ '^[0-9]+(\.[0-9]+)?$'
      THEN BTRIM(total_floor_area_m2::text)::numeric
      ELSE NULL
    END;
