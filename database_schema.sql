-- ============================================================================
-- HỆ THỐNG KHẢO SÁT HIỆN TRẠNG CÔNG TRÌNH METRO (KSQH METRO 2)
-- CƠ SỞ DỮ LIỆU KHÔNG GIAN: POSTGRESQL 15+ / POSTGIS 3+
-- ============================================================================

-- 1. KÍCH HOẠT EXTENSION POSTGIS & UUID
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "postgis";

-- 2. ĐỊNH NGHĨA ENUM (TYPES)
CREATE TYPE user_role_enum AS ENUM (
    'SUPER_ADMIN',      -- Ban QLDA Metro / Cấp 1
    'ZONE_MANAGER',    -- Quản lý phân vùng / Kiểm duyệt / Cấp 2
    'FIELD_SURVEYOR',   -- Cán bộ khảo sát hiện trường / Cấp 3
    'AUDITOR'           -- Kiểm định viên độc lập / Chỉ đọc
);

CREATE TYPE survey_status_enum AS ENUM (
    'UNASSIGNED',       -- Chưa phân công
    'IN_PROGRESS',      -- Đang khảo sát thực địa
    'PENDING_APPROVAL', -- Đã nộp / Chờ kiểm duyệt
    'APPROVED',         -- Đã duyệt (Đã đồng bộ GIS & lưu trữ pháp lý)
    'REJECTED'          -- Bị từ chối (Cần khảo sát lại)
);

CREATE TYPE crack_direction_enum AS ENUM (
    'VERTICAL',         -- Nứt dọc
    'HORIZONTAL',       -- Nứt ngang
    'DIAGONAL',         -- Nứt xiên
    'IRREGULAR'         -- Nứt chân chim / phức tạp
);

CREATE TYPE building_type_enum AS ENUM (
    'RESIDENTIAL',      -- Nhà ở riêng lẻ / Nhà phố
    'COMMERCIAL',       -- Thương mại / Dịch vụ
    'PUBLIC_OFFICE',    -- Trụ sở cơ quan / Trường học / Bệnh viện
    'HERITAGE',         -- Công trình di tích / Tôn giáo
    'OTHER'             -- Khác
);

