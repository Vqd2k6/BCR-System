import React, { useState } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  X,
  Send,
  ExternalLink,
} from 'lucide-react';
import { Button } from '../../../core/components/ui/Button';
import type { CondoUnitValidationIssue } from '../utils/condoUnitValidator';
import { useCondoUnitSurveyStore } from '../store/useCondoUnitSurveyStore';

interface Props {
  isOpen: boolean;
  blockingIssues: CondoUnitValidationIssue[];
  warnings: CondoUnitValidationIssue[];
  onClose: () => void;
  onProceedAnyway?: () => void;
  onGoToStep: (step: 1 | 2 | 3 | 4, fieldId?: string) => void;
}

export const CondoUnitMissingFieldsModal: React.FC<Props> = ({
  isOpen,
  blockingIssues,
  warnings,
  onClose,
  onProceedAnyway,
  onGoToStep,
}) => {
  const { setIsPhotoAuditOpen } = useCondoUnitSurveyStore();
  const hasBlocking = blockingIssues.length > 0;
  const hasWarnings = warnings.length > 0;
  const [activeTab, setActiveTab] = useState<'BLOCKING' | 'WARNING'>('BLOCKING');

  // Luôn cập nhật tab mặc định khi modal được mở ra
  React.useEffect(() => {
    if (isOpen) {
      setActiveTab(hasBlocking ? 'BLOCKING' : 'WARNING');
    }
  }, [isOpen, hasBlocking]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[120000] bg-slate-900/70 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto animate-in fade-in duration-150"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-white rounded-2xl w-full max-w-xl shadow-2xl border border-slate-200 overflow-hidden my-auto animate-in zoom-in-95 duration-150 flex flex-col max-h-[90vh]">
        {/* Header */}
        <div
          className={`p-4 sm:p-5 flex items-start gap-3 border-b ${
            hasBlocking
              ? 'bg-rose-50 border-rose-200 text-rose-950'
              : 'bg-amber-50 border-amber-200 text-amber-950'
          }`}
        >
          <div
            className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${
              hasBlocking
                ? 'bg-rose-100 text-rose-700 border border-rose-300'
                : 'bg-amber-100 text-amber-700 border border-amber-300'
            }`}
          >
            {hasBlocking ? <AlertCircle className="w-5 h-5" /> : <AlertTriangle className="w-5 h-5" />}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold">
                {hasBlocking
                  ? `Hồ sơ còn ${blockingIssues.length} mục bắt buộc cần bổ sung`
                  : `Hồ sơ có ${warnings.length} khuyến nghị cần lưu ý`}
              </h3>
              <button
                type="button"
                onClick={onClose}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-lg transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>
            <p className="text-xs text-slate-600 mt-1 leading-relaxed">
              {hasBlocking
                ? 'Theo quy chuẩn pháp lý dự án Metro 2, các trường dữ liệu bên dưới là bắt buộc trước khi nộp hồ sơ lên hệ thống.'
                : 'Các thông tin dưới đây không chặn nộp hồ sơ, nhưng bạn nên kiểm tra kỹ để báo cáo đạt chất lượng cao nhất.'}
            </p>
          </div>
        </div>

        {/* Tab switchers if both exist */}
        {hasBlocking && hasWarnings && (
          <div className="px-5 pt-3 flex gap-2 border-b border-slate-100 bg-slate-50/50">
            <button
              type="button"
              onClick={() => setActiveTab('BLOCKING')}
              className={`pb-2.5 px-3 text-xs font-bold border-b-2 transition-all flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'BLOCKING'
                  ? 'border-rose-600 text-rose-700'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-rose-600" />
              <span>Bắt buộc ({blockingIssues.length})</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('WARNING')}
              className={`pb-2.5 px-3 text-xs font-bold border-b-2 transition-all flex items-center gap-1.5 cursor-pointer ${
                activeTab === 'WARNING'
                  ? 'border-amber-600 text-amber-700'
                  : 'border-transparent text-slate-500 hover:text-slate-800'
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-amber-500" />
              <span>Khuyến nghị ({warnings.length})</span>
            </button>
          </div>
        )}

        {/* Issue list */}
        <div className="p-4 sm:p-5 overflow-y-auto flex-1 flex flex-col gap-2.5">
          {(activeTab === 'BLOCKING' ? blockingIssues : warnings).map((issue, idx) => (
            <div
              key={`${issue.fieldId}-${idx}`}
              className={`p-3 rounded-xl border flex items-start justify-between gap-3 transition-all ${
                issue.isBlocking
                  ? 'bg-rose-50/50 border-rose-200 hover:bg-rose-50'
                  : 'bg-amber-50/40 border-amber-200 hover:bg-amber-50'
              }`}
            >
              <div className="flex items-start gap-2.5 min-w-0">
                <span
                  className={`w-5 h-5 rounded-full text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5 ${
                    issue.isBlocking
                      ? 'bg-rose-100 text-rose-700 border border-rose-300'
                      : 'bg-amber-100 text-amber-700 border border-amber-300'
                  }`}
                >
                  {idx + 1}
                </span>

                <div className="min-w-0">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-slate-200 text-slate-700">
                      Bước {issue.step}
                    </span>
                    {issue.code && (
                      <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-indigo-100 text-indigo-700">
                        {issue.code}
                      </span>
                    )}
                    <strong className="text-xs text-slate-900 font-bold">{issue.title}</strong>
                  </div>
                  <p className="text-[11px] text-slate-600 mt-0.5 leading-relaxed">{issue.message}</p>
                </div>
              </div>

              {issue.target === 'CLOUD_SYNC' ? (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    setIsPhotoAuditOpen(true);
                  }}
                  className="px-2.5 py-1.5 rounded-lg text-xs font-bold shrink-0 flex items-center gap-1 transition-all cursor-pointer shadow-2xs bg-amber-600 hover:bg-amber-700 text-white"
                >
                  <span>⚡ Đồng bộ ảnh ngay</span>
                  <ArrowRight size={12} />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onGoToStep(issue.step, issue.fieldId);
                  }}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-bold shrink-0 flex items-center gap-1 transition-all cursor-pointer shadow-2xs ${
                    issue.isBlocking
                      ? 'bg-rose-600 hover:bg-rose-700 text-white'
                      : 'bg-amber-600 hover:bg-amber-700 text-white'
                  }`}
                >
                  <span>Điền ngay</span>
                  <ArrowRight size={12} />
                </button>
              )}
            </div>
          ))}
        </div>

        {/* Footer actions */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-3">
          <Button variant="secondary" size="md" onClick={onClose}>
            Quay lại kiểm tra
          </Button>

          {!hasBlocking && onProceedAnyway ? (
            <Button
              size="md"
              className="bg-teal-600 hover:bg-teal-700 text-white cursor-pointer shadow-md"
              onClick={() => {
                onClose();
                onProceedAnyway();
              }}
              icon={<Send className="w-4 h-4" />}
            >
              Tôi đã kiểm tra, Xác nhận nộp hồ sơ ➔
            </Button>
          ) : (
            <div className="flex items-center gap-2 flex-wrap justify-end">
              <span className="text-[11px] font-semibold text-rose-700 italic">
                Vui lòng bổ sung đầy đủ {blockingIssues.length} mục bắt buộc trước khi nộp
              </span>
              {blockingIssues.some((i) => i.target === 'CLOUD_SYNC') && (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    setIsPhotoAuditOpen(true);
                  }}
                  className="text-xs font-bold text-amber-700 hover:text-amber-800 underline flex items-center gap-1 cursor-pointer"
                >
                  ⚡ Đồng bộ ảnh
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
