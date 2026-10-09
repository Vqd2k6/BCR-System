import { getErrorMessage, getErrorStatus, isNotFoundError } from '@/utils/errorUtils';
import React, { useState } from 'react';
import { X, AlertTriangle, Send, CheckSquare, Square } from 'lucide-react';
import { api } from '../../../../services/api';

interface Props {
  isOpen: boolean;
  reportId: string;
  parcelCode: string;
  surveyorName?: string;
  onClose: () => void;
  onSuccess: (rejectionReason: string) => void;
}

const COMMON_REASONS = [
  'Ảnh khuyết tật D thiếu thước đo tỷ lệ nứt (Scale Card) hoặc bị mờ vạch mm',
  'Tọa độ GPS watermark trên ảnh chụp lệch quá xa so với thửa đất',
  'Phân loại hư hỏng / cấp độ nguy cơ Burland chưa đúng thực tế hiện trường',
  'Thiếu số liệu hoặc ảnh kiểm chứng đo nghiêng / lún chênh lệch',
  'Thiếu chữ ký chủ nhà và chưa có biên bản xác nhận của Tổ dân phố',
  'Sơ đồ mặt bằng CAD chưa thể hiện đầy đủ các vị trí khuyết tật',
];

export const RejectReportModal: React.FC<Props> = ({
  isOpen,
  reportId,
  parcelCode,
  surveyorName,
  onClose,
  onSuccess,
}) => {
  const [selectedReasons, setSelectedReasons] = useState<string[]>([]);
  const [customNote, setCustomNote] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  if (!isOpen) return null;

  const toggleReason = (reason: string) => {
    setSelectedReasons((prev) =>
      prev.includes(reason) ? prev.filter((r) => r !== reason) : [...prev, reason]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    const combinedReasons = [
      ...selectedReasons,
      customNote.trim() ? `Chỉ đạo cụ thể: ${customNote.trim()}` : '',
    ]
      .filter(Boolean)
      .join(' | ');

    if (!combinedReasons) {
      setErrorMsg('Vui lòng chọn ít nhất một lý do vi phạm hoặc nhập chỉ đạo kỹ thuật!');
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await api.post(`/admin/reports/${reportId}/reject`, {
        rejectionReason: combinedReasons,
      });

      if (res.data?.success || res.status === 200) {
        onSuccess(combinedReasons);
        onClose();
      } else {
        setErrorMsg(res.data?.message || 'Không thể gửi yêu cầu bổ sung.');
      }
    } catch (err: unknown) {
      console.error('[RejectReportModal] Error rejecting report:', err);
      setErrorMsg(
        getErrorMessage(err, 'Lỗi kết nối khi gửi yêu cầu bổ sung.')
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto animate-in fade-in duration-200">
      <div className="relative w-full max-w-xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden my-8">
        {/* Header */}
        <div className="flex items-center justify-between p-4 sm:p-5 bg-gradient-to-r from-red-600 via-rose-600 to-red-700 text-white">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-white/15 rounded-xl backdrop-blur-xs">
              <AlertTriangle className="w-5 h-5 text-amber-200" />
            </div>
            <div>
              <h3 className="text-base font-black tracking-tight">Yêu Cầu Bổ Sung / Trả Về Khảo Sát</h3>
              <p className="text-xs text-red-100 mt-0.5">
                Thửa: <strong>{parcelCode}</strong> {surveyorName ? `• KSV: ${surveyorName}` : ''}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-4 sm:p-6 space-y-4">
          <div>
            <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider mb-2">
              1. Chọn nhanh nhóm lỗi vi phạm thường gặp:
            </label>
            <div className="space-y-1.5 bg-slate-50 p-3 rounded-xl border border-slate-200">
              {COMMON_REASONS.map((reason) => {
                const isChecked = selectedReasons.includes(reason);
                return (
                  <button
                    key={reason}
                    type="button"
                    onClick={() => toggleReason(reason)}
                    className={`w-full flex items-start gap-2.5 p-2 rounded-lg text-left text-xs transition-colors cursor-pointer ${
                      isChecked
                        ? 'bg-red-50 text-red-900 font-semibold border border-red-200'
                        : 'text-slate-700 hover:bg-white'
                    }`}
                  >
                    {isChecked ? (
                      <CheckSquare className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                    ) : (
                      <Square className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                    )}
                    <span>{reason}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider mb-1.5">
              2. Chỉ đạo kỹ thuật chi tiết của Zone Admin:
            </label>
            <textarea
              rows={4}
              value={customNote}
              onChange={(e) => setCustomNote(e.target.value)}
              placeholder="Nhập hướng dẫn cụ thể cho Surveyor (VD: Cần áp sát thước đo nứt chuyên dụng Metro 2 vuông góc vạch chia, chụp lại 2 ảnh cận cảnh D-01 phòng khách)..."
              className="w-full p-3 rounded-xl border border-slate-300 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-red-500 focus:border-transparent placeholder:text-slate-400"
            />
          </div>

          {errorMsg && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 font-medium flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0 text-red-600" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Footer Actions */}
          <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
            >
              Hủy bỏ
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-4 py-2 text-xs font-bold text-white bg-red-600 hover:bg-red-700 rounded-xl flex items-center gap-1.5 transition-all shadow-md shadow-red-600/20 cursor-pointer disabled:opacity-50"
            >
              <Send className="w-3.5 h-3.5" />
              <span>{isSubmitting ? 'Đang gửi...' : 'Gửi yêu cầu bổ sung'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
