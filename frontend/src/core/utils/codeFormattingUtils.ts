/**
 * Bộ tiện ích định dạng hiển thị cho Hệ thống khảo sát hiện trạng Metro 2.
 * Thực thi kiến trúc 2 tầng (Dual-Layer Architecture):
 * 1. Tầng Lưu Trữ Ngầm (CSDL / Báo Cáo BCS / Định Danh Ảnh): Giữ 100% mã chuẩn pháp lý (08.01, MEZZ.01, TB01.01).
 * 2. Tầng Hiển Thị Giao Diện (Surveyor CAD / GIS Map): Tối giản hoá ngắn gọn (01, 02, M01, B-0039),
 *    chống tràn ranh giới ô/thửa tuyệt đối.
 */

import { floorCodeToUnitPrefix, resolveBaseFloorCode } from './floorCodeRules';

/**
 * Rút gọn mã căn hộ / vị trí master để hiển thị lọt lòng trong ô CAD trên màn hình Surveyor.
 * Mã lưu trữ ngầm trong CSDL vẫn là "08.01", "MEZZ.01" hoặc "TB01.01".
 *
 * @example
 * formatShortUnitDisplay('08.01')   => '01'
 * formatShortUnitDisplay('MEZZ.02') => '02'
 * formatShortUnitDisplay('TB01.01') => 'M01'
 * formatShortUnitDisplay('T08.01')  => 'M01'
 * formatShortUnitDisplay('P.402')   => 'P.402'
 * formatShortUnitDisplay('402')     => '402'
 */
export function formatShortUnitDisplay(
  unitCode?: string | null,
  unitType?: 'UNIT' | 'MASTER'
): string {
  if (!unitCode) return '';
  const trimmed = unitCode.trim();

  // Chuẩn định dạng mới U-XXX hoặc M-XXX (ví dụ: U-001, M-001)
  if (/^[UM][-_]\d+$/i.test(trimmed)) {
    return trimmed.toUpperCase().replace('_', '-');
  }

  // Đã có tiền tố M dạng M01, M02
  if (/^M\d+$/i.test(trimmed)) {
    return trimmed.toUpperCase();
  }

  const parts = trimmed.split('.');

  if (parts.length > 1) {
    const prefix = parts[0].toUpperCase();
    const suffix = parts.slice(1).join('.');

    // Chỉ coi là Master nếu unitType là MASTER hoặc tiền tố rõ ràng là Master (TB01, T08, TROOF...) và KHÔNG PHẢI là UNIT
    // Mã Master cũ dạng T + mã tầng (T08, TB01, TMEZZ...). Không nhầm tầng TUM/TECH/TERRACE là Master.
    const isMasterPrefix = /^T(\d+|B\d+|MEZZ\d*|KT|TECH\d*|ROOF|REF\d*|TUM)$/i.test(prefix);
    if (unitType === 'MASTER' || (unitType !== 'UNIT' && isMasterPrefix)) {
      const cleanSuffix = suffix.replace(/^M/i, '');
      return `M${cleanSuffix}`;
    }

    // Căn hộ thông thường (ví dụ 08.01, MEZZ.02, B01.01, TECH.01)
    return suffix;
  }

  if (unitType === 'MASTER') {
    return trimmed.toUpperCase().startsWith('M') ? trimmed.toUpperCase() : `M${trimmed}`;
  }

  // Trường hợp không có dấu chấm (ví dụ tên riêng phòng "402")
  return trimmed;
}

/**
 * Tự động sinh mã tiếp theo cho Căn hộ (U-XXX) hoặc Khu vực Master (M-XXX)
 * dựa trên danh sách các căn hộ / khu vực đã có trong toàn bộ toà nhà.
 * Tìm max(U) + 1 hoặc max(M) + 1, bắt đầu từ 001.
 *
 * @example
 * generateNextPartitionCode([{ unitCode: 'U-001' }, { unitCode: 'U-007' }], 'UNIT') => 'U-008'
 * generateNextPartitionCode([{ unitCode: 'M-001' }], 'MASTER') => 'M-002'
 * generateNextPartitionCode([], 'UNIT') => 'U-001'
 */
