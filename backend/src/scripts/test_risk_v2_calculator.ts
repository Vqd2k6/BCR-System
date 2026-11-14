/**
 * Unit test hàm tính rủi ro report nhà dân v2 (mẫu ST01-B-0056-CC). Không cần DB.
 * Chạy: npx ts-node src/scripts/test_risk_v2_calculator.ts
 */
import {
  BURLAND_ECS_MATRIX,
  braLevel,
  calculateRiskV2,
  classifyEcsV2,
  objectGroupScoreE,
  usageScoreE,
  type RiskV2DefectInput,
  type RiskV2Input,
} from '../modules/report/mappers/v2/risk-v2.calculator';
import { parseWidthMm } from '../modules/report/mappers/v2/residential-v2.presenter';

let passed = 0;
let failed = 0;
function eq<T>(actual: T, expected: T, label: string): void {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (ok) passed++;
  else failed++;
  console.log(`  ${ok ? '✅' : '❌'} ${label}${ok ? '' : ` — nhận ${JSON.stringify(actual)}, cần ${JSON.stringify(expected)}`}`);
}

const crack = (code: string, widthMm: number, isStructural = false): RiskV2DefectInput => ({ code, widthMm, isStructural, isRebarExposure: false });
const nonCrack = (code: string, isRebarExposure = false): RiskV2DefectInput => ({ code, widthMm: null, isStructural: false, isRebarExposure });

const base: RiskV2Input = {
  defects: [],
  burlandMaxGrade: 0,
  differentialSettlementObserved: false,
  foundationCat: 4,
  impactCode: 'I3',
  usage: 'Cửa hàng / Shop / Bách hóa',
  objectGroup: 'GENERAL',
};

console.log('\n1. Hồ sơ mẫu B-0056-CC (trang 5–8 của mẫu)');
{
  const defects = [crack('D-19', 4.0), crack('D-02', 0.25), crack('D-03', 0.25), nonCrack('D-13'), nonCrack('D-11')];
  const r = calculateRiskV2({ ...base, defects, burlandMaxGrade: 2 });
  eq(r.ecs.grade, 'MODERATE', 'ECS = Trung bình (nứt phi kết cấu lớn nhất 4,0 mm < 5 mm)');
  eq(r.ecs.governingDefectCode, 'D-19', 'khuyết tật quyết định = vết nứt 4,0 mm');
  eq(r.matrix.level, 2, 'ma trận B-2 × Trung bình = 2 Rủi ro thấp');
  eq(r.bra.scores, { A: 14, B: 8, C: 10, D: 10, E: 3 }, 'A–E = 14/8/10/10/3');
  eq(r.bra.total, 45, 'tổng BRA = 45');
  eq(r.bra.level, 3, 'BRA 45 = 3 Rủi ro trung bình');
  eq(r.overall, { level: 3, source: 'BRA' }, 'tổng thể = bất lợi hơn = 3 (theo BRA)');
}

console.log('\n2. ECS 4 mức');
const ecs = (defects: RiskV2DefectInput[], settlement = false) => classifyEcsV2({ defects, differentialSettlementObserved: settlement }).grade;
eq(ecs([]), 'GOOD', 'không khuyết tật = Tốt');
eq(ecs([crack('D-1', 0.3), crack('D-2', 0.3, true)]), 'GOOD', 'nứt đúng 0,3 mm = Tốt');
eq(ecs([crack('D-1', 0.31)]), 'MODERATE', 'nứt phi kết cấu 0,31 mm = Trung bình');
eq(ecs([crack('D-1', 1.0, true)]), 'MODERATE', 'nứt kết cấu đúng 1 mm = Trung bình');
eq(ecs([crack('D-1', 1.01, true)]), 'POOR', 'nứt kết cấu 1,01 mm = Kém');
eq(ecs([crack('D-1', 5.0)]), 'MODERATE', 'nứt phi kết cấu đúng 5 mm = Trung bình');
eq(ecs([crack('D-1', 5.1)]), 'POOR', 'nứt phi kết cấu 5,1 mm = Kém');
eq(ecs([crack('D-1', 2.0, true)]), 'POOR', 'nứt kết cấu đúng 2 mm = Kém');
eq(ecs([crack('D-1', 2.1, true)]), 'DANGEROUS', 'nứt kết cấu 2,1 mm = Nguy hiểm');
eq(ecs([crack('D-1', 10.0)]), 'POOR', 'nứt phi kết cấu đúng 10 mm = Kém');
eq(ecs([crack('D-1', 10.5)]), 'DANGEROUS', 'nứt phi kết cấu 10,5 mm = Nguy hiểm');
eq(ecs([nonCrack('D-1', true)]), 'POOR', 'lộ cốt thép = Kém');
eq(ecs([], true), 'DANGEROUS', 'có lún lệch = Nguy hiểm');
eq(ecs([crack('D-1', 3.0, false)]), 'MODERATE', 'nứt 3 mm trên vùng Z (phi kết cấu) = Trung bình');
eq(ecs([crack('D-1', 3.0, true)]), 'DANGEROUS', 'cùng 3 mm nhưng ghim trên cấu kiện E = Nguy hiểm');

