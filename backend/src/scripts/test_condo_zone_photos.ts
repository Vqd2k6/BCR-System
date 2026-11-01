/**
 * Kiểm thử nạp ảnh tổng quan Z/E vào Studio chung cư. CHỈ chạy trên DB bản sao vì có ghi hồ sơ thật của bản sao:
 *   DB_NAME=metro2_audit_test npx ts-node src/scripts/test_condo_zone_photos.ts
 */
import assert from 'assert';
import { Database } from '../database/db';
import { fetchCondoUnitAbsenceMap } from '../modules/audit/condo/condo-absence.resolver';
import { CondoCrudEngineService } from '../modules/audit/condo/services/condo-crud-engine.service';
import { AuditReviewService } from '../modules/audit/services/audit-review.service';
import { CryptoUtils } from '../common/utils/crypto.utils';

type JsonRecord = Record<string, unknown>;

const overviewOf = (zone: JsonRecord): unknown[] =>
  (Array.isArray(zone.overviewPhotos) ? zone.overviewPhotos : []) as unknown[];

async function loadJsonZones(reportId: string): Promise<JsonRecord[]> {
  const res = await Database.query<{ survey_data_json: JsonRecord }>(
    `SELECT survey_data_json FROM base_survey_reports WHERE id = $1;`,
    [reportId]
  );
  const json = res.rows[0].survey_data_json;
  return (Array.isArray(json.damageZones) && json.damageZones.length > 0 ? json.damageZones : json.zones) as JsonRecord[];
}

async function countZonesWithoutCtx(reportId: string): Promise<number> {
  const res = await Database.query<{ count: number }>(
    `SELECT COUNT(*)::int AS count FROM damage_zones
     WHERE report_id = $1 AND is_deleted IS NOT TRUE AND COALESCE(ctx_photo_url, '') = '';`,
    [reportId]
  );
  return res.rows[0].count;
}

async function main(): Promise<void> {
  const dbName = (await Database.query<{ name: string }>(`SELECT current_database() AS name;`)).rows[0].name;
  assert.strictEqual(dbName, 'metro2_audit_test', 'Chỉ được chạy trên DB bản sao');

  const password = 'ZonePhotos#2026';
  const adminId = (
    await Database.query<{ id: string }>(
      `INSERT INTO users (username, email, password_hash, full_name, role, status)
       VALUES ($1, $2, $3, 'Test Ảnh Vùng', 'SUPER_ADMIN', 'ACTIVE') RETURNING id;`,
      [`zone_photos_${Date.now()}`, `zone_photos_${Date.now()}@test.local`, await CryptoUtils.hashPassword(password)]
    )
  ).rows[0].id;

  const pick = await Database.query<{ id: string }>(
    `SELECT r.id
     FROM base_survey_reports r
     JOIN building_units u ON u.id = r.unit_id AND u.unit_type <> 'MASTER'
     WHERE r.status = 'SUBMITTED'
       AND jsonb_typeof(r.survey_data_json->'zones') = 'array'
       AND EXISTS (
         SELECT 1 FROM jsonb_array_elements(r.survey_data_json->'zones') z
         JOIN damage_zones dz ON dz.report_id = r.id AND dz.zone_code = z->>'zoneCode'
         WHERE jsonb_array_length(COALESCE(z->'overviewPhotos', '[]')) > 0
           AND jsonb_array_length(COALESCE(dz.overview_photos_json, '[]')) = 0
           AND COALESCE(dz.ctx_photo_url, '') = '')
     ORDER BY r.id;`
  );
  const absence = await fetchCondoUnitAbsenceMap(pick.rows.map((row) => row.id));
  const reportId = pick.rows.find((row) => absence.get(row.id)?.state !== 'ABSENT')?.id;
  assert.ok(reportId, 'Cần một hồ sơ không vắng còn ảnh tổng quan chỉ nằm trong JSON');
  const originalZones = await loadJsonZones(reportId);
  const photoCount = originalZones.reduce((sum, zone) => sum + overviewOf(zone).length, 0);
  assert.ok(photoCount > 0, 'Hồ sơ mẫu phải có ảnh tổng quan trong JSON');

  const view = (await AuditReviewService.getSplitPaneAuditView(reportId)) as { leftPane: { damageZones: JsonRecord[] } };
  const viewZones = view.leftPane.damageZones;
  const viewPhotoCount = viewZones.reduce((sum, zone) => sum + overviewOf(zone).length, 0);
  console.log(`Ảnh tổng quan: JSON ${photoCount}, view ${viewPhotoCount}`);

  const zonesWithoutCtx = await countZonesWithoutCtx(reportId);
  assert.ok(zonesWithoutCtx > 0, 'Hồ sơ mẫu phải có vùng chưa có CTX');

  // Mô phỏng form Studio: sửa ghi chú một vùng rồi gửi cả mảng vùng lên như frontend
  const formZones = viewZones.map((zone, idx) => ({
    ...zone,
    zoneCode: zone.zone_code,
    floorName: zone.floor_name,
    roomName: zone.room_name,
    overviewPhotos: overviewOf(zone),
    notes: idx === 0 ? 'Ghi chú thử ảnh vùng' : zone.notes,
  }));
  await CondoCrudEngineService.applyCondoAdminSurveyEdit(reportId, adminId, {
    updates: { damageZones: formZones },
    photoActions: [],
    diffPayload: [{ field: 'damageZones', label: 'Vùng', oldValue: '', newValue: '' }],
    editReason: 'Kiểm thử giữ ảnh tổng quan khi lưu',
    adminPassword: password,
  } as never);

  const savedZones = await loadJsonZones(reportId);
  assert.strictEqual(await countZonesWithoutCtx(reportId), zonesWithoutCtx, 'Không được lấy ảnh tổng quan làm CTX khi lưu');

  const savedPhotoCount = savedZones.reduce((sum, zone) => sum + overviewOf(zone).length, 0);
  console.log(`Sau khi lưu vùng: JSON còn ${savedPhotoCount}/${photoCount} ảnh tổng quan`);

  assert.strictEqual(viewPhotoCount, photoCount, 'Studio phải nhận đủ ảnh tổng quan từ JSON');
  assert.strictEqual(savedPhotoCount, photoCount, 'Lưu vùng không được làm mất ảnh tổng quan');
  console.log('OK test_condo_zone_photos');
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('[test_condo_zone_photos] Thất bại:', err);
    process.exit(1);
  });
