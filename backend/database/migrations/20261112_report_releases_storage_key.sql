-- ============================================================================
-- File PDF Rev phát hành lưu trên Cloudflare R2 (kho chính) thay vì đĩa local.
-- storage_provider = 'local' : file_path là đường dẫn tuyệt đối trên đĩa (bản ghi cũ / máy dev)
-- storage_provider = 'r2'|'s3': storage_key + storage_bucket xác định object; file_path lưu cùng key
-- Idempotent: chạy lại nhiều lần không lỗi.
-- ============================================================================

ALTER TABLE report_releases ADD COLUMN IF NOT EXISTS storage_provider TEXT NOT NULL DEFAULT 'local';
ALTER TABLE report_releases ADD COLUMN IF NOT EXISTS storage_key TEXT;
ALTER TABLE report_releases ADD COLUMN IF NOT EXISTS storage_bucket TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_report_releases_storage_provider'
  ) THEN
    ALTER TABLE report_releases
      ADD CONSTRAINT chk_report_releases_storage_provider CHECK (storage_provider IN ('local', 'r2', 's3'));
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS uq_report_releases_storage_key
  ON report_releases (storage_bucket, storage_key)
  WHERE storage_key IS NOT NULL;

COMMENT ON COLUMN report_releases.storage_provider IS 'Nơi lưu file Rev: local | r2 | s3';
COMMENT ON COLUMN report_releases.storage_key IS 'Key object trên R2/S3, dạng report-releases/{reportId}/rev-NN.pdf';
COMMENT ON COLUMN report_releases.storage_bucket IS 'Bucket chứa object Rev (R2_RELEASES_BUCKET hoặc bucket chính)';
