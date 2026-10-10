export interface UnitDefectItem {
  id: string;
  defectCode?: string; // D-01, D-02...
  pinX?: number | null; // 0..100% on CAD
  pinY?: number | null; // 0..100% on CAD
  location: string; // VD: Tường phòng khách, Góc cửa sổ phòng ngủ, Dầm trần bếp
  type: 'CRACK' | 'WATER_LEAKAGE' | 'PEELING' | 'OTHER';
  crackWidthMm: number;
  crackLengthM: number;
  description: string;
  photoUrl: string; // For backward compatibility / primary photo
  ctxPhotoUrl?: string; // Bối cảnh toàn diện vị trí khuyết tật
  cuPhotoUrl?: string; // Cận cảnh thước đo vết nứt
  hasScaleCard?: boolean;
}

export interface CondoWaterLeakageItem {
  id: string;
  leakageCode?: string; // WL-01, WL-02...
  location: string; // VD: Trần thạch cao phòng tắm, Hộp gen kỹ thuật bếp...
  description: string; // VD: Ố vàng loang lổ diện tích 0.8m2, sơn bong tróc rỉ nước
  photoUrl?: string; // Tương thích ngược
  ctxPhotoUrl?: string; // Ảnh bối cảnh toàn trần phòng
  cuPhotoUrl?: string; // Cận cảnh vết ố ẩm mốc có thước đo
}

export interface CondoUpperFloorLeakageState {
  has: boolean;
  leakageItems: CondoWaterLeakageItem[];
  // Tương thích ngược dạng điểm đơn lẻ
  location?: string;
  description?: string;
  photoUrl?: string;
}

export interface BeamSaggingData {
  hasSagging: boolean;
  location?: string;
  sagMm?: number;
  spanM?: number;
  ratioText?: string; // VD: 1/550
  photoUrl?: string;
}

export type CadBbox = { x: number; y: number; width: number; height: number } | [number, number, number, number];
export type CadPolygon = { x: number; y: number }[] | [number, number][];

export type ResidentStatus = 'CHỦ_HỘ_Ở' | 'CHO_THUÊ' | 'BỎ_TRỐNG_CHƯA_VỀ_Ở' | 'VẮNG_MẶT_KHÓA_CỬA';

export const VALID_RESIDENT_STATUSES: readonly ResidentStatus[] = [
  'CHỦ_HỘ_Ở',
  'CHO_THUÊ',
  'BỎ_TRỐNG_CHƯA_VỀ_Ở',
  'VẮNG_MẶT_KHÓA_CỬA'
];

export function isResidentStatus(val: unknown): val is ResidentStatus {
  return typeof val === 'string' && VALID_RESIDENT_STATUSES.includes(val as ResidentStatus);
}

export type DoorJammingStatus = 'NORMAL' | 'JAMMED' | 'RUBBING_FLOOR' | 'CRACKED_GLASS';

export const VALID_DOOR_JAMMING_STATUSES: readonly DoorJammingStatus[] = [
  'NORMAL',
  'JAMMED',
  'RUBBING_FLOOR',
  'CRACKED_GLASS'
];

export function isDoorJammingStatus(val: unknown): val is DoorJammingStatus {
  return typeof val === 'string' && VALID_DOOR_JAMMING_STATUSES.includes(val as DoorJammingStatus);
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
  unitCode: string; // VD: '03.03'
  floorNumber: number; // Lầu 3
  ownerName: string;
  ownerPhone: string;
  ownerIdCard: string;
  residentStatus: ResidentStatus;
  unitAreaM2: number | '';

  // Bộ ảnh nhận diện căn hộ con: P01 biển số phòng & P04 tổng quan cửa + lối đi hành lang
  photoP01: { url: string; photoCode?: string; notApplicable: boolean };
  photoP04: { url: string; photoCode?: string; notApplicable: boolean };

  // Thiết bị & Hoạt động nhạy cảm riêng tại căn hộ
  hasSensitiveEquipment: boolean;
  sensitiveEquipmentDesc: string;
  interiorRenovationHistory?: { hasRenovated: boolean; description?: string };

  // 3. Bản vẽ CAD riêng của căn & Khuyết tật nứt, thấm trần, võng dầm, kẹt cửa
  unitCadUrl?: string;
  cadBbox?: CadBbox | null;
  cadPolygon?: CadPolygon | null;
  localDefects: UnitDefectItem[];
  upperFloorWaterLeakage: CondoUpperFloorLeakageState;
  beamSagging?: BeamSaggingData;
  doorJammingStatus: DoorJammingStatus;
  settlementObserved: 'NONE' | 'SLIGHT' | 'NOTICEABLE' | 'SEVERE';
  settlementNotes: string;

  // 4. Ký xác nhận
  surveyorSignature: string;
  ownerSignature: string;
  ownerFeedback: string;
  surveyDate: string;
  workingMinutesPhotos?: string[];
}
