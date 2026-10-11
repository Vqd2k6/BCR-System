import { create } from 'zustand';
import type { GisParcel, BuildingUnit } from '../../../core/types/domain.types';
import {
  isResidentStatus,
  type CondoUnitFormData,
  type UnitDefectItem,
  type DamageZoneData,
  type StructuralElementData,
  type DefectItem,
  type CadZonePin,
} from '../types/condo-unit.types';
import { surveyDraftService } from '../../survey-phase1/services/surveyDraftService';
import api from '../../../services/api';
import { getNextAvailablePinCode } from '../../../components/canvas/FloorCadPinningCanvas';
import { sanitizeSurveyDataForSync } from '../../../core/services/uploadQueueService';

import { getErrorMessage } from '@/utils/errorUtils';
import type { LockedInfo } from '../../survey-phase1/components/ActiveSurveyorLockedModal';
import type { HandoverInfo } from '../../survey-phase1/components/HandoverTakeoverModal';

interface CondoUnitSurveyStore {
  currentStep: number;
  formData: CondoUnitFormData;
  lastSavedAt: string | null;
  syncStatus: 'IDLE' | 'SAVING' | 'SAVED' | 'ERROR';
  syncVersion: number;

  // Trạng thái khóa ca và tiếp quản ca khảo sát
  isLockedByOther: boolean;
  lockedInfo: LockedInfo | null;
  isHandoverModalOpen: boolean;
  handoverInfo: HandoverInfo | null;
  closeLockedModal: () => void;
  closeHandoverModal: () => void;
  takeoverDraft: (handoverCode: string, note?: string) => Promise<boolean>;
  checkDraftLock: () => Promise<void>;

  initializeForm: (parcel: GisParcel, unit?: BuildingUnit | null) => void;
  updateFormData: (updates: Partial<CondoUnitFormData>) => void;
  setStep: (step: number) => void;
  nextStep: () => void;
  prevStep: () => void;

  // Z - E - D actions
  addZone: (zone?: Partial<DamageZoneData>) => void;
  updateZone: (index: number, updater: Partial<DamageZoneData>) => void;
  removeZone: (index: number) => void;
  addElement: (element?: Partial<StructuralElementData>) => void;
  updateElement: (index: number, updater: Partial<StructuralElementData>) => void;
  removeElement: (index: number) => void;
  updateDefectsInZone: (zoneId: string, defects: DefectItem[]) => void;
  updateDefectsInElement: (elementId: string, defects: DefectItem[]) => void;

  // Legacy defect actions preserved for backward compatibility
  addDefect: (defect: Omit<UnitDefectItem, 'id'>) => void;
  removeDefect: (defectId: string) => void;
  clearDraft: () => void;
  syncDraftToServer: () => Promise<void>;
  releaseDraftLock: () => Promise<void>;

  isReadOnly: boolean;
  setIsReadOnly: (readOnly: boolean) => void;
  isPhotoAuditOpen: boolean;
  setIsPhotoAuditOpen: (open: boolean) => void;
}

/**
 * Loại bỏ triệt để các Vùng Z ma (chưa có ghim pin trên CAD và không có dữ liệu khuyết tật/ảnh)
 * Đảm bảo nếu chưa chấm CAD thì zones phải là mảng rỗng []
 */
export function cleanupGhostZones(zones: DamageZoneData[], pins: CadZonePin[] = []): DamageZoneData[] {
  if (!Array.isArray(zones) || zones.length === 0) return [];
  return zones.filter((z) => {
    const hasPin = pins.some((p) => p.zoneCode === z.zoneCode);
    if (hasPin) return true;

    const hasDefects = Array.isArray(z.defects) && z.defects.length > 0;
    const hasPhotos = Boolean(
      (z.ctxPhotoUrl && !z.ctxPhotoUrl.startsWith('blob:local://')) ||
      (Array.isArray(z.overviewPhotos) && z.overviewPhotos.length > 0)
    );
    const hasNotes = Boolean(z.notes && z.notes.trim() !== '');

    return hasDefects || hasPhotos || hasNotes;
  });
}

/**
 * Loại bỏ triệt để các Cấu kiện E ma (chưa có ghim pin trên CAD và không có dữ liệu khuyết tật/ảnh)
 */
export function cleanupGhostElements(elements: StructuralElementData[], pins: CadZonePin[] = []): StructuralElementData[] {
  if (!Array.isArray(elements) || elements.length === 0) return [];
  return elements.filter((e) => {
    const hasPin = pins.some((p) => p.zoneCode === e.elementCode);
    if (hasPin) return true;

    const hasDefects = Array.isArray(e.defects) && e.defects.length > 0;
    const hasPhotos = Boolean(
      (e.ctxPhotoUrl && !e.ctxPhotoUrl.startsWith('blob:local://')) ||
      (Array.isArray(e.overviewPhotos) && e.overviewPhotos.length > 0)
    );
    const hasNotes = Boolean(e.notes && e.notes.trim() !== '');

    return hasDefects || hasPhotos || hasNotes;
  });
}

export function deduplicateZones(zones: DamageZoneData[], pins: CadZonePin[] = []): DamageZoneData[] {
  if (!Array.isArray(zones) || zones.length === 0) return [];
  const cleaned = cleanupGhostZones(zones, pins);
  if (cleaned.length <= 1) return cleaned;

  const seenCodes = new Set<string>();
  const result: DamageZoneData[] = [];

  for (const z of cleaned) {
    if (!seenCodes.has(z.zoneCode)) {
      seenCodes.add(z.zoneCode);
      result.push(z);
    } else {
      // Phát hiện mã Z bị trùng lặp
      const hasDefects = Array.isArray(z.defects) && z.defects.length > 0;
      const hasPhotos = Boolean(z.ctxPhotoUrl || (Array.isArray(z.overviewPhotos) && z.overviewPhotos.length > 0));
      const hasMatchingPin = pins.some((p) => p.zoneCode === z.zoneCode);

      // Nếu là vùng sinh trùng rác không có dữ liệu thật -> loại bỏ
      if (!hasDefects && !hasPhotos && !hasMatchingPin) {
        continue;
      }

      // Nếu có dữ liệu thật -> cấp mã Z mới không trùng
      const newCode = getNextAvailablePinCode(
        [...pins, ...result.map((r) => ({ zoneCode: r.zoneCode }))],
        'Z'
      );
      seenCodes.add(newCode);
      result.push({ ...z, zoneCode: newCode });
    }
  }
  return result;
}

