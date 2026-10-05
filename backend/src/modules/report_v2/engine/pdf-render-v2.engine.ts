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

  private static async getBrowser(): Promise<Browser> {
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

      const headerTitle = options?.headerTitle || 'LIÊN DANH CRLG–CRSRI–TT | METRO 2 (BẾN THÀNH - THAM LƯƠNG)';
      const buildingId = options?.buildingId || '';
      const reportNo = options?.reportNo || '';

      const headerTemplate = `
        <div style="font-family: Arial, sans-serif; font-size: 7.5pt; width: 100%; padding: 0 12mm; display: flex; justify-content: space-between; border-bottom: 0.5pt solid #94a3b8; color: #475569; padding-bottom: 1.5mm;">
          <span style="font-weight: bold; text-transform: uppercase;">${headerTitle}</span>
          <span style="font-weight: bold; color: #0f3b6c;">${buildingId} ${reportNo ? ' | ' + reportNo : ''}</span>
        </div>
      `;

      const footerTemplate = `
        <div style="font-family: Arial, sans-serif; font-size: 7.5pt; width: 100%; padding: 0 12mm; display: flex; justify-content: space-between; border-top: 0.5pt solid #cbd5e1; color: #64748b; padding-top: 1.5mm;">
          <span>BÁO CÁO KHẢO SÁT HIỆN TRẠNG (BCS) - PHASE 1 / PHASE 1 REPORT</span>
          <span>Trang <span class="pageNumber"></span> / <span class="totalPages"></span></span>
        </div>
      `;

      const pdfBuffer = await page.pdf({
        format: 'A4',
        printBackground: true,
        displayHeaderFooter: true,
        headerTemplate,
        footerTemplate,
        margin: {
          top: '18mm',
          bottom: '18mm',
          left: '12mm',
          right: '12mm',
        },
      });

      return Buffer.from(pdfBuffer);
    } finally {
      try {
        if (fs.existsSync(tempHtmlPath)) {
          fs.unlinkSync(tempHtmlPath);
        }
      } catch {
        // ignore unlink error
      }
      await page.close();
    }
  }
}
