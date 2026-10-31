import type React from 'react';
import type { LucideIcon } from 'lucide-react';
import type { CadZonePin } from '../../../../../../components/canvas/FloorCadPinningCanvas';
import type {
  AuditPhotoActionParams,
  AuditPhotoHistoryParams,
  AuditStepwiseData,
  DiffItem,
  PhotoActionPayload,
  PhotoReplaceParams,
  StepwiseAbsenceLogItem,
  StepwiseAccessLimitation,
  StepwiseBurlandSummary,
  StepwiseEcs,
  StepwiseExecutiveSummary,
  StepwiseGisMutationConfirmed,
  StepwiseHistoryInterview,
  StepwiseIdentificationPhotoItem,
  StepwiseIdentificationPhotos,
  StepwiseSettlementTilt,
  StepwiseSignatures,
  StepwiseVi,
} from '../../stepwise/types';
import type { StudioCommittedPhotoInfo } from '../../stepwise/context/AuditStudioImgContext';

export type CondoAuditEntityKind = 'BUILDING_MASTER' | 'MASTER_AREA' | 'CONDO_UNIT';
export type CondoEntityKind = CondoAuditEntityKind;

export type CondoAbsenceState = 'ABSENT' | 'ACCESS_HISTORY' | 'SUSPECTED' | 'NORMAL';
export type CondoAbsenceDecisionValue = 'ABSENT' | 'NOT_ABSENT';

export interface CondoAbsenceView {
  state: CondoAbsenceState;
  signals: string[];
  decision: CondoAbsenceDecisionValue | null;
  isHardAbsent: boolean;
  hasUnknownOwnerName: boolean;
  hasUnknownOwnerPhone: boolean;
}

export interface CondoAbsenceDecision {
  decision: CondoAbsenceDecisionValue;
  reason: string;
  decidedAt: string;
}

export interface CondoParentMasterSummary {
  masterReportId: string | null;
  masterStatus: string;
  projectParcelCode: string;
  buildingName: string | null;
  addressText: string;
  aboveFloors: number | null;
  undergroundFloors?: number | null;
  basementFloors: number | null;
  constructionYear: string | null;
  structureSystem: string | null;
  foundationType: string | null;
  foundationCategory: string | null;
  foundationCatScore: number | null;
  distanceToCenterlineM: number | null;
  totalEcs: number | null;
  ecsClass: string | null;
  avgVi: number | null;
  viClass: string | null;
  impactLevel: number | null;
  braRating: string | null;
  asBuiltDrawingCount: number;
  isLocked?: boolean;
}

export interface CondoFloorPlanItem {
  id: string;
  floor_number: number;
  floor_name: string | null;
  cad_photo_url: string | null;
  updated_at?: string | null;
}

export interface CondoFloorMatrixUnitCell {
  unitId: string;
  unitCode: string;
  unitType: 'MASTER_AREA' | 'CONDO_UNIT';
  status: string;
  reportId: string | null;
  burlandScore: number | null;
  ownerName: string | null;
}

export interface CondoFloorMatrixRow {
  floorNumber: number;
  floorName: string;
  cadPhotoUrl: string | null;
  totalUnits: number;
  approvedUnits: number;
  pendingUnits: number;
  absentUnits: number;
  criticalUnits: number;
  masterAreasCount: number;
  units: CondoFloorMatrixUnitCell[];
}

export interface CondoDefectItemData {
  id: string;
  defectCode: string;
  defectType: string;
  screeningCategory?: string;
  widthMaxMm: number | null;
  lengthMm: number | null;
  crackDirection?: string;
  activityState?: string;
  functionalImpactE6?: number | null;
  structuralSignificanceE2?: number | null;
  materialDegradationE4?: number | null;
  hasScaleCard: boolean;
  isStructuralCritical: boolean;
  cuPhotoUrl?: string | null;
  cuPhotos?: string[];
  cuPhotoCode?: string;
  pinX?: number | null;
  pinY?: number | null;
  notes?: string;
  isDeleted?: boolean;
  historyCount?: number;
  hasHistory?: boolean;
}

export interface CondoDamageZoneItemData {
  id: string;
  zoneCode: string;
  floorName: string;
  roomName: string;
  componentType: string;
  wallMaterial: string;
  ctxPhotoUrl?: string | null;
  ctxPhotoCode?: string;
  burlandGrade: number;
  functionalImpactRepairNeeded: boolean;
  overviewPhotos?: string[];
  notes?: string;
  isDeleted?: boolean;
  historyCount?: number;
  hasHistory?: boolean;
  defects: CondoDefectItemData[];
}

export interface CondoStructuralElementItemData {
  id: string;
  elementCode: string;
  floorName: string;
  roomName: string;
  elementType: string;
  materialType: string;
  dimensionsText?: string;
  ctxPhotoUrl?: string | null;
  ctxPhotoCode?: string;
  hasDamage: boolean;
  overviewPhotos?: string[];
  notes?: string;
  isDeleted?: boolean;
  historyCount?: number;
  hasHistory?: boolean;
  defects: CondoDefectItemData[];
}

