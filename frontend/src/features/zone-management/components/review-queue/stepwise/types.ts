import type { PhotoReplaceParams } from '../AuditPhotoReplaceModal';
import type { FloorSurveyData, DamageZoneData, DefectItem, CadZonePin, PolygonPoint } from '../../../../survey-phase1/types/phase1.types';
import type { AuditHistoryLogItem } from '../AuditHistoryModal';
import type { RiskCardData } from '../EngineeringJudgementModal';

export type { PhotoReplaceParams, RiskCardData };

export interface StepwiseIdentificationPhotoItem {
  url?: string;
  photoUrl?: string;
  raw_photo_url?: string;
  annotated_photo_url?: string;
  photoCode?: string;
  caption?: string;
  notes?: string;
  polygonPoints?: PolygonPoint[] | null;
  floorSplits?: unknown;
  additionalPhotos?: Array<{ url: string; caption?: string; photoCode?: string; notes?: string }>;
  [key: string]: unknown;
}

export interface StepwiseIdentificationPhotos {
  photoP01?: StepwiseIdentificationPhotoItem | string;
  photoP02?: StepwiseIdentificationPhotoItem | string;
  photoP03?: StepwiseIdentificationPhotoItem | string;
  photoP04?: StepwiseIdentificationPhotoItem | string;
  photoP05?: StepwiseIdentificationPhotoItem | string;
  p01?: StepwiseIdentificationPhotoItem | string;
  p02?: StepwiseIdentificationPhotoItem | string;
  p03?: StepwiseIdentificationPhotoItem | string;
  p04?: StepwiseIdentificationPhotoItem | string;
  p05?: StepwiseIdentificationPhotoItem | string;
  facadeBoundaryGeojson?: unknown;
  [key: string]: unknown;
}

export interface StepwiseHistoryInterview {
  renovationLoad?: number;
  renovationYear?: number | string;
  renovationAreaM2?: number | string;
  renovationDetails?: string;
  renovationNotes?: string;
  majorRepair?: number;
  majorRepairYear?: number | string;
  majorRepairType?: string;
  repairNotes?: string;
  pastSettlement?: number;
  settlementNotes?: string;
  neighborDamage?: number;
  neighborNotes?: string;
  fireFloodIncident?: number;
  fireFloodNotes?: string;
  sensitiveEquipment?: { has?: boolean; description?: string; [key: string]: unknown };
  continuousOperation247?: { has?: boolean; notes?: string; [key: string]: unknown };
  [key: string]: unknown;
}

export interface StepwiseBurlandSummary {
  localMaxGrade?: number;
  predominantGrade?: number;
  structuralFlagLevel?: string;
  governingZoneCode?: string;
  representativeness?: string;
  needStructuralEngineerReview?: boolean;
  evaluationNotes?: string;
  engineerReviewNotes?: string;
  distributionHistogram?: Record<string, number>;
  controllingDefectsCount?: number;
  summaryNotes?: string;
  [key: string]: unknown;
}

export interface StepwiseAccessLimitation {
  type?: 'FULL_100' | 'PARTIAL' | 'EXTERNAL_ONLY' | string;
  isRestricted?: boolean;
  mainReason?: string;
  restrictedReasons?: string[];
  restrictedAreas?: string[];
  customRestrictedReason?: string;
  notes?: string;
  evidencePhotos?: Array<{ url: string; photoCode?: string; notes?: string }>;
  [key: string]: unknown;
}

export interface StepwiseGisMutationConfirmed {
  isMutated?: boolean;
  type?: 'SPLIT' | 'MERGE' | 'BOUNDARY_ADJUST' | 'MATCH' | 'NONE' | string;
  mutationType?: 'SPLIT' | 'MERGE' | 'BOUNDARY_ADJUST' | 'NONE' | string;
  surveyorNotes?: string;
  adminNotes?: string;
  details?: {
    splitChildren?: Array<{
      id: string;
      projectParcelCode?: string;
      officialCadastralCode?: string;
      landAreaM2?: number | string;
      ownerName?: string;
      [key: string]: unknown;
    }>;
    selectedMergeCodes?: string[];
    [key: string]: unknown;
  };
  notes?: string;
  [key: string]: unknown;
}

