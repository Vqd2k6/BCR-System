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
  componentType: string;
  wallMaterial: string;
  functionalImpactRepairNeeded: boolean;
  burlandGrade: number;
  ctxPhotoUrl: string;
  notes: string;
  defects: DefectItem[];
}

export interface FloorSurveyData {
  id: string;
  floorName: string;
  overviewPhotos: { id: string; url: string; caption?: string }[];
  cadSketchPhotoUrl: string;
  cadZonePins: CadZonePin[];
  zones: DamageZoneData[];
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
  gpsCoords: { lat: number; lng: number };
  adjacentBuildings: AdjacentBuildingState;
  isAbsenteeSurvey?: boolean;
  absenteeReason?: string;

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
  photoP03: { url: string; notApplicable: boolean };
  photoP04: { url: string; notApplicable: boolean };

  // Step 2.1 Architecture
  usageFunction: string;
  aboveFloors: number;
  undergroundFloors: number;
  constructionYear: number | '';
  isEstimatedYear: boolean;
  structureSystem: string;
  foundationType: string;
  pileDimensionMm: number | '';
  asBuiltDrawingFiles: { id: string; name: string; url: string }[];
  foundationCatScore: number; // 1..5

  // Step 2.2 History
  historyInterview: HistoryInterviewState;

  // Step 3 Floors & Zones & Defects
  floors: FloorSurveyData[];

  // Step 4 Burland & Structural Summary (Moved right after Step 3)
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

  // Step 9 Signatures
  signatures: {
    ownerFeedback: string;
    preparedBy: { fullName: string; title: string; date: string; signatureDataUrl: string };
    checkedBy: { fullName: string; title: string; date: string; signatureDataUrl: string };
    ownerRepresentative: { fullName: string; role: string; date: string; signatureDataUrl: string };
  };
}
