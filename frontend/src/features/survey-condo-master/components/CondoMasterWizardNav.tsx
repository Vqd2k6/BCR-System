import React, { useState } from 'react';
import { usePhase1SurveyStore } from '../../survey-phase1/store/usePhase1SurveyStore';
import { Building2, ArrowLeft, ArrowRight, Save, Check } from 'lucide-react';
import clsx from 'clsx';

const CONDO_STEPS = [
  { id: 1, label: '1. Ngoại quan toà' },
  { id: 2, label: '2. Quy mô & Móng' },
  { id: 3, label: '3. Không gian chung' },
  { id: 4, label: '4. Burland toà' },
  { id: 5, label: '5. Ranh GIS' },
  { id: 6, label: '6. Điểm ECS/VI' },
  { id: 7, label: '7. Dashboard' },
  { id: 8, label: '8. Ký số BQL' },
];

interface Props {
  onBackToHub: () => void;
}

export const CondoMasterWizardNav: React.FC<Props> = ({ onBackToHub }) => {
  const {
    currentStep,
    requestStepNavigation,
    nextStep,
    prevStep,
    formData,
    lastSavedAt,
    saveDraftToStorage,
  } = usePhase1SurveyStore();
  const [savedToast, setSavedToast] = useState(false);

  const handleManualSave = () => {
    saveDraftToStorage();
    setSavedToast(true);
    setTimeout(() => setSavedToast(false), 2500);
  };

  const handleStepClick = (stepId: number) => {
    requestStepNavigation(stepId);
  };

  const handlePrev = () => {
    prevStep();
  };

  const handleNext = () => {
    nextStep();
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
            <div className="p-1.5 rounded-lg bg-indigo-50 border border-indigo-200 text-indigo-600">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold bg-indigo-50 text-indigo-700 border border-indigo-200 px-2 py-0.5 rounded">
                  TOÀ CHUNG CƯ MẸ
                </span>
                <span className="text-xs font-bold text-slate-800">
                  {formData.projectParcelCode || formData.officialCadastralCode || 'TOÀ NHÀ'}
                </span>
              </div>
              <span className="text-[11px] text-slate-500 block truncate max-w-[280px]">
                {formData.houseNumber ? `${formData.houseNumber}, ` : ''}{formData.street || 'Đang cập nhật địa chỉ'}
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
            title="Bấm để lưu nháp dữ liệu khảo sát tòa nhà vào bộ nhớ thiết bị"
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

            <span className="text-xs font-bold text-indigo-700 bg-indigo-50 px-2.5 py-1 rounded-full border border-indigo-200">
              Bước {currentStep}/8
            </span>

            <button
              onClick={handleNext}
              disabled={currentStep === 8}
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
        <div className="flex items-center gap-1 min-w-[760px]">
          {CONDO_STEPS.map((s) => {
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
                    ? 'bg-indigo-600 text-white border-indigo-600 shadow-xs font-bold'
                    : isPassed
                    ? 'bg-indigo-50 text-indigo-700 border-indigo-200 hover:bg-indigo-100/70'
                    : 'bg-slate-50 text-slate-500 border-slate-200 hover:bg-slate-100'
                )}
              >
                <span
                  className={clsx(
                    'w-4 h-4 rounded-full text-[10px] flex items-center justify-center flex-shrink-0 font-bold',
                    isCurrent
                      ? 'bg-white text-indigo-700'
                      : isPassed
                      ? 'bg-indigo-200 text-indigo-800'
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
