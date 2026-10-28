import { Database } from '../../../database/db';
import type { ProgressFilter, RawProgressRow, RecordKind } from '../progress-report.types';
import { computeAlignmentSide } from '../geo/alignment-geometry';
import type { ProgressDataSource } from './progress.datasource';

/**
 * PostgreSQL/PostGIS DataSource – CHỈ ĐỌC (Read-Only 100%), SQL tham số hóa $n.
 *
 * Phải/Trái tuyến: SQL chỉ trả tọa độ tâm công trình (lng/lat); phía tuyến được tính bằng hàm thuần
 * computeAlignmentSide() trên tim tuyến chi tiết 537 điểm (geo/), chính xác hơn metro_alignments (12 điểm).
 */

type DbRow = Record<string, unknown>;

const PARCEL_GEO_CTE = `
  parcel_side AS (
    SELECT p.id AS parcel_id,
           ST_X(pt.g) AS pt_lng,
           ST_Y(pt.g) AS pt_lat
      FROM parcels p
      LEFT JOIN LATERAL (
        SELECT ST_SetSRID(
                 COALESCE(p.location_geom, ST_Centroid(p.footprint_polygon_geom), ST_Centroid(p.cadastral_polygon_geom)),
                 4326
               ) AS g
      ) pt ON TRUE
     WHERE p.lifecycle_status = 'ACTIVE'
       AND ($1::text = 'ALL' OR p.zone_id = $1::text)
  )`;

const ABSENCE_CTE = `
  absence_union AS (
    SELECT s.parcel_id, s.unit_id, s.recorded_at, s.absence_reason::text AS reason, s.notes
      FROM survey_absence_logs s
    UNION ALL
    SELECT l.parcel_id, NULL::uuid AS unit_id, l.recorded_at, l.absence_reason AS reason, l.notes
      FROM parcel_absence_logs l
  )`;

const REPORT_COLUMNS = `
  r.id AS report_id, r.status::text AS report_status, r.created_at AS report_created_at,
  r.updated_at AS report_updated_at, r.submitted_at AS report_submitted_at, r.survey_date AS report_survey_date,
  COALESCE(r.is_refused_or_absent, FALSE) AS report_is_refused_or_absent, r.survey_data_json AS report_json,
  r.owner_remarks,
  EXISTS (SELECT 1 FROM report_releases rr WHERE rr.report_id = r.id AND rr.deleted_at IS NULL) AS has_release,
  bs.building_name AS spec_building_name, bs.land_use_function AS spec_land_use_function,
  bs.floor_count AS spec_floor_count, bs.year_of_construction AS spec_year,
  bs.foundation_category::text AS spec_foundation_category, bs.foundation_depth_m AS spec_foundation_depth,
  bs.building_height_m AS spec_building_height, bs.foundation_cat_score AS spec_foundation_cat_score,
  rk.ecs_class::text AS risk_ecs_class, rk.building_risk_assessment_bra AS risk_bra,
  rk.overridden_ecs_class AS risk_overridden_ecs_class, rk.overridden_bra AS risk_overridden_bra,
  rk.overridden_burland_grade AS risk_overridden_burland,
  COALESCE(rk.is_engineering_judgement_applied, FALSE) AS risk_judgement_applied,
  COALESCE(da.monitoring_required, FALSE) AS monitoring_required`;

const REPORT_JOINS = `
  LEFT JOIN building_specifications bs ON bs.report_id = r.id
  LEFT JOIN risk_score_cards rk ON rk.report_id = r.id
  LEFT JOIN deformation_assessments da ON da.report_id = r.id`;

const PARCEL_COLUMNS = `
  p.id AS parcel_id, p.zone_id, mz.zone_name, p.project_parcel_code,
  p.house_number AS parcel_house_number, p.street AS parcel_street, p.ward AS parcel_ward,
  p.owner_name AS parcel_owner_name, p.owner_phone AS parcel_owner_phone,
  p.floor_count AS parcel_floor_count, p.frontage_width AS parcel_frontage_width,
  p.distance_to_centerline_m AS parcel_distance_to_centerline,
  p.survey_status::text AS parcel_survey_status, ps.pt_lng, ps.pt_lat`;

