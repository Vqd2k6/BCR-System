/**
 * Quét trước dấu cũ (logo PWA cũ cháy sẵn) cho MỌI ảnh raster mà report có thể in, lưu vào photo_watermark_status
 * để lần xuất report đầu tiên không phải chờ dò. Sau đó in bảng đếm ảnh NGHI NGỜ theo Zone / hồ sơ
 * (khối lượng Zone Admin phải xác nhận tay).
 *
 *   cd backend && npx ts-node --transpile-only src/scripts/backfill_photo_watermark_status.ts [--concurrency=6] [--limit=N] [--report-only]
 *
 * Nguồn URL: survey_photo_registry + dữ liệu khảo sát (survey_data_json, gồm sơ đồ CAD chụp tay không có trong sổ cái)
 * + ảnh chụp lại. Bỏ qua URL đã có kết quả (điểm cũ logo-v1 được phân loại lại theo ngưỡng logo-v2, không cần dò lại).
 * Không bao giờ ghi đè dòng MANUAL. Chỉ ghi bảng cache, không đụng ảnh/hồ sơ.
 */
import 'dotenv/config';
import { Database } from '../database/db';
import { ReportImageResolver } from '../modules/report/services/report-image-resolver.service';
import { isFieldPhotoUrl } from '../modules/report/services/legacy-watermark-index.service';
import {
  SCORE_UNSURE,
  SCORE_WATERMARKED,
  WATERMARK_DETECTOR_VERSION,
  WatermarkDetectorService,
} from '../modules/report/services/watermark-detector.service';

