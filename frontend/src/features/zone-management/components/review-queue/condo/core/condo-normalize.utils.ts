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

export function toStringArray(val: unknown): string[] {
  if (!Array.isArray(val)) return [];
  return val
    .map((item) => (typeof item === 'string' ? item : firstNonEmptyString(toRecord(item).url, toRecord(item).photoUrl)))
    .filter(Boolean);
}
