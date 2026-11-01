/**
 * Kiểm thử E2E luồng vắng mặt Khảo sát ↔ Thẩm định. CHỈ chạy trên DB bản sao vì có ghi hồ sơ:
 *   DB_NAME=metro2_audit_test npx ts-node src/scripts/test_absence_audit_flow.ts
 */
import assert from 'assert';
import { Database } from '../database/db';
import { AuditReviewService } from '../modules/audit/services/audit-review.service';
import { CadastralRepository } from '../modules/cadastral/cadastral.repository';
import { ReportSnapshotService } from '../modules/report/snapshot/report-snapshot.service';
import { applyCondoReportContext } from '../modules/report/snapshot/condo-absent-projection';
import { isResidentialAbsentSurvey, resolveAbsenceEvidence } from '../modules/audit/absence-evidence';
import { AuditModificationService } from '../modules/audit/services/audit-modification.service';
import { CondoUnitAuditStrategy } from '../modules/audit/condo/strategies/condo-unit.strategy';
import { fetchCondoUnitAbsenceMap } from '../modules/audit/condo/condo-absence.resolver';
import type { CondoReportContextRow } from '../modules/audit/condo/condo-audit.types';
import { CryptoUtils } from '../common/utils/crypto.utils';

const NOTICE_PHOTO = 'https://example.com/giay-hen.jpg';

async function expectRejected(action: () => Promise<unknown>, pattern: RegExp): Promise<void> {
  await assert.rejects(action, (err: Error) => pattern.test(err.message));
}

async function createAbsentParcel(suffix: string, adminId: string, photos: string[]) {
  const code = `TEST-ABS-${suffix}-${Date.now()}`;
  const parcelRes = await Database.query<{ id: string }>(
    `INSERT INTO parcels (zone_id, project_parcel_code, house_number, street, survey_status, location_geom)
     VALUES ('ZONE_01', $1, '1', 'Đường Thử', 'NOT_SURVEYED', ST_SetSRID(ST_Point(106.66, 10.76), 4326))
     RETURNING id;`,
    [code]
  );
  const parcelId = parcelRes.rows[0].id;
  await CadastralRepository.recordAbsence({
    parcelId,
    surveyorId: adminId,
    absenceReason: 'REFUSED_ACCESS',
    notes: 'Từ chối phối hợp khảo sát',
    minutesPhotos: photos,
    surveyData: {
      surveyCaseType: 'ABSENTEE',
      isAbsenteeSurvey: true,
      absenteeReason: 'Từ chối phối hợp khảo sát',
      absenteeMinutesPhotos: photos,
      photoP01: { url: 'https://example.com/p01.jpg' },
      ecs: { totalEcs: 0, ecsClass: 'GOOD' },
      vi: { viAvg: 1.5, viClass: 'LOW' },
      floors: [{ id: 'fl-1', floorName: 'Tầng trệt' }],
      settlementTilt: {
        diffSettlement: { level: 2, notes: 'Lún chênh thấy từ vỉa hè' },
        buildingTilt: { level: 0, notes: '' },
        beamSagging: { level: 0 },
      },
    },
  });
  const reportRes = await Database.query<{ id: string; status: string; submitted_at: Date | null }>(
    `SELECT id, status::text AS status, submitted_at FROM base_survey_reports WHERE parcel_id = $1 AND unit_id IS NULL;`,
    [parcelId]
  );
  // Bước cuối của đồng bộ bảng quan hệ: thiếu hàng này là luồng nộp vắng đã dừng giữa chừng
  const scopeRes = await Database.query(`SELECT 1 FROM survey_scopes WHERE report_id = $1;`, [reportRes.rows[0].id]);
  assert.strictEqual(scopeRes.rows.length, 1, 'Nộp vắng phải đồng bộ đủ bảng quan hệ');
  return { parcelId, report: reportRes.rows[0] };
}

