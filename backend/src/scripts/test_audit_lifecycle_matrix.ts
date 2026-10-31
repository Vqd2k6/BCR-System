/**
 * Ma trận vòng đời Thẩm định: submit diff, rollback, duyệt, trả, mở lại cho thổ cư và chung cư.
 * Tiêu chí chung: không use case nào được ra lỗi 5xx. Script ghi trực tiếp vào DB,
 * CHỈ chạy trên DB bản sao: DB_NAME=metro2_audit_test npx ts-node src/scripts/test_audit_lifecycle_matrix.ts
 */
import dotenv from 'dotenv';
import path from 'path';
dotenv.config({ path: path.resolve(process.cwd(), '.env') });

import assert from 'assert';
import { randomUUID } from 'crypto';
import { Database, pool } from '../database/db';
import { AuditService } from '../modules/audit/audit.service';
import { CryptoUtils } from '../common/utils/crypto.utils';
import { normalizeSurveyDate } from '../modules/audit/utils/survey-date.utils';

const ADMIN_PASSWORD = 'Matrix@Admin123';

interface ErrorWithStatus {
  status?: number;
  message?: string;
}

interface Outcome {
  name: string;
  error?: string;
}

const outcomes: Outcome[] = [];

function statusOf(err: unknown): number {
  return (err as ErrorWithStatus)?.status ?? 500;
}

function messageOf(err: unknown): string {
  return (err as ErrorWithStatus)?.message ?? String(err);
}

async function run(name: string, testFn: () => Promise<void>): Promise<void> {
  try {
    await testFn();
    outcomes.push({ name });
    console.log(`  PASS ${name}`);
  } catch (err) {
    outcomes.push({ name, error: messageOf(err) });
    console.error(`  FAIL ${name}: ${messageOf(err)}`);
  }
}

async function expectStatus(expected: number, action: () => Promise<unknown>): Promise<void> {
  try {
    await action();
  } catch (err) {
    assert.strictEqual(statusOf(err), expected, `Mong đợi ${expected}, nhận ${statusOf(err)}: ${messageOf(err)}`);
    return;
  }
  assert.fail(`Mong đợi lỗi ${expected} nhưng thao tác thành công`);
}

/** Thành công hoặc bị chốt nghiệp vụ 4xx đều hợp lệ; 5xx là lỗi hệ thống. */
async function expectNoServerError(action: () => Promise<unknown>): Promise<string> {
  try {
    await action();
    return 'OK';
  } catch (err) {
    const status = statusOf(err);
    assert.ok(status < 500, `Lỗi hệ thống ${status}: ${messageOf(err)}`);
    return `${status}: ${messageOf(err).slice(0, 90)}`;
  }
}

async function pickReports(reportType: string, status: string, limit: number, excludeIds: string[] = []): Promise<string[]> {
  const res = await Database.query<{ id: string }>(
    `SELECT id FROM base_survey_reports
     WHERE report_type = $1 AND status = $2::report_status_enum AND deleted_at IS NULL AND NOT (id = ANY($4::uuid[]))
     ORDER BY updated_at DESC LIMIT $3;`,
    [reportType, status, limit, excludeIds]
  );
  return res.rows.map((row) => row.id);
}

async function reportColumn<T>(reportId: string, column: 'status' | 'summary_conclusions' | 'zone_admin_id' | 'survey_date'): Promise<T> {
  const res = await Database.query<{ value: T }>(
    column === 'survey_date'
      ? `SELECT survey_date::text AS value FROM base_survey_reports WHERE id = $1;`
      : `SELECT ${column}::text AS value FROM base_survey_reports WHERE id = $1;`,
    [reportId]
  );
  return res.rows[0].value;
}

async function versionNumbers(reportId: string): Promise<number[]> {
  const res = await Database.query<{ version_number: number }>(
    `SELECT version_number FROM survey_report_versions WHERE report_id = $1 ORDER BY version_number;`,
    [reportId]
  );
  return res.rows.map((row) => row.version_number);
}

function editPayload(updates: Record<string, unknown>, adminPassword = ADMIN_PASSWORD) {
  return {
    adminPassword,
    editReason: 'Kiểm thử ma trận thẩm định',
    diffPayload: Object.keys(updates).map((field) => ({ field, label: field, oldValue: null, newValue: updates[field] })),
    updates,
    photoActions: [],
  };
}

