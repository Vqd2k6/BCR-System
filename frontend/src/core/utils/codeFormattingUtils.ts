/**
 * Bộ tiện ích định dạng hiển thị cho Hệ thống khảo sát hiện trạng Metro 2.
 * Thực thi kiến trúc 2 tầng (Dual-Layer Architecture):
 * 1. Tầng Lưu Trữ Ngầm (CSDL / Báo Cáo BCS / Định Danh Ảnh): Giữ 100% mã chuẩn pháp lý (08.01, MEZZ.01, TB01.01).
 * 2. Tầng Hiển Thị Giao Diện (Surveyor CAD / GIS Map): Tối giản hoá ngắn gọn (01, 02, M01, B-0039),
 *    chống tràn ranh giới ô/thửa tuyệt đối.
 */

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
    const isMasterPrefix = /^T(B\d+|\d+|MEZZ|KT|TECH|ROOF|REF|UM)/i.test(prefix);
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

/**
 * Định dạng số phòng mặc định (display_code) từ mã tầng và STT theo Phương án B
 * @example
 * formatDefaultDisplayCode('MEZZ', 1) => 'L.01'
 * formatDefaultDisplayCode('G', 2)    => 'G.02'
 * formatDefaultDisplayCode('B01', 1)  => 'B1-01'
 * formatDefaultDisplayCode('F02', 3)  => '203'
 * formatDefaultDisplayCode('02', 3)   => '203'
 * formatDefaultDisplayCode('12', 4)   => '1204'
 */
export function formatDefaultDisplayCode(
  floorCode: string | number,
  stt: number | string,
  type: 'UNIT' | 'MASTER' = 'UNIT'
): string {
  const sttNum = typeof stt === 'number' ? stt : parseInt(stt.replace(/\D/g, '') || '1', 10);
  const sttPadded = String(sttNum).padStart(2, '0');

  if (type === 'MASTER') {
    return `Khu vực chung M${sttPadded}`;
  }

  const str = String(floorCode).trim().toUpperCase();
  if (str === '0.5' || str === 'MEZZ' || str.includes('LỬNG')) {
    return `L.${sttPadded}`;
  }
  if (str === '0' || str === 'G' || str === 'F00' || str.includes('TRỆT')) {
    return `G.${sttPadded}`;
  }
  if (str === '-0.5' || str === 'SB' || str.includes('BÁN HẦM')) {
    return `SB-${sttPadded}`;
  }
  const bMatch = str.match(/B(\d+)/i) || (typeof floorCode === 'number' && floorCode < 0 ? [null, Math.abs(Math.round(floorCode)).toString()] : null);
  if (bMatch) {
    return `B${bMatch[1]}-${sttPadded}`;
  }

  // Tầng nổi
  const fMatch = str.match(/F?(\d+)/i);
  if (fMatch) {
    const fNum = parseInt(fMatch[1], 10);
    return `${fNum * 100 + sttNum}`;
  }

  return sttPadded;
}

/**
 * Sinh mã phân vùng chuẩn Phương án B: [MÃ_TẦNG].[STT] cho unitCode và gợi ý displayCode
 */
export function generateOptionBPartitionCode(
  floorCode: string | number,
  existingUnits: Array<{ unitCode?: string; unit_code?: string; partitionType?: string; unit_type?: string }>,
  type: 'UNIT' | 'MASTER' = 'UNIT'
): { unitCode: string; displayCode: string } {
  // Xác định tiền tố tầng cho unit_code
  let floorPrefix = '01';
  const str = String(floorCode).trim().toUpperCase();
  if (str === '0.5' || str === 'MEZZ' || str.includes('LỬNG')) {
    floorPrefix = 'MEZZ';
  } else if (str === '0' || str === 'G' || str === 'F00' || str.includes('TRỆT')) {
    floorPrefix = 'G';
  } else if (str === '-0.5' || str === 'SB') {
    floorPrefix = 'SB';
  } else if (/^B\d+$/i.test(str)) {
    floorPrefix = str;
  } else if (typeof floorCode === 'number' && floorCode < 0) {
    floorPrefix = `B${String(Math.abs(Math.round(floorCode))).padStart(2, '0')}`;
  } else {
    const numMatch = str.match(/\d+/);
    if (numMatch) {
      floorPrefix = numMatch[0].padStart(2, '0');
    }
  }

  // Tìm STT cao nhất hiện tại trên tầng này
  let maxStt = 0;
  for (const item of existingUnits) {
    const raw = (item.unitCode || item.unit_code || '').trim();
    if (!raw) continue;
    const parts = raw.split('.');
    if (parts.length > 1) {
      const pPrefix = parts[0].toUpperCase();
      if (pPrefix === floorPrefix) {
        const rawSuffix = parts.slice(1).join('.');
        const numPart = parseInt(rawSuffix.replace(/\D/g, ''), 10);
        if (!isNaN(numPart) && numPart > maxStt) {
          maxStt = numPart;
        }
      }
    }
  }

  const nextStt = maxStt + 1;
  const sttStr = String(nextStt).padStart(2, '0');
  const unitCode = type === 'MASTER' ? `${floorPrefix}.M${sttStr}` : `${floorPrefix}.${sttStr}`;
  const displayCode = formatDefaultDisplayCode(floorPrefix, nextStt, type);

  return { unitCode, displayCode };
}

