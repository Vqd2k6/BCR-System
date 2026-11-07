import { getPath, text, type Json } from './json-reader';

/**
 * Địa chỉ chuẩn hóa (survey_data_json.standardizedAddress) là dòng địa chỉ 1 dòng Admin đã chấp nhận / sửa ở Thẩm định
 * hoặc do Đồng bộ địa chỉ hàng loạt ghi; màn Thẩm định và biên bản PDF đều in dòng này. Excel tách nó ra 3 cột.
 * Tách NGUYÊN VĂN: không chuẩn hóa tên đường, không quy đổi phường, không điền thêm.
 */
export interface AddressParts {
  houseNumber: string;
  street: string;
  ward: string;
}

const CITY_SUFFIX = /,?\s*(TP\.?|Thành phố)\s*Hồ\s*Chí\s*Minh\s*\.?\s*$/i;
const WARD_PREFIX = /^phường\s+/i;
const STREET_PREFIX = /^đường\s+/i;
const NUMBER_PREFIX = /^số\s+/i;
const CONDO_PREFIX = /^chung\s*cư\b/i;
/** Số nhà: token có chữ số (VD 497B, 499/10F, 618/6), kèm hậu tố Bis/Ter nếu có. */
const HOUSE_TOKEN = /^(\S*\d\S*(?:\s+(?:bis|ter))?)(?:\s+(.*))?$/i;

export function splitStandardizedAddress(value: unknown): AddressParts | null {
  const raw = text(value).replace(/\s+/g, ' ').trim();
  if (!raw) return null;
  const body = raw.replace(CITY_SUFFIX, '').trim();
  const segments = body.split(',').map((s) => s.trim()).filter(Boolean);
  if (segments.length === 0) return null;

  let houseNumber = '';
  let street = '';
  let ward = '';
  const extras: string[] = [];

  segments.forEach((segment, idx) => {
    if (WARD_PREFIX.test(segment)) {
      if (!ward) ward = segment.replace(WARD_PREFIX, '').trim();
      return;
    }
    if (idx === 0) {
      const first = segment.replace(NUMBER_PREFIX, '').trim();
      // Chung cư (VD "Chung cư 522-588 …"): không đoán số nhà / tên đường từ đoạn này
      if (CONDO_PREFIX.test(first)) return;
      const house = HOUSE_TOKEN.exec(first);
      if (house) {
        houseNumber = house[1];
        street = (house[2] ?? '').replace(STREET_PREFIX, '').trim();
        return;
      }
      if (!STREET_PREFIX.test(segment)) return;
    }
    // Đoạn ngay sau số nhà là tên đường (VD "497B, Cách Mạng Tháng Tám" / "Số 493/2A, Cách Mạng Tháng 8")
    if (!street && (STREET_PREFIX.test(segment) || (idx === 1 && houseNumber))) {
      street = segment.replace(STREET_PREFIX, '').trim();
      return;
    }
    extras.push(segment);
  });

  // Khu phố / ghi chú khác giữ nguyên văn sau tên đường
  if (street && extras.length > 0) street = [street, ...extras].join(', ');
  return { houseNumber, street, ward };
}

/** Phần địa chỉ đã duyệt của một hồ sơ (null khi hồ sơ chưa có địa chỉ chuẩn hóa dạng chuỗi). */
export function readStandardizedParts(json: Json | null | undefined): AddressParts | null {
  const std = getPath(json, 'standardizedAddress');
  return typeof std === 'string' ? splitStandardizedAddress(std) : null;
}
