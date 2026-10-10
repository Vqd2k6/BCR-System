import { getErrorMessage, getErrorStatus } from '@/utils/errorUtils';
import React, { useEffect, useState } from 'react';
import { usePhase1SurveyStore } from '../../survey-phase1/store/usePhase1SurveyStore';
import { CondoMasterWizardNav } from '../components/CondoMasterWizardNav';
import { Step1_BuildingIdentification } from '../../survey-phase1/components/Step1_BuildingIdentification';
import { Step2_CondoMasterScaleAndCat } from '../components/Step2_CondoMasterScaleAndCat';
import { Step3_CondoMasterHistoryAndManagement } from '../components/Step3_CondoMasterHistoryAndManagement';
import { Step6_ScopeAndGisMutation } from '../../survey-phase1/components/Step6_ScopeAndGisMutation';
import { Step9_FieldSignatures } from '../../survey-phase1/components/Step9_FieldSignatures';
import { MissingFieldsModal } from '../../survey-phase1/components/MissingFieldsModal';
import { HandoverTakeoverModal } from '../../survey-phase1/components/HandoverTakeoverModal';
import { ActiveSurveyorLockedModal } from '../../survey-phase1/components/ActiveSurveyorLockedModal';
import type { GisParcel } from '../../../core/types/domain.types';
import { api } from '../../../services/api';
import { useAuth } from '../../../context/AuthContext';
import { ShieldAlert, ShieldCheck } from 'lucide-react';

export interface SurveyCondoMasterPageProps {
  parcel?: GisParcel | null;
  readOnly?: boolean;
  onBackToHome: () => void;
  onFinished?: () => void;
}

interface ServerPhase1ReportResponse {
  report?: {
    id?: string;
    status?: string;
    survey_data_json?: string | Record<string, unknown>;
    export_revision?: number;
    [key: string]: unknown;
  };
}

