/**
 * ============================================================================
 * PHOTO RESURVEY – QUY TẮC THUẦN (không I/O)
 * Dùng chung cho API, lúc nộp/duyệt và test để mọi nơi xếp giờ watermark giống nhau.
 * ============================================================================
 */

import { createHash } from 'crypto';
import { formatVnWatermark, fromVnWallClock, toVnWallClock, VN_OFFSET_MS } from '../report/mappers/formatters.mapper';
import type { ResurveySlotCode, ResurveyTime2Source } from './photo-resurvey.types';

export const RESURVEY_SLOT_CODES: readonly ResurveySlotCode[] = ['P-01', 'P-02', 'P-03', 'P-04', 'P-05', 'P-06', 'P-07'];

/** Mục nhiều ảnh: được chụp thêm ảnh phát sinh. */
export const MULTI_PHOTO_SLOTS: readonly ResurveySlotCode[] = ['P-03', 'P-05', 'P-06', 'P-07'];

/** P-02 là mặt đứng chính và là ảnh bìa: không được đánh dấu N/A. */
export const NA_FORBIDDEN_SLOTS: readonly ResurveySlotCode[] = ['P-02'];

/** Bước tối đa giữa các ảnh phát sinh (giây), người dùng chốt 09/11/2026. */
export const MAX_EXTRA_STEP_SECONDS = 120;

export const NA_REASON_MIN_LENGTH = 5;
export const REJECT_NOTE_MIN_LENGTH = 10;

/**
 * Mã mục ảnh ngoài nhà từ khoá ô Photo QC hoặc mã ảnh Phụ lục 1.
 * `P-03#2` → P-03, `P-05-2` → P-05. Ảnh võng dầm/sàn P-06B chụp trong nhà → null.
 */
export function slotCodeOf(photoKeyOrCode: string): ResurveySlotCode | null {
  const base = String(photoKeyOrCode || '').split('#')[0].trim().toUpperCase();
  if (base.startsWith('P-06B')) return null;
  const m = base.match(/^(P-0[1-7])(?:-\d+)?$/);
  return m ? (m[1] as ResurveySlotCode) : null;
}

export function isMultiPhotoSlot(slot: ResurveySlotCode): boolean {
  return MULTI_PHOTO_SLOTS.includes(slot);
}

export function slotOrder(slot: ResurveySlotCode): number {
  return RESURVEY_SLOT_CODES.indexOf(slot);
}

/**
 * Đọc lại chữ watermark ("9 thg 11, 2026 08:45:10", giờ Việt Nam) thành thời điểm tuyệt đối,
 * đúng chiều ngược của formatWatermarkDateTime. Chữ chỉ có ngày → hasTime = false.
 */
export function parseWatermarkText(text: string | null | undefined): { at: Date | null; hasTime: boolean } {
  const m = String(text || '').trim().match(/^(\d{1,2}) thg (\d{1,2}), (\d{4})(?: (\d{2}):(\d{2}):(\d{2}))?$/);
  if (!m) return { at: null, hasTime: false };
  const hasTime = m[4] !== undefined;
  // Chữ watermark là giờ Việt Nam: dựng thời điểm theo UTC+7, không theo múi giờ máy chủ (prod chạy UTC).
  const at = fromVnWallClock(
    Number(m[3]),
    Number(m[2]),
    Number(m[1]),
    hasTime ? Number(m[4]) : 0,
    hasTime ? Number(m[5]) : 0,
    hasTime ? Number(m[6]) : 0
  );
  return { at: isNaN(at.getTime()) ? null : at, hasTime };
}

export function formatTime2(at: Date): string {
  return formatVnWatermark(toVnWallClock(at));
}

export interface TimelineEntry {
  /** Mục ảnh ngoài nhà; ảnh khác (khuyết tật, phòng) để null. */
  slotCode: ResurveySlotCode | null;
  /** Chữ watermark đang in. */
  dateTimeText: string;
}

export interface ExtraRequest {
  itemId: string;
  slotCode: ResurveySlotCode;
}

export interface ExtraTimeResult {
  times: Map<string, { text: string; at: Date | null; source: ResurveyTime2Source }>;
  error: string | null;
}

