import { create } from 'zustand';
import { Phase1SurveyFormData } from '../types/phase1.types';
import { calculateEcsScore } from '../engine/ecsCalculator';
import { calculateViScore } from '../engine/viCalculator';
import { GisParcel, BuildingUnit } from '../../../core/types/domain.types';
import { validateStep, validateAllSteps, MissingFieldItem } from '../utils/stepValidator';
import { calculateParcelMetroSpatialMetrics } from '../utils/metroSpatialCalculator';

export interface Phase1SurveyStore {
  currentStep: number;
  currentUnitId: string | null;
  formData: Phase1SurveyFormData;
  isSavingDraft: boolean;
  lastSavedAt: string | null;
  missingModal: { isOpen: boolean; missingFields: MissingFieldItem[]; targetStep: number } | null;

  // Actions
  initializeForm: (parcel: GisParcel, unit?: BuildingUnit | null) => void;
  setCurrentStep: (step: number) => void;
  requestStepNavigation: (targetStep: number) => void;
  nextStep: () => void;
  prevStep: () => void;
  closeMissingModal: () => void;
  proceedAnyway: () => void;
  focusMissingField: (item: MissingFieldItem) => void;
  validateForFinalSubmit: () => boolean;
  updateFormData: (updater: Partial<Phase1SurveyFormData> | ((prev: Phase1SurveyFormData) => Phase1SurveyFormData)) => void;
  saveDraftToStorage: () => void;
  clearDraft: () => void;
  recalculateScores: () => void;
}

export const getDefaultInitialFormData = (parcelId: string = ''): Phase1SurveyFormData => ({
  parcelId,
  projectParcelCode: 'B-XXXXX',
  officialCadastralCode: '',
  buildingName: '',
  houseNumber: '',
  street: '',
  ownerName: '',
  ownerPhone: '',
  objectGroup: 'GENERAL',
  chainage: 'Km 0+000',
  metroOffsetDistance: '15.0m',
  clearanceOffsetDistance: '5.2m',
  gpsCoords: { lat: 10.7769, lng: 106.7009 },
  adjacentBuildings: {
    left: { type: 'Nhà phố / Nhà dân', details: 'Nhà phố / Nhà dân', note: '' },
    right: { type: 'Nhà phố / Nhà dân', details: 'Nhà phố / Nhà dân', note: '' },
    back: { type: 'Đất trống', details: 'Đất trống', note: '' },
  },
  surveyCaseType: 'NORMAL',
  isAbsenteeSurvey: false,
  absenteeReason: '',
  absenteeMinutesPhotos: [],
  underConstructionPhotos: [],
  constructionStageNotes: '',

  photoP01: { url: '', notApplicable: false },
  photoP02: {
    url: '',
    notApplicable: false,
    polygonPoints: [],
    floorSplits: [],
    widthM: '',
    heightM: '',
  },
  photoP03: { url: '', notApplicable: false, tag: 'Bên hông trái', additionalPhotos: [] },
  photoP04: { url: '', notApplicable: false },

  usageFunction: 'Nhà ở gia đình',
  aboveFloors: 0,
  undergroundFloors: 0,
  constructionYear: 2026,
  isEstimatedYear: false,
  structureSystem: 'RC - Khung BTCT toàn khối',
  foundationType: 'PC - Cọc ép BTCT',
  pileDimensionMm: '',
  asBuiltDrawingPhotoUrl: '',
  asBuiltDrawingFiles: [],
  foundationCatScore: 3,

  historyInterview: {
    renovationLoad: 0,
    majorRepair: 0,
    pastSettlement: 0,
    neighborDamage: 0,
    fireFloodIncident: 0,
    sensitiveEquipment: { has: false, description: '' },
    usageStatus: 'Đầy đủ 100%',
    continuousOperation247: false,
  },

  floors: [
    {
      id: 'floor_ground',
      floorName: 'Tầng trệt',
      overviewPhotos: [],
      cadSketchPhotoUrl: '',
      cadZonePins: [],
      cadElementPins: [],
      zones: [],
      structuralElements: [],
    },
  ],

  burlandSummary: {
    predominantGrade: 0,
    localMaxGrade: 0,
    governingZoneCode: 'Z-01',
    governingZoneDescription: '',
    representativeness: 'GLOBAL',
    structuralFlagLevel: 'NONE',
    needStructuralEngineerReview: false,
  },

  settlementTilt: {
    diffSettlement: { level: 0, position: '' },
    buildingTilt: { level: 0, xPermille: '', yPermille: '', direction: '' },
    beamSagging: { level: 0, position: '', sagMm: '', description: '' },
    dataSource: ['Quan sát trực quan'],
    reliability: 'HIGH',
    needAdditionalMonitoring: { required: false, notes: '' },
  },

  surveyScope: {
    externalFront: true,
    surveyedFloors: ['Tầng trệt'],
    roofTerrace: false,
    basement: false,
    backyardOuthouse: false,
  },
  accessLimitation: {
    type: 'FULL_100',
    restrictedAreas: [],
    restrictedFloorLevels: [],
    mainReason: '',
    notes: '',
  },
  gisMutationConfirmed: {
    type: 'MATCH',
    notes: '',
  },

  gateDecision: {
    decision: 'ALLOW',
    reason: '',
  },

  ecs: {
    e1: 0,
    e2: 0,
    e3: 0,
    e4: 0,
    e5: 0,
    e6: 0,
    totalEcs: 0,
    ecsClass: 'GOOD',
    engineeringJudgement: { action: 'KEEP', reason: '' },
    isOverrideLocked: false,
  },
  vi: {
    v1: 1,
    v2: 2,
    v3: 2,
    v4: 2,
    v5: 1,
    v6: 1,
    totalVi: 9,
    viAvg: 1.5,
    viClass: 'LOW',
    engineeringJudgement: { action: 'KEEP', reason: '' },
  },

  executiveSummary: {
    keyRisksDefectsText: '',
    specificRecommendationsText: '',
    constructionImpactStatus: 'PENDING',
    braStatus: 'PENDING',
  },

  signatures: {
    ownerFeedback: '',
    preparedBy: {
      fullName: '',
      title: 'Kỹ sư khảo sát hiện trường',
      date: new Date().toISOString().split('T')[0],
      photoUrl: '',
    },
    checkedBy: {
      fullName: '',
      title: 'Quản trị viên khu vực (Zone Admin)',
      date: new Date().toISOString().split('T')[0],
      photoUrl: '',
    },
    ownerRepresentative: {
      fullName: '',
      role: 'Chủ hộ / Đại diện',
      date: new Date().toISOString().split('T')[0],
      photoUrl: '',
    },
    workingMinutesPhotos: [],
  },
});

