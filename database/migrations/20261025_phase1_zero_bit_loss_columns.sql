-- ============================================================================
-- Migration: 20261025_phase1_zero_bit_loss_columns.sql
-- Purpose:
--   1. Idempotent reconciliation of all Phase 1 relational columns (Zero Bit-Loss)
--   2. Separate rejection_reason from engineering_recommendations on base_survey_reports
--   3. Backfill real owner_name, owner_phone, house_number, street from survey_data_json
--      (base_survey_reports, survey_drafts, report_versions) into parcels & building_units
-- ============================================================================

BEGIN;

-- 1. building_specifications
ALTER TABLE building_specifications
  ADD COLUMN IF NOT EXISTS construction_area_m2 NUMERIC(10, 2),
  ADD COLUMN IF NOT EXISTS building_height_m NUMERIC(6, 2),
  ADD COLUMN IF NOT EXISTS foundation_source VARCHAR(100),
  ADD COLUMN IF NOT EXISTS as_built_drawing_photos_json JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS foundation_cat_score INT,
  ADD COLUMN IF NOT EXISTS pile_dimensions_text VARCHAR(255),
  ADD COLUMN IF NOT EXISTS as_built_files_json JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS management_contact_json JSONB DEFAULT '{}'::jsonb;

-- 1.1. survey_photo_registry & parcel_absence_logs
ALTER TABLE survey_photo_registry
  ADD COLUMN IF NOT EXISTS rotation_angle INT DEFAULT 0;

CREATE TABLE IF NOT EXISTS parcel_absence_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    parcel_id UUID NOT NULL REFERENCES parcels(id) ON DELETE CASCADE,
    surveyor_id UUID NOT NULL REFERENCES users(id),
    attempt_number INT NOT NULL DEFAULT 1,
    absence_reason TEXT,
    notes TEXT,
    photo_proof_url TEXT,
    reschedule_date DATE,
    owner_name VARCHAR(128),
    owner_phone VARCHAR(32),
    recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_absence_logs_parcel ON parcel_absence_logs(parcel_id);
CREATE INDEX IF NOT EXISTS idx_absence_logs_surveyor ON parcel_absence_logs(surveyor_id);

-- 2. floor_surveys
ALTER TABLE floor_surveys
  ADD COLUMN IF NOT EXISTS has_structural_elements BOOLEAN DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS no_structural_elements_reason TEXT;

-- 3. damage_zones
ALTER TABLE damage_zones
  ADD COLUMN IF NOT EXISTS ctx_photo_code VARCHAR(150),
  ADD COLUMN IF NOT EXISTS overview_photos_json JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS dimensions_text VARCHAR(255),
  ADD COLUMN IF NOT EXISTS structural_integrity VARCHAR(150);

-- 4. defect_items
ALTER TABLE defect_items
  ADD COLUMN IF NOT EXISTS notes TEXT,
  ADD COLUMN IF NOT EXISTS functional_impact_e6 VARCHAR(64),
  ADD COLUMN IF NOT EXISTS cu_photo_codes_json JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS captured_at TIMESTAMPTZ;

-- 5. deformation_assessments
ALTER TABLE deformation_assessments
  ADD COLUMN IF NOT EXISTS notes TEXT,
  ADD COLUMN IF NOT EXISTS beam_sagging_photo_code VARCHAR(150),
  ADD COLUMN IF NOT EXISTS beam_sagging_photos_json JSONB DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS monitoring_required BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS monitoring_notes TEXT,
  ADD COLUMN IF NOT EXISTS details_json JSONB DEFAULT '{}'::jsonb;

-- 6. survey_scopes
ALTER TABLE survey_scopes
  ADD COLUMN IF NOT EXISTS scope_details_json JSONB DEFAULT '{}'::jsonb;

-- 7. base_survey_reports: separate rejection_reason from engineering_recommendations
ALTER TABLE base_survey_reports
  ADD COLUMN IF NOT EXISTS rejection_reason TEXT;

-- Tạm ngắt trigger khóa bất biến trong lúc Migration đồng bộ dữ liệu lịch sử (Steps 7.1, 8, 9)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_protect_approved_survey') THEN
    ALTER TABLE base_survey_reports DISABLE TRIGGER trg_protect_approved_survey;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_protect_approved_parcels') THEN
    ALTER TABLE parcels DISABLE TRIGGER trg_protect_approved_parcels;
  END IF;
END $$;

-- 7.1. Heal base_survey_reports where engineering_recommendations was overwritten by LÝ DO TRẢ VỀ / ADMIN MỞ LẠI HỒ SƠ (chỉ áp dụng cho hồ sơ chưa APPROVED)
UPDATE base_survey_reports
SET
  rejection_reason = COALESCE(
    rejection_reason,
    REGEXP_REPLACE(engineering_recommendations, '^(LÝ DO TRẢ VỀ:\s*|ADMIN MỞ LẠI HỒ SƠ:\s*|\[CAN THIỆP CHUYÊN GIA[^\]]*\]:\s*)', '', 'i')
  ),
  engineering_recommendations = NULLIF(
    COALESCE(
      survey_data_json->>'specificRecommendationsText',
      survey_data_json->>'engineeringRecommendations',
      ''
    ),
    ''
  )
