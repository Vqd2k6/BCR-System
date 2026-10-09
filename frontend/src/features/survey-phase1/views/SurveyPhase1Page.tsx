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
  PolygonPoint,
  FloorSplitLine,
} from '../types/phase1.types';
import { api } from '../../../services/api';
import { useAuth } from '../../../context/AuthContext';
import confetti from 'canvas-confetti';
import { uploadQueue, countBase64Images, sanitizeSurveyDataForSync } from '../../../core/services/uploadQueueService';

import { AbsenteeReviewView } from './AbsenteeReviewView';
import { CloudPhotoSyncModal } from '../components/CloudPhotoSyncModal';
import { auditSurveyPhotos } from '../utils/photoSyncAudit';
import { AlertOctagon } from 'lucide-react';
import { getEffectiveParcelStatus } from '../../../components/gis/sweep-map/utils/sweepMapHelpers';

interface IdentificationPhotoBackend {
  photo_type: string;
  raw_photo_url?: string;
  is_not_applicable?: boolean;
  facade_polygon_points_json?: PolygonPoint[];
  floor_split_lines_json?: FloorSplitLine[];
}

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
  component_type?: string;
  componentType?: string;
  wall_material?: string;
  wallMaterial?: string;
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
  overview_photos_json?: Array<string | { id?: string; url?: string; caption?: string }>;
  overview_photos?: Array<string | { id?: string; url?: string; caption?: string }>;
  cad_drawing_url?: string;
  cad_sketch_photo_url?: string;
  cad_structural_drawing_url?: string;
  cad_zone_pins_json?: Array<Record<string, unknown>>;
  cad_zone_pins?: Array<Record<string, unknown>>;
  cad_element_pins_json?: Array<Record<string, unknown>>;
  cad_element_pins?: Array<Record<string, unknown>>;
  zones?: DamageZoneData[];
  structural_elements?: Array<Record<string, unknown>>;
}

