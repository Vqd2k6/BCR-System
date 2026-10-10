-- ============================================================================
-- MIGRATION: 20261009_case_insensitive_username_index.sql
-- Dự án: Hệ Thống Khảo Sát Hiện Trạng Tuyến Metro Số 2 (BCS Platform)
-- Mục tiêu: Chuẩn hóa chỉ mục Case-Insensitive trên Username
-- Cho phép hiển thị chuẩn xác chữ hoa/thường (Case-Preserving Display)
-- và so khớp đăng nhập / chống trùng không phân biệt hoa thường (Case-Insensitive)
-- ============================================================================

-- 1. Xóa index so khớp nhị phân cũ (nếu có)
DROP INDEX IF EXISTS idx_users_username_active_unique;

-- 2. Tạo Partial Unique Index trên LOWER(username) cho các tài khoản đang hoạt động
-- Đảm bảo không thể tạo 2 tài khoản trùng tên khác chữ hoa/thường (VD: Admin_01 vs admin_01)
-- và tối ưu tốc độ truy vấn Index Scan cho WHERE LOWER(username) = LOWER($1)
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username_active_unique 
  ON users(LOWER(username)) WHERE deleted_at IS NULL;
