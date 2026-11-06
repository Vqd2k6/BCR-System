/**
 * Unit test sinh mã biện pháp (parcels.method_code) – hàm thuần, không cần DB.
 * Chạy: cd backend && npx ts-node --transpile-only src/scripts/parcel_method_code.test.ts
 */
import assert from 'node:assert/strict';
import {
  METHOD_CODE_PATTERN,
  buildMethodCode,
  computeMethodCode,
  resolveMethodCodePrefix,
  type ParcelMethodSourceRow,
} from '../modules/cadastral/utils/parcel-method-code';

const row = (zoneId: string, code: string, lng: number | null, lat: number | null): ParcelMethodSourceRow => ({
  id: '00000000-0000-0000-0000-000000000000',
  zone_id: zoneId,
  project_parcel_code: code,
  method_code: null,
  pt_lng: lng,
  pt_lat: lat,
});

const tests: Array<[string, () => void]> = [
  ['Tiền tố C&C = ST theo thứ tự ga', () => {
    assert.equal(resolveMethodCodePrefix('ZONE_01'), 'ST01');
    assert.equal(resolveMethodCodePrefix('ZONE_07'), 'ST04');
    assert.equal(resolveMethodCodePrefix('ZONE_21'), 'ST11');
  }],
  ['Tiền tố POR theo ga xuất phát', () => {
    assert.equal(resolveMethodCodePrefix('ZONE_02'), 'POR-01');
    assert.equal(resolveMethodCodePrefix('ZONE_08'), 'POR-04');
    assert.equal(resolveMethodCodePrefix('ZONE_20'), 'POR-10');
  }],
  ['Tiền tố Depot', () => {
    assert.equal(resolveMethodCodePrefix('ZONE_22'), 'DEP-01');
  }],
  ['Zone ngoài danh mục (kể cả ZONE_Sn cũ) bị từ chối', () => {
    assert.throws(() => resolveMethodCodePrefix('ZONE_S4'), /ParcelMethodCode:Prefix/);
    assert.throws(() => resolveMethodCodePrefix('ZONE_99'), /ParcelMethodCode:Prefix/);
  }],
  ['Ghép mã C&C / POR / DEP', () => {
    assert.equal(buildMethodCode('ZONE_07', 'C&C-04-B-0146', 'LEFT'), 'ST04-L-0146');
    assert.equal(buildMethodCode('ZONE_02', 'POR-01-B-1111', 'LEFT'), 'POR-01-L-1111');
    assert.equal(buildMethodCode('ZONE_04', 'POR-02-B-0112', 'RIGHT'), 'POR-02-R-0112');
    assert.equal(buildMethodCode('ZONE_22', 'DEP-01-B-0007', 'RIGHT'), 'DEP-01-R-0007');
  }],
  ['Giữ hậu tố -XD / -DU', () => {
    assert.equal(buildMethodCode('ZONE_07', 'C&C-04-B-0146-DU', 'LEFT'), 'ST04-L-0146-DU');
    assert.equal(buildMethodCode('ZONE_07', 'C&C-04-B-0146-XD', 'RIGHT'), 'ST04-R-0146-XD');
  }],
  ['Giữ nguyên dãy số 5 chữ số, không pad lại', () => {
    assert.equal(buildMethodCode('ZONE_07', 'B-00105', 'LEFT'), 'ST04-L-00105');
  }],
  ['Mã khảo sát không tách được số bị từ chối', () => {
    assert.throws(() => buildMethodCode('ZONE_07', 'B-00001-C&C', 'LEFT'), /ParcelMethodCode:Build/);
    assert.throws(() => buildMethodCode('ZONE_07', 'C&C-04-B-012', 'LEFT'), /ParcelMethodCode:Build/);
    assert.throws(() => buildMethodCode('ZONE_07', 'KHONG-SO', 'LEFT'), /ParcelMethodCode:Build/);
  }],
  ['Mã sinh ra luôn khớp định dạng chuẩn, không khoảng trắng', () => {
    for (const code of ['ST04-L-0146', 'POR-01-R-1111', 'DEP-01-L-0007', 'ST04-L-0146-DU']) {
      assert.ok(METHOD_CODE_PATTERN.test(code), code);
    }
    for (const code of ['ST04 - L - 0146', 'ST4-L-0146', 'ST04-X-0146', 'ST04-L-146']) {
      assert.ok(!METHOD_CODE_PATTERN.test(code), code);
    }
  }],
  ['Trái/Phải theo hướng tiến Bến Thành -> Tham Lương (đoạn đầu chạy về phía Tây)', () => {
    // Đoạn đầu tim tuyến từ (106.699247, 10.771022) đi về phía Tây: phía Bắc là bên PHẢI, phía Nam là bên TRÁI
    assert.equal(computeMethodCode(row('ZONE_01', 'C&C-01-B-0001', 106.6975, 10.7716)), 'ST01-R-0001');
    assert.equal(computeMethodCode(row('ZONE_01', 'C&C-01-B-0002', 106.6975, 10.7706)), 'ST01-L-0002');
  }],
  ['Thiếu toạ độ bị từ chối, không gán bừa', () => {
    assert.throws(() => computeMethodCode(row('ZONE_01', 'C&C-01-B-0003', null, null)), /ParcelMethodCode:Compute/);
  }],
];

let failed = 0;
for (const [name, fn] of tests) {
  try {
    fn();
    console.log(`  ✓ ${name}`);
  } catch (err: unknown) {
    failed += 1;
    console.error(`  ✗ ${name}`, err);
  }
}
console.log(`\n${tests.length - failed}/${tests.length} passed`);
if (failed > 0) process.exitCode = 1;
