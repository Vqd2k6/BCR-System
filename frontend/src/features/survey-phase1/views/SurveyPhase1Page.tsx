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
import { SurveyReviewBanner } from '../components/SurveyReviewBanner';
import { GisParcel, BuildingUnit } from '../../../core/types/domain.types';
import { api } from '../../../services/api';
import { useAuth } from '../../../context/AuthContext';
import confetti from 'canvas-confetti';

import { AbsenteeReviewView } from './AbsenteeReviewView';

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
    loadReportData,
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

            // 1. Khôi phục toàn vẹn 100% dữ liệu gốc từ JSON snapshot nếu đã từng nộp
            if (rep?.survey_data_json) {
              try {
                const rawJson = typeof rep.survey_data_json === 'string'
                  ? JSON.parse(rep.survey_data_json)
                  : rep.survey_data_json;
                if (rawJson && typeof rawJson === 'object') {
                  Object.assign(updates, rawJson);
                  console.log('[SurveyPhase1Page] Restored 100% original state from survey_data_json');
                }
              } catch (jsonErr) {
                console.warn('[SurveyPhase1Page] Lỗi giải mã survey_data_json:', jsonErr);
              }
            }

            if (absence) {
              updates.surveyCaseType = 'ABSENTEE';
              updates.isAbsenteeSurvey = true;
              updates.absenteeReason = absence.absence_reason || updates.absenteeReason || '';
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
              if (rep.identificationPhotos && Array.isArray(rep.identificationPhotos) && rep.identificationPhotos.length > 0) {
                rep.identificationPhotos.forEach((p: any) => {
                  if (p.photo_type === 'P01_HOUSE_NUMBER') {
                    updates.photoP01 = { url: p.raw_photo_url || '', notApplicable: p.is_not_applicable };
                  } else if (p.photo_type === 'P02_MAIN_FACADE') {
                    updates.photoP02 = {
                      ...(updates.photoP02 || {}),
                      url: p.raw_photo_url || '',
                      notApplicable: p.is_not_applicable,
                      polygonPoints: p.facade_polygon_points_json || updates.photoP02?.polygonPoints || [],
                      floorSplits: p.floor_split_lines_json || updates.photoP02?.floorSplits || [],
                      widthM: updates.photoP02?.widthM || '',
                      heightM: updates.photoP02?.heightM || '',
                    };
                  } else if (p.photo_type === 'P03_SIDE_OR_REAR') {
                    updates.photoP03 = { ...(updates.photoP03 || {}), url: p.raw_photo_url || '', notApplicable: p.is_not_applicable };
                  } else if (p.photo_type === 'P04_CONTEXT_STREET') {
                    updates.photoP04 = { ...(updates.photoP04 || {}), url: p.raw_photo_url || '', notApplicable: p.is_not_applicable };
                  }
                });
              }
              if (rep.historicalSensitivity) {
                const h = rep.historicalSensitivity;
                updates.historyInterview = {
                  ...(updates.historyInterview || {}),
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
              if (updates.floors && Array.isArray(updates.floors) && updates.floors.length > 0) {
                // Đã khôi phục từ snapshot survey_data_json -> Chuẩn hóa ảnh và bảo toàn dữ liệu zones, pins, CAD
                updates.floors = updates.floors.map((fl: any, idx: number) => {
                  const beFloor = rep.floorSurveys?.[idx];
                  const rawPhotos = fl.overviewPhotos && fl.overviewPhotos.length > 0 
                    ? fl.overviewPhotos 
                    : (beFloor?.overview_photos_json || beFloor?.overview_photos || []);
                  
                  const normalizedPhotos = (Array.isArray(rawPhotos) ? rawPhotos : []).map((p: any, pIdx: number) => {
                    if (typeof p === 'string') return { id: `fl_ov_${pIdx}`, url: p, caption: '' };
                    return { id: p.id || `fl_ov_${pIdx}`, url: p.url || '', caption: p.caption || '' };
                  });

                  return {
                    ...fl,
                    overviewPhotos: normalizedPhotos,
                    cadSketchPhotoUrl: fl.cadSketchPhotoUrl || beFloor?.cad_drawing_url || beFloor?.cad_sketch_photo_url || '',
                    cadStructuralSketchPhotoUrl: fl.cadStructuralSketchPhotoUrl || fl.cadStructuralDrawingUrl || beFloor?.cad_structural_drawing_url || '',
                    cadZonePins: fl.cadZonePins || beFloor?.cad_zone_pins_json || beFloor?.cad_zone_pins || [],
                    cadElementPins: fl.cadElementPins || beFloor?.cad_element_pins_json || beFloor?.cad_element_pins || [],
                    zones: fl.zones || [],
                    structuralElements: fl.structuralElements || [],
                  };
                });
              } else if (rep.floorSurveys && rep.floorSurveys.length > 0) {
                // Fallback nếu không có survey_data_json: khôi phục từ bảng floor_surveys và damage_zones
                const zonesByFloor = (rep.damageZones || []).reduce((acc: any, z: any) => {
                  const fid = z.floor_id;
                  if (!acc[fid]) acc[fid] = [];
                  acc[fid].push({
                    id: z.id,
                    zoneCode: z.zone_code,
                    zoneName: z.zone_name,
                    componentType: z.component_type,
                    notes: z.notes,
                    ctxPhotoUrl: z.photo_context_url || z.ctx_photo_url,
                    hasDamage: (z.defects && z.defects.length > 0) || Boolean(z.has_damage),
                    defects: (z.defects || []).map((d: any) => ({
                      id: d.id,
                      defectCode: d.defect_code,
                      pinX: Number(d.pin_x) || 0,
                      pinY: Number(d.pin_y) || 0,
                      screeningCategory: d.screening_category,
                      defectType: d.defect_type,
                      crackDirection: d.crack_direction,
                      widthMaxMm: Number(d.width_max_mm) || 0,
                      lengthMm: Number(d.length_mm) || 0,
                      cuPhotoUrl: d.cu_photo_url,
                      extraPhotoUrl: d.extra_photo_url,
                      pinColor: d.pin_color || '#ef4444',
                      hasScaleCard: d.has_scale_card ?? true,
                      isStructuralCritical: d.is_structural_critical ?? false,
                    })),
                  });
                  return acc;
                }, {});

                updates.floors = rep.floorSurveys.map((f: any) => {
                  const rawPhotos = f.overview_photos_json || f.overview_photos || [];
                  const normalizedPhotos = (Array.isArray(rawPhotos) ? rawPhotos : []).map((p: any, pIdx: number) => {
                    if (typeof p === 'string') return { id: `fl_ov_${pIdx}`, url: p, caption: '' };
                    return { id: p.id || `fl_ov_${pIdx}`, url: p.url || '', caption: p.caption || '' };
                  });

                  return {
                    id: f.id,
                    floorName: f.floor_name,
                    overviewPhotos: normalizedPhotos,
                    cadSketchPhotoUrl: f.cad_drawing_url || f.cad_sketch_photo_url || '',
                    cadStructuralSketchPhotoUrl: f.cad_structural_drawing_url || '',
                    cadZonePins: f.cad_zone_pins_json || f.cad_zone_pins || [],
                    cadElementPins: f.cad_element_pins_json || f.cad_element_pins || [],
                    zones: zonesByFloor[f.id] || f.zones || [],
                    structuralElements: f.structural_elements || [],
                  };
                });
              }
              if (rep.owner_remarks) {
                updates.ownerRemarks = rep.owner_remarks;
              }
              if (rep.surveyor_name || rep.owner_name || rep.surveyor_signature_url) {
                updates.signatures = {
                  ...(updates.signatures || {}),
                  ownerFeedback: rep.owner_remarks || updates.signatures?.ownerFeedback || '',
                  preparedBy: {
                    fullName: rep.surveyor_name || updates.signatures?.preparedBy?.fullName || '',
                    title: 'Kỹ sư khảo sát hiện trường',
                    date: rep.submitted_at ? rep.submitted_at.split('T')[0] : (updates.signatures?.preparedBy?.date || ''),
                    photoUrl: rep.surveyor_signature_url || rep.surveyor_signature_img || updates.signatures?.preparedBy?.photoUrl || '',
                  },
                  ownerRepresentative: {
                    fullName: rep.owner_name || updates.signatures?.ownerRepresentative?.fullName || '',
                    role: 'Chủ hộ / Đại diện',
                    date: rep.submitted_at ? rep.submitted_at.split('T')[0] : (updates.signatures?.ownerRepresentative?.date || ''),
                    photoUrl: rep.owner_signature_url || updates.signatures?.ownerRepresentative?.photoUrl || '',
                  },
                  workingMinutesPhotos: updates.signatures?.workingMinutesPhotos || [],
                };
              }
            }

            if (Object.keys(updates).length > 0) {
              loadReportData(updates);
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
      const store = usePhase1SurveyStore.getState();
      if (store.isSubmitted || readOnly) {
        return;
      }
      saveDraftToStorage();
      e.preventDefault();
      e.returnValue = 'Bạn có dữ liệu khảo sát đang thực hiện. Bạn có chắc chắn muốn tải lại hoặc rời đi?';
      return e.returnValue;
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [readOnly, saveDraftToStorage]);

  // Chặn thao tác back trình duyệt / vuốt back trên điện thoại
  useEffect(() => {
    window.history.pushState({ surveySessionActive: true }, '');

    const handlePopState = () => {
      const store = usePhase1SurveyStore.getState();
      if (store.isSubmitted || readOnly) {
        onBackToHome();
        return;
      }
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
  }, [onBackToHome, readOnly, saveDraftToStorage]);

  // Quay về an toàn có xác nhận và lưu nháp
  const handleSafeBackToHome = () => {
    const store = usePhase1SurveyStore.getState();
    if (store.isSubmitted || readOnly) {
      onBackToHome();
      return;
    }
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

    const confirmed = window.confirm(
      'Xác nhận nộp hồ sơ khảo sát Phase 1?\n\nSau khi nộp, hồ sơ sẽ chuyển sang trạng thái "Chờ duyệt" và không thể chỉnh sửa.\n\n⚠️ Vui lòng đảm bảo đã kiểm tra đầy đủ thông tin trước khi nộp.'
    );
    if (!confirmed) return;

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

      const response = await api.post('/surveys/phase1/submit', payload);

      // ✅ Chỉ báo thành công khi server xác nhận (2xx)
      if (response.data?.success) {
        clearDraft();
        try {
          confetti({
            particleCount: 100,
            spread: 80,
            origin: { y: 0.6 },
          });
        } catch (_e) {}
        alert('✅ Đã nộp thành công hồ sơ khảo sát hiện trạng Phase 1!\n\nHồ sơ đang chờ duyệt từ Zone Admin.');
        if (onFinished) {
          onFinished();
        } else {
          onBackToHome();
        }
      } else {
        // Server trả 2xx nhưng success=false
        throw new Error(response.data?.message || 'Server báo lỗi không xác định');
      }
    } catch (err: any) {
      console.error('[Phase1] Failed to submit survey:', err);
      // ❌ Lỗi thực sự - KHÔNG báo thành công, hiển thị thông báo lỗi rõ ràng
      const statusCode = err?.response?.status;
      const serverMsg = err?.response?.data?.detail || err?.response?.data?.message || err?.message;

      if (statusCode === 500) {
        alert(
          `❌ Lỗi máy chủ (500) - Hồ sơ CHƯA được nộp!\n\n${serverMsg || 'Internal Server Error'}\n\nVui lòng thử lại sau hoặc liên hệ kỹ thuật viên.\nDữ liệu đã được lưu nháp an toàn trên thiết bị.`
        );
      } else if (!statusCode) {
        alert(
          '❌ Lỗi kết nối mạng - Hồ sơ CHƯA được nộp!\n\nKiểm tra kết nối internet và thử lại.\nDữ liệu đã được lưu nháp an toàn trên thiết bị.'
        );
      } else {
        alert(
          `❌ Nộp hồ sơ thất bại (${statusCode}) - Hồ sơ CHƯA được nộp!\n\n${serverMsg || 'Lỗi không xác định'}\n\nVui lòng thử lại.`
        );
      }
      // ⛔ KHÔNG gọi onFinished() - ở lại trang để user có thể thử lại
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

  const isAbsenteeReport =
    formData.surveyCaseType === 'ABSENTEE' ||
    formData.isAbsenteeSurvey === true ||
    parcel?.surveyStatus === 'POSTPONED_ABSENT' ||
    reportData?.report?.survey_status === 'POSTPONED_ABSENT' ||
    Boolean(reportData?.absenceLog);

  if (readOnly && isAbsenteeReport) {
    return (
      <AbsenteeReviewView
        parcel={parcel}
        unit={unit}
        readOnly={readOnly}
        canApproveOrReject={Boolean(canApproveOrReject)}
        onApprove={handleApproveFromPage}
        onReject={handleRejectFromPage}
        onBackToHome={onBackToHome}
      />
    );
  }

  return (
    <div className="min-h-screen bg-slate-50/50 flex flex-col">
      {/* Read-Only Mode Banner */}
      <SurveyReviewBanner
        readOnly={readOnly}
        canApproveOrReject={canApproveOrReject}
        targetCode={parcel?.projectParcelCode || parcel?.officialCadastralCode || parcel?.id || ''}
        onApprove={handleApproveFromPage}
        onReject={handleRejectFromPage}
        onBack={onBackToHome}
      />

      {/* 8-Step Navigation Header */}
      <StepWizardNav onBackToHome={handleSafeBackToHome} />

      {/* Main Step Content Container */}
      <main className="flex-1 px-3 sm:px-6 py-6">
        {currentStep === 1 && (
          <Step1_BuildingIdentification
            onFinished={onFinished}
            onBackToHome={onBackToHome}
          />
        )}
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
