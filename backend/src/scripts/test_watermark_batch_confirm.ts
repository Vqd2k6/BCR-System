/**
 * Kiểm thử gửi xác nhận dấu cũ theo lô (POST /reports/:id/watermark-confirmations/batch).
 * GHI THẬT vào photo_watermark_status + system_audit_logs ⇒ chỉ chạy trên DB nháp (tên bắt đầu bằng "zz_")
 * hoặc metro2_audit_test, trên Docker local:
 *   DB_NAME=zz_wm npx ts-node --transpile-only src/scripts/test_watermark_batch_confirm.ts
 */
import 'dotenv/config';
import { Database, pool } from '../database/db';
import { config } from '../config';
import type { JwtPayload } from '../common/guards/auth.guard';
import { AppError } from '../common/errors/problem-details';
import { WatermarkConfirmationService } from '../modules/report/services/watermark-confirmation.service';
import { ReportService } from '../modules/report/services/report.service';
import { extractAllImageUrls } from '../modules/report/utils/report-preload.utils';
import { isFieldPhotoUrl } from '../modules/report/services/legacy-watermark-index.service';
import { assertLocalServer, assertLoopbackHost } from './lib/local-db-guard';

const TAG = 'TestWatermarkBatch';
let passed = 0;
let failed = 0;

function check(name: string, ok: boolean, detail = ''): void {
  if (ok) {
    passed += 1;
    console.log(`  ✅ ${name}`);
  } else {
    failed += 1;
    console.error(`  ❌ ${name} ${detail}`);
  }
}

async function expectError(name: string, status: number, run: () => Promise<unknown>): Promise<void> {
  try {
    await run();
    check(name, false, '(không ném lỗi)');
  } catch (err) {
    const got = err instanceof AppError ? err.status : -1;
    check(name, got === status, `(mong ${status}, nhận ${got}: ${err instanceof Error ? err.message : String(err)})`);
  }
}

async function manualRows(urls: string[]): Promise<Map<string, boolean>> {
  const res = await Database.query<{ photo_url: string; has_legacy_watermark: boolean }>(
    `SELECT photo_url, has_legacy_watermark FROM photo_watermark_status WHERE source = 'MANUAL' AND photo_url = ANY($1::text[]);`,
    [urls]
  );
  return new Map(res.rows.map((r) => [r.photo_url, r.has_legacy_watermark]));
}

