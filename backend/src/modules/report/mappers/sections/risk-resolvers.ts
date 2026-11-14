/**
 * ============================================================================
 * RISK RESOLVERS — NGUỒN DUY NHẤT CHO CẤP ECS / VI / TÁC ĐỘNG I / BRA (V×I) MỤC VIII
 * Hàm thuần, tách nguyên văn từ Section8RiskAssessmentMapper để báo cáo PDF và bản đồ GIS
 * chuyên đề (modules/gis-visualization) đọc cùng một thứ tự ưu tiên. Sửa ở đây là sửa cả hai.
 * Không có giá trị mặc định cho số liệu pháp lý: thiếu dữ liệu ⇒ null, nơi gọi tự quyết định hiển thị.
 * ============================================================================
 */

import { BRA_MATRIX_LOOKUP } from './bra-matrix.mapper';
import type { BraCellLookup } from './bra-matrix.mapper';

export type EcsClassCode = 'GOOD' | 'MEDIUM' | 'DEFICIENT' | 'CRITICAL';
export type VulnerabilityCode = 'V1' | 'V2' | 'V3' | 'V4';
export type ImpactLevelCode = 'I1' | 'I2' | 'I3' | 'I4';
export type BraLevelCode = 'LOW' | 'MEDIUM' | 'HIGH' | 'VERY_HIGH';

type Rec = Record<string, unknown>;

export const isRecord = (v: unknown): v is Rec => typeof v === 'object' && v !== null && !Array.isArray(v);
const asRec = (v: unknown): Rec => (isRecord(v) ? v : {});

export function pickNum(...candidates: unknown[]): number | null {
  for (const c of candidates) {
    if (c === undefined || c === null || c === '') continue;
    const n = Number(c);
    if (Number.isFinite(n)) return n;
  }
  return null;
}

export function pickMeters(...candidates: unknown[]): number | null {
  for (const c of candidates) {
    if (c === undefined || c === null || c === '') continue;
    if (typeof c === 'number' && Number.isFinite(c) && c >= 0) return c;
    const str = String(c).trim();
    if (!str) continue;
    const direct = Number(str);
    if (Number.isFinite(direct) && direct >= 0) return direct;
    const m = str.match(/-?\d+(?:[.,]\d+)?/);
    if (m) {
      const parsed = Number(m[0].replace(',', '.'));
      if (Number.isFinite(parsed) && parsed >= 0) return parsed;
    }
  }
  return null;
}

const judgementApplied = (rScores: unknown): boolean => Boolean(asRec(rScores).is_engineering_judgement_applied);

// ─── ECS ────────────────────────────────────────────────────────────────────

/** Tổng ECS: điểm điều chỉnh (khi áp dụng Engineering Judgement) → JSON đã chốt → thẻ điểm. */
export function resolveTotalEcs(ecsData: unknown, rScores: unknown): number | null {
  const ecs = asRec(ecsData);
  const card = asRec(rScores);
  if (judgementApplied(card) && pickNum(card.overridden_total_ecs) !== null) return Number(card.overridden_total_ecs);
  return pickNum(ecs.totalEcs, card.total_ecs_score);
}

/** Chuỗi cấp ECS đã đóng băng (chưa chuẩn hóa). */
export function resolveEcsClassRaw(ecsData: unknown, rScores: unknown): string {
  const ecs = asRec(ecsData);
  const card = asRec(rScores);
  const raw = judgementApplied(card) && card.overridden_ecs_class ? card.overridden_ecs_class : (ecs.ecsClass || card.ecs_class || '');
  return String(raw).trim().toUpperCase();
}

export function normalizeEcsClass(raw: string): EcsClassCode | null {
  if (raw === 'CRITICAL' || raw === 'NGUY HIỂM' || raw === 'VERY_HIGH') return 'CRITICAL';
  if (raw === 'DEFICIENT' || raw === 'KÉM' || raw === 'HIGH') return 'DEFICIENT';
  if (raw === 'MEDIUM' || raw === 'MODERATE' || raw === 'TRUNG BÌNH') return 'MEDIUM';
  if (raw === 'GOOD' || raw === 'VERY_LOW' || raw === 'LOW' || raw === 'TỐT') return 'GOOD';
  return null;
}

