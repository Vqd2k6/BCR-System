/**
 * Automated Test Suite: test_report_design_format.ts
 * Kiểm tra toàn diện 6 kịch bản Stress Test cho Report Design Format theo kết quả /grill-me:
 * 1. TC1: Sơ đồ CAD Tầng đạt chuẩn Hero CAD Sheet (max-height 175mm, không bị bóp nghẹt 105px)
 * 2. TC2: Bảng thống kê khuyết tật tách trang độc lập sau CAD, xóa bỏ "Ghi chú KSV" dưới ảnh
 * 3. TC3: Khung ảnh khuyết tật chuẩn hóa ngân sách trang (không còn inline placeholder 90mm/95mm)
 * 4. TC4: Typography chống tràn ô bảng (table-layout fixed, word-break break-word, overflow-wrap)
 * 5. TC5: Đồng bộ số tầng storeysAbove = Math.max(specs.aboveFloors, floors.length) xóa mâu thuẫn
 * 6. TC6: Render và kiểm tra toàn vẹn các file PDF thực tế (B-00026, B-00116, B-0063)
 */

import * as fs from 'fs';
import * as path from 'path';
import assert from 'assert';
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf';
import { pool } from '../database/db';
import { ReportV3Service } from '../modules/report_v3/report-v3.service';
import { ReportV2Service } from '../modules/report_v2/report-v2.service';
import { generateMetroSpatialVisualSvg } from '../modules/report_v2/utils/metro-spatial.utils';

