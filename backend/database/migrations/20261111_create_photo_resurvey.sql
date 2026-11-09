-- Migration: 20261111_create_photo_resurvey.sql
-- Module chụp lại ảnh ngoài nhà dân (Photo QC giai đoạn 3).
--   - survey_photo_resurveys      : 1 phiên chụp lại / hồ sơ (DRAFT -> SUBMITTED -> APPROVED; Admin từ chối thì về DRAFT).
--   - survey_photo_resurvey_items : từng thao tác trong phiên (REPLACE / ADD_EXTRA / MARK_NA).
-- Bất biến:
--   - Không ghi survey_data_json, không sửa/xoá file gốc trên R2 (ảnh mới nằm ở nhánh resurvey/...).
--   - Không xoá cứng: thay ảnh = soft-delete item cũ + thêm item mới.
--   - Report chỉ đọc phiên APPROVED (lớp phủ khi render); hồ sơ đã phát hành nhận ảnh mới từ revision kế tiếp.
-- Chạy lại nhiều lần an toàn.

CREATE TABLE IF NOT EXISTS survey_photo_resurveys (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    report_id UUID NOT NULL REFERENCES base_survey_reports(id),
    parcel_id UUID NOT NULL REFERENCES parcels(id),
    zone_id VARCHAR(32),
    status VARCHAR(16) NOT NULL DEFAULT 'DRAFT',
    surveyor_id UUID REFERENCES users(id) ON DELETE SET NULL,
    submitted_at TIMESTAMPTZ,
    submitted_sha256 VARCHAR(64),
    reviewed_by UUID REFERENCES users(id) ON DELETE SET NULL,
    reviewed_at TIMESTAMPTZ,
    review_note TEXT,
    reject_count INT NOT NULL DEFAULT 0,
    approved_sha256 VARCHAR(64),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    CONSTRAINT chk_photo_resurvey_status CHECK (status IN ('DRAFT', 'SUBMITTED', 'APPROVED'))
);

-- Mỗi hồ sơ chỉ có một phiên đang mở (nháp hoặc chờ duyệt).
CREATE UNIQUE INDEX IF NOT EXISTS uq_photo_resurvey_open
    ON survey_photo_resurveys(report_id)
    WHERE status IN ('DRAFT', 'SUBMITTED') AND deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_photo_resurvey_zone_status ON survey_photo_resurveys(zone_id, status) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_photo_resurvey_parcel ON survey_photo_resurveys(parcel_id);
CREATE INDEX IF NOT EXISTS idx_photo_resurvey_report ON survey_photo_resurveys(report_id);

CREATE TABLE IF NOT EXISTS survey_photo_resurvey_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    resurvey_id UUID NOT NULL REFERENCES survey_photo_resurveys(id),
    action VARCHAR(12) NOT NULL,
    slot_code VARCHAR(8) NOT NULL,
    -- REPLACE / MARK_NA: khoá ô Photo QC của ảnh gốc (P-02, P-03#2...). ADD_EXTRA: NULL.
    photo_key VARCHAR(64),
    original_url TEXT,
    -- ADD_EXTRA: thứ tự ảnh phát sinh trong cùng mục (1, 2, ...).
    extra_index INT,
    new_url TEXT,
    new_r2_key TEXT,
    new_sha256 VARCHAR(64),
    new_size_bytes INT,
    rotation INT NOT NULL DEFAULT 0,
    na_reason TEXT,
    -- Time 2: chữ ngày giờ in trên watermark report (khớp dòng thời gian ảnh gốc).
    time2_text VARCHAR(40),
    time2_at TIMESTAMPTZ,
    time2_source VARCHAR(16),
    -- Time 1: thời điểm chụp thật (đồng hồ máy KSV) và thời điểm server nhận ảnh.
    captured_at_client TIMESTAMPTZ,
    received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    capture_lat DOUBLE PRECISION,
    capture_lng DOUBLE PRECISION,
    capture_accuracy_m DOUBLE PRECISION,
    distance_to_parcel_m DOUBLE PRECISION,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    deleted_at TIMESTAMPTZ,
    CONSTRAINT chk_photo_resurvey_item_action CHECK (action IN ('REPLACE', 'ADD_EXTRA', 'MARK_NA')),
    CONSTRAINT chk_photo_resurvey_item_slot CHECK (slot_code IN ('P-01', 'P-02', 'P-03', 'P-04', 'P-05', 'P-06', 'P-07')),
    CONSTRAINT chk_photo_resurvey_item_time2_source CHECK (
        time2_source IS NULL OR time2_source IN ('ORIGINAL', 'INTERPOLATED', 'DATE_ONLY', 'ADMIN')
    ),
    CONSTRAINT chk_photo_resurvey_item_target CHECK (
        (action = 'ADD_EXTRA' AND photo_key IS NULL AND extra_index IS NOT NULL)
        OR (action IN ('REPLACE', 'MARK_NA') AND photo_key IS NOT NULL)
    ),
    CONSTRAINT chk_photo_resurvey_item_photo CHECK (
        (action = 'MARK_NA' AND new_url IS NULL)
        OR (action IN ('REPLACE', 'ADD_EXTRA') AND new_url IS NOT NULL)
    )
);

-- Mỗi ô ảnh gốc chỉ có một thao tác đang hiệu lực trong phiên (thay lại = soft-delete dòng cũ).
CREATE UNIQUE INDEX IF NOT EXISTS uq_photo_resurvey_item_target
    ON survey_photo_resurvey_items(resurvey_id, photo_key)
    WHERE photo_key IS NOT NULL AND deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_photo_resurvey_items_session ON survey_photo_resurvey_items(resurvey_id) WHERE deleted_at IS NULL;
