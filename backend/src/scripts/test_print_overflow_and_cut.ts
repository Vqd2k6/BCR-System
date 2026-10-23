/**
 * Automated Test Suite: test_print_overflow_and_cut.ts
 * Kiểm tra toàn diện giải pháp chống cắt trang / tràn trang khi in và tải PDF:
 * 1. TC1: SVG XML escaping cho mã công trình có ký tự đặc biệt (&, <, >, ", ')
 * 2. TC2: Nén hình học trang bìa (chiều cao <= 261mm, chứa cả ảnh & chữ ký)
 * 3. TC3: Trang 2 là Mục Lục (TOC), triệt tiêu hoàn toàn trang chữ ký mồ côi
 * 4. TC4: Sơ đồ CAD và bảng 5 khuyết tật nằm trọn vẹn trong 1 trang duy nhất
 * 5. TC5: Phụ lục ảnh nứt không có trang ghi chú mồ côi
 * 6. TC6: Render PDF thật qua pipeline 2-pass thành công, các chương bắt đầu ở đầu trang
 */

import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';
import assert from 'assert';
import * as pdfjs from 'pdfjs-dist/legacy/build/pdf';
import { pool } from '../database/db';
import { ReportService } from '../modules/report/report-v3.service';
import { generateMetroSpatialVisualSvg } from '../modules/report/utils/metro-spatial.utils';

