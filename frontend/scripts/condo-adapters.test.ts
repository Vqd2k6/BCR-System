import assert from 'node:assert/strict';
import { DEFAULT_CONDO_OWNER_FEEDBACK } from '../src/features/survey-condo-unit/utils/condoOwnerFeedback';
import { rotatePinCoords } from '../src/features/zone-management/components/review-queue/stepwise/utils/pinCoordinates';
import {
  adaptUnitAbsentee,
  adaptUnitBeamSagging,
  adaptUnitDoorJamming,
  getMeaningfulOwnerFeedback,
  getPhotosOutsideAbsenceLogs,
  adaptUnitLeakage,
  isBeamDetailVisible,
  isRenovationDescVisible,
  isSettlementNotesVisible,
  resolveUnitCadUrl,
  toSurveyDoorJammingPayload,
  toSurveyLeakagePayload,
  needsCondoAbsenceDecision,
} from '../src/features/zone-management/components/review-queue/condo/unit-studio/condo-unit.adapters';
import { compareCodes, isInterviewNotesVisible } from '../src/features/zone-management/components/review-queue/condo/core/condo-normalize.utils';
import { mapRawCondoDefects, resolveRawCondoElements, splitCondoZonesAndElements } from '../src/features/zone-management/components/review-queue/condo/core/condo-zone.mappers';
import { mergeCanvasDefects, toCanvasDefect } from '../src/features/zone-management/components/review-queue/condo/core/condo-defect-canvas.adapters';
import { deriveDefectE6, DOOR_SCREENING_CATEGORY, isLeakTypeMissing, LEAK_SCREENING_CATEGORY } from '../src/components/canvas/defectTaxonomy';
import type { CondoAbsenceView, CondoDefectItemData } from '../src/features/zone-management/components/review-queue/condo/types/condo-audit.types';

// Khóa form khảo sát
const surveyLeak = adaptUnitLeakage({
  upperFloorWaterLeakage: {
    has: true,
    leakageItems: [
      { id: 'a', location: 'Trần WC', description: 'Ố vàng', ctxPhotoUrl: 'ctx.jpg', cuPhotoUrl: 'cu.jpg' },
      { id: 'b', location: 'Hộp gen', description: 'Rỉ nước', photoUrl: 'old.jpg' },
    ],
  },
});
assert.equal(surveyLeak.hasLeakage, true);
assert.equal(surveyLeak.items.length, 2);
assert.equal(surveyLeak.items[1].ctxPhotoUrl, 'old.jpg');

const legacyLeak = adaptUnitLeakage({ upperFloorWaterLeakage: { has: true, location: 'Trần bếp' } });
assert.equal(legacyLeak.items[0].location, 'Trần bếp');

assert.equal(adaptUnitDoorJamming({ doorJammingStatus: 'JAMMED' }).hasJamming, true);
assert.equal(adaptUnitDoorJamming({ doorJammingStatus: 'NORMAL' }).hasJamming, false);

// Khóa Admin đã sửa được ưu tiên
assert.equal(
  adaptUnitLeakage({
    waterLeakageFromUpperFloor: { hasLeakage: false },
    upperFloorWaterLeakage: { has: true, leakageItems: [{ id: 'a' }] },
  }).hasLeakage,
  false
);
assert.equal(
  adaptUnitDoorJamming({ doorJamming: { hasJamming: false }, doorJammingStatus: 'JAMMED' }).hasJamming,
  false
);

// Thiếu dữ liệu không được sinh số hoặc kết luận giả
assert.deepEqual(adaptUnitLeakage({}), { hasLeakage: false, items: [] });
const emptyBeam = adaptUnitBeamSagging(undefined);
assert.equal(emptyBeam.level, null);
assert.equal(emptyBeam.sagMm, null);
assert.equal(emptyBeam.hasSagging, false);
assert.equal(adaptUnitBeamSagging({ hasSagging: true, location: 'Dầm khách', sagMm: 4 }).position, 'Dầm khách');

// Thứ tự Z/E/D
assert.ok(compareCodes('Z-02', 'Z-10') < 0);
const ordered = splitCondoZonesAndElements(
  [{ zoneCode: 'Z-03' }, { zoneCode: 'E-02' }, { zoneCode: 'Z-10' }, { zoneCode: 'Z-02' }, { zoneCode: 'E-01' }],
  [],
  'Tầng 1'
);
assert.deepEqual(ordered.damageZones.map((z) => z.zoneCode), ['Z-02', 'Z-03', 'Z-10']);
assert.deepEqual(ordered.structuralElements.map((e) => e.elementCode), ['E-01', 'E-02']);
assert.deepEqual(mapRawCondoDefects([{ defectCode: 'D-10' }, { defectCode: 'D-02' }], 'z').map((d) => d.defectCode), ['D-02', 'D-10']);

