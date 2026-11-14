import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import * as fe from '../src/core/utils/floorCodeRules';
import * as be from '../../backend/src/modules/cadastral/utils/floor-code.rules';
import {
  extractUnitStt,
  formatDefaultDisplayCode,
  formatShortUnitDisplay,
  generateOptionBPartitionCode,
} from '../src/core/utils/codeFormattingUtils';

// 1. Hai bản quy tắc FE/BE phải giống hệt nhau
const feText = fs.readFileSync(path.resolve('src/core/utils/floorCodeRules.ts'), 'utf8');
const beText = fs.readFileSync(path.resolve('../backend/src/modules/cadastral/utils/floor-code.rules.ts'), 'utf8');
assert.equal(feText, beText, 'floorCodeRules.ts (FE) và floor-code.rules.ts (BE) đã lệch nhau');

const samples: Array<[number, string | undefined]> = [
  [-2, undefined], [-1, 'Hầm B1'], [-0.5, undefined], [-1.5, undefined], [0, undefined], [0.5, undefined],
  [1, undefined], [1.5, undefined], [2, 'Tầng lửng'], [12, undefined], [16, 'Tầng kỹ thuật'],
  [20, 'Tầng lánh nạn'], [30, 'Tầng tum'], [31, 'Sân thượng'], [32, 'Mái'], [5, 'Tầng 5'],
];
for (const [n, name] of samples) {
  assert.equal(fe.resolveBaseFloorCode(n, name), be.resolveBaseFloorCode(n, name));
  assert.equal(fe.formatDefaultFloorLabel(n), be.formatDefaultFloorLabel(n));
}

// 2. Mã tầng gốc
assert.equal(fe.resolveBaseFloorCode(-0.5), 'SB');
assert.equal(fe.resolveBaseFloorCode(-0.5, 'Tầng bán hầm'), 'SB');
assert.equal(fe.resolveBaseFloorCode(0.5), 'MEZZ');
assert.equal(fe.resolveBaseFloorCode(1.5), 'MEZZ2');
assert.equal(fe.resolveBaseFloorCode(2.5), 'MEZZ3');
assert.equal(fe.resolveBaseFloorCode(2, 'Tầng lửng'), 'MEZZ');
assert.equal(fe.resolveBaseFloorCode(0), 'G');
assert.equal(fe.resolveBaseFloorCode(-1), 'B01');
assert.equal(fe.resolveBaseFloorCode(-2, 'Hầm B2'), 'B02');
assert.equal(fe.resolveBaseFloorCode(1), 'F01');
assert.equal(fe.resolveBaseFloorCode(12), 'F12');
assert.equal(fe.resolveBaseFloorCode(16, 'Tầng kỹ thuật'), 'TECH');
assert.equal(fe.resolveBaseFloorCode(20, 'Tầng lánh nạn'), 'REF');
assert.equal(fe.resolveBaseFloorCode(30, 'Tầng tum'), 'TUM');
assert.equal(fe.resolveBaseFloorCode(31, 'Sân thượng'), 'TERRACE');
assert.equal(fe.resolveBaseFloorCode(32, 'Tầng mái'), 'ROOF');

// 3. Đánh số tầng đặc biệt lặp lại; tầng thường không đánh số
assert.equal(fe.allocateFloorCode('TECH', []), 'TECH');
assert.equal(fe.allocateFloorCode('TECH', ['F01', 'TECH']), 'TECH2');
assert.equal(fe.allocateFloorCode('TECH', ['TECH', 'TECH2']), 'TECH3');
assert.equal(fe.allocateFloorCode('MEZZ2', ['MEZZ', 'MEZZ2']), 'MEZZ3');
assert.equal(fe.allocateFloorCode('REF', ['ref']), 'REF2');
assert.equal(fe.allocateFloorCode('F05', ['F05']), 'F05');
assert.equal(fe.resolveFloorCode(20.5, 'Tầng kỹ thuật', ['TECH']), 'TECH2');

