-- ============================================================================
-- HỆ THỐNG CƠ SỞ DỮ LIỆU KHẢO SÁT HIỆN TRẠNG QUY HOẠCH TUYẾN METRO 2 (BẾN THÀNH - THAM LƯƠNG)
-- Tiêu chuẩn: PostgreSQL 16 + PostGIS Extension
-- Đặc tả kỹ thuật: Bám sát 100% srs/CLASS_DIAGRAM.md & srs/Business_Logic.md
-- ============================================================================

-- 1. KÍCH HOẠT EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "postgis";

-- ============================================================================
-- 2. ĐỊNH NGHĨA CÁC KIỂU DỮ LIỆU ENUM CHUẨN HÓA (ENUM TYPES)
-- ============================================================================

-- Vai trò người dùng (RBAC)
CREATE TYPE role_enum AS ENUM (
    'SUPER_ADMIN', 
    'ZONE_ADMIN', 
    'SURVEYOR', 
    'CONTRACTOR'
);

-- Trạng thái người dùng
CREATE TYPE user_status_enum AS ENUM (
    'ACTIVE', 
    'INACTIVE', 
    'LOCKED'
);

-- Giai đoạn khảo sát
CREATE TYPE survey_phase_enum AS ENUM (
    'PHASE_1_PRE_CONSTRUCTION', 
    'PHASE_2_POST_CONSTRUCTION'
);

-- Cấp khảo sát Phase 2
CREATE TYPE survey_level_enum AS ENUM (
    'L2_A', 
    'L2_B', 
    'L2_C'
);

-- Trạng thái tiến độ khảo sát của thửa đất
CREATE TYPE parcel_survey_status_enum AS ENUM (
    'NOT_SURVEYED', 
    'IN_PROGRESS', 
    'PENDING_REVIEW', 
    'APPROVED', 
    'REJECTED'
);

-- Trạng thái vòng đời thửa đất (Phả hệ biến động)
CREATE TYPE parcel_lifecycle_enum AS ENUM (
    'ACTIVE', 
    'PENDING_MUTATION_APPROVAL', 
    'SPLIT_DEPRECATED', 
    'MERGED_DEPRECATED', 
    'MUTATION_VOID'
);

-- Loại biến động thửa đất
CREATE TYPE mutation_type_enum AS ENUM (
    'ORIGINAL', 
    'SPLIT', 
    'MERGE', 
    'REDRAW'
);

-- Trạng thái phê duyệt biến động
CREATE TYPE mutation_status_enum AS ENUM (
    'PROPOSED_BY_SURVEYOR', 
    'APPROVED', 
    'REJECTED'
);

-- Trạng thái nhiệm vụ giao việc
CREATE TYPE task_status_enum AS ENUM (
    'ASSIGNED', 
    'IN_PROGRESS', 
    'SUBMITTED', 
    'COMPLETED', 
    'CANCELLED'
);

-- Trạng thái vòng đời Báo cáo
CREATE TYPE report_status_enum AS ENUM (
    'DRAFT', 
    'SUBMITTED', 
    'UNDER_REVIEW', 
    'APPROVED', 
    'REJECTED'
);

-- Phân loại ảnh định danh
CREATE TYPE photo_ident_type_enum AS ENUM (
    'P01_HOUSE_NUMBER', 
    'P02_MAIN_FACADE', 
    'P03_SIDE_OR_REAR', 
    'P04_CONTEXT_STREET', 
    'ZONE_CTX', 
    'DEFECT_CU', 
    'DAMAGE_SKETCH', 
    'MEASUREMENT_DEVICE', 
    'CHECKIN_SELFIE', 
    'VERIFICATION_SIGNATURE'
);

-- Trạng thái xử lý AI nắn thẳng ảnh
CREATE TYPE ai_processing_status_enum AS ENUM (
    'NONE', 
    'PENDING', 
    'PROCESSING', 
    'COMPLETED', 
    'FAILED'
);