// ─── VI ─────────────────────────────────────────────────────────────────────

export interface ViScores {
  v1: number | null;
  v2: number | null;
  v3: number | null;
  v4: number | null;
  v5: number | null;
  v6: number | null;
  totalVi: number | null;
  /** Điểm TB VI thang 1–4, làm tròn 2 chữ số; null khi chưa có. */
  viAvg: number | null;
}

export function resolveViScores(viData: unknown, rScores: unknown): ViScores {
  const vi = asRec(viData);
  const card = asRec(rScores);
  const v1 = pickNum(vi.v1, card.v1_importance_score);
  const v2 = pickNum(vi.v2, card.v2_structure_score);
  const v3 = pickNum(vi.v3, card.v3_foundation_score);
  const v4 = pickNum(vi.v4, card.v4_age_score);
  const v5 = pickNum(vi.v5, card.v5_ecs_score, card.v5_condition_score);
  const v6 = pickNum(vi.v6, card.v6_sensitivity_score, card.v6_environment_score);

  const all = [v1, v2, v3, v4, v5, v6];
  const computedViSum = all.every((v): v is number => v !== null)
    ? all.reduce<number>((s, v) => s + Number(v), 0)
    : null;
  const totalVi = pickNum(vi.totalVi, vi.totalScore, vi.total, card.total_vi_score) ?? computedViSum;
  // Điểm TB VI thang 1–4: giá trị điều chỉnh ngoài khoảng (dữ liệu cũ lưu nhầm tổng ΣV) thì bỏ qua, dùng điểm TB đã lưu
  const overriddenAvgVi = judgementApplied(card) ? pickNum(card.overridden_avg_vi) : null;
  const validOverriddenAvgVi = overriddenAvgVi !== null && overriddenAvgVi >= 1 && overriddenAvgVi <= 4 ? overriddenAvgVi : null;
  if (overriddenAvgVi !== null && validOverriddenAvgVi === null) {
    console.error('[RiskResolvers:viAvg] overridden_avg_vi ngoài thang 1–4, bỏ qua:', overriddenAvgVi);
  }
  const rawSavedViAvg = validOverriddenAvgVi !== null
    ? validOverriddenAvgVi
    : (pickNum(vi.viAvg, vi.avgVi, card.avg_vi_score) ?? (totalVi !== null ? totalVi / 6 : null));
  const viAvg = rawSavedViAvg !== null ? parseFloat(rawSavedViAvg.toFixed(2)) : null;
  return { v1, v2, v3, v4, v5, v6, totalVi, viAvg };
}

export function resolveViClassRaw(viData: unknown, rScores: unknown): string {
  const vi = asRec(viData);
  const card = asRec(rScores);
  const raw = judgementApplied(card) && card.overridden_vi_class ? card.overridden_vi_class : (vi.viClass || card.vi_class || '');
  return String(raw).trim().toUpperCase();
}

export function normalizeViClassToVCode(raw: string): VulnerabilityCode | null {
  if (raw === 'VERY_HIGH' || raw === 'VERY HIGH' || raw === 'RẤT CAO' || raw === 'V4') return 'V4';
  if (raw === 'HIGH' || raw === 'CAO' || raw === 'V3') return 'V3';
  if (raw === 'MEDIUM' || raw === 'MODERATE' || raw === 'TRUNG BÌNH' || raw === 'V2') return 'V2';
  if (raw === 'LOW' || raw === 'VERY_LOW' || raw === 'THẤP' || raw === 'V1') return 'V1';
  return null;
}

export const VCODE_TO_VI_CLASS: Record<VulnerabilityCode, BraLevelCode> = { V1: 'LOW', V2: 'MEDIUM', V3: 'HIGH', V4: 'VERY_HIGH' };