export function deduplicateElements(elements: StructuralElementData[], pins: CadZonePin[] = []): StructuralElementData[] {
  if (!Array.isArray(elements) || elements.length === 0) return [];
  const cleaned = cleanupGhostElements(elements, pins);
  if (cleaned.length <= 1) return cleaned;

  const seenCodes = new Set<string>();
  const result: StructuralElementData[] = [];

  for (const e of cleaned) {
    if (!seenCodes.has(e.elementCode)) {
      seenCodes.add(e.elementCode);
      result.push(e);
    } else {
      const hasDefects = Array.isArray(e.defects) && e.defects.length > 0;
      const hasPhotos = Boolean(e.ctxPhotoUrl || (Array.isArray(e.overviewPhotos) && e.overviewPhotos.length > 0));
      const hasMatchingPin = pins.some((p) => p.zoneCode === e.elementCode);

      if (!hasDefects && !hasPhotos && !hasMatchingPin) {
        continue;
      }

      const newCode = getNextAvailablePinCode(
        [...pins, ...result.map((r) => ({ zoneCode: r.elementCode }))],
        'E'
      );
      seenCodes.add(newCode);
      result.push({ ...e, elementCode: newCode });
    }
  }
  return result;
}

/**
 * Trộn dữ liệu bản nháp từ Server vào Local mà TUYỆT ĐỐI KHÔNG làm mất ảnh hay ghi đè lùi dữ liệu
 */
export function mergeCondoUnitDataSafely(
  localData: CondoUnitFormData,
  serverData: Partial<CondoUnitFormData>
): CondoUnitFormData {
  const merged: CondoUnitFormData = {
    ...localData,
    ...serverData,
    parentInfo: {
      ...localData.parentInfo,
      ...(serverData.parentInfo || {}),
    },
  };

  // 1. Bảo vệ ảnh P01 (Biển số phòng)
  if (!serverData.photoP01?.url && localData.photoP01?.url) {
    merged.photoP01 = localData.photoP01;
  }

  // 2. Bảo vệ ảnh P04 (Toàn cảnh lối đi)
  if (!serverData.photoP04?.url && localData.photoP04?.url) {
    merged.photoP04 = localData.photoP04;
  }

  // 3. Bảo vệ ảnh Biên bản khảo sát giấy (workingMinutesPhotos)
  const localMinutes = localData.workingMinutesPhotos || [];
  const serverMinutes = serverData.workingMinutesPhotos || [];
  const minutesSet = new Set<string>();
  const mergedMinutes: string[] = [];
  [...serverMinutes, ...localMinutes].forEach((u) => {
    if (u && !minutesSet.has(u)) {
      minutesSet.add(u);
      mergedMinutes.push(u);
    }
  });
  merged.workingMinutesPhotos = mergedMinutes;

  // 4. Bảo vệ chữ ký khảo sát viên và chủ hộ
  if (!serverData.surveyorSignature && localData.surveyorSignature) {
    merged.surveyorSignature = localData.surveyorSignature;
  }
  if (!serverData.ownerSignature && localData.ownerSignature) {
    merged.ownerSignature = localData.ownerSignature;
  }
  if (!serverData.ownerFeedback && localData.ownerFeedback) {
    merged.ownerFeedback = localData.ownerFeedback;
  }

  // 5. Bảo vệ ảnh võng dầm/sàn
  if (localData.beamSagging?.photoUrl && !serverData.beamSagging?.photoUrl) {
    merged.beamSagging = {
      ...(merged.beamSagging || localData.beamSagging),
      photoUrl: localData.beamSagging.photoUrl,
    };
  }

  // 6. Trộn Vùng Z và bảo toàn 100% ảnh overviewPhotos, ctxPhotoUrl, cuPhotoUrl
  const localZones = localData.zones || [];
  const serverZones = serverData.zones || [];
  const mergedPins = Array.isArray(serverData.cadZonePins) && serverData.cadZonePins.length > 0
    ? serverData.cadZonePins
    : localData.cadZonePins || [];

  const localZoneMap = new Map<string, DamageZoneData>();
  localZones.forEach((z) => {
    if (z.zoneCode) localZoneMap.set(z.zoneCode, z);
    if (z.id) localZoneMap.set(z.id, z);
  });

  const processedZones: DamageZoneData[] = (serverZones.length > 0 ? serverZones : localZones).map((sz) => {
    const lz = localZoneMap.get(sz.zoneCode) || localZoneMap.get(sz.id);
    if (!lz) return sz;

    // Trộn mảng ảnh overviewPhotos
    const ovSet = new Set<string>();
    const mergedOv: string[] = [];
    [...(sz.overviewPhotos || []), ...(lz.overviewPhotos || [])].forEach((u) => {
      if (u && !ovSet.has(u)) {
        ovSet.add(u);
        mergedOv.push(u);
      }
    });

    // Trộn khuyết tật
    const localDefectMap = new Map<string, DefectItem>();
    (lz.defects || []).forEach((d) => {
      if (d.defectCode) localDefectMap.set(d.defectCode, d);
      if (d.id) localDefectMap.set(d.id, d);
    });

    const mergedDefects = (sz.defects || []).map((sd) => {
      const ld = localDefectMap.get(sd.defectCode) || (sd.id ? localDefectMap.get(sd.id) : undefined);
      if (!ld) return sd;
      return {
        ...ld,
        ...sd,
        cuPhotoUrl: sd.cuPhotoUrl || ld.cuPhotoUrl || '',
        cuPhotos: (Array.isArray(sd.cuPhotos) && sd.cuPhotos.length > 0)
          ? sd.cuPhotos
          : (ld.cuPhotos || (sd.cuPhotoUrl || ld.cuPhotoUrl ? [sd.cuPhotoUrl || ld.cuPhotoUrl] : [])),
        notes: sd.notes || ld.notes || '',
      };
    });

    // Bổ sung các defect chỉ có ở local
    (lz.defects || []).forEach((ld) => {
      const exists = mergedDefects.some((d) => d.defectCode === ld.defectCode || d.id === ld.id);
      if (!exists) {
        mergedDefects.push(ld);
      }
    });

    return {
      ...lz,
      ...sz,
      ctxPhotoUrl: sz.ctxPhotoUrl || lz.ctxPhotoUrl || '',
      overviewPhotos: mergedOv,
      defects: mergedDefects,
      hasDamage: mergedDefects.length > 0,
    };
  });

  // Bổ sung các zone chỉ có ở local
  localZones.forEach((lz) => {
    const exists = processedZones.some((z) => z.zoneCode === lz.zoneCode || z.id === lz.id);
    if (!exists) {
      processedZones.push(lz);
    }
  });

  merged.zones = deduplicateZones(processedZones, mergedPins);
  merged.cadZonePins = mergedPins;

  // 7. Tương tự cho Cấu kiện kết cấu E
  const localElements = localData.structuralElements || [];
  const serverElements = serverData.structuralElements || [];
  const mergedElementPins = Array.isArray(serverData.cadElementPins) && serverData.cadElementPins.length > 0
    ? serverData.cadElementPins
    : localData.cadElementPins || [];

  const localElementMap = new Map<string, StructuralElementData>();
  localElements.forEach((e) => {
    if (e.elementCode) localElementMap.set(e.elementCode, e);
    if (e.id) localElementMap.set(e.id, e);
  });

  const processedElements: StructuralElementData[] = (serverElements.length > 0 ? serverElements : localElements).map((se) => {
    const le = localElementMap.get(se.elementCode) || localElementMap.get(se.id);
    if (!le) return se;

    const ovSet = new Set<string>();
    const mergedOv: string[] = [];
    [...(se.overviewPhotos || []), ...(le.overviewPhotos || [])].forEach((u) => {
      if (u && !ovSet.has(u)) {
        ovSet.add(u);
        mergedOv.push(u);
      }
    });

    // Trộn khuyết tật cấu kiện E
    const localElemDefectMap = new Map<string, DefectItem>();
    (le.defects || []).forEach((d) => {
      if (d.defectCode) localElemDefectMap.set(d.defectCode, d);
      if (d.id) localElemDefectMap.set(d.id, d);
    });

    const mergedElemDefects = (se.defects || []).map((sd) => {
      const ld = localElemDefectMap.get(sd.defectCode) || (sd.id ? localElemDefectMap.get(sd.id) : undefined);
      if (!ld) return sd;
      return {
        ...ld,
        ...sd,
        cuPhotoUrl: sd.cuPhotoUrl || ld.cuPhotoUrl || '',
        cuPhotos: (Array.isArray(sd.cuPhotos) && sd.cuPhotos.length > 0)
          ? sd.cuPhotos
          : (ld.cuPhotos || (sd.cuPhotoUrl || ld.cuPhotoUrl ? [sd.cuPhotoUrl || ld.cuPhotoUrl] : [])),
        notes: sd.notes || ld.notes || '',
      };
    });

    (le.defects || []).forEach((ld) => {
      const exists = mergedElemDefects.some((d) => d.defectCode === ld.defectCode || d.id === ld.id);
      if (!exists) {
        mergedElemDefects.push(ld);
      }
    });

    return {
      ...le,
      ...se,
      ctxPhotoUrl: se.ctxPhotoUrl || le.ctxPhotoUrl || '',
      overviewPhotos: mergedOv,
      defects: mergedElemDefects,
    };
  });

  localElements.forEach((le) => {
    const exists = processedElements.some((e) => e.elementCode === le.elementCode || e.id === le.id);
    if (!exists) {
      processedElements.push(le);
    }
  });

  merged.structuralElements = deduplicateElements(processedElements, mergedElementPins);
  merged.cadElementPins = mergedElementPins;

  return merged;
}

