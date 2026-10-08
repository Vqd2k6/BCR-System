export interface UnitDefectItem {
  id: string;
  defectCode?: string; // D-01, D-02...
  pinX?: number; // 0..100% on CAD
  pinY?: number; // 0..100% on CAD
  location: string; // VD: Tường phòng khách, Góc cửa sổ phòng ngủ, Dầm trần bếp
  type: 'CRACK' | 'WATER_LEAKAGE' | 'PEELING' | 'OTHER';
  crackWidthMm: number;
  crackLengthM: number;
  description: string;
  photoUrl: string;
  hasScaleCard?: boolean;
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
  residentStatus: 'CHỦ_HỘ_Ở' | 'CHO_THUÊ' | 'BỎ_TRỐNG_CHƯA_VỀ_Ở' | 'VẮNG_MẶT_KHÓA_CỬA';
  unitAreaM2: number | '';

  // Bộ ảnh nhận diện căn hộ con: P01 biển số phòng & P04 tổng quan cửa + lối đi hành lang
  photoP01: { url: string; photoCode?: string; notApplicable: boolean };
  photoP04: { url: string; photoCode?: string; notApplicable: boolean };

  // Thiết bị & Hoạt động nhạy cảm riêng tại căn hộ
  hasSensitiveEquipment: boolean;
  sensitiveEquipmentDesc: string;
  interiorRenovationHistory?: { hasRenovated: boolean; description?: string };

  // 3. Bản vẽ CAD riêng của căn & Khuyết tật nứt, thấm trần, kẹt cửa
  unitCadUrl?: string;
  cadBbox?: { x: number; y: number; width: number; height: number } | null;
  cadPolygon?: { x: number; y: number }[] | null;
  localDefects: UnitDefectItem[];
  upperFloorWaterLeakage: {
    has: boolean;
    location?: string;
    description?: string;
    photoUrl?: string;
  };
  doorJammingStatus: 'NORMAL' | 'JAMMED' | 'RUBBING_FLOOR' | 'CRACKED_GLASS';
  settlementObserved: 'NONE' | 'SLIGHT' | 'NOTICEABLE' | 'SEVERE';
  settlementNotes: string;

  // 4. Ký xác nhận
  surveyorSignature: string;
  ownerSignature: string;
  ownerFeedback: string;
  surveyDate: string;
  workingMinutesPhotos?: string[];
}
