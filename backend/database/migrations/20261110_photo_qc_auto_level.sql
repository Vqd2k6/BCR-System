-- Migration: 20261110_photo_qc_auto_level.sql
-- Photo QC đợt 2:
--   1. Mức thu thập lại thêm 'AUTO' (đi theo gợi ý từ các cờ chụp lại) và làm mặc định.
--      Trước đây 'NONE' vừa là mặc định vừa được Excel hiểu là "theo gợi ý", nên quy 'NONE' cũ về 'AUTO'
--      giữ đúng hành vi đã có. Từ nay 'NONE' chọn tay nghĩa là "không chụp lại".
--   2. Ảnh khu vực chung (căn hộ unit_type = MASTER) luôn thuộc nhóm OUTDOOR (không cần xin chủ hộ).
-- Chạy lại nhiều lần an toàn.

ALTER TABLE photo_qc_reports DROP CONSTRAINT IF EXISTS chk_photo_qc_recapture_level;
ALTER TABLE photo_qc_reports
  ADD CONSTRAINT chk_photo_qc_recapture_level CHECK (recapture_level IN ('AUTO', 'NONE', 'OUTDOOR_ONLY', 'FULL'));
ALTER TABLE photo_qc_reports ALTER COLUMN recapture_level SET DEFAULT 'AUTO';

UPDATE photo_qc_reports SET recapture_level = 'AUTO', updated_at = NOW() WHERE recapture_level = 'NONE';

UPDATE photo_qc_photos qp
   SET photo_group = 'OUTDOOR', updated_at = NOW()
  FROM base_survey_reports r
  JOIN building_units bu ON bu.id = r.unit_id
 WHERE qp.report_id = r.id
   AND bu.unit_type = 'MASTER'
   AND qp.photo_group <> 'OUTDOOR';
