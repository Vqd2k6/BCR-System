import React, { useEffect, useMemo, useState } from 'react';
import { AlertTriangle, ArrowLeft, CheckCircle2, Clock, Info, Loader2, Send, ShieldCheck, XCircle } from 'lucide-react';
import { useAuth } from '../../../context/AuthContext';
import { usePhotoResurveyStore } from '../store/usePhotoResurveyStore';
import { ResurveyIdentityPanel } from './ResurveyIdentityPanel';
import { ResurveyExtraSection, ResurveySlotCard } from './ResurveySlotCards';
import type { ResurveyExtraTimePreview, ResurveyItemRow, ResurveySlotCode } from '../types';
import { REJECT_NOTE_MIN, STATUS_LABEL } from '../types';

export interface PhotoResurveyScreenProps {
  reportId: string;
  onClose: () => void;
  /** Gọi sau mỗi thay đổi trạng thái phiên (nộp / duyệt / từ chối) để màn chứa tải lại dấu GIS / danh sách. */
  onChanged?: () => void;
  /** Ép chế độ chỉ đọc (VD: Admin xem từ bản đồ). Mặc định theo quyền server trả về. */
  readOnly?: boolean;
}

const EXTERIOR_GROUP: readonly ResurveySlotCode[] = ['P-01', 'P-02', 'P-03', 'P-04'];

const STATUS_BADGE: Record<string, string> = {
  DRAFT: 'bg-sky-950 text-sky-300 border-sky-700',
  SUBMITTED: 'bg-amber-950 text-amber-300 border-amber-700',
  APPROVED: 'bg-emerald-950 text-emerald-300 border-emerald-700',
};

/** "2026-11-20T08:12:00.000Z" → giá trị cho <input type="datetime-local" step="1"> theo giờ máy. */
function toLocalInput(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
}

/**
 * Màn Khảo sát bổ sung một hồ sơ nhà dân (full màn hình):
 * - Bước 1 chỉ đọc để KSV nhận đúng nhà.
 * - Mục 1.5 (P-01..P-04) và 1.6 (P-05..P-07): ảnh gốc, cờ "PHẢI CHỤP LẠI", chụp lại / N/A / chụp thêm.
 * - Admin: đối chiếu ảnh cũ – mới, duyệt hoặc từ chối (kèm lý do).
 */
