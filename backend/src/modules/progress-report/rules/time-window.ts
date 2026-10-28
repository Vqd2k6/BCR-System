import type { ProgressFilter } from '../progress-report.types';

/**
 * Cửa sổ thời gian theo múi giờ Việt Nam (UTC+7, không có DST).
 * TODAY: riêng hôm nay | DATE_RANGE: từ ngày X đến ngày Y | ALL_TIME: toàn bộ từ trước đến nay.
 */

const VN_OFFSET_MS = 7 * 60 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

export interface TimeWindow {
  start: Date | null; // inclusive
  end: Date | null; // exclusive
  label: string;
}

export function vnDateString(d: Date): string {
  return new Date(d.getTime() + VN_OFFSET_MS).toISOString().slice(0, 10);
}

export function formatVnDate(isoDay: string): string {
  const [y, m, d] = isoDay.split('-');
  return `${d}/${m}/${y}`;
}

/**
 * Ngày lịch VN dưới dạng Date 00:00 UTC – Excel lưu ngày không có múi giờ (serial),
 * nên phải quy về đúng ngày VN trước khi ghi để không bị lùi 1 ngày (VD 29/09 00:00 VN = 28/09 17:00 UTC).
 */
export function toVnCalendarDate(d: Date | null): Date | null {
  if (!d) return null;
  return new Date(`${vnDateString(d)}T00:00:00.000Z`);
}

function vnDayStart(isoDay: string): Date {
  return new Date(Date.parse(`${isoDay}T00:00:00.000Z`) - VN_OFFSET_MS);
}

export function isValidIsoDay(v: string | undefined): v is string {
  return Boolean(v && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(`${v}T00:00:00Z`)));
}

export function resolveTimeWindow(filter: ProgressFilter, now: Date = new Date()): TimeWindow {
  if (filter.timeMode === 'TODAY') {
    const today = vnDateString(now);
    const start = vnDayStart(today);
    return { start, end: new Date(start.getTime() + DAY_MS), label: `Ngày ${formatVnDate(today)}` };
  }
  if (filter.timeMode === 'DATE_RANGE' && isValidIsoDay(filter.fromDate) && isValidIsoDay(filter.toDate)) {
    const start = vnDayStart(filter.fromDate);
    const end = new Date(vnDayStart(filter.toDate).getTime() + DAY_MS);
    return {
      start,
      end,
      label: `Từ ngày ${formatVnDate(filter.fromDate)} đến ngày ${formatVnDate(filter.toDate)}`,
    };
  }
  return { start: null, end: null, label: `Lũy kế từ trước đến ngày ${formatVnDate(vnDateString(now))}` };
}

export function isInWindow(dates: Date[], window: TimeWindow): boolean {
  if (!window.start || !window.end) return true;
  const s = window.start.getTime();
  const e = window.end.getTime();
  return dates.some((d) => d.getTime() >= s && d.getTime() < e);
}
