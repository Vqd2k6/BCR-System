/**
 * ============================================================================
 * LEGACY WATERMARK INDEX
 * Nhận diện ảnh đã được PWA cũ dập watermark sẵn vào pixel (logo + mã + giờ). Ảnh loại này
 * KHÔNG được dập thêm ở BE (tránh chồng 2 lớp watermark lên chứng cứ pháp lý).
 *
 * Luật (chốt 13/11/2026, thay luật đoán theo ngày):
 *   - Nguồn duy nhất là photo_watermark_status: kết quả dò logo trên pixel (DETECTOR) hoặc người xác nhận (MANUAL).
 *   - Mọi ảnh raster được in đều được dò, kể cả sơ đồ CAD chụp tay, bản vẽ, biên bản
 *     (trước đây URL có chữ "cad" bị loại khỏi bộ dò → C&C-05-B-0038 bị dập 2 lớp ở sơ đồ tầng trệt).
 *   - Điểm dò phân loại theo verdictOfScore (ngưỡng logo-v2). Điểm cũ của logo-v1 được phân loại lại.
 *   - Lưng chừng hoặc dò thất bại → NGHI NGỜ: report chặn xuất tới khi người xác nhận từng ảnh.
 *   - Hệ thống không bao giờ tự đoán (không còn luật ngày tải lên).
 *   - Lượt render bản Rev đã phát hành đọc trạng thái đóng băng trong snapshot, không đọc bảng sống.
 * ============================================================================
 */

import type { PoolClient } from 'pg';
import { Database } from '../../../database/db';
import { ReportImageResolver } from './report-image-resolver.service';
import { currentRenderImageScope } from './report-image-scope';
import { WATERMARK_DETECTOR_VERSION, WatermarkDetectorService, verdictOfScore } from './watermark-detector.service';

const DETECT_CONCURRENCY = 4;

export type LegacyWatermarkStatus = 'LEGACY' | 'CLEAN' | 'SUSPECT';
export type LegacyWatermarkSource = 'DETECTOR' | 'MANUAL' | 'FROZEN';
/** Vì sao ảnh nghi ngờ: điểm lưng chừng, dò thất bại, hoặc chưa từng được dò. */
export type LegacyWatermarkSuspectReason = 'UNSURE' | 'DETECT_FAILED' | 'NOT_DETECTED';

export interface LegacyWatermarkInfo {
  status: LegacyWatermarkStatus;
  source: LegacyWatermarkSource;
  score: number | null;
  suspectReason: LegacyWatermarkSuspectReason | null;
}

export interface LegacyWatermarkLoadOptions {
  /** Dò logo cho URL chưa có kết quả (tải ảnh nếu cần). Mặc định false: chỉ đọc kết quả đã lưu. */
  detect?: boolean;
}

/** Ảnh raster có thể mang dấu PWA cũ: mọi JPEG/PNG/WEBP (kể cả sơ đồ CAD chụp tay, biên bản). PDF và data URI thì không. */
export function isFieldPhotoUrl(url: string): boolean {
  if (!url || url.startsWith('data:')) return false;
  const clean = url.split('?')[0];
  return /\.(jpe?g|png|webp)$/i.test(clean);
}

function infoFromRow(row: { has_legacy_watermark: boolean; score: string | number | null; source: string | null }): LegacyWatermarkInfo {
  const score = row.score === null || row.score === undefined ? null : Number(row.score);
  if (row.source === 'MANUAL') {
    return { status: row.has_legacy_watermark ? 'LEGACY' : 'CLEAN', source: 'MANUAL', score, suspectReason: null };
  }
  if (score === null || !Number.isFinite(score)) {
    return { status: 'SUSPECT', source: 'DETECTOR', score: null, suspectReason: 'DETECT_FAILED' };
  }
  const verdict = verdictOfScore(score);
  if (verdict === 'WATERMARKED') return { status: 'LEGACY', source: 'DETECTOR', score, suspectReason: null };
  if (verdict === 'CLEAN') return { status: 'CLEAN', source: 'DETECTOR', score, suspectReason: null };
  return { status: 'SUSPECT', source: 'DETECTOR', score, suspectReason: 'UNSURE' };
}

export class LegacyWatermarkIndex {
  /** Kết quả mới nhất đọc từ DB / vừa dò, theo URL. Mỗi lượt load đọc lại DB để thấy xác nhận tay mới. */
  private static infoByUrl = new Map<string, LegacyWatermarkInfo>();
  /** Ảnh dò thất bại trong tiến trình này (không lưu DB để lượt sau dò lại). */
  private static failedUrls = new Set<string>();

  /** Trạng thái của URL; undefined = không phải ảnh raster hoặc chưa nạp/chưa dò. */
  public static statusOf(url?: string): LegacyWatermarkInfo | undefined {
    if (!url) return undefined;
    const frozen = currentRenderImageScope()?.frozenLegacy;
    if (frozen) {
      const v = frozen.get(url);
      if (v !== undefined) return { status: v ? 'LEGACY' : 'CLEAN', source: 'FROZEN', score: null, suspectReason: null };
    }
    const info = this.infoByUrl.get(url);
    if (info) return info;
    if (this.failedUrls.has(url)) return { status: 'SUSPECT', source: 'DETECTOR', score: null, suspectReason: 'DETECT_FAILED' };
    if (isFieldPhotoUrl(url)) return { status: 'SUSPECT', source: 'DETECTOR', score: null, suspectReason: 'NOT_DETECTED' };
    return undefined;
  }

