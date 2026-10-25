import { getErrorMessage, getErrorStatus, isNotFoundError } from '@/utils/errorUtils';
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
import { HandoverTakeoverModal } from '../components/HandoverTakeoverModal';
import { ActiveSurveyorLockedModal } from '../components/ActiveSurveyorLockedModal';
import type { GisParcel, BuildingUnit, SurveyStatus } from '../../../core/types/domain.types';
import type {
  Phase1SurveyFormData,
  FloorSurveyData,
  DamageZoneData,
  DefectItem,
} from '../types/phase1.types';
import { api } from '../../../services/api';
import { useAuth } from '../../../context/AuthContext';
import confetti from 'canvas-confetti';
import { uploadQueue } from '../../../core/services/uploadQueueService';
import { healLocalPhotoUris, findUnsyncedPhotoPaths } from '../../../core/storage/offlinePhotoStorage';
import { isCadastralOwnerPlaceholder, resolveOwnerName } from '../utils/stepValidator';

import { AbsenteeReviewView } from './AbsenteeReviewView';
import { CloudPhotoSyncModal } from '../components/CloudPhotoSyncModal';
import { auditSurveyPhotos } from '../utils/photoSyncAudit';
import { AlertOctagon, AlertTriangle, RefreshCw } from 'lucide-react';
import { getEffectiveParcelStatus } from '../../../components/gis/sweep-map/utils/sweepMapHelpers';
import { useAdminViewLock } from '../../../core/hooks/useAdminViewLock';
import { SurveyReadOnlyLock } from '../../../core/components/SurveyReadOnlyLock';
import {
  rehydrateIdentificationPhotos,
  rehydrateFloorSurveysByCanonicalKey,
  rehydrateDeformationAssessment,
  type BackendIdentificationPhotoRow,
} from '../mappers/surveyRehydration.adapter';

type IdentificationPhotoBackend = BackendIdentificationPhotoRow;

interface BackendDefectRecord {
  id: string;
  defect_code?: string;
  defectCode?: string;
  pin_x?: number;
  pinX?: number;
  pin_y?: number;
  pinY?: number;
  screening_category?: string;
  screeningCategory?: string;
  defect_type?: string;
  defectType?: string;
  crack_direction?: string;
  crackDirection?: string;
  width_max_mm?: number;
  widthMaxMm?: number;
  length_mm?: number;
  lengthMm?: number;
  activity_state?: 'S' | 'A' | 'D' | 'N';
  activityState?: 'S' | 'A' | 'D' | 'N';
  material_degradation_e4?: number;
  materialDegradationE4?: number;
  structural_significance_e2?: number;
  structuralSignificanceE2?: number;
  functional_impact_e6?: number | string;
  functionalImpactE6?: number | string;
  cu_photo_url?: string;
  cuPhotoUrl?: string;
  cu_photo_code?: string;
  cuPhotoCode?: string;
  cu_photos_json?: string[];
  cuPhotos?: string[];
  cu_photo_codes_json?: string[];
  cuPhotoCodes?: string[];
  extra_photo_url?: string;
  extraPhotoUrl?: string;
  pin_color?: string;
  pinColor?: string;
  has_scale_card?: boolean;
  hasScaleCard?: boolean;
  is_structural_critical?: boolean;
  isStructuralCritical?: boolean;
  notes?: string;
}

interface BackendDamageZoneRecord {
  id: string;
  zone_code?: string;
  zoneCode?: string;
  floor_name?: string;
  floor_id?: string;
  floorName?: string;
  room_name?: string;
  zone_name?: string;
  roomName?: string;
  custom_room_name?: string;
  component_type?: string;
  componentType?: string;
  custom_component_type?: string;
  wall_material?: string;
  wallMaterial?: string;
  custom_wall_material?: string;
  custom_element_type?: string;
  custom_material_type?: string;
  section_dimensions?: string;
  structural_integrity?: string;
  overview_photos_json?: string[];
  notes?: string;
  ctx_photo_url?: string;
  photo_context_url?: string;
  ctx_photo_code?: string;
  ctxPhotoCode?: string;
  has_damage?: boolean;
  functional_impact_repair_needed?: boolean;
  burland_grade?: number;
  burlandGrade?: number;
  defects?: BackendDefectRecord[];
}

interface BackendFloorSurveyRecord {
  id: string;
  floor_name?: string;
  floorName?: string;
  overview_photos_json?: Array<string | { id?: string; url?: string; caption?: string; photoCode?: string; photo_code?: string }>;
  overview_photos?: Array<string | { id?: string; url?: string; caption?: string; photoCode?: string; photo_code?: string }>;
  cad_drawing_url?: string;
  cad_sketch_photo_url?: string;
  cad_structural_drawing_url?: string;
  cad_zone_pins_json?: Array<Record<string, unknown>>;
  cad_zone_pins?: Array<Record<string, unknown>>;
  cad_element_pins_json?: Array<Record<string, unknown>>;
  cad_element_pins?: Array<Record<string, unknown>>;
  has_structural_elements?: boolean;
  no_structural_elements_reason?: string;
  beam_sagging_json?: Record<string, unknown>;
  zones?: DamageZoneData[];
  structural_elements?: Array<Record<string, unknown>>;
}

interface Phase1ServerReportResponse {
  report?: {
    status?: SurveyStatus;
    survey_data_json?: string | Record<string, unknown>;
    summary_conclusions?: string;
    engineering_recommendations?: string;
    rejection_reason?: string;
    owner_name?: string;
    owner_phone?: string;
    house_number?: string;
    street?: string;
    is_refused_or_absent?: boolean;
    buildingSpecs?: {
      building_name?: string;
      land_use_function?: string;
      floor_count?: number;
      basement_count?: number;
      construction_area_m2?: number;
      building_height_m?: number;
      year_of_construction?: number;
      is_year_estimated?: boolean;
      structural_system?: string;
      foundation_category?: string;
      foundation_source?: string;
      foundation_depth_m?: number;
      foundation_density?: number;
      foundation_spacing_m?: number;
      foundation_notes?: string;
      as_built_drawing_photo_url?: string;
      as_built_drawing_photos?: Array<{ id?: string; url: string; caption?: string }>;
    };
    identificationPhotos?: IdentificationPhotoBackend[];
    historicalSensitivity?: {
      extended_or_renovated?: boolean;
      previous_settlement_or_tilt?: boolean;
      fire_or_accident?: boolean;
      sensitive_equipment_present?: boolean;
      details?: string | null;
      e5_history_score?: number;
      renovation_load?: number;
      major_repair?: number;
      past_settlement?: number;
      neighbor_damage?: number;
      fire_flood_incident?: number;
      has_sensitive_equipment?: boolean;
      sensitive_equipment_desc?: string;
      usage_status?: string;
      continuous_operation_247?: boolean;
    };
    floorSurveys?: BackendFloorSurveyRecord[];
    damageZones?: BackendDamageZoneRecord[];
    deformation?: {
      tilt_angle_x?: number;
      tilt_angle_y?: number;
      tilt_direction?: string | null;
      floor_slope_ratio?: number;
      beam_deflection_mm?: number;
      e3_deformation_score?: number;
      measurement_method?: string;
      measurement_reliability?: 'HIGH' | 'MEDIUM' | 'LOW';
      diff_settlement_json?: Record<string, unknown>;
      building_tilt_json?: Record<string, unknown>;
      beam_sagging_json?: Record<string, unknown>;
      abnormal_case_json?: Record<string, unknown>;
      monitoring_notes?: string;
    };
    surveyScope?: {
      has_exterior?: boolean;
      has_first_floor?: boolean;
      has_upper_floors?: boolean;
      has_roof_basement?: boolean;
      has_adjacent_check?: boolean;
      has_other?: boolean;
      non_surveyed_areas_json?: unknown;
    };
    owner_remarks?: string;
    surveyor_name?: string;
    surveyor_signature_url?: string;
    surveyor_signature_img?: string;
    submitted_at?: string;
    owner_signature_url?: string;
    survey_status?: SurveyStatus;
    riskScores?: {
      e1_burland_score?: number;
      e2_structural_score?: number;
      e3_settlement_score?: number;
      e4_deterioration_score?: number;
      e5_history_score?: number;
      e6_functional_score?: number;
      [key: string]: unknown;
    };
  };
  absenceLog?: {
    absence_reason?: string;
    custom_reason?: string;
    notes?: string;
    photo_proof_url?: string;
    minutes_photos_json?: string[];
    [key: string]: unknown;
  };
  absenceLogs?: Array<{
    absence_reason?: string;
    custom_reason?: string;
    notes?: string;
    photo_proof_url?: string;
    minutes_photos_json?: string[];
    [key: string]: unknown;
  }>;
}

