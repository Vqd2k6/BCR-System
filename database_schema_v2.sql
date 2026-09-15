-- ============================================================================
-- KSQH METRO 2 — DATABASE SCHEMA V2
-- Bổ sung: Phase 1 (BCS-ECS-BRA), Phase 2 (Pre-Construction),
--           Defect Register, Media Evidences, Survey Signatures (4 bên)
-- Chạy SAU khi database_schema.sql đã được apply.
-- ============================================================================

-- ============================================================================
-- PHẦN 1: THÊM CÁC ENUM MỚI
-- ============================================================================

-- Vai trò bổ sung cho Web Signing
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'user_role_enum') THEN
    CREATE TYPE user_role_enum AS ENUM (
      'SUPER_ADMIN', 'ZONE_MANAGER', 'FIELD_SURVEYOR',
      'CONTRACTOR', 'LOCAL_AUTHORITY', 'AUDITOR'
    );
  ELSE
    -- Thêm 2 vai trò mới nếu chưa có
    ALTER TYPE user_role_enum ADD VALUE IF NOT EXISTS 'CONTRACTOR';
    ALTER TYPE user_role_enum ADD VALUE IF NOT EXISTS 'LOCAL_AUTHORITY';
  END IF;
END $$;

CREATE TYPE building_use_enum AS ENUM (
  'RESIDENTIAL',    -- Nhà ở riêng lẻ
  'COMMERCIAL',     -- Cửa hàng / Thương mại dịch vụ
  'OFFICE',         -- Văn phòng
  'HOTEL',          -- Khách sạn / Nhà trọ
  'PUBLIC',         -- Công cộng (Trường, Bệnh viện, Đình chùa)
  'OTHER'           -- Khác
);

CREATE TYPE importance_group_enum AS ENUM (
  'GENERAL',        -- Công trình thông thường
  'IMPORTANT',      -- Công trình quan trọng
  'CRITICAL'        -- Công trình đặc biệt (Trường học, BV, Di tích)
);

CREATE TYPE structural_system_enum AS ENUM (
  'RC_FRAME',             -- Khung BTCT
  'STEEL',                -- Khung thép
  'LOAD_BEARING_MASONRY', -- Tường gạch chịu lực
  'MIXED',                -- Hỗn hợp
  'OTHER'
);

CREATE TYPE structural_form_enum AS ENUM (
  'FRAME', 'WALL', 'MIXED', 'OTHER'
);

CREATE TYPE foundation_type_enum AS ENUM (
  'SHALLOW',        -- Móng nông (Móng băng, móng đơn)
  'WOOD_PILE',      -- Cọc cừ tràm
  'PRECAST_RC_PILE',-- Cọc BTCT đúc sẵn
  'BORED_PILE',     -- Cọc khoan nhồi (CIP)
  'UNKNOWN'         -- Không rõ
);

CREATE TYPE foundation_source_enum AS ENUM (
  'DRAWING',        -- Có bản vẽ hoàn công
  'OWNER_STATEMENT',-- Chủ nhà cung cấp thông tin
  'SITE_SURVEY'     -- Ước lượng từ khảo sát thực địa
);

CREATE TYPE ecs_class_enum AS ENUM (
  'GOOD',       -- Tốt (0-5 điểm)
  'MEDIUM',     -- Trung bình (6-10 điểm)
  'DEFICIENT',  -- Kém (11-16 điểm)
  'CRITICAL'    -- Nguy cấp (17-24 điểm)
);

CREATE TYPE structural_flag_enum AS ENUM (
  'NONE', 'LOW', 'MODERATE', 'HIGH', 'CRITICAL'
);

CREATE TYPE vi_class_enum AS ENUM (
  'LOW',        -- VIavg <= 1.5
  'MEDIUM',     -- 1.5 < VIavg <= 2.5
  'HIGH',       -- 2.5 < VIavg <= 3.25
  'VERY_HIGH'   -- VIavg > 3.25
);

CREATE TYPE impact_class_enum AS ENUM (
  'I1_LOW', 'I2_MEDIUM', 'I3_HIGH', 'I4_VERY_HIGH', 'PENDING'
);

CREATE TYPE bra_result_enum AS ENUM (
  'LOW', 'MEDIUM', 'HIGH', 'VERY_HIGH', 'PENDING'
);

