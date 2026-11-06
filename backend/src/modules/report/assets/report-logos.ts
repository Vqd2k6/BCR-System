/**
 * ============================================================================
 * REPORT LOGOS LOADER
 * Nạp Logo chính thức dự án Metro Tuyến 2 (THACO - CREC) dạng Base64 PNG-32
 * Ưu tiên bản nền trong suốt (dùng cả làm watermark đè lên ảnh bìa),
 * dự phòng bản nền trắng logo-thaco-rec.png.
 * ============================================================================
 */

import * as fs from 'fs';
import * as path from 'path';

const LOGO_FILE_NAMES = ['thaco_rec_logo_transparent.png', 'logo-thaco-rec.png'];

function loadLogoBase64(): string {
  const candidates: string[] = [];
  for (const fileName of LOGO_FILE_NAMES) {
    candidates.push(
      path.resolve(__dirname, fileName),
      path.resolve(process.cwd(), 'src/modules/report/assets', fileName),
      path.resolve(process.cwd(), 'backend/src/modules/report/assets', fileName),
    );
  }

  for (const filePath of candidates) {
    if (!fs.existsSync(filePath)) continue;
    try {
      const buf = fs.readFileSync(filePath);
      return `data:image/png;base64,${buf.toString('base64')}`;
    } catch (err) {
      console.error(`[ReportLogos:load] Không đọc được file logo ${filePath}`, err);
    }
  }

  console.error('[ReportLogos:load] Không tìm thấy file logo THACO - CREC nào trong các đường dẫn:', candidates);
  return '';
}

export const LOGO_THACO_REC_BASE64 = loadLogoBase64();
