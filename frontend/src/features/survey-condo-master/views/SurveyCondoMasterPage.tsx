import React, { useEffect, useState } from 'react';
import { usePhase1SurveyStore } from '../../survey-phase1/store/usePhase1SurveyStore';
import { CondoMasterWizardNav } from '../components/CondoMasterWizardNav';
import { Step1_BuildingIdentification } from '../../survey-phase1/components/Step1_BuildingIdentification';
import { Step2_OwnerInterview } from '../../survey-phase1/components/Step2_OwnerInterview';
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
        usageFunction: 'Chung cư / Toà nhiều căn hộ',
      });
      // Bắt đầu từ Bước 1 để người dùng confirm thông tin định danh
      setCurrentStep(1);
    }
  }, [parcel?.id]);

  // Cuộn lên đầu trang khi chuyển bước
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    document.documentElement.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    document.body.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  }, [currentStep]);

  // Nộp hồ sơ toàn diện Toà nhà Chung cư mẹ
  const handleSubmitFinal = async () => {
    const isValid = validateForFinalSubmit();
    if (!isValid) return;

    const confirmed = window.confirm(
      'Xác nhận nộp hồ sơ khảo sát Tòa nhà Chung cư tổng thể?\n\nSau khi nộp, hồ sơ sẽ chuyển sang trạng thái "Chờ duyệt" và không thể chỉnh sửa.'
    );
    if (!confirmed) return;

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

      const response = await api.post('/surveys/phase1/submit', payload);

      if (response.data?.success) {
        localStorage.setItem(`metro2_condo_master_submitted_${formData.parcelId}`, 'true');
        clearDraft();
        alert('Đã nộp thành công hồ sơ khảo sát Tòa nhà Chung cư tổng thể!\n\nHồ sơ đang chờ duyệt từ Zone Admin.');
        if (onFinished) {
          onFinished();
        } else {
          onBackToHome();
        }
      } else {
        throw new Error(response.data?.message || 'Server báo lỗi không xác định');
      }
    } catch (err: any) {
      console.error('[CondoMaster] Failed to submit master survey:', err);
      const statusCode = err?.response?.status;
      const serverMsg = err?.response?.data?.detail || err?.response?.data?.message || err?.message;

      if (statusCode === 500) {
        alert(
          `❌ Lỗi máy chủ (500) - Hồ sơ CHƯA ĐƯỢC nộp!\n\n${serverMsg || 'Internal Server Error'}\n\nVui lòng thử lại sau hoặc liên hệ kỹ thuật viên.\nDữ liệu đã được lưu nháp an toàn trên thiết bị.`
        );
      } else if (!statusCode) {
        alert(
          '❌ Lỗi kết nối mạng - Hồ sơ CHƯA ĐƯỢC nộp!\n\nKiểm tra kết nối internet và thử lại.\nDữ liệu đã được lưu nháp an toàn trên thiết bị.'
        );
      } else {
        alert(
          `❌ Nộp hồ sơ thất bại (${statusCode}) - Hồ sơ CHƯA ĐƯỢC nộp!\n\n${serverMsg || 'Lỗi không xác định'}\n\nVui lòng thử lại.`
        );
      }
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
        {currentStep === 1 && <Step1_BuildingIdentification isCondoMaster={true} />}
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
