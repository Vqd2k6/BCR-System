-- ============================================================================
-- Đa template report nhà dân (residential_v1 / residential_v2), chốt 14/11/2026.
-- Mỗi Rev ghi lại template đã dùng lúc phát hành để xem/tải lại Rev luôn ra đúng bố cục của file
-- đã băm SHA-256, kể cả khi template mặc định (DEFAULT_RESIDENTIAL_TEMPLATE) đổi sang v2.
-- Mọi Rev phát hành trước migration này đều in bằng template v1, nên DEFAULT 'residential_v1' là đúng sự thật.
-- Idempotent: chạy lại nhiều lần không lỗi.
-- ============================================================================

ALTER TABLE report_releases ADD COLUMN IF NOT EXISTS template_key TEXT NOT NULL DEFAULT 'residential_v1';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_report_releases_template_key'
  ) THEN
    ALTER TABLE report_releases
      ADD CONSTRAINT chk_report_releases_template_key CHECK (template_key IN ('residential_v1', 'residential_v2'));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_report_releases_snapshot_version
  ON report_releases (snapshot_version_id)
  WHERE snapshot_version_id IS NOT NULL;

COMMENT ON COLUMN report_releases.template_key IS 'Template report đã dùng khi phát hành Rev (residential_v1 | residential_v2); render lại Rev luôn theo cột này';
