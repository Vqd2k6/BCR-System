-- ============================================================================
-- MIGRATION: 20260928_add_survey_draft_sync.sql
-- Mục đích: Bổ sung các trường quản lý bản nháp (Draft), khóa cửa sổ làm việc 15 phút
-- và lịch sử bàn giao ca làm việc (Shift Handover) kèm mã bảo mật 6 số.
-- ============================================================================

ALTER TABLE base_survey_reports
    ADD COLUMN IF NOT EXISTS sync_version INT NOT NULL DEFAULT 1,
    ADD COLUMN IF NOT EXISTS last_edited_by_id UUID REFERENCES users(id),
    ADD COLUMN IF NOT EXISTS handover_security_code VARCHAR(8),
    ADD COLUMN IF NOT EXISTS is_ready_for_handover BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN IF NOT EXISTS handover_history JSONB NOT NULL DEFAULT '[]'::jsonb;

-- Đánh index tối ưu việc truy vấn bản nháp đang thực hiện
CREATE INDEX IF NOT EXISTS idx_reports_draft_lookup 
    ON base_survey_reports(parcel_id, phase, status);
