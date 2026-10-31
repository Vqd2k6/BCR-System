/**
 * ============================================================================
 * SNAPSHOT BUILDER (PURE 1:1 FREEZE — ZERO CALCULATION)
 * Đóng băng nguyên trạng 1:1 dữ liệu đã được phê duyệt từ `survey_data_json`,
 * `risk_score_cards`, `parcels` và các bảng quan hệ tại thời điểm APPROVE.
 * TUYỆT ĐỐI KHÔNG tự tính toán chỉ số ECS, VI, Impact hay BRA.
 * ============================================================================
 */

import type { PoolClient } from 'pg';
import { Database } from '../../../database/db';
import {
  ReportSnapshotSchema,
  type ReportSnapshot,
  type ImpactSnapshot,
  type BraSnapshot,
} from '../schemas/report-snapshot.schema';
import {
  type RiskCardRow,
  asObject,
  asNumber,
  resolveFrozenScores,
  computeDeepLegalHash,
  computeContentHash,
  stableStringify,
  sha256Hex,
} from './snapshot-scores.utils';
import { fetchCondoUnitAbsenceMap } from '../../audit/condo/condo-absence.resolver';
import { fetchMasterStandardizedAddress, projectCondoAbsentSurveyJson } from './condo-absent-projection';

export {
  type RiskCardRow,
  asObject,
  asNumber,
  resolveFrozenScores,
  computeDeepLegalHash,
  computeContentHash,
  stableStringify,
  sha256Hex,
};

