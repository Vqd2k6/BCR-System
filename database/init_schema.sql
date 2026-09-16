-- ============================================================================
-- HỆ THỐNG CƠ SỞ DỮ LIỆU KHẢO SÁT HIỆN TRẠNG QUY HOẠCH TUYẾN METRO 2 (BẾN THÀNH - THAM LƯƠNG)
-- Tiêu chuẩn: PostgreSQL 16 + PostGIS Extension
-- Kiến trúc: 7 Phân hệ Modular (Domain-Driven Bounded Contexts)
-- Đặc tả kỹ thuật: Bám sát 100% srs/API_SPECIFICATION.md & srs/CLASS_DIAGRAM.md
-- ============================================================================

-- 1. KÍCH HOẠT EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "postgis";

-- ============================================================================
-- 2. ĐỊNH NGHĨA CÁC KIỂU DỮ LIỆU ENUM CHUẨN HÓA (ENUM TYPES)
-- ============================================================================

-- Phân hệ 1: Người dùng & Xác thực
CREATE TYPE role_enum AS ENUM (
    'SUPER_ADMIN', 
    'ZONE_ADMIN', 
    'SURVEYOR', 
    'CONTRACTOR'
);

CREATE TYPE user_status_enum AS ENUM (
    'ACTIVE', 
    'SUSPENDED', 
    'LOCKED'
);

-- Phân hệ 2: Chấm công thực địa
CREATE TYPE verification_status_enum AS ENUM (
    'PENDING_VERIFICATION', 
    'APPROVED', 
    'FLAGGED_WARNING', 
    'REJECTED'
);

-- Phân hệ 3: GIS, Thửa đất & Biến động
CREATE TYPE parcel_survey_status_enum AS ENUM (
    'NOT_SURVEYED', 
    'ASSIGNED_TO_ME', 
    'IN_PROGRESS', 
    'POSTPONED_ABSENT', 
    'SUBMITTED', 
    'APPROVED', 
    'REJECTED'
);

CREATE TYPE parcel_lifecycle_enum AS ENUM (
    'ACTIVE', 
    'PENDING_MUTATION_APPROVAL', 
    'SPLIT_DEPRECATED', 
    'MERGED_DEPRECATED', 
    'MUTATION_VOID'
);

CREATE TYPE mutation_type_enum AS ENUM (
    'ORIGINAL', 
    'SPLIT', 
    'MERGE', 
    'REDRAW'
);

CREATE TYPE mutation_status_enum AS ENUM (
    'PROPOSED_BY_SURVEYOR', 
    'APPROVED', 
    'REJECTED'
);

CREATE TYPE absence_reason_enum AS ENUM (
    'HOMEOWNER_ABSENT', 
    'LOCKED_GATE', 
    'REFUSED_ACCESS'
);

CREATE TYPE task_status_enum AS ENUM (
    'ASSIGNED', 
    'IN_PROGRESS', 
    'SUBMITTED', 
    'COMPLETED', 
    'CANCELLED'
);

-- Phân hệ 4: Hồ sơ khảo sát
CREATE TYPE survey_phase_enum AS ENUM (
    'PHASE_1', 
    'PHASE_2'
);

CREATE TYPE report_status_enum AS ENUM (
    'DRAFT', 
    'SUBMITTED', 
    'UNDER_REVIEW', 
    'APPROVED', 
    'REJECTED'
);

CREATE TYPE survey_level_enum AS ENUM (
    'L2_A', 
    'L2_B', 
    'L2_C'
);

CREATE TYPE photo_ident_type_enum AS ENUM (
    'P01_HOUSE_NUMBER', 
    'P02_MAIN_FACADE', 
    'P03_SIDE_OR_REAR', 
    'P04_CONTEXT_STREET'
);

CREATE TYPE ai_processing_status_enum AS ENUM (
    'NONE', 
    'PENDING', 
    'PROCESSING', 
    'COMPLETED', 
    'FAILED'
);

CREATE TYPE building_grade_enum AS ENUM (
    'GENERAL', 
    'IMPORTANT', 
    'CRITICAL'
);

CREATE TYPE importance_group_enum AS ENUM (
    'GENERAL', 
    'IMPORTANT', 
    'CRITICAL'
);

