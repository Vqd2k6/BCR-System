/**
 * Bộ đếm dữ liệu di động theo ngày (localStorage), để KSV chụp màn hình gửi về khi máy tốn dữ liệu bất thường.
 * - API: cộng theo endpoint rút gọn (id/số được thay bằng :id).
 * - Upload ảnh: cộng dung lượng mỗi lượt gửi (kể cả lượt lỗi), tách riêng R2 trực tiếp và qua backend.
 * Ảnh R2 tải xuống để hiển thị không đo được (trình duyệt ẩn kích thước tài nguyên khác nguồn).
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

export function recordDataUsage(key: string, bytes: number): void {
  if (!Number.isFinite(bytes) || bytes <= 0) return;
  const day = todayVn();
  pending = pending || {};
  const bucket = pending[day] || (pending[day] = {});
  const cur = bucket[key] || { bytes: 0, count: 0 };
  bucket[key] = { bytes: cur.bytes + bytes, count: cur.count + 1 };
  if (!flushTimer) flushTimer = setTimeout(flush, 3000);
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