export const SurveyCondoMasterPage: React.FC<SurveyCondoMasterPageProps> = ({
  parcel,
  readOnly = false,
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
    setIsReadOnly,
    isLockedByOther,
    lockedInfo,
    closeLockedModal,
    isHandoverModalOpen,
    handoverInfo,
    closeHandoverModal,
    takeoverDraft,
  } = usePhase1SurveyStore();
  const { user } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [serverReport, setServerReport] = useState<ServerPhase1ReportResponse['report'] | null>(null);

  // Xác định trạng thái đã nộp
  const isSubmittedOrApproved =
    parcel?.surveyStatus === 'SUBMITTED' ||
    parcel?.surveyStatus === 'APPROVED' ||
    (parcel as unknown as { survey_status?: string })?.survey_status === 'SUBMITTED' ||
    (parcel as unknown as { survey_status?: string })?.survey_status === 'APPROVED' ||
    serverReport?.status === 'SUBMITTED' ||
    serverReport?.status === 'APPROVED';

  const isSurveyor = user?.role === 'SURVEYOR';
  const isZoneAdmin = user?.role === 'ZONE_ADMIN' || user?.role === 'SUPER_ADMIN';

  // Triple-lock readOnly: Nếu đã nộp, Surveyor bắt buộc CHỈ ĐƯỢC XEM LẠI. Chỉ Zone Admin mới được điều chỉnh.
  const effectiveReadOnly = Boolean(readOnly || (isSubmittedOrApproved && isSurveyor));
  const isZoneAdminAdjusting = Boolean(isSubmittedOrApproved && isZoneAdmin);

  // Khởi tạo form và Hydrate 100% dữ liệu đã nộp từ DB qua API
  useEffect(() => {
    if (parcel) {
      initializeForm(parcel, null);
      const cadastralCode =
        parcel.officialCadastralCode ||
        parcel.official_cadastral_code ||
        (parcel as unknown as { cadastralCode?: string; cadastral_code?: string }).cadastralCode ||
        (parcel as unknown as { cadastralCode?: string; cadastral_code?: string }).cadastral_code ||
        '';
      updateFormData({
        surveyCaseType: 'APARTMENT',
        objectGroup: 'IMPORTANT',
        usageFunction: 'Chung cư / Toà nhiều căn hộ',
        officialCadastralCode: cadastralCode,
      });
      // Bắt đầu từ Bước 1 để người dùng confirm thông tin định danh
      setCurrentStep(1);

      // Nạp hồ sơ Tòa Mẹ thực tế từ Backend (Khép kín DB -> BE -> FE)
      api.get<{ data?: ServerPhase1ReportResponse; report?: ServerPhase1ReportResponse['report'] }>(
        `/parcels/${parcel.id}/phase1-report?reportType=BUILDING_MASTER`
      )
        .then((res) => {
          const resData = res?.data?.data || res?.data;
          const rep = resData?.report;
          if (rep) {
            setServerReport(rep);
            if (rep.survey_data_json) {
              try {
                const rawJson =
                  typeof rep.survey_data_json === 'string'
                    ? JSON.parse(rep.survey_data_json)
                    : rep.survey_data_json;
                if (rawJson && typeof rawJson === 'object') {
                  updateFormData(rawJson);
                  console.log('[SurveyCondoMasterPage] Khôi phục 100% dữ liệu khảo sát Tòa Mẹ từ DB');
                }
              } catch (jsonErr) {
                console.warn('[SurveyCondoMasterPage] Lỗi parse survey_data_json:', jsonErr);
              }
            }
          }
        })
        .catch((err) => {
          console.warn('[SurveyCondoMasterPage] Không thể nạp hồ sơ khảo sát toà mẹ từ máy chủ:', err);
        });
    }
  }, [parcel?.id]);

  // Đồng bộ effectiveReadOnly vào Zustand store
  useEffect(() => {
    setIsReadOnly(effectiveReadOnly);
    return () => setIsReadOnly(false);
  }, [effectiveReadOnly]);

  // Định kỳ 2 phút tự động đồng bộ bản nháp lên máy chủ nếu có thay đổi và KHÔNG ở chế độ Read-Only
  useEffect(() => {
    if (effectiveReadOnly) return;
    const interval = setInterval(() => {
      const state = usePhase1SurveyStore.getState();
      if (state.isDirty && !state.isReadOnly) {
        console.log('[SurveyCondoMasterPage] Periodic 2-min auto-sync triggered...');
        state.syncDraftToServer();
      }
    }, 120_000);

    const handleBeforeUnloadSync = () => {
      const state = usePhase1SurveyStore.getState();
      if (state.isDirty && !state.isReadOnly) {
        state.syncDraftToServer();
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnloadSync);

    return () => {
      clearInterval(interval);
      window.removeEventListener('beforeunload', handleBeforeUnloadSync);
    };
  }, [effectiveReadOnly]);

  const handleSafeBackToHome = () => {
    const state = usePhase1SurveyStore.getState();
    if (state.isDirty && !effectiveReadOnly) {
      state.syncDraftToServer();
    }
    onBackToHome();
  };

  // Cuộn lên đầu trang khi chuyển bước
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    document.documentElement.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    document.body.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  }, [currentStep]);

  // Nộp hoặc cập nhật điều chỉnh hồ sơ toàn diện Toà nhà Chung cư mẹ
  const handleSubmitFinal = async () => {
    if (effectiveReadOnly) {
      alert('Hồ sơ đã nộp và ở chế độ chỉ xem. Kỹ sư khảo sát không có quyền chỉnh sửa hoặc nộp lại.');
      return;
    }

    const isValid = validateForFinalSubmit();
    if (!isValid) return;

    const confirmMessage = isZoneAdminAdjusting
      ? 'Xác nhận cập nhật điều chỉnh hồ sơ khảo sát Tòa nhà Chung cư tổng thể (Quyền Zone Admin)?\n\nCác sửa đổi sẽ được cập nhật trực tiếp vào hồ sơ hiện hành và tăng số hiệu phiên bản (Revision).'
      : 'Xác nhận nộp hồ sơ khảo sát Tòa nhà Chung cư tổng thể?\n\nSau khi nộp, hồ sơ sẽ chuyển sang trạng thái "Chờ duyệt" và không thể chỉnh sửa.';

    const confirmed = window.confirm(confirmMessage);
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
        if (isZoneAdminAdjusting) {
          alert('Zone Admin đã cập nhật điều chỉnh hồ sơ Tòa nhà thành công!');
        } else {
          alert('Đã nộp thành công hồ sơ khảo sát Tòa nhà Chung cư tổng thể!\n\nHồ sơ đang chờ duyệt từ Zone Admin.');
        }
        if (onFinished) {
          onFinished();
        } else {
          onBackToHome();
        }
      } else {
        throw new Error(response.data?.message || 'Server báo lỗi không xác định');
      }
    } catch (err: unknown) {
      console.error('[CondoMaster] Failed to submit master survey:', err);
      const statusCode = getErrorStatus(err);
      const serverMsg = getErrorMessage(err);

      if (statusCode === 403) {
        alert(`⛔ Quyền bị từ chối (403):\n\n${serverMsg || 'Hồ sơ đã nộp. Kỹ sư khảo sát chỉ có quyền xem lại, chỉ có Zone Admin mới được điều chỉnh.'}`);
      } else if (statusCode === 500) {
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
      <CondoMasterWizardNav onBackToHub={handleSafeBackToHome} />

      {/* Banner 1: Chế độ Xem Lại (Read-Only) của Kỹ sư khảo sát */}
      {effectiveReadOnly && (
        <div className="bg-amber-50 border-b border-amber-200 px-4 py-2.5 text-xs text-amber-900 shadow-xs">
          <div className="max-w-7xl mx-auto flex items-center justify-between gap-3">
            <span className="flex items-center gap-2">
              <ShieldAlert size={16} className="text-amber-600 shrink-0" />
              <span>
                <strong>Chế độ Xem Lại (Chỉ Đọc):</strong> Hồ sơ khảo sát Tòa nhà tổng thể đã được nộp. Kỹ sư khảo sát chỉ có quyền xem lại, chỉ có Zone Admin mới được điều chỉnh.
              </span>
            </span>
            <span className="font-bold text-amber-800 bg-amber-100 border border-amber-300 px-2.5 py-0.5 rounded-full text-[11px] shrink-0">
              READ-ONLY
            </span>
          </div>
        </div>
      )}

      {/* Banner 2: Chế độ Quản trị viên (Zone Admin) Điều chỉnh hồ sơ đã nộp */}
      {isZoneAdminAdjusting && (
        <div className="bg-indigo-50 border-b border-indigo-200 px-4 py-2.5 text-xs text-indigo-900 shadow-xs">
          <div className="max-w-7xl mx-auto flex items-center justify-between gap-3">
            <span className="flex items-center gap-2">
              <ShieldCheck size={16} className="text-indigo-600 shrink-0" />
              <span>
                <strong>Chế độ Quản trị viên (Zone Admin):</strong> Bạn đang điều chỉnh hồ sơ Tòa nhà đã nộp. Các cập nhật sẽ được ghi đè trực tiếp và tăng số hiệu phiên bản xuất báo cáo (Revision).
              </span>
            </span>
            <span className="font-bold text-indigo-800 bg-indigo-100 border border-indigo-300 px-2.5 py-0.5 rounded-full text-[11px] shrink-0">
              ADMIN EDIT MODE
            </span>
          </div>
        </div>
      )}

      {/* Thông báo phân biệt khảo sát tòa nhà mẹ - CHỈ HIỂN THỊ DUY NHẤT Ở BƯỚC 1 KHI CHƯA CÓ BANNER READ-ONLY */}
      {currentStep === 1 && !effectiveReadOnly && !isZoneAdminAdjusting && (
        <div className="bg-sky-50/90 text-sky-900 px-4 py-2 text-xs border-b border-sky-200/80 shadow-xs flex items-center justify-between">
          <div className="max-w-7xl mx-auto w-full flex items-center justify-between gap-3">
            <span className="leading-relaxed">
              📌 <strong>Lưu ý nghiệp vụ:</strong> Đây là biểu mẫu khảo sát Toà nhà tổng thể (Không gian & Kết cấu dùng chung). Các căn hộ con sẽ được khảo sát riêng từng căn trong Hub.
            </span>
            <span className="font-bold text-sky-700 bg-white border border-sky-300 px-2.5 py-0.5 rounded-full text-[11px] shrink-0 shadow-2xs">
              BIỂU MẪU TOÀ MẸ
            </span>
          </div>
        </div>
      )}

      {/* Main Step Content Container */}
      <main className="flex-1 px-3 sm:px-6 py-6">
        {currentStep === 1 && <Step1_BuildingIdentification isCondoMaster={true} />}
        {currentStep === 2 && <Step2_CondoMasterScaleAndCat />}
        {currentStep === 3 && <Step3_CondoMasterHistoryAndManagement />}
        {currentStep === 4 && <Step6_ScopeAndGisMutation />}
        {currentStep === 5 && (
          <Step9_FieldSignatures
            onSubmitFinal={handleSubmitFinal}
            isSubmitting={isSubmitting}
            readOnly={effectiveReadOnly}
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

      {/* Modal Bàn Giao Ca / Tiếp Quản Hồ Sơ Nháp Tòa Nhà */}
      <HandoverTakeoverModal
        isOpen={isHandoverModalOpen}
        handoverInfo={handoverInfo}
        onTakeover={takeoverDraft}
        onCancel={() => {
          closeHandoverModal();
          onBackToHome();
        }}
      />

      {/* Modal Cảnh Báo Khóa Phiên Khảo Sát Tòa Nhà */}
      <ActiveSurveyorLockedModal
        isOpen={isLockedByOther}
        lockedInfo={lockedInfo}
        onClose={() => {
          closeLockedModal();
          onBackToHome();
        }}
      />
    </div>
  );
};