export async function buildApprovedSnapshot(
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

  const unitId: string | null = repRes.rows[0]?.unit_id ?? null;
  const absence = (await fetchCondoUnitAbsenceMap([reportId], client)).get(reportId);
  const isAbsentUnit = absence?.state === 'ABSENT';

  const rawSurveyJson = repRes.rows[0]?.survey_data_json;
  const frozenSurveyDataJson = isAbsentUnit
    ? projectCondoAbsentSurveyJson(asObject(rawSurveyJson))
    : asObject(rawSurveyJson);
  // Căn hộ vắng không có bảng điểm: thẻ điểm hiện có là kết quả tính từ dữ liệu nội thất không có thật
  const cardRow = isAbsentUnit ? null : (cardRes.rows[0] ?? null);
  const burlandSummary = asObject(frozenSurveyDataJson.burlandSummary);
  const rawBurland =
    asNumber(cardRow?.overridden_burland_grade) ??
    asNumber(burlandSummary.localMaxGrade ?? burlandSummary.assignedCategory) ??
    asNumber(cardRow?.e1_burland_score);
  const burland = rawBurland === null ? null : Math.min(5, Math.max(0, Math.round(rawBurland)));

  const scores = resolveFrozenScores(frozenSurveyDataJson, cardRow, burland);

  const parcelId = repRes.rows[0]?.parcel_id;
  if (unitId && parcelId && !frozenSurveyDataJson.standardizedAddress) {
    const standardizedAddress = await fetchMasterStandardizedAddress(parcelId);
    if (standardizedAddress) frozenSurveyDataJson.standardizedAddress = standardizedAddress;
  }
  let frozenParcel: any = undefined;
  if (parcelId) {
    const pRes = await client.query<Record<string, any>>(
      `SELECT p.house_number, p.street, p.ward, p.district, p.owner_name, p.owner_phone,
              p.land_area_m2, p.construction_area_m2, p.floor_count, p.building_type,
              p.official_cadastral_code, p.project_parcel_code,
              p.zone_id, p.segment_type, p.frontage_width, p.lot_depth, p.mutation_type,
              p.distance_to_centerline_m,
              ms.segment_name AS metro_segment_name,
              ms.construction_type AS metro_construction_type,
              ms.start_chainage_km AS metro_start_chainage,
              ms.end_chainage_km AS metro_end_chainage,
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
        try {
          polyJson = JSON.parse(pr.polygon_geojson);
        } catch (polyErr) {
          console.warn('[SnapshotBuilder] Không thể parse polygon_geojson:', polyErr);
        }
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
        distanceToCenterlineM: asNumber(pr.distance_to_centerline_m),
        parcelSideAm: asNumber(frozenSurveyDataJson.frontageWidth ?? pr.frontage_width),
        parcelSideBm: asNumber(frozenSurveyDataJson.lotDepth ?? pr.lot_depth),
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
  const userNamesRes = await client.query<Record<string, any>>(
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
  let absenceLogsRows: Array<Record<string, unknown>> = [];
  if (parcelId) {
    try {
      const absRes = await Database.query<Record<string, unknown>>(
        `SELECT * FROM survey_absence_logs
         WHERE parcel_id = $1 AND unit_id IS NOT DISTINCT FROM $2
         ORDER BY attempt_count ASC, recorded_at ASC;`,
        [parcelId, unitId]
      );
      absenceLogsRows = absRes.rows;
    } catch (absErr) {
      console.warn('[SnapshotBuilder] Không thể truy vấn survey_absence_logs khi buildSnapshot:', absErr);
    }
  }
  if (absenceLogsRows.length > 0 && !Array.isArray(frozenSurveyDataJson.absenceLogs)) {
    frozenSurveyDataJson.absenceLogs = absenceLogsRows;
  }

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
  const distM = edgeDist ?? centerDist;

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
  const iCode: 'I1' | 'I2' | 'I3' | 'I4' | null =
    rawImpactGrade === 'I1' || rawImpactGrade === 'I2' || rawImpactGrade === 'I3' || rawImpactGrade === 'I4'
      ? rawImpactGrade
      : null;

  const impact: ImpactSnapshot = {
    iCode,
    distanceM: distM,
    distanceType: String(
      (frozenSurveyDataJson.impactAssessment as any)?.distanceType ||
        (edgeDist !== null ? 'STATION_EDGE' : 'TUNNEL_CENTERLINE')
    ),
  };

  const rawVCode = String(
    (frozenSurveyDataJson.braAssessment as any)?.vCode ||
      (frozenSurveyDataJson.braMatrix as any)?.vCode ||
      ''
  ).toUpperCase();
  const vCode: 'V1' | 'V2' | 'V3' | 'V4' | null =
    rawVCode === 'V1' || rawVCode === 'V2' || rawVCode === 'V3' || rawVCode === 'V4'
      ? rawVCode
      : scores.vi.viClass === 'VERY_HIGH'
      ? 'V4'
      : scores.vi.viClass === 'HIGH'
      ? 'V3'
      : scores.vi.viClass === 'MEDIUM'
      ? 'V2'
      : scores.vi.viClass === 'LOW'
      ? 'V1'
      : null;

  const rawBraStatus = String(
    (frozenSurveyDataJson.braAssessment as any)?.braStatus ||
      (frozenSurveyDataJson.braAssessment as any)?.finalRiskLevelVi ||
      (frozenSurveyDataJson.braMatrix as any)?.finalRiskLevel ||
      execSummary.braStatus ||
      (cardRow?.is_engineering_judgement_applied ? cardRow?.overridden_bra : null) ||
      cardRow?.overridden_bra ||
      cardRow?.baseline_risk_assessment ||
      ''
  ).toUpperCase();

  let finalRisk: { vi: string | null; en: string | null } = { vi: null, en: null };
  if (rawBraStatus === 'VERY_LOW' || rawBraStatus === 'LOW' || rawBraStatus.includes('THẤP')) {
    finalRisk = { vi: 'Rủi ro thấp', en: 'Low Risk' };
  } else if (rawBraStatus === 'MEDIUM' || rawBraStatus === 'MODERATE' || rawBraStatus.includes('TRUNG BÌNH')) {
    finalRisk = { vi: 'Rủi ro trung bình', en: 'Medium Risk' };
  } else if (rawBraStatus === 'HIGH' || (rawBraStatus.includes('CAO') && !rawBraStatus.includes('RẤT CAO'))) {
    finalRisk = { vi: 'Rủi ro cao', en: 'High Risk' };
  } else if (rawBraStatus === 'VERY_HIGH' || rawBraStatus === 'CRITICAL' || rawBraStatus.includes('RẤT CAO')) {
    finalRisk = { vi: 'Rủi ro rất cao', en: 'Very High Risk' };
  }

  const bra: BraSnapshot = {
    vCode,
    iCode,
    finalRiskLevelVi: finalRisk.vi,
    finalRiskLevelEn: finalRisk.en,
    isOverridden: Boolean(cardRow?.is_engineering_judgement_applied || cardRow?.overridden_bra),
    engineeringJudgementAction: cardRow?.engineering_judgement_action ?? null,
    engineeringJudgementReason: cardRow?.engineering_judgement_reason ?? null,
    judgementEngineerName: cardRow?.judgement_engineer_name ?? null,
  };

  let pinnedConfig: Record<string, unknown> | undefined = undefined;
  try {
    const { ReportConfigService } = await import('../../report_config/report-config.service');
    const activeCfg = await ReportConfigService.getActiveConfig();
    if (activeCfg) {
      pinnedConfig = JSON.parse(JSON.stringify(activeCfg));
    }
  } catch (cfgErr) {
    console.warn('[SnapshotBuilder] Không thể tải pinnedConfig khi buildSnapshot:', cfgErr);
  }

  const scopeRow = scopesRes.rows[0] as any;
  const repRow = repRes.rows[0];
  const frozenReportData: Record<string, unknown> = {
    identificationPhotos: photosRes.rows,
    buildingSpecs: specsRes.rows[0] || null,
    historicalSensitivity: isAbsentUnit ? null : historyRes.rows[0] || null,
    floors: isAbsentUnit ? [] : floorsRes.rows,
    damageZones: isAbsentUnit ? [] : zonesRes.rows,
    damage_zones: isAbsentUnit ? [] : zonesRes.rows,
    deformation: isAbsentUnit ? null : deformRes.rows[0] || null,
    riskScores: cardRow,
    phase2Details: p2DetailsRes.rows[0] || null,
    survey_date: repRow?.survey_date ?? null,
    summary_conclusions: isAbsentUnit ? null : repRow?.summary_conclusions ?? null,
    engineering_recommendations: repRow?.engineering_recommendations ?? null,
    owner_remarks: isAbsentUnit ? null : repRow?.owner_remarks ?? null,
    surveyor_signature_url: repRow?.surveyor_signature_url ?? null,
    owner_signature_url: repRow?.owner_signature_url ?? null,
    is_absentee_survey: repRow?.is_absentee_survey ?? null,
    is_vacant_land: repRow?.is_vacant_land ?? null,
    inaccessible_areas: scopeRow?.inaccessible_areas ?? null,
    accessibility_limitations: scopeRow?.accessibility_limitations ?? null,
    survey_coverage: scopeRow?.survey_coverage ?? null,
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
    absenceLogs: absenceLogsRows.length > 0 ? absenceLogsRows : (Array.isArray(frozenSurveyDataJson.absenceLogs) ? frozenSurveyDataJson.absenceLogs : []),
    absenteeNoticePhotos: frozenSurveyDataJson.absenteeNoticePhotos ?? frozenSurveyDataJson.absentNoticePhotos ?? frozenSurveyDataJson.absenteeMinutesPhotos ?? null,
  };

  const snapshotPayload = {
    schemaVersion: 2 as const,
    reportId,
    approvedAt: approvedAt.toISOString(),
    approvedByUserId,
    ...scores,
    contentSha256: computeContentHash(scores, frozenSurveyDataJson, frozenParcel),
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

