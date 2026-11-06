import { pool, Database } from '../database/db';
import { CadastralBatchService, buildAddressSuggestion } from '../modules/cadastral/cadastral-batch.service';

/**
 * Kiểm thử tác vụ hàng loạt trên bản đồ GIS (CQĐP, địa chỉ, ẩn/khôi phục).
 * CHẠY TRÊN DB TEST: DB_NAME=metro2_audit_test npx ts-node src/scripts/test_parcel_batch_ops.ts
 * Mượn thửa có sẵn, ghi lại giá trị gốc và luôn trả về ở khối finally. Phần còn lại trong DB:
 * các dòng system_audit_logs của lô test. survey_data_json không bao giờ bị đụng (có kiểm tra hash).
 */

if (process.env.DB_NAME !== 'metro2_audit_test') {
  console.error('[BatchOpsTest] Từ chối chạy: phải đặt DB_NAME=metro2_audit_test');
  process.exit(1);
}

const results: { name: string; passed: boolean }[] = [];
const check = (name: string, passed: boolean, detail?: unknown) => {
  results.push({ name, passed });
  console.log(`${passed ? '✅' : '❌'} ${name}${detail !== undefined ? ` -> ${JSON.stringify(detail).slice(0, 220)}` : ''}`);
};
const expectRejected = async (name: string, fn: () => Promise<unknown>, pattern: RegExp) => {
  try {
    await fn();
    check(name, false, 'Không bị từ chối');
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    check(name, pattern.test(message), message.slice(0, 140));
  }
};

const ids = async (sql: string, params: unknown[] = []): Promise<string[]> =>
  (await Database.query<{ id: string }>(sql, params)).rows.map((r) => r.id);

interface ParcelSnapshot {
  id: string;
  house_number: string | null;
  street: string | null;
  ward: string | null;
  district: string | null;
  local_authority_name: string | null;
  local_authority_role: string | null;
  local_authority_phone: string | null;
  lifecycle_status: string;
  survey_status: string;
  exclusion_type: string | null;
  exclusion_reason: string | null;
  excluded_at: Date | null;
  excluded_by_id: string | null;
}

const snapshot = async (parcelIds: string[]): Promise<ParcelSnapshot[]> =>
  (
    await Database.query<ParcelSnapshot>(
      `SELECT id, house_number, street, ward, district, local_authority_name, local_authority_role, local_authority_phone,
              lifecycle_status::text AS lifecycle_status, survey_status::text AS survey_status,
              exclusion_type, exclusion_reason, excluded_at, excluded_by_id
       FROM parcels WHERE id = ANY($1::uuid[]);`,
      [parcelIds]
    )
  ).rows;

const restoreSnapshot = async (rows: ParcelSnapshot[]) => {
  for (const r of rows) {
    await Database.query(
      `UPDATE parcels SET house_number = $2, street = $3, ward = $4, district = $5,
              local_authority_name = $6, local_authority_role = $7, local_authority_phone = $8,
              lifecycle_status = $9::parcel_lifecycle_enum, exclusion_type = $10, exclusion_reason = $11,
              excluded_at = $12, excluded_by_id = $13, survey_status = $14::parcel_survey_status_enum
       WHERE id = $1;`,
      [
        r.id, r.house_number, r.street, r.ward, r.district,
        r.local_authority_name, r.local_authority_role, r.local_authority_phone,
        r.lifecycle_status, r.exclusion_type, r.exclusion_reason, r.excluded_at, r.excluded_by_id, r.survey_status,
      ]
    );
  }
};

const jsonHash = async (parcelIds: string[]): Promise<string> =>
  (
    await Database.query<{ h: string | null }>(
      `SELECT md5(string_agg(md5(survey_data_json::text), ',' ORDER BY id)) AS h
       FROM base_survey_reports WHERE parcel_id = ANY($1::uuid[]);`,
      [parcelIds]
    )
  ).rows[0].h ?? 'none';

