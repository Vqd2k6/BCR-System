import React from 'react';
import { EyeOff, RotateCcw, X } from 'lucide-react';
import type { GisParcel } from '../../shared/types';
import { EXCLUSION_TYPE_LABELS } from '../../shared/parcelExclusion';

interface ExcludedParcelPanelProps {
  parcel: GisParcel;
  onClose: () => void;
  onRestore: (parcel: GisParcel) => void;
}

export const ExcludedParcelPanel: React.FC<ExcludedParcelPanelProps> = ({ parcel, onClose, onRestore }) => {
  return (
    <div className="absolute bottom-4 left-1/2 z-[1100] w-[92%] max-w-sm -translate-x-1/2 rounded-2xl border border-slate-200 bg-white p-4 shadow-xl space-y-2">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700">
          <EyeOff size={14} />
          <span>ĐÃ ẨN KHỎI KHẢO SÁT</span>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg p-1 text-slate-500 hover:bg-slate-100 cursor-pointer"
          title="Đóng"
        >
          <X size={16} />
        </button>
      </div>

      <span className="inline-block rounded-md border bg-teal-950 text-teal-300 border-teal-700 px-2 py-0.5 text-[11px] font-mono font-bold">
        {parcel.projectParcelCode}
      </span>

      <div className="text-xs text-slate-700">
        <div className="font-bold">{parcel.exclusionType ? EXCLUSION_TYPE_LABELS[parcel.exclusionType] : '---'}</div>
        <div className="mt-0.5">{parcel.exclusionReason || '---'}</div>
        <div className="mt-1 text-[11px] text-slate-500">
          {parcel.excludedByName || '---'}
          {parcel.excludedAt ? ` · ${new Date(parcel.excludedAt).toLocaleString('vi-VN')}` : ''}
        </div>
      </div>

      <button
        type="button"
        onClick={() => onRestore(parcel)}
        className="flex w-full items-center justify-center gap-1.5 rounded-xl bg-indigo-600 px-3 py-2 text-xs font-bold text-white hover:bg-indigo-700 cursor-pointer"
      >
        <RotateCcw size={14} />
        <span>Khôi phục thửa đất</span>
      </button>
    </div>
  );
};
