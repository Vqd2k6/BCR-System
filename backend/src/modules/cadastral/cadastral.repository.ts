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
    const zoneMapping: Record<string, string> = {
      'ZONE_S1': 'ZONE_01', 'ZONE_S2': 'ZONE_03', 'ZONE_S3': 'ZONE_05',
      'ZONE_S4': 'ZONE_07', 'ZONE_S5': 'ZONE_09', 'ZONE_S6': 'ZONE_11',
      'ZONE_S7': 'ZONE_13', 'ZONE_S8': 'ZONE_15', 'ZONE_S9': 'ZONE_17',
      'ZONE_S10': 'ZONE_19', 'ZONE_S11': 'ZONE_21',
      'ZONE_01': 'ZONE_S1', 'ZONE_03': 'ZONE_S2', 'ZONE_05': 'ZONE_S3',
      'ZONE_07': 'ZONE_S4', 'ZONE_09': 'ZONE_S5', 'ZONE_11': 'ZONE_S6',
      'ZONE_13': 'ZONE_S7', 'ZONE_15': 'ZONE_S8', 'ZONE_17': 'ZONE_S9',
      'ZONE_19': 'ZONE_S10', 'ZONE_21': 'ZONE_S11',
    };
    const target = (zoneId || 'ALL').toUpperCase();
    const isAll = target === 'ALL';
    const altTarget = zoneMapping[target] || target;

    let whereClause = `WHERE p.lifecycle_status = 'ACTIVE'`;
    const params: any[] = [];

    if (!isAll) {
      whereClause += ` AND (p.zone_id = $1 OR p.zone_id = $2)`;
      params.push(target, altTarget);
    }

    if (status) {
      params.push(status);
      whereClause += ` AND p.survey_status = $${params.length}`;
    }

    const res = await Database.query<ParcelEntity>(
      `SELECT p.*,
              GREATEST(p.total_units, (SELECT COUNT(*)::int FROM building_units u WHERE u.parcel_id = p.id)) AS total_units,
              (SELECT COUNT(*)::int FROM building_units u WHERE u.parcel_id = p.id AND u.status IN ('APPROVED', 'SUBMITTED')) AS completed_units_count,
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

      // 3. Ghi log vắng nhà
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
   * Cấp mã B-XXXXX tiếp theo dựa trên chỉ số lớn nhất hiện hữu trong hệ thống (MAX + 1)
   */
  static async getNextHighRangeProjectCode(client: PoolClient): Promise<string> {
    const res = await client.query<{ max_val: number }>(
      `SELECT COALESCE(MAX(substring(project_parcel_code from 3)::integer), 0) AS max_val
       FROM parcels
       WHERE project_parcel_code ~ '^B-[0-9]+$'
       FOR UPDATE;`
    );

    let nextNum = 1;
    if (res.rows[0]?.max_val !== undefined && res.rows[0]?.max_val !== null) {
      nextNum = Number(res.rows[0].max_val) + 1;
    }

    return `B-${String(nextNum).padStart(5, '0')}`;
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
}