CREATE TYPE adjacent_structure_enum AS ENUM (
    'TOWNHOUSE', 
    'HIGH_RISE', 
    'PUBLIC', 
    'EMPTY_LAND', 
    'OTHER'
);

CREATE TYPE structural_system_enum AS ENUM (
    'KHUNG_BTCT_CHIU_LUC', 
    'TUONG_GACH_CHIU_LUC', 
    'KET_CAU_THEP', 
    'NHA_GO', 
    'KET_CAU_HON_HOP'
);

CREATE TYPE foundation_category_enum AS ENUM (
    'CAT_1_MONG_NONG_GIA_CO', 
    'CAT_2_MONG_DON_BTCT', 
    'CAT_3_MONG_BANG_BTCT', 
    'CAT_4_MONG_COC_BTCT', 
    'CAT_5_KHONG_XAC_DINH'
);

CREATE TYPE component_type_enum AS ENUM (
    'WALL', 
    'BEAM', 
    'COLUMN', 
    'SLAB', 
    'FLOOR', 
    'STAIRS'
);

CREATE TYPE activity_state_enum AS ENUM (
    'U', 
    'S', 
    'A'
);

CREATE TYPE crack_evolution_enum AS ENUM (
    'STABLE', 
    'WIDENED', 
    'LENGTHENED', 
    'NEW_RECORDED', 
    'REPAIRED'
);

CREATE TYPE survey_coverage_enum AS ENUM (
    'TOAN_BO', 
    'MOT_PHAN', 
    'KHONG_THE_TIEP_CAN'
);

CREATE TYPE reliability_enum AS ENUM (
    'HIGH', 
    'MEDIUM', 
    'LOW'
);

-- Phân hệ 5: Tính điểm & Đánh giá rủi ro
CREATE TYPE ecs_class_enum AS ENUM (
    'GOOD', 
    'MEDIUM', 
    'DEFICIENT', 
    'CRITICAL'
);

CREATE TYPE vi_class_enum AS ENUM (
    'LOW', 
    'MEDIUM', 
    'HIGH', 
    'VERY_HIGH'
);

CREATE TYPE quality_gate_status_enum AS ENUM (
    'PASSED', 
    'FAILED', 
    'NA'
);

-- Phân hệ 6: Cảnh báo gian lận & Bất thường
CREATE TYPE alert_type_enum AS ENUM (
    'GPS_DISTANCE_DISCREPANCY', 
    'ABNORMAL_DURATION', 
    'STRUCTURAL_CRITICAL', 
    'MISSING_SCALE_CARD', 
    'REPEATED_ABSENCE'
);

CREATE TYPE alert_severity_enum AS ENUM (
    'LOW', 
    'MEDIUM', 
    'HIGH', 
    'CRITICAL'
);

-- Phân hệ 7: Đóng gói & Xuất báo cáo
CREATE TYPE export_scope_enum AS ENUM (
    'SELECTED_LIST', 
    'FILTER_CRITERIA', 
    'GLOBAL_ALL_ZONES'
);

CREATE TYPE export_format_enum AS ENUM (
    'PDF_BOOK_COMPILATION', 
    'ZIP_INDIVIDUAL_PDFS', 
    'EXCEL_SUMMARY'
);

CREATE TYPE export_status_enum AS ENUM (
    'QUEUED', 
    'PROCESSING', 
    'COMPLETED', 
    'FAILED', 
    'REVOKED'
);

-- ============================================================================
-- 3. BẢNG DỮ LIỆU - PHÂN HỆ 1: NGƯỜI DÙNG & XÁC THỰC (MODULE 1: AUTH & USERS)
-- ============================================================================

CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    username VARCHAR(64) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(128) NOT NULL,
    email VARCHAR(128),
    phone VARCHAR(32),
    role role_enum NOT NULL,
    assigned_zone_id VARCHAR(32),
    status user_status_enum NOT NULL DEFAULT 'ACTIVE',
    status_reason TEXT,
    avatar_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ
);

CREATE INDEX idx_users_username ON users(username);
CREATE INDEX idx_users_role ON users(role);
CREATE INDEX idx_users_status ON users(status);
CREATE INDEX idx_users_zone ON users(assigned_zone_id);

