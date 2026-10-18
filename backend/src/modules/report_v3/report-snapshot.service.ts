/**
 * ============================================================================
 * REPORT SNAPSHOT SERVICE (V3)
 * Chụp snapshot điểm ECS/VI tại thời điểm APPROVE (version tag APPROVED_RELEASE)
 * và áp ngược snapshot vào bản ghi báo cáo khi render (D3, D4).
 * ============================================================================
 */

import { createHash } from 'crypto';
import type { PoolClient } from 'pg';
import { Database } from '../../database/db';
import { calculateVi, type EcsClass, type ViClass } from '../scoring/vi-calculator';
import {
  ReportSnapshotSchema,
  type ReportSnapshot,
  type ReportSnapshotScores,
  type EcsSnapshot,
  type ViSnapshot,
} from './report-snapshot.schema';

type JsonObject = Record<string, unknown>;

interface RiskCardRow {
  e1_burland_score: number;
  e2_structure_score: number;
  e3_deformation_score: number;
  e4_material_score: number;
  e5_history_score: number;
  e6_overall_function_score: number;
  total_ecs_score: number;
  overridden_total_ecs: number | null;
  overridden_ecs_class: string | null;
  overridden_avg_vi: number | null;
  overridden_vi_class: string | null;
}

function asObject(value: unknown): JsonObject {
  return value !== null && typeof value === 'object' && !Array.isArray(value) ? (value as JsonObject) : {};
}

function asNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function ecsClassFromTotal(total: number): EcsClass {
  if (total >= 17) return 'CRITICAL';
  if (total >= 11) return 'DEFICIENT';
  if (total >= 6) return 'MEDIUM';
  return 'GOOD';
}

function normalizeEcsClass(value: string | null | undefined): EcsClass | null {
  const v = String(value || '').toUpperCase();
  return v === 'GOOD' || v === 'MEDIUM' || v === 'DEFICIENT' || v === 'CRITICAL' ? v : null;
}

function normalizeViClass(value: string | null | undefined): ViClass | null {
  const v = String(value || '').toUpperCase().replace(/\s+/g, '_');
  return v === 'LOW' || v === 'MEDIUM' || v === 'HIGH' || v === 'VERY_HIGH' ? v : null;
}

/** JSON ổn định (sắp xếp key) để hash lặp lại được */
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

