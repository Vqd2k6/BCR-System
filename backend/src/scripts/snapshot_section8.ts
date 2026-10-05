import fs from 'fs';
import path from 'path';
import puppeteer from 'puppeteer';

async function snapshotSection8() {
  const htmlPath = path.join(__dirname, '../modules/report_v2/templates/residential/preview_output.html');
  if (!fs.existsSync(htmlPath)) {
    console.error('Không tìm thấy file preview_output.html');
    process.exit(1);
  }

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1200, height: 1600, deviceScaleFactor: 2 });
    await page.goto(`file://${htmlPath}`, { waitUntil: 'networkidle0' });

    // Tìm Sheet trang 7
    const page7Handle = await page.evaluate(() => {
      const sheets = document.querySelectorAll('.a4-page-sheet');
      if (sheets.length >= 7) {
        const p7 = sheets[6] as HTMLElement;
        const rect = p7.getBoundingClientRect();
        return {
          x: Math.max(0, rect.left),
          y: Math.max(0, rect.top),
          width: rect.width,
          height: rect.height,
        };
      }
      return null;
    });

    const page7ScreenshotPath = '/Users/vqd2k6/.gemini/antigravity-ide/brain/e9fcce39-3111-4607-9a38-b82066dbf9d1/page7_full_clean.png';

    if (page7Handle) {
      await page.screenshot({
        path: page7ScreenshotPath,
        clip: page7Handle,
      });
      console.log(`✅ Đã chụp screenshot toàn bộ Trang 7 tại: ${page7ScreenshotPath}`);
    }

    // Chụp cận cảnh Bảng VIII.3 và Khung kết luận
    const rect = await page.evaluate(() => {
      const table = document.querySelector('table.bra-matrix-table');
      const title = table?.previousElementSibling as HTMLElement;
      const card = document.querySelector('.bra-summary-card') as HTMLElement;
      if (!title || !card) return null;
      const r1 = title.getBoundingClientRect();
      const r2 = card.getBoundingClientRect();
      return {
        x: Math.max(0, r1.left - 10),
        y: Math.max(0, r1.top - 8),
        width: Math.max(r1.width, r2.width) + 20,
        height: (r2.bottom - r1.top) + 16,
      };
    });

    const closeupScreenshotPath = '/Users/vqd2k6/.gemini/antigravity-ide/brain/e9fcce39-3111-4607-9a38-b82066dbf9d1/section8_bra_matrix_closeup.png';
    if (rect) {
      await page.screenshot({
        path: closeupScreenshotPath,
        clip: rect,
      });
      console.log(`✅ Đã chụp cận cảnh Bảng VIII.3 và Khung kết luận tại: ${closeupScreenshotPath}`);
    }
  } finally {
    await browser.close();
  }
}

snapshotSection8().catch(console.error);
