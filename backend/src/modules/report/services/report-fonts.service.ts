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

  private static cachedSansFontCss: string | null = null;

  /** Tên family của font sans nhúng cho template v2 (tên riêng để thân bài chắc chắn dùng font nhúng, không lấy font hệ thống). */
  public static readonly SANS_FAMILY = "V2 Liberation Sans";

  /**
   * Font sans (Liberation Sans 2.1.5, giấy phép SIL OFL — xem assets/fonts/LiberationSans-LICENSE.txt) nhúng Base64 cho template nhà dân v2,
   * để PDF trên macOS và máy chủ Linux giống nhau. Không dùng cho v1 (v1 đóng băng).
   * Thiếu file font thì log lỗi và trả chuỗi rỗng: CSS v2 vẫn rơi về Liberation Sans / Arial của hệ thống.
   */
  public static getSansFontCss(): string {
    if (this.cachedSansFontCss !== null) return this.cachedSansFontCss;
    const fontsDir = path.join(__dirname, "../assets/fonts");
    const faces: Array<[string, number, string]> = [
      ["LiberationSans-Regular.ttf", 400, "normal"],
      ["LiberationSans-Bold.ttf", 700, "normal"],
      ["LiberationSans-Italic.ttf", 400, "italic"],
      ["LiberationSans-BoldItalic.ttf", 700, "italic"],
    ];
    try {
      const rules = faces.map(([file, weight, style]) => {
        const b64 = fs.readFileSync(path.join(fontsDir, file)).toString("base64");
        return `@font-face {
  font-family: "${this.SANS_FAMILY}";
  src: url("data:font/truetype;base64,${b64}") format("truetype");
  font-weight: ${weight};
  font-style: ${style};
  font-display: block;
}`;
      });
      this.cachedSansFontCss = rules.join("\n");
    } catch (err) {
      console.error("[ReportFontsService:getSansFontCss] Không nạp được font Liberation Sans nhúng:", err);
      this.cachedSansFontCss = "";
    }
    return this.cachedSansFontCss;
  }
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

