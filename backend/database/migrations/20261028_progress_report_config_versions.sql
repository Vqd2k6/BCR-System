-- ============================================================================
-- 20261028 – CẤU HÌNH MODULE BÁO CÁO TIẾN ĐỘ NGÀY (PROGRESS REPORT PLUGIN)
--
-- Bảng cấu hình append-only (chỉ-thêm) cho module progress-report:
--   ngưỡng phân loại ECS/BRA/Burland, nhãn, màu, override Phải/Trái tuyến.
-- Phiên bản hiệu lực = version_number lớn nhất chưa xóa mềm.
-- Nếu bảng rỗng, module dùng DEFAULT_CONFIG trong code.
-- Migration lũy kế an toàn: chạy lại nhiều lần không lỗi.
-- Bảng độc lập, không có khóa ngoại tới bảng nghiệp vụ khảo sát (plugin cắm-rút).
-- ============================================================================

CREATE TABLE IF NOT EXISTS progress_report_config_versions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  version_number INTEGER NOT NULL UNIQUE CHECK (version_number >= 1),
  content_json JSONB NOT NULL,
  change_reason TEXT NOT NULL CHECK (char_length(btrim(change_reason)) >= 5),
  created_by_user_id UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_progress_report_config_versions_active
  ON progress_report_config_versions(version_number DESC) WHERE deleted_at IS NULL;

