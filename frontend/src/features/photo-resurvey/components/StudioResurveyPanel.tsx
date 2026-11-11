import React, { useMemo, useState } from 'react';
import { AlertTriangle, ArrowRight, Camera, CheckCircle2, ClipboardCheck, ImageOff, Undo2, X, XCircle } from 'lucide-react';
import { getErrorMessage } from '../../../utils/errorUtils';
import { decideResurveyApply } from '../api/photoResurvey.api';
import type { ResurveyApplyStatus, ResurveySessionView } from '../types';
import { STATUS_LABEL } from '../types';
import { ResurveyPhoto } from './ResurveyPhoto';
import {
  buildStudioResurveyRows,
  STUDIO_RESURVEY_STATE_CLASS,
  STUDIO_RESURVEY_STATE_LABEL,
  type StudioResurveyRow,
  type StudioResurveyState,
} from '../utils/studioResurveyStatus';

interface StudioResurveyPanelProps {
  view: ResurveySessionView;
  onClose: () => void;
  /** Mở màn duyệt phiên (PhotoResurveyScreen) khi phiên đang chờ duyệt. */
  onOpenReview: () => void;
  /** Sau mỗi quyết định Đưa vào / Bỏ qua / Hoàn tác: view mới từ server. */
  onDecided: (view: ResurveySessionView) => void;
}

const ORDER: StudioResurveyState[] = ['READY', 'SUBMITTED', 'NEED', 'CAPTURED', 'APPLIED', 'DECLINED'];

const BTN = 'px-2.5 py-1 rounded-lg text-xs font-bold flex items-center gap-1 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed';

function formatTime(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleString('vi-VN', { hour12: false });
}

function applyLabel(row: StudioResurveyRow): string {
  if (row.action === 'MARK_NA') return 'Đưa vào (bỏ ô khỏi report)';
  if (row.action === 'ADD_EXTRA') return 'Đưa vào (thêm ảnh)';
  return 'Đưa vào (thay ảnh cũ)';
}

/**
 * Ảnh chụp lại của căn đang thẩm định, theo từng ô: ảnh CŨ – ảnh MỚI – trạng thái.
 * Duyệt phiên chỉ xác nhận ảnh hợp lệ; Thẩm định quyết định Đưa vào report từng mục (có Hoàn tác).
 */
