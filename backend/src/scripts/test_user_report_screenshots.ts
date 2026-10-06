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

    // ===== KIỂM TRA TỰ ĐỘNG LAYOUT ẢNH / WATERMARK / SỐ TRANG =====
    const checks = await page.evaluate(() => {
      const issues: string[] = [];
      document.querySelectorAll('.photo-stage').forEach((stage) => {
        const img = stage.querySelector('img.photo-main') as HTMLImageElement | null;
        if (!img) return;
        const rotated = stage.classList.contains('is-rotated');
        const nativeAr = rotated ? img.naturalHeight / img.naturalWidth : img.naturalWidth / img.naturalHeight;
        const r = (stage as HTMLElement).getBoundingClientRect();
        const stageAr = r.width / r.height;
        if (Math.abs(nativeAr - stageAr) / nativeAr > 0.02) {
          issues.push(`Sai tỉ lệ khung: native=${nativeAr.toFixed(3)} stage=${stageAr.toFixed(3)}`);
        }
        if (img.classList.contains('photo-conv-z') || img.classList.contains('photo-conv-d')) {
          if (r.width < r.height) issues.push('Ảnh Z/D không ngang');
        }
        if (img.classList.contains('photo-conv-e')) {
          if (r.height < r.width) issues.push('Ảnh E không dọc');
        }
      });
      const bodyText = document.body.innerText;
      if (bodyText.includes('00:00:00')) issues.push('Còn timestamp 00:00:00');
      if (/Structural member Structural member/i.test(bodyText)) issues.push('Caption còn lặp "Structural member"');
      if (/Assessment\s*-\s*Phase 1 Report/i.test(bodyText)) issues.push('Còn tiêu đề cũ "... - Phase 1 Report"');
      const sheets = document.querySelectorAll('.a4-page-sheet').length;
      const totalEl = document.getElementById('report-total-pages');
      if (totalEl && Number(totalEl.textContent) !== sheets) issues.push(`Header tổng trang ${totalEl.textContent} != ${sheets}`);
      const wmOutside = document.querySelectorAll('.photo-wrapper-fit > .watermark-logo-top-right, .photo-wrapper-fit > .watermark-text-bottom-right').length;
      if (wmOutside > 0) issues.push(`Có ${wmOutside} watermark nằm ngoài khung ảnh`);
      return { issues, stages: document.querySelectorAll('.photo-stage').length };
    });
    console.log(`PHOTO-STAGE count: ${checks.stages}`);
    console.log(checks.issues.length ? `LAYOUT ISSUES:\n - ${checks.issues.join('\n - ')}` : 'LAYOUT CHECKS: ALL PASS');

    // 1. Cover page (Page 1)
    if (pageSheets[0]) {
      const coverPath = path.join(exportDir, 'verify_01_cover_centered.png');
      await pageSheets[0].screenshot({ path: coverPath });
      console.log(`Saved: ${coverPath}`);
    }

    // 2. Text page (Chapter I & II - Page 2)
    if (pageSheets[1]) {
      const pPath = path.join(exportDir, 'verify_02_text_margins.png');
      await pageSheets[1].screenshot({ path: pPath });
      console.log(`Saved Text Page 2: ${pPath}`);
    }

    // Loop through remaining pages to identify Appendix 1, CAD, Defects, Rooms Z, Elements E
    for (let i = 2; i < pageSheets.length; i++) {
      const text = await page.evaluate(el => el.textContent || '', pageSheets[i]);
      const hasPhotoGridExt = await page.evaluate(el => !!el.querySelector('.photo-grid-exterior'), pageSheets[i]);

      if (hasPhotoGridExt && !fs.existsSync(path.join(exportDir, 'verify_03_appendix1.png'))) {
        const pPath = path.join(exportDir, 'verify_03_appendix1.png');
        await pageSheets[i].screenshot({ path: pPath });
        console.log(`Saved Appendix 1 (Page ${i + 1}): ${pPath}`);
      }

      if (text.includes('PHỤ LỤC 2: THỐNG KÊ KHUYẾT TẬT TRÊN MẶT BẰNG TẦNG') && text.includes('Sơ đồ mặt bằng kiến trúc')) {
        const pPath = path.join(exportDir, 'verify_04_appendix2_cad.png');
        await pageSheets[i].screenshot({ path: pPath });
        console.log(`Saved Appendix 2 CAD (Page ${i + 1}): ${pPath}`);
      }

      if (text.includes('HỒ SƠ ẢNH ĐỐI CHIẾU KHUYẾT TẬT') && !fs.existsSync(path.join(exportDir, 'verify_07_appendix2_defects.png'))) {
        const pPath = path.join(exportDir, 'verify_07_appendix2_defects.png');
        await pageSheets[i].screenshot({ path: pPath });
        console.log(`Saved Appendix 2 Defects (Page ${i + 1}): ${pPath}`);
      }

      if (text.includes('HỒ SƠ ẢNH KHÔNG GIAN KIẾN TRÚC CÁC PHÒNG (VÙNG Z') && !fs.existsSync(path.join(exportDir, 'verify_05_appendix2_rooms_z.png'))) {
        const pPath = path.join(exportDir, 'verify_05_appendix2_rooms_z.png');
        await pageSheets[i].screenshot({ path: pPath });
        console.log(`Saved Appendix 2 Rooms Z (Page ${i + 1}): ${pPath}`);
      }

      if (text.includes('HỒ SƠ ẢNH CẤU KIỆN KẾT CẤU CHỊU LỰC (CỘT/DẦM E') && !fs.existsSync(path.join(exportDir, 'verify_06_appendix2_elements_e.png'))) {
        const pPath = path.join(exportDir, 'verify_06_appendix2_elements_e.png');
        await pageSheets[i].screenshot({ path: pPath });
        console.log(`Saved Appendix 2 Elements E (Page ${i + 1}): ${pPath}`);
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
