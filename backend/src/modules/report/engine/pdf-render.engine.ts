/**
 * ============================================================================
 * PDF RENDER ENGINE (PUPPETEER-CORE SINGLETON POOL - A4 300 DPI)
 * Quản lý kết xuất PDF chất lượng in ấn cao cấp (printBackground: true)
 * ============================================================================
 */

import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { randomUUID } from 'crypto';
import { pathToFileURL } from 'url';
import puppeteer, { Browser, Page, PDFOptions } from 'puppeteer-core';
import { locateSectionPages, type SectionHeading } from './pdf-page-analysis';

declare global {
  interface Window {
    /** Đặt bởi templates/residential/partials/report-scripts.hbs sau khi dựng khung ảnh và đánh số trang. */
    __reportReady?: boolean;
    /** Danh sách tiêu đề chương theo thứ tự tài liệu (cùng script): dùng dò trang thật cho Mục lục. */
    __sectionHeadings?: SectionHeading[];
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
  /**
   * Đầu trang (tiêu đề + mã công trình) và chân trang (mã + Trang i / N) bằng hộp lề trang của CSS
   * (@top-left, @bottom-right, counter(page)/counter(pages), cần Chrome ≥ 131). Bìa không có nhờ @page :first.
   */
  headerFooter?: boolean;
  /** Đối chiếu số trang trong Mục lục với trang thật của tiêu đề, lệch thì sửa rồi in lại (không nạp lại HTML). */
  tocTwoPass?: boolean;
}

const RENDER_TMP_DIR = path.join(os.tmpdir(), 'metro2-report-render');
const RENDER_TMP_MAX_AGE_MS = 60 * 60 * 1000;
let tmpSwept = false;

/** Xoá file HTML tạm bỏ sót (máy chủ dừng giữa chừng). Chạy một lần mỗi tiến trình. */
async function sweepRenderTmpDir(): Promise<void> {
  if (tmpSwept) return;
  tmpSwept = true;
  try {
    const now = Date.now();
    for (const name of await fs.promises.readdir(RENDER_TMP_DIR)) {
      const full = path.join(RENDER_TMP_DIR, name);
      const stat = await fs.promises.stat(full);
      if (now - stat.mtimeMs > RENDER_TMP_MAX_AGE_MS) await fs.promises.unlink(full);
    }
  } catch (err: unknown) {
    if ((err as NodeJS.ErrnoException)?.code !== 'ENOENT') {
      console.error('[PdfRenderEngine:sweep] Không dọn được thư mục HTML tạm:', err);
    }
  }
}

/** Chrome bắt đầu hỗ trợ hộp lề trang (@page { @top-left {...} }) và counter(pages) từ bản 131. */
const MIN_CHROME_FOR_MARGIN_BOXES = 131;
let marginBoxVersionChecked = false;

/** Chuỗi CSS an toàn: thoát \, ", xuống dòng. */
function cssString(value: string): string {
  return `"${String(value ?? '').replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\r?\n/g, ' ')}"`;
}

/**
 * CSS đầu/chân trang chạy cho mọi trang trừ trang đầu (bìa). Cùng nội dung thanh đầu trang của preview:
 * trái = tên liên danh/tuyến, phải = mã công trình | số báo cáo; chân trang: mã + Trang i / N thật.
 */
function buildRunningHeaderFooterCss(title: string, code: string): string {
  const base = "font: 8px 'Times New Roman', Times, serif; color: #333333;";
  const header = `${base} vertical-align: bottom; padding-bottom: 2mm; border-bottom: 0.5px solid #000000;`;
  const footer = `${base} vertical-align: top; padding-top: 2mm; border-top: 0.5px solid #000000;`;
  return `<style id="running-header-footer">
@page {
  @top-left { content: ${cssString(title)}; ${header} width: 64%; text-transform: uppercase; }
  @top-right { content: ${cssString(code)}; ${header} width: 36%; text-align: right; }
  @bottom-left { content: ${cssString(code)}; ${footer} width: 64%; }
  @bottom-right { content: "Trang " counter(page) " / " counter(pages); ${footer} width: 36%; text-align: right; }
}
@page :first {
  @top-left { content: none; border: none; }
  @top-right { content: none; border: none; }
  @bottom-left { content: none; border: none; }
  @bottom-right { content: none; border: none; }
}
</style>`;
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
    let tmpFile: string | null = null;

    try {
      // Nạp HTML từ file tạm: page.setContent đẩy cả chuỗi qua CDP, HTML 100+ MB (ảnh nhúng nguyên chất lượng)
      // làm Chrome chết ("Target closed"). Nạp từ file chỉ tốn vài giây.
      await sweepRenderTmpDir();
      await fs.promises.mkdir(RENDER_TMP_DIR, { recursive: true, mode: 0o700 });
      tmpFile = path.join(RENDER_TMP_DIR, `${randomUUID()}.html`);
      const code = `${options.buildingId} | ${options.reportNo}`;
      // Chèn CSS đầu/chân trang trước </head>; ghi ba đoạn liên tiếp để không nhân đôi chuỗi HTML hàng trăm MB.
      const headEnd = options.headerFooter ? html.indexOf('</head>') : -1;
      const injected = options.headerFooter ? buildRunningHeaderFooterCss(options.headerTitle || '', code) : '';
      const fileHandle = await fs.promises.open(tmpFile, 'w', 0o600);
      try {
        if (headEnd >= 0) {
          await fileHandle.writeFile(html.slice(0, headEnd), 'utf8');
          await fileHandle.writeFile(injected, 'utf8');
          await fileHandle.writeFile(html.slice(headEnd), 'utf8');
        } else {
          await fileHandle.writeFile(injected + html, 'utf8');
        }
      } finally {
        await fileHandle.close();
      }

      const browser = await this.getBrowser();
      if (options.headerFooter && !marginBoxVersionChecked) {
        marginBoxVersionChecked = true;
        const major = Number((await browser.version()).match(/(\d+)\./)?.[1] ?? 0);
        if (major < MIN_CHROME_FOR_MARGIN_BOXES) {
          console.error(`[PdfRenderEngine:chrome] Chrome ${major} < ${MIN_CHROME_FOR_MARGIN_BOXES}: không hỗ trợ hộp lề trang, PDF sẽ không có đầu/chân trang và số trang`);
        }
      }
      page = await browser.newPage();
      page.on('pageerror', (pageErr: unknown) => {
        console.error(`[PdfRenderEngine:pageerror] reportNo=${options.reportNo}`, pageErr);
      });

      await page.setViewport({
        width: 1240,
        height: 1754,
        deviceScaleFactor: 2,
      });

      await page.goto(pathToFileURL(tmpFile).href, {
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

      const pdfOptions: PDFOptions = {
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
      };

      const firstPass = Buffer.from(await page.pdf(pdfOptions));
      if (!options.tocTwoPass) return firstPass;
      return await this.reconcileToc(page, firstPass, pdfOptions, options);
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
      if (tmpFile) {
        try {
          await fs.promises.unlink(tmpFile);
        } catch (unlinkErr: unknown) {
          console.error('[PdfRenderEngine:cleanup] Không xoá được file HTML tạm:', tmpFile, unlinkErr);
        }
      }
    }
  }

  /**
   * Mục lục lấy số trang theo chỉ số khung giấy trong DOM nên lệch khi mục chảy qua nhiều trang.
   * Dò trang thật của từng tiêu đề trong PDF lượt 1; lệch thì ghi số thật vào Mục lục rồi in lại trên cùng trang đã nạp.
   */
  private static async reconcileToc(
    page: Page,
    firstPass: Buffer,
    pdfOptions: PDFOptions,
    options: PdfRenderOptions
  ): Promise<Buffer> {
    const info = await page.evaluate(() => ({
      headings: window.__sectionHeadings ?? [],
      printed: Array.from(document.querySelectorAll('[data-toc-target]')).map((el) => ({
        key: el.getAttribute('data-toc-target') ?? '',
        value: (el.textContent ?? '').trim(),
      })),
      printedTotal: (document.getElementById('report-total-pages')?.textContent ?? '').trim(),
    }));
    if (info.headings.length === 0 || info.printed.length === 0) return firstPass;

    const real = await locateSectionPages(firstPass, info.headings);
    const wrong = info.printed.filter((p) => real.pages[p.key] !== undefined && String(real.pages[p.key]) !== p.value);
    const totalWrong = info.printedTotal !== '' && info.printedTotal !== String(real.totalPages);
    if (wrong.length === 0 && !totalWrong) return firstPass;

    console.info(
      `[PdfRenderEngine:toc] reportNo=${options.reportNo}: ${wrong.length} mục trong Mục lục lệch trang thật${totalWrong ? `, tổng trang ${info.printedTotal} → ${real.totalPages}` : ''}, in lại`,
      wrong.map((w) => `${w.key}: ${w.value} → ${real.pages[w.key]}`)
    );
    await page.evaluate(
      (fix: { pages: Record<string, number>; totalPages: number }) => {
        document.querySelectorAll('[data-toc-target]').forEach((el) => {
          const key = el.getAttribute('data-toc-target');
          if (key && fix.pages[key] !== undefined) el.textContent = String(fix.pages[key]);
        });
        const totalEl = document.getElementById('report-total-pages');
        if (totalEl) totalEl.textContent = String(fix.totalPages);
      },
      real
    );

    const secondPass = Buffer.from(await page.pdf(pdfOptions));
    const verify = await locateSectionPages(secondPass, info.headings);
    const stillWrong = Object.keys(real.pages).filter((k) => verify.pages[k] !== real.pages[k]);
    if (verify.totalPages !== real.totalPages) stillWrong.push('totalPages');
    if (stillWrong.length > 0) {
      console.error(`[PdfRenderEngine:toc] reportNo=${options.reportNo}: sau khi in lại vẫn lệch ở`, stillWrong);
    }
    return secondPass;
  }

  public static async closeBrowser(): Promise<void> {
    if (this.browserInstance) {
      await this.browserInstance.close();
      this.browserInstance = null;
    }
  }
}
