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
export function formatShortUnitDisplay(unitCode?: string | null): string {
  if (!unitCode) return '';
  const trimmed = unitCode.trim();
  const parts = trimmed.split('.');

  if (parts.length > 1) {
    const prefix = parts[0].toUpperCase();
    const suffix = parts.slice(1).join('.');

    // Nếu là khu vực dùng chung (có tiền tố T ví dụ TB01.01, T08.01)
    if (prefix.startsWith('T')) {
      return `M${suffix}`;
    }

    // Căn hộ thông thường (ví dụ 08.01, MEZZ.02)
    return suffix;
  }

  // Trường hợp không có dấu chấm (ví dụ tên riêng phòng "402")
  return trimmed;
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
