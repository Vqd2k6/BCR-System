-- ============================================================================
-- DỮ LIỆU KHỞI TẠO MẪU (SEED DATA) - DỰ ÁN METRO 2 (BẾN THÀNH - THAM LƯƠNG)
-- ============================================================================

-- 1. KHỞI TẠO 11 PHÂN KHU / NHÀ GA TUYẾN METRO 2
INSERT INTO metro_zones (id, zone_code, zone_name, center_lat, center_lng, total_parcels_count) VALUES
('a0000000-0000-0000-0000-000000000001', 'ZONE_S01_BEN_THANH', 'Phân khu Ga S1 - Bến Thành', 10.771971, 106.698263, 250),
('a0000000-0000-0000-0000-000000000002', 'ZONE_S02_TAO_DAN', 'Phân khu Ga S2 - Tao Đàn', 10.774500, 106.691200, 310),
('a0000000-0000-0000-0000-000000000003', 'ZONE_S03_DAN_CHU', 'Phân khu Ga S3 - Dân Chủ', 10.778800, 106.680100, 420),
('a0000000-0000-0000-0000-000000000004', 'ZONE_S04_HOA_HUNG', 'Phân khu Ga S4 - Hòa Hưng', 10.783200, 106.672500, 380),
('a0000000-0000-0000-0000-000000000005', 'ZONE_S05_LE_THI_RIENG', 'Phân khu Ga S5 - Lê Thị Riêng', 10.789100, 106.663100, 500),
('a0000000-0000-0000-0000-000000000006', 'ZONE_S06_PHAM_VAN_HAI', 'Phân khu Ga S6 - Phạm Văn Hai', 10.793500, 106.656800, 460),
('a0000000-0000-0000-0000-000000000007', 'ZONE_S07_BAY_HIEN', 'Phân khu Ga S7 - Bảy Hiền', 10.797200, 106.651400, 580),
('a0000000-0000-0000-0000-000000000008', 'ZONE_S08_NGUYEN_HONG_DAO', 'Phân khu Ga S8 - Nguyễn Hồng Đào', 10.801500, 106.643200, 620),
('a0000000-0000-0000-0000-000000000009', 'ZONE_S09_BA_QUEO', 'Phân khu Ga S9 - Bà Quẹo', 10.806200, 106.634100, 750),
('a0000000-0000-0000-0000-000000000010', 'ZONE_S10_PHAM_VAN_BACH', 'Phân khu Ga S10 - Phạm Văn Bạch', 10.814500, 106.623400, 680),
('a0000000-0000-0000-0000-000000000011', 'ZONE_S11_TAN_BINH', 'Phân khu Ga S11 - Bến xe An Sương', 10.825100, 106.612000, 800)
ON CONFLICT (zone_code) DO NOTHING;

-- 2. KHỞI TẠO TÀI KHOẢN MẪU (Password mặc định hash của: 'Admin@123' hoặc 'Survey@123')
-- Hash bcrypt tương ứng: $2b$10$abcdef... (mô phỏng chuỗi hash an toàn)
INSERT INTO users (id, username, password_hash, full_name, email, phone, role, status, assigned_zone_id, employee_code) VALUES
('b0000000-0000-0000-0000-000000000001', 'superadmin', '$2a$12$e8YgQv0Kq9Wl5J7qK8WkOuN5cK5iF1ZgJ9V8W6Q5X7Y2Z1M0K3L4O', 'Nguyễn Văn Tổng (MAUR)', 'admin@maur.metro2.vn', '0901234567', 'SUPER_ADMIN', 'ACTIVE', NULL, 'MAUR-001'),
('b0000000-0000-0000-0000-000000000002', 'zoneadmin_s9', '$2a$12$e8YgQv0Kq9Wl5J7qK8WkOuN5cK5iF1ZgJ9V8W6Q5X7Y2Z1M0K3L4O', 'Trần Thị Trưởng Phân Khu (Ga S9)', 'admin.s9@crri.metro2.vn', '0902345678', 'ZONE_ADMIN', 'ACTIVE', 'a0000000-0000-0000-0000-000000000009', 'CRRI-S09'),
('b0000000-0000-0000-0000-000000000003', 'surveyor_01', '$2a$12$e8YgQv0Kq9Wl5J7qK8WkOuN5cK5iF1ZgJ9V8W6Q5X7Y2Z1M0K3L4O', 'Lê Văn Khảo Sát 1', 'surveyor1@metro2.vn', '0903456789', 'SURVEYOR', 'ACTIVE', 'a0000000-0000-0000-0000-000000000009', 'SRV-01'),
('b0000000-0000-0000-0000-000000000004', 'surveyor_02', '$2a$12$e8YgQv0Kq9Wl5J7qK8WkOuN5cK5iF1ZgJ9V8W6Q5X7Y2Z1M0K3L4O', 'Phạm Văn Khảo Sát 2', 'surveyor2@metro2.vn', '0904567890', 'SURVEYOR', 'ACTIVE', 'a0000000-0000-0000-0000-000000000009', 'SRV-02'),
('b0000000-0000-0000-0000-000000000005', 'guest_contractor', '$2a$12$e8YgQv0Kq9Wl5J7qK8WkOuN5cK5iF1ZgJ9V8W6Q5X7Y2Z1M0K3L4O', 'Đại diện Nhà Thầu TBM', 'contractor@tbm-tunnel.com', '0905678901', 'CONTRACTOR', 'ACTIVE', NULL, 'GUEST-01')
ON CONFLICT (username) DO NOTHING;

