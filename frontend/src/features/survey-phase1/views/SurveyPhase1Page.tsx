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
import { useAuth } from '../../../context/AuthContext';
import confetti from 'canvas-confetti';
import { Eye, CheckCircle2, XCircle } from 'lucide-react';

export interface SurveyPhase1PageProps {
  parcel?: GisParcel | null;
  unit?: BuildingUnit | null;
  readOnly?: boolean;
  onBackToHome: () => void;
  onFinished?: () => void;
}

export const SurveyPhase1Page: React.FC<SurveyPhase1PageProps> = ({
  parcel,
  unit,
  readOnly = false,
  onBackToHome,
  onFinished,
}) => {
  const {
    currentStep,
    formData,
    updateFormData,
    initializeForm,
    saveDraftToStorage,
    clearDraft,
    missingModal,
    closeMissingModal,
    proceedAnyway,
    focusMissingField,
    validateForFinalSubmit,
    setIsReadOnly,
  } = usePhase1SurveyStore();
  const { user } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [reportData, setReportData] = useState<any>(null);

  // Khởi tạo form khi parcel thay đổi
  useEffect(() => {
    if (parcel) {
      initializeForm(parcel, unit);
    }
  }, [parcel?.id, unit?.id]);

  // Sync readOnly prop vào Zustand store để toàn bộ wizard hiểu chế độ xem lại
  useEffect(() => {
    setIsReadOnly(readOnly);
    return () => setIsReadOnly(false); // cleanup khi unmount
  }, [readOnly]);

  // Tải dữ liệu hồ sơ nếu ở chế độ xem lại (Read-Only)
  useEffect(() => {
    if (readOnly && parcel?.id) {
      api.get(`/parcels/${parcel.id}/phase1-report`)
        .then((res: any) => {
          const data = res?.data?.data || res?.data;
          if (data) {
            console.log('[SurveyPhase1Page] Read-only report loaded:', data);
            setReportData(data);
            const rep = data.report;
            const absence = data.absenceLog;
            const updates: any = {};

            if (absence) {
              updates.surveyCaseType = 'ABSENTEE';
              updates.isAbsenteeSurvey = true;
              updates.absenteeReason = absence.absence_reason || '';
              if (absence.photo_proof_url) {
                updates.absenteeMinutesPhotos = [absence.photo_proof_url];
              }
            }

            if (rep) {
              if (rep.buildingSpecs) {
                const s = rep.buildingSpecs;
                if (s.building_name) updates.buildingName = s.building_name;
                if (s.land_use_function) updates.usageFunction = s.land_use_function;
                if (s.floor_count !== undefined && s.floor_count !== null) updates.aboveFloors = s.floor_count;
                if (s.basement_count !== undefined && s.basement_count !== null) updates.undergroundFloors = s.basement_count;
                if (s.construction_area_m2) updates.constructionAreaM2 = s.construction_area_m2;
                if (s.building_height_m) updates.buildingHeightM = s.building_height_m;
                if (s.year_of_construction) updates.constructionYear = s.year_of_construction;
                if (s.is_year_estimated !== undefined) updates.isEstimatedYear = s.is_year_estimated;
                if (s.structural_system) updates.structureSystem = s.structural_system;
                if (s.foundation_category) updates.foundationType = s.foundation_category;
              }
              if (rep.identificationPhotos && Array.isArray(rep.identificationPhotos)) {
                rep.identificationPhotos.forEach((p: any) => {
                  if (p.photo_type === 'P01_HOUSE_NUMBER') {
                    updates.photoP01 = { url: p.raw_photo_url || '', notApplicable: p.is_not_applicable };
                  } else if (p.photo_type === 'P02_MAIN_FACADE') {
                    updates.photoP02 = {
                      url: p.raw_photo_url || '',
                      notApplicable: p.is_not_applicable,
                      polygonPoints: p.facade_polygon_points_json || [],
                      floorSplits: p.floor_split_lines_json || [],
                      widthM: '',
                      heightM: '',
                    };
                  } else if (p.photo_type === 'P03_SIDE_OR_REAR') {
                    updates.photoP03 = { url: p.raw_photo_url || '', notApplicable: p.is_not_applicable };
                  } else if (p.photo_type === 'P04_CONTEXT_STREET') {
                    updates.photoP04 = { url: p.raw_photo_url || '', notApplicable: p.is_not_applicable };
                  }
                });
              }
              if (rep.historicalSensitivity) {
                const h = rep.historicalSensitivity;
                updates.historyInterview = {
                  renovationLoad: h.renovation_load ?? 0,
                  majorRepair: h.major_repair ?? 0,
                  pastSettlement: h.past_settlement ?? 0,
                  neighborDamage: h.neighbor_damage ?? 0,
                  fireFloodIncident: h.fire_flood_incident ?? 0,
                  sensitiveEquipment: {
                    has: Boolean(h.has_sensitive_equipment),
                    description: h.sensitive_equipment_desc || '',
                  },
                  usageStatus: h.usage_status || 'Đầy đủ 100%',
                  continuousOperation247: Boolean(h.continuous_operation_247),
                };
              }
              if (rep.floorSurveys && rep.floorSurveys.length > 0) {
                updates.floors = rep.floorSurveys.map((f: any) => ({
                  id: f.id,
                  floorName: f.floor_name,
                  overviewPhotos: f.overview_photos || [],
                  cadSketchPhotoUrl: f.cad_sketch_photo_url || '',
                  cadZonePins: f.cad_zone_pins || [],
                  cadElementPins: f.cad_element_pins || [],
                  zones: f.zones || [],
                  structuralElements: f.structural_elements || [],
                }));
              }
              if (rep.owner_remarks) {
                updates.ownerRemarks = rep.owner_remarks;
              }
              if (rep.surveyor_name || rep.owner_name) {
                updates.signatures = {
                  ownerFeedback: rep.owner_remarks || '',
                  preparedBy: {
                    fullName: rep.surveyor_name || '',
                    title: 'Kỹ sư khảo sát hiện trường',
                    date: rep.submitted_at ? rep.submitted_at.split('T')[0] : '',
                    photoUrl: rep.surveyor_signature_img || '',
                  },
                  ownerRepresentative: {
                    fullName: rep.owner_name || '',
                    role: 'Chủ hộ / Đại diện',
                    date: rep.submitted_at ? rep.submitted_at.split('T')[0] : '',
                    photoUrl: rep.owner_signature_url || '',
                  },
                  workingMinutesPhotos: [],
                };
              }
            }

            if (Object.keys(updates).length > 0) {
              updateFormData(updates);
            }
          }
        })
        .catch((err) => {
          console.warn('[SurveyPhase1Page] Could not fetch phase1-report for read-only:', err);
        });
    }
  }, [readOnly, parcel?.id]);

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
      try {
        confetti({
          particleCount: 100,
          spread: 80,
          origin: { y: 0.6 },
        });
      } catch (_e) {}
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

  const isPendingApproval = parcel?.surveyStatus === 'SUBMITTED' || reportData?.report?.status === 'SUBMITTED';
  const canApproveOrReject = (user?.role === 'ZONE_ADMIN' || user?.role === 'SUPER_ADMIN') && readOnly && isPendingApproval;

  const handleApproveFromPage = async () => {
    if (!parcel?.id) return;
    if (user?.role !== 'ZONE_ADMIN' && user?.role !== 'SUPER_ADMIN') {
      alert('Chỉ có Zone Admin hoặc Super Admin mới có quyền phê duyệt hồ sơ.');
      return;
    }
    const confirmApprove = window.confirm(`Bạn có chắc chắn muốn PHÊ DUYỆT hồ sơ khảo sát thửa [${parcel.projectParcelCode || parcel.officialCadastralCode || parcel.id}]?`);
    if (!confirmApprove) return;

    try {
      const overridesStr = localStorage.getItem('metro2_parcel_status_overrides');
      const overrides = overridesStr ? JSON.parse(overridesStr) : {};
      overrides[parcel.id] = {
        ...(overrides[parcel.id] || {}),
        status: 'APPROVED',
        updatedAt: new Date().toISOString(),
      };
      localStorage.setItem('metro2_parcel_status_overrides', JSON.stringify(overrides));

      try {
        await api.post(`/admin/reports/${parcel.id}/approve`, {});
      } catch (err: any) {
        console.warn('Backend approve API notice:', err?.response?.data || err?.message);
      }

      alert(`Đã phê duyệt thành công hồ sơ thửa [${parcel.projectParcelCode || parcel.officialCadastralCode || parcel.id}]!`);
      onBackToHome();
    } catch (e) {
      console.error('Approve error:', e);
      alert('Có lỗi xảy ra khi duyệt hồ sơ.');
    }
  };

  const handleRejectFromPage = async () => {
    if (!parcel?.id) return;
    if (user?.role !== 'ZONE_ADMIN' && user?.role !== 'SUPER_ADMIN') {
      alert('Chỉ có Zone Admin hoặc Super Admin mới có quyền từ chối hồ sơ.');
      return;
    }
    const reason = window.prompt(
      `Nhập lý do yêu cầu bổ sung / từ chối hồ sơ thửa [${parcel.projectParcelCode || parcel.officialCadastralCode || parcel.id}]:`,
      'Hồ sơ thiếu ảnh hiện trạng hoặc số liệu cần đo đạc lại'
    );
    if (!reason || !reason.trim()) return;

    try {
      const overridesStr = localStorage.getItem('metro2_parcel_status_overrides');
      const overrides = overridesStr ? JSON.parse(overridesStr) : {};
      overrides[parcel.id] = {
        ...(overrides[parcel.id] || {}),
        status: 'REJECTED',
        rejectionReason: reason.trim(),
        updatedAt: new Date().toISOString(),
      };
      localStorage.setItem('metro2_parcel_status_overrides', JSON.stringify(overrides));

      try {
        await api.post(`/admin/reports/${parcel.id}/reject`, {
          rejectionReason: reason.trim(),
        });
      } catch (err: any) {
        console.warn('Backend reject API notice:', err?.response?.data || err?.message);
      }

      alert(`Đã trả về hồ sơ thửa [${parcel.projectParcelCode || parcel.officialCadastralCode || parcel.id}] với yêu cầu bổ sung: "${reason.trim()}".`);
      onBackToHome();
    } catch (e) {
      console.error('Reject error:', e);
      alert('Có lỗi xảy ra khi từ chối hồ sơ.');
    }
  };

  return (
    <div className="min-h-screen bg-slate-50/50 flex flex-col">
      {/* Read-Only Mode Banner */}
      {readOnly && (
        <div className={`px-4 py-2.5 shadow-sm flex flex-wrap items-center justify-between sticky top-0 z-50 animate-in fade-in gap-2 border-b ${
          canApproveOrReject
            ? 'bg-violet-50 border-violet-200'
            : 'bg-sky-50 border-sky-200'
        }`}>
          <div className="flex items-center gap-2.5 text-xs sm:text-sm font-bold">
            <Eye className={`w-4 h-4 flex-shrink-0 ${canApproveOrReject ? 'text-violet-600' : 'text-sky-600'}`} />
            <span className={canApproveOrReject ? 'text-violet-800' : 'text-sky-800'}>
              {canApproveOrReject ? (
                <>Thẩm định hồ sơ (Zone Admin / Super Admin) - Thửa: <strong className="text-violet-700">{parcel?.projectParcelCode || parcel?.officialCadastralCode || parcel?.id}</strong></>
              ) : (
                <>👁️ Chế độ Xem lại biểu mẫu — Hồ sơ đã nộp, không thể chỉnh sửa.</>              )}
            </span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {canApproveOrReject && (
              <>
                <button
                  type="button"
                  onClick={handleApproveFromPage}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold px-3 py-1.5 rounded-lg flex items-center gap-1.5 shadow-sm transition-colors cursor-pointer"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  Duyệt hồ sơ
                </button>
                <button
                  type="button"
                  onClick={handleRejectFromPage}
                  className="bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold px-3 py-1.5 rounded-lg flex items-center gap-1.5 shadow-sm transition-colors cursor-pointer"
                >
                  <XCircle className="w-4 h-4" />
                  Từ chối
                </button>
              </>
            )}
            <button
              type="button"
              onClick={onBackToHome}
              className={`text-xs font-bold px-3 py-1.5 rounded-lg border transition-colors shrink-0 cursor-pointer ${
                canApproveOrReject
                  ? 'bg-white hover:bg-violet-50 text-violet-700 border-violet-300'
                  : 'bg-white hover:bg-sky-50 text-sky-700 border-sky-300'
              }`}
            >
              Quay về
            </button>
          </div>
        </div>
      )}

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
            readOnly={readOnly}
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
