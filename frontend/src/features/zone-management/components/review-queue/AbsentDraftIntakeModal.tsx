import React, { useState } from 'react';
import { X, AlertTriangle, Inbox } from 'lucide-react';
import { api } from '../../../../services/api';
import { getErrorMessage } from '@/utils/errorUtils';

const MIN_REASON_LENGTH = 10;

interface Props {
  reportId: string;
  parcelCode: string;
  parcelStatus?: string | null;
  surveyorName?: string | null;
  onClose: () => void;
  onSuccess: () => void;
}

/**
 * Admin tiếp nhận hồ sơ nhà dân vắng còn kẹt DRAFT vào hàng đợi thẩm định.
 * Backend chỉ đổi trạng thái, không đụng dữ liệu khảo sát, và ghi nhật ký kèm SHA-256 cùng lý do.
 */
export const AbsentDraftIntakeModal: React.FC<Props> = ({
  reportId,
  parcelCode,
  parcelStatus,
  surveyorName,
  onClose,
  onSuccess,
}) => {
  const [reason, setReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const isParcelInProgress = parcelStatus === 'IN_PROGRESS';
  const trimmedLength = reason.trim().length;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    setErrorMsg('');
    if (trimmedLength < MIN_REASON_LENGTH) {
      setErrorMsg(`Lý do tiếp nhận tối thiểu ${MIN_REASON_LENGTH} ký tự.`);
      return;
    }
    setIsSubmitting(true);
    try {
      await api.post(`/admin/reports/${encodeURIComponent(reportId)}/absent-intake`, { reason: reason.trim() });
      onSuccess();
      onClose();
    } catch (err: unknown) {
      console.error('[AbsentDraftIntakeModal:Submit] Lỗi tiếp nhận hồ sơ vắng vào thẩm định:', err);
      setErrorMsg(getErrorMessage(err, 'Không thể tiếp nhận hồ sơ vắng vào thẩm định.'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-700 overflow-hidden my-8">
        <div className="flex items-center justify-between p-4 sm:p-5 bg-gradient-to-r from-amber-600 to-amber-700 text-white">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-white/15 rounded-xl">
              <Inbox className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-black tracking-tight">Tiếp Nhận Hồ Sơ Vắng Vào Thẩm Định</h3>
              <p className="text-xs text-amber-100 mt-0.5">
                Thửa: <strong className="font-mono">{parcelCode}</strong>
                {surveyorName ? ` • KSV: ${surveyorName}` : ''}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            title="Đóng"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 sm:p-6 space-y-4">
          <p className="text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
            Hồ sơ đã ghi nhận vắng mặt nhưng chưa được nộp. Tiếp nhận sẽ chuyển hồ sơ sang <strong>Chờ duyệt</strong> để chuẩn hóa
            địa chỉ, tên chủ hộ trong Studio. Dữ liệu khảo sát giữ nguyên; hệ thống ghi nhật ký kèm mã băm SHA-256 và lý do của bạn.
          </p>

          {isParcelInProgress && (
            <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-800 text-xs text-rose-800 dark:text-rose-300 flex gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>
                Thửa đang ở trạng thái <strong>Đang khảo sát</strong>: KSV có thể đang quay lại khảo sát. Sau khi tiếp nhận, thửa chuyển về
                trạng thái vắng và KSV không sửa phiếu này được nữa. Nên liên hệ KSV trước khi tiếp nhận.
              </span>
            </div>
          )}

          <div>
            <label className="block text-xs font-bold text-slate-800 dark:text-slate-200 uppercase tracking-wider mb-1.5">
              Lý do tiếp nhận (bắt buộc)
            </label>
            <textarea
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="VD: Hồ sơ vắng ghi trước bản sửa 01/11, cần thẩm định để chuẩn hóa địa chỉ và tên chủ hộ."
              className="w-full p-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-xs text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent placeholder:text-slate-400"
            />
            <div className={`text-[10px] mt-1 ${trimmedLength >= MIN_REASON_LENGTH ? 'text-emerald-600' : 'text-slate-400'}`}>
              {trimmedLength}/{MIN_REASON_LENGTH} ký tự tối thiểu
            </div>
          </div>

          {errorMsg && (
            <div className="p-3 bg-red-50 dark:bg-red-950/60 border border-red-200 dark:border-red-800 rounded-xl text-xs text-red-700 dark:text-red-300 font-medium flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 text-xs font-bold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Hủy bỏ
            </button>
            <button
              type="submit"
              disabled={isSubmitting || trimmedLength < MIN_REASON_LENGTH}
              className="px-4 py-2 text-xs font-bold text-white bg-amber-600 hover:bg-amber-700 rounded-xl flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Inbox className="w-3.5 h-3.5" />
              <span>{isSubmitting ? 'Đang tiếp nhận...' : 'Tiếp nhận thẩm định'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