export function generateNextPartitionCode(
  existingUnits: Array<{ unitCode?: string; unit_code?: string; partitionType?: string; unit_type?: string }>,
  type: 'UNIT' | 'MASTER'
): string {
  const prefix = type === 'UNIT' ? 'U' : 'M';
  const regex = new RegExp(`^${prefix}[-_](\\d+)$`, 'i');
  let maxNum = 0;

  for (const item of existingUnits) {
    const rawCode = (item.unitCode || item.unit_code || '').trim();
    if (!rawCode) continue;
    const match = rawCode.match(regex);
    if (match) {
      const val = parseInt(match[1], 10);
      if (!isNaN(val) && val > maxNum) {
        maxNum = val;
      }
    }
  }

  const nextNum = maxNum + 1;
  const padded = nextNum < 1000 ? String(nextNum).padStart(3, '0') : String(nextNum);
  return `${prefix}-${padded}`;
}

/**
 * Rút gọn mã thửa đất để tránh tràn nhãn trên bản đồ GIS và danh sách thẻ thửa
 *
 * @example
 * formatShortParcelDisplay('C&C-05-B-0039')           => 'B-0039'
 * formatShortParcelDisplay('CRLG_METRO2_Z01_B0039')    => 'B-0039'
 * formatShortParcelDisplay('B-0039')                  => 'B-0039'
 * formatShortParcelDisplay('Thửa 125')                => 'Thửa 125'
 */
export function formatShortParcelDisplay(parcelCode?: string | null): string {
  if (!parcelCode) return '---';
  const trimmed = parcelCode.trim();

  // Khớp định dạng B-xxxx hoặc Bxxxxx
  const bMatch = trimmed.match(/(B-?\d{3,5})/i);
  if (bMatch) {
    const raw = bMatch[1].toUpperCase();
    return raw.includes('-') ? raw : `B-${raw.substring(1)}`;
  }

  // Khớp định dạng Thửa / Lô
  const lotMatch = trimmed.match(/(LÔ\s*\d+|THỬA\s*\d+)/i);
  if (lotMatch) {
    return lotMatch[1].toUpperCase();
  }

  // Nếu quá dài (> 12 ký tự) mà không khớp mẫu trên, cắt ngắn có ellipsis
  if (trimmed.length > 14) {
    return `${trimmed.slice(0, 12)}...`;
  }

  return trimmed;
}

type PartitionCodeItem = {
  unitCode?: string;
  unit_code?: string;
  partitionType?: string;
  unit_type?: string;
};

/**
 * Tiền tố mã căn từ mã tầng hoặc số tầng: 'F05'/5/'5' => '05', 0.5 => 'MEZZ', 1.5 => 'MEZZ2',
 * -0.5 => 'SB', 'TECH2' => 'TECH2'. Mã tầng chứa ký tự lạ (tên tầng cũ) thì suy theo tên + số tầng.
 */
export function resolveUnitCodePrefix(floorCode: string | number, floorNumber?: number): string {
  if (typeof floorCode === 'number') {
    return floorCodeToUnitPrefix(resolveBaseFloorCode(floorCode));
  }
  const str = String(floorCode).trim();
  if (/^-?\d+(\.\d+)?$/.test(str)) {
    return floorCodeToUnitPrefix(resolveBaseFloorCode(Number(str)));
  }
  const prefix = floorCodeToUnitPrefix(str);
  if (prefix) return prefix;
  if (floorNumber !== undefined && Number.isFinite(floorNumber)) {
    return floorCodeToUnitPrefix(resolveBaseFloorCode(floorNumber, str));
  }
  console.error('[codeFormattingUtils:resolveUnitCodePrefix] Không suy được tiền tố mã căn từ mã tầng:', floorCode);
  return 'XX';
}

/** STT trong mã căn: '02.03' => 3, '01.M02' => 2, 'T02.01' => 1. Mã không có dấu chấm (U-001) => null. */
export function extractUnitStt(code?: string | null): number | null {
  const raw = (code || '').trim();
  if (!raw.includes('.')) return null;
  const last = raw.split('.').pop() || '';
  const m = last.match(/^M?(\d+)$/i);
  return m ? parseInt(m[1], 10) : null;
}

/** Phân vùng là Khu vực chung: theo loại đã lưu; thiếu loại thì suy từ mã (01.M01, M-001, T02.01 cũ). */
function isMasterPartition(item: PartitionCodeItem): boolean {
  const t = (item.partitionType || item.unit_type || '').toUpperCase();
  if (t === 'MASTER') return true;
  if (t === 'UNIT') return false;
  const code = (item.unitCode || item.unit_code || '').trim();
  return /\.M\d+$/i.test(code) || /^M[-_]\d+$/i.test(code) || /^T(\d+|B\d+)\./i.test(code);
}

