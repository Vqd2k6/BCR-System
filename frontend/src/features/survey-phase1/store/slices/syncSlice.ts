import { getErrorMessage, getErrorStatus, isNotFoundError } from '@/utils/errorUtils';
import type { StateCreator } from 'zustand';
import type { Phase1SurveyStore, SyncSlice } from '../types';
import { surveyDraftService } from '../../services/surveyDraftService';
import { sanitizeSurveyDataForSync, uploadQueue } from '../../../../core/services/uploadQueueService';
import { calculateEcsScore } from '../../engine/ecsCalculator';
import { calculateViScore } from '../../engine/viCalculator';
import { saveSurveyDraft } from '../../../../core/utils/idbDraftStorage';
import { dedupePhase1FormData } from '../../utils/dedupePhase1Photos';
import { saveUploadedPhotoMapping, healLocalPhotoUris, findUnsyncedPhotoPaths } from '../../../../core/storage/offlinePhotoStorage';

// Lần gọi đến khi đang tìm phải chờ kết quả, nếu thoát sớm "Tải lại" sẽ báo không tìm thấy dù chưa tìm xong
let recoveryInFlight: Promise<void> | null = null;

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
  hasServerHydrated: false,
  isLockedByOther: false,
  lockedInfo: null,
  isHandoverModalOpen: false,
  handoverInfo: null,
  unsyncedRemotePhotos: null,
  photoRecovery: { status: 'IDLE', unresolvedCount: 0 },

  setIsDirty: (isDirty: boolean) => set({ isDirty }),
  markServerHydrated: () => set({ hasServerHydrated: true }),
  closeHandoverModal: () => set({ isHandoverModalOpen: false }),
  closeLockedModal: () => set({ isLockedByOther: false, lockedInfo: null }),

  syncDraftToServer: async () => {
    const { formData, currentUnitId, currentStep, syncVersion, isReadOnly, isSubmitted, hasServerHydrated } = get();
    // Chặn tuyệt đối: chỉ đọc / đã nộp / chưa nạp xong dữ liệu thật từ server (tránh ghi đè dữ liệu rỗng lên báo cáo trước)
    if (isReadOnly || isSubmitted || !hasServerHydrated || !formData.parcelId) return;

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
        unsyncedRemotePhotos: res.unsyncedPhotosInfo ?? null,
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

  // Tự cứu ảnh khi vào hồ sơ: máy còn bản gốc thì đẩy lên, không thì nhờ server tìm trên kho lưu trữ.
  // Chế độ chỉ đọc vẫn được chạy: server tự chặn theo trạng thái hồ sơ và ghi vết kiểm toán.
  recoverUnsyncedPhotos: () => {
    if (recoveryInFlight) return recoveryInFlight;

    const { formData, currentUnitId, isSubmitted } = get();
    const parcelId = formData.parcelId;
    if (isSubmitted || !parcelId) return Promise.resolve();
    if (findUnsyncedPhotoPaths(healLocalPhotoUris(formData)).length === 0) return Promise.resolve();

    const run = async () => {
      set({ photoRecovery: { status: 'RUNNING', unresolvedCount: 0 } });
      try {
        await uploadQueue.resumePendingOfflineUploads();
        const res = await surveyDraftService.recoverOrphanPhotos(parcelId, currentUnitId);

        for (const [localId, publicUrl] of Object.entries(res.recovered)) {
          saveUploadedPhotoMapping(localId, publicUrl);
        }

        set((state) => {
          const merged = dedupePhase1FormData(healLocalPhotoUris(state.formData));
          const remaining = findUnsyncedPhotoPaths(merged).length;
          return {
            formData: merged,
            photoRecovery: {
              status: res.status === 'UNAVAILABLE' ? 'UNAVAILABLE' : 'DONE',
              unresolvedCount: res.unresolved.length,
            },
            unsyncedRemotePhotos:
              remaining === 0 || !state.unsyncedRemotePhotos
                ? null
                : { ...state.unsyncedRemotePhotos, pendingCount: remaining },
          };
        });

        if (Object.keys(res.recovered).length > 0) {
          get().saveDraftToStorage();
        }
      } catch (err: unknown) {
        console.error('[SurveyPhase1Store:RecoverPhotos] Lỗi tự khôi phục ảnh:', err);
        set({ photoRecovery: { status: 'UNAVAILABLE', unresolvedCount: 0 } });
      }
    };

    recoveryInFlight = run().finally(() => {
      recoveryInFlight = null;
    });
    return recoveryInFlight;
  },

  releaseDraftLock: async () => {
    const { formData, currentUnitId, isReadOnly, isSubmitted } = get();
    // Chế độ chỉ xem / đã nộp: không phải chủ phiên, không được nhả khóa
    if (isReadOnly || isSubmitted) return;
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

        // Lưu toàn bộ photoMappings từ server vào persistent mapping của thiết bị mới
        const incomingMappings: Record<string, string> = {
          ...(res.photoMappings || {}),
          ...((serverData?._photoMappings as Record<string, string>) || {}),
        };
        for (const [localId, publicUrl] of Object.entries(incomingMappings)) {
          if (localId && publicUrl) {
            saveUploadedPhotoMapping(localId, publicUrl);
          }
        }

        set((state) => {
          const merged = dedupePhase1FormData(healLocalPhotoUris({ ...state.formData, ...serverData }));
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
            unsyncedRemotePhotos: null,
            isDirty: false,
            hasServerHydrated: true,
          };
        });

        const draftKey = `metro2_phase1_draft_${formData.parcelId}${currentUnitId ? `_${currentUnitId}` : ''}`;
        saveSurveyDraft(draftKey, { ...serverData, _savedStep: targetStep });
        void get().recoverUnsyncedPhotos();
        return true;
      }
      return false;
    } catch (err: unknown) {
      console.error('[SurveyPhase1Store] Takeover failed:', err);
      throw err;
    }
  },
});
