/**
 * ============================================================================
 * SNAPSHOT SCORES & HASH UTILS (PURE 1:1 READ — ZERO CALCULATION)
 * Đọc 1:1 các chỉ số đã lưu từ Admin Override / survey_data_json / risk_score_cards
 * và tạo mã băm toàn vẹn pháp lý SHA-256.
 * ============================================================================
 */

import { createHash } from 'crypto';
import type {
  ReportSnapshotScores,
  EcsSnapshot,
  ViSnapshot,
  EcsClass,
  ViClass,
} from '../schemas/report-snapshot.schema';

export type JsonObject = Record<string, unknown>;

export interface RiskCardRow {
  e1_burland_score: number | null;
  e2_structure_score: number | null;
  e3_deformation_score: number | null;
  e4_material_score: number | null;
  e5_history_score: number | null;
  e6_overall_function_score: number | null;
  total_ecs_score: number | null;
  ecs_class?: string | null;
  v1_importance_score?: number | null;
  v2_structure_score?: number | null;
  v3_foundation_score?: number | null;
  v4_age_score?: number | null;
  v5_ecs_score?: number | null;
  v6_sensitivity_score?: number | null;
  avg_vi_score?: number | null;
  vi_class?: string | null;
  impact_grade?: string | null;
  baseline_risk_assessment?: string | null;
  is_engineering_judgement_applied?: boolean | null;
  overridden_burland_grade?: number | null;
  overridden_total_ecs: number | null;
  overridden_ecs_class: string | null;
  overridden_importance_score?: number | null;
  overridden_avg_vi: number | null;
  overridden_vi_class: string | null;
  overridden_bra?: string | null;
  engineering_judgement_action?: string | null;
  engineering_judgement_reason?: string | null;
  judgement_engineer_name?: string | null;
}

export function asObject(value: unknown): JsonObject {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? (value as JsonObject) : {};
}

export function asNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function normalizeEcsClass(value: string | null | undefined): EcsClass | null {
  const v = String(value || '').toUpperCase().trim();
  return v === 'GOOD' || v === 'MEDIUM' || v === 'DEFICIENT' || v === 'CRITICAL' ? v : null;
}

function normalizeViClass(value: string | null | undefined): ViClass | null {
  const v = String(value || '').toUpperCase().trim().replace(/\s+/g, '_');
  return v === 'LOW' || v === 'MEDIUM' || v === 'HIGH' || v === 'VERY_HIGH' ? v : null;
}

