-- ============================================================================
-- DỮ LIỆU KHỞI TẠO MẪU (SEED DATA) - DỰ ÁN METRO 2 (BẾN THÀNH - THAM LƯƠNG)
-- ============================================================================

-- 1. KHỞI TẠO 11 PHÂN KHU / NHÀ GA TUYẾN METRO 2
INSERT INTO metro_zones (id, zone_code, zone_name, center_geom, total_parcels_count, approved_parcels_count) VALUES
('a0000000-0000-0000-0000-000000000001', 'ZONE_S1', 'Ga S1 - Bến Thành', ST_SetSRID(ST_MakePoint(106.698263, 10.771971), 4326), 420, 410),
('a0000000-0000-0000-0000-000000000002', 'ZONE_S2', 'Ga S2 - Tao Đàn', ST_SetSRID(ST_MakePoint(106.691200, 10.774500), 4326), 310, 290),
('a0000000-0000-0000-0000-000000000003', 'ZONE_S3', 'Ga S3 - Dân Chủ', ST_SetSRID(ST_MakePoint(106.680100, 10.778800), 4326), 420, 350),
('a0000000-0000-0000-0000-000000000004', 'ZONE_S4', 'Ga S4 - Hòa Hưng', ST_SetSRID(ST_MakePoint(106.672500, 10.783200), 4326), 380, 280),
('a0000000-0000-0000-0000-000000000005', 'ZONE_S5', 'Ga S5 - Lê Thị Riêng', ST_SetSRID(ST_MakePoint(106.663100, 10.789100), 4326), 500, 410),
('a0000000-0000-0000-0000-000000000006', 'ZONE_S6', 'Ga S6 - Phạm Văn Hai', ST_SetSRID(ST_MakePoint(106.656800, 10.793500), 4326), 460, 390),
('a0000000-0000-0000-0000-000000000007', 'ZONE_S7', 'Ga S7 - Bảy Hiền', ST_SetSRID(ST_MakePoint(106.651400, 10.797200), 4326), 580, 420),
('a0000000-0000-0000-0000-000000000008', 'ZONE_S8', 'Ga S8 - Nguyễn Hồng Đào', ST_SetSRID(ST_MakePoint(106.643200, 10.801500), 4326), 620, 480),
('a0000000-0000-0000-0000-000000000009', 'ZONE_S9', 'Ga S9 - Bà Quẹo', ST_SetSRID(ST_MakePoint(106.645678, 10.798123), 4326), 650, 385),
('a0000000-0000-0000-0000-000000000010', 'ZONE_S10', 'Ga S10 - Phạm Văn Bạch', ST_SetSRID(ST_MakePoint(106.623400, 10.814500), 4326), 680, 310),
('a0000000-0000-0000-0000-000000000011', 'ZONE_S11', 'Ga S11 - Tân Bình / Tham Lương', ST_SetSRID(ST_MakePoint(106.612000, 10.825100), 4326), 580, 210)
ON CONFLICT (zone_code) DO NOTHING;

-- 2. KHỞI TẠO TÀI KHOẢN MẪU (Password mặc định hash của: 'Password@123' hoặc 'Admin@123')
INSERT INTO users (id, username, password_hash, full_name, email, phone, role, status, assigned_zone_id) VALUES
('b0000000-0000-0000-0000-000000000001', 'superadmin', '$2a$12$e8YgQv0Kq9Wl5J7qK8WkOuN5cK5iF1ZgJ9V8W6Q5X7Y2Z1M0K3L4O', 'Nguyễn Văn Tổng (MAUR)', 'admin@maur.metro2.vn', '0901234567', 'SUPER_ADMIN', 'ACTIVE', NULL),
('b0000000-0000-0000-0000-000000000002', 'zoneadmin_s9', '$2a$12$e8YgQv0Kq9Wl5J7qK8WkOuN5cK5iF1ZgJ9V8W6Q5X7Y2Z1M0K3L4O', 'Trần Văn Tổ Trưởng (Ga S9)', 'zoneadmin.s9@metro2.vn', '0902345678', 'ZONE_ADMIN', 'ACTIVE', 'ZONE_S9'),
('b0000000-0000-0000-0000-000000000003', 'surveyor_s9_01', '$2a$12$e8YgQv0Kq9Wl5J7qK8WkOuN5cK5iF1ZgJ9V8W6Q5X7Y2Z1M0K3L4O', 'Nguyễn Văn Khảo Sát', 'surveyor.s9@metro2.vn', '0903456789', 'SURVEYOR', 'ACTIVE', 'ZONE_S9'),
('b0000000-0000-0000-0000-000000000004', 'surveyor_s9_02', '$2a$12$e8YgQv0Kq9Wl5J7qK8WkOuN5cK5iF1ZgJ9V8W6Q5X7Y2Z1M0K3L4O', 'Trần Văn B', 'surveyor2.s9@metro2.vn', '0904567890', 'SURVEYOR', 'ACTIVE', 'ZONE_S9'),
('b0000000-0000-0000-0000-000000000005', 'contractor_guest', '$2a$12$e8YgQv0Kq9Wl5J7qK8WkOuN5cK5iF1ZgJ9V8W6Q5X7Y2Z1M0K3L4O', 'Đại diện Nhà Thầu TBM', 'contractor@tbm-tunnel.com', '0905678901', 'CONTRACTOR', 'ACTIVE', NULL)
ON CONFLICT (username) DO NOTHING;

