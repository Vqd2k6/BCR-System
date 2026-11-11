import React, { useMemo } from 'react';
import { ArrowRight, Camera, ClipboardCheck, ImageOff, X } from 'lucide-react';
import type { ResurveySessionView } from '../types';
import { STATUS_LABEL } from '../types';
import { ResurveyPhoto } from './ResurveyPhoto';
import {
  buildStudioResurveyRows,
  STUDIO_RESURVEY_STATE_CLASS,
  STUDIO_RESURVEY_STATE_LABEL,
  type StudioResurveyState,
} from '../utils/studioResurveyStatus';

interface StudioResurveyPanelProps {
  view: ResurveySessionView;
  onClose: () => void;
  /** Mở màn duyệt phiên (PhotoResurveyScreen) khi phiên đang chờ duyệt. */
  onOpenReview: () => void;
}

const ORDER: StudioResurveyState[] = ['SUBMITTED', 'NEED', 'CAPTURED', 'APPLIED', 'NA'];

function formatTime(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleString('vi-VN', { hour12: false });
}

/**
 * Ảnh chụp lại của căn đang thẩm định, theo từng ô: ảnh CŨ – ảnh MỚI – trạng thái.
 * Ảnh mới chỉ vào report khi phiên được duyệt (report thay theo ô và URL gốc); Studio hiện theo đúng trạng thái đó.
 */
export const StudioResurveyPanel: React.FC<StudioResurveyPanelProps> = ({ view, onClose, onOpenReview }) => {
  const rows = useMemo(() => buildStudioResurveyRows(view), [view]);
  const counts = useMemo(() => {
    const c: Record<StudioResurveyState, number> = { NEED: 0, CAPTURED: 0, SUBMITTED: 0, APPLIED: 0, NA: 0 };
    for (const r of rows) c[r.state]++;
    return c;
  }, [rows]);
  const status = view.session?.status ?? null;
  const canOpenReview = status === 'SUBMITTED' && view.canReview;

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
              <button
                type="button"
                onClick={onOpenReview}
                className="px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 bg-amber-500 hover:bg-amber-600 text-white cursor-pointer"
              >
                <ClipboardCheck className="w-3.5 h-3.5" />
                <span>Duyệt phiên chụp lại</span>
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
          Ảnh mới chỉ được đưa vào report sau khi <strong>duyệt phiên chụp lại</strong>. Khi đã duyệt, report in ảnh mới thay ảnh cũ ở đúng ô
          (giữ giờ gốc), và thẻ ảnh trong Studio đổi sang ảnh mới kèm nhãn "Ảnh mới chụp lại". Crop QC của ảnh cũ không áp sang ảnh mới.
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {rows.length === 0 && <div className="py-10 text-center text-xs text-slate-500">Căn này không có ô ảnh nào cần chụp lại.</div>}
          {rows.map((r) => (
            <div key={r.key} className="rounded-xl border border-slate-200 p-3">
              <div className="flex flex-wrap items-center gap-2 mb-2">
                <span className="px-2 py-0.5 rounded-lg border text-[11px] bg-teal-950 text-teal-300 border-teal-700 font-mono font-bold">{r.slotCode}</span>
                <span className="text-xs font-semibold text-slate-700 truncate">{r.label}</span>
                <span className={`ml-auto px-2 py-0.5 rounded-full border text-[11px] font-bold ${STUDIO_RESURVEY_STATE_CLASS[r.state]}`}>
                  {STUDIO_RESURVEY_STATE_LABEL[r.state]}
                </span>
              </div>
              <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-3 force-light">
                <div className="space-y-1">
                  <div className="text-[10px] font-bold uppercase text-slate-500">Ảnh cũ trong hồ sơ</div>
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
                      <span>Đánh dấu không áp dụng: {r.naReason ?? '---'}</span>
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