export const StudioResurveyPanel: React.FC<StudioResurveyPanelProps> = ({ view, onClose, onOpenReview, onDecided }) => {
  const rows = useMemo(() => buildStudioResurveyRows(view), [view]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const counts = useMemo(() => {
    const c: Record<StudioResurveyState, number> = { NEED: 0, CAPTURED: 0, SUBMITTED: 0, READY: 0, APPLIED: 0, DECLINED: 0 };
    for (const r of rows) c[r.state]++;
    return c;
  }, [rows]);
  const status = view.session?.status ?? null;
  const sessionId = view.session?.id ?? null;
  const canOpenReview = status === 'SUBMITTED' && view.canReview;
  const canDecide = status === 'APPROVED' && view.canReview && Boolean(sessionId);
  const readyIds = rows.filter((r) => r.state === 'READY' && r.itemId).map((r) => r.itemId as string);

  const decide = async (itemIds: string[], decision: ResurveyApplyStatus) => {
    if (!sessionId || itemIds.length === 0 || saving) return;
    setSaving(true);
    setError(null);
    try {
      onDecided(await decideResurveyApply(sessionId, itemIds, decision));
    } catch (err: unknown) {
      console.error('[StudioResurveyPanel:decide] Không lưu được quyết định đưa vào report', err);
      setError(getErrorMessage(err, 'Không lưu được quyết định đưa vào report'));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/50 p-3" role="dialog" aria-modal="true">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[92vh] flex flex-col overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-2.5 border-b border-slate-200">
          <Camera className="w-4 h-4 text-sky-700 shrink-0" />
          <h3 className="text-sm font-bold text-slate-800 truncate">Ảnh chụp lại – {view.identity.reportCode}</h3>
          {status && (
            <span className="px-2 py-0.5 rounded-full border text-[11px] font-bold bg-slate-100 text-slate-700 border-slate-300">
              Phiên: {STATUS_LABEL[status]}
            </span>
          )}
          <div className="ml-auto flex items-center gap-2">
            {canOpenReview && (
              <button type="button" onClick={onOpenReview} className={`${BTN} bg-amber-500 hover:bg-amber-600 text-white`}>
                <ClipboardCheck className="w-3.5 h-3.5" />
                <span>Duyệt phiên chụp lại</span>
              </button>
            )}
            {canDecide && readyIds.length > 1 && (
              <button
                type="button"
                disabled={saving}
                onClick={() => void decide(readyIds, 'APPLIED')}
                className={`${BTN} bg-emerald-600 hover:bg-emerald-700 text-white`}
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Đưa vào tất cả ({readyIds.length})</span>
              </button>
            )}
            <button type="button" onClick={onClose} className="p-1 rounded-lg hover:bg-slate-100 text-slate-500 cursor-pointer" title="Đóng">
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 px-4 py-2 border-b border-slate-100 text-[11px] font-bold">
          {ORDER.filter((s) => counts[s] > 0).map((s) => (
            <span key={s} className={`px-2 py-0.5 rounded-full border ${STUDIO_RESURVEY_STATE_CLASS[s]}`}>
              {STUDIO_RESURVEY_STATE_LABEL[s]}: {counts[s]}
            </span>
          ))}
        </div>

        <div className="px-4 py-2 text-[11px] text-slate-600 bg-sky-50 border-b border-sky-100">
          Duyệt phiên chỉ xác nhận ảnh KSV chụp hợp lệ, <strong>report chưa đổi</strong>. Thẩm định so sánh từng ô rồi bấm <strong>Đưa vào</strong>{' '}
          (report in ảnh mới ở đúng ô, giữ giờ gốc) hoặc <strong>Bỏ qua</strong> (giữ ảnh cũ). Có thể hoàn tác trước khi phát hành Rev.
          Ảnh mới không mang crop của ảnh cũ.
        </div>

        {error && (
          <div className="mx-4 mt-2 px-3 py-2 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-700 flex items-center gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {rows.length === 0 && <div className="py-10 text-center text-xs text-slate-500">Căn này không có ô ảnh nào cần chụp lại.</div>}
          {rows.map((r) => (
            <div key={r.key} className={`rounded-xl border p-3 ${r.state === 'READY' ? 'border-amber-300 bg-amber-50/40' : 'border-slate-200'}`}>
              <div className="flex flex-wrap items-center gap-2 mb-2">
                <span className="px-2 py-0.5 rounded-lg border text-[11px] bg-teal-950 text-teal-300 border-teal-700 font-mono font-bold">{r.slotCode}</span>
                <span className="text-xs font-semibold text-slate-700 truncate">{r.label}</span>
                <span className={`px-2 py-0.5 rounded-full border text-[11px] font-bold ${STUDIO_RESURVEY_STATE_CLASS[r.state]}`}>
                  {STUDIO_RESURVEY_STATE_LABEL[r.state]}
                </span>
                {canDecide && r.itemId && (
                  <div className="ml-auto flex items-center gap-2">
                    {r.state === 'READY' ? (
                      <>
                        <button
                          type="button"
                          disabled={saving}
                          onClick={() => void decide([r.itemId as string], 'DECLINED')}
                          className={`${BTN} bg-slate-50 hover:bg-slate-100 text-slate-700 border border-slate-200`}
                        >
                          <XCircle className="w-3.5 h-3.5" />
                          <span>Bỏ qua</span>
                        </button>
                        <button
                          type="button"
                          disabled={saving}
                          onClick={() => void decide([r.itemId as string], 'APPLIED')}
                          className={`${BTN} bg-emerald-600 hover:bg-emerald-700 text-white`}
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>{applyLabel(r)}</span>
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        disabled={saving}
                        onClick={() => void decide([r.itemId as string], 'PENDING')}
                        className={`${BTN} bg-white hover:bg-slate-50 text-slate-600 border border-slate-200`}
                        title="Đưa về chờ quyết định"
                      >
                        <Undo2 className="w-3.5 h-3.5" />
                        <span>Hoàn tác</span>
                      </button>
                    )}
                  </div>
                )}
              </div>
              <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 force-light">
                <div className="space-y-1">
                  <div className="text-[10px] font-bold uppercase text-slate-500">
                    Ảnh cũ trong hồ sơ{r.state === 'APPLIED' ? ' (đã thay)' : ''}
                  </div>
                  {r.oldUrl ? (
                    <ResurveyPhoto url={r.oldUrl} rotation={r.oldRotation} alt={`Ảnh cũ ${r.label}`} height={180} tone="flag" />
                  ) : (
                    <div className="h-[180px] rounded-lg border border-dashed border-slate-300 flex items-center justify-center text-xs text-slate-500">
                      Ảnh thêm mới, không thay ảnh nào
                    </div>
                  )}
                </div>
                <ArrowRight className="w-5 h-5 text-slate-400" />
                <div className="space-y-1">
                  <div className="text-[10px] font-bold uppercase text-slate-500">
                    Ảnh mới KSV chụp{r.capturedAt ? ` • ${formatTime(r.capturedAt)}` : ''}
                  </div>
                  {r.action === 'MARK_NA' ? (
                    <div className="h-[180px] rounded-lg border border-dashed border-slate-300 flex flex-col items-center justify-center gap-1 text-xs text-slate-600 px-3 text-center">
                      <ImageOff className="w-5 h-5 text-slate-400" />
                      <span>KSV đánh dấu không áp dụng: {r.naReason ?? '---'}</span>
                    </div>
                  ) : r.newUrl ? (
                    <ResurveyPhoto url={r.newUrl} rotation={r.newRotation} alt={`Ảnh mới ${r.label}`} height={180} tone="new" />
                  ) : (
                    <div className="h-[180px] rounded-lg border border-dashed border-rose-300 flex items-center justify-center text-xs text-rose-600">
                      KSV chưa chụp lại ô này
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
