import { create } from 'zustand';
import { GisParcel } from '../../../core/types/domain.types';
import { getDefaultInitialFormData } from '../../survey-phase1/store/usePhase1SurveyStore';
import { calculateEcsScore } from '../../survey-phase1/engine/ecsCalculator';
import { calculateViScore } from '../../survey-phase1/engine/viCalculator';
import { CondoMasterFormData, CONDO_USAGE_FUNCTIONS, CONDO_FOUNDATION_TYPES, CONDO_STRUCTURAL_SYSTEMS } from '../types/condo-master.types';
import { surveyDraftService } from '../../survey-phase1/services/surveyDraftService';

interface CondoMasterSurveyStore {
  currentStep: number;
  formData: CondoMasterFormData;
  lastSavedAt: string | null;

  // Trạng thái đồng bộ server
  syncStatus: 'IDLE' | 'SYNCING' | 'SAVED' | 'OFFLINE' | 'ERROR';
  lastSyncedAt: string | null;
  syncVersion: number;
  isDirty: boolean;
  isLockedByOther: boolean;
  lockedInfo: { surveyorName: string; phone?: string; minutesAgo: number; message?: string } | null;
  isHandoverModalOpen: boolean;
  handoverInfo: {
    fromSurveyorName: string;
    fromSurveyorPhone?: string;
    currentStep: number;
    securityCode: string;
    updatedAt: string;
  } | null;

  initializeForm: (parcel: GisParcel) => void;
  updateFormData: (updates: Partial<CondoMasterFormData>) => void;
  setStep: (step: number) => void;
  nextStep: () => void;
  prevStep: () => void;
  syncDraftToServer: () => Promise<void>;
  releaseDraftLock: () => Promise<void>;
  takeoverDraft: (handoverCode: string, note?: string) => Promise<boolean>;
  closeHandoverModal: () => void;
  closeLockedModal: () => void;
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

  // Trạng thái đồng bộ server
  syncStatus: 'IDLE',
  lastSyncedAt: null,
  syncVersion: 1,
  isDirty: false,
  isLockedByOther: false,
  lockedInfo: null,
  isHandoverModalOpen: false,
  handoverInfo: null,

  closeHandoverModal: () => set({ isHandoverModalOpen: false }),
  closeLockedModal: () => set({ isLockedByOther: false, lockedInfo: null }),

  initializeForm: (parcel: GisParcel) => {
    set({ isLockedByOther: false, lockedInfo: null, isHandoverModalOpen: false });
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

    // Tải bản nháp từ server
    surveyDraftService
      .fetchDraft(parcel.id)
      .then((serverRes) => {
        if (serverRes.isLocked) {
          set({
            isLockedByOther: true,
            lockedInfo: {
              surveyorName: serverRes.activeSurveyorName || 'Kỹ sư khác',
              phone: serverRes.activeSurveyorPhone,
              minutesAgo: serverRes.minutesAgo || 1,
              message: serverRes.message,
            },
          });
          return;
        }

        if (serverRes.requiresHandover) {
          set({
            isHandoverModalOpen: true,
            handoverInfo: {
              fromSurveyorName: serverRes.fromSurveyorName || 'Kỹ sư ca trước',
              fromSurveyorPhone: serverRes.fromSurveyorPhone,
              currentStep: serverRes.currentStep || 2,
              securityCode: serverRes.securityCode || '',
              updatedAt: serverRes.updatedAt || '',
            },
          });
          return;
        }

        if (serverRes.draft && serverRes.draft.surveyData) {
          const serverData = serverRes.draft.surveyData;
          const targetStep =
            serverRes.draft.currentStep >= 2 && serverRes.draft.currentStep <= 8
              ? serverRes.draft.currentStep
              : undefined;

          set((state) => {
            const merged = { ...state.formData, ...serverData };
            const recalculatedEcs = calculateEcsScore(merged);
            const recalculatedVi = calculateViScore(merged, recalculatedEcs);
            merged.ecs = recalculatedEcs;
            merged.vi = recalculatedVi;

            return {
              formData: merged,
              currentStep: targetStep !== undefined ? targetStep : state.currentStep,
              syncVersion: serverRes.draft!.syncVersion || state.syncVersion,
              syncStatus: 'SAVED',
              lastSyncedAt: serverRes.draft!.updatedAt
                ? new Date(serverRes.draft!.updatedAt).toLocaleTimeString('vi-VN')
                : new Date().toLocaleTimeString('vi-VN'),
              lastSavedAt: new Date().toLocaleTimeString('vi-VN'),
              isDirty: false,
            };
          });
        }
      })
      .catch((err) => {
        console.warn('[CondoMasterStore] Failed to fetch server draft:', err);
        set({ syncStatus: 'OFFLINE' });
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
      isDirty: true,
    });
  },

