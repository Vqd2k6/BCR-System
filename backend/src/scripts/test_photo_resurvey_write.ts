/**
 * Kiểm thử đường ghi Khảo sát bổ sung (chụp lại ảnh ngoài nhà dân).
 * CHỈ chạy trên CSDL test và lưu trữ local:
 *   DB_NAME=metro2_audit_test STORAGE_TYPE=local npx ts-node --transpile-only src/scripts/test_photo_resurvey_write.ts
 *   A. Phân quyền Zone (KSV / Zone Admin Zone khác bị chặn).
 *   B. Mở phiên → cờ QC ASSIGNED; chụp lại thay dòng cũ bằng soft-delete; P-02 cấm N/A.
 *   C. Nộp thiếu ô → bị chặn; nộp đủ → SUBMITTED, khoá sửa, SHA-256.
 *   D. Từ chối → về DRAFT trên chính phiên; nộp lại → duyệt → cờ RESOLVED, report in ảnh mới (bìa + Phụ lục 1).
 *   E. Hồ sơ APPROVED: kết quả đóng băng vào snapshot mới, snapshot đã phát hành giữ nguyên (ROLLBACK).
 * Cuối test soft-delete phiên và tắt cờ đã tạo để chạy lại được.
 */
import assert from 'assert';
import sharp from 'sharp';
import type { JwtPayload } from '../common/guards/auth.guard';
import { Database, pool } from '../database/db';
import { PhotoResurveyRepository } from '../modules/photo-resurvey/photo-resurvey.repository';
import { parseFrozenResurvey } from '../modules/photo-resurvey/photo-resurvey.render';
import { PhotoResurveyService } from '../modules/photo-resurvey/photo-resurvey.service';
import { ReportSnapshotService } from '../modules/report/snapshot/report-snapshot.service';
import { ReportService } from '../modules/report/services/report.service';

if (process.env.DB_NAME !== 'metro2_audit_test' || (process.env.STORAGE_TYPE || '').toLowerCase() !== 'local') {
  console.error('[test_photo_resurvey_write] Chỉ chạy với DB_NAME=metro2_audit_test và STORAGE_TYPE=local');
  process.exit(1);
}

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

async function expectReject(p: Promise<unknown>, pattern: RegExp): Promise<void> {
  try {
    await p;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    assert.match(msg, pattern);
    return;
  }
  assert.fail(`phải bị từ chối (${pattern})`);
}

async function jpegBase64(color: { r: number; g: number; b: number }): Promise<string> {
  const buf = await sharp({ create: { width: 64, height: 48, channels: 3, background: color } }).jpeg().toBuffer();
  return `data:image/jpeg;base64,${buf.toString('base64')}`;
}

async function userOf(role: string, zone: string): Promise<JwtPayload> {
  const res = await Database.query<{ id: string; username: string; full_name: string }>(
    `SELECT id, username, full_name FROM users WHERE role = $1 AND assigned_zone_id = $2 AND deleted_at IS NULL ORDER BY created_at LIMIT 1;`,
    [role, zone]
  );
  const u = res.rows[0];
  assert.ok(u, `cần tài khoản ${role} ${zone}`);
  return { userId: u.id, username: u.username, role: role as JwtPayload['role'], fullName: u.full_name, assignedZoneId: zone };
}