async function main(): Promise<void> {
  const dbName = (await Database.query<{ name: string }>(`SELECT current_database() AS name;`)).rows[0].name;
  assert.strictEqual(dbName, 'metro2_audit_test', 'Chỉ được chạy trên DB bản sao');
  const adminId = (await Database.query<{ id: string }>(`SELECT id FROM users LIMIT 1;`)).rows[0].id;

  // Bằng chứng giấy hẹn không được lấy từ P-01
  assert.deepStrictEqual(resolveAbsenceEvidence({ photoP01: { url: 'x' } }, []).missing, [
    'Ảnh dán giấy hẹn / biên bản vắng nhà',
    'Người chứng kiến',
  ]);
  assert.strictEqual(
    resolveAbsenceEvidence({ signatures: { localAuthority: { fullName: 'Tổ trưởng A' } } }, [
      { photo_proof_url: NOTICE_PHOTO, minutes_photos_json: JSON.stringify([NOTICE_PHOTO]) },
    ]).missing.length,
    0,
    'Đại diện địa phương là người chứng kiến của nhà dân'
  );

  // Nộp vắng đưa hồ sơ vào hàng đợi
  const { parcelId, report } = await createAbsentParcel('A', adminId, [NOTICE_PHOTO]);
  assert.strictEqual(report.status, 'SUBMITTED');
  assert.ok(report.submitted_at);
  const queue = await AuditReviewService.listPendingSubmissions({ parcelId, filterLevel: 'RESIDENTIAL' });
  assert.strictEqual(queue.items.length, 1, 'Hồ sơ vắng phải hiện trong hàng đợi');

  // Payload thẩm định khớp cột thật của nhật ký vắng
  const view = (await AuditReviewService.getSplitPaneAuditView(report.id)) as Record<string, any>;
  assert.strictEqual(view.isResidentialAbsent, true);
  assert.strictEqual(view.leftPane.absenceLogs[0].photoUrl, NOTICE_PHOTO);
  assert.ok(view.leftPane.absenceLogs[0].attemptDate);
  assert.ok(!view.auditWarningFlags.some((f: { code: string }) => f.code === 'ABSENT_WITHOUT_INVITATION_PHOTO'));

  // Báo cáo không có điểm, không có tầng, nhưng giữ quan sát lún ngoài nhà
  const projected: Record<string, any> = await applyCondoReportContext<Record<string, any>>({
    id: report.id,
    unit_id: null,
    parcel_id: parcelId,
    status: 'SUBMITTED',
    survey_data_json: view.surveyJson,
  });
  assert.strictEqual(projected.condoUnitAbsent, true);
  assert.strictEqual(projected.residentialAbsent, true);
  assert.strictEqual(projected.survey_data_json.ecs, undefined);
  assert.strictEqual(projected.survey_data_json.vi, undefined);
  assert.strictEqual(projected.survey_data_json.floors, undefined);
  assert.strictEqual(projected.survey_data_json.settlementTilt.diffSettlement.level, 2);
  assert.strictEqual(projected.survey_data_json.settlementTilt.beamSagging, undefined);

  // Thiếu người chứng kiến thì phải có lý do giải trình
  await expectRejected(() => AuditReviewService.approveAbsenteeReport(report.id, adminId), /Người chứng kiến/);
  const approved = await AuditReviewService.approveAbsenteeReport(report.id, adminId, 'Đã gọi xác minh với tổ trưởng');
  assert.strictEqual(approved.status, 'APPROVED');
  const parcelStatus = await Database.query<{ survey_status: string }>(`SELECT survey_status FROM parcels WHERE id = $1;`, [parcelId]);
  assert.strictEqual(parcelStatus.rows[0].survey_status, 'POSTPONED_ABSENT_VERIFIED');

  // Bản đóng băng có SHA-256 và không mang điểm giả, dữ liệu gốc vẫn còn nguyên
  const snapshot = await ReportSnapshotService.getLatestApprovedSnapshot(report.id);
  assert.ok(snapshot, 'Phải có snapshot APPROVED_RELEASE');
  assert.strictEqual(snapshot.snapshot.ecs.ecsClass, null);
  assert.match(JSON.stringify(snapshot.snapshot), /[0-9a-f]{64}/, 'Snapshot phải có mã băm SHA-256');
  const originalJson = await Database.query<{ ecs_class: string }>(
    `SELECT survey_data_json#>>'{ecs,ecsClass}' AS ecs_class FROM base_survey_reports WHERE id = $1;`,
    [report.id]
  );
  assert.strictEqual(originalJson.rows[0].ecs_class, 'GOOD', 'Không được sửa bản gốc');

  // Hồ sơ đã xác nhận không mở lại trực tiếp được
  await expectRejected(
    () => AuditReviewService.revertReportToDraft(report.id, adminId, 'Chủ hộ đã liên hệ lại', null, 'ZONE_ADMIN', true),
    /APPROVED/
  );

  // Mở lại trước khi xác nhận: gỡ cờ vắng, giữ ảnh và nhật ký
  const second = await createAbsentParcel('B', adminId, []);
  await expectRejected(
    () => AuditReviewService.approveAbsenteeReport(second.report.id, adminId, 'ngắn'),
    /thiếu/
  );
  await expectRejected(
    () => AuditReviewService.revertReportToDraft(second.report.id, adminId, 'ngắn', null, 'ZONE_ADMIN', true),
    /tối thiểu/
  );
  await AuditReviewService.revertReportToDraft(second.report.id, adminId, 'Chủ hộ đã liên hệ lại', null, 'ZONE_ADMIN', true);
  const reopened = await Database.query<{ status: string; absent: boolean; json: Record<string, any> }>(
    `SELECT status::text AS status, is_refused_or_absent AS absent, survey_data_json AS json FROM base_survey_reports WHERE id = $1;`,
    [second.report.id]
  );
  assert.strictEqual(reopened.rows[0].status, 'DRAFT');
  assert.strictEqual(reopened.rows[0].absent, false);
  assert.strictEqual(reopened.rows[0].json.surveyCaseType, 'NORMAL');
  assert.strictEqual(reopened.rows[0].json.absenceDecision.decision, 'NOT_ABSENT');
  assert.strictEqual(reopened.rows[0].json.photoP01.url, 'https://example.com/p01.jpg');

  // Admin đổi loại hình nhà dân
  const editorPassword = 'Absence@Test1';
  const editorRes = await Database.query<{ id: string }>(
    `INSERT INTO users (username, email, password_hash, full_name, role)
     VALUES ($1, $2, $3, 'Thẩm Định Viên Thử', 'ZONE_ADMIN') RETURNING id;`,
    [`absence_editor_${Date.now()}`, `absence_editor_${Date.now()}@test.local`, await CryptoUtils.hashPassword(editorPassword)]
  );
  const editorId = editorRes.rows[0].id;
  const edit = (reportId: string, updates: Record<string, unknown>) =>
    AuditModificationService.applyAdminSurveyEdit(reportId, editorId, {
      adminPassword: editorPassword,
      editReason: 'Kiểm thử đổi loại hình',
      diffPayload: [],
      updates,
    });
  const readJson = async (reportId: string) =>
    (await Database.query<{ json: Record<string, any> }>(
      `SELECT survey_data_json AS json FROM base_survey_reports WHERE id = $1;`,
      [reportId]
    )).rows[0].json;
  const validReason = { reason: 'Đối chiếu ảnh hiện trường và tổ trưởng' };

  // Hồ sơ KSV nộp nhánh vắng chỉ quay lại qua Mở Lại
  const locked = await createAbsentParcel('C', adminId, [NOTICE_PHOTO]);
  await expectRejected(() => edit(locked.report.id, { surveyCaseType: 'NORMAL', absenceDecision: validReason }), /Mở Lại/);

  // Hồ sơ thường: đổi sang vắng rồi đổi lại
  const normalParcel = await Database.query<{ id: string }>(
    `INSERT INTO parcels (zone_id, project_parcel_code, house_number, street, survey_status, location_geom)
     VALUES ('ZONE_01', $1, '2', 'Đường Thử', 'NOT_SURVEYED', ST_SetSRID(ST_Point(106.66, 10.76), 4326)) RETURNING id;`,
    [`TEST-ABS-N-${Date.now()}`]
  );
  const normalReport = await Database.query<{ id: string }>(
    `INSERT INTO base_survey_reports (parcel_id, surveyor_id, status, report_code, survey_data_json)
     VALUES ($1, $2, 'SUBMITTED', $3, $4) RETURNING id;`,
    [
      normalParcel.rows[0].id,
      adminId,
      `REP-ABS-N-${Date.now().toString().slice(-6)}`,
      JSON.stringify({
        surveyCaseType: 'NORMAL',
        settlementTilt: { diffSettlement: { level: 1 }, beamSagging: { level: 2 } },
      }),
    ]
  );
  const normalId = normalReport.rows[0].id;
  await expectRejected(() => edit(normalId, { surveyCaseType: 'ABSENTEE' }), /lý do/);
  await expectRejected(() => edit(normalId, { surveyCaseType: 'ABSENTEE', absenceDecision: { reason: 'ngắn' } }), /lý do/);
  await edit(normalId, { surveyCaseType: 'ABSENTEE', absenceDecision: { ...validReason, decidedBy: 'gia-mao' } });
  const flipped = await readJson(normalId);
  assert.strictEqual(flipped.isAbsenteeSurvey, true);
  assert.strictEqual(flipped.absenceDecision.decision, 'ABSENT');
  assert.strictEqual(flipped.absenceDecision.decidedBy, editorId, 'Người quyết định do backend ghi');

  await expectRejected(() => edit(normalId, { floors: [] }), /không có dữ liệu/);
  await edit(normalId, { settlementTilt: { diffSettlement: { level: 3 }, beamSagging: { level: 5 } } });
  const tilted = await readJson(normalId);
  assert.strictEqual(tilted.settlementTilt.diffSettlement.level, 3);
  assert.strictEqual(tilted.settlementTilt.beamSagging.level, 2, 'Không sửa được võng dầm của nhà vắng');

  await edit(normalId, { surveyCaseType: 'NORMAL', absenceDecision: validReason });
  const restored = await readJson(normalId);
  assert.strictEqual(restored.isAbsenteeSurvey, false);
  assert.strictEqual(isResidentialAbsentSurvey(restored), false, 'Đổi lại phải thoát hẳn nhánh vắng');
  assert.strictEqual(restored.absenceDecision.decision, 'NOT_ABSENT');

  // Căn hộ: kiểm tra khóa nội thất theo kết luận sau khi áp dụng lượt sửa (chỉ đọc)
  const unitReports = await Database.query<{ id: string }>(
    `SELECT id FROM base_survey_reports WHERE unit_id IS NOT NULL AND deleted_at IS NULL LIMIT 500;`
  );
  const unitAbsence = await fetchCondoUnitAbsenceMap(unitReports.rows.map((row) => row.id));
  const normalUnitId = Array.from(unitAbsence.entries()).find(
    ([, value]) => value.state === 'NORMAL' && !value.hasRoomDefect
  )?.[0];
  assert.ok(normalUnitId, 'Cần 1 căn thường trong DB bản sao');
  const strategy = new CondoUnitAuditStrategy();
  const unitContext = { report_id: normalUnitId } as CondoReportContextRow;
  const absentDecision = { decision: 'ABSENT', reason: validReason.reason, decidedAt: '' };
  await strategy.validateBeforeModify(unitContext, { doorJammingStatus: 'JAMMED' }, []);
  await expectRejected(
    () => strategy.validateBeforeModify(unitContext, { absenceDecision: { decision: 'ABSENT', reason: 'ngắn' } }, []),
    /lý do/
  );
  await strategy.validateBeforeModify(unitContext, { absenceDecision: absentDecision, displayCode: 'P.101' }, []);
  await expectRejected(
    () => strategy.validateBeforeModify(unitContext, { absenceDecision: absentDecision, doorJammingStatus: 'JAMMED' }, []),
    /doorJammingStatus/
  );
  await expectRejected(
    () => strategy.validateBeforeModify(unitContext, { residentStatus: 'VẮNG_MẶT_KHÓA_CỬA', damageZones: [] }, []),
    /damageZones/
  );

  // Căn có khuyết tật trong phòng: đổi sang vắng phải kèm quyết định, nếu không tải lại vẫn hiện đủ form
  const roomDefectUnitId = Array.from(unitAbsence.entries()).find(
    ([, value]) => value.state === 'NORMAL' && value.hasRoomDefect && !value.decision
  )?.[0];
  assert.ok(roomDefectUnitId, 'Cần 1 căn thường có khuyết tật trong phòng trong DB bản sao');
  const roomDefectContext = { report_id: roomDefectUnitId } as CondoReportContextRow;
  await expectRejected(
    () => strategy.validateBeforeModify(roomDefectContext, { residentStatus: 'VẮNG_MẶT_KHÓA_CỬA' }, []),
    /xác nhận Vắng Chủ/
  );
  await strategy.validateBeforeModify(
    roomDefectContext,
    { residentStatus: 'VẮNG_MẶT_KHÓA_CỬA', absenceDecision: absentDecision },
    []
  );
  await strategy.validateBeforeModify(
    roomDefectContext,
    { residentStatus: 'VẮNG_MẶT_KHÓA_CỬA', absenceDecision: { ...absentDecision, decision: 'NOT_ABSENT' } },
    []
  );

  console.log('✅ test_absence_audit_flow: toàn bộ kịch bản đạt');
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('[test_absence_audit_flow] Thất bại:', err);
    process.exit(1);
  });
