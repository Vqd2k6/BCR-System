import type { BraLevelCode, EcsClassCode } from '../report/mappers/sections/risk-resolvers';
import type { StructureClass } from '../scoring/structure-system.classifier';

export type GisThematicReportStatus = 'APPROVED' | 'UNDER_REVIEW' | 'SUBMITTED';

/** Nhóm tuổi theo đúng V4 của vi-calculator.ts (v4FromAge): <10 · 10–25 · 26–40 · >40. */
export type YearCohortBucket = 'AGE_LT_10' | 'AGE_10_25' | 'AGE_26_40' | 'AGE_GT_40';
export type FoundationBucket = 'SHALLOW' | 'WOOD' | 'PRECAST_PILE' | 'BORED_PILE' | 'RAFT' | 'OTHER' | 'UNKNOWN';
export type FloorTierBucket = 'F1' | 'F2_3' | 'F4_5' | 'F6_9' | 'F10_PLUS';

/** Chỉ số chuyên đề của 1 thửa. null = chưa đánh giá / không có dữ liệu (không gán mặc định). */
export interface ParcelThematicMetrics {
  parcelId: string;
  /** null khi thửa chưa có hồ sơ APPROVED / UNDER_REVIEW / SUBMITTED. */
  reportStatus: GisThematicReportStatus | null;
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

  viClass: BraLevelCode | null;
  avgViScore: number | null;

  braLevel: BraLevelCode | null;
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
