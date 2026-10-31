import React from 'react';
import { CheckCircle2, ShieldAlert, Sparkles } from 'lucide-react';
import type { StepwiseBurlandSummary } from '../../stepwise/types';

interface CondoBurlandSummaryCardProps {
  scopeLabel: string;
  summary: StepwiseBurlandSummary;
  onOpenEngineeringJudgement?: () => void;
}

/** Bước 05: cấp Burland lớn nhất, tính lại từ danh sách Z/E/D hiện hành. */
export const CondoBurlandSummaryCard: React.FC<CondoBurlandSummaryCardProps> = ({
  scopeLabel,
  summary,
  onOpenEngineeringJudgement,
}) => {
  const maxGrade = Number(summary.localMaxGrade ?? 0);
  return (
    <div
      className={`p-3.5 rounded-xl border flex items-center justify-between gap-4 flex-wrap ${
        maxGrade >= 3
          ? 'bg-rose-50 border-rose-300'
          : maxGrade >= 1
            ? 'bg-amber-50 border-amber-300'
            : 'bg-emerald-50 border-emerald-300'
      }`}
    >
      <div className="flex items-center gap-3">
        {maxGrade >= 3 ? (
          <ShieldAlert className="w-7 h-7 text-rose-600 shrink-0" />
        ) : (
          <CheckCircle2 className="w-7 h-7 text-emerald-600 shrink-0" />
        )}
        <div>
          <div className="text-[11px] font-bold uppercase text-slate-600">{scopeLabel}</div>
          <div className="text-sm font-black text-slate-900 mt-0.5">
            Burland Cấp {maxGrade} • {summary.controllingDefectsCount ?? 0} khuyết tật
            {summary.governingZoneCode ? ` • Vị trí quyết định: ${summary.governingZoneCode}` : ''}
          </div>
          {summary.needStructuralEngineerReview && (
            <div className="text-xs font-bold text-rose-700 mt-0.5">
              Yêu cầu Kỹ sư Kết cấu kiểm định chuyên sâu trước khi phê duyệt
            </div>
          )}
        </div>
      </div>

      {onOpenEngineeringJudgement && (
        <button
          type="button"
          onClick={onOpenEngineeringJudgement}
          className="px-3 py-1.5 rounded-xl text-xs font-bold bg-sky-600 text-white hover:bg-sky-700 flex items-center gap-1.5 cursor-pointer shadow-xs"
        >
          <Sparkles className="w-3.5 h-3.5" />
          <span>Nhận Định Kỹ Sư</span>
        </button>
      )}
    </div>
  );
};
