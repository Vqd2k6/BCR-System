const puppeteer = require('puppeteer');
const path = require('path');

(async () => {
  const browser = await puppeteer.launch({ headless: 'new', args: ['--no-sandbox'] });
  const page = await browser.newPage();
  await page.setViewport({ width: 1200, height: 1600, deviceScaleFactor: 1 });
  const htmlPath = 'file://' + path.resolve(__dirname, '../../sample_export/preview_parcel_0054_full.html');
  await page.goto(htmlPath, { waitUntil: 'networkidle0' });

  const pages = await page.$$('.a4-page-sheet');
  console.log('Total A4 pages found in DOM:', pages.length);

  // Take screenshot of key pages (0-indexed)
  const indicesToCapture = [0, 2, 4, 5, 6, 7, 8, 9, 10, 11, 12, pages.length - 3, pages.length - 2, pages.length - 1];
  for (const idx of indicesToCapture) {
    if (idx >= 0 && idx < pages.length) {
      const p = pages[idx];
      const screenshotPath = path.resolve(__dirname, `../../sample_export/page_${idx + 1}.png`);
      await p.screenshot({ path: screenshotPath });
      console.log(`Captured page ${idx + 1} to ${screenshotPath}`);
    }
  }

  await browser.close();
  console.log('Snapshot complete!');
})();
