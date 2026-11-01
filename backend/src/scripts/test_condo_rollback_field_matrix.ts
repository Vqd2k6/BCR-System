/**
 * Đo độ phủ rollback của Căn hộ: sửa nhiều nhóm trường rồi rollback về từng kiểu bản chụp,
 * so từng bảng và khóa JSON với trạng thái trước khi sửa.
 * Chạy: DB_NAME=metro2_audit_test npx ts-node src/scripts/test_condo_rollback_field_matrix.ts
 */
import assert from 'node:assert/strict';
import dotenv from 'dotenv';
import { CryptoUtils } from '../common/utils/crypto.utils';
import { Database } from '../database/db';
import { CondoCrudEngineService } from '../modules/audit/condo/services/condo-crud-engine.service';
import { CondoVersionRollbackService } from '../modules/audit/condo/services/condo-version-rollback.service';
import { AuditVersionService } from '../modules/audit/services/audit-version.service';

dotenv.config();

type Row = Record<string, unknown>;
const REPORT_ID = 'bdd8097b-c959-4931-9c8a-8c741d164287';
const PASSWORD = 'Test@123456';
const VOLATILE = new Set(['updated_at', 'created_at', 'id', 'zone_id', 'unit_id', 'status', 'phase1_report_id']);
const EDITED_VALUE = /kiểm thử|^123(\.0+)?$|^8923|^1\.0423$|^11(\.0+)?$|^0900000000$|^079000000000$/i;
const VOLATILE_PATH = /(^|\.)(id|signatures\.(witnessName|witnessRole|witnessPhone)|overview_photos_json)$/;

function flatten(value: unknown, path: string, out: Record<string, string>): void {
  if (Array.isArray(value)) {
    value.forEach((item, idx) => flatten(item, `${path}[${idx}]`, out));
    if (value.length === 0) out[path] = '[]';
  } else if (value && typeof value === 'object' && !(value instanceof Date)) {
    Object.entries(value).forEach(([key, item]) => flatten(item, path ? `${path}.${key}` : key, out));
  } else {
    out[path] = String(value);
  }
}

async function dump(unitId: string | null, reportId: string = REPORT_ID, parcelId?: string): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  const add = async (name: string, sql: string, id: string) => {
    const rows = (await Database.query<Row>(sql, [id])).rows;
    rows.forEach((row, idx) =>
      Object.entries(row).forEach(([key, value]) => {
        if (!VOLATILE.has(key)) flatten(value, `${name}[${idx}].${key}`, out);
      })
    );
  };
  if (unitId) await add('unit', `SELECT * FROM building_units WHERE id = $1;`, unitId);
  if (parcelId) await add('parcel', `SELECT * FROM parcels WHERE id = $1;`, parcelId);
  await add('specs', `SELECT * FROM building_specifications WHERE report_id = $1;`, reportId);
  await add('history', `SELECT * FROM historical_sensitivities WHERE report_id = $1;`, reportId);
  await add('deformation', `SELECT * FROM deformation_assessments WHERE report_id = $1;`, reportId);
  await add('scores', `SELECT * FROM risk_score_cards WHERE report_id = $1;`, reportId);
  await add('floors', `SELECT * FROM floor_surveys WHERE report_id = $1;`, reportId);
  await add('zones', `SELECT * FROM damage_zones WHERE report_id = $1 AND is_deleted IS NOT TRUE ORDER BY floor_name, zone_code;`, reportId);
  await add('report', `SELECT survey_data_json, summary_conclusions, engineering_recommendations, owner_remarks FROM base_survey_reports WHERE id = $1;`, reportId);
  return out;
}