async function main(): Promise<void> {
  const target = { host: String(config.db.host), port: Number(config.db.port), database: String(config.db.database) };
  assertLoopbackHost(target, TAG);
  if (!target.database.startsWith('zz_') && target.database !== 'metro2_audit_test') {
    throw new Error(`[${TAG}] Chỉ chạy trên DB nháp zz_* hoặc metro2_audit_test, không chạy trên "${target.database}".`);
  }
  await Database.transaction(async (client) => assertLocalServer(client, target, TAG));

  // Hồ sơ có ≥ 5 ảnh hiện trường chưa xác nhận tay.
  const reports = await Database.query<{ id: string }>(
    `SELECT id FROM base_survey_reports WHERE deleted_at IS NULL AND unit_id IS NULL ORDER BY updated_at DESC LIMIT 50;`
  );
  let reportId = '';
  let urls: string[] = [];
  for (const r of reports.rows) {
    const resolved = await ReportService.resolve(r.id);
    const candidates = [...new Set(extractAllImageUrls(resolved.raw))].filter(isFieldPhotoUrl);
    const manual = await manualRows(candidates);
    const fresh = candidates.filter((u) => !manual.has(u));
    if (fresh.length >= 5) {
      reportId = resolved.id;
      urls = fresh.slice(0, 5);
      break;
    }
  }
  if (!reportId) throw new Error(`[${TAG}] Không tìm được hồ sơ có ≥ 5 ảnh chưa xác nhận.`);
  console.log(`Hồ sơ thử: ${reportId}`);
  const [u1, u2, u3, u4, u5] = urls;

  const admins = await Database.query<{ id: string; username: string; role: JwtPayload['role'] }>(
    `SELECT id, username, role::text AS role FROM users WHERE username IN ('superadmin', 'zoneadmin') AND deleted_at IS NULL;`
  );
  const sa = admins.rows.find((u) => u.username === 'superadmin');
  const za = admins.rows.find((u) => u.username === 'zoneadmin');
  if (!sa || !za) throw new Error(`[${TAG}] Thiếu user superadmin / zoneadmin trong DB nháp.`);
  const superAdmin: JwtPayload = { userId: sa.id, username: sa.username, role: 'SUPER_ADMIN', assignedZoneId: null, fullName: 'SA' };
  const zoneAdmin: JwtPayload = { userId: za.id, username: za.username, role: 'ZONE_ADMIN', assignedZoneId: 'ALL', fullName: 'ZA' };

  console.log('1. Zone Admin gửi lô 3 ảnh hợp lệ');
  const ok = await WatermarkConfirmationService.confirmLegacyBatch(
    zoneAdmin,
    reportId,
    [
      { photoUrl: u1, hasLegacyWatermark: true },
      { photoUrl: u2, hasLegacyWatermark: false },
      { photoUrl: u3, hasLegacyWatermark: true },
    ],
    '127.0.0.1'
  );
  const after1 = await manualRows([u1, u2, u3]);
  check('3 dòng MANUAL đúng kết quả', after1.get(u1) === true && after1.get(u2) === false && after1.get(u3) === true);
  const audit = await Database.query<{ n: number }>(
    `SELECT count(*)::int AS n FROM system_audit_logs WHERE action = 'PHOTO_WATERMARK_CONFIRM' AND entity_id = $1 AND diff_payload->>'batchId' = $2;`,
    [reportId, ok.batchId]
  );
  check('3 dòng audit cùng batchId', audit.rows[0]?.n === 3, `(nhận ${audit.rows[0]?.n})`);

  console.log('2. URL không thuộc hồ sơ ⇒ 400, không ghi ảnh nào');
  await expectError('URL lạ bị từ chối', 400, () =>
    WatermarkConfirmationService.confirmLegacyBatch(
      zoneAdmin,
      reportId,
      [
        { photoUrl: u4, hasLegacyWatermark: true },
        { photoUrl: 'https://example.invalid/khong-thuoc-ho-so.jpg', hasLegacyWatermark: true },
      ],
      '127.0.0.1'
    )
  );
  check('u4 không bị ghi', !(await manualRows([u4])).has(u4));

  console.log('3. Zone Admin gửi lô có ảnh đã xác nhận ⇒ 403, rollback cả lô');
  await expectError('ảnh đã MANUAL bị chặn với Zone Admin', 403, () =>
    WatermarkConfirmationService.confirmLegacyBatch(
      zoneAdmin,
      reportId,
      [
        { photoUrl: u4, hasLegacyWatermark: true },
        { photoUrl: u1, hasLegacyWatermark: false },
      ],
      '127.0.0.1'
    )
  );
  const after3 = await manualRows([u1, u4]);
  check('u4 không bị ghi, u1 giữ nguyên', !after3.has(u4) && after3.get(u1) === true);

  console.log('4. URL trùng trong lô ⇒ 400');
  await expectError('URL trùng bị từ chối', 400, () =>
    WatermarkConfirmationService.confirmLegacyBatch(
      zoneAdmin,
      reportId,
      [
        { photoUrl: u4, hasLegacyWatermark: true },
        { photoUrl: u4, hasLegacyWatermark: false },
      ],
      '127.0.0.1'
    )
  );

  console.log('5. Super Admin sửa ảnh đã xác nhận trong lô');
  await WatermarkConfirmationService.confirmLegacyBatch(
    superAdmin,
    reportId,
    [
      { photoUrl: u1, hasLegacyWatermark: false },
      { photoUrl: u4, hasLegacyWatermark: true },
    ],
    '127.0.0.1'
  );
  const after5 = await manualRows([u1, u4]);
  check('u1 đổi thành chưa có dấu, u4 có dấu cũ', after5.get(u1) === false && after5.get(u4) === true);

  console.log('6. Xác nhận lẻ (Studio) vẫn chạy sau khi tách hàm');
  await WatermarkConfirmationService.confirmLegacy(zoneAdmin, reportId, { photoUrl: u5, hasLegacyWatermark: false }, '127.0.0.1');
  check('u5 ghi MANUAL', (await manualRows([u5])).get(u5) === false);
  await expectError('xác nhận lẻ lần 2 bởi Zone Admin bị chặn', 403, () =>
    WatermarkConfirmationService.confirmLegacy(zoneAdmin, reportId, { photoUrl: u5, hasLegacyWatermark: true }, '127.0.0.1')
  );

  console.log(`\nKết quả: ${passed} đạt, ${failed} lỗi`);
  if (failed > 0) process.exitCode = 1;
}

main()
  .catch((err: unknown) => {
    console.error(`[${TAG}:Fatal]`, err);
    process.exitCode = 1;
  })
  .finally(() => {
    void pool.end();
  });
