import React from 'react';
import { useCondoMasterSurveyStore } from '../store/useCondoMasterSurveyStore';
import { Building2, ArrowLeft, Save } from 'lucide-react';
import { Button } from '../../../core/components/ui/Button';

const CONDO_STEPS = [
  { id: 1, label: 'Ngoại quan toà' },
  { id: 2, label: 'Quy mô & Móng' },
  { id: 3, label: 'Không gian chung' },
  { id: 4, label: 'Burland toà' },
  { id: 5, label: 'Ranh GIS' },
  { id: 6, label: 'Điểm ECS/VI' },
  { id: 7, label: 'Dashboard' },
  { id: 8, label: 'Ký số BQL' },
];

interface Props {
  onBackToHub: () => void;
}

export const CondoMasterWizardNav: React.FC<Props> = ({ onBackToHub }) => {
  const { currentStep, setStep, formData, lastSavedAt } = useCondoMasterSurveyStore();

  return (
    <header className="sticky top-0 z-40 bg-slate-900 text-white shadow-md border-b border-indigo-900/50">
      <div className="max-w-6xl mx-auto px-4 py-3 flex flex-col sm:flex-row items-center justify-between gap-3">
        {/* Left Info & Back */}
        <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-start">
          <Button
            variant="secondary"
            size="sm"
            onClick={onBackToHub}
            className="bg-slate-800 text-slate-200 hover:bg-slate-700 border-slate-700 text-xs"
            icon={<ArrowLeft className="w-3.5 h-3.5" />}
          >
            Quay lại Hub
          </Button>

          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-lg bg-indigo-600/30 border border-indigo-500/30 text-indigo-400">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-400/30 px-2 py-0.5 rounded">
                  TOÀ CHUNG CƯ TỔNG THỂ
                </span>
                <span className="text-sm font-bold text-white">
                  {formData.projectParcelCode || formData.officialCadastralCode || 'TOÀ NHÀ'}
                </span>
              </div>
              <span className="text-[11px] text-slate-400 block truncate max-w-[260px]">
                {formData.houseNumber ? `${formData.houseNumber}, ` : ''}{formData.street || 'Đang cập nhật'}
              </span>
            </div>
          </div>
        </div>

        {/* Right Status */}
        <div className="flex items-center gap-2 text-xs text-slate-400">
          <Save className="w-3.5 h-3.5 text-emerald-400" />
          <span>Đã lưu nháp: {lastSavedAt || 'Vừa xong'}</span>
        </div>
      </div>

      {/* Stepper Steps Bar */}
      <div className="bg-slate-950/80 border-t border-slate-800 px-4 py-2 overflow-x-auto">
        <div className="max-w-6xl mx-auto flex items-center justify-between min-w-[620px] gap-1">
          {CONDO_STEPS.map((s) => {
            const isCurrent = currentStep === s.id;
            const isPassed = currentStep > s.id;

            return (
              <button
                key={s.id}
                type="button"
                onClick={() => setStep(s.id)}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium transition-all ${
                  isCurrent
                    ? 'bg-indigo-600 text-white font-bold shadow-xs'
                    : isPassed
                    ? 'text-indigo-300 bg-indigo-950/40 hover:bg-indigo-900/50'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                }`}
              >
                <span
                  className={`w-5 h-5 rounded-full flex items-center justify-center text-[11px] font-bold ${
                    isCurrent
                      ? 'bg-white text-indigo-900'
                      : isPassed
                      ? 'bg-indigo-500/30 text-indigo-200 border border-indigo-400/40'
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