// 4. Tiền tố mã căn
assert.equal(fe.floorCodeToUnitPrefix('F05'), '05');
assert.equal(fe.floorCodeToUnitPrefix('F00'), 'G');
assert.equal(fe.floorCodeToUnitPrefix('MEZZ2'), 'MEZZ2');
assert.equal(fe.floorCodeToUnitPrefix('TECH'), 'TECH');
assert.equal(fe.floorCodeToUnitPrefix('Tầng lửng'), '');

// 5. Số tầng hợp lệ
assert.equal(fe.isValidFloorNumber(0.5), true);
assert.equal(fe.isValidFloorNumber(-0.5), true);
assert.equal(fe.isValidFloorNumber(1.2), false);
assert.equal(fe.isValidFloorNumber(101), false);

// 6. Sinh mã căn: TECH/ROOF không còn rơi về '01'
assert.equal(generateOptionBPartitionCode('TECH', [], 'UNIT').unitCode, 'TECH.01');
assert.equal(generateOptionBPartitionCode('ROOF', [], 'MASTER').unitCode, 'ROOF.M01');
assert.equal(generateOptionBPartitionCode(1.5, [], 'UNIT').unitCode, 'MEZZ2.01');
assert.equal(generateOptionBPartitionCode(-0.5, [], 'MASTER').unitCode, 'SB.M01');
assert.equal(generateOptionBPartitionCode(0, [], 'UNIT').unitCode, 'G.01');

// STT U và M đếm riêng
const floor1 = [
  { unitCode: '01.01', partitionType: 'UNIT' },
  { unitCode: '01.02', partitionType: 'UNIT' },
];
assert.equal(generateOptionBPartitionCode('F01', floor1, 'MASTER').unitCode, '01.M01');
assert.equal(generateOptionBPartitionCode('F01', floor1, 'UNIT').unitCode, '01.03');
assert.equal(
  generateOptionBPartitionCode('F01', [...floor1, { unitCode: '01.M01', partitionType: 'MASTER' }], 'UNIT').unitCode,
  '01.03'
);
// Master cũ T02.01 trên cùng tầng được tính vào STT Master
assert.equal(generateOptionBPartitionCode('F02', [{ unit_code: 'T02.01' }], 'MASTER').unitCode, '02.M02');
// Không trùng mã toàn tòa (căn 02.03 đã chuyển sang tầng 3 ở thẩm định)
assert.equal(
  generateOptionBPartitionCode('F02', [{ unitCode: '02.01', partitionType: 'UNIT' }, { unitCode: '02.02', partitionType: 'UNIT' }], 'UNIT', {
    buildingCodes: ['02.03', '03.01'],
  }).unitCode,
  '02.04'
);
// Mã tầng lạ (tên tầng cũ) suy theo số tầng truyền kèm
assert.equal(generateOptionBPartitionCode('Tầng lửng', [], 'UNIT', { floorNumber: 0.5 }).unitCode, 'MEZZ.01');

// 7. Số phòng gợi ý
assert.equal(formatDefaultDisplayCode('02', '02.03'), '203');
assert.equal(formatDefaultDisplayCode('F02', 3), '203');
assert.equal(formatDefaultDisplayCode('12', 4), '1204');
assert.equal(formatDefaultDisplayCode('MEZZ', 1), 'L.01');
assert.equal(formatDefaultDisplayCode('MEZZ2', '01'), 'L2.01');
assert.equal(formatDefaultDisplayCode('G', 2), 'G.02');
assert.equal(formatDefaultDisplayCode('B01', 1), 'B1-01');
assert.equal(formatDefaultDisplayCode('SB', 1), 'SB-01');
assert.equal(formatDefaultDisplayCode('TECH2', 1), 'TECH2-01');
assert.equal(formatDefaultDisplayCode(5, '05.M02', 'MASTER'), 'Khu vực chung M02');
assert.equal(extractUnitStt('U-001'), null);

// 8. Nhãn rút gọn ô CAD
assert.equal(formatShortUnitDisplay('TUM.01'), '01');
assert.equal(formatShortUnitDisplay('TECH.02'), '02');
assert.equal(formatShortUnitDisplay('T08.01'), 'M01');
assert.equal(formatShortUnitDisplay('01.M02', 'MASTER'), 'M02');
assert.equal(formatShortUnitDisplay('U-001'), 'U-001');

console.log('✅ floor-code-rules: tất cả kiểm tra đạt');
