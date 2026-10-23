-- Migration: 20261024_add_distance_to_centerline_and_schema_reconcile.sql
-- Mục đích:
--   1. Bổ sung cột vật lý distance_to_centerline_m (cự ly trắc địa tới tim tuyến Metro số 2) vào bảng parcels,
--      khắc phục triệt để lỗi 42703 (column p.distance_to_centerline_m does not exist) trên Render Production.
--   2. Tự động backfill cự ly trắc địa từ PostGIS (metro_alignments / metro_segments) cho các thửa đất hiện hữu đang NULL.
--   3. Đối soát idempotent (ADD COLUMN IF NOT EXISTS / CREATE TABLE IF NOT EXISTS) toàn bộ các bảng và cột
--      phục vụ Audit Studio, Versioning, Photo Lifecycle Registry và Report V3.
-- Cam kết An toàn Production: Zero Data Loss, Zero Table Rewrite, 100% Idempotent.

-- ============================================================================
-- 1. BẢNG PARCELS: BỔ SUNG CỘT CỰ LY TRẮC ĐỊA & CÁC CỘT ĐỐI SOÁT KIỂM TOÁN
-- ============================================================================
ALTER TABLE parcels ADD COLUMN IF NOT EXISTS frontage_width NUMERIC(10, 2);
ALTER TABLE parcels ADD COLUMN IF NOT EXISTS lot_depth NUMERIC(10, 2);
ALTER TABLE parcels ADD COLUMN IF NOT EXISTS distance_to_centerline_m NUMERIC(10, 2);
ALTER TABLE parcels ADD COLUMN IF NOT EXISTS is_locked BOOLEAN DEFAULT FALSE;
ALTER TABLE parcels ADD COLUMN IF NOT EXISTS locked_at TIMESTAMPTZ;
ALTER TABLE parcels ADD COLUMN IF NOT EXISTS locked_by_id UUID REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE parcels ADD COLUMN IF NOT EXISTS seal_hash VARCHAR(128);
ALTER TABLE parcels ADD COLUMN IF NOT EXISTS seal_notes TEXT;
ALTER TABLE parcels ADD COLUMN IF NOT EXISTS deleted_floors INT[] DEFAULT '{}';
ALTER TABLE parcels ADD COLUMN IF NOT EXISTS code_slug VARCHAR(64);
ALTER TABLE parcels ADD COLUMN IF NOT EXISTS assigned_surveyor_id UUID REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE parcels ADD COLUMN IF NOT EXISTS assigned_at TIMESTAMPTZ;
ALTER TABLE parcels ADD COLUMN IF NOT EXISTS assignment_notes TEXT;

CREATE INDEX IF NOT EXISTS idx_parcels_distance_centerline ON parcels(distance_to_centerline_m);

-- Tự động backfill distance_to_centerline_m từ metro_alignments cho các thửa đang NULL
UPDATE parcels p
SET distance_to_centerline_m = sub.dist_m
FROM (
  SELECT p2.id,
         ROUND(
           ST_Distance(
             COALESCE(p2.footprint_polygon_geom, p2.cadastral_polygon_geom, p2.location_geom)::geography,
             ma.centerline_geom::geography
           )::numeric,
           1
         ) AS dist_m
  FROM parcels p2
  CROSS JOIN LATERAL (
    SELECT centerline_geom
    FROM metro_alignments
    WHERE centerline_geom IS NOT NULL
    ORDER BY COALESCE(p2.footprint_polygon_geom, p2.cadastral_polygon_geom, p2.location_geom) <-> centerline_geom
    LIMIT 1
  ) ma
  WHERE p2.distance_to_centerline_m IS NULL
    AND COALESCE(p2.footprint_polygon_geom, p2.cadastral_polygon_geom, p2.location_geom) IS NOT NULL
) sub
WHERE p.id = sub.id
  AND p.distance_to_centerline_m IS NULL;

