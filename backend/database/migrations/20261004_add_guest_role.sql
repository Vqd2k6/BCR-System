-- ============================================================================
-- MIGRATION: 20261004_add_guest_role.sql
-- Dự án: Hệ Thống Khảo Sát Hiện Trạng Công Trình Tuyến Metro Số 2 (BCR-System)
--
-- Mục đích:
--   Bổ sung giá trị 'GUEST' vào enum role_enum phục vụ phân quyền truy cập
--   dành cho Chủ Đầu Tư (Ban Quản Lý Đường Sắt Đô Thị MAUR).
--
-- Tính chất kỹ thuật:
--   - PURELY ADDITIVE: Không làm thay đổi hay ảnh hưởng đến các role hiện hữu
--     (SUPER_ADMIN, ZONE_ADMIN, SURVEYOR, CONTRACTOR).
--   - RBAC SECURITY: Role 'GUEST' là vai trò Chỉ Đọc (Zero-Trust Read-Only),
--     không có quyền mutation hoặc export tải file.
-- ============================================================================

ALTER TYPE role_enum ADD VALUE IF NOT EXISTS 'GUEST';