CREATE TYPE recommended_action_enum AS ENUM (
  'BASELINE_RECORD',            -- Lưu hồ sơ nền, quan trắc theo kế hoạch
  'MONITORING_SETUP',           -- BCS đầy đủ, thiết lập mốc quan trắc
  'DETAILED_INVESTIGATION',     -- Khảo sát kết cấu & móng chi tiết
  'SPECIALIST_REVIEW_HOLD_POINT' -- Đánh giá chuyên sâu, Hold Point thi công
);

CREATE TYPE phase_status_enum AS ENUM (
  'NOT_STARTED',
  'IN_PROGRESS',
  'SUBMITTED',
  'APPROVED',
  'REJECTED'
);

CREATE TYPE defect_type_enum AS ENUM (
  'CRACK',              -- Nứt
  'SETTLEMENT_TILT',    -- Lún/Nghiêng
  'DEFLECTION_SAGGING', -- Võng/Biến dạng
  'SPALLING_DELAMINATION', -- Bong tróc/Tách lớp
  'REBAR_CORROSION',    -- Ăn mòn/Lộ cốt thép
  'WATER_SEEPAGE',      -- Thấm/Ẩm
  'FINISH_DEFECT',      -- Hư hỏng hoàn thiện
  'DOOR_WINDOW_JAM'     -- Kẹt cửa/nứt góc cửa
);

CREATE TYPE crack_direction_v2_enum AS ENUM (
  'DIAGONAL_45',     -- Chéo 45°
  'VERTICAL',        -- Thẳng đứng
  'HORIZONTAL',      -- Nằm ngang
  'STEPPED_MORTAR',  -- Ziczac theo mạch vữa
  'X_PATTERN',       -- Hình chữ X
  'SPIDER_WEB',      -- Mạng nhện
  'RANDOM'           -- Ngẫu nhiên
);

CREATE TYPE defect_activity_enum AS ENUM (
  'STATIC',               -- Tĩnh, không thay đổi
  'ACTIVE_DEVELOPING',    -- Đang phát triển
  'REPAIRED_RECRACKED',   -- Đã sửa, bị nứt lại
  'UNKNOWN'
);

CREATE TYPE delta_comparison_enum AS ENUM (
  'UNCHANGED',          -- Không đổi so với Phase 1
  'DEVELOPED_WIDER',    -- Rộng hơn
  'DEVELOPED_LONGER',   -- Dài hơn
  'REPAIRED',           -- Đã được sửa chữa
  'NEWLY_OBSERVED'      -- Mới phát sinh, không có trong Phase 1
);

CREATE TYPE sign_role_enum AS ENUM (
  'OWNER_RESIDENT',   -- Chủ sở hữu/Người sử dụng
  'SURVEYOR',         -- Cán bộ khảo sát
  'CONTRACTOR',       -- Đại diện Nhà thầu thi công
  'LOCAL_AUTHORITY'   -- Đại diện Chính quyền/Tổ dân phố
);

CREATE TYPE sign_platform_enum AS ENUM (
  'MOBILE_APP',   -- Ký tại hiện trường (Chủ hộ, Cán bộ)
  'WEB_PORTAL'    -- Ký tại văn phòng (Nhà thầu, Chính quyền)
);

-- ============================================================================
-- PHẦN 2: BỔ SUNG CỘT CHO BẢNG `buildings` HIỆN TẠI
-- ============================================================================
ALTER TABLE buildings
  ADD COLUMN IF NOT EXISTS building_code      VARCHAR(50),
  ADD COLUMN IF NOT EXISTS building_use       building_use_enum DEFAULT 'RESIDENTIAL',
  ADD COLUMN IF NOT EXISTS importance_group   importance_group_enum DEFAULT 'GENERAL',
  ADD COLUMN IF NOT EXISTS storeys_above      INT DEFAULT 1,
  ADD COLUMN IF NOT EXISTS storeys_basement   INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS construction_year  INT,
  ADD COLUMN IF NOT EXISTS is_year_estimated  BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS structural_system  structural_system_enum,
  ADD COLUMN IF NOT EXISTS structural_form    structural_form_enum,
  ADD COLUMN IF NOT EXISTS foundation_type    foundation_type_enum DEFAULT 'UNKNOWN',
  ADD COLUMN IF NOT EXISTS foundation_cat     INT DEFAULT 5 CHECK (foundation_cat BETWEEN 1 AND 5),
  ADD COLUMN IF NOT EXISTS foundation_source  foundation_source_enum,
  ADD COLUMN IF NOT EXISTS adjacent_context   VARCHAR(50),
  -- GIS tự động tính từ PostGIS (trigger)
  ADD COLUMN IF NOT EXISTS chainage_km        VARCHAR(20),
  ADD COLUMN IF NOT EXISTS distance_to_metro_m FLOAT,
  -- Trạng thái phân pha
  ADD COLUMN IF NOT EXISTS phase1_status      phase_status_enum DEFAULT 'NOT_STARTED',
  ADD COLUMN IF NOT EXISTS phase2_status      phase_status_enum DEFAULT 'NOT_STARTED';

