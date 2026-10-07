/**
 * Test Suite: Kiểm thử Đơn vị cho Module Report V2 Mappers & Calculators
 */
import { CadastralInfoMapper } from '../modules/report_v2/mappers/cadastral-info.mapper';
import { BurlandCalculator } from '../modules/report_v2/mappers/burland-calculator';
import { RiskScoringCalculator } from '../modules/report_v2/mappers/risk-scoring-calculator';
import { ReportV2ViewModelMapper } from '../modules/report_v2/mappers/report-v2-viewmodel.mapper';

function assert(condition: boolean, message: string) {
  if (!condition) {
    console.error(`❌ FAILED: ${message}`);
    process.exit(1);
  } else {
    console.log(`✅ PASSED: ${message}`);
  }
}

async function runTests() {
  console.log('--- 1. Kiểm thử CadastralInfoMapper ---');
  const bId1 = CadastralInfoMapper.formatBuildingId('C&C-01-B-0081', 'ZONE_01', 'C&C');
  assert(bId1 === 'B-00081-C&C (ST1)', `Building ID hoán vị chính xác: ${bId1}`);

  const bId2 = CadastralInfoMapper.formatBuildingId('TBM-09-B-01064', 'ZONE_09', 'TBM');
  assert(bId2 === 'B-01064-TBM (ST5)', `Building ID Zone 9 ga ST5: ${bId2}`);

  const reportNo = CadastralInfoMapper.formatReportNo(bId2, 1790480320866, '00');
  assert(reportNo === 'REPORT-B-01064-TBM-PHASE1-1790480320866 (Rev. 00)', `Report No sinh chuẩn xác: ${reportNo}`);

  const filingNo = CadastralInfoMapper.formatFilingNo(bId2, 2026);
  assert(filingNo === 'Số: 01064/BCS-P1/CRLG-2026', `Filing No: ${filingNo}`);

  console.log('\n--- 2. Kiểm thử BurlandCalculator ---');
  assert(BurlandCalculator.calculateGradeFromCrackWidth(0.05) === 0, 'w=0.05 -> Cấp 0');
  assert(BurlandCalculator.calculateGradeFromCrackWidth(0.8) === 1, 'w=0.8 -> Cấp 1');
  assert(BurlandCalculator.calculateGradeFromCrackWidth(4.0) === 2, 'w=4.0 -> Cấp 2');
  assert(BurlandCalculator.calculateGradeFromCrackWidth(8.0) === 3, 'w=8.0 -> Cấp 3');
  assert(BurlandCalculator.calculateGradeFromCrackWidth(18.0) === 4, 'w=18.0 -> Cấp 4');
  assert(BurlandCalculator.calculateGradeFromCrackWidth(30.0) === 5, 'w=30.0 -> Cấp 5');

  const mockFloors = [
    {
      floorName: 'Tầng trệt',
      zones: [
        { zoneCode: 'Z-01', roomName: 'Bếp', defects: [] },
        { zoneCode: 'Z-08', roomName: 'Bếp/Ăn', defects: [{ widthMm: 4.0, lengthM: 2.2 }] },
      ],
    },
  ];
  const burlandRes = BurlandCalculator.computeBurlandSection(mockFloors);
  assert(burlandRes.predominantGrade.vi.includes('Cấp 0'), 'Cấp chủ đạo là Cấp 0');
  assert(burlandRes.localMaxGrade.vi.includes('Cấp 2'), 'Cấp cục bộ lớn nhất là Cấp 2');
  assert(burlandRes.governingZone.vi.includes('Z-08'), 'Vùng chi phối là Z-08');

  console.log('\n--- 3. Kiểm thử RiskScoringCalculator ---');
  const mockReport = {
    project_parcel_code: 'C&C-01-B-01064',
    zone_id: 'ZONE_09',
    survey_data_json: {
      metroOffsetDistance: '30.0m',
      ecs: { ecsClass: 'MODERATE' },
    },
  };
  const riskRes = RiskScoringCalculator.computeRiskAssessment(mockReport, 2);
  assert(riskRes.scoring.totalBraScoreDisplay === '26 + A', `Điểm BRA hiển thị: ${riskRes.scoring.totalBraScoreDisplay}`);
  const scoreA = riskRes.scoring.items.find(i => i.code === 'A');
  assert(scoreA?.scoreDisplay === 'Chờ / Pending', 'Điểm A tự động ở trạng thái Chờ / Pending');
  assert(riskRes.overallRisk.grade.vi === 'Rủi ro thấp', 'Cấp độ rủi ro tổng thể là Rủi ro thấp');

  console.log('\n--- 4. Kiểm thử ReportV2ViewModelMapper Toàn Diện ---');
  const fullViewModel = ReportV2ViewModelMapper.buildViewModel(mockReport);
  assert(fullViewModel.metadata.buildingId.startsWith('B-01064'), 'Building ID hợp lệ trong ViewModel');
  assert(fullViewModel.signatures3Party.length === 3, 'Đầy đủ 3 cấp duyệt chữ ký');
  assert(fullViewModel.section1.buildingId === fullViewModel.metadata.buildingId, 'Mã công trình đồng bộ Chương I');
  assert(fullViewModel.section6.counts.surfaceFinishCracks === 1, 'Số lượng vết nứt hoàn thiện');
  assert(fullViewModel.appendix1.length === 5, 'Phụ lục 1 có đủ 5 ảnh ngoại thất P01-P05');
  assert(fullViewModel.appendix2.length === 2, 'Phụ lục 2 có 2 tầng (Trệt và Lửng)');
  assert(fullViewModel.appendix4.equipmentList.length === 4, 'Phụ lục 4 có đủ 4 thiết bị đo kiểm');

  console.log('\n🎉 TOÀN BỘ CÁC BÀI TEST PHASE 2 ĐÃ VƯỢT QUA 100%!');
}

runTests().catch((e) => {
  console.error(e);
  process.exit(1);
});
