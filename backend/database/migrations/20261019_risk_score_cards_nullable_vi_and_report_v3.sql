-- Migration: 20261019_risk_score_cards_nullable_vi_and_report_v3.sql
-- Description: (1) Cho phép V3/V4/avg_vi/vi_class NULL khi chưa đủ dữ liệu (CAT, năm xây dựng)
--              thay vì ghi mặc định giả 1.0 (#25, D3).
--              (2) Soft delete cho base_survey_reports (#30).
--              (3) Bảng report_releases lưu từng Rev phát hành (D2): file, SHA-256, lý do, người phát hành.

ALTER TABLE risk_score_cards ALTER COLUMN v3_foundation_score DROP NOT NULL;
ALTER TABLE risk_score_cards ALTER COLUMN v4_age_score DROP NOT NULL;
ALTER TABLE risk_score_cards ALTER COLUMN avg_vi_score DROP NOT NULL;
ALTER TABLE risk_score_cards ALTER COLUMN vi_class DROP NOT NULL;

ALTER TABLE base_survey_reports ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS idx_base_survey_reports_deleted_at ON base_survey_reports(deleted_at);

CREATE TABLE IF NOT EXISTS report_releases (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  report_id UUID NOT NULL REFERENCES base_survey_reports(id) ON DELETE RESTRICT,
  revision INTEGER NOT NULL CHECK (revision >= 0),
  reason TEXT NOT NULL,
  is_final BOOLEAN NOT NULL DEFAULT FALSE,
  file_path TEXT NOT NULL,
  file_size_bytes BIGINT NOT NULL,
  sha256 CHAR(64) NOT NULL,
  snapshot_version_id UUID REFERENCES survey_report_versions(id),
  released_by_user_id UUID NOT NULL REFERENCES users(id),
  released_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,
  UNIQUE (report_id, revision)
);

CREATE INDEX IF NOT EXISTS idx_report_releases_report_id ON report_releases(report_id, revision DESC);