console.log('\n3. Ma trận Burland × ECS (đủ 20 ô theo mẫu)');
const expected = [[1, 1, 1, 2], [1, 1, 2, 2], [2, 2, 3, 3], [3, 3, 4, 4], [4, 4, 4, 4]];
eq(BURLAND_ECS_MATRIX.map((r) => [...r]), expected, 'bảng ma trận khớp mẫu');
eq(calculateRiskV2({ ...base, burlandMaxGrade: 5, defects: [] }).matrix, { burlandRow: 4, level: 4 }, 'B-5 dùng hàng B-4/B-5');

console.log('\n4. Ngưỡng BRA');
eq([0, 19, 20, 39, 40, 59, 60, 100].map(braLevel), [1, 1, 2, 2, 3, 3, 4, 4], '0–19 / 20–39 / 40–59 / ≥60');

console.log('\n5. Chỉ số C, D, E');
eq([1, 2, 3, 4, 5].map((c) => calculateRiskV2({ ...base, foundationCat: c }).bra.scores.C), [0, 0, 5, 10, 15], 'C: CAT1–5 = 0/0/5/10/15');
eq((['I1', 'I2', 'I3', 'I4'] as const).map((i) => calculateRiskV2({ ...base, impactCode: i }).bra.scores.D), [0, 5, 10, 15], 'D: I1–I4 = 0/5/10/15');
eq(usageScoreE('Nhà bỏ trống'), 0, 'E: Nhà bỏ trống = 0');
eq(usageScoreE('Kho hàng / Xưởng sản xuất'), 0, 'E: Kho hàng / Xưởng = 0');
eq(usageScoreE('  nhà ở gia đình '), 3, 'E: Nhà ở (chuẩn hóa khoảng trắng/hoa thường) = 3');
eq(usageScoreE('Bệnh viện / Y tế'), 7, 'E: Bệnh viện = 7');
eq(usageScoreE('Cơ sở tôn giáo (Chùa, Nhà thờ)'), 7, 'E: Cơ sở tôn giáo = 7');
eq(usageScoreE('Khác (Nhập chi tiết...)'), null, 'E: Khác → không xác định theo công năng');
eq(objectGroupScoreE('critical'), 10, 'E: nhóm CRITICAL = 10');
eq(calculateRiskV2({ ...base, usage: 'Cơ sở tôn giáo (Chùa, Nhà thờ)', objectGroup: 'CRITICAL' }).bra.scores.E, 10, 'E = max(công năng 7, nhóm 10) = 10');
eq(calculateRiskV2({ ...base, usage: 'Nhà bỏ trống', objectGroup: 'GENERAL' }).bra.scores.E, 3, 'E = max(công năng 0, nhóm 3) = 3');
eq(calculateRiskV2({ ...base, usage: 'Khác (Nhập chi tiết...)', objectGroup: 'IMPORTANT' }).bra.scores.E, 7, 'Công năng "Khác" → theo nhóm IMPORTANT = 7');

console.log('\n6. Thiếu dữ liệu: không giả định');
{
  const r = calculateRiskV2({ ...base, foundationCat: null, impactCode: null, burlandMaxGrade: 1 });
  eq(r.bra.missing, ['C', 'D'], 'thiếu CAT và cự ly → C, D thiếu');
  eq(r.bra.total, null, 'tổng BRA = null (in --)');
  eq(r.overall, { level: 1, source: 'MATRIX' }, 'tổng thể chỉ theo ma trận khi thiếu BRA');
  const none = calculateRiskV2({ ...base, burlandMaxGrade: null, usage: null, objectGroup: null });
  eq(none.bra.missing, ['A', 'E'], 'thiếu Burland và công năng/nhóm → A, E thiếu');
  eq(none.overall, { level: null, source: null }, 'không có ma trận lẫn BRA → không có cấp tổng thể');
}

console.log('\n7. Đọc bề rộng từ ViewModel');
eq(['0.45 mm', '0,45 mm', '4.0', 2, '–', ''].map((v) => parseWidthMm(v)), [0.45, 0.45, 4, 2, null, null], 'chuỗi kèm đơn vị, dấu phẩy, số, gạch ngang');

console.log(`\nKết quả: ${passed} đạt, ${failed} lỗi`);
process.exit(failed === 0 ? 0 : 1);
