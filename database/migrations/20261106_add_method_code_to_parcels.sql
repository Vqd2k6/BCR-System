-- ============================================================================
-- 20261106 – MÃ SỐ BIỆN PHÁP TRƯỚC THI CÔNG (parcels.method_code)
--
-- Mỗi thửa đang tồn tại phải có đủ 2 mã: mã khảo sát (project_parcel_code) và mã biện pháp
-- (method_code, VD 'ST04-L-0146', 'POR-01-R-1111', 'DEP-01-L-0007', 'ST04-L-0146-DU').
-- Mã biện pháp do backend sinh (helper assignMethodCode, cùng tim tuyến CAD MAUR 537 điểm với
-- Báo cáo tiến độ) ngay sau INSERT, trong cùng transaction. Thửa cũ được bổ sung bằng script
-- populate_parcels_method_code.ts, chỉ ghi vào dòng còn NULL, không đụng cột khác.
--
-- Chốt toàn vẹn ở tầng DB:
--   (1) Thửa mới INSERT mà đến lúc COMMIT vẫn chưa có method_code -> RAISE (constraint trigger deferred).
--   (2) method_code đã có thì bất biến: cấm đổi giá trị hoặc xoá về NULL.
--   (3) Cấp mã lần đầu không làm đổi updated_at (backfill "chỉ bổ sung").
-- Migration lũy kế an toàn: chạy lại nhiều lần không lỗi, không ghi đè dữ liệu đã có.
-- ============================================================================

ALTER TABLE parcels ADD COLUMN IF NOT EXISTS method_code VARCHAR(48);

CREATE UNIQUE INDEX IF NOT EXISTS uq_parcels_method_code
  ON parcels (method_code)
  WHERE method_code IS NOT NULL;

-- (1) Thửa mới bắt buộc có mã biện pháp tại thời điểm COMMIT.
-- Trigger deferred nhận NEW theo phiên bản dòng lúc INSERT, nên phải đọc lại trạng thái thực tế của dòng.
CREATE OR REPLACE FUNCTION enforce_parcel_method_code_on_commit()
RETURNS TRIGGER AS $$
DECLARE
  v_method_code VARCHAR;
  v_exists BOOLEAN;
BEGIN
  SELECT TRUE, method_code INTO v_exists, v_method_code
  FROM parcels
  WHERE id = NEW.id;

  IF v_exists IS TRUE AND v_method_code IS NULL THEN
    RAISE EXCEPTION 'PARCEL_METHOD_CODE_REQUIRED: Thửa % chưa được sinh mã biện pháp (method_code). Mọi thửa phải có đủ mã khảo sát và mã biện pháp.',
      NEW.project_parcel_code
      USING ERRCODE = '23502';
  END IF;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_parcels_method_code_required ON parcels;

CREATE CONSTRAINT TRIGGER trg_parcels_method_code_required
AFTER INSERT ON parcels
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW
EXECUTE FUNCTION enforce_parcel_method_code_on_commit();

-- (2) Mã biện pháp đã cấp là bất biến.
CREATE OR REPLACE FUNCTION protect_parcel_method_code()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.method_code IS NOT NULL AND NEW.method_code IS DISTINCT FROM OLD.method_code THEN
    RAISE EXCEPTION 'PARCEL_METHOD_CODE_IMMUTABLE: Mã biện pháp % của thửa % đã cấp, không được thay đổi hoặc xoá.',
      OLD.method_code, OLD.project_parcel_code
      USING ERRCODE = '23514';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_protect_parcel_method_code ON parcels;

CREATE TRIGGER trg_protect_parcel_method_code
BEFORE UPDATE OF method_code ON parcels
FOR EACH ROW
EXECUTE FUNCTION protect_parcel_method_code();

-- (3) Cấp mã biện pháp lần đầu (NULL -> giá trị) là "chỉ bổ sung": không làm đổi updated_at của thửa.
-- Mọi thay đổi khác vẫn cập nhật updated_at như update_timestamp_column() dùng chung.
CREATE OR REPLACE FUNCTION update_parcels_timestamp_column()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.method_code IS NULL
     AND NEW.method_code IS NOT NULL
     AND (to_jsonb(OLD) - 'method_code' - 'updated_at') = (to_jsonb(NEW) - 'method_code' - 'updated_at') THEN
    NEW.updated_at = OLD.updated_at;
    RETURN NEW;
  END IF;

  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_update_parcels_timestamp ON parcels;

CREATE TRIGGER trg_update_parcels_timestamp
BEFORE UPDATE ON parcels
FOR EACH ROW EXECUTE FUNCTION update_parcels_timestamp_column();