export const PhotoResurveyScreen: React.FC<PhotoResurveyScreenProps> = ({ reportId, onClose, onChanged, readOnly }) => {
  const { user } = useAuth();
  const { view, loading, busy, error, load, reset, clearError, start, replace, addExtra, markNa, removeItem, rotateItem, submit, approve, reject } =
    usePhotoResurveyStore();
  const [reviewNote, setReviewNote] = useState('');
  const [overrides, setOverrides] = useState<Record<string, string>>({});

  useEffect(() => {
    void load(reportId);
    return () => reset();
  }, [reportId, load, reset]);

  const isSurveyor = user?.role === 'SURVEYOR';
  const canEdit = Boolean(view?.canEdit) && !readOnly;
  const hasSession = Boolean(view?.session);
  const sessionEditable = canEdit && view?.session?.status === 'DRAFT';
  const effectiveReadOnly = !canEdit;
  const locked = Boolean(busy);

  const itemByKey = useMemo(() => {
    const m = new Map<string, ResurveyItemRow>();
    for (const it of view?.items ?? []) if (it.photoKey) m.set(it.photoKey, it);
    return m;
  }, [view?.items]);
  const extrasBySlot = useMemo(() => {
    const m = new Map<ResurveySlotCode, ResurveyItemRow[]>();
    for (const it of view?.items ?? []) {
      if (it.action !== 'ADD_EXTRA') continue;
      m.set(it.slotCode, [...(m.get(it.slotCode) ?? []), it]);
    }
    return m;
  }, [view?.items]);
  const previews = useMemo(() => new Map<string, ResurveyExtraTimePreview>((view?.extraTimes ?? []).map((t) => [t.itemId, t])), [view?.extraTimes]);

  const flagged = (view?.slots ?? []).filter((s) => s.flagged);
  const handledCount = flagged.filter((s) => itemByKey.has(s.photoKey)).length;
  const allHandled = flagged.length > 0 && handledCount === flagged.length;
  const extraSlots = new Set<ResurveySlotCode>([...(view?.extraSlotCodes ?? []), ...extrasBySlot.keys()]);

  const afterChange = (ok: boolean) => {
    if (ok) onChanged?.();
  };

  const renderGroup = (title: string, codes: readonly ResurveySlotCode[]) => {
    const slots = (view?.slots ?? []).filter((s) => codes.includes(s.slotCode));
    const extraCodes = codes.filter((c) => extraSlots.has(c));
    if (slots.length === 0 && extraCodes.length === 0) return null;
    return (
      <section className="space-y-2.5">
        <h3 className="text-sm sm:text-base font-bold text-slate-800">{title}</h3>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-2.5">
          {slots.map((slot) => (
            <ResurveySlotCard
              key={slot.photoKey}
              slot={slot}
              item={itemByKey.get(slot.photoKey) ?? null}
              canEdit={sessionEditable}
              locked={locked}
              busyHere={busy === `slot:${slot.photoKey}`}
              onReplace={replace}
              onNa={markNa}
              onRemove={removeItem}
              onRotate={rotateItem}
            />
          ))}
          {extraCodes.map((code) => (
            <ResurveyExtraSection
              key={`extra-${code}`}
              slotCode={code}
              items={extrasBySlot.get(code) ?? []}
              previews={previews}
              canEdit={sessionEditable && (view?.extraSlotCodes ?? []).includes(code)}
              locked={locked}
              busyHere={busy === `extra:${code}`}
              onAdd={addExtra}
              onRemove={removeItem}
              onRotate={rotateItem}
            />
          ))}
        </div>
      </section>
    );
  };

  const extraItems = (view?.items ?? []).filter((i) => i.action === 'ADD_EXTRA');
  const title = view?.canReview ? 'Duyệt Khảo Sát Bổ Sung' : 'Khảo Sát Bổ Sung Ảnh Ngoài Nhà';

  return (
    <div className="fixed inset-0 z-[2000] bg-slate-100 flex flex-col">
      <header className="shrink-0 bg-white/95 backdrop-blur-md border-b border-slate-200/80 px-3 py-2.5 flex items-center gap-2">
        <button
          type="button"
          onClick={onClose}
          className="p-2 rounded-xl border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 cursor-pointer"
          aria-label="Quay lại"
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5 flex-wrap">
            <h2 className="text-sm sm:text-base font-black text-slate-800 truncate">
              {title}
              {effectiveReadOnly && isSurveyor ? ' (Chỉ Đọc)' : ''}
            </h2>
            {effectiveReadOnly && isSurveyor && (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold border bg-sky-950 text-sky-300 border-sky-700">Khảo Sát Viên</span>
            )}
          </div>
          <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
            {view?.identity.projectParcelCode && (
              <span className="px-2 py-0.5 rounded-md text-[10px] border bg-teal-950 text-teal-300 border-teal-700 font-mono font-bold">
                {view.identity.projectParcelCode}
              </span>
            )}
            {view?.identity.zoneId && (
              <span className="px-2 py-0.5 rounded-md text-[10px] border bg-cyan-950 text-cyan-300 border-cyan-700 font-mono font-bold">
                {view.identity.zoneId}
              </span>
            )}
            {view?.session && (
              <span className={`px-2 py-0.5 rounded-md text-[10px] border font-bold ${STATUS_BADGE[view.session.status]}`}>
                {STATUS_LABEL[view.session.status]}
              </span>
            )}
          </div>
        </div>
      </header>

      <main className="flex-1 overflow-y-auto px-3 py-3 space-y-3 pb-28">
        {loading && !view && (
          <div className="flex items-center justify-center gap-2 py-16 text-sm text-slate-600">
            <Loader2 className="w-5 h-5 animate-spin" /> Đang tải hồ sơ…
          </div>
        )}

        {error && (
          <div className="px-3 py-2 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-800 flex items-start gap-2">
            <XCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span className="flex-1">{error}</span>
            <button type="button" onClick={clearError} className="font-bold underline cursor-pointer">
              Đóng
            </button>
          </div>
        )}

        {view && (
          <>
            {view.session?.status === 'DRAFT' && view.session.rejectCount > 0 && view.session.reviewNote && (
              <div className="px-3 py-2 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-900 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>
                  <strong>Admin yêu cầu chụp lại (lần {view.session.rejectCount}):</strong> {view.session.reviewNote}
                </span>
              </div>
            )}
            {view.session?.status === 'SUBMITTED' && (
              <div className="px-3 py-2 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900 flex items-center gap-2">
                <Clock className="w-4 h-4 shrink-0" /> Đã nộp lúc {view.session.submittedAt ? new Date(view.session.submittedAt).toLocaleString('vi-VN') : '---'}
                {view.session.surveyorName ? ` bởi ${view.session.surveyorName}` : ''}, đang chờ Zone Admin duyệt.
              </div>
            )}
            {view.session?.status === 'APPROVED' && (
              <div className="px-3 py-2 rounded-xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-900 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0" /> Đã duyệt. Report in ảnh chụp lại thay ảnh gốc; ảnh gốc vẫn được lưu nguyên.
              </div>
            )}
            {view.appliesFromNextRevision && (
              <div className="px-3 py-2 rounded-xl bg-sky-50 border border-sky-200 text-xs text-sky-900 flex items-center gap-2">
                <Info className="w-4 h-4 shrink-0" /> Hồ sơ đã phát hành: ảnh chụp lại chỉ in từ bản phát hành kế tiếp, bản đã phát hành giữ nguyên.
              </div>
            )}
            {view.extraTimeError && (
              <div className="px-3 py-2 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-900 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" /> {view.extraTimeError}
              </div>
            )}

            {!hasSession && flagged.length === 0 && (
              <div className="px-3 py-6 rounded-2xl bg-white border border-slate-200 text-center text-sm text-slate-600">
                Hồ sơ không còn ảnh ngoài nhà nào cần chụp lại. Liên hệ Zone Admin nếu cần khảo sát bổ sung.
              </div>
            )}

            {!hasSession && canEdit && flagged.length > 0 && (
              <div className="px-3 py-3 rounded-2xl bg-white border border-sky-200 space-y-2">
                <div className="text-sm text-slate-700">
                  Hồ sơ có <strong>{flagged.length}</strong> ảnh ngoài nhà cần chụp lại theo rà soát Photo QC. Đối chiếu đúng nhà ở phần thông tin bên dưới rồi bắt đầu.
                </div>
                <button
                  type="button"
                  disabled={locked}
                  onClick={() => void start().then(afterChange)}
                  className="w-full px-3 py-2.5 rounded-xl bg-sky-600 text-white text-sm font-bold hover:bg-sky-700 flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {busy === 'start' ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
                  Bắt đầu khảo sát bổ sung
                </button>
              </div>
            )}

            <ResurveyIdentityPanel identity={view.identity} />

            {renderGroup('1.5. Bộ ảnh định danh ngoại thất (P-01 → P-04)', EXTERIOR_GROUP)}
            {renderGroup('1.6. Ảnh lún chênh & nghiêng ngoài nhà (P-05 → P-07)', ['P-05', 'P-06', 'P-07'])}

            {view.canReview && !readOnly && (
              <section className="rounded-2xl border border-amber-300 bg-amber-50/60 p-3 space-y-2.5">
                <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-amber-700" /> Thẩm định của Zone Admin
                </h3>
                {extraItems.length > 0 && (
                  <div className="space-y-1.5">
                    <div className="text-[11px] text-slate-600">
                      Giờ in watermark của ảnh chụp thêm (để trống = giữ giờ hệ thống đã xếp). Phải nằm giữa ảnh cuối của mục và ảnh kế tiếp.
                    </div>
                    {extraItems.map((it) => (
                      <label key={it.id} className="flex items-center gap-2 text-xs text-slate-700">
                        <span className="w-40 shrink-0">
                          {it.slotCode} #{it.extraIndex}: {it.time2Text || '---'}
                        </span>
                        <input
                          type="datetime-local"
                          step={1}
                          value={overrides[it.id] ?? ''}
                          placeholder={toLocalInput(it.time2At)}
                          onChange={(e) => setOverrides((o) => ({ ...o, [it.id]: e.target.value }))}
                          className="px-2 py-1 rounded-lg border border-slate-300 text-xs"
                        />
                      </label>
                    ))}
                  </div>
                )}
                <textarea
                  value={reviewNote}
                  onChange={(e) => setReviewNote(e.target.value)}
                  rows={2}
                  placeholder={`Ghi chú duyệt / lý do từ chối (từ chối cần tối thiểu ${REJECT_NOTE_MIN} ký tự)`}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-xs"
                />
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={locked || reviewNote.trim().length < REJECT_NOTE_MIN}
                    onClick={() => void reject(reviewNote).then(afterChange)}
                    className="flex-1 px-3 py-2 rounded-xl border text-xs font-bold bg-rose-950 text-rose-300 border-rose-700 hover:bg-rose-900 flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {busy === 'reject' ? <Loader2 className="w-4 h-4 animate-spin" /> : <XCircle className="w-4 h-4" />} Từ chối, yêu cầu chụp lại
                  </button>
                  <button
                    type="button"
                    disabled={locked}
                    onClick={() => {
                      const isoOverrides: Record<string, string> = {};
                      for (const [id, local] of Object.entries(overrides)) {
                        if (local) isoOverrides[id] = new Date(local).toISOString();
                      }
                      void approve(reviewNote, isoOverrides).then(afterChange);
                    }}
                    className="flex-1 px-3 py-2 rounded-xl border text-xs font-bold bg-emerald-950 text-emerald-300 border-emerald-700 hover:bg-emerald-900 flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {busy === 'approve' ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />} Phê duyệt & áp dụng
                  </button>
                </div>
              </section>
            )}
          </>
        )}
      </main>

      {view && sessionEditable && (
        <footer className="fixed bottom-0 inset-x-0 z-[2001] bg-white/95 backdrop-blur-md border-t border-slate-200 px-3 py-2.5 flex items-center gap-3">
          <div className="text-xs text-slate-600 flex-1">
            Đã xử lý <strong className={allHandled ? 'text-emerald-700' : 'text-rose-700'}>{handledCount}/{flagged.length}</strong> ảnh cần chụp lại
            {extraItems.length > 0 ? ` • ${extraItems.length} ảnh chụp thêm` : ''}
          </div>
          <button
            type="button"
            disabled={locked || !allHandled || Boolean(view.extraTimeError)}
            onClick={() => void submit().then(afterChange)}
            className="px-4 py-2.5 rounded-xl bg-sky-600 text-white text-sm font-bold hover:bg-sky-700 flex items-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {busy === 'submit' ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />} Nộp kết quả
          </button>
        </footer>
      )}
    </div>
  );
};