-- Unique constraint cho building_code
CREATE UNIQUE INDEX IF NOT EXISTS idx_buildings_building_code ON buildings (building_code)
  WHERE building_code IS NOT NULL;

-- ============================================================================
-- PHẦN 3: BẢNG HỒ SƠ KHẢO SÁT NỀN PHASE 1 (BCS-ECS-BRA)
-- ============================================================================
CREATE TABLE IF NOT EXISTS phase1_assessments (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    building_id         UUID NOT NULL REFERENCES buildings(id) ON DELETE CASCADE,
    zone_id             VARCHAR(50) REFERENCES survey_zones(id),
    surveyor_id         UUID REFERENCES users(id),
    checker_id          UUID REFERENCES users(id),
    approver_id         UUID REFERENCES users(id),
    status              phase_status_enum NOT NULL DEFAULT 'IN_PROGRESS',
    rejection_reason    TEXT,

    -- MỤC 2: Phạm vi khảo sát
    surveyed_scope      TEXT[],   -- ['Ngoài', 'Trong', 'Mái', 'Hầm', 'Khu phụ']
    has_access_restriction  BOOLEAN DEFAULT FALSE,
    access_restriction_notes TEXT,

    -- MỤC 3: Lịch sử & Nhạy cảm (Sensitivity)
    has_extensions_load_change      BOOLEAN,  -- TRUE/FALSE/NULL(Chưa rõ)
    has_major_repairs               BOOLEAN,
    has_prior_settlement_tilt       BOOLEAN,
    has_adjacent_construction_damage BOOLEAN,
    has_fire_flood_incidents        BOOLEAN,
    has_sensitive_equipment         BOOLEAN,
    sensitive_equipment_notes       TEXT,
    occupancy_status                VARCHAR(50), -- 'Đầy đủ', 'Một phần', 'Không sử dụng', '24/7'

    -- MỤC 4: BCS Sàng lọc (8 nhóm, lưu dạng JSONB vì số lượng nhiều)
    bcs_screening_results JSONB DEFAULT '{}',
    -- Schema: { "crackWall": true, "crackStructural": false, "settlementTilt": true,
    --           "waterSeepage": false, "spalling": false, "sectionLoss": false,
    --           "doorWindowJam": false, "activeDeveloping": true,
    --           "details": "Nứt tường phòng khách, dấu hiệu đang mở rộng" }

    -- MỤC 9: Thang đo Burland
    burland_predominant INT DEFAULT 0 CHECK (burland_predominant BETWEEN 0 AND 5),
    burland_local_max   INT DEFAULT 0 CHECK (burland_local_max BETWEEN 0 AND 5),

    -- MỤC 11: Chỉ số ECS (6 tiêu chí, mỗi tiêu chí 0-4 điểm)
    e1_structural_cracks        INT DEFAULT 0 CHECK (e1_structural_cracks BETWEEN 0 AND 4),
    e2_wall_masonry_cracks      INT DEFAULT 0 CHECK (e2_wall_masonry_cracks BETWEEN 0 AND 4),
    e3_deformation_tilt         INT DEFAULT 0 CHECK (e3_deformation_tilt BETWEEN 0 AND 4),
    e4_water_seepage_deterioration INT DEFAULT 0 CHECK (e4_water_seepage_deterioration BETWEEN 0 AND 4),
    e5_history_integrity        INT DEFAULT 0 CHECK (e5_history_integrity BETWEEN 0 AND 4),
    e6_functionality_state      INT DEFAULT 0 CHECK (e6_functionality_state BETWEEN 0 AND 4),
    -- Tổng điểm ECS tính tự động qua trigger
    ecs_total_score             INT DEFAULT 0,
    ecs_class                   ecs_class_enum,
    structural_flag             structural_flag_enum DEFAULT 'NONE',
    ecs_override_reason         TEXT, -- Ghi chú khi có Engineering Judgement override

    -- MỤC 12: Data Completeness Gate
    data_gate_foundation_info   BOOLEAN DEFAULT FALSE,
    data_gate_photos_mapping    BOOLEAN DEFAULT FALSE,
    data_gate_interior_survey   BOOLEAN DEFAULT FALSE,
    data_gate_settlement_data   BOOLEAN DEFAULT FALSE,
    data_gate_drawings          BOOLEAN DEFAULT FALSE,
    data_gate_structural_review BOOLEAN DEFAULT FALSE,
    data_gate_bra_ready         VARCHAR(20) DEFAULT 'PENDING', -- 'YES', 'CONDITIONAL', 'NO', 'PENDING'

    -- MỤC 13: Chỉ số Dễ tổn thương VI (6 tiêu chí, 1-4 điểm)
    v1_use_consequence      INT CHECK (v1_use_consequence BETWEEN 1 AND 4),
    v2_structural_fragility INT CHECK (v2_structural_fragility BETWEEN 1 AND 4),
    v3_foundation_uncertainty INT,  -- Auto-mapped từ foundation_cat
    v4_age_modifications    INT CHECK (v4_age_modifications BETWEEN 1 AND 4),
    v5_existing_condition   INT,    -- Auto-mapped từ ecs_class
    v6_sensitive_equipment  INT CHECK (v6_sensitive_equipment BETWEEN 1 AND 4),
    vi_total_score          INT,
    vi_average              NUMERIC(4,2),
    vi_class                vi_class_enum,
    vi_override_reason      TEXT,

    -- MỤC 14: Tác động Thi công Metro (I)
    metro_structure_type        VARCHAR(50), -- 'TBM_TUNNEL', 'CUT_AND_COVER', 'STATION_BOX'
    predicted_settlement_smax_mm FLOAT,
    predicted_angular_distortion FLOAT,
    predicted_vibration_ppv_mms  FLOAT,
    construction_impact_class   impact_class_enum DEFAULT 'PENDING',

    -- MỤC 15: Kết quả BRA
    bra_result              bra_result_enum DEFAULT 'PENDING',
    recommended_action      recommended_action_enum,

    -- Metadata
    survey_date             TIMESTAMPTZ DEFAULT NOW(),
    submitted_at            TIMESTAMPTZ,
    approved_at             TIMESTAMPTZ,
    created_at              TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_phase1_building_id ON phase1_assessments (building_id);
CREATE INDEX IF NOT EXISTS idx_phase1_status ON phase1_assessments (status);

-- ============================================================================
-- PHẦN 4: TRIGGER TỰ ĐỘNG TÍNH ECS & VI KHI INSERT/UPDATE phase1_assessments
-- ============================================================================
CREATE OR REPLACE FUNCTION fn_calculate_ecs_vi()
RETURNS TRIGGER AS $$
DECLARE
  v_ecs_total  INT;
  v_ecs_class  ecs_class_enum;
  v_struct_flag structural_flag_enum;
  v_v3         INT;
  v_v5         INT;
  v_vi_total   INT;
  v_vi_avg     NUMERIC(4,2);
  v_vi_class   vi_class_enum;
  v_found_cat  INT;
BEGIN
  -- Tính tổng ECS
  v_ecs_total := COALESCE(NEW.e1_structural_cracks,0)
               + COALESCE(NEW.e2_wall_masonry_cracks,0)
               + COALESCE(NEW.e3_deformation_tilt,0)
               + COALESCE(NEW.e4_water_seepage_deterioration,0)
               + COALESCE(NEW.e5_history_integrity,0)
               + COALESCE(NEW.e6_functionality_state,0);

  -- Phân loại ECS class
  IF v_ecs_total <= 5 THEN v_ecs_class := 'GOOD';
  ELSIF v_ecs_total <= 10 THEN v_ecs_class := 'MEDIUM';
  ELSIF v_ecs_total <= 16 THEN v_ecs_class := 'DEFICIENT';
  ELSE v_ecs_class := 'CRITICAL';
  END IF;

  -- === STRUCTURAL OVERRIDE (Bắt buộc, không thể bỏ qua) ===
  IF COALESCE(NEW.e1_structural_cracks,0) >= 3 OR COALESCE(NEW.e3_deformation_tilt,0) >= 3 THEN
    IF COALESCE(NEW.e1_structural_cracks,0) >= 4 OR COALESCE(NEW.e3_deformation_tilt,0) >= 4 THEN
      v_struct_flag := 'CRITICAL';
    ELSE
      v_struct_flag := 'HIGH';
    END IF;
    -- Khóa không cho xuống Good/Medium
    IF v_ecs_class = 'GOOD' OR v_ecs_class = 'MEDIUM' THEN
      v_ecs_class := 'DEFICIENT';
      NEW.ecs_override_reason := 'AUTO: Structural Override kích hoạt - Nứt kết cấu chịu lực hoặc Lún nghiêng nghiêm trọng.';
    END IF;
  ELSIF COALESCE(NEW.e1_structural_cracks,0) >= 2 OR COALESCE(NEW.e3_deformation_tilt,0) >= 2 THEN
    v_struct_flag := 'MODERATE';
  ELSIF COALESCE(NEW.e1_structural_cracks,0) >= 1 OR COALESCE(NEW.e3_deformation_tilt,0) >= 1 THEN
    v_struct_flag := 'LOW';
  ELSE
    v_struct_flag := 'NONE';
  END IF;

  NEW.ecs_total_score := v_ecs_total;
  NEW.ecs_class := v_ecs_class;
  NEW.structural_flag := v_struct_flag;

  -- Tự động tính V3 từ foundation_cat của bảng buildings
  SELECT COALESCE(foundation_cat, 5) INTO v_found_cat
  FROM buildings WHERE id = NEW.building_id;
  v_v3 := LEAST(4, CEIL(v_found_cat::FLOAT * 4.0 / 5.0));

  -- Tự động tính V5 từ ECS class
  v_v5 := CASE v_ecs_class
    WHEN 'GOOD'     THEN 1
    WHEN 'MEDIUM'   THEN 2
    WHEN 'DEFICIENT' THEN 3
    WHEN 'CRITICAL' THEN 4
    ELSE 2
  END;

  NEW.v3_foundation_uncertainty := v_v3;
  NEW.v5_existing_condition := v_v5;

  -- Tính VI (nếu đã nhập đủ V1, V2, V4, V6)
  IF NEW.v1_use_consequence IS NOT NULL AND NEW.v2_structural_fragility IS NOT NULL
     AND NEW.v4_age_modifications IS NOT NULL AND NEW.v6_sensitive_equipment IS NOT NULL THEN
    v_vi_total := NEW.v1_use_consequence + NEW.v2_structural_fragility
                + v_v3 + NEW.v4_age_modifications + v_v5 + NEW.v6_sensitive_equipment;
    v_vi_avg := v_vi_total::FLOAT / 6.0;
    IF v_vi_avg <= 1.5 THEN v_vi_class := 'LOW';
    ELSIF v_vi_avg <= 2.5 THEN v_vi_class := 'MEDIUM';
    ELSIF v_vi_avg <= 3.25 THEN v_vi_class := 'HIGH';
    ELSE v_vi_class := 'VERY_HIGH';
    END IF;
    NEW.vi_total_score := v_vi_total;
    NEW.vi_average := v_vi_avg;
    NEW.vi_class := v_vi_class;
  END IF;

  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_calculate_ecs_vi
BEFORE INSERT OR UPDATE ON phase1_assessments
FOR EACH ROW EXECUTE FUNCTION fn_calculate_ecs_vi();

-- ============================================================================
-- PHẦN 5: BẢNG HỒ SƠ KHẢO SÁT PRE-CONSTRUCTION PHASE 2
-- ============================================================================
CREATE TABLE IF NOT EXISTS phase2_pre_construction (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    building_id         UUID NOT NULL REFERENCES buildings(id) ON DELETE CASCADE,
    -- Kế thừa bắt buộc từ Phase 1 đã APPROVED
    phase1_id           UUID NOT NULL REFERENCES phase1_assessments(id) ON DELETE RESTRICT,
    zone_id             VARCHAR(50) REFERENCES survey_zones(id),
    surveyor_id         UUID REFERENCES users(id),
    status              phase_status_enum NOT NULL DEFAULT 'IN_PROGRESS',
    rejection_reason    TEXT,

    -- MỤC 2: Phạm vi tiếp cận chi tiết
    access_status       VARCHAR(50) DEFAULT 'FULL', -- 'FULL', 'PARTIAL', 'REFUSED', 'ABSENT'
    restriction_reason  TEXT,
    surveyed_areas      TEXT[],  -- ['Mặt tiền', 'Mái', 'Tầng 1', 'Tầng 2', 'Tầng hầm', 'Khu phụ']

    -- MỤC 3: Biến động kể từ Phase 1
    repairs_since_phase1        BOOLEAN DEFAULT FALSE,
    repairs_description         TEXT,
    new_external_damages        BOOLEAN DEFAULT FALSE,
    new_external_damages_desc   TEXT,
    current_usage_state         VARCHAR(50), -- 'Ổn định', 'Đang sửa chữa', 'Bỏ trống', 'Đổi công năng'

    -- MỤC 8: Ảnh chụp bản vẽ mặt bằng phác thảo vẽ tay
    sketch_photo_url            TEXT,
    sketch_photo_code           VARCHAR(100), -- VD: B-XXXX-SKETCH-F01
    sketch_notes                TEXT,
    sketch_captured_at          TIMESTAMPTZ,

    -- MỤC 9: Tóm tắt & Cảnh báo nguy cấp
    has_critical_damage_alert   BOOLEAN DEFAULT FALSE,
    monitoring_demand           TEXT[], -- ['Lún', 'Nghiêng', 'Nứt', 'Rung']
    overall_condition_summary   VARCHAR(80), -- 'STABLE', 'MONITOR', 'SPECIALIST_NEEDED'
    specialist_notes            TEXT,

    -- MỤC 6: Đo đạc lún/nghiêng nhanh
    tilt_angle_degree           FLOAT,
    tilt_direction              VARCHAR(30),
    tilt_measurement_method     VARCHAR(50), -- 'Dây rọi', 'Laser', 'Nivô', 'Ước tính'

    -- MỤC 11: Ý kiến chủ sở hữu
    owner_comments              TEXT,
    no_additional_comments      BOOLEAN DEFAULT FALSE,

    -- Metadata
    survey_date                 TIMESTAMPTZ DEFAULT NOW(),
    submitted_at                TIMESTAMPTZ,
    approved_at                 TIMESTAMPTZ,
    created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_phase2_building_id ON phase2_pre_construction (building_id);
CREATE INDEX IF NOT EXISTS idx_phase2_phase1_id ON phase2_pre_construction (phase1_id);
CREATE INDEX IF NOT EXISTS idx_phase2_status ON phase2_pre_construction (status);

-- ============================================================================
-- PHẦN 6: TRIGGER PREREQUISITE GATE — Chặn tạo Phase 2 khi Phase 1 chưa APPROVED
-- ============================================================================
CREATE OR REPLACE FUNCTION fn_prerequisite_phase2_gate()
RETURNS TRIGGER AS $$
DECLARE
  v_phase1_status phase_status_enum;
BEGIN
  SELECT status INTO v_phase1_status
  FROM phase1_assessments
  WHERE id = NEW.phase1_id;

  IF v_phase1_status IS NULL THEN
    RAISE EXCEPTION 'Không tìm thấy hồ sơ Phase 1 (ID: %). Vui lòng tạo và nộp Phase 1 trước.', NEW.phase1_id;
  END IF;

  IF v_phase1_status <> 'APPROVED' THEN
    RAISE EXCEPTION 'Hồ sơ Phase 1 phải được PHÊ DUYỆT (APPROVED) trước khi tạo Phase 2. Trạng thái hiện tại: %', v_phase1_status;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_prerequisite_phase2_gate
BEFORE INSERT ON phase2_pre_construction
FOR EACH ROW EXECUTE FUNCTION fn_prerequisite_phase2_gate();

-- ============================================================================
-- PHẦN 7: BẢNG SỔ KHUYẾT TẬT CHI TIẾT (DEFECT REGISTER D-01..D-99)
-- ============================================================================
CREATE TABLE IF NOT EXISTS defect_register (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    phase2_id           UUID NOT NULL REFERENCES phase2_pre_construction(id) ON DELETE CASCADE,
    building_id         UUID NOT NULL REFERENCES buildings(id) ON DELETE CASCADE,
    defect_code         VARCHAR(20) NOT NULL,  -- D-01, D-02...
    defect_seq          INT NOT NULL,          -- Số thứ tự trong hồ sơ (1, 2, 3...)

    -- Vị trí chi tiết
    floor_name          VARCHAR(50) NOT NULL,  -- 'Tầng 1', 'Tầng 2', 'Mái', 'Hầm'
    room_or_zone        VARCHAR(100) NOT NULL, -- 'Phòng khách', 'Bếp', 'Mặt tiền ngoài'
    structural_element  VARCHAR(50) NOT NULL,  -- 'COLUMN', 'BEAM', 'SLAB', 'WALL', 'CEILING'...
    element_material    VARCHAR(50),           -- 'RC', 'BRICK', 'STEEL', 'PLASTER', 'TILE'

    -- Phân loại khuyết tật
    defect_type         defect_type_enum NOT NULL,
    burland_grade       INT CHECK (burland_grade BETWEEN 0 AND 5), -- Chỉ áp dụng cho nứt tường xây

    -- Thông số đo lường (Phase 2 - Chi tiết)
    max_crack_width_mm  NUMERIC(6,2),  -- Bề rộng vết nứt lớn nhất (mm)
    crack_length_m      NUMERIC(6,2),  -- Chiều dài vết nứt (m)
    crack_direction     crack_direction_v2_enum,
    activity_status     defect_activity_enum DEFAULT 'UNKNOWN',

    -- SO SÁNH DELTA VỚI PHASE 1 (Cốt lõi nghiệp vụ)
    comparison_with_phase1  delta_comparison_enum NOT NULL,
    phase1_width_mm         NUMERIC(6,2),  -- Bề rộng đã ghi nhận ở Phase 1 (để so sánh)
    phase1_length_m         NUMERIC(6,2),
    delta_width_change_mm   NUMERIC(6,2) GENERATED ALWAYS AS (
      CASE WHEN max_crack_width_mm IS NOT NULL AND phase1_width_mm IS NOT NULL
           THEN max_crack_width_mm - phase1_width_mm ELSE NULL END
    ) STORED,

    -- Ghim điểm lên ảnh bản vẽ vẽ tay (% tọa độ trên ảnh)
    sketch_pin_x_percent    FLOAT,  -- 0.0 - 100.0
    sketch_pin_y_percent    FLOAT,  -- 0.0 - 100.0

    defect_notes        TEXT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    UNIQUE (phase2_id, defect_code)
);

CREATE INDEX IF NOT EXISTS idx_defect_phase2_id ON defect_register (phase2_id);
CREATE INDEX IF NOT EXISTS idx_defect_building_id ON defect_register (building_id);

-- ============================================================================
-- PHẦN 8: BẢNG QUẢN LÝ HÌNH ẢNH BẰNG CHỨNG PHÁP LÝ (MEDIA EVIDENCES)
-- ============================================================================
CREATE TABLE IF NOT EXISTS media_evidences (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    building_id         UUID NOT NULL REFERENCES buildings(id) ON DELETE CASCADE,
    phase1_id           UUID REFERENCES phase1_assessments(id) ON DELETE SET NULL,
    phase2_id           UUID REFERENCES phase2_pre_construction(id) ON DELETE SET NULL,
    defect_id           UUID REFERENCES defect_register(id) ON DELETE SET NULL,

    -- Phân loại ảnh (theo Phụ lục B biểu mẫu Phase 2)
    photo_type          VARCHAR(50) NOT NULL,
    -- 'P01_HOUSE_NUMBER', 'P02_MAIN_FACADE', 'P03_SIDE_REAR', 'P04_CONTEXT'
    -- 'DEFECT_CTX', 'DEFECT_CU_RULER', 'HAND_DRAWN_SKETCH'
    photo_code          VARCHAR(100) NOT NULL, -- B-XXXX-P01, B-XXXX-F01-R01-D01-CTX, ...

    -- Lưu trữ Cloudflare R2
    storage_key         VARCHAR(500) NOT NULL, -- Object key trên R2
    public_url          TEXT NOT NULL,
    thumbnail_url       TEXT,
    file_size_bytes     BIGINT,
    mime_type           VARCHAR(50) DEFAULT 'image/jpeg',

    -- Metadata Pháp lý bất biến (Watermark)
    captured_gps        geometry(Point, 4326), -- GPS phần cứng lúc chụp
    device_heading_deg  FLOAT,   -- Hướng la bàn (0-360°)
    captured_at         TIMESTAMPTZ NOT NULL,  -- Mốc thời gian epoch phần cứng
    watermark_data      JSONB NOT NULL DEFAULT '{}',
    -- { buildingCode, defectCode, gps, accuracy_m, timestamp_iso, surveyorCode, surveyorName }

    -- Kiểm soát chất lượng ảnh CU
    has_metric_ruler    BOOLEAN DEFAULT FALSE, -- Xác nhận ảnh CU có thước đo vạch mm

    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_media_building_id ON media_evidences (building_id);
CREATE INDEX IF NOT EXISTS idx_media_phase2_id ON media_evidences (phase2_id);
CREATE INDEX IF NOT EXISTS idx_media_defect_id ON media_evidences (defect_id);
CREATE INDEX IF NOT EXISTS idx_media_captured_gps ON media_evidences USING GIST (captured_gps);

-- ============================================================================
-- PHẦN 9: BẢNG CHỮ KÝ SỐ 4 BÊN (SURVEY SIGNATURES — HYBRID E-SIGNATURE)
-- ============================================================================
CREATE TABLE IF NOT EXISTS survey_signatures (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    phase2_id           UUID NOT NULL REFERENCES phase2_pre_construction(id) ON DELETE CASCADE,
    building_id         UUID NOT NULL REFERENCES buildings(id) ON DELETE CASCADE,

    -- Vai trò & Nền tảng ký
    sign_role           sign_role_enum NOT NULL,
    platform_origin     sign_platform_enum NOT NULL,

    -- Thông tin người ký
    signer_full_name    VARCHAR(150) NOT NULL,
    signer_title        VARCHAR(100),  -- 'Chủ hộ', 'Kỹ sư giám sát', 'Đại diện UBND P.12'
    signer_id_number    VARCHAR(50),   -- CCCD / CMND

    -- Chữ ký điện tử
    signature_image_url TEXT NOT NULL,  -- PNG trong suốt lưu trên R2
    signed_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    signature_gps       geometry(Point, 4326), -- Tọa độ lúc ký (Mobile)

    -- Từ chối ký
    is_refused          BOOLEAN DEFAULT FALSE,
    refusal_reason      TEXT,
    witness_notes       TEXT,

    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),

    -- Mỗi vai trò chỉ ký 1 lần cho 1 hồ sơ Phase 2
    UNIQUE (phase2_id, sign_role)
);

CREATE INDEX IF NOT EXISTS idx_signatures_phase2_id ON survey_signatures (phase2_id);

-- ============================================================================
-- PHẦN 10: TRIGGER TỰ ĐỘNG CẬP NHẬT phase1_status & phase2_status trên buildings
-- ============================================================================
CREATE OR REPLACE FUNCTION fn_sync_building_phase_status()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_TABLE_NAME = 'phase1_assessments' THEN
    UPDATE buildings SET phase1_status = NEW.status, updated_at = NOW()
    WHERE id = NEW.building_id;
  ELSIF TG_TABLE_NAME = 'phase2_pre_construction' THEN
    UPDATE buildings SET phase2_status = NEW.status, updated_at = NOW()
    WHERE id = NEW.building_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_sync_phase1_status
AFTER INSERT OR UPDATE OF status ON phase1_assessments
FOR EACH ROW EXECUTE FUNCTION fn_sync_building_phase_status();

CREATE TRIGGER trg_sync_phase2_status
AFTER INSERT OR UPDATE OF status ON phase2_pre_construction
FOR EACH ROW EXECUTE FUNCTION fn_sync_building_phase_status();

-- ============================================================================
-- PHẦN 11: VIEW BÁO CÁO THẨM ĐỊNH (WEB PORTAL AUDIT VIEW)
-- ============================================================================
CREATE OR REPLACE VIEW v_phase2_audit_summary AS
SELECT
    b.building_code,
    b.address,
    b.owner_name,
    b.phase1_status,
    b.phase2_status,
    p1.ecs_class,
    p1.ecs_total_score,
    p1.structural_flag,
    p1.vi_class,
    p1.vi_average,
    p1.bra_result,
    p2.id AS phase2_id,
    p2.access_status,
    p2.has_critical_damage_alert,
    p2.overall_condition_summary,
    COUNT(d.id) AS defect_count,
    SUM(CASE WHEN d.comparison_with_phase1 = 'NEWLY_OBSERVED' THEN 1 ELSE 0 END) AS new_defects,
    SUM(CASE WHEN d.comparison_with_phase1 IN ('DEVELOPED_WIDER','DEVELOPED_LONGER') THEN 1 ELSE 0 END) AS worsened_defects,
    COUNT(s.id) AS signatures_count,
    SUM(CASE WHEN s.is_refused THEN 1 ELSE 0 END) AS refused_signatures,
    b.deviation_meters AS gps_deviation_m,
    b.is_flagged AS gps_flagged,
    ST_AsGeoJSON(b.pin_gps)::json AS pin_geometry
FROM buildings b
LEFT JOIN phase1_assessments p1 ON p1.building_id = b.id AND p1.status = 'APPROVED'
LEFT JOIN phase2_pre_construction p2 ON p2.building_id = b.id
LEFT JOIN defect_register d ON d.phase2_id = p2.id
LEFT JOIN survey_signatures s ON s.phase2_id = p2.id
GROUP BY b.id, p1.id, p2.id;