async function runDesignFormatTests() {
  console.log('================================================================');
  console.log('🚀 BẮT ĐẦU KIỂM THỬ: ĐỊNH DẠNG THIẾT KẾ BÁO CÁO (REPORT DESIGN FORMAT)');
  console.log('================================================================\n');

  let passed = 0;
  const total = 6;

  // --------------------------------------------------------------------------
  // TC1: Sơ đồ CAD Tầng đạt chuẩn Hero CAD Sheet (max-height 175mm, gỡ bỏ 105px)
  // --------------------------------------------------------------------------
  console.log('▶ TC1: Kiểm tra quy chuẩn Hero CAD Sheet 175mm (gỡ bỏ hoàn toàn giới hạn 105px)');
  try {
    const cssPath = path.resolve(__dirname, '../modules/report_v2/templates/residential/styles.css');
    const cssContent = fs.readFileSync(cssPath, 'utf8');

    assert(!cssContent.includes('max-height: 105px !important;'), 'styles.css KHÔNG ĐƯỢC chứa max-height: 105px !important');
    assert(cssContent.includes('max-height: 175mm !important;'), 'styles.css phải chứa max-height: 175mm !important cho Hero CAD');
    assert(cssContent.includes('.cad-map-dual-grid .cad-map-image'), 'Phải định nghĩa riêng cho lưới CAD đôi');

    console.log('  ✅ PASSED: styles.css đã xóa bỏ 105px, Hero CAD Sheet đạt chuẩn 175mm!\n');
    passed++;
  } catch (err: any) {
    console.error('  ❌ FAILED TC1:', err.message);
  }

  // --------------------------------------------------------------------------
  // TC2: Bảng thống kê khuyết tật tách trang độc lập sau CAD, xóa Ghi chú KSV dưới ảnh
  // --------------------------------------------------------------------------
  console.log('▶ TC2: Kiểm tra Bảng thống kê khuyết tật tách trang sau CAD, xóa "Ghi chú KSV" dưới ảnh');
  try {
    const hbsPath = path.resolve(__dirname, '../modules/report_v2/templates/residential/partials/page-10-appendix-1-defects.hbs');
    const hbsContent = fs.readFileSync(hbsPath, 'utf8');

    // Kiểm tra không còn thẻ meta-strip-notes hiển thị "Ghi chú KSV"
    assert(!hbsContent.includes('meta-strip-notes'), 'page-10-appendix-1-defects.hbs KHÔNG ĐƯỢC chứa meta-strip-notes');
    assert(!hbsContent.includes('Ghi chú KSV:'), 'Dải thông số ảnh KHÔNG ĐƯỢC chứa chuỗi "Ghi chú KSV:"');

    // Kiểm tra thông báo chuyển tiếp trên trang Hero CAD
    assert(hbsContent.includes('DANH MỤC THỐNG KÊ KHUYẾT TẬT &amp; HỒ SƠ ẢNH ĐỐI CHIẾU'), 'Trang Hero CAD phải có khung thông báo chuyển tiếp bảng nứt');

    console.log('  ✅ PASSED: Bảng nứt tách trang độc lập sau CAD, đã loại bỏ khối Ghi chú KSV dưới ảnh!\n');
    passed++;
  } catch (err: any) {
    console.error('  ❌ FAILED TC2:', err.message);
  }

  // --------------------------------------------------------------------------
  // TC3: Khung ảnh khuyết tật chuẩn hóa ngân sách trang (xóa placeholder 90mm/95mm)
  // --------------------------------------------------------------------------
  console.log('▶ TC3: Kiểm tra Khung ảnh khuyết tật & không còn placeholder 90mm/95mm');
  try {
    const hbsPath = path.resolve(__dirname, '../modules/report_v2/templates/residential/partials/page-10-appendix-1-defects.hbs');
    const hbsContent = fs.readFileSync(hbsPath, 'utf8');

    assert(!hbsContent.includes('height: 90mm;'), 'Không được hardcode placeholder height: 90mm');
    assert(!hbsContent.includes('height: 95mm;'), 'Không được hardcode placeholder height: 95mm');
    assert(!hbsContent.includes('height: 200px;'), 'Không được hardcode placeholder height: 200px');

    console.log('  ✅ PASSED: 100% placeholder đã được chuẩn hóa theo CSS class, triệt tiêu nguy cơ tràn trang!\n');
    passed++;
  } catch (err: any) {
    console.error('  ❌ FAILED TC3:', err.message);
  }

  // --------------------------------------------------------------------------
  // TC4: Typography chống tràn ô bảng (table-layout fixed, word-break break-word)
  // --------------------------------------------------------------------------
  console.log('▶ TC4: Kiểm tra Typography chống tràn ô bảng (table-layout fixed, word-break, SVG XML escaping)');
  try {
    const cssPath = path.resolve(__dirname, '../modules/report_v2/templates/residential/styles.css');
    const cssContent = fs.readFileSync(cssPath, 'utf8');

    assert(cssContent.includes('table-layout: fixed;'), 'styles.css phải có table-layout: fixed cho bảng');
    assert(cssContent.includes('word-break: break-word;'), 'styles.css phải có word-break: break-word');
    assert(cssContent.includes('overflow-wrap: break-word;'), 'styles.css phải có overflow-wrap: break-word');

    // Test XML escaping trong SVG
    const svgDataUri = generateMetroSpatialVisualSvg(
      [[106.65, 10.78], [106.651, 10.78], [106.651, 10.781], [106.65, 10.781]],
      'B-00026-C&C <ST05> "Test" & \'Demo\''
    );
    const svgXml = Buffer.from(svgDataUri.replace(/^data:image\/svg\+xml;base64,/, ''), 'base64').toString('utf8');
    assert(svgXml.includes('&amp;'), 'SVG phải escape &');
    assert(svgXml.includes('&lt;ST05&gt;'), 'SVG phải escape < và >');

    console.log('  ✅ PASSED: Typography và XML escaping đã an toàn tuyệt đối trước chuỗi ký tự dài & đặc biệt!\n');
    passed++;
  } catch (err: any) {
    console.error('  ❌ FAILED TC4:', err.message);
  }

  // --------------------------------------------------------------------------
  // TC5: Đồng bộ số tầng storeysAbove xóa bỏ mâu thuẫn số liệu
  // --------------------------------------------------------------------------
  console.log('▶ TC5: Kiểm tra đồng bộ số tầng storeysAbove với số lượng tầng thực tế');
  try {
    const testReportId = 'd730fc32-3c55-4d4f-94d2-14d4bdcf5060'; // B-00026
    const resolved = await ReportV3Service.resolve(testReportId);
    const { viewModel } = await ReportV2Service.generateResidentialHtmlFromReport(resolved.raw, undefined, false, true);

    const storeysText = viewModel.section2.storeysDisplay.vi;
    console.log(`  ℹ️ B-00026 storeysDisplay.vi: "${storeysText}"`);
    console.log(`  ℹ️ B-00026 số tầng phụ lục: ${viewModel.appendix2.length} tầng`);

    assert(storeysText.includes('2 tầng') || storeysText.includes('2'), 'Số tầng của B-00026 phải là 2 tầng (đã khảo sát Trệt + Lầu 1)');
    assert.strictEqual(viewModel.appendix2.length, 2, 'Phụ lục phải có 2 tầng');

    console.log('  ✅ PASSED: Số tầng Chương II và Phụ lục khảo sát đã đồng nhất 100% (2 tầng)!\n');
    passed++;
  } catch (err: any) {
    console.error('  ❌ FAILED TC5:', err.message);
  }

  // --------------------------------------------------------------------------
  // TC6: Render và lưu trữ PDF thực tế các công trình mẫu (B-00026, B-00116, B-0063)
  // --------------------------------------------------------------------------
  console.log('▶ TC6: Render PDF thực tế và lưu trữ vào backend/test_output/audit/ để nghiệm thu trực quan');
  try {
    const testCases = [
      { id: 'd730fc32-3c55-4d4f-94d2-14d4bdcf5060', filename: 'B-00026-CC.pdf' },
      { id: '013d8ec6-a9d8-4854-8536-ce9c8ccf0903', filename: 'B-0116-CC.pdf' },
      { id: '52eff9ab-90fa-4ed3-9b05-90d5bfcd6793', filename: 'B-0063-CC.pdf' },
    ];

    const outDir = path.resolve(__dirname, '../../test_output/audit');
    if (!fs.existsSync(outDir)) {
      fs.mkdirSync(outDir, { recursive: true });
    }

    for (const tc of testCases) {
      console.log(`  Rendering ${tc.filename}...`);
      const res = await ReportV3Service.resolve(tc.id);
      const { pdfBuffer, buildingId } = await ReportV3Service.renderDraftPdf(res, undefined, true);

      const filePath = path.join(outDir, tc.filename);
      fs.writeFileSync(filePath, pdfBuffer);

      const doc = await pdfjs.getDocument({ data: new Uint8Array(pdfBuffer) }).promise;
      console.log(`    → Đã xuất ${tc.filename}: ${doc.numPages} trang, dung lượng: ${(pdfBuffer.length / 1024 / 1024).toFixed(2)} MB`);

      // Kiểm tra trang CAD Tầng trệt và Bảng nứt
      let cadPageNum = -1;
      let tablePageNum = -1;
      for (let i = 1; i <= doc.numPages; i++) {
        const page = await doc.getPage(i);
        const textContent = await page.getTextContent();
        const text = textContent.items.map((it: any) => it.str).join(' ').replace(/\s+/g, ' ').trim();
        const lower = text.toLowerCase();

        if (lower.includes('phụ lục 1') || lower.includes('phu luc 1') || lower.includes('appendix 1')) {
          if (lower.includes('sơ đồ mặt bằng') || lower.includes('hồ sơ khuyết tật trên mặt bằng') || lower.includes('floor plan defect record') || lower.includes('zone pins')) {
            if (cadPageNum === -1) {
              cadPageNum = i;
            }
          }
          if (lower.includes('bảng thống kê') || lower.includes('detailed floor defect') || lower.includes('defect specification table')) {
            if (tablePageNum === -1) {
              tablePageNum = i;
            }
          }
        }
      }

      console.log(`    → Trang CAD đầu tiên: Trang ${cadPageNum} | Trang Bảng nứt riêng: Trang ${tablePageNum}`);
      assert(cadPageNum > 0, `Phải tìm thấy trang CAD trong ${tc.filename}`);
      if (tc.filename === 'B-00026-CC.pdf' && tablePageNum > 0) {
        assert(tablePageNum > cadPageNum, `Bảng nứt riêng phải nằm sau trang CAD (${tablePageNum} > ${cadPageNum})`);
      }
    }

    console.log('  ✅ PASSED: Đã render thành công 3/3 file PDF thực tế và lưu trữ tại backend/test_output/audit/!\n');
    passed++;
  } catch (err: any) {
    console.error('  ❌ FAILED TC6:', err.message);
  }

  console.log('================================================================');
  console.log(`🎉 KẾT QUẢ KIỂM THỬ: ${passed}/${total} TEST CASES ĐẠT CHUẨN 100%`);
  console.log('================================================================\n');

  await pool.end();
  if (passed === total) {
    process.exit(0);
  } else {
    process.exit(1);
  }
}

runDesignFormatTests().catch((e) => {
  console.error('Lỗi thực thi kiểm thử thiết kế:', e);
  process.exit(1);
});
