import type {
  DamageZoneData,
  StructuralElementData,
  DefectItem,
  CadZonePin,
} from '../../survey-phase1/types/phase1.types';

export type { DamageZoneData, StructuralElementData, DefectItem, CadZonePin };

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

export interface HistoryInterviewState {
  renovationLoad: number; // 0..3
  majorRepair: number; // 0..3
  pastSettlement: number; // 0..3
  neighborDamage: number; // 0..3
  fireFloodIncident: number; // 0..3
  usageStatus: string;
  continuousOperation247: boolean;
  sensitiveEquipment: {
    has: boolean;
    description: string;
  };
  renovationDescription?: string;
}

export interface CondoUnitFormData {
  parcelId: string;
  unitId: string;
  status?: 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'REJECTED' | string;

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
  displayCode?: string; // Biển số căn hộ thực tế đối soát với ảnh P01 (VD: '303', 'P.303')
  floorNumber: number; // Lầu 3
  ownerName: string;
  ownerPhone: string;
  ownerIdCard: string;
  residentStatus: ResidentStatus;
  unitAreaM2: number | '';

  // Bộ ảnh nhận diện căn hộ con: P01 biển số phòng & P04 tổng quan cửa + lối đi hành lang
  photoP01: { url: string; photoCode?: string; notApplicable: boolean };
  photoP04: { url: string; photoCode?: string; notApplicable: boolean };

  // Thiết bị & Hoạt động nhạy cảm riêng tại căn hộ (Chuẩn hóa Phase 1)
  historyInterview: HistoryInterviewState;
  hasSensitiveEquipment: boolean;
  sensitiveEquipmentDesc: string;
  interiorRenovationHistory?: { hasRenovated: boolean; description?: string };

  // 3. Bản vẽ CAD riêng của căn & Khảo sát theo chuẩn phân cấp Z - E - D (Phase 1 Standard)
  unitCadUrl?: string;
  unitStructuralCadUrl?: string;
  cadBbox?: CadBbox | null;
  cadPolygon?: CadPolygon | null;
  isCadOverriddenByUser?: boolean;
  zones: DamageZoneData[];
  structuralElements: StructuralElementData[];
  hasStructuralElements: boolean;
  cadZonePins?: CadZonePin[];
  cadElementPins?: CadZonePin[];

  // Giữ lại các trường đặc thù chung cư & tương thích ngược
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

  // Cấu trúc lồng ghép tương thích ngược signatures
  signatures?: {
    surveyorSignature?: string;
    ownerSignature?: string;
    ownerFeedback?: string;
    surveyDate?: string;
    workingMinutesPhotos?: string[];
  };

  // 5. Kịch bản Chủ nhà Vắng Mặt / Khóa Cửa (Absentee Survey Workflow)
  isAbsentee?: boolean;
  absenteeInfo?: CondoUnitAbsenteeInfo;
  // Tương thích phẳng thuận tiện cho audit / view
  absenteeReason?: string;
  absenteeMinutesPhotos?: string[];
  resumedFromAbsentee?: boolean;
}

export type CondoUnitAbsenceReason =
  | 'HOMEOWNER_ABSENT'
  | 'UNOCCUPIED_EMPTY'
  | 'REFUSED_ACCESS'
  | 'LOCKED_SECURITY'
  | 'OTHER';

export const CONDO_UNIT_ABSENCE_REASONS: readonly { value: CondoUnitAbsenceReason; label: string }[] = [
  { value: 'HOMEOWNER_ABSENT', label: 'Chủ nhà đi vắng / Khóa cửa ngoài' },
  { value: 'UNOCCUPIED_EMPTY', label: 'Căn hộ bỏ trống / Chưa về ở' },
  { value: 'REFUSED_ACCESS', label: 'Chủ nhà hoặc khách thuê từ chối tiếp cận' },
  { value: 'LOCKED_SECURITY', label: 'Căn hộ niêm phong / BQL không có chìa khóa' },
  { value: 'OTHER', label: 'Lý do khác (Nhập chi tiết vào ghi chú)' },
];

export function isCondoUnitAbsenceReason(val: unknown): val is CondoUnitAbsenceReason {
  return typeof val === 'string' && ['HOMEOWNER_ABSENT', 'UNOCCUPIED_EMPTY', 'REFUSED_ACCESS', 'LOCKED_SECURITY', 'OTHER'].includes(val);
}

export type CondoUnitWitnessRole =
  | 'BUILDING_MANAGEMENT'
  | 'SECURITY'
  | 'FLOOR_LEADER'
  | 'NEIGHBOR'
  | 'POLICE'
  | 'OTHER';

export const CONDO_UNIT_WITNESS_ROLES: readonly { value: CondoUnitWitnessRole; label: string }[] = [
  { value: 'BUILDING_MANAGEMENT', label: 'Ban Quản Lý (BQL) Tòa Nhà' },
  { value: 'SECURITY', label: 'Đội Bảo Vệ Tòa Nhà' },
  { value: 'FLOOR_LEADER', label: 'Trưởng Tầng / Đại Diện Cư Dân / Tổ Dân Phố' },
  { value: 'NEIGHBOR', label: 'Hàng Xóm Căn Hộ Liền Kề' },
  { value: 'POLICE', label: 'Công An / Cảnh Sát Khu Vực' },
  { value: 'OTHER', label: 'Người Chứng Kiến Khác' },
];

export function isCondoUnitWitnessRole(val: unknown): val is CondoUnitWitnessRole {
  return typeof val === 'string' && ['BUILDING_MANAGEMENT', 'SECURITY', 'FLOOR_LEADER', 'NEIGHBOR', 'POLICE', 'OTHER'].includes(val);
}

export interface CondoUnitAbsenteeInfo {
  absenceReason: CondoUnitAbsenceReason;
  customReason?: string;
  notes?: string;
  witnessName?: string;
  witnessRole?: CondoUnitWitnessRole;
  witnessPhone?: string;
  noticeDelivered: boolean;
  rescheduleDate?: string;
  attemptCount: number;
  absenteeMinutesPhotos: string[];
}

