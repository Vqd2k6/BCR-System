-- Migration: 20261109_create_photo_qc.sql
-- Module Photo QC (rà soát ảnh hồ sơ): lớp phủ chỉ đọc lên dữ liệu khảo sát gốc.
--   - photo_qc_reports: 1 dòng / hồ sơ có thao tác (đổi bìa P04, mức thu thập lại, đã rà).
--   - photo_qc_photos : 1 dòng / ảnh có crop, dập bù watermark hoặc cờ chụp lại.
-- Bất biến: không ghi survey_data_json, không sửa/xoá file gốc trên R2, không xoá cứng dòng QC.
-- Hồ sơ APPROVED: render đọc QC đã đóng băng trong snapshot (frozenReportData.photo_qc),
-- nên sửa QC chỉ có hiệu lực từ snapshot/revision kế tiếp (r00 đã phát hành giữ nguyên SHA-256).

CREATE TABLE IF NOT EXISTS photo_qc_reports (
    report_id UUID PRIMARY KEY REFERENCES base_survey_reports(id),
    zone_id VARCHAR(32),
    station_code VARCHAR(16),
    cover_source VARCHAR(8),
    recapture_level VARCHAR(16) NOT NULL DEFAULT 'NONE',
    reviewed BOOLEAN NOT NULL DEFAULT FALSE,
    updated_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    CONSTRAINT chk_photo_qc_cover_source CHECK (cover_source IS NULL OR cover_source IN ('P04')),
    CONSTRAINT chk_photo_qc_recapture_level CHECK (recapture_level IN ('NONE', 'OUTDOOR_ONLY', 'FULL'))
);

CREATE INDEX IF NOT EXISTS idx_photo_qc_reports_zone_station ON photo_qc_reports(zone_id, station_code);

CREATE TABLE IF NOT EXISTS photo_qc_photos (
    report_id UUID NOT NULL REFERENCES base_survey_reports(id),
    photo_key VARCHAR(64) NOT NULL,
    photo_url TEXT NOT NULL,
    photo_label TEXT,
    crop JSONB,
    restamp_mode VARCHAR(8) NOT NULL DEFAULT 'NONE',
    recapture BOOLEAN NOT NULL DEFAULT FALSE,
    photo_group VARCHAR(8) NOT NULL,
    status VARCHAR(12) NOT NULL DEFAULT 'OPEN',
    updated_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    PRIMARY KEY (report_id, photo_key),
    CONSTRAINT chk_photo_qc_restamp_mode CHECK (restamp_mode IN ('NONE', 'LOGO', 'TEXT', 'BOTH')),
    CONSTRAINT chk_photo_qc_photo_group CHECK (photo_group IN ('OUTDOOR', 'INDOOR')),
    CONSTRAINT chk_photo_qc_status CHECK (status IN ('OPEN', 'ASSIGNED', 'RESOLVED'))
);

CREATE INDEX IF NOT EXISTS idx_photo_qc_photos_recapture ON photo_qc_photos(report_id) WHERE recapture = TRUE AND deleted_at IS NULL;
