/**
 * ============================================================================
 * REPORT FONTS SERVICE
 * Quản lý & nhúng họ font Latin Modern Roman (OpenType TeX/LaTeX) base64 vào CSS
 * Đảm bảo 100% hiển thị độc lập, không tải qua Internet/CDN, đúng chuẩn văn bản công sở.
 * ============================================================================
 */

import * as fs from 'fs';
import * as path from 'path';

export class ReportFontsService {
  private static cachedFontCss: string | null = null;

  private static resolveFontPath(filename: string): string {
    const candidates = [
      path.join(__dirname, '../assets/fonts', filename),
      path.join(__dirname, '../../assets/fonts', filename),
      path.join(process.cwd(), 'src/modules/report_v2/assets/fonts', filename),
      path.join(process.cwd(), 'dist/modules/report_v2/assets/fonts', filename),
      path.join(process.cwd(), 'backend/src/modules/report_v2/assets/fonts', filename),
    ];

    for (const p of candidates) {
      if (fs.existsSync(p)) {
        return p;
      }
    }
    return '';
  }

  public static getFontCss(): string {
    if (this.cachedFontCss) {
      return this.cachedFontCss;
    }

    const regularPath = this.resolveFontPath('lmroman10-regular.otf');
    const boldPath = this.resolveFontPath('lmroman10-bold.otf');
    const italicPath = this.resolveFontPath('lmroman10-italic.otf');
    const boldItalicPath = this.resolveFontPath('lmroman10-bolditalic.otf');

    if (!regularPath || !boldPath || !italicPath || !boldItalicPath) {
      console.warn('[ReportFontsService] Thiếu file font Latin Modern Roman, fallback sang serif hệ thống.');
      this.cachedFontCss = `
        /* Fallback Latin Modern Roman */
        :root {
          --font-main: 'Latin Modern Roman', 'Computer Modern', 'Times New Roman', serif;
        }
      `;
      return this.cachedFontCss;
    }

    try {
      const regBase64 = fs.readFileSync(regularPath).toString('base64');
      const boldBase64 = fs.readFileSync(boldPath).toString('base64');
      const italicBase64 = fs.readFileSync(italicPath).toString('base64');
      const boldItalicBase64 = fs.readFileSync(boldItalicPath).toString('base64');

      this.cachedFontCss = `
@font-face {
  font-family: 'Latin Modern Roman';
  src: url('data:font/otf;base64,${regBase64}') format('opentype');
  font-weight: 400;
  font-style: normal;
  font-display: block;
}

@font-face {
  font-family: 'Latin Modern Roman';
  src: url('data:font/otf;base64,${boldBase64}') format('opentype');
  font-weight: 700;
  font-style: normal;
  font-display: block;
}

@font-face {
  font-family: 'Latin Modern Roman';
  src: url('data:font/otf;base64,${italicBase64}') format('opentype');
  font-weight: 400;
  font-style: italic;
  font-display: block;
}

@font-face {
  font-family: 'Latin Modern Roman';
  src: url('data:font/otf;base64,${boldItalicBase64}') format('opentype');
  font-weight: 700;
  font-style: italic;
  font-display: block;
}
`;
      return this.cachedFontCss;
    } catch (err) {
      console.error('[ReportFontsService] Không thể đọc hoặc nạp font base64:', err);
      this.cachedFontCss = `/* Fallback font error */`;
      return this.cachedFontCss;
    }
  }
}
