import { DefectItem } from '../../../components/canvas/DefectPinningCanvas';
import { CadZonePin } from '../../../components/canvas/FloorCadPinningCanvas';
import { PolygonPoint, FloorSplitLine } from '../../../components/canvas/FacadePolygonCanvas';

export type ObjectGroupType = 'GENERAL' | 'IMPORTANT' | 'CRITICAL';

export interface AdjacentBuildingState {
  left: { type: string; details: string; note: string };
  right: { type: string; details: string; note: string };
  back: { type: string; details: string; note: string };
}

export interface DamageZoneData {
  id: string;
  zoneCode: string;
  floorName: string;
  roomName: string;
  customRoomName?: string;
  componentType: string;
  customComponentType?: string;
  wallMaterial: string;
  customWallMaterial?: string;
  functionalImpactRepairNeeded?: boolean;
  burlandGrade?: number;
  overviewPhotos: string[]; // Hỗ trợ nhiều ảnh tổng quan cho 1 Vùng Z
  ctxPhotoUrl?: string; // Ảnh bối cảnh chính để thả ghim nứt
  hasDamage?: boolean; // false nếu không có hư hại, true nếu có điểm khuyết tật D
  notes: string;
  defects: DefectItem[];
}

export interface StructuralElementData {
  id: string;
  elementCode: string; // E-01, E-02...
  floorName: string;
  roomName: string;
  customRoomName?: string;
  elementType: string; // Cột BTCT, Dầm BTCT, Bản sàn...
  customElementType?: string;
  materialType: string; // BTCT toàn khối, Khung thép...
  customMaterialType?: string;
  overviewPhotos: string[]; // Hỗ trợ nhiều ảnh tổng quan cho 1 Vùng E
  ctxPhotoUrl?: string; // Ảnh bối cảnh chính để thả ghim khuyết tật kết cấu
  hasDamage?: boolean; // false nếu không có hư hại, true nếu có khuyết tật D
  notes: string;
  defects: DefectItem[];
}

export interface FloorSurveyData {
  id: string;
  floorName: string;
  overviewPhotos: { id: string; url: string; caption?: string }[];
  cadSketchPhotoUrl: string; // Sơ đồ CAD_01 (Mặt bằng kiến trúc & Mảng tường Vùng Z)
  cadStructuralSketchPhotoUrl?: string; // Sơ đồ CAD_02 (Mặt bằng kết cấu chịu lực Vùng E)
  cadZonePins: CadZonePin[]; // Ghim Vùng Z (Kiến trúc / Mảng tường trên CAD_01)
  cadElementPins?: CadZonePin[]; // Ghim Vùng E (Kết cấu chịu lực trên CAD_02)
  zones: DamageZoneData[];
  structuralElements?: StructuralElementData[];
}

export interface HistoryInterviewState {
  renovationLoad: number; // 0..3
  majorRepair: number; // 0..3
  pastSettlement: number; // 0..3
  neighborDamage: number; // 0..3
  fireFloodIncident: number; // 0..3
  sensitiveEquipment: { has: boolean; description: string };
  usageStatus: string;
  continuousOperation247: boolean;
}

export interface SettlementTiltState {
  diffSettlement: {
    level: number; // 0..4
    position: string;
    photoUrl?: string;
  };
  buildingTilt: {
    level: number; // 0..4
    xPermille: number | '';
    yPermille: number | '';
    direction?: string;
  };
  beamSagging: {
    level: number; // 0..4
    position: string;
    sagMm: number | '';
    description?: string;
  };
  dataSource: string[];
  reliability: 'HIGH' | 'MEDIUM' | 'LOW';
  needAdditionalMonitoring: { required: boolean; notes: string };
}

export interface EcsScoreState {
  e1: number; // 0..4 (Burland max)
  e2: number; // 0..4 (Structural flag)
  e3: number; // 0..4 (Settlement tilt)
  e4: number; // 0..4 (Material deterioration)
  e5: number; // 0..4 (History interview)
  e6: number; // 0..4 (Functional/Overall)
  totalEcs: number; // 0..24
  ecsClass: 'GOOD' | 'MEDIUM' | 'DEFICIENT' | 'CRITICAL';
  engineeringJudgement: { action: 'KEEP' | 'UPGRADE' | 'DOWNGRADE'; reason: string };
  isOverrideLocked: boolean;
}

export interface ViScoreState {
  v1: number; // 1, 2, 4
  v2: number; // 1..4
  v3: number; // 1..4
  v4: number; // 1..4
  v5: number; // 1..4
  v6: number; // 1..4
  totalVi: number; // 6..24
  viAvg: number; // 1.0..4.0
  viClass: 'LOW' | 'MEDIUM' | 'HIGH' | 'VERY_HIGH';
  engineeringJudgement: { action: 'KEEP' | 'UPGRADE' | 'DOWNGRADE'; reason: string };
}

