/**
 * ============================================================================
 * PDF RENDER ENGINE (PUPPETEER-CORE SINGLETON POOL - A4 300 DPI)
 * Quản lý kết xuất PDF chất lượng in ấn cao cấp (printBackground: true)
 * ============================================================================
 */

import * as fs from 'fs';
import puppeteer, { Browser, Page } from 'puppeteer-core';

declare global {
  interface Window {
    /** Đặt bởi templates/residential/partials/report-scripts.hbs sau khi dựng khung ảnh và đánh số trang. */
    __reportReady?: boolean;
  }
}

/**
 * Ảnh pháp lý nhúng nguyên chất lượng → HTML lớn; cho phép render lâu thay vì giảm chất lượng ảnh.
 * Ngân sách: chờ hàng đợi 60s (render-queue) + nạp HTML 150s + chờ script 10s + in PDF 75s = 295s,
 * phải dưới mốc 300s của client (services/api.ts) và server (server.ts).
 */
function readTimeoutMs(envName: string, fallbackMs: number): number {
  const parsed = Number(process.env[envName]);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallbackMs;
}
const RENDER_TIMEOUT_MS = readTimeoutMs('REPORT_PDF_RENDER_TIMEOUT_MS', 150000);
const PRINT_TIMEOUT_MS = readTimeoutMs('REPORT_PDF_PRINT_TIMEOUT_MS', 75000);
const READY_TIMEOUT_MS = readTimeoutMs('REPORT_PDF_READY_TIMEOUT_MS', 10000);

export interface PdfRenderOptions {
  buildingId: string;
  reportNo: string;
  headerTitle?: string;
  /** HTML đã nhúng sẵn mọi ảnh: networkidle không hoàn tất với data URI lớn nên chỉ chờ sự kiện load. */
  selfContainedHtml?: boolean;
  /** Template có script đặt window.__reportReady (report Phase 1): chờ cờ này trước khi in. */
  waitForReportReady?: boolean;
}

function resolveChromeExecutablePath(): string | undefined {
  if (process.env.PUPPETEER_EXECUTABLE_PATH && fs.existsSync(process.env.PUPPETEER_EXECUTABLE_PATH)) {
    return process.env.PUPPETEER_EXECUTABLE_PATH;
  }
  const candidates = [
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
    '/usr/bin/google-chrome-stable',
    '/usr/bin/google-chrome',
    '/usr/bin/chromium-browser',
    '/usr/bin/chromium',
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  return undefined;
}

export class PdfRenderEngine {
  private static browserInstance: Browser | null = null;
  private static isInitializing = false;

  public static async getBrowser(): Promise<Browser> {
    if (this.browserInstance && this.browserInstance.connected) {
      return this.browserInstance;
    }

    if (this.isInitializing) {
      while (this.isInitializing) {
        await new Promise((r) => setTimeout(r, 150));
      }
      if (this.browserInstance && this.browserInstance.connected) {
        return this.browserInstance;
      }
    }

    this.isInitializing = true;
    try {
      this.browserInstance = await puppeteer.launch({
        headless: true,
        executablePath: resolveChromeExecutablePath(),
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-gpu',
          '--font-render-hinting=none',
        ],
      });

      this.browserInstance.on('disconnected', () => {
        this.browserInstance = null;
      });

      return this.browserInstance;
    } finally {
      this.isInitializing = false;
    }
  }

  public static async renderHtmlToPdf(html: string, options: PdfRenderOptions): Promise<Buffer> {
    const startedAt = Date.now();
    const htmlBytes = Buffer.byteLength(html, 'utf8');
    let page: Page | null = null;

    try {
      const browser = await this.getBrowser();
      page = await browser.newPage();
      page.on('pageerror', (pageErr: unknown) => {
        console.error(`[PdfRenderEngine:pageerror] reportNo=${options.reportNo}`, pageErr);
      });

      await page.setViewport({
        width: 1240,
        height: 1754,
        deviceScaleFactor: 2,
      });

      await page.setContent(html, {
        waitUntil: options.selfContainedHtml ? ['domcontentloaded', 'load'] : ['domcontentloaded', 'networkidle2'],
        timeout: RENDER_TIMEOUT_MS,
      });

      await page.evaluate(async () => {
        if (document.fonts && document.fonts.ready) {
          await document.fonts.ready;
        }
      });

      // Script trong template dựng khung ảnh và đánh số trang; in trước khi xong thì số trang/khung ảnh lệch preview.
      if (options.waitForReportReady) {
        try {
          await page.waitForFunction(() => window.__reportReady === true, { timeout: READY_TIMEOUT_MS });
        } catch (readyErr: unknown) {
          console.error(
            `[PdfRenderEngine:ready] reportNo=${options.reportNo}: __reportReady chưa bật sau ${READY_TIMEOUT_MS}ms, in với trạng thái hiện tại`,
            readyErr
          );
        }
      }

      const pdfUint8Array = await page.pdf({
        timeout: PRINT_TIMEOUT_MS,
        format: 'A4',
        printBackground: true,
        preferCSSPageSize: true,
        displayHeaderFooter: false,
        margin: {
          top: '0mm',
          right: '0mm',
          bottom: '0mm',
          left: '0mm',
        },
      });

      return Buffer.from(pdfUint8Array);
    } catch (err: unknown) {
      console.error(
        `[PdfRenderEngine:render] reportNo=${options.reportNo} buildingId=${options.buildingId} html=${htmlBytes} bytes, lỗi sau ${Date.now() - startedAt}ms`,
        err
      );
      throw err;
    } finally {
      if (page) {
        try {
          await page.close();
        } catch (closeErr: unknown) {
          console.error('[PdfRenderEngine:close] Không đóng được trang Chromium:', closeErr);
        }
      }
    }
  }

  public static async closeBrowser(): Promise<void> {
    if (this.browserInstance) {
      await this.browserInstance.close();
      this.browserInstance = null;
    }
  }
}
