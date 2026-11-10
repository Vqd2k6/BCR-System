/**
 * ============================================================================
 * LEGACY WATERMARK INDEX
 * Nhận diện ảnh hiện trường đã được FE dập watermark sẵn vào pixel (logo + mã + giờ)
 * trước mốc FE chuyển sang upload ảnh sạch. Ảnh loại này KHÔNG được dập thêm ở BE
 * (tránh chồng 2 lớp watermark lên chứng cứ pháp lý).
 *
 * Nguồn xác định (theo thứ tự):
 *   1. photo_watermark_status: kết quả dò logo trên pixel (WatermarkDetectorService). Đây là nguồn chính:
 *      máy chạy PWA cũ vẫn upload ảnh có dấu sau mốc cutover, và ảnh khôi phục mang ngày ghi mới.
 *   2. Chưa có kết quả và được phép dò (luồng report): dò ngay rồi lưu vào bảng.
 *   3. Dự phòng khi không dò được: survey_photo_registry.created_at < cutover, hoặc mốc ms 13 chữ số
 *      trong tên file chuẩn hóa (..._1790650546342_xxxxxx.jpg) trước cutover.
 *
 * "Ảnh cũ" là thuộc tính của URL (không phụ thuộc hồ sơ) → Set dùng chung an toàn giữa các lượt render.
 * ============================================================================
 */

import { Database } from '../../../database/db';
import { ReportImageResolver } from './report-image-resolver.service';
import { WATERMARK_DETECTOR_VERSION, WatermarkDetectorService } from './watermark-detector.service';

/** Ảnh không phải ảnh hiện trường chụp bằng app (CAD, chữ ký, scan biên bản, bản vẽ): không dò logo. */
const NON_FIELD_PHOTO_PATTERN = /(cad|blueprint|drawing|asbuilt|as-built|signature|chu[-_]?ky|minutes|bien[-_]?ban|\.pdf)(\b|_|\/|\.)/i;
const DETECT_CONCURRENCY = 4;

export interface LegacyWatermarkLoadOptions {
  /** Dò logo cho URL chưa có kết quả (tải ảnh nếu cần). Mặc định false: chỉ đọc kết quả đã lưu. */
  detect?: boolean;
}

export function isFieldPhotoUrl(url: string): boolean {
  if (!url || url.startsWith('data:')) return false;
  const clean = url.split('?')[0];
  if (!/\.(jpe?g)$/i.test(clean)) return false;
  return !NON_FIELD_PHOTO_PATTERN.test(clean);
}

const DEFAULT_CUTOVER_ISO = '2026-10-03T00:00:00+07:00';

function resolveCutoverMs(): number {
  const raw = process.env.REPORT_LEGACY_WATERMARK_CUTOVER || DEFAULT_CUTOVER_ISO;
  const ms = Date.parse(raw);
  if (Number.isNaN(ms)) {
    console.error(`[LegacyWatermark:cutover] Giá trị REPORT_LEGACY_WATERMARK_CUTOVER không hợp lệ: "${raw}", dùng mặc định ${DEFAULT_CUTOVER_ISO}`);
    return Date.parse(DEFAULT_CUTOVER_ISO);
  }
  return ms;
}

export const LEGACY_WATERMARK_CUTOVER_MS = resolveCutoverMs();

/** Mốc ms hợp lệ của dự án (2026-01-01 → 2030-01-01) để không bắt nhầm chuỗi số khác trong tên file. */
const FILENAME_TS_MIN = Date.parse('2026-01-01T00:00:00Z');
const FILENAME_TS_MAX = Date.parse('2030-01-01T00:00:00Z');

function uploadMsFromFilename(url: string): number | undefined {
  const fileName = url.split('?')[0].split('/').pop() || '';
  const matches = fileName.match(/_(\d{13})(?=[_.])/g);
  if (!matches) return undefined;
  for (const m of matches) {
    const ms = Number(m.slice(1));
    if (ms >= FILENAME_TS_MIN && ms < FILENAME_TS_MAX) return ms;
  }
  return undefined;
}

export class LegacyWatermarkIndex {
  private static legacyUrls = new Set<string>();
  private static checkedUrls = new Set<string>();

  public static has(url?: string): boolean {
    if (!url) return false;
    if (this.legacyUrls.has(url)) return true;
    if (this.checkedUrls.has(url)) return false;
    const ms = uploadMsFromFilename(url);
    return ms !== undefined && ms < LEGACY_WATERMARK_CUTOVER_MS;
  }

