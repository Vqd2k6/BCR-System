import React from 'react';
import { usePhase1SurveyStore } from '../../survey-phase1/store/usePhase1SurveyStore';
import { StepWizardNav } from '../../survey-phase1/components/StepWizardNav';
import { Home } from 'lucide-react';

export const CONDO_UNIT_STEPS = [
  '1. Đối soát toà cha',
  '2. Thông tin căn hộ',
  '3. Khảo sát các tầng',
  '4. Chốt Burland & Cờ KC',
  '5. Bảng điểm ECS & VI',
  '6. Tổng hợp Dashboard',
  '7. Ký biên bản 3 bên',
];

interface Props {
  onBackToHub: () => void;
}

export const CondoUnitWizardNav: React.FC<Props> = ({ onBackToHub }) => {
  const { formData } = usePhase1SurveyStore();

  const leftBadge = (
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
  );

  return (
    <StepWizardNav
      onBackToHome={onBackToHub}
      backLabel="Quay lại Hub"
      stepLabels={CONDO_UNIT_STEPS}
      themeColor="teal"
      leftBadge={leftBadge}
    />
  );
};
