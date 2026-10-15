-- Migration: 20261016_create_survey_audit_locks.sql
-- Description: Bảng lưu phiên khóa chỉnh sửa độc quyền (Exclusive Audit Lock 15 phút)

CREATE TABLE IF NOT EXISTS survey_audit_locks (
  report_id UUID PRIMARY KEY REFERENCES base_survey_reports(id) ON DELETE CASCADE,
  locked_by_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  locked_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '15 minutes')
);

CREATE INDEX IF NOT EXISTS idx_survey_audit_locks_expires_at ON survey_audit_locks(expires_at);