/**
 * FormState chuẩn hóa cho Module 1: Studio Thẩm định Tòa Nhà Mẹ (BUILDING_MASTER - 5 Bước)
 */
export interface CondoMasterFormState {
  projectParcelCode: string;
  standardizedAddress: string;
  keepKsvBoundaryConfirmed: boolean;
  keepKsvBoundaryReason: string;
  officialCadastralCode: string;
  buildingName: string;
  houseNumber: string;
  street: string;
  ward: string;
  district: string;
  managementBoardName: string;
  managementContactName: string;
  managementContactPhone: string;
  accessLimitation: StepwiseAccessLimitation;
  adjacentBuildings: Record<string, { details?: string; note?: string; notes?: string; [key: string]: unknown }>;
  identificationPhotos: StepwiseIdentificationPhotos;
  photoP01: StepwiseIdentificationPhotoItem;
  photoP02: StepwiseIdentificationPhotoItem;
  photoP03: StepwiseIdentificationPhotoItem;
  photoP04: StepwiseIdentificationPhotoItem;
  aboveFloors: number | null;
  undergroundFloors: number | null;
  podiumFloors: number | null;
  totalUnits: number | null;
  constructionYear: string;
  isEstimatedYear: boolean;
  constructionAreaM2: string | number;
  landAreaM2: string | number;
  buildingHeightM: string | number;
  objectGroup: string;
  usageFunction: string;
  structureSystem: string;
  foundationType: string;
  foundationCatScore: number | null;
  foundationDepthM: string | number;
  foundationSpacingM: string | number;
  pileDimensionMm: string;
  foundationNotes: string;
  asBuiltDrawingPhotos: Array<{ url: string; photoCode?: string; notes?: string }>;
  historyInterview: StepwiseHistoryInterview;
  settlementTilt: StepwiseSettlementTilt;
  surveyScope: Record<string, unknown>;
  gisMutationConfirmed: StepwiseGisMutationConfirmed;
  metroOffsetDistance: string | number;
  clearanceOffsetDistance: string | number;
  parcelCoordinates: [number, number][];
  gpsCoords: { lat?: number; lng?: number; accuracy?: number };
  ecs: StepwiseEcs;
  vi: StepwiseVi;
  executiveSummary: StepwiseExecutiveSummary;
  summaryConclusions: string;
  engineeringRecommendations: string;
  signatures: StepwiseSignatures;
  photoRotations: Record<string, number>;
  [key: string]: unknown;
}

/**
 * FormState chuẩn hóa cho Module 2: Studio Thẩm định Khu Vực Dùng Chung (MASTER_AREA - 5 Bước)
 */
export interface CondoAreaFormState {
  unitCode: string;
  floorNumber: number;
  areaName: string;
  areaCategory: string;
  locationDescription: string;
  accessStatus: 'FULL' | 'PARTIAL' | 'LOCKED' | string;
  lockedReason: string;
  lockedPhotoUrl: string;
  floorCadUrl: string;
  boundingBox: { x: number; y: number; width: number; height: number } | null;
  overviewPhotos: string[];
  croppedCadUrl: string;
  /** Bản vẽ KSV đã ghim Z (`floors[0].cadSketchPhotoUrl`), tọa độ ghim tính theo ảnh này. */
  sketchCadUrl: string;
  structuralCadUrl: string;
  cadZonePins: CadZonePin[];
  cadElementPins: CadZonePin[];
  damageZones: CondoDamageZoneItemData[];
  structuralElements: CondoStructuralElementItemData[];
  burlandSummary: StepwiseBurlandSummary;
  summaryConclusions: string;
  engineeringRecommendations: string;
  signatures: StepwiseSignatures;
  photoRotations: Record<string, number>;
  [key: string]: unknown;
}

export interface CondoUnitDoorJamming {
  hasJamming: boolean;
  /** Mã trạng thái của form khảo sát: NORMAL, JAMMED, RUBBING_FLOOR, CRACKED_GLASS. */
  status: string;
  statusLabel: string;
  locations: string;
  severity: string;
  photoUrl: string;
  notes: string;
}

export interface CondoUnitLeakageItem {
  id: string;
  leakageCode: string;
  location: string;
  description: string;
  suspectedUpperUnitCode: string;
  ctxPhotoUrl: string;
  cuPhotoUrl: string;
}

export interface CondoUnitWaterLeakage {
  hasLeakage: boolean;
  items: CondoUnitLeakageItem[];
}

export interface CondoUnitBeamSagging {
  hasSagging: boolean;
  level: number | null;
  sagMm: number | null;
  spanM: number | null;
  ratioText: string;
  position: string;
  photoUrl: string;
  notes: string;
}

export interface CondoUnitAbsenteeView {
  reasonCode: string;
  reason: string;
  notes: string;
  witnessName: string;
  witnessRole: string;
  witnessPhone: string;
  noticeDelivered: boolean;
  rescheduleDate: string;
  attemptCount: number | null;
  photos: string[];
}