  /** Chỉ true khi chắc chắn có dấu cũ (dò ≥ ngưỡng hoặc người xác nhận). Nghi ngờ KHÔNG được coi là có dấu. */
  public static has(url?: string): boolean {
    return this.statusOf(url)?.status === 'LEGACY';
  }

  /**
   * Trạng thái dấu cũ đã chốt (LEGACY / CLEAN) của các URL, để đóng băng vào snapshot Rev.
   * Ảnh nghi ngờ không được ghi: lượt render Rev sẽ chặn phát hành nếu còn ảnh nghi ngờ.
   */
  public static async decisionsForSnapshot(
    urls: string[],
    client: PoolClient
  ): Promise<Record<string, boolean>> {
    const pending = [...new Set(urls.filter((u) => u && isFieldPhotoUrl(u)))];
    if (pending.length === 0) return {};
    const res = await client.query<{ photo_url: string; has_legacy_watermark: boolean; score: string | null; source: string | null }>(
      `SELECT photo_url, has_legacy_watermark, score, source FROM photo_watermark_status WHERE photo_url = ANY($1::text[]);`,
      [pending]
    );
    const out: Record<string, boolean> = {};
    for (const row of res.rows) {
      const info = infoFromRow(row);
      if (info.status === 'LEGACY') out[row.photo_url] = true;
      else if (info.status === 'CLEAN') out[row.photo_url] = false;
    }
    return out;
  }

  /** Cập nhật ngay sau khi người xác nhận (API xác nhận), để lượt render kế tiếp trong tiến trình thấy luôn. */
  public static rememberManual(url: string, hasLegacyWatermark: boolean): void {
    this.failedUrls.delete(url);
    this.infoByUrl.set(url, { status: hasLegacyWatermark ? 'LEGACY' : 'CLEAN', source: 'MANUAL', score: null, suspectReason: null });
  }

  /**
   * Nạp trạng thái dấu cũ cho danh sách URL. Luồng report gọi với { detect: true } sau khi ảnh đã nạp
   * vào kho của lượt render. Bộ dò chạy lại không ghi đè dòng MANUAL.
   */
  public static async load(urls: string[], options: LegacyWatermarkLoadOptions = {}): Promise<void> {
    const pending = [...new Set(urls.filter((u) => u && isFieldPhotoUrl(u)))];
    if (pending.length === 0) return;

    const stats = { legacy: 0, clean: 0, suspect: 0, manual: 0, detectedNow: 0, detectFailed: 0 };
    const resolved = new Set<string>();

    try {
      const saved = await Database.query<{ photo_url: string; has_legacy_watermark: boolean; score: string | null; source: string | null }>(
        `SELECT photo_url, has_legacy_watermark, score, source
           FROM photo_watermark_status
          WHERE photo_url = ANY($1::text[]);`,
        [pending]
      );
      for (const row of saved.rows) {
        const info = infoFromRow(row);
        // Dòng DETECTOR không có điểm là dữ liệu hỏng: để lượt dò dưới đây thử lại.
        if (info.source === 'DETECTOR' && info.suspectReason === 'DETECT_FAILED') continue;
        resolved.add(row.photo_url);
        this.failedUrls.delete(row.photo_url);
        this.infoByUrl.set(row.photo_url, info);
      }
    } catch (err) {
      console.error('[LegacyWatermark:load] Không đọc được photo_watermark_status, các ảnh sẽ bị coi là nghi ngờ', err);
    }

    if (options.detect) {
      const toDetect = pending.filter((u) => !resolved.has(u));
      let cursor = 0;
      const worker = async (): Promise<void> => {
        while (cursor < toDetect.length) {
          const url = toDetect[cursor++];
          try {
            const result = await WatermarkDetectorService.detectLegacyLogo(await ReportImageResolver.getImageBuffer(url));
            await Database.query(
              `INSERT INTO photo_watermark_status (photo_url, has_legacy_watermark, verdict, score, detector_version, detected_at, source)
               VALUES ($1, $2, $3, $4, $5, NOW(), 'DETECTOR')
               ON CONFLICT (photo_url) DO UPDATE
                 SET has_legacy_watermark = EXCLUDED.has_legacy_watermark, verdict = EXCLUDED.verdict,
                     score = EXCLUDED.score, detector_version = EXCLUDED.detector_version, detected_at = NOW()
               WHERE photo_watermark_status.source <> 'MANUAL';`,
              [url, result.hasLegacyWatermark, result.verdict, result.score, WATERMARK_DETECTOR_VERSION]
            );
            stats.detectedNow += 1;
            this.failedUrls.delete(url);
            this.infoByUrl.set(url, infoFromRow({ has_legacy_watermark: result.hasLegacyWatermark, score: result.score, source: 'DETECTOR' }));
          } catch (err) {
            stats.detectFailed += 1;
            this.failedUrls.add(url);
            this.infoByUrl.delete(url);
            console.error(`[LegacyWatermark:detect] Không dò được logo, ảnh bị coi là NGHI NGỜ tới khi người xác nhận: ${url}`, err);
          }
        }
      };
      await Promise.all(Array.from({ length: Math.min(DETECT_CONCURRENCY, toDetect.length) }, worker));
    }

    for (const u of pending) {
      const info = this.statusOf(u);
      if (!info) continue;
      if (info.source === 'MANUAL') stats.manual += 1;
      if (info.status === 'LEGACY') stats.legacy += 1;
      else if (info.status === 'CLEAN') stats.clean += 1;
      else stats.suspect += 1;
    }
    if (stats.suspect > 0 || stats.detectedNow > 0 || stats.detectFailed > 0) {
      console.info('[LegacyWatermark:load] Trạng thái dấu cũ', { total: pending.length, ...stats });
    }
  }
}