CREATE TABLE user_sessions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    refresh_token_hash VARCHAR(255) NOT NULL,
    client_ip VARCHAR(64),
    user_agent TEXT,
    expires_at TIMESTAMPTZ NOT NULL,
    is_revoked BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_sessions_user ON user_sessions(user_id);

-- ============================================================================
-- 4. BẢNG DỮ LIỆU - PHÂN HỆ 3: GIS, ĐỊA CHÍNH & MÃ KÉP (MODULE 3: GIS & CADASTRAL)
-- ============================================================================

CREATE TABLE metro_zones (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    zone_code VARCHAR(32) UNIQUE NOT NULL, -- VD: 'ZONE_S1', 'ZONE_S9'
    zone_name VARCHAR(128) NOT NULL,       -- VD: 'Ga S9 - Bà Quẹo'
    boundary_geom GEOMETRY(Polygon, 4326),
    center_geom GEOMETRY(Point, 4326),
    total_parcels_count INT NOT NULL DEFAULT 0,
    approved_parcels_count INT NOT NULL DEFAULT 0,
    assigned_admin_id UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_metro_zones_code ON metro_zones(zone_code);
CREATE INDEX idx_metro_zones_boundary ON metro_zones USING GIST(boundary_geom);
CREATE INDEX idx_metro_zones_center ON metro_zones USING GIST(center_geom);

CREATE TABLE metro_alignments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    line_code VARCHAR(32) UNIQUE NOT NULL DEFAULT 'METRO_2',
    line_name VARCHAR(128) NOT NULL DEFAULT 'Tuyến Metro Số 2 (Bến Thành - Tham Lương)',
    centerline_geom GEOMETRY(LineString, 4326) NOT NULL,
    zoi_buffer_meters NUMERIC(8,2) NOT NULL DEFAULT 50.0,
    zoi_polygon_geom GEOMETRY(Polygon, 4326),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_metro_alignments_line ON metro_alignments USING GIST(centerline_geom);
CREATE INDEX idx_metro_alignments_zoi ON metro_alignments USING GIST(zoi_polygon_geom);

CREATE TABLE parcels (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    zone_id VARCHAR(32) NOT NULL,
    official_cadastral_code VARCHAR(64),          -- Mã địa chính gốc KS003 / Số tờ số thửa
    project_parcel_code VARCHAR(16) UNIQUE NOT NULL, -- Mã B-XXXXX BẤT BIẾN (VD: 'B-00105', 'B-07001')
    field_survey_code VARCHAR(32),                 -- Mã khảo sát thực địa (VD: 'KS004')
    house_number VARCHAR(64),
    street VARCHAR(128),
    ward VARCHAR(64),
    district VARCHAR(64),
    owner_name VARCHAR(128),
    owner_phone VARCHAR(32),
    land_area_m2 NUMERIC(10,2),
    construction_area_m2 NUMERIC(10,2),
    floor_count INT NOT NULL DEFAULT 1,
    importance_group importance_group_enum NOT NULL DEFAULT 'GENERAL',
    adjacent_type adjacent_structure_enum NOT NULL DEFAULT 'TOWNHOUSE',
    location_geom GEOMETRY(Point, 4326),
    cadastral_polygon_geom GEOMETRY(Polygon, 4326),
    footprint_polygon_geom GEOMETRY(Polygon, 4326),
    survey_status parcel_survey_status_enum NOT NULL DEFAULT 'NOT_SURVEYED',
    lifecycle_status parcel_lifecycle_enum NOT NULL DEFAULT 'ACTIVE',
    mutation_type mutation_type_enum NOT NULL DEFAULT 'ORIGINAL',
    parent_parcel_ids UUID[] DEFAULT '{}',
    child_parcel_ids UUID[] DEFAULT '{}',
    mutation_event_id UUID,
    active_phase1_report_id UUID,
    active_phase2_report_id UUID,
    absence_attempt_count INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_parcels_project_code ON parcels(project_parcel_code);
CREATE INDEX idx_parcels_zone ON parcels(zone_id);
CREATE INDEX idx_parcels_status ON parcels(survey_status);
CREATE INDEX idx_parcels_lifecycle ON parcels(lifecycle_status);
CREATE INDEX idx_parcels_location ON parcels USING GIST(location_geom);
CREATE INDEX idx_parcels_cadastral ON parcels USING GIST(cadastral_polygon_geom);
CREATE INDEX idx_parcels_footprint ON parcels USING GIST(footprint_polygon_geom);

CREATE TABLE survey_absence_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    parcel_id UUID NOT NULL REFERENCES parcels(id) ON DELETE CASCADE,
    surveyor_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    absence_reason absence_reason_enum NOT NULL,
    notes TEXT,
    photo_proof_url TEXT,
    reschedule_date TIMESTAMPTZ,
    attempt_count INT NOT NULL DEFAULT 1,
    recorded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_absence_parcel ON survey_absence_logs(parcel_id);
CREATE INDEX idx_absence_surveyor ON survey_absence_logs(surveyor_id);

CREATE TABLE parcel_mutation_events (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    mutation_code VARCHAR(64) UNIQUE NOT NULL,
    mutation_type mutation_type_enum NOT NULL,
    source_parcel_ids UUID[] NOT NULL,
    result_parcel_ids UUID[] NOT NULL,
    original_geojson JSONB,
    new_geojson JSONB,
    surveyor_notes TEXT,
    surveyor_id UUID NOT NULL REFERENCES users(id),
    zone_admin_id UUID REFERENCES users(id),
    status mutation_status_enum NOT NULL DEFAULT 'PROPOSED_BY_SURVEYOR',
    rejection_reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    approved_at TIMESTAMPTZ
);

CREATE INDEX idx_mutations_status ON parcel_mutation_events(status);

CREATE TABLE task_assignments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    parcel_id UUID NOT NULL REFERENCES parcels(id) ON DELETE CASCADE,
    surveyor_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    assigned_by_admin_id UUID NOT NULL REFERENCES users(id),
    deadline TIMESTAMPTZ NOT NULL,
    status task_status_enum NOT NULL DEFAULT 'ASSIGNED',
    notes TEXT,
    assigned_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_tasks_surveyor ON task_assignments(surveyor_id);
CREATE INDEX idx_tasks_parcel ON task_assignments(parcel_id);
CREATE INDEX idx_tasks_status ON task_assignments(status);

-- ============================================================================
-- 5. BẢNG DỮ LIỆU - PHÂN HỆ 2: CHẤM CÔNG THỰC ĐỊA (MODULE 2: ATTENDANCE)
-- ============================================================================

CREATE TABLE timekeeping_checkins (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    surveyor_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    zone_id VARCHAR(32) NOT NULL,
    checkin_time TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    gps_location GEOMETRY(Point, 4326) NOT NULL,
    distance_to_zone_center_meters NUMERIC(10,2) NOT NULL DEFAULT 0.0,
    is_within_zone_boundary BOOLEAN NOT NULL DEFAULT TRUE,
    selfie_photo_url TEXT,
    notes TEXT,
    verification_status verification_status_enum NOT NULL DEFAULT 'PENDING_VERIFICATION',
    verified_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    verified_at TIMESTAMPTZ,
    verification_notes TEXT,
    has_anomaly_flag BOOLEAN NOT NULL DEFAULT FALSE,
    anomaly_reason TEXT
);

CREATE INDEX idx_checkins_surveyor ON timekeeping_checkins(surveyor_id);
CREATE INDEX idx_checkins_zone ON timekeeping_checkins(zone_id);
CREATE INDEX idx_checkins_time ON timekeeping_checkins(checkin_time);
CREATE INDEX idx_checkins_status ON timekeeping_checkins(verification_status);
CREATE INDEX idx_checkins_location ON timekeeping_checkins USING GIST(gps_location);

-- ============================================================================
-- 6. BẢNG DỮ LIỆU - PHÂN HỆ 4: HỒ SƠ KHẢO SÁT (MODULE 4: SURVEY REPORTS)
-- ============================================================================

CREATE TABLE base_survey_reports (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    parcel_id UUID NOT NULL REFERENCES parcels(id) ON DELETE CASCADE,
    surveyor_id UUID NOT NULL REFERENCES users(id),
    zone_admin_id UUID REFERENCES users(id),
    report_code VARCHAR(64) UNIQUE NOT NULL,
    phase survey_phase_enum NOT NULL DEFAULT 'PHASE_1',
    status report_status_enum NOT NULL DEFAULT 'DRAFT',
    current_step INT NOT NULL DEFAULT 1,
    survey_date DATE NOT NULL DEFAULT CURRENT_DATE,
    summary_conclusions TEXT,
    engineering_recommendations TEXT,
    official_pdf_url TEXT,
    surveyor_signature_url TEXT,
    owner_signature_url TEXT,
    owner_remarks TEXT,
    is_refused_or_absent BOOLEAN NOT NULL DEFAULT FALSE,
    refusal_doc_ref VARCHAR(128),
    submitted_at TIMESTAMPTZ,
    approved_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_reports_parcel ON base_survey_reports(parcel_id);
CREATE INDEX idx_reports_surveyor ON base_survey_reports(surveyor_id);
CREATE INDEX idx_reports_status ON base_survey_reports(status);
CREATE INDEX idx_reports_phase ON base_survey_reports(phase);

CREATE TABLE phase1_report_details (
    report_id UUID PRIMARY KEY REFERENCES base_survey_reports(id) ON DELETE CASCADE,
    is_historical_baseline BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE phase2_report_details (
    report_id UUID PRIMARY KEY REFERENCES base_survey_reports(id) ON DELETE CASCADE,
    phase1_report_id UUID NOT NULL REFERENCES base_survey_reports(id),
    work_section VARCHAR(255),
    survey_level survey_level_enum NOT NULL DEFAULT 'L2_B',
    witness_members TEXT,
    special_conditions TEXT,
    has_structural_alteration BOOLEAN NOT NULL DEFAULT FALSE,
    has_added_floors BOOLEAN NOT NULL DEFAULT FALSE,
    has_changed_load_or_usage BOOLEAN NOT NULL DEFAULT FALSE,
    usage_change_details TEXT,
    data_limitations TEXT,
    notable_damage_summary TEXT,
    is_critical_alert BOOLEAN NOT NULL DEFAULT FALSE,
    monitoring_needs TEXT[] DEFAULT '{}',
    ndt_testing_needed BOOLEAN NOT NULL DEFAULT FALSE,
    ndt_testing_type VARCHAR(255),
    phase2_conclusion VARCHAR(128),
    compensation_verdict VARCHAR(128),
    delta_ecs INT NOT NULL DEFAULT 0,
    contractor_rep_signature_url TEXT,
    third_party_rep_signature_url TEXT,
    witness_signature_url TEXT
);

CREATE TABLE survey_identification_photos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    report_id UUID NOT NULL REFERENCES base_survey_reports(id) ON DELETE CASCADE,
    photo_type photo_ident_type_enum NOT NULL,
    raw_photo_url TEXT,
    annotated_photo_url TEXT,
    ai_enhanced_photo_url TEXT,
    facade_polygon_points_json JSONB, -- Mảng N điểm góc [{x, y}, ...]
    floor_split_lines_json JSONB,      -- Mảng đường phân tầng [{floor, y}, ...]
    dimensions_json JSONB,             -- Kích thước dóng {"h1": "3.8m", ...}
    is_not_applicable BOOLEAN NOT NULL DEFAULT FALSE,
    na_reason TEXT,
    ai_job_id VARCHAR(64),
    ai_processing_status ai_processing_status_enum NOT NULL DEFAULT 'NONE',
    watermark_lat NUMERIC(10,6),
    watermark_lng NUMERIC(10,6),
    watermark_timestamp TIMESTAMPTZ
);

CREATE INDEX idx_ident_photos_report ON survey_identification_photos(report_id);

CREATE TABLE building_specifications (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    report_id UUID UNIQUE NOT NULL REFERENCES base_survey_reports(id) ON DELETE CASCADE,
    building_name VARCHAR(255),
    building_grade building_grade_enum NOT NULL DEFAULT 'GENERAL',
    adjacent_buildings TEXT,
    structural_system structural_system_enum NOT NULL DEFAULT 'KHUNG_BTCT_CHIU_LUC',
    floor_count INT NOT NULL DEFAULT 1,
    basement_count INT NOT NULL DEFAULT 0,
    foundation_category foundation_category_enum NOT NULL DEFAULT 'CAT_2_MONG_DON_BTCT',
    roof_type VARCHAR(64),
    wall_type VARCHAR(64),
    year_of_construction INT,
    is_year_estimated BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE TABLE historical_sensitivities (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    report_id UUID UNIQUE NOT NULL REFERENCES base_survey_reports(id) ON DELETE CASCADE,
    extended_or_renovated BOOLEAN NOT NULL DEFAULT FALSE,
    previous_settlement_or_tilt BOOLEAN NOT NULL DEFAULT FALSE,
    fire_or_accident BOOLEAN NOT NULL DEFAULT FALSE,
    sensitive_equipment_present BOOLEAN NOT NULL DEFAULT FALSE,
    details TEXT,
    e5_history_score INT NOT NULL DEFAULT 0
);

CREATE TABLE damage_zones (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    report_id UUID NOT NULL REFERENCES base_survey_reports(id) ON DELETE CASCADE,
    phase1_damage_zone_id UUID REFERENCES damage_zones(id) ON DELETE SET NULL,
    is_inherited_from_phase1 BOOLEAN NOT NULL DEFAULT FALSE,
    is_new_in_phase2 BOOLEAN NOT NULL DEFAULT FALSE,
    zone_code VARCHAR(32) NOT NULL, -- VD: 'Z-01', 'Z-04 (MỚI)'
    floor_name VARCHAR(64) NOT NULL,
    room_name VARCHAR(128) NOT NULL,
    component_type component_type_enum NOT NULL DEFAULT 'WALL',
    wall_material VARCHAR(64),
    functional_impact_repair_needed BOOLEAN NOT NULL DEFAULT FALSE,
    burland_grade INT NOT NULL DEFAULT 0, -- 0 đến 5
    ctx_photo_url TEXT NOT NULL,
    notes TEXT,
    slab_condition TEXT,
    wall_condition TEXT,
    beam_column_condition TEXT,
    seepage_spalling_condition TEXT,
    deformation_condition TEXT
);

CREATE INDEX idx_damage_zones_report ON damage_zones(report_id);

CREATE TABLE defect_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    zone_id UUID NOT NULL REFERENCES damage_zones(id) ON DELETE CASCADE,
    phase1_defect_item_id UUID REFERENCES defect_items(id) ON DELETE SET NULL,
    is_new_in_phase2 BOOLEAN NOT NULL DEFAULT FALSE,
    defect_code VARCHAR(32) NOT NULL, -- VD: 'D-01', 'D-04 (MỚI)'
    pin_x NUMERIC(5,2) NOT NULL,       -- 0.00% -> 100.00%
    pin_y NUMERIC(5,2) NOT NULL,       -- 0.00% -> 100.00%
    screening_category VARCHAR(64) NOT NULL,
    defect_type VARCHAR(64) NOT NULL,
    crack_direction VARCHAR(128),
    width_max_mm NUMERIC(6,2) NOT NULL,
    length_mm NUMERIC(8,2) NOT NULL,
    activity_state activity_state_enum NOT NULL DEFAULT 'U',
    material_degradation_e4 INT NOT NULL DEFAULT 0,
    structural_significance_e2 INT NOT NULL DEFAULT 0,
    has_scale_card BOOLEAN NOT NULL DEFAULT TRUE,
    is_structural_critical BOOLEAN NOT NULL DEFAULT FALSE,
    cu_photo_url TEXT NOT NULL,
    extra_photo_url TEXT,
    phase1_width_mm NUMERIC(6,2),
    phase2_width_mm NUMERIC(6,2),
    delta_width_mm NUMERIC(6,2),
    phase1_length_mm NUMERIC(8,2),
    phase2_length_mm NUMERIC(8,2),
    delta_length_mm NUMERIC(8,2),
    evolution_status crack_evolution_enum NOT NULL DEFAULT 'STABLE',
    pin_color VARCHAR(16) NOT NULL DEFAULT '#4CAF50'
);

CREATE INDEX idx_defects_zone ON defect_items(zone_id);

CREATE TABLE deformation_assessments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    report_id UUID UNIQUE NOT NULL REFERENCES base_survey_reports(id) ON DELETE CASCADE,
    tilt_angle_x NUMERIC(5,3) NOT NULL DEFAULT 0.0,
    tilt_angle_y NUMERIC(5,3) NOT NULL DEFAULT 0.0,
    tilt_direction VARCHAR(64),
    floor_slope_ratio NUMERIC(6,4) NOT NULL DEFAULT 0.0,
    beam_deflection_mm NUMERIC(6,2) NOT NULL DEFAULT 0.0,
    measurement_method VARCHAR(64) DEFAULT 'LASER_LEVEL',
    measurement_reliability reliability_enum NOT NULL DEFAULT 'HIGH',
    phase2_tilt_x NUMERIC(5,3),
    phase2_tilt_y NUMERIC(5,3),
    delta_tilt_x NUMERIC(5,3),
    delta_tilt_y NUMERIC(5,3),
    delta_beam_deflection_mm NUMERIC(6,2),
    tilt_evolution_verdict VARCHAR(64),
    e3_deformation_score INT NOT NULL DEFAULT 0
);

CREATE TABLE damage_sketches (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    report_id UUID NOT NULL REFERENCES base_survey_reports(id) ON DELETE CASCADE,
    sketch_photo_url TEXT,
    cad_drawing_ref VARCHAR(128),
    notes TEXT,
    uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE survey_scopes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    report_id UUID UNIQUE NOT NULL REFERENCES base_survey_reports(id) ON DELETE CASCADE,
    survey_coverage survey_coverage_enum NOT NULL DEFAULT 'TOAN_BO',
    inaccessible_areas TEXT,
    accessibility_limitations TEXT
);

-- ============================================================================
-- 7. BẢNG DỮ LIỆU - PHÂN HỆ 5: TÍNH ĐIỂM & CHẤT LƯỢNG (MODULE 5: SCORING & QUALITY)
-- ============================================================================

CREATE TABLE risk_score_cards (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    report_id UUID UNIQUE NOT NULL REFERENCES base_survey_reports(id) ON DELETE CASCADE,
    e1_burland_score INT NOT NULL DEFAULT 0,
    e2_structure_score INT NOT NULL DEFAULT 0,
    e3_deformation_score INT NOT NULL DEFAULT 0,
    e4_material_score INT NOT NULL DEFAULT 0,
    e5_history_score INT NOT NULL DEFAULT 0,
    e6_overall_function_score INT NOT NULL DEFAULT 0,
    total_ecs_score INT NOT NULL DEFAULT 0, -- Tổng 0 đến 24
    ecs_class ecs_class_enum NOT NULL DEFAULT 'GOOD',
    v1_importance_score NUMERIC(4,2) NOT NULL DEFAULT 1.0,
    v2_structure_score NUMERIC(4,2) NOT NULL DEFAULT 1.0,
    v3_foundation_score NUMERIC(4,2) NOT NULL DEFAULT 1.0,
    v4_age_score NUMERIC(4,2) NOT NULL DEFAULT 1.0,
    v5_ecs_score NUMERIC(4,2) NOT NULL DEFAULT 1.0,
    v6_sensitivity_score NUMERIC(4,2) NOT NULL DEFAULT 1.0,
    avg_vi_score NUMERIC(4,2) NOT NULL DEFAULT 1.0,
    vi_class vi_class_enum NOT NULL DEFAULT 'LOW',
    construction_impact_level_i INT NOT NULL DEFAULT 1,
    building_risk_assessment_bra VARCHAR(32) NOT NULL DEFAULT 'LOW_RISK',
    is_engineering_judgement_applied BOOLEAN NOT NULL DEFAULT FALSE,
    engineering_judgement_action VARCHAR(32) DEFAULT 'KEEP',
    engineering_judgement_reason TEXT
);

CREATE TABLE quality_gate_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    report_id UUID NOT NULL REFERENCES base_survey_reports(id) ON DELETE CASCADE,
    checklist_code VARCHAR(32) NOT NULL, -- 'QG-01' -> 'QG-10'
    item_title VARCHAR(255) NOT NULL,
    status quality_gate_status_enum NOT NULL DEFAULT 'PASSED',
    details TEXT,
    checked_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_qg_report ON quality_gate_logs(report_id);

-- ============================================================================
-- 8. BẢNG DỮ LIỆU - PHÂN HỆ 6: CẢNH BÁO GIAN LẬN & BẤT THƯỜNG (MODULE 6: AUDIT ALERTS)
-- ============================================================================

CREATE TABLE audit_alert_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    report_id UUID NOT NULL REFERENCES base_survey_reports(id) ON DELETE CASCADE,
    parcel_id UUID NOT NULL REFERENCES parcels(id) ON DELETE CASCADE,
    surveyor_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    alert_type alert_type_enum NOT NULL,
    severity alert_severity_enum NOT NULL DEFAULT 'MEDIUM',
    title VARCHAR(255) NOT NULL,
    detail TEXT NOT NULL,
    flagged_values_json JSONB,
    is_resolved BOOLEAN NOT NULL DEFAULT FALSE,
    resolved_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    resolved_notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    resolved_at TIMESTAMPTZ
);

CREATE INDEX idx_audit_alerts_report ON audit_alert_items(report_id);
CREATE INDEX idx_audit_alerts_type ON audit_alert_items(alert_type);
CREATE INDEX idx_audit_alerts_severity ON audit_alert_items(severity);
CREATE INDEX idx_audit_alerts_resolved ON audit_alert_items(is_resolved);

CREATE TABLE system_audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    entity_type VARCHAR(64) NOT NULL,
    entity_id UUID NOT NULL,
    action VARCHAR(64) NOT NULL,
    performed_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    client_ip VARCHAR(64),
    diff_payload JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_system_logs_entity ON system_audit_logs(entity_type, entity_id);
CREATE INDEX idx_system_logs_user ON system_audit_logs(performed_by_user_id);
CREATE INDEX idx_system_logs_time ON system_audit_logs(created_at);

-- ============================================================================
-- 9. BẢNG DỮ LIỆU - PHÂN HỆ 7: XUẤT BÁO CÁO & EXPORT HUB (MODULE 7: EXPORT HUB)
-- ============================================================================

CREATE TABLE compiled_report_batches (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    batch_code VARCHAR(64) UNIQUE NOT NULL,
    zone_id VARCHAR(32), -- Nullable nếu xuất toàn tuyến 'ALL_ZONES'
    export_scope export_scope_enum NOT NULL DEFAULT 'FILTER_CRITERIA',
    selected_report_ids UUID[] DEFAULT '{}',
    filter_criteria_json JSONB,
    period_label VARCHAR(128),
    total_reports_compiled INT NOT NULL DEFAULT 0,
    exported_by_user_id UUID NOT NULL REFERENCES users(id),
    export_format export_format_enum NOT NULL DEFAULT 'PDF_BOOK_COMPILATION',
    include_gis_overview_map BOOLEAN NOT NULL DEFAULT TRUE,
    include_ecs_summary_table BOOLEAN NOT NULL DEFAULT TRUE,
    status export_status_enum NOT NULL DEFAULT 'QUEUED',
    download_url TEXT,
    file_size_bytes BIGINT,
    checksum_sha256 VARCHAR(64),
    error_message TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ
);

CREATE INDEX idx_batches_zone ON compiled_report_batches(zone_id);
CREATE INDEX idx_batches_status ON compiled_report_batches(status);
CREATE INDEX idx_batches_time ON compiled_report_batches(created_at);

CREATE TABLE guest_share_links (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    zone_id VARCHAR(32),
    parcel_id UUID REFERENCES parcels(id) ON DELETE CASCADE,
    share_token VARCHAR(128) UNIQUE NOT NULL,
    passcode_hash VARCHAR(255),
    is_public BOOLEAN NOT NULL DEFAULT FALSE,
    access_count INT NOT NULL DEFAULT 0,
    expires_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_share_token ON guest_share_links(share_token);

-- ============================================================================
-- 10. TRIGGERS & BUSINESS LOGIC INTEGRITY ENFORCEMENT
-- ============================================================================

-- Tự động cập nhật thời gian updated_at
CREATE OR REPLACE FUNCTION update_timestamp_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_update_users_timestamp
BEFORE UPDATE ON users
FOR EACH ROW EXECUTE FUNCTION update_timestamp_column();

CREATE TRIGGER trg_update_parcels_timestamp
BEFORE UPDATE ON parcels
FOR EACH ROW EXECUTE FUNCTION update_timestamp_column();

CREATE TRIGGER trg_update_reports_timestamp
BEFORE UPDATE ON base_survey_reports
FOR EACH ROW EXECUTE FUNCTION update_timestamp_column();
