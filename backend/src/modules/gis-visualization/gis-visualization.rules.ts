/**
 * ============================================================================
 * GIS VISUALIZATION RULES (PURE) — chuẩn hóa chỉ số chuyên đề của 1 thửa
 * Thứ tự ưu tiên bám đúng báo cáo PDF:
 *  - Năm XD / Số tầng / Tầng hầm: như Mục II (section-1-2-overview-spatial.mapper.ts) — JSON trước, SQL sau.
 *  - ECS / VI / Tác động I / BRA (V×I) / Burland: như Mục VIII qua risk-resolvers.ts (dùng chung với PDF).
 * Cấm đọc các cột SQL có DEFAULT giả: building_specifications.foundation_category (CAT_2),
 * .structural_system (KHUNG_BTCT), .floor_count / parcels.floor_count (1), .basement_count (0),
 * risk_score_cards.building_risk_assessment_bra ('LOW_RISK'). Các trường này chỉ lấy từ JSON đã khảo sát.
 * ============================================================================
 */

import {
  isRecord,
  normalizeEcsClass,
  normalizeViClassToVCode,
  resolveBraLevelCode,
  resolveBurlandLocalMaxGrade,
  resolveEcsClassRaw,
  resolveImpact,
  resolveObjectGroup,
  resolveTotalEcs,
  resolveViClassRaw,
  resolveViScores,
  VCODE_TO_VI_CLASS,
} from '../report/mappers/sections/risk-resolvers';
import { classifyStructureSystem } from '../scoring/structure-system.classifier';
import { v4FromAge } from '../scoring/vi-calculator';
import type {
  FloorTierBucket,
  FoundationBucket,
  GisThematicReportStatus,
  ParcelThematicMetrics,
  YearCohortBucket,
} from './types';

/** 1 dòng từ repository: thửa + hồ sơ được chọn (có thể null) + bảng phụ dạng JSON. */
export interface ThematicSourceRow {
  parcel_id: string;
  building_type: string | null;
  distance_to_centerline_m: number | string | null;
  report_id: string | null;
  report_status: string | null;
  report_type: string | null;
  survey_data_json: unknown;
  specs: unknown;
  card: unknown;
}

const THEMATIC_STATUSES: readonly GisThematicReportStatus[] = ['APPROVED', 'UNDER_REVIEW', 'SUBMITTED'];
const isThematicStatus = (v: unknown): v is GisThematicReportStatus =>
  typeof v === 'string' && (THEMATIC_STATUSES as readonly string[]).includes(v);

const blank = (v: unknown): boolean => v === undefined || v === null || v === '';
const firstPresent = (...vals: unknown[]): unknown => vals.find((v) => !blank(v));
const toFiniteNumber = (v: unknown): number | null => {
  if (blank(v)) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};
const toText = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v.trim() : null);

/** Năm hiện tại theo giờ Việt Nam (máy chủ prod chạy UTC). */
export function currentYearVn(now: Date = new Date()): number {
  return new Date(now.getTime() + 7 * 3600 * 1000).getUTCFullYear();
}

export function yearCohortFromAge(age: number): YearCohortBucket {
  const v4 = v4FromAge(age);
  if (v4 === 1) return 'AGE_LT_10';
  if (v4 === 2) return 'AGE_10_25';
  if (v4 === 3) return 'AGE_26_40';
  return 'AGE_GT_40';
}

/** Năm XD như Mục II: JSON constructionYear → building_specifications.year_of_construction. Thiếu/không hợp lệ ⇒ null (không mặc định 1999). */
export function resolveConstructionYear(
  json: Record<string, unknown>,
  specs: Record<string, unknown>,
  nowYear: number
): { year: number | null; isEstimated: boolean; age: number | null; cohort: YearCohortBucket | null } {
  const raw = toFiniteNumber(firstPresent(json.constructionYear, specs.constructionYear, specs.year_of_construction));
  const isEstimated = Boolean(json.isEstimatedYear ?? specs.isEstimatedYear ?? specs.is_year_estimated);
  if (raw === null || !Number.isInteger(raw) || raw <= 1800 || raw > nowYear) {
    return { year: null, isEstimated, age: null, cohort: null };
  }
  const age = nowYear - raw;
  return { year: raw, isEstimated, age, cohort: yearCohortFromAge(age) };
}

/**
 * Phân nhóm loại móng từ chuỗi đã khảo sát.
 * Nhà dân: 5 lựa chọn có tiền tố (Shallow/Wood/PC/CIP/Unknown — surveyOptionsConstants.ts).
 * Chung cư: 6 lựa chọn mô tả (condo-master.types.ts). Dữ liệu cũ: mã enum CAT_n_*.
 */
export function classifyFoundation(raw: unknown): FoundationBucket | null {
  const text = toText(raw);
  if (!text) return null;
  const s = text.toLowerCase();
  if (s.startsWith('shallow')) return 'SHALLOW';
  if (s.startsWith('wood')) return 'WOOD';
  if (/^pc\b/.test(s)) return 'PRECAST_PILE';
  if (/^cip\b/.test(s)) return 'BORED_PILE';
  if (s.startsWith('unknown')) return 'UNKNOWN';
  if (s.startsWith('cat_1') || s.startsWith('cat_2') || s.startsWith('cat_3')) return 'SHALLOW';
  if (s.startsWith('cat_4')) return 'PRECAST_PILE';
  if (s.startsWith('cat_5')) return 'UNKNOWN';
  if (s.includes('khoan nhồi') || s.includes('barrette') || s.includes('bored')) return 'BORED_PILE';
  if (s.includes('cọc ép') || s.includes('ly tâm')) return 'PRECAST_PILE';
  if (s.includes('móng bè') || s.includes('raft')) return 'RAFT';
  if (s.includes('cừ tràm')) return 'WOOD';
  if (s.includes('móng nông') || s.includes('móng băng') || s.includes('móng đơn')) return 'SHALLOW';
  if (s.includes('không rõ')) return 'UNKNOWN';
  return 'OTHER';
}

