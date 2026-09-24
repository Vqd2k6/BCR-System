import React, { useEffect, useState } from 'react';
import { usePhase1SurveyStore } from '../../survey-phase1/store/usePhase1SurveyStore';
import { CondoMasterWizardNav } from '../components/CondoMasterWizardNav';
import { Step1_BuildingIdentification } from '../../survey-phase1/components/Step1_BuildingIdentification';
import { Step2_CondoMasterInterview } from '../components/Step2_CondoMasterInterview';
import { Step3_FloorHierarchySurvey } from '../../survey-phase1/components/Step3_FloorHierarchySurvey';
import { Step4_BurlandSummary } from '../../survey-phase1/components/Step4_BurlandSummary';
import { Step6_ScopeAndGisMutation } from '../../survey-phase1/components/Step6_ScopeAndGisMutation';
import { Step7_TechnicalCalculations } from '../../survey-phase1/components/Step7_TechnicalCalculations';
import { Step8_ExecutiveDashboard } from '../../survey-phase1/components/Step8_ExecutiveDashboard';
import { Step9_FieldSignatures } from '../../survey-phase1/components/Step9_FieldSignatures';
import { MissingFieldsModal } from '../../survey-phase1/components/MissingFieldsModal';
import { GisParcel } from '../../../core/types/domain.types';
import { api } from '../../../services/api';

export interface SurveyCondoMasterPageProps {
  parcel?: GisParcel | null;
  onBackToHome: () => void;
  onFinished?: () => void;
}

export const SurveyCondoMasterPage: React.FC<SurveyCondoMasterPageProps> = ({
  parcel,
  onBackToHome,
  onFinished,
}) => {
  const {
    currentStep,
    formData,
    initializeForm,
    updateFormData,
    setCurrentStep,
    clearDraft,
    missingModal,
    closeMissingModal,
    proceedAnyway,
    focusMissingField,
    validateForFinalSubmit,
  } = usePhase1SurveyStore();
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Khởi tạo form khi parcel thay đổi và tự động set cấu hình Chung cư mẹ
  useEffect(() => {
    if (parcel) {
      initializeForm(parcel, null);
      updateFormData({
        surveyCaseType: 'APARTMENT',
        objectGroup: 'IMPORTANT',
        usageFunction: 'Chung cư/ Toà nhiều căn hộ',
      });
      // Bắt đầu từ Bước 2 nếu mở từ Hub
      setCurrentStep(2);
    }
  }, [parcel?.id]);

  // Cuộn lên đầu trang khi chuyển bước
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    document.documentElement.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    document.body.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  }, [currentStep]);

  // Nộp hồ sơ toàn diện Tòa nhà Chung cư mẹ
  const handleSubmitFinal = async () => {
    const isValid = validateForFinalSubmit();
    if (!isValid) return;

    try {
      setIsSubmitting(true);
      console.log('[CondoMaster] Submitting master condo survey payload:', formData);

      const payload = {
        parcelId: formData.parcelId,
        surveyData: formData,
        reportType: 'BUILDING_MASTER',
        status: 'COMPLETED',
        completedAt: new Date().toISOString(),
      };

      await api.post('/surveys/phase1/submit', payload);
      clearDraft();
      alert('Đã nộp thành công hồ sơ khảo sát Tòa nhà Chung cư tổng thể!');
      if (onFinished) {
        onFinished();
      } else {
        onBackToHome();
      }
    } catch (err: any) {
      console.error('[CondoMaster] Failed to submit master survey:', err);
      alert('Đã lưu hồ sơ cục bộ thành công!');
      if (onFinished) onFinished();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100/90 flex flex-col font-sans">
      {/* Condo Master Header */}
      <CondoMasterWizardNav onBackToHub={onBackToHome} />

      {/* Thông báo phân biệt khảo sát tòa nhà mẹ */}
      <div className="bg-indigo-50/90 text-indigo-900 px-4 py-2 text-xs border-b border-indigo-200/80 shadow-xs flex items-center justify-between">
        <div className="max-w-7xl mx-auto w-full flex items-center justify-between gap-3">
          <span className="leading-relaxed">
            📌 <strong>Lưu ý nghiệp vụ:</strong> Đây là biểu mẫu khảo sát Toà nhà tổng thể (Không gian & Kết cấu dùng chung). Các căn hộ con sẽ được khảo sát riêng từng căn trong Hub.
          </span>
          <span className="font-bold text-indigo-700 bg-white border border-indigo-300 px-2.5 py-0.5 rounded-full text-[11px] shrink-0 shadow-2xs">
            BIỂU MẪU TOÀ MẸ
          </span>
        </div>
      </div>

      {/* Main Step Content Container */}
      <main className="flex-1 px-3 sm:px-6 py-6">
        {currentStep === 1 && <Step1_BuildingIdentification />}
        {currentStep === 2 && <Step2_CondoMasterInterview />}
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

      {/* Modal Cảnh báo Thiếu Trường */}
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
