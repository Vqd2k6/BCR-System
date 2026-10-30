import { pool, Database } from '../database/db';
import { CadastralService } from '../modules/cadastral/cadastral.service';
import { CadastralIngestionService } from '../modules/cadastral/services/cadastral-ingestion.service';
import { SurveyService } from '../modules/survey/survey.service';
import { AuditReviewService } from '../modules/audit/services/audit-review.service';

/**
 * Kiểm thử Soft Exclusion thửa đất trên dữ liệu có sẵn, không tạo và không xóa dữ liệu nghiệp vụ.
 * Mượn 1 thửa ACTIVE/NOT_SURVEYED, loại trừ rồi luôn khôi phục lại ở khối finally.
 * Phần còn lại trong DB sau khi chạy: các dòng PARCEL_EXCLUDED/PARCEL_RESTORED của system_audit_logs.
 */
const results: { name: string; passed: boolean; detail?: string }[] = [];

const check = (name: string, passed: boolean, detail?: string) => {
  results.push({ name, passed, detail });
  console.log(`${passed ? '✅' : '❌'} ${name}${detail ? ` -> ${detail}` : ''}`);
};

const expectRejected = async (name: string, fn: () => Promise<unknown>, pattern: RegExp) => {
  try {
    await fn();
    check(name, false, 'Không bị từ chối');
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    check(name, pattern.test(message), message.slice(0, 110));
  }
};

const firstId = async (sql: string): Promise<string | null> => {
  const res = await Database.query<{ id: string }>(sql);
  return res.rows[0]?.id || null;
};

const superAdmin = async () => {
  const res = await Database.query<{ id: string }>(
    `SELECT id FROM users WHERE role = 'SUPER_ADMIN' AND deleted_at IS NULL LIMIT 1;`
  );
  return { userId: res.rows[0].id, role: 'SUPER_ADMIN', assignedZoneId: 'ALL' };
};

const lifecycleOf = async (parcelId: string): Promise<string> => {
  const res = await Database.query<{ lifecycle_status: string }>(
    `SELECT lifecycle_status FROM parcels WHERE id = $1;`,
    [parcelId]
  );
  return res.rows[0].lifecycle_status;
};

const auditCount = async (parcelId: string): Promise<number> => {
  const res = await Database.query<{ count: string }>(
    `SELECT COUNT(*) AS count FROM system_audit_logs
     WHERE entity_id = $1 AND action IN ('PARCEL_EXCLUDED', 'PARCEL_RESTORED');`,
    [parcelId]
  );
  return Number(res.rows[0].count);
};

