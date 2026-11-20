/**
 * Kiểm thử khóa ca khảo sát (sau sự cố C&C-04-B-0010): tiếp quản, nhịp giữ khóa, mở khóa, nộp, vắng mặt.
 *
 * CHỈ chạy trên DB nháp (tên DB phải chứa "scratch"), vì script ghi nháp thật và lùi mốc thời gian:
 *   DB_NAME=metro2_lock_test_scratch npx ts-node --transpile-only src/scripts/test_draft_lock_takeover.ts
 * Không xoá cứng dòng nào.
 */
import assert from 'assert';
import { Database } from '../database/db';
import { config } from '../config';
import { SurveyService } from '../modules/survey/survey.service';
import { CadastralService } from '../modules/cadastral/cadastral.service';

let passed = 0;
async function tc(name: string, fn: () => Promise<void>): Promise<void> {
  try {
    await fn();
    passed++;
    console.log(`  ✅ ${name}`);
  } catch (err) {
    console.error(`  ❌ ${name}`, err);
    process.exitCode = 1;
  }
}

interface AppErrorLike {
  status?: number;
  code?: string;
  message?: string;
}

async function expectError(p: Promise<unknown>, status: number, code?: string): Promise<AppErrorLike> {
  try {
    await p;
  } catch (err) {
    const e = err as AppErrorLike;
    assert.strictEqual(e.status, status, `mong đợi HTTP ${status}, nhận ${e.status} (${e.code}): ${e.message}`);
    if (code) assert.strictEqual(e.code, code);
    return e;
  }
  return assert.fail(`phải lỗi HTTP ${status}${code ? ` ${code}` : ''}`);
}

interface ReportRow {
  id: string;
  surveyor_id: string | null;
  last_edited_by_id: string | null;
  is_ready_for_handover: boolean | null;
  handover_security_code: string | null;
  handover_history: unknown[] | null;
  sync_version: number;
  updated_at: Date;
  lock_heartbeat_at: Date | null;
  status: string;
  survey_data_json: Record<string, unknown> | null;
}

async function draftOf(parcelId: string, unitId: string | null): Promise<ReportRow> {
  const res = await Database.query<ReportRow>(
    `SELECT id, surveyor_id, last_edited_by_id, is_ready_for_handover, handover_security_code, handover_history,
            sync_version, updated_at, lock_heartbeat_at, status::text AS status, survey_data_json
     FROM base_survey_reports
     WHERE parcel_id = $1 AND ${unitId ? 'unit_id = $2' : 'unit_id IS NULL'} AND phase = 'PHASE_1'
     ORDER BY created_at DESC LIMIT 1;`,
    unitId ? [parcelId, unitId] : [parcelId]
  );
  assert.ok(res.rows[0], 'phải có nháp');
  return res.rows[0];
}

/** Giả lập người giữ ca không hoạt động quá hạn khóa (chỉ trên DB nháp). */
async function expireLock(reportId: string): Promise<void> {
  // Cờ phiên để trigger không ghi đè updated_at đã lùi (migration 20261122)
  await Database.transaction(async (client) => {
    await client.query(`SET LOCAL metro2.keep_updated_at = 'on';`);
    await client.query(
      `UPDATE base_survey_reports SET updated_at = NOW() - INTERVAL '20 minutes', lock_heartbeat_at = NULL WHERE id = $1;`,
      [reportId]
    );
  });
}

function payload(marker: string): Record<string, unknown> {
  return {
    marker,
    ownerName: 'Kiểm thử khóa ca',
    photoP01: { url: 'https://example.invalid/p01.jpg' },
    photoP02: { url: 'https://example.invalid/p02.jpg' },
    photoP03: { url: 'https://example.invalid/p03.jpg' },
    floors: [{ floorName: 'Tầng 1', zones: [{ id: 'Z-01' }] }],
  };
}