  setStep: (step: number) => {
    set({ currentStep: step });
    get().syncDraftToServer();
  },

  nextStep: () => {
    const cur = get().currentStep;
    if (cur < 8) {
      set({ currentStep: cur + 1 });
      get().syncDraftToServer();
    }
  },

  prevStep: () => {
    const cur = get().currentStep;
    if (cur > 1) {
      set({ currentStep: cur - 1 });
      get().syncDraftToServer();
    }
  },

  syncDraftToServer: async () => {
    const { formData, currentStep, syncVersion } = get();
    if (!formData.parcelId) return;

    set({ syncStatus: 'SYNCING' });
    try {
      const res = await surveyDraftService.saveDraft({
        parcelId: formData.parcelId,
        reportType: 'BUILDING_MASTER',
        currentStep,
        surveyData: formData,
        syncVersion,
      });

      set({
        syncStatus: 'SAVED',
        syncVersion: res.syncVersion || syncVersion + 1,
        lastSyncedAt: new Date().toLocaleTimeString('vi-VN'),
        isDirty: false,
      });
    } catch (err: any) {
      console.warn('[CondoMasterStore] Sync draft failed:', err);
      set({ syncStatus: 'ERROR' });
    }
  },

  releaseDraftLock: async () => {
    const { formData } = get();
    if (!formData.parcelId) return;
    try {
      await surveyDraftService.releaseLock(formData.parcelId);
      set({ syncStatus: 'SAVED', lastSyncedAt: new Date().toLocaleTimeString('vi-VN') });
    } catch (err) {
      console.warn('[CondoMasterStore] Release lock failed:', err);
    }
  },

  takeoverDraft: async (handoverCode: string, note?: string) => {
    const { formData } = get();
    if (!formData.parcelId) return false;

    try {
      const res = await surveyDraftService.takeoverDraft({
        parcelId: formData.parcelId,
        handoverCode,
        note,
      });

      if (res && res.draft) {
        const serverData = res.draft.surveyData;
        const targetStep = res.draft.currentStep >= 2 && res.draft.currentStep <= 8 ? res.draft.currentStep : 2;

        set((state) => {
          const merged = { ...state.formData, ...serverData };
          const recalculatedEcs = calculateEcsScore(merged);
          const recalculatedVi = calculateViScore(merged, recalculatedEcs);
          merged.ecs = recalculatedEcs;
          merged.vi = recalculatedVi;

          return {
            formData: merged,
            currentStep: targetStep,
            syncVersion: res.draft.syncVersion,
            syncStatus: 'SAVED',
            lastSyncedAt: new Date().toLocaleTimeString('vi-VN'),
            isHandoverModalOpen: false,
            handoverInfo: null,
            isDirty: false,
          };
        });

        localStorage.setItem(`metro2_condo_master_draft_${formData.parcelId}`, JSON.stringify(serverData));
        return true;
      }
      return false;
    } catch (err: any) {
      console.error('[CondoMasterStore] Takeover failed:', err);
      throw err;
    }
  },

  clearDraft: () => {
    const pid = get().formData.parcelId;
    if (pid) {
      localStorage.removeItem(`metro2_condo_master_draft_${pid}`);
    }
  },
}));
