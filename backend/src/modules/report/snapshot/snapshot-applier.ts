/**
 * ============================================================================
 * SNAPSHOT APPLIER
 * Gắn dữ liệu Snapshot bất biến (`APPROVED_RELEASE`) vào bản ghi báo cáo in-memory
 * để quá trình render PDF / HTML hoàn toàn độc lập với các bảng live.
 * ============================================================================
 */

import type { ReportSnapshot } from '../schemas/report-snapshot.schema';
import { asObject } from './snapshot-builder';

type JsonObject = Record<string, unknown>;

export function applySnapshotToReportData<T extends JsonObject>(rawReport: T, snapshot: ReportSnapshot): T {
  const rec = JSON.parse(JSON.stringify(rawReport)) as Record<string, unknown>;

  if (snapshot.approvedAt) {
    rec.approved_at = snapshot.approvedAt;
  }

  // 0. Nạp lại các bảng quan hệ đã đóng băng
  if (snapshot.frozenReportData && typeof snapshot.frozenReportData === 'object') {
    const frd = JSON.parse(JSON.stringify(snapshot.frozenReportData)) as Record<string, unknown>;
    for (const [k, v] of Object.entries(frd)) {
      if (v !== undefined && v !== null) {
        rec[k] = v;
      }
    }
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
    if (fp.metroConstructionType !== undefined && fp.metroConstructionType !== null) {
      rec.metro_construction_type = fp.metroConstructionType;
    }
    if (fp.metroStartChainage !== undefined && fp.metroStartChainage !== null) {
      rec.metro_start_chainage = fp.metroStartChainage;
    }
    if (fp.metroEndChainage !== undefined && fp.metroEndChainage !== null) {
      rec.metro_end_chainage = fp.metroEndChainage;
    }
    if (fp.metroTunnelCrownDepth !== undefined && fp.metroTunnelCrownDepth !== null) {
      rec.metro_tunnel_crown_depth = fp.metroTunnelCrownDepth;
    }
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
      ...(snapshot.impact.distanceM !== undefined && snapshot.impact.distanceM !== null
        ? { distanceM: snapshot.impact.distanceM }
        : {}),
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

