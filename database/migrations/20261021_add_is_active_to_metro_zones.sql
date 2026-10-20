-- ============================================================================
-- MIGRATION: 20261021_add_is_active_to_metro_zones.sql
-- MỤC ĐÍCH:
--   Thêm cờ 'is_active' (BOOLEAN) cho bảng metro_zones nhằm hỗ trợ:
--   - Chế độ Nháp kiểm tra (Draft Mode) cho các Zone mới nạp.
--   - Khóa/Mở khóa Zone cho Khảo sát viên (Surveyor) chỉ khi Super Admin công bố.
-- ============================================================================

-- 1. Bổ sung cột is_active
ALTER TABLE metro_zones 
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT FALSE;

-- 2. Kích hoạt sẵn tất cả 22 Zone trên toàn hệ thống
UPDATE metro_zones 
SET is_active = TRUE;

-- 3. Tạo Index tối ưu hóa truy vấn lọc các Zone đang hoạt động
CREATE INDEX IF NOT EXISTS idx_metro_zones_is_active ON metro_zones(is_active);