async function suite(label: string, parcelId: string, unitId: string | null, A: string, B: string, C: string): Promise<void> {
  const reportType = unitId ? 'CONDO_UNIT' : 'STANDALONE';
  console.log(`\n${label}`);

  // A tạo nháp và đang giữ ca
  await SurveyService.saveSurveyDraft({ parcelId, unitId, surveyorId: A, reportType, currentStep: 3, surveyData: payload('A-1') });
  await SurveyService.heartbeatDraftLock(parcelId, unitId, A);
  const start = await draftOf(parcelId, unitId);
  assert.strictEqual(start.surveyor_id, A);

  await tc('1. A đang giữ ca: B tiếp quản đúng mã → 409, heartbeat của B → 409, B mở khóa → 403', async () => {
    const code = String(start.handover_security_code || (await draftOf(parcelId, unitId)).handover_security_code);
    await expectError(SurveyService.takeoverSurveyDraft({ parcelId, unitId, newSurveyorId: B, handoverCode: code }), 409, 'DRAFT_OWNED_BY_OTHER');
    await expectError(SurveyService.heartbeatDraftLock(parcelId, unitId, B), 409, 'DRAFT_OWNED_BY_OTHER');
    await expectError(SurveyService.releaseDraftLock(parcelId, unitId, B), 403);
    assert.strictEqual((await draftOf(parcelId, unitId)).surveyor_id, A);
  });

  await tc('2. B nộp (createPhase1Report) khi A giữ ca → 409, nháp của A không đổi', async () => {
    const before = await draftOf(parcelId, unitId);
    await expectError(SurveyService.createPhase1Report(parcelId, B, unitId || undefined, reportType), 409, 'DRAFT_OWNED_BY_OTHER');
    const after = await draftOf(parcelId, unitId);
    assert.strictEqual(after.surveyor_id, A);
    assert.deepStrictEqual(after.survey_data_json, before.survey_data_json);
    assert.strictEqual(after.sync_version, before.sync_version);
  });

  await tc('2b. B ghi nhận vắng mặt khi A giữ ca → 409, rollback (nháp + trạng thái không đổi)', async () => {
    const before = await draftOf(parcelId, unitId);
    await expectError(
      CadastralService.recordAbsence(parcelId, B, { unitId, absenceReason: 'OWNER_ABSENT', notes: 'test', surveyData: payload('B-absent') }),
      409,
      'DRAFT_OWNED_BY_OTHER'
    );
    const after = await draftOf(parcelId, unitId);
    assert.strictEqual(after.surveyor_id, A);
    assert.strictEqual(after.status, before.status);
    assert.deepStrictEqual(after.survey_data_json, before.survey_data_json);
  });

  await tc('6. Heartbeat không đổi updated_at, sync_version, nội dung nháp', async () => {
    const before = await draftOf(parcelId, unitId);
    const r = await SurveyService.heartbeatDraftLock(parcelId, unitId, A);
    assert.strictEqual(r.held, true);
    const after = await draftOf(parcelId, unitId);
    assert.strictEqual(after.updated_at.getTime(), before.updated_at.getTime());
    assert.strictEqual(after.sync_version, before.sync_version);
    assert.deepStrictEqual(after.survey_data_json, before.survey_data_json);
    assert.ok(after.lock_heartbeat_at);
  });

  await tc('3. A mở khóa ca → B nộp được: B giữ ca, handover_history +1, cờ mở khóa về FALSE', async () => {
    await SurveyService.releaseDraftLock(parcelId, unitId, A);
    const before = await draftOf(parcelId, unitId);
    assert.strictEqual(before.is_ready_for_handover, true);
    await SurveyService.createPhase1Report(parcelId, B, unitId || undefined, reportType);
    const after = await draftOf(parcelId, unitId);
    assert.strictEqual(after.surveyor_id, B);
    assert.strictEqual(after.is_ready_for_handover, false);
    assert.strictEqual((after.handover_history || []).length, (before.handover_history || []).length + 1);
  });

  await tc('4. B quá hạn khóa: C tiếp quản được; B heartbeat → 409, B lưu nháp → 409', async () => {
    const d = await draftOf(parcelId, unitId);
    await expireLock(d.id);
    await SurveyService.takeoverSurveyDraft({ parcelId, unitId, newSurveyorId: C, handoverCode: String(d.handover_security_code) });
    assert.strictEqual((await draftOf(parcelId, unitId)).surveyor_id, C);
    await expectError(SurveyService.heartbeatDraftLock(parcelId, unitId, B), 409, 'DRAFT_OWNED_BY_OTHER');
    await expectError(
      SurveyService.saveSurveyDraft({ parcelId, unitId, surveyorId: B, reportType, currentStep: 3, surveyData: payload('B-stale') }),
      409,
      'DRAFT_OWNED_BY_OTHER'
    );
  });

  await tc('5. Hai KSV tiếp quản cùng lúc (người giữ quá hạn), 5 vòng → mỗi vòng đúng 1 người thắng', async () => {
    const statuses: number[] = [];
    for (let round = 0; round < 5; round++) {
      const d = await draftOf(parcelId, unitId);
      await expireLock(d.id);
      const code = String(d.handover_security_code);
      // Hai người không phải chủ ca hiện tại
      const [x, y] = [A, B, C].filter((u) => u !== d.surveyor_id);
      const results = await Promise.allSettled([
        SurveyService.takeoverSurveyDraft({ parcelId, unitId, newSurveyorId: x, handoverCode: code }),
        SurveyService.takeoverSurveyDraft({ parcelId, unitId, newSurveyorId: y, handoverCode: code }),
      ]);
      const ok = results.filter((r) => r.status === 'fulfilled');
      const failed = results.filter((r): r is PromiseRejectedResult => r.status === 'rejected');
      assert.strictEqual(ok.length, 1, `vòng ${round + 1}: phải đúng 1 người thắng, có ${ok.length}`);
      // Người thua: 409 nếu thua ngay trong câu UPDATE, 400 nếu đọc nháp sau khi mã đã đổi
      const status = Number((failed[0].reason as AppErrorLike).status);
      assert.ok(status === 409 || status === 400, `vòng ${round + 1}: người thua nhận ${status}`);
      statuses.push(status);
      const winner = (await draftOf(parcelId, unitId)).surveyor_id;
      assert.ok(winner === x || winner === y);
    }
    console.log(`     mã lỗi người thua qua 5 vòng: ${statuses.join(', ')}`);
  });
}