export interface StepwiseEcs {
  e1?: number;
  e2?: number;
  e3?: number;
  e4?: number;
  e5?: number;
  e6?: number;
  totalEcs?: number;
  ecsClass?: string;
  [key: string]: number | string | undefined;
}

export interface StepwiseVi {
  v1?: number;
  v2?: number;
  v3?: number;
  v4?: number;
  v5?: number;
  v6?: number;
  totalVi?: number;
  avgVi?: number;
  viClass?: string;
  [key: string]: number | string | undefined;
}

export interface StepwiseExecutiveSummary {
  braStatus?: string;
  constructionImpactStatus?: string;
  summaryConclusions?: string;
  keyRisksDefectsText?: string;
  recommendations?: string;
  specificRecommendationsText?: string;
  [key: string]: unknown;
}

export interface StepwiseAbsenceLogItem {
  id?: string;
  attemptNumber?: number;
  attempt_number?: number;
  attemptDate?: string;
  attemptTime?: string;
  reason?: string;
  notes?: string;
  photoUrl?: string;
  created_at?: string;
  [key: string]: unknown;
}

export interface StepwiseSignatures {
  surveyorSignature?: string | null;
  surveyorName?: string;
  surveyorPhone?: string;
  preparedBy?: { fullName?: string; photoUrl?: string };
  ownerSignature?: string | null;
  ownerName?: string;
  ownerPhone?: string;
  ownerRepresentative?: { fullName?: string; photoUrl?: string };
  ownerFeedback?: string;
  ownerRemarks?: string;
  witnessName?: string;
  witnessRole?: string;
  witnessPhone?: string;
  witnessSignature?: string | null;
  workingMinutesPhotos?: (string | { url?: string; photoUrl?: string; photoCode?: string })[];
  [key: string]: unknown;
}

export interface StepwiseSettlementTilt {
  diffSettlement?: {
    level?: number | string;
    position?: string;
    photoUrl?: string;
    photoCode?: string;
    photos?: Array<{ url: string; photoCode?: string; notes?: string }>;
    notes?: string;
  };
  buildingTilt?: {
    level?: number | string;
    xPermille?: number | string;
    yPermille?: number | string;
    direction?: string;
    photoUrl?: string;
    photoCode?: string;
    photos?: Array<{ url: string; photoCode?: string; notes?: string }>;
    notes?: string;
  };
  beamSagging?: {
    level?: number | string;
    sagMm?: string | number;
    position?: string;
    description?: string;
  };
  abnormalCase?: {
    photoUrl?: string;
    photoCode?: string;
    photos?: Array<{ url: string; photoCode?: string; notes?: string }>;
    notes?: string;
  };
  dataSource?: string[] | unknown[];
  reliability?: string;
  needAdditionalMonitoring?: {
    required?: boolean;
    notes?: string;
  };
  [key: string]: unknown;
}

