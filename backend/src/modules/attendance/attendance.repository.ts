import { Database } from '../../database/db';

export interface TimekeepingCheckInEntity {
  id: string;
  surveyor_id: string;
  surveyor_name?: string;
  zone_id: string;
  checkin_time: Date;
  distance_to_zone_center_meters: number;
  is_within_zone_boundary: boolean;
  selfie_photo_url: string | null;
  notes: string | null;
  verification_status: 'PENDING_VERIFICATION' | 'APPROVED' | 'FLAGGED_WARNING' | 'REJECTED';
  verified_by_user_id: string | null;
  verified_at: Date | null;
  verification_notes: string | null;
  has_anomaly_flag: boolean;
  anomaly_reason: string | null;
  gps_latitude?: number;
  gps_longitude?: number;
}

export class AttendanceRepository {
  static async createCheckIn(data: {
    surveyorId: string;
    zoneId: string;
    gpsLatitude: number;
    gpsLongitude: number;
    distanceToCenterMeters: number;
    isWithinBoundary: boolean;
    selfiePhotoUrl?: string | null;
    notes?: string | null;
    hasAnomalyFlag: boolean;
    anomalyReason?: string | null;
  }): Promise<TimekeepingCheckInEntity> {
    const res = await Database.query<TimekeepingCheckInEntity>(
      `INSERT INTO timekeeping_checkins (
         surveyor_id, zone_id, gps_location, distance_to_zone_center_meters,
         is_within_zone_boundary, selfie_photo_url, notes, verification_status,
         has_anomaly_flag, anomaly_reason
       ) VALUES (
         $1, $2, ST_SetSRID(ST_MakePoint($3, $4), 4326), $5, $6, $7, $8,
         $9, $10, $11
       ) RETURNING *, ST_X(gps_location) AS gps_longitude, ST_Y(gps_location) AS gps_latitude;`,
      [
        data.surveyorId,
        data.zoneId,
        data.gpsLongitude,
        data.gpsLatitude,
        data.distanceToCenterMeters,
        data.isWithinBoundary,
        data.selfiePhotoUrl || null,
        data.notes || null,
        data.hasAnomalyFlag ? 'FLAGGED_WARNING' : 'PENDING_VERIFICATION',
        data.hasAnomalyFlag,
        data.anomalyReason || null,
      ]
    );
    return res.rows[0];
  }

  static async getCheckInById(id: string): Promise<TimekeepingCheckInEntity | null> {
    const res = await Database.query<TimekeepingCheckInEntity>(
      `SELECT t.*, u.full_name AS surveyor_name, ST_X(t.gps_location) AS gps_longitude, ST_Y(t.gps_location) AS gps_latitude
       FROM timekeeping_checkins t
       JOIN users u ON t.surveyor_id = u.id
       WHERE t.id = $1 LIMIT 1;`,
      [id]
    );
    return res.rows[0] || null;
  }

  static async listCheckIns(filters: {
    surveyorId?: string;
    zoneId?: string;
    status?: string;
    startDate?: string;
    endDate?: string;
    limit?: number;
    offset?: number;
  }): Promise<{ checkIns: TimekeepingCheckInEntity[]; total: number }> {
    let whereClause = `WHERE 1=1`;
    const params: any[] = [];

    if (filters.surveyorId) {
      params.push(filters.surveyorId);
      whereClause += ` AND t.surveyor_id = $${params.length}`;
    }
    if (filters.zoneId) {
      params.push(filters.zoneId);
      whereClause += ` AND t.zone_id = $${params.length}`;
    }
    if (filters.status) {
      params.push(filters.status);
      whereClause += ` AND t.verification_status = $${params.length}`;
    }
    if (filters.startDate) {
      params.push(filters.startDate);
      whereClause += ` AND t.checkin_time >= $${params.length}::timestamptz`;
    }
    if (filters.endDate) {
      params.push(filters.endDate);
      whereClause += ` AND t.checkin_time <= $${params.length}::timestamptz`;
    }

    const countRes = await Database.query<{ count: string }>(
      `SELECT COUNT(*) AS count FROM timekeeping_checkins t ${whereClause};`,
      params
    );
    const total = parseInt(countRes.rows[0]?.count || '0', 10);

    const limit = filters.limit || 20;
    const offset = filters.offset || 0;
    params.push(limit, offset);

    const res = await Database.query<TimekeepingCheckInEntity>(
      `SELECT t.*, u.full_name AS surveyor_name, ST_X(t.gps_location) AS gps_longitude, ST_Y(t.gps_location) AS gps_latitude
       FROM timekeeping_checkins t
       JOIN users u ON t.surveyor_id = u.id
       ${whereClause}
       ORDER BY t.checkin_time DESC
       LIMIT $${params.length - 1} OFFSET $${params.length};`,
      params
    );

    return { checkIns: res.rows, total };
  }

  static async verifyCheckIn(
    id: string,
    adminId: string,
    status: string,
    notes?: string | null
  ): Promise<TimekeepingCheckInEntity | null> {
    const res = await Database.query<TimekeepingCheckInEntity>(
      `UPDATE timekeeping_checkins
       SET verification_status = $2,
           verified_by_user_id = $3,
           verified_at = NOW(),
           verification_notes = $4
       WHERE id = $1
       RETURNING *;`,
      [id, status, adminId, notes || null]
    );
    return res.rows[0] || null;
  }

  static async getAttendanceSummary(zoneId?: string, month?: string): Promise<any[]> {
    let whereClause = ``;
    const params: any[] = [];

    if (zoneId) {
      params.push(zoneId);
      whereClause += ` AND t.zone_id = $${params.length}`;
    }

    const res = await Database.query(
      `SELECT 
         t.surveyor_id,
         u.full_name AS surveyor_name,
         u.assigned_zone_id,
         COUNT(*) AS total_checkins,
         COUNT(*) FILTER (WHERE t.verification_status = 'APPROVED') AS approved_days,
         COUNT(*) FILTER (WHERE t.has_anomaly_flag = TRUE) AS flagged_days,
         COUNT(*) FILTER (WHERE t.verification_status = 'REJECTED') AS rejected_days
       FROM timekeeping_checkins t
       JOIN users u ON t.surveyor_id = u.id
       WHERE 1=1 ${whereClause}
       GROUP BY t.surveyor_id, u.full_name, u.assigned_zone_id;`,
      params
    );
    return res.rows;
  }
}
