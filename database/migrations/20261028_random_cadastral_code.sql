-- ============================================================================
-- 20261028 – CẤP "MÃ ĐC" NGẪU NHIÊN R####### CHO THỬA PHÁT SINH DO TÁCH / GỘP THỬA
--
-- 1. Partial unique index: mã dạng R + 7 chữ số là duy nhất (không ràng buộc mã địa chính nhà nước).
-- 2. Cấp mã R####### cho các thửa đang thiếu official_cadastral_code (NULL / rỗng).
-- Migration lũy kế an toàn: chạy lại nhiều lần không lỗi, không đụng thửa đã có mã.
-- ============================================================================

CREATE UNIQUE INDEX IF NOT EXISTS uq_parcels_random_cadastral_code
  ON parcels (official_cadastral_code)
  WHERE official_cadastral_code ~ '^R[0-9]{7}$';

DO $$
DECLARE
  r RECORD;
  v_code TEXT;
BEGIN
  FOR r IN
    SELECT id FROM parcels
     WHERE official_cadastral_code IS NULL OR BTRIM(official_cadastral_code) = ''
  LOOP
    LOOP
      v_code := 'R' || LPAD((floor(random() * 10000000))::int::text, 7, '0');
      EXIT WHEN NOT EXISTS (SELECT 1 FROM parcels WHERE official_cadastral_code = v_code);
    END LOOP;
    UPDATE parcels SET official_cadastral_code = v_code, updated_at = NOW() WHERE id = r.id;
  END LOOP;
END $$;
