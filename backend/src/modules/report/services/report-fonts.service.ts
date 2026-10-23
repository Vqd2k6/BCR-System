/**
 * ============================================================================
 * REPORT EMBEDDED FONTS SERVICE
 * Nhúng trực tiếp bộ font Times New Roman chuẩn tiếng Việt (UTF-8) dạng Base64
 * để đảm bảo Puppeteer / Chromium Headless trên mọi môi trường Linux/Docker
 * hiển thị chính xác 100% dấu tiếng Việt, độ đậm nhạt và số trang.
 * ============================================================================
 */

import * as fs from 'fs';
import * as path from 'path';

export class ReportFontsService {
  private static cachedFontCss: string | null = null;

  public static getFontCss(): string {
    if (this.cachedFontCss !== null) {
      return this.cachedFontCss;
    }

    try {
      const fontsDir = path.join(__dirname, '../assets/fonts');
      const loadBase64 = (fileName: string): string | null => {
        const filePath = path.join(fontsDir, fileName);
        if (fs.existsSync(filePath)) {
          return fs.readFileSync(filePath).toString('base64');
        }
        return null;
      };

      const regularB64 = loadBase64('TimesNewRoman-Regular.ttf');
      const boldB64 = loadBase64('TimesNewRoman-Bold.ttf');
      const italicB64 = loadBase64('TimesNewRoman-Italic.ttf');
      const boldItalicB64 = loadBase64('TimesNewRoman-BoldItalic.ttf');

      const rules: string[] = [];

      if (regularB64) {
        rules.push(`
@font-face {
  font-family: 'Times New Roman';
  src: url('data:font/truetype;charset=utf-8;base64,${regularB64}') format('truetype');
  font-weight: 400;
  font-style: normal;
  font-display: block;
}`);
      }

      if (boldB64) {
        rules.push(`
@font-face {
  font-family: 'Times New Roman';
  src: url('data:font/truetype;charset=utf-8;base64,${boldB64}') format('truetype');
  font-weight: 700;
  font-style: normal;
  font-display: block;
}`);
      }

      if (italicB64) {
        rules.push(`
@font-face {
  font-family: 'Times New Roman';
  src: url('data:font/truetype;charset=utf-8;base64,${italicB64}') format('truetype');
  font-weight: 400;
  font-style: italic;
  font-display: block;
}`);
      }

      if (boldItalicB64) {
        rules.push(`
@font-face {
  font-family: 'Times New Roman';
  src: url('data:font/truetype;charset=utf-8;base64,${boldItalicB64}') format('truetype');
  font-weight: 700;
  font-style: italic;
  font-display: block;
}`);
      }

      this.cachedFontCss = rules.join('\n');
      return this.cachedFontCss;
    } catch (err) {
      console.warn('⚠️ [ReportFontsService] Không thể nạp font nhúng Base64:', err);
      this.cachedFontCss = '';
      return '';
    }
  }
}

