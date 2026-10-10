import { getErrorMessage, getErrorStatus, isNotFoundError } from '@/utils/errorUtils';
import React, { useEffect, useState } from 'react';
import { useCondoUnitSurveyStore } from '../store/useCondoUnitSurveyStore';
import { CondoUnitWizardNav } from '../components/CondoUnitWizardNav';
import { Step1_ParentInheritanceConfirmation } from '../components/Step1_ParentInheritanceConfirmation';
import { Step2_UnitSpecificInformation } from '../components/Step2_UnitSpecificInformation';
import { Step3_UnitDefectsAndSettlement } from '../components/Step3_UnitDefectsAndSettlement';
import { Step4_UnitSignatures } from '../components/Step4_UnitSignatures';
import type { GisParcel, BuildingUnit } from '../../../core/types/domain.types';
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
    formData,
    initializeForm,
    clearDraft,
    syncDraftToServer,
  } = useCondoUnitSurveyStore();
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (parcel) {
      initializeForm(parcel, unit);
      const unitStatus = unit?.status;
      if (unitStatus !== 'SUBMITTED' && unitStatus !== 'APPROVED') {
        setTimeout(() => {
          void syncDraftToServer();
        }, 100);
      }
    }
  }, [parcel?.id, unit?.id]);

  // Cuộn mượt lên đầu trang khi chuyển bước
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    document.documentElement.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    document.body.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  }, [currentStep]);

  // Chặn thao tác back trình duyệt ngoài ý muốn
  useEffect(() => {
    window.history.pushState({ condoUnitSessionActive: true }, '');

    const handlePopState = () => {
      const confirmLeave = window.confirm(
        'Bạn có chắc chắn muốn quay lại và tạm rời phiên khảo sát căn hộ? Dữ liệu đang nhập đã được lưu nháp an toàn.'
      );
      if (confirmLeave) {
        void syncDraftToServer();
        onBackToHome();
      } else {
        window.history.pushState({ condoUnitSessionActive: true }, '');
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [onBackToHome]);

  const handleSafeBackToHome = () => {
    const confirmLeave = window.confirm(
      'Bạn có chắc chắn muốn quay về danh sách căn hộ? Toàn bộ dữ liệu khảo sát đã được tự động lưu nháp an toàn.'
    );
    if (confirmLeave) {
      void syncDraftToServer();
      onBackToHome();
    }
  };

  const handleSubmitFinal = async () => {
    const confirmed = window.confirm(
      `Xác nhận nộp hồ sơ khảo sát căn hộ ${formData.unitCode || ''} (Tầng ${formData.floorNumber})?\n\nSau khi nộp, hồ sơ sẽ chuyển sang trạng thái "Chờ duyệt" từ Zone Admin.`
    );
    if (!confirmed) return;

    try {
      setIsSubmitting(true);
      console.log('[CondoUnit] Submitting child unit survey payload:', formData);

      const payload = {
        parcelId: formData.parcelId,
        unitId: formData.unitId,
        reportType: 'CONDO_UNIT',
        status: 'SUBMITTED',
        surveyData: formData,
        submittedAt: new Date().toISOString(),
      };

      const response = await api.post('/surveys/phase1/submit', payload);

      if (!response.data?.success) {
        throw new Error(response.data?.message || 'Server báo lỗi không xác định');
      }

      // Đánh dấu hoàn tất
      try {
        const completedUnitsKey = `metro2_condo_completed_units_${formData.parcelId}`;
        const existing = JSON.parse(localStorage.getItem(completedUnitsKey) || '[]');
        if (formData.unitId && !existing.includes(formData.unitId)) {
          existing.push(formData.unitId);
          localStorage.setItem(completedUnitsKey, JSON.stringify(existing));
        }
      } catch (_e) {}

      clearDraft();
      alert(`Đã nộp thành công hồ sơ khảo sát căn hộ ${formData.unitCode}!\n\nHồ sơ đang chờ duyệt từ Zone Admin.`);

      if (onFinished) {
        onFinished();
      } else {
        onBackToHome();
      }
    } catch (err: unknown) {
      console.error('[CondoUnit] Error submitting unit survey:', err);
      const statusCode = getErrorStatus(err);
      const serverMsg = getErrorMessage(err);
      alert(`❌ Nộp hồ sơ thất bại (${statusCode || 'Lỗi mạng'}): ${serverMsg || 'Vui lòng kiểm tra lại'}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100/90 flex flex-col font-sans">
      {/* Navbar chuẩn 4 bước */}
      <CondoUnitWizardNav onBackToHub={handleSafeBackToHome} />

      {/* Main Step Content Container */}
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
