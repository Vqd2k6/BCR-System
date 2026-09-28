import React, { useState } from 'react';
import { Users, ShieldCheck, ArrowRight, X, AlertCircle, RefreshCw, KeyRound } from 'lucide-react';

export interface HandoverInfo {
  fromSurveyorName: string;
  fromSurveyorPhone?: string;
  currentStep: number;
  securityCode: string;
  updatedAt: string;
}

export interface HandoverTakeoverModalProps {
  isOpen: boolean;
  onClose?: () => void;
  onCancel?: () => void;
  handoverInfo?: HandoverInfo | null;
  fromSurveyorName?: string;
  fromSurveyorPhone?: string;
  currentStep?: number;
  securityCode?: string;
  updatedAt?: string;
  onConfirmTakeover?: (code: string, note?: string) => Promise<boolean>;
  onTakeover?: (code: string, note?: string) => Promise<boolean>;
}

export const HandoverTakeoverModal: React.FC<HandoverTakeoverModalProps> = ({
  isOpen,
  onClose,
  onCancel,
  handoverInfo,
  fromSurveyorName: propName,
  fromSurveyorPhone: propPhone,
  currentStep: propStep,
  securityCode: propCode,
  updatedAt: propUpdatedAt,
  onConfirmTakeover,
  onTakeover,
}) => {
  const fromSurveyorName = handoverInfo?.fromSurveyorName ?? propName ?? 'Kỹ sư ca trước';
  const fromSurveyorPhone = handoverInfo?.fromSurveyorPhone ?? propPhone;
  const currentStep = handoverInfo?.currentStep ?? propStep ?? 1;
  const securityCode = handoverInfo?.securityCode ?? propCode ?? '';
  const updatedAt = handoverInfo?.updatedAt ?? propUpdatedAt ?? '';
  const confirmAction = onTakeover || onConfirmTakeover || (async () => false);
  const closeAction = onCancel || onClose || (() => {});
  const [inputCode, setInputCode] = useState('');
  const [note, setNote] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const formattedTime = updatedAt
    ? new Date(updatedAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' }) +
      ' ngày ' +
      new Date(updatedAt).toLocaleDateString('vi-VN')
    : 'Gần đây';

  const isCodeValid = inputCode.trim() === securityCode.trim();

  const handleTakeover = async () => {
    if (!isCodeValid) {
      setErrorMsg('Mã xác thực 6 số chưa chính xác. Vui lòng nhập đúng mã hiển thị bên dưới.');
      return;
    }

    setErrorMsg(null);
    setIsSubmitting(true);
    try {
      const success = await confirmAction(inputCode.trim(), note.trim());
      if (success) {
        closeAction();
      }
    } catch (err: any) {
      setErrorMsg(err?.response?.data?.message || err?.message || 'Tiếp quản thất bại');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-200 animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="flex items-start justify-between gap-3 pb-4 border-b border-slate-100">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center border border-blue-200 text-blue-600">
              <Users className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-lg font-bold text-slate-900">Tiếp Quản Ca Khảo Sát</h3>
              <p className="text-xs text-slate-500">Bảo toàn dữ liệu đo đạc ca trước</p>
            </div>
          </div>
          <button
            type="button"
            onClick={closeAction}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Thông tin ca trước */}
        <div className="my-4 p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2.5">
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-500">Kỹ sư ca trước:</span>
            <span className="font-bold text-slate-800 text-sm">{fromSurveyorName}</span>
          </div>
          {fromSurveyorPhone && (
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-500">Số điện thoại:</span>
              <span className="font-medium text-slate-700">{fromSurveyorPhone}</span>
            </div>
          )}
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-500">Thời điểm dừng:</span>
            <span className="font-medium text-slate-700">{formattedTime}</span>
          </div>
          <div className="flex items-center justify-between text-xs pt-1.5 border-t border-slate-200">
            <span className="text-slate-500">Vị trí đang làm dở:</span>
            <span className="inline-flex items-center gap-1 font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md border border-blue-200">
              Bước {currentStep}: {currentStep === 3 ? 'Khảo sát tầng & khuyết tật' : `Tiến độ bước ${currentStep}`}
            </span>
          </div>
        </div>

        {/* Mã bảo mật 6 số ngẫu nhiên */}
        <div className="my-4 p-4 rounded-xl bg-gradient-to-br from-amber-50 to-orange-50 border border-amber-200 text-center">
          <div className="flex items-center justify-center gap-1.5 text-xs font-semibold text-amber-800 mb-1.5">
            <KeyRound className="w-4 h-4 text-amber-600" />
            <span>Mã bảo mật tiếp quản ca:</span>
          </div>
          <div className="tracking-widest font-mono text-3xl font-extrabold text-amber-900 bg-white/90 py-2.5 px-6 rounded-lg inline-block border border-amber-300 shadow-inner">
            {securityCode}
          </div>
          <p className="text-[11px] text-amber-700 mt-2">
            Vui lòng nhập lại đúng 6 chữ số trên để xác nhận bạn nhận bàn giao ca từ KSV <strong>{fromSurveyorName}</strong>.
          </p>
        </div>

        {/* Input nhập mã */}
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Nhập mã 6 chữ số xác nhận:
            </label>
            <input
              type="text"
              maxLength={8}
              autoFocus
              value={inputCode}
              onChange={(e) => {
                setInputCode(e.target.value.replace(/\D/g, ''));
                setErrorMsg(null);
              }}
              placeholder="Nhập 6 số..."
              className="w-full text-center text-xl font-mono font-bold tracking-widest px-4 py-2.5 rounded-xl border border-slate-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">
              Ghi chú ca tiếp quản (tùy chọn):
            </label>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Ví dụ: Tiếp tục khảo sát từ Tầng 4..."
              className="w-full text-xs px-3 py-2 rounded-lg border border-slate-200 focus:ring-1 focus:ring-blue-500 outline-none"
            />
          </div>

          {errorMsg && (
            <div className="p-2.5 rounded-lg bg-red-50 border border-red-200 flex items-center gap-2 text-xs text-red-700">
              <AlertCircle className="w-4 h-4 text-red-500 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}
        </div>

        {/* Footer actions */}
        <div className="flex items-center justify-end gap-2.5 mt-6 pt-4 border-t border-slate-100">
          <button
            type="button"
            onClick={closeAction}
            disabled={isSubmitting}
            className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors"
          >
            Quay lại bản đồ
          </button>
          <button
            type="button"
            onClick={handleTakeover}
            disabled={!isCodeValid || isSubmitting}
            className={`px-5 py-2.5 text-xs font-bold rounded-xl flex items-center gap-2 shadow-sm transition-all ${
              isCodeValid && !isSubmitting
                ? 'bg-blue-600 hover:bg-blue-700 text-white shadow-blue-200 cursor-pointer'
                : 'bg-slate-200 text-slate-400 cursor-not-allowed'
            }`}
          >
            {isSubmitting ? (
              <>
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                <span>Đang tiếp quản...</span>
              </>
            ) : (
              <>
                <ShieldCheck className="w-4 h-4" />
                <span>Xác nhận Tiếp Quản Ca</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