async function main(): Promise<void> {
  const dbName = String(process.env.DATABASE_URL || config.database?.database || process.env.DB_NAME || '');
  if (!/scratch/i.test(dbName)) {
    console.error(`[test_draft_lock_takeover] Từ chối chạy: DB "${dbName}" không phải DB nháp (tên phải chứa "scratch").`);
    process.exitCode = 1;
    return;
  }
  console.log(`[test_draft_lock_takeover] DB nháp: ${dbName}`);

  const users = await Database.query<{ id: string }>(
    `SELECT id FROM users WHERE role = 'SURVEYOR' AND deleted_at IS NULL ORDER BY created_at LIMIT 3;`
  );
  assert.ok(users.rows.length === 3, 'cần 3 KSV');
  const [A, B, C] = users.rows.map((r) => r.id);

  const house = await Database.query<{ id: string }>(
    `SELECT p.id FROM parcels p
     WHERE COALESCE(p.building_type, '') <> 'CONDOMINIUM'
       AND COALESCE(p.survey_status::text, 'NOT_STARTED') IN ('NOT_STARTED', 'NOT_SURVEYED', 'ASSIGNED_TO_ME')
       AND NOT EXISTS (SELECT 1 FROM base_survey_reports r WHERE r.parcel_id = p.id)
     ORDER BY p.project_parcel_code LIMIT 1;`
  );
  assert.ok(house.rows[0], 'cần 1 thửa nhà dân chưa có hồ sơ');
  await suite('Nhà dân', house.rows[0].id, null, A, B, C);

  const unit = await Database.query<{ id: string; parcel_id: string }>(
    `SELECT bu.id, bu.parcel_id FROM building_units bu
     WHERE bu.deleted_at IS NULL AND COALESCE(bu.unit_type, 'UNIT') = 'UNIT'
       AND COALESCE(bu.status::text, 'NOT_STARTED') NOT IN ('SUBMITTED', 'APPROVED', 'POSTPONED_ABSENT', 'PHASE2_COMPLETED', 'APPROVED_PHASE2')
       AND NOT EXISTS (SELECT 1 FROM base_survey_reports r WHERE r.unit_id = bu.id)
     ORDER BY bu.unit_code LIMIT 1;`
  );
  if (unit.rows[0]) {
    await suite('Căn hộ', unit.rows[0].parcel_id, unit.rows[0].id, A, B, C);
  } else {
    console.log('  ⏭  không có căn hộ chưa khảo sát trong DB nháp');
  }

  console.log(`\n${passed} ca đạt${process.exitCode ? ', CÓ CA LỖI' : ''}`);
}

main()
  .catch((err) => {
    console.error('[test_draft_lock_takeover] Lỗi', err);
    process.exitCode = 1;
  })
  .finally(() => setTimeout(() => process.exit(process.exitCode ?? 0), 200));
