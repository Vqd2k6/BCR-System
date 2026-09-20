import { create } from 'zustand';
import { Phase1SurveyFormData } from '../types/phase1.types';
import { calculateEcsScore } from '../engine/ecsCalculator';
import { calculateViScore } from '../engine/viCalculator';
import { GisParcel, BuildingUnit } from '../../../core/types/domain.types';

export interface Phase1SurveyStore {
  currentStep: number;
  formData: Phase1SurveyFormData;
  isSavingDraft: boolean;
  lastSavedAt: string | null;

  // Actions
  initializeForm: (parcel: GisParcel, unit?: BuildingUnit | null) => void;
  setCurrentStep: (step: number) => void;
  nextStep: () => void;
  prevStep: () => void;
  updateFormData: (updater: Partial<Phase1SurveyFormData> | ((prev: Phase1SurveyFormData) => Phase1SurveyFormData)) => void;
  saveDraftToStorage: () => void;
  clearDraft: () => void;
  recalculateScores: () => void;
}

const getDefaultInitialFormData = (parcelId: string = ''): Phase1SurveyFormData => ({
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
  gpsCoords: { lat: 10.7769, lng: 106.7009 },
  adjacentBuildings: {
    left: { type: 'TOWNHOUSE', details: 'Nhà phố bê tông 3 tầng', note: '' },
    right: { type: 'TOWNHOUSE', details: 'Nhà phố bê tông 2 tầng', note: '' },
    back: { type: 'EMPTY_LAND', details: 'Đất trống / Hẻm kỹ thuật', note: '' },
  },

  photoP01: { url: '', notApplicable: false },
  photoP02: {
    url: '',
    notApplicable: false,
    polygonPoints: [],
    floorSplits: [],
    widthM: '',
    heightM: '',
  },
  photoP03: { url: '', notApplicable: false },
  photoP04: { url: '', notApplicable: false },

  usageFunction: 'Nhà ở riêng lẻ (Townhouse)',
  aboveFloors: 1,
  undergroundFloors: 0,
  constructionYear: 2010,
  isEstimatedYear: false,
  structureSystem: 'Khung BTCT toàn khối + Tường gạch chèn',
  foundationType: 'Móng cọc BTCT ép',
  pileDimensionMm: 250,
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
      zones: [],
    },
  ],

  burlandSummary: {
    predominantGrade: 0,
    localMaxGrade: 0,
    governingZoneCode: 'Z-01',
    governingZoneDescription: 'Mảng tường phòng khách',
    representativeness: 'GLOBAL',
    structuralFlagLevel: 'NONE',
    needStructuralEngineerReview: false,
  },

  settlementTilt: {
    diffSettlement: { status: 'NONE', position: '' },
    buildingTilt: { status: 'NONE', xPermille: '', yPermille: '' },
    floorTilt: { status: 'NONE', permille: '' },
    beamSagging: { status: 'NONE', position: '' },
    dataSource: ['Quan sát'],
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
    preparedBy: { fullName: 'Nguyễn Văn Khảo Sát', title: 'Cán bộ kỹ thuật hiện trường', date: new Date().toISOString().split('T')[0], signatureDataUrl: '' },
    checkedBy: { fullName: 'Trần Kiểm Tra', title: 'Kỹ sư trưởng nhóm', date: new Date().toISOString().split('T')[0], signatureDataUrl: '' },
    ownerRepresentative: { fullName: '', role: 'Chủ hộ', date: new Date().toISOString().split('T')[0], signatureDataUrl: '' },
  },
});

export const usePhase1SurveyStore = create<Phase1SurveyStore>((set, get) => ({
  currentStep: 1,
  formData: getDefaultInitialFormData(),
  isSavingDraft: false,
  lastSavedAt: null,

  initializeForm: (parcel: GisParcel, unit?: BuildingUnit | null) => {
    const draftKey = `metro2_phase1_draft_${parcel.id}${unit ? `_${unit.id}` : ''}`;
    let initialData = getDefaultInitialFormData(parcel.id);

    // Thử khôi phục từ draft lưu cục bộ
    try {
      const saved = localStorage.getItem(draftKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.parcelId === parcel.id) {
          initialData = { ...initialData, ...parsed };
          console.log('[SurveyPhase1Store] Restored form data from LocalStorage draft');
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
    if (parcel.floorCount) {
      initialData.aboveFloors = parcel.floorCount;
    }

    // Tự động tính toán điểm ban đầu
    const ecs = calculateEcsScore(initialData);
    const vi = calculateViScore(initialData, ecs);
    initialData.ecs = ecs;
    initialData.vi = vi;

    set({
      currentStep: 1,
      formData: initialData,
      lastSavedAt: new Date().toLocaleTimeString('vi-VN'),
    });
  },

  setCurrentStep: (step: number) => {
    if (step >= 1 && step <= 9) {
      get().recalculateScores();
      get().saveDraftToStorage();
      set({ currentStep: step });
    }
  },

  nextStep: () => {
    const { currentStep } = get();
    if (currentStep < 9) {
      get().setCurrentStep(currentStep + 1);
    }
  },

  prevStep: () => {
    const { currentStep } = get();
    if (currentStep > 1) {
      get().setCurrentStep(currentStep - 1);
    }
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
    const { formData } = get();
    if (!formData.parcelId) return;

    try {
      const draftKey = `metro2_phase1_draft_${formData.parcelId}`;
      localStorage.setItem(draftKey, JSON.stringify(formData));
      set({ lastSavedAt: new Date().toLocaleTimeString('vi-VN') });
    } catch (e) {
      console.warn('[SurveyPhase1Store] Failed to save draft:', e);
    }
  },

  clearDraft: () => {
    const { formData } = get();
    if (!formData.parcelId) return;
    const draftKey = `metro2_phase1_draft_${formData.parcelId}`;
    localStorage.removeItem(draftKey);
  },
}));
