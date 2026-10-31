import type { StateCreator } from 'zustand';
import type { Phase1SurveyStore, FormSlice } from '../types';
import type { Phase1SurveyFormData } from '../../types/phase1.types';
import { getDefaultInitialFormData } from '../initialFormData';
import type { GisParcel, BuildingUnit } from '../../../../core/types/domain.types';
import { calculateEcsScore } from '../../engine/ecsCalculator';
import { calculateViScore } from '../../engine/viCalculator';
import { calculateParcelMetroSpatialMetrics } from '../../utils/metroSpatialCalculator';
import { saveSurveyDraft, loadSurveyDraft, deleteSurveyDraft } from '../../../../core/utils/idbDraftStorage';
import { healLocalPhotoUris, saveUploadedPhotoMapping, findUnsyncedPhotoPaths } from '../../../../core/storage/offlinePhotoStorage';
import { surveyDraftService } from '../../services/surveyDraftService';
import { dedupePhase1FormData } from '../../utils/dedupePhase1Photos';
import { isCadastralOwnerPlaceholder, resolveOwnerName } from '../../utils/stepValidator';

export const createFormSlice: StateCreator<
  Phase1SurveyStore,
  [],
  [],
  FormSlice
> = (set, get) => ({
  currentUnitId: null,
  formData: getDefaultInitialFormData(),
  isSavingDraft: false,
  lastSavedAt: null,
  activeParcel: null,
  isReadOnly: false,
  isSubmitted: false,

  setIsReadOnly: (isReadOnly: boolean) =>
    set({ isReadOnly, missingModal: isReadOnly ? null : get().missingModal }),

  setIsSubmitted: (isSubmitted: boolean) => set({ isSubmitted }),

  initializeForm: (parcel: GisParcel, unit?: BuildingUnit | null, options?: { readOnly?: boolean }) => {
    const isSubmittedOrApproved =
      parcel.surveyStatus === 'SUBMITTED' ||
      parcel.surveyStatus === 'APPROVED' ||
      parcel.surveyStatus === 'PHASE2_COMPLETED' ||
      parcel.surveyStatus === 'APPROVED_PHASE2' ||
      parcel.survey_status === 'SUBMITTED' ||
      parcel.survey_status === 'APPROVED' ||
      Boolean(unit && (unit.status === 'SUBMITTED' || unit.status === 'APPROVED' || unit.status === 'COMPLETED'));

    set({
      isReadOnly: Boolean(options?.readOnly || get().isReadOnly || isSubmittedOrApproved),
      isSubmitted: isSubmittedOrApproved,
      isLockedByOther: false,
      lockedInfo: null,
      isHandoverModalOpen: false,
      // Chưa nạp xong dữ liệu thật từ server -> chưa được phép đồng bộ nháp
      hasServerHydrated: false,
    });
    const unitId = unit ? unit.id : null;
    const draftKey = `metro2_phase1_draft_${parcel.id}${unitId ? `_${unitId}` : ''}`;
    let initialData = getDefaultInitialFormData(parcel.id);
    let initialStep = 1;

    // 1. Thử khôi phục nhanh đồng bộ từ localStorage (chỉ khi không ở chế độ Read-Only và chưa nộp)
    if (!get().isReadOnly && !isSubmittedOrApproved) {
      try {
        const saved = localStorage.getItem(draftKey);
        if (saved) {
          const parsed = JSON.parse(saved);
          if (parsed.parcelId === parcel.id) {
            initialData = healLocalPhotoUris({ ...initialData, ...parsed });
            if (parsed._savedStep && parsed._savedStep >= 1 && parsed._savedStep <= 8) {
              initialStep = parsed._savedStep;
            }
            console.log('[SurveyPhase1Store] Restored fast draft from LocalStorage:', draftKey);
          }
        }
      } catch (e: unknown) {
        console.warn('[SurveyPhase1Store] Failed to restore localStorage draft:', e);
      }
    }

    // 2. Map các thông tin định danh thửa đất (nếu draft chưa có hoặc là default thì lấy từ parcel)
    initialData.parcelId = parcel.id;
    initialData.parcelCoordinates = parcel.coordinates;
    initialData.zoneId = parcel.zoneId || parcel.zone_id;
    const realProjectCode = parcel.projectParcelCode || parcel.project_parcel_code || parcel.projectCode;
    if (realProjectCode && (!initialData.projectParcelCode || initialData.projectParcelCode === 'B-XXXXX')) {
      initialData.projectParcelCode = realProjectCode;
    } else if (!initialData.projectParcelCode) {
      initialData.projectParcelCode = realProjectCode || 'B-XXXXX';
    }
    const realCadastralCode = parcel.officialCadastralCode || parcel.official_cadastral_code || (parcel as unknown as { cadastralCode?: string; cadastral_code?: string }).cadastralCode || (parcel as unknown as { cadastralCode?: string; cadastral_code?: string }).cadastral_code;
    if (realCadastralCode) {
      initialData.officialCadastralCode = realCadastralCode;
    } else if (!initialData.officialCadastralCode) {
      initialData.officialCadastralCode = '';
    }
    initialData.houseNumber = initialData.houseNumber || parcel.houseNumber || parcel.house_number || '';
    initialData.street = initialData.street || parcel.street || '';
    const rawIncomingOwner = unit?.ownerName || parcel.ownerName || parcel.owner_name || '';
    initialData.ownerName = resolveOwnerName(
      isCadastralOwnerPlaceholder(initialData.ownerName) ? '' : initialData.ownerName,
      isCadastralOwnerPlaceholder(rawIncomingOwner) ? '' : rawIncomingOwner
    );
    initialData.ownerPhone = initialData.ownerPhone || unit?.ownerPhone || unit?.owner_phone || parcel.ownerPhone || parcel.owner_phone || '';
    if (initialData.aboveFloors === undefined || initialData.aboveFloors === null || initialData.aboveFloors === 0 || initialData.aboveFloors === '') {
      initialData.aboveFloors = parcel.floorCount ? parcel.floorCount : '';
    }

    // Tính toán trắc địa không gian chuẩn từ Polygon thửa đất
    if (parcel.coordinates && parcel.coordinates.length > 0) {
      const spatialMetrics = calculateParcelMetroSpatialMetrics(parcel.coordinates);
      initialData.gpsCoords = spatialMetrics.closestVertex;
      initialData.metroOffsetDistance = spatialMetrics.metroOffsetDistance;
      initialData.clearanceOffsetDistance = spatialMetrics.clearanceOffsetDistance;
      initialData.chainage = initialData.chainage || '';
    }

    // Khởi tạo thông tin riêng cho Căn hộ con nếu có unit
    if (unit) {
      const uCode = unit.unitCode || unit.unit_code || '';
      const rawFloor = unit.floorNumber ?? unit.floor_number ?? unit.floorLevel ?? 1;
      const floorNum = typeof rawFloor === 'number' ? rawFloor : (parseInt(String(rawFloor).replace(/\D/g, ''), 10) || 1);

      initialData.unitId = unit.id;
      if (uCode) {
        initialData.unitCode = uCode;
      }
      initialData.unitFloorNumber = floorNum;
      initialData.aboveFloors = floorNum;
      initialData.surveyCaseType = 'APARTMENT';

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
        buildingName: parcel.buildingName || parcel.projectParcelCode || 'Tòa Nhà Chung Cư Cao Tầng',
        projectParcelCode: parcel.projectParcelCode || '',
        officialCadastralCode: parcel.officialCadastralCode || '',
        address: (parcel.houseNumber ? `${parcel.houseNumber}, ` : '') + (parcel.street || ''),
        chainage: initialData.chainage || '',
        metroOffsetDistance: initialData.metroOffsetDistance || '',
        isConfirmed: initialData.parentBuildingInfo?.isConfirmed || false,
      };

      if (initialData.floors && initialData.floors.length === 1 && initialData.floors[0].id === 'floor_ground') {
        initialData.floors[0].id = `floor_${floorNum}`;
        initialData.floors[0].floorName = `Tầng ${floorNum} - Căn hộ ${uCode || 'Con'}`;
      }
    }

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

    // 3. Tải bất đồng bộ draft đầy đủ từ IndexedDB (chỉ khi không ở chế độ Read-Only và chưa nộp)
    if (!get().isReadOnly && !isSubmittedOrApproved) {
      loadSurveyDraft<Phase1SurveyFormData & { _savedStep?: number; _localUpdatedAt?: string }>(draftKey)
        .then((fullDraft) => {
          if (fullDraft && fullDraft.parcelId === parcel.id) {
            const targetStep = fullDraft._savedStep !== undefined && fullDraft._savedStep >= 1 && fullDraft._savedStep <= 8 ? fullDraft._savedStep : undefined;
            set((state) => {
              const merged = dedupePhase1FormData(healLocalPhotoUris({ ...state.formData, ...fullDraft }));
              merged.ownerName = resolveOwnerName(state.formData.ownerName, fullDraft.ownerName);
              if (!merged.photoP01?.url && state.formData.photoP01?.url) merged.photoP01 = state.formData.photoP01;
              if (!merged.photoP02?.url && state.formData.photoP02?.url) merged.photoP02 = state.formData.photoP02;
              if (!merged.photoP03?.url && state.formData.photoP03?.url) merged.photoP03 = state.formData.photoP03;
              if (!merged.photoP04?.url && state.formData.photoP04?.url) merged.photoP04 = state.formData.photoP04;

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
        .catch((err: unknown) => {
          console.warn('[SurveyPhase1Store] IDB load draft error:', err);
        });

      // 4. Đồng bộ bản nháp từ máy chủ (Server Draft Sync)
      surveyDraftService
        .fetchDraft(parcel.id, unitId)
        .then((serverRes) => {
          // Lưu ánh xạ ảnh từ máy chủ vào bộ nhớ bền vững của thiết bị ngay lập tức
          const allServerMappings: Record<string, string> = {
            ...(serverRes.photoMappings || {}),
            ...(((serverRes.draft?.surveyData as Record<string, unknown>)?._photoMappings as Record<string, string>) || {}),
          };
          for (const [localId, cloudUrl] of Object.entries(allServerMappings)) {
            if (localId && cloudUrl) {
              saveUploadedPhotoMapping(localId, cloudUrl);
            }
          }

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
                currentStep: serverRes.currentStep || 1,
                securityCode: serverRes.securityCode || '',
                updatedAt: serverRes.updatedAt || '',
              },
            });
            return;
          }

          if (serverRes.draft && serverRes.draft.surveyData) {
            const serverData = serverRes.draft.surveyData;
            const targetStep =
              serverRes.draft.currentStep >= 1 && serverRes.draft.currentStep <= 8
                ? serverRes.draft.currentStep
                : undefined;

            const pStatus = parcel.surveyStatus || parcel.survey_status;
            const isRejectedOrReverted = pStatus === 'REJECTED';

            let finalMerged: Phase1SurveyFormData | null = null;
            set((state) => {
              const localUpdatedAtStr = (state.formData as Phase1SurveyFormData & { _localUpdatedAt?: string })._localUpdatedAt;
              const localTime = localUpdatedAtStr ? new Date(localUpdatedAtStr).getTime() : 0;
              const serverTime = serverRes.draft?.updatedAt ? new Date(serverRes.draft.updatedAt).getTime() : 0;
              const preferLocal = !isRejectedOrReverted && localTime > 0 && serverTime > 0 && localTime > serverTime;

              const rawCombined = preferLocal
                ? { ...serverData, ...state.formData }
                : { ...state.formData, ...serverData };

              const merged = dedupePhase1FormData(healLocalPhotoUris(rawCombined));
              merged.ownerName = resolveOwnerName(state.formData.ownerName, typeof serverData.ownerName === 'string' ? serverData.ownerName : null);

              if (!merged.photoP01?.url && state.formData.photoP01?.url) merged.photoP01 = state.formData.photoP01;
              if (!merged.photoP02?.url && state.formData.photoP02?.url) merged.photoP02 = state.formData.photoP02;
              if (!merged.photoP03?.url && state.formData.photoP03?.url) merged.photoP03 = state.formData.photoP03;
              if (!merged.photoP04?.url && state.formData.photoP04?.url) merged.photoP04 = state.formData.photoP04;
              if (
                (!merged.signatures?.workingMinutesPhotos || merged.signatures.workingMinutesPhotos.length === 0) &&
                state.formData.signatures?.workingMinutesPhotos?.length
              ) {
                merged.signatures = {
                  ...merged.signatures,
                  workingMinutesPhotos: state.formData.signatures.workingMinutesPhotos,
                };
              }

              const recalculatedEcs = calculateEcsScore(merged);
              const recalculatedVi = calculateViScore(merged, recalculatedEcs);
              merged.ecs = recalculatedEcs;
              merged.vi = recalculatedVi;
              finalMerged = merged;

              return {
                formData: merged,
                currentStep: preferLocal ? state.currentStep : (targetStep !== undefined ? targetStep : state.currentStep),
                syncVersion: serverRes.draft!.syncVersion || state.syncVersion,
                syncStatus: 'SAVED',
                lastSyncedAt: serverRes.draft!.updatedAt
                  ? new Date(serverRes.draft!.updatedAt).toLocaleTimeString('vi-VN')
                  : new Date().toLocaleTimeString('vi-VN'),
                lastSavedAt: new Date().toLocaleTimeString('vi-VN'),
                isDirty: false,
              };
            });
            console.log('[SurveyPhase1Store] Server draft restored successfully:', serverRes.draft.reportId);

            // Kiểm tra xem dữ liệu sau khi heal có còn ảnh unmapped nào không
            if (finalMerged) {
              const unmapped = findUnsyncedPhotoPaths(finalMerged);
              if (unmapped.length === 0) {
                set({ unsyncedRemotePhotos: null });
              } else if (serverRes.unsyncedPhotosInfo && serverRes.unsyncedPhotosInfo.pendingCount > 0) {
                set({
                  unsyncedRemotePhotos: {
                    ...serverRes.unsyncedPhotosInfo,
                    pendingCount: unmapped.length,
                  },
                });
              }
            }
          } else {
            if (serverRes.unsyncedPhotosInfo && serverRes.unsyncedPhotosInfo.pendingCount > 0) {
              set({ unsyncedRemotePhotos: serverRes.unsyncedPhotosInfo });
            } else {
              set({ unsyncedRemotePhotos: null });
            }
          }
          // Đã nạp xong (có hoặc không có bản nháp) -> cho phép đồng bộ từ giờ
          set({ hasServerHydrated: true });
        })
        .catch((err: unknown) => {
          console.warn('[SurveyPhase1Store] Failed to fetch server draft:', err);
          set({ syncStatus: 'OFFLINE', hasServerHydrated: true });
        });
    }
  },

  updateFormData: (updater) => {
    if (get().isReadOnly) return;

    set((state) => {
      const newFormData = typeof updater === 'function' ? updater(state.formData) : { ...state.formData, ...updater };
      const ecs = calculateEcsScore(newFormData);
      const vi = calculateViScore(newFormData, ecs);
      newFormData.ecs = ecs;
      newFormData.vi = vi;

      return {
        formData: newFormData,
        isDirty: true,
        activeParcel: state.activeParcel
          ? {
              ...state.activeParcel,
              ...(newFormData.ownerName !== undefined ? { ownerName: newFormData.ownerName } : {}),
              ...(newFormData.houseNumber !== undefined ? { houseNumber: newFormData.houseNumber } : {}),
              ...(newFormData.street !== undefined ? { street: newFormData.street } : {}),
            }
          : state.activeParcel,
      };
    });

    get().saveDraftToStorage();
  },

  loadReportData: (serverFormData) => {
    set((state) => {
      // SAFE MERGE: Nếu state.formData đã có ảnh mà serverFormData bị rỗng, bảo toàn ảnh hiện có
      const mergedPayload = { ...serverFormData };
      if (!mergedPayload.photoP01?.url && state.formData.photoP01?.url) {
        mergedPayload.photoP01 = state.formData.photoP01;
      }
      if (!mergedPayload.photoP02?.url && state.formData.photoP02?.url) {
        mergedPayload.photoP02 = state.formData.photoP02;
      }
      if (!mergedPayload.photoP03?.url && state.formData.photoP03?.url) {
        mergedPayload.photoP03 = state.formData.photoP03;
      }
      if (!mergedPayload.photoP04?.url && state.formData.photoP04?.url) {
        mergedPayload.photoP04 = state.formData.photoP04;
      }

      const newFormData = dedupePhase1FormData({ ...state.formData, ...mergedPayload });
      const resolvedOwner = resolveOwnerName(state.formData.ownerName, mergedPayload.ownerName);
      const isSpecialCase =
        newFormData.isAbsenteeSurvey ||
        newFormData.surveyCaseType === 'ABSENTEE' ||
        newFormData.surveyCaseType === 'VACANT_LAND' ||
        newFormData.surveyCaseType === 'UNDER_CONSTRUCTION' ||
        newFormData.surveyCaseType === 'APARTMENT';
      newFormData.ownerName =
        !state.isReadOnly && !state.isSubmitted && !isSpecialCase && isCadastralOwnerPlaceholder(resolvedOwner)
          ? ''
          : resolvedOwner;

      const ecs = calculateEcsScore(newFormData);
      const vi = calculateViScore(newFormData, ecs);

      // D1: Nếu đang xem ReadOnly / Submitted mà serverFormData đã có điểm chốt (ECS/VI), bảo toàn điểm từ Server/Snapshot
      if ((state.isReadOnly || state.isSubmitted) && serverFormData.ecs) {
        newFormData.ecs = { ...ecs, ...serverFormData.ecs };
      } else {
        newFormData.ecs = ecs;
      }
      if ((state.isReadOnly || state.isSubmitted) && serverFormData.vi) {
        newFormData.vi = { ...vi, ...serverFormData.vi };
      } else {
        newFormData.vi = vi;
      }

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
      _localUpdatedAt: new Date().toISOString(),
    };

    saveSurveyDraft(draftKey, payloadWithStep)
      .then(() => {
        set({ lastSavedAt: new Date().toLocaleTimeString('vi-VN') });
      })
      .catch((e) => {
        console.warn('[SurveyPhase1Store] IDB save failed:', e);
      });

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
              cuPhotos: (d.cuPhotos || []).map((p: string) => p && p.length > 50000 ? '' : p).filter(Boolean),
            })),
          })),
          structuralElements: (f.structuralElements || []).map((e) => ({
            ...e,
            ctxPhotoUrl: e.ctxPhotoUrl && e.ctxPhotoUrl.length > 50000 ? '' : e.ctxPhotoUrl,
            defects: (e.defects || []).map((d) => ({
              ...d,
              cuPhotoUrl: d.cuPhotoUrl && d.cuPhotoUrl.length > 50000 ? '' : d.cuPhotoUrl,
              cuPhotos: (d.cuPhotos || []).map((p: string) => p && p.length > 50000 ? '' : p).filter(Boolean),
            })),
          })),
        })),
      };
      localStorage.setItem(draftKey, JSON.stringify(compactData));
      set({ lastSavedAt: new Date().toLocaleTimeString('vi-VN') });

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
          // Bảo lưu trạng thái đã nộp
        } else {
          delete overrides[formData.parcelId];
        }
        localStorage.setItem('metro2_parcel_status_overrides', JSON.stringify(overrides));
      }
    } catch (_err) {}
  },
});
