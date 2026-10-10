import { getErrorMessage, getErrorStatus, isNotFoundError } from '@/utils/errorUtils';
import type { StateCreator } from 'zustand';
import type { Phase1SurveyStore, SyncSlice } from '../types';
import { surveyDraftService } from '../../services/surveyDraftService';
import { sanitizeSurveyDataForSync } from '../../../../core/services/uploadQueueService';
import { calculateEcsScore } from '../../engine/ecsCalculator';
import { calculateViScore } from '../../engine/viCalculator';
import { saveSurveyDraft } from '../../../../core/utils/idbDraftStorage';

export const createSyncSlice: StateCreator<
  Phase1SurveyStore,
  [],
  [],
  SyncSlice
> = (set, get) => ({
  syncStatus: 'IDLE',
  lastSyncedAt: null,
  syncVersion: 1,
  isDirty: false,
  isLockedByOther: false,
  lockedInfo: null,
  isHandoverModalOpen: false,
  handoverInfo: null,

  setIsDirty: (isDirty: boolean) => set({ isDirty }),
  closeHandoverModal: () => set({ isHandoverModalOpen: false }),
  closeLockedModal: () => set({ isLockedByOther: false, lockedInfo: null }),

  syncDraftToServer: async () => {
    const { formData, currentUnitId, currentStep, syncVersion, isReadOnly, isSubmitted } = get();
    if (isReadOnly || isSubmitted || !formData.parcelId) return;

    set({ syncStatus: 'SYNCING' });
    try {
      // Làm sạch dữ liệu, loại bỏ toàn bộ chuỗi Base64 để payload draft luôn < 100KB
      const cleanSurveyData = sanitizeSurveyDataForSync(formData);

      const res = await surveyDraftService.saveDraft({
        parcelId: formData.parcelId,
        unitId: currentUnitId,
        reportType: currentUnitId ? 'UNIT_CHILD' : (formData.surveyCaseType === 'APARTMENT' ? 'BUILDING_MASTER' : 'STANDALONE'),
        currentStep,
        surveyData: cleanSurveyData,
        syncVersion,
      });

      set({
        syncStatus: 'SAVED',
        syncVersion: res.syncVersion || syncVersion + 1,
        lastSyncedAt: new Date().toLocaleTimeString('vi-VN'),
        isDirty: false,
      });
    } catch (err: unknown) {
      const is404 = isNotFoundError(err);
      if (is404) {
        // Server chưa có route nháp hoặc đang bảo trì: Giữ trạng thái OFFLINE an toàn (dữ liệu đã lưu trọn vẹn trong IndexedDB)
        set({ syncStatus: 'OFFLINE', isDirty: false });
      } else {
        console.warn('[SurveyPhase1Store] Sync draft to server failed:', err);
        set({ syncStatus: 'ERROR' });
      }
    }
  },

  releaseDraftLock: async () => {
    const { formData, currentUnitId } = get();
    if (!formData.parcelId) return;
    try {
      await surveyDraftService.releaseLock(formData.parcelId, currentUnitId);
      set({ syncStatus: 'SAVED', lastSyncedAt: new Date().toLocaleTimeString('vi-VN') });
    } catch (err) {
      console.warn('[SurveyPhase1Store] Release lock failed:', err);
    }
  },

  takeoverDraft: async (handoverCode: string, note?: string) => {
    const { formData, currentUnitId } = get();
    if (!formData.parcelId) return false;

    try {
      const res = await surveyDraftService.takeoverDraft({
        parcelId: formData.parcelId,
        unitId: currentUnitId,
        handoverCode,
        note,
      });

      if (res && res.draft) {
        const serverData = res.draft.surveyData;
        const targetStep = res.draft.currentStep >= 1 && res.draft.currentStep <= 8 ? res.draft.currentStep : 1;

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

        const draftKey = `metro2_phase1_draft_${formData.parcelId}${currentUnitId ? `_${currentUnitId}` : ''}`;
        saveSurveyDraft(draftKey, { ...serverData, _savedStep: targetStep });
        return true;
      }
      return false;
    } catch (err: unknown) {
      console.error('[SurveyPhase1Store] Takeover failed:', err);
      throw err;
    }
  },
});