export interface AuditStepwiseFormState {
  projectParcelCode?: string;
  officialCadastralCode?: string;
  houseNumber?: string;
  street?: string;
  ward?: string;
  district?: string;
  buildingName?: string;
  ownerName?: string;
  ownerPhone?: string;
  buildingType?: string;
  objectGroup?: string;
  usageFunction?: string;
  aboveFloors?: number;
  undergroundFloors?: number;
  constructionYear?: number | string;
  isEstimatedYear?: boolean;
  constructionAreaM2?: number | string;
  buildingHeightM?: number | string;
  adjacentBuildings?: unknown;
  surveyCaseType?: string;
  vacantLandNotes?: string;
  constructionStageNotes?: string;
  unitCode?: string;
  unitFloorNumber?: string;
  managementContactName?: string;
  managementContactPhone?: string;
  gpsCoords?: { lat?: number; lng?: number; accuracy?: number };
  gpsLocation?: { lat?: number; lng?: number; latitude?: number; longitude?: number };
  coordinates?: [number, number] | [number, number][] | unknown;
  parcelCoordinates?: [number, number][];
  metroOffsetDistance?: string | number;
  clearanceOffsetDistance?: string | number;
  metroDistanceM?: number | string;
  distanceToMetroCenterlineM?: number | string;
  manualMetroDistanceM?: string | number;
  chainage?: string;
  structureSystem?: string;
  foundationType?: string;
  foundationCatScore?: number | null;
  foundationDepthM?: string | number;
  foundationDensity?: string | number;
  foundationSpacingM?: string | number;
  pileDimensionMm?: string;
  pileDimensions?: string;
  pileWidthMm?: number | string;
  pileLengthMm?: number | string;
  foundationNotes?: string;
  asBuiltDrawingPhotos?: Array<{ url: string; photoCode?: string; notes?: string }>;
  asBuiltDrawingPhotoUrl?: string;
  identificationPhotos?: StepwiseIdentificationPhotos;
  photoP01?: StepwiseIdentificationPhotoItem | string;
  photoP02?: StepwiseIdentificationPhotoItem | string;
  photoP03?: StepwiseIdentificationPhotoItem | string;
  photoP04?: StepwiseIdentificationPhotoItem | string;
  photoP05?: StepwiseIdentificationPhotoItem | string;
  historyInterview?: StepwiseHistoryInterview;
  damageZones?: DamageZoneData[];
  floors?: FloorSurveyData[];
  burlandSummary?: StepwiseBurlandSummary;
  settlementTilt?: StepwiseSettlementTilt;
  surveyScope?: Record<string, unknown>;
  accessLimitation?: StepwiseAccessLimitation;
  gisMutationConfirmed?: StepwiseGisMutationConfirmed;
  frontageWidth?: string | number;
  lotDepth?: string | number;
  landAreaM2?: string | number;
  landArea?: string | number;
  parcelId?: string;
  surveyStatus?: string;
  zoneId?: string;
  ecs?: StepwiseEcs;
  vi?: StepwiseVi;
  gateDecision?: string | { decision?: string; reason?: string };
  gateNotes?: string;
  reportId?: string;
  zone_id?: string;
  executiveSummary?: StepwiseExecutiveSummary;
  summaryConclusions?: string;
  keyRisksDefectsText?: string;
  surveyDate?: string;
  surveyorPhone?: string;
  signatures?: StepwiseSignatures;
  absenceLogs?: StepwiseAbsenceLogItem[];
  isRefusedOrAbsent?: boolean;
  status?: string;
  surveyorName?: string;
  ownerFeedback?: string;
  ownerRemarks?: string;
  workingMinutesPhotos?: (string | { url?: string; photoUrl?: string; photoCode?: string })[];
  ownerInterview?: { phone?: string; [key: string]: unknown };
  witnessInfo?: { name?: string; role?: string; phone?: string; signature?: string; [key: string]: unknown };
  witnessName?: string;
  witnessRole?: string;
  witnessPhone?: string;
  witnessSignature?: string | null;
  [key: string]: unknown;
}

export interface AuditStepBaseProps {
  isEditMode: boolean;
  formState: AuditStepwiseFormState;
  data?: AuditStepwiseData;
  reportId?: string;
  handleFieldChange: (key: string, label: string, val: unknown) => void;
  handleNestedFieldChange?: (parentKey: string, childKey: string, label: string, val: unknown) => void;
  onOpenPhotoZoom: (url: string, title?: string, photoCode?: string) => void;
  onOpenPhotoReplace: (params: PhotoReplaceParams) => void;
  onRefresh?: () => void;
}

export interface AuditStep3FloorDefectsProps extends AuditStepBaseProps {
  // specific overrides if any
}

export interface DiffItem {
  field: string;
  label: string;
  oldValue: unknown;
  newValue: unknown;
}

