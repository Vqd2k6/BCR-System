-- ============================================================================
-- MIGRATION: 20261014_add_postponed_absent_verified_to_enum.sql
-- Dự án: Hệ Thống Khảo Sát Hiện Trạng Công Trình Tuyến Metro Số 2 (BCR-System)
--
-- Mục đích:
--   Bổ sung giá trị 'POSTPONED_ABSENT_VERIFIED' vào enum parcel_survey_status_enum
--   để phân hệ phê duyệt Zone Admin có thể xác thực tính pháp lý của các hồ sơ
--   căn hộ con vắng mặt (có ảnh niêm phong/dán giấy hẹn), tạo điều kiện khóa sổ đợt 1.
--
-- Tính chất kỹ thuật:
--   - PURELY ADDITIVE: Không làm thay đổi hay ảnh hưởng đến các status hiện hữu
--     ('NOT_SURVEYED', 'IN_PROGRESS', 'SUBMITTED', 'APPROVED', 'POSTPONED_ABSENT', etc.)
-- ============================================================================

ALTER TYPE parcel_survey_status_enum ADD VALUE IF NOT EXISTS 'POSTPONED_ABSENT_VERIFIED';