function argNumber(name: string, fallback: number): number {
  const hit = process.argv.find((a) => a.startsWith(`--${name}=`));
  const n = hit ? Number(hit.split('=')[1]) : NaN;
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

const URL_SOURCES_SQL = `
  WITH urls AS (
    SELECT r.photo_url AS url FROM survey_photo_registry r WHERE r.photo_url IS NOT NULL
    UNION
    SELECT m[1] FROM base_survey_reports b,
      regexp_matches(b.survey_data_json::text, '(https?://[^"]+\\.(?:jpe?g|png|webp))', 'gi') m
     WHERE b.deleted_at IS NULL
    UNION
    SELECT i.new_url FROM survey_photo_resurvey_items i WHERE i.new_url IS NOT NULL AND i.deleted_at IS NULL
  )`;

async function detectMissing(concurrency: number, limit: number): Promise<number> {
  const res = await Database.query<{ url: string }>(
    `${URL_SOURCES_SQL}
     SELECT u.url FROM urls u
      WHERE NOT EXISTS (SELECT 1 FROM photo_watermark_status s WHERE s.photo_url = u.url AND (s.source = 'MANUAL' OR s.score IS NOT NULL))
      LIMIT $1;`,
    [limit]
  );
  const items = res.rows.map((r) => r.url).filter((u) => isFieldPhotoUrl(u));
  console.log(`[Backfill] ${items.length} ảnh chưa có kết quả dò (${WATERMARK_DETECTOR_VERSION}), song song ${concurrency}`);

  let done = 0;
  let failed = 0;
  const started = Date.now();
  let cursor = 0;
  const worker = async (): Promise<void> => {
    while (cursor < items.length) {
      const url = items[cursor++];
      try {
        const buffer = await ReportImageResolver.getImageBuffer(url);
        const r = await WatermarkDetectorService.detectLegacyLogo(buffer);
        await Database.query(
          `INSERT INTO photo_watermark_status (photo_url, has_legacy_watermark, verdict, score, detector_version, detected_at, source)
           VALUES ($1, $2, $3, $4, $5, NOW(), 'DETECTOR')
           ON CONFLICT (photo_url) DO UPDATE
             SET has_legacy_watermark = EXCLUDED.has_legacy_watermark, verdict = EXCLUDED.verdict,
                 score = EXCLUDED.score, detector_version = EXCLUDED.detector_version, detected_at = NOW()
           WHERE photo_watermark_status.source <> 'MANUAL';`,
          [url, r.hasLegacyWatermark, r.verdict, r.score, WATERMARK_DETECTOR_VERSION]
        );
        if (r.verdict === 'UNSURE') console.warn(`[Backfill] NGHI NGỜ score=${r.score.toFixed(2)} ${url}`);
      } catch (err) {
        failed += 1;
        console.error(`[Backfill] Không quét được (ảnh sẽ là NGHI NGỜ tới khi người xác nhận) ${url}:`, err instanceof Error ? err.message : err);
      }
      done += 1;
      if (done % 200 === 0) {
        const rate = done / ((Date.now() - started) / 1000);
        console.log(`[Backfill] ${done}/${items.length} (${rate.toFixed(1)} ảnh/s, lỗi ${failed})`);
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, worker));
  console.log(`[Backfill] Xong ${done} ảnh, lỗi ${failed}, ${Math.round((Date.now() - started) / 1000)}s`);
  return failed;
}

/** Bảng đếm ảnh nghi ngờ theo Zone và 20 hồ sơ nhiều nhất (chỉ đọc). */
async function reportSuspects(): Promise<void> {
  const res = await Database.query<{ zone_id: string | null; parcel_code: string | null; suspect: string; undetected: string }>(
    `WITH per_report AS (
       SELECT b.id, p.zone_id, p.project_parcel_code AS parcel_code, m[1] AS url
         FROM base_survey_reports b
         JOIN parcels p ON p.id = b.parcel_id,
         regexp_matches(b.survey_data_json::text, '(https?://[^"]+\\.(?:jpe?g|png|webp))', 'gi') m
        WHERE b.deleted_at IS NULL
     )
     SELECT pr.zone_id, pr.parcel_code,
            COUNT(DISTINCT pr.url) FILTER (WHERE s.source = 'DETECTOR' AND s.score >= $1 AND s.score < $2) AS suspect,
            COUNT(DISTINCT pr.url) FILTER (WHERE s.photo_url IS NULL OR (s.source = 'DETECTOR' AND s.score IS NULL)) AS undetected
       FROM per_report pr
       LEFT JOIN photo_watermark_status s ON s.photo_url = pr.url
      GROUP BY pr.zone_id, pr.parcel_code
     HAVING COUNT(DISTINCT pr.url) FILTER (WHERE s.source = 'DETECTOR' AND s.score >= $1 AND s.score < $2) > 0
         OR COUNT(DISTINCT pr.url) FILTER (WHERE s.photo_url IS NULL OR (s.source = 'DETECTOR' AND s.score IS NULL)) > 0
      ORDER BY 3 DESC, 4 DESC;`,
    [SCORE_UNSURE, SCORE_WATERMARKED]
  );
  const byZone = new Map<string, { reports: number; suspect: number; undetected: number }>();
  for (const r of res.rows) {
    const z = byZone.get(r.zone_id || '(không Zone)') || { reports: 0, suspect: 0, undetected: 0 };
    z.reports += 1;
    z.suspect += Number(r.suspect);
    z.undetected += Number(r.undetected);
    byZone.set(r.zone_id || '(không Zone)', z);
  }
  console.log(`\n[Backfill] Ảnh cần người xác nhận theo Zone (điểm ${SCORE_UNSURE}–${SCORE_WATERMARKED} / chưa dò):`);
  for (const [zone, z] of [...byZone.entries()].sort()) {
    console.log(`  ${zone}: ${z.reports} hồ sơ · ${z.suspect} ảnh nghi ngờ · ${z.undetected} ảnh chưa dò (sẽ dò khi chạy backfill hoặc khi xem trước)`);
  }
  console.log('\n[Backfill] 20 hồ sơ nhiều ảnh cần xác nhận nhất:');
  for (const r of res.rows.slice(0, 20)) {
    console.log(`  ${r.parcel_code} (${r.zone_id}): ${r.suspect} nghi ngờ · ${r.undetected} chưa dò`);
  }
}

async function main(): Promise<void> {
  let failed = 0;
  if (!process.argv.includes('--report-only')) {
    failed = await detectMissing(argNumber('concurrency', 6), argNumber('limit', 1_000_000));
  }
  await reportSuspects();
  process.exit(failed > 0 ? 2 : 0);
}

main().catch((err: unknown) => {
  console.error('[Backfill] Lỗi không mong đợi:', err);
  process.exit(1);
});
