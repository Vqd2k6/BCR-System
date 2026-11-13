/**
 * Kiểm thử đầu-cuối sửa lỗi watermark trên DB TEST (ghi DB + file Rev local, KHÔNG chạy trên DB thật):
 *   cd backend && DB_NAME=metro2_audit_test STORAGE_TYPE=local npx ts-node --transpile-only src/scripts/test_watermark_confirm_release_e2e.ts
 *
 * 1. API xác nhận dấu cũ: Zone khác bị chặn, URL lạ bị chặn, Zone Admin xác nhận 1 lần, xác nhận lại bị chặn,
 *    Super Admin sửa được, bộ dò chạy lại không ghi đè MANUAL, mỗi lần ghi có audit.
 * 2. Phát hành Rev: còn ảnh nghi ngờ thì bị chặn (WatermarkIncompleteError); xác nhận từng ảnh rồi phát hành được;
 *    snapshot có photo_watermark; Super Admin sửa xác nhận sau phát hành thì xem lại Rev vẫn như cũ.
 */
import assert from 'assert';
import { Database } from '../database/db';
import type { JwtPayload } from '../common/guards/auth.guard';
import { ForbiddenError, BadRequestError, WatermarkIncompleteError } from '../common/errors/problem-details';
import { ReportService } from '../modules/report/services/report.service';
import { ReportReleaseService } from '../modules/report/services/report-release.service';
import { WatermarkConfirmationService } from '../modules/report/services/watermark-confirmation.service';
import { extractAllImageUrls } from '../modules/report/utils/report-preload.utils';
import { isFieldPhotoUrl } from '../modules/report/services/legacy-watermark-index.service';
import { config } from '../config';

let passed = 0;
async function tc(name: string, fn: () => Promise<void>): Promise<void> {
  try {
    await fn();
    passed += 1;
    console.log(`  ✅ ${name}`);
  } catch (err) {
    console.error(`  ❌ ${name}`);
    throw err;
  }
}

async function expectReject(p: Promise<unknown>, cls: new (...args: never[]) => Error): Promise<void> {
  try {
    await p;
  } catch (err) {
    assert.ok(err instanceof cls, `Lỗi sai loại: ${String(err)}`);
    return;
  }
  assert.fail(`Mong đợi ${cls.name} nhưng không có lỗi`);
}