-- Fallback backfill từ metro_segments nếu metro_alignments trống
UPDATE parcels p
SET distance_to_centerline_m = sub.dist_m
FROM (
  SELECT p2.id,
         ROUND(
           ST_Distance(
             COALESCE(p2.footprint_polygon_geom, p2.cadastral_polygon_geom, p2.location_geom)::geography,
             ms.centerline_geom::geography
           )::numeric,
           1
         ) AS dist_m
  FROM parcels p2
  CROSS JOIN LATERAL (
    SELECT centerline_geom
    FROM metro_segments
    WHERE centerline_geom IS NOT NULL
    ORDER BY COALESCE(p2.footprint_polygon_geom, p2.cadastral_polygon_geom, p2.location_geom) <-> centerline_geom
    LIMIT 1
  ) ms
  WHERE p2.distance_to_centerline_m IS NULL
    AND COALESCE(p2.footprint_polygon_geom, p2.cadastral_polygon_geom, p2.location_geom) IS NOT NULL
) sub
WHERE p.id = sub.id
  AND p.distance_to_centerline_m IS NULL;

-- ============================================================================
-- 2. ĐỐI SOÁT IDEMPOTENT CÁC BẢNG CỐT LÕI KHÁC (PHÒNG NGỪA BASELINE DRIFT)
-- ============================================================================

-- 2.1 users & metro_zones
ALTER TABLE users ADD COLUMN IF NOT EXISTS signature_image_url TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS created_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS surveyor_code VARCHAR(32);

ALTER TABLE metro_zones ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE;

-- 2.2 base_survey_reports
ALTER TABLE base_survey_reports ADD COLUMN IF NOT EXISTS unit_id UUID REFERENCES building_units(id) ON DELETE SET NULL;
ALTER TABLE base_survey_reports ADD COLUMN IF NOT EXISTS parent_report_id UUID REFERENCES base_survey_reports(id) ON DELETE SET NULL;
ALTER TABLE base_survey_reports ADD COLUMN IF NOT EXISTS report_type VARCHAR(32) NOT NULL DEFAULT 'STANDALONE';
ALTER TABLE base_survey_reports ADD COLUMN IF NOT EXISTS export_revision INT NOT NULL DEFAULT 0;
ALTER TABLE base_survey_reports ADD COLUMN IF NOT EXISTS survey_data_json JSONB;
ALTER TABLE base_survey_reports ADD COLUMN IF NOT EXISTS sync_version INT NOT NULL DEFAULT 1;
ALTER TABLE base_survey_reports ADD COLUMN IF NOT EXISTS last_edited_by_id UUID REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE base_survey_reports ADD COLUMN IF NOT EXISTS handover_security_code VARCHAR(16);
ALTER TABLE base_survey_reports ADD COLUMN IF NOT EXISTS is_ready_for_handover BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE base_survey_reports ADD COLUMN IF NOT EXISTS handover_history JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE base_survey_reports ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- 2.3 building_units & building_floor_plans
ALTER TABLE building_units ADD COLUMN IF NOT EXISTS display_code VARCHAR(64);
ALTER TABLE building_units ADD COLUMN IF NOT EXISTS unit_type VARCHAR(32) DEFAULT 'UNIT';
ALTER TABLE building_units ADD COLUMN IF NOT EXISTS resident_status VARCHAR(64) DEFAULT 'CHỦ_HỘ_Ở';
ALTER TABLE building_units ADD COLUMN IF NOT EXISTS cad_bbox JSONB;
ALTER TABLE building_units ADD COLUMN IF NOT EXISTS cad_polygon JSONB;
ALTER TABLE building_units ADD COLUMN IF NOT EXISTS unit_cad_url TEXT;
ALTER TABLE building_units ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

