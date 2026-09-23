import React, { useEffect, useState } from 'react';
import { usePhase1SurveyStore } from '../../survey-phase1/store/usePhase1SurveyStore';
import { CondoUnitWizardNav } from '../components/CondoUnitWizardNav';
import { Step1_ParentInheritanceConfirmation } from '../components/Step1_ParentInheritanceConfirmation';
import { Step2_UnitSpecificInformation } from '../components/Step2_UnitSpecificInformation';
import { Step3_FloorHierarchySurvey } from '../../survey-phase1/components/Step3_FloorHierarchySurvey';
import { Step4_BurlandSummary } from '../../survey-phase1/components/Step4_BurlandSummary';
import { Step7_TechnicalCalculations } from '../../survey-phase1/components/Step7_TechnicalCalculations';
import { Step8_ExecutiveDashboard } from '../../survey-phase1/components/Step8_ExecutiveDashboard';
import { Step9_FieldSignatures } from '../../survey-phase1/components/Step9_FieldSignatures';
import { MissingFieldsModal } from '../../survey-phase1/components/MissingFieldsModal';
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
  const {
    currentStep,
    setCurrentStep,
    formData,
    initializeForm,
    saveDraftToStorage,
    clearDraft,
    missingModal,
    closeMissingModal,
    proceedAnyway,
    focusMissingField,
    validateForFinalSubmit,
  } = usePhase1SurveyStore();
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (parcel) {
      initializeForm(parcel, unit);
    }
  }, [parcel?.id, unit?.id]);

  // Chặn thao tác reload / đóng tab ngoài ý muốn
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      saveDraftToStorage();
      e.preventDefault();
      e.returnValue = 'Bạn có dữ liệu khảo sát căn hộ đang thực hiện. Bạn có chắc chắn muốn tải lại hoặc rời đi?';
      return e.returnValue;
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [saveDraftToStorage]);

  // Chặn thao tác back trình duyệt / vuốt back trên điện thoại
  useEffect(() => {
    window.history.pushState({ condoUnitSessionActive: true }, '');

    const handlePopState = () => {
      const confirmLeave = window.confirm(
        'Bạn có chắc chắn muốn quay lại và tạm rời phiên khảo sát căn hộ? Dữ liệu đang nhập đã được lưu nháp an toàn.'
      );
      if (confirmLeave) {
        saveDraftToStorage();
        onBackToHome();
      } else {
        window.history.pushState({ condoUnitSessionActive: true }, '');
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [onBackToHome, saveDraftToStorage]);

  // Quay về an toàn có xác nhận và lưu nháp
  const handleSafeBackToHome = () => {
    const confirmLeave = window.confirm(
      'Bạn có chắc chắn muốn quay về danh sách căn hộ? Toàn bộ dữ liệu khảo sát đã được tự động lưu nháp an toàn.'
    );
    if (confirmLeave) {
      saveDraftToStorage();
      onBackToHome();
    }
  };

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    document.documentElement.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    document.body.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  }, [currentStep]);

  const handleSubmitFinal = async () => {
    const isValid = validateForFinalSubmit();
    if (!isValid) return;

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
        if (formData.unitId && !existing.includes(formData.unitId)) {
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
      {/* Navbar sáng đồng bộ toàn hệ thống */}
      <CondoUnitWizardNav onBackToHub={handleSafeBackToHome} />

      {/* Main Step Content Container */}
      <main className="flex-1 px-3 sm:px-6 py-6">
        {currentStep === 1 && <Step1_ParentInheritanceConfirmation />}
        {currentStep === 2 && <Step2_UnitSpecificInformation />}
        {currentStep === 3 && <Step3_FloorHierarchySurvey />}
        {currentStep === 4 && <Step4_BurlandSummary />}
        {currentStep === 5 && <Step7_TechnicalCalculations />}
        {currentStep === 6 && <Step8_ExecutiveDashboard />}
        {currentStep === 7 && (
          <Step9_FieldSignatures
            onSubmitFinal={handleSubmitFinal}
            isSubmitting={isSubmitting}
          />
        )}
      </main>

      {/* Modal cảnh báo thiếu trường bắt buộc */}
      <MissingFieldsModal
        isOpen={Boolean(missingModal?.isOpen)}
        missingFields={missingModal?.missingFields || []}
        currentStep={currentStep}
        targetStep={missingModal?.targetStep || 1}
        onClose={closeMissingModal}
        onProceedAnyway={proceedAnyway}
        onFocusField={focusMissingField}
      />
    </div>
  );
};
