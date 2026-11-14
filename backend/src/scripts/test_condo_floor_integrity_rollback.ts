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
    for (const m of ['20261118_condo_floor_numeric_integrity.sql', '20261119_condo_floor_cad_structural.sql']) {
      await client.query(fs.readFileSync(path.join(BE, 'database/migrations', m), 'utf8'));
    }
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

    // GĐ C1: CAD_E tầng + Kho tài nguyên (xóa mềm) + CAD_E từng U/M có khóa
    const res1 = { id: 'r1', title: 'Kết cấu sàn', category: 'CAD_E' as const, url: 'https://r2/e-sheet.jpg', createdAt: '' };
    const res2 = { id: 'r2', title: 'Điện nước', category: 'OTHER' as const, url: 'https://r2/mep.jpg', createdAt: '' };
    let fp12 = await CadastralRepository.upsertFloorPlan(
      { parcelId, floorNumber: 12, floorName: 'Tầng 12', cadPhotoUrl: 'z12', cadStructuralUrl: 'https://r2/e12-v1.jpg', cadResources: [res1, res2] },
      client
    );
    assert.equal(fp12.cad_structural_url, 'https://r2/e12-v1.jpg');
    assert.equal((fp12.cad_resources_json || []).length, 2);
    // Không gửi cadStructuralUrl / cadResources → giữ nguyên
    fp12 = await CadastralRepository.upsertFloorPlan({ parcelId, floorNumber: 12, floorName: 'Tầng 12', cadPhotoUrl: 'z12' }, client);
    assert.equal(fp12.cad_structural_url, 'https://r2/e12-v1.jpg');
    assert.equal((fp12.cad_resources_json || []).length, 2);
    // Thay CAD_E + bỏ r2 khỏi danh sách → r2 xóa mềm, bản E cũ vào kho dạng xóa mềm
    fp12 = await CadastralRepository.upsertFloorPlan(
      { parcelId, floorNumber: 12, floorName: 'Tầng 12', cadPhotoUrl: 'z12', cadStructuralUrl: 'https://r2/e12-v2.jpg', cadResources: [res1] },
      client
    );
    const kho = fp12.cad_resources_json || [];
    assert.equal(kho.length, 3);
    assert.ok(kho.find((r) => r.id === 'r2')?.deletedAt);
    assert.ok(kho.find((r) => r.url === 'https://r2/e12-v1.jpg')?.deletedAt);
    assert.ok(!kho.find((r) => r.id === 'r1')?.deletedAt);
    console.log('✅ CAD_E tầng + Kho: giữ khi không gửi, xóa mềm tờ bị bỏ, lưu vết CAD_E cũ');

    const bboxE = { x: 10, y: 10, width: 20, height: 20 };
    await CadastralRepository.saveUnitPartitions(parcelId, 12, fp12.id, [
      { unitCode: '12.01', unitType: 'UNIT', unitStructuralCadUrl: 'data:e-v1', structuralBbox: bboxE },
    ], client);
    await client.query(`UPDATE building_units SET status = 'IN_PROGRESS' WHERE parcel_id = $1 AND unit_code = '12.01'`, [parcelId]);
    await CadastralRepository.saveUnitPartitions(parcelId, 12, fp12.id, [
      { unitCode: '12.01', unitType: 'UNIT', unitStructuralCadUrl: 'data:e-v2', structuralBbox: { x: 1, y: 1, width: 5, height: 5 } },
    ], client);
    const u12 = await client.query(`SELECT unit_structural_cad_url, cad_structural_bbox FROM building_units WHERE parcel_id = $1 AND unit_code = '12.01' AND deleted_at IS NULL`, [parcelId]);
    assert.equal(u12.rows[0].unit_structural_cad_url, 'data:e-v1');
    assert.deepEqual(u12.rows[0].cad_structural_bbox, bboxE);
    console.log('✅ CAD_E của U/M đã vào khảo sát không bị Admin ghi đè');

    // Dữ liệu cũ kiểu B-0129: dải Tầng 31 = {31,33,34,36} chồng lên Tầng 33, 34 đã có bản vẽ riêng
    const p31 = await CadastralRepository.upsertFloorPlan({ parcelId, floorNumber: 31, floorName: 'Tầng 31', cadPhotoUrl: 'z31', applicableFloors: [31, 33, 34, 36] }, client);
    const p33 = await CadastralRepository.upsertFloorPlan({ parcelId, floorNumber: 33, floorName: 'Tầng 33', cadPhotoUrl: 'z33' }, client);
    await CadastralRepository.upsertFloorPlan({ parcelId, floorNumber: 34, floorName: 'Tầng 34', cadPhotoUrl: 'z34' }, client);
    await client.query(
      `INSERT INTO building_units (parcel_id, unit_code, floor_number, floor_plan_id, status, unit_cad_url, cad_bbox)
       VALUES ($1,'L33',33,$2,'SUBMITTED','cad-L33','{"x":1,"y":1,"width":5,"height":5}'),
              ($1,'D33',33,$2,'NOT_SURVEYED',NULL,NULL),
              ($1,'L36',36,$2,'IN_PROGRESS','cad-L36',NULL),
              ($1,'D36',36,$2,'NOT_SURVEYED',NULL,NULL);`,
      [parcelId, p31.id]
    );
    const rLegacy = await CadastralRepository.atomicSyncFloorPlanAndPartitions(parcelId, 31, { floorName: 'Tầng 31', cadPhotoUrl: 'z31', applicableFloors: [31] }, []);
    const legacy = await client.query(
      `SELECT unit_code, floor_plan_id, deleted_at IS NOT NULL AS deleted, unit_cad_url, cad_bbox FROM building_units
       WHERE parcel_id = $1 AND unit_code IN ('L33','D33','L36','D36') ORDER BY unit_code`,
      [parcelId]
    );
    const byCode = Object.fromEntries(legacy.rows.map((r: { unit_code: string }) => [r.unit_code, r]));
    assert.equal(byCode.L33.floor_plan_id, p31.id, 'căn đã khảo sát L33 phải giữ nguyên liên kết bản vẽ');
    assert.equal(byCode.L33.unit_cad_url, 'cad-L33');
    assert.equal(byCode.L36.floor_plan_id, p31.id, 'căn đã khảo sát L36 phải giữ nguyên liên kết bản vẽ');
    assert.equal(byCode.D33.floor_plan_id, p33.id, 'ô chưa khảo sát trên tầng có bản vẽ riêng chuyển sang bản vẽ đó');
    assert.equal(byCode.D33.deleted, false);
    assert.equal(byCode.D36.deleted, true, 'ô chưa khảo sát trên tầng không còn bản vẽ bị xóa mềm');
    assert.deepEqual(rLegacy.relinkedUnitCodes, ['D33']);
    assert.deepEqual(rLegacy.prunedUnitCodes, ['D36']);
    console.log('✅ Dữ liệu chồng dải kiểu B-0129: căn đã khảo sát không đổi, ô nháp chuyển/xóa mềm đúng');

    await CadastralRepository.deleteFloorPlan(parcelId, 33, 'CLEAR_CAD', 1);
    const afterClear = await client.query(`SELECT floor_plan_id, unit_cad_url, cad_bbox FROM building_units WHERE parcel_id = $1 AND unit_code = 'L33'`, [parcelId]);
    assert.equal(afterClear.rows[0].floor_plan_id, p31.id);
    assert.equal(afterClear.rows[0].unit_cad_url, 'cad-L33');
    assert.deepEqual(afterClear.rows[0].cad_bbox, { x: 1, y: 1, width: 5, height: 5 });
    console.log('✅ Xóa CAD tầng: căn đã khảo sát giữ nguyên ảnh CAD, khung và liên kết');

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
