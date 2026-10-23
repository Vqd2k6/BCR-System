-- Migration: 20261022_enforce_approved_parcel_guard.sql
-- Mục đích: Khóa cứng bảng parcels khi lô đất đã có hồ sơ khảo sát cấp thửa/tổng thể (unit_id IS NULL) ở trạng thái APPROVED.
-- Ngăn chặn rò rỉ dữ liệu và bảo đảm tính bất biến pháp lý 100%, đồng thời không khóa nhầm các căn hộ con khác của tòa chung cư.

CREATE OR REPLACE FUNCTION check_parcel_approved_lock()
RETURNS TRIGGER AS $$
DECLARE
  v_has_approved BOOLEAN;
  v_report_code VARCHAR;
  v_old_btype VARCHAR;
  v_new_btype VARCHAR;
BEGIN
  -- Chuẩn hóa building_type ('CONDO' và 'CONDOMINIUM' là tương đương về mặt nghiệp vụ)
  v_old_btype := CASE WHEN UPPER(COALESCE(OLD.building_type, '')) = 'CONDO' THEN 'CONDOMINIUM' ELSE UPPER(COALESCE(OLD.building_type, '')) END;
  v_new_btype := CASE WHEN UPPER(COALESCE(NEW.building_type, '')) = 'CONDO' THEN 'CONDOMINIUM' ELSE UPPER(COALESCE(NEW.building_type, '')) END;

  -- Chỉ kiểm tra khi có sự thay đổi thực tế trên các trường cốt lõi
  IF (BTRIM(COALESCE(OLD.house_number, '')) IS DISTINCT FROM BTRIM(COALESCE(NEW.house_number, '')) OR
      BTRIM(COALESCE(OLD.street, '')) IS DISTINCT FROM BTRIM(COALESCE(NEW.street, '')) OR
      OLD.ward IS DISTINCT FROM NEW.ward OR
      OLD.district IS DISTINCT FROM NEW.district OR
      OLD.owner_name IS DISTINCT FROM NEW.owner_name OR
      OLD.owner_phone IS DISTINCT FROM NEW.owner_phone OR
      OLD.land_area_m2 IS DISTINCT FROM NEW.land_area_m2 OR
      OLD.construction_area_m2 IS DISTINCT FROM NEW.construction_area_m2 OR
      OLD.floor_count IS DISTINCT FROM NEW.floor_count OR
      v_old_btype IS DISTINCT FROM v_new_btype OR
      OLD.cadastral_polygon_geom IS DISTINCT FROM NEW.cadastral_polygon_geom OR
      OLD.footprint_polygon_geom IS DISTINCT FROM NEW.footprint_polygon_geom) THEN

    SELECT TRUE, report_code INTO v_has_approved, v_report_code
    FROM base_survey_reports
    WHERE parcel_id = OLD.id
      AND unit_id IS NULL
      AND status = 'APPROVED'
      AND deleted_at IS NULL
    LIMIT 1;

    IF v_has_approved IS TRUE THEN
      RAISE EXCEPTION 'PARCEL_LOCKED_APPROVED: Lô đất % đang có hồ sơ khảo sát đã phê duyệt (APPROVED - Mã: %). Bắt buộc phải Mở Approved trên hồ sơ trước khi sửa thông tin lô đất.',
        OLD.project_parcel_code, v_report_code
        USING ERRCODE = '23514'; -- check_violation
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_protect_approved_parcels ON parcels;

CREATE TRIGGER trg_protect_approved_parcels
BEFORE UPDATE ON parcels
FOR EACH ROW
EXECUTE FUNCTION check_parcel_approved_lock();
