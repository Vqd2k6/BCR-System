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
  is_companion: boolean;
  companion_name: string | null;
  companion_role: string | null;
  companion_phone: string | null;
  deleted_at?: Date | null;
  gps_latitude?: number;
  gps_longitude?: number;
}

export interface AttendanceSummaryRow {
  surveyor_id: string;
  surveyor_name: string;
  assigned_zone_id: string | null;
  total_checkins: string | number;
  approved_days: string | number;
  flagged_days: string | number;
  rejected_days: string | number;
}

export class AttendanceRepository {
  private static schemaEnsured = false;

  /**
   * Đảm bảo các cột mở rộng cho Người đi cùng luôn tồn tại (an toàn kể cả khi hot-reload chưa chạy lại server)
   */
  static async ensureCompanionColumns(): Promise<void> {
    if (this.schemaEnsured) return;
    try {
      await Database.query(`
        ALTER TABLE timekeeping_checkins
          ADD COLUMN IF NOT EXISTS is_companion BOOLEAN NOT NULL DEFAULT FALSE,
          ADD COLUMN IF NOT EXISTS companion_name VARCHAR(128),
          ADD COLUMN IF NOT EXISTS companion_role VARCHAR(128),
          ADD COLUMN IF NOT EXISTS companion_phone VARCHAR(32),
          ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;
      `);
      this.schemaEnsured = true;
    } catch (err: unknown) {
      console.error('[AttendanceRepository:ensureCompanionColumns] Error ensuring columns:', err);
    }
  }

  static async countTodayCompanionCheckIns(surveyorId: string): Promise<number> {
    await this.ensureCompanionColumns();
    const res = await Database.query<{ count: string }>(
      `SELECT COUNT(*) AS count
       FROM timekeeping_checkins
       WHERE surveyor_id = $1
         AND is_companion = TRUE
         AND deleted_at IS NULL
         AND (checkin_time AT TIME ZONE 'Asia/Ho_Chi_Minh')::date = (NOW() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date;`,
      [surveyorId]
    );
    return parseInt(res.rows[0]?.count || '0', 10);
  }

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
    isCompanion?: boolean;
    companionName?: string | null;
    companionRole?: string | null;
    companionPhone?: string | null;
  }): Promise<TimekeepingCheckInEntity> {
    await this.ensureCompanionColumns();
    const res = await Database.query<TimekeepingCheckInEntity>(
      `INSERT INTO timekeeping_checkins (
         surveyor_id, zone_id, gps_location, distance_to_zone_center_meters,
         is_within_zone_boundary, selfie_photo_url, notes, verification_status,
         has_anomaly_flag, anomaly_reason,
         is_companion, companion_name, companion_role, companion_phone
       ) VALUES (
         $1, $2, ST_SetSRID(ST_MakePoint($3, $4), 4326), $5, $6, $7, $8,
         $9, $10, $11,
         $12, $13, $14, $15
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
        Boolean(data.isCompanion),
        data.isCompanion ? (data.companionName?.trim() || null) : null,
        data.isCompanion ? (data.companionRole?.trim() || 'Cán bộ đo đạc & Ghi chép') : null,
        data.isCompanion ? (data.companionPhone?.trim() || null) : null,
      ]
    );
    return res.rows[0];
  }

  static async getCheckInById(id: string): Promise<TimekeepingCheckInEntity | null> {
    await this.ensureCompanionColumns();
    const res = await Database.query<TimekeepingCheckInEntity>(
      `SELECT t.*, u.full_name AS surveyor_name, ST_X(t.gps_location) AS gps_longitude, ST_Y(t.gps_location) AS gps_latitude
       FROM timekeeping_checkins t
       JOIN users u ON t.surveyor_id = u.id
       WHERE t.id = $1 AND t.deleted_at IS NULL LIMIT 1;`,
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
    isCompanion?: boolean;
    limit?: number;
    offset?: number;
  }): Promise<{ checkIns: TimekeepingCheckInEntity[]; total: number }> {
    await this.ensureCompanionColumns();
    let whereClause = `WHERE t.deleted_at IS NULL`;
    const params: unknown[] = [];

    if (filters.surveyorId) {
      params.push(filters.surveyorId);
      whereClause += ` AND t.surveyor_id = $${params.length}`;
    }
    if (filters.zoneId && filters.zoneId.toUpperCase() !== 'ALL' && filters.zoneId.toUpperCase() !== 'ALL_ZONES') {
      params.push(filters.zoneId);
      whereClause += ` AND t.zone_id = $${params.length}`;
    }
    if (filters.status) {
      params.push(filters.status);
      whereClause += ` AND t.verification_status = $${params.length}`;
    }
    if (typeof filters.isCompanion === 'boolean') {
      params.push(filters.isCompanion);
      whereClause += ` AND t.is_companion = $${params.length}`;
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

    const limit = filters.limit || 50;
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
    await this.ensureCompanionColumns();
    const res = await Database.query<TimekeepingCheckInEntity>(
      `UPDATE timekeeping_checkins
       SET verification_status = $2,
           verified_by_user_id = $3,
           verified_at = NOW(),
           verification_notes = $4
       WHERE id = $1 AND deleted_at IS NULL
       RETURNING *;`,
      [id, status, adminId, notes || null]
    );
    return res.rows[0] || null;
  }

  static async getAttendanceSummary(zoneId?: string, month?: string): Promise<AttendanceSummaryRow[]> {
    await this.ensureCompanionColumns();
    let whereClause = `WHERE t.deleted_at IS NULL AND t.is_companion = FALSE`;
    const params: unknown[] = [];

    if (zoneId && zoneId.toUpperCase() !== 'ALL' && zoneId.toUpperCase() !== 'ALL_ZONES') {
      params.push(zoneId);
      whereClause += ` AND t.zone_id = $${params.length}`;
    }

    if (month && /^\d{4}-\d{2}$/.test(month.trim())) {
      params.push(month.trim());
      whereClause += ` AND TO_CHAR(t.checkin_time AT TIME ZONE 'Asia/Ho_Chi_Minh', 'YYYY-MM') = $${params.length}`;
    }

    const res = await Database.query<AttendanceSummaryRow>(
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
       ${whereClause}
       GROUP BY t.surveyor_id, u.full_name, u.assigned_zone_id;`,
      params
    );
    return res.rows;
  }
}
