/**
 * ============================================================================
 * 15 BUSINESS TEST CASES SUITE - 8 REFINEMENTS VERIFICATION
 * Kiểm thử toàn diện 15 ca nghiệp vụ xoay quanh 8 điểm hiệu chỉnh báo cáo BCS V2
 * ============================================================================
 */

import * as fs from 'fs';
import * as path from 'path';
import { CadastralInfoMapper } from '../modules/report/mappers/cadastral-info.mapper';
import { Section3And4Mapper } from '../modules/report/mappers/sections/section-3-4-structural.mapper';
import { ReportViewModelMapper } from '../modules/report/mappers/report-v2-viewmodel.mapper';
import { generateMetroSpatialVisualSvg } from '../modules/report/utils/metro-spatial.utils';

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

async function run15BusinessCases() {
  console.log('================================================================');
  console.log(' BẮT ĐẦU CHẠY 15 TEST CASES NGHIỆP VỤ - 8 ĐIỂM HOÀN THIỆN BÁO CÁO ');
  console.log('================================================================\n');

  // --------------------------------------------------------------------------
  // NHÓM 1: ĐỊNH DANH & MÃ GA (Điểm 1)
  // --------------------------------------------------------------------------
  console.log('--- NHÓM 1: CHUẨN HÓA MÃ GA & BUILDING ID ---');

  // TC01: resolveStationCode trả về chuẩn 2 chữ số ST01 - ST11
  const stationCodes = [
    CadastralInfoMapper.resolveStationCode(5),
    CadastralInfoMapper.resolveStationCode('5'),
    CadastralInfoMapper.resolveStationCode('ST5'),
    CadastralInfoMapper.resolveStationCode('ZONE_05'),
    CadastralInfoMapper.resolveStationCode(1),
    CadastralInfoMapper.resolveStationCode(10),
  ];
  const allTwoDigits = stationCodes[0] === 'ST05' &&
                       stationCodes[1] === 'ST05' &&
                       stationCodes[2] === 'ST05' &&
                       stationCodes[3] === 'ST05' &&
                       stationCodes[4] === 'ST01' &&
                       stationCodes[5] === 'ST10';
  assert(
    'TC01',
    'resolveStationCode chuẩn hóa mã ga thành 2 chữ số (ST01, ST05, ST10)',
    allTwoDigits,
    `Thực tế: ${JSON.stringify(stationCodes)}`
  );

  // TC02: formatBuildingId chuẩn hóa (ST5) thành (ST05)
  const bldgId1 = CadastralInfoMapper.formatBuildingId('C&C-05-B-0026', 'ZONE_05', 'C&C');
  const bldgIdNormalized = CadastralInfoMapper.formatBuildingId('B-00026-C&C (ST5)', 'ZONE_05', 'C&C');
  const tc02Passed = bldgId1 === 'B-00026-C&C (ST05)' && bldgIdNormalized === 'B-00026-C&C (ST05)';
  assert(
    'TC02',
    'formatBuildingId chuẩn hóa mọi biến thể (ST5) thành (ST05)',
    tc02Passed,
    `bldgId1="${bldgId1}", bldgIdNormalized="${bldgIdNormalized}"`
  );

  // TC03: Đồng bộ Building ID và Doc.No trong toàn bộ ViewModel
  const sampleReportData = {
    project_parcel_code: 'C&C-05-B-0026',
    zone_id: 'ZONE_05',
    segment_type: 'C&C',
    survey_data_json: {
      step2Data: {
        foundationCatScore: 3,
        foundationSource: 'Phỏng vấn chủ nhà',
      },
    },
  };
  const vmBldg = ReportViewModelMapper.buildViewModel(sampleReportData);
  const tc03Passed = vmBldg.metadata.buildingId === 'B-00026-C&C (ST05)' &&
                     vmBldg.metadata.reportNo.includes('(ST05)') &&
                     !vmBldg.metadata.buildingId.includes('(ST5)') &&
                     !vmBldg.metadata.reportNo.includes('(ST5)');
  assert(
    'TC03',
    'Metadata buildingId và reportNo đồng bộ chuẩn (ST05), không chứa (ST5)',
    tc03Passed,
    `buildingId="${vmBldg.metadata.buildingId}", reportNo="${vmBldg.metadata.reportNo}"`
  );

  // --------------------------------------------------------------------------
  // NHÓM 2: NHÓM ĐỐI TƯỢNG KHẢO SÁT (Điểm 2)
  // --------------------------------------------------------------------------
  console.log('\n--- NHÓM 2: TINH GỌN NHÓM ĐỐI TƯỢNG KHẢO SÁT ---');

  // TC04: Nhóm đối tượng cho Kho hàng (không nối hậu tố lặp từ)
  const warehouseReport = {
    project_parcel_code: 'C&C-05-B-0026',
    zone_id: 'ZONE_05',
    building_type: 'WAREHOUSE',
    buildingSpecs: {
      buildingNameVi: 'Kho hàng',
      buildingNameEn: 'Warehouse',
    },
    survey_data_json: {},
  };
  const vmWarehouse = ReportViewModelMapper.buildViewModel(warehouseReport);
  const tc04Passed = vmWarehouse.section2.surveyCategory.vi === 'Công trình Kho hàng' &&
                     vmWarehouse.section2.surveyCategory.en === 'Commercial Warehouse' &&
                     !vmWarehouse.section2.surveyCategory.vi.includes('– Khảo sát hiện trạng công trình');
  assert(
    'TC04',
    'Nhóm đối tượng Kho hàng tinh gọn "Công trình Kho hàng", không lặp từ hậu tố',
    tc04Passed,
    `vi="${vmWarehouse.section2.surveyCategory.vi}", en="${vmWarehouse.section2.surveyCategory.en}"`
  );

  // TC05: Nhóm đối tượng cho Nhà dân riêng lẻ
  const resReport = {
    project_parcel_code: 'C&C-05-B-0027',
    zone_id: 'ZONE_05',
    building_type: 'RESIDENTIAL',
    buildingSpecs: {
      buildingNameVi: 'Nhà dân',
      buildingNameEn: 'Residential House',
    },
    survey_data_json: {},
  };
  const vmRes = ReportViewModelMapper.buildViewModel(resReport);
  const tc05Passed = vmRes.section2.surveyCategory.vi === 'Nhà dân / Nhà phố riêng lẻ' &&
                     vmRes.section2.surveyCategory.en === 'Private Residential Townhouse' &&
                     !vmRes.section2.surveyCategory.vi.includes('– Khảo sát');
  assert(
    'TC05',
    'Nhóm đối tượng Nhà dân riêng lẻ tinh gọn "Nhà dân / Nhà phố riêng lẻ"',
    tc05Passed,
    `vi="${vmRes.section2.surveyCategory.vi}", en="${vmRes.section2.surveyCategory.en}"`
  );

  // --------------------------------------------------------------------------
  // NHÓM 3: THỐNG NHẤT THUẬT NGỮ CHƯƠNG III (Điểm 3)
  // --------------------------------------------------------------------------
  console.log('\n--- NHÓM 3: THỐNG NHẤT THUẬT NGỮ CHƯƠNG III ---');

  const { section3 } = Section3And4Mapper.map(
    sampleReportData,
    sampleReportData.survey_data_json,
    {},
    0,
    0,
    null
  );

  // TC06: changeOfUse thống nhất "Không ghi nhận" / "Not recorded"
  const tc06Passed = section3.changeOfUse.vi === 'Không ghi nhận' &&
                     section3.changeOfUse.en === 'Not recorded';
  assert(
    'TC06',
    'Chương III Thay đổi công năng thống nhất thuật ngữ "Không ghi nhận" / "Not recorded"',
    tc06Passed,
    `vi="${section3.changeOfUse.vi}", en="${section3.changeOfUse.en}"`
  );

  // TC07: extension thống nhất "Không ghi nhận" / "Not recorded"
  const tc07Passed = section3.extension.vi === 'Không ghi nhận' &&
                     section3.extension.en === 'Not recorded';
  assert(
    'TC07',
    'Chương III Cơi nới / mở rộng thống nhất thuật ngữ "Không ghi nhận" / "Not recorded"',
    tc07Passed,
    `vi="${section3.extension.vi}", en="${section3.extension.en}"`
  );

  // TC08: structuralAlteration thống nhất "Không ghi nhận" / "Not recorded"
  const tc08Passed = section3.structuralAlteration.vi === 'Không ghi nhận' &&
                     section3.structuralAlteration.en === 'Not recorded';
  assert(
    'TC08',
    'Chương III Cải tạo kết cấu thống nhất thuật ngữ "Không ghi nhận" / "Not recorded"',
    tc08Passed,
    `vi="${section3.structuralAlteration.vi}", en="${section3.structuralAlteration.en}"`
  );

  // --------------------------------------------------------------------------
  // NHÓM 4: TÁCH NGUỒN THÔNG TIN ĐƠN NHẤT (Điểm 4)
  // --------------------------------------------------------------------------
  console.log('\n--- NHÓM 4: NGUỒN THÔNG TIN ĐƠN NHẤT THEO BƯỚC 2 ---');

  // TC09: Phỏng vấn chủ hộ khi có thông tin phỏng vấn
  const interviewReport = {
    survey_data_json: {
      step2Data: {
        foundationCatScore: 3,
        foundationSource: 'Phỏng vấn chủ hộ',
      },
    },
  };
  const { section3: s3Interview } = Section3And4Mapper.map(
    interviewReport,
    interviewReport.survey_data_json,
    {},
    0,
    0,
    null
  );
  const tc09Passed = s3Interview.informationSource.vi === 'Phỏng vấn chủ hộ' &&
                     s3Interview.informationSource.en === 'Property owner interview' &&
                     !s3Interview.informationSource.vi.includes(',');
  assert(
    'TC09',
    'Nguồn thông tin đơn nhất cho ca phỏng vấn: "Phỏng vấn chủ hộ"',
    tc09Passed,
    `vi="${s3Interview.informationSource.vi}", en="${s3Interview.informationSource.en}"`
  );

  // TC10: Quan sát hiện trường cho ca tự suy luận hoặc vắng chủ
  const absenteeReport = {
    survey_data_json: {
      isAbsenteeSurvey: true,
      step2Data: {
        foundationCatScore: 4,
        foundationSource: 'Tự suy luận hiện trường',
      },
    },
  };
  const { section3: s3Absentee } = Section3And4Mapper.map(
    absenteeReport,
    absenteeReport.survey_data_json,
    {},
    0,
    0,
    null
  );
  const tc10Passed = s3Absentee.informationSource.vi === 'Quan sát hiện trường' &&
                     s3Absentee.informationSource.en === 'Site observation';
  assert(
    'TC10',
    'Nguồn thông tin đơn nhất cho ca vắng chủ/suy luận: "Quan sát hiện trường"',
    tc10Passed,
    `vi="${s3Absentee.informationSource.vi}", en="${s3Absentee.informationSource.en}"`
  );

  // --------------------------------------------------------------------------
  // NHÓM 5: MỤC IX HẠN CHẾ TIẾP CẬN & ẨN TẦNG HẦM KHI BASEMENTCOUNT=0 (Điểm 5)
  // --------------------------------------------------------------------------
  console.log('\n--- NHÓM 5: MỤC IX HẠN CHẾ TIẾP CẬN & ẨN TẦNG HẦM ---');

  // TC11: Ẩn dòng Tầng hầm khi basementCount === 0
  const noBasementPayload = {
    project_parcel_code: 'C&C-05-B-0026',
    survey_data_json: {
      buildingSpecs: {
        basementCount: 0,
      },
    },
  };
  const vmNoBasement = ReportViewModelMapper.buildViewModel(noBasementPayload);
  const hasBasementRowNo = (vmNoBasement.section9.accessAreas || []).some(
    (a: any) => a.area?.vi?.includes('Tầng hầm') || a.area?.en?.toLowerCase()?.includes('basement')
  );
  assert(
    'TC11',
    'Mục IX tự động ẨN dòng Tầng hầm khi công trình không có hầm (basementCount === 0)',
    !hasBasementRowNo,
    `Số dòng tiếp cận: ${vmNoBasement.section9.accessAreas?.length}, các dòng: ${vmNoBasement.section9.accessAreas?.map((a: any) => a.area?.vi).join(', ')}`
  );

  // TC12: Hiển thị dòng Tầng hầm khi basementCount > 0
  const withBasementPayload = {
    project_parcel_code: 'C&C-05-B-0026',
    survey_data_json: {
      buildingSpecs: {
        basementCount: 1,
      },
    },
  };
  const vmWithBasement = ReportViewModelMapper.buildViewModel(withBasementPayload);
  const hasBasementRowYes = (vmWithBasement.section9.accessAreas || []).some(
    (a: any) => a.area?.vi?.includes('Tầng hầm') || a.area?.en?.toLowerCase()?.includes('basement')
  );
  assert(
    'TC12',
    'Mục IX hiển thị đầy đủ dòng Tầng hầm khi công trình có hầm (basementCount > 0)',
    hasBasementRowYes,
    `Số dòng tiếp cận: ${vmWithBasement.section9.accessAreas?.length}, các dòng: ${vmWithBasement.section9.accessAreas?.map((a: any) => a.area?.vi).join(', ')}`
  );

  // --------------------------------------------------------------------------
  // NHÓM 6: MONOCHROME ĐEN CÔNG SỞ & CSS GHIM D (Điểm 6 & 7)
  // --------------------------------------------------------------------------
  console.log('\n--- NHÓM 6: MONOCHROME ĐEN CÔNG SỞ & CSS GHIM D ---');

  // TC13: Bảng tiếp cận Mục IX dùng thuần chữ đen #000000 (không xanh/đỏ)
  const templatePath = path.resolve(__dirname, '../modules/report/templates/residential/partials/page-08-section-9-conclusions.hbs');
  const section9Content = fs.readFileSync(templatePath, 'utf8');
  const hasOldGreen = section9Content.includes('#15803d');
  const hasOldRed = section9Content.includes('#b91c1c');
  const hasPureBlack = section9Content.includes('color: #000000;');
  const tc13Passed = !hasOldGreen && !hasOldRed && hasPureBlack;
  assert(
    'TC13',
    'Mục IX loại bỏ hoàn toàn mã màu xanh/đỏ (#15803d, #b91c1c), chuẩn monochrome đen #000000',
    tc13Passed,
    `hasOldGreen=${hasOldGreen}, hasOldRed=${hasOldRed}, hasPureBlack=${hasPureBlack}`
  );

  // TC14: Sửa lỗi ghim D bẹp dí (line-height normal & 1.25)
  const stylesPath = path.resolve(__dirname, '../modules/report/templates/residential/styles.css');
  const stylesContent = fs.readFileSync(stylesPath, 'utf8');
  const hasPinLineHeight = stylesContent.includes('.photo-defect-pin') &&
                           stylesContent.includes('line-height: normal !important;');
  const hasBadgeLineHeight = stylesContent.includes('.photo-defect-pin-badge') &&
                             stylesContent.includes('line-height: 1.25 !important;') &&
                             stylesContent.includes('display: inline-block !important;');
  assert(
    'TC14',
    'CSS ghim D khắc phục triệt để lỗi bẹp dí (line-height: normal và badge line-height: 1.25 display: inline-block)',
    hasPinLineHeight && hasBadgeLineHeight,
    `hasPinLineHeight=${hasPinLineHeight}, hasBadgeLineHeight=${hasBadgeLineHeight}`
  );

  // --------------------------------------------------------------------------
  // NHÓM 7: SƠ ĐỒ VỊ TRÍ KHÔNG GIAN BÌA (Điểm 8)
  // --------------------------------------------------------------------------
  console.log('\n--- NHÓM 7: SƠ ĐỒ VỊ TRÍ KHÔNG GIAN TRANG BÌA ---');

  // TC15: Sinh sơ đồ vector SVG vị trí thửa đất & Metro 2 trên bìa
  const mockPolygon: [number, number][] = [
    [10.7765, 106.7005],
    [10.7765, 106.7015],
    [10.7775, 106.7015],
    [10.7775, 106.7005],
  ];
  const svgDataUri = generateMetroSpatialVisualSvg(mockPolygon, 'B-00026-C&C (ST05)');
  const isDataUri = svgDataUri.startsWith('data:image/svg+xml;base64,');
  const decodedSvg = Buffer.from(svgDataUri.replace('data:image/svg+xml;base64,', ''), 'base64').toString('utf8');
  
  const hasParcelPolygon = decodedSvg.includes('stroke="#dc2626"');
  const hasNorthArrow = decodedSvg.includes('>N</text>');
  const hasScaleBar = decodedSvg.includes('stroke="#000000" stroke-width="2"');
  const hasMetroLegend = decodedSvg.includes('Tim tuyến Metro 2');
  // Tuyệt đối không vẽ đường dóng khoảng cách (distance measurement lines)
  const noMeasurementLines = !decodedSvg.includes('distanceToAlignment') && !decodedSvg.includes('mép hố đào:');

  const tc15Passed = isDataUri && hasParcelPolygon && hasNorthArrow && hasScaleBar && hasMetroLegend && noMeasurementLines;
  assert(
    'TC15',
    'Sơ đồ vị trí không gian Metro trên bìa sinh đúng chuẩn SVG: Đa giác đỏ, tim xanh, la bàn Bắc, thước tỷ lệ, KHÔNG vẽ đường dóng cự ly',
    tc15Passed,
    `isDataUri=${isDataUri}, hasParcel=${hasParcelPolygon}, hasNorth=${hasNorthArrow}, hasScale=${hasScaleBar}, noMeasurementLines=${noMeasurementLines}`
  );

  // --------------------------------------------------------------------------
  // TỔNG KẾT
  // --------------------------------------------------------------------------
  console.log('\n================================================================');
  const passCount = results.filter(r => r.passed).length;
  const failCount = results.filter(r => !r.passed).length;
  console.log(` TỔNG KẾT: ${passCount}/15 TEST CASES PASS (${failCount} FAILS)`);
  console.log('================================================================\n');

  if (failCount > 0) {
    process.exit(1);
  }
}

run15BusinessCases().catch(err => {
  console.error('Lỗi thực thi test suite:', err);
  process.exit(1);
});
