import React from 'react';
import { AlertTriangle, ArrowRight, CheckCircle2, Edit3, X, Save } from 'lucide-react';
import { MissingFieldItem } from '../utils/stepValidator';

interface Props {
  isOpen: boolean;
  missingFields: MissingFieldItem[];
  currentStep: number;
  targetStep?: number;
  onClose: () => void;
  onProceedAnyway: () => void;
  onFocusField: (item: MissingFieldItem) => void;
}

export const MissingFieldsModal: React.FC<Props> = ({
  isOpen,
  missingFields,
  currentStep,
  targetStep,
  onClose,
  onProceedAnyway,
  onFocusField,
}) => {
  if (!isOpen || missingFields.length === 0) return null;

  const isFinalSubmit = targetStep === 10 || !targetStep;

  return (
    <div
      className="fixed inset-0 z-[99999] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-white rounded-2xl w-full max-w-lg shadow-2xl border border-amber-200 overflow-hidden my-auto animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="bg-amber-50 border-b border-amber-200/80 p-4 sm:p-5 flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-amber-100 border border-amber-300 flex items-center justify-center flex-shrink-0 text-amber-700">
            <AlertTriangle className="w-5 h-5" />
          </div>
          <div className="flex-1">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900">
                {isFinalSubmit
                  ? 'Hồ sơ còn mục chưa hoàn thiện'
                  : `Bước ${currentStep} còn ${missingFields.length} thông tin cần bổ sung`}
              </h3>
              <button
                type="button"
                onClick={onClose}
                className="text-slate-400 hover:text-slate-600 p-1"
              >
                <X size={18} />
              </button>
            </div>
            <p className="text-xs text-slate-600 mt-1 leading-relaxed">
              Để đảm bảo tính pháp lý và độ chính xác của hồ sơ khảo sát hiện trạng Metro 2, bạn nên hoàn thiện đầy đủ các trường thông tin bên dưới.
            </p>
          </div>
        </div>

        {/* Missing Fields List */}
        <div className="p-4 sm:p-5 max-h-[50vh] overflow-y-auto flex flex-col gap-2.5">
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
            Danh sách mục cần điền ({missingFields.length}):
          </span>

          {missingFields.map((item, idx) => (
            <div
              key={`${item.fieldId}-${idx}`}
              onClick={() => onFocusField(item)}
              className="group bg-slate-50 hover:bg-amber-50/70 border border-slate-200 hover:border-amber-300 rounded-xl p-3 flex items-start justify-between gap-3 cursor-pointer transition-all"
            >
              <div className="flex items-start gap-2.5">
                <span className="w-5 h-5 rounded-full bg-amber-100 text-amber-800 text-[10px] font-bold flex items-center justify-center flex-shrink-0 mt-0.5 border border-amber-200">
                  {idx + 1}
                </span>
                <div>
                  <div className="text-xs font-bold text-slate-900 group-hover:text-amber-900 flex items-center gap-1.5">
                    <span>{item.label}</span>
                    {item.step !== currentStep && (
                      <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-200 text-slate-700 font-semibold">
                        Bước {item.step}
                      </span>
                    )}
                  </div>
                  {item.description && (
                    <p className="text-[11px] text-slate-500 mt-0.5 leading-normal">
                      {item.description}
                    </p>
                  )}
                </div>
              </div>

              <span className="text-xs font-semibold text-indigo-600 group-hover:text-indigo-800 flex items-center gap-1 flex-shrink-0 pt-0.5">
                <span>Điền ngay</span>
                <ArrowRight size={13} />
              </span>
            </div>
          ))}
        </div>

        {/* Action Buttons */}
        <div className="bg-slate-50 border-t border-slate-200 p-4 sm:p-5 flex flex-col-reverse sm:flex-row items-center justify-end gap-2.5">
          {missingFields.some((f) => f.isBlocking) ? (
            <div
              className="w-full sm:w-auto px-4 py-2.5 rounded-xl border border-red-200 bg-red-50 text-red-700 text-xs font-bold flex items-center justify-center gap-1.5 cursor-not-allowed select-none"
              title="Bắt buộc bổ sung đầy đủ các điểm chấm Z, E và khuyết tật D trước khi sang bước tiếp theo"
            >
              <AlertTriangle size={14} className="text-red-500" />
              <span>Bắt buộc bổ sung mới được chuyển bước</span>
            </div>
          ) : (
            <button
              type="button"
              onClick={onProceedAnyway}
              className="w-full sm:w-auto px-4 py-2.5 rounded-xl border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 text-xs font-bold flex items-center justify-center gap-1.5 transition-colors"
            >
              <Save size={14} className="text-slate-500" />
              <span>{isFinalSubmit ? 'Lưu nháp hồ sơ' : 'Lưu tạm & Chuyển bước'}</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => onFocusField(missingFields[0])}
            className="w-full sm:w-auto px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold flex items-center justify-center gap-1.5 shadow-md shadow-indigo-200 transition-colors"
          >
            <Edit3 size={14} />
            <span>Tiếp tục điền mục còn thiếu</span>
          </button>
        </div>
      </div>
    </div>
  );
};
