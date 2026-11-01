import assert from 'node:assert/strict';
import {
  addCustomRestrictedArea,
  buildRestrictedFloorOptions,
  normalizeAccessLimitation,
  readCustomRestrictedAreas,
  splitLegacyRestrictedArea,
} from '../src/features/survey-phase1/utils/accessLimitation';

const optionsOf = (floorNames: string[], aboveFloors: number, storedLabels: string[] = [], extraFloorsCount = 0) =>
  buildRestrictedFloorOptions({ floorNames, aboveFloors, extraFloorsCount, storedLabels });
const labelsOf = (...args: Parameters<typeof optionsOf>) => optionsOf(...args).map((f) => f.label);
const checkedOf = (...args: Parameters<typeof optionsOf>) =>
  optionsOf(...args).filter((f) => f.storedLabels.length > 0).map((f) => f.label);

const STEP3 = ['Tầng trệt', 'Tầng 1 (Lầu 1)', 'Tầng 2'];

assert.deepEqual(labelsOf(STEP3, 5), [...STEP3, 'Tầng 3 (Lầu 3)', 'Tầng 4 (Lầu 4)']);
assert.deepEqual(labelsOf(['Tầng trệt'], 3), ['Tầng trệt', 'Tầng 1 (Lầu 1)', 'Tầng 2 (Lầu 2)']);
assert.deepEqual(labelsOf(['Tầng 1 (Trệt)'], 2), ['Tầng 1 (Trệt)', 'Tầng 1 (Lầu 1)', 'Tầng 2 (Lầu 2)']);

// Lửng, mái, hầm không làm lệch số: dùng chỉ số mảng sẽ ra Lầu 5
const mixed = ['Tầng hầm 1', 'Tầng trệt', 'Tầng lửng', 'Tầng 1 (Lầu 1)', 'Tầng 2', 'Tầng mái'];
assert.equal(labelsOf(mixed, 7).at(-1), 'Tầng 3 (Lầu 3)');

// Đúng ảnh người dùng gửi: nhãn cũ không được đứng cạnh nhãn mới cùng số Tầng
const fromScreenshot = labelsOf(STEP3, 6, ['Tầng 4 (Lầu 3)']);
assert.deepEqual(fromScreenshot, [...STEP3, 'Tầng 3 (Lầu 3)', 'Tầng 4 (Lầu 4)', 'Tầng 5 (Lầu 5)']);
assert.deepEqual(checkedOf(STEP3, 6, ['Tầng 4 (Lầu 3)']), ['Tầng 3 (Lầu 3)']);
const floorNumbers = fromScreenshot.map((label) => label.match(/Tầng (\d+)/)?.[1]).filter(Boolean);
assert.equal(new Set(floorNumbers).size, floorNumbers.length);

// Nhãn cũ trỏ vào tầng đã khảo sát: tick đúng dòng và mở khóa, không sinh dòng thừa
const onSurveyed = optionsOf(STEP3, 3, ['Tầng 2 (Lầu 1)']);
assert.deepEqual(onSurveyed.map((f) => f.label), STEP3);
assert.deepEqual(onSurveyed.map((f) => f.isAlreadySurveyed), [true, false, true]);

// Nhãn cao hơn số tầng hiện có vẫn về đúng dòng chuẩn
assert.deepEqual(checkedOf(STEP3, 3, ['Tầng 7 (Lầu 6)']), ['Tầng 6 (Lầu 6)']);

// Nhãn không có số vẫn hiện để bỏ tick được
assert.deepEqual(labelsOf(STEP3, 3, ['Tầng gác']), [...STEP3, 'Tầng gác']);
assert.deepEqual(checkedOf(STEP3, 3, ['Tầng gác']), ['Tầng gác']);

assert.deepEqual(splitLegacyRestrictedArea('[Khu vực khác: Phòng phám lầu 1 ]'), {
  customRestrictedAreas: ['Phòng phám lầu 1'],
  notes: '',
});
assert.deepEqual(splitLegacyRestrictedArea('Tầng 2 ,hai phòng ngủ. [Khu vực khác: Phía sau cho thuê.]'), {
  customRestrictedAreas: ['Phía sau cho thuê.'],
  notes: 'Tầng 2 ,hai phòng ngủ.',
});
assert.deepEqual(splitLegacyRestrictedArea(undefined), { customRestrictedAreas: [], notes: '' });

assert.deepEqual(readCustomRestrictedAreas({ customRestrictedAreas: ['A', ' B ', ''] }), ['A', 'B']);
assert.deepEqual(readCustomRestrictedAreas({ customRestrictedArea: 'Kho' }), ['Kho']);
assert.deepEqual(readCustomRestrictedAreas({ notes: 'x [Khu vực khác: Sau nhà]' }), ['Sau nhà']);
assert.deepEqual(readCustomRestrictedAreas({ customRestrictedAreas: ['Mới'], notes: '[Khu vực khác: Cũ]' }), ['Mới']);

// Ghi chú đang gõ dở còn khoảng trắng cuối thì không được bị cắt
const typing = { notes: 'Ghi chú đang gõ ', customRestrictedAreas: ['Kho'] };
assert.equal(normalizeAccessLimitation(typing), typing);

const migrated = normalizeAccessLimitation({ notes: 'A [Khu vực khác: Cũ]' });
assert.equal(migrated.notes, 'A');
assert.deepEqual(migrated.customRestrictedAreas, ['Cũ']);
const fromSingle = normalizeAccessLimitation({ notes: '', customRestrictedArea: 'Kho' });
assert.deepEqual(fromSingle.customRestrictedAreas, ['Kho']);
assert.equal(fromSingle.customRestrictedArea, undefined);

assert.deepEqual(addCustomRestrictedArea(['A'], '  Phòng   WC lầu 3 '), ['A', 'Phòng WC lầu 3']);
const list = ['Phòng WC'];
assert.equal(addCustomRestrictedArea(list, 'phòng wc'), list);
assert.equal(addCustomRestrictedArea(list, '   '), list);

console.log('restricted-area: OK');
