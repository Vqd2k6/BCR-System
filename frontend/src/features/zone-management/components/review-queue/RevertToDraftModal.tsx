import React, { useState } from 'react';
import { RotateCcw, X, AlertTriangle, Send } from 'lucide-react';
import { api } from '../../../../services/api';
import { getErrorMessage } from '@/utils/errorUtils';

interface RevertToDraftModalProps {
  isOpen: boolean;
  reportId: string;
  parcelCode: string;
  onClose: () => void;
  onSuccess: () => void;
}

const COMMON_REVERT_REASONS = [
  'Yêu cầu khảo sát viên bổ sung ảnh thước đo (Scale Card) còn thiếu tại thực địa',
  'Cần kiểm tra lại các vết nứt và đo lại độ nghiêng/lún chênh lệch',
  'Cần liên hệ lại chủ hộ để bổ sung thông tin phỏng vấn và chữ ký',
  'Chỉnh sửa vị trí ghim khuyết tật trên sơ đồ mặt bằng CAD chưa khớp hiện trường',
  'Sai lệch thông tin định danh hoặc thông số kỹ thuật công trình',
];

export const RevertToDraftModal: React.FC<RevertToDraftModalProps> = ({
  isOpen,
  reportId,
  parcelCode,
  onClose,
  onSuccess,
}) => {
  const [selectedReason, setSelectedReason] = useState<string>('');
  const [customNote, setCustomNote] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    const reason = [
      selectedReason,
      customNote.trim() ? `Ghi chú: ${customNote.trim()}` : '',
    ]
      .filter(Boolean)
      .join(' - ');

    if (!reason || reason.trim().length < 5) {
      setErrorMsg('Vui lòng chọn hoặc nhập lý do hoàn trả (tối thiểu 5 ký tự)!');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await api.post(`/admin/reports/${reportId}/revert-to-draft`, {
        reason: reason.trim(),
      });
      if (res.data?.success || res.status === 200) {
        alert(`Đã hoàn trả hồ sơ thửa ${parcelCode} về trạng thái "Đang làm dở" thành công!`);
        onSuccess();
        onClose();
      } else {
        setErrorMsg(res.data?.message || 'Không thể chuyển trạng thái hồ sơ.');
      }
    } catch (err: unknown) {
      setErrorMsg(getErrorMessage(err, 'Lỗi kết nối khi hoàn trả hồ sơ.'));
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-200 dark:border-slate-800 w-full max-w-lg overflow-hidden flex flex-col">
        {/* Header */}
        <div className="px-5 py-4 bg-amber-50 dark:bg-amber-950/40 border-b border-amber-200 dark:border-amber-900/60 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-amber-100 dark:bg-amber-900/80 text-amber-700 dark:text-amber-300">
              <RotateCcw className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 dark:text-slate-100 text-sm">
                Mở Lại Hồ Sơ (Chuyển Về Đang Làm Dở)
              </h3>
              <p className="text-xs text-amber-700 dark:text-amber-400 font-mono mt-0.5">
                Thửa đất: <strong className="underline">{parcelCode}</strong>
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 flex flex-col gap-4">
          <div className="p-3 bg-amber-50/70 dark:bg-amber-950/30 border border-amber-200/80 dark:border-amber-900/50 rounded-xl text-xs text-amber-900 dark:text-amber-300 flex items-start gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
            <span>
              Hành động này chỉ dành cho <strong>Zone Admin</strong> / <strong>Super Admin</strong>. Sau khi hoàn trả, khảo sát viên sẽ có quyền chỉnh sửa lại báo cáo trên thiết bị hiện trường và nộp lại.
            </span>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-2">
              Chọn lý do hoàn trả:
            </label>
            <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
              {COMMON_REVERT_REASONS.map((r, i) => (
                <label
                  key={i}
                  className={`flex items-start gap-2.5 p-2 rounded-lg text-xs cursor-pointer border transition-colors ${
                    selectedReason === r
                      ? 'bg-amber-50 dark:bg-amber-950/50 border-amber-300 dark:border-amber-700 text-amber-900 dark:text-amber-200 font-medium'
                      : 'bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100'
                  }`}
                >
                  <input
                    type="radio"
                    name="revertReason"
                    value={r}
                    checked={selectedReason === r}
                    onChange={() => setSelectedReason(r)}
                    className="mt-0.5 text-amber-600 focus:ring-amber-500"
                  />
                  <span>{r}</span>
                </label>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">
              Ghi chú thêm chỉ đạo cho khảo sát viên (tuỳ chọn):
            </label>
            <textarea
              value={customNote}
              onChange={(e) => setCustomNote(e.target.value)}
              placeholder="Nhập nội dung hướng dẫn hoặc yêu cầu cụ thể..."
              rows={3}
              className="w-full text-xs p-2.5 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-slate-100 focus:ring-2 focus:ring-amber-500 focus:border-amber-500 outline-hidden"
            />
          </div>

          {errorMsg && (
            <div className="p-2.5 bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-900 rounded-lg text-xs text-rose-700 dark:text-rose-300">
              {errorMsg}
            </div>
          )}

          {/* Footer Buttons */}
          <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-200 dark:border-slate-800">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-xl transition-colors cursor-pointer"
            >
              Hủy Bỏ
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 shadow-sm transition-all cursor-pointer disabled:opacity-50"
            >
              <Send className="w-3.5 h-3.5" />
              <span>{isSubmitting ? 'Đang hoàn trả...' : 'Xác Nhận Hoàn Trả'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