async function runScenario(name: string, unitId: string, adminId: string, targetVersion: number): Promise<string[]> {
  const before = await dump(unitId);
  const context = (await CondoCrudEngineService.resolveCondoReportContext(REPORT_ID))?.context;
  const json = context?.survey_data_json as Row;
  const updates: Row = {
    floorNumber: 123,
    unitAreaM2: 8923,
    displayCode: '1.0423',
    ownerName: 'Chủ kiểm thử',
    ownerPhone: '0900000000',
    ownerIdCard: '079000000000',
    settlementObserved: 'SLIGHT',
    settlementNotes: 'Lún kiểm thử',
    beamSagging: { hasSagging: true, level: 2, sagMm: 11, spanM: 4, position: 'Dầm kiểm thử' },
    historyInterview: { ...(json.historyInterview as Row), renovationLoad: 3, usageStatus: 'Đang sử dụng một phần' },
    hasSensitiveEquipment: true,
    sensitiveEquipmentDesc: 'Đàn kiểm thử',
    interiorRenovationHistory: { hasRenovated: true, description: 'Cải tạo kiểm thử' },
    roomLayoutNotes: 'Ghi chú kiểm thử',
    summaryConclusions: 'Kết luận kiểm thử',
    engineeringRecommendations: 'Kiến nghị kiểm thử',
    ownerFeedback: 'Ý kiến kiểm thử',
    signatures: { ...(json.signatures as Row), witnessName: 'Người chứng kiến kiểm thử' },
  };
  await CondoCrudEngineService.applyCondoAdminSurveyEdit(REPORT_ID, adminId, {
    adminPassword: PASSWORD,
    editReason: 'Kiểm thử ma trận rollback',
    diffPayload: Object.keys(updates).map((field) => ({ field, label: field, oldValue: json[field], newValue: updates[field] })),
    updates,
  });
  const edited = await dump(unitId);
  await CondoVersionRollbackService.rollbackCondoReportVersion(REPORT_ID, targetVersion, adminId, {
    password: PASSWORD,
    reason: 'Kiểm thử ma trận rollback',
  });
  const after = await dump(unitId);

  const keys = [...new Set([...Object.keys(before), ...Object.keys(edited), ...Object.keys(after)])].sort();
  // Hàng chưa từng tồn tại được dựng từ JSON nên có giá trị mặc định; chỉ tính là kẹt nếu còn mang giá trị đã sửa
  const lagging = keys.filter(
    (key) =>
      !VOLATILE_PATH.test(key) &&
      before[key] !== after[key] &&
      edited[key] === after[key] &&
      (before[key] !== undefined || EDITED_VALUE.test(String(after[key])))
  );
  console.log(`\n=== ${name} (v${targetVersion}): bản sửa đổi ${keys.filter((k) => before[k] !== edited[k]).length} khóa, còn kẹt ở giá trị đã sửa ${lagging.length}`);
  lagging.slice(0, 40).forEach((key) => console.log(`  ${key}: gốc=${String(before[key]).slice(0, 44)} | sau=${String(after[key]).slice(0, 44)}`));
  return lagging;
}

/** Khu vực chung và Tháp: tạo bản chụp đầy đủ, sửa, rollback về chính bản đó. */
async function runEntityScenario(name: string, reportId: string, adminId: string, updates: Row): Promise<string[]> {
  const resolved = await CondoCrudEngineService.resolveCondoReportContext(reportId);
  assert.ok(resolved);
  const { unit_id: unitId, parcel_id: parcelId } = resolved.context;
  const snapshot = await AuditVersionService.createSnapshot(reportId, {
    versionTag: 'ADMIN_DIFF_SAVE',
    title: 'Trước kiểm thử ma trận rollback',
    editReason: 'Kiểm thử',
    userId: adminId,
  });
  const before = await dump(unitId, reportId, parcelId);
  await CondoCrudEngineService.applyCondoAdminSurveyEdit(reportId, adminId, {
    adminPassword: PASSWORD,
    editReason: 'Kiểm thử ma trận rollback',
    diffPayload: Object.keys(updates).map((field) => ({ field, label: field, oldValue: null, newValue: updates[field] })),
    updates,
  });
  const edited = await dump(unitId, reportId, parcelId);
  await CondoVersionRollbackService.rollbackCondoReportVersion(reportId, snapshot.versionNumber, adminId, {
    password: PASSWORD,
    reason: 'Kiểm thử ma trận rollback',
  });
  const after = await dump(unitId, reportId, parcelId);
  const keys = [...new Set([...Object.keys(before), ...Object.keys(edited), ...Object.keys(after)])].sort();
  const changed = keys.filter((key) => before[key] !== edited[key]);
  // Rollback chuẩn hóa JSON (thêm damageZones, scopeStatus...) nên khóa mới sinh không tính là kẹt giá trị đã sửa
  const lagging = keys.filter(
    (key) => !VOLATILE_PATH.test(key) && !/_geom$/.test(key) && before[key] !== after[key] && (before[key] !== undefined || EDITED_VALUE.test(String(after[key])))
  );
  console.log(`\n=== ${name}: bản sửa đổi ${changed.length} khóa, sau rollback lệch ${lagging.length}`);
  lagging.slice(0, 30).forEach((key) => console.log(`  ${key}: gốc=${String(before[key]).slice(0, 44)} | sau=${String(after[key]).slice(0, 44)}`));
  return lagging;
}

