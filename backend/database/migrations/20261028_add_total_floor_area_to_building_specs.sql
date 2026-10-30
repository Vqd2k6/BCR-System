-- ============================================================================
-- Migration: 20261028_add_total_floor_area_to_building_specs.sql
-- Purpose:
--   1. Add total_floor_area_m2 column to building_specifications table
--   2. Backfill existing surveys from survey_data_json->>'totalFloorAreaM2' or fallback to construction_area_m2
-- ============================================================================

-- 1. Bổ sung cột construction_area_m2 và total_floor_area_m2 vào building_specifications nếu chưa có
ALTER TABLE building_specifications
  ADD COLUMN IF NOT EXISTS construction_area_m2 NUMERIC(10, 2),
  ADD COLUMN IF NOT EXISTS total_floor_area_m2 NUMERIC(10, 2);

-- 2. Tự động backfill dữ liệu cũ:
-- Ưu tiên lấy từ r.survey_data_json->>'totalFloorAreaM2' nếu hợp lệ số học,
-- nếu chưa có thì lấy từ bs.construction_area_m2 (vì trước đây 1 trường dùng chung)
UPDATE building_specifications bs
SET total_floor_area_m2 = COALESCE(
  CASE
    WHEN BTRIM(COALESCE(r.survey_data_json->>'totalFloorAreaM2', '')) ~ '^[0-9]+(\.[0-9]+)?$'
    THEN BTRIM(r.survey_data_json->>'totalFloorAreaM2')::numeric
    ELSE NULL
  END,
  bs.construction_area_m2
)
FROM base_survey_reports r
WHERE bs.report_id = r.id
  AND bs.total_floor_area_m2 IS NULL
  AND (
    BTRIM(COALESCE(r.survey_data_json->>'totalFloorAreaM2', '')) ~ '^[0-9]+(\.[0-9]+)?$'
    OR bs.construction_area_m2 IS NOT NULL
  );

