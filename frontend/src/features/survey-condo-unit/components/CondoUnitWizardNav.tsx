import React from 'react';
import { useCondoUnitSurveyStore } from '../store/useCondoUnitSurveyStore';
import { Home, ArrowLeft, Save, Building2 } from 'lucide-react';
import { Button } from '../../../core/components/ui/Button';

const CONDO_UNIT_STEPS = [
  { id: 1, label: '1. Đối soát toà cha' },
  { id: 2, label: '2. Thông tin & 2 ảnh P01/P04' },
  { id: 3, label: '3. Khuyết tật & Lún riêng' },
  { id: 4, label: '4. Ký số chủ căn hộ' },
];

interface Props {
  onBackToHub: () => void;
}

export const CondoUnitWizardNav: React.FC<Props> = ({ onBackToHub }) => {
  const { currentStep, setStep, formData, lastSavedAt } = useCondoUnitSurveyStore();

  return (
    <header className="sticky top-0 z-40 bg-slate-900 text-white shadow-md border-b border-teal-900/50">
      <div className="max-w-4xl mx-auto px-4 py-3 flex flex-col sm:flex-row items-center justify-between gap-3">
        {/* Left Info & Back */}
        <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-start">
          <Button
            variant="secondary"
            size="sm"
            onClick={onBackToHub}
            className="bg-slate-800 text-slate-200 hover:bg-slate-700 border-slate-700 text-xs"
            icon={<ArrowLeft className="w-3.5 h-3.5" />}
          >
            Về Hub
          </Button>

          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-teal-600/30 border border-teal-500/30 text-teal-400">
              <Home className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold bg-teal-500/20 text-teal-300 border border-teal-400/30 px-2 py-0.5 rounded">
                  CĂN HỘ {formData.unitCode || 'P.---'}
                </span>
                <span className="text-sm font-bold text-white">
                  Tầng {formData.floorNumber}
                </span>
              </div>
              <span className="text-[11px] text-slate-400 block truncate max-w-[240px]">
                Thuộc: {formData.parentInfo?.buildingName || 'Tòa Chung Cư'}
              </span>
            </div>
          </div>
        </div>

        {/* Right Status */}
        <div className="flex items-center gap-2 text-xs text-slate-400">
          <Save className="w-3.5 h-3.5 text-emerald-400" />
          <span>Lưu nháp: {lastSavedAt || 'Vừa xong'}</span>
        </div>
      </div>

      {/* Stepper Steps Bar */}
      <div className="bg-slate-950/80 border-t border-slate-800 px-4 py-2 overflow-x-auto">
        <div className="max-w-4xl mx-auto flex items-center justify-between gap-2">
          {CONDO_UNIT_STEPS.map((s) => {
            const isCurrent = currentStep === s.id;
            const isPassed = currentStep > s.id;

            return (
              <button
                key={s.id}
                type="button"
                onClick={() => setStep(s.id)}
                className={`flex-1 flex items-center justify-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-all ${
                  isCurrent
                    ? 'bg-teal-600 text-white font-bold shadow-xs'
                    : isPassed
                    ? 'text-teal-300 bg-teal-950/40 hover:bg-teal-900/50'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                }`}
              >
                <span
                  className={`w-5 h-5 rounded-full flex items-center justify-center text-[11px] font-bold ${
                    isCurrent
                      ? 'bg-white text-teal-900'
                      : isPassed
                      ? 'bg-teal-500/30 text-teal-200 border border-teal-400/40'
                      : 'bg-slate-800 text-slate-400'
                  }`}
                >
                  {s.id}
                </span>
                <span className="truncate">{s.label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </header>
  );
};