// Ô phụ thuộc điều kiện
assert.equal(isBeamDetailVisible(adaptUnitBeamSagging({ hasSagging: false, sagMm: 0, spanM: 0 })), false);
assert.equal(isBeamDetailVisible(adaptUnitBeamSagging({ hasSagging: true, sagMm: 4 })), true, 'KSV có võng nhưng không có level');
assert.equal(isBeamDetailVisible(adaptUnitBeamSagging({ level: 1 })), true);
assert.equal(isBeamDetailVisible(adaptUnitBeamSagging({ hasSagging: false, level: 0, notes: 'Dữ liệu cũ' })), true);
assert.equal(isRenovationDescVisible({ hasRenovated: false, description: '' }, {}), false);
assert.equal(isRenovationDescVisible({ hasRenovated: false, description: '' }, { majorRepair: 1 }), true);
assert.equal(isRenovationDescVisible({ hasRenovated: false, description: 'Cũ' }, {}), true);
assert.equal(isSettlementNotesVisible('NONE', ''), false);
assert.equal(isSettlementNotesVisible('', ''), false);
assert.equal(isSettlementNotesVisible('SLIGHT', ''), true);
assert.equal(isInterviewNotesVisible(0, ''), false);
assert.equal(isInterviewNotesVisible(undefined, undefined), false);
assert.equal(isInterviewNotesVisible(1, ''), true);
assert.equal(isInterviewNotesVisible(0, 'Cũ'), true);

assert.deepEqual(resolveUnitCadUrl({ unitCadUrl: 'unit.png' }, { floor_cad_url: 'floor.png' }), {
  cadUrl: 'unit.png',
  isFloorCadFallback: false,
});
assert.deepEqual(resolveUnitCadUrl({}, { floor_cad_url: 'floor.png' }), {
  cadUrl: 'floor.png',
  isFloorCadFallback: true,
});
assert.deepEqual(resolveUnitCadUrl({}, {}), { cadUrl: '', isFloorCadFallback: false });
assert.equal(resolveUnitCadUrl({}, { unit_cad_url: 'db.png', floor_cad_url: 'floor.png' }).cadUrl, 'db.png');

assert.equal(adaptUnitAbsentee({}), null);
const absentee = adaptUnitAbsentee({
  isAbsentee: true,
  absenteeInfo: { absenceReason: 'HOMEOWNER_ABSENT', absenteeMinutesPhotos: ['a.jpg'], attemptCount: 3 },
  absenteeMinutesPhotos: ['a.jpg', 'b.jpg'],
});
assert.equal(absentee?.reason, 'Chủ nhà đi vắng / Khóa cửa ngoài');
assert.deepEqual(absentee?.photos, ['a.jpg', 'b.jpg']);
assert.equal(absentee?.attemptCount, 3);

console.log('[condo-adapters] OK');

// Khi lưu, dạng hiển thị trở về đúng khóa form để báo cáo và bộ đọc dùng chung một nguồn
const leakPayload = toSurveyLeakagePayload({ hasLeakage: false, items: [] });
assert.deepEqual(leakPayload.leakageItems, []);
assert.equal(leakPayload.location, '');
assert.equal(adaptUnitLeakage({ upperFloorWaterLeakage: { ...leakPayload } }).hasLeakage, false);

const door = adaptUnitDoorJamming({ doorJammingStatus: 'JAMMED' });
const doorPayload = toSurveyDoorJammingPayload({ ...door, status: 'NORMAL' });
assert.equal(doorPayload.doorJammingStatus, 'NORMAL');
assert.equal(doorPayload.doorJamming.hasJamming, false);

// Xoay đủ 4 lần thì ghim trở về vị trí cũ
let rotated = { x: 30.5, y: 72.1 };
for (let i = 0; i < 4; i += 1) rotated = rotatePinCoords(rotated.x, rotated.y);
assert.deepEqual(rotated, { x: 30.5, y: 72.1 });
assert.deepEqual(rotatePinCoords(30, 70), { x: 30, y: 30 });

// Đổi sang vắng ở căn có khuyết tật trong phòng: chỉ bắt chốt khi Admin vừa đổi và chưa có quyết định
const accessHistory = { state: 'ACCESS_HISTORY', decision: null } as CondoAbsenceView;
assert.equal(needsCondoAbsenceDecision(accessHistory, 'VẮNG_MẶT_KHÓA_CỬA', 'CHỦ_HỘ_Ở'), true);
assert.equal(needsCondoAbsenceDecision(accessHistory, 'VẮNG_MẶT_KHÓA_CỬA', 'VẮNG_MẶT_KHÓA_CỬA'), false);
assert.equal(needsCondoAbsenceDecision(accessHistory, 'CHO_THUÊ', 'CHỦ_HỘ_Ở'), false);
assert.equal(
  needsCondoAbsenceDecision({ ...accessHistory, decision: 'NOT_ABSENT' }, 'VẮNG_MẶT_KHÓA_CỬA', 'CHỦ_HỘ_Ở'),
  false
);
assert.equal(needsCondoAbsenceDecision({ ...accessHistory, state: 'ABSENT' }, 'VẮNG_MẶT_KHÓA_CỬA', 'CHỦ_HỘ_Ở'), false);