/** CAT móng 1–5 như Mục VIII: JSON foundationCatScore → building_specifications.foundation_cat_score. */
export function resolveFoundationCat(json: Record<string, unknown>, specs: Record<string, unknown>): number | null {
  const n = toFiniteNumber(firstPresent(json.foundationCatScore, specs.foundationCatScore, specs.foundation_cat_score));
  return n !== null && Number.isInteger(n) && n >= 1 && n <= 5 ? n : null;
}

export function floorTier(above: number): FloorTierBucket | null {
  if (!Number.isInteger(above) || above < 1) return null;
  if (above === 1) return 'F1';
  if (above <= 3) return 'F2_3';
  if (above <= 5) return 'F4_5';
  if (above <= 9) return 'F6_9';
  return 'F10_PLUS';
}

/** Số tầng nổi / hầm đã khảo sát (JSON). Không dùng floor_count / basement_count SQL (DEFAULT 1 / 0). Tầng nổi 0 hoặc thiếu ⇒ không xếp nhóm. */
export function resolveFloors(
  json: Record<string, unknown>
): { above: number | null; basement: number | null; tier: FloorTierBucket | null } {
  const above = toFiniteNumber(json.aboveFloors);
  const basement = toFiniteNumber(json.undergroundFloors);
  return { above, basement, tier: above === null ? null : floorTier(above) };
}

export function isVacantLandReport(json: Record<string, unknown>): boolean {
  return Boolean(json.isVacantLand || json.surveyCaseType === 'VACANT_LAND');
}

const emptyMetrics = (parcelId: string, isCondoMaster: boolean): ParcelThematicMetrics => ({
  parcelId,
  reportStatus: null,
  isCondoMaster,
  isVacantLand: false,
  constructionYear: null,
  isYearEstimated: false,
  buildingAge: null,
  yearCohort: null,
  foundationType: null,
  foundationBucket: null,
  foundationCatScore: null,
  structureSystem: null,
  structureClass: null,
  ecsClass: null,
  totalEcs: null,
  burlandMaxGrade: null,
  viClass: null,
  avgViScore: null,
  braLevel: null,
  impactCode: null,
  aboveFloors: null,
  basementFloors: null,
  floorTier: null,
});

export function buildParcelMetrics(row: ThematicSourceRow, nowYear: number): ParcelThematicMetrics {
  const bt = String(row.building_type || '').toUpperCase();
  const isCondo = bt === 'CONDOMINIUM' || bt === 'CONDO' || row.report_type === 'BUILDING_MASTER';
  const base = emptyMetrics(row.parcel_id, isCondo);
  if (!row.report_id || !isThematicStatus(row.report_status)) return base;

  const json = isRecord(row.survey_data_json) ? row.survey_data_json : {};
  const specsRow = isRecord(row.specs) ? row.specs : {};
  const card = isRecord(row.card) ? row.card : null;
  // Mục VIII dùng buildingSpecs nếu có, nếu không thì chính JSON
  const s8Specs = isRecord(row.specs) ? row.specs : json;
  const vacant = isVacantLandReport(json);

  const year = resolveConstructionYear(json, specsRow, nowYear);
  const foundationType = toText(json.foundationType);
  const structureSystem = toText(json.structureSystem);
  const floors = resolveFloors(json);

  const ecsData = isRecord(json.ecs) ? json.ecs : {};
  const viData = isRecord(json.vi) ? json.vi : {};
  const vCode = normalizeViClassToVCode(resolveViClassRaw(viData, card));
  const impact = resolveImpact(json, s8Specs, card, row.distance_to_centerline_m, resolveObjectGroup(json, s8Specs));
  const burland = resolveBurlandLocalMaxGrade(json);

  return {
    ...base,
    reportStatus: row.report_status,
    isVacantLand: vacant,
    constructionYear: vacant ? null : year.year,
    isYearEstimated: vacant ? false : year.isEstimated,
    buildingAge: vacant ? null : year.age,
    yearCohort: vacant ? null : year.cohort,
    foundationType: vacant ? null : foundationType,
    foundationBucket: vacant ? null : classifyFoundation(foundationType),
    foundationCatScore: vacant ? null : resolveFoundationCat(json, specsRow),
    structureSystem: vacant ? null : structureSystem,
    structureClass: vacant || !structureSystem ? null : classifyStructureSystem(structureSystem),
    ecsClass: normalizeEcsClass(resolveEcsClassRaw(ecsData, card)),
    totalEcs: resolveTotalEcs(ecsData, card),
    burlandMaxGrade: burland !== null && Number.isInteger(burland) && burland >= 0 && burland <= 5 ? burland : null,
    viClass: vCode ? VCODE_TO_VI_CLASS[vCode] : null,
    avgViScore: resolveViScores(viData, card).viAvg,
    braLevel: resolveBraLevelCode(json, card, vCode, impact.code),
    impactCode: impact.code === '--' ? null : impact.code,
    aboveFloors: vacant ? null : floors.above,
    basementFloors: vacant ? null : floors.basement,
    floorTier: vacant ? null : floors.tier,
  };
}
