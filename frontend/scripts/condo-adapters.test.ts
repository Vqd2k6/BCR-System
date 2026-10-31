import assert from 'node:assert/strict';
import { rotatePinCoords } from '../src/features/zone-management/components/review-queue/stepwise/utils/pinCoordinates';
import {
  adaptUnitAbsentee,
  adaptUnitBeamSagging,
  adaptUnitDoorJamming,
  adaptUnitLeakage,
  resolveUnitCadUrl,
  toSurveyDoorJammingPayload,
  toSurveyLeakagePayload,
} from '../src/features/zone-management/components/review-queue/condo/unit-studio/condo-unit.adapters';

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
