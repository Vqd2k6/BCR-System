import type { ResurveyItemRow, ResurveySessionView, ResurveySlotCode } from '../types';

/**
 * Trạng thái một ô ảnh trong Studio thẩm định:
 *   NEED      – bị gắn cờ chụp lại, KSV chưa chụp.
 *   CAPTURED  – KSV đã chụp nhưng phiên chưa nộp (DRAFT).
 *   SUBMITTED – đã nộp, chờ duyệt phiên.
 *   APPLIED   – phiên đã duyệt: report đang in ảnh mới (lớp phủ resurvey khi render), Studio hiện ảnh mới.
 *   NA        – phiên đã duyệt đánh dấu không áp dụng: ô bị bỏ khỏi report.
 */
export type StudioResurveyState = 'NEED' | 'CAPTURED' | 'SUBMITTED' | 'APPLIED' | 'NA';

export interface StudioResurveyRow {
  key: string;
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
  naReason: string | null;
}

/** Ảnh gốc (theo URL) → thông tin hiển thị trên thẻ ảnh Studio. */
export interface StudioResurveyMark {
  state: StudioResurveyState;
  newUrl: string | null;
  newRotation: number;
}

export function buildStudioResurveyRows(view: ResurveySessionView): StudioResurveyRow[] {
  const status = view.session?.status ?? null;
  const itemByKey = new Map(view.items.filter((i) => i.photoKey).map((i) => [i.photoKey as string, i]));
  const stateFor = (item: ResurveyItemRow | undefined): StudioResurveyState => {
    if (!item) return 'NEED';
    if (status === 'APPROVED') return item.action === 'MARK_NA' ? 'NA' : 'APPLIED';
    return status === 'SUBMITTED' ? 'SUBMITTED' : 'CAPTURED';
  };

  const rows: StudioResurveyRow[] = [];
  for (const slot of view.slots) {
    const item = itemByKey.get(slot.photoKey);
    if (!slot.flagged && !item) continue;
    rows.push({
      key: slot.photoKey,
      slotCode: slot.slotCode,
      label: slot.label,
      oldUrl: slot.url,
      oldRotation: slot.rotation,
      newUrl: item?.newUrl ?? null,
      newRotation: item?.rotation ?? 0,
      action: item?.action ?? null,
      state: stateFor(item),
      capturedAt: item?.capturedAtClient ?? item?.receivedAt ?? null,
      naReason: item?.naReason ?? null,
    });
  }
  for (const item of view.items) {
    if (item.action !== 'ADD_EXTRA') continue;
    rows.push({
      key: item.id,
      slotCode: item.slotCode,
      label: `Ảnh phát sinh thêm ${item.slotCode}`,
      oldUrl: null,
      oldRotation: 0,
      newUrl: item.newUrl,
      newRotation: item.rotation,
      action: item.action,
      state: stateFor(item),
      capturedAt: item.capturedAtClient ?? item.receivedAt,
      naReason: null,
    });
  }
  return rows.sort((a, b) => a.slotCode.localeCompare(b.slotCode));
}

/** Map URL ảnh gốc → dấu trạng thái, để thẻ ảnh Studio đổi sang ảnh mới / gắn badge. */
export function buildStudioResurveyMarks(rows: StudioResurveyRow[]): Map<string, StudioResurveyMark> {
  const marks = new Map<string, StudioResurveyMark>();
  for (const r of rows) {
    if (!r.oldUrl) continue;
    marks.set(r.oldUrl, { state: r.state, newUrl: r.newUrl, newRotation: r.newRotation });
  }
  return marks;
}

export const STUDIO_RESURVEY_STATE_LABEL: Record<StudioResurveyState, string> = {
  NEED: 'Cần chụp lại – chưa có ảnh',
  CAPTURED: 'KSV đã chụp, chưa nộp',
  SUBMITTED: 'Đã chụp, chờ duyệt phiên',
  APPLIED: 'Đã đưa vào report',
  NA: 'Không áp dụng (bỏ khỏi report)',
};

export const STUDIO_RESURVEY_STATE_CLASS: Record<StudioResurveyState, string> = {
  NEED: 'bg-rose-950 text-rose-300 border-rose-700',
  CAPTURED: 'bg-sky-950 text-sky-300 border-sky-700',
  SUBMITTED: 'bg-amber-950 text-amber-300 border-amber-700',
  APPLIED: 'bg-emerald-950 text-emerald-300 border-emerald-700',
  NA: 'bg-slate-800 text-slate-300 border-slate-600',
};
