-- ============================================================================
-- MIGRATION: 20260928_fix_phase1_discrepancies.sql
-- Mục đích:
-- 1. Đồng bộ dữ liệu phạm vi khảo sát (surveyScope & accessLimitation) vào bảng survey_scopes
-- 2. Khôi phục chuẩn xác component_type trong bảng damage_zones từ snapshot survey_data_json
-- ============================================================================

-- 1. Backfill dữ liệu vào bảng survey_scopes từ snapshot survey_data_json
INSERT INTO survey_scopes (report_id, survey_coverage, inaccessible_areas, accessibility_limitations)
SELECT 
    r.id AS report_id,
    CASE 
        WHEN r.survey_data_json->'accessLimitation'->>'type' = 'LIMITED' THEN 'MOT_PHAN'::survey_coverage_enum
        WHEN r.survey_data_json->'accessLimitation'->>'type' IN ('ABSENT_REFUSED', 'ABSENTEE') 
             OR (r.survey_data_json->>'isAbsenteeSurvey')::boolean = true 
             OR r.survey_data_json->>'surveyCaseType' = 'ABSENTEE' THEN 'KHONG_THE_TIEP_CAN'::survey_coverage_enum
        ELSE 'TOAN_BO'::survey_coverage_enum
    END AS survey_coverage,
    NULLIF(trim(both '[]"' from (r.survey_data_json->'accessLimitation'->>'restrictedAreas')), '') AS inaccessible_areas,
    NULLIF(
        concat_ws(': ', 
            r.survey_data_json->'accessLimitation'->>'mainReason',
            r.survey_data_json->'accessLimitation'->>'notes'
        ), ''
    ) AS accessibility_limitations
FROM base_survey_reports r
WHERE r.survey_data_json IS NOT NULL
ON CONFLICT (report_id) DO UPDATE SET
    survey_coverage = EXCLUDED.survey_coverage,
    inaccessible_areas = EXCLUDED.inaccessible_areas,
    accessibility_limitations = EXCLUDED.accessibility_limitations;

-- 2. Khôi phục component_type trong damage_zones từ survey_data_json->floors->zones
WITH raw_zones AS (
    SELECT 
        r.id AS report_id,
        z->>'zoneCode' AS zone_code,
        COALESCE(z->>'floorName', f->>'floorName', 'Tầng trệt') AS floor_name,
        z->>'componentType' AS raw_comp
    FROM base_survey_reports r,
         jsonb_array_elements(r.survey_data_json->'floors') f,
         jsonb_array_elements(f->'zones') z
    WHERE r.survey_data_json IS NOT NULL
)
UPDATE damage_zones dz
SET component_type = CASE
    WHEN UPPER(rz.raw_comp) LIKE '%THANG%' OR UPPER(rz.raw_comp) LIKE '%STAIR%' THEN 'STAIRS'::component_type_enum
    WHEN UPPER(rz.raw_comp) LIKE '%SÀN%' OR UPPER(rz.raw_comp) LIKE '%SAN%' OR UPPER(rz.raw_comp) LIKE '%NỀN%' OR UPPER(rz.raw_comp) LIKE '%FLOOR%' THEN 'FLOOR'::component_type_enum
    WHEN UPPER(rz.raw_comp) LIKE '%CỘT%' OR UPPER(rz.raw_comp) LIKE '%COT%' OR UPPER(rz.raw_comp) LIKE '%COLUMN%' THEN 'COLUMN'::component_type_enum
    WHEN UPPER(rz.raw_comp) LIKE '%DẦM%' OR UPPER(rz.raw_comp) LIKE '%DAM%' OR UPPER(rz.raw_comp) LIKE '%BEAM%' THEN 'BEAM'::component_type_enum
    WHEN UPPER(rz.raw_comp) LIKE '%TRẦN%' OR UPPER(rz.raw_comp) LIKE '%TRAN%' OR UPPER(rz.raw_comp) LIKE '%SLAB%' THEN 'SLAB'::component_type_enum
    ELSE 'WALL'::component_type_enum
END
FROM raw_zones rz
WHERE dz.report_id = rz.report_id AND dz.zone_code = rz.zone_code;

-- 3. Bổ sung chuẩn hóa theo room_name nếu có
UPDATE damage_zones
SET component_type = 'STAIRS'::component_type_enum
WHERE component_type = 'WALL'::component_type_enum AND (room_name ILIKE '%Cầu thang%' OR room_name ILIKE '%Hành lang%');
