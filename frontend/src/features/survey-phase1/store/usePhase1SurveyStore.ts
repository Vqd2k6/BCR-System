import { create } from 'zustand';
import { Phase1SurveyFormData } from '../types/phase1.types';
import { calculateEcsScore } from '../engine/ecsCalculator';
import { calculateViScore } from '../engine/viCalculator';
import { GisParcel, BuildingUnit } from '../../../core/types/domain.types';
import { validateStep, validateAllSteps, MissingFieldItem } from '../utils/stepValidator';
import { calculateParcelMetroSpatialMetrics } from '../utils/metroSpatialCalculator';
import { saveSurveyDraft, loadSurveyDraft, deleteSurveyDraft } from '../../../core/utils/idbDraftStorage';

export interface Phase1SurveyStore {
  currentStep: number;
  currentUnitId: string | null;
  formData: Phase1SurveyFormData;
  isSavingDraft: boolean;
  lastSavedAt: string | null;
  activeParcel: GisParcel | null;
  missingModal: { isOpen: boolean; missingFields: MissingFieldItem[]; targetStep: number } | null;

  // Actions
  isReadOnly: boolean;
  setIsReadOnly: (isReadOnly: boolean) => void;
  isSubmitted: boolean;
  setIsSubmitted: (isSubmitted: boolean) => void;
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
  loadReportData: (serverFormData: Partial<Phase1SurveyFormData>) => void;
  saveDraftToStorage: () => void;
  clearDraft: (preserveSubmittedStatus?: boolean) => void;
  recalculateScores: () => void;
}

