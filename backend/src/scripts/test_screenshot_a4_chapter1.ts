import fs from 'fs';
import path from 'path';
import puppeteer from 'puppeteer';

async function testScreenA4Chapter1Screenshot() {
  const htmlPath = path.join(__dirname, '../modules/report_v2/templates/residential/preview_output.html');
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1440, height: 900, deviceScaleFactor: 2 });
    await page.goto(`file://${htmlPath}`, { waitUntil: 'networkidle0' });

    // Scroll down to Chapter I
    await page.evaluate(() => {
      window.scrollTo(0, 1100);
    });

    const screenshotPath = '/Users/vqd2k6/.gemini/antigravity-ide/brain/e9fcce39-3111-4607-9a38-b82066dbf9d1/a4_screen_view_chapter1.png';
    await page.screenshot({ path: screenshotPath, fullPage: false });
    console.log(`✅ Đã chụp màn hình Chương I tại: ${screenshotPath}`);
  } finally {
    await browser.close();
  }
}

testScreenA4Chapter1Screenshot().catch(console.error);
