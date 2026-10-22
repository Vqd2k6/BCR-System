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

  public static computeDeepLegalHash(
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
        defects: (fl.zones || []).flatMap((z: any) =>
          (z.defects || [])
            .filter((d: any) => !d.isDeleted && !d.is_deleted)
            .map((d: any) => ({
              code: d.defectCode || d.defect_code,
              widthMm: d.widthMaxMm ?? d.width_max_mm,
              lengthMm: d.lengthMm ?? d.length_mm,
              cuPhotoUrl: d.cuPhotoUrl || d.cu_photo_url,
            }))
        ),
      })),
      deformationMeasurements: sJson.settlementTilt || sJson.deformation || {},
      signatures: {
        surveyor: sJson.signatures?.surveyorSignatureUrl || sJson.surveyorSignatureUrl || null,
        owner: sJson.signatures?.ownerSignatureUrl || sJson.ownerSignatureUrl || null,
      },
    };
    return sha256Hex(stableStringify(legalPayload));
  }

  public static computeContentHash(scores: ReportSnapshotScores, surveyJson?: any, frozenParcel?: any): string {
    if (surveyJson || frozenParcel) {
      return this.computeDeepLegalHash(scores, surveyJson, frozenParcel);
    }
    return sha256Hex(stableStringify(scores));
  }

  /** Đọc dữ liệu cần thiết rồi dựng snapshot Full v2 (dùng trong transaction APPROVE) */
  public static async buildSnapshot(
    client: PoolClient,
    reportId: string,
    approvedByUserId: string,
    approvedAt: Date,
    exportRevision?: number
  ): Promise<ReportSnapshot> {
    const repRes = await client.query<{
      id: string;
      parcel_id: string;
      export_revision: number;
      report_code: string;
      survey_data_json: unknown;
    }>(
      `SELECT id, parcel_id, export_revision, report_code, survey_data_json FROM base_survey_reports WHERE id = $1;`,
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

    // Thu thập toàn bộ dữ liệu lô đất tại thời điểm phê duyệt để đóng băng vĩnh viễn
    const parcelId = repRes.rows[0]?.parcel_id;
    let frozenParcel: any = undefined;
    if (parcelId) {
      const pRes = await client.query<{
        house_number: string | null;
        street: string | null;
        ward: string | null;
        district: string | null;
        owner_name: string | null;
        owner_phone: string | null;
        land_area_m2: number | string | null;
        construction_area_m2: number | string | null;
        floor_count: number | null;
        building_type: string | null;
        official_cadastral_code: string | null;
        project_parcel_code: string | null;
        distance_to_centerline_m: number | null;
        parcel_side_a_m: number | null;
        parcel_side_b_m: number | null;
        polygon_geojson: string | null;
      }>(
        `SELECT p.house_number, p.street, p.ward, p.district, p.owner_name, p.owner_phone,
                p.land_area_m2, p.construction_area_m2, p.floor_count, p.building_type,
                p.official_cadastral_code, p.project_parcel_code,
                ROUND(ST_Distance(COALESCE(p.footprint_polygon_geom, p.cadastral_polygon_geom)::geography, ms.centerline_geom::geography)::numeric, 1) AS distance_to_centerline_m,
                ROUND((ST_Distance(
                  ST_PointN(ST_ExteriorRing(ST_OrientedEnvelope(p.cadastral_polygon_geom)), 1)::geography,
                  ST_PointN(ST_ExteriorRing(ST_OrientedEnvelope(p.cadastral_polygon_geom)), 2)::geography
                ))::numeric, 1) AS parcel_side_a_m,
                ROUND((ST_Distance(
                  ST_PointN(ST_ExteriorRing(ST_OrientedEnvelope(p.cadastral_polygon_geom)), 2)::geography,
                  ST_PointN(ST_ExteriorRing(ST_OrientedEnvelope(p.cadastral_polygon_geom)), 3)::geography
                ))::numeric, 1) AS parcel_side_b_m,
                ST_AsGeoJSON(COALESCE(p.footprint_polygon_geom, p.cadastral_polygon_geom)) AS polygon_geojson
         FROM parcels p
         LEFT JOIN metro_segments ms ON ms.segment_code = p.zone_id
         WHERE p.id = $1 LIMIT 1;`,
        [parcelId]
      );
      if (pRes.rows[0]) {
        const pr = pRes.rows[0];
        let polyJson: any = null;
        if (pr.polygon_geojson) {
          try { polyJson = JSON.parse(pr.polygon_geojson); } catch (e) {}
        }
        frozenParcel = {
          houseNumber: pr.house_number,
          street: pr.street,
          ward: pr.ward,
          district: pr.district,
          ownerName: pr.owner_name,
          ownerPhone: pr.owner_phone,
          landAreaM2: pr.land_area_m2,
          constructionAreaM2: pr.construction_area_m2,
          floorCount: pr.floor_count,
          buildingType: pr.building_type,
          cadastralCode: pr.official_cadastral_code,
          projectParcelCode: pr.project_parcel_code,
          distanceToCenterlineM: pr.distance_to_centerline_m !== null ? Number(pr.distance_to_centerline_m) : null,
          parcelSideAm: pr.parcel_side_a_m !== null ? Number(pr.parcel_side_a_m) : null,
          parcelSideBm: pr.parcel_side_b_m !== null ? Number(pr.parcel_side_b_m) : null,
          polygonGeojson: polyJson,
        };
      }
    }

    const rev = exportRevision ?? repRes.rows[0]?.export_revision ?? 0;
    const rawSurveyJson = repRes.rows[0]?.survey_data_json;
    const frozenSurveyDataJson = asObject(rawSurveyJson);

    const snapshotPayload = {
      schemaVersion: 2 as const,
      reportId,
      approvedAt: approvedAt.toISOString(),
      approvedByUserId,
      ...scores,
      contentSha256: this.computeContentHash(scores, frozenSurveyDataJson, frozenParcel),
      exportRevision: Number.isFinite(rev) ? Math.max(0, Math.floor(rev)) : 0,
      frozenParcel,
      frozenSurveyDataJson,
    };
    return ReportSnapshotSchema.parse(snapshotPayload);
  }

  /** Ghi snapshot APPROVED_RELEASE vào survey_report_versions trong CÙNG transaction với APPROVE */
  public static async writeApprovedRelease(
    client: PoolClient,
    reportId: string,
    adminId: string,
    approvedAt: Date,
    title: string,
    exportRevision?: number
  ): Promise<{ versionId: string; versionNumber: number; snapshot: ReportSnapshot }> {
    const snapshot = await this.buildSnapshot(client, reportId, adminId, approvedAt, exportRevision);
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
      [reportId, nextVer, title, 'Chốt snapshot bất biến tại thời điểm APPROVE', JSON.stringify(snapshot), adminId]
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
   * Gắn dữ liệu snapshot vào bản ghi báo cáo (clone) để render độc lập 100% với bảng parcels live
   */
  public static applySnapshotToReport<T extends JsonObject>(rawReport: T, snapshot: ReportSnapshot): T {
    const rec = JSON.parse(JSON.stringify(rawReport)) as Record<string, unknown>;

    // 1. Nạp lại survey_data_json đã đóng băng tại thời điểm duyệt
    if (snapshot.frozenSurveyDataJson && typeof snapshot.frozenSurveyDataJson === 'object') {
      rec.survey_data_json = JSON.parse(JSON.stringify(snapshot.frozenSurveyDataJson));
    }

    // 2. Nạp lại thông tin lô đất đã đóng băng tại thời điểm duyệt
    if (snapshot.frozenParcel) {
      const fp = snapshot.frozenParcel;
      if (fp.houseNumber !== undefined) rec.house_number = fp.houseNumber;
      if (fp.street !== undefined) rec.street = fp.street;
      if (fp.ward !== undefined) rec.ward = fp.ward;
      if (fp.district !== undefined) rec.district = fp.district;
      if (fp.ownerName !== undefined) rec.owner_name = fp.ownerName;
      if (fp.ownerPhone !== undefined) rec.owner_phone = fp.ownerPhone;
      if (fp.landAreaM2 !== undefined) rec.land_area_m2 = fp.landAreaM2;
      if (fp.constructionAreaM2 !== undefined) rec.parcel_construction_area_m2 = fp.constructionAreaM2;
      if (fp.floorCount !== undefined) rec.parcel_floor_count = fp.floorCount;
      if (fp.buildingType !== undefined) rec.building_type = fp.buildingType;
      if (fp.distanceToCenterlineM !== undefined) rec.distance_to_centerline_m = fp.distanceToCenterlineM;
      if (fp.parcelSideAm !== undefined) rec.parcel_side_a_m = fp.parcelSideAm;
      if (fp.parcelSideBm !== undefined) rec.parcel_side_b_m = fp.parcelSideBm;
      if (fp.polygonGeojson !== undefined) rec.parcel_polygon_geojson = fp.polygonGeojson;
      if (fp.cadastralCode !== undefined) rec.official_cadastral_code = fp.cadastralCode;
      if (fp.projectParcelCode !== undefined) rec.project_parcel_code = fp.projectParcelCode;
    }

    if (snapshot.exportRevision !== undefined) {
      rec.export_revision = snapshot.exportRevision;
    }

    // 3. Áp dụng điểm số ECS/VI từ snapshot
    const json = asObject(rec.survey_data_json);
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
    rec.survey_data_json = json;
    return rec as T;
  }

  /**
   * Tự động rà soát và nâng cấp Full Snapshot v2 cho các hồ sơ APPROVED cũ nếu phát hiện thiếu (Self-Healing).
   * Chạy tự động khi server bootstrap. Nếu 100% hồ sơ đã có snapshot v2, chỉ tốn ~2ms và thoát ngay.
   */
  public static async autoBackfillApprovedSnapshots(): Promise<void> {
    try {
      const checkRes = await Database.query<{ count: string }>(
        `SELECT COUNT(*) AS count
         FROM base_survey_reports r
         WHERE r.status = 'APPROVED' AND r.deleted_at IS NULL
           AND NOT EXISTS (
             SELECT 1 FROM survey_report_versions v
             WHERE v.report_id = r.id
               AND v.version_tag = 'APPROVED_RELEASE'
               AND (v.snapshot_data->>'schemaVersion')::int = 2
               AND v.snapshot_data->'frozenParcel' IS NOT NULL
           );`
      );
      const neededCount = Number(checkRes.rows[0]?.count || 0);
      if (neededCount === 0) {
        return;
      }

      console.log(`🔄 [SNAPSHOT AUTO-HEAL] Phát hiện ${neededCount} hồ sơ APPROVED chưa có Full Snapshot v2. Đang tự động nâng cấp...`);

      const approvedReports = await Database.query<{
        id: string;
        report_code: string;
        approved_at: Date;
        zone_admin_id: string | null;
        export_revision: number;
      }>(
        `SELECT id, report_code, approved_at, zone_admin_id, export_revision
         FROM base_survey_reports
         WHERE status = 'APPROVED' AND deleted_at IS NULL
         ORDER BY approved_at ASC;`
      );

      await Database.transaction(async (client) => {
        for (const report of approvedReports.rows) {
          const existingSnap = await client.query<{
            id: string;
            version_number: number;
            snapshot_data: any;
          }>(
            `SELECT id, version_number, snapshot_data
             FROM survey_report_versions
             WHERE report_id = $1 AND version_tag = 'APPROVED_RELEASE'
             ORDER BY version_number DESC
             LIMIT 1;`,
            [report.id]
          );

          const row = existingSnap.rows[0];
          if (row && row.snapshot_data?.schemaVersion === 2 && row.snapshot_data?.frozenParcel) {
            continue;
          }

          const adminUserRes = await client.query<{ id: string }>(
            `SELECT id FROM users WHERE id = $1 UNION SELECT id FROM users WHERE role IN ('ZONE_ADMIN', 'SUPER_ADMIN') LIMIT 1;`,
            [report.zone_admin_id]
          );
          const adminId = adminUserRes.rows[0]?.id;
          if (!adminId) continue;
          const approvedAt = report.approved_at || new Date();

          if (row) {
            const fullSnapshot = await this.buildSnapshot(
              client,
              report.id,
              adminId,
              approvedAt,
              report.export_revision
            );
            await client.query(
              `UPDATE survey_report_versions
               SET snapshot_data = $1,
                   edit_reason = 'Auto-Heal nâng cấp Full Snapshot v2 (bất biến dữ liệu khảo sát và thửa đất)'
               WHERE id = $2;`,
              [JSON.stringify(fullSnapshot), row.id]
            );
          } else {
            await this.writeApprovedRelease(
              client,
              report.id,
              adminId,
              approvedAt,
              `Khởi tạo snapshot APPROVED_RELEASE (Rev ${String(report.export_revision).padStart(2, '0')})`,
              report.export_revision
            );
          }
        }
      });
      console.log(`✅ [SNAPSHOT AUTO-HEAL] Đã tự động nâng cấp hoàn tất ${neededCount} hồ sơ lên Full Snapshot v2.`);
    } catch (err: unknown) {
      console.error('[SNAPSHOT AUTO-HEAL ERROR] Cảnh báo lỗi khi tự động nâng cấp snapshot:', err);
    }
  }
}
