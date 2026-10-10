import type { GisParcel, BuildingUnit } from '../../../core/types/domain.types';
import type { EvidencePhotoItem, DamageZoneData, StructuralElementData } from '../../survey-phase1/types/phase1.types';
import type { CadZonePin } from '../../../components/canvas/FloorCadPinningCanvas';

// ============================================================================
// HẰNG SỐ DANH MỤC KHU VỰC DÙNG CHUNG
// ============================================================================
export const COMMON_ROOM_NAMES = [
  'Khu vực chính',
  'Sảnh thang máy',
  'Hành lang chung',
  'Cầu thang bộ thoát hiểm',
  'Phòng kỹ thuật điện nước',
  'Phòng sinh hoạt cộng đồng',
  'Khu vực hầm xe / ram dốc',
  'Khu vực sân thượng / tầng mái',
  'Sân vườn cảnh quan chung',
  'Hồ bơi / Khu tiện ích',
  'Khác (Ghi chú)',
] as const;

export const ARCH_COMPONENT_TYPES = [
  'Tường ngăn không chịu lực',
  'Trát tường / Hoàn thiện mặt ngoài',
  'Ốp lát gạch men / Đá granit',
  'Sơn nước nội / ngoại thất',
  'Trần thạch cao / Trần nhôm',
  'Lát nền gạch / Đá / Bê tông mài',
  'Cửa đi / Cửa sổ / Vách kính chung',
  'Lan can sắt / Kính hành lang',
  'Khác',
] as const;

export const WALL_MATERIALS = [
  'Sơn nước trên tường gạch',
  'Gạch ốp tường Ceramic / Porcelain',
  'Đá hoa cương / Đá Marble tự nhiên',
  'Vữa trát xi măng cát',
  'Tấm thạch cao hoàn thiện sơn',
  'Vách kính cường lực an toàn',
  'Tấm ốp nhôm Alu / Composite',
  'Khác',
] as const;

export const STRUCTURAL_ELEMENT_TYPES = [
  'Cột bê tông cốt thép',
  'Vách cứng BTCT / Lõi thang máy',
  'Dầm khung bê tông cốt thép',
  'Bản sàn bê tông cốt thép',
  'Tường vây hầm / Cọc Barrette',
  'Khung kèo thép tiền chế',
  'Bản thang bộ BTCT',
  'Khác',
] as const;

export const STRUCTURAL_MATERIALS = [
  'Bê tông cốt thép toàn khối',
  'Bê tông ứng suất trước',
  'Khung kết cấu thép liên hợp',
  'Khác',
] as const;

// ============================================================================
// TOẠ ĐỘ & BOUNDING BOX CHUẨN HOÁ
// ============================================================================
export interface NormalizedBbox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export function normalizeBbox(
  raw: [number, number, number, number] | { x: number; y: number; width: number; height: number } | null | undefined
): NormalizedBbox | null {
  if (!raw) return null;
  if (Array.isArray(raw)) {
    if (raw.length < 4) return null;
    return {
      x: raw[0],
      y: raw[1],
      width: raw[2] >= raw[0] ? raw[2] - raw[0] : raw[2],
      height: raw[3] >= raw[1] ? raw[3] - raw[1] : raw[3],
    };
  }
  if (typeof raw === 'object' && 'x' in raw && 'y' in raw && 'width' in raw && 'height' in raw) {
    return {
      x: Number(raw.x) || 0,
      y: Number(raw.y) || 0,
      width: Number(raw.width) || 0,
      height: Number(raw.height) || 0,
    };
  }
  return null;
}

// ============================================================================
// GIAO THỨC DỮ LIỆU BẢN VẼ TẦNG & KHẢO SÁT KHU VỰC
// ============================================================================
export interface FloorPartition {
  id: string;
  unit_code: string;
  floor_number: number;
  cad_bbox?: [number, number, number, number] | { x: number; y: number; width: number; height: number } | null;
  unit_cad_url?: string;
  unit_type?: 'UNIT' | 'MASTER';
}

export interface FloorPlanResponse {
  plan?: {
    id: string;
    cad_photo_url: string;
    floor_name: string;
    floor_number: number;
    floor_code?: string;
    floorCode?: string;
  };
  units?: FloorPartition[];
}

export interface MasterAreaSurveyPayload {
  overviewPhotos?: EvidencePhotoItem[];
  cadSketchPhotoUrl?: string;
  cadStructuralSketchPhotoUrl?: string;
  useSeparateStructuralCad?: boolean;
  cadZonePins?: CadZonePin[];
  cadElementPins?: CadZonePin[];
  zones?: DamageZoneData[];
  structuralElements?: StructuralElementData[];
  hasStructuralElements?: boolean;
  noStructuralElementsReason?: string;
  dominantBurlandGrade?: number;
  surveyorRemarks?: string;
  surveyorSignatureUrl?: string;
}

export type AreaSurveySyncStatus = 'SAVED_CLOUD' | 'SAVED_LOCAL' | 'SYNCING' | 'ERROR';

export interface FloorPlanItem {
  id: string;
  floor_number: number;
  floor_name: string;
  floor_code?: string;
  cad_photo_url: string;
  cad_photo_code?: string;
}

export interface SurveyCondoMasterAreaModalProps {
  parcel: GisParcel;
  unit: BuildingUnit;
  onClose: () => void;
  onSurveyCompleted: () => void;
  readOnly?: boolean;
  floorCadUrl?: string;
  floorPlans?: FloorPlanItem[];
}

export interface PreFlightCheckItem {
  id: string;
  step: 1 | 2 | 3 | 4 | 5;
  stepTitle: string;
  category: 'PHOTO' | 'CAD' | 'ZONE' | 'STRUCTURAL' | 'DEFECT' | 'REMARKS' | 'SYNC';
  title: string;
  description: string;
  status: 'VALID' | 'WARNING' | 'ERROR';
  tabIndex?: number;
  actionLabel?: string;
}

export interface PreFlightValidationResult {
  isValid: boolean;
  totalChecks: number;
  passedChecks: number;
  blockingErrors: PreFlightCheckItem[];
  warnings: PreFlightCheckItem[];
  allItems: PreFlightCheckItem[];
}

