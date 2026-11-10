-- ============================================================================
-- Kết quả nhận diện watermark FE cũ (logo THACO-CREC cháy sẵn trong pixel) theo từng URL ảnh.
-- Ảnh trên R2 là bất biến theo URL nên chỉ cần quét 1 lần; quét lại khi đổi detector_version.
-- verdict: WATERMARKED | UNSURE | CLEAN. has_legacy_watermark = verdict <> 'CLEAN'
-- (UNSURE coi như đã có dấu để không bao giờ dập chồng lên chứng cứ).
-- Idempotent. Không có thao tác xoá.
-- ============================================================================

CREATE TABLE IF NOT EXISTS photo_watermark_status (
  photo_url TEXT PRIMARY KEY,
  has_legacy_watermark BOOLEAN NOT NULL,
  verdict TEXT NOT NULL,
  score NUMERIC(8, 3) NOT NULL,
  detector_version TEXT NOT NULL,
  detected_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_photo_watermark_status_verdict') THEN
    ALTER TABLE photo_watermark_status
      ADD CONSTRAINT chk_photo_watermark_status_verdict CHECK (verdict IN ('WATERMARKED', 'UNSURE', 'CLEAN'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_photo_watermark_status_verdict ON photo_watermark_status (verdict);

COMMENT ON TABLE photo_watermark_status IS 'Nhận diện watermark FE cũ theo logo (WatermarkDetectorService), dùng thay luật đoán theo ngày';
