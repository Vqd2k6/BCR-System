-- Migration: Backfill floor_code cho các bản ghi cũ trong building_floor_plans
-- Mục đích: Đảm bảo 100% floor plans có mã tầng chuẩn xác (B01, G, MEZZ, F01..F99)

UPDATE building_floor_plans
SET floor_code = CASE
  WHEN floor_number < 0 THEN 'B' || LPAD(ABS(floor_number)::text, 2, '0')
  WHEN floor_number = 0 THEN 'G'
  WHEN LOWER(floor_name) LIKE '%lửng%' OR LOWER(floor_name) LIKE '%mezzanine%' THEN 'MEZZ'
  WHEN LOWER(floor_name) LIKE '%bán hầm%' OR LOWER(floor_name) LIKE '%semi-basement%' THEN 'SB'
  WHEN LOWER(floor_name) LIKE '%kỹ thuật%' THEN 'TECH'
  WHEN LOWER(floor_name) LIKE '%lánh nạn%' THEN 'REF'
  WHEN LOWER(floor_name) LIKE '%mái%' OR LOWER(floor_name) LIKE '%roof%' THEN 'ROOF'
  WHEN LOWER(floor_name) LIKE '%sân thượng%' THEN 'TERRACE'
  WHEN LOWER(floor_name) LIKE '%tum%' THEN 'TUM'
  ELSE 'F' || LPAD(floor_number::text, 2, '0')
END
WHERE floor_code IS NULL;
