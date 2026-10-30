-- ============================================================================
-- Migration: 20261030_add_parcel_exclusion.sql
-- Purpose:
--   Soft Exclusion cho thửa đất không thuộc diện khảo sát (đất giao thông, đất trống,
--   thửa click nhầm / tập huấn / trùng lặp). Không xóa cứng, không đổi survey_status.
--   Lưu ý: không dùng giá trị enum mới trong file này vì migration chạy trong transaction.
-- ============================================================================

ALTER TYPE parcel_lifecycle_enum ADD VALUE IF NOT EXISTS 'EXCLUDED_NON_BUILDING';
ALTER TYPE parcel_lifecycle_enum ADD VALUE IF NOT EXISTS 'EXCLUDED_TRAINING_DEMO';

ALTER TABLE parcels ADD COLUMN IF NOT EXISTS exclusion_type VARCHAR(32);
ALTER TABLE parcels ADD COLUMN IF NOT EXISTS exclusion_reason TEXT;
ALTER TABLE parcels ADD COLUMN IF NOT EXISTS excluded_at TIMESTAMPTZ;
ALTER TABLE parcels ADD COLUMN IF NOT EXISTS excluded_by_id UUID REFERENCES users(id) ON DELETE SET NULL;
