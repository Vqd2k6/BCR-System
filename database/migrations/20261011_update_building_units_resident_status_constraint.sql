-- ============================================================================
-- Migration: 20261011_update_building_units_resident_status_constraint.sql
-- Mục đích: Mở rộng ràng buộc CHECK cho cột resident_status trong bảng building_units
-- để hỗ trợ đầy đủ các trạng thái thực tế chuẩn Phase 1 BCS Metro 2:
-- 'CHỦ_HỘ_Ở', 'CHO_THUÊ', 'BỎ_TRỐNG_CHƯA_VỀ_Ở', 'VẮNG_MẶT_KHÓA_CỬA', 'ĐỂ_TRỐNG', 'TRANH_CHẤP'
-- ============================================================================

DO $$
BEGIN
  -- 1. Xóa ràng buộc cũ nếu đang tồn tại
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'chk_building_units_resident_status'
  ) THEN
    ALTER TABLE building_units DROP CONSTRAINT chk_building_units_resident_status;
  END IF;

  -- 2. Tạo ràng buộc mới với đầy đủ các enum hợp lệ
  ALTER TABLE building_units 
    ADD CONSTRAINT chk_building_units_resident_status 
    CHECK (resident_status IN (
      'CHỦ_HỘ_Ở', 
      'CHO_THUÊ', 
      'BỎ_TRỐNG_CHƯA_VỀ_Ở', 
      'VẮNG_MẶT_KHÓA_CỬA', 
      'ĐỂ_TRỐNG', 
      'TRANH_CHẤP'
    ));
END $$;
