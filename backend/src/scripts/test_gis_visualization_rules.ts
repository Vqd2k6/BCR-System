/**
 * Kiểm thử thuần cho modules/gis-visualization/gis-visualization.rules.ts (không cần DB).
 * Chạy: npx ts-node --transpile-only src/scripts/test_gis_visualization_rules.ts
 */
import assert from 'node:assert/strict';
import {
  buildParcelMetrics,
  classifyFoundation,
  currentYearVn,
  floorTier,
  resolveConstructionYear,
  yearCohortFromAge,
} from '../modules/gis-visualization/gis-visualization.rules';
import type { ThematicSourceRow } from '../modules/gis-visualization/gis-visualization.rules';

let passed = 0;
function test(name: string, fn: () => void): void {
  fn();
  passed += 1;
  console.log(`  ✓ ${name}`);
}

const NOW = 2026;
const row = (over: Partial<ThematicSourceRow> = {}): ThematicSourceRow => ({
  parcel_id: 'p-1',
  building_type: 'STANDALONE',
  distance_to_centerline_m: null,
  report_id: 'r-1',
  report_status: 'APPROVED',
  report_type: 'STANDALONE',
  survey_data_json: {},
  specs: null,
  card: null,
  ...over,
});

console.log('gis-visualization rules');

test('năm thiếu ⇒ null, không mặc định 1999', () => {
  const r = resolveConstructionYear({}, {}, NOW);
  assert.equal(r.year, null);
  assert.equal(r.cohort, null);
});

test('năm JSON ưu tiên hơn SQL; năm tương lai bị loại', () => {
  assert.equal(resolveConstructionYear({ constructionYear: 1990 }, { year_of_construction: 2000 }, NOW).year, 1990);
  assert.equal(resolveConstructionYear({}, { year_of_construction: 2000 }, NOW).year, 2000);
  assert.equal(resolveConstructionYear({ constructionYear: 2030 }, {}, NOW).year, null);
});

test('nhóm tuổi đúng v4FromAge: <10 · 10–25 · 26–40 · >40', () => {
  assert.equal(yearCohortFromAge(9), 'AGE_LT_10');
  assert.equal(yearCohortFromAge(10), 'AGE_10_25');
  assert.equal(yearCohortFromAge(25), 'AGE_10_25');
  assert.equal(yearCohortFromAge(26), 'AGE_26_40');
  assert.equal(yearCohortFromAge(40), 'AGE_26_40');
  assert.equal(yearCohortFromAge(41), 'AGE_GT_40');
});

test('năm hiện tại theo giờ VN (UTC+7)', () => {
  assert.equal(currentYearVn(new Date('2026-12-31T18:00:00Z')), 2027);
  assert.equal(currentYearVn(new Date('2026-12-31T16:00:00Z')), 2026);
});

test('5 lựa chọn móng nhà dân', () => {
  assert.equal(classifyFoundation('Shallow - Móng nông (Móng băng / Móng đơn / Móng bè)'), 'SHALLOW');
  assert.equal(classifyFoundation('Wood - Móng cừ tràm / Nền gia cố'), 'WOOD');
  assert.equal(classifyFoundation('PC - Móng cọc ép BTCT'), 'PRECAST_PILE');
  assert.equal(classifyFoundation('CIP - Móng cọc khoan nhồi'), 'BORED_PILE');
  assert.equal(classifyFoundation('Unknown - Không rõ thông tin móng'), 'UNKNOWN');
});

test('6 lựa chọn móng chung cư', () => {
  assert.equal(classifyFoundation('Móng cọc khoan nhồi BTCT (Bored Piles D1000 - D1500)'), 'BORED_PILE');
  assert.equal(classifyFoundation('Móng bè trên nền cọc khoan nhồi (Piled Raft Foundation)'), 'BORED_PILE');
  assert.equal(classifyFoundation('Móng tường vây kết hợp cọc Barrette (Diaphragm Wall + Barrette)'), 'BORED_PILE');
  assert.equal(classifyFoundation('Móng bè hộp tầng hầm BTCT toàn khối (Box Raft Foundation)'), 'RAFT');
  assert.equal(classifyFoundation('Móng cọc ép / cọc ly tâm D500 - D800'), 'PRECAST_PILE');
  assert.equal(classifyFoundation('Khác (Ghi chú chi tiết)'), 'OTHER');
});

test('móng dạng mã enum cũ trong JSON; rỗng ⇒ null', () => {
  assert.equal(classifyFoundation('CAT_1_MONG_NONG_GIA_CO'), 'SHALLOW');
  assert.equal(classifyFoundation('CAT_4_MONG_COC_BTCT'), 'PRECAST_PILE');
  assert.equal(classifyFoundation('CAT_5_KHONG_XAC_DINH'), 'UNKNOWN');
  assert.equal(classifyFoundation(''), null);
  assert.equal(classifyFoundation(undefined), null);
});

