-- ============================================================================
-- MIGRATION: 20261121_draft_lock_heartbeat.sql
-- Dự án: Hệ Thống Khảo Sát Hiện Trạng Công Trình Tuyến Metro Số 2 (BCS Platform)
--
-- Mục đích:
--   Giữ khóa ca khảo sát khi KSV đang mở form mà chưa sửa gì (đo đạc, trao đổi chủ hộ).
--   Trước đây hạn khóa 15 phút chỉ tính theo updated_at (đổi khi lưu nháp) ⇒ KSV khác
--   tiếp quản được dù người giữ ca vẫn đang làm. Client gửi nhịp 5 phút/lượt vào cột này.
--   Không dùng updated_at vì nó là mốc so nháp cục bộ mới hơn máy chủ.
--
-- An toàn:
--   - Idempotent (IF NOT EXISTS), cột cho phép NULL, không cập nhật dữ liệu cũ.
-- ============================================================================

ALTER TABLE base_survey_reports ADD COLUMN IF NOT EXISTS lock_heartbeat_at TIMESTAMPTZ;