export class ReportSnapshotService {
  /**
   * Tính điểm đã chốt: Admin override > survey_data_json (đã Admin duyệt) > risk_score_cards > calculator chuẩn D7.
   * Hàm thuần (không đụng DB) để test được.
   */
  public static resolveScores(
    surveyJsonRaw: unknown,
    card: RiskCardRow | null,
    burlandMaxGrade: number | null
  ): ReportSnapshotScores {
    const json = asObject(surveyJsonRaw);
    const ecsJson = asObject(json.ecs);
    const viJson = asObject(json.vi);
    const history = asObject(json.historyInterview);

    // ---- ECS ----
    const eKeys = ['e1', 'e2', 'e3', 'e4', 'e5', 'e6'] as const;
    const cardE: Record<(typeof eKeys)[number], number | null> = card
      ? {
          e1: card.e1_burland_score,
          e2: card.e2_structure_score,
          e3: card.e3_deformation_score,
          e4: card.e4_material_score,
          e5: card.e5_history_score,
          e6: card.e6_overall_function_score,
        }
      : { e1: null, e2: null, e3: null, e4: null, e5: null, e6: null };

    const e = {} as Record<(typeof eKeys)[number], number | null>;
    for (const k of eKeys) e[k] = asNumber(ecsJson[k]) ?? cardE[k];

    const hasEcsJson = eKeys.some((k) => asNumber(ecsJson[k]) !== null);
    const allE = eKeys.every((k) => e[k] !== null);
    const sumE = allE ? eKeys.reduce((acc, k) => acc + (e[k] as number), 0) : null;
    const overrideTotal = card?.overridden_total_ecs ?? null;
    const totalEcs = overrideTotal ?? asNumber(ecsJson.totalEcs) ?? sumE ?? (card ? card.total_ecs_score : null);
    const ecsClass: EcsClass | null =
      normalizeEcsClass(card?.overridden_ecs_class) ?? (totalEcs === null ? null : ecsClassFromTotal(totalEcs));

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

    // ---- VI (calculator chuẩn D7, dùng chung với màn review) ----
    const catRaw = asNumber(json.foundationCatScore);
    const yearRaw = asNumber(json.constructionYear);
    const sensitive = asObject(history.sensitiveEquipment);
    const adminOverrides: { v2?: number; v4?: number; v6?: number } = {};
    const v2Saved = asNumber(viJson.v2);
    const v4Saved = asNumber(viJson.v4);
    const v6Saved = asNumber(viJson.v6);
    if (v2Saved !== null) adminOverrides.v2 = v2Saved;
    if (v4Saved !== null) adminOverrides.v4 = v4Saved;
    if (v6Saved !== null) adminOverrides.v6 = v6Saved;

    const calc = calculateVi({
      usageFunction: typeof json.usageFunction === 'string' ? json.usageFunction : null,
      surveyCaseType: typeof json.surveyCaseType === 'string' ? json.surveyCaseType : null,
      isVacantLand: json.isVacantLand === true,
      objectGroup: typeof json.objectGroup === 'string' ? json.objectGroup : null,
      structureSystem: typeof json.structureSystem === 'string' ? json.structureSystem : null,
      foundationCatScore: catRaw,
      constructionYear: yearRaw,
      renovationLoad: asNumber(history.renovationLoad) ?? 0,
      continuousOperation247: history.continuousOperation247 === true,
      hasSensitiveEquipment: sensitive.has === true,
      ecsClass,
      adminOverrides,
    });

    const overrideAvg = card?.overridden_avg_vi ?? null;
    const overrideViClass = normalizeViClass(card?.overridden_vi_class);
    const avg = overrideAvg ?? calc.viAvg;

    const vi: ViSnapshot = {
      v1: calc.v1,
      v2: calc.v2,
      v3: calc.v3,
      v4: calc.v4,
      v5: ecsClass === null ? null : calc.v5,
      v6: calc.v6,
      total: calc.totalVi,
      avg,
      viClass: overrideViClass ?? calc.viClass,
      foundationCat: catRaw !== null && Number.isInteger(catRaw) && catRaw >= 1 && catRaw <= 5 ? catRaw : null,
      source:
        overrideAvg !== null || overrideViClass !== null
          ? 'ADMIN_OVERRIDE'
          : calc.viAvg === null
            ? 'UNASSESSED'
            : v4Saved !== null || v2Saved !== null || v6Saved !== null
              ? 'SURVEY_JSON'
              : 'CALCULATED',
    };

    return { ecs, vi, burlandMaxGrade };
  }

  public static computeContentHash(scores: ReportSnapshotScores): string {
    return sha256Hex(stableStringify(scores));
  }

  /** Đọc dữ liệu cần thiết rồi dựng snapshot (dùng trong transaction APPROVE) */
  public static async buildSnapshot(
    client: PoolClient,
    reportId: string,
    approvedByUserId: string,
    approvedAt: Date
  ): Promise<ReportSnapshot> {
    const repRes = await client.query<{ survey_data_json: unknown }>(
      `SELECT survey_data_json FROM base_survey_reports WHERE id = $1;`,
      [reportId]
    );
    const cardRes = await client.query<RiskCardRow>(`SELECT * FROM risk_score_cards WHERE report_id = $1;`, [reportId]);
    const burlandRes = await client.query<{ max_burland: number | null }>(
      `SELECT MAX(burland_grade) AS max_burland FROM damage_zones WHERE report_id = $1;`,
      [reportId]
    );
    const rawBurland = burlandRes.rows[0]?.max_burland;
    const burland = rawBurland === null || rawBurland === undefined ? null : Math.min(5, Math.max(0, Number(rawBurland)));

    const scores = this.resolveScores(repRes.rows[0]?.survey_data_json, cardRes.rows[0] ?? null, burland);
    const snapshot: ReportSnapshot = {
      schemaVersion: 1,
      reportId,
      approvedAt: approvedAt.toISOString(),
      approvedByUserId,
      ...scores,
      contentSha256: this.computeContentHash(scores),
    };
    return ReportSnapshotSchema.parse(snapshot);
  }

