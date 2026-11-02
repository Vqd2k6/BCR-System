/**
 * Miễn Vùng Z: mọi luồng ghi lại floor_surveys dùng chung `replaceFloorSurveyRows`, nên cờ Z/E không bị về mặc định.
 * Chạy: DB_NAME=metro2_audit_test npx ts-node src/scripts/test_zone_exemption_persistence.ts
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import dotenv from 'dotenv';
import { Database } from '../database/db';
import { replaceFloorSurveyRows } from '../modules/survey/repositories/floor-survey-rows';
import { carryServerManagedSurveyKeys, mergeServerManagedKeysInTx } from '../modules/survey/server-managed-survey-keys';
import { collectZoneExemptFloors, toBilingualNoZonesReason } from '../modules/survey/zone-exemption.utils';

dotenv.config();

class ScenarioRollback extends Error {}

function collectTsFiles(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return collectTsFiles(full);
    return entry.name.endsWith('.ts') ? [full] : [];
  });
}

async function main(): Promise<void> {
  const report = await Database.query<{ id: string }>(`SELECT id FROM base_survey_reports WHERE deleted_at IS NULL LIMIT 1;`);
  const reportId = report.rows[0]?.id;
  assert.ok(reportId, 'Thiếu hồ sơ để kiểm thử');

  try {
    await Database.transaction(async (client) => {
      // saveFloorSurveys đọc bảng này trước khi ghi: helper không được xin khóa ở kết nối khác trong lúc đó
      await client.query(`SELECT overview_photos_json FROM floor_surveys WHERE report_id = $1;`, [reportId]);
      const startedAt = Date.now();
      await replaceFloorSurveyRows(client, reportId, [
        {
          floorName: 'Tầng 2',
          overviewPhotos: [{ url: 'o.jpg' }],
          hasZones: false,
          noZonesReason: 'Chủ nhà chỉ cho chụp tổng quan tầng',
          hasStructuralElements: false,
          noStructuralElementsReason: 'Mái tôn',
        },
        { floor_name: 'Tầng 3', cad_drawing_url: 'cad.jpg' },
      ]);
      assert.ok(Date.now() - startedAt < 5000, 'Ghi tầng không được treo chờ khóa');
      const rows = (
        await client.query(
          `SELECT floor_name, floor_order, has_zones, no_zones_reason, has_structural_elements, no_structural_elements_reason, cad_drawing_url
           FROM floor_surveys WHERE report_id = $1 ORDER BY floor_order;`,
          [reportId]
        )
      ).rows;
      assert.equal(rows.length, 2);
      assert.equal(rows[0].has_zones, false);
      assert.equal(rows[0].no_zones_reason, 'Chủ nhà chỉ cho chụp tổng quan tầng');
      assert.equal(rows[0].has_structural_elements, false);
      assert.equal(rows[0].no_structural_elements_reason, 'Mái tôn');
      assert.equal(rows[1].floor_name, 'Tầng 3');
      assert.equal(rows[1].has_zones, true, 'Tầng không có cờ giữ mặc định');
      assert.equal(rows[1].cad_drawing_url, 'cad.jpg');
      throw new ScenarioRollback();
    });
  } catch (err) {
    if (!(err instanceof ScenarioRollback)) throw err;
  }

  // Ghi chú chỉ có trong SQL: ghi lại tầng không được làm mất, kể cả khi đổi tên tầng
  try {
    await Database.transaction(async (client) => {
      await client.query(`DELETE FROM floor_surveys WHERE report_id = $1;`, [reportId]);
      await client.query(
        `INSERT INTO floor_surveys (report_id, floor_name, floor_order, notes, created_at) VALUES
         ($1, 'Tầng A', 1, 'Ghi chú A', '2026-01-01T00:00:00Z'),
         ($1, 'Tầng B', 2, 'Ghi chú B', '2026-01-02T00:00:00Z'),
         ($1, 'Tầng C', 3, 'Ghi chú C', '2026-01-03T00:00:00Z');`,
        [reportId]
      );
      await replaceFloorSurveyRows(client, reportId, [
        { floorName: 'Tầng A' },
        { floorName: 'Tầng B đổi tên' },
        { floorName: 'Tầng C', notes: 'Ghi chú mới' },
        { floorName: 'Tầng D' },
      ]);
      const rows = (
        await client.query(`SELECT floor_name, notes, created_at FROM floor_surveys WHERE report_id = $1 ORDER BY floor_order;`, [reportId])
      ).rows;
      assert.equal(rows[0].notes, 'Ghi chú A');
      assert.equal(new Date(rows[0].created_at).toISOString(), '2026-01-01T00:00:00.000Z');
      assert.equal(rows[1].notes, 'Ghi chú B', 'Đổi tên tầng vẫn giữ ghi chú theo thứ tự');
      assert.equal(rows[2].notes, 'Ghi chú mới', 'Ghi chú mới thắng ghi chú cũ');
      assert.equal(rows[3].notes, null, 'Tầng mới không nhận ghi chú của tầng khác');

      await replaceFloorSurveyRows(client, reportId, [{ floorName: 'Tầng C' }, { floorName: 'Tầng X' }]);
      const shifted = (
        await client.query(`SELECT floor_name, notes FROM floor_surveys WHERE report_id = $1 ORDER BY floor_order;`, [reportId])
      ).rows;
      assert.equal(shifted[0].notes, 'Ghi chú mới', 'Tầng đổi vị trí vẫn theo đúng tên');
      assert.equal(shifted[1].floor_name, 'Tầng X');
      throw new ScenarioRollback();
    });
  } catch (err) {
    if (!(err instanceof ScenarioRollback)) throw err;
  }

  // Lớp phủ do server quản lý: KSV lưu đè JSON không làm mất, client không tự gửi được
  const stored = { ownerName: 'gốc', adminIdentityOverrides: { ownerName: null }, archivedAdminIdentityOverrides: [{ ownerName: 'A' }] };
  const carried = carryServerManagedSurveyKeys(stored, { ownerName: 'KSV lưu lại', floors: [] });
  assert.deepEqual(carried.adminIdentityOverrides, { ownerName: null });
  assert.deepEqual(carried.archivedAdminIdentityOverrides, [{ ownerName: 'A' }]);
  assert.equal(carried.ownerName, 'KSV lưu lại');
  const spoofed = carryServerManagedSurveyKeys(stored, { adminIdentityOverrides: { ownerName: 'Giả' } });
  assert.deepEqual(spoofed.adminIdentityOverrides, { ownerName: null });
  assert.equal(carryServerManagedSurveyKeys({}, { adminIdentityOverrides: { ownerName: 'Giả' } }).adminIdentityOverrides, undefined);

  try {
    await Database.transaction(async (client) => {
      await client.query(
        `UPDATE base_survey_reports SET survey_data_json = COALESCE(survey_data_json, '{}'::jsonb) || $2::jsonb WHERE id = $1;`,
        [reportId, JSON.stringify({ adminIdentityOverrides: { ownerIdCard: null } })]
      );
      const merged = await mergeServerManagedKeysInTx(client, reportId, { ownerName: 'Nộp lại' });
      assert.deepEqual(JSON.parse(String(merged)).adminIdentityOverrides, { ownerIdCard: null });
      assert.equal(await mergeServerManagedKeysInTx(client, reportId, null), null, 'Không gửi JSON thì không ghi');
      throw new ScenarioRollback();
    });
  } catch (err) {
    if (!(err instanceof ScenarioRollback)) throw err;
  }

  // Một nhánh tự INSERT riêng sẽ làm cờ miễn về TRUE như lỗi cũ của cờ E
  const offenders = collectTsFiles(path.resolve(__dirname, '../modules')).filter(
    (file) => !file.endsWith('floor-survey-rows.ts') && fs.readFileSync(file, 'utf8').includes('INSERT INTO floor_surveys')
  );
  assert.deepEqual(offenders, []);

  assert.deepEqual(collectZoneExemptFloors(null), []);
  assert.equal(collectZoneExemptFloors([{ floorName: 'A' }, { floorName: 'B', hasZones: false, noZonesReason: 'Cửa khóa bên trong' }]).length, 1);
  assert.equal(toBilingualNoZonesReason('Lý do tự do của KSV').en, 'Lý do tự do của KSV', 'Không tự dựng câu tiếng Anh');
  assert.equal(toBilingualNoZonesReason(undefined).vi, '---', 'Không có lý do mặc định');

  console.log('✅ test_zone_exemption_persistence: đạt');
  process.exit(0);
}

main().catch((err) => {
  console.error('[test_zone_exemption_persistence] Thất bại:', err);
  process.exit(1);
});
