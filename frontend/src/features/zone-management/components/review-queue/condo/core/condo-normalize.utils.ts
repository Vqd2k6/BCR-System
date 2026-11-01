/**
 * Tiện ích chuẩn hóa dữ liệu thô cho Studio Chung cư.
 * Dữ liệu đo đạc thiếu phải giữ nguyên là thiếu (null/undefined), tuyệt đối không gán số mặc định.
 */

export const isRecord = (val: unknown): val is Record<string, unknown> =>
  typeof val === 'object' && val !== null && !Array.isArray(val);

export const toRecord = (val: unknown): Record<string, unknown> => (isRecord(val) ? val : {});

export function toNumberOrNull(val: unknown): number | null {
  if (val === null || val === undefined || val === '') return null;
  const num = Number(val);
  return Number.isFinite(num) ? num : null;
}

export function toOptionalNumber(val: unknown): number | undefined {
  return toNumberOrNull(val) ?? undefined;
}

export function firstNonEmptyString(...values: unknown[]): string {
  for (const val of values) {
    if (typeof val === 'string' && val.trim() !== '') return val;
    if (typeof val === 'number' && Number.isFinite(val)) return String(val);
  }
  return '';
}

/** KSV lưu số đo mặc định là 0, nên 0 tính là chưa có số đo. */
export function isFilled(val: unknown): boolean {
  return typeof val === 'number' ? val > 0 : firstNonEmptyString(val) !== '';
}

/** Ô phụ thuộc điều kiện vẫn phải hiện khi đang có dữ liệu, để không giấu chứng cứ đã ghi. */
export function isInterviewNotesVisible(level: unknown, notes: unknown): boolean {
  return Number(level) > 0 || isFilled(notes);
}

/** Thứ tự tự nhiên của mã Z/E/D: `Z-02` đứng trước `Z-10`. */
export function compareCodes(a: string, b: string): number {
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' });
}

export function toStringArray(val: unknown): string[] {
  if (!Array.isArray(val)) return [];
  return val
    .map((item) => (typeof item === 'string' ? item : firstNonEmptyString(toRecord(item).url, toRecord(item).photoUrl)))
    .filter(Boolean);
}
