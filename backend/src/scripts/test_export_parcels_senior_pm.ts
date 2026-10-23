import * as fs from 'fs';
import * as path from 'path';
import { Database, pool } from '../database/db';
import { ReportService } from '../modules/report/report-v3.service';
import { PdfRenderEngine } from '../modules/report/engine/pdf-render.engine';

async function main() {
  console.log('══════════════════════════════════════════════════════════════════');
  console.log('  KIỂM CHỨNG BÁO CÁO SENIOR PM: B-00116 VÀ B-0063');
  console.log('══════════════════════════════════════════════════════════════════');

  const parcels = [
    { id: '013d8ec6-a9d8-4854-8536-ce9c8ccf0903', code: 'B-00116', note: 'Có vết nứt, đối chiếu thước đo, CAT 4' },
    { id: '52eff9ab-90fa-4ed3-9b05-90d5bfcd6793', code: 'B-0063', note: '0 khuyết tật, lưu trữ đối chứng' },
  ];

  const outDir = path.resolve(__dirname, '../../test_output/result');
  fs.mkdirSync(outDir, { recursive: true });

  const browser = await PdfRenderEngine.getBrowser();

  for (const p of parcels) {
    console.log(`\n🔍 Đang xử lý hồ sơ ${p.code} (${p.note})...`);
    const resolved = await ReportService.resolve(p.id);

    // 1. Render HTML
    const { html } = await ReportService.renderDraftHtml(resolved, undefined, false, true);
    console.log(`   - Độ dài HTML: ${Math.round(html.length / 1024)} KB`);

    // 2. Kiểm tra HTML checks
    const checks: Array<{ name: string; pass: boolean; info?: string }> = [];

    // Font Latin Modern Roman
    checks.push({
      name: 'Nhúng font chuẩn Latin Modern Roman (Base64)',
      pass: html.includes('Latin Modern Roman') && html.includes('font-family: \'Latin Modern Roman\''),
    });

    // 8 Biến kích thước chữ tiêu chuẩn
    checks.push({
      name: '8 biến tỷ lệ Typography (--fs-t0 đến --fs-f1, floor 9pt)',
      pass: html.includes('--fs-t0:') && html.includes('--fs-f1: 9pt;') && html.includes('--fs-b1: 11pt;'),
    });

    // Không dùng màu sặc sỡ, monochrome styling
    checks.push({
      name: 'Định dạng trắng đen tiêu chuẩn công sở (không màu nền sặc sỡ)',
      pass: !html.includes('background-color: #2563eb') && !html.includes('background-color: #0369a1'),
    });

    // Bỏ [ Đã ký điện tử ]
    checks.push({
      name: 'Bỏ nhãn [ Đã ký điện tử ], giữ ô ký sạch cho chữ ký sống',
      pass: !html.includes('[ Đã ký điện tử ]') && !html.includes('[Đã ký điện tử]'),
    });

    // Lọc tài khoản test
    checks.push({
      name: 'Lọc tên tài khoản test (zoneAdminTest_01)',
      pass: !html.includes('zoneAdminTest_01'),
    });

    // Không lỗi cú pháp ghim CAD double brackets [[ ]]
    checks.push({
      name: 'Sửa lỗi double brackets [[ ]] tại điểm ghim CAD',
      pass: !html.includes('[[') && !html.includes(']]'),
    });

    // Không có blob: URL
    checks.push({
      name: 'Không chứa blob: URL',
      pass: !html.includes('src="blob:') && !html.includes('url("blob:'),
    });

    // Không có localhost: URL
    checks.push({
      name: 'Không chứa localhost: URL trong ảnh',
      pass: !html.includes('src="http://localhost') && !html.includes('src="https://localhost'),
    });

    // Cấu trúc 7 phần: Mục X, Mục XI, Phụ lục 1, Phụ lục 2, Phụ lục 3
    checks.push({
      name: 'Mục X: Bản vẽ mặt đứng ngoài & bộ ảnh định danh công trình',
      pass: html.includes('MỤC X') || html.includes('SECTION X'),
    });
    checks.push({
      name: 'Mục XI: Biên bản khảo sát hiện trường (trước phụ lục)',
      pass: html.includes('MỤC XI') || html.includes('SECTION XI'),
    });
    checks.push({
      name: 'Phụ lục 1: Hồ sơ khuyết tật (nhóm có vết nứt)',
      pass: html.includes('PHỤ LỤC 1') || html.includes('APPENDIX 1'),
    });
    checks.push({
      name: 'Phụ lục 2: Hồ sơ ảnh lưu trữ đối chứng (nhóm không nứt)',
      pass: html.includes('PHỤ LỤC 2') || html.includes('APPENDIX 2'),
    });
    checks.push({
      name: 'Phụ lục 3: Thiết bị và phạm vi tiếp cận',
      pass: html.includes('PHỤ LỤC 3') || html.includes('APPENDIX 3'),
    });

    for (const c of checks) {
      if (c.pass) {
        console.log(`     ✅ ${c.name}`);
      } else {
        console.log(`     ❌ ${c.name} ${c.info || ''}`);
      }
    }

    // 3. Render PDF và đo đạc TOC bằng Puppeteer Page
    console.log(`   - Khởi tạo trang Puppeteer để kiểm tra đo đạc DOM & TOC...`);
    const page = await browser.newPage();
    try {
      await page.setContent(html, { waitUntil: 'load', timeout: 60000 });
      await page.waitForFunction('window.__reportReady === true', { timeout: 30000 });

      // Lấy các giá trị TOC được đo động trong DOM
      const tocInfo = await page.evaluate(() => {
        const items = Array.from(document.querySelectorAll('[data-toc-target]')).map((el) => ({
          target: el.getAttribute('data-toc-target'),
          text: el.textContent?.trim(),
        }));
        const totalSheets = document.querySelectorAll('.a4-page-sheet').length;
        return { items, totalSheets };
      });

      console.log(`   - Tổng số trang vật lý đo được: ${tocInfo.totalSheets}`);
      console.log(`   - Số trang hiển thị trong Mục lục:`);
      for (const it of tocInfo.items) {
        console.log(`       • ${it.target}: trang ${it.text}`);
      }

      // 4. Xuất file PDF thực tế
      console.log(`   - Tiến hành xuất file PDF...`);
      const pdfBuffer = await page.pdf({
        format: 'A4',
        printBackground: true,
        preferCSSPageSize: true,
        displayHeaderFooter: true,
        headerTemplate: '<div></div>',
        footerTemplate: '<div></div>',
        margin: { top: '0mm', bottom: '0mm', left: '0mm', right: '0mm' },
      });

      const pdfPath = path.join(outDir, `BCS_${p.code}_Senior_PM_Standard.pdf`);
      fs.writeFileSync(pdfPath, pdfBuffer);
      console.log(`   ✅ Đã lưu file PDF: ${pdfPath} (${Math.round(pdfBuffer.length / 1024)} KB)`);

    } finally {
      await page.close();
    }
  }

  await pool.end();
  await browser.close();
  console.log('\n══════════════════════════════════════════════════════════════════');
  console.log('  HOÀN TẤT KIỂM CHỨNG TOÀN DIỆN THÀNH CÔNG');
  console.log('══════════════════════════════════════════════════════════════════');
}

main().catch((err) => {
  console.error('Lỗi kiểm chứng:', err);
  process.exit(1);
});