/**
 * Định dạng số phòng mặc định (display_code) — chỉ là gợi ý, Admin/KSV sửa theo biển thực tế.
 * Nhận STT hoặc nguyên mã căn: '02.03' chỉ lấy phần sau dấu chấm (=> '203', không phải '403').
 * @example
 * formatDefaultDisplayCode('MEZZ', 1)     => 'L.01'
 * formatDefaultDisplayCode('MEZZ2', 1)    => 'L2.01'
 * formatDefaultDisplayCode('G', 2)        => 'G.02'
 * formatDefaultDisplayCode('B01', 1)      => 'B1-01'
 * formatDefaultDisplayCode('F02', 3)      => '203'
 * formatDefaultDisplayCode('02', '02.03') => '203'
 * formatDefaultDisplayCode('TECH2', 1)    => 'TECH2-01'
 */
export function formatDefaultDisplayCode(
  floorCode: string | number,
  stt: number | string,
  type: 'UNIT' | 'MASTER' = 'UNIT'
): string {
  let sttNum: number;
  if (typeof stt === 'number') {
    sttNum = stt;
  } else {
    const fromCode = extractUnitStt(stt);
    const digits = parseInt(stt.replace(/\D/g, ''), 10);
    sttNum = fromCode ?? (Number.isNaN(digits) ? 1 : digits);
  }
  const sttPadded = String(sttNum).padStart(2, '0');

  if (type === 'MASTER') {
    return `Khu vực chung M${sttPadded}`;
  }

  const prefix = resolveUnitCodePrefix(floorCode);
  if (prefix === 'MEZZ') return `L.${sttPadded}`;
  const mezz = prefix.match(/^MEZZ(\d+)$/);
  if (mezz) return `L${mezz[1]}.${sttPadded}`;
  if (prefix === 'G') return `G.${sttPadded}`;
  if (/^SB\d*$/.test(prefix)) return `${prefix}-${sttPadded}`;
  const basement = prefix.match(/^B(\d+)$/);
  if (basement) return `B${parseInt(basement[1], 10)}-${sttPadded}`;
  if (/^\d+$/.test(prefix)) return `${parseInt(prefix, 10) * 100 + sttNum}`;
  return `${prefix}-${sttPadded}`;
}

/**
 * Sinh mã phân vùng chuẩn: Căn hộ `[TIỀN_TỐ].[STT]`, Khu vực chung `[TIỀN_TỐ].M[STT]`.
 * - STT đếm RIÊNG cho UNIT và MASTER, chỉ trong `sameFloorUnits` (các ô của đúng tầng này,
 *   không suy tầng từ tiền tố vì căn có thể đã được chuyển tầng ở thẩm định mà giữ mã cũ).
 * - Mã sinh ra không trùng bất kỳ mã nào trong `sameFloorUnits` lẫn `buildingCodes` (toàn tòa).
 * @example
 * generateOptionBPartitionCode('F01', [{ unitCode: '01.01', partitionType: 'UNIT' }], 'MASTER') => { unitCode: '01.M01', ... }
 */
export function generateOptionBPartitionCode(
  floorCode: string | number,
  sameFloorUnits: ReadonlyArray<PartitionCodeItem>,
  type: 'UNIT' | 'MASTER' = 'UNIT',
  options: { floorNumber?: number; buildingCodes?: Iterable<string> } = {}
): { unitCode: string; displayCode: string } {
  const floorPrefix = resolveUnitCodePrefix(floorCode, options.floorNumber);
  const wantMaster = type === 'MASTER';

  const taken = new Set<string>();
  let maxStt = 0;
  for (const item of sameFloorUnits) {
    const raw = (item.unitCode || item.unit_code || '').trim();
    if (!raw) continue;
    taken.add(raw.toUpperCase());
    if (isMasterPartition(item) !== wantMaster) continue;
    const stt = extractUnitStt(raw);
    if (stt !== null && stt > maxStt) maxStt = stt;
  }
  for (const code of options.buildingCodes || []) {
    if (code) taken.add(String(code).trim().toUpperCase());
  }

  const build = (n: number): string => {
    const sttStr = String(n).padStart(2, '0');
    return wantMaster ? `${floorPrefix}.M${sttStr}` : `${floorPrefix}.${sttStr}`;
  };
  let nextStt = maxStt + 1;
  while (taken.has(build(nextStt).toUpperCase())) nextStt++;

  return { unitCode: build(nextStt), displayCode: formatDefaultDisplayCode(floorPrefix, nextStt, type) };
}

