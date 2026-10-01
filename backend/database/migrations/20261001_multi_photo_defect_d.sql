-- ============================================================================
-- MIGRATION: 20261001_multi_photo_defect_d.sql
-- Dự án: Hệ Thống Khảo Sát Hiện Trạng Công Trình Tuyến Metro Số 2 (BCS Platform)
--
-- Mục đích:
--   Bổ sung cột cu_photos_json lưu trữ mảng nhiều ảnh cận cảnh (Multi-Photo)
--   kèm thước đo tỷ lệ vết nứt cho khuyết tật D-xx.
--
-- Tính chất kỹ thuật:
--   - PURELY ADDITIVE: Không DROP, không RENAME, không ALTER kiểu dữ liệu cũ.
--   - ZERO DATA LOSS: Bảo toàn 100% các hồ sơ khảo sát đã lưu ở mọi trạng thái.
--   - METADATA UPDATE ONLY: Trên PostgreSQL 11+, việc thêm cột với giá trị DEFAULT
--     chỉ cập nhật catalog metadata (< 0.1s), KHÔNG LOCK BẢNG, KHÔNG DOWNTIME.
-- ============================================================================

BEGIN;

-- 1. Bổ sung cột lưu trữ mảng JSONB các ảnh cận cảnh (nếu chưa có)
-- Giá trị mặc định là mảng rỗng '[]'::jsonb
ALTER TABLE defect_items
    ADD COLUMN IF NOT EXISTS cu_photos_json JSONB DEFAULT '[]'::jsonb;

-- 2. Đảm bảo cột định danh ảnh cu_photo_code có chỉ mục để tối ưu tra cứu
CREATE INDEX IF NOT EXISTS idx_defect_items_cu_photo_code 
    ON defect_items(cu_photo_code);

-- 3. Tạo comment giải thích mục đích sử dụng trên CSDL
COMMENT ON COLUMN defect_items.cu_photos_json IS 'Mảng JSON lưu trữ danh sách tất cả các ảnh cận cảnh CU có thước đo nứt của điểm khuyết tật D-xx';

COMMIT;

-- ============================================================================
-- CÂU LỆNH KIỂM TRA HẬU KỲ (VERIFICATION QUERY):
-- SELECT column_name, data_type, column_default, is_nullable
-- FROM information_schema.columns
-- WHERE table_name = 'defect_items' AND column_name IN ('cu_photo_url', 'cu_photos_json');
-- ============================================================================