async function createUser(prefix: string, role: string): Promise<string> {
  const hash = await CryptoUtils.hashPassword(ADMIN_PASSWORD);
  const res = await Database.query<{ id: string }>(
    `INSERT INTO users (username, password_hash, full_name, role)
     VALUES ($1, $2, $3, $4::role_enum) RETURNING id;`,
    [`${prefix}_${randomUUID().slice(0, 8)}`, hash, `Ma trận ${prefix}`, role]
  );
  return res.rows[0].id;
}

async function createMasterAreaReport(masterReportId: string, surveyorId: string): Promise<string> {
  const parcelRes = await Database.query<{ parcel_id: string }>(`SELECT parcel_id FROM base_survey_reports WHERE id = $1;`, [masterReportId]);
  const parcelId = parcelRes.rows[0].parcel_id;
  const unitId = randomUUID();
  const reportId = randomUUID();
  await Database.query(
    `INSERT INTO building_units (id, parcel_id, unit_code, unit_type, floor_number, status)
     VALUES ($1, $2, $3, 'MASTER', 1, 'SUBMITTED');`,
    [unitId, parcelId, `AREA-${reportId.slice(0, 6)}`]
  );
  await Database.query(
    `INSERT INTO base_survey_reports (id, parcel_id, unit_id, report_code, report_type, phase, status, surveyor_id, current_step, survey_data_json)
     VALUES ($1, $2, $3, $4, 'MASTER_AREA', 'PHASE_1', 'SUBMITTED', $5, 4, '{"zones": [], "ownerName": "BQL gốc"}');`,
    [reportId, parcelId, unitId, `MTX-${reportId.slice(0, 8)}`, surveyorId]
  );
  return reportId;
}

