import * as fs from 'fs';
import * as path from 'path';
import puppeteer from 'puppeteer';
import { ReportV2Service } from '../modules/report_v2/report-v2.service';

async function main() {
  const parcelCode = 'C&C-05-B-0154';
  const reportId = '06286cda-6111-4880-aab3-081834e75233';

  console.log(`Generating HTML for ${parcelCode}...`);
  const { html, viewModel } = await ReportV2Service.generateResidentialHtml(reportId);

  const previewPath = path.resolve(__dirname, '../../sample_export/preview_parcel_0154_full.html');
  fs.writeFileSync(previewPath, html, 'utf-8');
  console.log(`Saved HTML to ${previewPath}`);

  console.log('Launching browser to capture screenshots...');
  const browser = await puppeteer.launch({
    headless: 'new' as any,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-gpu'],
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1240, height: 1754, deviceScaleFactor: 2 });
  await page.setContent(html, { waitUntil: 'networkidle0' });

  // Find all page sheets
  const pages = await page.$$('.a4-page-sheet');
  console.log(`Found ${pages.length} page sheets.`);

  const artifactDir = '/Users/vqd2k6/.gemini/antigravity-ide/brain/e9fcce39-3111-4607-9a38-b82066dbf9d1';

  // Page 4 contains Section III and Section IV
  if (pages.length >= 4) {
    const page4Path = path.join(artifactDir, '0154_page4_section3_and_4.png');
    await pages[3].screenshot({ path: page4Path });
    console.log(`Captured Section III & IV to ${page4Path}`);
  }

  // Page 5 contains Section V and Section VI
  if (pages.length >= 5) {
    const page5Path = path.join(artifactDir, '0154_page5_section5_and_6.png');
    await pages[4].screenshot({ path: page5Path });
    console.log(`Captured Section V & VI to ${page5Path}`);
  }

  await browser.close();
  console.log('Done!');
  process.exit(0);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
