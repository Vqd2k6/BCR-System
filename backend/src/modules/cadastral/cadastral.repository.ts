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
    let whereClause = `WHERE p.zone_id = $1 AND p.lifecycle_status = 'ACTIVE'`;
    const params: any[] = [zoneId];

    if (status) {
      params.push(status);
      whereClause += ` AND p.survey_status = $${params.length}`;
    }

    const res = await Database.query<ParcelEntity>(
      `SELECT p.*,
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
              ST_AsGeoJSON(p.location_geom)::json AS location_geojson
       FROM parcels p
       WHERE p.lifecycle_status = 'ACTIVE'
         AND p.survey_status IN ('NOT_SURVEYED', 'POSTPONED_ABSENT')
         AND ST_DWithin(
           p.location_geom::geography,
           ST_SetSRID(ST_MakePoint($2, $1), 4326)::geography,
           $3
         )
       ORDER BY distance_meters ASC
       LIMIT 20;`,
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
  }): Promise<void> {
    await Database.transaction(async (client) => {
      // 1. Tăng số lần vắng mặt và chuyển trạng thái thửa đất sang POSTPONED_ABSENT
      await client.query(
        `UPDATE parcels
         SET survey_status = 'POSTPONED_ABSENT',
             absence_attempt_count = absence_attempt_count + 1,
             updated_at = NOW()
         WHERE id = $1;`,
        [data.parcelId]
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
}