async function main(): Promise<void> {
  if (config.db.database !== 'metro2_audit_test') {
    throw new Error(`Chỉ chạy trên DB test metro2_audit_test (đang là ${config.db.database})`);
  }
  const rep = await Database.query<{ id: string; zone_id: string }>(
    `SELECT b.id, p.zone_id FROM base_survey_reports b JOIN parcels p ON p.id = b.parcel_id
      WHERE b.status = 'APPROVED' AND b.deleted_at IS NULL AND p.project_parcel_code = $1 LIMIT 1;`,
    [process.argv[2] || 'C&C-01-B-0228']
  );
  const reportId = rep.rows[0].id;
  const zoneId = rep.rows[0].zone_id;
  const users = await Database.query<{ id: string; role: string }>(
    `(SELECT id, role FROM users WHERE deleted_at IS NULL AND role = 'SUPER_ADMIN' LIMIT 1)
     UNION ALL (SELECT id, role FROM users WHERE deleted_at IS NULL AND role = 'ZONE_ADMIN' LIMIT 1);`
  );
  const saId = users.rows.find((u) => u.role === 'SUPER_ADMIN')?.id as string;
  const zaId = users.rows.find((u) => u.role === 'ZONE_ADMIN')?.id as string;
  const sa: JwtPayload = { userId: saId, username: 'sa-test', role: 'SUPER_ADMIN', assignedZoneId: null } as JwtPayload;
  const zaOwn: JwtPayload = { userId: zaId, username: 'za-own', role: 'ZONE_ADMIN', assignedZoneId: zoneId } as JwtPayload;
  const zaOther: JwtPayload = { userId: zaId, username: 'za-other', role: 'ZONE_ADMIN', assignedZoneId: 'ZONE_99' } as JwtPayload;

  const resolved = await ReportService.resolve(reportId);
  const url = extractAllImageUrls(resolved.raw).find(isFieldPhotoUrl) as string;
  assert.ok(url, 'Hồ sơ test không có ảnh');
  const backup = await Database.query(`SELECT * FROM photo_watermark_status WHERE photo_url = $1;`, [url]);

  console.log(`\n[1] API xác nhận dấu cũ (hồ sơ ${reportId}, ${zoneId})`);
  await tc('Zone Admin Zone khác → 403', () => expectReject(
    WatermarkConfirmationService.confirmLegacy(zaOther, reportId, { photoUrl: url, hasLegacyWatermark: false }, '127.0.0.1'), ForbiddenError));
  await tc('URL không thuộc hồ sơ → 400', () => expectReject(
    WatermarkConfirmationService.confirmLegacy(zaOwn, reportId, { photoUrl: 'https://x/khong-thuoc-ho-so.jpg', hasLegacyWatermark: false }, null), BadRequestError));
  await Database.query(`UPDATE photo_watermark_status SET source = 'DETECTOR' WHERE photo_url = $1;`, [url]);
  await tc('Zone Admin đúng Zone xác nhận "Chưa có dấu" → lưu MANUAL + audit', async () => {
    const before = await Database.query<{ n: string }>(`SELECT COUNT(*) AS n FROM system_audit_logs WHERE action = 'PHOTO_WATERMARK_CONFIRM' AND entity_id = $1;`, [reportId]);
    await WatermarkConfirmationService.confirmLegacy(zaOwn, reportId, { photoUrl: url, hasLegacyWatermark: false }, '127.0.0.1');
    const row = await Database.query<{ source: string; has_legacy_watermark: boolean; confirmed_by: string }>(
      `SELECT source, has_legacy_watermark, confirmed_by FROM photo_watermark_status WHERE photo_url = $1;`, [url]);
    assert.strictEqual(row.rows[0].source, 'MANUAL');
    assert.strictEqual(row.rows[0].has_legacy_watermark, false);
    assert.strictEqual(row.rows[0].confirmed_by, zaId);
    const after = await Database.query<{ n: string }>(`SELECT COUNT(*) AS n FROM system_audit_logs WHERE action = 'PHOTO_WATERMARK_CONFIRM' AND entity_id = $1;`, [reportId]);
    assert.strictEqual(Number(after.rows[0].n), Number(before.rows[0].n) + 1);
  });
  await tc('Zone Admin xác nhận lại ảnh đã xác nhận → 403 (chỉ Super Admin sửa)', () => expectReject(
    WatermarkConfirmationService.confirmLegacy(zaOwn, reportId, { photoUrl: url, hasLegacyWatermark: true }, null), ForbiddenError));
  await tc('Super Admin sửa kết quả → "Có dấu cũ"', async () => {
    await WatermarkConfirmationService.confirmLegacy(sa, reportId, { photoUrl: url, hasLegacyWatermark: true, reason: 'test sửa' }, null);
    const row = await Database.query<{ has_legacy_watermark: boolean }>(`SELECT has_legacy_watermark FROM photo_watermark_status WHERE photo_url = $1;`, [url]);
    assert.strictEqual(row.rows[0].has_legacy_watermark, true);
  });
  await tc('Bộ dò chạy lại (upsert DETECTOR) không ghi đè dòng MANUAL', async () => {
    await Database.query(
      `INSERT INTO photo_watermark_status (photo_url, has_legacy_watermark, verdict, score, detector_version, detected_at, source)
       VALUES ($1, false, 'CLEAN', 1.0, 'logo-v2', NOW(), 'DETECTOR')
       ON CONFLICT (photo_url) DO UPDATE SET has_legacy_watermark = EXCLUDED.has_legacy_watermark, verdict = EXCLUDED.verdict,
         score = EXCLUDED.score, detector_version = EXCLUDED.detector_version, detected_at = NOW()
       WHERE photo_watermark_status.source <> 'MANUAL';`,
      [url]
    );
    const row = await Database.query<{ source: string; has_legacy_watermark: boolean }>(`SELECT source, has_legacy_watermark FROM photo_watermark_status WHERE photo_url = $1;`, [url]);
    assert.strictEqual(row.rows[0].source, 'MANUAL');
    assert.strictEqual(row.rows[0].has_legacy_watermark, true);
  });

  console.log('\n[2] Phát hành Rev (chốt chặn cứng + snapshot đóng băng)');
  let releasedRev = 0;
  await tc('Còn ảnh chưa dập được thì bị chặn; xác nhận từng ảnh nghi ngờ rồi phát hành được', async () => {
    for (let round = 0; round < 3; round++) {
      try {
        const rel = await ReportReleaseService.issueNewRevision(reportId, sa, 'Kiểm thử phát hành Rev sau khi sửa lỗi watermark');
        releasedRev = rel.revision;
        break;
      } catch (err) {
        if (!(err instanceof WatermarkIncompleteError)) throw err;
        const params = err.invalidParams ?? [];
        console.log(`    chặn đúng: ${params.length} ảnh – ${params.slice(0, 2).map((p) => p.message).join(' | ')}`);
        assert.ok(params.length > 0);
        // Ảnh chưa từng được dò phải được dò ngay lúc phát hành, không bị chặn chờ xác nhận tay.
        assert.ok(!params.some((p) => /chưa được dò/i.test(p.message)), 'Lượt phát hành bỏ qua bước dò cho ảnh chưa có trong snapshot');
        // Ảnh tải lỗi thật (không phải nghi ngờ) thì không xác nhận hộ được.
        const suspects = params.filter((p) => /vùng nghi ngờ|chưa được dò|không đọc được ảnh/i.test(p.message));
        assert.strictEqual(suspects.length, params.length, 'Có ảnh lỗi không phải nghi ngờ dấu cũ');
        for (const p of suspects) {
          await WatermarkConfirmationService.confirmLegacy(sa, reportId, { photoUrl: p.field, hasLegacyWatermark: false, reason: 'e2e test' }, null);
        }
      }
    }
    assert.ok(releasedRev > 0, 'Không phát hành được Rev');
  });
  await tc('Snapshot Rev có photo_watermark và xem lại Rev không đổi khi Super Admin sửa xác nhận sau phát hành', async () => {
    const snap = await Database.query<{ snapshot_data: { frozenReportData?: { photo_watermark?: Record<string, boolean> } } }>(
      `SELECT v.snapshot_data FROM report_releases r JOIN survey_report_versions v ON v.id = r.snapshot_version_id
        WHERE r.report_id = $1 AND r.revision = $2;`,
      [reportId, releasedRev]
    );
    const frozen = snap.rows[0]?.snapshot_data?.frozenReportData?.photo_watermark;
    assert.ok(frozen && Object.keys(frozen).length > 0, 'Snapshot thiếu photo_watermark');
    assert.strictEqual(frozen[url], true);
    const resolvedNow = await ReportService.resolve(reportId);
    const before = await ReportService.renderDraftHtml(resolvedNow, undefined, false, true, releasedRev);
    await WatermarkConfirmationService.confirmLegacy(sa, reportId, { photoUrl: url, hasLegacyWatermark: false, reason: 'sửa sau phát hành' }, null);
    const after = await ReportService.renderDraftHtml(resolvedNow, undefined, false, true, releasedRev);
    assert.strictEqual(after.watermark.legacy, before.watermark.legacy);
    assert.strictEqual(after.watermark.stamped, before.watermark.stamped);
  });

  // Trả dòng cache của URL test về như trước (dữ liệu test, giữ bảng sạch cho lần chạy sau).
  if (backup.rows[0]) {
    const b = backup.rows[0] as Record<string, unknown>;
    await Database.query(
      `UPDATE photo_watermark_status SET has_legacy_watermark = $2, verdict = $3, score = $4, detector_version = $5, source = $6,
              confirmed_by = $7, confirmed_at = $8, confirm_reason = $9 WHERE photo_url = $1;`,
      [url, b.has_legacy_watermark, b.verdict, b.score, b.detector_version, b.source ?? 'DETECTOR', b.confirmed_by ?? null, b.confirmed_at ?? null, b.confirm_reason ?? null]
    );
  }
  console.log(`\n✅ ĐẠT – ${passed} ca (Rev ${releasedRev})`);
  process.exit(0);
}

main().catch((err: unknown) => {
  console.error('[test_watermark_confirm_release_e2e] THẤT BẠI', err);
  process.exit(1);
});