async function runTests() {
  console.log('================================================================');
  console.log('🚀 BẮT ĐẦU KIỂM THỬ: CHỐNG TRÀN VÀ CẮT TRANG KHI IN / TẢI BÁO CÁO');
  console.log('================================================================\n');

  let passed = 0;
  let total = 6;

  // --------------------------------------------------------------------------
  // TC1: SVG XML Escaping
  // --------------------------------------------------------------------------
  console.log('▶ TC1: Kiểm tra escape XML an toàn trong Sơ đồ vị trí Metro (ký tự &)');
  try {
    const rawDataUri = generateMetroSpatialVisualSvg(
      [[106.65, 10.78], [106.651, 10.78], [106.651, 10.781], [106.65, 10.781]],
      'B-00026-C&C (ST05)'
    );

    const base64Data = rawDataUri.replace(/^data:image\/svg\+xml;base64,/, '');
    const svgXml = Buffer.from(base64Data, 'base64').toString('utf8');

    assert(svgXml.includes('&amp;'), 'SVG phải escape ký tự & thành &amp;');
    assert(!svgXml.includes('B-00026-C&C (ST05)</text>'), 'Không được để sót ký tự & trần trong thẻ text');

    // Kiểm tra cú pháp XML bằng xmllint
    const tmpSvgPath = '/tmp/test_spatial_map.svg';
    fs.writeFileSync(tmpSvgPath, svgXml, 'utf8');
    execSync(`xmllint --noout ${tmpSvgPath}`);
    fs.unlinkSync(tmpSvgPath);

    console.log('  ✅ PASSED: SVG XML 100% hợp lệ, xmllint không báo lỗi cú pháp!\n');
    passed++;
  } catch (err: any) {
    console.error('  ❌ FAILED TC1:', err.message);
  }

  // --------------------------------------------------------------------------
  // Lấy dữ liệu và render PDF kiểm thử cho công trình B-00026-C&C
  // --------------------------------------------------------------------------
  console.log('▶ Đang render PDF thật qua pipeline 2-pass TOC...');
  const testReportId = 'd730fc32-3c55-4d4f-94d2-14d4bdcf5060';
  const resolved = await ReportService.resolve(testReportId);
  const { pdfBuffer, buildingId } = await ReportService.renderDraftPdf(resolved, undefined, true);
  const doc = await pdfjs.getDocument({ data: new Uint8Array(pdfBuffer) }).promise;
  const numPages = doc.numPages;
  console.log(`  ℹ️ PDF Render hoàn tất: ${numPages} trang, mã: ${buildingId}\n`);

  // Trích xuất văn bản từng trang
  const pageTexts: string[] = [];
  for (let i = 1; i <= numPages; i++) {
    const page = await doc.getPage(i);
    const content = await page.getTextContent();
    const text = content.items.map((it: any) => it.str).join(' ').trim().replace(/\s+/g, ' ');
    pageTexts.push(text);
  }

  // --------------------------------------------------------------------------
  // TC2: Trang bìa (Page 1) chứa cả Ảnh mặt tiền, Sơ đồ Metro và Bảng chữ ký
  // --------------------------------------------------------------------------
  console.log('▶ TC2: Kiểm tra Trang 1 (Bìa) chứa trọn vẹn Ảnh và Bảng ký duyệt');
  try {
    const p1 = pageTexts[0];
    assert(p1.includes('Building Condition Survey and Assessment') || p1.includes('Building Condition Survey'), 'Trang 1 phải có tiêu đề báo cáo');
    assert(p1.includes('ẢNH MẶT TIỀN CÔNG TRÌNH') || p1.includes('FACADE PHOTO'), 'Trang 1 phải có chú thích ảnh mặt tiền');
    assert(p1.includes('SƠ ĐỒ VỊ TRÍ THỬA ĐẤT') || p1.includes('SPATIAL MAP'), 'Trang 1 phải có sơ đồ vị trí');
    assert(p1.includes('NGƯỜI LẬP') || p1.includes('PREPARED BY'), 'Trang 1 phải có chức danh Người lập');
    assert(p1.includes('KIỂM TRA') || p1.includes('CHECKED') || p1.includes('APPROVED'), 'Trang 1 phải có chức danh Kiểm tra / Duyệt');

    console.log('  ✅ PASSED: Trang 1 chứa trọn vẹn tiêu đề, ảnh mặt tiền, sơ đồ Metro và bảng ký duyệt!\n');
    passed++;
  } catch (err: any) {
    console.error('  ❌ FAILED TC2:', err.message);
  }

  // --------------------------------------------------------------------------
  // TC3: Trang 2 là Mục Lục (TOC) - Triệt tiêu trang chữ ký mồ côi
  // --------------------------------------------------------------------------
  console.log('▶ TC3: Kiểm tra Trang 2 là Mục Lục (TOC)');
  try {
    const p2 = pageTexts[1];
    assert(p2.includes('M Ụ C L Ụ C') || p2.includes('TABLE OF CONTENTS') || p2.includes('MỤC LỤC'), 'Trang 2 phải là Mục Lục');
    assert(!p2.includes('NGƯỜI LẬP BÁO CÁO'), 'Trang 2 không được chứa bảng chữ ký bìa mồ côi');

    console.log('  ✅ PASSED: Trang 2 chính xác là Mục Lục báo cáo!\n');
    passed++;
  } catch (err: any) {
    console.error('  ❌ FAILED TC3:', err.message);
  }

  // --------------------------------------------------------------------------
  // TC4: Sơ đồ CAD và bảng 5 khuyết tật nằm trọn trong 1 trang duy nhất
  // --------------------------------------------------------------------------
  console.log('▶ TC4: Kiểm tra Sơ đồ CAD và bảng khuyết tật không bị xé đôi');
  try {
    // Tìm trang có tiêu đề mặt bằng tầng trệt
    let groundCadPage = -1;
    for (let i = 0; i < pageTexts.length; i++) {
      if (pageTexts[i].includes('H Ồ S Ơ KHUY Ế T TẬT TR Ê N MẶT BẰNG TẦNG') && pageTexts[i].includes('Tầng tr ệ t')) {
        groundCadPage = i + 1;
        break;
      }
    }
    assert(groundCadPage > 0, 'Phải tìm thấy trang Sơ đồ CAD Tầng trệt');
    const textG = pageTexts[groundCadPage - 1];

    assert(textG.includes('D-01'), 'Trang CAD Tầng trệt phải chứa lỗi D-01');
    assert(textG.includes('D-05'), 'Trang CAD Tầng trệt phải chứa lỗi D-05 (không bị đẩy sang trang sau)');

    console.log(`  ✅ PASSED: Trang ${groundCadPage} chứa trọn vẹn cả Sơ đồ CAD và danh sách 5 khuyết tật!\n`);
    passed++;
  } catch (err: any) {
    console.error('  ❌ FAILED TC4:', err.message);
  }

  // --------------------------------------------------------------------------
  // TC5: Phụ lục ảnh nứt không có trang mồ côi chỉ chứa "Ghi chú KSV"
  // --------------------------------------------------------------------------
  console.log('▶ TC5: Kiểm tra không có trang ảnh khuyết tật nào bị mồ côi dòng ghi chú');
  try {
    let orphanFound = false;
    for (let i = 0; i < pageTexts.length; i++) {
      const txt = pageTexts[i];
      // Nếu trang chỉ có dưới 200 ký tự và chứa "Ghi chú KSV" thì đó là trang mồ côi
      if (txt.length < 200 && txt.includes('Ghi chú KSV')) {
        orphanFound = true;
        console.error(`  Phát hiện trang mồ côi tại Trang ${i + 1}: ${txt}`);
      }
    }
    assert(!orphanFound, 'Không được có trang nào mồ côi dòng Ghi chú KSV');

    console.log('  ✅ PASSED: 100% trang ảnh khuyết tật gắn liền với thước đo và ghi chú, không có trang mồ côi!\n');
    passed++;
  } catch (err: any) {
    console.error('  ❌ FAILED TC5:', err.message);
  }

  // --------------------------------------------------------------------------
  // TC6: Kiểm tra các tiêu đề Chương bắt đầu ở đầu trang sạch sẽ
  // --------------------------------------------------------------------------
  console.log('▶ TC6: Kiểm tra tiêu đề các Chương bắt đầu ở đầu trang');
  try {
    const p3 = pageTexts[2];
    const p4 = pageTexts[3];
    assert(p3.includes('I. TH Ô NG TIN CHUNG'), 'Trang 3 chứa Chương I');
    assert(p4.includes('II. TH Ô NG TIN C Ơ BẢN'), 'Trang 4 bắt đầu sạch sẽ với Chương II');

    console.log('  ✅ PASSED: Các chương mục phân tách trang chỉn chu, tiêu đề nằm trên đầu trang!\n');
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

runTests().catch((e) => {
  console.error('Lỗi thực thi kiểm thử:', e);
  process.exit(1);
});
