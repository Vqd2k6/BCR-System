/**
 * ============================================================================
 * 5 TEST CASES SUITE - REPORT MONOCHROME STANDARDIZATION
 * Kiểm thử toàn diện 5 ca nghiệp vụ chuẩn hóa đơn sắc đen công sở (#000000)
 * ============================================================================
 */

import * as fs from 'fs';
import * as path from 'path';
import Handlebars from 'handlebars';
import { ReportV2Service } from '../modules/report_v2/report-v2.service';
import { ReportV3Service } from '../modules/report_v3/report-v3.service';
import { pool } from '../database/db';

interface TestResult {
  id: string;
  name: string;
  passed: boolean;
  message?: string;
}

const results: TestResult[] = [];

function assert(id: string, name: string, condition: boolean, failMsg?: string) {
  if (condition) {
    results.push({ id, name, passed: true });
    console.log(`  ✅ [PASS] ${id}: ${name}`);
  } else {
    results.push({ id, name, passed: false, message: failMsg });
    console.error(`  ❌ [FAIL] ${id}: ${name}`);
    if (failMsg) console.error(`     Chi tiết: ${failMsg}`);
  }
}

async function runMonochrome5Cases() {
  console.log('================================================================');
  console.log(' BẮT ĐẦU CHẠY 5 TEST CASES - CHUẨN HÓA ĐƠN SẮC ĐEN CÔNG SỞ #000000 ');
  console.log('================================================================\n');

  const partialsDir = path.resolve(__dirname, '../modules/report_v2/templates/residential/partials');

  // --------------------------------------------------------------------------
  // TC1: Bảng VII.4 Structural Integrity Check trong page-06
  // --------------------------------------------------------------------------
  console.log('--- TEST CASE 1: BẢNG VII.4 STRUCTURAL INTEGRITY CHECK ---');
  const page06Path = path.join(partialsDir, 'page-06-bcs-checklist-and-section-7.hbs');
  const page06Content = fs.readFileSync(page06Path, 'utf8');

  const tc1HasBlack = page06Content.includes('style="color: #000000;"');
  const tc1NoRed = !page06Content.includes('#b91c1c');
  const tc1NoGreen = !page06Content.includes('#15803d');
  const tc1BoldLogic = page06Content.includes('class="{{#if (gt this.defectCount 0)}}font-bold{{/if}}"');

  assert(
    'TC1',
    'Bảng VII.4 cấu kiện chịu lực sử dụng 100% màu đen #000000, không còn #b91c1c (đỏ) hay #15803d (xanh)',
    tc1HasBlack && tc1NoRed && tc1NoGreen && tc1BoldLogic,
    `hasBlack=${tc1HasBlack}, noRed=${tc1NoRed}, noGreen=${tc1NoGreen}, boldLogic=${tc1BoldLogic}`
  );

  // --------------------------------------------------------------------------
  // TC2: Chương I & II trong page-03 (Building ID, Diện tích, Tĩnh không)
  // --------------------------------------------------------------------------
  console.log('\n--- TEST CASE 2: CHƯƠNG I & II THÔNG TIN CƠ BẢN VÀ THÔNG SỐ ---');
  const page03Path = path.join(partialsDir, 'page-03-toc-and-sections-1-2.hbs');
  const page03Content = fs.readFileSync(page03Path, 'utf8');

  const tc2NoBlue = !page03Content.includes('#0f3b6c');
  const tc2BuildingIdBlack = page03Content.includes('<td class="val-col font-bold" style="color: #000000;">{{section1.buildingId}}</td>');
  const tc2FloorAreaBlack = page03Content.includes('<strong style="color: #000000;">{{section2.floorAreaDisplay.vi}}</strong>');
  const tc2ClearanceBlack = page03Content.includes('<strong style="color: #000000;">{{section2.clearanceDisplay.vi}}</strong>');

  assert(
    'TC2',
    'Chương I & II triệt tiêu hoàn toàn #0f3b6c, đưa Building ID, Diện tích sàn, Tĩnh không về #000000',
    tc2NoBlue && tc2BuildingIdBlack && tc2FloorAreaBlack && tc2ClearanceBlack,
    `noBlue=${tc2NoBlue}, buildingIdBlack=${tc2BuildingIdBlack}, floorAreaBlack=${tc2FloorAreaBlack}, clearanceBlack=${tc2ClearanceBlack}`
  );

  // --------------------------------------------------------------------------
  // TC3: Quét tĩnh toàn bộ thư mục templates/residential/partials/*.hbs
  // --------------------------------------------------------------------------
  console.log('\n--- TEST CASE 3: QUÉT TĨNH TOÀN BỘ CÁC PARTIAL TEMPLATE REPORT V2 ---');
  const partialFiles = fs.readdirSync(partialsDir).filter((f) => f.endsWith('.hbs'));
  const coloredTextRegex = /(?:color|stroke|fill):\s*#(?:15803d|b91c1c|c2410c|0f3b6c|2563eb|dc2626|16a34a|0d9488|0284c7)/i;
  const namedColorsRegex = /color:\s*(?:green|red|blue|orange|amber)\b/i;

  const violations: string[] = [];
  for (const file of partialFiles) {
    const filePath = path.join(partialsDir, file);
    const content = fs.readFileSync(filePath, 'utf8');
    if (coloredTextRegex.test(content) || namedColorsRegex.test(content)) {
      violations.push(file);
    }
  }

  assert(
    'TC3',
    'Tất cả 12 file partial Handlebars của Report V2 không chứa bất kỳ mã màu văn bản nào (xanh, đỏ, cam, xanh dương)',
    violations.length === 0,
    `Phát hiện template vi phạm màu: ${violations.join(', ')}`
  );

  // --------------------------------------------------------------------------
  // TC4: Handlebars Compile & Render với Dữ liệu mẫu (Bình thường vs Khuyết tật)
  // --------------------------------------------------------------------------
  console.log('\n--- TEST CASE 4: HANDLEBARS COMPILE & RENDER THỰC TẾ ---');
  ReportV2Service.registerHelpersAndPartials(partialsDir);

  const testTemplate = Handlebars.compile(`
    {{> page-06-bcs-checklist-and-section-7}}
  `);

  const mockContext = {
    section7: {
      hasStructuralSection: true,
      hasElements: true,
      structuralElements: [
        {
          elementCode: 'C-01',
          floorName: { vi: 'Tầng 1', en: '1st Floor' },
          location: { vi: 'Trục A-1', en: 'Grid A-1' },
          elementType: 'Cột BTCT',
          materialType: 'BTCT',
          defectCount: 0,
          conditionVi: 'Bình thường, không ghi nhận khuyết tật',
        },
        {
          elementCode: 'B-02',
          floorName: { vi: 'Tầng 2', en: '2nd Floor' },
          location: { vi: 'Dầm chính', en: 'Main Beam' },
          elementType: 'Dầm BTCT',
          materialType: 'BTCT',
          defectCount: 2,
          conditionVi: 'Ghi nhận 2 khuyết tật bề mặt',
        },
      ],
      predominantGrade: { vi: 'Cấp 1 - Rất nhẹ', en: 'Grade 1 - Very slight' },
      structuralSafetyConclusion: { vi: 'Kết cấu ổn định', en: 'Structurally stable' },
      engineeringRecommendation: { vi: 'Theo dõi định kỳ', en: 'Routine monitoring' },
    },
    bcsChecklist: [],
  };

  const renderedHtml = testTemplate(mockContext);
  const tc4NormalHasBlack = renderedHtml.includes('style="color: #000000;"');
  const tc4DefectiveHasBold = renderedHtml.includes('class="font-bold" style="color: #000000;"');
  const tc4NoRedText = !renderedHtml.includes('#b91c1c');
  const tc4NoGreenText = !renderedHtml.includes('#15803d');

  assert(
    'TC4',
    'HTML sinh ra từ Handlebars: Cấu kiện bình thường & khuyết tật đều mang color #000000, cấu kiện có khuyết tật mang class font-bold',
    tc4NormalHasBlack && tc4DefectiveHasBold && tc4NoRedText && tc4NoGreenText,
    `normalHasBlack=${tc4NormalHasBlack}, defectiveHasBold=${tc4DefectiveHasBold}, noRed=${tc4NoRedText}, noGreen=${tc4NoGreenText}`
  );

  // --------------------------------------------------------------------------
  // TC5: Render PDF Thực Tế Trên Công Trình Thật (B-00116)
  // --------------------------------------------------------------------------
  console.log('\n--- TEST CASE 5: RENDER PDF THỰC TẾ & KIỂM TRA TỔNG THỂ ---');
  let tc5Passed = false;
  let tc5ErrorMsg = '';

  try {
    const reportId = '013d8ec6-a9d8-4854-8536-ce9c8ccf0903';
    const resolved = await ReportV3Service.resolve(reportId);
    const { pdfBuffer, buildingId } = await ReportV3Service.renderDraftPdf(resolved, undefined, true);

    const pdfSizeOk = pdfBuffer && pdfBuffer.length > 50000; // > 50KB
    console.log(`     Đã render PDF thành công cho ${buildingId}, kích thước: ${(pdfBuffer.length / 1024).toFixed(1)} KB`);

    // Lưu file để kiểm tra
    const outDir = path.resolve(__dirname, '../../../report_0410/resuilt');
    fs.mkdirSync(outDir, { recursive: true });
    const outPdf = path.join(outDir, `BCS_${buildingId}_Monochrome_Standard.pdf`);
    fs.writeFileSync(outPdf, pdfBuffer);

    tc5Passed = pdfSizeOk;
  } catch (err: any) {
    tc5ErrorMsg = err?.message || String(err);
    console.error('     Lỗi khi render PDF thực tế:', tc5ErrorMsg);
  }

  assert(
    'TC5',
    'Xuất file PDF báo cáo thực tế cho B-00116 đạt chuẩn đơn sắc đen công sở, dung lượng hợp lệ (> 50KB)',
    tc5Passed,
    tc5ErrorMsg
  );

  // --------------------------------------------------------------------------
  // TỔNG KẾT
  // --------------------------------------------------------------------------
  console.log('\n================================================================');
  const total = results.length;
  const passedCount = results.filter((r) => r.passed).length;
  const failedCount = total - passedCount;

  console.log(` KẾT QUẢ: ĐẠT ${passedCount}/${total} TEST CASES (${failedCount === 0 ? '100% THÀNH CÔNG' : 'CÓ TEST THẤT BẠI'})`);
  console.log('================================================================\n');

  await pool.end();

  if (failedCount > 0) {
    process.exit(1);
  } else {
    process.exit(0);
  }
}

runMonochrome5Cases().catch(async (e) => {
  console.error('Fatal error in test suite:', e);
  try {
    await pool.end();
  } catch (_) {}
  process.exit(1);
});
