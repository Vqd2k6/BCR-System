import { StateCreator } from 'zustand';
import { Phase1SurveyStore, FormSlice } from '../types';
import { getDefaultInitialFormData } from '../initialFormData';
import { GisParcel, BuildingUnit } from '../../../../core/types/domain.types';
import { calculateEcsScore } from '../../engine/ecsCalculator';
import { calculateViScore } from '../../engine/viCalculator';
import { calculateParcelMetroSpatialMetrics } from '../../utils/metroSpatialCalculator';
import { saveSurveyDraft, loadSurveyDraft, deleteSurveyDraft } from '../../../../core/utils/idbDraftStorage';
import { surveyDraftService } from '../../services/surveyDraftService';

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

  initializeForm: (parcel: GisParcel, unit?: BuildingUnit | null) => {
    set({ isSubmitted: false, isLockedByOther: false, lockedInfo: null, isHandoverModalOpen: false });
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
    initialData.ownerPhone = initialData.ownerPhone || (unit as any)?.ownerPhone || (unit as any)?.owner_phone || parcel.ownerPhone || (parcel as any).owner_phone || '';
    if (initialData.aboveFloors === undefined || initialData.aboveFloors === null || initialData.aboveFloors === 0 || initialData.aboveFloors === '') {
      initialData.aboveFloors = parcel.floorCount ? parcel.floorCount : '';
    }

    // Tính toán trắc địa không gian chuẩn từ Polygon thửa đất
    if (parcel.coordinates && parcel.coordinates.length > 0) {
      const spatialMetrics = calculateParcelMetroSpatialMetrics(parcel.coordinates);
      initialData.gpsCoords = spatialMetrics.closestVertex;
      initialData.metroOffsetDistance = spatialMetrics.metroOffsetDistance;
      initialData.clearanceOffsetDistance = spatialMetrics.clearanceOffsetDistance;
      initialData.chainage = '';
    }

    // Khởi tạo thông tin riêng cho Căn hộ con nếu có unit
    if (unit) {
      const uCode = (unit as any).unitCode || (unit as any).unit_code || '';
      const rawFloor = (unit as any).floorNumber ?? (unit as any).floor_number ?? (unit as any).floorLevel ?? 1;
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
        buildingName: (parcel as any).buildingName || parcel.projectParcelCode || 'Tòa Nhà Chung Cư Cao Tầng',
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

    // 3. Tải bất đồng bộ draft đầy đủ từ IndexedDB
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

    // 4. Đồng bộ bản nháp từ máy chủ (Server Draft Sync)
    surveyDraftService
      .fetchDraft(parcel.id, unitId)
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
          console.log('[SurveyPhase1Store] Server draft restored successfully:', serverRes.draft.reportId);
        }
      })
      .catch((err) => {
        console.warn('[SurveyPhase1Store] Failed to fetch server draft:', err);
        set({ syncStatus: 'OFFLINE' });
      });
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
      const newFormData = { ...state.formData, ...serverFormData };
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