  /**
   * Nạp trạng thái watermark cũ cho danh sách URL của một lượt render (chỉ xử lý URL chưa kiểm tra).
   * Luồng report gọi với { detect: true } sau khi ảnh đã nạp vào cache của ReportImageResolver.
   */
  public static async load(urls: string[], options: LegacyWatermarkLoadOptions = {}): Promise<void> {
    const pending = [...new Set(urls.filter((u) => u && !this.checkedUrls.has(u)))];
    if (pending.length === 0) return;

    const stats = { detector: 0, detectorClean: 0, detectedNow: 0, unsure: 0, registry: 0, filename: 0, detectFailed: 0 };
    const resolved = new Set<string>();

    // 1. Kết quả dò logo đã lưu (đúng phiên bản bộ dò).
    try {
      const saved = await Database.query<{ photo_url: string; has_legacy_watermark: boolean; verdict: string }>(
        `SELECT photo_url, has_legacy_watermark, verdict
           FROM photo_watermark_status
          WHERE photo_url = ANY($1::text[]) AND detector_version = $2;`,
        [pending, WATERMARK_DETECTOR_VERSION]
      );
      for (const row of saved.rows) {
        resolved.add(row.photo_url);
        if (row.has_legacy_watermark) {
          this.legacyUrls.add(row.photo_url);
          stats.detector += 1;
          if (row.verdict === 'UNSURE') stats.unsure += 1;
        } else {
          stats.detectorClean += 1;
        }
      }
    } catch (err) {
      console.error('[LegacyWatermark:load] Không đọc được photo_watermark_status, dùng luật dự phòng', err);
    }

    // 2. Dò ngay các ảnh hiện trường chưa có kết quả (chỉ khi được phép).
    if (options.detect) {
      const toDetect = pending.filter((u) => !resolved.has(u) && isFieldPhotoUrl(u));
      let cursor = 0;
      const worker = async (): Promise<void> => {
        while (cursor < toDetect.length) {
          const url = toDetect[cursor++];
          try {
            const result = await WatermarkDetectorService.detectLegacyLogo(await ReportImageResolver.getImageBuffer(url));
            await Database.query(
              `INSERT INTO photo_watermark_status (photo_url, has_legacy_watermark, verdict, score, detector_version, detected_at)
               VALUES ($1, $2, $3, $4, $5, NOW())
               ON CONFLICT (photo_url) DO UPDATE
                 SET has_legacy_watermark = EXCLUDED.has_legacy_watermark, verdict = EXCLUDED.verdict,
                     score = EXCLUDED.score, detector_version = EXCLUDED.detector_version, detected_at = NOW();`,
              [url, result.hasLegacyWatermark, result.verdict, result.score, WATERMARK_DETECTOR_VERSION]
            );
            resolved.add(url);
            stats.detectedNow += 1;
            if (result.hasLegacyWatermark) {
              this.legacyUrls.add(url);
              stats.detector += 1;
              if (result.verdict === 'UNSURE') {
                stats.unsure += 1;
                console.warn(`[LegacyWatermark:detect] Ảnh lưng chừng (score ${result.score}), coi như đã có dấu: ${url}`);
              }
            } else {
              stats.detectorClean += 1;
            }
          } catch (err) {
            stats.detectFailed += 1;
            console.error(`[LegacyWatermark:detect] Không dò được logo, dùng luật dự phòng: ${url}`, err);
          }
        }
      };
      await Promise.all(Array.from({ length: Math.min(DETECT_CONCURRENCY, toDetect.length) }, worker));
    }

    // 3. Dự phòng cho URL chưa có kết quả dò: registry trước cutover hoặc mốc ms trong tên file.
    const fallback = pending.filter((u) => !resolved.has(u));
    let fallbackOk = true;
    if (fallback.length > 0) {
      try {
        const result = await Database.query<{ photo_url: string }>(
          `SELECT DISTINCT photo_url
             FROM survey_photo_registry
            WHERE photo_url = ANY($1::text[])
              AND created_at < $2;`,
          [fallback, new Date(LEGACY_WATERMARK_CUTOVER_MS).toISOString()]
        );
        for (const row of result.rows) {
          this.legacyUrls.add(row.photo_url);
          stats.registry += 1;
        }
      } catch (err) {
        fallbackOk = false;
        console.error('[LegacyWatermark:load] Không truy vấn được survey_photo_registry', err);
      }
      for (const u of fallback) {
        if (this.legacyUrls.has(u)) continue;
        const ms = uploadMsFromFilename(u);
        if (ms !== undefined && ms < LEGACY_WATERMARK_CUTOVER_MS) {
          this.legacyUrls.add(u);
          stats.filename += 1;
        }
      }
    }

    // URL dùng luật dự phòng chỉ đánh dấu đã kiểm khi truy vấn registry thành công, để lượt sau thử lại.
    for (const u of pending) {
      if (resolved.has(u) || fallbackOk) this.checkedUrls.add(u);
    }

    if (stats.detector + stats.registry + stats.filename + stats.detectFailed > 0 || stats.detectedNow > 0) {
      console.info('[LegacyWatermark:load] Ảnh đã có watermark cũ → không dập thêm ở BE', { total: pending.length, ...stats });
    }
  }
}
