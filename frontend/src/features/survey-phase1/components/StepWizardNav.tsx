import React, { useState } from 'react';
import { usePhase1SurveyStore } from '../store/usePhase1SurveyStore';
import { Save, ArrowLeft, ArrowRight, Check } from 'lucide-react';
import clsx from 'clsx';

const STEP_LABELS = [
  '1. Tiếp cận & Ảnh',
  '2. Phỏng vấn chủ hộ',
  '3. Khảo sát các tầng',
  '4. Chốt Burland & Cờ KC',
  '5. Phạm vi & Ranh GIS',
  '6. Bảng điểm ECS & VI',
  '7. Tổng hợp Dashboard',
  '8. Ký biên bản 3 bên',
];

interface StepWizardNavProps {
  onBackToHome: () => void;
}

export const StepWizardNav: React.FC<StepWizardNavProps> = ({ onBackToHome }) => {
  const { currentStep, requestStepNavigation, nextStep, prevStep, lastSavedAt, saveDraftToStorage } =
    usePhase1SurveyStore();
  const [savedToast, setSavedToast] = useState(false);

  const handleManualSave = () => {
    saveDraftToStorage();
    setSavedToast(true);
    setTimeout(() => setSavedToast(false), 2500);
  };

  return (
    <div className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200/80 shadow-sm">
      {/* Top action header */}
      <div className="px-4 py-3 flex items-center justify-between gap-2 max-w-7xl mx-auto">
        <button
          onClick={onBackToHome}
          className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-semibold text-slate-600 hover:text-slate-900 px-2.5 py-1.5 rounded-lg hover:bg-slate-100 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Về danh sách</span>
        </button>

        {/* Step indicator pills on mobile */}
        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
            Bước {currentStep}/8
          </span>
          <span className="text-xs sm:text-sm font-semibold text-slate-800 hidden sm:inline">
            {STEP_LABELS[currentStep - 1]}
          </span>
        </div>

        {/* Auto save badge & navigation buttons */}
        <div className="flex items-center gap-2">
          <button
            onClick={handleManualSave}
            className={clsx(
              'inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-lg border transition-all shadow-xs',
              savedToast
                ? 'bg-emerald-600 text-white border-emerald-600'
                : 'text-emerald-700 bg-emerald-50/80 hover:bg-emerald-100 border-emerald-200'
            )}
            title="Bấm để lưu nháp dữ liệu khảo sát vào bộ nhớ thiết bị"
          >
            {savedToast ? (
              <>
                <Check className="w-3.5 h-3.5 text-white" />
                <span>Đã lưu!</span>
              </>
            ) : (
              <>
                <Save className="w-3.5 h-3.5 text-emerald-600" />
                <span>{lastSavedAt ? `Lưu nháp: ${lastSavedAt}` : 'Lưu nháp'}</span>
              </>
            )}
          </button>

          <button
            onClick={prevStep}
            disabled={currentStep === 1}
            className="p-1.5 text-slate-600 hover:bg-slate-100 disabled:opacity-30 disabled:pointer-events-none rounded-lg border border-slate-200 transition-all"
            title="Bước trước"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>

          <button
            onClick={nextStep}
            disabled={currentStep === 8}
            className="p-1.5 text-slate-600 hover:bg-slate-100 disabled:opacity-30 disabled:pointer-events-none rounded-lg border border-slate-200 transition-all"
            title="Bước tiếp theo"
          >
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Progress Bar & Desktop Step Tabs */}
      <div className="px-4 pb-2 max-w-7xl mx-auto overflow-x-auto no-scrollbar">
        <div className="flex items-center gap-1 min-w-[750px]">
          {STEP_LABELS.map((label, idx) => {
            const stepNum = idx + 1;
            const isPassed = stepNum < currentStep;
            const isCurrent = stepNum === currentStep;

            return (
              <button
                key={stepNum}
                onClick={() => requestStepNavigation(stepNum)}
                className={clsx(
                  'flex-1 py-1.5 px-2 rounded-lg text-xs font-medium text-center transition-all flex items-center justify-center gap-1.5 truncate border',
                  isCurrent
                    ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm font-bold'
                    : isPassed
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100/70'
                    : 'bg-slate-50 text-slate-500 border-slate-200 hover:bg-slate-100'
                )}
              >
                <span
                  className={clsx(
                    'w-4 h-4 rounded-full text-[10px] flex items-center justify-center flex-shrink-0 font-bold',
                    isCurrent
                      ? 'bg-white text-emerald-700'
                      : isPassed
                      ? 'bg-emerald-200 text-emerald-800'
                      : 'bg-slate-200 text-slate-600'
                  )}
                >
                  {stepNum}
                </span>
                <span className="truncate">{label.split('. ')[1]}</span>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
