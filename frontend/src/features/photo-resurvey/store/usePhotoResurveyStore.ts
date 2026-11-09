import { create } from 'zustand';
import { getErrorMessage } from '../../../utils/errorUtils';
import {
  approveResurvey,
  fetchResurveyView,
  markResurveyNa,
  rejectResurvey,
  removeResurveyItem,
  rotateResurveyItem,
  startResurveySession,
  submitResurvey,
  uploadExtraPhoto,
  uploadReplacePhoto,
} from '../api/photoResurvey.api';
import type { CapturedPhoto, ResurveySessionView, ResurveySlotCode } from '../types';

/**
 * Store riêng của Khảo sát bổ sung – KHÔNG dùng chung usePhase1SurveyStore để không đè bản nháp
 * khảo sát đang làm dở của KSV. Không lưu localStorage: nguồn sự thật là server.
 */
interface PhotoResurveyState {
  reportId: string | null;
  view: ResurveySessionView | null;
  loading: boolean;
  /** Khoá thao tác ghi: tên việc đang chạy (ô ảnh / nộp / duyệt). Khác null thì mọi nút ghi bị khoá. */
  busy: string | null;
  error: string | null;
  load: (reportId: string) => Promise<void>;
  reset: () => void;
  clearError: () => void;
  start: () => Promise<boolean>;
  replace: (photoKey: string, photo: CapturedPhoto) => Promise<boolean>;
  addExtra: (slotCode: ResurveySlotCode, photo: CapturedPhoto) => Promise<boolean>;
  markNa: (photoKey: string, reason: string) => Promise<boolean>;
  removeItem: (itemId: string) => Promise<boolean>;
  rotateItem: (itemId: string, rotation: number) => Promise<boolean>;
  submit: () => Promise<boolean>;
  approve: (note: string, time2Overrides: Record<string, string>) => Promise<boolean>;
  reject: (note: string) => Promise<boolean>;
}

export const usePhotoResurveyStore = create<PhotoResurveyState>((set, get) => {
  /** Chạy một thao tác ghi: khoá nút, cập nhật view từ server, log lỗi có tag và giữ thông báo cho UI. */
  const runWrite = async (
    busyKey: string,
    tag: string,
    fn: (view: ResurveySessionView) => Promise<ResurveySessionView>
  ): Promise<boolean> => {
    const { view, busy } = get();
    if (!view || busy) return false;
    set({ busy: busyKey, error: null });
    try {
      const next = await fn(view);
      set({ view: next, busy: null });
      return true;
    } catch (err: unknown) {
      console.error(`[PhotoResurvey:${tag}] Thao tác thất bại`, err);
      set({ busy: null, error: getErrorMessage(err, 'Thao tác thất bại, vui lòng thử lại') });
      return false;
    }
  };

  const sessionId = (view: ResurveySessionView): string => {
    if (!view.session) throw new Error('Chưa mở phiên khảo sát bổ sung');
    return view.session.id;
  };

  return {
    reportId: null,
    view: null,
    loading: false,
    busy: null,
    error: null,

    load: async (reportId) => {
      set({ reportId, loading: true, error: null, view: get().reportId === reportId ? get().view : null });
      try {
        const view = await fetchResurveyView(reportId);
        if (get().reportId === reportId) set({ view, loading: false });
      } catch (err: unknown) {
        console.error('[PhotoResurvey:load] Không tải được phiên khảo sát bổ sung', err);
        set({ loading: false, error: getErrorMessage(err, 'Không tải được dữ liệu khảo sát bổ sung') });
      }
    },
    reset: () => set({ reportId: null, view: null, loading: false, busy: null, error: null }),
    clearError: () => set({ error: null }),

    start: () => runWrite('start', 'start', (v) => startResurveySession(v.reportId)),
    replace: (photoKey, photo) => runWrite(`slot:${photoKey}`, 'replace', (v) => uploadReplacePhoto(sessionId(v), photoKey, photo)),
    addExtra: (slotCode, photo) => runWrite(`extra:${slotCode}`, 'addExtra', (v) => uploadExtraPhoto(sessionId(v), slotCode, photo)),
    markNa: (photoKey, reason) => runWrite(`slot:${photoKey}`, 'markNa', (v) => markResurveyNa(sessionId(v), photoKey, reason)),
    removeItem: (itemId) => runWrite(`item:${itemId}`, 'removeItem', (v) => removeResurveyItem(sessionId(v), itemId)),
    rotateItem: (itemId, rotation) => runWrite(`item:${itemId}`, 'rotateItem', (v) => rotateResurveyItem(sessionId(v), itemId, rotation)),
    submit: () => runWrite('submit', 'submit', (v) => submitResurvey(sessionId(v))),
    approve: (note, time2Overrides) =>
      runWrite('approve', 'approve', (v) =>
        approveResurvey(sessionId(v), {
          note: note.trim() || undefined,
          time2Overrides: Object.keys(time2Overrides).length > 0 ? time2Overrides : undefined,
        })
      ),
    reject: (note) => runWrite('reject', 'reject', (v) => rejectResurvey(sessionId(v), note.trim())),
  };
});
