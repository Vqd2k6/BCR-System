import { GisParcel, BuildingUnit } from '../../../core/types/domain.types';

export interface UnitDefectItem {
  id: string;
  location: string; // VD: Tường phòng khách, Góc cửa sổ phòng ngủ, Dầm trần bếp
  type: 'CRACK' | 'WATER_LEAKAGE' | 'PEELING' | 'OTHER';
  crackWidthMm: number;
  crackLengthM: number;
  description: string;
  photoUrl: string;
}

export interface CondoUnitFormData {
  parcelId: string;
  unitId: string;

  // 1. Thông tin thừa kế từ tòa cha (Read-only for confirmation)
  parentInfo: {
    projectParcelCode: string;
    officialCadastralCode: string;
    buildingName: string;
    address: string;
    chainage: string;
    metroOffsetDistance: string;
    isConfirmed: boolean;
  };

  // 2. Thông tin riêng của căn hộ con (OOP Child attributes)
  unitCode: string; // VD: 'P.1204'
  floorNumber: number; // Lầu 12
  ownerName: string;
  ownerPhone: string;
  ownerIdCard: string;
  unitAreaM2: number | '';
  bedroomCount: number | '';
  balconyFacingMetro: 'YES' | 'NO' | 'UNKNOWN';

  // Bộ ảnh nhận diện căn hộ con: chỉ cần P01 và P04 theo yêu cầu
  photoP01: { url: string; notApplicable: boolean }; // Cửa chính căn hộ từ hành lang
  photoP04: { url: string; notApplicable: boolean }; // Toàn cảnh không gian chính / phòng khách

  // Thiết bị & Hoạt động nhạy cảm riêng tại căn hộ
  hasSensitiveEquipment: boolean;
  sensitiveEquipmentDesc: string;

  // 3. Khuyết tật và lún nứt riêng của căn con
  localDefects: UnitDefectItem[];
  settlementObserved: 'NONE' | 'SLIGHT' | 'NOTICEABLE' | 'SEVERE';
  settlementNotes: string;

  // 4. Ký xác nhận
  surveyorSignature: string;
  ownerSignature: string;
  ownerFeedback: string;
  surveyDate: string;
}
