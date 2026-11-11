-- Duyệt crop Photo QC: chỉ crop đã được Thẩm định duyệt (APPROVED) mới in vào report.
-- Crop đã lưu từ trước đặt PENDING (mặc định) để buộc rà lại sau khi chốt góc xoay / ghim.
ALTER TABLE photo_qc_photos ADD COLUMN IF NOT EXISTS crop_status VARCHAR(10) NOT NULL DEFAULT 'PENDING';
ALTER TABLE photo_qc_photos ADD COLUMN IF NOT EXISTS crop_reviewed_by UUID REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE photo_qc_photos ADD COLUMN IF NOT EXISTS crop_reviewed_at TIMESTAMPTZ;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_photo_qc_crop_status') THEN
        ALTER TABLE photo_qc_photos
            ADD CONSTRAINT chk_photo_qc_crop_status CHECK (crop_status IN ('PENDING', 'APPROVED', 'REJECTED'));
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_photo_qc_photos_crop_pending
    ON photo_qc_photos(report_id)
    WHERE crop IS NOT NULL AND crop_status = 'PENDING' AND deleted_at IS NULL;
