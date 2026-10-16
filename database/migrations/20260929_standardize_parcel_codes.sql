-- Migration: Chuẩn hóa mã thửa đất theo phân đoạn [LOẠI]-[STT]-[B-XXXX]
-- Áp dụng: Tuyến Metro Số 2 (Bến Thành - Tham Lương)
-- Ngày thực hiện: 29/09/2026

-- Đảm bảo độ dài VARCHAR(32) cho project_parcel_code và code_slug
ALTER TABLE parcels ALTER COLUMN project_parcel_code TYPE VARCHAR(32);
ALTER TABLE parcels ALTER COLUMN code_slug TYPE VARCHAR(32);

-- Tạo chỉ mục tìm kiếm nhanh
CREATE INDEX IF NOT EXISTS idx_parcels_project_parcel_code ON parcels(project_parcel_code);
CREATE INDEX IF NOT EXISTS idx_parcels_code_slug ON parcels(code_slug);