// ─── TÁC ĐỘNG THI CÔNG I ────────────────────────────────────────────────────

/** Nhóm công trình như Mục VIII dùng cho V1 và ngưỡng cự ly I. */
export function resolveObjectGroup(json: unknown, specs: unknown): string {
  return String(asRec(json).objectGroup || asRec(specs).building_grade || 'GENERAL').toUpperCase();
}

export interface ImpactResolution {
  code: ImpactLevelCode | '--';
  /** Cự ly đã dùng (m) hoặc '--'. */
  metroOffset: number | string;
  hasStationEdge: boolean;
}

const IMPACT_CODES: readonly string[] = ['I1', 'I2', 'I3', 'I4'];
const isImpactCode = (v: string): v is ImpactLevelCode => IMPACT_CODES.includes(v);

export function resolveImpact(
  json: unknown,
  specs: unknown,
  rScores: unknown,
  distanceToCenterlineM: unknown,
  objGroup: string
): ImpactResolution {
  const j = asRec(json);
  const s = asRec(specs);
  const card = asRec(rScores);
  const frozenImpact = asRec(j.impactAssessment);
  const edgeDist = pickMeters(j.stationEdgeDistance, j.clearanceOffsetDistance, j.distanceToTunnelEdgeM, s.clearanceOffsetDistance);
  const centerDist = pickMeters(j.manualMetroDistanceM, j.distanceToMetroM, j.metroOffsetDistance, s.metroOffsetDistance, distanceToCenterlineM);
  const hasStationEdge = frozenImpact.distanceType ? frozenImpact.distanceType === 'STATION_EDGE' : edgeDist !== null;
  const metroOffset: number | string = pickMeters(frozenImpact.distanceM) ?? (hasStationEdge && edgeDist !== null ? edgeDist : (centerDist !== null ? centerDist : '--'));

  const isHighImportanceGroup =
    objGroup.includes('IMPORTANT') ||
    objGroup.includes('CRITICAL') ||
    objGroup.includes('SPECIAL') ||
    objGroup.includes('HERITAGE') ||
    objGroup.includes('GRADE_1') ||
    objGroup.includes('GRADE_2') ||
    objGroup.includes('QUAN TRỌNG') ||
    objGroup.includes('ĐẶC BIỆT');

  const derivedImpactCode: ImpactLevelCode | '' =
    typeof metroOffset === 'number' && Number.isFinite(metroOffset)
      ? isHighImportanceGroup
        ? (metroOffset > 30 ? 'I1' : metroOffset > 20 ? 'I2' : metroOffset > 10 ? 'I3' : 'I4')
        : (metroOffset > 20 ? 'I1' : metroOffset > 10 ? 'I2' : metroOffset > 5 ? 'I3' : 'I4')
      : '';

  const execImpactStr = String(asRec(j.executiveSummary).constructionImpactStatus || '').toUpperCase();
  const execImpactMatch = execImpactStr.match(/\b(I[1-4])\b/);
  const cardOverriddenImpact = (judgementApplied(card) && card.overridden_impact_level_i)
    ? `I${String(card.overridden_impact_level_i).replace(/^I/i, '')}`
    : null;
  const rawImpactCode = String(
    frozenImpact.iCode || frozenImpact.code || execImpactMatch?.[1] || cardOverriddenImpact || card.impact_grade ||
    (card.impact_level_i ? `I${String(card.impact_level_i || '').replace(/^I/i, '')}` : '') ||
    derivedImpactCode
  ).toUpperCase();
  const fallbackImpactStr = String(frozenImpact.iCode || frozenImpact.code || execImpactMatch?.[1] || cardOverriddenImpact || card.impact_grade || derivedImpactCode || '').toUpperCase();
  const code: ImpactLevelCode | '--' = isImpactCode(rawImpactCode)
    ? rawImpactCode
    : (isImpactCode(fallbackImpactStr) ? fallbackImpactStr : '--');

  return { code, metroOffset, hasStationEdge };
}