export const getDefaultInitialFormData = (parcelId: string = ''): Phase1SurveyFormData => ({
  parcelId,
  projectParcelCode: '',
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
    left: { type: '', details: '', note: '' },
    right: { type: '', details: '', note: '' },
    back: { type: '', details: '', note: '' },
  },
  surveyCaseType: 'NORMAL',
  isAbsenteeSurvey: false,
  absenteeReason: '',
  absenteeMinutesPhotos: [],
  underConstructionPhotos: [],
  constructionStageNotes: '',
  isVacantLand: false,
  vacantLandStatus: '',
  vacantLandNotes: '',
  vacantLandPhotos: [],

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

  usageFunction: '',
  aboveFloors: 0,
  undergroundFloors: 0,
  constructionAreaM2: '',
  buildingHeightM: '',
  constructionYear: 2026,
  isEstimatedYear: false,
  structureSystem: '',
  foundationType: '',
  foundationSource: 'Bản vẽ hoàn công',
  pileDimensionMm: '',
  pileWidthMm: '',
  pileLengthMm: '',
  foundationDepthM: '',
  foundationDensity: '',
  foundationSpacingM: '',
  foundationNotes: '',
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
    diffSettlement: { level: 0, position: '', photoUrl: '', notes: '' },
    buildingTilt: { level: 0, xPermille: '', yPermille: '', direction: '', photoUrl: '', notes: '' },
    beamSagging: { level: 0, position: '', sagMm: '', description: '', photoUrl: '', notes: '' },
    abnormalCase: { photoUrl: '', notes: '' },
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
  activeParcel: null,
  missingModal: null,
  isReadOnly: false,
  setIsReadOnly: (isReadOnly: boolean) => set({ isReadOnly, missingModal: isReadOnly ? null : get().missingModal }),
  isSubmitted: false,
  setIsSubmitted: (isSubmitted: boolean) => set({ isSubmitted }),

  initializeForm: (parcel: GisParcel, unit?: BuildingUnit | null) => {
    set({ isSubmitted: false });
    const unitId = unit ? unit.id : null;
    const draftKey = `metro2_phase1_draft_${parcel.id}${unitId ? `_${unitId}` : ''}`;
    let initialData = getDefaultInitialFormData(parcel.id);
    let initialStep = 1;

    // 1. Thử khôi phục nhanh đồng bộ từ localStorage (fallback)
    try {
      const saved = localStorage.getItem(draftKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.parcelId === parcel.id) {
          initialData = { ...initialData, ...parsed };
          if (parsed._savedStep && parsed._savedStep >= 1 && parsed._savedStep <= 8) {
            initialStep = parsed._savedStep;
          }
          console.log('[SurveyPhase1Store] Restored fast draft from LocalStorage:', draftKey);
        }
      }
    } catch (e) {
      console.warn('[SurveyPhase1Store] Failed to restore localStorage draft:', e);
    }

    // 2. Map các thông tin định danh thửa đất (nếu draft chưa có hoặc là default thì lấy từ parcel)
    initialData.parcelId = parcel.id;
    initialData.parcelCoordinates = parcel.coordinates;
    initialData.zoneId = parcel.zoneId || (parcel as any).zone_id;
    const realProjectCode = parcel.projectParcelCode || (parcel as any).project_parcel_code || (parcel as any).projectCode;
    if (realProjectCode && (!initialData.projectParcelCode || initialData.projectParcelCode === 'B-XXXXX')) {
      initialData.projectParcelCode = realProjectCode;
    } else if (!initialData.projectParcelCode) {
      initialData.projectParcelCode = realProjectCode || 'B-XXXXX';
    }
    initialData.officialCadastralCode = initialData.officialCadastralCode || parcel.officialCadastralCode || (parcel as any).official_cadastral_code || '';
    initialData.houseNumber = initialData.houseNumber || parcel.houseNumber || (parcel as any).house_number || '';
    initialData.street = initialData.street || parcel.street || '';
    initialData.ownerName = initialData.ownerName || unit?.ownerName || parcel.ownerName || (parcel as any).owner_name || '';
    if (initialData.aboveFloors === undefined || initialData.aboveFloors === null || initialData.aboveFloors === 0 || initialData.aboveFloors === '') {
      initialData.aboveFloors = parcel.floorCount ? parcel.floorCount : '';
    }

    // Tính toán trắc địa không gian chuẩn từ Polygon thửa đất (Phương án A)
    // Tọa độ là Đỉnh ranh polygon gần tim Metro nhất
    if (parcel.coordinates && parcel.coordinates.length > 0) {
      const spatialMetrics = calculateParcelMetroSpatialMetrics(parcel.coordinates);
      initialData.gpsCoords = initialData.gpsCoords?.lat ? initialData.gpsCoords : spatialMetrics.closestVertex;
      initialData.metroOffsetDistance = initialData.metroOffsetDistance || spatialMetrics.metroOffsetDistance;
      initialData.clearanceOffsetDistance = initialData.clearanceOffsetDistance || spatialMetrics.clearanceOffsetDistance;
      initialData.chainage = initialData.chainage || spatialMetrics.chainage;
    }

    // Khởi tạo thông tin riêng cho Căn hộ con nếu có unit
    if (unit) {
      const uCode = (unit as any).unitCode || (unit as any).unit_code || '';
      const rawFloor = (unit as any).floorNumber ?? (unit as any).floor_number ?? (unit as any).floorLevel ?? 1;
      const floorNum = typeof rawFloor === 'number' ? rawFloor : (parseInt(String(rawFloor).replace(/\D/g, ''), 10) || 1);

      initialData.unitId = unit.id;
      // Luôn kế thừa mã căn hộ và tầng lầu từ ngoài hub
      if (uCode) {
        initialData.unitCode = uCode;
      }
      initialData.unitFloorNumber = floorNum;
      initialData.aboveFloors = floorNum;
      initialData.surveyCaseType = 'APARTMENT';

      // Phương án B: Mặc định tick "Không áp dụng" (N/A) đối với P-02 và P-03 ở căn hộ con
      if (!initialData.photoP02?.url) {
        initialData.photoP02 = {
          ...(initialData.photoP02 || { url: '', polygonPoints: [], floorSplits: [], widthM: '', heightM: '' }),
          notApplicable: true,
        };
      }
      if (!initialData.photoP03?.url) {
        initialData.photoP03 = {
          ...(initialData.photoP03 || { url: '' }),
          notApplicable: true,
        };
      }

      initialData.parentBuildingInfo = {
        buildingName: (parcel as any).buildingName || parcel.projectParcelCode || 'Tòa Nhà Chung Cư Cao Tầng',
        projectParcelCode: parcel.projectParcelCode || '',
        officialCadastralCode: parcel.officialCadastralCode || '',
        address: (parcel.houseNumber ? `${parcel.houseNumber}, ` : '') + (parcel.street || ''),
        chainage: initialData.chainage || '',
        metroOffsetDistance: initialData.metroOffsetDistance || '',
        isConfirmed: initialData.parentBuildingInfo?.isConfirmed || false,
      };

      // Đặt tên tầng phù hợp với căn hộ nếu mới khởi tạo
      if (initialData.floors && initialData.floors.length === 1 && initialData.floors[0].id === 'floor_ground') {
        initialData.floors[0].id = `floor_${floorNum}`;
        initialData.floors[0].floorName = `Tầng ${floorNum} - Căn hộ ${uCode || 'Con'}`;
      }
    }

    // Tự động tính toán điểm ban đầu
    const ecs = calculateEcsScore(initialData);
    const vi = calculateViScore(initialData, ecs);
    initialData.ecs = ecs;
    initialData.vi = vi;

    set({
      currentStep: initialStep,
      currentUnitId: unitId,
      formData: initialData,
      activeParcel: parcel,
      missingModal: null,
      lastSavedAt: new Date().toLocaleTimeString('vi-VN'),
    });

    // 3. Tải bất đồng bộ draft đầy đủ (không giới hạn ảnh và bản vẽ CAD) từ IndexedDB
    loadSurveyDraft<any>(draftKey)
      .then((fullDraft) => {
        if (fullDraft && fullDraft.parcelId === parcel.id) {
          const targetStep = fullDraft._savedStep >= 1 && fullDraft._savedStep <= 8 ? fullDraft._savedStep : undefined;
          set((state) => {
            const merged = { ...state.formData, ...fullDraft };
            const recalculatedEcs = calculateEcsScore(merged);
            const recalculatedVi = calculateViScore(merged, recalculatedEcs);
            merged.ecs = recalculatedEcs;
            merged.vi = recalculatedVi;
            return {
              formData: merged,
              currentStep: targetStep !== undefined ? targetStep : state.currentStep,
              lastSavedAt: new Date().toLocaleTimeString('vi-VN'),
            };
          });
          console.log('[SurveyPhase1Store] Full rich draft restored from IndexedDB:', draftKey, 'savedStep:', targetStep);
        }
      })
      .catch((err) => {
        console.warn('[SurveyPhase1Store] IDB load draft error:', err);
      });
  },

  setCurrentStep: (step: number) => {
    if (step >= 1 && step <= 8) {
      if (!get().isReadOnly) {
        get().recalculateScores();
        get().saveDraftToStorage();
      }
      set({ currentStep: step, missingModal: null });
    }
  },

  requestStepNavigation: (targetStep: number) => {
    const { currentStep, formData, isReadOnly } = get();
    if (targetStep === currentStep) return;

    // Khi ở chế độ xem lại (Read-Only) hoặc chuyển về bước trước -> Cho phép chuyển bước tự do không block
    if (isReadOnly || targetStep < currentStep) {
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
    const { currentStep, isReadOnly } = get();
    if (currentStep < 8) {
      if (isReadOnly) {
        get().setCurrentStep(currentStep + 1);
      } else {
        get().requestStepNavigation(currentStep + 1);
      }
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

    // Nếu trường còn thiếu thuộc tầng cụ thể (floorIndex), phát sự kiện chuyển tab tầng trước
    if (item.floorIndex !== undefined) {
      window.dispatchEvent(
        new CustomEvent('ksqh-focus-floor', {
          detail: { floorIndex: item.floorIndex },
        })
      );
    }

    setTimeout(() => {
      let el = document.getElementById(item.fieldId);
      if (!el) {
        el = document.querySelector(`[name="${item.fieldId}"]`) ||
             document.querySelector(`[data-field-id="${item.fieldId}"]`) ||
             document.querySelector(`.${item.fieldId}`) as HTMLElement | null;
      }
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        el.classList.add('ring-4', 'ring-red-400', 'bg-red-50/50', 'transition-all', 'duration-300');
        setTimeout(() => {
          el?.classList.remove('ring-4', 'ring-red-400', 'bg-red-50/50', 'transition-all', 'duration-300');
        }, 3500);
        if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement || el instanceof HTMLSelectElement) {
          el.focus();
        } else {
          const childInput = el.querySelector('input, select, textarea, button') as HTMLElement | null;
          if (childInput) childInput.focus();
        }
      }
    }, item.floorIndex !== undefined ? 400 : 250);
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
    // Chế độ Xem lại (Read-Only): TUYỆT ĐỐI không cho phép thay đổi dữ liệu biểu mẫu đã nộp
    if (get().isReadOnly) return;

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

  loadReportData: (serverFormData) => {
    set((state) => {
      const newFormData = { ...state.formData, ...serverFormData };
      // Tự động tính lại điểm ECS & VI khi tải dữ liệu từ server
      const ecs = calculateEcsScore(newFormData);
      const vi = calculateViScore(newFormData, ecs);
      newFormData.ecs = ecs;
      newFormData.vi = vi;

      return { formData: newFormData };
    });
  },

  recalculateScores: () => {
    const { formData } = get();
    const ecs = calculateEcsScore(formData);
    const vi = calculateViScore(formData, ecs);
    set({ formData: { ...formData, ecs, vi } });
  },

  saveDraftToStorage: () => {
    if (get().isReadOnly || get().isSubmitted) return;
    const { formData, currentUnitId, currentStep } = get();
    if (!formData.parcelId) return;

    const draftKey = `metro2_phase1_draft_${formData.parcelId}${currentUnitId ? `_${currentUnitId}` : ''}`;
    const payloadWithStep = {
      ...formData,
      _savedStep: currentStep,
    };

    // 1. Lưu bản đầy đủ không giới hạn vào IndexedDB (lưu được ảnh Base64 lớn và CAD)
    saveSurveyDraft(draftKey, payloadWithStep)
      .then(() => {
        set({ lastSavedAt: new Date().toLocaleTimeString('vi-VN') });
      })
      .catch((e) => {
        console.warn('[SurveyPhase1Store] IDB save failed:', e);
      });

    // 2. Lưu bản compact vào localStorage để dự phòng
    try {
      const compactData = {
        ...payloadWithStep,
        floors: (payloadWithStep.floors || []).map((f) => ({
          ...f,
          cadSketchPhotoUrl: f.cadSketchPhotoUrl && f.cadSketchPhotoUrl.length > 50000 ? '' : f.cadSketchPhotoUrl,
          cadStructuralSketchPhotoUrl: f.cadStructuralSketchPhotoUrl && f.cadStructuralSketchPhotoUrl.length > 50000 ? '' : f.cadStructuralSketchPhotoUrl,
          zones: (f.zones || []).map((z) => ({
            ...z,
            ctxPhotoUrl: z.ctxPhotoUrl && z.ctxPhotoUrl.length > 50000 ? '' : z.ctxPhotoUrl,
            defects: (z.defects || []).map((d) => ({
              ...d,
              cuPhotoUrl: d.cuPhotoUrl && d.cuPhotoUrl.length > 50000 ? '' : d.cuPhotoUrl,
            })),
          })),
          structuralElements: (f.structuralElements || []).map((e) => ({
            ...e,
            ctxPhotoUrl: e.ctxPhotoUrl && e.ctxPhotoUrl.length > 50000 ? '' : e.ctxPhotoUrl,
            defects: (e.defects || []).map((d) => ({
              ...d,
              cuPhotoUrl: d.cuPhotoUrl && d.cuPhotoUrl.length > 50000 ? '' : d.cuPhotoUrl,
            })),
          })),
        })),
      };
      localStorage.setItem(draftKey, JSON.stringify(compactData));
      set({ lastSavedAt: new Date().toLocaleTimeString('vi-VN') });

      // 3. Đồng bộ trạng thái 'IN_PROGRESS' vào overrides để toàn bộ App và Map GIS nhận biết ngay lập tức
      try {
        const overridesStr = localStorage.getItem('metro2_parcel_status_overrides') || '{}';
        const overrides = JSON.parse(overridesStr);
        let s = 'IN_PROGRESS';
        if (formData.isAbsenteeSurvey || formData.surveyCaseType === 'ABSENTEE') {
          s = 'POSTPONED_ABSENT';
        } else if (formData.surveyCaseType === 'UNDER_CONSTRUCTION') {
          s = 'UNDER_CONSTRUCTION';
        }
        overrides[formData.parcelId] = {
          ...(overrides[formData.parcelId] || {}),
          status: s,
          updatedAt: new Date().toISOString(),
        };
        localStorage.setItem('metro2_parcel_status_overrides', JSON.stringify(overrides));
      } catch (_err) {}
    } catch (_err) {
      console.warn('[SurveyPhase1Store] LocalStorage quota reached, relied on IndexedDB');
    }
  },

  clearDraft: (preserveSubmittedStatus: boolean = true) => {
    set({ isSubmitted: true });
    const { formData, currentUnitId } = get();
    if (!formData.parcelId) return;
    const draftKey = `metro2_phase1_draft_${formData.parcelId}${currentUnitId ? `_${currentUnitId}` : ''}`;
    deleteSurveyDraft(draftKey);
    localStorage.removeItem(draftKey);

    try {
      const overridesStr = localStorage.getItem('metro2_parcel_status_overrides') || '{}';
      const overrides = JSON.parse(overridesStr);
      if (overrides[formData.parcelId]) {
        if (preserveSubmittedStatus && (overrides[formData.parcelId].status === 'SUBMITTED' || overrides[formData.parcelId].status === 'APPROVED')) {
          // Bảo lưu trạng thái đã nộp / đã duyệt
        } else {
          delete overrides[formData.parcelId];
        }
        localStorage.setItem('metro2_parcel_status_overrides', JSON.stringify(overrides));
      }
    } catch (_err) {}
  },
}));
