import puppeteer, { Browser } from 'puppeteer-core';
import * as fs from 'fs';

export class PdfRenderEngine {
  private static browserInstance: Browser | null = null;

  /**
   * Tìm đường dẫn khả dụng của Google Chrome trên hệ điều hành
   */
  private static getChromeExecutablePath(): string {
    const envPath = process.env.PUPPETEER_EXECUTABLE_PATH;
    if (envPath && fs.existsSync(envPath)) return envPath;

    // Các vị trí mặc định phổ biến
    const candidatePaths = [
      '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', // macOS
      '/Applications/Chromium.app/Contents/MacOS/Chromium',          // macOS Chromium
      '/usr/bin/google-chrome',                                      // Linux
      '/usr/bin/google-chrome-stable',                               // Linux
      '/usr/bin/chromium',                                           // Linux Chromium
      '/usr/bin/chromium-browser',                                   // Linux Chromium
      'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',  // Windows
      'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
    ];

    for (const p of candidatePaths) {
      if (fs.existsSync(p)) {
        return p;
      }
    }

    throw new Error(
      'Không tìm thấy Google Chrome hoặc Chromium trên máy chủ để render PDF. Vui lòng cài đặt Chrome hoặc gán biến môi trường PUPPETEER_EXECUTABLE_PATH.'
    );
  }

  /**
   * Khởi tạo hoặc tái sử dụng Browser Singleton
   */
  private static async getBrowser(): Promise<Browser> {
    if (!this.browserInstance || !this.browserInstance.isConnected()) {
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
    }
    return this.browserInstance;
  }

  /**
   * Render HTML string thành file PDF Buffer chuẩn A4
   */
  static async renderHtmlToPdf(
    htmlContent: string,
    options?: {
      buildingId?: string;
      reportCode?: string;
      headerTitle?: string;
      footerNote?: string;
    }
  ): Promise<Buffer> {
    const browser = await this.getBrowser();
    const page = await browser.newPage();

    try {
      // Đặt kích thước viewport mô phỏng trang A4 300 DPI
      await page.setViewport({ width: 1240, height: 1754, deviceScaleFactor: 2 });

      // Nạp HTML và đợi render xong domcontentloaded + networkidle0
      await page.setContent(htmlContent, {
        waitUntil: ['domcontentloaded', 'networkidle0'],
        timeout: 60000,
      });

      const headerTitle = options?.headerTitle || 'LIÊN DANH CRLG–CRSRI–TT | DỰ ÁN METRO 2 (BẾN THÀNH – THAM LƯƠNG)';
      const buildingCode = options?.buildingId ? `Mã: ${options.buildingId}` : '';
      const docCode = options?.reportCode ? `Số: ${options.reportCode}` : '';

      // Header template pháp lý theo chuẩn tài liệu xây dựng
      const headerTemplate = `
        <div style="font-family: 'Times New Roman', Times, serif; font-size: 8pt; width: 100%; padding: 0 15mm; display: flex; justify-content: space-between; border-bottom: 0.5pt solid #94a3b8; color: #475569; padding-bottom: 2mm;">
          <span style="font-weight: bold; text-transform: uppercase;">${headerTitle}</span>
          <span>${buildingCode} ${docCode ? ' | ' + docCode : ''}</span>
        </div>
      `;

      // Footer template với số trang động Trang X / Y
      const footerTemplate = `
        <div style="font-family: 'Times New Roman', Times, serif; font-size: 8pt; width: 100%; padding: 0 15mm; display: flex; justify-content: space-between; border-top: 0.5pt solid #cbd5e1; color: #64748b; padding-top: 2mm;">
          <span>BÁO CÁO KHẢO SÁT HIỆN TRẠNG CÔNG TRÌNH - PHASE 1 (BCS)</span>
          <span>Trang <span class="pageNumber"></span> / <span class="totalPages"></span></span>
        </div>
      `;

      // Xuất PDF A4 có căn lề bảo đảm in ấn và đóng tập
      const pdfBuffer = await page.pdf({
        format: 'A4',
        printBackground: true,
        displayHeaderFooter: true,
        headerTemplate,
        footerTemplate,
        margin: {
          top: '20mm',
          bottom: '20mm',
          left: '18mm',
          right: '15mm',
        },
      });

      return Buffer.from(pdfBuffer);
    } finally {
      await page.close();
    }
  }
}