async function run() {
  const adminRes = await Database.query<{ id: string }>(
    `SELECT id FROM users WHERE role = 'SUPER_ADMIN' AND deleted_at IS NULL LIMIT 1;`
  );
  const superAdmin = { userId: adminRes.rows[0].id, role: 'SUPER_ADMIN', assignedZoneId: 'ALL' };
  const zone4Admin = { userId: superAdmin.userId, role: 'ZONE_ADMIN', assignedZoneId: 'ZONE_04' };
  const surveyor = { userId: superAdmin.userId, role: 'SURVEYOR', assignedZoneId: 'ZONE_07' };

  // --- Chọn dữ liệu mượn ---
  const freeZone7 = await ids(
    `SELECT p.id FROM parcels p
     WHERE p.zone_id = 'ZONE_07' AND p.lifecycle_status = 'ACTIVE' AND p.survey_status = 'NOT_SURVEYED' AND p.is_locked = FALSE
       AND NOT EXISTS (SELECT 1 FROM base_survey_reports r WHERE r.parcel_id = p.id)
       AND NOT EXISTS (SELECT 1 FROM building_units u WHERE u.parcel_id = p.id)
     ORDER BY p.project_parcel_code LIMIT 3;`
  );
  const submittedZone7 = await ids(
    `SELECT p.id FROM parcels p JOIN base_survey_reports r ON r.parcel_id = p.id AND r.deleted_at IS NULL
     WHERE p.zone_id = 'ZONE_07' AND p.lifecycle_status = 'ACTIVE' AND r.status = 'SUBMITTED' LIMIT 1;`
  );
  // Thửa Zone 7 có hồ sơ KSV ghi CMT8; ô đường của thửa sẽ được đặt tạm thành tên phường (trả lại ở finally)
  const surveyedCmt8Contaminated = await ids(
    `SELECT p.id FROM parcels p JOIN base_survey_reports r ON r.parcel_id = p.id AND r.deleted_at IS NULL AND r.unit_id IS NULL
     WHERE p.zone_id = 'ZONE_07' AND p.lifecycle_status = 'ACTIVE'
       AND r.survey_data_json->>'street' ~* 'cmt|cách mạng'
       AND r.status <> 'APPROVED' LIMIT 1;`
  );
  // Thửa Zone 9 sẽ được đặt tạm survey_status = APPROVED (chỉ cột parcels, không đụng hồ sơ; trả lại ở finally)
  const approvedZone9 = await ids(
    `SELECT p.id FROM parcels p WHERE p.zone_id = 'ZONE_09' AND p.lifecycle_status = 'ACTIVE' AND p.is_locked = FALSE
     ORDER BY p.project_parcel_code LIMIT 1;`
  );
  const zone4 = await ids(`SELECT id FROM parcels WHERE zone_id = 'ZONE_04' AND lifecycle_status = 'ACTIVE' LIMIT 1;`);

  const all = Array.from(new Set([...freeZone7, ...submittedZone7, ...surveyedCmt8Contaminated, ...approvedZone9, ...zone4]));
  check('Có đủ dữ liệu mượn', freeZone7.length === 3 && submittedZone7.length === 1 && surveyedCmt8Contaminated.length === 1 && approvedZone9.length === 1 && zone4.length === 1, {
    freeZone7: freeZone7.length, submittedZone7: submittedZone7.length, surveyedCmt8Contaminated: surveyedCmt8Contaminated.length, approvedZone9: approvedZone9.length, zone4: zone4.length,
  });
  if (results.some((r) => !r.passed)) return;

  const original = await snapshot(all);
  const hashBeforeOthers = await jsonHash(all.filter((id) => id !== surveyedCmt8Contaminated[0]));
  const reportBackups: Array<{ id: string; json: string; updatedAt: string }> = [];
  let lockBackup: { reportId: string; previous: { locked_by_user_id: string; expires_at: string } | null } | null = null;

  try {
    await Database.query(`UPDATE parcels SET street = 'Phường 13' WHERE id = $1;`, [surveyedCmt8Contaminated[0]]);
    await Database.query(`UPDATE parcels SET survey_status = 'APPROVED' WHERE id = $1;`, [approvedZone9[0]]);

    // 1. Phân quyền
    await expectRejected('Zone Admin ZONE_04 gửi thửa ZONE_07 -> 403 cả lô', () =>
      CadastralBatchService.setLocalAuthority({ parcelIds: [zone4[0], freeZone7[0]], name: 'Test CQĐP', role: null, phone: null }, zone4Admin, null),
      /không thuộc phân khu/);
    const afterIdor = await snapshot([zone4[0]]);
    check('IDOR: thửa ZONE_04 trong lô không bị đổi', afterIdor[0].local_authority_name === original.find((o) => o.id === zone4[0])?.local_authority_name);
    await expectRejected('Khảo sát viên bị từ chối', () =>
      CadastralBatchService.exclude({ parcelIds: freeZone7, exclusionType: 'ROAD_TRAFFIC', reason: 'Test' }, surveyor, null),
      /Zone Admin hoặc Super Admin/);
    await expectRejected('ID không tồn tại -> 404', () =>
      CadastralBatchService.setLocalAuthority({ parcelIds: ['00000000-0000-0000-0000-000000000000'], name: 'Test', role: null, phone: null }, superAdmin, null),
      /Không tìm thấy/);

    // 2. Ẩn hàng loạt: thửa hợp lệ được ẩn, thửa đã nộp bị bỏ qua
    const excludeIds = [...freeZone7, submittedZone7[0]];
    const ex = await CadastralBatchService.exclude({ parcelIds: excludeIds, exclusionType: 'CLICK_MISTAKE', reason: 'Test tự động: click nhầm' }, superAdmin, '127.0.0.1');
    check('Ẩn hàng loạt: 3 thửa ẩn, 1 thửa đã nộp bỏ qua', ex.updated.length === 3 && ex.skipped.length === 1 && /đã có hồ sơ|đã nộp/.test(ex.skipped[0].reason), ex.skipped);
    const exRows = await snapshot(freeZone7);
    check('CLICK_MISTAKE -> EXCLUDED_TRAINING_DEMO (theo EXCLUSION_TYPE_TO_LIFECYCLE)', exRows.every((r) => r.lifecycle_status === 'EXCLUDED_TRAINING_DEMO'));
    const exLogs = await Database.query<{ c: string }>(
      `SELECT COUNT(*) AS c FROM system_audit_logs WHERE action = 'PARCEL_EXCLUDED' AND diff_payload->>'batchId' = $1;`, [ex.batchId]);
    check('Ẩn hàng loạt: 3 dòng log có batchId', Number(exLogs.rows[0].c) === 3);

    // 3. Khôi phục hàng loạt: giữ lý do loại trừ cũ trong log; thửa ACTIVE bị bỏ qua
    const rs = await CadastralBatchService.restore({ parcelIds: [...freeZone7, submittedZone7[0]], reason: 'Test tự động: khôi phục' }, superAdmin, null);
    check('Khôi phục: 3 thửa, thửa ACTIVE bỏ qua', rs.updated.length === 3 && rs.skipped.length === 1, rs.skipped);
    const rsRows = await snapshot(freeZone7);
    check('Khôi phục: exclusion_* về NULL', rsRows.every((r) => r.lifecycle_status === 'ACTIVE' && !r.exclusion_type && !r.exclusion_reason && !r.excluded_at && !r.excluded_by_id));
    const rsLog = await Database.query<{ prev: string | null }>(
      `SELECT diff_payload->>'previousExclusionReason' AS prev FROM system_audit_logs WHERE action = 'PARCEL_RESTORED' AND diff_payload->>'batchId' = $1 LIMIT 1;`, [rs.batchId]);
    check('Khôi phục: log giữ lý do loại trừ cũ', rsLog.rows[0]?.prev === 'Test tự động: click nhầm', rsLog.rows[0]);

    // 4. CQĐP: gán, ghi đè có log before/after, thửa APPROVED bị bỏ qua
    const la = await CadastralBatchService.setLocalAuthority(
      { parcelIds: [...freeZone7, approvedZone9[0]], name: 'Nguyễn Văn Test', role: 'Tổ trưởng TDP', phone: '0900000000' }, superAdmin, null);
    check('CQĐP: 3 thửa cập nhật, thửa APPROVED bỏ qua', la.updated.length === 3 && la.skipped.length === 1 && /đã duyệt/.test(la.skipped[0].reason), la.skipped);
    const la2 = await CadastralBatchService.setLocalAuthority({ parcelIds: freeZone7, name: 'Trần Thị Test', role: null, phone: null }, superAdmin, null);
    const laLog = await Database.query<{ before: string | null }>(
      `SELECT diff_payload->'before'->>'name' AS before FROM system_audit_logs WHERE action = 'PARCEL_LOCAL_AUTHORITY_SET' AND diff_payload->>'batchId' = $1 LIMIT 1;`, [la2.batchId]);
    check('CQĐP ghi đè: log lưu giá trị cũ', la2.updated.length === 3 && laLog.rows[0]?.before === 'Nguyễn Văn Test');

    // 5. Xem trước địa chỉ
    const preview = await CadastralBatchService.previewAddress([...freeZone7, ...surveyedCmt8Contaminated, approvedZone9[0]], superAdmin);
    const surveyedRow = preview.find((r) => r.parcelId === surveyedCmt8Contaminated[0]);
    check('Preview: ô đường nhiễm + KSV ghi CMT8 -> lấy CMT8 từ KSV', surveyedRow?.suggested.street === 'Cách Mạng Tháng Tám' && surveyedRow?.sourceByField.street === 'SURVEYOR', surveyedRow?.suggested);
    const freeRow = preview.find((r) => r.parcelId === freeZone7[0]);
    check('Preview: thửa chưa khảo sát, ô đường nhiễm -> giữ nguyên ô đường', freeRow?.streetKeptAsIs === true && freeRow?.suggested.street === freeRow?.parcelRaw.street, freeRow?.suggested);
    check('Preview: phường địa chính được quy đổi theo đúng quận', ['Phường Nhiêu Lộc', 'Phường Hòa Hưng'].includes(freeRow?.suggested.ward ?? ''), freeRow?.suggested);
    const approvedRow = preview.find((r) => r.parcelId === approvedZone9[0]);
    check('Preview: thửa APPROVED bị khóa, không tự tích', Boolean(approvedRow?.lockedReason) && approvedRow?.autoSelectable === false);
    await expectRejected('Preview: thửa ngoài Zone 3/7/9 -> 400', () => CadastralBatchService.previewAddress(zone4, superAdmin), /chỉ áp dụng/);

    // 6. Đồng bộ địa chỉ
    const target = preview.find((r) => r.parcelId === freeZone7[1])!;
    const sync = await CadastralBatchService.syncAddress({
      items: [
        { parcelId: freeZone7[1], ...target.suggested, street: 'Cách Mạng Tháng Tám' },
        { parcelId: freeZone7[2], houseNumber: '1', street: 'Phường 9', ward: 'Phường Nhiêu Lộc', district: 'Quận 3' },
        { parcelId: approvedZone9[0], houseNumber: '1', street: 'Cách Mạng Tháng Tám', ward: 'Phường Nhiêu Lộc', district: 'Quận 3' },
      ],
    }, superAdmin, null);
    check('Đồng bộ: 1 thửa cập nhật', sync.updated.length === 1 && sync.updated[0].parcelId === freeZone7[1], sync);
    check('Đồng bộ: đường vẫn là tên phường -> bỏ qua', sync.skipped.some((s) => s.parcelId === freeZone7[2] && /tên phường/.test(s.reason)));
    check('Đồng bộ: thửa APPROVED -> bỏ qua', sync.skipped.some((s) => s.parcelId === approvedZone9[0] && /đã duyệt/.test(s.reason)));
    const syncLog = await Database.query<{ edited: string }>(
      `SELECT diff_payload->>'editedByAdmin' AS edited FROM system_audit_logs WHERE action = 'PARCEL_ADDRESS_BATCH_UPDATED' AND diff_payload->>'batchId' = $1;`, [sync.batchId]);
    check('Đồng bộ: log ghi trường Admin sửa tay (street)', syncLog.rows.length === 1 && syncLog.rows[0].edited.includes('street'), syncLog.rows[0]);

    // 6b. Thửa có hồ sơ: ghi như Admin sửa ở Thẩm định, giữ trạng thái, có v0 + snapshot, Quận không đổi
    const repRes = await Database.query<{ id: string; status: string; json: string; updated_at: string }>(
      `SELECT r.id, r.status::text AS status, r.survey_data_json::text AS json, r.updated_at::text AS updated_at
       FROM base_survey_reports r JOIN parcels p ON p.id = r.parcel_id
       WHERE p.id = $1 AND r.deleted_at IS NULL AND r.unit_id IS NULL
       ORDER BY (CASE WHEN r.id = p.active_phase1_report_id THEN 0 ELSE 1 END), r.updated_at DESC NULLS LAST LIMIT 1;`,
      [surveyedCmt8Contaminated[0]]
    );
    const rep = repRes.rows[0];
    reportBackups.push({ id: rep.id, json: rep.json, updatedAt: rep.updated_at });
    const verBefore = await Database.query<{ c: string }>(`SELECT COUNT(*) AS c FROM survey_report_versions WHERE report_id = $1;`, [rep.id]);
    const districtBefore = (await snapshot(surveyedCmt8Contaminated))[0].district;
    const repPreview = (await CadastralBatchService.previewAddress(surveyedCmt8Contaminated, superAdmin))[0];
    check('Preview: thửa có hồ sơ trả reportId', repPreview.reportId === rep.id && repPreview.reportDiffCount > 0, { reportId: repPreview.reportId, reportDiffCount: repPreview.reportDiffCount });
    const repSync = await CadastralBatchService.syncAddress(
      { items: [{ parcelId: surveyedCmt8Contaminated[0], ...repPreview.suggested, street: 'Cách Mạng Tháng Tám' }] },
      superAdmin,
      null
    );
    const repAfter = await Database.query<{ status: string; json: Record<string, unknown> }>(
      `SELECT status::text AS status, survey_data_json AS json FROM base_survey_reports WHERE id = $1;`,
      [rep.id]
    );
    const expectedStd = `${repPreview.suggested.houseNumber ? `Số ${repPreview.suggested.houseNumber} ` : ''}Cách Mạng Tháng Tám, ${repPreview.suggested.ward}, TP. Hồ Chí Minh`;
    check('Hồ sơ: ghi đường + địa chỉ chuẩn hóa vào survey_data_json', repSync.updated.length === 1 && repAfter.rows[0].json.street === 'Cách Mạng Tháng Tám' && repAfter.rows[0].json.standardizedAddress === expectedStd, { sync: repSync, std: repAfter.rows[0].json.standardizedAddress });
    check('Hồ sơ: giữ nguyên trạng thái', repAfter.rows[0].status === rep.status, { before: rep.status, after: repAfter.rows[0].status });
    const originalJson = JSON.parse(rep.json) as Record<string, unknown>;
    const changedKeys = Object.keys({ ...originalJson, ...repAfter.rows[0].json }).filter(
      (k) => JSON.stringify(originalJson[k]) !== JSON.stringify(repAfter.rows[0].json[k])
    );
    const allowedKeys = ['houseNumber', 'street', 'ward', 'standardizedAddress', '_lastAdminEdit'];
    check('Hồ sơ: chỉ đổi đúng các khóa địa chỉ', changedKeys.every((k) => allowedKeys.includes(k)), changedKeys);
    const versions = await Database.query<{ version_tag: string }>(
      `SELECT version_tag FROM survey_report_versions WHERE report_id = $1 ORDER BY version_number;`,
      [rep.id]
    );
    check('Hồ sơ: có v0 ORIGINAL_SUBMISSION và snapshot ADMIN_DIFF_SAVE mới', versions.rows[0]?.version_tag === 'ORIGINAL_SUBMISSION' && versions.rows[versions.rows.length - 1]?.version_tag === 'ADMIN_DIFF_SAVE' && versions.rows.length > Number(verBefore.rows[0].c), versions.rows.map((v) => v.version_tag));
    const editLog = await Database.query<{ c: string }>(
      `SELECT COUNT(*) AS c FROM system_audit_logs WHERE action = 'ZONE_ADMIN_SURVEY_EDIT' AND entity_id = $1 AND diff_payload->>'batchId' = $2;`,
      [rep.id, repSync.batchId]
    );
    check('Hồ sơ: log ZONE_ADMIN_SURVEY_EDIT có batchId', Number(editLog.rows[0].c) === 1);
    check('Quận trong bảng thửa không đổi', (await snapshot(surveyedCmt8Contaminated))[0].district === districtBefore);

    // 6c. Hồ sơ đang bị Admin khác khóa thẩm định -> bỏ qua
    const otherAdmin = await Database.query<{ id: string }>(
      `SELECT id FROM users WHERE role IN ('ZONE_ADMIN','SUPER_ADMIN') AND deleted_at IS NULL AND id <> $1 LIMIT 1;`,
      [superAdmin.userId]
    );
    const subRep = await Database.query<{ id: string }>(
      `SELECT r.id FROM base_survey_reports r WHERE r.parcel_id = $1 AND r.deleted_at IS NULL AND r.unit_id IS NULL ORDER BY r.updated_at DESC LIMIT 1;`,
      [submittedZone7[0]]
    );
    const prevLock = await Database.query<{ locked_by_user_id: string; expires_at: string }>(
      `SELECT locked_by_user_id, expires_at::text AS expires_at FROM survey_audit_locks WHERE report_id = $1;`,
      [subRep.rows[0].id]
    );
    lockBackup = { reportId: subRep.rows[0].id, previous: prevLock.rows[0] ?? null };
    await Database.query(
      `INSERT INTO survey_audit_locks (report_id, locked_by_user_id, expires_at) VALUES ($1, $2, NOW() + INTERVAL '10 minutes')
       ON CONFLICT (report_id) DO UPDATE SET locked_by_user_id = EXCLUDED.locked_by_user_id, expires_at = EXCLUDED.expires_at;`,
      [subRep.rows[0].id, otherAdmin.rows[0].id]
    );
    const subPreview = (await CadastralBatchService.previewAddress(submittedZone7, superAdmin))[0];
    const lockedSync = await CadastralBatchService.syncAddress(
      { items: [{ parcelId: submittedZone7[0], ...subPreview.suggested, street: 'Cách Mạng Tháng Tám' }] },
      superAdmin,
      null
    );
    check('Hồ sơ đang bị Admin khác khóa -> bỏ qua', lockedSync.updated.length === 0 && /đang được thẩm định/.test(lockedSync.skipped[0]?.reason ?? ''), lockedSync.skipped);

    // 7. Lỗi giữa transaction -> rollback cả lô
    const beforeRollback = await snapshot([freeZone7[0]]);
    await expectRejected('Lỗi DB ở dòng thứ 2 -> ROLLBACK', () =>
      CadastralBatchService.syncAddress({
        items: [
          { parcelId: freeZone7[0], houseNumber: '999', street: 'Cách Mạng Tháng Tám', ward: 'Phường Hòa Hưng', district: 'Quận 10' },
          { parcelId: freeZone7[2], houseNumber: '1', street: 'Cách Mạng Tháng Tám ' + 'x'.repeat(200), ward: 'Phường Hòa Hưng' },
        ],
      }, superAdmin, null),
      /too long|quá dài|value/i);
    const afterRollback = await snapshot([freeZone7[0]]);
    check('ROLLBACK: dòng 1 không bị ghi', afterRollback[0].house_number === beforeRollback[0].house_number);

    // 8. Hàm đề xuất thuần
    const conflict = buildAddressSuggestion({
      zoneId: 'ZONE_07',
      parcelRaw: { houseNumber: '500', street: 'Phường 10', ward: 'Phường 10', district: 'Quận 3' },
      surveyorEntered: { houseNumber: '500 CMT8', street: 'kp7, p.Hoà Hưng', ward: '', district: '' },
    });
    check('Đề xuất: địa chính Q3 nhưng KSV ghi Hòa Hưng -> wardConflict', conflict.wardConflict?.surveyorWard === 'Phường Hòa Hưng' && conflict.suggested.street === 'Cách Mạng Tháng Tám', conflict);

    // 9. Các tác vụ khác (CQĐP, ẩn/khôi phục, thửa chưa có hồ sơ) không đụng survey_data_json
    const otherIds = all.filter((id) => id !== surveyedCmt8Contaminated[0]);
    check('survey_data_json của các hồ sơ khác trong lô không đổi', (await jsonHash(otherIds)) === hashBeforeOthers);
  } finally {
    await restoreSnapshot(original);
    for (const b of reportBackups) {
      await Database.query(`UPDATE base_survey_reports SET survey_data_json = $2::jsonb, updated_at = $3::timestamptz WHERE id = $1;`, [b.id, b.json, b.updatedAt]);
    }
    if (lockBackup) {
      if (lockBackup.previous) {
        await Database.query(`UPDATE survey_audit_locks SET locked_by_user_id = $2, expires_at = $3::timestamptz WHERE report_id = $1;`, [lockBackup.reportId, lockBackup.previous.locked_by_user_id, lockBackup.previous.expires_at]);
      } else {
        // Không xóa: cho khóa test hết hạn ngay
        await Database.query(`UPDATE survey_audit_locks SET expires_at = NOW() - INTERVAL '1 minute' WHERE report_id = $1;`, [lockBackup.reportId]);
      }
    }
    console.log('[BatchOpsTest] Phiên bản survey_report_versions do test tạo được giữ lại (DB test)');
    console.log('[BatchOpsTest] Đã trả lại giá trị gốc cho thửa mượn');
  }
}

run()
  .then(async () => {
    const failed = results.filter((r) => !r.passed);
    console.log(`\n${results.length - failed.length}/${results.length} kiểm tra đạt`);
    await pool.end();
    process.exit(failed.length > 0 ? 1 : 0);
  })
  .catch(async (err: unknown) => {
    console.error('[BatchOpsTest] Lỗi không mong đợi', err);
    await pool.end();
    process.exit(1);
  });