WHERE status <> 'APPROVED'
  AND engineering_recommendations ~* '^(LÝ DO TRẢ VỀ:|ADMIN MỞ LẠI HỒ SƠ:|ADMIN CHUYỂN VỀ ĐANG LÀM DỞ|\[CAN THIỆP CHUYÊN GIA)';

-- 8. Heal base_survey_reports.survey_data_json->>'ownerName' from other base_survey_reports, survey_report_versions or signatures if currently placeholder/empty (chỉ áp dụng cho hồ sơ chưa APPROVED)
WITH recovered_owners AS (
  SELECT
    r.id AS report_id,
    COALESCE(
      CASE
        WHEN NULLIF(BTRIM(r.survey_data_json->>'ownerName'), '') IS NOT NULL
         AND BTRIM(r.survey_data_json->>'ownerName') !~* '^(chủ\s+hộ\s+thửa|chưa\s+cập\s+nhật|chủ\s+sở\s+hữu\s+thửa)'
        THEN BTRIM(r.survey_data_json->>'ownerName')
        ELSE NULL
      END,
      CASE
        WHEN NULLIF(BTRIM(r.survey_data_json->'signatures'->'ownerRepresentative'->>'fullName'), '') IS NOT NULL
         AND BTRIM(r.survey_data_json->'signatures'->'ownerRepresentative'->>'fullName') !~* '^(chủ\s+hộ\s+thửa|chưa\s+cập\s+nhật|chủ\s+sở\s+hữu\s+thửa)'
        THEN BTRIM(r.survey_data_json->'signatures'->'ownerRepresentative'->>'fullName')
        ELSE NULL
      END,
      (
        SELECT BTRIM(sd.survey_data_json->>'ownerName')
        FROM base_survey_reports sd
        WHERE sd.parcel_id = r.parcel_id
          AND sd.unit_id IS NOT DISTINCT FROM r.unit_id
          AND sd.id <> r.id
          AND NULLIF(BTRIM(sd.survey_data_json->>'ownerName'), '') IS NOT NULL
          AND BTRIM(sd.survey_data_json->>'ownerName') !~* '^(chủ\s+hộ\s+thửa|chưa\s+cập\s+nhật|chủ\s+sở\s+hữu\s+thửa)'
        ORDER BY sd.updated_at DESC NULLS LAST, sd.created_at DESC
        LIMIT 1
      ),
      (
        SELECT BTRIM(COALESCE(
          rv.snapshot_data->'surveyData'->>'ownerName',
          rv.snapshot_data->'frozenReportData'->'survey_data_json'->>'ownerName',
          rv.snapshot_data->'frozenParcel'->>'owner_name',
          rv.snapshot_data->>'ownerName'
        ))
        FROM survey_report_versions rv
        WHERE rv.report_id = r.id
          AND NULLIF(BTRIM(COALESCE(
            rv.snapshot_data->'surveyData'->>'ownerName',
            rv.snapshot_data->'frozenReportData'->'survey_data_json'->>'ownerName',
            rv.snapshot_data->'frozenParcel'->>'owner_name',
            rv.snapshot_data->>'ownerName'
          )), '') IS NOT NULL
          AND BTRIM(COALESCE(
            rv.snapshot_data->'surveyData'->>'ownerName',
            rv.snapshot_data->'frozenReportData'->'survey_data_json'->>'ownerName',
            rv.snapshot_data->'frozenParcel'->>'owner_name',
            rv.snapshot_data->>'ownerName'
          )) !~* '^(chủ\s+hộ\s+thửa|chưa\s+cập\s+nhật|chủ\s+sở\s+hữu\s+thửa)'
        ORDER BY rv.version_number DESC
        LIMIT 1
      )
    ) AS clean_owner_name
  FROM base_survey_reports r
  WHERE r.status <> 'APPROVED'
    AND r.survey_data_json IS NOT NULL
    AND (
      NULLIF(BTRIM(r.survey_data_json->>'ownerName'), '') IS NULL
      OR BTRIM(r.survey_data_json->>'ownerName') ~* '^(chủ\s+hộ\s+thửa|chưa\s+cập\s+nhật|chủ\s+sở\s+hữu\s+thửa)'
    )
)
UPDATE base_survey_reports r
SET survey_data_json = jsonb_set(r.survey_data_json, '{ownerName}', to_jsonb(ro.clean_owner_name), true)
FROM recovered_owners ro
WHERE r.id = ro.report_id
  AND ro.clean_owner_name IS NOT NULL;

