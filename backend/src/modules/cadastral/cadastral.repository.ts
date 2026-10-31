import { Database } from '../../database/db';
import { PoolClient } from 'pg';
import { NotFoundError, BadRequestError, ForbiddenError } from '../../common/errors/problem-details';
import { EXCLUDED_LIFECYCLE_STATUSES } from './utils/parcel-exclusion';

export interface ParcelEntity {
  id: string;
  zone_id: string;
  official_cadastral_code: string | null;
  project_parcel_code: string;
  field_survey_code: string | null;
  house_number: string | null;
  street: string | null;
  ward: string | null;
  district: string | null;
  owner_name: string | null;
  owner_phone: string | null;
  land_area_m2: number | null;
  construction_area_m2: number | null;
  floor_count: number;
  importance_group: string;
  adjacent_type: string;
  survey_status: 'NOT_SURVEYED' | 'ASSIGNED_TO_ME' | 'IN_PROGRESS' | 'POSTPONED_ABSENT' | 'SUBMITTED' | 'APPROVED' | 'REJECTED';
  lifecycle_status:
    | 'ACTIVE'
    | 'PENDING_MUTATION_APPROVAL'
    | 'SPLIT_DEPRECATED'
    | 'MERGED_DEPRECATED'
    | 'MUTATION_VOID'
    | 'EXCLUDED_NON_BUILDING'
    | 'EXCLUDED_TRAINING_DEMO';
  exclusion_type?: string | null;
  exclusion_reason?: string | null;
  excluded_at?: Date | null;
  excluded_by_id?: string | null;
  building_type?: string;
  total_units?: number;
  deleted_floors?: number[];
  active_phase1_report_id?: string | null;
  mutation_type: string;
  parent_parcel_ids: string[];
  child_parcel_ids: string[];
  absence_attempt_count: number;
  assigned_surveyor_id?: string | null;
  assigned_surveyor_name?: string | null;
  assigned_surveyor_code?: string | null;
  assigned_surveyor_phone?: string | null;
  location_geojson?: Record<string, unknown> | null;
  cadastral_geojson?: Record<string, unknown> | null;
  footprint_geojson?: Record<string, unknown> | null;
  created_at: Date;
  updated_at: Date;
}

export interface CadBBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface CadPolygonPoint {
  x: number;
  y: number;
}

export interface BuildingUnitEntity {
  id: string;
  parcel_id: string;
  unit_code: string;
  display_code?: string | null;
  floor_number: number;
  owner_name: string | null;
  owner_phone: string | null;
  owner_id_card: string | null;
  status: string;
  phase1_report_id: string | null;
  phase2_report_id: string | null;
  floor_plan_id?: string | null;
  cad_bbox?: CadBBox | null;
  cad_polygon?: CadPolygonPoint[] | null;
  unit_cad_url?: string | null;
  resident_status?: string | null;
  unit_type?: 'UNIT' | 'MASTER' | null;
  created_at: Date;
  updated_at: Date;
  deleted_at?: Date | null;
}

export interface BuildingFloorPlanEntity {
  id: string;
  parcel_id: string;
  floor_number: number;
  floor_name: string;
  floor_code?: string | null;
  applicable_floors: number[];
  cad_photo_url: string;
  cad_photo_code: string | null;
  image_width: number | null;
  image_height: number | null;
  scope?: 'MASTER' | 'UNIT' | 'BOTH';
  area_type?: string | null;
  created_at: Date;
  updated_at: Date;
  deleted_at?: Date | null;
}


export class CadastralRepository {
  static async findById(id: string): Promise<ParcelEntity | null> {
    const res = await Database.query<ParcelEntity>(
      `SELECT p.*,
              COALESCE(
                CASE
                  WHEN NULLIF(BTRIM(r_latest.survey_data_json->>'ownerName'), '') IS NOT NULL
                   AND BTRIM(r_latest.survey_data_json->>'ownerName') !~* '^(chủ\s+hộ\s+thửa|chưa\s+cập\s+nhật|chủ\s+sở\s+hữu\s+thửa)'
                  THEN BTRIM(r_latest.survey_data_json->>'ownerName')
                  ELSE NULL
                END,
                CASE
                  WHEN NULLIF(BTRIM(p.owner_name), '') IS NOT NULL
                   AND BTRIM(p.owner_name) !~* '^(chủ\s+hộ\s+thửa|chưa\s+cập\s+nhật|chủ\s+sở\s+hữu\s+thửa)'
                  THEN BTRIM(p.owner_name)
                  ELSE NULL
                END,
                NULLIF(BTRIM(r_latest.survey_data_json->>'ownerName'), ''),
                p.owner_name
              ) AS owner_name,
              COALESCE(NULLIF(BTRIM(r_latest.survey_data_json->>'ownerPhone'), ''), p.owner_phone) AS owner_phone,
              COALESCE(NULLIF(BTRIM(r_latest.survey_data_json->>'houseNumber'), ''), p.house_number) AS house_number,
              COALESCE(NULLIF(BTRIM(r_latest.survey_data_json->>'street'), ''), p.street) AS street,
              ST_AsGeoJSON(p.location_geom)::json AS location_geojson,
              ST_AsGeoJSON(p.cadastral_polygon_geom)::json AS cadastral_geojson,
              ST_AsGeoJSON(p.footprint_polygon_geom)::json AS footprint_geojson
       FROM parcels p
       LEFT JOIN LATERAL (
         SELECT bsr.survey_data_json
         FROM base_survey_reports bsr
         WHERE bsr.parcel_id = p.id
           AND bsr.unit_id IS NULL
           AND bsr.deleted_at IS NULL
         ORDER BY (CASE WHEN bsr.id = p.active_phase1_report_id THEN 0 ELSE 1 END), bsr.updated_at DESC NULLS LAST, bsr.created_at DESC
         LIMIT 1
       ) r_latest ON TRUE
       WHERE p.id = $1 LIMIT 1;`,
      [id]
    );
    return res.rows[0] || null;
  }

  static async findByProjectCode(code: string): Promise<ParcelEntity | null> {
    const res = await Database.query<ParcelEntity>(
      `SELECT p.* FROM parcels p WHERE p.project_parcel_code = $1 LIMIT 1;`,
      [code]
    );
    return res.rows[0] || null;
  }

