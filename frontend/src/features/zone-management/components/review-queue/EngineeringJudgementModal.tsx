import React, { useState } from 'react';
import { X, ShieldAlert, CheckCircle2, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { api } from '../../../../services/api';

interface Props {
  isOpen: boolean;
  reportId: string;
  parcelCode: string;
  currentBurlandGrade?: string;
  onClose: () => void;
  onSuccess: () => void;
}

export const EngineeringJudgementModal: React.FC<Props> = ({
  isOpen,
  reportId,
  parcelCode,
  currentBurlandGrade,
  onClose,
  onSuccess,
}) => {
  const [action, setAction] = useState<'UPGRADE' | 'DOWNGRADE' | 'KEEP'>('UPGRADE');
  const [reason, setReason] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason || reason.trim().length < 5) {
      setErrorMsg('Vui lòng nhập lý giải kỹ thuật kết cấu tối thiểu 5 ký tự!');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg('');
    try {
      const res = await api.post(`/admin/reports/${reportId}/engineering-judgement`, {
        action,
        reason: reason.trim(),
      });

      if (res.data?.success || res.status === 200) {
        onSuccess();
        onClose();
      } else {
        setErrorMsg(res.data?.message || 'Không thể lưu can thiệp chuyên gia.');
      }
    } catch (err: any) {
      console.error('[EngineeringJudgementModal] Error:', err);
      setErrorMsg(
        err.response?.data?.message || err.message || 'Lỗi kết nối khi lưu can thiệp kỹ sư.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto animate-in fade-in duration-200">
      <div className="relative w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden my-8">
        {/* Header */}
        <div className="flex items-center justify-between p-4 sm:p-5 bg-gradient-to-r from-indigo-700 via-purple-700 to-indigo-800 text-white">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-white/15 rounded-xl backdrop-blur-xs">
              <ShieldAlert className="w-5 h-5 text-indigo-200" />
            </div>
            <div>
              <h3 className="text-base font-black tracking-tight">Can Thiệp Chuyên Gia Kết Cấu</h3>
              <p className="text-xs text-indigo-100 mt-0.5">
                Thửa: <strong>{parcelCode}</strong> {currentBurlandGrade ? `• Hiện tại: ${currentBurlandGrade}` : ''}
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
              Hành động phán đoán kỹ thuật:
            </label>
            <div className="grid grid-cols-3 gap-2.5">
              <button
                type="button"
                onClick={() => setAction('UPGRADE')}
                className={`p-3 rounded-xl border text-center transition-all cursor-pointer ${
                  action === 'UPGRADE'
                    ? 'border-red-500 bg-red-50 text-red-900 font-bold shadow-xs'
                    : 'border-slate-200 hover:border-slate-300 text-slate-700'
                }`}
              >
                <TrendingUp className={`w-5 h-5 mx-auto mb-1 ${action === 'UPGRADE' ? 'text-red-600' : 'text-slate-400'}`} />
                <span className="text-xs block">Nâng cấp nguy cơ</span>
                <span className="text-[10px] text-slate-400 block mt-0.5">Shear crack / lún móng</span>
              </button>

              <button
                type="button"
                onClick={() => setAction('DOWNGRADE')}
                className={`p-3 rounded-xl border text-center transition-all cursor-pointer ${
                  action === 'DOWNGRADE'
                    ? 'border-emerald-500 bg-emerald-50 text-emerald-900 font-bold shadow-xs'
                    : 'border-slate-200 hover:border-slate-300 text-slate-700'
                }`}
              >
                <TrendingDown className={`w-5 h-5 mx-auto mb-1 ${action === 'DOWNGRADE' ? 'text-emerald-600' : 'text-slate-400'}`} />
                <span className="text-xs block">Hạ mức độ</span>
                <span className="text-[10px] text-slate-400 block mt-0.5">Nứt vữa co ngót</span>
              </button>

              <button
                type="button"
                onClick={() => setAction('KEEP')}
                className={`p-3 rounded-xl border text-center transition-all cursor-pointer ${
                  action === 'KEEP'
                    ? 'border-indigo-500 bg-indigo-50 text-indigo-900 font-bold shadow-xs'
                    : 'border-slate-200 hover:border-slate-300 text-slate-700'
                }`}
              >
                <Minus className={`w-5 h-5 mx-auto mb-1 ${action === 'KEEP' ? 'text-indigo-600' : 'text-slate-400'}`} />
                <span className="text-xs block">Giữ nguyên</span>
                <span className="text-[10px] text-slate-400 block mt-0.5">Bổ sung căn cứ</span>
              </button>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-slate-800 uppercase tracking-wider mb-1.5">
              Căn cứ & Lý giải chuyên môn kỹ thuật kết cấu (*):
            </label>
            <textarea
              rows={4}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Nhập nhận định kỹ thuật (VD: Vết nứt góc 45 độ tại chân dầm D-01 có dấu hiệu ứng suất cắt tiếp giáp vùng đào hầm tuyến Metro 2, đề xuất nâng lên Grade 3 để đưa vào danh mục quan trắc lún nghiêng)..."
              className="w-full p-3 rounded-xl border border-slate-300 text-xs text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent placeholder:text-slate-400"
            />
          </div>

          {errorMsg && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-red-700 font-medium">
              {errorMsg}
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
              className="px-4 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl flex items-center gap-1.5 transition-all shadow-md shadow-indigo-600/20 cursor-pointer disabled:opacity-50"
            >
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>{isSubmitting ? 'Đang lưu...' : 'Lưu can thiệp kỹ sư'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
