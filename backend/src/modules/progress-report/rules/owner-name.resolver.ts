import type { RawProgressRow } from '../progress-report.types';
import { firstText, getPath } from './json-reader';
import { hasIdentityOverride, isUnknownOwnerPhone, resolveIdentityValue } from '../../audit/condo/condo-absence.resolver';

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

/**
 * Căn hộ đã có hồ sơ: JSON hồ sơ (sau diff của Admin) là nguồn sự thật cho định danh.
 * - Có khóa trong lớp phủ `adminIdentityOverrides` (kể cả null = đã xóa) → chỉ dùng lớp phủ.
 * - Có khóa trong JSON (kể cả rỗng) → không rơi về cột building_units, vì diff không đồng bộ cột đó.
 * Trả `undefined` khi không thuộc trường hợp này để dùng thứ tự cũ.
 */
function resolveCondoIdentity(row: RawProgressRow, key: 'ownerName' | 'ownerPhone'): string | undefined {
  const json = row.reportJson;
  if (row.kind !== 'CONDO_UNIT' || !row.reportId || !json) return undefined;
  if (hasIdentityOverride(json, key)) return firstText(resolveIdentityValue(json, key));
  if (key in json) return firstText(json[key]);
  return undefined;
}

export function resolveOwnerName(row: RawProgressRow): string {
  const json = row.reportJson;
  const condoValue = resolveCondoIdentity(row, 'ownerName');
  if (condoValue !== undefined) return cleanOwnerName(condoValue);
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
  const condoValue = resolveCondoIdentity(row, 'ownerPhone');
  const phone =
    condoValue !== undefined
      ? condoValue
      : firstText(getPath(row.reportJson, 'ownerPhone'), row.kind === 'CONDO_UNIT' ? row.unitOwnerPhone : row.parcelOwnerPhone);
  // SĐT KSV điền cho đủ form (1111, 0987654321...) không phải dữ liệu thật
  return isUnknownOwnerPhone(phone) ? '' : phone;
}