async function main(): Promise<void> {
  if (process.env.DB_NAME !== 'metro2_audit_test') throw new Error('Chỉ chạy trên metro2_audit_test.');
  const hash = await CryptoUtils.hashPassword(PASSWORD);
  const admin = await Database.query<{ id: string }>(`SELECT id FROM users WHERE role = 'ZONE_ADMIN' AND status = 'ACTIVE' LIMIT 1;`);
  const adminId = admin.rows[0].id;
  await Database.query(`UPDATE users SET password_hash = $1 WHERE id = $2;`, [hash, adminId]);
  const unit = await Database.query<{ unit_id: string }>(`SELECT unit_id FROM base_survey_reports WHERE id = $1;`, [REPORT_ID]);
  const unitId = unit.rows[0].unit_id;
  await Database.query(
    `UPDATE base_survey_reports SET status = 'SUBMITTED' WHERE id = $1 AND status NOT IN ('SUBMITTED', 'UNDER_REVIEW');`,
    [REPORT_ID]
  );
  const swap = await Database.query<{ version_number: number }>(
    `SELECT version_number FROM survey_report_versions WHERE report_id = $1 AND version_tag = 'UNIT_CAD_SPATIAL_SWAP' ORDER BY version_number DESC LIMIT 1;`,
    [REPORT_ID]
  );
  // Đưa hồ sơ về trạng thái sạch trước khi đo
  await CondoVersionRollbackService.rollbackCondoReportVersion(REPORT_ID, swap.rows[0].version_number, adminId, {
    password: PASSWORD,
    reason: 'Đưa về trạng thái sạch',
  });
  const unitFloor = async () =>
    Number((await Database.query<{ floor_number: string }>(`SELECT floor_number FROM building_units WHERE id = $1;`, [unitId])).rows[0].floor_number);
  assert.equal(await unitFloor(), 1, 'Tầng phải về 1 sau rollback');

  const lagging = [
    ...(await runScenario('Bản hoán đổi CAD, chỉ có JSON', unitId, adminId, swap.rows[0].version_number)),
    ...(await runScenario('Bản gốc, sau đó có hoán đổi CAD', unitId, adminId, 0)),
  ];
  const pickEntity = async (where: string) =>
    (await Database.query<{ id: string }>(
      `SELECT r.id FROM base_survey_reports r JOIN parcels p ON p.id = r.parcel_id LEFT JOIN building_units bu ON bu.id = r.unit_id
       WHERE r.deleted_at IS NULL AND r.status IN ('SUBMITTED', 'UNDER_REVIEW') AND COALESCE(p.is_locked, false) = false AND ${where}
       ORDER BY r.created_at DESC LIMIT 1;`
    )).rows[0]?.id;
  const areaId = await pickEntity(`bu.unit_type = 'MASTER' AND EXISTS (SELECT 1 FROM damage_zones z WHERE z.report_id = r.id)`);
  if (areaId) {
    lagging.push(
      ...(await runEntityScenario('Khu vực chung', areaId, adminId, {
        floorNumber: 123,
        areaName: 'Khu vực kiểm thử',
        displayCode: 'M-KT',
        summaryConclusions: 'Kết luận kiểm thử',
        areaInfo: { areaName: 'Khu vực kiểm thử', floorNumber: 123, accessStatus: 'LOCKED', lockedReason: 'Khóa kiểm thử', locationDescription: 'Vị trí kiểm thử' },
      }))
    );
  }
  const masterId = await pickEntity(`r.report_type = 'BUILDING_MASTER'`);
  if (masterId) {
    // Cố định mốc: lần chạy trước có thể để lại giá trị đã sửa
    await Database.query(
      `UPDATE parcels SET total_units = 12 WHERE id = (SELECT parcel_id FROM base_survey_reports WHERE id = $1);`,
      [masterId]
    );
    lagging.push(
      ...(await runEntityScenario('Tháp', masterId, adminId, {
        aboveFloors: 123,
        undergroundFloors: 9,
        totalUnits: 999,
        buildingName: 'Tháp kiểm thử',
        houseNumber: '999',
        ownerName: 'BQL kiểm thử',
        managementContactName: 'BQL kiểm thử',
        pileDimensionMm: '999x999',
        constructionYear: '1999',
        buildingHeightM: 123,
        summaryConclusions: 'Kết luận kiểm thử',
        engineeringRecommendations: 'Kiến nghị kiểm thử',
      }))
    );
  }
  assert.equal(await unitFloor(), 1, 'Tầng phải về 1 sau cả 2 kịch bản');
  const bbox = await Database.query<{ cad_bbox: unknown; floor_plan_id: string | null }>(
    `SELECT cad_bbox, floor_plan_id FROM building_units WHERE id = $1;`,
    [unitId]
  );
  assert.ok(bbox.rows[0].cad_bbox, 'Vị trí CAD phải được khôi phục');
  assert.ok(bbox.rows[0].floor_plan_id, 'Mặt bằng tầng phải được khôi phục');
  assert.equal(lagging.length, 0, 'Còn trường không quay về sau rollback');
  console.log('\n[test_condo_rollback_field_matrix] OK');
  process.exit(0);
}

main().catch((err) => {
  console.error('[test_condo_rollback_field_matrix] Thất bại:', err?.message ?? err);
  process.exit(1);
});
