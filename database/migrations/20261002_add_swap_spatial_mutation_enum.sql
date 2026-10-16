-- ============================================================================
-- MIGRATION: 20261002_add_swap_spatial_mutation_enum.sql
-- Dự án: Hệ Thống Khảo Sát Hiện Trạng Công Trình Tuyến Metro Số 2 (BCS Platform)
--
-- Mục đích:
--   Bổ sung giá trị 'SWAP_SPATIAL' vào enum mutation_type_enum cho nghiệp vụ
--   hoán đổi vị trí ranh đất không gian GIS (Spatial Geometry Swap).
--
-- Tính chất kỹ thuật:
--   - PURELY ADDITIVE: Không ảnh hưởng đến các giá trị enum hiện hữu (ORIGINAL, SPLIT, MERGE, REDRAW).
--   - ZERO DATA LOSS: Bảo toàn 100% hồ sơ, mã thửa và watermark ảnh.
-- ============================================================================

ALTER TYPE mutation_type_enum ADD VALUE IF NOT EXISTS 'SWAP_SPATIAL';
