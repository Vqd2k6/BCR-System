import { create } from 'zustand';
import { GisParcel, BuildingUnit } from '../../../core/types/domain.types';
import { CondoUnitFormData, UnitDefectItem } from '../types/condo-unit.types';

interface CondoUnitSurveyStore {
  currentStep: number;
  formData: CondoUnitFormData;
  lastSavedAt: string | null;

  initializeForm: (parcel: GisParcel, unit?: BuildingUnit | null) => void;
  updateFormData: (updates: Partial<CondoUnitFormData>) => void;
  setStep: (step: number) => void;
  nextStep: () => void;
  prevStep: () => void;
  addDefect: (defect: Omit<UnitDefectItem, 'id'>) => void;
  removeDefect: (defectId: string) => void;
  clearDraft: () => void;
}

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
  unitCode: 'P.101',
  floorNumber: 1,
  ownerName: '',
  ownerPhone: '',
  ownerIdCard: '',
  unitAreaM2: 65,
  bedroomCount: 2,
  balconyFacingMetro: 'YES',
  photoP01: { url: '', notApplicable: false },
  photoP04: { url: '', notApplicable: false },
  hasSensitiveEquipment: false,
  sensitiveEquipmentDesc: '',
  localDefects: [],
  settlementObserved: 'NONE',
  settlementNotes: '',
  surveyorSignature: '',
  ownerSignature: '',
  ownerFeedback: 'Đồng ý với hiện trạng ghi nhận tại căn hộ',
  surveyDate: new Date().toLocaleDateString('vi-VN'),
});

export const useCondoUnitSurveyStore = create<CondoUnitSurveyStore>((set, get) => ({
  currentStep: 1,
  formData: getDefaultCondoUnitFormData('default_parcel', 'default_unit'),
  lastSavedAt: null,

  initializeForm: (parcel: GisParcel, unit?: BuildingUnit | null) => {
    const pId = parcel.id;
    const uId = unit?.id || 'unit-default';
    const draftKey = `metro2_condo_unit_draft_${pId}_${uId}`;

    let data = getDefaultCondoUnitFormData(pId, uId);

    // Kế thừa thông tin toà nhà cha
    data.parentInfo = {
      projectParcelCode: parcel.projectParcelCode || (parcel as any).project_parcel_code || 'B-001',
      officialCadastralCode: parcel.officialCadastralCode || (parcel as any).official_cadastral_code || 'DC-001',
      buildingName: (parcel as any).buildingName || 'Tòa nhà Chung Cư',
      address: `${parcel.houseNumber ? `${parcel.houseNumber}, ` : ''}${parcel.street || ''}`,
      chainage: 'Km 3+450',
      metroOffsetDistance: `${(parcel as any).distanceMeters || 12.5}m`,
      isConfirmed: false,
    };

    // Gán thông tin căn hộ
    if (unit) {
      data.unitCode = (unit as any).unit_code || unit.unitCode || data.unitCode;
      const parsedFloor = parseInt(String((unit as any).floor_number || (unit as any).floorLevel || '1').replace(/\D/g, ''), 10);
      data.floorNumber = isNaN(parsedFloor) ? 1 : parsedFloor;
      data.ownerName = (unit as any).owner_name || unit.ownerName || '';
      data.ownerPhone = (unit as any).owner_phone || unit.ownerPhone || '';
      data.ownerIdCard = (unit as any).owner_id_card || (unit as any).ownerIdCard || '';
    }

    // Khôi phục bản nháp nếu có
    try {
      const saved = localStorage.getItem(draftKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.parcelId === pId && parsed.unitId === uId) {
          data = { ...data, ...parsed };
        }
      }
    } catch (_e) {}

    set({
      currentStep: 1,
      formData: data,
      lastSavedAt: new Date().toLocaleTimeString('vi-VN'),
    });
  },

  updateFormData: (updates: Partial<CondoUnitFormData>) => {
    const prev = get().formData;
    const next = { ...prev, ...updates };
    const time = new Date().toLocaleTimeString('vi-VN');

    // Lưu bản nháp cục bộ
    try {
      const draftKey = `metro2_condo_unit_draft_${next.parcelId}_${next.unitId}`;
      localStorage.setItem(draftKey, JSON.stringify(next));
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
    if (cur < 4) {
      set({ currentStep: cur + 1 });
    }
  },

  prevStep: () => {
    const cur = get().currentStep;
    if (cur > 1) {
      set({ currentStep: cur - 1 });
    }
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
    const { parcelId, unitId } = get().formData;
    try {
      localStorage.removeItem(`metro2_condo_unit_draft_${parcelId}_${unitId}`);
    } catch (_e) {}
  },
}));
