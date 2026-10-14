-- ============================================================================
-- MIGRATION: 20261014_add_parcel_seal_columns.sql
-- Dự án: Hệ Thống Khảo Sát Hiện Trạng Công Trình Tuyến Metro Số 2 (BCS Platform)
-- Mục đích: Bổ sung các trường phục vụ Khóa Sổ Pháp Lý Toàn Diện Tòa Nhà Mẹ (Condo Master Final Seal)
-- ============================================================================

ALTER TABLE parcels
  ADD COLUMN IF NOT EXISTS is_locked BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS locked_at TIMESTAMPTZ DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS locked_by_id UUID REFERENCES users(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS seal_hash VARCHAR(255) DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS seal_notes TEXT DEFAULT NULL;

CREATE INDEX IF NOT EXISTS idx_parcels_is_locked ON parcels(is_locked);
