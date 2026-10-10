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
  floor_plan_id?: string | null;
  cad_bbox?: { x: number; y: number; width: number; height: number } | null;
  cad_polygon?: { x: number; y: number }[] | null;
  unit_cad_url?: string | null;
  resident_status?: string | null;
  unit_type?: 'UNIT' | 'MASTER' | null;
  created_at: Date;
  updated_at: Date;
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
    unitId?: string | null;
    absenceReason: string;
    notes?: string | null;
    photoProofUrl?: string | null;
    rescheduleDate?: string | null;
    ownerName?: string | null;
    ownerPhone?: string | null;
    surveyData?: unknown;
  }): Promise<void> {
    await Database.transaction(async (client) => {
      if (data.unitId) {
        // Cập nhật trạng thái cho căn hộ con / ô khu vực master
        await client.query(
          `UPDATE building_units
           SET status = 'POSTPONED_ABSENT',
               owner_name = COALESCE($2, owner_name),
               owner_phone = COALESCE($3, owner_phone),
               updated_at = NOW()
           WHERE id = $1;`,
          [data.unitId, data.ownerName || null, data.ownerPhone || null]
        );
      } else {
        // 1. Tăng số lần vắng mặt của thửa đất/tòa nhà, chuyển trạng thái sang POSTPONED_ABSENT
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
      }

      // 2. Lấy bộ đếm hiện tại
      const countRes = await client.query<{ absence_attempt_count: number }>(
        `SELECT absence_attempt_count FROM parcels WHERE id = $1;`,
        [data.parcelId]
      );
      const attemptCount = countRes.rows[0]?.absence_attempt_count || 1;

      // 3. Ghi log vắng nhà (kèm unit_id nếu có)
      await client.query(
        `INSERT INTO survey_absence_logs (
           parcel_id, surveyor_id, absence_reason, notes, photo_proof_url,
           reschedule_date, attempt_count, unit_id
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8);`,
        [
          data.parcelId,
          data.surveyorId,
          data.absenceReason,
          data.notes || null,
          data.photoProofUrl || null,
          data.rescheduleDate || null,
          attemptCount,
          data.unitId || null,
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
    unitType?: 'UNIT' | 'MASTER';
  }): Promise<BuildingUnitEntity> {
    const res = await Database.query<BuildingUnitEntity>(
      `INSERT INTO building_units (parcel_id, unit_code, floor_number, owner_name, owner_phone, owner_id_card, unit_type)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
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
       WHERE u.parcel_id = $1;`,
      [parcelId]
    );
    return parseInt(res.rows[0]?.count || '0', 10);
  }

  static async findFloorPlansByParcelId(parcelId: string): Promise<BuildingFloorPlanEntity[]> {
    const res = await Database.query<BuildingFloorPlanEntity>(
      `SELECT * FROM building_floor_plans WHERE parcel_id = $1 ORDER BY floor_number ASC;`,
      [parcelId]
    );
    return res.rows;
  }

  static async findFloorPlanByFloor(parcelId: string, floorNumber: number): Promise<BuildingFloorPlanEntity | null> {
    const res = await Database.query<BuildingFloorPlanEntity>(
      `SELECT * FROM building_floor_plans 
       WHERE parcel_id = $1 AND (floor_number = $2 OR $2 = ANY(applicable_floors))
       ORDER BY (floor_number = $2) DESC, floor_number ASC
       LIMIT 1;`,
      [parcelId, floorNumber]
    );
    return res.rows[0] || null;
  }

  static async upsertFloorPlan(data: {
    parcelId: string;
    floorNumber: number;
    floorName: string;
    floorCode?: string;
    applicableFloors?: number[];
    cadPhotoUrl: string;
    cadPhotoCode?: string;
    imageWidth?: number;
    imageHeight?: number;
    scope?: 'MASTER' | 'UNIT' | 'BOTH';
    areaType?: string;
  }): Promise<BuildingFloorPlanEntity> {
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

    const res = await Database.query<BuildingFloorPlanEntity>(
      `INSERT INTO building_floor_plans (
        parcel_id, floor_number, floor_name, floor_code, applicable_floors, cad_photo_url, cad_photo_code, image_width, image_height, scope, area_type, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW())
      ON CONFLICT (parcel_id, floor_number) DO UPDATE SET
        floor_name = EXCLUDED.floor_name,
        floor_code = COALESCE(EXCLUDED.floor_code, building_floor_plans.floor_code),
        applicable_floors = EXCLUDED.applicable_floors,
        cad_photo_url = EXCLUDED.cad_photo_url,
        cad_photo_code = EXCLUDED.cad_photo_code,
        image_width = EXCLUDED.image_width,
        image_height = EXCLUDED.image_height,
        scope = COALESCE(EXCLUDED.scope, building_floor_plans.scope),
        area_type = COALESCE(EXCLUDED.area_type, building_floor_plans.area_type),
        updated_at = NOW()
      RETURNING *;`,
      [
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
      ]
    );
    return res.rows[0];
  }

  static async saveUnitPartitions(
    parcelId: string,
    floorNumber: number,
    floorPlanId: string | null,
    partitions: { unitCode: string; floorNumber?: number; bbox?: any; polygon?: any; unitCadUrl?: string; unitType?: 'UNIT' | 'MASTER' }[]
  ): Promise<BuildingUnitEntity[]> {
    const savedUnits: BuildingUnitEntity[] = [];

    for (const part of partitions) {
      const uFloor = part.floorNumber !== undefined ? part.floorNumber : floorNumber;
      const uType = part.unitType || 'UNIT';
      const res = await Database.query<BuildingUnitEntity>(
        `INSERT INTO building_units (
          parcel_id, unit_code, floor_number, floor_plan_id, cad_bbox, cad_polygon, unit_cad_url, unit_type, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
        ON CONFLICT (parcel_id, unit_code) DO UPDATE SET
          floor_number = EXCLUDED.floor_number,
          floor_plan_id = COALESCE(EXCLUDED.floor_plan_id, building_units.floor_plan_id),
          cad_bbox = COALESCE(EXCLUDED.cad_bbox, building_units.cad_bbox),
          cad_polygon = COALESCE(EXCLUDED.cad_polygon, building_units.cad_polygon),
          unit_cad_url = COALESCE(EXCLUDED.unit_cad_url, building_units.unit_cad_url),
          unit_type = COALESCE(EXCLUDED.unit_type, building_units.unit_type, 'UNIT'),
          updated_at = NOW()
        RETURNING *;`,
        [
          parcelId,
          part.unitCode,
          uFloor,
          floorPlanId,
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

    // Tự động tính toán và cập nhật scope của floor plan nếu có floorPlanId
    if (floorPlanId && partitions.length > 0) {
      const hasUnit = partitions.some(p => (p.unitType || 'UNIT') === 'UNIT');
      const hasMaster = partitions.some(p => p.unitType === 'MASTER');
      const scope: 'UNIT' | 'MASTER' | 'BOTH' = (hasUnit && hasMaster) ? 'BOTH' : (hasMaster ? 'MASTER' : 'UNIT');
      await Database.query(
        `UPDATE building_floor_plans SET scope = $2, updated_at = NOW() WHERE id = $1;`,
        [floorPlanId, scope]
      );
    }

    // Cập nhật total_units và building_type = 'CONDOMINIUM'
    await Database.query(
      `UPDATE parcels 
       SET total_units = (SELECT COUNT(*) FROM building_units WHERE parcel_id = $1),
           building_type = 'CONDOMINIUM',
           deleted_floors = array_remove(COALESCE(deleted_floors, '{}'), $2::int),
           updated_at = NOW()
       WHERE id = $1;`,
      [parcelId, floorNumber]
    );

    return savedUnits;
  }

  static async getSurveyedUnitsOnFloor(
    parcelId: string, 
    floorNumber: number
  ): Promise<{ unit_code: string; status: string }[]> {
    const res = await Database.query<{ unit_code: string; status: string }>(
      `SELECT unit_code, status 
       FROM building_units 
       WHERE parcel_id = $1 AND floor_number = $2 
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
    // 1. Xóa các unit nháp của tầng này chưa khảo sát
    await Database.query(
      `DELETE FROM building_units 
       WHERE parcel_id = $1 AND floor_number = $2 AND phase1_report_id IS NULL AND (status = 'NOT_SURVEYED' OR status IS NULL);`,
      [parcelId, floorNumber]
    );

    // 2. Gỡ liên kết CAD đối với các unit đã có báo cáo khảo sát
    await Database.query(
      `UPDATE building_units 
       SET floor_plan_id = NULL, cad_bbox = NULL, cad_polygon = NULL, unit_cad_url = NULL 
       WHERE parcel_id = $1 AND floor_number = $2;`,
      [parcelId, floorNumber]
    );

    // 3. Xóa bản ghi bản vẽ tầng trong building_floor_plans nếu có
    await Database.query(
      `DELETE FROM building_floor_plans WHERE parcel_id = $1 AND floor_number = $2;`,
      [parcelId, floorNumber]
    );

    // 4. Gỡ số tầng khỏi danh sách áp dụng (applicable_floors) của bất kỳ bản vẽ tầng nào khác
    await Database.query(
      `UPDATE building_floor_plans 
       SET applicable_floors = array_remove(applicable_floors, $2::int),
           updated_at = NOW()
       WHERE parcel_id = $1 AND $2::int = ANY(applicable_floors);`,
      [parcelId, floorNumber]
    );

    // 5. Nếu là DELETE_FLOOR (và đã qua bước chặn surveyedCount === 0), đưa tầng vào parcels.deleted_floors
    if (mode === 'DELETE_FLOOR') {
      await Database.query(
        `UPDATE parcels 
         SET deleted_floors = array_append(COALESCE(deleted_floors, '{}'), $2::int),
             total_units = (SELECT COUNT(*) FROM building_units WHERE parcel_id = $1),
             updated_at = NOW()
         WHERE id = $1 AND NOT ($2::int = ANY(COALESCE(deleted_floors, '{}')));`,
        [parcelId, floorNumber]
      );
    } else {
      await Database.query(
        `UPDATE parcels 
         SET total_units = (SELECT COUNT(*) FROM building_units WHERE parcel_id = $1),
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
       WHERE id = ANY($3::uuid[]);`,
      [surveyorId, notes || null, parcelIds]
    );
    return res.rowCount || 0;
  }
}

