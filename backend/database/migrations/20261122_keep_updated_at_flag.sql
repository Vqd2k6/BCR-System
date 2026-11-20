-- ============================================================================
-- MIGRATION: 20261122_keep_updated_at_flag.sql
-- Dự án: Hệ Thống Khảo Sát Hiện Trạng Công Trình Tuyến Metro Số 2 (BCS Platform)
--
-- Mục đích:
--   Nhịp giữ khóa ca (lock_heartbeat_at, 5 phút/lượt) KHÔNG được làm đổi base_survey_reports.updated_at.
--   updated_at là mốc frontend dùng để chọn nháp trên máy hay nháp trên máy chủ khi mở lại hồ sơ:
--   nếu nhịp giữ khóa đẩy updated_at lên, một lượt lưu nháp lỗi mạng (trong khi nhịp vẫn gửi được)
--   sẽ khiến lần mở sau lấy bản máy chủ và ghi đè phần sửa chưa lưu trên máy.
--
--   Trigger trg_update_reports_timestamp đặt updated_at = NOW() ở mọi UPDATE. Thêm cờ phiên:
--     SET LOCAL metro2.keep_updated_at = 'on'  ⇒  trigger không đụng updated_at trong transaction đó
--     (không có trong SET thì giữ giá trị cũ; câu nào tự đặt updated_at thì giữ giá trị đã đặt).
--   Không đặt cờ ⇒ hành vi như cũ (NOW()). Chỉ lệnh nhịp giữ khóa đặt cờ.
--
-- An toàn:
--   - CREATE OR REPLACE FUNCTION: idempotent, không đổi trigger, không cập nhật dữ liệu.
--   - Hàm dùng chung cho users và base_survey_reports; mặc định giữ nguyên hành vi cũ.
-- ============================================================================

CREATE OR REPLACE FUNCTION update_timestamp_column()
RETURNS TRIGGER AS $$
BEGIN
    IF current_setting('metro2.keep_updated_at', true) = 'on' THEN
        RETURN NEW;
    END IF;
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;