-- ============================================================================
-- 3. BẢNG NGƯỜI DÙNG & PHÂN QUYỀN NỘI BỘ (USERS & RBAC)
-- ============================================================================
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    username VARCHAR(50) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(120) NOT NULL,
    employee_code VARCHAR(50) UNIQUE NOT NULL,
    role user_role_enum NOT NULL DEFAULT 'FIELD_SURVEYOR',
    phone_number VARCHAR(20),
    email VARCHAR(120),
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- 4. BẢNG HÀNH LANG TUYẾN METRO (METRO CORRIDORS)
-- ============================================================================
CREATE TABLE metro_corridors (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(150) NOT NULL,                     -- Tuyến Metro Số 2 (Bến Thành – Tham Lương)
    centerline geometry(LineString, 4326) NOT NULL, -- Tim tuyến Metro (WGS 84)
    buffer_corridor geometry(Polygon, 4326),        -- Hành lang an toàn / vùng đệm ảnh hưởng (50m)
    total_length_km NUMERIC(6,2),                   -- ~ 11.04 km
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- 5. BẢNG PHÂN VÙNG KHẢO SÁT (SURVEY ZONES)
-- ============================================================================
CREATE TABLE survey_zones (
    id VARCHAR(50) PRIMARY KEY,                     -- vd: 'ZONE-TB01', 'ZONE-Q302'
    name VARCHAR(150) NOT NULL,                     -- Phân vùng Ga Bảy Hiền (Tân Bình)
    corridor_id UUID REFERENCES metro_corridors(id),
    manager_id UUID REFERENCES users(id),           -- Zone Manager phụ trách
    assigned_surveyor_id UUID REFERENCES users(id), -- Surveyor được giao việc
    boundary geometry(Polygon, 4326) NOT NULL,      -- Ranh giới đa giác phân vùng
    color_hex VARCHAR(10) DEFAULT '#0284c7',
    estimated_buildings INT DEFAULT 0,              -- Ước lượng số căn trong vùng
    completed_buildings INT DEFAULT 0,              -- Số căn đã duyệt
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- 6. BẢNG CÔNG TRÌNH / HỒ SƠ KHẢO SÁT (BUILDINGS - CORE BCA ENTITY)
-- ============================================================================
CREATE TABLE buildings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    house_code VARCHAR(50) UNIQUE NOT NULL,         -- Mã căn khảo sát (vd: 'TB-BH-003')
    owner_name VARCHAR(150) NOT NULL,               -- Họ tên chủ hộ / người đại diện
    owner_phone VARCHAR(20),
    owner_id_card VARCHAR(20),                      -- CCCD / CMND chủ hộ
    address TEXT NOT NULL,                          -- Địa chỉ thực tế
    ward VARCHAR(50),                               -- Phường
    district VARCHAR(50),                           -- Quận
    building_type building_type_enum DEFAULT 'RESIDENTIAL',
    zone_id VARCHAR(50) REFERENCES survey_zones(id),
    
    -- TRẠNG THÁI & CẢNH BÁO
    status survey_status_enum NOT NULL DEFAULT 'IN_PROGRESS',
    is_flagged BOOLEAN NOT NULL DEFAULT FALSE,      -- Gắn cờ cảnh báo sai lệch GPS > 50m
    
    -- DUAL-GPS CHỐNG GIAN LẬN (ANTI-CHEAT)
    hardware_gps geometry(Point, 4326) NOT NULL,    -- Tọa độ chip thiết bị thực tế ngầm
    pin_gps geometry(Point, 4326) NOT NULL,         -- Tọa độ ghim tâm mái nhà
    deviation_meters NUMERIC(8,2) NOT NULL DEFAULT 0.00, -- Khoảng cách lệch tính theo mét
    
    -- ĐA GIÁC ĐƯỜNG BAO THỰC TẾ (REVERSE GIS FOOTPRINT)
    footprint geometry(Polygon, 4326),              -- Ranh giới khép góc của ngôi nhà
    
    -- THÔNG TIN VẬN HÀNH & KIỂM DUYỆT
    surveyor_id UUID NOT NULL REFERENCES users(id),
    survey_started_at TIMESTAMPTZ DEFAULT NOW(),
    survey_submitted_at TIMESTAMPTZ,
    reviewed_by UUID REFERENCES users(id),
    reviewed_at TIMESTAMPTZ,
    rejection_reason TEXT,
    
    -- DỮ LIỆU ĐỊA CHÍNH THAM CHIẾU TỪ SQHKT (NẾU CÓ)
    cadastral_plot_number VARCHAR(50),              -- Số thửa
    cadastral_map_sheet VARCHAR(50),                -- Số tờ bản đồ
    raw_cadastral_data JSONB,                       -- Lưu vết JSON chức năng quy hoạch gốc
    
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- 7. CÂU TRÚC PHÂN CẤP CÔNG TRÌNH ĐỘNG (DYNAMIC HIERARCHICAL STRUCTURAL TREE)
-- ============================================================================

-- 7.1. Bảng Khảo sát Tổng quan Ngoại thất & Kết cấu chịu lực chính
CREATE TABLE building_exterior_conditions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    building_id UUID UNIQUE NOT NULL REFERENCES buildings(id) ON DELETE CASCADE,
    overall_condition VARCHAR(100) DEFAULT 'Bình thường',
    main_structure_type VARCHAR(100),               -- Bê tông cốt thép / Tường gạch chịu lực / Khung thép
    foundation_type VARCHAR(100),                   -- Móng cọc / Móng băng / Móng đơn
    settlement_signs BOOLEAN DEFAULT FALSE,         -- Dấu hiệu lún nghiêng công trình
    tilt_measurement_notes TEXT,                    -- Ghi chú độ nghiêng (nếu có)
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 7.2. Bảng Tầng (Dynamic Floors: Hầm, Trệt, Lầu 1..n, Mái)
CREATE TABLE building_floors (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    building_id UUID NOT NULL REFERENCES buildings(id) ON DELETE CASCADE,
    floor_name VARCHAR(50) NOT NULL,                -- 'Tầng Hầm', 'Tầng Trệt', 'Lầu 1', 'Mái'
    floor_order INT NOT NULL DEFAULT 1,
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 7.3. Bảng Phòng / Khu vực trong tầng (Dynamic Rooms / Areas)
CREATE TABLE floor_rooms (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    floor_id UUID NOT NULL REFERENCES building_floors(id) ON DELETE CASCADE,
    room_name VARCHAR(100) NOT NULL,               -- 'Phòng khách', 'Bếp', 'Phòng ngủ 1', 'Ban công'
    room_order INT NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 7.4. Bảng Cấu kiện khảo sát (Components: Tường, Trần, Sàn, Cột, Dầm, Cửa)
CREATE TABLE room_components (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    room_id UUID NOT NULL REFERENCES floor_rooms(id) ON DELETE CASCADE,
    component_name VARCHAR(100) NOT NULL,           -- 'Tường trước', 'Cột góc', 'Dầm giao', 'Sàn gạch'
    has_defect BOOLEAN NOT NULL DEFAULT FALSE,      -- Có vết nứt / hư hại
    condition_description TEXT,                     -- Mô tả hiện trạng
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 7.5. Bảng Chi tiết Vết nứt & Đo đạc Kỹ thuật (Cracks & Defect Measurements)
CREATE TABLE crack_defects (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    component_id UUID NOT NULL REFERENCES room_components(id) ON DELETE CASCADE,
    defect_code VARCHAR(50),                        -- vd: 'CRK-01'
    length_cm NUMERIC(6,2) NOT NULL,                -- Chiều dài vết nứt (cm)
    width_mm NUMERIC(5,2) NOT NULL,                 -- Bề rộng khe nứt (mm) - vd: 0.8mm, 2.0mm
    direction crack_direction_enum DEFAULT 'DIAGONAL',
    severity_level VARCHAR(30) DEFAULT 'MEDIUM',    -- MILD, MEDIUM, SEVERE
    canvas_annotation_json JSONB,                   -- Tọa độ vector nét vẽ trên ảnh
    notes TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- 8. BẢNG LƯU TRỮ HÌNH ẢNH & WATERMARK PHÁP LÝ (SURVEY PHOTOS & CLOUDFLARE R2)
-- ============================================================================
CREATE TABLE survey_photos (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    building_id UUID NOT NULL REFERENCES buildings(id) ON DELETE CASCADE,
    floor_id UUID REFERENCES building_floors(id) ON DELETE SET NULL,
    room_id UUID REFERENCES floor_rooms(id) ON DELETE SET NULL,
    component_id UUID REFERENCES room_components(id) ON DELETE SET NULL,
    crack_id UUID REFERENCES crack_defects(id) ON DELETE SET NULL,
    
    photo_url VARCHAR(500) NOT NULL,                -- Đường dẫn ảnh trên Cloudflare R2 / S3
    thumbnail_url VARCHAR(500),                     -- Ảnh thumbnail preview
    file_size_bytes BIGINT NOT NULL,                -- Dung lượng file (bytes)
    mime_type VARCHAR(50) DEFAULT 'image/jpeg',
    caption VARCHAR(255),
    
    -- DỮ LIỆU WATERMARK ĐƯỢC MÃ HÓA & KHÔNG THỂ SỬA ĐỔI
    watermark_metadata JSONB NOT NULL,              -- { "gps": [10.79, 106.65], "timestamp": "...", "device": "iPhone 15", "surveyor": "..." }
    captured_at TIMESTAMPTZ NOT NULL,               -- Thời điểm chụp thực tế
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- 9. BẢNG NHẬT KÝ THEO DÕI THAO TÁC & PHÁP LÝ (AUDIT LOGS)
-- ============================================================================
CREATE TABLE audit_logs (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    building_id UUID REFERENCES buildings(id) ON DELETE SET NULL,
    user_id UUID NOT NULL REFERENCES users(id),
    action VARCHAR(50) NOT NULL,                    -- 'CREATE', 'SUBMIT', 'APPROVE', 'REJECT', 'REVERSE_GIS_SYNC'
    previous_status survey_status_enum,
    new_status survey_status_enum,
    ip_address VARCHAR(45),
    details JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- 10. THIẾT LẬP CHỈ MỤC KHÔNG GIAN (SPATIAL INDEXES - GIST) & CHỈ MỤC B-TREE
-- ============================================================================

-- Spatial Indexes (Tăng tốc độ truy vấn bản đồ GIS lên gấp hàng trăm lần)
CREATE INDEX idx_metro_corridors_centerline ON metro_corridors USING GIST (centerline);
CREATE INDEX idx_metro_corridors_buffer ON metro_corridors USING GIST (buffer_corridor);
CREATE INDEX idx_survey_zones_boundary ON survey_zones USING GIST (boundary);
CREATE INDEX idx_buildings_hardware_gps ON buildings USING GIST (hardware_gps);
CREATE INDEX idx_buildings_pin_gps ON buildings USING GIST (pin_gps);
CREATE INDEX idx_buildings_footprint ON buildings USING GIST (footprint);

-- B-Tree Indexes
CREATE INDEX idx_buildings_house_code ON buildings (house_code);
CREATE INDEX idx_buildings_zone_id ON buildings (zone_id);
CREATE INDEX idx_buildings_status ON buildings (status);
CREATE INDEX idx_buildings_surveyor_id ON buildings (surveyor_id);
CREATE INDEX idx_survey_photos_building_id ON survey_photos (building_id);
CREATE INDEX idx_audit_logs_building_id ON audit_logs (building_id);

-- ============================================================================
-- 11. TRIGGER TỰ ĐỘNG TÍNH SAI LỆCH DUAL-GPS & GẮN CỜ CẢNH BÁO (>50M)
-- ============================================================================
CREATE OR REPLACE FUNCTION fn_calculate_gps_deviation()
RETURNS TRIGGER AS $$
BEGIN
    -- Tính khoảng cách theo đường trắc địa WGS84 (mét) giữa GPS ngầm và GPS ghim
    NEW.deviation_meters := ST_DistanceSphere(NEW.hardware_gps, NEW.pin_gps);
    
    -- Nếu sai lệch > 50 mét, tự động gắn cờ cảnh báo
    IF NEW.deviation_meters > 50.0 THEN
        NEW.is_flagged := TRUE;
    ELSE
        NEW.is_flagged := FALSE;
    END IF;
    
    NEW.updated_at := NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_check_gps_deviation
BEFORE INSERT OR UPDATE OF hardware_gps, pin_gps ON buildings
FOR EACH ROW
EXECUTE FUNCTION fn_calculate_gps_deviation();

-- ============================================================================
-- 12. VIEW TIỆN ÍCH: TRÍCH XUẤT GEOJSON DÀNH RIÊNG CHO LEAFLET / WEB ADMIN
-- ============================================================================
CREATE OR REPLACE VIEW v_buildings_geojson AS
SELECT 
    b.id,
    b.house_code,
    b.owner_name,
    b.address,
    b.status,
    b.is_flagged,
    b.deviation_meters,
    ST_AsGeoJSON(b.pin_gps)::json AS pin_geometry,
    ST_AsGeoJSON(b.footprint)::json AS footprint_geometry,
    json_build_object(
        'type', 'Feature',
        'geometry', ST_AsGeoJSON(COALESCE(b.footprint, b.pin_gps))::json,
        'properties', json_build_object(
            'id', b.id,
            'houseCode', b.house_code,
            'ownerName', b.owner_name,
            'address', b.address,
            'status', b.status,
            'isFlagged', b.is_flagged,
            'deviationMeters', b.deviation_meters
        )
    ) AS feature_geojson
FROM buildings b;