-- 3. KHỞI TẠO CÁC THỬA ĐẤT MẪU MÃ KÉP (DUAL-ID PARCELS TẠI PHÂN KHU GA S9)
INSERT INTO parcels (
    id, zone_id, official_cadastral_code, project_parcel_code, field_survey_code,
    house_number, street, ward, district, owner_name, owner_phone,
    land_area_m2, construction_area_m2, floor_count,
    importance_group, adjacent_type,
    location_geom, cadastral_polygon_geom, footprint_polygon_geom,
    survey_status, lifecycle_status
) VALUES
(
    'c0000000-0000-0000-0000-000000000001',
    'ZONE_S9',
    'KS003-00105',
    'B-00105',
    'KS004',
    '854', 'Đường Trường Chinh', 'Phường 15', 'Quận Tân Bình', 'Nguyễn Văn Hùng', '0908123456',
    68.50, 52.00, 3,
    'GENERAL', 'TOWNHOUSE',
    ST_SetSRID(ST_MakePoint(106.645678, 10.798123), 4326),
    ST_SetSRID(ST_PolygonFromText('POLYGON((106.6451 10.7981, 106.6455 10.7981, 106.6455 10.7984, 106.6451 10.7984, 106.6451 10.7981))'), 4326),
    ST_SetSRID(ST_PolygonFromText('POLYGON((106.6451 10.7981, 106.6455 10.7981, 106.6455 10.7984, 106.6451 10.7984, 106.6451 10.7981))'), 4326),
    'APPROVED', 'ACTIVE'
),
(
    'c0000000-0000-0000-0000-000000000002',
    'ZONE_S9',
    'KS003-00106',
    'B-00106',
    'KS005',
    '856', 'Đường Trường Chinh', 'Phường 15', 'Quận Tân Bình', 'Trần Thị Mai', '0908234567',
    72.00, 58.00, 2,
    'GENERAL', 'TOWNHOUSE',
    ST_SetSRID(ST_MakePoint(106.645800, 10.798200), 4326),
    ST_SetSRID(ST_PolygonFromText('POLYGON((106.6455 10.7981, 106.6459 10.7981, 106.6459 10.7984, 106.6455 10.7984, 106.6455 10.7981))'), 4326),
    ST_SetSRID(ST_PolygonFromText('POLYGON((106.6455 10.7981, 106.6459 10.7981, 106.6459 10.7984, 106.6455 10.7984, 106.6455 10.7981))'), 4326),
    'IN_PROGRESS', 'ACTIVE'
),
(
    'c0000000-0000-0000-0000-000000000003',
    'ZONE_S9',
    'KS003-00107',
    'B-00107',
    'KS006',
    '858', 'Đường Trường Chinh', 'Phường 15', 'Quận Tân Bình', 'Hoàng Văn Tuấn', '0908345678',
    85.00, 70.00, 4,
    'IMPORTANT', 'HIGH_RISE',
    ST_SetSRID(ST_MakePoint(106.646000, 10.798300), 4326),
    ST_SetSRID(ST_PolygonFromText('POLYGON((106.6459 10.7981, 106.6463 10.7981, 106.6463 10.7985, 106.6459 10.7985, 106.6459 10.7981))'), 4326),
    ST_SetSRID(ST_PolygonFromText('POLYGON((106.6459 10.7981, 106.6463 10.7981, 106.6463 10.7985, 106.6459 10.7985, 106.6459 10.7981))'), 4326),
    'NOT_SURVEYED', 'ACTIVE'
)
ON CONFLICT (project_parcel_code) DO NOTHING;
