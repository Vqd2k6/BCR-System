-- ============================================================================
-- Xác nhận tay trạng thái dấu cũ của ảnh (sửa lỗi watermark 13/11/2026).
-- Ảnh NGHI NGỜ (điểm dò 1,15–4,5 hoặc dò thất bại) chặn xuất report tới khi Zone Admin / Super Admin
-- xác nhận từng ảnh "Có dấu cũ" / "Chưa có dấu". Kết quả gắn theo URL ảnh (file R2 bất biến).
--   source = DETECTOR: kết quả bộ dò; bộ dò chạy lại được ghi đè.
--   source = MANUAL  : người xác nhận; bộ dò chạy lại KHÔNG được ghi đè.
-- Dòng MANUAL cho ảnh dò thất bại không có điểm, nên score bỏ NOT NULL.
-- Lịch sử xác nhận nằm trong system_audit_logs (action PHOTO_WATERMARK_CONFIRM, before/after).
-- Idempotent. Không có thao tác xoá.
-- ============================================================================

ALTER TABLE photo_watermark_status ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'DETECTOR';
ALTER TABLE photo_watermark_status ADD COLUMN IF NOT EXISTS confirmed_by UUID NULL;
ALTER TABLE photo_watermark_status ADD COLUMN IF NOT EXISTS confirmed_at TIMESTAMPTZ NULL;
ALTER TABLE photo_watermark_status ADD COLUMN IF NOT EXISTS confirm_reason TEXT NULL;
ALTER TABLE photo_watermark_status ALTER COLUMN score DROP NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_photo_watermark_status_source') THEN
    ALTER TABLE photo_watermark_status
      ADD CONSTRAINT chk_photo_watermark_status_source CHECK (source IN ('DETECTOR', 'MANUAL'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_photo_watermark_status_source ON photo_watermark_status (source);

COMMENT ON COLUMN photo_watermark_status.source IS 'DETECTOR = bộ dò logo; MANUAL = người xác nhận (bộ dò không ghi đè)';
COMMENT ON COLUMN photo_watermark_status.confirmed_by IS 'users.id người xác nhận tay (Zone Admin của Zone hoặc Super Admin)';