  static async findExactForSwapByCode(
    rawCode: string,
    excludeParcelId?: string
  ): Promise<(ParcelEntity & {
    report_id?: string | null;
    report_code?: string | null;
    report_status?: string | null;
    surveyor_name?: string | null;
  }) | null> {
    const cleanedCode = (rawCode || '')
      .trim()
      .replace(/[\[\]"'\\]/g, '')
      .trim();
    if (!cleanedCode) return null;

    const isUuidExclude =
      !!excludeParcelId &&
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(excludeParcelId.trim());

    const params: unknown[] = [cleanedCode];
    let excludeClause = '';
    if (isUuidExclude && excludeParcelId) {
      params.push(excludeParcelId.trim());
      excludeClause = `AND p.id != $2::uuid`;
    }

    const res = await Database.query<
      ParcelEntity & {
        report_id?: string | null;
        report_code?: string | null;
        report_status?: string | null;
        surveyor_name?: string | null;
      }
    >(
      `SELECT p.*,
              COALESCE(
                CASE
                  WHEN NULLIF(BTRIM(r_latest.survey_data_json->>'ownerName'), '') IS NOT NULL
                   AND BTRIM(r_latest.survey_data_json->>'ownerName') !~* '^(chủ\\s+hộ\\s+thửa|chưa\\s+cập\\s+nhật|chủ\\s+sở\\s+hữu\\s+thửa)'
                  THEN BTRIM(r_latest.survey_data_json->>'ownerName')
                  ELSE NULL
                END,
                CASE
                  WHEN NULLIF(BTRIM(p.owner_name), '') IS NOT NULL
                   AND BTRIM(p.owner_name) !~* '^(chủ\\s+hộ\\s+thửa|chưa\\s+cập\\s+nhật|chủ\\s+sở\\s+hữu\\s+thửa)'
                  THEN BTRIM(p.owner_name)
                  ELSE NULL
                END,
                NULLIF(BTRIM(r_latest.survey_data_json->>'ownerName'), ''),
                p.owner_name
              ) AS owner_name,
              COALESCE(NULLIF(BTRIM(r_latest.survey_data_json->>'ownerPhone'), ''), p.owner_phone) AS owner_phone,
              COALESCE(NULLIF(BTRIM(r_latest.survey_data_json->>'houseNumber'), ''), p.house_number) AS house_number,
              COALESCE(NULLIF(BTRIM(r_latest.survey_data_json->>'street'), ''), p.street) AS street,
              ST_AsGeoJSON(p.location_geom)::json AS location_geojson,
              ST_AsGeoJSON(p.cadastral_polygon_geom)::json AS cadastral_geojson,
              ST_AsGeoJSON(p.footprint_polygon_geom)::json AS footprint_geojson,
              r_latest.id AS report_id,
              r_latest.report_code AS report_code,
              r_latest.status AS report_status,
              COALESCE(u_rep.full_name, u_p.full_name) AS surveyor_name
       FROM parcels p
       LEFT JOIN LATERAL (
         SELECT bsr.id, bsr.report_code, bsr.status, bsr.surveyor_id, bsr.survey_data_json
         FROM base_survey_reports bsr
         WHERE bsr.parcel_id = p.id
           AND bsr.unit_id IS NULL
           AND bsr.deleted_at IS NULL
         ORDER BY (CASE WHEN bsr.id = p.active_phase1_report_id THEN 0 ELSE 1 END), bsr.updated_at DESC NULLS LAST, bsr.created_at DESC
         LIMIT 1
       ) r_latest ON TRUE
       LEFT JOIN users u_rep ON r_latest.surveyor_id = u_rep.id
       LEFT JOIN users u_p ON p.assigned_surveyor_id = u_p.id
       WHERE p.lifecycle_status = 'ACTIVE'
         ${excludeClause}
         AND (
           UPPER(BTRIM(p.project_parcel_code)) = UPPER($1)
           OR UPPER(BTRIM(COALESCE(p.official_cadastral_code, ''))) = UPPER($1)
         )
       ORDER BY (CASE WHEN UPPER(BTRIM(p.project_parcel_code)) = UPPER($1) THEN 0 ELSE 1 END) ASC
       LIMIT 1;`,
      params
    );
    return res.rows[0] || null;
  }

  // Map between ZONE_S1..S11 and ZONE_01..ZONE_22
  private static readonly ZONE_ALIASES: Record<string, string[]> = {
    'ZONE_S1': ['ZONE_S1', 'ZONE_01'],
    'ZONE_01': ['ZONE_01', 'ZONE_S1'],
    'ZONE_S2': ['ZONE_S2', 'ZONE_02', 'ZONE_03'],
    'ZONE_02': ['ZONE_02', 'ZONE_S2'],
    'ZONE_S3': ['ZONE_S3', 'ZONE_03', 'ZONE_05'],
    'ZONE_03': ['ZONE_03', 'ZONE_S3', 'ZONE_S2'],
    'ZONE_S4': ['ZONE_S4', 'ZONE_04', 'ZONE_07'],
    'ZONE_04': ['ZONE_04', 'ZONE_S4'],
    'ZONE_S5': ['ZONE_S5', 'ZONE_09', 'ZONE_05'],
    'ZONE_05': ['ZONE_05', 'ZONE_S5', 'ZONE_S3'],
    'ZONE_S6': ['ZONE_S6', 'ZONE_11'],
    'ZONE_11': ['ZONE_11', 'ZONE_S6'],
    'ZONE_S7': ['ZONE_S7', 'ZONE_13'],
    'ZONE_13': ['ZONE_13', 'ZONE_S7'],
    'ZONE_S8': ['ZONE_S8', 'ZONE_08', 'ZONE_15'],
    'ZONE_08': ['ZONE_08', 'ZONE_S8'],
    'ZONE_S9': ['ZONE_S9', 'ZONE_09', 'ZONE_17'],
    'ZONE_09': ['ZONE_09', 'ZONE_S9', 'ZONE_S5', 'ZONE_17'],
    'ZONE_S10': ['ZONE_S10', 'ZONE_19'],
    'ZONE_19': ['ZONE_19', 'ZONE_S10'],
    'ZONE_S11': ['ZONE_S11', 'ZONE_21'],
    'ZONE_21': ['ZONE_21', 'ZONE_S11'],
  };

  /**
   * Danh sách thửa đã loại trừ, chỉ phục vụ màn soát xét của Admin (không dùng chung với zone-map).
   */
  static async listExcludedParcelsByZone(zoneId: string): Promise<ParcelEntity[]> {
    const target = (zoneId || 'ALL').toUpperCase();
    const isAll = target === 'ALL' || target === 'ALL_ZONES';
    const params: unknown[] = [[...EXCLUDED_LIFECYCLE_STATUSES]];
    let zoneClause = '';

    if (!isAll) {
      params.push(this.ZONE_ALIASES[target] || [target]);
      zoneClause = `AND p.zone_id = ANY($2)`;
    }

    const res = await Database.query<ParcelEntity>(
      `SELECT p.id, p.zone_id, p.project_parcel_code, p.official_cadastral_code,
              p.house_number, p.street, p.owner_name, p.owner_phone,
              p.land_area_m2, p.construction_area_m2, p.floor_count, p.building_type,
              p.survey_status, p.lifecycle_status,
              p.exclusion_type, p.exclusion_reason, p.excluded_at, p.excluded_by_id,
              u.full_name AS excluded_by_name,
              ST_AsGeoJSON(p.location_geom)::json AS location_geojson,
              ST_AsGeoJSON(p.cadastral_polygon_geom)::json AS cadastral_geojson,
              ST_AsGeoJSON(p.footprint_polygon_geom)::json AS footprint_geojson
       FROM parcels p
       LEFT JOIN users u ON p.excluded_by_id = u.id
       WHERE p.lifecycle_status::text = ANY($1::text[])
         ${zoneClause}
       ORDER BY p.excluded_at DESC NULLS LAST, p.project_parcel_code ASC;`,
      params
    );
    return res.rows;
  }

  static getZoneAliases(zoneId: string): string[] {
    const target = zoneId.trim().toUpperCase();
    return this.ZONE_ALIASES[target] || [target];
  }

  static async listParcelsByZone(zoneId: string, status?: string): Promise<ParcelEntity[]> {
    const target = (zoneId || 'ALL').toUpperCase();
    const isAll = target === 'ALL' || target === 'ALL_ZONES';

    const targetList = this.ZONE_ALIASES[target] || [target];

    let whereClause = `WHERE p.lifecycle_status = 'ACTIVE'`;
    const params: any[] = [];

    if (!isAll) {
      params.push(targetList);
      whereClause += ` AND p.zone_id = ANY($${params.length})`;
    }

    if (status) {
      params.push(status);
      whereClause += ` AND p.survey_status = $${params.length}`;
    }

    const res = await Database.query<ParcelEntity>(
      `SELECT p.*,
              COALESCE(
                CASE
                  WHEN NULLIF(BTRIM(r_latest.survey_data_json->>'ownerName'), '') IS NOT NULL
                   AND BTRIM(r_latest.survey_data_json->>'ownerName') !~* '^(chủ\s+hộ\s+thửa|chưa\s+cập\s+nhật|chủ\s+sở\s+hữu\s+thửa)'
                  THEN BTRIM(r_latest.survey_data_json->>'ownerName')
                  ELSE NULL
                END,
                CASE
                  WHEN NULLIF(BTRIM(p.owner_name), '') IS NOT NULL
                   AND BTRIM(p.owner_name) !~* '^(chủ\s+hộ\s+thửa|chưa\s+cập\s+nhật|chủ\s+sở\s+hữu\s+thửa)'
                  THEN BTRIM(p.owner_name)
                  ELSE NULL
                END,
                NULLIF(BTRIM(r_latest.survey_data_json->>'ownerName'), ''),
                p.owner_name
              ) AS owner_name,
              COALESCE(NULLIF(BTRIM(r_latest.survey_data_json->>'ownerPhone'), ''), p.owner_phone) AS owner_phone,
              COALESCE(NULLIF(BTRIM(r_latest.survey_data_json->>'houseNumber'), ''), p.house_number) AS house_number,
              COALESCE(NULLIF(BTRIM(r_latest.survey_data_json->>'street'), ''), p.street) AS street,
              GREATEST(p.total_units, (SELECT COUNT(*)::int FROM building_units u WHERE u.parcel_id = p.id AND u.deleted_at IS NULL)) AS total_units,
              (SELECT COUNT(*)::int FROM building_units u WHERE u.parcel_id = p.id AND u.status IN ('APPROVED', 'SUBMITTED') AND u.deleted_at IS NULL) AS completed_units_count,
              COALESCE(
                (
                  SELECT r.surveyor_id
                  FROM base_survey_reports r
                  WHERE r.parcel_id = p.id
                  ORDER BY r.updated_at DESC
                  LIMIT 1
                ),
                (
                  SELECT ta.surveyor_id
                  FROM task_assignments ta
                  WHERE ta.parcel_id = p.id
                  ORDER BY ta.assigned_at DESC
                  LIMIT 1
                )
              ) AS assigned_surveyor_id,
              COALESCE(
                (
                  SELECT u.full_name
                  FROM base_survey_reports r
                  JOIN users u ON r.surveyor_id = u.id
                  WHERE r.parcel_id = p.id
                  ORDER BY r.updated_at DESC
                  LIMIT 1
                ),
                (
                  SELECT u.full_name
                  FROM task_assignments ta
                  JOIN users u ON ta.surveyor_id = u.id
                  WHERE ta.parcel_id = p.id
                  ORDER BY ta.assigned_at DESC
                  LIMIT 1
                )
              ) AS assigned_surveyor_name,
              COALESCE(
                (
                  SELECT u.surveyor_code
                  FROM base_survey_reports r
                  JOIN users u ON r.surveyor_id = u.id
                  WHERE r.parcel_id = p.id
                  ORDER BY r.updated_at DESC
                  LIMIT 1
                ),
                (
                  SELECT u.surveyor_code
                  FROM task_assignments ta
                  JOIN users u ON ta.surveyor_id = u.id
                  WHERE ta.parcel_id = p.id
                  ORDER BY ta.assigned_at DESC
                  LIMIT 1
                )
              ) AS assigned_surveyor_code,
              COALESCE(
                (
                  SELECT u.phone
                  FROM base_survey_reports r
                  JOIN users u ON r.surveyor_id = u.id
                  WHERE r.parcel_id = p.id
                  ORDER BY r.updated_at DESC
                  LIMIT 1
                ),
                (
                  SELECT u.phone
                  FROM task_assignments ta
                  JOIN users u ON ta.surveyor_id = u.id
                  WHERE ta.parcel_id = p.id
                  ORDER BY ta.assigned_at DESC
                  LIMIT 1
                )
              ) AS assigned_surveyor_phone,
              ST_AsGeoJSON(p.location_geom)::json AS location_geojson,
              ST_AsGeoJSON(p.cadastral_polygon_geom)::json AS cadastral_geojson,
              ST_AsGeoJSON(p.footprint_polygon_geom)::json AS footprint_geojson
       FROM parcels p
       LEFT JOIN LATERAL (
         SELECT bsr.survey_data_json
         FROM base_survey_reports bsr
         WHERE bsr.parcel_id = p.id
           AND bsr.unit_id IS NULL
           AND bsr.deleted_at IS NULL
         ORDER BY (CASE WHEN bsr.id = p.active_phase1_report_id THEN 0 ELSE 1 END), bsr.updated_at DESC NULLS LAST, bsr.created_at DESC
         LIMIT 1
       ) r_latest ON TRUE
       ${whereClause}
       ORDER BY p.project_parcel_code ASC;`,
      params
    );
    return res.rows;
  }

  static async getMetroAlignment() {
    const res = await Database.query(`
      SELECT 
        id, line_code, line_name, zoi_buffer_meters,
        ST_AsGeoJSON(centerline_geom)::json AS centerline_geojson,
        ST_AsGeoJSON(zoi_polygon_geom)::json AS zoi_geojson
      FROM metro_alignments
      LIMIT 1;
    `);
    return res.rows[0] || null;
  }

  static async getMetroSegments() {
    const res = await Database.query(`
      SELECT 
        id, zone_index, segment_code, segment_name, construction_type,
        start_chainage_km, end_chainage_km, zoi_buffer_meters,
        ST_AsGeoJSON(centerline_geom)::json AS centerline_geojson,
        ST_AsGeoJSON(zoi_polygon_geom)::json AS zoi_geojson
      FROM metro_segments
      ORDER BY zone_index ASC;
    `);
    return res.rows;
  }

  static async findNearbyParcels(
    lat: number,
    lng: number,
    radiusMeters: number = 150
  ): Promise<ParcelEntity[]> {
    const res = await Database.query<ParcelEntity>(
      `SELECT p.*,
              COALESCE(
                CASE
                  WHEN NULLIF(BTRIM(r_latest.survey_data_json->>'ownerName'), '') IS NOT NULL
                   AND BTRIM(r_latest.survey_data_json->>'ownerName') !~* '^(chủ\s+hộ\s+thửa|chưa\s+cập\s+nhật|chủ\s+sở\s+hữu\s+thửa)'
                  THEN BTRIM(r_latest.survey_data_json->>'ownerName')
                  ELSE NULL
                END,
                CASE
                  WHEN NULLIF(BTRIM(p.owner_name), '') IS NOT NULL
                   AND BTRIM(p.owner_name) !~* '^(chủ\s+hộ\s+thửa|chưa\s+cập\s+nhật|chủ\s+sở\s+hữu\s+thửa)'
                  THEN BTRIM(p.owner_name)
                  ELSE NULL
                END,
                NULLIF(BTRIM(r_latest.survey_data_json->>'ownerName'), ''),
                p.owner_name
              ) AS owner_name,
              COALESCE(NULLIF(BTRIM(r_latest.survey_data_json->>'ownerPhone'), ''), p.owner_phone) AS owner_phone,
              COALESCE(NULLIF(BTRIM(r_latest.survey_data_json->>'houseNumber'), ''), p.house_number) AS house_number,
              COALESCE(NULLIF(BTRIM(r_latest.survey_data_json->>'street'), ''), p.street) AS street,
              ST_Distance(
                p.location_geom::geography,
                ST_SetSRID(ST_MakePoint($2, $1), 4326)::geography
              ) AS distance_meters,
              ST_AsGeoJSON(p.location_geom)::json AS location_geojson,
              ST_AsGeoJSON(p.cadastral_polygon_geom)::json AS cadastral_geojson
       FROM parcels p
       LEFT JOIN LATERAL (
         SELECT bsr.survey_data_json
         FROM base_survey_reports bsr
         WHERE bsr.parcel_id = p.id
           AND bsr.unit_id IS NULL
           AND bsr.deleted_at IS NULL
         ORDER BY (CASE WHEN bsr.id = p.active_phase1_report_id THEN 0 ELSE 1 END), bsr.updated_at DESC NULLS LAST, bsr.created_at DESC
         LIMIT 1
       ) r_latest ON TRUE
       WHERE p.lifecycle_status = 'ACTIVE'
         AND ST_DWithin(
           p.location_geom::geography,
           ST_SetSRID(ST_MakePoint($2, $1), 4326)::geography,
           $3
         )
       ORDER BY distance_meters ASC
       LIMIT 50;`,
      [lat, lng, radiusMeters]
    );
    return res.rows;
  }

  static async updateSurveyStatus(
    id: string,
    status: string,
    client?: PoolClient
  ): Promise<void> {
    const query = `UPDATE parcels SET survey_status = $2, updated_at = NOW() WHERE id = $1;`;
    if (client) {
      await client.query(query, [id, status]);
    } else {
      await Database.query(query, [id, status]);
    }
  }

  static async recordAbsence(data: {
    parcelId: string;
    surveyorId: string;
    unitId?: string | null;
    absenceReason: string;
    customReason?: string | null;
    notes?: string | null;
    witnessName?: string | null;
    witnessRole?: string | null;
    witnessPhone?: string | null;
    noticeDelivered?: boolean;
    photoProofUrl?: string | null;
    minutesPhotos?: string[];
    rescheduleDate?: string | null;
    attemptCount?: number;
    ownerName?: string | null;
    ownerPhone?: string | null;
    surveyData?: unknown;
  }): Promise<void> {
    let savedReportIdForRelational: string | null = null;
    const rawSurveyObj = (data.surveyData && typeof data.surveyData === 'object') ? (data.surveyData as Record<string, any>) : null;
    const isPlaceholderOwner = (val: unknown): boolean =>
      typeof val === 'string' && /^(chủ\s+hộ\s+thửa|chưa\s+cập\s+nhật|chủ\s+sở\s+hữu\s+thửa)/i.test(val.trim());
    const cleanAbsenceOwnerName =
      data.ownerName && !isPlaceholderOwner(data.ownerName)
        ? data.ownerName.trim()
        : rawSurveyObj?.ownerName && !isPlaceholderOwner(rawSurveyObj.ownerName)
          ? String(rawSurveyObj.ownerName).trim()
          : null;
    const cleanAbsenceOwnerPhone =
      (data.ownerPhone && data.ownerPhone.trim()) ||
      (typeof rawSurveyObj?.ownerPhone === 'string' && rawSurveyObj.ownerPhone.trim()) ||
      null;
    const cleanAbsenceHouseNumber =
      typeof rawSurveyObj?.houseNumber === 'string' && rawSurveyObj.houseNumber.trim()
        ? rawSurveyObj.houseNumber.trim()
        : null;
    const cleanAbsenceStreet =
      typeof rawSurveyObj?.street === 'string' && rawSurveyObj.street.trim()
        ? rawSurveyObj.street.trim()
        : null;

    await Database.transaction(async (client) => {
      let attemptCount = 1;

      if (data.unitId) {
        // Cập nhật trạng thái cho căn hộ con
        await client.query(
          `UPDATE building_units
           SET status = 'POSTPONED_ABSENT',
               owner_name = COALESCE($2, owner_name),
               owner_phone = COALESCE($3, owner_phone),
               updated_at = NOW()
           WHERE id = $1;`,
          [data.unitId, cleanAbsenceOwnerName, cleanAbsenceOwnerPhone]
        );

        if (data.attemptCount && data.attemptCount > 0) {
          attemptCount = data.attemptCount;
        } else {
          const unitCountRes = await client.query<{ count: string }>(
            `SELECT COUNT(*) FROM survey_absence_logs WHERE unit_id = $1;`,
            [data.unitId]
          );
          attemptCount = parseInt(unitCountRes.rows[0]?.count || '0', 10) + 1;
        }
      } else {
        // 1. Tăng số lần vắng mặt của thửa đất/tòa nhà, chuyển trạng thái sang POSTPONED_ABSENT
        await client.query(
          `UPDATE parcels
           SET survey_status = 'POSTPONED_ABSENT',
               absence_attempt_count = absence_attempt_count + 1,
               owner_name = COALESCE($2, owner_name),
               owner_phone = COALESCE($3, owner_phone),
               house_number = COALESCE($4, house_number),
               street = COALESCE($5, street),
               updated_at = NOW()
           WHERE id = $1;`,
          [data.parcelId, cleanAbsenceOwnerName, cleanAbsenceOwnerPhone, cleanAbsenceHouseNumber, cleanAbsenceStreet]
        );

        if (data.attemptCount && data.attemptCount > 0) {
          attemptCount = data.attemptCount;
        } else {
          const countRes = await client.query<{ absence_attempt_count: number }>(
            `SELECT absence_attempt_count FROM parcels WHERE id = $1;`,
            [data.parcelId]
          );
          attemptCount = countRes.rows[0]?.absence_attempt_count || 1;
        }
      }

      // Chuẩn hóa absence_reason
      const validReasons = ['HOMEOWNER_ABSENT', 'LOCKED_GATE', 'REFUSED_ACCESS', 'UNOCCUPIED_EMPTY', 'LOCKED_SECURITY', 'OTHER'];
      const normalizedReason = validReasons.includes(data.absenceReason) ? data.absenceReason : 'OTHER';
      const customReason = data.customReason || (normalizedReason === 'OTHER' ? data.absenceReason : null);
      const minutesPhotosList = Array.isArray(data.minutesPhotos) ? data.minutesPhotos : [];
      const primaryPhoto = data.photoProofUrl || (minutesPhotosList.length > 0 ? minutesPhotosList[0] : null);

      // 3. Ghi log vắng nhà (kèm unit_id và các trường chi tiết nếu có)
      await client.query(
        `INSERT INTO survey_absence_logs (
           parcel_id, surveyor_id, absence_reason, notes, photo_proof_url,
           reschedule_date, attempt_count, unit_id, custom_reason,
           witness_name, witness_role, witness_phone, notice_delivered, minutes_photos_json
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14);`,
        [
          data.parcelId,
          data.surveyorId,
          normalizedReason,
          data.notes || null,
          primaryPhoto,
          data.rescheduleDate || null,
          attemptCount,
          data.unitId || null,
          customReason,
          data.witnessName || null,
          data.witnessRole || null,
          data.witnessPhone || null,
          Boolean(data.noticeDelivered),
          JSON.stringify(minutesPhotosList),
        ]
      );

      // 4. Nếu có dữ liệu ngoại thất Bước 1, lưu bảo toàn vào base_survey_reports
      if (data.surveyData) {
        let repRes;
        if (data.unitId) {
          repRes = await client.query<{ id: string }>(
            `SELECT id FROM base_survey_reports WHERE parcel_id = $1 AND unit_id = $2 ORDER BY created_at DESC LIMIT 1;`,
            [data.parcelId, data.unitId]
          );
        } else {
          repRes = await client.query<{ id: string }>(
            `SELECT id FROM base_survey_reports WHERE parcel_id = $1 AND unit_id IS NULL ORDER BY created_at DESC LIMIT 1;`,
            [data.parcelId]
          );
        }

        let repId: string;
        if (repRes.rows[0]) {
          repId = repRes.rows[0].id;
          await client.query(
            `UPDATE base_survey_reports
             SET is_refused_or_absent = TRUE,
                 status = 'DRAFT',
                 survey_data_json = $2,
                 surveyor_id = $3,
                 updated_at = NOW()
             WHERE id = $1;`,
            [repId, JSON.stringify(data.surveyData), data.surveyorId]
          );
        } else {
          const reportCode = `REPORT-ABSENT-${Date.now()}`;
          const reportType = data.unitId ? 'CONDO_UNIT' : 'STANDALONE';
          const newRep = await client.query<{ id: string }>(
            `INSERT INTO base_survey_reports (
               parcel_id, unit_id, surveyor_id, report_code, report_type, phase, status, is_refused_or_absent, survey_data_json
             ) VALUES ($1, $2, $3, $4, $5, 'PHASE_1', 'DRAFT', TRUE, $6)
             RETURNING id;`,
            [data.parcelId, data.unitId || null, data.surveyorId, reportCode, reportType, JSON.stringify(data.surveyData)]
          );
          repId = newRep.rows[0].id;
          await client.query(
            `INSERT INTO phase1_report_details (report_id, is_historical_baseline) VALUES ($1, TRUE);`,
            [repId]
          );
        }
        savedReportIdForRelational = repId;

        if (data.unitId) {
          await client.query(
            `UPDATE building_units SET phase1_report_id = $2 WHERE id = $1;`,
            [data.unitId, repId]
          );
        } else {
          await client.query(
            `UPDATE parcels SET active_phase1_report_id = $2 WHERE id = $1;`,
            [data.parcelId, repId]
          );
        }
      }
    });

    // 5. Đồng bộ các bảng quan hệ (survey_identification_photos, building_specifications, deformation_assessments, survey_scopes) cho hồ sơ Vắng mặt
    if (savedReportIdForRelational && rawSurveyObj) {
      try {
        const { SurveyPackageMapper } = await import('../survey/survey-package.mapper');
        const { SurveyDefectsRepository } = await import('../survey/repositories/survey-defects.repository');
        const step1Photos = SurveyPackageMapper.mapStep1Photos(rawSurveyObj);
        await SurveyDefectsRepository.saveIdentificationPhotos(savedReportIdForRelational, step1Photos);
        const specs = SurveyPackageMapper.mapBuildingSpecs(rawSurveyObj);
        await SurveyDefectsRepository.saveBuildingSpecs(savedReportIdForRelational, specs);
        const def = SurveyPackageMapper.mapDeformation(rawSurveyObj);
        if (def) {
          await SurveyDefectsRepository.saveDeformation(savedReportIdForRelational, def);
        }
        await SurveyDefectsRepository.saveSurveyScope(savedReportIdForRelational, {
          ...rawSurveyObj,
          isAbsenteeSurvey: true,
        });
      } catch (relErr) {
        console.warn('[recordAbsence] Cảnh báo lưu bảng quan hệ cho hồ sơ vắng mặt:', relErr);
      }
    }
  }

  static async updateFootprint(
    id: string,
    footprintGeoJson: any,
    constructionAreaM2?: number
  ): Promise<void> {
    const geoJsonStr = typeof footprintGeoJson === 'string' ? footprintGeoJson : JSON.stringify(footprintGeoJson);
    await Database.query(
      `UPDATE parcels
       SET footprint_polygon_geom = ST_SetSRID(ST_GeomFromGeoJSON($2), 4326),
           construction_area_m2 = COALESCE($3, construction_area_m2),
           updated_at = NOW()
       WHERE id = $1;`,
      [id, geoJsonStr, constructionAreaM2 || null]
    );
  }

  /**
   * Cấp mã tiếp theo cho thửa đất phát sinh (Nối tiếp Max của chính Zone đó và theo tiền tố của thửa cha)
   */
  static async getNextHighRangeProjectCode(
    client: PoolClient,
    zoneId?: string,
    parentCode?: string
  ): Promise<string> {
    let prefix = 'B-';
    let padLen = 4;
    let nextNum = 1;

    let parentPrefix = '';
    if (parentCode) {
      const match = parentCode.match(/^(.*?)(\d+)/);
      if (match) {
        parentPrefix = match[1];
        prefix = match[1];
        padLen = Math.max(match[2].length, 4);
        nextNum = parseInt(match[2], 10) + 1;
      }
    }

    let query = `SELECT project_parcel_code FROM parcels WHERE 1=1`;
    const params: any[] = [];
    if (zoneId) {
      params.push(zoneId);
      query += ` AND zone_id = $${params.length}`;
    }
    if (parentPrefix) {
      params.push(`${parentPrefix}%`);
      query += ` AND project_parcel_code LIKE $${params.length}`;
    }
    query += `
      ORDER BY substring(project_parcel_code from '[0-9]+$')::integer DESC NULLS LAST
      LIMIT 1
      FOR UPDATE;
    `;

    const res = await client.query<{ project_parcel_code: string }>(query, params);

    if (res.rows.length > 0 && res.rows[0].project_parcel_code) {
      const maxCode = res.rows[0].project_parcel_code;
      const match = maxCode.match(/^(.*?)(\d+)$/);
      if (match) {
        prefix = match[1];
        padLen = Math.max(match[2].length, 4);
        nextNum = parseInt(match[2], 10) + 1;
      }
    }

    return `${prefix}${String(nextNum).padStart(padLen, '0')}`;
  }

  static async findUnitsByParcelId(parcelId: string): Promise<BuildingUnitEntity[]> {
    const res = await Database.query<BuildingUnitEntity>(
      `SELECT u.*,
        COALESCE(u.phase1_report_id, (SELECT r.id FROM base_survey_reports r WHERE r.unit_id = u.id ORDER BY r.created_at DESC LIMIT 1)) AS phase1_report_id
       FROM building_units u
       WHERE u.parcel_id = $1 AND u.deleted_at IS NULL
       ORDER BY u.floor_number ASC, u.unit_code ASC;`,
      [parcelId]
    );
    return res.rows.map((r) => ({
      ...r,
      floor_number: Number(r.floor_number),
    }));
  }

  static async findUnitById(unitId: string): Promise<BuildingUnitEntity | null> {
    const res = await Database.query<BuildingUnitEntity>(
      `SELECT u.* FROM building_units u WHERE u.id = $1 AND u.deleted_at IS NULL LIMIT 1;`,
      [unitId]
    );
    return res.rows[0] || null;
  }

  static async createBuildingUnit(data: {
    parcelId: string;
    unitCode: string;
    floorNumber: number;
    ownerName?: string | null;
    ownerPhone?: string | null;
    ownerIdCard?: string | null;
    unitType?: 'UNIT' | 'MASTER';
  }): Promise<BuildingUnitEntity> {
    return Database.transaction(async (client) => {
      const res = await client.query<BuildingUnitEntity>(
        `INSERT INTO building_units (
          parcel_id, unit_code, floor_number, owner_name, owner_phone, owner_id_card, unit_type, deleted_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, NULL, NOW())
        ON CONFLICT (parcel_id, unit_code) WHERE deleted_at IS NULL DO UPDATE SET
          floor_number = EXCLUDED.floor_number,
          owner_name = COALESCE(EXCLUDED.owner_name, building_units.owner_name),
          owner_phone = COALESCE(EXCLUDED.owner_phone, building_units.owner_phone),
          owner_id_card = COALESCE(EXCLUDED.owner_id_card, building_units.owner_id_card),
          unit_type = COALESCE(EXCLUDED.unit_type, building_units.unit_type, 'UNIT'),
          deleted_at = NULL,
          updated_at = NOW()
        RETURNING *;`,
        [
          data.parcelId,
          data.unitCode,
          data.floorNumber,
          data.ownerName || null,
          data.ownerPhone || null,
          data.ownerIdCard || null,
          data.unitType || 'UNIT',
        ]
      );
      // Cập nhật total_units và building_type trong parcels
      await client.query(
        `UPDATE parcels 
         SET total_units = (SELECT COUNT(*) FROM building_units WHERE parcel_id = $1 AND deleted_at IS NULL),
             building_type = 'CONDOMINIUM',
             updated_at = NOW()
         WHERE id = $1;`,
        [data.parcelId]
      );
      return res.rows[0];
    });
  }

  static async updateBuildingType(
    parcelId: string,
    buildingType: string,
    totalUnits?: number
  ): Promise<ParcelEntity | null> {
    const res = await Database.query<ParcelEntity>(
      `UPDATE parcels 
       SET building_type = $2,
           total_units = COALESCE($3, total_units),
           updated_at = NOW()
       WHERE id = $1
       RETURNING *;`,
      [parcelId, buildingType, totalUnits !== undefined ? totalUnits : null]
    );
    return res.rows[0] || null;
  }

  static async countReportsByParcelId(parcelId: string): Promise<number> {
    const res = await Database.query<{ count: string }>(
      `SELECT COUNT(*) as count FROM base_survey_reports WHERE parcel_id = $1;`,
      [parcelId]
    );
    return parseInt(res.rows[0]?.count || '0', 10);
  }

  static async countUnitReportsByParcelId(parcelId: string): Promise<number> {
    const res = await Database.query<{ count: string }>(
      `SELECT COUNT(*) as count 
       FROM base_survey_reports r
       JOIN building_units u ON r.unit_id = u.id
       WHERE u.parcel_id = $1 AND u.deleted_at IS NULL;`,
      [parcelId]
    );
    return parseInt(res.rows[0]?.count || '0', 10);
  }

  static async findFloorPlansByParcelId(parcelId: string): Promise<BuildingFloorPlanEntity[]> {
    const res = await Database.query<BuildingFloorPlanEntity>(
      `SELECT * FROM building_floor_plans WHERE parcel_id = $1 AND deleted_at IS NULL ORDER BY floor_number ASC;`,
      [parcelId]
    );
    return res.rows.map((r) => ({
      ...r,
      floor_number: Number(r.floor_number),
      applicable_floors: Array.isArray(r.applicable_floors)
        ? r.applicable_floors.map(Number)
        : [Number(r.floor_number)],
    }));
  }

  static async findFloorPlanByFloor(parcelId: string, floorNumber: number): Promise<BuildingFloorPlanEntity | null> {
    const res = await Database.query<BuildingFloorPlanEntity>(
      `SELECT * FROM building_floor_plans 
       WHERE parcel_id = $1 AND (floor_number = $2 OR $2 = ANY(applicable_floors)) AND deleted_at IS NULL
       ORDER BY (floor_number = $2) DESC, floor_number ASC
       LIMIT 1;`,
      [parcelId, floorNumber]
    );
    return res.rows[0] || null;
  }

  static async upsertFloorPlan(
    data: {
      parcelId: string;
      floorNumber: number;
      floorName: string;
      floorCode?: string;
      applicableFloors?: number[];
      cadPhotoUrl: string;
      cadPhotoCode?: string | null;
      imageWidth?: number | null;
      imageHeight?: number | null;
      scope?: 'MASTER' | 'UNIT' | 'BOTH';
      areaType?: string | null;
    },
    client?: PoolClient
  ): Promise<BuildingFloorPlanEntity> {
    const applicable = data.applicableFloors && data.applicableFloors.length > 0 
      ? data.applicableFloors 
      : [data.floorNumber];

    // Xác định floorCode chuẩn nếu client chưa truyền
    let floorCode = (data.floorCode || '').trim();
    if (!floorCode) {
      if (data.floorNumber < 0) {
        floorCode = `B${String(Math.abs(data.floorNumber)).padStart(2, '0')}`;
      } else if (data.floorNumber === 0) {
        floorCode = 'G';
      } else {
        const lower = data.floorName.toLowerCase();
        if (lower.includes('lửng') || lower.includes('mezzanine')) floorCode = 'MEZZ';
        else if (lower.includes('bán hầm') || lower.includes('semi-basement')) floorCode = 'SB';
        else if (data.floorNumber < 0 || lower.includes('hầm') || lower.includes('basement')) {
          const match = lower.match(/(?:hầm|basement|b)\s*(\d+)/i);
          const bNum = match ? parseInt(match[1], 10) : (data.floorNumber < 0 ? Math.abs(data.floorNumber) : 1);
          floorCode = `B${String(bNum).padStart(2, '0')}`;
        }
        else if (lower.includes('kỹ thuật')) floorCode = 'TECH';
        else if (lower.includes('lánh nạn')) floorCode = 'REF';
        else if (lower.includes('tum')) floorCode = 'TUM';
        else if (lower.includes('mái') || lower.includes('roof')) floorCode = 'ROOF';
        else if (lower.includes('sân thượng')) floorCode = 'TERRACE';
        else floorCode = `F${String(data.floorNumber).padStart(2, '0')}`;
      }
    }

    // Tự động nhận diện thông minh scope & areaType nếu chưa truyền
    let scope = data.scope;
    let areaType = data.areaType;
    if (!scope) {
      const lowerName = data.floorName.toLowerCase();
      if (data.floorNumber < 0 || lowerName.includes('hầm') || lowerName.includes('basement')) {
        scope = 'MASTER';
        areaType = areaType || 'BASEMENT';
      } else if (lowerName.includes('mái') || lowerName.includes('thượng') || lowerName.includes('rooftop')) {
        scope = 'MASTER';
        areaType = areaType || 'ROOFTOP';
      } else if (lowerName.includes('kỹ thuật') || lowerName.includes('lánh nạn')) {
        scope = 'MASTER';
        areaType = areaType || 'TECHNICAL_REFUGE';
      } else if (lowerName.includes('trệt') || lowerName.includes('sảnh') || lowerName.includes('lobby')) {
        scope = 'BOTH';
        areaType = areaType || 'GROUND_LOBBY';
      } else {
        scope = 'UNIT';
        areaType = areaType || 'TYPICAL_UNIT';
      }
    }

    const insertSql = `INSERT INTO building_floor_plans (
        parcel_id, floor_number, floor_name, floor_code, applicable_floors, cad_photo_url, cad_photo_code, image_width, image_height, scope, area_type, deleted_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NULL, NOW())
      ON CONFLICT (parcel_id, floor_number) WHERE deleted_at IS NULL DO UPDATE SET
        floor_name = EXCLUDED.floor_name,
        floor_code = COALESCE(EXCLUDED.floor_code, building_floor_plans.floor_code),
        applicable_floors = EXCLUDED.applicable_floors,
        cad_photo_url = EXCLUDED.cad_photo_url,
        cad_photo_code = EXCLUDED.cad_photo_code,
        image_width = EXCLUDED.image_width,
        image_height = EXCLUDED.image_height,
        scope = COALESCE(EXCLUDED.scope, building_floor_plans.scope),
        area_type = COALESCE(EXCLUDED.area_type, building_floor_plans.area_type),
        deleted_at = NULL,
        updated_at = NOW()
      RETURNING *;`;
    const insertParams = [
      data.parcelId,
      data.floorNumber,
      data.floorName,
      floorCode,
      applicable,
      data.cadPhotoUrl,
      data.cadPhotoCode || null,
      data.imageWidth || null,
      data.imageHeight || null,
      scope,
      areaType || null,
    ];

    const res = client
      ? await client.query<BuildingFloorPlanEntity>(insertSql, insertParams)
      : await Database.query<BuildingFloorPlanEntity>(insertSql, insertParams);

    // Tự động gỡ bỏ tầng khỏi deleted_floors của parcel khi đã có bản vẽ hợp lệ
    const updateParcelSql = `UPDATE parcels 
       SET deleted_floors = array_remove(COALESCE(deleted_floors, '{}'), $2::int),
           updated_at = NOW()
       WHERE id = $1;`;
    if (client) {
      await client.query(updateParcelSql, [data.parcelId, data.floorNumber]);
    } else {
      await Database.query(updateParcelSql, [data.parcelId, data.floorNumber]);
    }

    return res.rows[0];
  }

  static async saveUnitPartitions(
    parcelId: string,
    floorNumber: number,
    floorPlanId: string | null,
    partitions: { 
      unitCode: string; 
      displayCode?: string | null; 
      floorNumber?: number; 
      bbox?: CadBBox | null; 
      polygon?: CadPolygonPoint[] | null; 
      unitCadUrl?: string | null; 
      unitType?: 'UNIT' | 'MASTER';
    }[],
    client?: PoolClient
  ): Promise<BuildingUnitEntity[]> {
    const executeLogic = async (txClient: PoolClient): Promise<BuildingUnitEntity[]> => {
      const savedUnits: BuildingUnitEntity[] = [];

      // Tải cache danh sách floor plans của toà nhà để gán floor_plan_id chính xác theo từng tầng
      const floorPlansRes = await txClient.query<BuildingFloorPlanEntity>(
        `SELECT id, floor_number, applicable_floors 
         FROM building_floor_plans 
         WHERE parcel_id = $1 AND deleted_at IS NULL
         ORDER BY floor_number ASC;`,
        [parcelId]
      );
      const allFloorPlans = floorPlansRes.rows;

      for (const part of partitions) {
        const uFloor = part.floorNumber !== undefined ? part.floorNumber : floorNumber;
        const uType = part.unitType || 'UNIT';
        const dispCode = part.displayCode || null;

        // Phân giải floor_plan_id chính xác cho tầng của căn hộ:
        // Ưu tiên bản vẽ riêng của tầng uFloor, nếu không có mới lấy bản vẽ kế thừa từ applicable_floors
        let effectiveFloorPlanId = floorPlanId;
        const directPlan = allFloorPlans.find((fp) => Number(fp.floor_number) === Number(uFloor));
        if (directPlan) {
          effectiveFloorPlanId = directPlan.id;
        } else {
          const sharedPlan = allFloorPlans.find(
            (fp) => Array.isArray(fp.applicable_floors) && fp.applicable_floors.map(Number).includes(Number(uFloor))
          );
          if (sharedPlan) {
            effectiveFloorPlanId = sharedPlan.id;
          }
        }

        const res = await txClient.query<BuildingUnitEntity>(
          `INSERT INTO building_units (
            parcel_id, unit_code, display_code, floor_number, floor_plan_id, cad_bbox, cad_polygon, unit_cad_url, unit_type, deleted_at, updated_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NULL, NOW())
          ON CONFLICT (parcel_id, unit_code) WHERE deleted_at IS NULL DO UPDATE SET
            display_code = COALESCE(EXCLUDED.display_code, building_units.display_code),
            floor_number = CASE
              WHEN (building_units.status IS DISTINCT FROM 'NOT_SURVEYED' OR building_units.phase1_report_id IS NOT NULL OR EXISTS (SELECT 1 FROM base_survey_reports r WHERE r.unit_id = building_units.id AND r.deleted_at IS NULL))
              THEN COALESCE(building_units.floor_number, EXCLUDED.floor_number)
              ELSE EXCLUDED.floor_number
            END,
            floor_plan_id = CASE
              WHEN (building_units.status IS DISTINCT FROM 'NOT_SURVEYED' OR building_units.phase1_report_id IS NOT NULL OR EXISTS (SELECT 1 FROM base_survey_reports r WHERE r.unit_id = building_units.id AND r.deleted_at IS NULL))
              THEN COALESCE(building_units.floor_plan_id, EXCLUDED.floor_plan_id)
              ELSE COALESCE(EXCLUDED.floor_plan_id, building_units.floor_plan_id)
            END,
            cad_bbox = CASE
              WHEN (building_units.status IS DISTINCT FROM 'NOT_SURVEYED' OR building_units.phase1_report_id IS NOT NULL OR EXISTS (SELECT 1 FROM base_survey_reports r WHERE r.unit_id = building_units.id AND r.deleted_at IS NULL))
              THEN COALESCE(building_units.cad_bbox, EXCLUDED.cad_bbox)
              ELSE COALESCE(EXCLUDED.cad_bbox, building_units.cad_bbox)
            END,
            cad_polygon = CASE
              WHEN (building_units.status IS DISTINCT FROM 'NOT_SURVEYED' OR building_units.phase1_report_id IS NOT NULL OR EXISTS (SELECT 1 FROM base_survey_reports r WHERE r.unit_id = building_units.id AND r.deleted_at IS NULL))
              THEN COALESCE(building_units.cad_polygon, EXCLUDED.cad_polygon)
              ELSE COALESCE(EXCLUDED.cad_polygon, building_units.cad_polygon)
            END,
            unit_cad_url = CASE
              WHEN (building_units.status IS DISTINCT FROM 'NOT_SURVEYED' OR building_units.phase1_report_id IS NOT NULL OR EXISTS (SELECT 1 FROM base_survey_reports r WHERE r.unit_id = building_units.id AND r.deleted_at IS NULL))
              THEN COALESCE(building_units.unit_cad_url, EXCLUDED.unit_cad_url)
              ELSE COALESCE(EXCLUDED.unit_cad_url, building_units.unit_cad_url)
            END,
            unit_type = COALESCE(EXCLUDED.unit_type, building_units.unit_type, 'UNIT'),
            deleted_at = NULL,
            updated_at = NOW()
          RETURNING *;`,
          [
            parcelId,
            part.unitCode,
            dispCode,
            uFloor,
            effectiveFloorPlanId,
            part.bbox ? JSON.stringify(part.bbox) : null,
            part.polygon ? JSON.stringify(part.polygon) : null,
            part.unitCadUrl || null,
            uType,
          ]
        );
        if (res.rows[0]) {
          savedUnits.push(res.rows[0]);
        }
      }

      // SAFE PRUNING (SOFT DELETE MANDATE):
      // TUYỆT ĐỐI CHỈ SOFT DELETE (deleted_at = NOW()) các unit CHƯA KHẢO SÁT
      const targetFloors = Array.from(
        new Set(partitions.map((p) => (p.floorNumber !== undefined ? p.floorNumber : floorNumber)))
      );
      if (targetFloors.length === 0) {
        targetFloors.push(floorNumber);
      }

      for (const fl of targetFloors) {
        const activeCodesOnFloor = partitions
          .filter((p) => (p.floorNumber !== undefined ? p.floorNumber : floorNumber) === fl)
          .map((p) => p.unitCode.trim())
          .filter(Boolean);

        if (activeCodesOnFloor.length > 0) {
          await txClient.query(
            `UPDATE building_units 
             SET deleted_at = NOW(), updated_at = NOW()
             WHERE parcel_id = $1 
               AND floor_number = $2 
               AND NOT (unit_code = ANY($3::varchar[]))
               AND phase1_report_id IS NULL 
               AND (status = 'NOT_SURVEYED' OR status IS NULL)
               AND deleted_at IS NULL;`,
            [parcelId, fl, activeCodesOnFloor]
          );
        } else {
          await txClient.query(
            `UPDATE building_units 
             SET deleted_at = NOW(), updated_at = NOW()
             WHERE parcel_id = $1 
               AND floor_number = $2 
               AND phase1_report_id IS NULL 
               AND (status = 'NOT_SURVEYED' OR status IS NULL)
               AND deleted_at IS NULL;`,
            [parcelId, fl]
          );
        }
      }

      // Cập nhật scope của floor plan nếu có floorPlanId
      if (floorPlanId && partitions.length > 0) {
        const hasUnit = partitions.some((p) => (p.unitType || 'UNIT') === 'UNIT');
        const hasMaster = partitions.some((p) => p.unitType === 'MASTER');
        const scope: 'UNIT' | 'MASTER' | 'BOTH' = hasUnit && hasMaster ? 'BOTH' : hasMaster ? 'MASTER' : 'UNIT';
        await txClient.query(
          `UPDATE building_floor_plans SET scope = $2, updated_at = NOW() WHERE id = $1 AND deleted_at IS NULL;`,
          [floorPlanId, scope]
        );
      }

      // Cập nhật total_units và building_type = 'CONDOMINIUM'
      await txClient.query(
        `UPDATE parcels 
         SET total_units = (SELECT COUNT(*) FROM building_units WHERE parcel_id = $1 AND deleted_at IS NULL),
             building_type = 'CONDOMINIUM',
             deleted_floors = array_remove(COALESCE(deleted_floors, '{}'), $2::int),
             updated_at = NOW()
         WHERE id = $1;`,
        [parcelId, floorNumber]
      );

      return savedUnits;
    };

    if (client) {
      return executeLogic(client);
    }
    return Database.transaction(async (txClient) => executeLogic(txClient));
  }

  static async atomicSyncFloorPlanAndPartitions(
    parcelId: string,
    floorNumber: number,
    floorPlanData: {
      floorName: string;
      floorCode?: string;
      applicableFloors?: number[];
      cadPhotoUrl: string;
      cadPhotoCode?: string | null;
      imageWidth?: number | null;
      imageHeight?: number | null;
      scope?: 'MASTER' | 'UNIT' | 'BOTH';
      areaType?: string | null;
    },
    partitions: {
      unitCode: string;
      displayCode?: string | null;
      floorNumber?: number;
      bbox?: CadBBox | null;
      polygon?: CadPolygonPoint[] | null;
      unitCadUrl?: string | null;
      unitType?: 'UNIT' | 'MASTER';
    }[]
  ): Promise<{ plan: BuildingFloorPlanEntity; units: BuildingUnitEntity[] }> {
    return Database.transaction(async (client) => {
      const plan = await CadastralRepository.upsertFloorPlan(
        {
          parcelId,
          floorNumber,
          ...floorPlanData,
        },
        client
      );

      const units = await CadastralRepository.saveUnitPartitions(
        parcelId,
        floorNumber,
        plan.id,
        partitions,
        client
      );

      return { plan, units };
    });
  }

  static async deleteUnit(parcelId: string, unitId: string): Promise<boolean> {
    return Database.transaction(async (client) => {
      await client.query(
        `UPDATE building_units 
         SET deleted_at = NOW(), updated_at = NOW() 
         WHERE id = $1 AND parcel_id = $2 AND deleted_at IS NULL;`,
        [unitId, parcelId]
      );
      await client.query(
        `UPDATE parcels 
         SET total_units = (SELECT COUNT(*) FROM building_units WHERE parcel_id = $1 AND deleted_at IS NULL),
             updated_at = NOW()
         WHERE id = $1;`,
        [parcelId]
      );
      return true;
    });
  }

  static async getSurveyedUnitsOnFloor(
    parcelId: string, 
    floorNumber: number
  ): Promise<{ unit_code: string; status: string }[]> {
    const res = await Database.query<{ unit_code: string; status: string }>(
      `SELECT unit_code, status 
       FROM building_units 
       WHERE parcel_id = $1 AND floor_number = $2 AND deleted_at IS NULL
         AND (phase1_report_id IS NOT NULL OR status NOT IN ('NOT_SURVEYED'));`,
      [parcelId, floorNumber]
    );
    return res.rows;
  }

  static async restoreFloor(parcelId: string, floorNumber: number): Promise<boolean> {
    await Database.query(
      `UPDATE parcels 
       SET deleted_floors = array_remove(COALESCE(deleted_floors, '{}'), $2::int),
           updated_at = NOW()
       WHERE id = $1;`,
      [parcelId, floorNumber]
    );
    return true;
  }

  static async deleteFloorPlan(
    parcelId: string, 
    floorNumber: number, 
    mode: 'CLEAR_CAD' | 'DELETE_FLOOR' = 'DELETE_FLOOR',
    surveyedCount = 0
  ): Promise<{ message: string; floorNumber: number; mode: string; surveyedCount: number }> {
    return Database.transaction(async (client) => {
      // 1. Soft-delete các unit nháp của tầng này chưa khảo sát
      await client.query(
        `UPDATE building_units 
         SET deleted_at = NOW(), updated_at = NOW()
         WHERE parcel_id = $1 AND floor_number = $2 AND phase1_report_id IS NULL AND (status = 'NOT_SURVEYED' OR status IS NULL) AND deleted_at IS NULL;`,
        [parcelId, floorNumber]
      );

      // 2. Gỡ liên kết CAD đối với các unit đã có báo cáo khảo sát
      await client.query(
        `UPDATE building_units 
         SET floor_plan_id = NULL, cad_bbox = NULL, cad_polygon = NULL, unit_cad_url = NULL, updated_at = NOW()
         WHERE parcel_id = $1 AND floor_number = $2 AND deleted_at IS NULL;`,
        [parcelId, floorNumber]
      );

      // 3. Soft-delete bản ghi bản vẽ tầng trong building_floor_plans nếu có
      await client.query(
        `UPDATE building_floor_plans 
         SET deleted_at = NOW(), updated_at = NOW() 
         WHERE parcel_id = $1 AND floor_number = $2 AND deleted_at IS NULL;`,
        [parcelId, floorNumber]
      );

      // 4. Gỡ số tầng khỏi danh sách áp dụng (applicable_floors) của bất kỳ bản vẽ tầng nào khác
      await client.query(
        `UPDATE building_floor_plans 
         SET applicable_floors = array_remove(applicable_floors, $2::int),
             updated_at = NOW()
         WHERE parcel_id = $1 AND $2::int = ANY(applicable_floors) AND deleted_at IS NULL;`,
        [parcelId, floorNumber]
      );

      // 5. Nếu là DELETE_FLOOR, đưa tầng vào parcels.deleted_floors
      if (mode === 'DELETE_FLOOR') {
        await client.query(
          `UPDATE parcels 
           SET deleted_floors = array_append(COALESCE(deleted_floors, '{}'), $2::int),
               total_units = (SELECT COUNT(*) FROM building_units WHERE parcel_id = $1 AND deleted_at IS NULL),
               updated_at = NOW()
           WHERE id = $1 AND NOT ($2::int = ANY(COALESCE(deleted_floors, '{}')));`,
          [parcelId, floorNumber]
        );
      } else {
        await client.query(
          `UPDATE parcels 
           SET total_units = (SELECT COUNT(*) FROM building_units WHERE parcel_id = $1 AND deleted_at IS NULL),
               updated_at = NOW()
           WHERE id = $1;`,
          [parcelId]
        );
      }

      const message = mode === 'DELETE_FLOOR'
        ? `Đã xóa thành công Tầng ${floorNumber} khỏi tòa nhà.`
        : surveyedCount > 0
        ? `Đã xóa bản vẽ CAD và giải phóng phân chia của Tầng ${floorNumber}. Dữ liệu ${surveyedCount} căn hộ khảo sát vẫn được bảo toàn nguyên vẹn.`
        : `Đã xóa bản vẽ CAD và giải phóng phân chia của Tầng ${floorNumber}.`;

      return {
        message,
        floorNumber,
        mode,
        surveyedCount,
      };
    });
  }

  static async getAbsenceLogsForParcel(parcelId: string): Promise<any[]> {
    const res = await Database.query(
      `SELECT l.*, u.full_name AS surveyor_name, u.surveyor_code
       FROM survey_absence_logs l
       LEFT JOIN users u ON l.surveyor_id = u.id
       WHERE l.parcel_id = $1
       ORDER BY l.attempt_count ASC, l.recorded_at ASC;`,
      [parcelId]
    );
    return res.rows;
  }

  static async getMyAssignedParcels(surveyorId: string, lat?: number, lng?: number): Promise<ParcelEntity[]> {
    let distanceSelect = 'NULL AS distance_to_surveyor_meters';
    let orderBy = 'p.created_at DESC';
    const params: any[] = [surveyorId];

    if (lat !== undefined && lng !== undefined && !isNaN(lat) && !isNaN(lng)) {
      params.push(lng, lat);
      distanceSelect = `ST_Distance(p.location_geom::geography, ST_SetSRID(ST_MakePoint($2, $3), 4326)::geography) AS distance_to_surveyor_meters`;
      orderBy = 'distance_to_surveyor_meters ASC NULLS LAST, p.created_at DESC';
    }

    try {
      const res = await Database.query<ParcelEntity>(
        `SELECT p.*,
                ST_AsGeoJSON(p.location_geom)::json AS location_geojson,
                ST_AsGeoJSON(p.cadastral_polygon_geom)::json AS cadastral_geojson,
                ST_AsGeoJSON(p.footprint_polygon_geom)::json AS footprint_geojson,
                ${distanceSelect}
         FROM parcels p
         WHERE (
           p.assigned_surveyor_id = $1
           OR EXISTS (
             SELECT 1 FROM task_assignments ta
             WHERE ta.parcel_id = p.id AND ta.surveyor_id = $1
           )
           OR EXISTS (
             SELECT 1 FROM base_survey_reports r
             WHERE r.parcel_id = p.id AND r.surveyor_id = $1
           )
         )
           AND p.lifecycle_status = 'ACTIVE'
           AND p.survey_status IN ('NOT_SURVEYED', 'IN_PROGRESS', 'POSTPONED_ABSENT')
         ORDER BY ${orderBy};`,
        params
      );
      return res.rows;
    } catch (err: any) {
      if (err?.code === '42703' || String(err?.message || '').includes('assigned_surveyor_id')) {
        console.warn('⚠️ [CadastralRepository.getMyAssignedParcels] Missing assigned_surveyor_id column. Executing auto-heal migration...');
        try {
          await Database.query(`
            ALTER TABLE parcels ADD COLUMN IF NOT EXISTS assigned_surveyor_id UUID REFERENCES users(id);
            CREATE INDEX IF NOT EXISTS idx_parcels_assigned_surveyor ON parcels(assigned_surveyor_id);
          `);
          const retryRes = await Database.query<ParcelEntity>(
            `SELECT p.*,
                    ST_AsGeoJSON(p.location_geom)::json AS location_geojson,
                    ST_AsGeoJSON(p.cadastral_polygon_geom)::json AS cadastral_geojson,
                    ST_AsGeoJSON(p.footprint_polygon_geom)::json AS footprint_geojson,
                    ${distanceSelect}
             FROM parcels p
             WHERE (
               p.assigned_surveyor_id = $1
               OR EXISTS (
                 SELECT 1 FROM task_assignments ta
                 WHERE ta.parcel_id = p.id AND ta.surveyor_id = $1
               )
               OR EXISTS (
                 SELECT 1 FROM base_survey_reports r
                 WHERE r.parcel_id = p.id AND r.surveyor_id = $1
               )
             )
               AND p.lifecycle_status = 'ACTIVE'
               AND p.survey_status IN ('NOT_SURVEYED', 'IN_PROGRESS', 'POSTPONED_ABSENT')
             ORDER BY ${orderBy};`,
            params
          );
          return retryRes.rows;
        } catch (healErr) {
          console.error('❌ [CadastralRepository.getMyAssignedParcels] Fallback query to legacy tables:', healErr);
          const fallbackRes = await Database.query<ParcelEntity>(
            `SELECT p.*,
                    ST_AsGeoJSON(p.location_geom)::json AS location_geojson,
                    ST_AsGeoJSON(p.cadastral_polygon_geom)::json AS cadastral_geojson,
                    ST_AsGeoJSON(p.footprint_polygon_geom)::json AS footprint_geojson,
                    ${distanceSelect}
             FROM parcels p
             WHERE (
               EXISTS (
                 SELECT 1 FROM task_assignments ta
                 WHERE ta.parcel_id = p.id AND ta.surveyor_id = $1
               )
               OR EXISTS (
                 SELECT 1 FROM base_survey_reports r
                 WHERE r.parcel_id = p.id AND r.surveyor_id = $1
               )
             )
               AND p.lifecycle_status = 'ACTIVE'
               AND p.survey_status IN ('NOT_SURVEYED', 'IN_PROGRESS', 'POSTPONED_ABSENT')
             ORDER BY ${orderBy};`,
            params
          );
          return fallbackRes.rows;
        }
      }
      throw err;
    }
  }

  static async assignSurveyorToParcels(parcelIds: string[], surveyorId: string, notes?: string): Promise<number> {
    const res = await Database.query(
      `UPDATE parcels
       SET assigned_surveyor_id = $1,
           assigned_at = NOW(),
           assignment_notes = COALESCE($2, assignment_notes),
           updated_at = NOW()
       WHERE id = ANY($3::uuid[])
         AND lifecycle_status::text <> ALL($4::text[]);`,
      [surveyorId, notes || null, parcelIds, [...EXCLUDED_LIFECYCLE_STATUSES]]
    );
    return res.rowCount || 0;
  }

  /**
   * Hoán đổi vị trí ranh ô CAD (CAD Spatial Geometry Swap) giữa 2 căn hộ hoặc khu vực master:
   * - Bảo toàn 100% hồ sơ, mã căn (unit_code), biển số (display_code), loại (unit_type),
   *   chủ hộ, báo cáo khảo sát (phase1_report_id, phase2_report_id), ảnh hiện trạng, watermark.
   * - Tráo đổi hình học CAD: cad_bbox, cad_polygon, unit_cad_url (và floor_plan_id, floor_number nếu cross-floor).
   * - Đồng bộ lại trường tọa độ trong survey_data_json của base_survey_reports nếu có báo cáo.
   * - Ghi vết kiểm toán hệ thống vào system_audit_logs.
   */
  static async swapUnitCadGeometries(
    parcelId: string,
    unitAId: string,
    unitBId: string,
    adminId: string,
    reason: string,
    clientIp?: string
  ): Promise<{
    message: string;
    unitA: BuildingUnitEntity;
    unitB: BuildingUnitEntity;
    swapEventCode: string;
  }> {
    return Database.transaction(async (client) => {
      // 1. Khóa và lấy thông tin 2 đơn vị
      const uRes = await client.query<BuildingUnitEntity>(
        `SELECT * FROM building_units
         WHERE id IN ($1::uuid, $2::uuid) AND parcel_id = $3::uuid AND deleted_at IS NULL
         FOR UPDATE;`,
        [unitAId, unitBId, parcelId]
      );

      if (uRes.rows.length < 2) {
        throw new NotFoundError(
          `Không tìm thấy đủ 2 vị trí hợp lệ trong tòa nhà để hoán đổi (Tìm thấy ${uRes.rows.length}/2).`
        );
      }

      const unitA = uRes.rows.find((u) => u.id === unitAId);
      const unitB = uRes.rows.find((u) => u.id === unitBId);

      if (!unitA || !unitB) {
        throw new BadRequestError('Không thể phân định 2 vị trí riêng biệt để hoán đổi');
      }

      if (unitA.id === unitB.id) {
        throw new BadRequestError('Không thể hoán đổi vị trí với chính nó');
      }

      // 1.1. Chặn hoán đổi chéo phân loại (UNIT <-> MASTER)
      const typeA = unitA.unit_type || 'UNIT';
      const typeB = unitB.unit_type || 'UNIT';
      if (typeA !== typeB) {
        throw new BadRequestError(
          `Không thể hoán đổi chéo giữa Căn hộ (${unitA.unit_code} - ${typeA}) và Mặt bằng/Khu vực chung (${unitB.unit_code} - ${typeB}). Chỉ cho phép hoán đổi cùng phân loại (UNIT <-> UNIT hoặc MASTER <-> MASTER).`
        );
      }

      // 1.2. Khóa và truy vấn toàn bộ hồ sơ khảo sát (bao gồm cả DRAFT và SUBMITTED) của 2 vị trí
      interface UnitReportRow {
        id: string;
        unit_id: string | null;
        status: string;
        survey_data_json: Record<string, unknown> | string | null;
        sync_version: number | null;
      }

      const reportsARes = await client.query<UnitReportRow>(
        `SELECT id, unit_id, status, survey_data_json, sync_version
         FROM base_survey_reports
         WHERE (unit_id = $1::uuid OR ($2::uuid IS NOT NULL AND id = $2::uuid))
           AND deleted_at IS NULL
         FOR UPDATE;`,
        [unitA.id, unitA.phase1_report_id || null]
      );

      const reportsBRes = await client.query<UnitReportRow>(
        `SELECT id, unit_id, status, survey_data_json, sync_version
         FROM base_survey_reports
         WHERE (unit_id = $1::uuid OR ($2::uuid IS NOT NULL AND id = $2::uuid))
           AND deleted_at IS NULL
         FOR UPDATE;`,
        [unitB.id, unitB.phase1_report_id || null]
      );

      // 1.3. Chốt chặn bất biến pháp lý: Không cho phép hoán đổi nếu tòa nhà mẹ hoặc một trong 2 vị trí đã APPROVED
      const parcelStatusRes = await client.query<{ survey_status: string; project_parcel_code: string }>(
        `SELECT survey_status, project_parcel_code FROM parcels WHERE id = $1::uuid FOR UPDATE;`,
        [parcelId]
      );
      if (
        parcelStatusRes.rows[0] &&
        ['APPROVED', 'APPROVED_PHASE2'].includes(parcelStatusRes.rows[0].survey_status)
      ) {
        throw new ForbiddenError(
          `Không thể hoán đổi vị trí: Tòa nhà [${parcelStatusRes.rows[0].project_parcel_code}] đã được phê duyệt chính thức (${parcelStatusRes.rows[0].survey_status}) và bị khóa bất biến.`
        );
      }

      const isApprovedOrLockedA =
        unitA.status === 'APPROVED' ||
        unitA.status === 'APPROVED_PHASE2' ||
        reportsARes.rows.some((r) => r.status === 'APPROVED' || r.status === 'APPROVED_PHASE2');
      if (isApprovedOrLockedA) {
        throw new ForbiddenError(
          `Không thể hoán đổi vị trí: Đơn vị [${unitA.unit_code}] đã được phê duyệt chính thức (APPROVED) hoặc đã bị khóa pháp lý bất biến.`
        );
      }

      const isApprovedOrLockedB =
        unitB.status === 'APPROVED' ||
        unitB.status === 'APPROVED_PHASE2' ||
        reportsBRes.rows.some((r) => r.status === 'APPROVED' || r.status === 'APPROVED_PHASE2');
      if (isApprovedOrLockedB) {
        throw new ForbiddenError(
          `Không thể hoán đổi vị trí: Đơn vị [${unitB.unit_code}] đã được phê duyệt chính thức (APPROVED) hoặc đã bị khóa pháp lý bất biến.`
        );
      }

      // 1.4. Xác định trạng thái dữ liệu của từng vị trí (1 căn đã có data <-> 1 căn chưa có data, 2 căn có data, hoặc 2 căn chưa có data)
      const hasDataA =
        Boolean(unitA.phase1_report_id) ||
        Boolean(unitA.status && unitA.status !== 'NOT_SURVEYED') ||
        reportsARes.rows.length > 0;

      const hasDataB =
        Boolean(unitB.phase1_report_id) ||
        Boolean(unitB.status && unitB.status !== 'NOT_SURVEYED') ||
        reportsBRes.rows.length > 0;

      const extractCadUrlFromReport = (rep?: UnitReportRow): string | null => {
        if (!rep || !rep.survey_data_json) return null;
        const parsed =
          typeof rep.survey_data_json === 'string'
            ? (JSON.parse(rep.survey_data_json) as Record<string, unknown>)
            : rep.survey_data_json;
        const directUrl =
          (typeof parsed.unitCadUrl === 'string' && parsed.unitCadUrl.trim() !== '' ? parsed.unitCadUrl : null) ||
          (typeof parsed.cadSketchPhotoUrl === 'string' && parsed.cadSketchPhotoUrl.trim() !== '' ? parsed.cadSketchPhotoUrl : null);
        if (directUrl) return directUrl;
        if (parsed.floorSurvey && typeof parsed.floorSurvey === 'object') {
          const fs = parsed.floorSurvey as Record<string, unknown>;
          if (typeof fs.cadSketchPhotoUrl === 'string' && fs.cadSketchPhotoUrl.trim() !== '') {
            return fs.cadSketchPhotoUrl;
          }
          if (typeof fs.cadDrawingUrl === 'string' && fs.cadDrawingUrl.trim() !== '') {
            return fs.cadDrawingUrl;
          }
        }
        return null;
      };

      const preservedCadUrlA = unitA.unit_cad_url || extractCadUrlFromReport(reportsARes.rows[0]) || null;
      const preservedCadUrlB = unitB.unit_cad_url || extractCadUrlFromReport(reportsBRes.rows[0]) || null;

      // Lưu trữ snapshot cũ để ghi audit log và cập nhật
      const oldGeomA = {
        cad_bbox: unitA.cad_bbox,
        cad_polygon: unitA.cad_polygon,
        unit_cad_url: unitA.unit_cad_url,
        floor_plan_id: unitA.floor_plan_id,
        floor_number: unitA.floor_number,
      };

      const oldGeomB = {
        cad_bbox: unitB.cad_bbox,
        cad_polygon: unitB.cad_polygon,
        unit_cad_url: unitB.unit_cad_url,
        floor_plan_id: unitB.floor_plan_id,
        floor_number: unitB.floor_number,
      };

      // Quy tắc bảo toàn CAD theo giống cơ chế hoán đổi Nhà dân:
      // - Chỉ đổi vị trí khung định vị trên bản đồ mặt bằng tầng (cad_bbox, cad_polygon, floor_plan_id, floor_number).
      // - Nếu đơn vị ĐÃ CÓ DỮ LIỆU KHẢO SÁT (hasData = true): Giữ nguyên 100% ảnh CAD nội bộ của chính đơn vị đó (preservedCadUrl) để bảo vệ các điểm ghim Z-01/E-01, tuyệt đối không lấy unit_cad_url của đơn vị kia đè vào.
      // - Nếu đơn vị CHƯA CÓ DỮ LIỆU KHẢO SÁT (hasData = false): Đặt unit_cad_url = NULL để khi KSV vào khảo sát lần đầu sẽ tự động cắt CAD chuẩn theo khung vị trí mới.
      const nextUnitCadUrlA = hasDataA ? preservedCadUrlA : null;
      const nextUnitCadUrlB = hasDataB ? preservedCadUrlB : null;

      // 2. Cập nhật hoán đổi tọa độ khung trên mặt bằng tầng cho Unit A (nhận vị trí ô của B trên map tầng)
      const updateARes = await client.query<BuildingUnitEntity>(
        `UPDATE building_units
         SET cad_bbox = $1,
             cad_polygon = $2,
             unit_cad_url = $3,
             floor_plan_id = $4,
             floor_number = $5,
             updated_at = NOW()
         WHERE id = $6
         RETURNING *;`,
        [
          oldGeomB.cad_bbox ? JSON.stringify(oldGeomB.cad_bbox) : null,
          oldGeomB.cad_polygon ? JSON.stringify(oldGeomB.cad_polygon) : null,
          nextUnitCadUrlA,
          oldGeomB.floor_plan_id,
          oldGeomB.floor_number,
          unitA.id,
        ]
      );

      // 3. Cập nhật hoán đổi tọa độ khung trên mặt bằng tầng cho Unit B (nhận vị trí ô của A trên map tầng)
      const updateBRes = await client.query<BuildingUnitEntity>(
        `UPDATE building_units
         SET cad_bbox = $1,
             cad_polygon = $2,
             unit_cad_url = $3,
             floor_plan_id = $4,
             floor_number = $5,
             updated_at = NOW()
         WHERE id = $6
         RETURNING *;`,
        [
          oldGeomA.cad_bbox ? JSON.stringify(oldGeomA.cad_bbox) : null,
          oldGeomA.cad_polygon ? JSON.stringify(oldGeomA.cad_polygon) : null,
          nextUnitCadUrlB,
          oldGeomA.floor_plan_id,
          oldGeomA.floor_number,
          unitB.id,
        ]
      );

      // 4. Đồng bộ lại dữ liệu khung vị trí trên mặt bằng tầng và khóa cứng CAD (isCadLocked = true) trong base_survey_reports & floor_surveys
      const syncUnitReportsAndLockCad = async (
        unit: BuildingUnitEntity,
        reports: UnitReportRow[],
        newGeom: {
          cad_bbox: CadBBox | null | undefined;
          cad_polygon: CadPolygonPoint[] | null | undefined;
          floor_plan_id: string | null | undefined;
          floor_number: number;
        },
        preservedCadUrl: string | null
      ) => {
        const isMaster = (unit.unit_type || 'UNIT') === 'MASTER';
        for (const rep of reports) {
          const rawJson: Record<string, unknown> =
            typeof rep.survey_data_json === 'string'
              ? (JSON.parse(rep.survey_data_json) as Record<string, unknown>)
              : { ...(rep.survey_data_json || {}) };

          const existingUnitCadUrl =
            (typeof rawJson.unitCadUrl === 'string' && rawJson.unitCadUrl.trim() !== ''
              ? rawJson.unitCadUrl
              : null) || preservedCadUrl;

          const existingCadSketchUrl =
            (typeof rawJson.cadSketchPhotoUrl === 'string' && rawJson.cadSketchPhotoUrl.trim() !== ''
              ? rawJson.cadSketchPhotoUrl
              : null) || preservedCadUrl;

          const updatedJson: Record<string, unknown> = {
            ...rawJson,
            cadBbox: newGeom.cad_bbox || null,
            cadPolygon: newGeom.cad_polygon || null,
            floorNumber: newGeom.floor_number,
            isCadLocked: true,
            isCadOverriddenByUser: true,
          };

          if (!isMaster && existingUnitCadUrl) {
            updatedJson.unitCadUrl = existingUnitCadUrl;
          }
          if (isMaster && existingCadSketchUrl) {
            updatedJson.cadSketchPhotoUrl = existingCadSketchUrl;
          }

          if (updatedJson.floorSurvey && typeof updatedJson.floorSurvey === 'object') {
            const fs = { ...(updatedJson.floorSurvey as Record<string, unknown>) };
            fs.floorOrder = newGeom.floor_number;
            fs.isCadLocked = true;
            if (existingCadSketchUrl && (!fs.cadSketchPhotoUrl || fs.cadSketchPhotoUrl === '')) {
              fs.cadSketchPhotoUrl = existingCadSketchUrl;
            }
            updatedJson.floorSurvey = fs;
          }

          if (Array.isArray(updatedJson.floors) && updatedJson.floors.length > 0) {
            updatedJson.floors = updatedJson.floors.map((fl: unknown, idx: number) => {
              if (idx === 0 && fl && typeof fl === 'object') {
                const flObj = { ...(fl as Record<string, unknown>) };
                flObj.floorOrder = newGeom.floor_number;
                flObj.isCadLocked = true;
                return flObj;
              }
              return fl;
            });
          }

          await client.query(
            `UPDATE base_survey_reports
             SET survey_data_json = $1::jsonb,
                 sync_version = COALESCE(sync_version, 1) + 1,
                 updated_at = NOW()
             WHERE id = $2::uuid;`,
            [JSON.stringify(updatedJson), rep.id]
          );

          await client.query(
            `UPDATE floor_surveys
             SET floor_order = $1,
                 floor_name = CASE
                   WHEN $3 = 'MASTER' THEN floor_name
                   ELSE $2
                 END
             WHERE report_id = $4::uuid;`,
            [
              newGeom.floor_number,
              `Căn hộ ${unit.display_code || unit.unit_code} (Tầng ${newGeom.floor_number})`,
              unit.unit_type || 'UNIT',
              rep.id,
            ]
          );

          // 4.1. Ghi bản chụp lịch sử phiên bản (survey_report_versions) để Audit Studio truy vết (EC-04)
          const maxVerRes = await client.query<{ max_ver: number | null }>(
            `SELECT MAX(version_number) AS max_ver FROM survey_report_versions WHERE report_id = $1::uuid;`,
            [rep.id]
          );
          const nextVer =
            maxVerRes.rows[0]?.max_ver !== null && maxVerRes.rows[0]?.max_ver !== undefined
              ? Number(maxVerRes.rows[0].max_ver) + 1
              : 1;

          await client.query(
            `INSERT INTO survey_report_versions (
               report_id, version_number, version_tag, title, edit_reason,
               snapshot_data, diff_summary, created_by_user_id, client_ip
             ) VALUES (
               $1::uuid, $2, 'UNIT_CAD_SPATIAL_SWAP', $3, $4,
               $5::jsonb, $6::jsonb,
               (SELECT id FROM users WHERE id = $7::uuid LIMIT 1),
               $8
             );`,
            [
              rep.id,
              nextVer,
              `Hoán đổi vị trí ô CAD mặt bằng (${unit.unit_code})`,
              reason,
              JSON.stringify(updatedJson),
              JSON.stringify([
                {
                  field: 'cadBbox',
                  oldValue: unit.cad_bbox || null,
                  newValue: newGeom.cad_bbox || null,
                },
                {
                  field: 'floorNumber',
                  oldValue: unit.floor_number,
                  newValue: newGeom.floor_number,
                },
                {
                  field: 'isCadLocked',
                  oldValue: Boolean(rawJson.isCadLocked),
                  newValue: true,
                },
              ]),
              adminId,
              clientIp || null,
            ]
          );
        }
      };

      if (hasDataA && reportsARes.rows.length > 0) {
        await syncUnitReportsAndLockCad(unitA, reportsARes.rows, oldGeomB, preservedCadUrlA);
      }

      if (hasDataB && reportsBRes.rows.length > 0) {
        await syncUnitReportsAndLockCad(unitB, reportsBRes.rows, oldGeomA, preservedCadUrlB);
      }

      // 5. Ghi log kiểm toán pháp lý hệ thống (system_audit_logs)
      const swapEventCode = `SWAP-UNIT-CAD-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
      await client.query(
        `INSERT INTO system_audit_logs (
           entity_type, entity_id, action, performed_by_user_id, diff_payload, client_ip
         ) VALUES ($1, $2, $3, $4, $5, $6);`,
        [
          'BUILDING_UNIT',
          unitA.id,
          'UNIT_CAD_SPATIAL_SWAP',
          adminId,
          JSON.stringify({
            swapEventCode,
            parcelId,
            unitA: {
              id: unitA.id,
              unitCode: unitA.unit_code,
              displayCode: unitA.display_code,
              unitType: typeA,
              status: unitA.status,
              hasSurveyData: hasDataA,
              isCadLocked: hasDataA,
              oldFloor: oldGeomA.floor_number,
              newFloor: oldGeomB.floor_number,
              oldBbox: oldGeomA.cad_bbox,
              newBbox: oldGeomB.cad_bbox,
              preservedUnitCadUrl: nextUnitCadUrlA,
            },
            unitB: {
              id: unitB.id,
              unitCode: unitB.unit_code,
              displayCode: unitB.display_code,
              unitType: typeB,
              status: unitB.status,
              hasSurveyData: hasDataB,
              isCadLocked: hasDataB,
              oldFloor: oldGeomB.floor_number,
              newFloor: oldGeomA.floor_number,
              oldBbox: oldGeomB.cad_bbox,
              newBbox: oldGeomA.cad_bbox,
              preservedUnitCadUrl: nextUnitCadUrlB,
            },
            reason,
            timestamp: new Date().toISOString(),
          }),
          clientIp || null,
        ]
      );

      return {
        message: `Đã hoán đổi thành công vị trí trên mặt bằng tầng giữa ${unitA.unit_code} và ${unitB.unit_code}. Toàn bộ mã định danh, hồ sơ khảo sát, bản vẽ CAD nội bộ và các điểm ghim đã được khóa cứng & bảo toàn 100%.`,
        unitA: updateARes.rows[0],
        unitB: updateBRes.rows[0],
        swapEventCode,
      };
    });
  }
}

