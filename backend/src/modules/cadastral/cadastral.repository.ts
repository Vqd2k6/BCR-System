import { Database } from '../../database/db';
import { PoolClient } from 'pg';

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
  lifecycle_status: 'ACTIVE' | 'PENDING_MUTATION_APPROVAL' | 'SPLIT_DEPRECATED' | 'MERGED_DEPRECATED' | 'MUTATION_VOID';
  building_type?: string;
  total_units?: number;
  mutation_type: string;
  parent_parcel_ids: string[];
  child_parcel_ids: string[];
  absence_attempt_count: number;
  assigned_surveyor_id?: string | null;
  assigned_surveyor_name?: string | null;
  assigned_surveyor_code?: string | null;
  assigned_surveyor_phone?: string | null;
  location_geojson?: any;
  cadastral_geojson?: any;
  footprint_geojson?: any;
  created_at: Date;
  updated_at: Date;
}

export interface BuildingUnitEntity {
  id: string;
  parcel_id: string;
  unit_code: string;
  floor_number: number;
  owner_name: string | null;
  owner_phone: string | null;
  owner_id_card: string | null;
  status: string;
  phase1_report_id: string | null;
  phase2_report_id: string | null;
  created_at: Date;
  updated_at: Date;
}


export class CadastralRepository {
  static async findById(id: string): Promise<ParcelEntity | null> {
    const res = await Database.query<ParcelEntity>(
      `SELECT p.*,
              ST_AsGeoJSON(p.location_geom)::json AS location_geojson,
              ST_AsGeoJSON(p.cadastral_polygon_geom)::json AS cadastral_geojson,
              ST_AsGeoJSON(p.footprint_polygon_geom)::json AS footprint_geojson
       FROM parcels p
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

  static async listParcelsByZone(zoneId: string, status?: string): Promise<ParcelEntity[]> {
    // Map between ZONE_S1..S11 and ZONE_01..ZONE_22
    const target = (zoneId || 'ALL').toUpperCase();
    const isAll = target === 'ALL';

    const zoneAliases: Record<string, string[]> = {
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

    const targetList = zoneAliases[target] || [target];

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
              GREATEST(p.total_units, (SELECT COUNT(*)::int FROM building_units u WHERE u.parcel_id = p.id)) AS total_units,
              (SELECT COUNT(*)::int FROM building_units u WHERE u.parcel_id = p.id AND u.status IN ('APPROVED', 'SUBMITTED')) AS completed_units_count,
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
              ST_Distance(
                p.location_geom::geography,
                ST_SetSRID(ST_MakePoint($2, $1), 4326)::geography
              ) AS distance_meters,
              ST_AsGeoJSON(p.location_geom)::json AS location_geojson,
              ST_AsGeoJSON(p.cadastral_polygon_geom)::json AS cadastral_geojson
       FROM parcels p
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
    absenceReason: string;
    notes?: string | null;
    photoProofUrl?: string | null;
    rescheduleDate?: string | null;
    ownerName?: string | null;
    ownerPhone?: string | null;
    surveyData?: any;
  }): Promise<void> {
    await Database.transaction(async (client) => {
      // 1. Tăng số lần vắng mặt, chuyển trạng thái sang POSTPONED_ABSENT và lưu thông tin chủ hộ/SĐT nếu có
      await client.query(
        `UPDATE parcels
         SET survey_status = 'POSTPONED_ABSENT',
             absence_attempt_count = absence_attempt_count + 1,
             owner_name = COALESCE($2, owner_name),
             owner_phone = COALESCE($3, owner_phone),
             updated_at = NOW()
         WHERE id = $1;`,
        [data.parcelId, data.ownerName || null, data.ownerPhone || null]
      );

      // 2. Lấy bộ đếm hiện tại
      const countRes = await client.query<{ absence_attempt_count: number }>(
        `SELECT absence_attempt_count FROM parcels WHERE id = $1;`,
        [data.parcelId]
      );
      const attemptCount = countRes.rows[0]?.absence_attempt_count || 1;

      // 3. Ghi log vắng nhà (Bảo lưu lịch sử vĩnh viễn, không bao giờ bị xóa)
      await client.query(
        `INSERT INTO survey_absence_logs (
           parcel_id, surveyor_id, absence_reason, notes, photo_proof_url,
           reschedule_date, attempt_count
         ) VALUES ($1, $2, $3, $4, $5, $6, $7);`,
        [
          data.parcelId,
          data.surveyorId,
          data.absenceReason,
          data.notes || null,
          data.photoProofUrl || null,
          data.rescheduleDate || null,
          attemptCount,
        ]
      );

      // 4. Nếu có dữ liệu ngoại thất Bước 1, lưu bảo toàn vào base_survey_reports
      if (data.surveyData) {
        const repRes = await client.query<{ id: string }>(
          `SELECT id FROM base_survey_reports WHERE parcel_id = $1 ORDER BY created_at DESC LIMIT 1;`,
          [data.parcelId]
        );
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
          const newRep = await client.query<{ id: string }>(
            `INSERT INTO base_survey_reports (
               parcel_id, surveyor_id, report_code, phase, status, is_refused_or_absent, survey_data_json
             ) VALUES ($1, $2, $3, 'PHASE_1', 'DRAFT', TRUE, $4)
             RETURNING id;`,
            [data.parcelId, data.surveyorId, reportCode, JSON.stringify(data.surveyData)]
          );
          repId = newRep.rows[0].id;
          await client.query(
            `INSERT INTO phase1_report_details (report_id, is_historical_baseline) VALUES ($1, TRUE);`,
            [repId]
          );
        }
        await client.query(
          `UPDATE parcels SET active_phase1_report_id = $2 WHERE id = $1;`,
          [data.parcelId, repId]
        );
      }
    });
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
   * Cấp mã tiếp theo cho thửa đất phát sinh (Phương án 1: Nối tiếp Max của chính Zone đó)
   */
  static async getNextHighRangeProjectCode(
    client: PoolClient,
    zoneId?: string,
    parentCode?: string
  ): Promise<string> {
    let query = `
      SELECT project_parcel_code
      FROM parcels
    `;
    const params: any[] = [];
    if (zoneId) {
      query += ` WHERE zone_id = $1 `;
      params.push(zoneId);
    }
    query += `
      ORDER BY substring(project_parcel_code from '[0-9]+$')::integer DESC
      LIMIT 1
      FOR UPDATE;
    `;

    const res = await client.query<{ project_parcel_code: string }>(query, params);

    let prefix = 'B-';
    let padLen = 4;
    let nextNum = 1;

    if (res.rows.length > 0 && res.rows[0].project_parcel_code) {
      const maxCode = res.rows[0].project_parcel_code;
      const match = maxCode.match(/^(.*?)(\d+)$/);
      if (match) {
        prefix = match[1];
        padLen = Math.max(match[2].length, 4);
        nextNum = parseInt(match[2], 10) + 1;
      }
    } else if (parentCode) {
      const match = parentCode.match(/^(.*?)(\d+)$/);
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
      `SELECT u.* FROM building_units u
       WHERE u.parcel_id = $1
       ORDER BY u.floor_number ASC, u.unit_code ASC;`,
      [parcelId]
    );
    return res.rows;
  }

  static async findUnitById(unitId: string): Promise<BuildingUnitEntity | null> {
    const res = await Database.query<BuildingUnitEntity>(
      `SELECT u.* FROM building_units u WHERE u.id = $1 LIMIT 1;`,
      [unitId]
    );
    return res.rows[0] || null;
  }

  static async createBuildingUnit(data: {
    parcelId: string;
    unitCode: string;
    floorNumber: number;
    ownerName?: string;
    ownerPhone?: string;
    ownerIdCard?: string;
  }): Promise<BuildingUnitEntity> {
    const res = await Database.query<BuildingUnitEntity>(
      `INSERT INTO building_units (parcel_id, unit_code, floor_number, owner_name, owner_phone, owner_id_card)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *;`,
      [
        data.parcelId,
        data.unitCode,
        data.floorNumber,
        data.ownerName || null,
        data.ownerPhone || null,
        data.ownerIdCard || null,
      ]
    );
    // Cập nhật total_units và building_type trong parcels
    await Database.query(
      `UPDATE parcels 
       SET total_units = (SELECT COUNT(*) FROM building_units WHERE parcel_id = $1),
           building_type = 'CONDOMINIUM',
           updated_at = NOW()
       WHERE id = $1;`,
      [data.parcelId]
    );
    return res.rows[0];
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

    const res = await Database.query<ParcelEntity>(
      `SELECT p.*,
              ST_AsGeoJSON(p.location_geom)::json AS location_geojson,
              ST_AsGeoJSON(p.cadastral_polygon_geom)::json AS cadastral_geojson,
              ST_AsGeoJSON(p.footprint_polygon_geom)::json AS footprint_geojson,
              ${distanceSelect}
       FROM parcels p
       WHERE p.assigned_surveyor_id = $1
         AND p.lifecycle_status = 'ACTIVE'
         AND p.survey_status IN ('NOT_SURVEYED', 'IN_PROGRESS', 'POSTPONED_ABSENT')
       ORDER BY ${orderBy};`,
      params
    );
    return res.rows;
  }

  static async assignSurveyorToParcels(parcelIds: string[], surveyorId: string, notes?: string): Promise<number> {
    const res = await Database.query(
      `UPDATE parcels
       SET assigned_surveyor_id = $1,
           assigned_at = NOW(),
           assignment_notes = COALESCE($2, assignment_notes),
           updated_at = NOW()
       WHERE id = ANY($3::uuid[]);`,
      [surveyorId, notes || null, parcelIds]
    );
    return res.rowCount || 0;
  }
}

