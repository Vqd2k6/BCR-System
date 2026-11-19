/**
 * Bộ đếm dữ liệu di động theo ngày (localStorage), để KSV chụp màn hình gửi về khi máy tốn dữ liệu bất thường.
 * - API: cộng theo endpoint rút gọn (id/số được thay bằng :id).
 * - Upload ảnh: cộng dung lượng mỗi lượt gửi (kể cả lượt lỗi), tách riêng R2 trực tiếp và qua backend.
 * - Tải xuống ngoài API (ảnh, tile, mã ứng dụng): Resource Timing, xem startResourceMeter.
 * Ảnh R2 khác nguồn không đo được dung lượng (r2.dev không gửi Timing-Allow-Origin) nên chỉ đếm lượt.
 */

const STORAGE_KEY = 'metro2_data_meter';
const KEEP_DAYS = 7;

export interface DataMeterEntry {
  key: string;
  bytes: number;
  count: number;
}

type DayBucket = Record<string, { bytes: number; count: number }>;
type MeterStore = Record<string, DayBucket>;

const todayVn = (): string => {
  const d = new Date(Date.now() + 7 * 3600 * 1000);
  return d.toISOString().slice(0, 10);
};

const readStore = (): MeterStore => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? (parsed as MeterStore) : {};
  } catch (err: unknown) {
    console.error('[dataMeter:readStore] Không đọc được bộ đếm dữ liệu:', err);
    return {};
  }
};

let pending: MeterStore | null = null;
let flushTimer: ReturnType<typeof setTimeout> | null = null;

