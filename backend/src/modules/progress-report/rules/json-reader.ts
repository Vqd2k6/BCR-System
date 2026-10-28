/**
 * Tiện ích thuần đọc giá trị an toàn từ survey_data_json (Zero-Any, không side-effect).
 */

export type Json = Record<string, unknown>;

export function getPath(source: Json | null | undefined, path: string): unknown {
  if (!source) return undefined;
  let cur: unknown = source;
  for (const key of path.split('.')) {
    if (cur && typeof cur === 'object' && !Array.isArray(cur)) {
      cur = (cur as Json)[key];
    } else {
      return undefined;
    }
  }
  return cur;
}

export function text(v: unknown): string {
  if (v === null || v === undefined) return '';
  if (typeof v === 'string') return v.replace(/\s+/g, ' ').trim();
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  return '';
}

export function firstText(...values: unknown[]): string {
  for (const v of values) {
    const t = text(v);
    if (t) return t;
  }
  return '';
}

/** Đọc số kể cả dạng chuỗi có đơn vị ("38.7m", "28,0 m"). */
export function toNumber(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null;
  if (typeof v === 'number') return Number.isFinite(v) ? v : null;
  const cleaned = String(v).replace(',', '.').replace(/[^\d.-]/g, '');
  if (!cleaned || cleaned === '-' || cleaned === '.') return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

export function firstNumber(...values: unknown[]): number | null {
  for (const v of values) {
    const n = toNumber(v);
    if (n !== null) return n;
  }
  return null;
}

export function arrayLength(v: unknown): number {
  return Array.isArray(v) ? v.length : 0;
}

export function stripPrefix(value: string, prefixPattern: RegExp): string {
  return value.replace(prefixPattern, '').trim();
}