  /** Ghi snapshot APPROVED_RELEASE vào survey_report_versions trong CÙNG transaction với APPROVE */
  public static async writeApprovedRelease(
    client: PoolClient,
    reportId: string,
    adminId: string,
    approvedAt: Date,
    title: string
  ): Promise<{ versionId: string; versionNumber: number; snapshot: ReportSnapshot }> {
    const snapshot = await this.buildSnapshot(client, reportId, adminId, approvedAt);
    const maxRes = await client.query<{ max_ver: number | null }>(
      `SELECT MAX(version_number) AS max_ver FROM survey_report_versions WHERE report_id = $1;`,
      [reportId]
    );
    const maxVer = maxRes.rows[0]?.max_ver;
    const nextVer = maxVer === null || maxVer === undefined ? 0 : Number(maxVer) + 1;
    const ins = await client.query<{ id: string }>(
      `INSERT INTO survey_report_versions (
         report_id, version_number, version_tag, title, edit_reason, snapshot_data, created_by_user_id
       ) VALUES ($1, $2, 'APPROVED_RELEASE', $3, $4, $5, $6)
       RETURNING id;`,
      [reportId, nextVer, title, 'Chốt điểm tại thời điểm APPROVE', JSON.stringify(snapshot), adminId]
    );
    return { versionId: ins.rows[0].id, versionNumber: nextVer, snapshot };
  }

  /** Snapshot APPROVED_RELEASE mới nhất (hoặc null) */
  public static async getLatestApprovedSnapshot(
    reportId: string
  ): Promise<{ versionId: string; snapshot: ReportSnapshot } | null> {
    const res = await Database.query<{ id: string; snapshot_data: unknown }>(
      `SELECT id, snapshot_data FROM survey_report_versions
       WHERE report_id = $1 AND version_tag = 'APPROVED_RELEASE'
       ORDER BY version_number DESC LIMIT 1;`,
      [reportId]
    );
    const row = res.rows[0];
    if (!row) return null;
    const parsed = ReportSnapshotSchema.safeParse(row.snapshot_data);
    if (!parsed.success) {
      console.error('[ReportSnapshotService] Snapshot APPROVED_RELEASE không hợp lệ:', reportId, parsed.error.flatten());
      return null;
    }
    return { versionId: row.id, snapshot: parsed.data };
  }

  /**
   * Gắn điểm snapshot vào bản ghi báo cáo (clone) để pipeline V2 render đúng số đã chốt.
   * Giá trị null được bỏ khỏi survey_data_json.vi để calculator render '--' thay vì đoán.
   */
  public static applySnapshotToReport<T extends JsonObject>(rawReport: T, snapshot: ReportSnapshot): T {
    const cloned = JSON.parse(JSON.stringify(rawReport)) as T;
    const json = asObject(cloned.survey_data_json);
    const ecs: JsonObject = {};
    const vi: JsonObject = {};
    for (const k of ['e1', 'e2', 'e3', 'e4', 'e5', 'e6'] as const) {
      if (snapshot.ecs[k] !== null) ecs[k] = snapshot.ecs[k];
    }
    if (snapshot.ecs.total !== null) ecs.totalEcs = snapshot.ecs.total;
    for (const k of ['v1', 'v2', 'v3', 'v4', 'v5', 'v6'] as const) {
      if (snapshot.vi[k] !== null) vi[k] = snapshot.vi[k];
    }
    if (snapshot.vi.total !== null) vi.totalVi = snapshot.vi.total;
    if (snapshot.vi.avg !== null) vi.viAvg = snapshot.vi.avg;

    const prevEcs = asObject(json.ecs);
    const prevVi = asObject(json.vi);
    json.ecs = { engineeringJudgement: prevEcs.engineeringJudgement, ...ecs };
    json.vi = { engineeringJudgement: prevVi.engineeringJudgement, ...vi };
    if (snapshot.vi.foundationCat !== null) json.foundationCatScore = snapshot.vi.foundationCat;
    else delete json.foundationCatScore;
    (cloned as JsonObject).survey_data_json = json;
    return cloned;
  }
}
