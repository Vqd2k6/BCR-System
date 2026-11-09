import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { Camera, Clock, Loader2, RefreshCw, X } from 'lucide-react';
import { useResurveyTasks } from '../hooks/useResurveyTasks';
import { PhotoResurveyScreen } from './PhotoResurveyScreen';
import type { ResurveyTask } from '../types';

interface PhotoResurveyReviewListProps {
  /** Zone đang làm việc ('ALL' = toàn tuyến, chỉ Super Admin). */
  zone?: string;
  onClose: () => void;
}

const STATE_ORDER: Record<ResurveyTask['state'], number> = { SUBMITTED: 0, PENDING: 1 };

/** Danh sách cho Zone Admin: hồ sơ chờ duyệt ảnh chụp lại (trên cùng) và hồ sơ KSV chưa chụp xong. */
export const PhotoResurveyReviewList: React.FC<PhotoResurveyReviewListProps> = ({ zone, onClose }) => {
  const { tasks, loading, reload } = useResurveyTasks(zone, true);
  const [openId, setOpenId] = useState<string | null>(null);
  const sorted = [...tasks].sort((a, b) => STATE_ORDER[a.state] - STATE_ORDER[b.state] || a.reportCode.localeCompare(b.reportCode));
  const submittedCount = tasks.filter((t) => t.state === 'SUBMITTED').length;

  return (
    <div className="fixed inset-0 z-[1500] bg-slate-900/50 flex items-center justify-center p-3">
      <div className="w-full max-w-3xl max-h-[90vh] flex flex-col rounded-2xl bg-white border border-slate-200 shadow-2xl">
        <div className="flex items-center gap-2 px-4 py-3 border-b border-slate-200">
          <Camera className="w-5 h-5 text-sky-600" />
          <h3 className="text-base font-black text-slate-800 flex-1">
            Khảo sát bổ sung ảnh ngoài nhà
            <span className="ml-2 px-2 py-0.5 rounded-full text-[11px] font-bold border bg-amber-950 text-amber-300 border-amber-700">
              {submittedCount} chờ duyệt
            </span>
          </h3>
          <button
            type="button"
            onClick={() => void reload()}
            className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 cursor-pointer"
            title="Tải lại"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 cursor-pointer"
            aria-label="Đóng"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-2">
          {loading && (
            <div className="flex items-center justify-center gap-2 py-10 text-sm text-slate-500">
              <Loader2 className="w-4 h-4 animate-spin" /> Đang tải…
            </div>
          )}
          {!loading && sorted.length === 0 && (
            <div className="py-10 text-center text-sm text-slate-500">Không có hồ sơ nhà dân nào cần chụp lại ảnh ngoài nhà.</div>
          )}
          {sorted.map((t) => (
            <div key={t.reportId} className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="px-2 py-0.5 rounded-md text-[10px] border bg-teal-950 text-teal-300 border-teal-700 font-mono font-bold">
                    {t.parcelCode || '---'}
                  </span>
                  {t.zoneId && (
                    <span className="px-2 py-0.5 rounded-md text-[10px] border bg-cyan-950 text-cyan-300 border-cyan-700 font-mono font-bold">{t.zoneId}</span>
                  )}
                  {t.state === 'SUBMITTED' ? (
                    <span className="px-2 py-0.5 rounded-md text-[10px] border font-bold bg-amber-950 text-amber-300 border-amber-700">Chờ duyệt</span>
                  ) : (
                    <span className="px-2 py-0.5 rounded-md text-[10px] border font-bold bg-rose-950 text-rose-300 border-rose-700">
                      {t.sessionStatus === 'DRAFT' ? 'KSV đang chụp' : 'Chưa chụp'}
                    </span>
                  )}
                </div>
                <div className="text-xs text-slate-600 mt-1 truncate">
                  {t.address || t.reportCode} • {t.openOutdoorCount} ảnh cần chụp lại
                  {t.surveyorName ? ` • KSV: ${t.surveyorName}` : ''}
                </div>
                {t.submittedAt && (
                  <div className="text-[11px] text-slate-500 flex items-center gap-1">
                    <Clock className="w-3 h-3" /> Nộp lúc {new Date(t.submittedAt).toLocaleString('vi-VN')}
                  </div>
                )}
              </div>
              <button
                type="button"
                onClick={() => setOpenId(t.reportId)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold border cursor-pointer ${
                  t.state === 'SUBMITTED'
                    ? 'bg-emerald-600 text-white border-emerald-600 hover:bg-emerald-700'
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                }`}
              >
                {t.state === 'SUBMITTED' ? 'Duyệt' : 'Xem'}
              </button>
            </div>
          ))}
        </div>
      </div>

      {openId &&
        createPortal(
          <PhotoResurveyScreen
            reportId={openId}
            onClose={() => {
              setOpenId(null);
              void reload();
            }}
            onChanged={() => void reload()}
          />,
          document.body
        )}
    </div>
  );
};
