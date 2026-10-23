/**
 * ============================================================================
 * REPORT LOGOS LOADER
 * Nạp Logo chính thức dự án Metro Tuyến 2 (THACO - CREC) dạng Base64 PNG-32
 * ============================================================================
 */

import * as fs from 'fs';
import * as path from 'path';

function loadLogoBase64(): string {
  const candidates = [
    path.resolve(__dirname, 'thaco_rec_logo_transparent.png'),
    path.resolve(process.cwd(), 'src/modules/report/assets/thaco_rec_logo_transparent.png'),
    path.resolve(process.cwd(), 'backend/src/modules/report/assets/thaco_rec_logo_transparent.png'),
  ];

  for (const filePath of candidates) {
    if (fs.existsSync(filePath)) {
      try {
        const buf = fs.readFileSync(filePath);
        return `data:image/png;base64,${buf.toString('base64')}`;
      } catch {
        // continue
      }
    }
  }
  return '';
}

export const LOGO_THACO_REC_BASE64 = loadLogoBase64();

