/**
 * Đo độ phủ rollback của Nhà dân: sửa nhiều nhóm trường, rollback, rồi so từng bảng và từng khóa JSON.
 * Chạy: DB_NAME=metro2_audit_test npx ts-node src/scripts/test_rollback_field_matrix.ts
 */
import dotenv from 'dotenv';
import { CryptoUtils } from '../common/utils/crypto.utils';
import { Database } from '../database/db';
import { AuditModificationService } from '../modules/audit/services/audit-modification.service';
import { AuditVersionService } from '../modules/audit/services/audit-version.service';

dotenv.config();

type Row = Record<string, unknown>;
const VOLATILE = new Set(['updated_at', 'created_at', 'id', 'zone_id', 'export_revision', 'last_edited_by_id', 'status']);

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

async function dump(reportId: string, parcelId: string): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  const add = (name: string, rows: Row[]) => {
    rows.forEach((row, idx) => {
      Object.entries(row).forEach(([key, value]) => {
        if (!VOLATILE.has(key)) flatten(value, `${name}[${idx}].${key}`, out);
      });
    });
  };
  const one = async (sql: string, params: unknown[]) => (await Database.query<Row>(sql, params)).rows;
  add('parcels', await one(`SELECT * FROM parcels WHERE id = $1;`, [parcelId]));
  add('specs', await one(`SELECT * FROM building_specifications WHERE report_id = $1;`, [reportId]));
  add('history', await one(`SELECT * FROM historical_sensitivities WHERE report_id = $1;`, [reportId]));
  add('deformation', await one(`SELECT * FROM deformation_assessments WHERE report_id = $1;`, [reportId]));
  add('scope', await one(`SELECT * FROM survey_scopes WHERE report_id = $1;`, [reportId]));
  add('scores', await one(`SELECT * FROM risk_score_cards WHERE report_id = $1;`, [reportId]));
  add('floors', await one(`SELECT * FROM floor_surveys WHERE report_id = $1 ORDER BY floor_order, floor_name;`, [reportId]));
  add('zones', await one(`SELECT * FROM damage_zones WHERE report_id = $1 AND is_deleted IS NOT TRUE ORDER BY floor_name, zone_code;`, [reportId]));
  const report = await one(`SELECT survey_data_json, summary_conclusions, engineering_recommendations FROM base_survey_reports WHERE id = $1;`, [reportId]);
  add('report', report);
  return out;
}

async function main(): Promise<void> {
  if (process.env.DB_NAME !== 'metro2_audit_test') throw new Error('Chỉ chạy trên metro2_audit_test.');

  const picked = await Database.query<{ id: string; parcel_id: string; survey_data_json: Row }>(
    `SELECT r.id, r.parcel_id, r.survey_data_json FROM base_survey_reports r
     JOIN parcels p ON p.id = r.parcel_id
     WHERE r.report_type = 'STANDALONE' AND r.status = 'UNDER_REVIEW' AND r.deleted_at IS NULL
       AND COALESCE(p.is_locked, false) = false AND jsonb_array_length(r.survey_data_json->'floors') >= 2
     ORDER BY r.created_at DESC LIMIT 1;`
  );
  const report = picked.rows[0];
  if (!report) throw new Error('Không có hồ sơ phù hợp.');

  const password = 'Test@123456';
  const hash = await CryptoUtils.hashPassword(password);
  const admin = await Database.query<{ id: string }>(`SELECT id FROM users WHERE role = 'ZONE_ADMIN' LIMIT 1;`);
  await Database.query(`UPDATE users SET password_hash = $1 WHERE id = $2;`, [hash, admin.rows[0].id]);
  const adminId = admin.rows[0].id;

  const snapshot = await AuditVersionService.createSnapshot(report.id, {
    versionTag: 'ADMIN_DIFF_SAVE',
    title: 'Trước kiểm thử ma trận rollback',
    editReason: 'Kiểm thử',
    userId: adminId,
  });
  const before = await dump(report.id, report.parcel_id);

  const json = report.survey_data_json;
  const floors = json.floors as Row[];
  const updates: Row = {
    aboveFloors: Number(json.aboveFloors ?? 1) + 3,
    undergroundFloors: Number(json.undergroundFloors ?? 0) + 2,
    constructionYear: '1999',
    buildingName: 'Sửa kiểm thử',
    ownerName: 'Chủ kiểm thử',
    houseNumber: '999',
    constructionAreaM2: 123.4,
    landAreaM2: 234.5,
    buildingHeightM: 45.6,
    summaryConclusions: 'Kết luận kiểm thử',
    floors: [
      ...floors.map((floor, idx) => (idx === 0 ? { ...floor, floorName: 'Tầng đổi tên', notes: 'Sửa' } : floor)),
      { floorName: 'Tầng thêm kiểm thử', zones: [], structuralElements: [] },
    ],
  };
  await AuditModificationService.applyAdminSurveyEdit(report.id, adminId, {
    adminPassword: password,
    editReason: 'Kiểm thử ma trận rollback',
    diffPayload: Object.keys(updates).map((field) => ({ field, label: field, oldValue: json[field], newValue: updates[field] })),
    updates,
  });
  const edited = await dump(report.id, report.parcel_id);

  await AuditVersionService.rollbackToVersion(report.id, snapshot.versionNumber, adminId, {
    password,
    reason: 'Kiểm thử ma trận rollback',
  });
  const after = await dump(report.id, report.parcel_id);

  const keys = [...new Set([...Object.keys(before), ...Object.keys(after)])].sort();
  const notRestored = keys.filter((key) => before[key] !== after[key] && !/\.id$|_geom$|adjacent_buildings$/.test(key));
  const changedByEdit = keys.filter((key) => before[key] !== edited[key]);
  console.log(`Hồ sơ ${report.id}: bản sửa đổi ${changedByEdit.length} khóa, sau rollback còn lệch ${notRestored.length} khóa.`);
  const byGroup: Record<string, string[]> = {};
  notRestored.forEach((key) => {
    (byGroup[key.split('[')[0]] ??= []).push(key);
  });
  for (const [group, list] of Object.entries(byGroup)) {
    console.log(`\n${group}: ${list.length}`);
    list.slice(0, 30).forEach((key) => {
      const edit = before[key] !== edited[key] ? ' (do bản sửa)' : ' (rollback tự đổi)';
      console.log(`  ${key}: gốc=${String(before[key]).slice(0, 50)} | sau=${String(after[key]).slice(0, 50)}${edit}`);
    });
  }
  process.exit(0);
}

main().catch((err) => {
  console.error('[test_rollback_field_matrix] Thất bại:', err);
  process.exit(1);
});
