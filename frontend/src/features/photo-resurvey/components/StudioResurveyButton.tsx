import React, { useCallback, useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Camera } from 'lucide-react';
import { fetchResurveyView } from '../api/photoResurvey.api';
import { PhotoResurveyScreen } from './PhotoResurveyScreen';
import { STATUS_LABEL, type ResurveySessionView } from '../types';

interface StudioResurveyButtonProps {
  reportId: string;
  /** Gọi sau khi phiên đổi trạng thái (duyệt / từ chối) để Studio tải lại dữ liệu. */
  onChanged?: () => void;
}

const BADGE: Record<string, string> = {
  DRAFT: 'bg-sky-950 text-sky-300 border-sky-700',
  SUBMITTED: 'bg-amber-950 text-amber-300 border-amber-700',
  APPROVED: 'bg-emerald-950 text-emerald-300 border-emerald-700',
};

/**
 * Lối vào ảnh KSV chụp lại trong Studio thẩm định: hiện khi hồ sơ có cờ chụp lại hoặc đã có phiên.
 * Đối chiếu ảnh CŨ – MỚI và duyệt/từ chối nằm ở PhotoResurveyScreen (Admin).
 */
export const StudioResurveyButton: React.FC<StudioResurveyButtonProps> = ({ reportId, onChanged }) => {
  const [view, setView] = useState<ResurveySessionView | null>(null);
  const [open, setOpen] = useState(false);

  const load = useCallback(async () => {
    try {
      setView(await fetchResurveyView(reportId));
    } catch (err: unknown) {
      // Hồ sơ không thuộc diện chụp lại (vd căn hộ): ẩn nút, vẫn log để truy vết.
      console.error('[StudioResurveyButton:load] Không tải được trạng thái ảnh chụp lại', err);
      setView(null);
    }
  }, [reportId]);

  useEffect(() => {
    void load();
  }, [load]);

  const status = view?.session?.status ?? null;
  const flaggedCount = (view?.slots ?? []).filter((s) => s.flagged).length;
  if (!view || (!status && flaggedCount === 0)) return null;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="px-2.5 py-1 bg-sky-50 hover:bg-sky-100 text-sky-700 border border-sky-200 rounded-lg text-[11px] font-bold flex items-center gap-1 transition-all cursor-pointer shadow-2xs"
        title="Đối chiếu ảnh cũ – ảnh KSV chụp lại và duyệt"
      >
        <Camera className="w-3 h-3 text-sky-600" />
        <span>Ảnh Chụp Lại</span>
        <span className={`px-1.5 py-px rounded-full border text-[10px] ${status ? BADGE[status] : 'bg-slate-800 text-slate-300 border-slate-600'}`}>
          {status ? STATUS_LABEL[status] ?? status : `${flaggedCount} ảnh cần chụp`}
        </span>
      </button>
      {open &&
        createPortal(
          <PhotoResurveyScreen
            reportId={reportId}
            onClose={() => {
              setOpen(false);
              void load();
            }}
            onChanged={() => {
              void load();
              onChanged?.();
            }}
          />,
          document.body
        )}
    </>
  );
};