test('cột SQL có DEFAULT giả bị bỏ qua (foundation_category, structural_system, floor_count, basement_count)', () => {
  const m = buildParcelMetrics(row({
    specs: { foundation_category: 'CAT_2_MONG_DON_BTCT', structural_system: 'KHUNG_BTCT_CHIU_LUC', floor_count: 1, basement_count: 0 },
  }), NOW);
  assert.equal(m.foundationBucket, null);
  assert.equal(m.structureClass, null);
  assert.equal(m.aboveFloors, null);
  assert.equal(m.floorTier, null);
  assert.equal(m.basementFloors, null);
});

test('nhóm số tầng', () => {
  assert.equal(floorTier(0), null);
  assert.equal(floorTier(1), 'F1');
  assert.equal(floorTier(3), 'F2_3');
  assert.equal(floorTier(5), 'F4_5');
  assert.equal(floorTier(9), 'F6_9');
  assert.equal(floorTier(10), 'F10_PLUS');
});

test('Burland lấy cấp thô localMaxGrade, tách bạch Cấp 0 và Cấp 1; không dùng e1_burland_score', () => {
  const g0 = buildParcelMetrics(row({ survey_data_json: { burlandSummary: { localMaxGrade: 0 } }, card: { e1_burland_score: 0 } }), NOW);
  const g1 = buildParcelMetrics(row({ survey_data_json: { burlandSummary: { localMaxGrade: 1 } }, card: { e1_burland_score: 0 } }), NOW);
  const none = buildParcelMetrics(row({ card: { e1_burland_score: 3 } }), NOW);
  assert.equal(g0.burlandMaxGrade, 0);
  assert.equal(g1.burlandMaxGrade, 1);
  assert.equal(none.burlandMaxGrade, null);
});

test('ECS / VI override chỉ áp dụng khi có Engineering Judgement', () => {
  const card = { ecs_class: 'GOOD', overridden_ecs_class: 'CRITICAL', vi_class: 'LOW', overridden_vi_class: 'VERY_HIGH' };
  const off = buildParcelMetrics(row({ card: { ...card, is_engineering_judgement_applied: false } }), NOW);
  const on = buildParcelMetrics(row({ card: { ...card, is_engineering_judgement_applied: true } }), NOW);
  assert.equal(off.ecsClass, 'GOOD');
  assert.equal(off.viClass, 'LOW');
  assert.equal(on.ecsClass, 'CRITICAL');
  assert.equal(on.viClass, 'VERY_HIGH');
});

test('BRA không bao giờ đọc building_risk_assessment_bra', () => {
  const m = buildParcelMetrics(row({ card: { building_risk_assessment_bra: 'LOW_RISK' } }), NOW);
  assert.equal(m.braLevel, null);
});

test('BRA: cấp đã chốt trong JSON thắng ma trận; thiếu thì tra V×I', () => {
  const explicit = buildParcelMetrics(row({ survey_data_json: { braAssessment: { braStatus: 'HIGH' }, vi: { viClass: 'LOW' }, impactAssessment: { iCode: 'I1' } } }), NOW);
  assert.equal(explicit.braLevel, 'HIGH');
  const matrix = buildParcelMetrics(row({ survey_data_json: { vi: { viClass: 'HIGH' }, impactAssessment: { iCode: 'I4' } } }), NOW);
  assert.equal(matrix.braLevel, 'VERY_HIGH');
  assert.equal(matrix.impactCode, 'I4');
});

test('hồ sơ DRAFT / REJECTED hoặc không có hồ sơ ⇒ mọi chỉ số null', () => {
  for (const status of ['DRAFT', 'REJECTED']) {
    const m = buildParcelMetrics(row({ report_status: status, survey_data_json: { constructionYear: 1990, vi: { viClass: 'HIGH' } } }), NOW);
    assert.equal(m.reportStatus, null);
    assert.equal(m.constructionYear, null);
    assert.equal(m.viClass, null);
  }
  const none = buildParcelMetrics(row({ report_id: null, report_status: null }), NOW);
  assert.equal(none.reportStatus, null);
});

test('chung cư chưa có Master ⇒ UNASSESSED, vẫn nhận diện là chung cư', () => {
  const m = buildParcelMetrics(row({ building_type: 'CONDOMINIUM', report_id: null, report_status: null, report_type: null }), NOW);
  assert.equal(m.isCondoMaster, true);
  assert.equal(m.reportStatus, null);
  assert.equal(m.floorTier, null);
});

test('đất trống: không xếp nhóm năm / móng / tầng', () => {
  const m = buildParcelMetrics(row({ survey_data_json: { isVacantLand: true, constructionYear: 2000, aboveFloors: 2, foundationType: 'PC - Móng cọc ép BTCT' } }), NOW);
  assert.equal(m.isVacantLand, true);
  assert.equal(m.yearCohort, null);
  assert.equal(m.foundationBucket, null);
  assert.equal(m.floorTier, null);
});

console.log(`\n${passed} test passed`);
