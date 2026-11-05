-- ============================================================================
-- 20261105 – CẤU HÌNH KHUNG TÊN BÌNH ĐỒ CAD THEO ZONE
--
-- (1) zone_drawing_title_blocks: chức danh ký (Người vẽ / Kiểm tra / Duyệt / Chủ nhiệm / GĐ dự án)
--     và Số bản vẽ của từng Zone. Thiếu bản ghi -> frontend dùng giá trị trên bản vẽ mẫu PDF.
-- (2) zone_drawing_revisions: lịch sử phát hành R00, R01... CHỈ THÊM (append-only); số Rev do server cấp.
-- Chỉ Super Admin được ghi; mọi thay đổi ghi system_audit_logs trong cùng transaction.
-- Migration lũy kế an toàn: chạy lại nhiều lần không lỗi, không ghi đè dữ liệu đã có.
-- ============================================================================

CREATE TABLE IF NOT EXISTS zone_drawing_title_blocks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  zone_code VARCHAR(20) NOT NULL UNIQUE,
  prepared_by TEXT NOT NULL DEFAULT '',
  reviewed_by TEXT NOT NULL DEFAULT '',
  approved_by TEXT NOT NULL DEFAULT '',
  manager TEXT NOT NULL DEFAULT '',
  project_manager TEXT NOT NULL DEFAULT '',
  drawing_no TEXT NOT NULL DEFAULT '',
  updated_by_user_id UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS zone_drawing_revisions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  zone_code VARCHAR(20) NOT NULL,
  revision_number INTEGER NOT NULL CHECK (revision_number >= 0),
  issue_date DATE NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  created_by_user_id UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_zone_drawing_revisions_zone_number
  ON zone_drawing_revisions(zone_code, revision_number);

CREATE INDEX IF NOT EXISTS idx_zone_drawing_revisions_active
  ON zone_drawing_revisions(zone_code, revision_number) WHERE deleted_at IS NULL;
