import React, { useState } from 'react';
import { usePhase1SurveyStore } from '../../survey-phase1/store/usePhase1SurveyStore';
import { Home, ArrowLeft, ArrowRight, Save, Building2, Check } from 'lucide-react';
import clsx from 'clsx';

export const CONDO_UNIT_STEPS = [
  { id: 1, label: '1. Đối soát toà cha' },
  { id: 2, label: '2. Thông tin căn hộ' },
  { id: 3, label: '3. Khảo sát các tầng' },
  { id: 4, label: '4. Chốt Burland & Cờ KC' },
  { id: 5, label: '5. Bảng điểm ECS & VI' },
  { id: 6, label: '6. Tổng hợp Dashboard' },
  { id: 7, label: '7. Ký biên bản 3 bên' },
];

interface Props {
  onBackToHub: () => void;
}

export const CondoUnitWizardNav: React.FC<Props> = ({ onBackToHub }) => {
  const { currentStep, setCurrentStep, nextStep, prevStep, formData, lastSavedAt, saveDraftToStorage } =
    usePhase1SurveyStore();
  const [savedToast, setSavedToast] = useState(false);

  const handleManualSave = () => {
    saveDraftToStorage();
    setSavedToast(true);
    setTimeout(() => setSavedToast(false), 2500);
  };

  const handleStepClick = (stepId: number) => {
    setCurrentStep(stepId);
  };

  const handlePrev = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleNext = () => {
    if (currentStep < 7) {
      setCurrentStep(currentStep + 1);
    }
  };

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200/80 shadow-xs">
      <div className="max-w-7xl mx-auto px-4 py-2.5 flex flex-col sm:flex-row items-center justify-between gap-3">
        {/* Left Info & Back */}
        <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-start">
          <button
            type="button"
            onClick={onBackToHub}
            className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-semibold text-slate-600 hover:text-slate-900 px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200/80 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Quay lại Hub</span>
          </button>

          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-teal-50 border border-teal-200 text-teal-600">
              <Home className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold bg-teal-50 text-teal-700 border border-teal-200 px-2 py-0.5 rounded">
                  CĂN HỘ {formData.unitCode || 'P.---'}
                </span>
                <span className="text-xs font-bold text-slate-800">
                  Tầng {formData.unitFloorNumber || 1}
                </span>
              </div>
              <span className="text-[11px] text-slate-500 block truncate max-w-[260px]">
                Thuộc: {formData.parentBuildingInfo?.buildingName || formData.buildingName || 'Tòa Chung Cư'}
              </span>
            </div>
          </div>
        </div>

        {/* Right Status & Quick Navigation */}
        <div className="flex items-center gap-2.5">
          <button
            onClick={handleManualSave}
            className={clsx(
              'inline-flex items-center gap-1.5 text-xs font-semibold px-2.5 py-1 rounded-lg border transition-all shadow-xs',
              savedToast
                ? 'bg-emerald-600 text-white border-emerald-600'
                : 'text-emerald-700 bg-emerald-50/80 hover:bg-emerald-100 border-emerald-200'
            )}
            title="Bấm để lưu nháp dữ liệu khảo sát căn hộ vào bộ nhớ thiết bị"
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

          <div className="flex items-center gap-1">
            <button
              onClick={handlePrev}
              disabled={currentStep === 1}
              className="p-1.5 text-slate-600 hover:bg-slate-100 disabled:opacity-30 disabled:pointer-events-none rounded-lg border border-slate-200 transition-all"
              title="Bước trước"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>

            <span className="text-xs font-bold text-teal-700 bg-teal-50 px-2.5 py-1 rounded-full border border-teal-200">
              Bước {currentStep}/7
            </span>

            <button
              onClick={handleNext}
              disabled={currentStep === 7}
              className="p-1.5 text-slate-600 hover:bg-slate-100 disabled:opacity-30 disabled:pointer-events-none rounded-lg border border-slate-200 transition-all"
              title="Bước tiếp theo"
            >
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Stepper Steps Bar */}
      <div className="px-4 pb-2 max-w-7xl mx-auto overflow-x-auto no-scrollbar">
        <div className="flex items-center gap-1 min-w-[700px]">
          {CONDO_UNIT_STEPS.map((s) => {
            const isCurrent = currentStep === s.id;
            const isPassed = currentStep > s.id;

            return (
              <button
                key={s.id}
                type="button"
                onClick={() => handleStepClick(s.id)}
                className={clsx(
                  'flex-1 py-1.5 px-2 rounded-lg text-xs font-medium text-center transition-all flex items-center justify-center gap-1.5 truncate border',
                  isCurrent
                    ? 'bg-teal-600 text-white border-teal-600 shadow-xs font-bold'
                    : isPassed
                    ? 'bg-teal-50 text-teal-700 border-teal-200 hover:bg-teal-100/70'
                    : 'bg-slate-50 text-slate-500 border-slate-200 hover:bg-slate-100'
                )}
              >
                <span
                  className={clsx(
                    'w-4 h-4 rounded-full text-[10px] flex items-center justify-center flex-shrink-0 font-bold',
                    isCurrent
                      ? 'bg-white text-teal-700'
                      : isPassed
                      ? 'bg-teal-200 text-teal-800'
                      : 'bg-slate-200 text-slate-600'
                  )}
                >
                  {s.id}
                </span>
                <span className="truncate">{s.label.split('. ')[1]}</span>
              </button>
            );
          })}
        </div>
      </div>
    </header>
  );
};
