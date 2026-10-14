-- ==============================================================================
-- Migration: 20261015_create_survey_report_versions.sql
-- Description: Tạo bảng lưu trữ Snapshot phiên bản bất biến (Append-Only)
--              cho hồ sơ khảo sát hiện trạng Metro 2 (Survey Report Versioning).
-- ==============================================================================

CREATE TABLE IF NOT EXISTS survey_report_versions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    report_id UUID NOT NULL REFERENCES base_survey_reports(id) ON DELETE CASCADE,
    version_number INTEGER NOT NULL, -- 0 (Bản nộp thực địa ban đầu), 1, 2, 3...
    version_tag VARCHAR(64) NOT NULL, -- 'ORIGINAL_SUBMISSION', 'ADMIN_DIFF_SAVE', 'CHIEF_ENGINEER_OVERRIDE', 'PHOTO_REPLACEMENT', 'ROLLBACK_RESTORE', 'REVERT_TO_DRAFT'
    title VARCHAR(255) NOT NULL, -- Tiêu đề ngắn gọn: VD: 'Bản nộp thực địa ban đầu', 'Hiệu chỉnh vết nứt D-01 bởi Kỹ sư D'
    edit_reason TEXT, -- Lý do kỹ thuật bắt buộc
    snapshot_data JSONB NOT NULL, -- Toàn bộ trạng thái hồ sơ tại giây phút đó
    diff_summary JSONB, -- Mảng diff [{field, label, oldValue, newValue}] dẫn tới phiên bản này
    created_by_user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    client_ip VARCHAR(64),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_report_version UNIQUE (report_id, version_number)
);

-- Index tra cứu danh sách phiên bản theo report_id sắp xếp mới nhất lên đầu
CREATE INDEX IF NOT EXISTS idx_report_versions_lookup 
ON survey_report_versions(report_id, version_number DESC);

-- Index lọc theo tag phiên bản
CREATE INDEX IF NOT EXISTS idx_report_versions_tag 
ON survey_report_versions(version_tag);

-- Index theo thời gian tạo phiên bản
CREATE INDEX IF NOT EXISTS idx_report_versions_created_at 
ON survey_report_versions(created_at DESC);