-- Nhóm đối tượng công trình
CREATE TYPE importance_group_enum AS ENUM (
    'GENERAL', 
    'IMPORTANT', 
    'CRITICAL'
);

-- Loại công trình liền kề
CREATE TYPE adjacent_structure_enum AS ENUM (
    'TOWNHOUSE', 
    'HIGH_RISE', 
    'PUBLIC', 
    'EMPTY_LAND', 
    'OTHER'
);

-- Hệ kết cấu chịu lực
CREATE TYPE structural_system_enum AS ENUM (
    'RC_FRAME', 
    'STEEL_FRAME', 
    'LOAD_BEARING_BRICK', 
    'MIXED', 
    'TIMBER', 
    'OTHER'
);

-- Dạng chịu lực
CREATE TYPE structural_form_enum AS ENUM (
    'FRAME', 
    'WALL', 
    'MIXED', 
    'OTHER'
);

-- Loại móng
CREATE TYPE foundation_type_enum AS ENUM (
    'SHALLOW_PAD', 
    'WOOD_PILE', 
    'PC_PILE', 
    'CIP_BORED_PILE', 
    'UNKNOWN'
);

-- Trạng thái hoạt động vết nứt
CREATE TYPE activity_state_enum AS ENUM (
    'U_UNKNOWN', 
    'S_STABLE', 
    'A_ACTIVE'
);

-- Tiến triển vết nứt Phase 2
CREATE TYPE crack_evolution_enum AS ENUM (
    'STABLE', 
    'WIDENED', 
    'LENGTHENED', 
    'NEW_RECORDED', 
    'REPAIRED'
);

-- Phán quyết bồi thường Phase 2
CREATE TYPE compensation_verdict_enum AS ENUM (
    'NO_IMPACT', 
    'NEGLIGIBLE_COSMETIC', 
    'STRUCTURAL_IMPACT'
);

-- Phân hạng ECS
CREATE TYPE ecs_class_enum AS ENUM (
    'GOOD_0_5', 
    'MEDIUM_6_10', 
    'DEFICIENT_11_16', 
    'CRITICAL_17_24'
);

-- Phân hạng Vulnerability Index
CREATE TYPE vi_class_enum AS ENUM (
    'LOW', 
    'MEDIUM', 
    'HIGH', 
    'VERY_HIGH'
);

-- Định dạng xuất báo cáo hàng loạt
CREATE TYPE export_format_enum AS ENUM (
    'PDF_BOOK_COMPILATION', 
    'ZIP_ARCHIVE', 
    'EXCEL_GEOJSON'
);

-- ============================================================================
-- 3. BẢNG DỮ LIỆU PHÂN KHU & NGƯỜI DÙNG (METRO ZONES & USERS)
-- ============================================================================