let debounceTimer: ReturnType<typeof setTimeout> | null = null;
let isHydratingDraft = false;

const getDefaultCondoUnitFormData = (parcelId: string, unitId: string): CondoUnitFormData => ({
  parcelId,
  unitId,
  parentInfo: {
    projectParcelCode: '',
    officialCadastralCode: '',
    buildingName: '',
    address: '',
    chainage: 'Km 0+000',
    metroOffsetDistance: '15.0m',
    isConfirmed: false,
  },
  unitCode: '01.01',
  displayCode: '',
  floorNumber: 1,
  ownerName: '',
  ownerPhone: '',
  ownerIdCard: '',
  residentStatus: 'CHỦ_HỘ_Ở',
  unitAreaM2: 65,
  photoP01: { url: '', notApplicable: false },
  photoP04: { url: '', notApplicable: false },
  historyInterview: {
    renovationLoad: 0,
    majorRepair: 0,
    pastSettlement: 0,
    neighborDamage: 0,
    fireFloodIncident: 0,
    usageStatus: 'Đầy đủ',
    continuousOperation247: false,
    sensitiveEquipment: {
      has: false,
      description: '',
    },
    renovationDescription: '',
  },
  hasSensitiveEquipment: false,
  sensitiveEquipmentDesc: '',
  interiorRenovationHistory: { hasRenovated: false, description: '' },
  unitCadUrl: '',
  cadBbox: null,
  cadPolygon: null,

  // 3. Phân cấp Vùng Z & Cấu kiện E (Phase 1 Standard)
  zones: [],
  structuralElements: [],
  hasStructuralElements: true,
  cadZonePins: [],
  cadElementPins: [],

  // Tương thích ngược
  localDefects: [],
  upperFloorWaterLeakage: {
    has: false,
    leakageItems: [],
    location: '',
    description: '',
    photoUrl: '',
  },
  beamSagging: {
    hasSagging: false,
    location: '',
    sagMm: 0,
    spanM: 0,
    ratioText: '',
    photoUrl: '',
  },
  doorJammingStatus: 'NORMAL',
  settlementObserved: 'NONE',
  settlementNotes: '',
  surveyorSignature: '',
  ownerSignature: '',
  ownerFeedback: 'Đồng ý với hiện trạng ghi nhận tại căn hộ',
  surveyDate: new Date().toLocaleDateString('vi-VN'),
  workingMinutesPhotos: [],
});

