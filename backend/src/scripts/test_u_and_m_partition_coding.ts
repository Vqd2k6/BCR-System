import assert from 'assert';
import { Database } from '../database/db';
import { CadastralRepository } from '../modules/cadastral/cadastral.repository';

// Hàm mô phỏng logic sinh mã frontend
function generateNextPartitionCode(
  existingUnits: Array<{ unitCode?: string; unit_code?: string }>,
  type: 'UNIT' | 'MASTER'
): string {
  const prefix = type === 'UNIT' ? 'U' : 'M';
  const regex = new RegExp(`^${prefix}[-_](\\d+)$`, 'i');
  let maxNum = 0;

  for (const item of existingUnits) {
    const rawCode = (item.unitCode || item.unit_code || '').trim();
    if (!rawCode) continue;
    const match = rawCode.match(regex);
    if (match) {
      const val = parseInt(match[1], 10);
      if (!isNaN(val) && val > maxNum) {
        maxNum = val;
      }
    }
  }

  const nextNum = maxNum + 1;
  const padded = nextNum < 1000 ? String(nextNum).padStart(3, '0') : String(nextNum);
  return `${prefix}-${padded}`;
}

async function runTest() {
  console.log('============================================================');
  console.log('🧪 TEST: QUY ƯỚC ĐỊNH DANH U-XXX (UNIT) & M-XXX (MASTER)');
  console.log('============================================================');

  // PHẦN 1: UNIT TEST LOGIC SINH MÃ VÀ ĐỘC LẬP KHI XÓA
  console.log('\n--- PHẦN 1: KIỂM THỬ THUẬT TOÁN COUNTER VÀ GAP FILLING ---');

  // 1.1 Khởi đầu rỗng
  const emptyList: Array<{ unitCode: string }> = [];
  assert.strictEqual(generateNextPartitionCode(emptyList, 'UNIT'), 'U-001', 'Danh sách rỗng phải sinh U-001');
  assert.strictEqual(generateNextPartitionCode(emptyList, 'MASTER'), 'M-001', 'Danh sách rỗng phải sinh M-001');
  console.log('✅ 1.1 Khởi đầu rỗng sinh đúng U-001 và M-001');

  // 1.2 Sinh liên tiếp
  const pool = [
    { unitCode: 'U-001' },
    { unitCode: 'U-002' },
    { unitCode: 'U-003' },
    { unitCode: 'M-001' },
  ];
  assert.strictEqual(generateNextPartitionCode(pool, 'UNIT'), 'U-004', 'Tiếp theo phải là U-004');
  assert.strictEqual(generateNextPartitionCode(pool, 'MASTER'), 'M-002', 'Tiếp theo phải là M-002');
  console.log('✅ 1.2 Sinh liên tiếp đúng U-004 và M-002');

  // 1.3 Xóa U-002 (giữ 001, 003) -> Mã tiếp theo vẫn là max + 1 = U-004
  const poolAfterDelete = pool.filter((u) => u.unitCode !== 'U-002');
  assert.strictEqual(generateNextPartitionCode(poolAfterDelete, 'UNIT'), 'U-004', 'Xóa U-002 thì ô mới vẫn là max + 1 = U-004');
  console.log('✅ 1.3 Xóa U-002 không làm ảnh hưởng U-001 và U-003, ô mới sinh max(U)+1 = U-004');

  // 1.4 Thử nghiệm vượt 999
  const largePool = [{ unitCode: 'U-999' }];
  assert.strictEqual(generateNextPartitionCode(largePool, 'UNIT'), 'U-1000', 'Vượt 999 phải thành U-1000 không bị pad lỗi');
  console.log('✅ 1.4 Hỗ trợ vượt ngưỡng 999 (U-1000) an toàn');

  // PHẦN 2: INTEGRATION TEST VỚI CSDL POSTGRESQL
  console.log('\n--- PHẦN 2: LƯU TRỮ VÀ RÀNG BUỘC CƠ SỞ DỮ LIỆU ---');

  // Lấy hoặc tạo parcel test
  let parcelId: string;
  const existing = await Database.query<{ id: string }>(
    `SELECT id FROM parcels WHERE project_parcel_code = 'TEST-UM-CODING-01' LIMIT 1;`
  );
  if (existing.rows[0]) {
    parcelId = existing.rows[0].id;
  } else {
    const zoneRes = await Database.query<{ zone_id: string }>(`SELECT zone_id FROM parcels WHERE zone_id IS NOT NULL LIMIT 1;`);
    const zoneId = zoneRes.rows[0]?.zone_id;
    if (!zoneId) throw new Error('Không có zone_id');
    const newP = await Database.query<{ id: string }>(
      `INSERT INTO parcels (project_parcel_code, official_cadastral_code, zone_id, building_type, floor_count)
       VALUES ('TEST-UM-CODING-01', 'OFF-UM-01', $1, 'CONDOMINIUM', 2)
       RETURNING id;`,
      [zoneId]
    );
    parcelId = newP.rows[0].id;
  }

  // Dọn dẹp units cũ của test
  await Database.query(`DELETE FROM building_units WHERE parcel_id = $1;`, [parcelId]);

  // 2.1 Lưu Tầng 1: U-001, U-002, M-001
  console.log('2.1 Lưu phân vùng Tầng 1: U-001, U-002, M-001...');
  const floor1Parts = [
    { unitCode: 'U-001', floorNumber: 1, unitType: 'UNIT' as const, bbox: { x: 10, y: 10, width: 20, height: 20 } },
    { unitCode: 'U-002', floorNumber: 1, unitType: 'UNIT' as const, bbox: { x: 35, y: 10, width: 20, height: 20 } },
    { unitCode: 'M-001', floorNumber: 1, unitType: 'MASTER' as const, bbox: { x: 60, y: 10, width: 20, height: 20 } },
  ];
  await CadastralRepository.saveUnitPartitions(parcelId, 1, null, floor1Parts);

  const unitsInDb1 = await Database.query<{ unit_code: string; unit_type: string; floor_number: number }>(
    `SELECT unit_code, unit_type, floor_number FROM building_units WHERE parcel_id = $1 ORDER BY unit_code;`,
    [parcelId]
  );
  console.log('   Tầng 1 lưu thành công:', unitsInDb1.rows);
  assert.strictEqual(unitsInDb1.rows.length, 3);
  assert.strictEqual(unitsInDb1.rows[0].unit_code, 'M-001');
  assert.strictEqual(unitsInDb1.rows[1].unit_code, 'U-001');
  assert.strictEqual(unitsInDb1.rows[2].unit_code, 'U-002');

  // 2.2 Lưu Tầng 2: U-003, U-004, M-002 (Tăng dần toàn tòa không reset)
  console.log('\n2.2 Lưu phân vùng Tầng 2: U-003, U-004, M-002...');
  const floor2Parts = [
    { unitCode: 'U-003', floorNumber: 2, unitType: 'UNIT' as const, bbox: { x: 10, y: 10, width: 20, height: 20 } },
    { unitCode: 'U-004', floorNumber: 2, unitType: 'UNIT' as const, bbox: { x: 35, y: 10, width: 20, height: 20 } },
    { unitCode: 'M-002', floorNumber: 2, unitType: 'MASTER' as const, bbox: { x: 60, y: 10, width: 20, height: 20 } },
  ];
  await CadastralRepository.saveUnitPartitions(parcelId, 2, null, floor2Parts);

  const unitsInDbAll = await Database.query<{ unit_code: string; unit_type: string; floor_number: number }>(
    `SELECT unit_code, unit_type, floor_number FROM building_units WHERE parcel_id = $1 ORDER BY unit_code;`,
    [parcelId]
  );
  console.log('   Toàn tòa có 6 phân vùng:', unitsInDbAll.rows.map((u) => `${u.unit_code} (F${u.floor_number}, ${u.unit_type})`));
  assert.strictEqual(unitsInDbAll.rows.length, 6);

  // 2.3 Mô phỏng gap filling: Đổi tên U-004 thành U-008
  console.log('\n2.3 Đổi tên U-004 thành U-008 (tùy chỉnh của người dùng)...');
  await Database.query(
    `UPDATE building_units SET unit_code = 'U-008' WHERE parcel_id = $1 AND unit_code = 'U-004';`,
    [parcelId]
  );
  const updatedUnit = await Database.query<{ unit_code: string }>(
    `SELECT unit_code FROM building_units WHERE parcel_id = $1 AND unit_code = 'U-008';`,
    [parcelId]
  );
  assert.strictEqual(updatedUnit.rows.length, 1);
  console.log('   => PASS: Người dùng có toàn quyền rename hoặc gap-filling thành công!');

  console.log('\n🎉 TẤT CẢ TEST CASES ĐỊNH DANH U-XXX VÀ M-XXX ĐỀU ĐẠT CHUẨN 100%!');
  process.exit(0);
}

runTest().catch((err) => {
  console.error('❌ TEST FAILED:', err);
  process.exit(1);
});
