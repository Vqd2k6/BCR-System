import React, { useState } from 'react';
import { EyeOff, RotateCcw, X } from 'lucide-react';
import { getErrorMessage } from '@/utils/errorUtils';
import type { GisParcel, ParcelExclusionType } from './types';
import { EXCLUSION_TYPE_LABELS, excludeParcel, restoreParcel } from './parcelExclusion';

interface ExcludeParcelModalProps {
  parcel: GisParcel;
  mode: 'EXCLUDE' | 'RESTORE';
  onClose: () => void;
  onSuccess: () => void;
}

const MIN_REASON_LENGTH = 3;

export const ExcludeParcelModal: React.FC<ExcludeParcelModalProps> = ({ parcel, mode, onClose, onSuccess }) => {
  const [exclusionType, setExclusionType] = useState<ParcelExclusionType>('ROAD_TRAFFIC');
  const [reason, setReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');

  const isExclude = mode === 'EXCLUDE';
  const canSubmit = reason.trim().length >= MIN_REASON_LENGTH && !isSubmitting;

  const handleSubmit = async () => {
    setIsSubmitting(true);
    setErrorMessage('');
    try {
      if (isExclude) {
        await excludeParcel(parcel.id, exclusionType, reason.trim());
      } else {
        await restoreParcel(parcel.id, reason.trim());
      }
      onSuccess();
      onClose();
    } catch (err: unknown) {
      console.error('[ExcludeParcelModal:submit] Không thể cập nhật trạng thái thửa đất:', err);
      setErrorMessage(getErrorMessage(err, 'Không thể cập nhật trạng thái thửa đất'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[3000] flex items-center justify-center bg-slate-950/50 p-4">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-xl space-y-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-sm font-bold text-slate-900">
              {isExclude ? 'Loại trừ thửa đất khỏi khảo sát' : 'Khôi phục thửa đất về khảo sát'}
            </h3>
            <span className="mt-1 inline-block rounded-md border bg-teal-950 text-teal-300 border-teal-700 px-2 py-0.5 text-[11px] font-mono font-bold">
              {parcel.projectParcelCode}
            </span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-slate-500 hover:bg-slate-100 cursor-pointer"
            title="Đóng"
          >
            <X size={18} />
          </button>
        </div>

        {isExclude && (
          <label className="block text-xs font-bold text-slate-700">
            Phân loại
            <select
              value={exclusionType}
              onChange={(e) => setExclusionType(e.target.value as ParcelExclusionType)}
              className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-800 cursor-pointer"
            >
              {(Object.keys(EXCLUSION_TYPE_LABELS) as ParcelExclusionType[]).map((type) => (
                <option key={type} value={type}>
                  {EXCLUSION_TYPE_LABELS[type]}
                </option>
              ))}
            </select>
          </label>
        )}

        <label className="block text-xs font-bold text-slate-700">
          Lý do giải trình
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            maxLength={500}
            rows={3}
            className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-800"
            placeholder={isExclude ? 'VD: Phần vỉa hè đường Trường Chinh' : 'VD: Kiểm tra lại thấy có công trình'}
          />
        </label>

        {errorMessage && (
          <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700">
            {errorMessage}
          </p>
        )}

        <div className="flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-slate-200 px-3 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50 cursor-pointer"
          >
            Hủy
          </button>
          <button
            type="button"
            disabled={!canSubmit}
            onClick={handleSubmit}
            className="flex items-center gap-1.5 rounded-xl bg-indigo-600 px-3 py-2 text-xs font-bold text-white hover:bg-indigo-700 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isExclude ? <EyeOff size={14} /> : <RotateCcw size={14} />}
            <span>{isExclude ? 'Xác nhận loại trừ' : 'Khôi phục thửa đất'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
