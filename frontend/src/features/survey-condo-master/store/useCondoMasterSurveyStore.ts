import { create } from 'zustand';
import { GisParcel } from '../../../core/types/domain.types';
import { getDefaultInitialFormData } from '../../survey-phase1/store/usePhase1SurveyStore';
import { calculateEcsScore } from '../../survey-phase1/engine/ecsCalculator';
import { calculateViScore } from '../../survey-phase1/engine/viCalculator';
import { CondoMasterFormData, CONDO_USAGE_FUNCTIONS, CONDO_FOUNDATION_TYPES, CONDO_STRUCTURAL_SYSTEMS } from '../types/condo-master.types';

interface CondoMasterSurveyStore {
  currentStep: number;
  formData: CondoMasterFormData;
  lastSavedAt: string | null;

  initializeForm: (parcel: GisParcel) => void;
  updateFormData: (updates: Partial<CondoMasterFormData>) => void;
  setStep: (step: number) => void;
  nextStep: () => void;
  prevStep: () => void;
  clearDraft: () => void;
}

const getDefaultCondoMasterFormData = (parcelId: string): CondoMasterFormData => {
  const base = getDefaultInitialFormData(parcelId);
  return {
    ...base,
    objectGroup: 'IMPORTANT',
    usageFunction: CONDO_USAGE_FUNCTIONS[0], // Cố định Chung cư/ Toà nhiều căn hộ
    foundationType: CONDO_FOUNDATION_TYPES[0],
    structureSystem: CONDO_STRUCTURAL_SYSTEMS[0],
    unitsPerFloor: 8,
    totalUnitsCount: 32,
    aboveFloors: base.aboveFloors || 5,
    undergroundFloors: base.undergroundFloors || 1,
  };
};

export const useCondoMasterSurveyStore = create<CondoMasterSurveyStore>((set, get) => ({
  currentStep: 2, // Mặc định tiếp nối từ Bước 2
  formData: getDefaultCondoMasterFormData('default'),
  lastSavedAt: null,

  initializeForm: (parcel: GisParcel) => {
    const draftKey = `metro2_condo_master_draft_${parcel.id}`;
    let data = getDefaultCondoMasterFormData(parcel.id);

    try {
      const saved = localStorage.getItem(draftKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.parcelId === parcel.id) {
          data = { ...data, ...parsed };
        }
      }
    } catch (_e) {}

    // Map parcel properties
    data.parcelId = parcel.id;
    data.projectParcelCode = parcel.projectParcelCode || data.projectParcelCode;
    data.officialCadastralCode = parcel.officialCadastralCode || data.officialCadastralCode;
    data.houseNumber = parcel.houseNumber || data.houseNumber;
    data.street = parcel.street || data.street;
    data.ownerName = parcel.ownerName || 'Ban Quản Trị / Ban Quản Lý Tòa Nhà';
    data.usageFunction = CONDO_USAGE_FUNCTIONS[0];
    if (parcel.floorCount) {
      data.aboveFloors = parcel.floorCount;
    }

    if (parcel.coordinates && parcel.coordinates.length > 0) {
      const avgLat = parcel.coordinates.reduce((sum, c) => sum + c[0], 0) / parcel.coordinates.length;
      const avgLng = parcel.coordinates.reduce((sum, c) => sum + c[1], 0) / parcel.coordinates.length;
      data.gpsCoords = { lat: Number(avgLat.toFixed(6)), lng: Number(avgLng.toFixed(6)) };
    }

    // Auto-compute ECS & VI
    const ecs = calculateEcsScore(data);
    const vi = calculateViScore(data, ecs);
    data.ecs = ecs;
    data.vi = vi;

    set({
      currentStep: 2,
      formData: data,
      lastSavedAt: new Date().toLocaleTimeString('vi-VN'),
    });
  },

  updateFormData: (updates: Partial<CondoMasterFormData>) => {
    const prev = get().formData;
    const next = { ...prev, ...updates };

    // Auto recalculate total units if floors or unitsPerFloor changed
    if ('unitsPerFloor' in updates || 'aboveFloors' in updates) {
      const uPerFloor = typeof next.unitsPerFloor === 'number' ? next.unitsPerFloor : 0;
      const floors = typeof next.aboveFloors === 'number' ? next.aboveFloors : 1;
      next.totalUnitsCount = uPerFloor * floors;
    }

    // Recalculate scores
    const ecs = calculateEcsScore(next);
    const vi = calculateViScore(next, ecs);
    next.ecs = ecs;
    next.vi = vi;

    const time = new Date().toLocaleTimeString('vi-VN');

    // Save to local storage
    try {
      if (next.parcelId) {
        localStorage.setItem(`metro2_condo_master_draft_${next.parcelId}`, JSON.stringify(next));
      }
    } catch (_e) {}

    set({
      formData: next,
      lastSavedAt: time,
    });
  },

  setStep: (step: number) => {
    set({ currentStep: step });
  },

  nextStep: () => {
    const cur = get().currentStep;
    if (cur < 8) {
      set({ currentStep: cur + 1 });
    }
  },

  prevStep: () => {
    const cur = get().currentStep;
    if (cur > 1) {
      set({ currentStep: cur - 1 });
    }
  },

  clearDraft: () => {
    const pid = get().formData.parcelId;
    if (pid) {
      localStorage.removeItem(`metro2_condo_master_draft_${pid}`);
    }
  },
}));