async function main(): Promise<void> {
  const dbNameRes = await Database.query<{ name: string }>(`SELECT current_database() AS name;`);
  assert.notStrictEqual(dbNameRes.rows[0].name, 'metro2_gis_db', 'Từ chối chạy trên DB chính');

  const adminId = await createUser('mtx_admin', 'ZONE_ADMIN');
  const superAdminId = await createUser('mtx_super', 'SUPER_ADMIN');
  const surveyorId = await createUser('mtx_surveyor', 'SURVEYOR');
  const otherSurveyorId = await createUser('mtx_other', 'SURVEYOR');

  console.log('\n[Đơn vị] Chuẩn hóa ngày');
  await run('dd/mm/yyyy không bị đảo ngày tháng', async () => {
    assert.strictEqual(normalizeSurveyDate('12/10/2026'), '2026-10-12');
    assert.strictEqual(normalizeSurveyDate('30/10/2026'), '2026-10-30');
    assert.strictEqual(normalizeSurveyDate('2026-10-30'), '2026-10-30');
    assert.strictEqual(normalizeSurveyDate('31/02/2026'), null);
    assert.strictEqual(normalizeSurveyDate('không phải ngày'), null);
  });

  console.log('\n[Thổ cư] Submit diff');
  const realReportId = '24597192-085f-4e87-ad38-29d0510f66cb';
  await run('Hồ sơ gây lỗi FK gốc submit diff thành công', async () => {
    const before = await versionNumbers(realReportId);
    const result = await AuditService.applyAdminSurveyEdit(realReportId, adminId, editPayload({ surveyDate: '12/10/2026' }));
    assert.deepStrictEqual((result as { warnings?: string[] }).warnings ?? [], []);
    const scoreRes = await Database.query<{ total_ecs_score: number | null }>(
      `SELECT total_ecs_score FROM risk_score_cards WHERE report_id = $1;`,
      [realReportId]
    );
    assert.ok(scoreRes.rows[0], 'Thiếu bảng điểm sau khi sửa');
    assert.strictEqual(await reportColumn(realReportId, 'status'), 'UNDER_REVIEW');
    assert.strictEqual(await reportColumn(realReportId, 'survey_date'), '2026-10-12');
    assert.ok((await versionNumbers(realReportId)).length >= before.length + 1, 'Thiếu phiên bản ADMIN_DIFF_SAVE');
  });

  const residential = await pickReports('STANDALONE', 'SUBMITTED', 12, [realReportId]);
  assert.ok(residential.length >= 10, 'Không đủ hồ sơ thổ cư SUBMITTED');

  await run('Sai mật khẩu trả 403, không phải 401 gây đăng xuất', async () => {
    await expectStatus(403, () => AuditService.applyAdminSurveyEdit(residential[0], adminId, editPayload({ ownerName: 'X' }, 'sai-mat-khau')));
  });
  await run('Thiếu mật khẩu trả 400', async () => {
    await expectStatus(400, () => AuditService.applyAdminSurveyEdit(residential[0], adminId, editPayload({ ownerName: 'X' }, ' ')));
  });
  await run('Số không hợp lệ trả 400 và không ghi gì', async () => {
    await expectStatus(400, () => AuditService.applyAdminSurveyEdit(residential[0], adminId, editPayload({ frontageWidth: 'abc' })));
    await expectStatus(400, () => AuditService.applyAdminSurveyEdit(residential[0], adminId, editPayload({ aboveFloors: '2.5' })));
    assert.strictEqual(await reportColumn(residential[0], 'status'), 'SUBMITTED');
  });
  await run('Ngày không hợp lệ trả 400', async () => {
    await expectStatus(400, () => AuditService.applyAdminSurveyEdit(residential[0], adminId, editPayload({ surveyDate: '31/02/2026' })));
  });
  await run('Có người khác lưu giữa lúc đọc và lúc ghi: trả 409, không ghi đè', async () => {
    const reportId = residential[1];
    const db = Database as unknown as { transaction: typeof Database.transaction };
    const originalTransaction = db.transaction;
    db.transaction = (async (work: Parameters<typeof Database.transaction>[0]) => {
      db.transaction = originalTransaction;
      await Database.query(`UPDATE base_survey_reports SET updated_at = NOW() WHERE id = $1;`, [reportId]);
      return originalTransaction.call(Database, work);
    }) as typeof Database.transaction;
    try {
      await expectStatus(409, () => AuditService.applyAdminSurveyEdit(reportId, adminId, editPayload({ ownerName: 'Bản ghi đè' })));
    } finally {
      db.transaction = originalTransaction;
    }
    assert.strictEqual(await reportColumn(reportId, 'status'), 'SUBMITTED');
  });
  await run('Độ nghiêng thập phân lưu đúng, không lỗi kiểu integer', async () => {
    const reportId = residential[10];
    await AuditService.applyAdminSurveyEdit(reportId, adminId, editPayload({
      settlementTilt: { buildingTilt: { xPermille: 1.5, yPermille: 0.17 }, beamSagging: { sagMm: 2.5 } },
    }));
    const res = await Database.query<{ tilt_angle_x: string; tilt_angle_y: string; beam_deflection_mm: string }>(
      `SELECT tilt_angle_x, tilt_angle_y, beam_deflection_mm FROM deformation_assessments WHERE report_id = $1;`,
      [reportId]
    );
    assert.strictEqual(Number(res.rows[0].tilt_angle_x), 1.5);
    assert.strictEqual(Number(res.rows[0].tilt_angle_y), 0.17);
    assert.strictEqual(Number(res.rows[0].beam_deflection_mm), 2.5);
  });
  await run('Xoay và thay ảnh định danh P04 không lỗi enum', async () => {
    const rotate = { action: 'ROTATE', targetPhotoType: 'P04', photoType: 'P04', category: 'IDENTIFICATION', rotation: 90, angle: 90 };
    await expectNoServerError(() =>
      AuditService.applyAdminSurveyEdit(residential[2], adminId, { ...editPayload({ ownerName: 'Ảnh P04' }), photoActions: [rotate] } as never)
    );
    const updated = await expectNoServerError(() =>
      AuditService.applyAdminSurveyEdit(residential[3], adminId, editPayload({ photoP04: { url: 'https://example.com/p04.jpg' } }))
    );
    assert.strictEqual(updated, 'OK', updated);
  });

  console.log('\n[Thổ cư] Rollback');
  await run('Rollback xóa kết luận thêm sau phiên bản đích và tạo phiên bản mới', async () => {
    const reportId = residential[4];
    const original = await reportColumn<string | null>(reportId, 'summary_conclusions');
    await AuditService.applyAdminSurveyEdit(reportId, adminId, editPayload({ ownerName: 'Mốc định dạng mới' }));
    const target = (await versionNumbers(reportId)).pop() as number;
    await AuditService.applyAdminSurveyEdit(reportId, adminId, editPayload({ summaryConclusions: 'Kết luận thêm sau mốc' }));
    assert.strictEqual(await reportColumn(reportId, 'summary_conclusions'), 'Kết luận thêm sau mốc');
    const before = await versionNumbers(reportId);
    await AuditService.rollbackReportVersion(reportId, target, adminId, { reason: 'Hoàn nguyên ma trận', password: ADMIN_PASSWORD });
    assert.strictEqual(await reportColumn(reportId, 'summary_conclusions'), original);
    assert.ok((await versionNumbers(reportId)).length > before.length, 'Rollback không tạo phiên bản mới');
  });
  await run('Rollback về snapshot cũ không có kết luận thì giữ nguyên, không xóa nhầm', async () => {
    const reportId = residential[4];
    await AuditService.applyAdminSurveyEdit(reportId, adminId, editPayload({ summaryConclusions: 'Kết luận hiện hành' }));
    const legacyVersion = (await versionNumbers(reportId)).pop() as number;
    await Database.query(
      `UPDATE survey_report_versions
       SET snapshot_data = (snapshot_data::jsonb - 'summaryConclusions' - 'engineeringRecommendations')
       WHERE report_id = $1 AND version_number = $2;`,
      [reportId, legacyVersion]
    );
    const jsonRes = await Database.query(
      `UPDATE survey_report_versions
       SET snapshot_data = jsonb_set(snapshot_data::jsonb, '{surveyJson}', (snapshot_data::jsonb->'surveyJson') - 'summaryConclusions')
       WHERE report_id = $1 AND version_number = $2;`,
      [reportId, legacyVersion]
    );
    assert.strictEqual(jsonRes.rowCount, 1);
    await AuditService.rollbackReportVersion(reportId, legacyVersion, adminId, { reason: 'Hoàn nguyên định dạng cũ', password: ADMIN_PASSWORD });
    assert.strictEqual(await reportColumn(reportId, 'summary_conclusions'), 'Kết luận hiện hành');
  });
  await run('Rollback phiên bản không tồn tại trả 404', async () => {
    await expectStatus(404, () => AuditService.rollbackReportVersion(residential[4], 9999, adminId, { reason: 'Không tồn tại', password: ADMIN_PASSWORD }));
  });
  await run('Rollback sai mật khẩu bị từ chối', async () => {
    await expectStatus(400, () => AuditService.rollbackReportVersion(residential[4], 0, adminId, { reason: 'Sai mật khẩu', password: 'sai' }));
  });

  console.log('\n[Thổ cư] Trả về, mở lại, phê duyệt');
  await run('Trả về rồi Admin mở lại', async () => {
    const reportId = residential[5];
    await AuditService.rejectReport(reportId, adminId, 'Thiếu ảnh hiện trường');
    assert.strictEqual(await reportColumn(reportId, 'status'), 'REJECTED');
    await AuditService.revertReportToDraft(reportId, adminId, 'Mở lại để bổ sung', undefined, 'ZONE_ADMIN');
    assert.strictEqual(await reportColumn(reportId, 'status'), 'DRAFT');
    assert.strictEqual(await reportColumn(reportId, 'zone_admin_id'), adminId);
  });
  await run('Surveyor không mở lại được hồ sơ người khác', async () => {
    await expectStatus(403, () => AuditService.revertReportToDraft(residential[6], otherSurveyorId, 'Không phải của tôi', undefined, 'SURVEYOR'));
    assert.strictEqual(await reportColumn(residential[6], 'status'), 'SUBMITTED');
  });
  await run('Surveyor mở lại hồ sơ của mình, không bị ghi vào zone_admin_id', async () => {
    const reportId = residential[7];
    await Database.query(`UPDATE base_survey_reports SET surveyor_id = $2 WHERE id = $1;`, [reportId, surveyorId]);
    const zoneAdminBefore = await reportColumn(reportId, 'zone_admin_id');
    await AuditService.revertReportToDraft(reportId, surveyorId, undefined, undefined, 'SURVEYOR');
    assert.strictEqual(await reportColumn(reportId, 'status'), 'DRAFT');
    assert.strictEqual(await reportColumn(reportId, 'zone_admin_id'), zoneAdminBefore);
  });
  await run('Phê duyệt không ra lỗi hệ thống (quét 2 hồ sơ)', async () => {
    for (const reportId of residential.slice(8, 10)) {
      console.log(`     approve ${reportId.slice(0, 8)} -> ${await expectNoServerError(() => AuditService.approveReport(reportId, adminId, 'Ma trận'))}`);
    }
  });

  console.log('\n[Bất biến] Hồ sơ APPROVED');
  const approved = await pickReports('STANDALONE', 'APPROVED', 1);
  await run('Hồ sơ APPROVED chặn mọi thao tác ghi', async () => {
    assert.ok(approved[0], 'Không có hồ sơ APPROVED');
    const reportId = approved[0];
    await expectStatus(409, () => AuditService.rejectReport(reportId, adminId, 'Thử trả về'));
    await expectStatus(409, () => AuditService.revertReportToDraft(reportId, adminId, 'Thử mở lại', undefined, 'ZONE_ADMIN'));
    await expectStatus(409, () => AuditService.approveAbsenteeReport(reportId, adminId, 'Thử vắng mặt'));
    await expectStatus(403, () => AuditService.applyAdminSurveyEdit(reportId, adminId, editPayload({ ownerName: 'X' })));
    await expectStatus(409, () => AuditService.rollbackReportVersion(reportId, 0, adminId, { reason: 'Thử rollback', password: ADMIN_PASSWORD }));
    assert.strictEqual(await reportColumn(reportId, 'status'), 'APPROVED');
  });
  await run('Super Admin mở khóa xong thì sửa được', async () => {
    const reportId = approved[0];
    await AuditService.unlockApprovedReport(reportId, superAdminId);
    assert.notStrictEqual(await reportColumn(reportId, 'status'), 'APPROVED');
    await AuditService.applyAdminSurveyEdit(reportId, adminId, editPayload({ ownerName: 'Sau mở khóa' }));
  });

  console.log('\n[Chung cư] Căn hộ con');
  const units = await pickReports('CONDO_UNIT', 'SUBMITTED', 6);
  assert.ok(units.length >= 5, 'Không đủ căn hộ SUBMITTED');
  await run('Căn hộ: submit diff và sai mật khẩu', async () => {
    await expectStatus(403, () => AuditService.applyAdminSurveyEdit(units[0], adminId, editPayload({ ownerName: 'X' }, 'sai-mat-khau')));
    await AuditService.applyAdminSurveyEdit(units[0], adminId, editPayload({ ownerName: 'Chủ căn hộ đã sửa' }));
  });
  await run('Căn hộ: rollback về phiên bản đầu', async () => {
    const versions = await versionNumbers(units[0]);
    assert.ok(versions.length > 0, 'Căn hộ chưa có phiên bản');
    await AuditService.rollbackReportVersion(units[0], versions[0], adminId, { reason: 'Hoàn nguyên căn hộ', password: ADMIN_PASSWORD });
  });
  await run('Căn hộ: trả về và mở lại', async () => {
    await AuditService.rejectReport(units[1], adminId, 'Thiếu ảnh');
    await AuditService.revertReportToDraft(units[1], adminId, 'Mở lại', undefined, 'ZONE_ADMIN');
    assert.strictEqual(await reportColumn(units[1], 'status'), 'DRAFT');
  });
  await run('Căn hộ: phê duyệt và phê duyệt vắng mặt không lỗi hệ thống', async () => {
    console.log(`     approve -> ${await expectNoServerError(() => AuditService.approveReport(units[2], adminId, 'Ma trận'))}`);
    console.log(`     absentee -> ${await expectNoServerError(() => AuditService.approveAbsenteeReport(units[3], adminId, 'Ma trận'))}`);
  });
  await run('Căn hộ: duyệt hàng loạt đi qua luồng Condo', async () => {
    const result = await AuditService.batchApproveReports([units[4]], adminId, 'Ma trận');
    const failure = result.results.find((item) => !item.success);
    console.log(`     batch -> ${failure ? failure.message.slice(0, 90) : 'OK'}`);
    assert.ok(!failure || !/column|syntax|violates|does not exist/i.test(failure.message), failure?.message);
  });

  console.log('\n[Chung cư] Master & Khu vực chung');
  const masters = await pickReports('BUILDING_MASTER', 'SUBMITTED', 1);
  await run('Master: submit diff có sửa điểm ECS/VI', async () => {
    assert.ok(masters[0], 'Không có BUILDING_MASTER SUBMITTED');
    await AuditService.applyAdminSurveyEdit(masters[0], adminId, editPayload({ ecs: { e1: 1 }, vi: { v1: 2 } }));
  });
  await run('Master: rollback', async () => {
    const versions = await versionNumbers(masters[0]);
    assert.ok(versions.length > 0, 'Master chưa có phiên bản');
    await AuditService.rollbackReportVersion(masters[0], versions[0], adminId, { reason: 'Hoàn nguyên master', password: ADMIN_PASSWORD });
  });
  let areaReportId = '';
  await run('Khu vực chung: submit diff và rollback', async () => {
    areaReportId = await createMasterAreaReport(masters[0], surveyorId);
    await AuditService.applyAdminSurveyEdit(areaReportId, adminId, editPayload({ ownerName: 'BQL đã sửa' }));
    const versions = await versionNumbers(areaReportId);
    assert.ok(versions.length > 0, 'Khu vực chung chưa có phiên bản');
    await AuditService.rollbackReportVersion(areaReportId, versions[0], adminId, { reason: 'Hoàn nguyên khu vực', password: ADMIN_PASSWORD });
  });
  await run('Final seal không lỗi hệ thống', async () => {
    const parcelRes = await Database.query<{ parcel_id: string }>(`SELECT parcel_id FROM base_survey_reports WHERE id = $1;`, [masters[0]]);
    console.log(`     seal -> ${await expectNoServerError(() => AuditService.executeFinalSeal(parcelRes.rows[0].parcel_id, adminId, 'Ma trận'))}`);
  });

  await run('Final seal thành công khi master và toàn bộ căn đã duyệt, sau đó khóa mọi chỉnh sửa', async () => {
    const parcelId = randomUUID();
    const unitId = randomUUID();
    const masterId = randomUUID();
    const unitReportId = randomUUID();
    await Database.query(
      `INSERT INTO parcels (id, project_parcel_code, building_type, zone_id, survey_status, is_locked)
       VALUES ($1, $2, 'CONDOMINIUM', 'ZONE_01', 'IN_PROGRESS', FALSE);`,
      [parcelId, `MTX_SEAL_${parcelId.slice(0, 8)}`]
    );
    await Database.query(
      `INSERT INTO building_units (id, parcel_id, unit_code, unit_type, floor_number, status)
       VALUES ($1, $2, 'P.101', 'UNIT', 1, 'SUBMITTED');`,
      [unitId, parcelId]
    );
    await Database.query(
      `INSERT INTO base_survey_reports (id, parcel_id, unit_id, report_code, report_type, phase, status, surveyor_id, current_step, survey_data_json)
       VALUES ($1, $2, NULL, $3, 'BUILDING_MASTER', 'PHASE_1', 'SUBMITTED', $6, 4, '{"zones": []}'),
              ($4, $2, $5, $7, 'CONDO_UNIT', 'PHASE_1', 'SUBMITTED', $6, 4, '{"zones": []}');`,
      [masterId, parcelId, `MTX-M-${masterId.slice(0, 8)}`, unitReportId, unitId, surveyorId, `MTX-U-${unitReportId.slice(0, 8)}`]
    );
    // Luồng duyệt đã có ca riêng; ở đây chỉ cần trạng thái đầu vào của niêm phong
    await Database.query(`UPDATE base_survey_reports SET status = 'APPROVED' WHERE id = ANY($1::uuid[]);`, [[masterId, unitReportId]]);
    await Database.query(`UPDATE building_units SET status = 'APPROVED' WHERE id = $1;`, [unitId]);

    const sealed = await AuditService.executeFinalSeal(parcelId, adminId, 'Khóa sổ ma trận');
    assert.ok(sealed.isLocked && sealed.sealHash, 'Không tạo được seal hash');
    await expectStatus(400, () => AuditService.executeFinalSeal(parcelId, adminId, 'Khóa lần hai'));
    await expectStatus(409, () => AuditService.applyAdminSurveyEdit(unitReportId, adminId, editPayload({ ownerName: 'Sau niêm phong' })));
  });

  const failed = outcomes.filter((outcome) => outcome.error);
  console.log(`\nKẾT QUẢ: ${outcomes.length - failed.length}/${outcomes.length} đạt`);
  failed.forEach((outcome) => console.error(`  - ${outcome.name}: ${outcome.error}`));
  process.exitCode = failed.length > 0 ? 1 : 0;
}

main()
  .catch((err) => {
    console.error('[AuditLifecycleMatrix:Main] Dừng do lỗi:', err);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
