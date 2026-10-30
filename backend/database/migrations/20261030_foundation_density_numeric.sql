-- ============================================================================
-- Migration: 20261030_foundation_density_numeric.sql
-- Purpose:
--   1. Đổi building_specifications.foundation_density từ INT sang NUMERIC(10, 3).
--      Mật độ móng là "số lượng/m²" nên giá trị thập phân (VD 0.17) là hợp lệ;
--      kiểu INT cũ làm lỗi rollback phiên bản thẩm định
--      ("invalid input syntax for type integer") và làm mất dữ liệu khi nộp khảo sát.
--   2. Backfill các hồ sơ bị mất mật độ móng thập phân từ survey_data_json.
-- ============================================================================

ALTER TABLE building_specifications
  ALTER COLUMN foundation_density TYPE NUMERIC(10, 3) USING foundation_density::numeric;

UPDATE building_specifications bs
SET foundation_density = (r.survey_data_json->>'foundationDensity')::numeric
FROM base_survey_reports r
WHERE r.id = bs.report_id
  AND bs.foundation_density IS NULL
  AND (r.survey_data_json->>'foundationDensity') ~ '^[0-9]+(\.[0-9]+)?$';
