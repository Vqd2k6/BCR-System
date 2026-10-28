import type { RawProgressRow } from '../progress-report.types';
import { firstText, getPath } from './json-reader';

/**
 * Cột J – Chủ sở hữu: lấy đúng tên KSV đã nhập, loại bỏ placeholder địa chính.
 */
const PLACEHOLDER = /^(chủ\s+hộ\s+thửa|chủ\s+sở\s+hữu\s+thửa|chưa\s+cập\s+nhật|chưa\s+rõ|không\s+rõ|--+|n\/a)/i;
/** Giá trị KSV nhập mang nghĩa "không có thông tin". */
const EMPTY_MEANING = /^(không|không có|ko|k|x|-|\.|0)$/i;

export function cleanOwnerName(v: string): string {
  const t = v.replace(/\s+/g, ' ').trim();
  if (!t || PLACEHOLDER.test(t) || EMPTY_MEANING.test(t) || /tờ\s*bản\s*đồ/i.test(t)) return '';
  return t;
}

export function resolveOwnerName(row: RawProgressRow): string {
  const json = row.reportJson;
  const candidates = [
    firstText(getPath(json, 'ownerName')),
    firstText(getPath(json, 'signatures.ownerRepresentative.fullName')),
    row.kind === 'CONDO_UNIT' ? row.unitOwnerName ?? '' : row.parcelOwnerName ?? '',
  ];
  for (const c of candidates) {
    const cleaned = cleanOwnerName(c);
    if (cleaned) return cleaned;
  }
  return '';
}

export function resolveOwnerPhone(row: RawProgressRow): string {
  return firstText(
    getPath(row.reportJson, 'ownerPhone'),
    row.kind === 'CONDO_UNIT' ? row.unitOwnerPhone : row.parcelOwnerPhone
  );
}
