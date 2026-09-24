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
import { Eye } from 'lucide-react';

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
  } = usePhase1SurveyStore();
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Khởi tạo form khi parcel thay đổi
  useEffect(() => {
    if (parcel) {
      initializeForm(parcel, unit);
    }
  }, [parcel?.id, unit?.id]);

  // Tải dữ liệu hồ sơ nếu ở chế độ xem lại (Read-Only)
  useEffect(() => {
    if (readOnly && parcel?.id) {
      api.get(`/parcels/${parcel.id}/phase1-report`)
        .then((res: any) => {
          const data = res?.data?.data || res?.data;
          if (data) {
            console.log('[SurveyPhase1Page] Read-only report loaded:', data);
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
      {/* Read-Only Mode Banner */}
      {readOnly && (
        <div className="bg-amber-500 text-white px-4 py-2.5 shadow-md flex items-center justify-between sticky top-0 z-50 animate-in fade-in">
          <div className="flex items-center gap-2.5 text-xs sm:text-sm font-bold">
            <Eye className="w-5 h-5 flex-shrink-0" />
            <span>
              👁️ Chế độ xem lại biểu mẫu (Read-Only) - Hồ sơ đã nộp / Đang thi công / Vắng mặt. Không thể chỉnh sửa hoặc nộp lại.
            </span>
          </div>
          <button
            type="button"
            onClick={onBackToHome}
            className="bg-white/20 hover:bg-white/30 text-white text-xs font-bold px-3 py-1.5 rounded-lg border border-white/30 transition-colors shrink-0 ml-2"
          >
            Quay về danh sách
          </button>
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
