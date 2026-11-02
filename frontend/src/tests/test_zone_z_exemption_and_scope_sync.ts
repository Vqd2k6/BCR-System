/**
 * test_zone_z_exemption_and_scope_sync.ts
 * Miễn Vùng Z: lý do bắt buộc, ảnh tổng quan vẫn bắt buộc, có tầng miễn thì không được khai tiếp cận 100%.
 * Không cần DB.
 */
import assert from 'node:assert/strict';
import { verifyDataCompletenessGate } from '../features/survey-phase1/engine/completenessGate';
import { getDefaultInitialFormData } from '../features/survey-phase1/store/initialFormData';
import type { FloorSurveyData, Phase1SurveyFormData } from '../features/survey-phase1/types/phase1.types';
import { validateStep } from '../features/survey-phase1/utils/stepValidator';
import {
  getZoneExemptFloors,
  hasFloorZoneData,
  NO_ZONES_REASON_PRESETS,
} from '../features/survey-phase1/utils/zoneExemption';

const OVERVIEW = [{ id: 'o1', url: 'https://pub-metro2.r2.dev/o1.jpg' }];
const EXEMPT_E = { hasStructuralElements: false, noStructuralElementsReason: 'Tầng mái không có cấu kiện riêng' };

const floor = (patch: Partial<FloorSurveyData>): FloorSurveyData => ({
  id: 'f1',
  floorName: 'Tầng 2',
  overviewPhotos: OVERVIEW,
  cadSketchPhotoUrl: '',
  cadZonePins: [],
  cadElementPins: [],
  zones: [],
  structuralElements: [],
  ...EXEMPT_E,
  ...patch,
});

const form = (floors: FloorSurveyData[], type: 'FULL_100' | 'LIMITED' = 'LIMITED'): Phase1SurveyFormData => ({
  ...getDefaultInitialFormData(),
  floors,
  accessLimitation: { ...getDefaultInitialFormData().accessLimitation, type },
});

const missing = (step: number, data: Phase1SurveyFormData): string[] =>
  validateStep(step, data).missingFields.map((item) => item.label);
const has = (labels: string[], text: string): boolean => labels.some((label) => label.includes(text));

const reason = NO_ZONES_REASON_PRESETS[0];

// Bước 3
const passed = missing(3, form([floor({ hasZones: false, noZonesReason: reason })]));
assert.equal(has(passed, 'Vùng Z'), false, 'Tầng miễn đủ lý do không bị đòi Vùng Z');
assert.equal(has(passed, 'Ảnh chụp tổng quan'), false);

assert.ok(
  has(missing(3, form([floor({ hasZones: false, noZonesReason: reason, overviewPhotos: [] })])), 'Ảnh chụp tổng quan'),
  'Miễn Z vẫn bắt buộc ảnh tổng quan'
);
assert.ok(has(missing(3, form([floor({ hasZones: false, noZonesReason: 'ngắn' })])), 'Lý do miễn Vùng Z'));
assert.ok(has(missing(3, form([floor({ hasZones: false })])), 'Lý do miễn Vùng Z'), 'Không có lý do mặc định');

// Hồ sơ cũ không có cờ giữ nguyên hành vi
assert.ok(has(missing(3, form([floor({})])), 'Điểm chấm Vùng Z'));
assert.ok(has(missing(3, form([floor({ hasZones: true })])), 'Điểm chấm Vùng Z'));

// Tầng trống không còn là lý do miễn, và tầng đã có dữ liệu Z thì không được miễn
assert.equal(NO_ZONES_REASON_PRESETS.some((item) => item.includes('Tầng trống')), false);
assert.equal(hasFloorZoneData(floor({})), false);
assert.equal(hasFloorZoneData(floor({ cadZonePins: [{ zoneCode: 'Z-01' } as FloorSurveyData['cadZonePins'][number]] })), true);

// Bước phạm vi
const exemptFloor = floor({ hasZones: false, noZonesReason: reason });
assert.ok(has(missing(5, form([exemptFloor], 'FULL_100')), 'Hạn chế tiếp cận'), 'Có tầng miễn thì không được FULL_100');
assert.equal(has(missing(5, form([exemptFloor], 'LIMITED')), 'Hạn chế tiếp cận'), false);
assert.equal(has(missing(5, form([floor({})], 'FULL_100')), 'Hạn chế tiếp cận'), false);
assert.equal(getZoneExemptFloors(form([exemptFloor, floor({ id: 'f2' })]).floors).length, 1);

// Nguyên nhân chính bắt buộc khi LIMITED, kể cả hồ sơ bị ép LIMITED do tầng miễn Z
const withReason = (data: Phase1SurveyFormData, mainReason: string): Phase1SurveyFormData => ({
  ...data,
  accessLimitation: { ...data.accessLimitation, mainReason },
});
const REASON_LABEL = 'Nguyên nhân chính hạn chế';
assert.ok(has(missing(5, form([floor({})], 'LIMITED')), REASON_LABEL), 'LIMITED chưa chọn nguyên nhân bị chặn');
assert.ok(has(missing(5, form([exemptFloor], 'LIMITED')), REASON_LABEL), 'Tầng miễn Z vẫn cần nguyên nhân');
assert.ok(has(missing(5, withReason(form([floor({})], 'LIMITED'), 'Khác: ')), REASON_LABEL), 'Tiền tố Khác trống bị chặn');
assert.ok(has(missing(5, withReason(form([floor({})], 'LIMITED'), '   ')), REASON_LABEL), 'Chỉ có dấu cách bị chặn');
assert.equal(has(missing(5, withReason(form([floor({})], 'LIMITED'), 'Chủ nhà đi vắng / Khóa cửa')), REASON_LABEL), false);
assert.equal(has(missing(5, withReason(form([floor({})], 'LIMITED'), 'Người thuê không mở cửa')), REASON_LABEL), false);
assert.equal(has(missing(5, form([floor({})], 'FULL_100')), REASON_LABEL), false, 'FULL_100 không cần nguyên nhân');

// Cổng dữ liệu: dù hồ sơ khai FULL_100 cũng không được ALLOW khi có tầng miễn
const baseGate = {
  foundationCatScore: 3,
  photoP01: { url: 'p1', notApplicable: false } as Phase1SurveyFormData['photoP01'],
  photoP02: { url: 'p2', notApplicable: false } as Phase1SurveyFormData['photoP02'],
  photoP04: { url: 'p4', notApplicable: false } as Phase1SurveyFormData['photoP04'],
  asBuiltDrawingPhotoUrl: 'drawing',
};
const zoneFloor = floor({ id: 'f2', zones: [{ id: 'z1' } as FloorSurveyData['zones'][number]] });
const exemptGate = verifyDataCompletenessGate({ ...form([zoneFloor, exemptFloor], 'FULL_100'), ...baseGate });
assert.equal(exemptGate.overallSuggestedDecision, 'CONDITIONAL');
assert.equal(exemptGate.internalAccess.label, 'Hạn chế tiếp cận');
const allExemptGate = verifyDataCompletenessGate({ ...form([exemptFloor], 'LIMITED'), ...baseGate });
assert.equal(allExemptGate.overallSuggestedDecision, 'CONDITIONAL', 'Miễn mọi tầng vẫn phải CONDITIONAL');
const normalGate = verifyDataCompletenessGate({ ...form([zoneFloor], 'FULL_100'), ...baseGate });
assert.equal(normalGate.internalAccess.label, 'Đã khảo sát 100%', 'Hồ sơ thường không bị đổi');

console.log('✅ test_zone_z_exemption_and_scope_sync: đạt');
