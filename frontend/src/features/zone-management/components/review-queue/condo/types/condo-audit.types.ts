import type React from 'react';
import type { LucideIcon } from 'lucide-react';
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

export type CondoAuditEntityKind = 'BUILDING_MASTER' | 'MASTER_AREA' | 'CONDO_UNIT';
export type CondoEntityKind = CondoAuditEntityKind;

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
  widthMaxMm: number;
  lengthMm: number;
  crackDirection?: string;
  activityState?: string;
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
  pinX?: number | null;
  pinY?: number | null;
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
  pinX?: number | null;
  pinY?: number | null;
  hasDamage: boolean;
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
  identificationPhotos: StepwiseIdentificationPhotos;
  photoP01: StepwiseIdentificationPhotoItem;
  photoP02: StepwiseIdentificationPhotoItem;
  photoP03: StepwiseIdentificationPhotoItem;
  photoP04: StepwiseIdentificationPhotoItem;
  aboveFloors: number;
  undergroundFloors: number;
  podiumFloors: number;
  totalUnits: number;
  constructionYear: string;
  isEstimatedYear: boolean;
  constructionAreaM2: string | number;
  landAreaM2: string | number;
  buildingHeightM: string | number;
  objectGroup: string;
  usageFunction: string;
  structureSystem: string;
  foundationType: string;
  foundationCatScore: number;
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
  damageZones: CondoDamageZoneItemData[];
  structuralElements: CondoStructuralElementItemData[];
  burlandSummary: StepwiseBurlandSummary;
  summaryConclusions: string;
  engineeringRecommendations: string;
  signatures: StepwiseSignatures;
  photoRotations: Record<string, number>;
  [key: string]: unknown;
}

/**
 * FormState chuẩn hóa cho Module 3: Studio Thẩm định Căn Hộ Con (CONDO_UNIT - 4 Bước + Vắng mặt)
 */
export interface CondoUnitFormState {
  unitCode: string;
  floorNumber: number;
  ownerName: string;
  ownerPhone: string;
  residentRole: string;
  occupancyStatus: string;
  isRefusedOrAbsent: boolean;
  absenceReason: string;
  absenceLogs: StepwiseAbsenceLogItem[];
  absenteeNoticePhotos: string[];
  doorJamming: {
    hasJamming: boolean;
    locations: string;
    severity: string;
    photoUrl: string;
    notes: string;
  };
  waterLeakageFromUpperFloor: {
    hasLeakage: boolean;
    sourceLocation: string;
    suspectedUpperUnitCode: string;
    photoUrl: string;
    notes: string;
  };
  beamSagging: {
    hasSagging: boolean;
    level: number;
    sagMm: string | number;
    position: string;
    photoUrl: string;
    notes: string;
  };
  photoP01: StepwiseIdentificationPhotoItem;
  photoP04: StepwiseIdentificationPhotoItem;
  roomLayoutUrl: string;
  roomLayoutNotes: string;
  damageZones: CondoDamageZoneItemData[];
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
  stagedPhotoActions?: PhotoActionPayload[];
  onUndoPhotoAction?: (action: PhotoActionPayload) => void;
}

export interface CondoStepRegistryItem<TFormState extends Record<string, unknown>> {
  stepId: string;
  stepNumber: number;
  title: string;
  subtitle?: string;
  navLabel: string;
  icon: LucideIcon;
  dirtyWatchKeys: Array<keyof TFormState & string>;
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
}