// Khu vực chung chỉ giữ E trong floors[]
assert.deepEqual(resolveRawCondoElements([], { floors: [{ structuralElements: [{ elementCode: 'E-01' }] }, {}] }), [
  { elementCode: 'E-01' },
]);
assert.deepEqual(resolveRawCondoElements([{ elementCode: 'E-02' }], { floors: [{ structuralElements: [{ elementCode: 'E-01' }] }] }), [
  { elementCode: 'E-02' },
]);

// E6 suy từ loại đúng thang 6 mức của ecsCalculator
assert.equal(deriveDefectE6(LEAK_SCREENING_CATEGORY, 'Ẩm mốc bề mặt'), 1);
assert.equal(deriveDefectE6(LEAK_SCREENING_CATEGORY, 'Thấm nước'), 2);
assert.equal(deriveDefectE6(LEAK_SCREENING_CATEGORY, 'Dột nước'), 3);
assert.equal(deriveDefectE6(LEAK_SCREENING_CATEGORY, 'Rò rỉ nước tràn'), 4);
assert.equal(deriveDefectE6(DOOR_SCREENING_CATEGORY, 'Kẹt cửa đi'), 5);
assert.equal(deriveDefectE6('Nứt tường gạch / Vữa trát hoàn thiện', 'Nứt ziczac theo mạch vữa gạch'), 0);
assert.equal(isLeakTypeMissing(LEAK_SCREENING_CATEGORY, 'Khác'), true);
assert.equal(isLeakTypeMissing('Khác', 'Khác'), false);

// Canvas: xoay đi xoay lại không làm trôi ghim; D đã lưu bị gỡ khỏi canvas chỉ xóa mềm, D chưa lưu bỏ hẳn
const savedDefect = {
  id: '11111111-1111-4111-8111-111111111111',
  defectCode: 'D-01',
  pinX: 20.123,
  pinY: 30.456,
  screeningCategory: 'Khác',
  defectType: 'Khác',
  activityState: 'S',
} as CondoDefectItemData;
const draftDefect = { ...savedDefect, id: 'def_1_D-02', defectCode: 'D-02' } as CondoDefectItemData;
for (const rotation of [0, 90, 180, 270]) {
  const [kept] = mergeCanvasDefects([savedDefect], [toCanvasDefect(savedDefect, rotation)], 'Z-01', rotation);
  assert.equal(kept.pinX, 20.123);
  assert.equal(kept.pinY, 30.456);
}
const removed = mergeCanvasDefects([savedDefect, draftDefect], [], 'Z-01', 0);
assert.equal(removed.length, 1);
assert.equal(removed[0].defectCode, 'D-01');
assert.equal(removed[0].isDeleted, true);
const added = mergeCanvasDefects([], [{ ...toCanvasDefect(savedDefect, 0), defectCode: 'D-03', id: undefined }], 'Z-02', 0)[0];
assert.ok(added.id.startsWith('def_'));
assert.equal(added.cuPhotoCode, 'Z-02-D-03-CU');

// Gộp nội dung trùng ở Bước 09 căn vắng
assert.equal(getMeaningfulOwnerFeedback(`  ${DEFAULT_CONDO_OWNER_FEEDBACK} `), '');
assert.equal(getMeaningfulOwnerFeedback(' Không tiếp cận được '), 'Không tiếp cận được');
assert.equal(getMeaningfulOwnerFeedback(null), '');
const signedWitness = adaptUnitAbsentee({
  absenteeInfo: {},
  signatures: { witnessName: 'BQL Tòa A', witnessRole: 'Bảo vệ', witnessPhone: '0900000000' },
});
assert.equal(signedWitness?.witnessName, 'BQL Tòa A');
assert.equal(signedWitness?.witnessRole, 'Bảo vệ');
assert.equal(signedWitness?.witnessPhone, '0900000000');
assert.equal(adaptUnitAbsentee({ absenteeInfo: {}, signatures: { localAuthority: { fullName: 'Tổ trưởng' } } })?.witnessName, 'Tổ trưởng');
assert.equal(adaptUnitAbsentee({ absenteeInfo: { witnessName: 'KSV khai' }, signatures: { witnessName: 'Khác' } })?.witnessName, 'KSV khai');
assert.deepEqual(getPhotosOutsideAbsenceLogs(['log.jpg', 'json.jpg', 'log2.jpg'], [{ photoUrl: 'log.jpg' }, { photoUrl: 'log2.jpg' }]), ['json.jpg']);
assert.deepEqual(getPhotosOutsideAbsenceLogs(['a.jpg'], []), ['a.jpg']);
