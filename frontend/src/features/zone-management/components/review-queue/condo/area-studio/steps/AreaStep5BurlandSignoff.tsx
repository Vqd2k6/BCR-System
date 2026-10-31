import React from 'react';
import {
  ShieldAlert,
  CheckCircle2,
  FileSignature,
  Maximize2,
} from 'lucide-react';
import type {
  CondoAreaFormState,
  CondoAuditStepProps,
} from '../../types/condo-audit.types';

export const AreaStep5BurlandSignoff: React.FC<
  CondoAuditStepProps<CondoAreaFormState>
> = ({
  isEditMode,
  formState,
  handleFieldChange,
  onOpenPhotoZoom,
}) => {
  const bSum = formState.burlandSummary || {};
  const maxGrade = Number(bSum.localMaxGrade ?? 0);
  const sigs = formState.signatures || {};

  return (
    <div className="space-y-6">
      {/* 1. Tổng hợp Cấp độ Hư hại Burland của Khu vực dùng chung */}
      <div
        className={`p-4 rounded-2xl border flex items-center justify-between gap-4 flex-wrap ${
          maxGrade >= 3
            ? 'bg-rose-50 dark:bg-rose-950/30 border-rose-300 dark:border-rose-800'
            : maxGrade >= 1
              ? 'bg-amber-50 dark:bg-amber-950/30 border-amber-300 dark:border-amber-800'
              : 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-300 dark:border-emerald-800'
        }`}
      >
        <div className="flex items-center gap-3">
          {maxGrade >= 3 ? (
            <ShieldAlert className="w-8 h-8 text-rose-600 shrink-0" />
          ) : (
            <CheckCircle2 className="w-8 h-8 text-emerald-600 shrink-0" />
          )}
          <div>
            <div className="text-xs font-black uppercase text-slate-700 dark:text-slate-200">
              Cấp Độ Hư Hại Burland Đại Diện Phân Vùng ({formState.unitCode})
            </div>
            <div className="text-base font-black text-slate-900 dark:text-white mt-0.5">
              Burland Cấp {maxGrade} • Tổng số vết nứt hoạt động:{' '}
              {bSum.controllingDefectsCount ?? 0} vị trí
              {bSum.governingZoneCode ? ` (Vị trí quyết định: ${bSum.governingZoneCode})` : ''}
            </div>
          </div>
        </div>
      </div>

      {/* 2. Kết luận & Kiến nghị kỹ thuật */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-black text-slate-800 dark:text-slate-100 mb-1.5">
            Kết luận hiện trạng Phân vùng Dùng chung
          </label>
          {isEditMode ? (
            <textarea
              rows={3}
              value={formState.summaryConclusions}
              onChange={(e) =>
                handleFieldChange(
                  'summaryConclusions',
                  'Kết luận phân vùng dùng chung',
                  e.target.value
                )
              }
              className="w-full p-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs"
            />
          ) : (
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 text-xs min-h-[72px]">
              {formState.summaryConclusions || 'Phân vùng dùng chung được ghi nhận đầy đủ hiện trạng.'}
            </div>
          )}
        </div>

        <div>
          <label className="block text-xs font-black text-slate-800 dark:text-slate-100 mb-1.5">
            Đề xuất kỹ thuật / Theo dõi vết nứt
          </label>
          {isEditMode ? (
            <textarea
              rows={3}
              value={formState.engineeringRecommendations}
              onChange={(e) =>
                handleFieldChange(
                  'engineeringRecommendations',
                  'Đề xuất kỹ thuật phân vùng chung',
                  e.target.value
                )
              }
              className="w-full p-3 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs"
            />
          ) : (
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 text-xs min-h-[72px]">
              {formState.engineeringRecommendations || 'Tiếp tục theo dõi định kỳ trong quá trình thi công.'}
            </div>
          )}
        </div>
      </div>

      {/* 3. Chữ ký Kỹ sư Khảo sát */}
      <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 flex items-center justify-between gap-4 flex-wrap">
        <div className="flex items-center gap-2 text-xs">
          <FileSignature className="w-4 h-4 text-indigo-600" />
          <span>
            Kỹ sư thực hiện:{' '}
            <strong className="text-slate-900 dark:text-white">
              {sigs.surveyorName || 'Kỹ sư hiện trường'}
            </strong>
          </span>
        </div>

        {sigs.surveyorSignature && (
          <button
            type="button"
            onClick={() =>
              onOpenPhotoZoom(sigs.surveyorSignature!, 'Chữ ký Kỹ sư khảo sát')
            }
            className="w-24 h-12 rounded-lg border border-slate-300 bg-white force-light overflow-hidden cursor-pointer relative group"
          >
            <img
              src={sigs.surveyorSignature}
              alt="Signature"
              className="w-full h-full object-contain"
            />
            <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 flex items-center justify-center">
              <Maximize2 className="w-3 h-3 text-white" />
            </div>
          </button>
        )}
      </div>
    </div>
  );
};