/**
 * Xếp Time 2 cho ảnh phát sinh (quyết định 09/11/2026):
 * - T_prev = giờ muộn nhất của mục đó (mục chưa có giờ → giờ muộn nhất của các mục ngoài nhà đứng trước).
 * - T_next = giờ sớm nhất trên dòng thời gian sau T_prev, không tính chính mục đó.
 * - k ảnh chia đều khoảng mở (T_prev, T_next), bước = min(120s, ⌊khoảng/(k+1)⌋); bước < 1s → lỗi, báo Admin.
 * - Không có T_next → T_prev + 120s·i.
 * - Report không có mốc giờ nào → in theo ngày khảo sát (DATE_ONLY) như các ảnh khác.
 * Thứ tự ảnh phát sinh trong một mục giữ theo thứ tự `extras`.
 */
export function computeExtraTimes(timeline: TimelineEntry[], extras: ExtraRequest[], surveyDateText: string): ExtraTimeResult {
  const times: ExtraTimeResult['times'] = new Map();
  const errors: string[] = [];
  const timed = timeline
    .map((e) => ({ slotCode: e.slotCode, ...parseWatermarkText(e.dateTimeText) }))
    .filter((e): e is { slotCode: ResurveySlotCode | null; at: Date; hasTime: true } => e.hasTime && e.at !== null);

  const bySlot = new Map<ResurveySlotCode, string[]>();
  for (const x of extras) {
    const list = bySlot.get(x.slotCode) ?? [];
    list.push(x.itemId);
    bySlot.set(x.slotCode, list);
  }

  for (const [slot, ids] of bySlot) {
    const k = ids.length;
    const ownTimes = timed.filter((e) => e.slotCode === slot).map((e) => e.at.getTime());
    let prevMs: number | null = ownTimes.length > 0 ? Math.max(...ownTimes) : null;
    if (prevMs === null) {
      const before = timed
        .filter((e) => e.slotCode !== null && slotOrder(e.slotCode) < slotOrder(slot))
        .map((e) => e.at.getTime());
      prevMs = before.length > 0 ? Math.max(...before) : null;
    }
    if (prevMs === null) {
      ids.forEach((id) => times.set(id, { text: surveyDateText, at: null, source: 'DATE_ONLY' }));
      continue;
    }
    const prev = prevMs;
    const after = timed.filter((e) => e.slotCode !== slot && e.at.getTime() > prev).map((e) => e.at.getTime());
    const nextMs = after.length > 0 ? Math.min(...after) : null;

    let stepSec = MAX_EXTRA_STEP_SECONDS;
    if (nextMs !== null) {
      const gapSec = Math.floor((nextMs - prev) / 1000);
      stepSec = Math.min(MAX_EXTRA_STEP_SECONDS, Math.floor(gapSec / (k + 1)));
      if (stepSec < 1) {
        errors.push(
          `Mục ${slot}: chỉ còn ${gapSec} giây trước ảnh kế tiếp, không xếp được ${k} ảnh phát sinh. Liên hệ Zone Admin.`
        );
        continue;
      }
    }
    ids.forEach((id, idx) => {
      const at = new Date(prev + stepSec * (idx + 1) * 1000);
      times.set(id, { text: formatTime2(at), at, source: 'INTERPOLATED' });
    });
  }

  return { times, error: errors.length > 0 ? errors.join(' ') : null };
}

/**
 * Khoảng hợp lệ để Admin chỉnh Time 2 của một ảnh phát sinh: (T_prev, T_next) theo cùng định nghĩa trên.
 */
export function extraTimeBounds(timeline: TimelineEntry[], slot: ResurveySlotCode): { prev: Date | null; next: Date | null } {
  const timed = timeline
    .map((e) => ({ slotCode: e.slotCode, ...parseWatermarkText(e.dateTimeText) }))
    .filter((e): e is { slotCode: ResurveySlotCode | null; at: Date; hasTime: true } => e.hasTime && e.at !== null);
  const own = timed.filter((e) => e.slotCode === slot).map((e) => e.at.getTime());
  let prevMs: number | null = own.length > 0 ? Math.max(...own) : null;
  if (prevMs === null) {
    const before = timed.filter((e) => e.slotCode !== null && slotOrder(e.slotCode) < slotOrder(slot)).map((e) => e.at.getTime());
    prevMs = before.length > 0 ? Math.max(...before) : null;
  }
  if (prevMs === null) return { prev: null, next: null };
  const p = prevMs;
  const after = timed.filter((e) => e.slotCode !== slot && e.at.getTime() > p).map((e) => e.at.getTime());
  return { prev: new Date(p), next: after.length > 0 ? new Date(Math.min(...after)) : null };
}

