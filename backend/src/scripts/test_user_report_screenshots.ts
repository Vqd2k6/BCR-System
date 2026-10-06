import fs from 'fs';
import path from 'path';
import puppeteer from 'puppeteer';
import { ReportV2Service } from '../modules/report_v2/report-v2.service';

async function main() {
  const exportDir = '/Users/vqd2k6/.gemini/antigravity-ide/brain/e9fcce39-3111-4607-9a38-b82066dbf9d1/sample_export';
  if (!fs.existsSync(exportDir)) {
    fs.mkdirSync(exportDir, { recursive: true });
  }

  const testReportId = '06286cda-6111-4880-aab3-081834e75233';
  console.log(`Generating HTML for report ${testReportId}...`);
  const { html, viewModel } = await ReportV2Service.generateResidentialHtml(testReportId);

  const htmlPath = path.join(exportDir, 'user_report_0154.html');
  fs.writeFileSync(htmlPath, html, 'utf8');
  console.log(`HTML saved at ${htmlPath} (${Math.round(html.length / 1024)} KB)`);

  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width: 1200, height: 1600, deviceScaleFactor: 2 });
    await page.goto(`file://${htmlPath}`, { waitUntil: 'networkidle0' });

    // Wait a brief moment for canvas rotations to complete
    await new Promise(r => setTimeout(r, 1200));

    const pageSheets = await page.$$('.a4-page-sheet');
    console.log(`Found ${pageSheets.length} pages in document`);

    // 1. Cover page
    if (pageSheets[0]) {
      const coverPath = path.join(exportDir, 'verify_01_cover_centered.png');
      await pageSheets[0].screenshot({ path: coverPath });
      console.log(`Saved: ${coverPath}`);
    }

    // Loop through remaining pages to identify Appendix 1, Appendix 2 CAD, Appendix 2 Defects
    for (let i = 1; i < pageSheets.length; i++) {
      const hasPhotoGridExt = await page.evaluate(el => !!el.querySelector('.photo-grid-exterior'), pageSheets[i]);
      if (hasPhotoGridExt) {
        const pPath = path.join(exportDir, 'verify_02_appendix1.png');
        await pageSheets[i].screenshot({ path: pPath });
        console.log(`Saved Appendix 1 (Page ${i + 1}): ${pPath}`);
      }
      const text = await page.evaluate(el => el.textContent || '', pageSheets[i]);
      if (text.includes('PHỤ LỤC 2: THỐNG KÊ KHUYẾT TẬT TRÊN MẶT BẰNG TẦNG') && text.includes('Sơ đồ mặt bằng kiến trúc')) {
        const pPath = path.join(exportDir, 'verify_03_appendix2_cad.png');
        await pageSheets[i].screenshot({ path: pPath });
        console.log(`Saved Appendix 2 CAD (Page ${i + 1}): ${pPath}`);
      }
      if (text.includes('PHỤ LỤC 2: HỒ SƠ ẢNH ĐỐI CHIẾU KHUYẾT TẬT')) {
        const pPath = path.join(exportDir, 'verify_04_appendix2_defects.png');
        await pageSheets[i].screenshot({ path: pPath });
        console.log(`Saved Appendix 2 Defects (Page ${i + 1}): ${pPath}`);
      }
      if (text.includes('HỒ SƠ ẢNH TỔNG THỂ KHÔNG GIAN CÁC PHÒNG') && text.includes('Trang 1/5')) {
        const pPath = path.join(exportDir, 'verify_05_appendix2_rooms.png');
        await pageSheets[i].screenshot({ path: pPath });
        console.log(`Saved Appendix 2 Rooms (Page ${i + 1}): ${pPath}`);
      }
    }
  } finally {
    await browser.close();
  }
  process.exit(0);
}

main().catch(err => {
  console.error('Error in verification:', err);
  process.exit(1);
});
