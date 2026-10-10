import React, { useState } from 'react';
import {
  AlertCircle,
  X,
  Lock,
  ShieldAlert,
  Calendar,
  Camera,
  CheckCircle2,
  Clock,
} from 'lucide-react';
import { PhotoCaptureInput } from '../../../../components/common/PhotoCaptureInput';
import type { MetroWatermarkOptions } from '../../../../utils/watermarkEngine';

export interface MasterAreaAbsentPayload {
  absenceReason: 'LOCKED_GATE' | 'REFUSED_ACCESS' | 'HOMEOWNER_ABSENT';
  notes: string;
  photoProofUrl?: string;
  rescheduleDate?: string;
}

interface Props {
  isOpen: boolean;
  unitCode: string;
  floorName: string;
  watermarkOptions?: MetroWatermarkOptions;
  onClose: () => void;
  onSubmit: (payload: MasterAreaAbsentPayload) => Promise<void>;
}

export const MasterAreaAbsentModal: React.FC<Props> = ({
  isOpen,
  unitCode,
  floorName,
  watermarkOptions,
  onClose,
  onSubmit,
}) => {
  const [absenceReason, setAbsenceReason] = useState<'LOCKED_GATE' | 'REFUSED_ACCESS' | 'HOMEOWNER_ABSENT'>('LOCKED_GATE');
  const [notes, setNotes] = useState<string>('');
  const [photoProofUrl, setPhotoProofUrl] = useState<string>('');
  const [rescheduleDate, setRescheduleDate] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!notes.trim()) {
      alert('Vui lòng nhập ghi chú hiện trường giải trình lý do chưa tiếp cận được khu vực.');
      return;
    }

    try {
      setIsSubmitting(true);
      await onSubmit({
        absenceReason,
        notes: notes.trim(),
        photoProofUrl: photoProofUrl || undefined,
        rescheduleDate: rescheduleDate ? new Date(rescheduleDate).toISOString() : undefined,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[110000] flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-lg w-full overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="px-5 py-4 bg-gradient-to-r from-purple-50 via-purple-50/50 to-white border-b border-purple-100 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-100 border border-purple-200 flex items-center justify-center text-purple-700">
              <Lock className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm sm:text-base font-bold text-slate-900 flex items-center gap-2">
                <span>Ghi Nhận Tạm Hoãn Khảo Sát</span>
              </h3>
              <p className="text-xs text-slate-500">
                Khu vực <span className="font-bold text-purple-700 font-mono">{unitCode}</span> ({floorName})
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
            title="Đóng"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="p-5 overflow-y-auto space-y-4 flex-1">
          <div className="p-3 bg-purple-50/60 rounded-xl border border-purple-200/80 text-xs text-purple-900 flex items-start gap-2.5">
            <AlertCircle className="w-4 h-4 text-purple-600 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="font-semibold">Hồ sơ sẽ chuyển sang trạng thái Tạm hoãn (Màu tím)</p>
              <p className="text-purple-700 text-[11px] leading-relaxed">
                Số liệu nháp hiện tại vẫn được bảo toàn an toàn trên Cloud Server. Khảo sát viên có thể quay lại tiếp tục khi khu vực được mở khóa hoặc cấp quyền tiếp cận.
              </p>
            </div>
          </div>

          {/* Lý do vắng / khóa */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              Lý do không tiếp cận được <span className="text-rose-500">*</span>
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setAbsenceReason('LOCKED_GATE')}
                className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex items-center gap-2.5 ${
                  absenceReason === 'LOCKED_GATE'
                    ? 'border-purple-500 bg-purple-50/60 text-purple-900 ring-2 ring-purple-500/20 font-bold'
                    : 'border-slate-200 hover:border-slate-300 text-slate-700'
                }`}
              >
                <Lock className="w-4 h-4 text-purple-600 shrink-0" />
                <div className="text-xs">
                  <div>Cửa phòng bị khóa</div>
                  <div className="text-[10px] text-slate-500 font-normal">Chưa có chìa / BQL vắng</div>
                </div>
              </button>

              <button
                type="button"
                onClick={() => setAbsenceReason('REFUSED_ACCESS')}
                className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex items-center gap-2.5 ${
                  absenceReason === 'REFUSED_ACCESS'
                    ? 'border-purple-500 bg-purple-50/60 text-purple-900 ring-2 ring-purple-500/20 font-bold'
                    : 'border-slate-200 hover:border-slate-300 text-slate-700'
                }`}
              >
                <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0" />
                <div className="text-xs">
                  <div>Chưa cấp phép vào</div>
                  <div className="text-[10px] text-slate-500 font-normal">Bảo trì / Cần thẻ đặc biệt</div>
                </div>
              </button>
            </div>
          </div>

          {/* Ghi chú chi tiết */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5">
              Ghi chú hiện trường <span className="text-rose-500">*</span>
            </label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="VD: Cửa phòng máy biến áp đang khóa xích, bảo vệ ca sáng báo kỹ thuật điện cầm chìa đi bảo trì ga khác, hẹn lại 14h30..."
              rows={3}
              className="w-full text-xs p-3 rounded-xl border border-slate-300 focus:border-purple-500 focus:ring-2 focus:ring-purple-200 outline-none resize-none"
              required
            />
          </div>

          {/* Ảnh bằng chứng cửa khóa / niêm phong */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
              <Camera className="w-3.5 h-3.5 text-purple-600" />
              <span>Ảnh bằng chứng (Cửa khóa / Biển báo bảo trì)</span>
            </label>
            <PhotoCaptureInput
              label="Chụp ảnh cửa khóa / niêm phong"
              value={photoProofUrl}
              onChange={(url) => setPhotoProofUrl(url)}
              watermarkOptions={watermarkOptions}
            />
          </div>

          {/* Lịch hẹn khảo sát lại */}
          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1.5 flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-purple-600" />
              <span>Lịch hẹn tiếp cận lại (Tùy chọn)</span>
            </label>
            <input
              type="datetime-local"
              value={rescheduleDate}
              onChange={(e) => setRescheduleDate(e.target.value)}
              className="w-full text-xs p-2.5 rounded-xl border border-slate-300 focus:border-purple-500 focus:ring-2 focus:ring-purple-200 outline-none"
            />
          </div>

          {/* Footer Buttons */}
          <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2.5">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 rounded-xl text-xs font-bold text-slate-700 hover:bg-slate-100 border border-slate-300 transition-colors cursor-pointer disabled:opacity-50"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-5 py-2 rounded-xl text-xs font-bold bg-purple-600 hover:bg-purple-700 text-white shadow-sm shadow-purple-600/20 transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              {isSubmitting ? (
                <>
                  <Clock className="w-3.5 h-3.5 animate-spin" />
                  <span>Đang lưu...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="w-3.5 h-3.5" />
                  <span>Xác Nhận Tạm Hoãn</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
