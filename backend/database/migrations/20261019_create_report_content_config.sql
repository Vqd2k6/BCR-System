-- ============================================================================
-- 20261019 – CẤU HÌNH NỘI DUNG CHUẨN BÁO CÁO (Q1) & DANH MỤC THIẾT BỊ DỰ ÁN (Q5)
--
-- (1) report_standard_text_versions: văn bản chuẩn Mục IX / Phụ lục 3 / chú giải (*), lưu theo phiên bản
--     chỉ-thêm (append-only). Phiên bản hiệu lực = version_number lớn nhất chưa xóa mềm.
-- (2) project_survey_equipment: danh mục thiết bị khảo sát cấp dự án (model, serial, hiệu chuẩn).
--     Thiếu thông tin -> báo cáo in '--'. Xóa mềm bằng deleted_at.
-- (3) report_releases ghi lại phiên bản văn bản chuẩn + ảnh chụp danh mục thiết bị đã dùng cho mỗi Rev.
-- Migration lũy kế an toàn: chạy lại nhiều lần không lỗi, không ghi đè dữ liệu đã có.
-- ============================================================================

CREATE TABLE IF NOT EXISTS report_standard_text_versions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  version_number INTEGER NOT NULL UNIQUE CHECK (version_number >= 1),
  content_json JSONB NOT NULL,
  change_reason TEXT NOT NULL CHECK (char_length(btrim(change_reason)) >= 5),
  created_by_user_id UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_report_standard_text_versions_active
  ON report_standard_text_versions(version_number DESC) WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS project_survey_equipment (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  sort_order INTEGER NOT NULL DEFAULT 0,
  name_vi TEXT NOT NULL CHECK (char_length(btrim(name_vi)) >= 2),
  name_en TEXT NOT NULL DEFAULT '',
  specification_vi TEXT NOT NULL DEFAULT '',
  specification_en TEXT NOT NULL DEFAULT '',
  purpose_vi TEXT NOT NULL DEFAULT '',
  purpose_en TEXT NOT NULL DEFAULT '',
  model TEXT,
  serial_no TEXT,
  calibration_cert_no TEXT,
  calibration_valid_to DATE,
  created_by_user_id UUID REFERENCES users(id),
  updated_by_user_id UUID REFERENCES users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_project_survey_equipment_active
  ON project_survey_equipment(sort_order) WHERE deleted_at IS NULL;

ALTER TABLE report_releases ADD COLUMN IF NOT EXISTS standard_text_version_id UUID REFERENCES report_standard_text_versions(id);
ALTER TABLE report_releases ADD COLUMN IF NOT EXISTS equipment_snapshot_json JSONB;

-- Phiên bản 1: chỉ giữ văn bản chuẩn của dự án. Bỏ các câu khuôn mẫu không có căn cứ
-- ("Nội dung cần bổ sung" tự sinh, "lưu tại phòng thí nghiệm").
INSERT INTO report_standard_text_versions (version_number, content_json, change_reason)
SELECT 1,
  '{
    "recommendations": [
      {"vi": "Kiến nghị thiết lập hồ sơ hiện trạng ban đầu làm căn cứ pháp lý; lắp đặt mốc quan trắc biến dạng định kỳ trong suốt quá trình đào hầm TBM; theo dõi các vết nứt đã ghi nhận bằng thước đo nứt.",
       "en": "It is recommended to establish the baseline record as legal evidence, install periodic deformation monitoring points during TBM tunnelling, and follow up recorded cracks with crack gauges."},
      {"vi": "Báo cáo Giai đoạn 1 là hồ sơ khảo sát và sàng lọc ban đầu; hồ sơ pháp lý xác nhận hiện trạng trước thi công được thực hiện theo quy trình Giai đoạn 2 và các yêu cầu được dự án/Tư vấn phê duyệt.",
       "en": "This Phase 1 report is a preliminary survey and screening record; the legal pre-construction condition record is established under the Phase 2 procedure and the requirements approved by the Project/Engineer."}
    ],
    "pendingItems": [],
    "calibrationNote": null,
    "asteriskFootnote": {"vi": "(*) Các thông số bổ sung theo yêu cầu kỹ thuật của Chủ đầu tư & Ban Quản lý Tuyến Metro 2.",
                         "en": "(*) Additional parameters required by the Employer & Metro Line 2 Management Board."}
  }'::jsonb,
  'Khởi tạo văn bản chuẩn từ mẫu báo cáo hiện hành (bỏ câu khuôn mẫu tự sinh)'
WHERE NOT EXISTS (SELECT 1 FROM report_standard_text_versions);

-- Danh mục thiết bị khởi tạo: chỉ tên + mục đích + thông số đã có trong mẫu cũ.
-- Model / serial / chứng chỉ hiệu chuẩn để trống -> báo cáo in '--' cho tới khi Super Admin nhập.
INSERT INTO project_survey_equipment (sort_order, name_vi, name_en, specification_vi, specification_en, purpose_vi, purpose_en)
SELECT * FROM (VALUES
  (1, 'Máy ảnh số có GPS', 'Digital camera with GPS', '≥ 12MP, tọa độ EXIF WGS-84', '≥ 12 MP, EXIF WGS-84', 'Ảnh định danh, bối cảnh vết nứt', 'Identification photos, crack context'),
  (2, 'Thước đo bề rộng nứt', 'Crack width gauge', 'Vạch chia 0,1 – 10,0 mm', '0.1 – 10.0 mm', 'Đo bề rộng lớn nhất wmax', 'Measure wmax'),
  (3, 'Thước laser / thước thép', 'Laser / steel tape', '± 1,5 mm, tầm đo 40 m', '± 1.5 mm, 40 m range', 'Chiều dài nứt, kích thước phòng', 'Crack length, room size'),
  (4, 'Máy đo nghiêng / thước bọt nước', 'Inclinometer / spirit level', '', '', 'Nghiêng thân nhà X/Y, võng dầm sàn', 'Building tilt X/Y, deflection')
) AS seed(sort_order, name_vi, name_en, specification_vi, specification_en, purpose_vi, purpose_en)
WHERE NOT EXISTS (SELECT 1 FROM project_survey_equipment);
