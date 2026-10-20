/**
 * ============================================================================
 * COMPREHENSIVE REPORT AUDIT & VERIFICATION SUITE
 * Bộ kiểm thử toàn diện 7 phân hệ nghiệp vụ theo kế hoạch:
 * /Users/vqd2k6/.gemini/antigravity-ide/brain/c7de99b8-7533-4aa1-884c-85238e9107c5/plan_report_approval_and_data_audit.md
 *
 * Mỗi nghiệp vụ bao gồm 5 Test Cases thực tế chuyên sâu (Tổng cộng 35 Test Cases):
 * - Nghiệp vụ 1: Phân giải Tên Chủ Hộ & Người đại diện ký thay
 * - Nghiệp vụ 2: Kích thước công trình (Mặt tiền / Chiều sâu) & In '--' khi thiếu
 * - Nghiệp vụ 3: Độ nghiêng & Biến dạng (‰) - Loại bỏ lỗi chia 10
 * - Nghiệp vụ 4: Mục XII Bản vẽ hoàn công móng & Mục lục linh hoạt (Dynamic TOC)
 * - Nghiệp vụ 5: Đồng bộ Snapshot bất biến khi Xem trước (HTML Preview Sync)
 * - Nghiệp vụ 6: Sơ đồ không gian trang bìa khổ dọc 3:4 & Chiều cao <= 175px
 * - Nghiệp vụ 7: Xoay ảnh vật lý server-side bằng Sharp
 * ============================================================================
 */

import * as fs from 'fs';
import * as path from 'path';
import assert from 'assert';
import sharp from 'sharp';
import { pool } from '../database/db';
import { ReportV2ViewModelMapper } from '../modules/report_v2/mappers/report-v2-viewmodel.mapper';
import { Section5DeformationMapper } from '../modules/report_v2/mappers/sections/section-5-deformation.mapper';
import { Appendix3And4Mapper } from '../modules/report_v2/mappers/appendices/appendix-3-4-records.mapper';
import { ScenarioFlagsAndTocMapper } from '../modules/report_v2/mappers/sections/scenario-flags-and-toc.mapper';
import { ReportImageResolver } from '../modules/report_v2/services/report-image-resolver.service';
import { ReportV3Service } from '../modules/report_v3/report-v3.service';
import { ReportSnapshotService } from '../modules/report_v3/report-snapshot.service';
import { applyOverridesToReportV2 } from '../modules/report_v2/utils/report-override-v2.utils';
import { generateMetroSpatialVisualSvg } from '../modules/report_v2/utils/metro-spatial.utils';

interface TestCaseLog {
  domain: string;
  testCaseNumber: number;
  title: string;
  status: 'PASSED' | 'FAILED';
  errorDetails?: string;
  remediation?: string;
}

const auditLogs: TestCaseLog[] = [];

function recordResult(domain: string, tcNum: number, title: string, passed: boolean, error?: any, remediation?: string) {
  if (passed) {
    console.log(`  ✅ [${domain} - TC${tcNum}] PASSED: ${title}`);
    auditLogs.push({ domain, testCaseNumber: tcNum, title, status: 'PASSED' });
  } else {
    console.error(`  ❌ [${domain} - TC${tcNum}] FAILED: ${title}`);
    console.error(`     Error: ${error?.message || error}`);
    if (remediation) {
      console.error(`     Remediation Applied: ${remediation}`);
    }
    auditLogs.push({
      domain,
      testCaseNumber: tcNum,
      title,
      status: 'FAILED',
      errorDetails: error?.message || String(error),
      remediation,
    });
  }
}

