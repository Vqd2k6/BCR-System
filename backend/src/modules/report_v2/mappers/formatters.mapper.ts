/**
 * ============================================================================
 * REPORT V2 FORMATTERS & PHOTO UTILS
 * Các hàm tiện ích chuẩn hóa ngày tháng và trích xuất thông tin ảnh
 * ============================================================================
 */

/**
 * Chuẩn hóa chuỗi ngày tháng ISO sang định dạng chuẩn kỹ thuật Việt Nam DD/MM/YYYY
 */
export function formatDateVi(dateVal: any, includeTime: boolean = false): string {
  if (!dateVal) return '';
  const str = String(dateVal).trim();
  if (/^\d{1,2}\/\d{1,2}\/\d{4}/.test(str)) {
    if (!includeTime && str.includes('(')) {
      return str.split('(')[0].trim();
    }
    return str;
  }
  const d = new Date(str);
  if (isNaN(d.getTime())) return str;
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  if (includeTime && (d.getHours() !== 0 || d.getMinutes() !== 0)) {
    const hours = String(d.getHours()).padStart(2, '0');
    const mins = String(d.getMinutes()).padStart(2, '0');
    return `${day}/${month}/${year} (${hours}:${mins})`;
  }
  return `${day}/${month}/${year}`;
}

export function formatWatermarkDateTime(dateVal: any): string {
  if (!dateVal) return '';
  const str = String(dateVal).trim();
  if (str.includes('thg')) {
    return str;
  }
  let d: Date;
  const vnMatch = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s*\(?(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?\)?)?/);
  if (vnMatch) {
    const day = parseInt(vnMatch[1], 10);
    const month = parseInt(vnMatch[2], 10) - 1;
    const year = parseInt(vnMatch[3], 10);
    const hour = vnMatch[4] ? parseInt(vnMatch[4], 10) : 0;
    const min = vnMatch[5] ? parseInt(vnMatch[5], 10) : 0;
    const sec = vnMatch[6] ? parseInt(vnMatch[6], 10) : 0;
    d = new Date(year, month, day, hour, min, sec);
  } else {
    d = new Date(str);
  }

  if (isNaN(d.getTime())) {
    return str;
  }

  const day = d.getDate();
  const month = d.getMonth() + 1;
  const year = d.getFullYear();

  // Thiếu metadata giờ (00:00:00) -> chỉ hiện ngày theo chuẩn tiếng Việt
  if (d.getHours() === 0 && d.getMinutes() === 0 && d.getSeconds() === 0) {
    return `${day} thg ${month}, ${year}`;
  }

  const hours = String(d.getHours()).padStart(2, '0');
  const mins = String(d.getMinutes()).padStart(2, '0');
  const secs = String(d.getSeconds()).padStart(2, '0');
  return `${day} thg ${month}, ${year} ${hours}:${mins}:${secs}`;
}

export function extractPhotoDateTime(photoUrl?: string, itemShotAt?: any, fallbackDate?: any): string {
  if (itemShotAt) {
    const formatted = formatWatermarkDateTime(itemShotAt);
    if (formatted) return formatted;
  }
  if (photoUrl && typeof photoUrl === 'string') {
    const match = photoUrl.match(/_(\d{13})_/);
    if (match) {
      const epoch = parseInt(match[1], 10);
      if (!isNaN(epoch) && epoch > 1500000000000 && epoch < 2500000000000) {
        return formatWatermarkDateTime(new Date(epoch));
      }
    }
  }
  return formatWatermarkDateTime(fallbackDate) || '';
}
