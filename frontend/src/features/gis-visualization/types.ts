/** Hợp đồng GET /gis-visualization/thematic — khớp backend/src/modules/gis-visualization/types.ts. */

export type GisThematicLayoutId =
  | 'WORKFLOW'
  | 'CONSTRUCTION_YEAR'
  | 'FOUNDATION_STRUCTURE'
  | 'STRUCTURAL_CONDITION'
  | 'BURLAND_GRADE'
  | 'VI_INDEX'
  | 'BRA_RISK'
  | 'FLOOR_COUNT';

export type ThematicSubModeId =
  | 'FOUNDATION_TYPE'
  | 'STRUCTURE_SYSTEM'
  | 'FOUNDATION_CAT'
  | 'FLOOR_TIER'
  | 'BASEMENT';

export type RiskLevelCode = 'LOW' | 'MEDIUM' | 'HIGH' | 'VERY_HIGH';
export type EcsClassCode = 'GOOD' | 'MEDIUM' | 'DEFICIENT' | 'CRITICAL';
export type YearCohortBucket = 'AGE_LT_10' | 'AGE_10_25' | 'AGE_26_40' | 'AGE_GT_40';
export type FoundationBucket = 'SHALLOW' | 'WOOD' | 'PRECAST_PILE' | 'BORED_PILE' | 'RAFT' | 'OTHER' | 'UNKNOWN';
export type StructureClass = 'RC' | 'MIXED' | 'MASONRY' | 'STEEL' | 'SUBSTANDARD' | 'OTHER' | 'UNKNOWN';
export type FloorTierBucket = 'F1' | 'F2_3' | 'F4_5' | 'F6_9' | 'F10_PLUS';
export type ThematicReportStatus = 'APPROVED' | 'UNDER_REVIEW' | 'SUBMITTED';

export interface ParcelThematicMetrics {
  parcelId: string;
  reportStatus: ThematicReportStatus | null;
  isCondoMaster: boolean;
  isVacantLand: boolean;
  constructionYear: number | null;
  isYearEstimated: boolean;
  buildingAge: number | null;
  yearCohort: YearCohortBucket | null;
  foundationType: string | null;
  foundationBucket: FoundationBucket | null;
  foundationCatScore: number | null;
  structureSystem: string | null;
  structureClass: StructureClass | null;
  ecsClass: EcsClassCode | null;
  totalEcs: number | null;
  burlandMaxGrade: number | null;
  viClass: RiskLevelCode | null;
  avgViScore: number | null;
  braLevel: RiskLevelCode | null;
  impactCode: 'I1' | 'I2' | 'I3' | 'I4' | null;
  aboveFloors: number | null;
  basementFloors: number | null;
  floorTier: FloorTierBucket | null;
}

export interface ZoneThematicPayload {
  zoneId: string;
  generatedAt: string;
  totalParcels: number;
  assessedParcels: number;
  parcels: ParcelThematicMetrics[];
}
