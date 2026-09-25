-- ============================================================================
-- RESET DATABASE SẠCH CHUẨN THỰC ĐỊA (CLEAN PRODUCTION RESET)
-- Mục tiêu: Xóa sạch toàn bộ dữ liệu khảo sát & thửa đất (0 parcels)
-- Giữ lại: Cấu trúc bảng PostGIS, 11 Ga Metro 2 và các tài khoản người dùng
-- ============================================================================

BEGIN;

-- 1. XÓA SẠCH DỮ LIỆU CÁC BẢNG KHẢO SÁT, THỬA ĐẤT, BIẾN ĐỘNG & CHỨNG CỨ
TRUNCATE TABLE 
    parcels,
    building_units,
    base_survey_reports,
    phase1_report_details,
    phase2_report_details,
    floor_surveys,
    defect_items,
    damage_zones,
    damage_sketches,
    deformation_assessments,
    timekeeping_checkins,
    survey_identification_photos,
    audit_alert_items,
    cadastral_history_logs,
    parcel_mutation_events,
    guest_share_links,
    system_audit_logs,
    quality_gate_logs,
    risk_score_cards,
    building_specifications,
    historical_sensitivities,
    survey_absence_logs,
    task_assignments,
    user_sessions,
    compiled_report_batches
CASCADE;

-- 2. ĐẢM BẢO 11 GA METRO 2 VÀ RESET BỘ ĐẾM VỀ 0
INSERT INTO metro_zones (id, zone_code, zone_name, center_geom, total_parcels_count, approved_parcels_count) VALUES
('a0000000-0000-0000-0000-000000000001', 'ZONE_S1', 'Ga S1 - Bến Thành', ST_SetSRID(ST_MakePoint(106.696694, 10.770830), 4326), 0, 0),
('a0000000-0000-0000-0000-000000000002', 'ZONE_S2', 'Ga S2 - Tao Đàn', ST_SetSRID(ST_MakePoint(106.690134, 10.774130), 4326), 0, 0),
('a0000000-0000-0000-0000-000000000003', 'ZONE_S3', 'Ga S3 - Dân Chủ', ST_SetSRID(ST_MakePoint(106.678489, 10.777797), 4326), 0, 0),
('a0000000-0000-0000-0000-000000000004', 'ZONE_S4', 'Ga S4 - Hòa Hưng', ST_SetSRID(ST_MakePoint(106.672859, 10.782510), 4326), 0, 0),
('a0000000-0000-0000-0000-000000000005', 'ZONE_S5', 'Ga S5 - Lê Thị Riêng', ST_SetSRID(ST_MakePoint(106.665315, 10.786061), 4326), 0, 0),
('a0000000-0000-0000-0000-000000000006', 'ZONE_S6', 'Ga S6 - Phạm Văn Hai', ST_SetSRID(ST_MakePoint(106.658081, 10.790290), 4326), 0, 0),
('a0000000-0000-0000-0000-000000000007', 'ZONE_S7', 'Ga S7 - Bảy Hiền', ST_SetSRID(ST_MakePoint(106.652375, 10.793561), 4326), 0, 0),
('a0000000-0000-0000-0000-000000000008', 'ZONE_S8', 'Ga S8 - Nguyễn Hồng Đào', ST_SetSRID(ST_MakePoint(106.644632, 10.797605), 4326), 0, 0),
('a0000000-0000-0000-0000-000000000009', 'ZONE_S9', 'Ga S9 - Bà Quẹo', ST_SetSRID(ST_MakePoint(106.637211, 10.802564), 4326), 0, 0),
('a0000000-0000-0000-0000-000000000010', 'ZONE_S10', 'Ga S10 - Phạm Văn Bạch', ST_SetSRID(ST_MakePoint(106.630708, 10.815381), 4326), 0, 0),
('a0000000-0000-0000-0000-000000000011', 'ZONE_S11', 'Ga S11 - Tân Bình / Tham Lương', ST_SetSRID(ST_MakePoint(106.625132, 10.821594), 4326), 0, 0)
ON CONFLICT (zone_code) DO UPDATE SET 
    total_parcels_count = 0, 
    approved_parcels_count = 0;

-- 3. ĐẢM BẢO CÁC TÀI KHOẢN ĐĂNG NHẬP HOẠT ĐỘNG
-- Password mặc định: 'Admin@123' cho SuperAdmin/ZoneAdmin, 'Password@123' cho Surveyor/Contractor
INSERT INTO users (id, username, password_hash, full_name, email, phone, role, status, assigned_zone_id) VALUES
('b0000000-0000-0000-0000-000000000001', 'superadmin', '$2a$10$Mc8KQVRO3nHstxfQyiWjEuJCHaPl42TlIR0J.HXeH5nZl6KNXKmDe', 'Nguyễn Văn Tổng (MAUR)', 'admin@maur.metro2.vn', '0901234567', 'SUPER_ADMIN', 'ACTIVE', NULL),
('b0000000-0000-0000-0000-000000000002', 'zoneadmin_s9', '$2a$10$Mc8KQVRO3nHstxfQyiWjEuJCHaPl42TlIR0J.HXeH5nZl6KNXKmDe', 'Trần Văn Tổ Trưởng (Ga S9)', 'zoneadmin.s9@metro2.vn', '0902345678', 'ZONE_ADMIN', 'ACTIVE', 'ZONE_S9'),
('b0000000-0000-0000-0000-000000000003', 'surveyor_s9_01', '$2a$10$aK1LSAN1sdZE2SGC49WjuuBDztr4SRxCgYe5jWF4/d3O0Uk2Fn0kK', 'Nguyễn Văn Khảo Sát', 'surveyor.s9@metro2.vn', '0903456789', 'SURVEYOR', 'ACTIVE', 'ZONE_S9'),
('b0000000-0000-0000-0000-000000000004', 'surveyor_s9_02', '$2a$10$aK1LSAN1sdZE2SGC49WjuuBDztr4SRxCgYe5jWF4/d3O0Uk2Fn0kK', 'Trần Văn B', 'surveyor2.s9@metro2.vn', '0904567890', 'SURVEYOR', 'ACTIVE', 'ZONE_S9'),
('b0000000-0000-0000-0000-000000000005', 'contractor_guest', '$2a$10$aK1LSAN1sdZE2SGC49WjuuBDztr4SRxCgYe5jWF4/d3O0Uk2Fn0kK', 'Đại diện Nhà Thầu TBM', 'contractor@tbm-tunnel.com', '0905678901', 'CONTRACTOR', 'ACTIVE', NULL)
ON CONFLICT (username) DO UPDATE SET 
    password_hash = EXCLUDED.password_hash,
    status = 'ACTIVE';

COMMIT;