-- 9. Backfill parcels (owner_name, owner_phone, house_number, street) from latest parcel-level base_survey_reports
WITH latest_parcel_survey AS (
  SELECT DISTINCT ON (p.id)
    p.id AS parcel_id,
    CASE
      WHEN NULLIF(BTRIM(r.survey_data_json->>'ownerName'), '') IS NOT NULL
       AND BTRIM(r.survey_data_json->>'ownerName') !~* '^(chủ\s+hộ\s+thửa|chưa\s+cập\s+nhật|chủ\s+sở\s+hữu\s+thửa)'
      THEN BTRIM(r.survey_data_json->>'ownerName')
      ELSE NULL
    END AS real_owner_name,
    NULLIF(BTRIM(r.survey_data_json->>'ownerPhone'), '') AS real_owner_phone,
    NULLIF(BTRIM(r.survey_data_json->>'houseNumber'), '') AS real_house_number,
    NULLIF(BTRIM(r.survey_data_json->>'street'), '') AS real_street
  FROM parcels p
  LEFT JOIN LATERAL (
    SELECT bsr.survey_data_json, bsr.updated_at, bsr.created_at
    FROM base_survey_reports bsr
    WHERE bsr.parcel_id = p.id
      AND bsr.unit_id IS NULL
      AND (bsr.report_type IS NULL OR bsr.report_type NOT IN ('CONDO_UNIT', 'UNIT_CHILD'))
    ORDER BY (CASE WHEN bsr.id = p.active_phase1_report_id THEN 0 ELSE 1 END), bsr.updated_at DESC NULLS LAST, bsr.created_at DESC
    LIMIT 1
  ) r ON TRUE
  WHERE r.survey_data_json IS NOT NULL
)
UPDATE parcels p
SET
  owner_name = COALESCE(lps.real_owner_name, p.owner_name),
  owner_phone = COALESCE(lps.real_owner_phone, p.owner_phone),
  house_number = COALESCE(lps.real_house_number, p.house_number),
  street = COALESCE(lps.real_street, p.street),
  updated_at = NOW()
FROM latest_parcel_survey lps
WHERE p.id = lps.parcel_id
  AND (
    (lps.real_owner_name IS NOT NULL AND lps.real_owner_name IS DISTINCT FROM p.owner_name)
    OR (lps.real_owner_phone IS NOT NULL AND lps.real_owner_phone IS DISTINCT FROM p.owner_phone)
    OR (lps.real_house_number IS NOT NULL AND lps.real_house_number IS DISTINCT FROM p.house_number)
    OR (lps.real_street IS NOT NULL AND lps.real_street IS DISTINCT FROM p.street)
  );

-- Bật lại trigger khóa bất biến sau khi hoàn tất backfill
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_protect_approved_survey') THEN
    ALTER TABLE base_survey_reports ENABLE TRIGGER trg_protect_approved_survey;
  END IF;
  IF EXISTS (SELECT 1 FROM pg_trigger WHERE tgname = 'trg_protect_approved_parcels') THEN
    ALTER TABLE parcels ENABLE TRIGGER trg_protect_approved_parcels;
  END IF;
END $$;

-- 10. Backfill building_units (owner_name, owner_phone) from latest unit-level base_survey_reports
WITH latest_unit_survey AS (
  SELECT DISTINCT ON (bu.id)
    bu.id AS unit_id,
    CASE
      WHEN NULLIF(BTRIM(r.survey_data_json->>'ownerName'), '') IS NOT NULL
       AND BTRIM(r.survey_data_json->>'ownerName') !~* '^(chủ\s+hộ\s+thửa|chưa\s+cập\s+nhật|chủ\s+sở\s+hữu\s+thửa)'
      THEN BTRIM(r.survey_data_json->>'ownerName')
      ELSE NULL
    END AS real_owner_name,
    NULLIF(BTRIM(r.survey_data_json->>'ownerPhone'), '') AS real_owner_phone
  FROM building_units bu
  LEFT JOIN LATERAL (
    SELECT bsr.survey_data_json, bsr.updated_at, bsr.created_at
    FROM base_survey_reports bsr
    WHERE bsr.unit_id = bu.id OR bsr.id = bu.phase1_report_id
    ORDER BY (CASE WHEN bsr.id = bu.phase1_report_id THEN 0 ELSE 1 END), bsr.updated_at DESC NULLS LAST, bsr.created_at DESC
    LIMIT 1
  ) r ON TRUE
  WHERE r.survey_data_json IS NOT NULL
)
UPDATE building_units bu
SET
  owner_name = COALESCE(lus.real_owner_name, bu.owner_name),
  owner_phone = COALESCE(lus.real_owner_phone, bu.owner_phone),
  updated_at = NOW()
FROM latest_unit_survey lus
WHERE bu.id = lus.unit_id
  AND (
    (lus.real_owner_name IS NOT NULL AND lus.real_owner_name IS DISTINCT FROM bu.owner_name)
    OR (lus.real_owner_phone IS NOT NULL AND lus.real_owner_phone IS DISTINCT FROM bu.owner_phone)
  );

COMMIT;
