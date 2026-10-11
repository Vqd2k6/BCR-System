import { getErrorMessage, getErrorStatus, isNotFoundError } from '@/utils/errorUtils';
import React, { useEffect, useState } from 'react';
import { useCondoUnitSurveyStore } from '../store/useCondoUnitSurveyStore';
import { CondoUnitWizardNav } from '../components/CondoUnitWizardNav';
import { Step1_ParentInheritanceConfirmation } from '../components/Step1_ParentInheritanceConfirmation';
import { Step2_UnitSpecificInformation } from '../components/Step2_UnitSpecificInformation';
import { Step3_UnitDefectsAndSettlement } from '../components/Step3_UnitDefectsAndSettlement';
import { Step4_UnitSignatures } from '../components/Step4_UnitSignatures';
import { CondoUnitMissingFieldsModal } from '../components/CondoUnitMissingFieldsModal';
import { validateCondoUnitFull, type CondoUnitValidationIssue } from '../utils/condoUnitValidator';
import type { GisParcel, BuildingUnit } from '../../../core/types/domain.types';
import { api } from '../../../services/api';
import { sanitizeSurveyDataForSync } from '../../../core/services/uploadQueueService';
import { ActiveSurveyorLockedModal } from '../../survey-phase1/components/ActiveSurveyorLockedModal';
import { HandoverTakeoverModal } from '../../survey-phase1/components/HandoverTakeoverModal';

export interface SurveyCondoUnitPageProps {
  parcel?: GisParcel | null;
  unit?: BuildingUnit | null;
  readOnly?: boolean;
  onBackToHome: () => void;
  onFinished?: () => void;
}

export const SurveyCondoUnitPage: React.FC<SurveyCondoUnitPageProps> = ({
  parcel,
  unit,
  readOnly = false,
  onBackToHome,
  onFinished,
}) => {
  const {
    currentStep,
    setStep,
    formData,
    initializeForm,
    clearDraft,
    syncDraftToServer,
    isLockedByOther,
    lockedInfo,
    closeLockedModal,
    isHandoverModalOpen,
    handoverInfo,
    closeHandoverModal,
    takeoverDraft,
    checkDraftLock,
    setIsReadOnly,
  } = useCondoUnitSurveyStore();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [missingModalState, setMissingModalState] = useState<{
    isOpen: boolean;
    blockingIssues: CondoUnitValidationIssue[];
    warnings: CondoUnitValidationIssue[];
  }>({
    isOpen: false,
    blockingIssues: [],
    warnings: [],
  });
  const lastInitializedKeyRef = React.useRef<string>('');

  const unitStatus = unit?.status || formData?.status;
  const isSubmittedOrApproved = unitStatus === 'SUBMITTED' || unitStatus === 'APPROVED';
  const effectiveReadOnly = Boolean(readOnly || isSubmittedOrApproved);

  useEffect(() => {
    if (parcel) {
      const currentKey = `${parcel.id}_${unit?.id || 'none'}`;
      if (lastInitializedKeyRef.current !== currentKey) {
        lastInitializedKeyRef.current = currentKey;
        initializeForm(parcel, unit);
      }
    }
  }, [parcel?.id, unit?.id, initializeForm]);

  useEffect(() => {
    setIsReadOnly(effectiveReadOnly);
    return () => setIsReadOnly(false);
  }, [effectiveReadOnly, setIsReadOnly]);

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
      if (effectiveReadOnly) {
        onBackToHome();
        return;
      }
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
  }, [effectiveReadOnly, onBackToHome, syncDraftToServer]);

  const handleSafeBackToHome = () => {
    if (effectiveReadOnly) {
      onBackToHome();
      return;
    }
    const confirmLeave = window.confirm(
      'Bạn có chắc chắn muốn quay về danh sách căn hộ? Toàn bộ dữ liệu khảo sát đã được tự động lưu nháp an toàn.'
    );
    if (confirmLeave) {
      void syncDraftToServer();
      onBackToHome();
    }
  };

  const handleGoToStep = (step: 1 | 2 | 3 | 4, fieldId?: string) => {
    setStep(step);
    if (fieldId) {
      setTimeout(() => {
        const el = document.getElementById(fieldId);
        if (el) {
          el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }, 150);
    }
  };

  const executeSubmit = async () => {
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
        surveyData: sanitizeSurveyDataForSync(formData),
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

  const handleSubmitFinal = () => {
    // Chạy kiểm tra qua Cổng Thẩm Định Toàn Diện của Căn Hộ Con
    const { isValid, blockingIssues, warnings } = validateCondoUnitFull(formData);

    if (!isValid || warnings.length > 0) {
      setMissingModalState({
        isOpen: true,
        blockingIssues,
        warnings,
      });
      return;
    }

    void executeSubmit();
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

      {/* Modal Cảnh báo & Chỉ dẫn Bổ sung Dữ liệu Căn Hộ Con */}
      <CondoUnitMissingFieldsModal
        isOpen={missingModalState.isOpen}
        blockingIssues={missingModalState.blockingIssues}
        warnings={missingModalState.warnings}
        onClose={() => setMissingModalState((prev) => ({ ...prev, isOpen: false }))}
        onProceedAnyway={() => {
          setMissingModalState((prev) => ({ ...prev, isOpen: false }));
          void executeSubmit();
        }}
        onGoToStep={handleGoToStep}
      />

      {/* Modal Bàn Giao Ca / Tiếp Quản Hồ Sơ Nháp Căn Hộ Con */}
      <HandoverTakeoverModal
        isOpen={isHandoverModalOpen}
        handoverInfo={handoverInfo}
        onTakeover={takeoverDraft}
        onCancel={() => {
          closeHandoverModal();
          onBackToHome();
        }}
      />

      {/* Modal Cảnh Báo Khóa Phiên Khảo Sát Căn Hộ Con */}
      <ActiveSurveyorLockedModal
        isOpen={isLockedByOther}
        lockedInfo={lockedInfo}
        onClose={() => {
          closeLockedModal();
          onBackToHome();
        }}
        onRecheck={checkDraftLock}
      />
    </div>
  );
};
