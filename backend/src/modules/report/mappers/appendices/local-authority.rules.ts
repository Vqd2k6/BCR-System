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

export type LocalAuthoritySource = 'SURVEYOR' | 'PARCEL' | 'RULE' | 'NONE';

export interface ResolvedLocalAuthority {
  name: string;
  role: string;
  phone: string;
  source: LocalAuthoritySource;
}

/** Dòng parcels (hoặc dòng report JOIN parcels) mang 3 cột CQĐP cấp thửa, đặt tên theo alias parcel_local_authority_*. */
export interface LocalAuthorityParcelFields {
  parcel_local_authority_name?: string | null;
  parcel_local_authority_role?: string | null;
  parcel_local_authority_phone?: string | null;
  zone_id?: string | null;
  ward?: string | null;
  street?: string | null;
  district?: string | null;
}

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const text = (v: unknown): string => (typeof v === 'string' ? v.trim() : '');
const firstText = (...values: unknown[]): string => values.map(text).find(Boolean) ?? '';

/**
 * Người làm chứng / đại diện CQĐP của một hồ sơ, thứ tự ưu tiên:
 *   1. KSV ghi trong survey_data_json (luôn thắng, không bao giờ bị ghi đè)
 *   2. Giá trị gán ở cấp thửa (parcels.local_authority_*, do Zone Admin gán hàng loạt)
 *   3. Quy tắc địa bàn cố định (ZONE_09)
 * Dùng chung cho Phụ lục 3-4 và màn Thẩm định để không lệch khóa (title/role).
 */
export function resolveLocalAuthority(json: unknown, row: LocalAuthorityParcelFields): ResolvedLocalAuthority {
  const j = isRecord(json) ? json : {};
  const sig = isRecord(j.signatures) ? j.signatures : {};
  const la = isRecord(sig.localAuthority) ? sig.localAuthority : {};
  const witnessInfo = isRecord(j.witnessInfo) ? j.witnessInfo : {};
  const absentee = isRecord(j.absenteeInfo) ? j.absenteeInfo : {};

  const surveyorName = firstText(la.fullName, sig.witnessName, witnessInfo.name, j.witnessName, absentee.witnessName);
  if (surveyorName) {
    return {
      name: surveyorName,
      role: firstText(la.title, la.role, sig.witnessRole, witnessInfo.role, j.witnessRole, absentee.witnessRole),
      phone: firstText(la.phone, sig.witnessPhone, witnessInfo.phone, j.witnessPhone, absentee.witnessPhone),
      source: 'SURVEYOR',
    };
  }

  const parcelName = text(row.parcel_local_authority_name);
  if (parcelName) {
    return {
      name: parcelName,
      role: text(row.parcel_local_authority_role),
      phone: text(row.parcel_local_authority_phone),
      source: 'PARCEL',
    };
  }

  const ruleName = resolveLocalRepresentative(
    row.zone_id,
    firstText(j.ward, row.ward),
    firstText(j.street, row.street),
    row.district
  );
  if (ruleName) return { name: ruleName, role: '', phone: '', source: 'RULE' };

  return { name: '', role: '', phone: '', source: 'NONE' };
}
