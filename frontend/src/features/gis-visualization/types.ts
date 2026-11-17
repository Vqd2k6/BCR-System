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
  impactCode: ImpactCode | null;
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

// ─── Trình bày & bộ lọc chỉ định (frontend) ─────────────────────────────────

/** Kiểu thang màu theo lý thuyết bản đồ chuyên đề. */
export type ThematicScaleType = 'sequential' | 'risk_heatmap' | 'qualitative' | 'binary';

/** Nhóm layout trên bộ chọn. */
export type ThematicLayoutGroup = 'OPERATIONAL' | 'CHARACTERISTICS' | 'RISK';

export type ImpactCode = 'I1' | 'I2' | 'I3' | 'I4';
export type BasementFilterMode = 'ALL' | 'HAS_BASEMENT' | 'NO_BASEMENT';

/**
 * Bộ lọc chỉ định đa tiêu chí, độc lập với layout đang xem.
 * Trường null/undefined/mảng rỗng ⇒ không ràng buộc. Các tiêu chí ghép AND; trong 1 tập chọn là OR.
 */
export interface ThematicPrecisionFilter {
  yearMin?: number | null;
  yearMax?: number | null;
  excludeEstimatedYear?: boolean;
  aboveFloorsMin?: number | null;
  aboveFloorsMax?: number | null;
  basementMode?: BasementFilterMode;
  foundationBuckets?: FoundationBucket[];
  structureClasses?: StructureClass[];
  catMin?: number | null;
  catMax?: number | null;
  ecsMin?: number | null;
  ecsMax?: number | null;
  burlandMin?: number | null;
  burlandMax?: number | null;
  viMin?: number | null;
  viMax?: number | null;
  braLevels?: RiskLevelCode[];
  impactCodes?: ImpactCode[];
  reportStatuses?: ThematicReportStatus[];
}

/** DIM: làm mờ thửa không khớp; ISOLATE: ẩn hẳn thửa không khớp. */
export type ThematicFilterDisplayMode = 'DIM' | 'ISOLATE';