export interface StepwiseBuildingSpecs {
  ownerName?: string;
  ownerPhone?: string;
  buildingGrade?: string;
  building_grade?: string;
  landUseFunction?: string;
  land_use_function?: string;
  floorCount?: number;
  floor_count?: number;
  basementCount?: number;
  basement_count?: number;
  yearOfConstruction?: string;
  year_of_construction?: string;
  isYearEstimated?: boolean;
  is_year_estimated?: boolean;
  constructionAreaM2?: string | number;
  construction_area_m2?: string | number;
  buildingHeightM?: string | number;
  building_height_m?: string | number;
  adjacentBuildings?: unknown;
  adjacent_buildings?: unknown;
  structuralSystem?: string;
  structural_system?: string;
  foundationCategory?: string;
  foundation_category?: string;
  foundationDepthM?: string | number;
  foundation_depth_m?: string | number;
  foundationDensity?: string | number;
  foundation_density?: string | number;
  foundationSpacingM?: string | number;
  foundation_spacing_m?: string | number;
  foundationNotes?: string;
  foundation_notes?: string;
  frontageWidth?: string | number;
  lotDepth?: string | number;
  landAreaM2?: string | number;
  buildingType?: string;
  [key: string]: unknown;
}

export interface StepwiseDeformation {
  diff_settlement_level?: number;
  diff_settlement_position?: string;
  diff_settlement_photo_url?: string;
  diff_settlement_photo_code?: string;
  diff_settlement_photos_json?: Array<{ url: string; photoCode?: string; notes?: string }>;
  diff_settlement_notes?: string;
  building_tilt_level?: number;
  tilt_x_permille?: number;
  tilt_y_permille?: number;
  tilt_direction?: string;
  tilt_photo_url?: string;
  tilt_photo_code?: string;
  tilt_photos_json?: Array<{ url: string; photoCode?: string; notes?: string }>;
  tilt_notes?: string;
  beam_sagging_level?: number;
  beam_sagging_mm?: string | number;
  beam_sagging_position?: string;
  beam_sagging_description?: string;
  abnormal_photo_url?: string;
  abnormal_photo_code?: string;
  abnormal_photos_json?: Array<{ url: string; photoCode?: string; notes?: string }>;
  abnormal_notes?: string;
  need_additional_monitoring?: boolean;
  monitoring_notes?: string;
  [key: string]: unknown;
}

export interface StepwiseSurveyJson {
  metroOffsetDistance?: string | number;
  clearanceOffsetDistance?: string | number;
  gpsCoords?: { latitude?: number; lat?: number; longitude?: number; lng?: number; accuracy?: number };
  projectParcelCode?: string;
  houseNumber?: string;
  street?: string;
  ward?: string;
  district?: string;
  buildingName?: string;
  ownerName?: string;
  ownerPhone?: string;
  officialCadastralCode?: string;
  buildingType?: string;
  objectGroup?: string;
  usageFunction?: string;
  aboveFloors?: number;
  undergroundFloors?: number;
  constructionYear?: string;
  isEstimatedYear?: boolean;
  constructionAreaM2?: string | number;
  buildingHeightM?: string | number;
  adjacentBuildings?: unknown;
  surveyCaseType?: string;
  vacantLandNotes?: string;
  constructionStageNotes?: string;
  unitCode?: string;
  unitFloorNumber?: string;
  managementContactName?: string;
  managementContactPhone?: string;
  manualMetroDistanceM?: string | number;
  chainage?: string;
  structureSystem?: string;
  foundationType?: string;
  foundationCatScore?: number | null;
  foundationDepthM?: string | number;
  foundationDensity?: string | number;
  foundationSpacingM?: string | number;
  pileDimensionMm?: string;
  pileWidthMm?: string | number;
  pileLengthMm?: string | number;
  foundationNotes?: string;
  asBuiltDrawingPhotos?: Array<{ url: string; photoCode?: string; notes?: string }>;
  asBuiltDrawingPhotoUrl?: string;
  identificationPhotos?: StepwiseIdentificationPhotos;
  photoP01?: StepwiseIdentificationPhotoItem | string;
  photoP02?: StepwiseIdentificationPhotoItem | string;
  photoP03?: StepwiseIdentificationPhotoItem | string;
  photoP04?: StepwiseIdentificationPhotoItem | string;
  photoP05?: StepwiseIdentificationPhotoItem | string;
  facadeBoundaryGeojson?: unknown;
  historyInterview?: StepwiseHistoryInterview;
  damageZones?: DamageZoneData[];
  floors?: FloorSurveyData[];
  burlandSummary?: StepwiseBurlandSummary;
  settlementTilt?: StepwiseSettlementTilt;
  surveyScope?: Record<string, unknown>;
  accessLimitation?: StepwiseAccessLimitation;
  gisMutationConfirmed?: StepwiseGisMutationConfirmed;
  frontageWidth?: string | number;
  lotDepth?: string | number;
  landAreaM2?: string | number;
  ecs?: StepwiseEcs;
  vi?: StepwiseVi;
  gateDecision?: { decision: string; reason: string };
  executiveSummary?: StepwiseExecutiveSummary;
  summaryConclusions?: string;
  surveyDate?: string;
  surveyorPhone?: string;
  witnessName?: string;
  witnessRole?: string;
  witnessPhone?: string;
  witnessSignature?: string | null;
  signatures?: StepwiseSignatures;
  [key: string]: unknown;
}

