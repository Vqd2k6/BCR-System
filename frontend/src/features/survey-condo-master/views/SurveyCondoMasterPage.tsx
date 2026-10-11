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
import { useAdminViewLock } from '../../../core/hooks/useAdminViewLock';
import { ShieldAlert, RotateCcw, Unlock } from 'lucide-react';

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
    loadReportData,
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
    markServerHydrated,
  } = usePhase1SurveyStore();
  const { isAdmin: isZoneAdmin, isViewOnlyForAdmin, unlockEdit, lockEdit } = useAdminViewLock();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [serverReport, setServerReport] = useState<ServerPhase1ReportResponse['report'] | null>(null);
  const [isReverting, setIsReverting] = useState(false);
  const [localStatusOverride, setLocalStatusOverride] = useState<string | null>(null);

  // Xác định trạng thái đã nộp:
  // Nếu có localStatusOverride -> Ưu tiên localStatusOverride
  // Nếu đã nạp serverReport -> Ưu tiên trạng thái của serverReport (DRAFT thì cho phép sửa tiếp)
  // Nếu chưa nạp serverReport -> Fallback trạng thái từ parcel
  const currentStatus = localStatusOverride || (serverReport ? serverReport.status : null);
  const isSubmittedOrApproved = currentStatus
    ? (currentStatus === 'SUBMITTED' || currentStatus === 'APPROVED')
    : Boolean(
        parcel?.surveyStatus === 'SUBMITTED' ||
        parcel?.surveyStatus === 'APPROVED' ||
        (parcel as unknown as { survey_status?: string })?.survey_status === 'SUBMITTED' ||
        (parcel as unknown as { survey_status?: string })?.survey_status === 'APPROVED'
      );

  // Triple-lock readOnly: Đã nộp/phê duyệt -> MỌI VAI TRÒ (kể cả Admin) đều CHỈ ĐỌC, không đồng bộ.
  // Admin mở biểu mẫu đang làm dở cũng mặc định CHỈ XEM cho tới khi chủ động "Mở khóa chỉnh sửa".
  const effectiveReadOnly = Boolean(readOnly || isSubmittedOrApproved || isViewOnlyForAdmin);
  const parcelStatusSubmitted = Boolean(
    parcel?.surveyStatus === 'SUBMITTED' ||
    parcel?.surveyStatus === 'APPROVED' ||
    (parcel as unknown as { survey_status?: string })?.survey_status === 'SUBMITTED' ||
    (parcel as unknown as { survey_status?: string })?.survey_status === 'APPROVED'
  );

  // Khởi tạo form và Hydrate 100% dữ liệu đã nộp từ DB qua API
  useEffect(() => {
    if (parcel) {
      initializeForm(parcel, null, { readOnly: effectiveReadOnly });
      const cadastralCode =
        parcel.officialCadastralCode ||
        parcel.official_cadastral_code ||
        (parcel as unknown as { cadastralCode?: string; cadastral_code?: string }).cadastralCode ||
        (parcel as unknown as { cadastralCode?: string; cadastral_code?: string }).cadastral_code ||
        '';
      
      const initialMasterDefaults = {
        surveyCaseType: 'APARTMENT' as const,
        objectGroup: 'IMPORTANT' as const,
        usageFunction: 'Chung cư / Toà nhiều căn hộ',
        officialCadastralCode: cadastralCode,
      };

      if (!effectiveReadOnly) {
        updateFormData(initialMasterDefaults);
      } else {
        loadReportData(initialMasterDefaults);
      }

      // Bắt đầu từ Bước 1 để người dùng confirm thông tin định danh
      setCurrentStep(1);

      // Nạp hồ sơ Tòa Mẹ thực tế từ Backend (Khép kín DB -> BE -> FE, ưu tiên draft nếu không ở chế độ chỉ đọc)
      // Chỉ ưu tiên nạp bản nháp khi hồ sơ CHƯA nộp (kể cả admin đang xem chế độ chỉ đọc) để hiển thị đúng dữ liệu nháp mới nhất
      const fetchUrl = `/parcels/${parcel.id}/phase1-report?reportType=BUILDING_MASTER${!readOnly && !parcelStatusSubmitted ? '&preferDraft=true' : ''}`;
      api.get<{ data?: ServerPhase1ReportResponse; report?: ServerPhase1ReportResponse['report'] }>(fetchUrl)
        .then((res) => {
          const resData = res?.data?.data || res?.data;
          const rep = resData?.report;
          if (rep) {
            setServerReport(rep);
            const updates: Record<string, unknown> = {};

            if (rep.survey_data_json) {
              try {
                const rawJson =
                  typeof rep.survey_data_json === 'string'
                    ? JSON.parse(rep.survey_data_json)
                    : rep.survey_data_json;
                if (rawJson && typeof rawJson === 'object') {
                  Object.assign(updates, rawJson);
                }
              } catch (jsonErr: unknown) {
                console.warn('[SurveyCondoMasterPage] Lỗi parse survey_data_json:', jsonErr);
              }
            }

            // Fallback trích xuất bổ sung nếu thiếu trong JSON
            if (rep.buildingSpecs && typeof rep.buildingSpecs === 'object') {
              const s = rep.buildingSpecs as Record<string, unknown>;
              if (s.building_name && !updates.buildingName) updates.buildingName = String(s.building_name);
              if (s.floor_count !== undefined && updates.aboveFloors === undefined) updates.aboveFloors = Number(s.floor_count);
              if (s.basement_count !== undefined && updates.undergroundFloors === undefined) updates.undergroundFloors = Number(s.basement_count);
              if (s.foundation_category && !updates.foundationType) updates.foundationType = String(s.foundation_category);
              if (s.structural_system && !updates.structureSystem) updates.structureSystem = String(s.structural_system);
              if (s.construction_area_m2 && !updates.constructionAreaM2) updates.constructionAreaM2 = Number(s.construction_area_m2);
              if (s.building_height_m && !updates.buildingHeightM) updates.buildingHeightM = Number(s.building_height_m);
            }

            // Bảo toàn ảnh định danh P01 - P04 từ bảng survey_identification_photos
            if (rep.identificationPhotos && Array.isArray(rep.identificationPhotos) && rep.identificationPhotos.length > 0) {
              (rep.identificationPhotos as Array<Record<string, unknown>>).forEach((p) => {
                const rawUrl = String(p.raw_photo_url || '');
                const isNotApp = Boolean(p.is_not_applicable);

                if (p.photo_type === 'P01_HOUSE_NUMBER') {
                  const cur = updates.photoP01 as { url?: string } | undefined;
                  if (!cur?.url && rawUrl) {
                    updates.photoP01 = { url: rawUrl, notApplicable: isNotApp };
                  }
                } else if (p.photo_type === 'P02_MAIN_FACADE') {
                  const cur = updates.photoP02 as { url?: string; polygonPoints?: unknown[]; floorSplits?: unknown[]; widthM?: string; heightM?: string } | undefined;
                  if (!cur?.url && rawUrl) {
                    updates.photoP02 = {
                      url: rawUrl,
                      notApplicable: isNotApp,
                      polygonPoints: (p.facade_polygon_points_json as { x: number; y: number }[]) || cur?.polygonPoints || [],
                      floorSplits: p.floor_split_lines_json || cur?.floorSplits || [],
                      widthM: cur?.widthM || '',
                      heightM: cur?.heightM || '',
                    };
                  }
                } else if (p.photo_type === 'P03_SIDE_OR_REAR') {
                  const cur = updates.photoP03 as { url?: string; tag?: string } | undefined;
                  if (!cur?.url && rawUrl) {
                    const dim = p.dimensions_json as { tag?: string } | undefined;
                    updates.photoP03 = {
                      url: rawUrl,
                      notApplicable: isNotApp,
                      tag: dim?.tag || cur?.tag || 'Bên hông trái',
                    };
                  }
                } else if (p.photo_type === 'P04_CONTEXT_STREET') {
                  const cur = updates.photoP04 as { url?: string } | undefined;
                  if (!cur?.url && rawUrl) {
                    updates.photoP04 = { url: rawUrl, notApplicable: isNotApp };
                  }
                }
              });
            }

            if (Object.keys(updates).length > 0) {
              loadReportData(updates);
              console.log('[SurveyCondoMasterPage] Khôi phục 100% dữ liệu khảo sát Tòa Mẹ từ DB via loadReportData');
            }
          }
        })
        .catch((err: unknown) => {
          console.warn('[SurveyCondoMasterPage] Không thể nạp hồ sơ khảo sát toà mẹ từ máy chủ:', err);
        });
    }
  }, [parcel?.id, effectiveReadOnly, readOnly]);

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
      alert('Biểu mẫu đang ở chế độ chỉ xem (đã nộp hoặc chưa mở khóa chỉnh sửa). Không thể sửa hoặc nộp lại.');
      return;
    }

    const isValid = validateForFinalSubmit();
    if (!isValid) return;

    const confirmMessage =
      'Xác nhận nộp hồ sơ khảo sát Tòa nhà Chung cư tổng thể?\n\nSau khi nộp, hồ sơ sẽ chuyển sang trạng thái "Chờ duyệt" và không thể chỉnh sửa.';

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
        alert('Đã nộp thành công hồ sơ khảo sát Tòa nhà Chung cư tổng thể!\n\nHồ sơ đang chờ duyệt từ Zone Admin.');
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

  const handleRevertToDraft = async () => {
    if (!parcel?.id) return;
    const confirmRevert = window.confirm(
      `Xác nhận chuyển trạng thái hồ sơ Tòa nhà [${parcel.projectParcelCode || parcel.officialCadastralCode || parcel.id}] về "Đang làm dở"?\n\nSau khi chuyển, khảo sát viên hoặc admin có thể chỉnh sửa thông tin và nộp lại.`
    );
    if (!confirmRevert) return;

    try {
      setIsReverting(true);
      const res = await api.post(`/admin/reports/${parcel.id}/revert-to-draft`, {});
      if (!res.data?.success) {
        throw new Error(res.data?.message || 'Server không phản hồi');
      }

      setLocalStatusOverride('IN_PROGRESS');
      if (serverReport) {
        setServerReport({ ...serverReport, status: 'DRAFT' });
      }
      if (parcel) {
        parcel.surveyStatus = 'IN_PROGRESS';
      }
      // Báo cáo thật vừa được mở lại -> admin trở thành chủ phiên, cho phép sửa và đồng bộ trở lại
      unlockEdit();
      setIsReadOnly(false);
      markServerHydrated();

      alert(`✅ Đã chuyển hồ sơ Tòa nhà về trạng thái "Đang làm dở" thành công! Biểu mẫu đã được mở để chỉnh sửa.`);
    } catch (err: unknown) {
      console.error('[SurveyCondoMasterPage] Revert error:', err);
      alert(`❌ Lỗi khi chuyển trạng thái: ${getErrorMessage(err)}`);
    } finally {
      setIsReverting(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100/90 flex flex-col font-sans">
      {/* Condo Master Header */}
      <CondoMasterWizardNav onBackToHub={handleSafeBackToHome} />

      {/* Banner 1: Chế độ Xem Lại (Read-Only) - đã nộp hoặc admin chưa mở khóa chỉnh sửa */}
      {effectiveReadOnly && (
        <div className="bg-amber-50 border-b border-amber-200 px-4 py-2.5 text-xs text-amber-900 shadow-xs">
          <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3">
            <span className="flex items-center gap-2">
              <ShieldAlert size={16} className="text-amber-600 shrink-0" />
              <span>
                <strong>Chế độ Xem Lại (Chỉ Đọc · Không đồng bộ):</strong>{' '}
                {isSubmittedOrApproved
                  ? `Hồ sơ khảo sát Tòa nhà tổng thể đã được nộp. ${isZoneAdmin ? 'Admin có thể mở lại để chỉnh sửa thông tin.' : 'Chỉ có Zone Admin mới được điều chỉnh.'}`
                  : 'Biểu mẫu đang ở chế độ chỉ xem, dữ liệu sẽ không bị thay đổi hay đồng bộ. Bấm "Mở khóa chỉnh sửa" nếu muốn sửa.'}
              </span>
            </span>
            <div className="flex items-center gap-2">
              {isZoneAdmin && isSubmittedOrApproved && (
                <button
                  type="button"
                  disabled={isReverting}
                  onClick={handleRevertToDraft}
                  className="bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold px-3 py-1.5 rounded-lg flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer disabled:opacity-50"
                  title="Chuyển trạng thái về 'Đang làm dở' để chỉnh sửa thông tin"
                >
                  <RotateCcw size={14} className={isReverting ? 'animate-spin' : ''} />
                  <span>{isReverting ? 'Đang chuyển...' : 'Chuyển về "Đang làm dở" để sửa'}</span>
                </button>
              )}
              {isZoneAdmin && !isSubmittedOrApproved && isViewOnlyForAdmin && (
                <button
                  type="button"
                  onClick={unlockEdit}
                  className="bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold px-3 py-1.5 rounded-lg flex items-center gap-1.5 shadow-xs transition-colors cursor-pointer"
                  title="Mở khóa chỉnh sửa biểu mẫu (kiểm tra khóa ca / tiếp quản)"
                >
                  <Unlock size={14} />
                  <span>Mở khóa chỉnh sửa</span>
                </button>
              )}
              <span className="font-bold text-amber-800 bg-amber-100 border border-amber-300 px-2.5 py-0.5 rounded-full text-[11px] shrink-0">
                READ-ONLY
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Thông báo phân biệt khảo sát tòa nhà mẹ - CHỈ HIỂN THỊ DUY NHẤT Ở BƯỚC 1 KHI CHƯA CÓ BANNER READ-ONLY */}
      {currentStep === 1 && !effectiveReadOnly && (
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
          if (isZoneAdmin) {
            lockEdit();
          } else {
            onBackToHome();
          }
        }}
      />

      {/* Modal Cảnh Báo Khóa Phiên Khảo Sát Tòa Nhà */}
      <ActiveSurveyorLockedModal
        isOpen={isLockedByOther}
        lockedInfo={lockedInfo}
        onClose={() => {
          closeLockedModal();
          if (isZoneAdmin) {
            lockEdit();
          } else {
            onBackToHome();
          }
        }}
      />
    </div>
  );
};
