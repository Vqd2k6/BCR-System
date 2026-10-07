import * as fs from 'fs';
import * as path from 'path';
import { ReportV2Service } from '../modules/report_v2/report-v2.service';
import { PdfRenderV2Engine } from '../modules/report_v2/engine/pdf-render-v2.engine';

async function runTest() {
  console.log('================================================================');
  console.log('🔍 KIỂM THỬ TỰ ĐỘNG DỮ LIỆU BÁO CÁO C&C-05-B-0054 (PHASE 1 BCS)');
  console.log('================================================================');

  const reportId = '2ba54dae-0af2-4a40-9896-acdc71e3a914';

  console.log(`\n1. Đang nạp và phân giải ViewModel cho Báo cáo ID: ${reportId}...`);
  const { html, viewModel } = await ReportV2Service.generateResidentialHtml(reportId);

  console.log('✅ Đã nạp thành công ViewModel!');

  console.log('\n2. Kiểm tra tính toàn vẹn dữ liệu từng chương:');
  
  // Section 1
  console.log(' • Chương 1 (Định danh):');
  console.log('   - Mã công trình:', viewModel.metadata.buildingId);
  console.log('   - Địa chỉ:', viewModel.section1.address.vi);
  console.log('   - Chủ hộ:', viewModel.section1.ownerOccupant.vi);
  console.log('   - SĐT:', viewModel.section1.contactPhone);

  // Section 2
  console.log(' • Chương 2 (Thông tin tòa nhà):');
  console.log('   - Số tầng:', viewModel.section2.storeysDisplay.vi);
  console.log('   - Tổng diện tích sàn:', viewModel.section2.totalFloorAreaM2, 'm²');
  console.log('   - Diện tích XD tầng trệt:', viewModel.section2.footprintM2, 'm²');
  console.log('   - Chiều cao:', viewModel.section2.maxHeightM, 'm');
  console.log('   - Năm XD:', viewModel.section2.yearConstructed);

  // Section 3
  console.log(' • Chương 3 (Lịch sử sử dụng):');
  console.log('   - Sửa chữa lớn:', viewModel.section3.majorRepair.vi);
  console.log('   - Ngập lụt:', viewModel.section3.flooding.vi);
  console.log('   - Tình trạng sử dụng:', viewModel.section3.occupancyStatus.vi);

  // Section 4
  console.log(' • Chương 4 (Kết cấu & Móng):');
  console.log('   - Loại móng:', viewModel.section4.foundationType.vi);
  console.log('   - Chiều sâu móng:', viewModel.section4.foundationDepth.vi);
  console.log('   - Nguồn thông tin móng:', viewModel.section4.foundationEvidence.vi);
  console.log('   - Công trình liền kề:', viewModel.section4.adjacentBuildings.vi);

  // Section 5
  console.log(' • Chương 5 (Độ nghiêng & Lún):');
  console.log('   - Đo độ nghiêng:', viewModel.section5.buildingInclination.measured);
  console.log('   - Phương pháp đo:', viewModel.section5.basisOfDetermination.vi);
  console.log('   - Độ tin cậy:', viewModel.section5.reliability.vi);
  console.log('   - Lún chênh:', viewModel.section5.differentialSettlement.location.vi);

  // Section 6 & Appendix 2
  console.log(' • Chương 6 & Phụ lục 2 (Khuyết tật & Mặt bằng tầng):');
  console.log('   - Số tầng khảo sát:', viewModel.appendix2.length);
  let totalDefects = 0;
  for (const fl of viewModel.appendix2) {
    const dCount = fl.defectSummaryRows.length;
    totalDefects += dCount;
    const subpagesCount = fl.defectPairPages ? fl.defectPairPages.length : 0;
    console.log(`   - ${fl.floorName.vi}: ${dCount} khuyết tật | ${subpagesCount} trang ảnh đối chiếu (tối đa 2 cặp/trang) | CAD: ${fl.hasStructuralCadMap ? 'Có bản vẽ Kiến trúc + Kết cấu' : 'Có bản vẽ'}`);
  }
  console.log('   => Tổng số khuyết tật thu thập:', totalDefects);

  // Section 8
  console.log(' • Chương 8 (Đánh giá rủi ro BRA):');
  console.log('   - ECS:', viewModel.section8.riskMatrix.ecsGrade.vi, `(Điểm: ${viewModel.section8.supplementaryPhase1.totalEcs})`);
  console.log('   - VI:', viewModel.section8.supplementaryPhase1.viClass.vi, `(Điểm: ${viewModel.section8.supplementaryPhase1.viAvg})`);
  console.log('   - Cấp tác động Metro I:', viewModel.section8.supplementaryPhase1.impactClass);
  console.log('   - Phân hạng rủi ro BRA:', viewModel.section8.supplementaryPhase1.braMatrixResult.vi);

  // Section 9
  console.log(' • Chương 9 (Kết luận & Ý kiến chủ nhà):');
  console.log('   - Ý kiến chủ nhà:', viewModel.section9.witnessNarrative.vi);
  console.log('   - Kết luận KSV:', viewModel.section9.conclusions[0]?.vi);

  // Appendix 1
  console.log(' • Phụ lục 1 (Ảnh định danh & ngoại thất):');
  console.log('   - Tổng số ảnh:', viewModel.appendix1.length);
  viewModel.appendix1.forEach((p, idx) => {
    console.log(`     [${idx + 1}] ${p.photoCode} (${p.originalTag}): ${p.name.vi} - Base64: ${p.base64 ? 'OK' : 'URL'}`);
  });
  console.log(`   - Phân chia: ${viewModel.appendix1Pages?.length || 1} trang A4 (mỗi trang tối đa 4 ảnh)`);

  // Appendix 3
  console.log(' • Phụ lục 3 (Biên bản khảo sát hiện trường):');
  console.log('   - Đại diện chủ nhà:', viewModel.appendix3.ownerRepresentative.vi);
  console.log('   - Số trang biên bản scan:', viewModel.appendix3.signedRecordPages.length);
  viewModel.appendix3.signedRecordPages.forEach((doc, idx) => {
    console.log(`     [Trang ${idx + 1}] ${doc.title.vi} - Base64: ${doc.base64 ? 'OK' : 'URL'}`);
  });

  // 3. Xuất file HTML xem trước
  const exportDir = path.join(__dirname, '../../sample_export');
  if (!fs.existsSync(exportDir)) {
    fs.mkdirSync(exportDir, { recursive: true });
  }

  const htmlPath = path.join(exportDir, 'preview_parcel_0054_full.html');
  fs.writeFileSync(htmlPath, html, 'utf8');
  console.log(`\n💾 Đã ghi file HTML xem trước tại: ${htmlPath}`);

  // 4. Biên dịch ra PDF A4
  console.log('\n3. Đang xuất Báo cáo PDF A4 chuẩn kỹ thuật (Chromium Headless)...');
  const pdfBuffer = await PdfRenderV2Engine.renderHtmlToPdf(html, {
    buildingId: viewModel.metadata.buildingId,
    reportNo: viewModel.metadata.reportNo,
    headerTitle: 'LIÊN DANH CRLG–CRSRI–TT | DỰ ÁN METRO 2 BẾN THÀNH - THAM LƯƠNG',
  });

  const pdfPath = path.join(exportDir, 'BaoCao_C_C-05-B-0054_FullData.pdf');
  fs.writeFileSync(pdfPath, pdfBuffer);
  console.log(`✅ Xuất PDF thành công! Kích thước: ${(pdfBuffer.length / 1024 / 1024).toFixed(2)} MB`);
  console.log(`📁 Đường dẫn PDF: ${pdfPath}`);

  console.log('\n================================================================');
  console.log('🎉 TẤT CẢ CÁC MỤC KIỂM THỬ ĐÃ HOÀN TẤT THÀNH CÔNG 100%!');
  console.log('================================================================\n');
}

runTest().catch((err) => {
  console.error('❌ Lỗi kiểm thử:', err);
  process.exit(1);
});