// ─── BRA (V×I) ──────────────────────────────────────────────────────────────

/** Cấp BRA đã chốt tường minh: JSON thẩm định → tóm tắt → điều chỉnh kỹ sư → thẻ điểm. Không đọc building_risk_assessment_bra. */
export function resolveExplicitBraRaw(json: unknown, rScores: unknown): string {
  const j = asRec(json);
  const card = asRec(rScores);
  const frozenBra = asRec(j.braAssessment);
  return String(
    frozenBra.braStatus ||
    frozenBra.finalRiskLevelVi ||
    frozenBra.riskLevelVi ||
    asRec(j.executiveSummary).braStatus ||
    (judgementApplied(card) ? card.overridden_bra : null) ||
    card.final_bra_grade ||
    card.preliminary_bra_classification ||
    card.baseline_risk_assessment ||
    ''
  ).toUpperCase();
}

export function normalizeBraLevel(raw: string): BraLevelCode | null {
  if (raw === 'NEGLIGIBLE' || raw === 'VERY_LOW' || raw === 'LOW' || raw.includes('KHÔNG ĐÁNG KỂ') || raw.includes('THẤP')) return 'LOW';
  if (raw === 'MEDIUM' || raw === 'MODERATE' || raw.includes('TRUNG BÌNH')) return 'MEDIUM';
  if (raw === 'HIGH' || (raw.includes('CAO') && !raw.includes('RẤT CAO'))) return 'HIGH';
  if (raw === 'VERY_HIGH' || raw === 'CRITICAL' || raw.includes('RẤT CAO')) return 'VERY_HIGH';
  return null;
}

export const BRA_LEVEL_TEXT: Record<BraLevelCode, { vi: string; en: string }> = {
  LOW: { vi: 'Rủi ro thấp', en: 'Low Risk' },
  MEDIUM: { vi: 'Rủi ro trung bình', en: 'Medium Risk' },
  HIGH: { vi: 'Rủi ro cao', en: 'High Risk' },
  VERY_HIGH: { vi: 'Rủi ro rất cao', en: 'Very High Risk' },
};

const LOOKUP_LEVEL_TO_CODE: Record<BraCellLookup['riskLevel'], BraLevelCode> = {
  Low: 'LOW',
  Medium: 'MEDIUM',
  High: 'HIGH',
  'Very High': 'VERY_HIGH',
};

export function lookupBraCell(vCode: VulnerabilityCode | null, iCode: ImpactLevelCode | '--'): BraCellLookup | null {
  return vCode !== null && iCode !== '--' ? BRA_MATRIX_LOOKUP[vCode][iCode] : null;
}

/** Cấp BRA cuối cùng như PDF Mục VIII: cấp đã chốt tường minh, nếu không có thì tra ma trận V×I. */
export function resolveBraLevelCode(
  json: unknown,
  rScores: unknown,
  vCode: VulnerabilityCode | null,
  iCode: ImpactLevelCode | '--'
): BraLevelCode | null {
  const explicit = normalizeBraLevel(resolveExplicitBraRaw(json, rScores));
  if (explicit) return explicit;
  const cell = lookupBraCell(vCode, iCode);
  return cell ? LOOKUP_LEVEL_TO_CODE[cell.riskLevel] : null;
}

// ─── BURLAND ────────────────────────────────────────────────────────────────

/**
 * Cấp Burland cục bộ lớn nhất (0–5) như report-viewmodel truyền vào Mục VIII: chỉ từ burlandSummary.localMaxGrade.
 * Không dùng e1_burland_score (thang điểm E1 0–4, Cấp 0 và Cấp 1 đều ra 0).
 */
export function resolveBurlandLocalMaxGrade(json: unknown): number | null {
  const raw = asRec(asRec(json).burlandSummary).localMaxGrade;
  if (raw === undefined || raw === null || isNaN(Number(raw))) return null;
  return Number(raw);
}
