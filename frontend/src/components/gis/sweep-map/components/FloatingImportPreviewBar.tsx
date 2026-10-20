import React from 'react';
import { Eye, Check, X, ShieldAlert, Sparkles, Layers } from 'lucide-react';
import type { ImportPreviewState } from '../../shared/types';

interface Props {
  previewState: ImportPreviewState;
  onConfirm: () => void;
  onCancel: () => void;
  isImporting?: boolean;
}

export const FloatingImportPreviewBar: React.FC<Props> = ({
  previewState,
  onConfirm,
  onCancel,
  isImporting = false,
}) => {
  return (
    <div className="absolute top-16 left-1/2 -translate-x-1/2 z-[1000] w-11/12 max-w-4xl bg-slate-900/95 backdrop-blur-md text-white border border-amber-500/50 rounded-2xl shadow-2xl p-3 sm:p-4 animate-in fade-in slide-in-from-top-4 duration-300">
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
        {/* Left: Zone & Parcel Status */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-500/20 text-amber-400 border border-amber-500/30 flex items-center justify-center shrink-0">
            <Layers className="w-5 h-5 animate-pulse" />
          </div>

          <div>
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded-md bg-amber-950 text-amber-300 border border-amber-700 text-[11px] font-mono font-bold">
                XEM TRƯỚC NÉT ĐỨT
              </span>
              <span className="text-xs sm:text-sm font-bold text-white">
                {previewState.zoneCode} - {previewState.zoneName}
              </span>
            </div>
            <div className="text-[11px] text-slate-300 mt-0.5 flex items-center gap-2">
              <span>
                Tổng: <strong className="text-amber-400">{previewState.totalIncoming} thửa đất</strong>
              </span>
              <span className="text-slate-500">|</span>
              <span>
                Dải mã: <strong className="text-cyan-400 font-mono">{previewState.startCode}</strong> $\rightarrow$ <strong className="text-cyan-400 font-mono">{previewState.endCode}</strong>
              </span>
            </div>
          </div>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
          <button
            type="button"
            onClick={onCancel}
            disabled={isImporting}
            className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white border border-slate-700 text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <X size={14} />
            <span>Hủy Xem Trước</span>
          </button>

          <button
            type="button"
            onClick={onConfirm}
            disabled={isImporting}
            className="px-4 py-1.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white shadow-lg shadow-emerald-900/40 text-xs font-bold flex items-center gap-2 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed active:scale-95"
          >
            {isImporting ? (
              <>
                <div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span>Đang nạp CSDL...</span>
              </>
            ) : (
              <>
                <Check size={15} />
                <span>Xác Nhận Nạp Vào CSDL ({previewState.totalIncoming} Thửa)</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
