import fs from 'fs';
import path from 'path';
import puppeteer from 'puppeteer';
import { ReportV2Service } from '../modules/report_v2/report-v2.service';

async function snapshotSectionVIII() {
  const reportId = '2ba54dae-0af2-4a40-9896-acdc71e3a914'; // C&C-05-B-0054
  console.log(`Generating HTML for ${reportId}...`);
  const { html, viewModel } = await ReportV2Service.generateResidentialHtml(reportId);

  const tempHtmlPath = path.join(__dirname, 'temp_p7.html');
  fs.writeFileSync(tempHtmlPath, html, 'utf-8');

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1200, height: 1600, deviceScaleFactor: 2 });
    await page.goto(`file://${tempHtmlPath}`, { waitUntil: 'networkidle0' });

    // Find the page sheet containing Section VIII header
    const targetElement = await page.evaluateHandle(() => {
      const sheets = Array.from(document.querySelectorAll('.a4-page-sheet'));
      return sheets.find(sheet => {
        const h2 = sheet.querySelector('h2.chapter-header');
        return h2 && h2.textContent && h2.textContent.includes('VIII.');
      });
    });

    const screenshotPath = '/Users/vqd2k6/.gemini/antigravity-ide/brain/e9fcce39-3111-4607-9a38-b82066dbf9d1/section_viii_p7_preview.png';
    const asElement = targetElement.asElement();
    if (asElement) {
      await asElement.screenshot({ path: screenshotPath });
      console.log(`✅ Page 7 screenshot captured at: ${screenshotPath}`);
    } else {
      console.log('Target element not found, taking full page screenshot...');
      await page.screenshot({ path: screenshotPath, fullPage: true });
    }

    console.log('ViewModel Section 8:', JSON.stringify(viewModel.section8, null, 2));
  } finally {
    await browser.close();
    if (fs.existsSync(tempHtmlPath)) {
      fs.unlinkSync(tempHtmlPath);
    }
  }
}

snapshotSectionVIII().catch(console.error);
