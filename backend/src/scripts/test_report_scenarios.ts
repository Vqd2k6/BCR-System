/**
 * Test Suite Phase 6: Kiểm thử toàn diện Ma trận kịch bản đa dạng (N chập K Scenarios)
 * Xác nhận hệ thống Adaptive Layout tự động co giãn và xử lý các tình huống thực địa.
 */
import fs from 'fs';
import path from 'path';
import Handlebars from 'handlebars';
import { ReportV2ViewModelMapper } from '../modules/report_v2/mappers/report-v2-viewmodel.mapper';
import { ReportV2Service } from '../modules/report_v2/report-v2.service';
import { PdfRenderV2Engine } from '../modules/report_v2/engine/pdf-render-v2.engine';

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ FAILED: ${message}`);
    process.exit(1);
  } else {
    console.log(`✅ PASSED: ${message}`);
  }
}

async function runScenarioMatrixTests() {
  console.log('🚀 Bắt đầu Kiểm thử Ma trận Kịch bản Bố cục (Adaptive Scenarios Matrix)...');

  const { template: compiled, styles: stylesSource } = ReportV2Service.getCompiledTemplate();

  // =========================================================================
  // KỊCH BẢN 1: BÁO CÁO TOÀN DIỆN (FULL DATA SCENARIO)
  // Có đầy đủ P01..P05, cả 2 bản vẽ CAD_ARCH và CAD_STRUCT, có khuyết tật D-01/D-02.
  // =========================================================================
  console.log('\n--- KỊCH BẢN 1: BÁO CÁO TOÀN DIỆN (FULL DATA) ---');
  const fullMockData = {
    project_parcel_code: 'C&C-01-B-01064',
    zone_id: 'ZONE_09',
    survey_date: '26/09/2026 (10:20)',
    surveyor_name: 'Nguyễn Trọng Tuấn',
    zone_admin_name: 'Lê Văn Kiểm',
    super_admin_name: 'Trần Đình Duyệt',
    survey_data_json: {
      photos: {
        p01: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><text y="50">P01</text></svg>',
        p02: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><text y="50">P02</text></svg>',
        p03: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><text y="50">P03</text></svg>',
        p04: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><text y="50">P04</text></svg>',
        p05: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><text y="50">P05</text></svg>',
      },
      floors: [
        {
          floorId: 'FLOOR_01',
          floorName: 'Tầng 1 (Tầng Trệt)',
          damageMapUrl: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg"><text y="50">CAD_ARCH</text></svg>',
          structuralMapUrl: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg"><text y="50">CAD_STRUCT</text></svg>',
          defects: [
            {
              id: 'D_01',
              defectCode: 'D-01',
              location: 'Tường trục 2/A',
              crackWidth: '0.3mm',
              crackLength: '1.2m',
              burlandGrade: 1,
              description: 'Vết nứt chân chim lớp vữa tô',
              contextPhotoUrl: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg"><text y="50">Ctx</text></svg>',
              crackGaugePhotoUrl: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg"><text y="50">Gauge</text></svg>',
            },
          ],
        },
      ],
    },
  };

  const vm1 = ReportV2ViewModelMapper.buildViewModel(fullMockData);
  assert(vm1.scenarioFlags.exteriorPhotoLayout === 'grid_6', 'Kịch bản 1: exteriorPhotoLayout là grid_6');
  assert(vm1.scenarioFlags.hasSideOrRearPhotos === true, 'Kịch bản 1: hasSideOrRearPhotos = true');
  assert(vm1.scenarioFlags.hasTiltPhoto === true, 'Kịch bản 1: hasTiltPhoto = true');
  assert(vm1.scenarioFlags.hasStructuralCadMap === true, 'Kịch bản 1: hasStructuralCadMap = true');
  assert(vm1.scenarioFlags.hasAnyDefects === true, 'Kịch bản 1: hasAnyDefects = true');

  const html1 = compiled({ ...vm1, styles: stylesSource });
  assert(html1.includes('P-01') && html1.includes('Biển số nhà'), 'HTML 1 chứa P-01');
  assert(html1.includes('P-03') && html1.includes('Mặt bên'), 'HTML 1 chứa P-03');
  assert(html1.includes('P-05') && html1.includes('độ nghiêng'), 'HTML 1 chứa P-05');
  assert(html1.includes('D-01'), 'HTML 1 chứa khuyết tật D-01');
  assert(!html1.includes('<div class="party-wall-notice">'), 'HTML 1 không hiển thị party-wall-notice trong body');

  // =========================================================================
  // KỊCH BẢN 2: NHÀ ỐNG SÁT VÁCH (PARTY WALL - THIẾU P-03, KHÔNG ĐO NGHIÊNG P-05)
  // Thực tế phổ biến nhất tại TP.HCM: hai bên nhà giáp ranh, không có mặt thoáng.
  // =========================================================================
  console.log('\n--- KỊCH BẢN 2: NHÀ ỐNG SÁT VÁCH (PARTY WALL, THIẾU P-03, THIẾU P-05) ---');
  const partyWallMockData = {
    project_parcel_code: 'C&C-01-B-01065',
    zone_id: 'ZONE_09',
    survey_date: '26/09/2026 (11:00)',
    surveyor_name: 'Nguyễn Trọng Tuấn',
    zone_admin_name: 'Lê Văn Kiểm',
    super_admin_name: 'Trần Đình Duyệt',
    survey_data_json: {
      photos: {
        p01: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><text y="50">P01</text></svg>',
        p02: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><text y="50">P02</text></svg>',
        p04: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100"><text y="50">P04</text></svg>',
        // Không có p03 và p05
      },
      floors: [
        {
          floorId: 'FLOOR_01',
          floorName: 'Tầng 1 (Tầng Trệt)',
          damageMapUrl: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg"><text y="50">CAD_ARCH</text></svg>',
        },
      ],
    },
  };

  const vm2 = ReportV2ViewModelMapper.buildViewModel(partyWallMockData);
  assert(vm2.scenarioFlags.exteriorPhotoLayout === 'party_wall_3', 'Kịch bản 2: exteriorPhotoLayout tự động chuyển thành party_wall_3');
  assert(vm2.scenarioFlags.hasSideOrRearPhotos === false, 'Kịch bản 2: hasSideOrRearPhotos = false');
  assert(vm2.scenarioFlags.hasTiltPhoto === false, 'Kịch bản 2: hasTiltPhoto = false');

  const html2 = compiled({ ...vm2, styles: stylesSource });
  assert(html2.includes('<div class="party-wall-notice">'), 'HTML 2 hiển thị khung party-wall-notice');
  assert(html2.includes('Công trình dạng nhà liên kế') && html2.includes('giáp ranh hai bên'), 'HTML 2 ghi chú kỹ thuật tường chung sát vách');
  assert(!html2.includes('[ Chưa có ảnh P-03 ]'), 'HTML 2 không render placeholder rỗng P-03');
  assert(!html2.includes('[ Chưa có ảnh P-05 ]'), 'HTML 2 không render placeholder rỗng P-05');

  // =========================================================================
  // KỊCH BẢN 3: ĐƠN CAD KIẾN TRÚC (KHÔNG CÓ BẢN VẼ KẾT CẤU CAD_STRUCT / CAD_E)
  // Bản vẽ kiến trúc mở rộng toàn trang Full-Width, ẩn slot kết cấu.
  // =========================================================================
  console.log('\n--- KỊCH BẢN 3: ĐƠN CAD KIẾN TRÚC (KHÔNG CÓ CAD KẾT CẤU) ---');
  const singleCadMockData = {
    project_parcel_code: 'C&C-01-B-01066',
    zone_id: 'ZONE_09',
    survey_date: '26/09/2026 (11:30)',
    surveyor_name: 'Nguyễn Trọng Tuấn',
    zone_admin_name: 'Lê Văn Kiểm',
    super_admin_name: 'Trần Đình Duyệt',
    survey_data_json: {
      floors: [
        {
          floorId: 'FLOOR_01',
          floorName: 'Tầng 1 (Tầng Trệt)',
          damageMapUrl: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg"><text y="50">CAD_ARCH_ONLY</text></svg>',
          // Không có structuralMapUrl
        },
      ],
    },
  };

  const vm3 = ReportV2ViewModelMapper.buildViewModel(singleCadMockData);
  assert(vm3.appendix2[0].hasStructuralCadMap === false, 'Kịch bản 3: Tầng trệt hasStructuralCadMap = false');

  const html3 = compiled({ ...vm3, styles: stylesSource });
  assert(html3.includes('cad-map-container full-width'), 'HTML 3 hiển thị CAD dạng full-width');
  assert(!html3.includes('Mặt Bằng Cấu Kiện Kết Cấu Chịu Lực E'), 'HTML 3 ẩn bản vẽ kết cấu khi không có');

  // =========================================================================
  // KỊCH BẢN 4: KẾT CẤU NGUYÊN VẸN (ZERO DEFECTS / KHÔNG CÓ NỨT NẺ)
  // Hiển thị Banner xác nhận kết cấu ổn định, ẩn bảng khuyết tật và ảnh đối chiếu.
  // =========================================================================
  console.log('\n--- KỊCH BẢN 4: KẾT CẤU NGUYÊN VẸN (ZERO DEFECTS) ---');
  const zeroDefectsMockData = {
    project_parcel_code: 'C&C-01-B-01067',
    zone_id: 'ZONE_09',
    survey_date: '26/09/2026 (12:00)',
    surveyor_name: 'Nguyễn Trọng Tuấn',
    zone_admin_name: 'Lê Văn Kiểm',
    super_admin_name: 'Trần Đình Duyệt',
    survey_data_json: {
      floors: [
        {
          floorId: 'FLOOR_01',
          floorName: 'Tầng 1 (Tầng Trệt)',
          damageMapUrl: 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg"><text y="50">CAD_ARCH</text></svg>',
          defects: [], // Hoàn toàn không có defect nào
        },
      ],
    },
  };

  const vm4 = ReportV2ViewModelMapper.buildViewModel(zeroDefectsMockData);
  assert(vm4.scenarioFlags.hasAnyDefects === false, 'Kịch bản 4: hasAnyDefects = false');
  assert(vm4.appendix2[0].hasDefects === false, 'Kịch bản 4: Tầng 1 hasDefects = false');

  const html4 = compiled({ ...vm4, styles: stylesSource });
  assert(html4.includes('<div class="zero-defects-banner">'), 'HTML 4 hiển thị zero-defects-banner');
  assert(html4.includes('không phát hiện vết nứt') || html4.includes('không ghi nhận vết nứt'), 'HTML 4 có thông báo kết cấu nguyên vẹn');
  assert(!html4.includes('Bảng 2.'), 'HTML 4 ẩn bảng tổng hợp vết nứt của tầng không khuyết tật');

  // =========================================================================
  // KỊCH BẢN 5: KIỂM TRA QUY CHUẨN HEADER & FOOTER TOÀN DIỆN
  // Header 3 cột THACO REC chỉ xuất hiện DUY NHẤT ở Trang bìa.
  // Tuyệt đối không còn thanh floating toolbar.
  // =========================================================================
  console.log('\n--- KỊCH BẢN 5: KIỂM TRA QUY CHUẨN HEADER DUY NHẤT & KHÔNG TOOLBAR ---');
  const headerTableCount = (html1.match(/<table class="report-running-header">/g) || []).length;
  assert(headerTableCount === 1, `Header 3 cột chỉ xuất hiện đúng 1 lần trên toàn bộ tài liệu (thực tế: ${headerTableCount})`);

  const toolbarCount = (html1.match(/screen-floating-toolbar/g) || []).length;
  assert(toolbarCount === 0, `Thanh floating toolbar đã được xóa bỏ hoàn toàn (thực tế: ${toolbarCount})`);

  const subpageTopbarCount = (html1.match(/<div class="report-subpage-topbar">/g) || []).length;
  assert(subpageTopbarCount >= 10, `Các trang con có thanh running subpage topbar trang nhã (thực tế: ${subpageTopbarCount})`);

  console.log('\n🎉 TẤT CẢ 5 KỊCH BẢN TRONG MA TRẬN ĐÃ ĐẠT CHUẨN 100%!');
}

runScenarioMatrixTests().catch((err) => {
  console.error('❌ Lỗi:', err);
  process.exit(1);
});