async function runComprehensiveAudit() {
  console.log('================================================================');
  console.log('🚀 BẮT ĐẦU CHẠY BỘ KIỂM THỬ TOÀN DIỆN 7 NGHIỆP VỤ BÁO CÁO (5 TC / NGHIỆP VỤ)');
  console.log('================================================================\n');

  // ==========================================================================
  // NGHIỆP VỤ 1: PHÂN GIẢI TÊN CHỦ HỘ & NGƯỜI ĐẠI DIỆN KÝ THAY
  // ==========================================================================
  console.log('--- [NGHIỆP VỤ 1: PHÂN GIẢI TÊN CHỦ HỘ & NGƯỜI ĐẠI DIỆN KÝ THAY] ---');

  // TC 1.1: Ưu tiên tên KSV thu thập tại hiện trường (json.ownerName), loại bỏ placeholder địa chính "Chủ hộ thửa..."
  try {
    const rawReport = {
      project_parcel_code: 'B-001',
      owner_name: 'Chủ hộ thửa 123 tờ 45',
      survey_data_json: {
        ownerName: 'Nguyễn Văn Thực Địa',
        signatures: { ownerRepresentative: { fullName: 'Nguyễn Văn Thực Địa' } },
      },
    };
    const vm = ReportV2ViewModelMapper.buildViewModel(rawReport);
    assert.strictEqual(vm.section1.ownerName, 'Nguyễn Văn Thực Địa', 'Phải lấy Nguyễn Văn Thực Địa từ survey_data_json');
    assert(!vm.section1.ownerName.includes('Chủ hộ thửa'), 'Tuyệt đối không lấy placeholder địa chính');
    recordResult('NV1_OwnerName', 1, 'Ưu tiên tên KSV thu thập, loại bỏ placeholder "Chủ hộ thửa..."', true);
  } catch (err) {
    recordResult('NV1_OwnerName', 1, 'Ưu tiên tên KSV thu thập, loại bỏ placeholder "Chủ hộ thửa..."', false, err);
  }

  // TC 1.2: Hồ sơ có cả Chủ sở hữu và Người đại diện ký thay -> Không được hoán đổi, giữ độc lập 100%
  try {
    const rawReport = {
      project_parcel_code: 'B-002',
      owner_name: 'Trần Văn Chủ Nhà',
      survey_data_json: {
        ownerName: 'Trần Văn Chủ Nhà',
        signatures: {
          ownerRepresentative: {
            fullName: 'Lê Văn Thuê Nhà (Đại diện ký thay)',
            relation: 'Người thuê nhà',
          },
        },
      },
    };
    const vm = ReportV2ViewModelMapper.buildViewModel(rawReport);
    const app3 = vm.appendix3;

    assert.strictEqual(vm.section1.ownerName, 'Trần Văn Chủ Nhà', 'Tên chủ sở hữu ở Chương I phải là Trần Văn Chủ Nhà');
    assert(app3.ownerRepresentative.vi.includes('Lê Văn Thuê Nhà'), 'Người đại diện ký biên bản phải là Lê Văn Thuê Nhà');
    assert.notStrictEqual(vm.section1.ownerName, app3.ownerRepresentative.vi, 'Chủ sở hữu và người ký thay không được hoán đổi cho nhau');
    recordResult('NV1_OwnerName', 2, 'Chủ sở hữu và Người đại diện ký thay độc lập, không hoán đổi', true);
  } catch (err) {
    recordResult('NV1_OwnerName', 2, 'Chủ sở hữu và Người đại diện ký thay độc lập, không hoán đổi', false, err);
  }

  // TC 1.3: Admin hiệu chỉnh ownerName qua overrides/edit -> đồng bộ vào signatures.ownerRepresentative.fullName khi đang là placeholder
  try {
    const rawReport = {
      project_parcel_code: 'B-003',
      owner_name: 'Chủ hộ thửa 88',
      survey_data_json: {
        ownerName: 'Chủ hộ thửa 88',
        signatures: { ownerRepresentative: { fullName: 'Chủ hộ thửa 88' } },
      },
    };
    const overrides = { ownerName: 'Phạm Thị Mới Được Duyệt' };
    const overridden = applyOverridesToReportV2(rawReport, overrides);
    assert.strictEqual(overridden.survey_data_json.ownerName, 'Phạm Thị Mới Được Duyệt');
    assert.strictEqual(overridden.survey_data_json.signatures.ownerRepresentative.fullName, 'Phạm Thị Mới Được Duyệt');
    const vm = ReportV2ViewModelMapper.buildViewModel(overridden);
    assert.strictEqual(vm.section1.ownerName, 'Phạm Thị Mới Được Duyệt');
    recordResult('NV1_OwnerName', 3, 'Admin hiệu chỉnh ownerName đồng bộ cả survey_data_json và signatures', true);
  } catch (err) {
    recordResult('NV1_OwnerName', 3, 'Admin hiệu chỉnh ownerName đồng bộ cả survey_data_json và signatures', false, err);
  }

  // TC 1.4: Hồ sơ vắng chủ (isAbsentee = true) -> Phụ lục 3 ghi nhận vắng chủ / niêm yết
  try {
    const rawReport = {
      project_parcel_code: 'B-004',
      owner_name: 'Bà Vắng Mặt',
      survey_data_json: {
        ownerName: 'Bà Vắng Mặt',
        isAbsenteeSurvey: true,
        absenteeReason: 'Chủ nhà đi công tác nước ngoài',
      },
    };
    const vm = ReportV2ViewModelMapper.buildViewModel(rawReport);
    assert.strictEqual(vm.section1.ownerName, 'Bà Vắng Mặt');
    assert(vm.appendix3.ownerRepresentative.vi.includes('Vắng mặt') || vm.appendix3.ownerRepresentative.vi.includes('niêm yết'), 'Phụ lục 3 phải ghi nhận vắng chủ');
    recordResult('NV1_OwnerName', 4, 'Hồ sơ vắng chủ ghi nhận đúng chủ sở hữu và trạng thái vắng chủ ở Phụ lục 3', true);
  } catch (err) {
    recordResult('NV1_OwnerName', 4, 'Hồ sơ vắng chủ ghi nhận đúng chủ sở hữu và trạng thái vắng chủ ở Phụ lục 3', false, err);
  }

  // TC 1.5: KSV nhập khoảng trắng thừa hoặc chuỗi rỗng -> trim chuẩn, fallback an toàn không crash
  try {
    const rawReport1 = {
      project_parcel_code: 'B-005A',
      owner_name: '   Trần Thị Trim   ',
      survey_data_json: { ownerName: '   Trần Thị Trim   ' },
    };
    const vm1 = ReportV2ViewModelMapper.buildViewModel(rawReport1);
    assert.strictEqual(vm1.section1.ownerName, 'Trần Thị Trim');

    const rawReport2 = {
      project_parcel_code: 'B-005B',
      owner_name: '',
      survey_data_json: { ownerName: '' },
    };
    const vm2 = ReportV2ViewModelMapper.buildViewModel(rawReport2);
    assert(vm2.section1.ownerName === 'Chủ hộ' || vm2.section1.ownerName === 'Chưa xác định', 'Fallback an toàn về Chủ hộ hoặc Chưa xác định');
    recordResult('NV1_OwnerName', 5, 'Chuẩn hóa khoảng trắng trim và fallback "Chủ hộ" an toàn', true);
  } catch (err) {
    recordResult('NV1_OwnerName', 5, 'Chuẩn hóa khoảng trắng trim và fallback an toàn', false, err);
  }

  // ==========================================================================
  // NGHIỆP VỤ 2: KÍCH THƯỚC CÔNG TRÌNH & IN '--' KHI THIẾU
  // ==========================================================================
  console.log('\n--- [NGHIỆP VỤ 2: KÍCH THƯỚC CÔNG TRÌNH & IN \'--\' KHI THIẾU] ---');

  // TC 2.1: Có đo đạc đầy đủ: frontage_width = 4.5, lot_depth = 18.2
  try {
    const rawReport = {
      project_parcel_code: 'B-021',
      frontage_width: 4.5,
      lot_depth: 18.2,
      buildingSpecs: { frontage_width: 4.5, lot_depth: 18.2 },
      survey_data_json: {},
    };
    const vm = ReportV2ViewModelMapper.buildViewModel(rawReport);
    assert(vm.section2.dimensionsDisplay.vi.includes('Mặt tiền 4.5 m'), 'Phải có Mặt tiền 4.5 m');
    assert(vm.section2.dimensionsDisplay.vi.includes('Chiều sâu 18.2 m'), 'Phải có Chiều sâu 18.2 m');
    recordResult('NV2_Dimensions', 1, 'Đầy đủ kích thước đo đạc: hiển thị chuẩn "Mặt tiền 4.5 m × Chiều sâu 18.2 m"', true);
  } catch (err) {
    recordResult('NV2_Dimensions', 1, 'Đầy đủ kích thước đo đạc', false, err);
  }

  // TC 2.2: Chỉ đo mặt tiền: frontage_width = 4.5, lot_depth = null
  try {
    const rawReport = {
      project_parcel_code: 'B-022',
      frontage_width: 4.5,
      lot_depth: null,
      buildingSpecs: { frontage_width: 4.5, lot_depth: null },
      survey_data_json: {},
    };
    const vm = ReportV2ViewModelMapper.buildViewModel(rawReport);
    assert(vm.section2.dimensionsDisplay.vi.includes('Mặt tiền 4.5 m'), 'Phải có Mặt tiền 4.5 m');
    assert(vm.section2.dimensionsDisplay.vi.includes('Chiều sâu -- m'), 'Chiều sâu thiếu phải in "-- m"');
    recordResult('NV2_Dimensions', 2, 'Chỉ đo mặt tiền: hiển thị "Mặt tiền 4.5 m × Chiều sâu -- m"', true);
  } catch (err) {
    recordResult('NV2_Dimensions', 2, 'Chỉ đo mặt tiền', false, err);
  }

  // TC 2.3: Chỉ đo chiều sâu: frontage_width = null, lot_depth = 20.0
  try {
    const rawReport = {
      project_parcel_code: 'B-023',
      frontage_width: null,
      lot_depth: 20.0,
      buildingSpecs: { frontage_width: null, lot_depth: 20.0 },
      survey_data_json: {},
    };
    const vm = ReportV2ViewModelMapper.buildViewModel(rawReport);
    assert(vm.section2.dimensionsDisplay.vi.includes('Mặt tiền -- m'), 'Mặt tiền thiếu phải in "-- m"');
    assert(vm.section2.dimensionsDisplay.vi.includes('Chiều sâu 20.0 m') || vm.section2.dimensionsDisplay.vi.includes('Chiều sâu 20 m'), 'Phải có Chiều sâu 20 m');
    recordResult('NV2_Dimensions', 3, 'Chỉ đo chiều sâu: hiển thị "Mặt tiền -- m × Chiều sâu 20.0 m"', true);
  } catch (err) {
    recordResult('NV2_Dimensions', 3, 'Chỉ đo chiều sâu', false, err);
  }

  // TC 2.4: Không đo cả hai (chỉ có diện tích đất): in rõ "-- m" và KHÔNG suy diễn từ GIS
  try {
    const rawReport = {
      project_parcel_code: 'B-024',
      frontage_width: null,
      lot_depth: null,
      land_area_m2: 85.5,
      buildingSpecs: { frontage_width: null, lot_depth: null, land_area: 85.5 },
      survey_data_json: {},
    };
    const vm = ReportV2ViewModelMapper.buildViewModel(rawReport);
    assert(vm.section2.dimensionsDisplay.vi.includes('Mặt tiền -- m × Chiều sâu -- m'), 'Cả hai thiếu phải in Mặt tiền -- m × Chiều sâu -- m');
    assert(vm.section2.floorAreaDisplay.vi.includes('85.5 m²') || String(vm.section2.landAreaM2) === '85.5', 'Phải ghi nhận diện tích khuôn viên đất');
    recordResult('NV2_Dimensions', 4, 'Không đo kích thước: in "-- m" rõ ràng, tuyệt đối không suy diễn từ GIS', true);
  } catch (err) {
    recordResult('NV2_Dimensions', 4, 'Không đo kích thước', false, err);
  }

  // TC 2.5: Override từ Admin: Admin cập nhật frontageWidth và lotDepth
  try {
    const rawReport = {
      project_parcel_code: 'B-025',
      frontage_width: null,
      lot_depth: null,
      buildingSpecs: { frontage_width: null, lot_depth: null },
      survey_data_json: {},
    };
    const overrides = {
      frontageWidth: 5.2,
      lotDepth: 16.8,
    };
    const overridden = applyOverridesToReportV2(rawReport, overrides);
    assert.strictEqual(overridden.frontage_width, 5.2);
    assert.strictEqual(overridden.lot_depth, 16.8);
    const vm = ReportV2ViewModelMapper.buildViewModel(overridden);
    assert(vm.section2.dimensionsDisplay.vi.includes('Mặt tiền 5.2 m × Chiều sâu 16.8 m'));
    recordResult('NV2_Dimensions', 5, 'Admin overrides frontageWidth/lotDepth cập nhật chính xác vào báo cáo', true);
  } catch (err) {
    recordResult('NV2_Dimensions', 5, 'Admin overrides frontageWidth/lotDepth', false, err);
  }

  // ==========================================================================
  // NGHIỆP VỤ 3: ĐỘ NGHIÊNG & BIẾN DẠNG (‰) - LOẠI BỎ LỖI CHIA 10
  // ==========================================================================
  console.log('\n--- [NGHIỆP VỤ 3: ĐỘ NGHIÊNG & BIẾN DẠNG (‰) - KHÔNG CHIA 10] ---');

  // TC 3.1: Kiểm tra logic cập nhật độ nghiêng không bị chia 10 trong mã nguồn AuditModificationService
  try {
    const auditModPath = path.resolve(__dirname, '../modules/audit/services/audit-modification.service.ts');
    const auditModCode = fs.readFileSync(auditModPath, 'utf8');
    assert(!auditModCode.includes('Number(tilt.xPermille) / 10'), 'KHÔNG ĐƯỢC chứa phép chia 10 đối với tilt.xPermille');
    assert(!auditModCode.includes('Number(tilt.yPermille) / 10'), 'KHÔNG ĐƯỢC chứa phép chia 10 đối với tilt.yPermille');
    assert(auditModCode.includes('tilt.xPermille !== undefined && tilt.xPermille !== \'\' ? Number(tilt.xPermille) : null'), 'Lưu trực tiếp Number(tilt.xPermille)');
    recordResult('NV3_Tilt', 1, 'AuditModificationService đã loại bỏ hoàn toàn phép chia 10 (/ 10) đối với độ nghiêng', true);
  } catch (err) {
    recordResult('NV3_Tilt', 1, 'AuditModificationService loại bỏ / 10', false, err);
  }

  // TC 3.2: Hiển thị giá trị độ nghiêng kèm đơn vị ‰ chuẩn
  try {
    const rawReport = {
      deformation: {},
      survey_data_json: {
        settlementTilt: {
          buildingTilt: {
            xPermille: 2.5,
            yPermille: 1.2,
            direction: 'Đông Nam',
          },
        },
      },
    };
    const s5 = Section5DeformationMapper.map(
      rawReport,
      rawReport.survey_data_json,
      rawReport.survey_data_json.settlementTilt,
      [],
      0,
      0
    );
    assert(s5.buildingInclination.measured.includes('2.500‰'), 'Phải chứa 2.500‰');
    assert(s5.buildingInclination.measured.includes('1.200‰'), 'Phải chứa 1.200‰');
    assert(s5.buildingInclination.measured.includes('Đông Nam'), 'Phải chứa hướng Đông Nam');
    recordResult('NV3_Tilt', 2, 'Hiển thị giá trị độ nghiêng X, Y chuẩn xác kèm đơn vị ‰ và hướng', true);
  } catch (err) {
    recordResult('NV3_Tilt', 2, 'Hiển thị độ nghiêng chuẩn ‰', false, err);
  }

  // TC 3.3: Không đo đạc bằng máy Laser (chỉ quan sát ngoại quan) -> In "-- (Quan sát ngoại quan, không đo đạc)"
  try {
    const rawReport = {
      deformation: {},
      survey_data_json: {
        settlementTilt: {
          buildingTilt: {
            level: 0,
            xPermille: null,
            yPermille: null,
          },
        },
      },
    };
    const s5 = Section5DeformationMapper.map(
      rawReport,
      rawReport.survey_data_json,
      rawReport.survey_data_json.settlementTilt,
      [],
      0,
      0
    );
    assert.strictEqual(s5.buildingInclination.measured, '-- (Quan sát ngoại quan, không đo đạc)');
    recordResult('NV3_Tilt', 3, 'Không đo máy laser: hiển thị chuẩn "-- (Quan sát ngoại quan, không đo đạc)"', true);
  } catch (err) {
    recordResult('NV3_Tilt', 3, 'Không đo máy laser', false, err);
  }

  // TC 3.4: Chỉ đo 1 trục X = 3.1‰, trục Y chưa đo -> X in 3.100‰, Y in '--'
  try {
    const rawReport = {
      deformation: {},
      survey_data_json: {
        settlementTilt: {
          buildingTilt: {
            xPermille: 3.1,
            yPermille: null,
          },
        },
      },
    };
    const s5 = Section5DeformationMapper.map(
      rawReport,
      rawReport.survey_data_json,
      rawReport.survey_data_json.settlementTilt,
      [],
      0,
      0
    );
    assert(s5.buildingInclination.measured.includes('3.100‰'), 'X phải in 3.100‰');
    assert(s5.buildingInclination.measured.includes('Y = --'), 'Y phải in --');
    recordResult('NV3_Tilt', 4, 'Đo 1 trục: trục đo in ‰, trục thiếu in "--" độc lập', true);
  } catch (err) {
    recordResult('NV3_Tilt', 4, 'Đo 1 trục', false, err);
  }

  // TC 3.5: Độ võng dầm/sàn sagMm -> f = X mm; không đo in "Không phát hiện võng"
  try {
    const rawReport1 = {
      survey_data_json: { settlementTilt: { beamSagging: { sagMm: 12 } } },
    };
    const s5_1 = Section5DeformationMapper.map(rawReport1, rawReport1.survey_data_json, rawReport1.survey_data_json.settlementTilt, [], 0, 0);
    assert.strictEqual(s5_1.beamSlabDeflection.measured, 'f = 12 mm');

    const rawReport2 = {
      survey_data_json: { settlementTilt: { beamSagging: {} } },
    };
    const s5_2 = Section5DeformationMapper.map(rawReport2, rawReport2.survey_data_json, rawReport2.survey_data_json.settlementTilt, [], 0, 0);
    assert.strictEqual(s5_2.beamSlabDeflection.measured, 'Không phát hiện võng');
    recordResult('NV3_Tilt', 5, 'Đo võng dầm sàn: hiển thị f = X mm hoặc "Không phát hiện võng"', true);
  } catch (err) {
    recordResult('NV3_Tilt', 5, 'Đo võng dầm sàn', false, err);
  }

  // ==========================================================================
  // NGHIỆP VỤ 4: MỤC XII BẢN VẼ HOÀN CÔNG MÓNG & MỤC LỤC LINH HOẠT
  // ==========================================================================
  console.log('\n--- [NGHIỆP VỤ 4: MỤC XII BẢN VẼ HOÀN CÔNG MÓNG & MỤC LỤC LINH HOẠT] ---');

  // TC 4.1: Hồ sơ có 2 ảnh bản vẽ hoàn công -> tạo đúng 1 Sheet (2 bản vẽ / Sheet A4) ở Mục XII
  try {
    const rawReport = {
      survey_data_json: {
        asBuiltDrawings: [
          { url: 'https://example.com/draw1.jpg', title: 'Mặt bằng móng' },
          { url: 'https://example.com/draw2.jpg', title: 'Chi tiết cốt thép' },
        ],
      },
    };
    const s12 = Appendix3And4Mapper.mapSection12AsBuilt(rawReport, rawReport.survey_data_json);
    assert.strictEqual(s12.hasDrawings, true);
    assert.strictEqual(s12.totalDrawings, 2);
    assert.strictEqual(s12.sheets.length, 1, '2 bản vẽ phải vừa vặn trong 1 Sheet A4');
    assert.strictEqual(s12.sheets[0].drawings.length, 2);
    recordResult('NV4_SectionXII', 1, 'Có 2 ảnh bản vẽ hoàn công: tạo đúng 1 Sheet A4 (lưới 2 bản vẽ / sheet)', true);
  } catch (err) {
    recordResult('NV4_SectionXII', 1, '2 ảnh bản vẽ hoàn công', false, err);
  }

  // TC 4.2: Hồ sơ có 3 ảnh bản vẽ hoàn công -> chia đúng 2 Sheet (Sheet 1: 2 ảnh, Sheet 2: 1 ảnh)
  try {
    const rawReport = {
      survey_data_json: {
        asBuiltDrawings: [
          { url: 'https://example.com/d1.jpg', title: 'Bản vẽ 1' },
          { url: 'https://example.com/d2.jpg', title: 'Bản vẽ 2' },
          { url: 'https://example.com/d3.jpg', title: 'Bản vẽ 3' },
        ],
      },
    };
    const s12 = Appendix3And4Mapper.mapSection12AsBuilt(rawReport, rawReport.survey_data_json);
    assert.strictEqual(s12.sheets.length, 2, '3 bản vẽ phải chia thành 2 Sheet A4');
    assert.strictEqual(s12.sheets[0].drawings.length, 2, 'Sheet 1 phải có 2 bản vẽ');
    assert.strictEqual(s12.sheets[1].drawings.length, 1, 'Sheet 2 phải có 1 bản vẽ');
    recordResult('NV4_SectionXII', 2, 'Có 3 ảnh bản vẽ hoàn công: chia chuẩn 2 Sheet (2 ảnh sheet 1, 1 ảnh sheet 2)', true);
  } catch (err) {
    recordResult('NV4_SectionXII', 2, '3 ảnh bản vẽ hoàn công', false, err);
  }

  // TC 4.3: Hồ sơ KHÔNG có bản vẽ hoàn công -> hasDrawings = false, chiếm 0 trang, TOC không hiển thị
  try {
    const rawReport = {
      survey_data_json: {},
    };
    const s12 = Appendix3And4Mapper.mapSection12AsBuilt(rawReport, rawReport.survey_data_json);
    assert.strictEqual(s12.hasDrawings, false);
    assert.strictEqual(s12.sheets.length, 0);

    const mockMeta: any = {};
    const mockApp1: any[] = [{}];
    const mockApp2: any[] = [];
    const mockApp3: any = { signedRecordPages: [] };
    const toc = ScenarioFlagsAndTocMapper.calculateTocPageNumbers(
      mockMeta,
      mockApp1,
      mockApp2,
      mockApp3,
      s12
    );
    assert.strictEqual(toc.sectionXII, undefined, 'Khi không có bản vẽ, toc.sectionXII phải là undefined');
    recordResult('NV4_SectionXII', 3, 'Không có bản vẽ hoàn công: hasDrawings = false, Mục XII chiếm 0 trang và ẩn khỏi TOC', true);
  } catch (err) {
    recordResult('NV4_SectionXII', 3, 'Không có bản vẽ hoàn công', false, err);
  }

  // TC 4.4: Khi Mục XII xuất hiện -> Mục lục Trang 2 hiển thị số trang Mục XII và Phụ lục 1, 2, 3 tịnh tiến đúng
  try {
    const s12: any = {
      hasDrawings: true,
      sheets: [{}, {}], // 2 sheet
      totalDrawings: 4,
    };
    const mockMeta: any = {};
    const mockApp1: any[] = [{}, {}]; // 2 trang (pageSectionX = 9, pageSectionXI = 9 + 2 = 11)
    const mockApp2: any[] = [];
    const mockApp3: any = { signedRecordPages: [{}, {}] }; // 2 trang (sectionXIPageCount = 1 + 2 = 3)
    // pageSectionXII = 11 + 3 = 14
    // section12PageCount = 2
    // pagePl1 = 14 + 2 = 16
    const toc = ScenarioFlagsAndTocMapper.calculateTocPageNumbers(
      mockMeta,
      mockApp1,
      mockApp2,
      mockApp3,
      s12
    );
    assert.strictEqual(toc.sectionXII, 14, 'Mục XII phải bắt đầu từ trang 14');
    assert.strictEqual(toc.pagePl1, 16, 'Phụ lục 1 phải tịnh tiến sang trang 16');
    recordResult('NV4_SectionXII', 4, 'Mục lục tính toán chính xác số trang Mục XII và tịnh tiến các phụ lục sau', true);
  } catch (err) {
    recordResult('NV4_SectionXII', 4, 'Mục lục tính toán số trang', false, err);
  }

  // TC 4.5: Phụ lục 3 (Biên bản hiện trường) KHÔNG còn chứa ảnh bản vẽ hoàn công
  try {
    const rawReport = {
      project_parcel_code: 'B-045',
      survey_data_json: {
        signatures: { workingMinutesPhotos: ['https://example.com/minutes_p1.jpg'] },
        asBuiltDrawings: ['https://example.com/as_built.jpg'],
      },
    };
    const app3 = Appendix3And4Mapper.mapAppendix3(rawReport, rawReport.survey_data_json, []);
    const urls = app3.signedRecordPages.map((p) => p.url);
    assert(urls.includes('https://example.com/minutes_p1.jpg'), 'Phụ lục 3 phải chứa biên bản hiện trường');
    assert(!urls.includes('https://example.com/as_built.jpg'), 'Phụ lục 3 TUYỆT ĐỐI KHÔNG chứa ảnh bản vẽ hoàn công');
    recordResult('NV4_SectionXII', 5, 'Phụ lục 3 hoàn toàn sạch sẽ, tách biệt độc lập với bản vẽ hoàn công', true);
  } catch (err) {
    recordResult('NV4_SectionXII', 5, 'Phụ lục 3 tách biệt bản vẽ', false, err);
  }

  // ==========================================================================
  // NGHIỆP VỤ 5: ĐỒNG BỘ SNAPSHOT KHI XEM TRƯỚC (HTML PREVIEW SYNC)
  // ==========================================================================
  console.log('\n--- [NGHIỆP VỤ 5: ĐỒNG BỘ SNAPSHOT KHI XEM TRƯỚC (HTML PREVIEW SYNC)] ---');

  // TC 5.1: Hồ sơ APPROVED nạp đúng snapshot APPROVED_RELEASE trong renderDraftHtml
  try {
    const resolvedApproved = {
      id: 'd730fc32-3c55-4d4f-94d2-14d4bdcf5060', // B-00026
      status: 'APPROVED' as const,
      raw: {
        id: 'd730fc32-3c55-4d4f-94d2-14d4bdcf5060',
        project_parcel_code: 'B-00026',
        status: 'APPROVED',
        survey_data_json: { ecs: { totalEcs: 999 } }, // Điểm giả định khác snapshot
      },
    };
    const { viewModel } = await ReportV3Service.renderDraftHtml(resolvedApproved as any, undefined, false, false);
    assert.notStrictEqual(viewModel.section7.totalScore, 999, 'Điểm ECS phải lấy từ Snapshot đã duyệt, không lấy điểm giả 999');
    recordResult('NV5_SnapshotSync', 1, 'Hồ sơ APPROVED tự động nạp snapshot APPROVED_RELEASE khi xem trước HTML', true);
  } catch (err) {
    recordResult('NV5_SnapshotSync', 1, 'Hồ sơ APPROVED nạp snapshot', false, err);
  }

  // TC 5.2: Bảng điểm ECS và kết luận kỹ thuật trong HTML Preview khớp 100% với snapshot
  try {
    const mockSnapshot = {
      schemaVersion: 1 as const,
      reportId: '11111111-1111-1111-1111-111111111111',
      approvedAt: new Date().toISOString(),
      approvedByUserId: '22222222-2222-2222-2222-222222222222',
      ecs: {
        e1: 2, e2: 1, e3: 0, e4: 2, e5: 1, e6: 2,
        total: 8,
        ecsClass: 'MEDIUM' as const,
        source: 'ADMIN_OVERRIDE' as const,
      },
      vi: {
        v1: 1, v2: 1, v3: 1, v4: 1, v5: 1, v6: 1,
        total: 6, avg: 1,
        viClass: 'LOW' as const,
        foundationCat: 2,
        source: 'ADMIN_OVERRIDE' as const,
      },
      burlandMaxGrade: 2,
      contentSha256: 'a'.repeat(64),
    };
    const rawReport = {
      status: 'APPROVED',
      survey_data_json: { ecs: { totalEcs: 0 }, vi: { totalVi: 0 } },
    };
    const applied = ReportSnapshotService.applySnapshotToReport(rawReport, mockSnapshot);
    assert.strictEqual(applied.survey_data_json.ecs.totalEcs, 8);
    assert.strictEqual(applied.survey_data_json.vi.totalVi, 6);
    assert.strictEqual(applied.survey_data_json.foundationCatScore, 2);
    recordResult('NV5_SnapshotSync', 2, 'applySnapshotToReport đóng băng 100% điểm ECS, VI và CAT móng', true);
  } catch (err) {
    recordResult('NV5_SnapshotSync', 2, 'applySnapshotToReport đóng băng điểm', false, err);
  }

  // TC 5.3: Hồ sơ APPROVED bỏ qua effectiveOverrides để bảo vệ tính toàn vẹn pháp lý
  try {
    const resolvedApproved = {
      id: 'd730fc32-3c55-4d4f-94d2-14d4bdcf5060',
      status: 'APPROVED' as const,
      raw: {
        id: 'd730fc32-3c55-4d4f-94d2-14d4bdcf5060',
        project_parcel_code: 'B-00026',
        status: 'APPROVED',
        survey_data_json: { ownerName: 'Chủ Hộ Pháp Lý Đã Duyệt' },
      },
    };
    const maliciousOverrides = { ownerName: 'Kẻ Giả Mạo' };
    const { viewModel } = await ReportV3Service.renderDraftHtml(resolvedApproved as any, maliciousOverrides, false, false);
    assert.notStrictEqual(viewModel.section1.ownerName, 'Kẻ Giả Mạo', 'Hồ sơ APPROVED tuyệt đối không nhận overrides tùy tiện');
    recordResult('NV5_SnapshotSync', 3, 'Hồ sơ APPROVED khóa chặt overrides tùy tiện từ phía client', true);
  } catch (err) {
    recordResult('NV5_SnapshotSync', 3, 'Hồ sơ APPROVED khóa overrides', false, err);
  }

  // TC 5.4: Hồ sơ DRAFT cho phép áp dụng overrides bình thường để chỉnh sửa trước khi duyệt
  try {
    const resolvedDraft = {
      id: 'd730fc32-3c55-4d4f-94d2-14d4bdcf5060',
      status: 'DRAFT' as const,
      raw: {
        id: 'd730fc32-3c55-4d4f-94d2-14d4bdcf5060',
        project_parcel_code: 'B-00026',
        status: 'DRAFT',
        survey_data_json: { ownerName: 'Tên Bản Nháp' },
      },
    };
    const draftOverrides = { ownerName: 'Tên Sửa Đổi Trong Nháp' };
    const { viewModel } = await ReportV3Service.renderDraftHtml(resolvedDraft as any, draftOverrides, false, false);
    assert.strictEqual(viewModel.section1.ownerName, 'Tên Sửa Đổi Trong Nháp');
    recordResult('NV5_SnapshotSync', 4, 'Hồ sơ DRAFT cho phép overrides để xem trước trước khi duyệt', true);
  } catch (err) {
    recordResult('NV5_SnapshotSync', 4, 'Hồ sơ DRAFT cho phép overrides', false, err);
  }

  // TC 5.5: Tính toán Content Hash SHA-256 nhất quán cho Snapshot
  try {
    const scores = {
      ecs: { e1: 1, e2: 1, e3: 1, e4: 1, e5: 1, e6: 1, total: 6, ecsClass: 'MEDIUM' as const, source: 'CALCULATED' as const },
      vi: { v1: 1, v2: 1, v3: 1, v4: 1, v5: 1, v6: 1, total: 6, avg: 1, viClass: 'LOW' as const, foundationCat: 1, source: 'CALCULATED' as const },
      burlandMaxGrade: 1,
    };
    const hash1 = ReportSnapshotService.computeContentHash(scores);
    const hash2 = ReportSnapshotService.computeContentHash(scores);
    assert.strictEqual(hash1, hash2);
    assert.strictEqual(hash1.length, 64);
    recordResult('NV5_SnapshotSync', 5, 'SHA-256 Content Hash của Snapshot điểm được bảo toàn tính toàn vẹn', true);
  } catch (err) {
    recordResult('NV5_SnapshotSync', 5, 'SHA-256 Content Hash', false, err);
  }

  // ==========================================================================
  // NGHIỆP VỤ 6: SƠ ĐỒ KHÔNG GIAN TRANG BÌA KHỔ DỌC 3:4 & CHIỀU CAO <= 175PX
  // ==========================================================================
  console.log('\n--- [NGHIỆP VỤ 6: SƠ ĐỒ KHÔNG GIAN TRANG BÌA KHỔ DỌC 3:4 & CHIỀU CAO <= 175PX] ---');

  // TC 6.1: SVG có viewBox chuẩn khổ dọc 3:4 (300 x 400)
  try {
    const coords: [number, number][] = [
      [10.78, 106.65],
      [10.78, 106.651],
      [10.781, 106.651],
      [10.781, 106.65],
    ];
    const svgDataUri = generateMetroSpatialVisualSvg(coords, 'B-001');
    const svgText = Buffer.from(svgDataUri.replace(/^data:image\/svg\+xml;base64,/, ''), 'base64').toString('utf8');
    assert(svgText.includes('viewBox="0 0 300 400"'), 'SVG phải có viewBox="0 0 300 400"');
    assert(svgText.includes('width="300"'), 'SVG phải có width="300"');
    assert(svgText.includes('height="400"'), 'SVG phải có height="400"');
    recordResult('NV6_CoverMap', 1, 'Sơ đồ SVG đạt chuẩn tỷ lệ khổ dọc 3:4 (width: 300, height: 400)', true);
  } catch (err) {
    recordResult('NV6_CoverMap', 1, 'Sơ đồ SVG đạt chuẩn 3:4', false, err);
  }

  // TC 6.2: CSS wrapper kiểm soát chiều cao 175px chống tràn trang bìa
  try {
    const cssPath = path.resolve(__dirname, '../modules/report_v2/templates/residential/styles.css');
    const css = fs.readFileSync(cssPath, 'utf8');
    assert(css.includes('height: 175px;'), 'styles.css phải định nghĩa height: 175px cho cover wrapper');
    assert(css.includes('.cover-spatial-wrapper'), 'Phải định nghĩa cho .cover-spatial-wrapper');
    assert(css.includes('.cover-spatial-img'), 'Phải định nghĩa cho .cover-spatial-img');
    assert(css.includes('object-fit: cover !important;'), 'cover-spatial-img phải có object-fit: cover');
    recordResult('NV6_CoverMap', 2, 'CSS kiểm soát ngân sách chiều cao 175px, object-fit cover chống vỡ trang bìa', true);
  } catch (err) {
    recordResult('NV6_CoverMap', 2, 'CSS chiều cao 175px', false, err);
  }

  // TC 6.3: Nền ảnh vệ tinh Esri World Imagery (LOD 18) được nhúng từ local disk cache
  try {
    const cacheDir = path.resolve(process.cwd(), 'data/cache/satellite_tiles');
    const files = fs.existsSync(cacheDir) ? fs.readdirSync(cacheDir) : [];
    console.log(`     (Số tile vệ tinh có sẵn trong disk cache: ${files.length})`);
    assert(files.length > 0, 'Phải có tile vệ tinh lưu sẵn trong data/cache/satellite_tiles');
    recordResult('NV6_CoverMap', 3, 'Ảnh vệ tinh Esri World Imagery được lưu trữ bền vững trong local disk cache', true);
  } catch (err) {
    recordResult('NV6_CoverMap', 3, 'Ảnh vệ tinh trong disk cache', false, err);
  }

  // TC 6.4: Graceful fallback: khi không có tile vệ tinh, SVG hiển thị nền vector #1e293b an toàn
  try {
    const coords: [number, number][] = [
      [21.0285, 105.8542], // Tọa độ Hà Nội không có tile Metro 2 TPHCM
      [21.0285, 105.8552],
      [21.0295, 105.8552],
      [21.0295, 105.8542],
    ];
    const svgDataUri = generateMetroSpatialVisualSvg(coords, 'HN-TEST');
    const svgText = Buffer.from(svgDataUri.replace(/^data:image\/svg\+xml;base64,/, ''), 'base64').toString('utf8');
    assert(svgText.includes('fill="#1e293b"'), 'Khi mất tile phải fallback về nền sẫm màu #1e293b');
    assert(svgText.includes('stroke="#ffffff" stroke-width="4.5"'), 'Vẫn vẽ viền phát sáng trắng cho đa giác');
    recordResult('NV6_CoverMap', 4, 'Graceful fallback: khi không có tile vệ tinh, nền vector #1e293b hiển thị hoàn hảo', true);
  } catch (err) {
    recordResult('NV6_CoverMap', 4, 'Graceful fallback vector', false, err);
  }

  // TC 6.5: Pure Clean Map: loại bỏ hoàn toàn đường dóng nét đứt, ô badge cự ly, nhãn mã công trình, thước tỷ lệ và chú thích
  try {
    const coords: [number, number][] = [
      [10.78, 106.65],
      [10.78, 106.651],
      [10.781, 106.651],
      [10.781, 106.65],
    ];
    const svgDataUri = generateMetroSpatialVisualSvg(coords, 'CLEAN-MAP-TEST');
    const svgText = Buffer.from(svgDataUri.replace(/^data:image\/svg\+xml;base64,/, ''), 'base64').toString('utf8');
    assert(!svgText.includes('Thước tỷ lệ'), 'Không được có thước tỷ lệ');
    assert(!svgText.includes('scaleBar'), 'Không được có scaleBar');
    assert(!svgText.includes('Bảng chú thích'), 'Không được có Bảng chú thích');
    assert(!svgText.includes('dark-pill'), 'Không được có badge cự ly dark-pill');
    assert(svgText.includes('font-weight="bold" text-anchor="middle">N</text>'), 'Phải giữ la bàn chỉ Bắc N');
    recordResult('NV6_CoverMap', 5, 'Pure Clean Map: loại bỏ toàn bộ chi tiết thừa, chỉ giữ la bàn chỉ hướng Bắc tinh tế', true);
  } catch (err) {
    recordResult('NV6_CoverMap', 5, 'Pure Clean Map', false, err);
  }

  // ==========================================================================
  // NGHIỆP VỤ 7: XOAY ẢNH VẬT LÝ SERVER-SIDE BẰNG SHARP
  // ==========================================================================
  console.log('\n--- [NGHIỆP VỤ 7: XOAY ẢNH VẬT LÝ SERVER-SIDE BẰNG SHARP] ---');

  // Tạo ảnh mẫu kích thước 100x60 (Landscape) để test xoay
  const sampleLandscapeBuffer = await sharp({
    create: { width: 100, height: 60, channels: 3, background: { r: 200, g: 50, b: 50 } },
  }).jpeg().toBuffer();
  const sampleDataUri = `data:image/jpeg;base64,${sampleLandscapeBuffer.toString('base64')}`;

  // TC 7.1: Xoay ảnh 90 độ vật lý -> kích thước đổi từ 100x60 thành 60x100 (Portrait)
  try {
    const rotated90DataUri = await ReportImageResolver.resolveAndRotateImage(sampleDataUri, 90);
    const rotated90Buf = Buffer.from(rotated90DataUri.replace(/^data:image\/jpeg;base64,/, ''), 'base64');
    const meta90 = await sharp(rotated90Buf).metadata();
    assert.strictEqual(meta90.width, 60, 'Chiều rộng sau xoay 90 độ phải là 60px');
    assert.strictEqual(meta90.height, 100, 'Chiều cao sau xoay 90 độ phải là 100px');
    recordResult('NV7_SharpRotation', 1, 'Xoay 90 độ vật lý: chuyển đổi chính xác từ 100x60 sang 60x100', true);
  } catch (err) {
    recordResult('NV7_SharpRotation', 1, 'Xoay 90 độ vật lý', false, err);
  }

  // TC 7.2: Xoay ảnh 180 độ vật lý -> kích thước 100x60 giữ nguyên, pixel lộn ngược
  try {
    const rotated180DataUri = await ReportImageResolver.resolveAndRotateImage(sampleDataUri, 180);
    const rotated180Buf = Buffer.from(rotated180DataUri.replace(/^data:image\/jpeg;base64,/, ''), 'base64');
    const meta180 = await sharp(rotated180Buf).metadata();
    assert.strictEqual(meta180.width, 100);
    assert.strictEqual(meta180.height, 60);
    recordResult('NV7_SharpRotation', 2, 'Xoay 180 độ vật lý: bảo toàn kích thước 100x60 và đảo ngược hướng ảnh', true);
  } catch (err) {
    recordResult('NV7_SharpRotation', 2, 'Xoay 180 độ vật lý', false, err);
  }

  // TC 7.3: Xoay ảnh 270 độ vật lý -> kích thước đổi thành 60x100
  try {
    const rotated270DataUri = await ReportImageResolver.resolveAndRotateImage(sampleDataUri, 270);
    const rotated270Buf = Buffer.from(rotated270DataUri.replace(/^data:image\/jpeg;base64,/, ''), 'base64');
    const meta270 = await sharp(rotated270Buf).metadata();
    assert.strictEqual(meta270.width, 60);
    assert.strictEqual(meta270.height, 100);
    recordResult('NV7_SharpRotation', 3, 'Xoay 270 độ vật lý: kích thước đổi chuẩn xác thành 60x100', true);
  } catch (err) {
    recordResult('NV7_SharpRotation', 3, 'Xoay 270 độ vật lý', false, err);
  }

  // TC 7.4: Góc xoay 0 độ hoặc 360 độ -> không tốn tài nguyên xoay, trả về buffer gốc
  try {
    const rot0 = await ReportImageResolver.resolveAndRotateImage(sampleDataUri, 0);
    const rot360 = await ReportImageResolver.resolveAndRotateImage(sampleDataUri, 360);
    assert.strictEqual(rot0, sampleDataUri);
    assert.strictEqual(rot360, sampleDataUri);
    recordResult('NV7_SharpRotation', 4, 'Góc xoay 0/360 độ: giữ nguyên buffer gốc, tối ưu hiệu năng', true);
  } catch (err) {
    recordResult('NV7_SharpRotation', 4, 'Góc xoay 0/360 độ', false, err);
  }

  // TC 7.5: Cache xoay hoạt động chính xác theo key `#rot=${angle}`
  try {
    const testUrl = 'https://example.com/test_cache_rotate.jpg';
    const fakeRotatedBase64 = 'data:image/jpeg;base64,FAKE_ROTATED_90';
    (ReportImageResolver as any).cache.set(`${testUrl}#rot=90`, fakeRotatedBase64);

    const resolved = ReportImageResolver.resolveToBase64(testUrl, 90);
    assert.strictEqual(resolved, fakeRotatedBase64, 'resolveToBase64 phải trả về ngay bản xoay đã cache');
    recordResult('NV7_SharpRotation', 5, 'Bộ nhớ đệm phân giải ảnh theo góc xoay hoạt động tức thì và chính xác', true);
  } catch (err) {
    recordResult('NV7_SharpRotation', 5, 'Bộ nhớ đệm xoay ảnh', false, err);
  }

  // ==========================================================================
  // TỔNG HỢP KẾT QUẢ KIỂM THỬ
  // ==========================================================================
  console.log('\n================================================================');
  console.log('📊 TỔNG HỢP KẾT QUẢ BỘ KIỂM THỬ TOÀN DIỆN (35 TEST CASES)');
  console.log('================================================================');

  const passedCount = auditLogs.filter((l) => l.status === 'PASSED').length;
  const failedCount = auditLogs.filter((l) => l.status === 'FAILED').length;
  const totalCount = auditLogs.length;

  console.log(`Tổng số Test Cases: ${totalCount}`);
  console.log(`Số lượng ĐẠT (PASSED): ${passedCount} / ${totalCount} (${((passedCount / totalCount) * 100).toFixed(1)}%)`);
  console.log(`Số lượng LỖI (FAILED): ${failedCount} / ${totalCount}`);

  if (failedCount > 0) {
    console.log('\nDANH SÁCH LỖI VÀ HÀNH ĐỘNG KHẮC PHỤC CẦN THỰC HIỆN:');
    for (const fail of auditLogs.filter((l) => l.status === 'FAILED')) {
      console.log(`- [${fail.domain} TC${fail.testCaseNumber}] ${fail.title}`);
      console.log(`  Lỗi: ${fail.errorDetails}`);
      if (fail.remediation) {
        console.log(`  Phương pháp khắc phục: ${fail.remediation}`);
      }
    }
  } else {
    console.log('\n🎉 TUYỆT VỜI! 100% (35/35) TEST CASES ĐÃ ĐẠT CHUẨN THẨM ĐỊNH!');
  }
  console.log('================================================================\n');

  await pool.end();
  if (failedCount === 0) {
    process.exit(0);
  } else {
    process.exit(1);
  }
}

runComprehensiveAudit().catch((err) => {
  console.error('Lỗi ngoại lệ khi chạy bộ kiểm thử toàn diện:', err);
  process.exit(1);
});
