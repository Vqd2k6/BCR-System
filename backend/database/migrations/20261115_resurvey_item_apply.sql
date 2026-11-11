-- Migration: 20261115_resurvey_item_apply.sql
-- Thẩm định quyết định "Đưa vào" từng mục ảnh chụp lại.
--   Duyệt phiên chỉ xác nhận ảnh KSV hợp lệ; report chỉ in mục apply_status = 'APPLIED'.
--   Dòng cũ (kể cả phiên đã duyệt trước đây) nhận PENDING: ngừng in cho tới khi Thẩm định bấm Đưa vào.
-- Chạy lại nhiều lần an toàn.

ALTER TABLE survey_photo_resurvey_items ADD COLUMN IF NOT EXISTS apply_status VARCHAR(10) NOT NULL DEFAULT 'PENDING';
ALTER TABLE survey_photo_resurvey_items ADD COLUMN IF NOT EXISTS apply_decided_by UUID REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE survey_photo_resurvey_items ADD COLUMN IF NOT EXISTS apply_decided_at TIMESTAMPTZ;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_photo_resurvey_item_apply_status') THEN
    ALTER TABLE survey_photo_resurvey_items
      ADD CONSTRAINT chk_photo_resurvey_item_apply_status CHECK (apply_status IN ('PENDING', 'APPLIED', 'DECLINED'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_photo_resurvey_items_apply
    ON survey_photo_resurvey_items(resurvey_id, apply_status) WHERE deleted_at IS NULL;