/** yyyyMMddHHmmss theo giờ Việt Nam (UTC+7), 14 chữ số. */
export function vnCompactStamp(at: Date): string {
  const vn = new Date(at.getTime() + VN_OFFSET_MS);
  const p = (n: number, w = 2) => String(n).padStart(w, '0');
  return `${vn.getUTCFullYear()}${p(vn.getUTCMonth() + 1)}${p(vn.getUTCDate())}${p(vn.getUTCHours())}${p(vn.getUTCMinutes())}${p(vn.getUTCSeconds())}`;
}

/**
 * Tên file ảnh chụp lại. Cố ý KHÔNG chứa `_<13 chữ số>` (epoch ms): extractPhotoDateTime đọc mẫu đó
 * từ tên file và sẽ in nhầm giờ chụp thật lên watermark.
 */
export function buildResurveyFileName(parcelCode: string, slot: ResurveySlotCode, suffix: string, capturedAt: Date): string {
  const parcel = String(parcelCode || 'PARCEL').replace(/[^A-Za-z0-9-]/g, '_');
  const slotPart = slot.replace('-', '');
  const safeSuffix = suffix.replace(/[^A-Za-z0-9]/g, '');
  return `HCM_M2.1_${parcel}_${slotPart}${safeSuffix ? `_${safeSuffix}` : ''}_RS${vnCompactStamp(capturedAt)}.jpg`;
}

/** Mẫu epoch trong tên file mà extractPhotoDateTime nhận diện – dùng để tự kiểm tên file. */
export const URL_EPOCH_PATTERN = /(?:_|__|^photo_)(\d{13})(?:_|\.|$)/;

function stable(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stable);
  if (value && typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    return Object.keys(obj)
      .sort()
      .reduce<Record<string, unknown>>((acc, key) => {
        acc[key] = stable(obj[key]);
        return acc;
      }, {});
  }
  return value;
}

/** SHA-256 của JSON đã sắp khoá (cùng nội dung → cùng mã, không phụ thuộc thứ tự khoá). */
export function stableSha256(value: unknown): string {
  return createHash('sha256').update(JSON.stringify(stable(value))).digest('hex');
}

/** Mã ảnh Phụ lục 1 và tag mã ảnh cho ảnh phát sinh thứ `n` của một mục (n tính trên tổng số ảnh của mục). */
export function extraPhotoCodes(slot: ResurveySlotCode, n: number): { photoCode: string; tag: string } {
  const nn = String(n).padStart(2, '0');
  switch (slot) {
    case 'P-03':
      return { photoCode: 'P-03', tag: `P03_${nn}` };
    case 'P-05':
      return { photoCode: `P-05-${n}`, tag: `EXT_TILT_${nn}` };
    case 'P-06':
      return { photoCode: `P-06-${n}`, tag: `FOUND_SETTLE_${nn}` };
    case 'P-07':
      return { photoCode: `P-07-${n}`, tag: `EXT_ANOMALY_${nn}` };
    default:
      return { photoCode: slot, tag: `${slot.replace('-', '')}_${nn}` };
  }
}

export const SLOT_LABEL: Record<ResurveySlotCode, { vi: string; en: string }> = {
  'P-01': { vi: 'Biển số nhà / tên công trình', en: 'House number / signboard' },
  'P-02': { vi: 'Mặt đứng chính toàn cảnh', en: 'Overall view of the main facade' },
  'P-03': { vi: 'Mặt bên', en: 'Side facade' },
  'P-04': { vi: 'Bối cảnh đường phố & tuyến Metro', en: 'Street context & Metro alignment' },
  'P-05': { vi: 'Kiểm tra độ nghiêng công trình', en: 'Building inclination check' },
  'P-06': { vi: 'Khảo sát lún móng & nền công trình', en: 'Foundation & settlement survey' },
  'P-07': { vi: 'Dấu hiệu bất thường ngoại quan', en: 'Exterior visual anomaly check' },
};
