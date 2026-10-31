/**
 * ============================================================================
 * PDF RENDER ENGINE (PUPPETEER-CORE SINGLETON POOL - A4 300 DPI)
 * Quản lý kết xuất PDF chất lượng in ấn cao cấp (printBackground: true)
 * ============================================================================
 */

import * as fs from 'fs';
import puppeteer, { Browser } from 'puppeteer-core';

export interface PdfRenderOptions {
  buildingId: string;
  reportNo: string;
  headerTitle?: string;
  /** HTML đã nhúng sẵn mọi ảnh: networkidle không hoàn tất với data URI lớn nên chỉ chờ sự kiện load. */
  selfContainedHtml?: boolean;
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
    const browser = await this.getBrowser();
    const page = await browser.newPage();

    try {
      await page.setViewport({
        width: 1240,
        height: 1754,
        deviceScaleFactor: 2,
      });

      await page.setContent(html, {
        waitUntil: options.selfContainedHtml ? ['domcontentloaded', 'load'] : ['domcontentloaded', 'networkidle2'],
        timeout: 45000,
      });

      await page.evaluate(async () => {
        if ((document as any).fonts && (document as any).fonts.ready) {
          await (document as any).fonts.ready;
        }
      });

      const pdfUint8Array = await page.pdf({
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
    } finally {
      await page.close();
    }
  }

  public static async closeBrowser(): Promise<void> {
    if (this.browserInstance) {
      await this.browserInstance.close();
      this.browserInstance = null;
    }
  }
}
