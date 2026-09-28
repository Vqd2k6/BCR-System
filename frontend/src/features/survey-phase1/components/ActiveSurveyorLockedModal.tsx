import React, { useState } from 'react';
import { Lock, AlertTriangle, Phone, RefreshCw, ArrowLeft } from 'lucide-react';

export interface LockedInfo {
  surveyorName: string;
  phone?: string;
  minutesAgo: number;
  message?: string;
}

export interface ActiveSurveyorLockedModalProps {
  isOpen: boolean;
  onClose: () => void;
  lockedInfo?: LockedInfo | null;
  surveyorName?: string;
  phone?: string;
  minutesAgo?: number;
  message?: string;
  onRecheck?: () => void;
}

export const ActiveSurveyorLockedModal: React.FC<ActiveSurveyorLockedModalProps> = ({
  isOpen,
  onClose,
  lockedInfo,
  surveyorName: propName,
  phone: propPhone,
  minutesAgo: propMinutes,
  message: propMessage,
  onRecheck,
}) => {
  const [isRechecking, setIsRechecking] = useState(false);

  if (!isOpen) return null;

  const surveyorName = lockedInfo?.surveyorName ?? propName ?? 'Kỹ sư khác';
  const phone = lockedInfo?.phone ?? propPhone;
  const minutesAgo = lockedInfo?.minutesAgo ?? propMinutes ?? 1;
  const message = lockedInfo?.message ?? propMessage;

  const handleRecheck = async () => {
    if (!onRecheck) {
      window.location.reload();
      return;
    }
    setIsRechecking(true);
    try {
      await onRecheck();
    } finally {
      setIsRechecking(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 duration-200">
        <div className="text-center space-y-3">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600 shadow-inner">
            <Lock className="w-7 h-7" />
          </div>

          <h3 className="text-lg font-bold text-slate-900">
            Công Trình Đang Được Khảo Sát
          </h3>

          <div className="p-3.5 rounded-xl bg-amber-50/70 border border-amber-200 text-left space-y-2">
            <p className="text-xs text-amber-900 font-medium leading-relaxed">
              Kỹ sư <strong className="text-slate-900 font-bold">{surveyorName}</strong> đang tích cực thực hiện khảo sát hiện trường tại công trình này (vừa cập nhật <strong>{minutesAgo} phút trước</strong>).
            </p>
            {phone && (
              <div className="flex items-center gap-1.5 text-xs text-amber-800 pt-1 border-t border-amber-200/80">
                <Phone className="w-3.5 h-3.5 text-amber-600" />
                <span>Liên hệ: <strong>{phone}</strong></span>
              </div>
            )}
          </div>

          <div className="text-xs text-slate-600 space-y-1.5 text-left bg-slate-50 p-3 rounded-xl border border-slate-200">
            <p className="font-semibold text-slate-700">🔒 Để bảo vệ dữ liệu và tránh xung đột:</p>
            <ul className="list-disc list-inside space-y-1 text-slate-500 text-[11px]">
              <li>Hệ thống tạm khóa chỉnh sửa đối với tài khoản khác trong vòng 15 phút.</li>
              <li>Bạn có thể tiếp quản sau khi KSV {surveyorName} ngưng làm việc ít nhất 15 phút.</li>
              <li>Hoặc liên hệ KSV {surveyorName} bấm nút <strong>"Bàn giao ca"</strong> ngay trên máy của họ để mở khóa tức thì.</li>
            </ul>
          </div>
        </div>

        <div className="flex items-center justify-between gap-3 mt-6 pt-4 border-t border-slate-100">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 px-4 py-2.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors flex items-center justify-center gap-1.5"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Quay lại</span>
          </button>

          <button
            type="button"
            onClick={handleRecheck}
            disabled={isRechecking}
            className="flex-1 px-4 py-2.5 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-sm transition-colors flex items-center justify-center gap-1.5"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRechecking ? 'animate-spin' : ''}`} />
            <span>{isRechecking ? 'Đang kiểm tra...' : 'Kiểm tra lại'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
