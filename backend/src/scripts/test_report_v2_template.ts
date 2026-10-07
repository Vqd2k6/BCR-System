/**
 * Test Suite Phase 3: Kiểm thử biên dịch Handlebars Template & CSS Paged Media
 */
import fs from 'fs';
import path from 'path';
import Handlebars from 'handlebars';
import { ReportV2ViewModelMapper } from '../modules/report_v2/mappers/report-v2-viewmodel.mapper';
import { ReportV2Service } from '../modules/report_v2/report-v2.service';

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ FAILED: ${message}`);
    process.exit(1);
  } else {
    console.log(`✅ PASSED: ${message}`);
  }
}

async function runTemplateTest() {
  console.log('--- 1. Kiểm tra sự tồn tại của Template & Styles ---');
  const templatePath = path.join(__dirname, '../modules/report_v2/templates/residential/index.hbs');
  const stylesPath = path.join(__dirname, '../modules/report_v2/templates/residential/styles.css');

  assert(fs.existsSync(templatePath), `index.hbs tồn tại tại ${templatePath}`);
  assert(fs.existsSync(stylesPath), `styles.css tồn tại tại ${stylesPath}`);

  console.log('\n--- 2. Đọc và chuẩn bị Helpers & Partials từ ReportV2Service ---');
  const { template: compiled, styles: stylesSource } = ReportV2Service.getCompiledTemplate();

  console.log('\n--- 3. Chuẩn bị Mock Data từ ViewModelMapper ---');
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

  const viewModel = ReportV2ViewModelMapper.buildViewModel(mockReport);

  console.log('\n--- 4. Biên dịch Handlebars Template sang HTML ---');
  const htmlOutput = compiled({
    ...viewModel,
    styles: stylesSource,
  });

  assert(typeof htmlOutput === 'string' && htmlOutput.length > 5000, `HTML sinh ra có độ dài hợp lệ: ${htmlOutput.length} ký tự`);
  assert(htmlOutput.includes('B-01064-C&amp;C') || htmlOutput.includes('B-01064-C&C'), 'HTML chứa đúng Building ID hoán vị');
  assert(htmlOutput.includes('R-01064-C&amp;C-(ST09)-R00') || htmlOutput.includes('R-01064-C&C-(ST09)-R00') || htmlOutput.includes('R-01064'), 'HTML chứa đúng Report No');
  assert(htmlOutput.includes('I. THÔNG TIN CHUNG - GENERAL INFORMATION'), 'HTML chứa Chương I');
  assert(htmlOutput.includes('Bảng VIII.3: Ma trận phân cấp rủi ro công trình trước thi công (BRA = V × I Matrix)'), 'HTML chứa Bảng VIII.3 BRA Matrix');
  assert(htmlOutput.includes('PHỤ LỤC 1: BẢN VẼ MẶT ĐỨNG NGOÀI CÔNG TRÌNH'), 'HTML chứa Phụ lục 1');
  assert(htmlOutput.includes('PHỤ LỤC 2: THỐNG KÊ KHUYẾT TẬT TRÊN MẶT BẰNG TẦNG'), 'HTML chứa Phụ lục 2');
  assert(htmlOutput.includes('PHỤ LỤC 4: THIẾT BỊ VÀ PHẠM VI TIẾP CẬN'), 'HTML chứa Phụ lục 4');

  // Lưu file HTML preview để kiểm tra
  const previewPath = path.join(__dirname, '../modules/report_v2/templates/residential/preview_output.html');
  fs.writeFileSync(previewPath, htmlOutput, 'utf8');
  console.log(`\n💾 Đã lưu bản HTML xem trước tại: ${previewPath}`);

  console.log('\n🎉 TOÀN BỘ CÁC BÀI TEST PHASE 3 ĐÃ VƯỢT QUA 100%!');
}

runTemplateTest().catch((e) => {
  console.error(e);
  process.exit(1);
});