interface Phase1ServerReportResponse {
  report?: {
    status?: SurveyStatus;
    survey_data_json?: string | Record<string, unknown>;
    engineering_recommendations?: string;
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
    };
    identificationPhotos?: IdentificationPhotoBackend[];
    historicalSensitivity?: {
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
    photo_proof_url?: string;
    [key: string]: unknown;
  };
}

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
  } = usePhase1SurveyStore();
  const { user } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [reportData, setReportData] = useState<Phase1ServerReportResponse | null>(null);
  const [isPhotoSyncModalOpen, setIsPhotoSyncModalOpen] = useState(false);
  const [isPhotoSyncFromSubmit, setIsPhotoSyncFromSubmit] = useState(false);

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

  const effectiveReadOnly = Boolean(readOnly || isSubmittedOrApproved);

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
            const absence = data.absenceLog as { absence_reason?: string; photo_proof_url?: string } | undefined;
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

            if (effectiveReadOnly) {
              if (absence && rep?.is_refused_or_absent) {
                updates.surveyCaseType = 'ABSENTEE';
                updates.isAbsenteeSurvey = true;
                updates.absenteeReason = absence.absence_reason || updates.absenteeReason || '';
                if (absence.photo_proof_url) {
                  updates.absenteeMinutesPhotos = [absence.photo_proof_url];
                }
              }
            } else {
              // Khi ở chế độ chỉnh sửa / tiếp tục khảo sát (Chủ nhà có mặt)
              if (updates.resumedFromAbsentee || parcel.surveyStatus === 'IN_PROGRESS' || rep?.is_refused_or_absent === false) {
                updates.surveyCaseType = 'NORMAL';
                updates.isAbsenteeSurvey = false;
                if (absence) {
                  updates.previousAbsenceLogs = updates.previousAbsenceLogs || [absence];
                  updates.resumedFromAbsentee = true;
                }
              }
            }

            if (rep) {
              if (rep.owner_name) updates.ownerName = rep.owner_name;
              if (rep.owner_phone) updates.ownerPhone = rep.owner_phone;
              if (rep.house_number) updates.houseNumber = rep.house_number;
              if (rep.street) updates.street = rep.street;

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
                rep.identificationPhotos.forEach((p) => {
                  if (p.photo_type === 'P01_HOUSE_NUMBER') {
                    updates.photoP01 = { url: p.raw_photo_url || '', notApplicable: Boolean(p.is_not_applicable) };
                  } else if (p.photo_type === 'P02_MAIN_FACADE') {
                    updates.photoP02 = {
                      ...(updates.photoP02 || {}),
                      url: p.raw_photo_url || '',
                      notApplicable: Boolean(p.is_not_applicable),
                      polygonPoints: p.facade_polygon_points_json || updates.photoP02?.polygonPoints || [],
                      floorSplits: p.floor_split_lines_json || updates.photoP02?.floorSplits || [],
                      widthM: updates.photoP02?.widthM || '',
                      heightM: updates.photoP02?.heightM || '',
                    };
                  } else if (p.photo_type === 'P03_SIDE_OR_REAR') {
                    updates.photoP03 = { ...(updates.photoP03 || {}), url: p.raw_photo_url || '', notApplicable: Boolean(p.is_not_applicable) };
                  } else if (p.photo_type === 'P04_CONTEXT_STREET') {
                    updates.photoP04 = { ...(updates.photoP04 || {}), url: p.raw_photo_url || '', notApplicable: Boolean(p.is_not_applicable) };
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
                updates.floors = updates.floors.map((fl, idx) => {
                  const beFloor = rep.floorSurveys?.[idx];
                  const rawPhotos = fl.overviewPhotos && fl.overviewPhotos.length > 0 
                    ? fl.overviewPhotos 
                    : (beFloor?.overview_photos_json || beFloor?.overview_photos || []);
                  
                  const normalizedPhotos = (Array.isArray(rawPhotos) ? rawPhotos : []).map((p, pIdx) => {
                    if (typeof p === 'string') return { id: `fl_ov_${pIdx}`, url: p, caption: '' };
                    return { id: p.id || `fl_ov_${pIdx}`, url: p.url || '', caption: p.caption || '' };
                  });

                  return {
                    ...fl,
                    overviewPhotos: normalizedPhotos,
                    cadSketchPhotoUrl: fl.cadSketchPhotoUrl || beFloor?.cad_drawing_url || beFloor?.cad_sketch_photo_url || '',
                    cadStructuralSketchPhotoUrl: fl.cadStructuralSketchPhotoUrl || fl.cad_structural_drawing_url || beFloor?.cad_structural_drawing_url || '',
                    cadZonePins: (fl.cadZonePins || beFloor?.cad_zone_pins_json || beFloor?.cad_zone_pins || []) as unknown as FloorSurveyData['cadZonePins'],
                    cadElementPins: (fl.cadElementPins || beFloor?.cad_element_pins_json || beFloor?.cad_element_pins || []) as unknown as FloorSurveyData['cadElementPins'],
                    zones: fl.zones || [],
                    structuralElements: fl.structuralElements || [],
                  };
                });
              } else if (rep.floorSurveys && rep.floorSurveys.length > 0) {
                // Fallback nếu không có survey_data_json: khôi phục từ bảng floor_surveys và damage_zones
                const zonesByFloor = (rep.damageZones || []).reduce<Record<string, DamageZoneData[]>>((acc, z) => {
                  const fid = z.floor_name || z.floor_id || z.floorName || 'default';
                  if (!acc[fid]) acc[fid] = [];
                  acc[fid].push({
                    id: z.id,
                    zoneCode: z.zone_code || z.zoneCode || 'Z-01',
                    floorName: z.floor_name || z.floorName || '',
                    roomName: z.room_name || z.zone_name || z.roomName || 'Không gian chung',
                    componentType: z.component_type || z.componentType || 'WALL',
                    wallMaterial: z.wall_material || z.wallMaterial || '',
                    notes: z.notes || '',
                    overviewPhotos: [],
                    ctxPhotoUrl: z.ctx_photo_url || z.photo_context_url || '',
                    ctxPhotoCode: z.ctx_photo_code || z.ctxPhotoCode || '',
                    hasDamage: (z.defects && z.defects.length > 0) || Boolean(z.has_damage) || Boolean(z.functional_impact_repair_needed),
                    burlandGrade: Number(z.burland_grade ?? z.burlandGrade) || 0,
                    defects: (z.defects || []).map((d): DefectItem => {
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
                    }),
                  });
                  return acc;
                }, {});

                updates.floors = rep.floorSurveys.map((f): FloorSurveyData => {
                  const rawPhotos = f.overview_photos_json || f.overview_photos || [];
                  const normalizedPhotos = (Array.isArray(rawPhotos) ? rawPhotos : []).map((p, pIdx) => {
                    if (typeof p === 'string') return { id: `fl_ov_${pIdx}`, url: p, caption: '' };
                    return { id: p.id || `fl_ov_${pIdx}`, url: p.url || '', caption: p.caption || '' };
                  });

                  return {
                    id: f.id,
                    floorName: f.floor_name || f.floorName || 'Tầng',
                    overviewPhotos: normalizedPhotos,
                    cadSketchPhotoUrl: f.cad_drawing_url || f.cad_sketch_photo_url || '',
                    cadStructuralSketchPhotoUrl: f.cad_structural_drawing_url || '',
                    cadZonePins: (f.cad_zone_pins_json || f.cad_zone_pins || []) as unknown as FloorSurveyData['cadZonePins'],
                    cadElementPins: (f.cad_element_pins_json || f.cad_element_pins || []) as unknown as FloorSurveyData['cadElementPins'],
                    zones: zonesByFloor[f.floor_name || ''] || zonesByFloor[f.floorName || ''] || zonesByFloor[f.id] || f.zones || [],
                    structuralElements: (f.structural_elements || []) as unknown as FloorSurveyData['structuralElements'],
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

            if (Object.keys(updates).length > 0) {
              loadReportData(updates);
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

    const handlePopState = () => {
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
        onBackToHome();
      } else {
        window.history.pushState({ surveySessionActive: true }, '');
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [onBackToHome, effectiveReadOnly, saveDraftToStorage]);

  // Quay về an toàn có xác nhận và lưu nháp
  const handleSafeBackToHome = () => {
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
      onBackToHome();
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
      const cleanFormData = sanitizeSurveyDataForSync(formData);
      console.log('[Phase1] Submitting final survey payload (sanitized):', cleanFormData);

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
      } catch (err: unknown) {
        console.warn('Backend approve API notice:', getErrorMessage(err));
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
        onBackToHome={onBackToHome}
      />
    );
  }

  return (
    <div className="min-h-screen bg-slate-50/50 flex flex-col">
      {/* Read-Only Mode Banner */}
      <SurveyReviewBanner
        readOnly={effectiveReadOnly}
        canApproveOrReject={canApproveOrReject}
        targetCode={parcel?.projectParcelCode || parcel?.officialCadastralCode || parcel?.id || ''}
        onApprove={handleApproveFromPage}
        onReject={handleRejectFromPage}
        onBack={onBackToHome}
      />

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
                  {(reportData?.report?.engineering_recommendations || parcel?.rejectionReason || 'Vui lòng kiểm tra lại hình ảnh khuyết tật có thước đo mm và số liệu đo đạc theo yêu cầu của Kỹ sư Zone Admin.').replace(/^LÝ DO TRẢ VỀ:\s*/i, '')}
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
      <main
        className="flex-1 px-3 sm:px-6 py-6"
        data-survey-readonly={effectiveReadOnly ? 'true' : undefined}
      >
        {effectiveReadOnly && (
          <style>{`
            [data-survey-readonly="true"] input:not([type="button"]):not([type="submit"]):not([type="checkbox"]):not([type="radio"]),
            [data-survey-readonly="true"] textarea,
            [data-survey-readonly="true"] select {
              pointer-events: none !important;
              background-color: #f8fafc !important;
              border-color: #cbd5e1 !important;
              color: #334155 !important;
              cursor: default !important;
              user-select: text !important;
            }
            [data-survey-readonly="true"] input[type="checkbox"],
            [data-survey-readonly="true"] input[type="radio"] {
              pointer-events: none !important;
              cursor: default !important;
            }
          `}</style>
        )}
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
            readOnly={effectiveReadOnly}
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
    </div>
  );
};
