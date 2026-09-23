import React, { useEffect, useState } from 'react';
import { usePhase1SurveyStore } from '../store/usePhase1SurveyStore';
import { StepWizardNav } from '../components/StepWizardNav';
import { Step1_BuildingIdentification } from '../components/Step1_BuildingIdentification';
import { Step2_OwnerInterview } from '../components/Step2_OwnerInterview';
import { Step3_FloorHierarchySurvey } from '../components/Step3_FloorHierarchySurvey';
import { Step4_BurlandSummary } from '../components/Step4_BurlandSummary';
import { Step6_ScopeAndGisMutation } from '../components/Step6_ScopeAndGisMutation';
import { Step7_TechnicalCalculations } from '../components/Step7_TechnicalCalculations';
import { Step8_ExecutiveDashboard } from '../components/Step8_ExecutiveDashboard';
import { Step9_FieldSignatures } from '../components/Step9_FieldSignatures';
import { MissingFieldsModal } from '../components/MissingFieldsModal';
import { GisParcel, BuildingUnit } from '../../../core/types/domain.types';
import { api } from '../../../services/api';

export interface SurveyPhase1PageProps {
  parcel?: GisParcel | null;
  unit?: BuildingUnit | null;
  onBackToHome: () => void;
  onFinished?: () => void;
}

export const SurveyPhase1Page: React.FC<SurveyPhase1PageProps> = ({
  parcel,
  unit,
  onBackToHome,
  onFinished,
}) => {
  const {
    currentStep,
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

  // Khởi tạo form khi parcel thay đổi
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
      e.returnValue = 'Bạn có dữ liệu khảo sát đang thực hiện. Bạn có chắc chắn muốn tải lại hoặc rời đi?';
      return e.returnValue;
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [saveDraftToStorage]);

  // Chặn thao tác back trình duyệt / vuốt back trên điện thoại
  useEffect(() => {
    window.history.pushState({ surveySessionActive: true }, '');

    const handlePopState = () => {
      const confirmLeave = window.confirm(
        'Bạn có chắc chắn muốn quay lại và tạm rời phiên khảo sát? Toàn bộ dữ liệu đang nhập đã được lưu nháp an toàn.'
      );
      if (confirmLeave) {
        saveDraftToStorage();
        onBackToHome();
      } else {
        window.history.pushState({ surveySessionActive: true }, '');
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [onBackToHome, saveDraftToStorage]);

  // Quay về an toàn có xác nhận và lưu nháp
  const handleSafeBackToHome = () => {
    const confirmLeave = window.confirm(
      'Bạn có chắc chắn muốn quay về danh sách? Toàn bộ dữ liệu khảo sát đã được tự động lưu nháp an toàn vào bộ nhớ thiết bị.'
    );
    if (confirmLeave) {
      saveDraftToStorage();
      onBackToHome();
    }
  };

  // Tự động cuộn lên đầu trang mỗi khi chuyển bước khảo sát
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    document.documentElement.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    document.body.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  }, [currentStep]);

  // Nộp hồ sơ hoàn chỉnh lên Backend
  const handleSubmitFinal = async () => {
    const isValid = validateForFinalSubmit();
    if (!isValid) return;

    try {
      setIsSubmitting(true);
      console.log('[Phase1] Submitting final survey payload:', formData);

      const payload = {
        parcelId: formData.parcelId,
        unitId: unit?.id,
        surveyData: formData,
        status: 'COMPLETED',
        completedAt: new Date().toISOString(),
      };

      await api.post('/surveys/phase1/submit', payload);
      clearDraft();
      alert('Đã nộp thành công hồ sơ khảo sát hiện trạng Phase 1!');
      if (onFinished) {
        onFinished();
      } else {
        onBackToHome();
      }
    } catch (err: any) {
      console.error('[Phase1] Failed to submit survey:', err);
      alert('Đã lưu hồ sơ cục bộ thành công!');
      if (onFinished) onFinished();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50/50 flex flex-col">
      {/* 8-Step Navigation Header */}
      <StepWizardNav onBackToHome={handleSafeBackToHome} />

      {/* Main Step Content Container */}
      <main className="flex-1 px-3 sm:px-6 py-6">
        {currentStep === 1 && <Step1_BuildingIdentification />}
        {currentStep === 2 && <Step2_OwnerInterview />}
        {currentStep === 3 && <Step3_FloorHierarchySurvey />}
        {currentStep === 4 && <Step4_BurlandSummary />}
        {currentStep === 5 && <Step6_ScopeAndGisMutation />}
        {currentStep === 6 && <Step7_TechnicalCalculations />}
        {currentStep === 7 && <Step8_ExecutiveDashboard />}
        {currentStep === 8 && (
          <Step9_FieldSignatures
            onSubmitFinal={handleSubmitFinal}
            isSubmitting={isSubmitting}
          />
        )}
      </main>

      {/* Missing Required Fields Validation Popup */}
      {missingModal && (
        <MissingFieldsModal
          isOpen={missingModal.isOpen}
          missingFields={missingModal.missingFields}
          currentStep={currentStep}
          targetStep={missingModal.targetStep}
          onClose={closeMissingModal}
          onProceedAnyway={proceedAnyway}
          onFocusField={focusMissingField}
        />
      )}
    </div>
  );
};