const BUILDINGS_SQL = `
WITH ${PARCEL_GEO_CTE}, ${ABSENCE_CTE}
SELECT ${PARCEL_COLUMNS},
       NULL::uuid AS unit_id, NULL AS unit_code, NULL AS unit_display_code, NULL::numeric AS unit_floor_number,
       NULL AS unit_owner_name, NULL AS unit_owner_phone, NULL AS unit_status,
       rep.*,
       NULL::jsonb AS master_json, NULL AS master_building_name, NULL::int AS master_year,
       ab.cnt AS absence_count, ab.first_at AS absence_first_at, ab.last_at AS absence_last_at,
       ab.last_reason AS absence_reason, ab.last_notes AS absence_notes
  FROM parcels p
  JOIN parcel_side ps ON ps.parcel_id = p.id
  LEFT JOIN metro_zones mz ON mz.zone_code = p.zone_id
  LEFT JOIN LATERAL (
    SELECT ${REPORT_COLUMNS}
      FROM base_survey_reports r
      ${REPORT_JOINS}
     WHERE r.parcel_id = p.id
       AND r.unit_id IS NULL
       AND r.deleted_at IS NULL
       AND r.phase = 'PHASE_1'
       AND COALESCE(r.report_type, 'STANDALONE') NOT IN ('CONDO_UNIT', 'UNIT_CHILD')
     ORDER BY (r.id = p.active_phase1_report_id) DESC, r.updated_at DESC NULLS LAST
     LIMIT 1
  ) rep ON TRUE
  LEFT JOIN LATERAL (
    SELECT COUNT(*)::int AS cnt, MIN(au.recorded_at) AS first_at, MAX(au.recorded_at) AS last_at,
           (ARRAY_AGG(au.reason ORDER BY au.recorded_at DESC))[1] AS last_reason,
           (ARRAY_AGG(au.notes ORDER BY au.recorded_at DESC))[1] AS last_notes
      FROM absence_union au
     WHERE au.parcel_id = p.id AND au.unit_id IS NULL
  ) ab ON TRUE
 WHERE NOT (
   UPPER(COALESCE(p.building_type, '')) IN ('CONDOMINIUM', 'CONDO')
   AND EXISTS (
     SELECT 1 FROM building_units bu
      WHERE bu.parcel_id = p.id AND bu.deleted_at IS NULL AND COALESCE(bu.unit_type, 'UNIT') = 'UNIT'
   )
 )
 ORDER BY p.zone_id, p.project_parcel_code;`;

const UNITS_SQL = `
WITH ${PARCEL_GEO_CTE}, ${ABSENCE_CTE}
SELECT ${PARCEL_COLUMNS},
       bu.id AS unit_id, bu.unit_code, bu.display_code AS unit_display_code, bu.floor_number AS unit_floor_number,
       bu.owner_name AS unit_owner_name, bu.owner_phone AS unit_owner_phone, bu.status::text AS unit_status,
       rep.*,
       mst.survey_data_json AS master_json, mst_bs.building_name AS master_building_name,
       mst_bs.year_of_construction AS master_year,
       ab.cnt AS absence_count, ab.first_at AS absence_first_at, ab.last_at AS absence_last_at,
       ab.last_reason AS absence_reason, ab.last_notes AS absence_notes
  FROM building_units bu
  JOIN parcels p ON p.id = bu.parcel_id
  JOIN parcel_side ps ON ps.parcel_id = p.id
  LEFT JOIN metro_zones mz ON mz.zone_code = p.zone_id
  LEFT JOIN LATERAL (
    SELECT ${REPORT_COLUMNS}
      FROM base_survey_reports r
      ${REPORT_JOINS}
     WHERE (r.unit_id = bu.id OR r.id = bu.phase1_report_id)
       AND r.deleted_at IS NULL
       AND r.phase = 'PHASE_1'
     ORDER BY (r.id = bu.phase1_report_id) DESC, r.updated_at DESC NULLS LAST
     LIMIT 1
  ) rep ON TRUE
  LEFT JOIN LATERAL (
    SELECT m.id, m.survey_data_json
      FROM base_survey_reports m
     WHERE m.parcel_id = p.id AND m.unit_id IS NULL AND m.deleted_at IS NULL AND m.phase = 'PHASE_1'
     ORDER BY (m.id = p.active_phase1_report_id) DESC, m.updated_at DESC NULLS LAST
     LIMIT 1
  ) mst ON TRUE
  LEFT JOIN building_specifications mst_bs ON mst_bs.report_id = mst.id
  LEFT JOIN LATERAL (
    SELECT COUNT(*)::int AS cnt, MIN(au.recorded_at) AS first_at, MAX(au.recorded_at) AS last_at,
           (ARRAY_AGG(au.reason ORDER BY au.recorded_at DESC))[1] AS last_reason,
           (ARRAY_AGG(au.notes ORDER BY au.recorded_at DESC))[1] AS last_notes
      FROM absence_union au
     WHERE au.unit_id = bu.id
  ) ab ON TRUE
 WHERE bu.deleted_at IS NULL
   AND COALESCE(bu.unit_type, 'UNIT') = 'UNIT'
   AND UPPER(COALESCE(p.building_type, '')) IN ('CONDOMINIUM', 'CONDO')
 ORDER BY p.zone_id, p.project_parcel_code, bu.floor_number, bu.unit_code;`;

function str(v: unknown): string | null {
  if (v === null || v === undefined) return null;
  const s = String(v);
  return s;
}