const flush = () => {
  flushTimer = null;
  if (!pending) return;
  try {
    const store = readStore();
    for (const [day, bucket] of Object.entries(pending)) {
      const target = store[day] || (store[day] = {});
      for (const [key, v] of Object.entries(bucket)) {
        const cur = target[key] || { bytes: 0, count: 0 };
        target[key] = { bytes: cur.bytes + v.bytes, count: cur.count + v.count };
      }
    }
    const days = Object.keys(store).sort();
    while (days.length > KEEP_DAYS) delete store[days.shift() as string];
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch (err: unknown) {
    console.error('[dataMeter:flush] Không lưu được bộ đếm dữ liệu:', err);
  }
  pending = null;
};

/** Rút gọn URL API: bỏ query, thay UUID / số / mã thửa bằng :id */
export function normalizeMeterKey(method: string, url: string): string {
  const path = (url || '').split('?')[0].replace(/^https?:\/\/[^/]+/, '');
  const norm = path
    .split('/')
    .map((seg) => (/^[0-9a-f]{8}-[0-9a-f-]{27,}$/i.test(seg) || /^-?\d+(\.\d+)?$/.test(seg) || /%26|&/.test(seg) ? ':id' : seg))
    .join('/');
  return `${method.toUpperCase()} ${norm}`;
}

const addToBucket = (key: string, bytes: number) => {
  const day = todayVn();
  pending = pending || {};
  const bucket = pending[day] || (pending[day] = {});
  const cur = bucket[key] || { bytes: 0, count: 0 };
  bucket[key] = { bytes: cur.bytes + bytes, count: cur.count + 1 };
  if (!flushTimer) flushTimer = setTimeout(flush, 3000);
};

export function recordDataUsage(key: string, bytes: number): void {
  if (!Number.isFinite(bytes) || bytes <= 0) return;
  addToBucket(key, bytes);
}

/** Chỉ đếm lượt (không biết dung lượng), vd. ảnh R2 khác nguồn mà trình duyệt ẩn kích thước */
export function recordDataCount(key: string): void {
  addToBucket(key, 0);
}

/** Số byte UTF-8 của chuỗi, không cấp phát bộ đệm (nháp có thể vài MB) */
export function utf8Length(s: string): number {
  let n = 0;
  for (let i = 0; i < s.length; i++) {
    const c = s.charCodeAt(i);
    if (c < 0x80) n += 1;
    else if (c < 0x800) n += 2;
    else if (c >= 0xd800 && c < 0xdc00) {
      n += 4;
      i++;
    } else n += 3;
  }
  return n;
}

/** Ước lượng phần đầu multipart của mỗi trường FormData (boundary + Content-Disposition) */
const MULTIPART_PART_OVERHEAD = 160;

/** Dung lượng body gửi đi: chuỗi JSON, FormData (gồm tệp), Blob, ArrayBuffer, URLSearchParams */
export function estimateBodyBytes(body: unknown): number {
  if (body === null || body === undefined) return 0;
  if (typeof body === 'string') return utf8Length(body);
  if (typeof Blob !== 'undefined' && body instanceof Blob) return body.size;
  if (body instanceof ArrayBuffer) return body.byteLength;
  if (ArrayBuffer.isView(body)) return body.byteLength;
  if (typeof URLSearchParams !== 'undefined' && body instanceof URLSearchParams) return utf8Length(body.toString());
  if (typeof FormData !== 'undefined' && body instanceof FormData) {
    let total = 0;
    body.forEach((value, name) => {
      total += MULTIPART_PART_OVERHEAD + utf8Length(name) + (typeof value === 'string' ? utf8Length(value) : value.size);
    });
    return total;
  }
  return 0;
}

const RESOURCE_KIND: Record<string, string> = {
  img: 'ảnh',
  image: 'ảnh',
  css: 'mã ứng dụng',
  script: 'mã ứng dụng',
  link: 'mã ứng dụng',
  fetch: 'tệp',
  other: 'tệp',
};

let resourceMeterStarted = false;

/**
 * Đếm tài nguyên tải xuống ngoài API (ảnh, tile bản đồ, mã ứng dụng) bằng Resource Timing.
 * - transferSize > 0: đo được thật (cùng nguồn, hoặc máy chủ gửi Timing-Allow-Origin).
 * - Ảnh khác nguồn có transferSize = 0 (R2 r2.dev không gửi Timing-Allow-Origin, hoặc lấy từ cache đĩa):
 *   chỉ đếm lượt để thấy ảnh bị tải lặp; dung lượng xem bằng DevTools.
 * Bỏ qua XHR (axios đã đếm ở interceptor), mọi URL /api/ và lượt PUT presign lên R2 (hàng đợi đã đếm).
 */
export function startResourceMeter(): void {
  if (resourceMeterStarted || typeof PerformanceObserver === 'undefined' || typeof window === 'undefined') return;
  resourceMeterStarted = true;
  try {
    const observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries() as PerformanceResourceTiming[]) {
        const url = entry.name;
        if (entry.initiatorType === 'xmlhttprequest' || entry.initiatorType === 'beacon') continue;
        if (!/^https?:/i.test(url) || url.includes('/api/') || /X-Amz-Signature=/i.test(url)) continue;
        let host = '';
        try {
          host = new URL(url).host;
        } catch (err: unknown) {
          console.error('[dataMeter:ResourceMeter] URL tài nguyên không hợp lệ:', url, err);
          continue;
        }
        const kind = RESOURCE_KIND[entry.initiatorType] || 'tệp';
        if (entry.transferSize > 0) {
          recordDataUsage(`TẢI ${kind} (${host})`, entry.transferSize);
        } else if (kind === 'ảnh' && host !== window.location.host && entry.encodedBodySize === 0) {
          recordDataCount(`TẢI ảnh (${host}) — không đo được dung lượng, gồm cả lượt lấy từ cache`);
        }
      }
    });
    observer.observe({ type: 'resource', buffered: true });
  } catch (err: unknown) {
    console.error('[dataMeter:ResourceMeter] Không bật được bộ đếm tài nguyên:', err);
  }
}

/** Top nguồn tốn dữ liệu trong ngày (mặc định hôm nay) */
export function getDataUsageTop(limit = 10, day: string = todayVn()): { day: string; totalBytes: number; entries: DataMeterEntry[] } {
  flush();
  const bucket = readStore()[day] || {};
  const entries = Object.entries(bucket)
    .map(([key, v]) => ({ key, bytes: v.bytes, count: v.count }))
    .sort((a, b) => b.bytes - a.bytes);
  return { day, totalBytes: entries.reduce((s, e) => s + e.bytes, 0), entries: entries.slice(0, limit) };
}

export const formatBytes = (n: number): string =>
  n >= 1024 ** 3 ? `${(n / 1024 ** 3).toFixed(2)} GB` : n >= 1024 ** 2 ? `${(n / 1024 ** 2).toFixed(1)} MB` : `${Math.round(n / 1024)} KB`;