export const usePhase1SurveyStore = create<Phase1SurveyStore>((set, get) => ({
  currentStep: 1,
  currentUnitId: null,
  formData: getDefaultInitialFormData(),
  isSavingDraft: false,
  lastSavedAt: null,
  missingModal: null,

  initializeForm: (parcel: GisParcel, unit?: BuildingUnit | null) => {
    const unitId = unit ? unit.id : null;
    const draftKey = `metro2_phase1_draft_${parcel.id}${unitId ? `_${unitId}` : ''}`;
    let initialData = getDefaultInitialFormData(parcel.id);

    // Thử khôi phục từ draft lưu cục bộ
    try {
      const saved = localStorage.getItem(draftKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.parcelId === parcel.id) {
          initialData = { ...initialData, ...parsed };
          console.log('[SurveyPhase1Store] Restored form data from LocalStorage draft:', draftKey);
        }
      }
    } catch (e) {
      console.warn('[SurveyPhase1Store] Failed to restore draft:', e);
    }

    // Luôn map thông tin thửa mới nhất
    initialData.parcelId = parcel.id;
    initialData.projectParcelCode = parcel.projectParcelCode || initialData.projectParcelCode;
    initialData.officialCadastralCode = parcel.officialCadastralCode || initialData.officialCadastralCode;
    initialData.houseNumber = parcel.houseNumber || initialData.houseNumber;
    initialData.street = parcel.street || initialData.street;
    initialData.ownerName = unit?.ownerName || parcel.ownerName || initialData.ownerName;
    if (parcel.floorCount !== undefined && parcel.floorCount !== null) {
      initialData.aboveFloors = parcel.floorCount;
    }

    // Tính toán trắc địa không gian chuẩn từ Polygon thửa đất (Phương án A)
    if (parcel.coordinates && parcel.coordinates.length > 0) {
      const spatialMetrics = calculateParcelMetroSpatialMetrics(parcel.coordinates);
      initialData.gpsCoords = spatialMetrics.centroid;
      initialData.metroOffsetDistance = spatialMetrics.metroOffsetDistance;
      initialData.clearanceOffsetDistance = spatialMetrics.clearanceOffsetDistance;
      initialData.chainage = spatialMetrics.chainage;
    }

    // Tự động tính toán điểm ban đầu
    const ecs = calculateEcsScore(initialData);
    const vi = calculateViScore(initialData, ecs);
    initialData.ecs = ecs;
    initialData.vi = vi;

    set({
      currentStep: 1,
      currentUnitId: unitId,
      formData: initialData,
      missingModal: null,
      lastSavedAt: new Date().toLocaleTimeString('vi-VN'),
    });
  },

  setCurrentStep: (step: number) => {
    if (step >= 1 && step <= 8) {
      get().recalculateScores();
      get().saveDraftToStorage();
      set({ currentStep: step, missingModal: null });
    }
  },

  requestStepNavigation: (targetStep: number) => {
    const { currentStep, formData } = get();
    if (targetStep === currentStep) return;

    if (targetStep < currentStep) {
      get().setCurrentStep(targetStep);
      return;
    }

    // Navigating forward -> validate current step
    const validation = validateStep(currentStep, formData);
    if (!validation.isValid) {
      set({
        missingModal: {
          isOpen: true,
          missingFields: validation.missingFields,
          targetStep,
        },
      });
      return;
    }

    get().setCurrentStep(targetStep);
  },

  nextStep: () => {
    const { currentStep } = get();
    if (currentStep < 8) {
      get().requestStepNavigation(currentStep + 1);
    }
  },

  prevStep: () => {
    const { currentStep } = get();
    if (currentStep > 1) {
      get().setCurrentStep(currentStep - 1);
    }
  },

  closeMissingModal: () => {
    set({ missingModal: null });
  },

  proceedAnyway: () => {
    const { missingModal } = get();
    if (missingModal) {
      const hasBlocking = missingModal.missingFields.some((f) => f.isBlocking);
      if (hasBlocking) {
        return;
      }
      const target = missingModal.targetStep;
      get().saveDraftToStorage();
      set({ missingModal: null });
      if (target >= 1 && target <= 8) {
        get().setCurrentStep(target);
      }
    }
  },

  focusMissingField: (item: MissingFieldItem) => {
    const { currentStep } = get();
    set({ missingModal: null });

    if (item.step !== currentStep) {
      get().setCurrentStep(item.step);
    }

    setTimeout(() => {
      const el = document.getElementById(item.fieldId);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        el.classList.add('ring-4', 'ring-red-400', 'bg-red-50/50');
        setTimeout(() => {
          el.classList.remove('ring-4', 'ring-red-400', 'bg-red-50/50');
        }, 3500);
        if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement) {
          el.focus();
        }
      }
    }, 250);
  },

  validateForFinalSubmit: () => {
    const { formData } = get();
    const validation = validateAllSteps(formData);
    if (!validation.isValid) {
      set({
        missingModal: {
          isOpen: true,
          missingFields: validation.missingFields,
          targetStep: 10,
        },
      });
      return false;
    }
    return true;
  },

  updateFormData: (updater) => {
    set((state) => {
      const newFormData = typeof updater === 'function' ? updater(state.formData) : { ...state.formData, ...updater };
      // Tự động tính lại điểm ECS & VI khi form thay đổi
      const ecs = calculateEcsScore(newFormData);
      const vi = calculateViScore(newFormData, ecs);
      newFormData.ecs = ecs;
      newFormData.vi = vi;

      return { formData: newFormData };
    });

    // Auto save draft debounced
    get().saveDraftToStorage();
  },

  recalculateScores: () => {
    const { formData } = get();
    const ecs = calculateEcsScore(formData);
    const vi = calculateViScore(formData, ecs);
    set({ formData: { ...formData, ecs, vi } });
  },

  saveDraftToStorage: () => {
    const { formData, currentUnitId } = get();
    if (!formData.parcelId) return;

    const draftKey = `metro2_phase1_draft_${formData.parcelId}${currentUnitId ? `_${currentUnitId}` : ''}`;
    try {
      localStorage.setItem(draftKey, JSON.stringify(formData));
      set({ lastSavedAt: new Date().toLocaleTimeString('vi-VN') });
    } catch (e) {
      console.warn('[SurveyPhase1Store] LocalStorage full, saving essential fields:', e);
      try {
        const compactData = {
          ...formData,
          photoP01: { ...formData.photoP01, url: formData.photoP01.url?.length > 100000 ? '' : formData.photoP01.url },
          photoP02: { ...formData.photoP02, url: formData.photoP02.url?.length > 100000 ? '' : formData.photoP02.url },
          photoP04: { ...formData.photoP04, url: formData.photoP04.url?.length > 100000 ? '' : formData.photoP04.url },
        };
        localStorage.setItem(draftKey, JSON.stringify(compactData));
        set({ lastSavedAt: new Date().toLocaleTimeString('vi-VN') });
      } catch (_err) {
        console.error('[SurveyPhase1Store] Could not save draft:', _err);
      }
    }
  },

  clearDraft: () => {
    const { formData, currentUnitId } = get();
    if (!formData.parcelId) return;
    const draftKey = `metro2_phase1_draft_${formData.parcelId}${currentUnitId ? `_${currentUnitId}` : ''}`;
    localStorage.removeItem(draftKey);
  },
}));