-- 3. KHỞI TẠO CÁC THỬA ĐẤT MẪU MÃ KÉP (DUAL-ID PARCELS TẠI PHÂN KHU GA S9)
INSERT INTO parcels (
    id, zone_id, official_cadastral_code, project_parcel_code, 
    house_number, street, ward, district, owner_name, owner_phone, 
    importance_group, adjacent_type, gps_latitude, gps_longitude, 
    chainage_km, distance_to_metro_centerline_m, distance_to_clearance_boundary_m,
    survey_status, lifecycle_status, polygon_geom
) VALUES
(
    'c0000000-0000-0000-0000-000000000001',
    'a0000000-0000-0000-0000-000000000009',
    'KS003-00001',
    'B-00001',
    '102', 'Trường Chinh', 'Phường 13', 'Quận Tân Bình', 'Nguyễn Thị Hoa', '0912111222',
    'GENERAL', 'TOWNHOUSE', 10.806250, 106.634120,
    9.120, 12.50, 4.20,
    'APPROVED', 'ACTIVE',
    ST_SetSRID(ST_PolygonFromText('POLYGON((106.63410 10.80620, 106.63425 10.80620, 106.63425 10.80630, 106.63410 10.80630, 106.63410 10.80620))'), 4326)
),
(
    'c0000000-0000-0000-0000-000000000002',
    'a0000000-0000-0000-0000-000000000009',
    'KS003-00002',
    'B-00002',
    '104', 'Trường Chinh', 'Phường 13', 'Quận Tân Bình', 'Trần Văn Bình', '0913222333',
    'GENERAL', 'TOWNHOUSE', 10.806350, 106.634220,
    9.135, 14.20, 5.80,
    'IN_PROGRESS', 'ACTIVE',
    ST_SetSRID(ST_PolygonFromText('POLYGON((106.63425 10.80620, 106.63440 10.80620, 106.63440 10.80630, 106.63425 10.80630, 106.63425 10.80620))'), 4326)
),
(
    'c0000000-0000-0000-0000-000000000003',
    'a0000000-0000-0000-0000-000000000009',
    'KS003-00003',
    'B-00003',
    '106', 'Trường Chinh', 'Phường 13', 'Quận Tân Bình', 'Công ty TNHH Hoàng Gia', '0914333444',
    'IMPORTANT', 'HIGH_RISE', 10.806450, 106.634320,
    9.150, 8.50, 0.00,
    'NOT_SURVEYED', 'ACTIVE',
    ST_SetSRID(ST_PolygonFromText('POLYGON((106.63440 10.80620, 106.63460 10.80620, 106.63460 10.80635, 106.63440 10.80635, 106.63440 10.80620))'), 4326)
)
ON CONFLICT (zone_id, project_parcel_code) DO NOTHING;
