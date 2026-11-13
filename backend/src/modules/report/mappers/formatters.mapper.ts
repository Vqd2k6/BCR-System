/**
 * ============================================================================
 * REPORT FORMATTERS & PHOTO UTILS
 * Các hàm tiện ích chuẩn hóa ngày tháng và trích xuất thông tin ảnh
 * ============================================================================
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
  // Luôn theo giờ Việt Nam, không phụ thuộc múi giờ máy chủ (prod chạy UTC):
  //   - Date lúc 00:00:00.000 giờ máy chủ = cột DATE của pg → chỉ có ngày, lấy đúng ngày đó.
  //   - "yyyy-mm-dd" / ISO không ghi múi giờ: đã là giờ VN, đọc thẳng.
  //   - Date có giờ / ISO có múi giờ (Z, +07:00): quy đổi sang giờ VN.
  let c: VnWallClock | null = null;
  if (dateVal instanceof Date) {
    if (isNaN(dateVal.getTime())) return '';
    const isPgDate = dateVal.getHours() === 0 && dateVal.getMinutes() === 0 && dateVal.getSeconds() === 0 && dateVal.getMilliseconds() === 0;
    c = isPgDate
      ? { year: dateVal.getFullYear(), month: dateVal.getMonth() + 1, day: dateVal.getDate(), hour: 0, minute: 0, second: 0 }
      : toVnWallClock(dateVal);
  } else {
    const naive = str.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2}))?(?:\.\d+)?)?$/);
    if (naive) {
      c = {
        year: Number(naive[1]), month: Number(naive[2]), day: Number(naive[3]),
        hour: naive[4] ? Number(naive[4]) : 0, minute: naive[5] ? Number(naive[5]) : 0, second: naive[6] ? Number(naive[6]) : 0,
      };
    } else {
      const d = new Date(str);
      if (isNaN(d.getTime())) return str;
      c = toVnWallClock(d);
    }
  }
  const p2 = (n: number) => String(n).padStart(2, '0');
  if (includeTime && (c.hour !== 0 || c.minute !== 0)) {
    return `${p2(c.day)}/${p2(c.month)}/${c.year} (${p2(c.hour)}:${p2(c.minute)})`;
  }
  return `${p2(c.day)}/${p2(c.month)}/${c.year}`;
}

/** Ngày nhập tay có thể ở dạng dd/mm/yyyy: new Date() sẽ ném lỗi hoặc đảo ngày tháng nên phải tách riêng. */
export function parseSurveyDate(dateVal: any): Date | null {
  if (!dateVal) return null;
  const str = String(dateVal).trim();
  const vnMatch = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  const parsed = vnMatch
    ? new Date(Date.UTC(Number(vnMatch[3]), Number(vnMatch[2]) - 1, Number(vnMatch[1])))
    : new Date(str);
  return isNaN(parsed.getTime()) ? null : parsed;
}

/** Việt Nam: UTC+7 cố định (không có giờ mùa hè). */
export const VN_OFFSET_MS = 7 * 3600 * 1000;

export interface VnWallClock {
  year: number;
  month: number; // 1–12
  day: number;
  hour: number;
  minute: number;
  second: number;
}

/**
 * Giờ treo tường Việt Nam của một thời điểm, KHÔNG phụ thuộc múi giờ tiến trình Node.
 * Máy chủ prod chạy UTC: đọc bằng getHours() sẽ lệch –7 giờ.
 */
export function toVnWallClock(at: Date): VnWallClock {
  const v = new Date(at.getTime() + VN_OFFSET_MS);
  return {
    year: v.getUTCFullYear(),
    month: v.getUTCMonth() + 1,
    day: v.getUTCDate(),
    hour: v.getUTCHours(),
    minute: v.getUTCMinutes(),
    second: v.getUTCSeconds(),
  };
}

/** Thời điểm ứng với giờ treo tường Việt Nam (ngược của toVnWallClock). */
export function fromVnWallClock(year: number, month: number, day: number, hour = 0, minute = 0, second = 0): Date {
  return new Date(Date.UTC(year, month - 1, day, hour, minute, second) - VN_OFFSET_MS);
}

/** Chữ watermark "6 thg 10, 2026 15:49:55" (00:00:00 → chỉ in ngày) từ giờ treo tường VN. */
export function formatVnWatermark(c: VnWallClock): string {
  if (c.hour === 0 && c.minute === 0 && c.second === 0) return `${c.day} thg ${c.month}, ${c.year}`;
  const p = (n: number) => String(n).padStart(2, '0');
  return `${c.day} thg ${c.month}, ${c.year} ${p(c.hour)}:${p(c.minute)}:${p(c.second)}`;
}