function num(v: unknown): number | null {
  if (v === null || v === undefined || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function date(v: unknown): Date | null {
  if (v === null || v === undefined) return null;
  const d = v instanceof Date ? v : new Date(String(v));
  return Number.isNaN(d.getTime()) ? null : d;
}

function obj(v: unknown): Record<string, unknown> | null {
  if (v && typeof v === 'object' && !Array.isArray(v)) return v as Record<string, unknown>;
  if (typeof v === 'string' && v.trim().startsWith('{')) {
    try {
      const parsed: unknown = JSON.parse(v);
      return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? (parsed as Record<string, unknown>) : null;
    } catch (err: unknown) {
      console.error('[ProgressReport] JSON hồ sơ không parse được:', err);
      return null;
    }
  }
  return null;
}

function lngLat(lng: unknown, lat: unknown): readonly [number, number] | null {
  const x = num(lng);
  const y = num(lat);
  return x !== null && y !== null ? [x, y] : null;
}

function mapRow(r: DbRow, kind: RecordKind): RawProgressRow {
  return {
    kind,
    parcelId: String(r.parcel_id),
    unitId: str(r.unit_id),
    zoneId: String(r.zone_id ?? ''),
    zoneName: str(r.zone_name),
    projectParcelCode: String(r.project_parcel_code ?? ''),
    parcelHouseNumber: str(r.parcel_house_number),
    parcelStreet: str(r.parcel_street),
    parcelWard: str(r.parcel_ward),
    parcelOwnerName: str(r.parcel_owner_name),
    parcelOwnerPhone: str(r.parcel_owner_phone),
    parcelFloorCount: num(r.parcel_floor_count),
    parcelFrontageWidth: num(r.parcel_frontage_width),
    parcelDistanceToCenterline: num(r.parcel_distance_to_centerline),
    parcelSurveyStatus: String(r.parcel_survey_status ?? 'NOT_SURVEYED'),
    unitCode: str(r.unit_code),
    unitDisplayCode: str(r.unit_display_code),
    unitFloorNumber: num(r.unit_floor_number),
    unitOwnerName: str(r.unit_owner_name),
    unitOwnerPhone: str(r.unit_owner_phone),
    unitStatus: str(r.unit_status),
    reportId: str(r.report_id),
    reportStatus: str(r.report_status),
    reportCreatedAt: date(r.report_created_at),
    reportUpdatedAt: date(r.report_updated_at),
    reportSubmittedAt: date(r.report_submitted_at),
    reportSurveyDate: date(r.report_survey_date),
    reportIsRefusedOrAbsent: r.report_is_refused_or_absent === true,
    reportJson: obj(r.report_json),
    ownerRemarks: str(r.owner_remarks),
    hasRelease: r.has_release === true,
    specBuildingName: str(r.spec_building_name),
    specLandUseFunction: str(r.spec_land_use_function),
    specFloorCount: num(r.spec_floor_count),
    specYear: num(r.spec_year),
    specFoundationCategory: str(r.spec_foundation_category),
    specFoundationDepth: num(r.spec_foundation_depth),
    specBuildingHeight: num(r.spec_building_height),
    specFoundationCatScore: num(r.spec_foundation_cat_score),
    riskEcsClass: str(r.risk_ecs_class),
    riskBra: str(r.risk_bra),
    riskOverriddenEcsClass: str(r.risk_overridden_ecs_class),
    riskOverriddenBra: str(r.risk_overridden_bra),
    riskOverriddenBurland: num(r.risk_overridden_burland),
    riskJudgementApplied: r.risk_judgement_applied === true,
    monitoringRequired: r.monitoring_required === true,
    masterJson: obj(r.master_json),
    masterBuildingName: str(r.master_building_name),
    masterYear: num(r.master_year),
    absenceCount: num(r.absence_count) ?? 0,
    absenceFirstAt: date(r.absence_first_at),
    absenceLastAt: date(r.absence_last_at),
    absenceReason: str(r.absence_reason),
    absenceNotes: str(r.absence_notes),
    computedSide: computeAlignmentSide(lngLat(r.pt_lng, r.pt_lat)).side,
  };
}

export class PgProgressDataSource implements ProgressDataSource {
  async fetchRows(filter: Pick<ProgressFilter, 'zoneId'>): Promise<RawProgressRow[]> {
    const zoneParam = filter.zoneId || 'ALL';
    const [buildings, units] = await Promise.all([
      Database.query<DbRow>(BUILDINGS_SQL, [zoneParam]),
      Database.query<DbRow>(UNITS_SQL, [zoneParam]),
    ]);
    const rows = [
      ...buildings.rows.map((r) => mapRow(r, 'BUILDING')),
      ...units.rows.map((r) => mapRow(r, 'CONDO_UNIT')),
    ];
    // Giữ nhóm theo zone → mã thửa, căn hộ con nằm liền nhau theo tòa mẹ
    return rows.sort((a, b) =>
      a.zoneId.localeCompare(b.zoneId) ||
      a.projectParcelCode.localeCompare(b.projectParcelCode) ||
      (a.unitFloorNumber ?? 0) - (b.unitFloorNumber ?? 0) ||
      String(a.unitCode ?? '').localeCompare(String(b.unitCode ?? ''), 'vi', { numeric: true })
    );
  }

  async fetchZoneName(zoneId: string): Promise<string | null> {
    if (!zoneId || zoneId === 'ALL') return null;
    const res = await Database.query<{ zone_name: string }>(
      `SELECT zone_name FROM metro_zones WHERE zone_code = $1 LIMIT 1;`,
      [zoneId]
    );
    return res.rows[0]?.zone_name ?? null;
  }
}

