import React from 'react';
import { usePhase1SurveyStore } from '../../survey-phase1/store/usePhase1SurveyStore';
import { StepWizardNav } from '../../survey-phase1/components/StepWizardNav';
import { Building2 } from 'lucide-react';

const CONDO_STEPS = [
  '1. Ngoại quan toà',
  '2. Quy mô & Móng',
  '3. Không gian chung',
  '4. Burland toà',
  '5. Ranh GIS',
  '6. Điểm ECS/VI',
  '7. Dashboard',
  '8. Ký số BQL',
];

interface Props {
  onBackToHub: () => void;
}

export const CondoMasterWizardNav: React.FC<Props> = ({ onBackToHub }) => {
  const { formData } = usePhase1SurveyStore();

  const leftBadge = (
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
          {formData.houseNumber ? `${formData.houseNumber}, ` : ''}
          {formData.street || 'Đang cập nhật địa chỉ'}
        </span>
      </div>
    </div>
  );

  return (
    <StepWizardNav
      onBackToHome={onBackToHub}
      backLabel="Quay lại Hub"
      stepLabels={CONDO_STEPS}
      themeColor="indigo"
      leftBadge={leftBadge}
    />
  );
};