export interface AuditStepwiseData {
  id?: string;
  parcelId?: string;
  projectParcelCode?: string;
  officialCadastralCode?: string;
  houseNumber?: string;
  street?: string;
  ward?: string;
  district?: string;
  buildingName?: string;
  buildingType?: string;
  constructionAreaM2?: string | number;
  braStatus?: string;
  engineeringRecommendations?: string;
  summaryConclusions?: string;
  surveyDate?: string;
  surveyorPhone?: string;
  surveyorName?: string;
  surveyorSignatureUrl?: string;
  ownerName?: string;
  ownerPhone?: string;
  ownerSignatureUrl?: string;
  ownerRemarks?: string;
  isRefusedOrAbsent?: boolean;
  surveyStatus?: string;
  activeParcel?: unknown;
  unitCode?: string;
  unitFloorNumber?: string;
  chainage?: string;
  frontageWidth?: string | number;
  lotDepth?: string | number;
  landAreaM2?: string | number;
  metroOffsetDistance?: string | number;
  clearanceOffsetDistance?: string | number;
  manualMetroDistanceM?: string | number;
  cadastralGeojson?: unknown;
  cadastral_geojson?: unknown;
  coordinates?: [number, number] | [number, number][] | unknown;
  parcelCoordinates?: [number, number][];
  surveyJson?: StepwiseSurveyJson;
  survey_data_json?: StepwiseSurveyJson;
  buildingSpecs?: StepwiseBuildingSpecs;
  deformation?: StepwiseDeformation;
  historyInterview?: StepwiseHistoryInterview;
  zoneId?: string;
  zone_id?: string;
  reportId?: string;
  status?: string;
  reportCode?: string;
  absenceLogs?: StepwiseAbsenceLogItem[];
  auditHistory?: AuditHistoryLogItem[];
  auditFlags?: unknown[];
  leftPane?: {
    buildingSpecs?: StepwiseBuildingSpecs;
    deformation?: StepwiseDeformation;
    interview?: StepwiseHistoryInterview;
    signatures?: StepwiseSignatures;
    damageZones?: unknown[];
    absenceLogs?: StepwiseAbsenceLogItem[];
    surveyJson?: StepwiseSurveyJson;
    riskScoreCard?: RiskCardData;
    [key: string]: unknown;
  };
  rightPane?: {
    identificationPhotos?: StepwiseIdentificationPhotos;
    facadeBoundaryGeojson?: unknown;
    [key: string]: unknown;
  };
  [key: string]: unknown;
}
