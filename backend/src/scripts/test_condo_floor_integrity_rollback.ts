/**
 * Kiểm hồi quy GĐ A/B phân hệ chung cư (tầng lẻ, mã U/M, 409, dọn ô, dải tầng điển hình).
 * Chạy toàn bộ trong MỘT transaction và ROLLBACK ở cuối: không để lại dữ liệu, không xóa cứng.
 */
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
const BE = path.resolve(__dirname, '../..');
import { pool, Database } from '../database/db';
import { CadastralRepository } from '../modules/cadastral/cadastral.repository';

async function expectConflict(client: { query: (q: string) => Promise<unknown> }, label: string, fn: () => Promise<unknown>) {
  await client.query('SAVEPOINT sp');
  try {
    await fn();
    throw new Error(`${label}: lẽ ra phải 409`);
  } catch (err) {
    const name = (err as { constructor?: { name?: string } }).constructor?.name;
    if (name !== 'ConflictError') throw err;
    console.log(`✅ ${label}: ConflictError — ${(err as Error).message.slice(0, 110)}`);
  } finally {
    await client.query('ROLLBACK TO SAVEPOINT sp');
  }
}

(async () => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(fs.readFileSync(path.join(BE, 'database/migrations/20261118_condo_floor_numeric_integrity.sql'), 'utf8'));
    const zone = await client.query(`SELECT zone_id FROM parcels WHERE zone_id IS NOT NULL LIMIT 1`);
    const p = await client.query(
      `INSERT INTO parcels (project_parcel_code, zone_id, building_type, floor_count, location_geom)
       VALUES ('VERIFY-GD-AB', $1, 'CONDOMINIUM', 20, ST_SetSRID(ST_MakePoint(106.68, 10.77), 4326)) RETURNING id`,
      [zone.rows[0].zone_id]
    );
    const parcelId: string = p.rows[0].id;

    // Mã tầng do server suy khi client không truyền
    const mezz = await CadastralRepository.upsertFloorPlan({ parcelId, floorNumber: 0.5, floorName: 'Tầng 0.5', cadPhotoUrl: 'x' }, client);
    const sb = await CadastralRepository.upsertFloorPlan({ parcelId, floorNumber: -0.5, floorName: 'Tầng -0.5', cadPhotoUrl: 'x' }, client);
    const t1 = await CadastralRepository.upsertFloorPlan({ parcelId, floorNumber: 16, floorName: 'Tầng kỹ thuật', cadPhotoUrl: 'x' }, client);
    const t2 = await CadastralRepository.upsertFloorPlan({ parcelId, floorNumber: 20, floorName: 'Tầng kỹ thuật', cadPhotoUrl: 'x' }, client);
    assert.deepEqual([mezz.floor_code, sb.floor_code, t1.floor_code, t2.floor_code], ['MEZZ', 'SB', 'TECH', 'TECH2']);
    console.log('✅ floor_code server: MEZZ / SB / TECH / TECH2');

    // Lưu phân vùng tầng 0.5
    const saved = await CadastralRepository.saveUnitPartitions(parcelId, 0.5, mezz.id, [
      { unitCode: 'MEZZ.01', unitType: 'UNIT' },
      { unitCode: 'MEZZ.02', unitType: 'UNIT' },
      { unitCode: 'MEZZ.M01', unitType: 'MASTER' },
    ], client);
    assert.equal(saved.length, 3);
    assert.ok(saved.every((u: { floor_number: number }) => Number(u.floor_number) === 0.5));
    console.log('✅ saveUnitPartitions tầng 0.5 (trước đây lỗi 22P02 ở deleted_floors)');

    await client.query(`UPDATE building_units SET status = 'SUBMITTED' WHERE parcel_id = $1 AND unit_code = 'MEZZ.01'`, [parcelId]);

    await expectConflict(client, 'Mã căn đã khảo sát ở tầng khác', () =>
      CadastralRepository.saveUnitPartitions(parcelId, 16, t1.id, [{ unitCode: 'MEZZ.01', unitType: 'UNIT' }], client));
    await expectConflict(client, 'Mã chưa khảo sát ở tầng ngoài dải', () =>
      CadastralRepository.saveUnitPartitions(parcelId, 16, t1.id, [{ unitCode: 'MEZZ.02', unitType: 'UNIT' }], client));
    await expectConflict(client, 'Trùng mã trong cùng payload', () =>
      CadastralRepository.saveUnitPartitions(parcelId, 16, t1.id, [
        { unitCode: 'TECH.01', unitType: 'UNIT' },
        { unitCode: 'TECH.01', unitType: 'UNIT', floorNumber: 20 },
      ], client));

    // Lưu lại tầng 0.5 chỉ còn M01: MEZZ.02 (chưa KS) bị xóa mềm, MEZZ.01 (đã KS) giữ
    await CadastralRepository.saveUnitPartitions(parcelId, 0.5, mezz.id, [{ unitCode: 'MEZZ.M01', unitType: 'MASTER' }], client);
    const left = await client.query(`SELECT unit_code FROM building_units WHERE parcel_id = $1 AND deleted_at IS NULL ORDER BY unit_code`, [parcelId]);
    assert.deepEqual(left.rows.map((r: { unit_code: string }) => r.unit_code), ['MEZZ.01', 'MEZZ.M01']);
    const soft = await client.query(`SELECT count(*)::int AS n FROM building_units WHERE parcel_id = $1 AND unit_code = 'MEZZ.02' AND deleted_at IS NOT NULL`, [parcelId]);
    assert.equal(soft.rows[0].n, 1);
    console.log('✅ Dọn ô: chỉ xóa mềm ô chưa khảo sát, giữ căn đã khảo sát');

    // #15 atomicSync: dải tầng điển hình — chạy trên cùng client (không tự COMMIT)
    (Database as unknown as { transaction: (fn: (c: unknown) => Promise<unknown>) => Promise<unknown> }).transaction = (fn) => fn(client);
    const plan = { floorName: 'Tầng 5', cadPhotoUrl: 'x' };
    await CadastralRepository.atomicSyncFloorPlanAndPartitions(parcelId, 5, { ...plan, applicableFloors: [5, 6, 7] }, [
      { unitCode: '05.01', unitType: 'UNIT' },
      { unitCode: '06.01', unitType: 'UNIT', floorNumber: 6 },
      { unitCode: '07.01', unitType: 'UNIT', floorNumber: 7 },
    ]);
    await CadastralRepository.upsertFloorPlan({ parcelId, floorNumber: 8, floorName: 'Tầng 8', cadPhotoUrl: 'x' }, client);
    await expectConflict(client, 'Dải gộp tầng đã có mặt bằng riêng', () =>
      CadastralRepository.atomicSyncFloorPlanAndPartitions(parcelId, 5, { ...plan, applicableFloors: [5, 8] }, []));
    const r9 = await CadastralRepository.atomicSyncFloorPlanAndPartitions(parcelId, 9, { floorName: 'Tầng 9', cadPhotoUrl: 'x', applicableFloors: [9, 6] }, []);
    assert.deepEqual(r9.releasedFromOtherPlans, [6]);
    const p5 = await client.query(`SELECT applicable_floors FROM building_floor_plans WHERE parcel_id = $1 AND floor_number = 5 AND deleted_at IS NULL`, [parcelId]);
    assert.deepEqual(p5.rows[0].applicable_floors, [5, 7]);
    console.log('✅ Tầng 6 chuyển sang dải Tầng 9, dải Tầng 5 còn [5, 7] (hết chồng dải)');
    const r5 = await CadastralRepository.atomicSyncFloorPlanAndPartitions(parcelId, 5, { ...plan, applicableFloors: [5] }, [{ unitCode: '05.01', unitType: 'UNIT' }]);
    assert.deepEqual(r5.detachedFloors, [7]);
    assert.deepEqual(r5.prunedUnitCodes, ['07.01']);
    console.log('✅ Thu hẹp dải: gỡ Tầng 7, xóa mềm ô chưa khảo sát 07.01');

    // deleted_floors nhận tầng lẻ
    const df = await client.query(
      `UPDATE parcels SET deleted_floors = array_append(COALESCE(deleted_floors,'{}'), $2::numeric(4,1)) WHERE id = $1 RETURNING deleted_floors`,
      [parcelId, 0.5]
    );
    assert.deepEqual(df.rows[0].deleted_floors, [0.5]);
    console.log('✅ deleted_floors NUMERIC: [0.5], pg trả number[]');
  } finally {
    await client.query('ROLLBACK');
    client.release();
    await pool.end();
    console.log('↩️  ROLLBACK — DB local không đổi');
  }
})().catch((err) => {
  console.error('[verify_condo_gd_ab] THẤT BẠI:', err);
  process.exit(1);
});
