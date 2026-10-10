import assert from 'assert';
import { Database } from '../database/db';
import { CadastralRepository } from '../modules/cadastral/cadastral.repository';
import { CadastralService } from '../modules/cadastral/cadastral.service';

async function runTest() {
  console.log('============================================================');
  console.log('🧪 TEST: SAFE PARTITION PRUNING & IMMUTABILITY PROTECTION');
  console.log('============================================================');

  // 1. Tạo hoặc lấy parcel test
  let parcelId: string;
  const existing = await Database.query<{ id: string }>(
    `SELECT id FROM parcels WHERE project_parcel_code = 'TEST-PRUNING-01' LIMIT 1;`
  );
  if (existing.rows[0]) {
    parcelId = existing.rows[0].id;
  } else {
    const zoneRes = await Database.query<{ zone_id: string }>(`SELECT zone_id FROM parcels WHERE zone_id IS NOT NULL LIMIT 1;`);
    const zoneId = zoneRes.rows[0]?.zone_id;
    if (!zoneId) throw new Error('Không có zone_id');
    const newP = await Database.query<{ id: string }>(
      `INSERT INTO parcels (project_parcel_code, official_cadastral_code, zone_id, building_type, floor_count)
       VALUES ('TEST-PRUNING-01', 'OFF-PRUNE-01', $1, 'CONDOMINIUM', 1)
       RETURNING id;`,
      [zoneId]
    );
    parcelId = newP.rows[0].id;
  }

  // Dọn dẹp units cũ của test
  await Database.query(`DELETE FROM building_units WHERE parcel_id = $1;`, [parcelId]);

  console.log('1. Khởi tạo 3 phân vùng trên Tầng 1: U-001 (khảo sát), U-002 (chưa khảo sát), U-003 (chưa khảo sát)...');
  await CadastralRepository.saveUnitPartitions(parcelId, 1, null, [
    { unitCode: 'U-001', floorNumber: 1, unitType: 'UNIT', bbox: { x: 10, y: 10, width: 20, height: 20 } },
    { unitCode: 'U-002', floorNumber: 1, unitType: 'UNIT', bbox: { x: 35, y: 10, width: 20, height: 20 } },
    { unitCode: 'U-003', floorNumber: 1, unitType: 'UNIT', bbox: { x: 60, y: 10, width: 20, height: 20 } },
  ]);

  // Đánh dấu U-001 là đã bắt đầu khảo sát
  await Database.query(
    `UPDATE building_units SET status = 'IN_PROGRESS' WHERE parcel_id = $1 AND unit_code = 'U-001';`,
    [parcelId]
  );

  const initialUnits = await Database.query<{ unit_code: string; status: string }>(
    `SELECT unit_code, status FROM building_units WHERE parcel_id = $1 ORDER BY unit_code;`,
    [parcelId]
  );
  console.log('   Trạng thái ban đầu:', initialUnits.rows);
  assert.strictEqual(initialUnits.rows.length, 3);
  assert.strictEqual(initialUnits.rows[0].unit_code, 'U-001');
  assert.strictEqual(initialUnits.rows[0].status, 'IN_PROGRESS');

  // 2. Mô phỏng người dùng xóa ô U-002 trên canvas và bấm "Lưu Tầng 1" (payload chỉ còn U-001 và U-003)
  console.log('\n2. Người dùng xóa ô U-002 trên canvas và bấm Lưu Tầng 1 (payload: [U-001, U-003])...');
  await CadastralRepository.saveUnitPartitions(parcelId, 1, null, [
    { unitCode: 'U-001', floorNumber: 1, unitType: 'UNIT', bbox: { x: 10, y: 10, width: 20, height: 20 } },
    { unitCode: 'U-003', floorNumber: 1, unitType: 'UNIT', bbox: { x: 60, y: 10, width: 20, height: 20 } },
  ]);

  const afterDeleteU002 = await Database.query<{ unit_code: string; status: string }>(
    `SELECT unit_code, status FROM building_units WHERE parcel_id = $1 ORDER BY unit_code;`,
    [parcelId]
  );
  console.log('   Kết quả sau khi lưu (U-002 đã bị xóa):', afterDeleteU002.rows);
  assert.strictEqual(afterDeleteU002.rows.length, 2, 'Phải còn đúng 2 ô');
  assert.strictEqual(afterDeleteU002.rows.some((u) => u.unit_code === 'U-002'), false, 'U-002 phải bị xóa sạch khỏi CSDL');
  assert.strictEqual(afterDeleteU002.rows.some((u) => u.unit_code === 'U-001'), true, 'U-001 phải còn nguyên');
  assert.strictEqual(afterDeleteU002.rows.some((u) => u.unit_code === 'U-003'), true, 'U-003 phải còn nguyên');
  console.log('   => PASS: Ô chưa khảo sát U-002 đã được xóa sạch dứt điểm khỏi CSDL!');

  // 3. Mô phỏng tình huống rủi ro: Payload cố tình loại bỏ ô U-001 (đã khảo sát) và chỉ gửi [U-003]
  console.log('\n3. Rào chắn bảo vệ pháp lý: Thử gửi payload không chứa U-001 (chỉ gửi [U-003])...');
  await CadastralRepository.saveUnitPartitions(parcelId, 1, null, [
    { unitCode: 'U-003', floorNumber: 1, unitType: 'UNIT', bbox: { x: 60, y: 10, width: 20, height: 20 } },
  ]);

  const afterAccidentalOmit = await Database.query<{ unit_code: string; status: string }>(
    `SELECT unit_code, status FROM building_units WHERE parcel_id = $1 ORDER BY unit_code;`,
    [parcelId]
  );
  console.log('   Kết quả kiểm tra rào chắn bảo vệ:', afterAccidentalOmit.rows);
  assert.strictEqual(afterAccidentalOmit.rows.some((u) => u.unit_code === 'U-001'), true, 'U-001 TUYỆT ĐỐI KHÔNG BỊ XÓA vì đã khảo sát');
  console.log('   => PASS: Rào chắn pháp lý bảo vệ 100% ô đã khảo sát U-001 không bị xóa!');

  // 4. Kiểm thử API CadastralService.deleteUnit trực tiếp
  console.log('\n4. Kiểm thử CadastralService.deleteUnit trực tiếp...');
  const unitU001 = (await Database.query<{ id: string }>(`SELECT id FROM building_units WHERE parcel_id = $1 AND unit_code = 'U-001';`, [parcelId])).rows[0];
  const unitU003 = (await Database.query<{ id: string }>(`SELECT id FROM building_units WHERE parcel_id = $1 AND unit_code = 'U-003';`, [parcelId])).rows[0];

  // Thử xóa U-001 (đã khảo sát) -> phải bị chặn với BadRequestError
  let blocked = false;
  try {
    await CadastralService.deleteUnit(parcelId, unitU001.id);
  } catch (err: any) {
    if (err.message && err.message.includes('mang tính pháp lý')) {
      blocked = true;
    }
  }
  assert.strictEqual(blocked, true, 'Xóa trực tiếp ô đã khảo sát phải bị từ chối');
  console.log('   => PASS: Từ chối xóa trực tiếp ô đã khảo sát U-001!');

  // Xóa U-003 (chưa khảo sát) -> thành công
  await CadastralService.deleteUnit(parcelId, unitU003.id);
  const finalUnits = await Database.query<{ unit_code: string }>(
    `SELECT unit_code FROM building_units WHERE parcel_id = $1;`,
    [parcelId]
  );
  console.log('   Số unit còn lại sau khi xóa U-003:', finalUnits.rows);
  assert.strictEqual(finalUnits.rows.length, 1);
  assert.strictEqual(finalUnits.rows[0].unit_code, 'U-001');
  console.log('   => PASS: Xóa trực tiếp ô chưa khảo sát U-003 thành công mỹ mãn!');

  console.log('\n🎉 TẤT CẢ TEST CASES SAFE PARTITION PRUNING ĐÃ ĐẠT 100%!');
  process.exit(0);
}

runTest().catch((err) => {
  console.error('❌ TEST FAILED:', err);
  process.exit(1);
});