async function main(): Promise<void> {
  const surveyor09 = await userOf('SURVEYOR', 'ZONE_09');
  const surveyor07 = await userOf('SURVEYOR', 'ZONE_07');
  const admin09 = await userOf('ZONE_ADMIN', 'ZONE_09');
  const admin07 = await userOf('ZONE_ADMIN', 'ZONE_07');

  const rep = await Database.query<{ id: string }>(
    `SELECT r.id FROM base_survey_reports r JOIN parcels p ON p.id = r.parcel_id
     WHERE r.deleted_at IS NULL AND r.status <> 'APPROVED' AND r.report_type = 'STANDALONE' AND r.unit_id IS NULL
       AND p.zone_id = 'ZONE_09' AND COALESCE(r.survey_data_json->'photoP02'->>'url', '') <> ''
       AND COALESCE(jsonb_array_length(r.survey_data_json->'settlementTilt'->'buildingTilt'->'photos'), 0) >= 1
       AND NOT EXISTS (SELECT 1 FROM survey_photo_resurveys s WHERE s.report_id = r.id AND s.deleted_at IS NULL)
     ORDER BY r.report_code LIMIT 1;`
  );
  const reportId = rep.rows[0]?.id;
  assert.ok(reportId, 'cần một hồ sơ nhà dân ZONE_09 chưa duyệt có P-02 và ảnh nghiêng');

  // Mức thu thập lại phải là AUTO (NONE chọn tay = không chụp lại); test khác có thể để lại NONE.
  const prevLevel = await Database.query<{ recapture_level: string }>(
    `SELECT recapture_level FROM photo_qc_reports WHERE report_id = $1 AND deleted_at IS NULL;`,
    [reportId]
  );
  await Database.query(
    `INSERT INTO photo_qc_reports (report_id, zone_id, recapture_level) VALUES ($1, 'ZONE_09', 'AUTO')
     ON CONFLICT (report_id) DO UPDATE SET recapture_level = 'AUTO', updated_at = NOW();`,
    [reportId]
  );

  // Gắn cờ chụp lại cho P-02 và P-05 như Admin làm ở Photo QC.
  const initial = await PhotoResurveyService.getView(admin09, reportId);
  const p02 = initial.slots.find((s) => s.photoKey === 'P-02');
  const p05 = initial.slots.find((s) => s.photoKey === 'P-05');
  assert.ok(p02 && p05, 'hồ sơ phải có ô P-02 và P-05');
  const flagKeys = [p02.photoKey, p05.photoKey];
  for (const s of [p02, p05]) {
    await Database.query(
      `INSERT INTO photo_qc_photos (report_id, photo_key, photo_url, photo_label, recapture, photo_group, status)
       VALUES ($1, $2, $3, $4, TRUE, 'OUTDOOR', 'OPEN')
       ON CONFLICT (report_id, photo_key) DO UPDATE
         SET photo_url = EXCLUDED.photo_url, recapture = TRUE, status = 'OPEN', deleted_at = NULL, updated_at = NOW();`,
      [reportId, s.photoKey, s.url, s.label]
    );
  }
  let sessionId = '';

  try {
    console.log('A. Phân quyền Zone');
    await tc('KSV / Zone Admin ZONE_07 không xem được hồ sơ ZONE_09', async () => {
      await expectReject(PhotoResurveyService.getView(surveyor07, reportId), /phân khu/);
      await expectReject(PhotoResurveyService.getView(admin07, reportId), /phân khu/);
    });
    await tc('Danh sách GIS của KSV ZONE_09 có thửa này ở trạng thái PENDING', async () => {
      const tasks = await PhotoResurveyService.listTasks(surveyor09, {});
      const t = tasks.find((x) => x.reportId === reportId);
      assert.strictEqual(t?.state, 'PENDING');
      assert.ok((t?.openOutdoorCount ?? 0) >= 2);
      assert.ok(t?.lat !== null && t?.lng !== null, 'cần toạ độ để vẽ dấu chấm than');
    });
    await tc('Admin không mở phiên chụp được', async () => {
      await expectReject(PhotoResurveyService.startSession(admin09, reportId), /Khảo sát viên/);
    });

    console.log('B. Mở phiên, chụp lại, N/A');
    await tc('Mở phiên → DRAFT, cờ QC chuyển ASSIGNED', async () => {
      const v = await PhotoResurveyService.startSession(surveyor09, reportId);
      assert.strictEqual(v.session?.status, 'DRAFT');
      assert.ok(v.canEdit);
      sessionId = v.session!.id;
      const st = await Database.query<{ status: string }>(
        `SELECT status FROM photo_qc_photos WHERE report_id = $1 AND photo_key = ANY($2::text[]);`,
        [reportId, flagKeys]
      );
      assert.ok(st.rows.every((r) => r.status === 'ASSIGNED'));
    });
    await tc('KSV khác (cùng Zone, khác người) không sửa được phiên', async () => {
      const other = await Database.query<{ id: string }>(
        `SELECT id FROM users WHERE role = 'SURVEYOR' AND assigned_zone_id = 'ZONE_09' AND id <> $1 AND deleted_at IS NULL LIMIT 1;`,
        [surveyor09.userId]
      );
      if (!other.rows[0]) return;
      const otherUser: JwtPayload = { ...surveyor09, userId: other.rows[0].id };
      await expectReject(
        PhotoResurveyService.uploadPhoto(otherUser, sessionId, { action: 'REPLACE', photoKey: 'P-02', base64: await jpegBase64({ r: 1, g: 2, b: 3 }) }),
        /KSV khác/
      );
    });
    await tc('Chụp lại P-02: Time 2 = chữ giờ đang in của ảnh gốc, ảnh mới nằm ở nhánh resurvey/', async () => {
      const v = await PhotoResurveyService.uploadPhoto(surveyor09, sessionId, {
        action: 'REPLACE', photoKey: 'P-02', base64: await jpegBase64({ r: 200, g: 0, b: 0 }),
        capturedAtClient: new Date().toISOString(), lat: 10.77, lng: 106.69,
      });
      const it = v.items.find((i) => i.photoKey === 'P-02');
      assert.strictEqual(it?.time2Text, p02.dateTimeText);
      assert.strictEqual(it?.time2Source, 'ORIGINAL');
      assert.ok(it?.newUrl?.includes('/resurvey/'), it?.newUrl ?? '');
      assert.ok(!/_\d{13}[._]/.test(it?.newUrl ?? ''), 'tên file không được có epoch 13 số');
      assert.ok(it?.distanceToParcelM !== null, 'phải tính khoảng cách tới thửa');
    });
    await tc('Chụp lại P-02 lần 2: dòng cũ soft-delete, chỉ còn 1 dòng hiệu lực', async () => {
      await PhotoResurveyService.uploadPhoto(surveyor09, sessionId, { action: 'REPLACE', photoKey: 'P-02', base64: await jpegBase64({ r: 0, g: 200, b: 0 }) });
      const rows = await Database.query<{ live: number; dead: number }>(
        `SELECT COUNT(*) FILTER (WHERE deleted_at IS NULL)::int AS live, COUNT(*) FILTER (WHERE deleted_at IS NOT NULL)::int AS dead
         FROM survey_photo_resurvey_items WHERE resurvey_id = $1 AND photo_key = 'P-02';`,
        [sessionId]
      );
      assert.deepStrictEqual(rows.rows[0], { live: 1, dead: 1 });
    });
    await tc('P-02 không được đánh dấu N/A', async () => {
      await expectReject(PhotoResurveyService.markNa(surveyor09, sessionId, { photoKey: 'P-02', reason: 'Không cần thiết' }), /P-02/);
    });
    await tc('Ảnh không bị gắn cờ không được chụp thay', async () => {
      const unflagged = initial.slots.find((s) => !flagKeys.includes(s.photoKey));
      if (!unflagged) return;
      await expectReject(
        PhotoResurveyService.uploadPhoto(surveyor09, sessionId, { action: 'REPLACE', photoKey: unflagged.photoKey, base64: await jpegBase64({ r: 9, g: 9, b: 9 }) }),
        /không nằm trong danh sách/
      );
    });

    console.log('C. Nộp');
    await tc('Nộp khi còn P-05 chưa xử lý → bị chặn, nêu tên ảnh', async () => {
      await expectReject(PhotoResurveyService.submit(surveyor09, sessionId), /chưa chụp lại hoặc đánh dấu N\/A/);
    });
    await tc('N/A cho P-05 + chụp thêm 1 ảnh P-05 → xem trước giờ ảnh phát sinh', async () => {
      await PhotoResurveyService.markNa(surveyor09, sessionId, { photoKey: 'P-05', reason: 'Ảnh đo nghiêng trùng góc, không cần thiết' });
      const v = await PhotoResurveyService.uploadPhoto(surveyor09, sessionId, { action: 'ADD_EXTRA', slotCode: 'P-05', base64: await jpegBase64({ r: 0, g: 0, b: 200 }) });
      const extra = v.items.find((i) => i.action === 'ADD_EXTRA');
      assert.ok(extra);
      assert.strictEqual(v.extraTimeError, null);
      assert.ok(v.extraTimes.some((t) => t.itemId === extra.id && t.time2Text));
    });
    await tc('Nộp đủ → SUBMITTED, có SHA-256, Time 2 ảnh phát sinh đã chốt', async () => {
      const v = await PhotoResurveyService.submit(surveyor09, sessionId);
      assert.strictEqual(v.session?.status, 'SUBMITTED');
      assert.match(v.session?.submittedSha256 ?? '', /^[0-9a-f]{64}$/);
      const extra = v.items.find((i) => i.action === 'ADD_EXTRA');
      assert.ok(extra?.time2Text && extra.time2Source);
      assert.strictEqual(v.canEdit, false);
    });
    await tc('Sau khi nộp: KSV không thêm/bỏ ảnh được', async () => {
      await expectReject(PhotoResurveyService.uploadPhoto(surveyor09, sessionId, { action: 'REPLACE', photoKey: 'P-02', base64: await jpegBase64({ r: 1, g: 1, b: 1 }) }), /chờ Admin duyệt/);
      const items = await PhotoResurveyRepository.getActiveItems(sessionId);
      await expectReject(PhotoResurveyService.removeItem(surveyor09, sessionId, items[0].id), /chờ Admin duyệt/);
    });
    await tc('GIS chuyển sang SUBMITTED', async () => {
      const t = (await PhotoResurveyService.listTasks(admin09, { zone: 'ZONE_09' })).find((x) => x.reportId === reportId);
      assert.strictEqual(t?.state, 'SUBMITTED');
    });

    console.log('D. Từ chối, nộp lại, duyệt');
    await tc('Zone Admin Zone khác không duyệt / từ chối được', async () => {
      await expectReject(PhotoResurveyService.reject(admin07, sessionId, { note: 'Ảnh mờ, chụp lại giúp' }), /phân khu/);
    });
    await tc('Từ chối → phiên về DRAFT, giữ nguyên ảnh đã chụp, đếm lần từ chối', async () => {
      const v = await PhotoResurveyService.reject(admin09, sessionId, { note: 'Ảnh P-02 bị nghiêng, chụp lại thẳng' });
      assert.strictEqual(v.session?.status, 'DRAFT');
      assert.strictEqual(v.session?.rejectCount, 1);
      assert.strictEqual(v.session?.reviewNote, 'Ảnh P-02 bị nghiêng, chụp lại thẳng');
      assert.ok(v.items.length >= 3);
    });
    await tc('Admin chỉnh giờ ảnh phát sinh ra ngoài khoảng → bị chặn', async () => {
      await PhotoResurveyService.submit(surveyor09, sessionId);
      const items = await PhotoResurveyRepository.getActiveItems(sessionId);
      const extra = items.find((i) => i.action === 'ADD_EXTRA')!;
      if (extra.time2Source === 'DATE_ONLY') return;
      await expectReject(
        PhotoResurveyService.approve(admin09, sessionId, { time2Overrides: { [extra.id]: '2000-01-01T00:00:00Z' } }),
        /phải nằm trong khoảng|không có mốc giờ/
      );
    });
    let newP02Url = '';
    await tc('Duyệt → APPROVED, cờ QC RESOLVED, SHA-256 duyệt', async () => {
      const v = await PhotoResurveyService.approve(admin09, sessionId, { note: 'Đạt' });
      assert.strictEqual(v.session?.status, 'APPROVED');
      assert.match(v.session?.approvedSha256 ?? '', /^[0-9a-f]{64}$/);
      newP02Url = v.items.find((i) => i.photoKey === 'P-02')?.newUrl ?? '';
      const st = await Database.query<{ status: string }>(
        `SELECT status FROM photo_qc_photos WHERE report_id = $1 AND photo_key = ANY($2::text[]);`,
        [reportId, flagKeys]
      );
      assert.ok(st.rows.every((r) => r.status === 'RESOLVED'));
      const logs = await Database.query<{ action: string }>(
        `SELECT action FROM system_audit_logs WHERE entity_type = 'PHOTO_RESURVEY' AND entity_id = $1 ORDER BY created_at;`,
        [sessionId]
      );
      const actions = logs.rows.map((r) => r.action);
      for (const a of ['PHOTO_RESURVEY_START', 'PHOTO_RESURVEY_SUBMIT', 'PHOTO_RESURVEY_REJECT', 'PHOTO_RESURVEY_APPROVE']) {
        assert.ok(actions.includes(a), `thiếu nhật ký ${a}`);
      }
    });
    await tc('Duyệt phiên CHƯA đổi report: mục chờ đưa vào, P-02 vẫn ảnh cũ; Thẩm định đưa vào, bỏ qua, hoàn tác', async () => {
      const v0 = await PhotoResurveyService.getView(admin09, reportId);
      assert.strictEqual(v0.canApply, true, 'Zone Admin đúng Zone phải được Đưa vào sau khi duyệt');
      assert.strictEqual((await PhotoResurveyService.getView(surveyor09, reportId)).canApply, false, 'KSV không được Đưa vào');
      assert.ok(v0.items.every((i) => i.applyStatus === 'PENDING'), 'mục mới duyệt phải chờ đưa vào');
      assert.strictEqual(v0.slots.find((s) => s.photoKey === 'P-02')?.url, p02.url, 'chưa đưa vào thì report in ảnh cũ');
      assert.strictEqual(await PhotoResurveyRepository.loadRenderState(reportId), null);
      const ids = v0.items.map((i) => i.id);
      const declined = await PhotoResurveyService.decideApply(admin09, sessionId, { itemIds: ids, decision: 'DECLINED' });
      assert.ok(declined.items.every((i) => i.applyStatus === 'DECLINED'));
      assert.strictEqual(await PhotoResurveyRepository.loadRenderState(reportId), null);
      await PhotoResurveyService.decideApply(admin09, sessionId, { itemIds: ids, decision: 'PENDING' });
      const applied = await PhotoResurveyService.decideApply(admin09, sessionId, { itemIds: ids, decision: 'APPLIED' });
      assert.ok(applied.items.every((i) => i.applyStatus === 'APPLIED' && i.applyDecidedAt));
      const logs = await Database.query<{ n: string }>(
        `SELECT COUNT(*)::text AS n FROM system_audit_logs WHERE entity_type = 'PHOTO_RESURVEY' AND entity_id = $1 AND action = 'PHOTO_RESURVEY_APPLY';`,
        [sessionId]
      );
      assert.strictEqual(logs.rows[0]?.n, '3');
    });
    await tc('Admin chỉnh tay giờ ảnh phát sinh: trong khoảng lưu ADMIN; ngoài khoảng, ảnh thay thế, KSV bị chặn', async () => {
      const v = await PhotoResurveyService.getView(admin09, reportId);
      const extra = v.items.find((i) => i.action === 'ADD_EXTRA');
      const repl = v.items.find((i) => i.action === 'REPLACE');
      assert.ok(extra?.time2Text && repl, 'cần 1 ảnh phát sinh và 1 ảnh thay thế');
      // Giờ VN của giờ đang lưu (nằm trong khoảng hợp lệ) → dạng YYYY-MM-DDTHH:mm:ss.
      const m = extra!.time2Text!.match(/^(\d{1,2}) thg (\d{1,2}), (\d{4}) (\d{2}:\d{2}:\d{2})$/);
      assert.ok(m, `giờ phát sinh phải có giờ: ${extra!.time2Text}`);
      const iso = `${m![3]}-${m![2].padStart(2, '0')}-${m![1].padStart(2, '0')}T${m![4]}`;
      const saved = await PhotoResurveyService.updateExtraTime2(admin09, sessionId, extra!.id, { at: iso });
      const after = saved.items.find((i) => i.id === extra!.id);
      assert.strictEqual(after?.time2Source, 'ADMIN');
      assert.strictEqual(after?.time2Text, extra!.time2Text);
      await assert.rejects(PhotoResurveyService.updateExtraTime2(admin09, sessionId, extra!.id, { at: '2000-01-01T08:00:00' }), /phải nằm trong khoảng/);
      await assert.rejects(PhotoResurveyService.updateExtraTime2(admin09, sessionId, extra!.id, { at: '2026-02-31T08:00:00' }), /không hợp lệ/);
      await assert.rejects(PhotoResurveyService.updateExtraTime2(admin09, sessionId, repl!.id, { at: iso }), /giờ của ảnh gốc/);
      await assert.rejects(PhotoResurveyService.updateExtraTime2(surveyor09, sessionId, extra!.id, { at: iso }));
      const logs = await Database.query<{ n: string }>(
        `SELECT COUNT(*)::text AS n FROM system_audit_logs WHERE entity_type = 'PHOTO_RESURVEY' AND entity_id = $1 AND action = 'PHOTO_RESURVEY_TIME2_EDIT';`,
        [sessionId]
      );
      assert.strictEqual(logs.rows[0]?.n, '1');
    });
    await tc('Bản in kế tiếp: P-02 là ảnh mới (giờ in giữ nguyên), P-05 gốc bị bỏ, ảnh phát sinh có mặt', async () => {
      const v = await PhotoResurveyService.getView(admin09, reportId);
      const slot02 = v.slots.find((s) => s.photoKey === 'P-02');
      assert.strictEqual(slot02?.url, newP02Url);
      assert.strictEqual(slot02?.dateTimeText, p02.dateTimeText);
      assert.ok(!v.slots.some((s) => s.url === p05.url), 'ảnh P-05 gốc phải bị bỏ khỏi bản in');
      assert.ok(v.slots.some((s) => s.url.includes('/resurvey/') && s.slotCode === 'P-05'), 'ảnh phát sinh P-05 phải có mặt');
      assert.ok(!v.slots.some((s) => s.flagged), 'không còn cờ mở');
      const render = await PhotoResurveyRepository.loadRenderState(reportId);
      assert.strictEqual(render?.sessions.length, 1);
    });
    await tc('Render HTML thật: Phụ lục 1 + bìa nạp ảnh mới, chữ giờ watermark giữ như ảnh gốc', async () => {
      const raw = await ReportService.resolveReport(reportId);
      const { viewModel } = await ReportService.generateHtmlFromReport(raw, undefined, false, false);
      const item = viewModel.appendix1.find((p) => p.photoCode === 'P-02');
      assert.strictEqual(item?.url, newP02Url);
      assert.ok(item?.base64?.startsWith('data:image/'), 'ảnh mới phải nạp được base64');
      assert.strictEqual(item?.watermarkDateTime, p02.dateTimeText);
      if (viewModel.metadata.coverPhotoUrl) {
        assert.strictEqual(viewModel.metadata.coverPhotoUrl, newP02Url);
        assert.ok(viewModel.metadata.coverPhotoBase64?.startsWith('data:image/'));
      }
      const pageCount = viewModel.appendix1Pages?.length ?? 0;
      assert.strictEqual(pageCount, Math.ceil(viewModel.appendix1.length / 4));
      assert.strictEqual(viewModel.tocPageNumbers.sectionXI, viewModel.tocPageNumbers.sectionX + pageCount);
    });

    console.log('E. Hồ sơ APPROVED (transaction ROLLBACK)');
    const approved = await Database.query<{ id: string; approved_at: Date; export_revision: number; parcel_id: string }>(
      `SELECT id, approved_at, export_revision, parcel_id FROM base_survey_reports
       WHERE status = 'APPROVED' AND deleted_at IS NULL AND report_type = 'STANDALONE' LIMIT 1;`
    );
    if (!approved.rows[0]) {
      console.log('  ⏭  không có hồ sơ APPROVED trong CSDL test, bỏ qua');
    } else {
      const appr = approved.rows[0];
      await tc('Snapshot mới mang kết quả chụp lại; snapshot đã phát hành giữ nguyên', async () => {
        const before = await ReportSnapshotService.getLatestApprovedSnapshot(appr.id);
        const client = await pool.connect();
        try {
          await client.query('BEGIN');
          const s = await client.query<{ id: string }>(
            `INSERT INTO survey_photo_resurveys (report_id, parcel_id, status, surveyor_id, reviewed_at)
             VALUES ($1, $2, 'APPROVED', $3, NOW()) RETURNING id;`,
            [appr.id, appr.parcel_id, surveyor09.userId]
          );
          await client.query(
            `INSERT INTO survey_photo_resurvey_items (resurvey_id, action, slot_code, photo_key, original_url, new_url, time2_text, created_by, apply_status)
             VALUES ($1, 'REPLACE', 'P-02', 'P-02', 'u/old.jpg', 'u/new.jpg', '1 thg 1, 2026 08:00:00', $2, 'APPLIED');`,
            [s.rows[0].id, surveyor09.userId]
          );
          const snap = await ReportSnapshotService.writeApprovedRelease(client, appr.id, admin09.userId, appr.approved_at, 'TEST resurvey', appr.export_revision);
          const frozen = parseFrozenResurvey(snap.snapshot.frozenReportData?.photo_resurvey);
          assert.strictEqual(frozen?.sessions[0]?.items[0]?.newUrl, 'u/new.jpg');
          if (before) assert.strictEqual(parseFrozenResurvey(before.snapshot.frozenReportData?.photo_resurvey), null);
        } finally {
          await client.query('ROLLBACK');
          client.release();
        }
        const after = await ReportSnapshotService.getLatestApprovedSnapshot(appr.id);
        assert.strictEqual(after?.versionId, before?.versionId, 'ROLLBACK: không để lại snapshot');
      });
    }
  } finally {
    // Dọn để chạy lại: soft-delete phiên, tắt cờ đã tạo (không xoá cứng).
    await Database.query(`UPDATE survey_photo_resurveys SET deleted_at = NOW() WHERE report_id = $1 AND deleted_at IS NULL;`, [reportId]);
    await Database.query(
      `UPDATE photo_qc_photos SET recapture = FALSE, status = 'OPEN', deleted_at = NOW() WHERE report_id = $1 AND photo_key = ANY($2::text[]);`,
      [reportId, flagKeys]
    );
    if (prevLevel.rows[0]) {
      await Database.query(`UPDATE photo_qc_reports SET recapture_level = $2, updated_at = NOW() WHERE report_id = $1;`, [
        reportId,
        prevLevel.rows[0].recapture_level,
      ]);
    }
  }

  console.log(`\n${passed} ca đạt${process.exitCode ? ', CÓ CA LỖI' : ''}`);
}

main()
  .catch((err) => {
    console.error('[test_photo_resurvey_write] Lỗi', err);
    process.exitCode = 1;
  })
  .finally(() => setTimeout(() => process.exit(process.exitCode ?? 0), 200));