/**
 * Chữ giờ watermark in trên report, luôn theo giờ Việt Nam:
 *   - Date / ISO có múi giờ (Z, +07:00) / epoch: quy đổi sang giờ VN.
 *   - "dd/mm/yyyy (hh:mm:ss)" và ISO không ghi múi giờ: đã là giờ VN, giữ nguyên.
 *   - "yyyy-mm-dd" chỉ có ngày: in ngày.
 */
export function formatWatermarkDateTime(dateVal: any): string {
  if (!dateVal) return '';
  if (dateVal instanceof Date) {
    if (isNaN(dateVal.getTime())) return '';
    // pg trả cột DATE thành Date lúc 00:00 giờ máy chủ: đó là "chỉ có ngày", không quy đổi múi giờ.
    if (dateVal.getHours() === 0 && dateVal.getMinutes() === 0 && dateVal.getSeconds() === 0 && dateVal.getMilliseconds() === 0) {
      return `${dateVal.getDate()} thg ${dateVal.getMonth() + 1}, ${dateVal.getFullYear()}`;
    }
    return formatVnWatermark(toVnWallClock(dateVal));
  }
  const str = String(dateVal).trim();
  if (str.includes('thg')) {
    return str;
  }
  const vnMatch = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s*\(?(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?\)?)?/);
  if (vnMatch) {
    return formatVnWatermark({
      day: parseInt(vnMatch[1], 10),
      month: parseInt(vnMatch[2], 10),
      year: parseInt(vnMatch[3], 10),
      hour: vnMatch[4] ? parseInt(vnMatch[4], 10) : 0,
      minute: vnMatch[5] ? parseInt(vnMatch[5], 10) : 0,
      second: vnMatch[6] ? parseInt(vnMatch[6], 10) : 0,
    });
  }
  // ISO không có múi giờ: JS coi là giờ máy chủ → đọc thẳng như giờ VN.
  const naive = str.match(/^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2}))?(?:\.\d+)?)?$/);
  if (naive) {
    return formatVnWatermark({
      year: Number(naive[1]),
      month: Number(naive[2]),
      day: Number(naive[3]),
      hour: naive[4] ? Number(naive[4]) : 0,
      minute: naive[5] ? Number(naive[5]) : 0,
      second: naive[6] ? Number(naive[6]) : 0,
    });
  }
  const d = new Date(str);
  if (isNaN(d.getTime())) {
    return str;
  }
  return formatVnWatermark(toVnWallClock(d));
}

export function extractPhotoDateTime(photoUrl?: string, itemShotAt?: any, fallbackDate?: any): string {
  if (itemShotAt) {
    const formatted = formatWatermarkDateTime(itemShotAt);
    if (formatted) return formatted;
  }
  if (photoUrl && typeof photoUrl === 'string') {
    const match = photoUrl.match(/(?:_|__|^photo_)(\d{13})(?:_|\.|$)/);
    if (match && match[1]) {
      const epoch = parseInt(match[1], 10);
      if (!isNaN(epoch) && epoch > 1500000000000 && epoch < 2500000000000) {
        return formatWatermarkDateTime(new Date(epoch));
      }
    }
  }
  return formatWatermarkDateTime(fallbackDate) || '';
}

/**
 * Chuẩn hóa họ tên người tiếng Việt:
 * 1. Bỏ khoảng trắng và dấu thừa ở cuối tên.
 * 2. Viết hoa chữ cái đầu của các từ đang gõ thường.
 * Ví dụ: "Võ hữu thuận." -> "Võ Hữu Thuận"
 *        "nguyễn thị thu thảo" -> "Nguyễn Thị Thu Thảo"
 */
export function formatPersonName(name: string | null | undefined): string {
  if (!name || typeof name !== 'string') return '';
  // Chỉ bỏ dấu thừa cuối tên và viết hoa từ gõ thường: `KS.`, `UBND`, `A. Hùng/ B` là nội dung của tên, phải giữ nguyên
  const cleaned = name.replace(/\s+/g, ' ').trim().replace(/[\s.,;:_|*#$@!?-]+$/, '');
  if (!cleaned) return '';
  return cleaned
    .split(' ')
    .map((word) =>
      word === word.toLocaleLowerCase('vi-VN') ? word.charAt(0).toLocaleUpperCase('vi-VN') + word.slice(1) : word
    )
    .join(' ');
}