export const useCondoUnitSurveyStore = create<CondoUnitSurveyStore>((set, get) => ({
  currentStep: 1,
  formData: getDefaultCondoUnitFormData('default_parcel', 'default_unit'),
  lastSavedAt: null,
  syncStatus: 'IDLE',
  syncVersion: 1,

  isLockedByOther: false,
  lockedInfo: null,
  isHandoverModalOpen: false,
  handoverInfo: null,
  isReadOnly: false,
  setIsReadOnly: (isReadOnly) => set({ isReadOnly }),
  isPhotoAuditOpen: false,
  setIsPhotoAuditOpen: (isPhotoAuditOpen) => set({ isPhotoAuditOpen }),
  closeLockedModal: () => set({ isLockedByOther: false, lockedInfo: null }),
  closeHandoverModal: () => set({ isHandoverModalOpen: false, handoverInfo: null }),

  initializeForm: (parcel: GisParcel, unit?: BuildingUnit | null) => {
    const pId = parcel.id;
    const uId = unit?.id || 'unit-default';
    const draftKey = `metro2_condo_unit_draft_${pId}_${uId}`;

    let data = getDefaultCondoUnitFormData(pId, uId);

    // Kế thừa thông tin toà nhà cha
    data.parentInfo = {
      projectParcelCode: parcel.projectParcelCode || parcel.project_parcel_code || 'B-001',
      officialCadastralCode: parcel.officialCadastralCode || parcel.official_cadastral_code || 'DC-001',
      buildingName: parcel.buildingName || parcel.building_name || 'Tòa nhà Chung Cư',
      address: `${parcel.houseNumber ? `${parcel.houseNumber}, ` : ''}${parcel.street || ''}`,
      chainage: 'Km 3+450',
      metroOffsetDistance: `${parcel.distanceMeters || parcel.distance_meters || 12.5}m`,
      isConfirmed: false,
    };

    // Gán thông tin căn hộ
    if (unit) {
      data.unitCode = unit.unit_code || unit.unitCode || data.unitCode;
      data.displayCode = unit.display_code || unit.displayCode || '';
      const rawFloor = unit.floor_number ?? unit.floorNumber ?? unit.floorLevel ?? unit.floor_level ?? 1;
      const parsedFloor = typeof rawFloor === 'number' ? rawFloor : parseFloat(String(rawFloor));
      data.floorNumber = isNaN(parsedFloor) ? 1 : parsedFloor;
      data.ownerName = unit.owner_name || unit.ownerName || '';
      data.ownerPhone = unit.owner_phone || unit.ownerPhone || '';
      data.ownerIdCard = unit.owner_id_card || unit.ownerIdCard || '';
      if (unit.unit_cad_url || unit.unitCadUrl) data.unitCadUrl = unit.unit_cad_url || unit.unitCadUrl || '';
      if (unit.cad_bbox || unit.cadBbox) data.cadBbox = unit.cad_bbox ?? unit.cadBbox ?? null;
      if (unit.cad_polygon || unit.cadPolygon) data.cadPolygon = unit.cad_polygon ?? unit.cadPolygon ?? null;
      const resStatus = unit.resident_status || unit.residentStatus;
      if (resStatus && isResidentStatus(resStatus)) data.residentStatus = resStatus;
      if (unit.status) data.status = unit.status;
    }

    // Khôi phục bản nháp nếu có
    try {
      const saved = localStorage.getItem(draftKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.parcelId === pId && parsed.unitId === uId) {
          if (parsed.upperFloorWaterLeakage) {
            if (!Array.isArray(parsed.upperFloorWaterLeakage.leakageItems)) {
              parsed.upperFloorWaterLeakage.leakageItems = parsed.upperFloorWaterLeakage.has && (parsed.upperFloorWaterLeakage.location || parsed.upperFloorWaterLeakage.photoUrl)
                ? [{
                    id: `wl-legacy-${Date.now()}`,
                    leakageCode: 'WL-01',
                    location: parsed.upperFloorWaterLeakage.location || 'Trần phòng',
                    description: parsed.upperFloorWaterLeakage.description || '',
                    photoUrl: parsed.upperFloorWaterLeakage.photoUrl || '',
                    cuPhotoUrl: parsed.upperFloorWaterLeakage.photoUrl || '',
                  }]
                : [];
            }
          }
          if (!parsed.beamSagging) {
            parsed.beamSagging = { hasSagging: false, location: '', sagMm: 0, spanM: 0, ratioText: '', photoUrl: '' };
          }

          // Khôi phục hoặc tổng hợp historyInterview tương thích ngược
          if (parsed.historyInterview) {
            data.historyInterview = { ...data.historyInterview, ...parsed.historyInterview };
          } else {
            const hasSens = Boolean(parsed.hasSensitiveEquipment);
            const sensDesc = parsed.sensitiveEquipmentDesc || '';
            const hasReno = Boolean(parsed.interiorRenovationHistory?.hasRenovated);
            const renoDesc = parsed.interiorRenovationHistory?.description || '';
            data.historyInterview = {
              ...data.historyInterview,
              renovationLoad: hasReno ? 1 : 0,
              renovationDescription: renoDesc,
              sensitiveEquipment: {
                has: hasSens,
                description: sensDesc,
              },
            };
          }

          // Khôi phục hoặc chuyển đổi Vùng Z & Cấu kiện E tương thích ngược
          if (Array.isArray(parsed.zones) && parsed.zones.length > 0) {
            data.zones = parsed.zones;
          } else if (Array.isArray(parsed.localDefects) && parsed.localDefects.length > 0) {
            // Chuyển đổi các khuyết tật localDefects cũ thành các Vùng Z
            const migratedZones: DamageZoneData[] = [];
            parsed.localDefects.forEach((d: UnitDefectItem, idx: number) => {
              const zCode = `Z-${String(idx + 1).padStart(2, '0')}`;
              const defectItem: DefectItem = {
                id: d.id,
                defectCode: d.defectCode || `D-${String(idx + 1).padStart(2, '0')}`,
                pinX: d.pinX ?? 50,
                pinY: d.pinY ?? 50,
                screeningCategory: d.type === 'WATER_LEAKAGE' ? 'WATER_LEAK' : (d.type === 'PEELING' ? 'SPALLING' : 'CRACK'),
                defectType: d.type === 'WATER_LEAKAGE' ? 'Thấm dột trần từ căn hộ tầng trên' : (d.type === 'PEELING' ? 'Bong tróc vữa trát / Sơn' : 'Vết nứt'),
                crackDirection: 'Ngang / Dọc',
                widthMaxMm: d.crackWidthMm || 0.2,
                lengthMm: Math.round((d.crackLengthM || 1) * 1000),
                activityState: 'U',
                materialDegradationE4: 0,
                structuralSignificanceE2: 1,
                hasScaleCard: d.hasScaleCard ?? true,
                isStructuralCritical: (d.crackWidthMm || 0) >= 5,
                cuPhotoUrl: d.cuPhotoUrl || d.photoUrl || '',
                cuPhotos: d.cuPhotoUrl || d.photoUrl ? [d.cuPhotoUrl || d.photoUrl] : [],
                notes: d.description || '',
              };
              migratedZones.push({
                id: `migrated_z_${idx}_${Date.now()}`,
                zoneCode: zCode,
                floorName: `Tầng ${parsed.floorNumber || 1}`,
                roomName: d.location || 'Không gian căn hộ',
                componentType: 'Tường gạch vữa xi măng (Tường bao / ngăn)',
                wallMaterial: 'Sơn nước nội thất / ngoại thất',
                overviewPhotos: [],
                ctxPhotoUrl: d.ctxPhotoUrl || d.photoUrl || '',
                hasDamage: true,
                notes: d.description || '',
                defects: [defectItem],
              });
            });
            data.zones = migratedZones;
          }

          if (Array.isArray(parsed.structuralElements)) {
            data.structuralElements = parsed.structuralElements;
          }
          if (parsed.hasStructuralElements !== undefined) {
            data.hasStructuralElements = Boolean(parsed.hasStructuralElements);
          }
          if (Array.isArray(parsed.cadZonePins)) {
            data.cadZonePins = parsed.cadZonePins;
          }
          if (Array.isArray(parsed.cadElementPins)) {
            data.cadElementPins = parsed.cadElementPins;
          }

          data = { ...data, ...parsed };
          data.zones = deduplicateZones(data.zones || [], data.cadZonePins || []);
          data.structuralElements = deduplicateElements(data.structuralElements || [], data.cadElementPins || []);
        }
      }
    } catch (_e) {}

    // Lưu ngay vào danh sách đang làm dở trên local
    try {
      const inProgressKey = `metro2_condo_in_progress_units_${pId}`;
      const list: string[] = JSON.parse(localStorage.getItem(inProgressKey) || '[]');
      if (unit?.id && !list.includes(unit.id)) {
        list.push(unit.id);
        localStorage.setItem(inProgressKey, JSON.stringify(list));
      }
    } catch (_e) {}

    // Xác định targetStep an toàn tránh bị reset về bước 1
    const savedStepKey = `metro2_condo_unit_step_${pId}_${uId}`;
    let targetStep = 1;

    // 1. Kiểm tra URL query param (?step=2...)
    if (typeof window !== 'undefined') {
      try {
        const urlParams = new URLSearchParams(window.location.search);
        const urlStep = parseInt(urlParams.get('step') || '', 10);
        if (!isNaN(urlStep) && urlStep >= 1 && urlStep <= 4) {
          targetStep = urlStep;
        }
      } catch (_e) {}
    }

    // 2. Kiểm tra localStorage nếu chưa có từ URL
    if (targetStep === 1) {
      try {
        const localStep = parseInt(localStorage.getItem(savedStepKey) || '', 10);
        if (!isNaN(localStep) && localStep >= 1 && localStep <= 4) {
          targetStep = localStep;
        }
      } catch (_e) {}
    }

    // 3. Nếu store hiện tại đang mở cùng căn hộ và đã ở bước > 1, giữ nguyên không reset
    const curStore = get();
    if (
      curStore.formData.parcelId === pId &&
      curStore.formData.unitId === uId &&
      curStore.currentStep > 1
    ) {
      targetStep = curStore.currentStep;
    }

    const isUnitReadOnly = unit?.status === 'SUBMITTED' || unit?.status === 'APPROVED';

    set({
      currentStep: targetStep,
      formData: data,
      lastSavedAt: new Date().toLocaleTimeString('vi-VN'),
      syncStatus: 'IDLE',
      isReadOnly: isUnitReadOnly,
    });

    // Hydrate từ cloud draft nếu có trên server
    surveyDraftService
      .fetchDraft(pId, uId)
      .then(async (draftRes) => {
        if (draftRes?.isLocked) {
          set({
            isLockedByOther: true,
            lockedInfo: {
              surveyorName: draftRes.activeSurveyorName || 'Kỹ sư khác',
              phone: draftRes.activeSurveyorPhone,
              minutesAgo: draftRes.minutesAgo || 1,
              message: draftRes.message,
            },
          });
          return;
        }

        if (draftRes?.requiresHandover) {
          set({
            isHandoverModalOpen: true,
            handoverInfo: {
              fromSurveyorName: draftRes.fromSurveyorName || 'Kỹ sư ca trước',
              fromSurveyorPhone: draftRes.fromSurveyorPhone,
              currentStep: draftRes.currentStep || 1,
              securityCode: draftRes.securityCode || '',
              updatedAt: draftRes.updatedAt || '',
            },
          });
          return;
        }

        if (draftRes?.hasDraft && draftRes.draft?.surveyData) {
          const sData = draftRes.draft.surveyData as Partial<CondoUnitFormData>;
          const cur = get().formData;
          if (cur.parcelId === pId && cur.unitId === uId) {
            const safelyMerged = mergeCondoUnitDataSafely(cur, sData);
            isHydratingDraft = true;
            get().updateFormData(safelyMerged);
            isHydratingDraft = false;

            // Chỉ nâng bước nếu người dùng vẫn đang ở bước 1 và cloud draft lưu bước cao hơn
            if (
              get().currentStep === 1 &&
              draftRes.draft.currentStep &&
              draftRes.draft.currentStep > 1 &&
              draftRes.draft.currentStep <= 4
            ) {
              get().setStep(draftRes.draft.currentStep);
            }
            if (draftRes.draft.updatedAt) {
              set({
                lastSavedAt: new Date(draftRes.draft.updatedAt).toLocaleTimeString('vi-VN'),
                syncStatus: 'SAVED',
                syncVersion: draftRes.draft.syncVersion || 1,
              });
            }
          }
        } else {
          // Fallback khi không có draft (đã nộp SUBMITTED / APPROVED hoặc đổi máy/xóa cache)
          const unitRecord = unit as { phase1_report_id?: string | null; phase1ReportId?: string | null; status?: string };
          const repId = unitRecord?.phase1_report_id || unitRecord?.phase1ReportId;
          const isSubmittedOrApproved =
            unitRecord?.status === 'SUBMITTED' ||
            unitRecord?.status === 'APPROVED' ||
            Boolean(repId);

          if (isSubmittedOrApproved) {
            try {
              const endpoint = repId
                ? `/reports/phase1/${repId}`
                : `/parcels/${pId}/phase1-report?unitId=${uId}&reportType=CONDO_UNIT`;
              const res = await api.get(endpoint);
              if (res.data?.success && res.data.data) {
                const rObj = res.data.data?.report || res.data.data;
                const sData = (rObj.survey_data_json || rObj.surveyData || {}) as Partial<CondoUnitFormData>;
                const cur = get().formData;
                if (cur.parcelId === pId && cur.unitId === uId && Object.keys(sData).length > 0) {
                  // Khôi phục chữ ký & biên bản nếu nằm trong signatures
                  const sigs = sData.signatures || {};
                  if (!sData.workingMinutesPhotos && Array.isArray(sigs.workingMinutesPhotos)) {
                    sData.workingMinutesPhotos = sigs.workingMinutesPhotos;
                  }
                  if (!sData.surveyorSignature && (sigs.surveyorSignature || rObj.surveyor_signature_url)) {
                    sData.surveyorSignature = sigs.surveyorSignature || rObj.surveyor_signature_url;
                  }
                  if (!sData.ownerSignature && (sigs.ownerSignature || rObj.owner_signature_url)) {
                    sData.ownerSignature = sigs.ownerSignature || rObj.owner_signature_url;
                  }
                  if (!sData.surveyDate && (sigs.surveyDate || rObj.survey_date)) {
                    sData.surveyDate = sigs.surveyDate || rObj.survey_date;
                  }

                  get().updateFormData({
                    ...sData,
                    parentInfo: {
                      ...cur.parentInfo,
                      ...(sData.parentInfo || {}),
                    },
                  });
                  set({
                    syncStatus: 'SAVED',
                    lastSavedAt: rObj.updated_at
                      ? new Date(rObj.updated_at).toLocaleTimeString('vi-VN')
                      : new Date().toLocaleTimeString('vi-VN'),
                  });
                }
              }
            } catch (repErr) {
              console.warn('[CondoUnitStore] Không thể tải dữ liệu báo cáo đã nộp:', repErr);
            }
          }
        }
      })
      .catch((err) => {
        console.warn('[CondoUnitStore] Không thể tải bản nháp cloud:', err);
      });
  },

  syncDraftToServer: async () => {
    if (debounceTimer) {
      clearTimeout(debounceTimer);
      debounceTimer = null;
    }

    const { formData, currentStep, syncVersion, isReadOnly } = get();
    if (!formData.parcelId || !formData.unitId) return;

    // Chặn tuyệt đối không sync nháp nếu hồ sơ là chỉ đọc hoặc đã nộp/phê duyệt
    if (isReadOnly || formData.status === 'SUBMITTED' || formData.status === 'APPROVED') {
      return;
    }

    if (isHydratingDraft) return;

    set({ syncStatus: 'SAVING' });

    // Đánh dấu in-progress trên localStorage để Hub nhận diện lập tức
    try {
      const inProgressKey = `metro2_condo_in_progress_units_${formData.parcelId}`;
      const list: string[] = JSON.parse(localStorage.getItem(inProgressKey) || '[]');
      if (!list.includes(formData.unitId)) {
        list.push(formData.unitId);
        localStorage.setItem(inProgressKey, JSON.stringify(list));
      }
    } catch (_e) {}

    try {
      const res = await surveyDraftService.saveDraft({
        parcelId: formData.parcelId,
        unitId: formData.unitId,
        reportType: 'CONDO_UNIT',
        currentStep,
        surveyData: sanitizeSurveyDataForSync(formData) as unknown as Record<string, unknown>,
        syncVersion,
      });

      set({
        syncStatus: 'SAVED',
        syncVersion: res.syncVersion || syncVersion + 1,
        lastSavedAt: new Date().toLocaleTimeString('vi-VN'),
      });
    } catch (err: unknown) {
      console.warn('[CondoUnitStore] Lỗi lưu bản nháp cloud:', err);
      set({ syncStatus: 'ERROR' });

      // Nếu lỗi do bị khóa ca bởi KSV khác (HTTP 400)
      const errorMsg = getErrorMessage(err);
      if (
        errorMsg.includes('khóa') ||
        errorMsg.includes('tiếp quản') ||
        errorMsg.includes('Kỹ sư')
      ) {
        void get().checkDraftLock();
      }
    }
  },

  updateFormData: (updates: Partial<CondoUnitFormData>) => {
    const prev = get().formData;
    const next = { ...prev, ...updates };

    // Đồng bộ 2 chiều giữa historyInterview và các cờ phẳng tương thích ngược
    if (updates.historyInterview) {
      const hi = updates.historyInterview;
      next.hasSensitiveEquipment = Boolean(hi.sensitiveEquipment?.has);
      next.sensitiveEquipmentDesc = hi.sensitiveEquipment?.description || '';
      next.interiorRenovationHistory = {
        hasRenovated: (hi.renovationLoad ?? 0) > 0 || (hi.majorRepair ?? 0) > 0,
        description: hi.renovationDescription || '',
      };
    } else if (
      updates.hasSensitiveEquipment !== undefined ||
      updates.sensitiveEquipmentDesc !== undefined ||
      updates.interiorRenovationHistory !== undefined
    ) {
      next.historyInterview = {
        ...next.historyInterview,
        renovationLoad: next.interiorRenovationHistory?.hasRenovated ? 1 : next.historyInterview.renovationLoad,
        renovationDescription: next.interiorRenovationHistory?.description || next.historyInterview.renovationDescription,
        sensitiveEquipment: {
          has: next.hasSensitiveEquipment,
          description: next.sensitiveEquipmentDesc,
        },
      };
    }

    // Tự động khử trùng lặp nếu có zones hoặc structuralElements cập nhật
    if (updates.zones) {
      next.zones = deduplicateZones(updates.zones, next.cadZonePins || []);
    }
    if (updates.structuralElements) {
      next.structuralElements = deduplicateElements(updates.structuralElements, next.cadElementPins || []);
    }

    // Đồng bộ 2 chiều giữa zones / structuralElements và localDefects phẳng
    if (updates.zones || updates.structuralElements) {
      const allDefects: UnitDefectItem[] = [];
      const currentZones = next.zones || [];
      const currentElements = next.structuralElements || [];

      currentZones.forEach((z) => {
        (z.defects || []).forEach((d) => {
          allDefects.push({
            id: d.id || `d-${d.defectCode}`,
            defectCode: d.defectCode,
            pinX: d.pinX,
            pinY: d.pinY,
            location: `${z.roomName} - ${z.componentType}`,
            type: d.screeningCategory === 'WATER_LEAK' ? 'WATER_LEAKAGE' : (d.screeningCategory === 'SPALLING' ? 'PEELING' : 'CRACK'),
            crackWidthMm: Number(d.widthMaxMm) || 0,
            crackLengthM: (Number(d.lengthMm) || 0) / 1000,
            description: d.notes || '',
            photoUrl: d.cuPhotoUrl || d.photoUrl || z.ctxPhotoUrl || '',
            ctxPhotoUrl: z.ctxPhotoUrl || undefined,
            cuPhotoUrl: d.cuPhotoUrl || undefined,
            hasScaleCard: d.hasScaleCard,
          });
        });
      });

      currentElements.forEach((e) => {
        (e.defects || []).forEach((d) => {
          allDefects.push({
            id: d.id || `d-${d.defectCode}`,
            defectCode: d.defectCode,
            pinX: d.pinX,
            pinY: d.pinY,
            location: `${e.roomName} - ${e.elementType}`,
            type: d.screeningCategory === 'WATER_LEAK' ? 'WATER_LEAKAGE' : (d.screeningCategory === 'SPALLING' ? 'PEELING' : 'CRACK'),
            crackWidthMm: Number(d.widthMaxMm) || 0,
            crackLengthM: (Number(d.lengthMm) || 0) / 1000,
            description: d.notes || '',
            photoUrl: d.cuPhotoUrl || d.photoUrl || e.ctxPhotoUrl || '',
            ctxPhotoUrl: e.ctxPhotoUrl || undefined,
            cuPhotoUrl: d.cuPhotoUrl || undefined,
            hasScaleCard: d.hasScaleCard,
          });
        });
      });

      next.localDefects = allDefects;
    }

    // Đồng bộ đối tượng signatures tương thích ngược
    if (
      updates.surveyorSignature !== undefined ||
      updates.ownerSignature !== undefined ||
      updates.ownerFeedback !== undefined ||
      updates.surveyDate !== undefined ||
      updates.workingMinutesPhotos !== undefined
    ) {
      next.signatures = {
        ...(next.signatures || {}),
        surveyorSignature: next.surveyorSignature,
        ownerSignature: next.ownerSignature,
        ownerFeedback: next.ownerFeedback,
        surveyDate: next.surveyDate,
        workingMinutesPhotos: next.workingMinutesPhotos,
      };
    }

    const time = new Date().toLocaleTimeString('vi-VN');

    // Lưu bản nháp cục bộ
    try {
      const draftKey = `metro2_condo_unit_draft_${next.parcelId}_${next.unitId}`;
      localStorage.setItem(draftKey, JSON.stringify(next));

      const inProgressKey = `metro2_condo_in_progress_units_${next.parcelId}`;
      const list: string[] = JSON.parse(localStorage.getItem(inProgressKey) || '[]');
      if (!list.includes(next.unitId)) {
        list.push(next.unitId);
        localStorage.setItem(inProgressKey, JSON.stringify(list));
      }
    } catch (_e) {}

    set({
      formData: next,
      lastSavedAt: time,
    });

    // Debounce auto-save lên máy chủ (1500ms) - Bỏ qua nếu đang nạp draft
    if (isHydratingDraft) {
      if (debounceTimer) {
        clearTimeout(debounceTimer);
        debounceTimer = null;
      }
    } else {
      if (debounceTimer) {
        clearTimeout(debounceTimer);
      }
      debounceTimer = setTimeout(() => {
        void get().syncDraftToServer();
      }, 1500);
    }
  },

  setStep: (step: number) => {
    if (step < 1 || step > 4) return;
    const { formData } = get();
    const pId = formData.parcelId;
    const uId = formData.unitId;

    // Lưu bước hiện tại vào localStorage
    try {
      const savedStepKey = `metro2_condo_unit_step_${pId}_${uId}`;
      localStorage.setItem(savedStepKey, String(step));
    } catch (_e) {}

    // Cập nhật URL query param và cuộn mượt
    if (typeof window !== 'undefined') {
      try {
        const url = new URL(window.location.href);
        url.searchParams.set('step', String(step));
        window.history.replaceState(window.history.state, '', url.toString());
      } catch (_e) {}
      window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
      document.documentElement.scrollTo({ top: 0, left: 0, behavior: 'instant' });
      document.body.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    }

    set({ currentStep: step });
    void get().syncDraftToServer();
  },

  nextStep: () => {
    const cur = get().currentStep;
    if (cur < 4) {
      get().setStep(cur + 1);
    }
  },

  prevStep: () => {
    const cur = get().currentStep;
    if (cur > 1) {
      get().setStep(cur - 1);
    }
  },

  // Z - E - D Actions
  addZone: (zone) => {
    const prev = get().formData;
    const existingPins = [
      ...(prev.cadZonePins || []),
      ...(prev.zones || []).map((z) => ({ zoneCode: z.zoneCode })),
    ];
    const generatedCode = getNextAvailablePinCode(existingPins, 'Z');
    const newZone: DamageZoneData = {
      id: `zone_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      zoneCode: zone?.zoneCode || generatedCode,
      floorName: `Tầng ${prev.floorNumber || 1}`,
      roomName: zone?.roomName || 'Phòng khách',
      componentType: zone?.componentType || 'Tường gạch vữa xi măng (Tường bao / ngăn)',
      wallMaterial: zone?.wallMaterial || 'Sơn nước nội thất / ngoại thất',
      overviewPhotos: [],
      ctxPhotoUrl: '',
      notes: '',
      defects: [],
      hasDamage: false,
      ...zone,
    };
    get().updateFormData({
      zones: [...prev.zones, newZone],
    });
  },

  updateZone: (index, updater) => {
    const prev = get().formData;
    const updated = [...prev.zones];
    if (index >= 0 && index < updated.length) {
      const oldCode = updated[index].zoneCode;
      updated[index] = { ...updated[index], ...updater };
      const newCode = updated[index].zoneCode;
      let pins = prev.cadZonePins;
      if (newCode && oldCode && newCode !== oldCode && Array.isArray(pins)) {
        pins = pins.map((p) => (p.zoneCode === oldCode ? { ...p, zoneCode: newCode, label: newCode } : p));
      }
      get().updateFormData({ zones: updated, cadZonePins: pins });
    }
  },

  removeZone: (index) => {
    const prev = get().formData;
    const targetZone = prev.zones[index];
    const updatedZones = prev.zones.filter((_, i) => i !== index);
    const updatedPins = targetZone
      ? (prev.cadZonePins || []).filter((p) => p.zoneCode !== targetZone.zoneCode)
      : prev.cadZonePins;
    get().updateFormData({ zones: updatedZones, cadZonePins: updatedPins });
  },

  addElement: (element) => {
    const prev = get().formData;
    const existingPins = [
      ...(prev.cadElementPins || []),
      ...(prev.structuralElements || []).map((e) => ({ zoneCode: e.elementCode })),
    ];
    const generatedCode = getNextAvailablePinCode(existingPins, 'E');
    const newElement: StructuralElementData = {
      id: `element_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      elementCode: element?.elementCode || generatedCode,
      floorName: `Tầng ${prev.floorNumber || 1}`,
      roomName: element?.roomName || 'Phòng khách',
      elementType: element?.elementType || 'Cột BTCT (Cột chịu lực chính)',
      materialType: element?.materialType || 'Bê tông cốt thép (BTCT) đổ toàn khối',
      overviewPhotos: [],
      ctxPhotoUrl: '',
      notes: '',
      defects: [],
      hasDamage: false,
      ...element,
    };
    get().updateFormData({
      structuralElements: [...prev.structuralElements, newElement],
    });
  },

  updateElement: (index, updater) => {
    const prev = get().formData;
    const updated = [...prev.structuralElements];
    if (index >= 0 && index < updated.length) {
      const oldCode = updated[index].elementCode;
      updated[index] = { ...updated[index], ...updater };
      const newCode = updated[index].elementCode;
      let pins = prev.cadElementPins;
      if (newCode && oldCode && newCode !== oldCode && Array.isArray(pins)) {
        pins = pins.map((p) => (p.zoneCode === oldCode ? { ...p, zoneCode: newCode, label: newCode } : p));
      }
      get().updateFormData({ structuralElements: updated, cadElementPins: pins });
    }
  },

  removeElement: (index) => {
    const prev = get().formData;
    const targetEl = prev.structuralElements[index];
    const updatedEls = prev.structuralElements.filter((_, i) => i !== index);
    const updatedPins = targetEl
      ? (prev.cadElementPins || []).filter((p) => p.zoneCode !== targetEl.elementCode)
      : prev.cadElementPins;
    get().updateFormData({ structuralElements: updatedEls, cadElementPins: updatedPins });
  },

  updateDefectsInZone: (zoneId, defects) => {
    const prev = get().formData;
    const updated = prev.zones.map((z) => {
      if (z.id === zoneId) {
        const burlandGrades = defects.map((d) => Number(d.burlandGrade) || 0);
        const maxBurland = burlandGrades.length > 0 ? Math.max(...burlandGrades) : 0;
        return {
          ...z,
          defects,
          hasDamage: defects.length > 0,
          burlandGrade: maxBurland,
        };
      }
      return z;
    });
    get().updateFormData({ zones: updated });
  },

  updateDefectsInElement: (elementId, defects) => {
    const prev = get().formData;
    const updated = prev.structuralElements.map((e) => {
      if (e.id === elementId) {
        return {
          ...e,
          defects,
          hasDamage: defects.length > 0,
        };
      }
      return e;
    });
    get().updateFormData({ structuralElements: updated });
  },

  addDefect: (defect) => {
    const prev = get().formData;
    const newDefect: UnitDefectItem = {
      ...defect,
      id: `ud-${Date.now()}`,
    };
    get().updateFormData({
      localDefects: [...prev.localDefects, newDefect],
    });
  },

  removeDefect: (defectId: string) => {
    const prev = get().formData;
    get().updateFormData({
      localDefects: prev.localDefects.filter((d) => d.id !== defectId),
    });
  },

  clearDraft: () => {
    if (debounceTimer) {
      clearTimeout(debounceTimer);
      debounceTimer = null;
    }
    const { parcelId, unitId } = get().formData;
    try {
      localStorage.removeItem(`metro2_condo_unit_draft_${parcelId}_${unitId}`);
      const inProgressKey = `metro2_condo_in_progress_units_${parcelId}`;
      const list: string[] = JSON.parse(localStorage.getItem(inProgressKey) || '[]');
      const filtered = list.filter((id) => id !== unitId);
      localStorage.setItem(inProgressKey, JSON.stringify(filtered));
    } catch (_e) {}
  },

  checkDraftLock: async () => {
    const { formData } = get();
    if (!formData.parcelId || !formData.unitId) return;
    try {
      const draftRes = await surveyDraftService.fetchDraft(formData.parcelId, formData.unitId);
      if (draftRes?.isLocked) {
        set({
          isLockedByOther: true,
          lockedInfo: {
            surveyorName: draftRes.activeSurveyorName || 'Kỹ sư khác',
            phone: draftRes.activeSurveyorPhone,
            minutesAgo: draftRes.minutesAgo || 1,
            message: draftRes.message,
          },
        });
      } else if (draftRes?.requiresHandover) {
        set({
          isHandoverModalOpen: true,
          handoverInfo: {
            fromSurveyorName: draftRes.fromSurveyorName || 'Kỹ sư ca trước',
            fromSurveyorPhone: draftRes.fromSurveyorPhone,
            currentStep: draftRes.currentStep || 1,
            securityCode: draftRes.securityCode || '',
            updatedAt: draftRes.updatedAt || '',
          },
        });
      }
    } catch (_e) {}
  },

  takeoverDraft: async (handoverCode: string, note?: string) => {
    const { formData } = get();
    if (!formData.parcelId || !formData.unitId) return false;

    try {
      const res = await surveyDraftService.takeoverDraft({
        parcelId: formData.parcelId,
        unitId: formData.unitId,
        handoverCode,
        note,
      });

      if (res && res.draft) {
        const serverData = res.draft.surveyData as Partial<CondoUnitFormData>;
        const targetStep =
          res.draft.currentStep >= 1 && res.draft.currentStep <= 4
            ? res.draft.currentStep
            : 1;

        const safelyMerged = mergeCondoUnitDataSafely(get().formData, serverData);

        set((state) => ({
          formData: safelyMerged,
          currentStep: targetStep,
          syncVersion: res.draft.syncVersion || state.syncVersion,
          syncStatus: 'SAVED',
          lastSavedAt: new Date().toLocaleTimeString('vi-VN'),
          isHandoverModalOpen: false,
          handoverInfo: null,
          isLockedByOther: false,
          lockedInfo: null,
        }));

        try {
          const draftKey = `metro2_condo_unit_draft_${formData.parcelId}_${formData.unitId}`;
          localStorage.setItem(draftKey, JSON.stringify(get().formData));
        } catch (_e) {}

        return true;
      }
      return false;
    } catch (err: unknown) {
      console.error('[CondoUnitStore] Tiếp quản ca thất bại:', err);
      throw err;
    }
  },

  releaseDraftLock: async () => {
    const { parcelId, unitId } = get().formData;
    if (!parcelId) return;
    try {
      await surveyDraftService.releaseLock(parcelId, unitId || null);
      set({ syncStatus: 'SAVED', lastSavedAt: new Date().toLocaleTimeString('vi-VN') });
    } catch (err) {
      console.warn('[CondoUnitStore] Lỗi mở khóa bản nháp:', err);
    }
  },
}));