async function run() {
  const admin = await superAdmin();
  const target = await Database.query<{ id: string; zone_id: string }>(
    `SELECT p.id, p.zone_id FROM parcels p
     WHERE p.lifecycle_status = 'ACTIVE' AND p.survey_status = 'NOT_SURVEYED' AND p.is_locked = FALSE
       AND p.zone_id LIKE 'ZONE\\_%'
       AND NOT EXISTS (SELECT 1 FROM base_survey_reports r WHERE r.parcel_id = p.id)
       AND NOT EXISTS (SELECT 1 FROM building_units u WHERE u.parcel_id = p.id)
     LIMIT 1;`
  );
  const { id: parcelId, zone_id: zoneId } = target.rows[0];
  const otherZone = zoneId === 'ZONE_21' ? 'ZONE_19' : 'ZONE_21';
  const zoneAdmin = { userId: admin.userId, role: 'ZONE_ADMIN', assignedZoneId: otherZone };
  const surveyor = { userId: admin.userId, role: 'SURVEYOR', assignedZoneId: zoneId };
  const exclude = { action: 'EXCLUDE' as const, exclusionType: 'ROAD_TRAFFIC' as const, reason: 'Test tự động: đất vỉa hè' };
  const restore = { action: 'RESTORE' as const, reason: 'Test tự động: khôi phục' };

  await expectRejected('Zone Admin khác Zone bị từ chối (IDOR)', () =>
    CadastralService.updateParcelLifecycle(parcelId, exclude, zoneAdmin), /IDOR/);
  await expectRejected('Surveyor bị từ chối', () =>
    CadastralService.updateParcelLifecycle(parcelId, exclude, surveyor), /Zone Admin/);
  await expectRejected('RESTORE thửa ACTIVE bị từ chối', () =>
    CadastralService.updateParcelLifecycle(parcelId, restore, admin), /chỉ thửa đã loại trừ/);

  for (const status of ['SUBMITTED', 'APPROVED']) {
    const id = await firstId(`SELECT id FROM parcels WHERE survey_status = '${status}' AND lifecycle_status = 'ACTIVE' LIMIT 1;`);
    if (id) {
      await expectRejected(`Không ẩn được thửa ${status}`, () =>
        CadastralService.updateParcelLifecycle(id, exclude, admin), /không thể loại trừ/);
    } else {
      check(`Không ẩn được thửa ${status}`, true, 'BỎ QUA: không có dữ liệu');
    }
  }

  const merged = await firstId(`SELECT id FROM parcels WHERE lifecycle_status = 'MERGED_DEPRECATED' LIMIT 1;`);
  if (merged) {
    await expectRejected('Không RESTORE được thửa MERGED_DEPRECATED', () =>
      CadastralService.updateParcelLifecycle(merged, restore, admin), /chỉ thửa đã loại trừ/);
    await expectRejected('Không EXCLUDE được thửa MERGED_DEPRECATED', () =>
      CadastralService.updateParcelLifecycle(merged, exclude, admin), /chỉ thửa ACTIVE/);
  }

  const logsBeforeRollback = await auditCount(parcelId);
  await expectRejected('Ghi log lỗi thì rollback (client_ip quá dài)', () =>
    CadastralService.updateParcelLifecycle(parcelId, exclude, admin, 'x'.repeat(100)), /too long/);
  check('Sau rollback thửa vẫn ACTIVE', (await lifecycleOf(parcelId)) === 'ACTIVE');
  check('Sau rollback không có dòng log mới', (await auditCount(parcelId)) === logsBeforeRollback);

  const before = (await AuditReviewService.getProgressAnalytics(zoneId)) as { total_parcels: number };
  const logsBefore = await auditCount(parcelId);

  try {
    await CadastralService.updateParcelLifecycle(parcelId, exclude, admin);
    check('Ẩn thành công', (await lifecycleOf(parcelId)) === 'EXCLUDED_NON_BUILDING');
    check('Đúng 1 dòng audit khi ẩn', (await auditCount(parcelId)) === logsBefore + 1);

    const after = (await AuditReviewService.getProgressAnalytics(zoneId)) as { total_parcels: number };
    check('total_parcels giảm đúng 1', after.total_parcels === before.total_parcels - 1,
      `${before.total_parcels} -> ${after.total_parcels}`);

    const map = await CadastralService.listParcelsInZone(zoneId);
    check('Thửa biến mất khỏi zone-map', !map.some((p) => p.id === parcelId));

    const excluded = await CadastralService.listExcludedParcels(zoneId, admin);
    check('Thửa có trong /parcels/excluded', excluded.some((p) => p.id === parcelId && p.exclusion_reason === exclude.reason));
    await expectRejected('Zone Admin khác Zone không xem được danh sách', () =>
      CadastralService.listExcludedParcels(zoneId, zoneAdmin), /không có quyền/);

    await expectRejected('Ẩn lần 2 bị từ chối', () =>
      CadastralService.updateParcelLifecycle(parcelId, exclude, admin), /chỉ thửa ACTIVE/);
    await expectRejected('Start survey bị chặn', () =>
      CadastralService.startAdHocSurvey(parcelId, admin.userId), /đã bị loại trừ/);
    await expectRejected('Resume survey bị chặn', () =>
      CadastralService.resumeSurveyAfterAbsence(parcelId, admin.userId), /đã bị loại trừ/);
    await expectRejected('Record absence bị chặn', () =>
      CadastralService.recordAbsence(parcelId, admin.userId, { absenceReason: 'TEST' }), /đã bị loại trừ/);
    await expectRejected('Tạo report Phase 1 bị chặn', () =>
      SurveyService.createPhase1Report(parcelId, admin.userId), /đã bị loại trừ/);
    await expectRejected('Execute mutation bị chặn', () =>
      CadastralService.executeAdminMutation(admin.userId, { mutationType: 'MERGE', sourceParcelIds: [parcelId] }), /đã bị loại trừ/);

    const assign = await CadastralService.assignSurveyor([parcelId], admin.userId);
    check('Assign bỏ qua thửa đã ẩn', assign.updatedCount === 0);

    await expectRejected('Clean Re-import bị chặn', () =>
      CadastralIngestionService.executeImportZone(zoneId, [], admin.userId, true), /KHÓA CHẶN AN TOÀN/);
  } finally {
    await CadastralService.updateParcelLifecycle(parcelId, restore, admin);
  }

  check('Khôi phục về ACTIVE', (await lifecycleOf(parcelId)) === 'ACTIVE');
  check('Đúng 1 dòng audit khi khôi phục', (await auditCount(parcelId)) === logsBefore + 2);
  const restored = await Database.query<{ exclusion_reason: string | null; excluded_at: Date | null }>(
    `SELECT exclusion_reason, excluded_at FROM parcels WHERE id = $1;`,
    [parcelId]
  );
  check('Đã xóa thông tin loại trừ', restored.rows[0].exclusion_reason === null && restored.rows[0].excluded_at === null);
  const final = (await AuditReviewService.getProgressAnalytics(zoneId)) as { total_parcels: number };
  check('total_parcels trở lại ban đầu', final.total_parcels === before.total_parcels);
}

run()
  .catch((err: unknown) => {
    console.error('[test_parcel_exclusion_flow] Lỗi không mong đợi:', err);
    results.push({ name: 'Script', passed: false });
  })
  .finally(async () => {
    const failed = results.filter((r) => !r.passed).length;
    console.log(`\nKết quả: ${results.length - failed}/${results.length} đạt`);
    await pool.end();
    process.exit(failed > 0 ? 1 : 0);
  });