export interface Phase1SurveyFormData {
  parcelId: string;
  projectParcelCode: string;
  officialCadastralCode: string;
  buildingName: string;
  houseNumber: string;
  street: string;
  ownerName: string;
  ownerPhone: string;
  objectGroup: ObjectGroupType;
  chainage: string;
  metroOffsetDistance: string;
  clearanceOffsetDistance: string;
  gpsCoords: { lat: number; lng: number };
  adjacentBuildings: AdjacentBuildingState;
  surveyCaseType?: 'NORMAL' | 'ABSENTEE' | 'APARTMENT' | 'UNDER_CONSTRUCTION';
  isAbsenteeSurvey?: boolean;
  absenteeReason?: string;
  customAbsenteeReason?: string; // Nhập tay khi chọn Lý do khác
  absenteeMinutesPhotos?: string[]; // Ảnh biên bản vắng nhà (có thể chụp nhiều ảnh)
  underConstructionPhotos?: string[]; // Ảnh công trình đang thi công xây dựng (nhiều ảnh)
  constructionStageNotes?: string; // Ghi chú giai đoạn thi công xây dựng

  // Thông tin mở rộng cho Tòa nhà Chung cư / Cao tầng
  unitsPerFloor?: number | ''; // Số căn mỗi tầng
  totalUnitsCount?: number | ''; // Tổng số căn hộ ước tính
  managementContactName?: string; // Đại diện BQL / BQT tòa nhà
  managementContactPhone?: string; // Số điện thoại BQL tòa nhà

  // Step 1 Photos & Polygon
  photoP01: { url: string; notApplicable: boolean };
  photoP02: {
    url: string;
    notApplicable: boolean;
    polygonPoints: PolygonPoint[];
    floorSplits: FloorSplitLine[];
    widthM: number | '';
    heightM: number | '';
  };
  photoP03: {
    url: string;
    notApplicable: boolean;
    tag?: string;
    additionalPhotos?: { url: string; tag: string }[];
  };
  photoP04: { url: string; notApplicable: boolean };

  // Step 2.1 Architecture
  usageFunction: string;
  aboveFloors: number;
  undergroundFloors: number;
  constructionYear: number | '';
  isEstimatedYear: boolean;
  structureSystem: string;
  foundationType: string;
  pileDimensionMm: string;
  asBuiltDrawingPhotoUrl?: string;
  asBuiltDrawingFiles: { id: string; name: string; url: string }[];
  foundationCatScore: number; // 1..5

  // Step 2.2 History
  historyInterview: HistoryInterviewState;

  // Step 3 Floors & Zones & Defects
  floors: FloorSurveyData[];

  // Step 4 Burland & Structural Summary
  burlandSummary: {
    predominantGrade: number;
    localMaxGrade: number;
    governingZoneCode: string;
    governingZoneDescription: string;
    representativeness: 'GLOBAL' | 'LOCAL';
    structuralFlagLevel: 'NONE' | 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL';
    needStructuralEngineerReview: boolean;
  };

  // Step 5 Settlement & Tilt
  settlementTilt: SettlementTiltState;

  // Step 6 Scope & GIS Mutation
  surveyScope: {
    externalFront: boolean;
    surveyedFloors: string[];
    roofTerrace: boolean;
    basement: boolean;
    backyardOuthouse: boolean;
  };
  accessLimitation: {
    type: 'FULL_100' | 'LIMITED' | 'ABSENT_REFUSED';
    restrictedAreas: string[];
    restrictedFloorLevels: string[];
    mainReason: string;
    notes: string;
  };
  gisMutationConfirmed: {
    type: 'MATCH' | 'SPLIT' | 'MERGE';
    notes: string;
  };

  // Data Completeness Gate Decision
  gateDecision?: {
    decision: 'ALLOW' | 'CONDITIONAL' | 'PENDING';
    reason: string;
  };

  // Step 7 Auto Calculations
  ecs: EcsScoreState;
  vi: ViScoreState;

  // Step 8 Executive Dashboard
  executiveSummary: {
    keyRisksDefectsText: string;
    specificRecommendationsText: string;
    constructionImpactStatus: 'PENDING';
    braStatus: 'PENDING';
  };

  // Step 9 Signatures & Working Minutes
  signatures: {
    ownerFeedback: string;
    preparedBy: {
      fullName: string;
      title: string;
      date: string;
      photoUrl?: string;
    };
    checkedBy?: {
      fullName: string;
      title: string;
      date: string;
      photoUrl?: string;
    };
    ownerRepresentative: {
      fullName: string;
      role: string;
      date: string;
      photoUrl?: string;
    };
    workingMinutesPhotos: string[];
  };
}
