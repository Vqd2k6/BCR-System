-- Migration: Tạo bảng survey_photo_registry quản lý vòng đời ảnh minh bạch và bổ sung cờ is_deleted
-- Ngày tạo: 2026-10-15
-- Dự án: Tuyến Metro số 2 TP.HCM (CRLG-CRSRI-TT)

-- 1. Bổ sung cờ xóa mềm is_deleted cho bảng khuyết tật và vùng hư hỏng
ALTER TABLE defect_items 
ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE damage_zones 
ADD COLUMN IF NOT EXISTS is_deleted BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS idx_defect_items_is_deleted ON defect_items(is_deleted);
CREATE INDEX IF NOT EXISTS idx_damage_zones_is_deleted ON damage_zones(is_deleted);

-- 2. Tạo bảng quản lý vòng đời ảnh chuyên biệt survey_photo_registry
CREATE TABLE IF NOT EXISTS survey_photo_registry (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    report_id UUID NOT NULL REFERENCES base_survey_reports(id) ON DELETE CASCADE,
    parcel_id UUID NOT NULL REFERENCES parcels(id) ON DELETE CASCADE,
    photo_category VARCHAR(64) NOT NULL, -- 'IDENTIFICATION', 'OVERVIEW', 'AS_BUILT', 'SETTLEMENT_TILT', 'CAD_FLOOR', 'ZONE_CTX', 'DEFECT_CU', 'SCOPE_GIS', 'MINUTES', 'ABSENCE_NOTICE', 'SIGNATURE'
    photo_type VARCHAR(64) NOT NULL,     -- 'P01', 'P02', 'P03', 'P04', 'CU', 'CTX', 'CAD', 'MINUTES', etc.
    photo_code VARCHAR(150) NOT NULL,    -- Chuẩn HCM_M2.B0039_F01_Z01_D01_CU_01
    photo_url TEXT NOT NULL,             -- URL file trên Cloudflare R2 / Local
    storage_key TEXT,                    -- Key lưu trữ trên S3/R2
    original_filename TEXT,              -- Tên file gốc người dùng tải lên
    standardized_filename TEXT NOT NULL, -- Tên file chuẩn M2__...jpg
    sha256_hash VARCHAR(64) NOT NULL,    -- Checksum SHA-256 bảo vệ tính toàn vẹn (Tamper-Proof)
    size_bytes BIGINT,
    mime_type VARCHAR(64) DEFAULT 'image/jpeg',
    status VARCHAR(32) NOT NULL DEFAULT 'ACTIVE', -- 'ACTIVE', 'SUPERSEDED', 'DELETED'
    superseded_by_photo_id UUID REFERENCES survey_photo_registry(id) ON DELETE SET NULL,
    superseded_by_url TEXT,
    replacement_for_url TEXT,
    is_deleted BOOLEAN NOT NULL DEFAULT false,
    deleted_at TIMESTAMPTZ,
    deleted_by_id UUID REFERENCES users(id) ON DELETE SET NULL,
    action_type VARCHAR(32) NOT NULL,    -- 'INITIAL_SURVEY', 'ADD', 'REPLACE', 'DELETE'
    action_reason TEXT,                  -- Lý do điều chỉnh bắt buộc của Admin
    actor_id UUID REFERENCES users(id) ON DELETE SET NULL,
    actor_role VARCHAR(32) DEFAULT 'ZONE_ADMIN',
    metadata_json JSONB DEFAULT '{}'::jsonb, -- GPS lat/lng, dimensions, epoch, defect_id, zone_id, floor_id
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Chỉ mục tối ưu hóa tra cứu pháp lý và kiểm toán
CREATE INDEX IF NOT EXISTS idx_photo_registry_report ON survey_photo_registry(report_id);
CREATE INDEX IF NOT EXISTS idx_photo_registry_code ON survey_photo_registry(photo_code);
CREATE INDEX IF NOT EXISTS idx_photo_registry_status ON survey_photo_registry(status);
CREATE INDEX IF NOT EXISTS idx_photo_registry_sha256 ON survey_photo_registry(sha256_hash);
CREATE INDEX IF NOT EXISTS idx_photo_registry_is_deleted ON survey_photo_registry(is_deleted);