/**
 * FormState chuẩn hóa cho Module 3: Studio Thẩm định Căn Hộ Con (CONDO_UNIT).
 * `doorJamming` và `waterLeakageFromUpperFloor` là dạng hiển thị; `buildCondoUnitUpdatesPayload` đổi về khóa form khi lưu.
 */
export interface CondoUnitFormState {
  unitCode: string;
  displayCode: string;
  floorNumber: number | null;
  ownerName: string;
  ownerPhone: string;
  ownerIdCard: string;
  residentStatus: string;
  unitAreaM2: number | null;
  isRefusedOrAbsent: boolean;
  absence: CondoAbsenceView;
  absenceDecision: CondoAbsenceDecision | null;
  absenteeInfo: CondoUnitAbsenteeView | null;
  absenceLogs: StepwiseAbsenceLogItem[];
  doorJamming: CondoUnitDoorJamming;
  waterLeakageFromUpperFloor: CondoUnitWaterLeakage;
  beamSagging: CondoUnitBeamSagging;
  settlementObserved: string;
  settlementNotes: string;
  historyInterview: StepwiseHistoryInterview;
  hasSensitiveEquipment: boolean;
  sensitiveEquipmentDesc: string;
  interiorRenovationHistory: { hasRenovated: boolean; description: string };
  photoP01: StepwiseIdentificationPhotoItem;
  photoP04: StepwiseIdentificationPhotoItem;
  roomLayoutUrl: string;
  structuralCadUrl: string;
  cadZonePins: CadZonePin[];
  cadElementPins: CadZonePin[];
  isFloorCadFallback: boolean;
  roomLayoutNotes: string;
  damageZones: CondoDamageZoneItemData[];
  structuralElements: CondoStructuralElementItemData[];
  burlandSummary: StepwiseBurlandSummary;
  summaryConclusions: string;
  engineeringRecommendations: string;
  ownerFeedback: string;
  signatures: StepwiseSignatures;
  photoRotations: Record<string, number>;
  [key: string]: unknown;
}

export interface CondoAuditStepProps<TFormState extends Record<string, unknown>> {
  isEditMode: boolean;
  formState: TFormState;
  data: AuditStepwiseData;
  reportId: string;
  parentMasterSummary?: CondoParentMasterSummary;
  floorPlans?: CondoFloorPlanItem[];
  handleFieldChange: (key: keyof TFormState & string, label: string, val: unknown) => void;
  handleNestedFieldChange: (
    parentKey: keyof TFormState & string,
    childKey: string,
    label: string,
    val: unknown
  ) => void;
  isFieldDirty: (fieldKey: string, subKey?: string) => boolean;
  discardField: (fieldKey: string) => void;
  onOpenPhotoZoom: (url: string, title?: string, photoCode?: string, rotation?: number) => void;
  onOpenPhotoReplace?: (params: PhotoReplaceParams) => void;
  onOpenPhotoAction?: (params: AuditPhotoActionParams) => void;
  onOpenPhotoHistory?: (params: AuditPhotoHistoryParams) => void;
  onOpenEngineeringJudgement?: () => void;
  onOpenMasterReportById?: (masterReportId: string) => void;
  onRefresh?: () => void;
  stagedPhotoActions?: PhotoActionPayload[];
  onUndoPhotoAction?: (action: PhotoActionPayload) => void;
}

export interface CondoStepRegistryItem<TFormState extends Record<string, unknown>> {
  /** Trùng ID và số bước của Nhà dân: `step-N` và `0N`, được phép nhảy số. */
  stepId: string;
  number: string;
  title: string;
  icon: LucideIcon;
  /** Step tự render `<section>` (step gắn thẳng từ Nhà dân), shell không bọc thêm khung. */
  selfFramed?: boolean;
  Component: React.FC<CondoAuditStepProps<TFormState>>;
}

export interface CondoStudioEntryProps {
  data: AuditStepwiseData;
  reportId: string;
  onRefresh: () => void;
  onOpenPhotoZoom: (url: string, title?: string, photoCode?: string, rotation?: number) => void;
  onOpenPhotoReplace: (params: PhotoReplaceParams) => void;
  onOpenPhotoAction?: (params: AuditPhotoActionParams) => void;
  onOpenPhotoHistory?: (params: AuditPhotoHistoryParams) => void;
  onOpenDiffModal: (diffItems: DiffItem[], updates: Record<string, unknown>) => void;
  onOpenEngineeringJudgement: () => void;
  onOpenRejectModal?: () => void;
  onDirtyChange: (dirtyData: {
    dirtyCount: number;
    diffItems: DiffItem[];
    updates: Record<string, unknown>;
    discardAll: (silent?: boolean) => void;
    discardDiffItem?: (fieldKey: string) => void;
  }) => void;
  stagedPhotoActions?: PhotoActionPayload[];
  onUndoPhotoAction?: (action: PhotoActionPayload) => void;
  onDiscardAllStagedPhotos?: () => void;
  onSwitchReportId?: (newReportId: string) => void;
  registerStudioCommitHandler?: (handler: (items: StudioCommittedPhotoInfo[]) => void) => void;
}
