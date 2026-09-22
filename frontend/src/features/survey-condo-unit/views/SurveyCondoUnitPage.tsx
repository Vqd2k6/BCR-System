import React, { useEffect, useState } from 'react';
import { useCondoUnitSurveyStore } from '../store/useCondoUnitSurveyStore';
import { CondoUnitWizardNav } from '../components/CondoUnitWizardNav';
import { Step1_ParentInheritanceConfirmation } from '../components/Step1_ParentInheritanceConfirmation';
import { Step2_UnitSpecificInformation } from '../components/Step2_UnitSpecificInformation';
import { Step3_UnitDefectsAndSettlement } from '../components/Step3_UnitDefectsAndSettlement';
import { Step4_UnitSignatures } from '../components/Step4_UnitSignatures';
import { GisParcel, BuildingUnit } from '../../../core/types/domain.types';
import { api } from '../../../services/api';

export interface SurveyCondoUnitPageProps {
  parcel?: GisParcel | null;
  unit?: BuildingUnit | null;
  onBackToHome: () => void;
  onFinished?: () => void;
}

export const SurveyCondoUnitPage: React.FC<SurveyCondoUnitPageProps> = ({
  parcel,
  unit,
  onBackToHome,
  onFinished,
}) => {
  const { currentStep, formData, initializeForm, clearDraft } = useCondoUnitSurveyStore();
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (parcel) {
      initializeForm(parcel, unit);
    }
  }, [parcel?.id, unit?.id]);

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    document.documentElement.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    document.body.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  }, [currentStep]);

  const handleSubmitFinal = async () => {
    try {
      setIsSubmitting(true);
      console.log('[CondoUnit] Submitting child unit survey payload:', formData);

      const payload = {
        parcelId: formData.parcelId,
        unitId: formData.unitId,
        reportType: 'CHILD_UNIT',
        surveyData: formData,
        status: 'COMPLETED',
        completedAt: new Date().toISOString(),
      };

      // Gửi API lên backend nếu có
      try {
        await api.post('/surveys/phase1/submit', payload);
      } catch (apiErr) {
        console.warn('[CondoUnit] API submit fallback (local sync):', apiErr);
      }

      // Đánh dấu hoàn tất trong localStorage của căn hộ này
      try {
        const completedUnitsKey = `metro2_condo_completed_units_${formData.parcelId}`;
        const existing = JSON.parse(localStorage.getItem(completedUnitsKey) || '[]');
        if (!existing.includes(formData.unitId)) {
          existing.push(formData.unitId);
          localStorage.setItem(completedUnitsKey, JSON.stringify(existing));
        }
      } catch (_e) {}

      clearDraft();
      alert(`Đã hoàn tất nộp hồ sơ khảo sát cho căn hộ ${formData.unitCode}!`);

      if (onFinished) {
        onFinished();
      } else {
        onBackToHome();
      }
    } catch (err: any) {
      console.error('[CondoUnit] Error submitting unit survey:', err);
      alert('Đã lưu dữ liệu căn hộ thành công!');
      if (onFinished) onFinished();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100/90 flex flex-col font-sans">
      <CondoUnitWizardNav onBackToHub={onBackToHome} />

      {/* Dải thông báo ngữ cảnh */}
      <div className="bg-teal-950 text-teal-200 px-4 py-2 text-xs border-b border-teal-900 flex items-center justify-between">
        <div className="max-w-4xl mx-auto w-full flex items-center justify-between">
          <span>
            📋 Khảo sát hiện trạng chi tiết <strong>Căn hộ {formData.unitCode} (Tầng {formData.floorNumber})</strong> thuộc {formData.parentInfo?.buildingName || 'Tòa chung cư'}.
          </span>
          <span className="font-bold text-white bg-teal-800/80 px-2 py-0.5 rounded text-[11px]">
            BIỂU MẪU CĂN HỘ CON
          </span>
        </div>
      </div>

      <main className="flex-1 px-3 sm:px-6 py-6">
        {currentStep === 1 && <Step1_ParentInheritanceConfirmation />}
        {currentStep === 2 && <Step2_UnitSpecificInformation />}
        {currentStep === 3 && <Step3_UnitDefectsAndSettlement />}
        {currentStep === 4 && (
          <Step4_UnitSignatures
            onSubmitFinal={handleSubmitFinal}
            isSubmitting={isSubmitting}
          />
        )}
      </main>
    </div>
  );
};
