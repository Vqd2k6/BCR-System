/**
 * ============================================================================
 * PDF RENDER ENGINE V2 (PUPPETEER POOL SINGLETON)
 * Tối ưu hóa in ấn PDF A4 chuẩn 300 DPI, chống zombie process, chống timeout
 * Khung header & footer song ngữ pháp lý CRLG - CRSRI - TT
 * ============================================================================
 */

import puppeteer, { Browser } from 'puppeteer-core';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { v4 as uuidv4 } from 'uuid';

export interface PdfRenderOptions {
  buildingId?: string;
  reportNo?: string;
  headerTitle?: string;
  footerTitle?: string;
}

/** Escape ký tự HTML để an toàn khi chèn vào header/footer template của Chromium */
export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export class PdfRenderV2Engine {
  private static browserInstance: Browser | null = null;
  private static isLaunching = false;

  private static getChromeExecutablePath(): string {
    const envPath = process.env.PUPPETEER_EXECUTABLE_PATH;
    if (envPath && fs.existsSync(envPath)) return envPath;

    const candidatePaths = [
      '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
      '/Applications/Chromium.app/Contents/MacOS/Chromium',
      '/usr/bin/google-chrome',
      '/usr/bin/google-chrome-stable',
      '/usr/bin/chromium',
      '/usr/bin/chromium-browser',
      'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
      'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    ];

    for (const p of candidatePaths) {
      if (fs.existsSync(p)) {
        return p;
      }
    }

    throw new Error(
      'Không tìm thấy Google Chrome hoặc Chromium trên máy chủ để render PDF. Vui lòng cài đặt Chrome hoặc gán biến PUPPETEER_EXECUTABLE_PATH.'
    );
  }

  public static async getBrowser(): Promise<Browser> {
    if (this.browserInstance && this.browserInstance.isConnected()) {
      return this.browserInstance;
    }

    while (this.isLaunching) {
      await new Promise(r => setTimeout(r, 100));
      if (this.browserInstance && this.browserInstance.isConnected()) {
        return this.browserInstance;
      }
    }

    this.isLaunching = true;
    try {
      const executablePath = this.getChromeExecutablePath();
      this.browserInstance = await puppeteer.launch({
        executablePath,
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-gpu',
          '--font-render-hinting=medium',
        ],
      });
      return this.browserInstance;
    } finally {
      this.isLaunching = false;
    }
  }

  public static async renderHtmlToPdf(
    htmlContent: string,
    options?: PdfRenderOptions
  ): Promise<Buffer> {
    const browser = await this.getBrowser();
    const page = await browser.newPage();
    const tempHtmlPath = path.join(os.tmpdir(), `metro2_report_v2_${uuidv4()}.html`);

    try {
      // 1. Ghi HTML ra file tạm để Chromium nạp trực tiếp
      fs.writeFileSync(tempHtmlPath, htmlContent, 'utf8');

      // 2. Set viewport A4
      await page.setViewport({ width: 1240, height: 1754, deviceScaleFactor: 2 });

      // 3. Nạp file qua URL file://
      await page.goto(`file://${tempHtmlPath}`, {
        waitUntil: 'domcontentloaded',
        timeout: 60000,
      });

      // Chờ script dựng khung ảnh (photo-stage), xoay Z/E/D, đánh số trang xong trước khi in
      try {
        await page.waitForFunction('window.__reportReady === true', { timeout: 60000 });
      } catch (err) {
        // Không chặn xuất PDF nhưng phải ghi log để biết layout có thể chưa hoàn tất
        console.error('[PdfRenderV2Engine] __reportReady không phản hồi kịp, PDF có thể chưa hoàn chỉnh layout:', err);
      }

      const headerTitle = escapeHtml(options?.headerTitle || 'LIÊN DANH CRLG–CRSRI–TT | METRO 2 (BẾN THÀNH - THAM LƯƠNG)');
      const buildingId = escapeHtml(options?.buildingId || '');
      const reportNo = escapeHtml(options?.reportNo || '');

      const headerTemplate = `
        <div style="font-family: 'Latin Modern Roman', 'Computer Modern', 'Times New Roman', serif; font-size: 10pt; width: 100%; padding: 0 15mm; display: flex; justify-content: space-between; border-bottom: 0.5pt solid #000000; color: #000000; padding-bottom: 1.5mm;">
          <span style="font-weight: bold; text-transform: uppercase;">${headerTitle}</span>
          <span style="font-weight: bold; color: #000000;">${buildingId} ${reportNo ? ' | ' + reportNo : ''}</span>
        </div>
      `;

      const footerTemplate = `
        <div style="font-family: 'Latin Modern Roman', 'Computer Modern', 'Times New Roman', serif; font-size: 10pt; width: 100%; padding: 0 15mm; display: flex; justify-content: space-between; border-top: 0.5pt solid #000000; color: #000000; padding-top: 1.5mm;">
          <span>${reportNo || buildingId}</span>
          <span style="font-weight: 600; color: #000000;">Trang <span class="pageNumber"></span> / <span class="totalPages"></span></span>
        </div>
      `;

      const pdfOptions = {
        format: 'A4' as const,
        printBackground: true,
        displayHeaderFooter: true,
        headerTemplate,
        footerTemplate,
        margin: {
          top: '18mm',
          bottom: '18mm',
          left: '15mm',
          right: '15mm',
        },
      };

      // Pass 1: in thử để đo số trang THẬT (một .a4-page-sheet có thể tràn nhiều trang in)
      let pdfBuffer = await page.pdf(pdfOptions);
      try {
        const applied = await this.applyRealPageNumbers(page, Buffer.from(pdfBuffer));
        if (applied) {
          // Pass 2: in lại với Mục lục và tổng số trang chính xác
          pdfBuffer = await page.pdf(pdfOptions);
        }
      } catch (err) {
        console.error('[PdfRenderV2Engine] Không dò được số trang thực, giữ Mục lục ước lượng:', err);
      }

      return Buffer.from(pdfBuffer);
    } finally {
      try {
        if (fs.existsSync(tempHtmlPath)) {
          fs.unlinkSync(tempHtmlPath);
        }
      } catch (err) {
        console.error('[PdfRenderV2Engine] Không xóa được file HTML tạm:', tempHtmlPath, err);
      }
      await page.close();
    }
  }

  /** Trích văn bản từng trang PDF bằng pdfjs-dist (bản legacy cho Node). */
  private static async extractPageTexts(pdf: Buffer): Promise<string[]> {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const pdfjs = require('pdfjs-dist/legacy/build/pdf.js');
    const doc = await pdfjs.getDocument({
      data: new Uint8Array(pdf),
      useSystemFonts: true,
      disableFontFace: true,
      verbosity: 0,
    }).promise;
    const texts: string[] = [];
    for (let i = 1; i <= doc.numPages; i++) {
      const pg = await doc.getPage(i);
      const content = await pg.getTextContent();
      texts.push(
        content.items
          .map((it: any) => it.str)
          .join(' ')
          .replace(/\s+/g, ' ')
          .normalize('NFC')
      );
    }
    await doc.destroy();
    return texts;
  }

  /** Ghi số trang thật vào Mục lục và tổng số trang; trả về true nếu đã cập nhật. */
  private static async applyRealPageNumbers(page: any, pdf: Buffer): Promise<boolean> {
    const headings: { key: string; text: string }[] = await page.evaluate(
      'window.__sectionHeadings || []'
    );
    if (!headings.length) return false;

    const pages = await this.extractPageTexts(pdf);
    // pdfjs tách ký tự tiếng Việt thành nhiều mảnh có khoảng trắng ("TH Ô NG"): so khớp theo chuỗi đã bỏ khoảng trắng + dấu
    const norm = (s: string) =>
      s
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/đ/gi, 'd')
        .replace(/[^a-zA-Z0-9]/g, '')
        .toLowerCase();
    const pageTexts = pages.map(norm);

    // Bỏ qua các trang chứa Mục lục (chính nó cũng liệt kê tiêu đề các chương)
    let tocLast = -1;
    pageTexts.forEach((t, i) => {
      if (t.includes('tableofcontents')) tocLast = i;
    });

    const map: Record<string, number> = {};
    let cursor = tocLast + 1;
    for (const h of headings) {
      const needle = norm(h.text).slice(0, 28);
      let found = -1;
      for (let i = cursor; i < pageTexts.length; i++) {
        if (pageTexts[i].includes(needle)) {
          found = i;
          break;
        }
      }
      if (found >= 0) {
        map[h.key] = found + 1;
        cursor = found;
      }
    }

    const total = pages.length;
    await page.evaluate(
      (m: Record<string, number>, t: number) => {
        document.querySelectorAll('[data-toc-target]').forEach((el) => {
          const k = el.getAttribute('data-toc-target');
          if (k && m[k]) el.textContent = String(m[k]);
        });
        const totalEl = document.getElementById('report-total-pages');
        if (totalEl) totalEl.textContent = String(t);
      },
      map,
      total
    );
    return Object.keys(map).length > 0;
  }
}
