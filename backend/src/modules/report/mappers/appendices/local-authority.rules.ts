import { standardizeWard } from '../../../audit/utils/residential-address.standards';

/**
 * Đại diện địa phương cố định theo địa bàn, dùng khi hồ sơ không ghi nhận người chứng kiến.
 * ZONE_09 (ST05): phải tuyến là P. Nhiêu Lộc; trái tuyến là P. Hòa Hưng và P. Tân Hòa.
 * Ngoài bảng quy tắc trả chuỗi rỗng, không suy đoán.
 */

const normalizeName = (value: string): string =>
  value.normalize('NFC').toLowerCase().replace(/hoà/g, 'hòa').replace(/\s+/g, ' ').trim();

export function resolveLocalRepresentative(
  zoneId: string | null | undefined,
  ward: string | null | undefined,
  street: string | null | undefined,
  district?: string | null
): string {
  if ((zoneId ?? '').trim().toUpperCase() !== 'ZONE_09') return '';

  const wardName = normalizeName(standardizeWard(ward, district).ward);
  if (wardName.includes('nhiêu lộc')) return 'Lê Văn Sơn';
  if (wardName.includes('tân hòa')) return 'Nguyễn Tấn Phát';
  if (wardName.includes('hòa hưng')) {
    return normalizeName(street ?? '').includes('bắc hải') ? 'Nguyễn Cao Vân' : 'Lương Quang Thuận';
  }
  return '';
}