ALTER TABLE building_floor_plans ADD COLUMN IF NOT EXISTS scope VARCHAR(32) DEFAULT 'BUILDING';
ALTER TABLE building_floor_plans ADD COLUMN IF NOT EXISTS area_type VARCHAR(32) DEFAULT 'RESIDENTIAL';
ALTER TABLE building_floor_plans ADD COLUMN IF NOT EXISTS floor_code VARCHAR(32);
ALTER TABLE building_floor_plans ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- 2.4 damage_zones, defect_items, survey_identification_photos, deformation_assessments
ALTER TABLE damage_zones ADD COLUMN IF NOT EXISTS ctx_photo_code VARCHAR(150);
ALTER TABLE damage_zones ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE defect_items ADD COLUMN IF NOT EXISTS cu_photo_code VARCHAR(150);
ALTER TABLE defect_items ADD COLUMN IF NOT EXISTS cu_photos_json JSONB DEFAULT '[]'::jsonb;
ALTER TABLE defect_items ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE survey_identification_photos ADD COLUMN IF NOT EXISTS photo_code VARCHAR(150);

ALTER TABLE deformation_assessments ADD COLUMN IF NOT EXISTS diff_settlement_photo_code VARCHAR(150);
ALTER TABLE deformation_assessments ADD COLUMN IF NOT EXISTS tilt_photo_code VARCHAR(150);
ALTER TABLE deformation_assessments ADD COLUMN IF NOT EXISTS abnormal_photo_code VARCHAR(150);
ALTER TABLE deformation_assessments ADD COLUMN IF NOT EXISTS diff_settlement_photos_json JSONB DEFAULT '[]'::jsonb;
ALTER TABLE deformation_assessments ADD COLUMN IF NOT EXISTS tilt_photos_json JSONB DEFAULT '[]'::jsonb;
ALTER TABLE deformation_assessments ADD COLUMN IF NOT EXISTS abnormal_photos_json JSONB DEFAULT '[]'::jsonb;

-- 2.5 risk_score_cards
ALTER TABLE risk_score_cards ALTER COLUMN v3_foundation_score DROP NOT NULL;
ALTER TABLE risk_score_cards ALTER COLUMN v4_age_score DROP NOT NULL;
ALTER TABLE risk_score_cards ALTER COLUMN avg_vi_score DROP NOT NULL;
ALTER TABLE risk_score_cards ALTER COLUMN vi_class DROP NOT NULL;

ALTER TABLE risk_score_cards ADD COLUMN IF NOT EXISTS overridden_burland_grade INT;
ALTER TABLE risk_score_cards ADD COLUMN IF NOT EXISTS overridden_total_ecs INT;
ALTER TABLE risk_score_cards ADD COLUMN IF NOT EXISTS overridden_ecs_class VARCHAR(32);
ALTER TABLE risk_score_cards ADD COLUMN IF NOT EXISTS overridden_importance_score NUMERIC(4, 2);
ALTER TABLE risk_score_cards ADD COLUMN IF NOT EXISTS overridden_avg_vi NUMERIC(4, 2);
ALTER TABLE risk_score_cards ADD COLUMN IF NOT EXISTS overridden_vi_class VARCHAR(32);
ALTER TABLE risk_score_cards ADD COLUMN IF NOT EXISTS overridden_impact_level_i INT;
ALTER TABLE risk_score_cards ADD COLUMN IF NOT EXISTS overridden_bra VARCHAR(64);
ALTER TABLE risk_score_cards ADD COLUMN IF NOT EXISTS judgement_engineer_name VARCHAR(255);
ALTER TABLE risk_score_cards ADD COLUMN IF NOT EXISTS judgement_applied_at TIMESTAMPTZ;

-- 2.6 Các bảng phụ trợ Audit, Versioning & Report V3
CREATE TABLE IF NOT EXISTS survey_report_versions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    report_id UUID NOT NULL REFERENCES base_survey_reports(id) ON DELETE CASCADE,
    version_number INT NOT NULL,
    version_tag VARCHAR(64) NOT NULL DEFAULT 'ADMIN_DIFF_SAVE',
    title VARCHAR(255) NOT NULL,
    edit_reason TEXT,
    snapshot_data JSONB NOT NULL,
    diff_summary JSONB DEFAULT '[]'::jsonb,
    created_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    client_ip VARCHAR(64),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_survey_report_versions_report_id ON survey_report_versions(report_id, version_number DESC);

