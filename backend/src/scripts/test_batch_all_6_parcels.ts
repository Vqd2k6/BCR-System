import * as fs from 'fs';
import * as path from 'path';
import { ReportV2Service } from '../modules/report_v2/report-v2.service';
import { PdfRenderV2Engine } from '../modules/report_v2/engine/pdf-render-v2.engine';

interface TestCase {
  code: string;
  reportId: string;
  expectedScenario: string;
}

const testCases: TestCase[] = [
  { code: 'C&C-05-B-0054', reportId: '2ba54dae-0af2-4a40-9896-acdc71e3a914', expectedScenario: 'High defects (18 defects, 4 floors, full ext photos)' },
  { code: 'C&C-05-B-0056', reportId: 'fe13606f-0c6f-43d3-8b73-58d1c35e7ffb', expectedScenario: 'Zero defects (0 defects, 3 floors, 3 minutes)' },
  { code: 'C&C-05-B-0058', reportId: 'c98b9bca-ea5e-4372-bdd0-b04dc663a767', expectedScenario: 'Zero defects (0 defects, 2 floors, 2 minutes)' },
  { code: 'C&C-05-B-0154', reportId: '06286cda-6111-4880-aab3-081834e75233', expectedScenario: '6 floors (tallest building, 6 defects, mixed floors)' },
  { code: 'C&C-05-B-0156', reportId: '28b8dd21-5f0b-425e-94e5-f69d56ae8006', expectedScenario: 'Single defect (1 defect in 4 floors, party wall, 2 minutes)' },
  { code: 'C&C-05-B-0158', reportId: '3508761d-2cf5-4edf-988e-3d11865f7f24', expectedScenario: '1 floor (single storey, 4 defects, party wall)' },
];

async function runBatchTests() {
  console.log('================================================================');
  console.log('🚀 KIỂM THỬ TỰ ĐỘNG BÁO CÁO V2 CHO TOÀN BỘ 6 MÃ THỬA ĐẤT THỰC TẾ');
  console.log('================================================================\n');

  const exportDir = path.join(__dirname, '../../sample_export/batch_test');
  if (!fs.existsSync(exportDir)) {
    fs.mkdirSync(exportDir, { recursive: true });
  }

  const results: Array<{
    code: string;
    reportId: string;
    status: 'SUCCESS' | 'FAILED';
    storeys: number;
    totalDefects: number;
    extPhotosCount: number;
    minutesCount: number;
    pdfSizeMb: string;
    error?: string;
  }> = [];

  for (const tc of testCases) {
    console.log(`----------------------------------------------------------------`);
    console.log(`▶ Đang xử lý: ${tc.code} (${tc.expectedScenario})...`);
    console.log(`  Report ID: ${tc.reportId}`);

    try {
      // 1. Sinh HTML & ViewModel
      const { html, viewModel } = await ReportV2Service.generateResidentialHtml(tc.reportId);

      // Thống kê nhanh
      let totalDefects = 0;
      for (const fl of viewModel.appendix2) {
        totalDefects += fl.defectSummaryRows.length;
      }

      const storeys = viewModel.appendix2.length;
      const extPhotosCount = viewModel.appendix1.length;
      const minutesCount = viewModel.appendix3.signedRecordPages.length;

      console.log(`  📊 Thống kê: ${storeys} tầng | ${totalDefects} khuyết tật | ${extPhotosCount} ảnh ngoại quan | ${minutesCount} trang biên bản`);

      // 2. Lưu HTML
      const htmlFile = path.join(exportDir, `preview_${tc.code}.html`);
      fs.writeFileSync(htmlFile, html, 'utf8');

      // 3. Render PDF
      console.log(`  ⏳ Đang render PDF Chromium...`);
      const pdfBuffer = await PdfRenderV2Engine.renderHtmlToPdf(html, {
        buildingId: viewModel.metadata.buildingId,
        reportNo: viewModel.metadata.reportNo,
        headerTitle: 'LIÊN DANH CRLG–CRSRI–TT | DỰ ÁN METRO 2 BẾN THÀNH - THAM LƯƠNG',
      });

      const pdfFile = path.join(exportDir, `BaoCao_${tc.code}.pdf`);
      fs.writeFileSync(pdfFile, pdfBuffer);
      const pdfSizeMb = (pdfBuffer.length / 1024 / 1024).toFixed(2);
      console.log(`  ✅ Thành công! PDF size: ${pdfSizeMb} MB -> ${pdfFile}`);

      results.push({
        code: tc.code,
        reportId: tc.reportId,
        status: 'SUCCESS',
        storeys,
        totalDefects,
        extPhotosCount,
        minutesCount,
        pdfSizeMb,
      });
    } catch (err: any) {
      console.error(`  ❌ LỖI KHI XỬ LÝ ${tc.code}:`, err.message);
      results.push({
        code: tc.code,
        reportId: tc.reportId,
        status: 'FAILED',
        storeys: 0,
        totalDefects: 0,
        extPhotosCount: 0,
        minutesCount: 0,
        pdfSizeMb: '0',
        error: err.message,
      });
    }
  }

  console.log('\n================================================================');
  console.log('📋 TỔNG KẾT KẾT QUẢ KIỂM THỬ 6 TEST CASES:');
  console.log('================================================================');
  console.table(results);
}

runBatchTests().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
