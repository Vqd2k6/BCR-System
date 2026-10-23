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
  type ImpactSnapshot,
  type BraSnapshot,
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
    if (card?.overridden_burland_grade !== null && card?.overridden_burland_grade !== undefined) {
      e.e1 = asNumber(card.overridden_burland_grade) ?? e.e1;
    }

    const hasEcsJson = eKeys.some((k) => asNumber(ecsJson[k]) !== null);
    const allE = eKeys.every((k) => e[k] !== null);
    const sumE = allE ? eKeys.reduce((acc, k) => acc + (e[k] as number), 0) : null;
    const overrideTotal = card?.overridden_total_ecs ?? null;
    const totalEcs = overrideTotal ?? asNumber(ecsJson.totalEcs) ?? sumE ?? (card ? card.total_ecs_score : null);
    const ecsClass: EcsClass | null =
      normalizeEcsClass(card?.overridden_ecs_class) ??
      normalizeEcsClass(ecsJson.ecsClass as string | undefined) ??
      normalizeEcsClass(card?.ecs_class) ??
      (totalEcs === null ? null : ecsClassFromTotal(totalEcs));

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

    // ---- VI (calculator chuẩn D7, ưu tiên điểm đã chốt trong survey_data_json / risk_score_cards) ----
    const catRaw = asNumber(json.foundationCatScore);
    const yearRaw = asNumber(json.constructionYear);
    const sensitive = asObject(history.sensitiveEquipment);
    const adminOverrides: Partial<Record<'v1' | 'v2' | 'v3' | 'v4' | 'v5' | 'v6', number>> = {};
    const v1Saved = asNumber(card?.overridden_importance_score) ?? asNumber(viJson.v1) ?? asNumber(card?.v1_importance_score);
    const v2Saved = asNumber(viJson.v2) ?? asNumber(card?.v2_structure_score);
    const v3Saved = asNumber(viJson.v3) ?? asNumber(card?.v3_foundation_score);
    const v4Saved = asNumber(viJson.v4) ?? asNumber(card?.v4_age_score);
    const v5Saved = asNumber(viJson.v5) ?? asNumber(card?.v5_ecs_score);
    const v6Saved = asNumber(viJson.v6) ?? asNumber(card?.v6_sensitivity_score);
    if (v1Saved !== null) adminOverrides.v1 = v1Saved;
    if (v2Saved !== null) adminOverrides.v2 = v2Saved;
    if (v3Saved !== null) adminOverrides.v3 = v3Saved;
    if (v4Saved !== null) adminOverrides.v4 = v4Saved;
    if (v5Saved !== null) adminOverrides.v5 = v5Saved;
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
    const avg = overrideAvg ?? asNumber(viJson.viAvg ?? viJson.avgVi) ?? calc.viAvg ?? asNumber(card?.avg_vi_score);

    const vi: ViSnapshot = {
      v1: calc.v1,
      v2: calc.v2,
      v3: calc.v3,
      v4: calc.v4,
      v5: ecsClass === null && v5Saved === null ? null : calc.v5,
      v6: calc.v6,
      total: asNumber(viJson.totalVi) ?? calc.totalVi,
      avg,
      viClass: overrideViClass ?? normalizeViClass(viJson.viClass as string | undefined) ?? calc.viClass ?? normalizeViClass(card?.vi_class),
      foundationCat: catRaw !== null && Number.isInteger(catRaw) && catRaw >= 1 && catRaw <= 5 ? catRaw : null,
      source:
        overrideAvg !== null || overrideViClass !== null
          ? 'ADMIN_OVERRIDE'
          : avg === null
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
        defects: [...(fl.zones || []), ...(fl.structuralElements || [])]
          .filter((item: any) => !item.isDeleted && !item.is_deleted)
          .flatMap((z: any) =>
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
    const repRes = await client.query<Record<string, any>>(
      `SELECT * FROM base_survey_reports WHERE id = $1;`,
      [reportId]
    );
    const cardRes = await client.query<RiskCardRow>(`SELECT * FROM risk_score_cards WHERE report_id = $1;`, [reportId]);
    const burlandRes = await client.query<{ max_burland: number | null }>(
      `SELECT MAX(burland_grade) AS max_burland FROM damage_zones WHERE report_id = $1 AND (is_deleted = FALSE OR is_deleted IS NULL);`,
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
        zone_id: string | null;
        segment_type: string | null;
        frontage_width: number | string | null;
        lot_depth: number | string | null;
        mutation_type: string | null;
        metro_segment_name: string | null;
        metro_construction_type: string | null;
        metro_start_chainage: number | string | null;
        metro_end_chainage: number | string | null;
      }>(
        `SELECT p.house_number, p.street, p.ward, p.district, p.owner_name, p.owner_phone,
                p.land_area_m2, p.construction_area_m2, p.floor_count, p.building_type,
                p.official_cadastral_code, p.project_parcel_code,
                p.zone_id, p.segment_type, p.frontage_width, p.lot_depth, p.mutation_type,
                ms.segment_name AS metro_segment_name,
                ms.construction_type AS metro_construction_type,
                ms.start_chainage_km AS metro_start_chainage,
                ms.end_chainage_km AS metro_end_chainage,
                ROUND(ST_Distance(COALESCE(p.footprint_polygon_geom, p.cadastral_polygon_geom)::geography, ms.centerline_geom::geography)::numeric, 1) AS distance_to_centerline_m,
                ROUND((ST_Distance(
                  ST_PointN(ST_ExteriorRing(ST_OrientedEnvelope(p.cadastral_polygon_geom)), 1)::geography,
                  ST_PointN(ST_ExteriorRing(ST_OrientedEnvelope(p.cadastral_polygon_geom)), 2)::geography
                ))::numeric, 1) AS parcel_side_a_m,
                ROUND((ST_Distance(
                  ST_PointN(ST_ExteriorRing(ST_OrientedEnvelope(p.cadastral_polygon_geom)), 2)::geography,
                  ST_PointN(ST_OrientedEnvelope(p.cadastral_polygon_geom) IS NOT NULL AND TRUE ? ST_ExteriorRing(ST_OrientedEnvelope(p.cadastral_polygon_geom)) : ST_ExteriorRing(ST_OrientedEnvelope(p.cadastral_polygon_geom)), 3)::geography
                ))::numeric, 1) AS parcel_side_b_m,
                ST_AsGeoJSON(COALESCE(p.footprint_polygon_geom, p.cadastral_polygon_geom)) AS polygon_geojson
         FROM parcels p
         LEFT JOIN metro_segments ms ON ms.segment_code = p.zone_id
         WHERE p.id = $1 LIMIT 1;`
          .replace(
            'ST_PointN(ST_OrientedEnvelope(p.cadastral_polygon_geom) IS NOT NULL AND TRUE ? ST_ExteriorRing(ST_OrientedEnvelope(p.cadastral_polygon_geom)) : ST_ExteriorRing(ST_OrientedEnvelope(p.cadastral_polygon_geom)), 3)',
            'ST_PointN(ST_ExteriorRing(ST_OrientedEnvelope(p.cadastral_polygon_geom)), 3)'
          ),
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
          distanceToCenterlineM: pr.distance_to_centerline_m !== null && pr.distance_to_centerline_m !== undefined ? Number(pr.distance_to_centerline_m) : null,
          parcelSideAm: pr.parcel_side_a_m !== null && pr.parcel_side_a_m !== undefined ? Number(pr.parcel_side_a_m) : null,
          parcelSideBm: pr.parcel_side_b_m !== null && pr.parcel_side_b_m !== undefined ? Number(pr.parcel_side_b_m) : null,
          polygonGeojson: polyJson,
          zoneId: pr.zone_id ?? null,
          segmentType: pr.segment_type ?? null,
          frontageWidth: pr.frontage_width ?? null,
          lotDepth: pr.lot_depth ?? null,
          gisMutationType: pr.mutation_type ?? null,
          metroSegmentName: pr.metro_segment_name ?? null,
          metroConstructionType: pr.metro_construction_type ?? null,
          metroStartChainage: pr.metro_start_chainage ?? null,
          metroEndChainage: pr.metro_end_chainage ?? null,
        };
      }
    }

    const rev = exportRevision ?? repRes.rows[0]?.export_revision ?? 0;
    const rawSurveyJson = repRes.rows[0]?.survey_data_json;
    const frozenSurveyDataJson = asObject(rawSurveyJson);

    // Thu thập dữ liệu bảng quan hệ (buildingSpecs, deformation, historicalSensitivity, identificationPhotos, damageZones, riskScores, surveyScopes, buildingUnit) tại thời điểm APPROVE
    const unitId = repRes.rows[0]?.unit_id;
    const photosRes = await client.query(`SELECT * FROM survey_identification_photos WHERE report_id = $1;`, [reportId]);
    const specsRes = await client.query(`SELECT * FROM building_specifications WHERE report_id = $1;`, [reportId]);
    const historyRes = await client.query(`SELECT * FROM historical_sensitivities WHERE report_id = $1;`, [reportId]);
    const floorsRes = await client.query(`SELECT * FROM floor_surveys WHERE report_id = $1 ORDER BY floor_order ASC;`, [reportId]);
    const zonesRes = await client.query(
      `SELECT z.*,
              COALESCE(
                json_agg(d.*) FILTER (WHERE d.id IS NOT NULL AND (d.is_deleted = false OR d.is_deleted IS NULL)),
                '[]'
              ) AS defects
       FROM damage_zones z
       LEFT JOIN defect_items d ON z.id = d.zone_id AND (d.is_deleted = false OR d.is_deleted IS NULL)
       WHERE z.report_id = $1 AND (z.is_deleted = false OR z.is_deleted IS NULL)
       GROUP BY z.id;`,
      [reportId]
    );
    const deformRes = await client.query(`SELECT * FROM deformation_assessments WHERE report_id = $1;`, [reportId]);
    const p2DetailsRes = await client.query(`SELECT * FROM phase2_report_details WHERE report_id = $1;`, [reportId]);
    const userNamesRes = await client.query<{
      surveyor_name: string | null;
      surveyor_code: string | null;
      surveyor_phone: string | null;
      surveyor_signature_img: string | null;
      admin_name: string | null;
      admin_code: string | null;
      zone_admin_signature_img: string | null;
      super_admin_name: string | null;
      super_admin_signature_img: string | null;
    }>(
      `SELECT u.full_name AS surveyor_name, u.surveyor_code, u.phone AS surveyor_phone,
              u.signature_image_url AS surveyor_signature_img,
              ua.full_name AS admin_name, ua.surveyor_code AS admin_code,
              ua.signature_image_url AS zone_admin_signature_img,
              COALESCE(sa.full_name, default_sa.full_name) AS super_admin_name,
              COALESCE(sa.signature_image_url, default_sa.signature_image_url) AS super_admin_signature_img
       FROM base_survey_reports r
       LEFT JOIN users u ON r.surveyor_id = u.id
       LEFT JOIN users ua ON COALESCE(r.zone_admin_id, $2::uuid) = ua.id
       LEFT JOIN users sa ON ua.created_by_user_id = sa.id
       LEFT JOIN LATERAL (
         SELECT full_name, signature_image_url FROM users
         WHERE role = 'SUPER_ADMIN' AND status = 'ACTIVE'
         ORDER BY created_at ASC LIMIT 1
       ) default_sa ON true
       WHERE r.id = $1 LIMIT 1;`,
      [reportId, approvedByUserId]
    );
    const scopesRes = await client.query(`SELECT * FROM survey_scopes WHERE report_id = $1 LIMIT 1;`, [reportId]);
    const unitRes = unitId
      ? await client.query(`SELECT * FROM building_units WHERE id = $1 LIMIT 1;`, [unitId])
      : { rows: [] as any[] };

    const cardRow = cardRes.rows[0] ?? null;
    const edgeDist =
      asNumber(frozenSurveyDataJson.stationEdgeDistance) ??
      asNumber(frozenSurveyDataJson.clearanceOffsetDistance) ??
      asNumber(frozenSurveyDataJson.distanceToTunnelEdgeM) ??
      asNumber((specsRes.rows[0] as any)?.clearanceOffsetDistance);
    const centerDist =
      asNumber(frozenSurveyDataJson.manualMetroDistanceM) ??
      asNumber(frozenSurveyDataJson.distanceToMetroM) ??
      asNumber(frozenSurveyDataJson.metroOffsetDistance) ??
      asNumber((specsRes.rows[0] as any)?.metroOffsetDistance) ??
      frozenParcel?.distanceToCenterlineM ??
      null;
    const hasStationEdge = edgeDist !== null;
    const distM = hasStationEdge ? edgeDist : centerDist;

    const objGroup = String(
      frozenSurveyDataJson.objectGroup ||
      (specsRes.rows[0] as any)?.building_grade ||
      'GENERAL'
    ).toUpperCase();
    const isSpecialObj = objGroup === 'CRITICAL' || objGroup === 'IMPORTANT';

    const execSummary = asObject(frozenSurveyDataJson.executiveSummary);
    const execImpactStr = String(execSummary.constructionImpactStatus || '').toUpperCase();
    const execImpactMatch = execImpactStr.match(/\b(I[1-4])\b/);
    const cardOverriddenImpact = (cardRow as any)?.overridden_impact_level_i
      ? `I${(cardRow as any).overridden_impact_level_i}`
      : null;

    const rawImpactGrade = String(
      (frozenSurveyDataJson.impactAssessment as any)?.iCode ||
      (frozenSurveyDataJson.impactAssessment as any)?.code ||
      execImpactMatch?.[1] ||
      cardOverriddenImpact ||
      cardRow?.impact_grade ||
      ''
    ).toUpperCase();
    let iCode: 'I1' | 'I2' | 'I3' | 'I4' = 'I1';
    if (rawImpactGrade === 'I1' || rawImpactGrade === 'I2' || rawImpactGrade === 'I3' || rawImpactGrade === 'I4') {
      iCode = rawImpactGrade;
    } else if (distM !== null && Number.isFinite(distM)) {
      if (isSpecialObj) {
        if (distM >= 30) iCode = 'I1';
        else if (distM >= 20) iCode = 'I2';
        else if (distM >= 10) iCode = 'I3';
        else iCode = 'I4';
      } else {
        if (distM >= 20) iCode = 'I1';
        else if (distM >= 10) iCode = 'I2';
        else if (distM >= 5) iCode = 'I3';
        else iCode = 'I4';
      }
    }

    const impact: ImpactSnapshot = {
      iCode,
      distanceM: distM,
      distanceType: String(
        (frozenSurveyDataJson.impactAssessment as any)?.distanceType ||
        (hasStationEdge ? 'STATION_EDGE' : 'TUNNEL_CENTERLINE')
      ),
    };

    const viAvgVal = scores.vi.avg ?? 1.5;
    let vCode: 'V1' | 'V2' | 'V3' | 'V4' = 'V1';
    if (scores.vi.viClass === 'VERY_HIGH' || viAvgVal > 3.25) vCode = 'V4';
    else if (scores.vi.viClass === 'HIGH' || viAvgVal > 2.5) vCode = 'V3';
    else if (scores.vi.viClass === 'MEDIUM' || viAvgVal > 1.5) vCode = 'V2';

    const matrixLookup: Record<string, Record<string, { vi: string; en: string }>> = {
      V1: {
        I1: { vi: 'Rủi ro thấp', en: 'Low Risk' },
        I2: { vi: 'Rủi ro thấp', en: 'Low Risk' },
        I3: { vi: 'Rủi ro trung bình', en: 'Medium Risk' },
        I4: { vi: 'Rủi ro cao', en: 'High Risk' },
      },
      V2: {
        I1: { vi: 'Rủi ro thấp', en: 'Low Risk' },
        I2: { vi: 'Rủi ro trung bình', en: 'Medium Risk' },
        I3: { vi: 'Rủi ro trung bình', en: 'Medium Risk' },
        I4: { vi: 'Rủi ro cao', en: 'High Risk' },
      },
      V3: {
        I1: { vi: 'Rủi ro trung bình', en: 'Medium Risk' },
        I2: { vi: 'Rủi ro trung bình', en: 'Medium Risk' },
        I3: { vi: 'Rủi ro cao', en: 'High Risk' },
        I4: { vi: 'Rủi ro rất cao', en: 'Very High Risk' },
      },
      V4: {
        I1: { vi: 'Rủi ro cao', en: 'High Risk' },
        I2: { vi: 'Rủi ro cao', en: 'High Risk' },
        I3: { vi: 'Rủi ro rất cao', en: 'Very High Risk' },
        I4: { vi: 'Rủi ro rất cao', en: 'Very High Risk' },
      },
    };
    let finalRisk = matrixLookup[vCode]?.[iCode] || { vi: 'Rủi ro thấp', en: 'Low Risk' };
    const overriddenBraRaw = String(
      (frozenSurveyDataJson.braAssessment as any)?.braStatus ||
      (frozenSurveyDataJson.braAssessment as any)?.finalRiskLevelVi ||
      execSummary.braStatus ||
      (cardRow?.is_engineering_judgement_applied ? cardRow?.overridden_bra : null) ||
      cardRow?.overridden_bra ||
      ''
    ).toUpperCase();
    if (overriddenBraRaw === 'VERY_LOW' || overriddenBraRaw === 'LOW' || overriddenBraRaw.includes('THẤP')) {
      finalRisk = { vi: 'Rủi ro thấp', en: 'Low Risk' };
    } else if (overriddenBraRaw === 'MEDIUM' || overriddenBraRaw === 'MODERATE' || overriddenBraRaw.includes('TRUNG BÌNH')) {
      finalRisk = { vi: 'Rủi ro trung bình', en: 'Medium Risk' };
    } else if (overriddenBraRaw === 'HIGH' || (overriddenBraRaw.includes('CAO') && !overriddenBraRaw.includes('RẤT CAO'))) {
      finalRisk = { vi: 'Rủi ro cao', en: 'High Risk' };
    } else if (overriddenBraRaw === 'VERY_HIGH' || overriddenBraRaw === 'CRITICAL' || overriddenBraRaw.includes('RẤT CAO')) {
      finalRisk = { vi: 'Rủi ro rất cao', en: 'Very High Risk' };
    }

    const bra: BraSnapshot = {
      vCode,
      iCode,
      finalRiskLevelVi: finalRisk.vi,
      finalRiskLevelEn: finalRisk.en,
      isOverridden: Boolean(cardRow?.is_engineering_judgement_applied || overriddenBraRaw),
      engineeringJudgementAction: cardRow?.engineering_judgement_action ?? null,
      engineeringJudgementReason: cardRow?.engineering_judgement_reason ?? null,
      judgementEngineerName: cardRow?.judgement_engineer_name ?? null,
    };

    let pinnedConfig: Record<string, unknown> | undefined = undefined;
    try {
      const { ReportConfigService } = await import('../report_config/report-config.service');
      const activeCfg = await ReportConfigService.getActiveConfig();
      if (activeCfg) {
        pinnedConfig = JSON.parse(JSON.stringify(activeCfg));
      }
    } catch (cfgErr) {
      console.warn('[ReportSnapshotService] Không thể tải pinnedConfig khi buildSnapshot:', cfgErr);
    }

    const scopeRow = scopesRes.rows[0] as any;
    const unitRow = unitRes.rows[0] as any;
    const repRow = repRes.rows[0];
    const frozenReportData: Record<string, unknown> = {
      identificationPhotos: photosRes.rows,
      buildingSpecs: specsRes.rows[0] || null,
      historicalSensitivity: historyRes.rows[0] || null,
      floors: floorsRes.rows,
      damageZones: zonesRes.rows,
      damage_zones: zonesRes.rows,
      deformation: deformRes.rows[0] || null,
      riskScores: cardRow,
      phase2Details: p2DetailsRes.rows[0] || null,
      survey_date: repRow?.survey_date ?? null,
      summary_conclusions: repRow?.summary_conclusions ?? null,
      engineering_recommendations: repRow?.engineering_recommendations ?? null,
      owner_remarks: repRow?.owner_remarks ?? null,
      surveyor_signature_url: repRow?.surveyor_signature_url ?? null,
      owner_signature_url: repRow?.owner_signature_url ?? null,
      is_absentee_survey: repRow?.is_absentee_survey ?? null,
      is_vacant_land: repRow?.is_vacant_land ?? null,
      inaccessible_areas: scopeRow?.inaccessible_areas ?? null,
      accessibility_limitations: scopeRow?.accessibility_limitations ?? null,
      survey_coverage: scopeRow?.survey_coverage ?? null,
      ...(unitRow
        ? {
            unit_code: unitRow.unit_code,
            display_code: unitRow.display_code,
            floor_number: unitRow.floor_number,
            unit_area_m2: unitRow.unit_area_m2,
            resident_status: unitRow.resident_status,
            owner_name: unitRow.owner_name,
            owner_phone: unitRow.owner_phone,
            owner_id_card: unitRow.owner_id_card,
          }
        : {}),
      surveyor_name: userNamesRes.rows[0]?.surveyor_name ?? null,
      surveyor_code: userNamesRes.rows[0]?.surveyor_code ?? null,
      surveyor_phone: userNamesRes.rows[0]?.surveyor_phone ?? null,
      surveyor_signature_img: userNamesRes.rows[0]?.surveyor_signature_img ?? null,
      admin_name: userNamesRes.rows[0]?.admin_name ?? null,
      zone_admin_name: userNamesRes.rows[0]?.admin_name ?? null,
      admin_code: userNamesRes.rows[0]?.admin_code ?? null,
      zone_admin_signature_img: userNamesRes.rows[0]?.zone_admin_signature_img ?? null,
      super_admin_name: userNamesRes.rows[0]?.super_admin_name ?? null,
      super_admin_signature_img: userNamesRes.rows[0]?.super_admin_signature_img ?? null,
      report_code: repRow?.report_code ?? null,
    };

    const snapshotPayload = {
      schemaVersion: 2 as const,
      reportId,
      approvedAt: approvedAt.toISOString(),
      approvedByUserId,
      ...scores,
      contentSha256: this.computeContentHash(scores, frozenSurveyDataJson, frozenParcel),
      exportRevision: Number.isFinite(rev) ? Math.max(0, Math.floor(rev)) : 0,
      impact,
      bra,
      ...(pinnedConfig ? { pinnedConfig } : {}),
      frozenParcel,
      frozenSurveyDataJson,
      frozenReportData,
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
   * Truy xuất Snapshot tương ứng với một bản Revision cụ thể (hoặc bản APPROVED_RELEASE mới nhất nếu không truyền revision).
   * Dùng cho Xem trước HTML (?rev=N), Xem Payload JSON (?rev=N) và kiểm toán lịch sử phát hành.
   */
  public static async getSnapshotForRevision(
    reportId: string,
    revision?: number
  ): Promise<{ versionId: string; snapshot: ReportSnapshot } | null> {
    if (revision === undefined || revision === null || !Number.isFinite(Number(revision))) {
      return this.getLatestApprovedSnapshot(reportId);
    }

    const revNum = Math.max(0, Math.floor(Number(revision)));
    const relRes = await Database.query<{
      snapshot_version_id: string | null;
      revision: number;
      snapshot_data: unknown;
    }>(
      `SELECT rr.snapshot_version_id, rr.revision, v.snapshot_data
       FROM report_releases rr
       LEFT JOIN survey_report_versions v ON v.id = rr.snapshot_version_id
       WHERE rr.report_id = $1 AND rr.revision = $2 AND rr.deleted_at IS NULL
       LIMIT 1;`,
      [reportId, revNum]
    );

    const relRow = relRes.rows[0];
    if (relRow?.snapshot_data) {
      const parsed = ReportSnapshotSchema.safeParse(relRow.snapshot_data);
      if (parsed.success) {
        return {
          versionId: relRow.snapshot_version_id || '',
          snapshot: { ...parsed.data, exportRevision: relRow.revision ?? revNum },
        };
      }
    }

    // Fallback: Tìm trong survey_report_versions bản APPROVED_RELEASE có exportRevision === revNum
    const verRes = await Database.query<{ id: string; snapshot_data: unknown }>(
      `SELECT id, snapshot_data
       FROM survey_report_versions
       WHERE report_id = $1
         AND version_tag = 'APPROVED_RELEASE'
         AND COALESCE((snapshot_data->>'exportRevision')::int, 0) = $2
       ORDER BY version_number DESC
       LIMIT 1;`,
      [reportId, revNum]
    );
    if (verRes.rows[0]?.snapshot_data) {
      const parsed = ReportSnapshotSchema.safeParse(verRes.rows[0].snapshot_data);
      if (parsed.success) {
        return {
          versionId: verRes.rows[0].id,
          snapshot: { ...parsed.data, exportRevision: revNum },
        };
      }
    }

    const latest = await this.getLatestApprovedSnapshot(reportId);
    if (!latest) return null;
    return {
      versionId: latest.versionId,
      snapshot: { ...latest.snapshot, exportRevision: revNum },
    };
  }

  /**
   * Gắn dữ liệu snapshot vào bản ghi báo cáo (clone) để render độc lập 100% với bảng parcels & các bảng quan hệ live
   */
  public static applySnapshotToReport<T extends JsonObject>(rawReport: T, snapshot: ReportSnapshot): T {
    const rec = JSON.parse(JSON.stringify(rawReport)) as Record<string, unknown>;

    // Khóa cứng mốc thời gian phê duyệt theo đúng bản Snapshot (đảm bảo generatedAt và ngày ký duyệt trên từng Rev là bất biến)
    if (snapshot.approvedAt) {
      rec.approved_at = snapshot.approvedAt;
    }

    // 0. Nạp lại các bảng quan hệ đã đóng băng (buildingSpecs, deformation, historicalSensitivity, damageZones, riskScores...)
    if (snapshot.frozenReportData && typeof snapshot.frozenReportData === 'object') {
      const frd = JSON.parse(JSON.stringify(snapshot.frozenReportData)) as Record<string, unknown>;
      for (const [k, v] of Object.entries(frd)) {
        if (v !== undefined && v !== null) {
          rec[k] = v;
        }
      }
      // Tương thích ngược với các snapshot trước đây chỉ lưu admin_name mà chưa có zone_admin_name
      if (frd.admin_name && !rec.zone_admin_name) {
        rec.zone_admin_name = frd.admin_name;
      }
    }

    if (snapshot.pinnedConfig && typeof snapshot.pinnedConfig === 'object' && !rec.reportContentConfig) {
      rec.reportContentConfig = JSON.parse(JSON.stringify(snapshot.pinnedConfig));
    }

    // 1. Nạp lại survey_data_json đã đóng băng tại thời điểm duyệt
    if (snapshot.frozenSurveyDataJson && typeof snapshot.frozenSurveyDataJson === 'object') {
      rec.survey_data_json = JSON.parse(JSON.stringify(snapshot.frozenSurveyDataJson));
    }

    // 2. Nạp lại thông tin lô đất & đoạn tuyến Metro đã đóng băng tại thời điểm duyệt
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
      if (fp.zoneId !== undefined && fp.zoneId !== null) rec.zone_id = fp.zoneId;
      if (fp.segmentType !== undefined && fp.segmentType !== null) rec.segment_type = fp.segmentType;
      if (fp.frontageWidth !== undefined && fp.frontageWidth !== null) rec.frontage_width = fp.frontageWidth;
      if (fp.lotDepth !== undefined && fp.lotDepth !== null) rec.lot_depth = fp.lotDepth;
      if (fp.gisMutationType !== undefined && fp.gisMutationType !== null) rec.gis_mutation_type = fp.gisMutationType;
      if (fp.metroSegmentName !== undefined && fp.metroSegmentName !== null) rec.metro_segment_name = fp.metroSegmentName;
      if (fp.metroConstructionType !== undefined && fp.metroConstructionType !== null) rec.metro_construction_type = fp.metroConstructionType;
      if (fp.metroStartChainage !== undefined && fp.metroStartChainage !== null) rec.metro_start_chainage = fp.metroStartChainage;
      if (fp.metroEndChainage !== undefined && fp.metroEndChainage !== null) rec.metro_end_chainage = fp.metroEndChainage;
      if (fp.metroTunnelCrownDepth !== undefined && fp.metroTunnelCrownDepth !== null) rec.metro_tunnel_crown_depth = fp.metroTunnelCrownDepth;
    }

    if (snapshot.exportRevision !== undefined) {
      rec.export_revision = snapshot.exportRevision;
    }

    // 3. Áp dụng điểm số ECS / VI / Impact / BRA từ snapshot
    const json = asObject(rec.survey_data_json);
    const ecs: JsonObject = {};
    const vi: JsonObject = {};
    for (const k of ['e1', 'e2', 'e3', 'e4', 'e5', 'e6'] as const) {
      if (snapshot.ecs[k] !== null) ecs[k] = snapshot.ecs[k];
    }
    if (snapshot.ecs.total !== null) ecs.totalEcs = snapshot.ecs.total;
    if (snapshot.ecs.ecsClass !== null) ecs.ecsClass = snapshot.ecs.ecsClass;
    for (const k of ['v1', 'v2', 'v3', 'v4', 'v5', 'v6'] as const) {
      if (snapshot.vi[k] !== null) vi[k] = snapshot.vi[k];
    }
    if (snapshot.vi.total !== null) vi.totalVi = snapshot.vi.total;
    if (snapshot.vi.avg !== null) {
      vi.viAvg = snapshot.vi.avg;
      vi.avgVi = snapshot.vi.avg;
    }
    if (snapshot.vi.viClass !== null) vi.viClass = snapshot.vi.viClass;

    const prevEcs = asObject(json.ecs);
    const prevVi = asObject(json.vi);
    json.ecs = { engineeringJudgement: prevEcs.engineeringJudgement, ...ecs };
    json.vi = { engineeringJudgement: prevVi.engineeringJudgement, ...vi };
    if (snapshot.vi.foundationCat !== null) json.foundationCatScore = snapshot.vi.foundationCat;
    else delete json.foundationCatScore;

    if (snapshot.impact) {
      json.impactAssessment = {
        ...asObject(json.impactAssessment),
        ...(snapshot.impact.iCode ? { iCode: snapshot.impact.iCode, code: snapshot.impact.iCode } : {}),
        ...(snapshot.impact.distanceM !== undefined && snapshot.impact.distanceM !== null ? { distanceM: snapshot.impact.distanceM } : {}),
        ...(snapshot.impact.distanceType ? { distanceType: snapshot.impact.distanceType } : {}),
      };
    }

    if (snapshot.bra) {
      json.braAssessment = {
        ...asObject(json.braAssessment),
        ...snapshot.bra,
        ...(snapshot.bra.finalRiskLevelVi ? { riskLevelVi: snapshot.bra.finalRiskLevelVi } : {}),
        ...(snapshot.bra.finalRiskLevelEn ? { riskLevelEn: snapshot.bra.finalRiskLevelEn } : {}),
      };
    }

    // Đồng bộ cả rec.riskScores với snapshot để không một mapper nào đọc nhầm điểm live
    const curRiskScores = asObject(rec.riskScores);
    rec.riskScores = {
      ...curRiskScores,
      ...(snapshot.ecs.e1 !== null ? { e1_burland_score: snapshot.ecs.e1 } : {}),
      ...(snapshot.ecs.e2 !== null ? { e2_structure_score: snapshot.ecs.e2 } : {}),
      ...(snapshot.ecs.e3 !== null ? { e3_deformation_score: snapshot.ecs.e3 } : {}),
      ...(snapshot.ecs.e4 !== null ? { e4_material_score: snapshot.ecs.e4 } : {}),
      ...(snapshot.ecs.e5 !== null ? { e5_history_score: snapshot.ecs.e5 } : {}),
      ...(snapshot.ecs.e6 !== null ? { e6_overall_function_score: snapshot.ecs.e6 } : {}),
      ...(snapshot.ecs.total !== null ? { total_ecs_score: snapshot.ecs.total } : {}),
      ...(snapshot.ecs.ecsClass !== null ? { ecs_class: snapshot.ecs.ecsClass } : {}),
      ...(snapshot.vi.v1 !== null ? { v1_importance_score: snapshot.vi.v1 } : {}),
      ...(snapshot.vi.v2 !== null ? { v2_structure_score: snapshot.vi.v2 } : {}),
      ...(snapshot.vi.v3 !== null ? { v3_foundation_score: snapshot.vi.v3 } : {}),
      ...(snapshot.vi.v4 !== null ? { v4_age_score: snapshot.vi.v4 } : {}),
      ...(snapshot.vi.v5 !== null ? { v5_ecs_score: snapshot.vi.v5 } : {}),
      ...(snapshot.vi.v6 !== null ? { v6_sensitivity_score: snapshot.vi.v6 } : {}),
      ...(snapshot.vi.avg !== null ? { avg_vi_score: snapshot.vi.avg } : {}),
      ...(snapshot.vi.viClass !== null ? { vi_class: snapshot.vi.viClass } : {}),
      ...(snapshot.impact?.iCode ? { impact_grade: snapshot.impact.iCode } : {}),
      ...(snapshot.bra?.finalRiskLevelVi ? { baseline_risk_assessment: snapshot.bra.finalRiskLevelVi } : {}),
    };

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
               AND v.snapshot_data->'frozenReportData' IS NOT NULL
               AND v.snapshot_data->'bra' IS NOT NULL
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
          if (
            row &&
            row.snapshot_data?.schemaVersion === 2 &&
            row.snapshot_data?.frozenParcel &&
            row.snapshot_data?.frozenReportData &&
            row.snapshot_data?.bra
          ) {
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
