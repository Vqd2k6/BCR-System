import React from 'react';
import { Eye, CheckCircle2, XCircle } from 'lucide-react';

interface SurveyReviewBannerProps {
  readOnly: boolean;
  canApproveOrReject: boolean;
  targetCode: string;
  onApprove: () => void;
  onReject: () => void;
  onBack: () => void;
}

export const SurveyReviewBanner: React.FC<SurveyReviewBannerProps> = ({
  readOnly,
  canApproveOrReject,
  targetCode,
  onApprove,
  onReject,
  onBack,
}) => {
  if (!readOnly) return null;

  return (
    <div
      className={`px-4 py-2.5 shadow-xs flex flex-wrap items-center justify-between sticky top-0 z-50 animate-in fade-in gap-2 border-b ${
        canApproveOrReject ? 'bg-violet-50 border-violet-200' : 'bg-sky-50 border-sky-200'
      }`}
    >
      <div className="flex items-center gap-2.5 text-xs sm:text-sm font-bold">
        <Eye className={`w-4 h-4 shrink-0 ${canApproveOrReject ? 'text-violet-600' : 'text-sky-600'}`} />
        <span className={canApproveOrReject ? 'text-violet-800' : 'text-sky-800'}>
          {canApproveOrReject ? (
            <>
              Thẩm định hồ sơ (Zone Admin / Super Admin) - Thửa:{' '}
              <strong className="text-violet-700">{targetCode}</strong>
            </>
          ) : (
            <>👁️ Chế độ Xem lại biểu mẫu — Hồ sơ đã nộp, không thể chỉnh sửa.</>
          )}
        </span>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        {canApproveOrReject && (
          <>
            <button
              type="button"
              onClick={onApprove}
              className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-3 py-1.5 rounded-lg flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
            >
              <CheckCircle2 className="w-4 h-4" />
              Duyệt hồ sơ
            </button>
            <button
              type="button"
              onClick={onReject}
              className="bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold px-3 py-1.5 rounded-lg flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
            >
              <XCircle className="w-4 h-4" />
              Từ chối
            </button>
          </>
        )}
        <button
          type="button"
          onClick={onBack}
          className={`text-xs font-bold px-3 py-1.5 rounded-lg border transition-colors shrink-0 cursor-pointer ${
            canApproveOrReject
              ? 'bg-white hover:bg-violet-50 text-violet-700 border-violet-300'
              : 'bg-white hover:bg-sky-50 text-sky-700 border-sky-300'
          }`}
        >
          Quay về
        </button>
      </div>
    </div>
  );
};
