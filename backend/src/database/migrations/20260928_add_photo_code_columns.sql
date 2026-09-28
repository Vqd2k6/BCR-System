-- Migration: Bổ sung các cột định danh mã ảnh (Photo ID / photo_code) chuẩn hóa dự án Metro 2
-- Ngày tạo: 2026-09-28
-- Áp dụng cho: survey_identification_photos, damage_zones, defect_items, deformation_assessments

-- 1. Bảng 4 ảnh định danh ngoại thất P01 - P04
ALTER TABLE survey_identification_photos 
ADD COLUMN IF NOT EXISTS photo_code VARCHAR(150);

-- 2. Bảng vùng hư hỏng (Ảnh bối cảnh CTX)
ALTER TABLE damage_zones 
ADD COLUMN IF NOT EXISTS ctx_photo_code VARCHAR(150);

-- 3. Bảng khuyết tật (Ảnh cận cảnh CU có thước đo)
ALTER TABLE defect_items 
ADD COLUMN IF NOT EXISTS cu_photo_code VARCHAR(150);

-- 4. Bảng đánh giá biến dạng lún nghiêng (Mục 1.6 Bước 1)
ALTER TABLE deformation_assessments 
ADD COLUMN IF NOT EXISTS diff_settlement_photo_code VARCHAR(150),
ADD COLUMN IF NOT EXISTS tilt_photo_code VARCHAR(150),
ADD COLUMN IF NOT EXISTS abnormal_photo_code VARCHAR(150);

-- 5. Tạo Index tối ưu hóa truy vấn nhanh theo Photo ID khi tra cứu pháp lý
CREATE INDEX IF NOT EXISTS idx_survey_photos_photo_code ON survey_identification_photos(photo_code);
CREATE INDEX IF NOT EXISTS idx_damage_zones_ctx_photo_code ON damage_zones(ctx_photo_code);
CREATE INDEX IF NOT EXISTS idx_defect_items_cu_photo_code ON defect_items(cu_photo_code);