const isCadastralPlaceholder = (name?: string | null): boolean => isCadastralOwnerPlaceholder(name);

const reverseMapStructuralSystem = (dbVal?: string | null): string => {
  if (!dbVal) return '';
  const upper = dbVal.toUpperCase();
  if (upper.includes('KHUNG_BTCT') || upper.includes('RC')) return 'RC - BTCT (Khung bê tông cốt thép toàn khối)';
  if (upper.includes('THEP') || upper.includes('STEEL')) return 'Steel - Khung kết cấu thép';
  if (upper.includes('GACH') || upper.includes('MASONRY')) return 'Masonry - Tường gạch chịu lực';
  if (upper.includes('HON_HOP') || upper.includes('MIXED')) return 'Mixed - Kết cấu hỗn hợp';
  return dbVal;
};

const reverseMapFoundationCategory = (dbVal?: string | null): string => {
  if (!dbVal) return '';
  const upper = dbVal.toUpperCase();
  if (upper.includes('CAT_1') || upper.includes('WOOD') || upper.includes('TRAM')) return 'Wood - Móng cừ tràm / Nền gia cố';
  if (upper.includes('CAT_2') || upper.includes('CAT_3') || upper.includes('SHALLOW') || upper.includes('NONG') || upper.includes('DON') || upper.includes('BANG')) return 'Shallow - Móng nông (Móng băng / Móng đơn / Móng bè)';
  if (upper.includes('CAT_4') || upper.includes('PC')) return 'PC - Móng cọc ép BTCT';
  if (upper.includes('CIP')) return 'CIP - Móng cọc khoan nhồi';
  if (upper.includes('CAT_5') || upper.includes('UNKNOWN') || upper.includes('KHONG_XAC_DINH')) return 'Unknown - Không rõ thông tin móng';
  return dbVal;
};

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
    // Trạng thái khóa & tiếp quản ca
    isLockedByOther,
    lockedInfo,
    closeLockedModal,
    isHandoverModalOpen,
    handoverInfo,
    closeHandoverModal,
    takeoverDraft,
    syncDraftToServer,
    isDirty,
    setCurrentStep,
    unsyncedRemotePhotos,
  } = usePhase1SurveyStore();
  const { user } = useAuth();
  const { isAdmin, isViewOnlyForAdmin, unlockEdit } = useAdminViewLock();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [reportData, setReportData] = useState<Phase1ServerReportResponse | null>(null);
  const [isPhotoSyncModalOpen, setIsPhotoSyncModalOpen] = useState(false);
  const [isPhotoSyncFromSubmit, setIsPhotoSyncFromSubmit] = useState(false);
  const [isExitingWithSync, setIsExitingWithSync] = useState(false);

  // Tính toán trạng thái chỉ đọc (Triple-lock read-only protection)
  const effectiveStatus = parcel ? getEffectiveParcelStatus(parcel) : null;
  const serverStatus = reportData?.report?.status;
  const isSubmittedOrApproved =
    effectiveStatus === 'SUBMITTED' ||
    effectiveStatus === 'APPROVED' ||
    effectiveStatus === 'PHASE2_COMPLETED' ||
    effectiveStatus === 'APPROVED_PHASE2' ||
    parcel?.surveyStatus === 'SUBMITTED' ||
    parcel?.surveyStatus === 'APPROVED' ||
    parcel?.surveyStatus === 'PHASE2_COMPLETED' ||
    parcel?.surveyStatus === 'APPROVED_PHASE2' ||
    serverStatus === 'SUBMITTED' ||
    serverStatus === 'APPROVED' ||
    serverStatus === 'PHASE2_COMPLETED' ||
    serverStatus === 'APPROVED_PHASE2';

  const effectiveReadOnly = Boolean(readOnly || isSubmittedOrApproved || isViewOnlyForAdmin);

  // Khởi tạo form khi parcel thay đổi
  useEffect(() => {
    if (parcel) {
      initializeForm(parcel, unit);
    }
  }, [parcel?.id, unit?.id]);

  // Sync effectiveReadOnly prop vào Zustand store để toàn bộ wizard hiểu chế độ xem lại
  useEffect(() => {
    setIsReadOnly(effectiveReadOnly);
    return () => setIsReadOnly(false); // cleanup khi unmount
  }, [effectiveReadOnly]);

  // Định kỳ 2 phút tự động đồng bộ bản nháp lên máy chủ nếu có thay đổi (isDirty === true)
  useEffect(() => {
    if (effectiveReadOnly) return;
    const interval = setInterval(() => {
      const state = usePhase1SurveyStore.getState();
      if (state.isDirty && !state.isReadOnly) {
        console.log('[SurveyPhase1Page] Periodic 2-min auto-sync triggered...');
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

  // Ngăn chặn Safari iOS và Android pinch-zoom/gesture làm vỡ tỷ lệ trang,
  // ngoại trừ khi người dùng chủ động tương tác trong vùng CAD/Defect Canvas hoặc Photo Lightbox.
  useEffect(() => {
    const handleGesture = (e: Event) => {
      const target = e.target as HTMLElement | null;
      if (target?.closest?.('[data-zoomable-canvas="true"], [data-lightbox="true"]')) {
        return;
      }
      e.preventDefault();
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (e.touches.length > 1) {
        const target = e.target as HTMLElement | null;
        if (target?.closest?.('[data-zoomable-canvas="true"], [data-lightbox="true"]')) {
          return;
        }
        e.preventDefault();
      }
    };

    document.addEventListener('gesturestart', handleGesture, { passive: false });
    document.addEventListener('gesturechange', handleGesture, { passive: false });
    document.addEventListener('gestureend', handleGesture, { passive: false });
    document.addEventListener('touchmove', handleTouchMove, { passive: false });

    return () => {
      document.removeEventListener('gesturestart', handleGesture);
      document.removeEventListener('gesturechange', handleGesture);
      document.removeEventListener('gestureend', handleGesture);
      document.removeEventListener('touchmove', handleTouchMove);
    };
  }, []);

  // Tải dữ liệu hồ sơ nếu ở chế độ xem lại (Read-Only) hoặc nạp dữ liệu đã lưu từ máy chủ
  useEffect(() => {
    if (parcel?.id) {
      api.get<Phase1ServerReportResponse>(`/parcels/${parcel.id}/phase1-report`)
        .then((res) => {
          const data = (res?.data && 'data' in res.data ? (res.data as { data?: Phase1ServerReportResponse }).data : res?.data) || null;
          if (data) {
            console.log('[SurveyPhase1Page] Report loaded from server:', data);
            setReportData(data);
            const rep = data.report;
            const absence = data.absenceLog as {
              absence_reason?: string;
              custom_reason?: string;
              photo_proof_url?: string;
              minutes_photos_json?: string[];
            } | undefined;
            const updates: Partial<Phase1SurveyFormData> = {};

            // Nếu hồ sơ trên máy chủ đã nộp hoặc phê duyệt, kích hoạt ngay chế độ chỉ xem
            if (
              rep?.status === 'SUBMITTED' ||
              rep?.status === 'APPROVED' ||
              rep?.status === 'PHASE2_COMPLETED' ||
              rep?.status === 'APPROVED_PHASE2'
            ) {
              setIsReadOnly(true);
            }

            // 1. Khôi phục toàn vẹn 100% dữ liệu gốc từ JSON snapshot nếu đã từng nộp / lưu
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

            const allAbsenceLogs = Array.isArray(data.absenceLogs) && data.absenceLogs.length > 0
              ? data.absenceLogs
              : (absence ? [absence] : []);

            if (effectiveReadOnly) {
              if (absence && rep?.is_refused_or_absent) {
                updates.surveyCaseType = 'ABSENTEE';
                updates.isAbsenteeSurvey = true;
                updates.absenteeReason = absence.absence_reason || updates.absenteeReason || '';
                if (absence.custom_reason && !updates.customAbsenteeReason) {
                  updates.customAbsenteeReason = absence.custom_reason;
                }
                const absPhotos = Array.isArray(absence.minutes_photos_json) && absence.minutes_photos_json.length > 0
                  ? absence.minutes_photos_json
                  : (absence.photo_proof_url ? [absence.photo_proof_url] : []);
                if (absPhotos.length > 0 && (!updates.absenteeMinutesPhotos || updates.absenteeMinutesPhotos.length === 0)) {
                  updates.absenteeMinutesPhotos = absPhotos;
                }
                if (allAbsenceLogs.length > 0 && (!updates.previousAbsenceLogs || updates.previousAbsenceLogs.length === 0)) {
                  updates.previousAbsenceLogs = allAbsenceLogs;
                }
              }
            } else {
              // Khi ở chế độ chỉnh sửa / tiếp tục khảo sát (Chủ nhà có mặt)
              if (updates.resumedFromAbsentee || parcel.surveyStatus === 'IN_PROGRESS' || rep?.is_refused_or_absent === false) {
                updates.surveyCaseType = 'NORMAL';
                updates.isAbsenteeSurvey = false;
                if (allAbsenceLogs.length > 0) {
                  updates.previousAbsenceLogs = updates.previousAbsenceLogs?.length ? updates.previousAbsenceLogs : allAbsenceLogs;
                  updates.resumedFromAbsentee = true;
                }
              }
            }

            if (rep) {
              // E3: Chỉ lấy tên chủ hộ thực tế (không phải placeholder "Chủ hộ thửa...") khi ghi đè vào form
              const resolvedRealOwner = resolveOwnerName(
                isCadastralPlaceholder(updates.ownerName) ? '' : updates.ownerName,
                isCadastralPlaceholder(rep.owner_name) ? '' : rep.owner_name
              );
              if (resolvedRealOwner) {
                updates.ownerName = resolvedRealOwner;
              } else if (effectiveReadOnly) {
                updates.ownerName = updates.ownerName || rep.owner_name || '';
              } else if (isCadastralPlaceholder(updates.ownerName)) {
                updates.ownerName = '';
              }
              if (!updates.ownerPhone && rep.owner_phone) {
                updates.ownerPhone = rep.owner_phone;
              }
              if (!updates.houseNumber && rep.house_number) updates.houseNumber = rep.house_number;
              if (!updates.street && rep.street) updates.street = rep.street;

              if (rep.buildingSpecs) {
                const s = rep.buildingSpecs;
                if (!updates.buildingName && s.building_name) updates.buildingName = s.building_name;
                if (!updates.usageFunction && s.land_use_function) updates.usageFunction = s.land_use_function;
                if (updates.aboveFloors === undefined || updates.aboveFloors === null || updates.aboveFloors === '') {
                  if (s.floor_count !== undefined && s.floor_count !== null) updates.aboveFloors = s.floor_count;
                }
                if (updates.undergroundFloors === undefined || updates.undergroundFloors === null || updates.undergroundFloors === '') {
                  if (s.basement_count !== undefined && s.basement_count !== null) updates.undergroundFloors = s.basement_count;
                }
                if (!updates.constructionAreaM2 && s.construction_area_m2) updates.constructionAreaM2 = s.construction_area_m2;
                if (!updates.buildingHeightM && s.building_height_m) updates.buildingHeightM = s.building_height_m;
                if (!updates.constructionYear && s.year_of_construction) updates.constructionYear = s.year_of_construction;
                if (updates.isEstimatedYear === undefined && s.is_year_estimated !== undefined) updates.isEstimatedYear = s.is_year_estimated;

                // Chỉ map từ DB nếu updates chưa có, và phải ánh xạ sang UI display string chuẩn
                if (!updates.structureSystem && s.structural_system) {
                  updates.structureSystem = reverseMapStructuralSystem(s.structural_system);
                }
                if (!updates.foundationType && s.foundation_category) {
                  updates.foundationType = reverseMapFoundationCategory(s.foundation_category);
                }
                if (!updates.foundationSource && s.foundation_source) updates.foundationSource = s.foundation_source;
                if (updates.foundationDepthM === undefined && s.foundation_depth_m !== undefined) updates.foundationDepthM = s.foundation_depth_m;
                if (updates.foundationDensity === undefined && s.foundation_density !== undefined) updates.foundationDensity = s.foundation_density;
                if (updates.foundationSpacingM === undefined && s.foundation_spacing_m !== undefined) updates.foundationSpacingM = s.foundation_spacing_m;
                if (!updates.foundationNotes && s.foundation_notes) updates.foundationNotes = s.foundation_notes;
                if ((!updates.asBuiltDrawingPhotos || updates.asBuiltDrawingPhotos.length === 0) && s.as_built_drawing_photos) {
                  updates.asBuiltDrawingPhotos = Array.isArray(s.as_built_drawing_photos) ? s.as_built_drawing_photos : [];
                }
              }
              if (rep.identificationPhotos && Array.isArray(rep.identificationPhotos) && rep.identificationPhotos.length > 0) {
                const rehydratedPhotos = rehydrateIdentificationPhotos(rep.identificationPhotos, {
                  photoP01: updates.photoP01,
                  photoP02: updates.photoP02,
                  photoP03: updates.photoP03,
                  photoP04: updates.photoP04,
                });
                if (rehydratedPhotos.photoP01) updates.photoP01 = rehydratedPhotos.photoP01;
                if (rehydratedPhotos.photoP02) updates.photoP02 = rehydratedPhotos.photoP02;
                if (rehydratedPhotos.photoP03) updates.photoP03 = rehydratedPhotos.photoP03;
                if (rehydratedPhotos.photoP04) updates.photoP04 = rehydratedPhotos.photoP04;
              }
              if (rep.historicalSensitivity) {
                const h = rep.historicalSensitivity;
                let parsedDetails: Record<string, unknown> | null = null;
                if (h.details && typeof h.details === 'string') {
                  try {
                    parsedDetails = JSON.parse(h.details);
                  } catch {
                    // details có thể là chuỗi văn bản ghi chú
                  }
                }

                const existingHi = updates.historyInterview;
                updates.historyInterview = {
                  renovationLoad: existingHi?.renovationLoad ?? (typeof parsedDetails?.renovationLoad === 'number' ? parsedDetails.renovationLoad : (h.renovation_load ?? (h.extended_or_renovated ? 1 : 0))),
                  majorRepair: existingHi?.majorRepair ?? (typeof parsedDetails?.majorRepair === 'number' ? parsedDetails.majorRepair : (h.major_repair ?? 0)),
                  pastSettlement: existingHi?.pastSettlement ?? (typeof parsedDetails?.pastSettlement === 'number' ? parsedDetails.pastSettlement : (h.past_settlement ?? (h.previous_settlement_or_tilt ? 1 : 0))),
                  neighborDamage: existingHi?.neighborDamage ?? (typeof parsedDetails?.neighborDamage === 'number' ? parsedDetails.neighborDamage : (h.neighbor_damage ?? 0)),
                  fireFloodIncident: existingHi?.fireFloodIncident ?? (typeof parsedDetails?.fireFloodIncident === 'number' ? parsedDetails.fireFloodIncident : (h.fire_flood_incident ?? (h.fire_or_accident ? 1 : 0))),
                  sensitiveEquipment: existingHi?.sensitiveEquipment || (parsedDetails?.sensitiveEquipment as { has: boolean; description: string }) || {
                    has: Boolean(h.has_sensitive_equipment ?? h.sensitive_equipment_present),
                    description: h.sensitive_equipment_desc || '',
                  },
                  usageStatus: existingHi?.usageStatus || (typeof parsedDetails?.usageStatus === 'string' ? parsedDetails.usageStatus : (h.usage_status || 'Đầy đủ 100%')),
                  continuousOperation247: existingHi?.continuousOperation247 ?? (typeof parsedDetails?.continuousOperation247 === 'boolean' ? parsedDetails.continuousOperation247 : (h.continuous_operation_247 ?? false)),
                };
              }
              if (updates.floors && Array.isArray(updates.floors) && updates.floors.length > 0) {
                // [ND-06] Khớp tầng theo khóa định danh chuẩn (floor_name / floorCode), bảo toàn photoCode và CAD_01/CAD_02
                updates.floors = rehydrateFloorSurveysByCanonicalKey(updates.floors, rep.floorSurveys);
              } else if (rep.floorSurveys && rep.floorSurveys.length > 0) {
                // Fallback nếu không có survey_data_json: khôi phục từ bảng floor_surveys và damage_zones (tách Z-xx và E-xx)
                const elementsByFloor: Record<string, FloorSurveyData['structuralElements']> = {};
                const zonesByFloor = (rep.damageZones || []).reduce<Record<string, DamageZoneData[]>>((acc, z) => {
                  const fid = z.floor_name || z.floor_id || z.floorName || 'default';
                  const zCode = String(z.zone_code || z.zoneCode || 'Z-01');
                  const mappedDefects = (z.defects || []).map((d): DefectItem => {
                    const cuList: string[] = Array.isArray(d.cu_photos_json) && d.cu_photos_json.length > 0
                      ? d.cu_photos_json
                      : (Array.isArray(d.cuPhotos) && d.cuPhotos.length > 0
                          ? d.cuPhotos
                          : (d.cu_photo_url || d.cuPhotoUrl ? [d.cu_photo_url || d.cuPhotoUrl || ''] : []));
                    const codeList: string[] = Array.isArray(d.cu_photo_codes_json) && d.cu_photo_codes_json.length > 0
                      ? d.cu_photo_codes_json
                      : (Array.isArray(d.cuPhotoCodes) && d.cuPhotoCodes.length > 0
                          ? d.cuPhotoCodes
                          : (d.cu_photo_code || d.cuPhotoCode ? [d.cu_photo_code || d.cuPhotoCode || ''] : []));
                    return {
                      id: d.id,
                      defectCode: d.defect_code || d.defectCode || 'D-01',
                      pinX: Number(d.pin_x ?? d.pinX) || 0,
                      pinY: Number(d.pin_y ?? d.pinY) || 0,
                      screeningCategory: d.screening_category || d.screeningCategory || 'Nứt tường gạch / Vữa trát hoàn thiện',
                      defectType: d.defect_type || d.defectType || 'Nứt chân chim / Mạng nhện vữa trát (<0.5mm)',
                      crackDirection: (d.crack_direction || d.crackDirection) as DefectItem['crackDirection'],
                      widthMaxMm: Number(d.width_max_mm ?? d.widthMaxMm) || 0,
                      lengthMm: Number(d.length_mm ?? d.lengthMm) || 0,
                      activityState: (d.activity_state || d.activityState || 'S') as DefectItem['activityState'],
                      materialDegradationE4: Number(d.material_degradation_e4 ?? d.materialDegradationE4) || 0,
                      structuralSignificanceE2: Number(d.structural_significance_e2 ?? d.structuralSignificanceE2) || 0,
                      functionalImpactE6: (d.functional_impact_e6 ?? d.functionalImpactE6 ?? '') as DefectItem['functionalImpactE6'],
                      cuPhotoUrl: cuList[0] || d.cu_photo_url || d.cuPhotoUrl || '',
                      cuPhotoCode: codeList[0] || d.cu_photo_code || d.cuPhotoCode || '',
                      cuPhotos: cuList,
                      cuPhotoCodes: codeList,
                      extraPhotoUrl: d.extra_photo_url || d.extraPhotoUrl,
                      pinColor: d.pin_color || d.pinColor || '#ef4444',
                      hasScaleCard: d.has_scale_card ?? d.hasScaleCard ?? true,
                      isStructuralCritical: d.is_structural_critical ?? d.isStructuralCritical ?? false,
                      notes: d.notes || '',
                    };
                  });

                  if (zCode.toUpperCase().startsWith('E-')) {
                    if (!elementsByFloor[fid]) elementsByFloor[fid] = [];
                    elementsByFloor[fid].push({
                      id: z.id,
                      elementCode: zCode,
                      floorName: z.floor_name || z.floorName || '',
                      roomName: z.room_name || z.zone_name || z.roomName || 'Cấu kiện kết cấu',
                      customRoomName: z.custom_room_name || '',
                      elementType: (z.component_type || z.componentType || 'COLUMN') as NonNullable<FloorSurveyData['structuralElements']>[number]['elementType'],
                      customElementType: z.custom_element_type || z.custom_component_type || '',
                      materialType: z.wall_material || z.wallMaterial || 'BTCT',
                      customMaterialType: z.custom_material_type || z.custom_wall_material || '',
                      dimensions: z.section_dimensions || '',
                      sectionDimensions: z.section_dimensions || '',
                      structuralIntegrity: z.structural_integrity || '',
                      notes: z.notes || '',
                      overviewPhotos: Array.isArray(z.overview_photos_json) ? z.overview_photos_json : [],
                      ctxPhotoUrl: z.ctx_photo_url || z.photo_context_url || '',
                      ctxPhotoCode: z.ctx_photo_code || z.ctxPhotoCode || '',
                      hasDamage: mappedDefects.length > 0 || Boolean(z.has_damage) || Boolean(z.functional_impact_repair_needed),
                      defects: mappedDefects,
                    });
                    return acc;
                  }

                  if (!acc[fid]) acc[fid] = [];
                  acc[fid].push({
                    id: z.id,
                    zoneCode: zCode,
                    floorName: z.floor_name || z.floorName || '',
                    roomName: z.room_name || z.zone_name || z.roomName || 'Không gian chung',
                    customRoomName: z.custom_room_name || '',
                    componentType: z.component_type || z.componentType || 'WALL',
                    customComponentType: z.custom_component_type || '',
                    wallMaterial: z.wall_material || z.wallMaterial || '',
                    customWallMaterial: z.custom_wall_material || '',
                    functionalImpactRepairNeeded: Boolean(z.functional_impact_repair_needed),
                    notes: z.notes || '',
                    overviewPhotos: Array.isArray(z.overview_photos_json) ? z.overview_photos_json : [],
                    ctxPhotoUrl: z.ctx_photo_url || z.photo_context_url || '',
                    ctxPhotoCode: z.ctx_photo_code || z.ctxPhotoCode || '',
                    hasDamage: mappedDefects.length > 0 || Boolean(z.has_damage) || Boolean(z.functional_impact_repair_needed),
                    burlandGrade: Number(z.burland_grade ?? z.burlandGrade) || 0,
                    defects: mappedDefects,
                  });
                  return acc;
                }, {});

                updates.floors = rep.floorSurveys.map((f): FloorSurveyData => {
                  const rawPhotos = f.overview_photos_json || f.overview_photos || [];
                  const normalizedPhotos = (Array.isArray(rawPhotos) ? rawPhotos : []).map((p, pIdx) => {
                    if (typeof p === 'string') return { id: `fl_ov_${pIdx}`, url: p, caption: '' };
                    const pObj = p as { id?: string; url?: string; caption?: string; photoCode?: string; photo_code?: string };
                    return {
                      id: pObj.id || `fl_ov_${pIdx}`,
                      url: pObj.url || '',
                      caption: pObj.caption || '',
                      ...(pObj.photoCode || pObj.photo_code ? { photoCode: pObj.photoCode || pObj.photo_code } : {}),
                    };
                  });

                  return {
                    id: f.id,
                    floorName: f.floor_name || f.floorName || 'Tầng',
                    overviewPhotos: normalizedPhotos,
                    cadSketchPhotoUrl: f.cad_drawing_url || f.cad_sketch_photo_url || '',
                    cadStructuralSketchPhotoUrl: f.cad_structural_drawing_url || '',
                    cadZonePins: (f.cad_zone_pins_json || f.cad_zone_pins || []) as unknown as FloorSurveyData['cadZonePins'],
                    cadElementPins: (f.cad_element_pins_json || f.cad_element_pins || []) as unknown as FloorSurveyData['cadElementPins'],
                    hasStructuralElements: f.has_structural_elements ?? true,
                    noStructuralElementsReason: f.no_structural_elements_reason || '',
                    beamSagging: f.beam_sagging_json as FloorSurveyData['beamSagging'],
                    zones: zonesByFloor[f.floor_name || ''] || zonesByFloor[f.floorName || ''] || zonesByFloor[f.id] || f.zones || [],
                    structuralElements: elementsByFloor[f.floor_name || ''] || elementsByFloor[f.floorName || ''] || elementsByFloor[f.id] || ((f.structural_elements || []) as unknown as FloorSurveyData['structuralElements']),
                  };
                });
              }
              if (!updates.settlementTilt && rep.deformation) {
                const rehydratedDeform = rehydrateDeformationAssessment(rep.deformation);
                if (rehydratedDeform) {
                  updates.settlementTilt = rehydratedDeform;
                }
              }
              if (!updates.surveyScope && rep.surveyScope) {
                const sc = rep.surveyScope;
                const surveyedParts: string[] = [];
                if (sc.has_exterior) surveyedParts.push('Ngoại thất / Mặt tiền công trình');
                if (sc.has_first_floor) surveyedParts.push('Tầng 1 (Tầng trệt)');
                if (sc.has_upper_floors) surveyedParts.push('Các tầng lầu trên cao');
                if (sc.has_roof_basement) surveyedParts.push('Mái / Tầng hầm / Sân thượng');
                if (sc.has_adjacent_check) surveyedParts.push('Khu vực tiếp giáp công trình lân cận');
                if (sc.has_other) surveyedParts.push('Khác (Nhập chi tiết...)');
                updates.surveyScope = {
                  externalFront: Boolean(sc.has_exterior),
                  surveyedFloors: sc.has_first_floor ? ['Tầng 1'] : [],
                  surveyedParts,
                  roofTerrace: Boolean(sc.has_roof_basement),
                  basement: Boolean(sc.has_roof_basement),
                  backyardOuthouse: Boolean(sc.has_other),
                };
              }
              if (rep.summary_conclusions || rep.engineering_recommendations) {
                const cleanRecs =
                  rep.engineering_recommendations &&
                  !/^(LÝ DO TRẢ VỀ|ADMIN MỞ LẠI|ADMIN CHUYỂN VỀ)/i.test(rep.engineering_recommendations)
                    ? rep.engineering_recommendations
                    : '';
                updates.executiveSummary = {
                  keyRisksDefectsText: updates.executiveSummary?.keyRisksDefectsText || rep.summary_conclusions || '',
                  specificRecommendationsText: updates.executiveSummary?.specificRecommendationsText || cleanRecs || '',
                  constructionImpactStatus: updates.executiveSummary?.constructionImpactStatus || 'PENDING',
                  braStatus: updates.executiveSummary?.braStatus || 'PENDING',
                };
              }
              if (rep.owner_remarks) {
                updates.ownerRemarks = rep.owner_remarks;
              }
              if (rep.surveyor_name || rep.surveyor_signature_url || rep.owner_signature_url || updates.signatures) {
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
                    fullName: updates.signatures?.ownerRepresentative?.fullName || '',
                    role: updates.signatures?.ownerRepresentative?.role || 'Chủ hộ / Đại diện',
                    date: rep.submitted_at ? rep.submitted_at.split('T')[0] : (updates.signatures?.ownerRepresentative?.date || ''),
                    photoUrl: rep.owner_signature_url || updates.signatures?.ownerRepresentative?.photoUrl || '',
                  },
                  workingMinutesPhotos: updates.signatures?.workingMinutesPhotos || [],
                };
              }
              if (!updates.burlandSummary) {
                const maxBurland = Number(rep.riskScores?.e1_burland_score || 0);
                updates.burlandSummary = {
                  predominantGrade: maxBurland,
                  localMaxGrade: maxBurland,
                  governingZoneCode: 'Z-01',
                  governingZoneDescription: '',
                  representativeness: 'GLOBAL',
                  structuralFlagLevel: 'NONE',
                  needStructuralEngineerReview: false,
                };
              }
            }

            // D2: Nếu thửa đất đang ở trạng thái IN_PROGRESS (đang làm dở) và bản ghi trên server chỉ là DRAFT thường (không phải REJECTED/ABSENT),
            // ưu tiên bản nháp mới hơn từ IndexedDB / Server Draft để không ghi đè lùi dữ liệu KSV vừa gõ
            const isNormalActiveDraft =
              !effectiveReadOnly &&
              rep?.status === 'DRAFT' &&
              !rep?.is_refused_or_absent &&
              parcel.surveyStatus === 'IN_PROGRESS';

            if (Object.keys(updates).length > 0) {
              if (isNormalActiveDraft) {
                const currentStoreData = usePhase1SurveyStore.getState().formData;
                const localUpdatedAtStr = (currentStoreData as Phase1SurveyFormData & { _localUpdatedAt?: string })._localUpdatedAt;
                if (!localUpdatedAtStr) {
                  loadReportData(updates);
                } else {
                  // Chỉ bổ sung previousAbsenceLogs / resumedFromAbsentee nếu có, giữ nguyên dữ liệu nháp mới hơn
                  if (updates.previousAbsenceLogs?.length && !currentStoreData.previousAbsenceLogs?.length) {
                    loadReportData({
                      previousAbsenceLogs: updates.previousAbsenceLogs,
                      resumedFromAbsentee: updates.resumedFromAbsentee,
                    });
                  }
                }
              } else {
                loadReportData(updates);
              }
            }
          }
        })
        .catch((err) => {
          console.warn('[SurveyPhase1Page] Notice: phase1-report not found or new survey:', getErrorMessage(err));
        });
    }
  }, [effectiveReadOnly, parcel?.id]);

  // Chặn thao tác reload / đóng tab ngoài ý muốn
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      const store = usePhase1SurveyStore.getState();
      if (store.isSubmitted || effectiveReadOnly) {
        return;
      }
      saveDraftToStorage();
      e.preventDefault();
      e.returnValue = 'Bạn có dữ liệu khảo sát đang thực hiện. Bạn có chắc chắn muốn tải lại hoặc rời đi?';
      return e.returnValue;
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [effectiveReadOnly, saveDraftToStorage]);

  // Chặn thao tác back trình duyệt / vuốt back trên điện thoại
  useEffect(() => {
    window.history.pushState({ surveySessionActive: true }, '');

    const handlePopState = async () => {
      const store = usePhase1SurveyStore.getState();
      if (store.isSubmitted || effectiveReadOnly) {
        onBackToHome();
        return;
      }
      const confirmLeave = window.confirm(
        'Bạn có chắc chắn muốn quay lại và tạm rời phiên khảo sát? Toàn bộ dữ liệu đang nhập đã được lưu nháp an toàn.'
      );
      if (confirmLeave) {
        saveDraftToStorage();
        setIsExitingWithSync(true);
        try {
          await Promise.race([
            syncDraftToServer(),
            new Promise((resolve) => setTimeout(resolve, 3000)),
          ]);
        } catch (err) {
          console.warn('[handlePopState] Sync before exit failed/timed out:', err);
        } finally {
          setIsExitingWithSync(false);
          onBackToHome();
        }
      } else {
        window.history.pushState({ surveySessionActive: true }, '');
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [onBackToHome, effectiveReadOnly, saveDraftToStorage, syncDraftToServer]);

  // Quay về an toàn có xác nhận và lưu nháp
  const handleSafeBackToHome = async () => {
    const store = usePhase1SurveyStore.getState();
    if (store.isSubmitted || effectiveReadOnly) {
      onBackToHome();
      return;
    }
    const confirmLeave = window.confirm(
      'Bạn có chắc chắn muốn quay về danh sách? Toàn bộ dữ liệu khảo sát đã được tự động lưu nháp an toàn vào bộ nhớ thiết bị.'
    );
    if (confirmLeave) {
      saveDraftToStorage();
      setIsExitingWithSync(true);
      try {
        await Promise.race([
          syncDraftToServer(),
          new Promise((resolve) => setTimeout(resolve, 3000)),
        ]);
      } catch (err) {
        console.warn('[handleSafeBackToHome] Sync before exit failed/timed out:', err);
      } finally {
        setIsExitingWithSync(false);
        onBackToHome();
      }
    }
  };

  // Tự động cuộn lên đầu trang mỗi khi chuyển bước khảo sát
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    document.documentElement.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    document.body.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  }, [currentStep]);

  const photoAudit = auditSurveyPhotos(formData, updateFormData);

  // Thực thi lệnh gửi payload khảo sát lên server
  const executeFinalSubmit = async () => {
    try {
      setIsSubmitting(true);
      const cleanFormData = healLocalPhotoUris(formData);
      const unsyncedPaths = findUnsyncedPhotoPaths(cleanFormData);
      const pendingUploads = uploadQueue.getPendingAndActiveCount();
      if (unsyncedPaths.length > 0 || pendingUploads > 0) {
        void uploadQueue.resumePendingOfflineUploads();
        setIsPhotoSyncFromSubmit(true);
        setIsPhotoSyncModalOpen(true);
        return;
      }
      console.log('[Phase1] Submitting final survey payload (healed):', cleanFormData);

      const payload = {
        parcelId: formData.parcelId,
        unitId: unit?.id,
        surveyData: cleanFormData,
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
    } catch (err: unknown) {
      console.error('[Phase1] Failed to submit survey:', err);
      // ❌ Lỗi thực sự - KHÔNG báo thành công, hiển thị thông báo lỗi rõ ràng
      const statusCode = getErrorStatus(err);
      const serverMsg = getErrorMessage(err);

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

  // Nộp hồ sơ hoàn chỉnh lên Backend
  const handleSubmitFinal = async () => {
    const isValid = validateForFinalSubmit();
    if (!isValid) return;

    const confirmed = window.confirm(
      'Xác nhận nộp hồ sơ khảo sát Phase 1?\n\nSau khi nộp, hồ sơ sẽ chuyển sang trạng thái "Chờ duyệt" và không thể chỉnh sửa.\n\n⚠️ Vui lòng đảm bảo đã kiểm tra đầy đủ thông tin trước khi nộp.'
    );
    if (!confirmed) return;

    // 1. Kiểm tra hàng đợi upload Cloud hoặc còn ảnh dạng Base64
    const currentAudit = auditSurveyPhotos(formData, updateFormData);
    const pendingUploads = uploadQueue.getPendingAndActiveCount();
    if (currentAudit.unsyncedPhotosCount > 0 || pendingUploads > 0) {
      // Thay vì alert mù mờ, mở ngay Modal chi tiết danh sách ảnh để user thấy rõ ảnh nào thiếu & ở bước nào
      setIsPhotoSyncFromSubmit(true);
      setIsPhotoSyncModalOpen(true);
      return;
    }

    await executeFinalSubmit();
  };


  const isPendingApproval =
    parcel?.surveyStatus === 'SUBMITTED' ||
    effectiveStatus === 'SUBMITTED' ||
    reportData?.report?.status === 'SUBMITTED';
  const canApproveOrReject = (user?.role === 'ZONE_ADMIN' || user?.role === 'SUPER_ADMIN') && effectiveReadOnly && isPendingApproval;

  const handleApproveFromPage = async () => {
    if (!parcel?.id) return;
    if (user?.role !== 'ZONE_ADMIN' && user?.role !== 'SUPER_ADMIN') {
      alert('Chỉ có Zone Admin hoặc Super Admin mới có quyền phê duyệt hồ sơ.');
      return;
    }

    // E3: Chặn cứng Phê duyệt nếu hồ sơ khảo sát thường (NORMAL) thiếu tên chủ hộ thực tế hoặc còn giữ placeholder địa chính
    const isSpecialCase =
      formData.isAbsenteeSurvey ||
      formData.surveyCaseType === 'ABSENTEE' ||
      formData.surveyCaseType === 'VACANT_LAND' ||
      formData.surveyCaseType === 'UNDER_CONSTRUCTION' ||
      formData.surveyCaseType === 'APARTMENT' ||
      Boolean(reportData?.report?.is_refused_or_absent);

    if (!isSpecialCase && (!formData.ownerName?.trim() || isCadastralOwnerPlaceholder(formData.ownerName))) {
      alert(
        '⛔ Không thể phê duyệt: Hồ sơ khảo sát chưa có Tên chủ sở hữu / người sử dụng thực tế (đang để trống hoặc còn tên giả định địa chính "Chủ hộ thửa...").\n\nVui lòng bấm nút "Từ chối / Trả về" để yêu cầu Khảo sát viên bổ sung tên chủ hộ thực tế.'
      );
      return;
    }

    const confirmApprove = window.confirm(`Bạn có chắc chắn muốn PHÊ DUYỆT hồ sơ khảo sát thửa [${parcel.projectParcelCode || parcel.officialCadastralCode || parcel.id}]?`);
    if (!confirmApprove) return;

    try {
      await api.post(`/admin/reports/${parcel.id}/approve`, {});

      const overridesStr = localStorage.getItem('metro2_parcel_status_overrides');
      const overrides = overridesStr ? JSON.parse(overridesStr) : {};
      overrides[parcel.id] = {
        ...(overrides[parcel.id] || {}),
        status: 'APPROVED',
        updatedAt: new Date().toISOString(),
      };
      localStorage.setItem('metro2_parcel_status_overrides', JSON.stringify(overrides));

      alert(`Đã phê duyệt thành công hồ sơ thửa [${parcel.projectParcelCode || parcel.officialCadastralCode || parcel.id}]!`);
      onBackToHome();
    } catch (e: unknown) {
      console.error('Approve error:', e);
      alert(`❌ Không thể phê duyệt hồ sơ: ${getErrorMessage(e, 'Có lỗi xảy ra khi duyệt hồ sơ.')}`);
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
      } catch (err: unknown) {
        console.warn('Backend reject API notice:', getErrorMessage(err));
      }

      alert(`Đã trả về hồ sơ thửa [${parcel.projectParcelCode || parcel.officialCadastralCode || parcel.id}] với yêu cầu bổ sung: "${reason.trim()}".`);
      onBackToHome();
    } catch (e) {
      console.error('Reject error:', e);
      alert('Có lỗi xảy ra khi từ chối hồ sơ.');
    }
  };

  const handleRevertToDraftFromPage = async () => {
    if (!parcel?.id) return;
    if (user?.role !== 'ZONE_ADMIN' && user?.role !== 'SUPER_ADMIN') {
      alert('Chỉ có Zone Admin hoặc Super Admin mới có quyền chuyển trạng thái hồ sơ.');
      return;
    }
    const confirmRevert = window.confirm(
      `Bạn có chắc chắn muốn chuyển hồ sơ thửa [${parcel.projectParcelCode || parcel.officialCadastralCode || parcel.id}] về trạng thái "Đang làm dở" để chỉnh sửa thông tin?`
    );
    if (!confirmRevert) return;

    try {
      const overridesStr = localStorage.getItem('metro2_parcel_status_overrides');
      if (overridesStr) {
        const overrides = JSON.parse(overridesStr);
        delete overrides[parcel.id];
        localStorage.setItem('metro2_parcel_status_overrides', JSON.stringify(overrides));
      }

      await api.post(`/admin/reports/${parcel.id}/revert-to-draft`, {});

      setIsReadOnly(false);
      if (reportData?.report) {
        reportData.report.status = 'DRAFT';
      }
      parcel.surveyStatus = 'IN_PROGRESS';

      alert(`✅ Đã chuyển hồ sơ thửa [${parcel.projectParcelCode || parcel.officialCadastralCode || parcel.id}] về trạng thái "Đang làm dở" thành công! Biểu mẫu đã được mở để chỉnh sửa.`);
    } catch (e: unknown) {
      console.error('Revert error:', e);
      alert(`❌ Có lỗi xảy ra khi chuyển trạng thái: ${getErrorMessage(e)}`);
    }
  };

  const isAbsenteeReport =
    formData.surveyCaseType === 'ABSENTEE' ||
    formData.isAbsenteeSurvey === true ||
    parcel?.surveyStatus === 'POSTPONED_ABSENT' ||
    reportData?.report?.survey_status === 'POSTPONED_ABSENT' ||
    Boolean(reportData?.absenceLog);

  if (effectiveReadOnly && isAbsenteeReport) {
    return (
      <AbsenteeReviewView
        parcel={parcel}
        unit={unit}
        readOnly={effectiveReadOnly}
        canApproveOrReject={Boolean(canApproveOrReject)}
        onApprove={handleApproveFromPage}
        onReject={handleRejectFromPage}
        onRevertToDraft={canApproveOrReject ? handleRevertToDraftFromPage : undefined}
        onBackToHome={onBackToHome}
      />
    );
  }

  return (
    <div className="min-h-screen w-full max-w-full overflow-x-hidden bg-slate-50/50 flex flex-col">
      {/* Read-Only Mode Banner */}
      <SurveyReviewBanner
        readOnly={effectiveReadOnly}
        canApproveOrReject={canApproveOrReject}
        targetCode={parcel?.projectParcelCode || parcel?.officialCadastralCode || parcel?.id || ''}
        onApprove={handleApproveFromPage}
        onReject={handleRejectFromPage}
        onRevertToDraft={canApproveOrReject ? handleRevertToDraftFromPage : undefined}
        canUnlockEdit={isAdmin && !isSubmittedOrApproved && isViewOnlyForAdmin}
        onUnlockEdit={unlockEdit}
        onBack={onBackToHome}
      />

      {/* Cảnh Báo Bàn Giao Ca: Còn ảnh chưa được tải lên từ thiết bị trước */}
      {unsyncedRemotePhotos && unsyncedRemotePhotos.pendingCount > 0 && photoAudit.unsyncedPhotosCount > 0 && !effectiveReadOnly && (
        <div className="bg-amber-500/10 border-b border-amber-500/30 text-amber-900 px-4 py-3 sticky top-0 z-30 shadow-xs animate-in fade-in">
          <div className="max-w-7xl mx-auto flex items-center justify-between gap-3 text-xs sm:text-sm">
            <div className="flex items-center gap-2.5">
              <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
              <div>
                <span className="font-bold">⚠️ CẢNH BÁO BÀN GIAO CA LIÊN THIẾT BỊ: </span>
                Hồ sơ có <strong className="text-amber-700 underline font-black">{Math.min(unsyncedRemotePhotos.pendingCount, photoAudit.unsyncedPhotosCount)} ảnh</strong> được chụp từ thiết bị của <strong>{unsyncedRemotePhotos.ownerSurveyorName}</strong> chưa được tải lên Cloud. Vui lòng nhắc KSV mở thiết bị đó kết nối mạng để tải ảnh lên trước khi nộp hồ sơ.
              </div>
            </div>
            <button
              type="button"
              onClick={() => setIsPhotoSyncModalOpen(true)}
              className="px-3 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold shrink-0 transition-colors cursor-pointer"
            >
              Kiểm tra ảnh
            </button>
          </div>
        </div>
      )}

      {/* Cảnh Báo Hồ Sơ Bị Trả Về (Dành cho Surveyor khi vào sửa bổ sung) */}
      {(parcel?.surveyStatus === 'REJECTED' || reportData?.report?.status === 'REJECTED') && (
        <div className="bg-red-50 border-b-2 border-red-300 p-3 sm:p-4 animate-in fade-in sticky top-0 z-40 shadow-xs">
          <div className="max-w-7xl mx-auto flex items-start gap-3">
            <div className="p-2 bg-red-100 rounded-xl text-red-700 shrink-0 mt-0.5">
              <AlertOctagon className="w-5 h-5" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h4 className="text-xs sm:text-sm font-black text-red-950 uppercase tracking-wide">
                  🛑 HỒ SƠ BỊ ZONE ADMIN TRẢ VỀ YÊU CẦU ĐO ĐẠC / BỔ SUNG
                </h4>
                <span className="px-2 py-0.5 rounded-full bg-red-200 text-red-900 font-mono text-[10px] font-black">
                  TRẠNG THÁI: REJECTED
                </span>
              </div>
              <div className="mt-1.5 p-2.5 bg-white/90 rounded-xl border border-red-200 text-xs text-red-900">
                <span className="font-bold text-red-700 block mb-0.5">Yêu cầu từ Zone Admin:</span>
                <p className="font-medium italic leading-relaxed">
                  {(
                    reportData?.report?.rejection_reason ||
                    parcel?.rejectionReason ||
                    (reportData?.report?.engineering_recommendations?.startsWith('LÝ DO TRẢ VỀ:')
                      ? reportData.report.engineering_recommendations
                      : '') ||
                    'Vui lòng kiểm tra lại hình ảnh khuyết tật có thước đo mm và số liệu đo đạc theo yêu cầu của Kỹ sư Zone Admin.'
                  ).replace(/^LÝ DO TRẢ VỀ:\s*/i, '')}
                </p>
              </div>
              <p className="text-[11px] text-red-700 mt-1.5 leading-relaxed">
                ℹ️ <strong>Khảo sát viên lưu ý:</strong> Toàn bộ dữ liệu bạn đã nhập trước đó vẫn được giữ nguyên 100%. Vui lòng kiểm tra và bổ sung đúng các mục được yêu cầu ở trên, sau đó di chuyển tới <strong>Bước 8 (Ký Biên Bản)</strong> để bấm <strong>"Nộp Lại"</strong>.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* 8-Step Navigation Header */}
      <StepWizardNav
        onBackToHome={handleSafeBackToHome}
        onOpenPhotoAuditModal={() => {
          setIsPhotoSyncFromSubmit(false);
          setIsPhotoSyncModalOpen(true);
        }}
      />

      {/* Main Step Content Container */}
      <SurveyReadOnlyLock readOnly={effectiveReadOnly} className="flex-1 flex flex-col px-3 sm:px-6 py-6 w-full min-w-0 max-w-full">
        {currentStep === 1 && (
          <Step1_BuildingIdentification
            onFinished={onFinished}
            onBackToHome={handleSafeBackToHome}
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
            readOnly={effectiveReadOnly}
          />
        )}
      </SurveyReadOnlyLock>

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

      {/* Modal Bàn Giao Ca / Tiếp Quản Hồ Sơ Nháp */}
      <HandoverTakeoverModal
        isOpen={isHandoverModalOpen}
        handoverInfo={handoverInfo}
        onTakeover={takeoverDraft}
        onCancel={() => {
          closeHandoverModal();
          onBackToHome();
        }}
      />

      {/* Modal Cảnh Báo Khóa Phiên Khảo Sát (KSV Khác Đang Làm Việc) */}
      <ActiveSurveyorLockedModal
        isOpen={isLockedByOther}
        lockedInfo={lockedInfo}
        onClose={() => {
          closeLockedModal();
          onBackToHome();
        }}
      />

      {/* Modal Kiểm Tra Chi Tiết Trạng Thái Ảnh Cloudflare R2 */}
      <CloudPhotoSyncModal
        isOpen={isPhotoSyncModalOpen}
        onClose={() => setIsPhotoSyncModalOpen(false)}
        allPhotos={photoAudit.allPhotos}
        unsyncedPhotos={photoAudit.unsyncedPhotos}
        syncedPhotos={photoAudit.syncedPhotos}
        parcelCode={parcel?.projectParcelCode || parcel?.officialCadastralCode || formData.projectParcelCode || 'CHƯA_RÕ'}
        onNavigateToStep={(step) => {
          setCurrentStep(step);
          setIsPhotoSyncModalOpen(false);
        }}
        isFromSubmitAttempt={isPhotoSyncFromSubmit}
        onProceedSubmitAnyway={() => {
          setIsPhotoSyncModalOpen(false);
          executeFinalSubmit();
        }}
      />

      {/* Overlay Đồng bộ trước khi thoát */}
      {isExitingWithSync && (
        <div
          role="status"
          aria-live="polite"
          className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-slate-900/80 backdrop-blur-sm p-4 text-center text-white"
        >
          <div className="bg-slate-800/90 border border-slate-700 rounded-2xl p-6 shadow-2xl flex flex-col items-center max-w-sm w-full mx-auto animate-in fade-in zoom-in-95 duration-200">
            <RefreshCw className="w-10 h-10 text-emerald-400 animate-spin mb-4" />
            <p className="text-base font-semibold text-white">Đang upload đồng bộ trước khi thoát</p>
            <p className="text-xs text-slate-400 mt-2">Dữ liệu khảo sát đang được đồng bộ an toàn lên hệ thống...</p>
          </div>
        </div>
      )}
    </div>
  );
};
