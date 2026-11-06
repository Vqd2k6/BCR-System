-- ============================================================================
-- 20261107 – ĐẠI DIỆN CHÍNH QUYỀN ĐỊA PHƯƠNG (CQĐP) Ở CẤP THỬA
--
-- Giá trị mặc định do Zone Admin gán hàng loạt trên bản đồ GIS (POST /admin/parcels/batch/local-authority).
-- Chỉ là FALLBACK khi đọc báo cáo: người làm chứng KSV ghi trong survey_data_json luôn được ưu tiên,
-- batch KHÔNG ghi vào survey_data_json. Không lưu chữ ký ở cấp thửa (mỗi biên bản phải có chữ ký riêng).
-- Lịch sử thay đổi nằm trong system_audit_logs (action PARCEL_LOCAL_AUTHORITY_SET, before/after).
-- Migration lũy kế an toàn: chạy lại nhiều lần không lỗi.
-- ============================================================================

ALTER TABLE parcels ADD COLUMN IF NOT EXISTS local_authority_name VARCHAR(128);
ALTER TABLE parcels ADD COLUMN IF NOT EXISTS local_authority_role VARCHAR(128);
ALTER TABLE parcels ADD COLUMN IF NOT EXISTS local_authority_phone VARCHAR(32);

COMMENT ON COLUMN parcels.local_authority_name IS 'Họ tên đại diện chính quyền địa phương mặc định của thửa (fallback khi hồ sơ KSV không ghi người làm chứng)';
COMMENT ON COLUMN parcels.local_authority_role IS 'Chức vụ / đơn vị của đại diện CQĐP (VD: Tổ trưởng TDP, Cán bộ địa chính phường)';
COMMENT ON COLUMN parcels.local_authority_phone IS 'Số điện thoại liên hệ của đại diện CQĐP';
