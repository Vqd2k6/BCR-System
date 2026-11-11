import React from 'react';
import { BellRing, Camera, Crop, X } from 'lucide-react';

interface StudioPendingNoticeProps {
  reportCode: string;
  /** Nhãn các ô có ảnh chụp lại chờ Thẩm định đưa vào (vd "P-04 • Bối cảnh đường phố"). */
  readyResurvey: string[];
  /** Số ô có crop chờ duyệt hoặc quá hạn. */
  pendingCropCount: number;
  onOpenResurvey: () => void;
  onOpenCropReview: () => void;
  onClose: () => void;
}

/**
 * Báo cho Thẩm định ngay khi mở Studio: căn có ảnh chụp lại chờ đưa vào hoặc crop chờ duyệt.
 * Không có gì thì không hiện; đóng rồi vẫn còn badge trên header.
 */
export const StudioPendingNotice: React.FC<StudioPendingNoticeProps> = ({
  reportCode,
  readyResurvey,
  pendingCropCount,
  onOpenResurvey,
  onOpenCropReview,
  onClose,
}) => (
  <div className="fixed inset-0 z-[75] flex items-center justify-center bg-black/40 p-3" role="dialog" aria-modal="true">
    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
      <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-200 bg-amber-50">
        <BellRing className="w-4 h-4 text-amber-600 shrink-0" />
        <h3 className="text-sm font-bold text-slate-800 truncate">Căn {reportCode} có cập nhật cần xem</h3>
        <button type="button" onClick={onClose} className="ml-auto p-1 rounded-lg hover:bg-amber-100 text-slate-500 cursor-pointer" title="Để sau">
          <X className="w-4 h-4" />
        </button>
      </div>
      <div className="p-4 space-y-3 text-xs text-slate-700">
        {readyResurvey.length > 0 && (
          <div className="rounded-xl border border-amber-200 bg-amber-50/60 p-3 space-y-1.5">
            <div className="font-bold flex items-center gap-1.5">
              <Camera className="w-3.5 h-3.5 text-amber-600" />
              {readyResurvey.length} ảnh chụp lại đã duyệt, chờ đưa vào report
            </div>
            <ul className="list-disc pl-5 space-y-0.5 text-slate-600">
              {readyResurvey.slice(0, 6).map((l) => (
                <li key={l}>{l}</li>
              ))}
              {readyResurvey.length > 6 && <li>… và {readyResurvey.length - 6} ảnh khác</li>}
            </ul>
            <p className="text-[11px] text-slate-500">Chưa đưa vào thì report vẫn in ảnh cũ.</p>
          </div>
        )}
        {pendingCropCount > 0 && (
          <div className="rounded-xl border border-teal-200 bg-teal-50/60 p-3">
            <div className="font-bold flex items-center gap-1.5">
              <Crop className="w-3.5 h-3.5 text-teal-600" />
              {pendingCropCount} ô ảnh có crop chờ duyệt
            </div>
            <p className="text-[11px] text-slate-500 mt-1">Còn crop chờ duyệt hoặc quá hạn thì chưa xuất report được.</p>
          </div>
        )}
      </div>
      <div className="flex flex-wrap justify-end gap-2 px-4 py-3 border-t border-slate-100">
        <button type="button" onClick={onClose} className="px-3 py-1.5 rounded-lg text-xs font-bold border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 cursor-pointer">
          Để sau
        </button>
        {pendingCropCount > 0 && (
          <button type="button" onClick={onOpenCropReview} className="px-3 py-1.5 rounded-lg text-xs font-bold bg-teal-600 text-white hover:bg-teal-700 flex items-center gap-1 cursor-pointer">
            <Crop className="w-3.5 h-3.5" /> Duyệt crop
          </button>
        )}
        {readyResurvey.length > 0 && (
          <button type="button" onClick={onOpenResurvey} className="px-3 py-1.5 rounded-lg text-xs font-bold bg-amber-500 text-white hover:bg-amber-600 flex items-center gap-1 cursor-pointer">
            <Camera className="w-3.5 h-3.5" /> Xem ảnh chụp lại
          </button>
        )}
      </div>
    </div>
  </div>
);