CREATE TABLE IF NOT EXISTS survey_audit_locks (
    report_id UUID PRIMARY KEY REFERENCES base_survey_reports(id) ON DELETE CASCADE,
    locked_by_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    locked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '5 minutes')
);

CREATE TABLE IF NOT EXISTS survey_photo_registry (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    report_id UUID NOT NULL REFERENCES base_survey_reports(id) ON DELETE CASCADE,
    parcel_id UUID NOT NULL REFERENCES parcels(id) ON DELETE CASCADE,
    photo_category VARCHAR(64) NOT NULL,
    photo_type VARCHAR(64) NOT NULL,
    photo_code VARCHAR(150) NOT NULL,
    photo_url TEXT NOT NULL,
    storage_key TEXT,
    original_filename TEXT,
    standardized_filename TEXT NOT NULL,
    sha256_hash VARCHAR(64) NOT NULL,
    size_bytes BIGINT,
    mime_type VARCHAR(64) DEFAULT 'image/jpeg',
    status VARCHAR(32) NOT NULL DEFAULT 'ACTIVE',
    superseded_by_photo_id UUID REFERENCES survey_photo_registry(id) ON DELETE SET NULL,
    superseded_by_url TEXT,
    replacement_for_url TEXT,
    is_deleted BOOLEAN NOT NULL DEFAULT false,
    deleted_at TIMESTAMPTZ,
    deleted_by_id UUID REFERENCES users(id) ON DELETE SET NULL,
    action_type VARCHAR(32) NOT NULL,
    action_reason TEXT,
    actor_id UUID REFERENCES users(id) ON DELETE SET NULL,
    actor_role VARCHAR(32) DEFAULT 'ZONE_ADMIN',
    metadata_json JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_photo_registry_report ON survey_photo_registry(report_id);
CREATE INDEX IF NOT EXISTS idx_photo_registry_code ON survey_photo_registry(photo_code);

CREATE TABLE IF NOT EXISTS report_standard_text_versions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    version_number INTEGER NOT NULL UNIQUE CHECK (version_number >= 1),
    content_json JSONB NOT NULL,
    change_reason TEXT NOT NULL,
    created_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS project_survey_equipment (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    sort_order INTEGER NOT NULL DEFAULT 0,
    name_vi TEXT NOT NULL,
    name_en TEXT NOT NULL DEFAULT '',
    specification_vi TEXT NOT NULL DEFAULT '',
    specification_en TEXT NOT NULL DEFAULT '',
    purpose_vi TEXT NOT NULL DEFAULT '',
    purpose_en TEXT NOT NULL DEFAULT '',
    model TEXT,
    serial_no TEXT,
    calibration_cert_no TEXT,
    calibration_valid_to DATE,
    created_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    updated_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS report_releases (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    report_id UUID NOT NULL REFERENCES base_survey_reports(id) ON DELETE RESTRICT,
    revision INTEGER NOT NULL CHECK (revision >= 0),
    reason TEXT NOT NULL,
    is_final BOOLEAN NOT NULL DEFAULT FALSE,
    file_path TEXT NOT NULL,
    file_size_bytes BIGINT NOT NULL,
    sha256 CHAR(64) NOT NULL,
    snapshot_version_id UUID,
    released_by_user_id UUID NOT NULL REFERENCES users(id),
    released_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    standard_text_version_id UUID REFERENCES report_standard_text_versions(id) ON DELETE SET NULL,
    equipment_snapshot_json JSONB,
    UNIQUE (report_id, revision)
);
ALTER TABLE report_releases ADD COLUMN IF NOT EXISTS standard_text_version_id UUID REFERENCES report_standard_text_versions(id) ON DELETE SET NULL;
ALTER TABLE report_releases ADD COLUMN IF NOT EXISTS equipment_snapshot_json JSONB;
