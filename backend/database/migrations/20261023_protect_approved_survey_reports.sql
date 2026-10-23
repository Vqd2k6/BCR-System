-- Migration: 20261023_protect_approved_survey_reports.sql
-- Mục đích:
--   1. Khóa bất biến bảng base_survey_reports khi hồ sơ đã ở trạng thái APPROVED.
--      Chỉ cho phép:
--      a) Chuyển trạng thái Mở khóa hợp lệ (OLD.status = 'APPROVED' -> NEW.status IN ('UNDER_REVIEW', 'DRAFT')) mà không sửa nội dung khảo sát.
--      b) Luồng Phát hành Revision chính thức (tăng export_revision >= OLD.export_revision + 1 hoặc cập nhật official_pdf_url / xóa cờ tạm hasPendingRelease mà không sửa dữ liệu khảo sát).
--   2. Cập nhật idempotent hàm check_parcel_approved_lock() để đảm bảo chỉ khóa cấp Thửa đất khi có báo cáo cấp thửa/tổng thể (unit_id IS NULL) đang APPROVED.

CREATE OR REPLACE FUNCTION check_approved_survey_report_lock()
RETURNS TRIGGER AS $$
DECLARE
  v_old_clean_json JSONB;
  v_new_clean_json JSONB;
BEGIN
  v_old_clean_json := CASE
    WHEN OLD.survey_data_json IS NOT NULL AND jsonb_typeof(OLD.survey_data_json) = 'object'
    THEN OLD.survey_data_json - 'hasPendingRelease'
    ELSE COALESCE(OLD.survey_data_json, '{}'::jsonb)
  END;

  v_new_clean_json := CASE
    WHEN NEW.survey_data_json IS NOT NULL AND jsonb_typeof(NEW.survey_data_json) = 'object'
    THEN NEW.survey_data_json - 'hasPendingRelease'
    ELSE COALESCE(NEW.survey_data_json, '{}'::jsonb)
  END;

  IF (OLD.status = 'APPROVED' AND NEW.status = 'APPROVED') THEN
    -- 1. Kiểm tra nếu là luồng Release Revision hợp lệ (không thay đổi dữ liệu khảo sát gốc ngoài cờ tạm hasPendingRelease)
    IF (v_old_clean_json IS NOT DISTINCT FROM v_new_clean_json AND
        OLD.summary_conclusions IS NOT DISTINCT FROM NEW.summary_conclusions AND
        OLD.engineering_recommendations IS NOT DISTINCT FROM NEW.engineering_recommendations AND
        OLD.owner_remarks IS NOT DISTINCT FROM NEW.owner_remarks AND
        OLD.parcel_id IS NOT DISTINCT FROM NEW.parcel_id AND
        OLD.unit_id IS NOT DISTINCT FROM NEW.unit_id AND
        OLD.survey_date IS NOT DISTINCT FROM NEW.survey_date AND
        OLD.is_refused_or_absent IS NOT DISTINCT FROM NEW.is_refused_or_absent AND
        OLD.owner_signature_url IS NOT DISTINCT FROM NEW.owner_signature_url AND
        OLD.surveyor_signature_url IS NOT DISTINCT FROM NEW.surveyor_signature_url) THEN

      -- Cho phép tăng export_revision khi phát hành bản sửa đổi mới (Rev N -> Rev N+1)
      IF (NEW.export_revision >= COALESCE(OLD.export_revision, 0) + 1) THEN
        RETURN NEW;
      END IF;

      -- Cho phép gán official_pdf_url hoặc dọn cờ tạm hasPendingRelease khi export_revision giữ nguyên
      IF (NEW.export_revision IS NOT DISTINCT FROM OLD.export_revision) THEN
        RETURN NEW;
      END IF;
    END IF;

    -- 2. Chặn cứng mọi hành vi UPDATE dữ liệu khảo sát hoặc sửa export_revision bất hợp pháp khi đang APPROVED
    IF (v_old_clean_json IS DISTINCT FROM v_new_clean_json OR
        OLD.summary_conclusions IS DISTINCT FROM NEW.summary_conclusions OR
        OLD.engineering_recommendations IS DISTINCT FROM NEW.engineering_recommendations OR
        OLD.owner_remarks IS DISTINCT FROM NEW.owner_remarks OR
        OLD.parcel_id IS DISTINCT FROM NEW.parcel_id OR
        OLD.unit_id IS DISTINCT FROM NEW.unit_id OR
        OLD.survey_date IS DISTINCT FROM NEW.survey_date OR
        OLD.is_refused_or_absent IS DISTINCT FROM NEW.is_refused_or_absent OR
        OLD.owner_signature_url IS DISTINCT FROM NEW.owner_signature_url OR
        OLD.surveyor_signature_url IS DISTINCT FROM NEW.surveyor_signature_url OR
        OLD.export_revision IS DISTINCT FROM NEW.export_revision) THEN
      RAISE EXCEPTION 'VI PHẠM BẤT BIẾN (SURVEY_REPORT_LOCKED_APPROVED): Hồ sơ khảo sát % (ID: %) đã được phê duyệt chính thức (APPROVED). Tuyệt đối không được phép UPDATE trực tiếp dữ liệu khi chưa mở khóa (UNDER_REVIEW) hoặc phát hành Rev mới.',
        OLD.report_code, OLD.id
        USING ERRCODE = '23514';
    END IF;
  ELSIF (OLD.status = 'APPROVED' AND NEW.status <> 'APPROVED' AND v_old_clean_json IS DISTINCT FROM v_new_clean_json) THEN
    RAISE EXCEPTION 'VI PHẠM BẤT BIẾN (SURVEY_REPORT_LOCKED_APPROVED): Không được phép vừa hạ trạng thái vừa ghi đè survey_data_json trong cùng một câu lệnh trên hồ sơ % (ID: %).',
      OLD.report_code, OLD.id
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_protect_approved_survey ON base_survey_reports;

CREATE TRIGGER trg_protect_approved_survey
BEFORE UPDATE ON base_survey_reports
FOR EACH ROW
EXECUTE FUNCTION check_approved_survey_report_lock();

-- Đồng bộ idempotent hàm check_parcel_approved_lock() cho các môi trường đã chạy migration 20261022 trước đó
CREATE OR REPLACE FUNCTION check_parcel_approved_lock()
RETURNS TRIGGER AS $$
DECLARE
  v_has_approved BOOLEAN;
  v_report_code VARCHAR;
  v_old_btype VARCHAR;
  v_new_btype VARCHAR;
BEGIN
  v_old_btype := CASE WHEN UPPER(COALESCE(OLD.building_type, '')) = 'CONDO' THEN 'CONDOMINIUM' ELSE UPPER(COALESCE(OLD.building_type, '')) END;
  v_new_btype := CASE WHEN UPPER(COALESCE(NEW.building_type, '')) = 'CONDO' THEN 'CONDOMINIUM' ELSE UPPER(COALESCE(NEW.building_type, '')) END;

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
        USING ERRCODE = '23514';
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
