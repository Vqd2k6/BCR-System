/**
 * Quét trước watermark FE cũ (logo cháy sẵn) cho mọi ảnh hiện trường trong survey_photo_registry,
 * lưu vào photo_watermark_status để lần xuất report đầu tiên không phải chờ dò.
 *
 *   cd backend && npx ts-node --transpile-only src/scripts/backfill_photo_watermark_status.ts [--concurrency=6] [--limit=N]
 *
 * Chạy lại được: chỉ quét URL chưa có kết quả của phiên bản bộ dò hiện tại. Chỉ ghi bảng cache, không đụng ảnh/hồ sơ.
 */
import 'dotenv/config';
import { Database } from '../database/db';
import { ReportImageResolver } from '../modules/report/services/report-image-resolver.service';
import { isFieldPhotoUrl } from '../modules/report/services/legacy-watermark-index.service';
import { WATERMARK_DETECTOR_VERSION, WatermarkDetectorService } from '../modules/report/services/watermark-detector.service';

function argNumber(name: string, fallback: number): number {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  const n = hit ? Number(hit.split('=')[1]) : NaN;
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

async function main(): Promise<void> {
  const concurrency = argNumber('concurrency', 6);
  const limit = argNumber('limit', 1_000_000);

  const res = await Database.query<{ photo_url: string; upload_day: string }>(
    `SELECT r.photo_url, MIN((r.created_at AT TIME ZONE 'Asia/Ho_Chi_Minh')::date)::text AS upload_day
       FROM survey_photo_registry r
      WHERE r.photo_url IS NOT NULL
        AND NOT EXISTS (
          SELECT 1 FROM photo_watermark_status s
           WHERE s.photo_url = r.photo_url AND s.detector_version = $1
        )
      GROUP BY r.photo_url
      ORDER BY MIN(r.created_at)
      LIMIT $2;`,
    [WATERMARK_DETECTOR_VERSION, limit]
  );
  const items = res.rows.filter((r) => isFieldPhotoUrl(r.photo_url));
  console.log(`[Backfill] ${items.length} ảnh hiện trường cần quét (bỏ qua ${res.rows.length - items.length} ảnh không phải ảnh chụp), song song ${concurrency}`);

  const byDay = new Map<string, { total: number; wm: number; unsure: number }>();
  let done = 0;
  let failed = 0;
  const started = Date.now();
  let cursor = 0;

  const worker = async (): Promise<void> => {
    while (cursor < items.length) {
      const item = items[cursor++];
      try {
        const buffer = await ReportImageResolver.getImageBuffer(item.photo_url);
        const r = await WatermarkDetectorService.detectLegacyLogo(buffer);
        await Database.query(
          `INSERT INTO photo_watermark_status (photo_url, has_legacy_watermark, verdict, score, detector_version, detected_at)
           VALUES ($1, $2, $3, $4, $5, NOW())
           ON CONFLICT (photo_url) DO UPDATE
             SET has_legacy_watermark = EXCLUDED.has_legacy_watermark, verdict = EXCLUDED.verdict,
                 score = EXCLUDED.score, detector_version = EXCLUDED.detector_version, detected_at = NOW();`,
          [item.photo_url, r.hasLegacyWatermark, r.verdict, r.score, WATERMARK_DETECTOR_VERSION]
        );
        const d = byDay.get(item.upload_day) || { total: 0, wm: 0, unsure: 0 };
        d.total += 1;
        if (r.verdict === 'WATERMARKED') d.wm += 1;
        if (r.verdict === 'UNSURE') {
          d.unsure += 1;
          console.warn(`[Backfill] UNSURE score=${r.score} ${item.photo_url}`);
        }
        byDay.set(item.upload_day, d);
      } catch (err) {
        failed += 1;
        console.error(`[Backfill] Không quét được ${item.photo_url}:`, err instanceof Error ? err.message : err);
      }
      done += 1;
      if (done % 200 === 0) {
        const rate = done / ((Date.now() - started) / 1000);
        console.log(`[Backfill] ${done}/${items.length} (${rate.toFixed(1)} ảnh/s, lỗi ${failed})`);
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, worker));

  console.log('\n[Backfill] Thống kê theo ngày upload (có dấu / lưng chừng / tổng):');
  for (const [day, d] of [...byDay.entries()].sort()) {
    if (d.wm + d.unsure > 0) console.log(`  ${day}  ${d.wm} / ${d.unsure} / ${d.total}`);
  }
  console.log(`[Backfill] Xong ${done} ảnh, lỗi ${failed}, ${Math.round((Date.now() - started) / 1000)}s`);
  process.exit(failed > 0 ? 2 : 0);
}

main().catch((err: unknown) => {
  console.error('[Backfill] Lỗi không mong đợi:', err);
  process.exit(1);
});
