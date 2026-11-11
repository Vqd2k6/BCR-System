import type { ResurveyItemRow, ResurveySessionView, ResurveySlotCode } from '../types';

/**
 * Trạng thái một mục ảnh chụp lại trong Studio thẩm định:
 *   NEED      – bị gắn cờ chụp lại, KSV chưa chụp.
 *   CAPTURED  – KSV đã chụp nhưng phiên chưa nộp (DRAFT).
 *   SUBMITTED – đã nộp, chờ duyệt phiên.
 *   READY     – phiên đã duyệt, chờ Thẩm định quyết định Đưa vào / Bỏ qua (report vẫn in ảnh cũ).
 *   APPLIED   – Thẩm định đã Đưa vào: report in ảnh mới (hoặc thêm ảnh / bỏ ô N/A).
 *   DECLINED  – Thẩm định Bỏ qua: giữ ảnh cũ.
 */
export type StudioResurveyState = 'NEED' | 'CAPTURED' | 'SUBMITTED' | 'READY' | 'APPLIED' | 'DECLINED';

export interface StudioResurveyRow {
  key: string;
  /** Mục trong phiên (null khi KSV chưa chụp). */
  itemId: string | null;
  slotCode: ResurveySlotCode;
  label: string;
  /** Ảnh đang có trong hồ sơ (null với ảnh phát sinh thêm). */
  oldUrl: string | null;
  oldRotation: number;
  newUrl: string | null;
  newRotation: number;
  action: ResurveyItemRow['action'] | null;
  state: StudioResurveyState;
  capturedAt: string | null;
  /** Giờ ảnh gốc đang in trên report (watermark). */
  oldTimeText: string | null;
  /** Giờ sẽ in trên report nếu Đưa vào (Time 2: thay ảnh giữ giờ gốc, ảnh phát sinh chèn giữa 2 ảnh kề). */
  printTimeText: string | null;
  /** Nguồn giờ in của ảnh phát sinh (ADMIN = Admin chỉnh tay). */
  time2Source: ResurveyItemRow['time2Source'];
  naReason: string | null;
}

/** Ảnh gốc (theo URL) → thông tin hiển thị trên thẻ ảnh Studio. */
export interface StudioResurveyMark {
  state: StudioResurveyState;
  action: ResurveyItemRow['action'] | null;
  newUrl: string | null;
  newRotation: number;
}

export function buildStudioResurveyRows(view: ResurveySessionView): StudioResurveyRow[] {
  const status = view.session?.status ?? null;
  const itemByKey = new Map(view.items.filter((i) => i.photoKey).map((i) => [i.photoKey as string, i]));
  const stateFor = (item: ResurveyItemRow | undefined): StudioResurveyState => {
    if (!item) return 'NEED';
    if (status === 'APPROVED') {
      if (item.applyStatus === 'APPLIED') return 'APPLIED';
      if (item.applyStatus === 'DECLINED') return 'DECLINED';
      return 'READY';
    }
    return status === 'SUBMITTED' ? 'SUBMITTED' : 'CAPTURED';
  };

  // Ô đã Đưa vào: report đang in ảnh mới nên view.slots trả URL mới. Lấy ảnh cũ từ originalUrl của mục.
  const rows: StudioResurveyRow[] = [];
  const seenKeys = new Set<string>();
  for (const slot of view.slots) {
    const item = itemByKey.get(slot.photoKey);
    if (!slot.flagged && !item) continue;
    seenKeys.add(slot.photoKey);
    const applied = item?.applyStatus === 'APPLIED' && status === 'APPROVED';
    rows.push({
      key: slot.photoKey,
      itemId: item?.id ?? null,
      slotCode: slot.slotCode,
      label: slot.label,
      oldUrl: item?.originalUrl ?? slot.url,
      oldRotation: applied ? 0 : slot.rotation,
      newUrl: item?.newUrl ?? null,
      newRotation: item?.rotation ?? 0,
      action: item?.action ?? null,
      state: stateFor(item),
      capturedAt: item?.capturedAtClient ?? item?.receivedAt ?? null,
      oldTimeText: slot.dateTimeText || null,
      // Ảnh thay thế: report luôn in giờ ảnh gốc ở vị trí đó (không đọc time2 đã lưu).
      printTimeText: item?.action === 'REPLACE' ? slot.dateTimeText || null : item?.time2Text ?? null,
      time2Source: item?.time2Source ?? null,
      naReason: item?.naReason ?? null,
    });
  }
  for (const item of view.items) {
    // Mục N/A đã Đưa vào: ô bị bỏ khỏi report nên không còn trong view.slots.
    if (item.photoKey && seenKeys.has(item.photoKey)) continue;
    rows.push({
      key: item.id,
      itemId: item.id,
      slotCode: item.slotCode,
      label: item.action === 'ADD_EXTRA' ? `Ảnh phát sinh thêm ${item.slotCode}` : `${item.slotCode} (${item.photoKey ?? ''})`,
      oldUrl: item.action === 'ADD_EXTRA' ? null : item.originalUrl,
      oldRotation: 0,
      newUrl: item.newUrl,
      newRotation: item.rotation,
      action: item.action,
      state: stateFor(item),
      capturedAt: item.capturedAtClient ?? item.receivedAt,
      oldTimeText: null,
      printTimeText: item.time2Text,
      time2Source: item.time2Source,
      naReason: item.naReason,
    });
  }
  return rows.sort((a, b) => a.slotCode.localeCompare(b.slotCode));
}

/** Map URL ảnh gốc → dấu trạng thái, để thẻ ảnh Studio đổi sang ảnh mới / gắn badge. */
export function buildStudioResurveyMarks(rows: StudioResurveyRow[]): Map<string, StudioResurveyMark> {
  const marks = new Map<string, StudioResurveyMark>();
  for (const r of rows) {
    if (!r.oldUrl) continue;
    marks.set(r.oldUrl, { state: r.state, action: r.action, newUrl: r.newUrl, newRotation: r.newRotation });
  }
  return marks;
}

export const STUDIO_RESURVEY_STATE_LABEL: Record<StudioResurveyState, string> = {
  NEED: 'Cần chụp lại – chưa có ảnh',
  CAPTURED: 'KSV đã chụp, chưa nộp',
  SUBMITTED: 'Đã chụp, chờ duyệt phiên',
  READY: 'Ảnh mới – chờ đưa vào',
  APPLIED: 'Đã đưa vào report',
  DECLINED: 'Đã bỏ qua, giữ ảnh cũ',
};

export const STUDIO_RESURVEY_STATE_CLASS: Record<StudioResurveyState, string> = {
  NEED: 'bg-rose-950 text-rose-300 border-rose-700',
  CAPTURED: 'bg-sky-950 text-sky-300 border-sky-700',
  SUBMITTED: 'bg-sky-950 text-sky-300 border-sky-700',
  READY: 'bg-amber-950 text-amber-300 border-amber-700',
  APPLIED: 'bg-emerald-950 text-emerald-300 border-emerald-700',
  DECLINED: 'bg-slate-800 text-slate-300 border-slate-600',
};