export function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map((v) => stableStringify(v)).join(',')}]`;
  const obj = value as JsonObject;
  return `{${Object.keys(obj)
    .sort()
    .map((k) => `${JSON.stringify(k)}:${stableStringify(obj[k])}`)
    .join(',')}}`;
}

export function sha256Hex(input: string | Buffer): string {
  return createHash('sha256').update(input).digest('hex');
}

export function resolveFrozenScores(
  surveyJsonRaw: unknown,
  card: RiskCardRow | null,
  burlandMaxGrade: number | null
): ReportSnapshotScores {
  const json = asObject(surveyJsonRaw);
  const ecsJson = asObject(json.ecs);
  const viJson = asObject(json.vi ?? json.vulnerabilityIndex);

  const eKeys = ['e1', 'e2', 'e3', 'e4', 'e5', 'e6'] as const;
  const cardE: Record<(typeof eKeys)[number], number | null> = card
    ? {
        e1: asNumber(card.e1_burland_score),
        e2: asNumber(card.e2_structure_score),
        e3: asNumber(card.e3_deformation_score),
        e4: asNumber(card.e4_material_score),
        e5: asNumber(card.e5_history_score),
        e6: asNumber(card.e6_overall_function_score),
      }
    : { e1: null, e2: null, e3: null, e4: null, e5: null, e6: null };

  const e = {} as Record<(typeof eKeys)[number], number | null>;
  for (const k of eKeys) {
    e[k] = asNumber(ecsJson[k]) ?? cardE[k];
  }
  if (card?.overridden_burland_grade !== null && card?.overridden_burland_grade !== undefined) {
    e.e1 = asNumber(card.overridden_burland_grade) ?? e.e1;
  }

  const hasEcsJson = eKeys.some((k) => asNumber(ecsJson[k]) !== null);
  const overrideTotal = asNumber(card?.overridden_total_ecs);
  const totalEcs =
    overrideTotal ??
    asNumber(ecsJson.totalEcs ?? ecsJson.totalScore ?? ecsJson.total) ??
    asNumber(card?.total_ecs_score);

  const ecsClass: EcsClass | null =
    normalizeEcsClass(card?.overridden_ecs_class) ??
    normalizeEcsClass((ecsJson.ecsClass ?? ecsJson.classification) as string | undefined) ??
    normalizeEcsClass(card?.ecs_class);

  const ecs: EcsSnapshot = {
    ...e,
    total: totalEcs,
    ecsClass,
    source:
      overrideTotal !== null
        ? 'ADMIN_OVERRIDE'
        : hasEcsJson
        ? 'SURVEY_JSON'
        : card
        ? 'RISK_CARD'
        : 'UNASSESSED',
  };

  const v1 = asNumber(card?.overridden_importance_score) ?? asNumber(viJson.v1) ?? asNumber(card?.v1_importance_score);
  const v2 = asNumber(viJson.v2) ?? asNumber(card?.v2_structure_score);
  const v3 = asNumber(viJson.v3) ?? asNumber(card?.v3_foundation_score);
  const v4 = asNumber(viJson.v4) ?? asNumber(card?.v4_age_score);
  const v5 = asNumber(viJson.v5) ?? asNumber(card?.v5_ecs_score);
  const v6 = asNumber(viJson.v6) ?? asNumber(card?.v6_sensitivity_score);

  const overrideAvg = asNumber(card?.overridden_avg_vi);
  const overrideViClass = normalizeViClass(card?.overridden_vi_class);
  const avg =
    overrideAvg ??
    asNumber(viJson.viAvg ?? viJson.avgVi ?? viJson.averageScore ?? viJson.avg) ??
    asNumber(card?.avg_vi_score);
  const totalVi = asNumber(viJson.totalVi ?? viJson.totalScore ?? viJson.total);
  const viClass =
    overrideViClass ??
    normalizeViClass((viJson.viClass ?? viJson.classification) as string | undefined) ??
    normalizeViClass(card?.vi_class);

  const catRaw = asNumber(json.foundationCatScore);
  const foundationCat = catRaw !== null && Number.isInteger(catRaw) && catRaw >= 1 && catRaw <= 5 ? catRaw : null;

  const hasAnyViJson = [v1, v2, v3, v4, v5, v6].some((v) => v !== null);
  const vi: ViSnapshot = {
    v1,
    v2,
    v3,
    v4,
    v5,
    v6,
    total: totalVi,
    avg,
    viClass,
    foundationCat,
    source:
      overrideAvg !== null || overrideViClass !== null
        ? 'ADMIN_OVERRIDE'
        : hasAnyViJson || avg !== null
        ? 'SURVEY_JSON'
        : 'UNASSESSED',
  };

  return { ecs, vi, burlandMaxGrade };
}

export function computeDeepLegalHash(
  scores: ReportSnapshotScores,
  surveyJson?: any,
  frozenParcel?: any
): string {
  const sJson = surveyJson || {};
  const legalPayload = {
    scores,
    parcelInfo: frozenParcel || {},
    structuralSpecs: sJson.buildingSpecs || sJson.specs || {},
    defectsSummary: (sJson.floors || []).map((fl: any) => ({
      floor: fl.floorName,
      cadZonePins: fl.cadZonePins || [],
      cadElementPins: fl.cadElementPins || [],
      defects: [...(fl.zones || []), ...(fl.structuralElements || [])]
        .filter((item: any) => !item.isDeleted && !item.is_deleted)
        .flatMap((z: any) =>
          (z.defects || [])
            .filter((d: any) => !d.isDeleted && !d.is_deleted)
            .map((d: any) => ({
              code: d.defectCode || d.defect_code,
              widthMm: d.widthMaxMm ?? d.width_max_mm,
              lengthMm: d.lengthMm ?? d.length_mm,
              pinX: d.pinX ?? d.pin_x,
              pinY: d.pinY ?? d.pin_y,
              cuPhotoUrl: d.cuPhotoUrl || d.cu_photo_url,
            }))
        ),
    })),
    deformationMeasurements: sJson.settlementTilt || sJson.deformation || {},
    photoRotations: sJson.photoRotations || {},
    signatures: {
      surveyor: sJson.signatures?.surveyorSignatureUrl || sJson.surveyorSignatureUrl || null,
      owner: sJson.signatures?.ownerSignatureUrl || sJson.ownerSignatureUrl || null,
    },
  };
  return sha256Hex(stableStringify(legalPayload));
}

export function computeContentHash(scores: ReportSnapshotScores, surveyJson?: any, frozenParcel?: any): string {
  if (surveyJson || frozenParcel) {
    return computeDeepLegalHash(scores, surveyJson, frozenParcel);
  }
  return sha256Hex(stableStringify(scores));
}

