import fs from 'fs';
import path from 'path';
import puppeteer from 'puppeteer';

async function testScreenA4Screenshot() {
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
    // Giả lập màn hình Desktop chuẩn 1440x900
    await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 2 });
    await page.goto(`file://${htmlPath}`, { waitUntil: 'networkidle0' });

    const screenshotPath = '/Users/vqd2k6/.gemini/antigravity-ide/brain/e9fcce39-3111-4607-9a38-b82066dbf9d1/a4_screen_view_preview.png';
    await page.screenshot({ path: screenshotPath, fullPage: false });
    console.log(`✅ Đã chụp màn hình A4 Screen Simulation tại: ${screenshotPath}`);
  } finally {
    await browser.close();
  }
}

testScreenA4Screenshot().catch(console.error);
