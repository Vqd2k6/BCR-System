-- ============================================================================
-- MIGRATION: 20261011_add_completed_to_parcel_survey_status_enum.sql
-- Dự án: Hệ Thống Khảo Sát Hiện Trạng Công Trình Tuyến Metro Số 2 (BCR-System)
--
-- Mục đích:
--   Bổ sung giá trị 'COMPLETED' vào enum parcel_survey_status_enum nhằm ngăn chặn
--   lỗi hệ thống (500 Internal Server Error: invalid input value for enum
--   parcel_survey_status_enum: "COMPLETED") khi lưu draft hoặc giải phóng lock
--   của phiên khảo sát căn hộ con (building_units).
--
-- Tính chất kỹ thuật:
--   - PURELY ADDITIVE: Không làm thay đổi hay ảnh hưởng đến các status hiện hữu
--     ('NOT_SURVEYED', 'IN_PROGRESS', 'SUBMITTED', 'APPROVED', etc.)
-- ============================================================================

ALTER TYPE parcel_survey_status_enum ADD VALUE IF NOT EXISTS 'COMPLETED';