-- Bảng Phân khu / Nhà ga Metro 2 (Ga S1 -> Ga S11)
CREATE TABLE metro_zones (
    id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    zone_code                   VARCHAR(50) UNIQUE NOT NULL, -- VD: 'ZONE_S09_BA_QUEO'
    zone_name                   VARCHAR(255) NOT NULL,       -- VD: 'Phân khu Ga S9 - Bà Quẹo'
    boundary_geom               GEOMETRY(POLYGON, 4326),     -- Polygon ranh giới phân khu
    center_lat                  NUMERIC(10, 7),
    center_lng                  NUMERIC(10, 7),
    total_parcels_count         INT DEFAULT 0,
    completed_parcels_count     INT DEFAULT 0,
    created_at                  TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at                  TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Bảng Người dùng hệ thống (SuperAdmin, ZoneAdmin, Surveyor, Contractor)
CREATE TABLE users (
    id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    username                    VARCHAR(100) UNIQUE NOT NULL,
    password_hash               VARCHAR(255) NOT NULL,
    full_name                   VARCHAR(255) NOT NULL,
    email                       VARCHAR(255) UNIQUE,
    phone                       VARCHAR(50),
    role                        role_enum NOT NULL DEFAULT 'SURVEYOR',
    status                      user_status_enum NOT NULL DEFAULT 'ACTIVE',
    assigned_zone_id            UUID REFERENCES metro_zones(id) ON DELETE SET NULL, -- Gán phân khu cho ZoneAdmin / Surveyor
    employee_code               VARCHAR(50),
    last_login_at               TIMESTAMPTZ,
    created_at                  TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at                  TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Bảng Chấm công Hiện trường GPS
CREATE TABLE timekeeping_checkins (
    id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    surveyor_id                 UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    zone_id                     UUID REFERENCES metro_zones(id) ON DELETE SET NULL,
    check_in_time               TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    gps_latitude                NUMERIC(10, 7) NOT NULL,
    gps_longitude               NUMERIC(10, 7) NOT NULL,
    gps_accuracy_m              NUMERIC(6, 2),
    selfie_photo_url            VARCHAR(512) NOT NULL,
    accompanying_members        JSONB, -- Danh sách nhân sự đi cùng: ["Nguyễn Văn A", "Trần Văn B"]
    notes                       TEXT,
    created_at                  TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- 4. BẢNG THỬA ĐẤT MÃ KÉP & BIẾN ĐỘNG RANH GIS (DUAL-ID PARCELS & MUTATION)
-- ============================================================================

CREATE TABLE parcels (
    id                              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    zone_id                         UUID NOT NULL REFERENCES metro_zones(id) ON DELETE RESTRICT,
    
    -- KIẾN TRÚC MÃ KÉP (DUAL-ID)
    official_cadastral_code         VARCHAR(100) NOT NULL, -- Mã địa chính nhà nước (KS003-XXXX hoặc Số tờ - Số thửa)
    project_parcel_code             VARCHAR(50) NOT NULL,  -- Mã quản lý dự án (B-XXXXX, B-07001...)
    
    -- Thông tin địa chỉ & Chủ hộ
    house_number                    VARCHAR(100),
    street                          VARCHAR(255),
    ward                            VARCHAR(100),
    district                        VARCHAR(100),
    owner_name                      VARCHAR(255),
    owner_phone                     VARCHAR(50),
    importance_group                importance_group_enum DEFAULT 'GENERAL',
    adjacent_type                   adjacent_structure_enum DEFAULT 'TOWNHOUSE',
    
    -- Tọa độ & Đo đạc tim tuyến Metro
    gps_latitude                    NUMERIC(10, 7),
    gps_longitude                   NUMERIC(10, 7),
    chainage_km                     NUMERIC(8, 3), -- Lý trình (Km)
    distance_to_metro_centerline_m  NUMERIC(8, 2), -- Khoảng cách tim hầm (m)
    distance_to_clearance_boundary_m NUMERIC(8, 2), -- Khoảng cách ranh GPMB (m)
    
    -- Dữ liệu Không gian GIS (PostGIS)
    polygon_geom                    GEOMETRY(POLYGON, 4326),
    polygon_geojson                 JSONB,
    
    -- Trạng thái khảo sát & Phả hệ vòng đời
    survey_status                   parcel_survey_status_enum DEFAULT 'NOT_SURVEYED',
    lifecycle_status                parcel_lifecycle_enum DEFAULT 'ACTIVE',
    mutation_type                   mutation_type_enum DEFAULT 'ORIGINAL',
    
    parent_parcel_ids               UUID[], -- Mảng UUID thửa cha (nếu do tách thửa)
    child_parcel_ids                UUID[], -- Mảng UUID các thửa con
    
    created_at                      TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at                      TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    
    CONSTRAINT uq_zone_project_code UNIQUE(zone_id, project_parcel_code)
);

-- Spatial Index trên toạ độ ranh đất
CREATE INDEX idx_parcels_polygon_geom ON parcels USING GIST (polygon_geom);
CREATE INDEX idx_parcels_project_code ON parcels(project_parcel_code);
CREATE INDEX idx_parcels_cadastral_code ON parcels(official_cadastral_code);

-- Bảng Sự kiện Biến động Ranh Thửa Đất (Parcel Mutation Event)
CREATE TABLE parcel_mutation_events (
    id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    mutation_code               VARCHAR(100) UNIQUE NOT NULL, -- MUT-202609-0001
    mutation_type               mutation_type_enum NOT NULL,  -- SPLIT, MERGE, REDRAW
    source_parcel_ids           UUID[] NOT NULL,              -- Thửa gốc bị tách/gộp
    result_parcel_ids           UUID[] NOT NULL,              -- Các thửa mới sinh ra
    original_geojson            JSONB NOT NULL,               -- Snapshot polygon cũ
    new_geojson                 JSONB NOT NULL,               -- Polygon mới vẽ
    surveyor_notes              TEXT,
    surveyor_id                 UUID NOT NULL REFERENCES users(id),
    zone_admin_id               UUID REFERENCES users(id),
    status                      mutation_status_enum DEFAULT 'PROPOSED_BY_SURVEYOR',
    rejection_reason            TEXT,
    created_at                  TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    approved_at                 TIMESTAMPTZ
);

-- Bảng Phân công nhiệm vụ (Task Assignment)
CREATE TABLE task_assignments (
    id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    parcel_id                   UUID NOT NULL REFERENCES parcels(id) ON DELETE CASCADE,
    surveyor_id                 UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    assigned_by_admin_id        UUID NOT NULL REFERENCES users(id),
    assigned_at                 TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    deadline                    TIMESTAMPTZ NOT NULL,
    status                      task_status_enum DEFAULT 'ASSIGNED',
    notes                       TEXT,
    completed_at                TIMESTAMPTZ
);

-- Bảng Link chia sẻ cho Khách (Contractor Guest Share Links)
CREATE TABLE guest_share_links (
    id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    zone_id                     UUID REFERENCES metro_zones(id) ON DELETE CASCADE,
    parcel_id                   UUID REFERENCES parcels(id) ON DELETE CASCADE,
    share_token                 VARCHAR(128) UNIQUE NOT NULL,
    passcode_hash               VARCHAR(255),
    is_public                   BOOLEAN DEFAULT FALSE,
    expires_at                  TIMESTAMPTZ NOT NULL,
    access_count                INT DEFAULT 0,
    created_at                  TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- 5. PHÂN HỆ BÁO CÁO KHẢO SÁT HỢP NHẤT (BASE, PHASE 1 & PHASE 2 REPORTS)
-- ============================================================================

-- Bảng Báo cáo Khảo sát Cơ sở (Base Survey Report Aggregate)
CREATE TABLE base_survey_reports (
    id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    parcel_id                   UUID NOT NULL REFERENCES parcels(id) ON DELETE CASCADE,
    surveyor_id                 UUID NOT NULL REFERENCES users(id),
    zone_admin_id               UUID REFERENCES users(id),
    report_code                 VARCHAR(100) UNIQUE NOT NULL, -- REPORT-P1-B00105-202609
    report_type                 survey_phase_enum NOT NULL,   -- PHASE_1 hoặc PHASE_2
    survey_date                 TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    status                      report_status_enum DEFAULT 'DRAFT',
    current_step                INT DEFAULT 1,
    is_data_quality_passed      BOOLEAN DEFAULT FALSE,
    summary_conclusions         TEXT,
    recommendations             TEXT,
    rejection_reason            TEXT,
    file_download_url           VARCHAR(512),
    approved_at                 TIMESTAMPTZ,
    created_at                  TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP,
    updated_at                  TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Bảng Chi tiết Báo cáo Phase 1
CREATE TABLE phase1_survey_details (
    report_id                   UUID PRIMARY KEY REFERENCES base_survey_reports(id) ON DELETE CASCADE,
    is_historical_baseline      BOOLEAN DEFAULT TRUE,
    engineering_judgement_delta INT DEFAULT 0,
    engineering_judgement_reason TEXT
);

-- Bảng Chi tiết Báo cáo Phase 2 (Pre-Construction BCS Form - Phiếu 02)
CREATE TABLE phase2_survey_details (
    report_id                   UUID PRIMARY KEY REFERENCES base_survey_reports(id) ON DELETE CASCADE,
    phase1_report_id            UUID NOT NULL REFERENCES base_survey_reports(id),
    work_section                VARCHAR(255) NOT NULL, -- Đoạn thi công: Ga S9 -> Ga S10
    survey_level                survey_level_enum DEFAULT 'L2_B',
    witness_members             TEXT,
    special_conditions          TEXT,
    
    -- Biến động sau GĐ1
    has_extension_after_phase1  BOOLEAN DEFAULT FALSE,
    extension_detail            TEXT,
    has_repair_after_phase1     BOOLEAN DEFAULT FALSE,
    repair_detail               TEXT,
    has_usage_change_after_phase1 BOOLEAN DEFAULT FALSE,
    usage_change_detail         TEXT,
    other_changes               TEXT,
    
    -- Đánh giá hiện trạng
    total_defects_count         INT DEFAULT 0,
    total_photos_count          INT DEFAULT 0,
    total_sketches_count        INT DEFAULT 0,
    inaccessible_areas          TEXT,
    data_limitations            TEXT,
    most_notable_damage         TEXT,
    has_critical_signs          BOOLEAN DEFAULT FALSE,
    monitoring_needs            TEXT[], -- Mảng: ['LUN', 'NGHIENG', 'NUT', 'RUNG']
    additional_ndt_required     BOOLEAN DEFAULT FALSE,
    ndt_details                 TEXT,
    phase2_condition_conclusion VARCHAR(100),
    checklist_10_items_json     JSONB, -- Kết quả 10 tiêu chí Phụ lục A
    compensation_verdict        compensation_verdict_enum DEFAULT 'NO_IMPACT'
);

-- ============================================================================
-- 6. PHÂN HỆ LƯU TRỮ ẢNH PHÂN LỚP & AI MATRIX (SURVEY PHOTOS & AI PIPELINE)
-- ============================================================================

CREATE TABLE survey_photos (
    id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    report_id                   UUID NOT NULL REFERENCES base_survey_reports(id) ON DELETE CASCADE,
    zone_id                     UUID, -- Sẽ được tham chiếu ở bảng damage_zones
    defect_id                   UUID, -- Sẽ được tham chiếu ở bảng defect_items
    
    photo_type                  photo_ident_type_enum NOT NULL,
    photo_code                  VARCHAR(100) NOT NULL, -- Mã: B-00105-P01, B-00105-F02-R01-D01-CU
    
    is_not_applicable           BOOLEAN DEFAULT FALSE,
    na_reason                   TEXT,
    
    -- Lưu trữ đa lớp
    raw_photo_url               VARCHAR(512),
    thumbnail_url               VARCHAR(512),
    ai_enhanced_photo_url       VARCHAR(512),
    
    -- Lớp Vector Canvas & AI Nắn Thẳng
    facade_polygon_points_json  JSONB, -- 4 điểm góc mặt tiền: [{"x":0.1,"y":0.2}, ...]
    floor_split_lines_json      JSONB, -- Các đường cắt tầng: [{"floor":"Trệt","y":0.8}, ...]
    canvas_annotations_json     JSONB, -- Nét vẽ tay kích thước h1, h2, Htot, W
    
    file_size_bytes             BIGINT,
    mime_type                   VARCHAR(50) DEFAULT 'image/jpeg',
    image_width_px              INT,
    image_height_px             INT,
    checksum_sha256             VARCHAR(64) NOT NULL, -- Mã băm chống làm giả chứng cứ
    
    watermark_lat               NUMERIC(10, 7),
    watermark_lng               NUMERIC(10, 7),
    watermark_timestamp         TIMESTAMPTZ,
    exif_metadata_json          JSONB,
    
    ai_processing_status        ai_processing_status_enum DEFAULT 'NONE',
    ai_perspective_matrix_json  JSONB, -- Ma trận biến đổi nắn thẳng 3x3 Homography
    
    created_at                  TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- 7. ĐẶC TRƯNG KẾT CẤU & ĐỘ NHẠY CẢM LỊCH SỬ (SPECS & SENSITIVITY)
-- ============================================================================

CREATE TABLE building_specifications (
    id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    report_id                   UUID UNIQUE NOT NULL REFERENCES base_survey_reports(id) ON DELETE CASCADE,
    use_type                    VARCHAR(100) NOT NULL DEFAULT 'Nhà ở',
    floors_above                INT NOT NULL DEFAULT 1,
    floors_underground          INT NOT NULL DEFAULT 0,
    construction_year           INT,
    is_age_estimated            BOOLEAN DEFAULT FALSE,
    structural_system           structural_system_enum DEFAULT 'RC_FRAME',
    structural_form             structural_form_enum DEFAULT 'FRAME',
    foundation_type             foundation_type_enum DEFAULT 'SHALLOW_PAD',
    cat_foundation_score        INT CHECK (cat_foundation_score BETWEEN 1 AND 5),
    cat_sources                 TEXT[], -- ['Drawing', 'Owner', 'Site']
    created_at                  TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE historical_sensitivities (
    id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    report_id                   UUID UNIQUE NOT NULL REFERENCES base_survey_reports(id) ON DELETE CASCADE,
    extension_score             INT DEFAULT 0 CHECK (extension_score BETWEEN 0 AND 4),
    structural_repair_score     INT DEFAULT 0 CHECK (structural_repair_score BETWEEN 0 AND 4),
    past_settlement_score       INT DEFAULT 0 CHECK (past_settlement_score BETWEEN 0 AND 4),
    adjacent_impact_score       INT DEFAULT 0 CHECK (adjacent_impact_score BETWEEN 0 AND 4),
    past_severe_incident_score  INT DEFAULT 0 CHECK (past_severe_incident_score BETWEEN 0 AND 4),
    has_sensitive_equipment     BOOLEAN DEFAULT FALSE,
    sensitive_equipment_desc    TEXT,
    usage_status                VARCHAR(50) DEFAULT 'Full',
    is_continuous_operation    BOOLEAN DEFAULT FALSE,
    created_at                  TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- 8. VÙNG KHẢO SÁT & SỔ GHI NHẬN KHUYẾT TẬT ĐỘNG (ZONES & DEFECTS 1->N)
-- ============================================================================

CREATE TABLE damage_zones (
    id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    report_id                   UUID NOT NULL REFERENCES base_survey_reports(id) ON DELETE CASCADE,
    phase1_damage_zone_id       UUID REFERENCES damage_zones(id), -- Kế thừa nếu là Phase 2
    is_inherited_from_phase1    BOOLEAN DEFAULT FALSE,
    is_new_in_phase2            BOOLEAN DEFAULT FALSE,
    
    zone_code                   VARCHAR(50) NOT NULL, -- Z-01, Z-02...
    floor_index                 INT NOT NULL DEFAULT 0,
    floor_name                  VARCHAR(100) NOT NULL, -- Tầng trệt, Lầu 1, Lầu 2...
    room_name                   VARCHAR(100) NOT NULL, -- Phòng khách, P.Ngủ 1, Hành lang...
    wall_material               VARCHAR(100) DEFAULT 'BTCT / Tường gạch',
    ctx_photo_url               VARCHAR(512),
    requires_repair             BOOLEAN DEFAULT FALSE,
    burland_grade               INT DEFAULT 0 CHECK (burland_grade BETWEEN 0 AND 5),
    
    created_at                  TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE defect_items (
    id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    zone_id                     UUID NOT NULL REFERENCES damage_zones(id) ON DELETE CASCADE,
    phase1_defect_item_id       UUID REFERENCES defect_items(id), -- Kế thừa đối soát nếu là Phase 2
    is_new_in_phase2            BOOLEAN DEFAULT FALSE,
    
    defect_code                 VARCHAR(50) NOT NULL, -- D-01, D-02...
    pin_x_ratio                 NUMERIC(6, 4) NOT NULL, -- Tọa độ X tỉ lệ % trên ảnh CTX (0.0000 -> 1.0000)
    pin_y_ratio                 NUMERIC(6, 4) NOT NULL, -- Tọa độ Y tỉ lệ % trên ảnh CTX (0.0000 -> 1.0000)
    cu_photo_url                VARCHAR(512),
    
    screening_indicator         VARCHAR(255),
    component_type              VARCHAR(100),
    crack_pattern               VARCHAR(100),
    crack_width_max_mm          NUMERIC(6, 2), -- w (mm)
    crack_length_mm             NUMERIC(8, 2), -- L (mm)
    crack_direction             VARCHAR(100),
    activity_state              activity_state_enum DEFAULT 'U_UNKNOWN',
    
    -- Điểm số kỹ thuật
    material_degradation_score  INT DEFAULT 0 CHECK (material_degradation_score BETWEEN 0 AND 4),
    structural_significance_score INT DEFAULT 0 CHECK (structural_significance_score BETWEEN 0 AND 4),
    is_structural_critical      BOOLEAN DEFAULT FALSE,
    
    -- Đo đạc biến thiên Delta Phase 2
    phase2_width_mm             NUMERIC(6, 2),
    phase2_length_mm            NUMERIC(8, 2),
    delta_crack_width_mm        NUMERIC(6, 2) DEFAULT 0.00,
    delta_crack_length_mm       NUMERIC(8, 2) DEFAULT 0.00,
    crack_evolution_status      crack_evolution_enum DEFAULT 'STABLE',
    
    created_at                  TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Thêm khóa ngoại cho survey_photos tham chiếu zone_id và defect_id
ALTER TABLE survey_photos ADD CONSTRAINT fk_photos_zone FOREIGN KEY (zone_id) REFERENCES damage_zones(id) ON DELETE CASCADE;
ALTER TABLE survey_photos ADD CONSTRAINT fk_photos_defect FOREIGN KEY (defect_id) REFERENCES defect_items(id) ON DELETE CASCADE;

-- ============================================================================
-- 9. ĐO ĐẠC BIẾN DẠNG LÚN NGHIÊNG & TÍNH ĐIỂM RỦI RO (DEFORMATION & SCORING)
-- ============================================================================

CREATE TABLE deformation_assessments (
    id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    report_id                   UUID UNIQUE NOT NULL REFERENCES base_survey_reports(id) ON DELETE CASCADE,
    
    diff_settlement_status      INT DEFAULT 0 CHECK (diff_settlement_status BETWEEN 0 AND 4),
    diff_settlement_location    VARCHAR(255),
    
    tilt_status                 INT DEFAULT 0 CHECK (tilt_status BETWEEN 0 AND 4),
    tilt_x_percent              NUMERIC(5, 2) DEFAULT 0.00,
    tilt_y_percent              NUMERIC(5, 2) DEFAULT 0.00,
    
    floor_tilt_status           INT DEFAULT 0 CHECK (floor_tilt_status BETWEEN 0 AND 4),
    floor_tilt_percent          NUMERIC(5, 2) DEFAULT 0.00,
    
    deflection_status           INT DEFAULT 0 CHECK (deflection_status BETWEEN 0 AND 4),
    deflection_location         VARCHAR(255),
    deflection_mm               NUMERIC(6, 2) DEFAULT 0.00,
    
    data_sources                TEXT[],
    data_reliability            VARCHAR(50) DEFAULT 'Cao',
    requires_extra_monitoring   BOOLEAN DEFAULT FALSE,
    notes                       TEXT,
    
    created_at                  TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE risk_score_cards (
    id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    report_id                   UUID UNIQUE NOT NULL REFERENCES base_survey_reports(id) ON DELETE CASCADE,
    
    e1_burland_score            INT NOT NULL DEFAULT 0,
    e2_structure_score          INT NOT NULL DEFAULT 0,
    e3_deformation_score        INT NOT NULL DEFAULT 0,
    e4_material_score           INT NOT NULL DEFAULT 0,
    e5_history_score            INT NOT NULL DEFAULT 0,
    e6_overall_function_score   INT NOT NULL DEFAULT 0,
    
    total_ecs_score             INT NOT NULL DEFAULT 0 CHECK (total_ecs_score BETWEEN 0 AND 24),
    ecs_class                   ecs_class_enum NOT NULL DEFAULT 'GOOD_0_5',
    
    v1_function_score           NUMERIC(4, 2) DEFAULT 1.00,
    v2_structure_score          NUMERIC(4, 2) DEFAULT 1.00,
    v_avg_score                 NUMERIC(4, 2) DEFAULT 1.00,
    vi_class                    vi_class_enum NOT NULL DEFAULT 'LOW',
    bra_score                   VARCHAR(50) DEFAULT 'Pending',
    
    created_at                  TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE survey_verifications (
    id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    report_id                   UUID UNIQUE NOT NULL REFERENCES base_survey_reports(id) ON DELETE CASCADE,
    owner_feedback              TEXT,
    surveyor_signature_photo_url VARCHAR(512),
    inspector_signature_photo_url VARCHAR(512),
    owner_signature_photo_url    VARCHAR(512),
    witness_signature_photo_url  VARCHAR(512),
    is_refused_or_absent        BOOLEAN DEFAULT FALSE,
    refusal_doc_reference       VARCHAR(255),
    created_at                  TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================================
-- 10. PHÂN HỆ XUẤT BÁO CÁO HÀNG LOẠT & AUDIT LOGS (BATCH DOSSIER & AUDIT)
-- ============================================================================

CREATE TABLE compiled_report_batches (
    id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    zone_id                     UUID NOT NULL REFERENCES metro_zones(id) ON DELETE RESTRICT,
    batch_code                  VARCHAR(100) UNIQUE NOT NULL, -- DOSSIER-ZONE-S09-202609
    total_reports_count         INT NOT NULL DEFAULT 0,
    date_from                   TIMESTAMPTZ NOT NULL,
    date_to                     TIMESTAMPTZ NOT NULL,
    compiled_by_user_id         UUID NOT NULL REFERENCES users(id),
    export_format               export_format_enum DEFAULT 'PDF_BOOK_COMPILATION',
    file_download_url           VARCHAR(512) NOT NULL,
    file_size_bytes             BIGINT,
    checksum_sha256             VARCHAR(64) NOT NULL,
    is_published_to_guests      BOOLEAN DEFAULT TRUE,
    created_at                  TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE audit_logs (
    id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    entity_type                 VARCHAR(100) NOT NULL, -- 'BASE_REPORT', 'PARCEL', 'MUTATION'...
    entity_id                   UUID NOT NULL,
    action                      VARCHAR(100) NOT NULL, -- 'CREATE', 'APPROVE', 'REJECT', 'SPLIT_PARCEL'...
    performed_by_user_id        UUID NOT NULL REFERENCES users(id),
    client_ip                   VARCHAR(50),
    diff_payload                JSONB,
    created_at                  TIMESTAMPTZ DEFAULT CURRENT_TIMESTAMP
);

-- Index tra cứu nhanh Audit Logs
CREATE INDEX idx_audit_entity ON audit_logs(entity_type, entity_id);
CREATE INDEX idx_audit_user ON audit_logs(performed_by_user_id);
CREATE INDEX idx_audit_time ON audit_logs(created_at DESC);
