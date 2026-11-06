/**
 * ============================================================================
 * LEGACY WATERMARK INDEX
 * Nhận diện ảnh hiện trường đã được FE dập watermark sẵn vào pixel (logo + mã + giờ)
 * trước mốc FE chuyển sang upload ảnh sạch. Ảnh loại này KHÔNG được dập thêm ở BE
 * (tránh chồng 2 lớp watermark lên chứng cứ pháp lý).
 *
 * Nguồn xác định (theo thứ tự):
 *   1. survey_photo_registry.created_at < mốc cutover (khớp đúng photo_url)
 *   2. Mốc thời gian upload 13 chữ số (ms) nhúng trong tên file chuẩn hóa: ..._1790650546342_xxxxxx.jpg
 *
 * "Ảnh cũ" là thuộc tính của URL (không phụ thuộc hồ sơ) → Set dùng chung an toàn giữa các lượt render.
 * ============================================================================
 */

import { Database } from '../../../database/db';

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

  /** Nạp trạng thái ảnh cũ cho danh sách URL của một lượt render (chỉ truy vấn URL chưa kiểm tra). */
  public static async load(urls: string[]): Promise<void> {
    const pending = urls.filter((u) => u && !this.checkedUrls.has(u));
    if (pending.length === 0) return;

    try {
      // Hai nguồn, ảnh thỏa MỘT trong hai là ảnh cũ:
      //  1. Registry có bản ghi trước cutover.
      //  2. Mốc ms trong tên file trước cutover. Bắt buộc giữ nguồn này cho cả URL có trong registry:
      //     đợt khôi phục ảnh 02–04/11/2026 ghi lại 36 file cũ (đã có watermark FE) dưới dạng REPLACE
      //     với created_at sau cutover — chỉ tên file còn giữ đúng thời điểm gốc.
      const result = await Database.query<{ photo_url: string }>(
        `SELECT DISTINCT photo_url
           FROM survey_photo_registry
          WHERE photo_url = ANY($1::text[])
            AND created_at < $2;`,
        [pending, new Date(LEGACY_WATERMARK_CUTOVER_MS).toISOString()]
      );

      let byRegistry = 0;
      for (const row of result.rows) {
        this.legacyUrls.add(row.photo_url);
        byRegistry += 1;
      }

      let byFilename = 0;
      for (const u of pending) {
        if (this.legacyUrls.has(u)) continue;
        const ms = uploadMsFromFilename(u);
        if (ms !== undefined && ms < LEGACY_WATERMARK_CUTOVER_MS) {
          this.legacyUrls.add(u);
          byFilename += 1;
        }
      }
      for (const u of pending) this.checkedUrls.add(u);

      if (byRegistry + byFilename > 0) {
        console.info(
          `[LegacyWatermark:load] ${byRegistry} ảnh cũ theo registry, ${byFilename} theo mốc trong tên file, trên ${pending.length} URL → không dập thêm watermark BE`
        );
      }
    } catch (err) {
      // Không đánh dấu checked để lượt render sau thử lại; has() vẫn dùng được nguồn tên file.
      console.error('[LegacyWatermark:load] Không truy vấn được survey_photo_registry', err);
    }
  }
}
