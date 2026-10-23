/**
 * Test Suite Phase 4: Kiểm thử Rendering PDF A4 thực tế bằng Chromium Headless Pool
 */
import fs from 'fs';
import path from 'path';
import Handlebars from 'handlebars';
import { ReportViewModelMapper } from '../modules/report/mappers/report-v2-viewmodel.mapper';
import { ReportService } from '../modules/report/report-v2.service';
import { PdfRenderEngine } from '../modules/report/engine/pdf-render.engine';

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ FAILED: ${message}`);
    process.exit(1);
  } else {
    console.log(`✅ PASSED: ${message}`);
  }
}

async function testPdfRender() {
  console.log('--- 1. Chuẩn bị ViewModel & HTML ---');
  const { template: compiled, styles: stylesSource } = ReportService.getCompiledTemplate();

  const mockReport = {
    project_parcel_code: 'C&C-01-B-01064',
    zone_id: 'ZONE_09',
    survey_date: '26/09/2026 (10:20)',
    surveyor_name: 'Nguyễn Trọng Tuấn',
    zone_admin_name: 'Lê Văn Kiểm',
    super_admin_name: 'Trần Đình Duyệt',
    survey_data_json: {
      metroOffsetDistance: '30.0m',
      ecs: { ecsClass: 'MODERATE' },
    },
  };

  const viewModel = ReportViewModelMapper.buildViewModel(mockReport);
  const htmlOutput = compiled({
    ...viewModel,
    styles: stylesSource,
  });

  console.log('\n--- 2. Khởi tạo Chromium và Render PDF A4 ---');
  const startTime = Date.now();
  const pdfBuffer = await PdfRenderEngine.renderHtmlToPdf(htmlOutput, {
    buildingId: viewModel.metadata.buildingId,
    reportNo: viewModel.metadata.reportNo,
    headerTitle: 'LIÊN DANH CRLG–CRSRI–TT | DỰ ÁN METRO 2 BẾN THÀNH - THAM LƯƠNG',
  });
  const duration = Date.now() - startTime;

  console.log(`⏱️ Thời gian render PDF: ${duration} ms`);
  assert(Buffer.isBuffer(pdfBuffer), 'Kết quả trả về là Buffer');
  assert(pdfBuffer.length > 50000, `Dung lượng PDF hợp lệ: ${pdfBuffer.length} bytes`);

  // Kiểm tra Header Magic Bytes của file PDF (%PDF-)
  const magic = pdfBuffer.slice(0, 5).toString('ascii');
  assert(magic === '%PDF-', `Định dạng chuẩn PDF (%PDF-), thực tế: ${magic}`);

  const outputPath = path.join(__dirname, '../modules/report/test_output_report_v2.pdf');
  fs.writeFileSync(outputPath, pdfBuffer);
  console.log(`\n💾 Đã lưu file PDF thực nghiệm tại: ${outputPath}`);

  console.log('\n🎉 TOÀN BỘ CÁC BÀI TEST PHASE 4 ĐÃ VƯỢT QUA 100%!');
  process.exit(0);
}

testPdfRender().catch((err) => {
  console.error('❌ Lỗi kiểm thử PDF render:', err);
  process.exit(1);
});
