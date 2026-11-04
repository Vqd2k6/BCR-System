import type { PoolClient, QueryResult, QueryResultRow } from 'pg';
import { Database } from '../../database/db';
import { escapeLikePattern, VN_TZ, type VerificationStatus } from './attendance.rules';

export interface TimekeepingCheckInEntity {
  id: string;
  surveyor_id: string;
  surveyor_name?: string;
  surveyor_code?: string | null;
  surveyor_phone?: string | null;
  surveyor_assigned_zone_id?: string | null;
  zone_id: string;
  checkin_time: Date;
  distance_to_zone_center_meters: number;
  is_within_zone_boundary: boolean;
  selfie_photo_url: string | null;
  notes: string | null;
  verification_status: VerificationStatus;
  verified_by_user_id: string | null;
  verified_by_name?: string | null;
  verified_at: Date | null;
  verification_notes: string | null;
  has_anomaly_flag: boolean;
  anomaly_reason: string | null;
  anomaly_codes: string[];
  effective_anomaly_codes?: string[];
  is_missing_checkout?: boolean;
  work_date?: string;
  is_companion: boolean;
  companion_name: string | null;
  companion_role: string | null;
  companion_phone: string | null;
  checkout_time?: Date | null;
  checkout_distance_to_zone_center_meters?: number | null;
  checkout_selfie_photo_url?: string | null;
  checkout_notes?: string | null;
  work_duration_minutes?: number | null;
  checkout_gps_latitude?: number | null;
  checkout_gps_longitude?: number | null;
  gps_accuracy_meters?: number | null;
  checkout_gps_accuracy_meters?: number | null;
  zone_center_lng?: number | null;
  zone_center_lat?: number | null;
  checkout_zone_center_lng?: number | null;
  checkout_zone_center_lat?: number | null;
  assigned_zone_at_checkin?: string | null;
  surveys_created_count?: number | null;
  surveys_submitted_count?: number | null;
  deleted_at?: Date | null;
  gps_latitude?: number;
  gps_longitude?: number;
}

export interface AttendanceSummaryRow {
  surveyor_id: string;
  surveyor_name: string;
  surveyor_code: string | null;
  assigned_zone_id: string | null;
  total_shift_days: number;
  work_days: number;
  approved_days: number;
  flagged_days: number;
  rejected_days: number;
  pending_days: number;
  completed_checkout_days: number;
  missing_checkout_days: number;
  total_work_minutes: number;
  anomaly_shift_count: number;
  companion_checkins_total: number;
  companion_accepted_count: number;
  companion_pending_count: number;
  companions: Array<{ name: string | null; phone: string | null }>;
  surveys_submitted: number;
}

export interface AttendanceCountersRow {
  main_today: number;
  companion_today: number;
  on_field_now: number;
  completed_today: number;
  pending_total: number;
  pending_with_anomaly: number;
  pending_missing_checkout: number;
  pending_distance: number;
}

export interface AuditHistoryRow {
  id: string;
  action: string;
  performed_by_user_id: string | null;
  performed_by_name: string | null;
  created_at: Date;
  diff_payload: Record<string, unknown> | null;
}

export interface AttendancePeriodRow {
  id: string;
  zone_id: string;
  period_month: string;
  status: 'OPEN' | 'LOCKED';
  current_snapshot_id: string | null;
  locked_by: string | null;
  locked_by_name?: string | null;
  locked_at: Date | null;
  unlocked_by: string | null;
  unlocked_at: Date | null;
  unlock_reason: string | null;
}

export interface AttendanceSnapshotRow {
  id: string;
  period_id: string;
  zone_id: string;
  period_month: string;
  snapshot_json: Record<string, unknown>;
  snapshot_sha256: string;
  locked_by: string | null;
  locked_by_name?: string | null;
  locked_at: Date;
  unlocked_by: string | null;
  unlocked_at: Date | null;
  unlock_reason: string | null;
}

export interface CheckInListFilters {
  surveyorId?: string;
  zoneIds?: string[] | null;
  status?: VerificationStatus;
  anomaly?: string;
  fromDate?: string;
  toDate?: string;
  isCompanion?: boolean;
  search?: string;
  limit?: number;
  offset?: number;
}

export interface BatchCandidateRow {
  id: string;
  surveyor_id: string;
  zone_id: string;
  checkout_time: Date | null;
  selfie_photo_url: string | null;
  effective_anomaly_codes: string[];
  work_month: string;
  is_companion: boolean;
}

type Queryable = Pick<PoolClient, 'query'>;

function run<T extends QueryResultRow>(client: Queryable | undefined, text: string, params: unknown[]): Promise<QueryResult<T>> {
  if (client) return client.query<T>(text, params);
  return Database.query<T>(text, params);
}

// --- SQL fragments dùng chung (chỉ chứa hằng, không nội suy dữ liệu người dùng) ---
const WORK_DATE_SQL = `(t.checkin_time AT TIME ZONE '${VN_TZ}')::date`;
const MISSING_CHECKOUT_SQL = `(t.checkout_time IS NULL AND ${WORK_DATE_SQL} < (NOW() AT TIME ZONE '${VN_TZ}')::date)`;
const EFFECTIVE_CODES_SQL = `(CASE WHEN ${MISSING_CHECKOUT_SQL} THEN array_append(t.anomaly_codes, 'MISSING_CHECKOUT') ELSE t.anomaly_codes END)`;
/** Mốc đầu ngày VN dạng timestamptz cho tham số YYYY-MM-DD. */
const vnDayStart = (param: string) => `((${param})::date::timestamp AT TIME ZONE '${VN_TZ}')`;
const vnMonthStart = (param: string) => `(((${param}) || '-01')::date::timestamp AT TIME ZONE '${VN_TZ}')`;
const vnMonthEnd = (param: string) => `((((${param}) || '-01')::date + INTERVAL '1 month')::timestamp AT TIME ZONE '${VN_TZ}')`;

const CHECKIN_SELECT = `
  t.*,
  u.full_name AS surveyor_name,
  u.surveyor_code,
  u.phone AS surveyor_phone,
  u.assigned_zone_id AS surveyor_assigned_zone_id,
  vb.full_name AS verified_by_name,
  ST_X(t.gps_location) AS gps_longitude, ST_Y(t.gps_location) AS gps_latitude,
  ST_X(t.checkout_gps_location) AS checkout_gps_longitude, ST_Y(t.checkout_gps_location) AS checkout_gps_latitude,
  ${WORK_DATE_SQL}::text AS work_date,
  ${MISSING_CHECKOUT_SQL} AS is_missing_checkout,
  ${EFFECTIVE_CODES_SQL} AS effective_anomaly_codes`;

const CHECKIN_FROM = `
  FROM timekeeping_checkins t
  JOIN users u ON t.surveyor_id = u.id
  LEFT JOIN users vb ON t.verified_by_user_id = vb.id`;

function buildFilterClause(filters: CheckInListFilters, params: unknown[]): string {
  let where = `WHERE t.deleted_at IS NULL`;
  const push = (v: unknown) => {
    params.push(v);
    return `$${params.length}`;
  };

  if (filters.surveyorId) where += ` AND t.surveyor_id = ${push(filters.surveyorId)}`;
  if (filters.zoneIds) where += ` AND UPPER(t.zone_id) = ANY(${push(filters.zoneIds)}::text[])`;
  if (filters.status) where += ` AND t.verification_status = ${push(filters.status)}`;
  if (typeof filters.isCompanion === 'boolean') where += ` AND t.is_companion = ${push(filters.isCompanion)}`;
  if (filters.fromDate) where += ` AND t.checkin_time >= ${vnDayStart(push(filters.fromDate))}`;
  if (filters.toDate) {
    where += ` AND t.checkin_time < (${vnDayStart(push(filters.toDate))} + INTERVAL '1 day')`;
  }
  if (filters.anomaly === 'ANY') {
    where += ` AND cardinality(${EFFECTIVE_CODES_SQL}) > 0`;
  } else if (filters.anomaly === 'NONE') {
    where += ` AND cardinality(${EFFECTIVE_CODES_SQL}) = 0`;
  } else if (filters.anomaly) {
    where += ` AND ${push(filters.anomaly)} = ANY(${EFFECTIVE_CODES_SQL})`;
  }
  if (filters.search && filters.search.trim()) {
    const p = push(`%${escapeLikePattern(filters.search.trim())}%`);
    where += ` AND (
      unaccent(u.full_name) ILIKE unaccent(${p})
      OR COALESCE(u.surveyor_code, '') ILIKE ${p}
      OR COALESCE(u.phone, '') ILIKE ${p}
      OR unaccent(COALESCE(t.companion_name, '')) ILIKE unaccent(${p})
      OR COALESCE(t.companion_phone, '') ILIKE ${p}
    )`;
  }
  return where;
}

export class AttendanceRepository {
  private static schemaEnsured = false;

  /**
   * Đảm bảo các cột mở rộng cho Người đi cùng luôn tồn tại (an toàn kể cả khi hot-reload chưa chạy lại server).
   * Cột mới từ 20261104 trở đi chỉ được thêm qua migration, không thêm vào đây.
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
          ADD COLUMN IF NOT EXISTS checkout_time TIMESTAMPTZ DEFAULT NULL,
          ADD COLUMN IF NOT EXISTS checkout_gps_location GEOMETRY(Point, 4326) DEFAULT NULL,
          ADD COLUMN IF NOT EXISTS checkout_distance_to_zone_center_meters NUMERIC(10,2) DEFAULT NULL,
          ADD COLUMN IF NOT EXISTS checkout_selfie_photo_url TEXT DEFAULT NULL,
          ADD COLUMN IF NOT EXISTS checkout_notes TEXT DEFAULT NULL,
          ADD COLUMN IF NOT EXISTS work_duration_minutes INT DEFAULT NULL,
          ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ DEFAULT NULL;
      `);
      this.schemaEnsured = true;
    } catch (err: unknown) {
      console.error('[AttendanceRepository:ensureCompanionColumns] Error ensuring columns:', err);
    }
  }

  static async getUserAssignedZone(userId: string): Promise<string | null> {
    const res = await Database.query<{ assigned_zone_id: string | null }>(
      `SELECT assigned_zone_id FROM users WHERE id = $1 LIMIT 1;`,
      [userId]
    );
    return res.rows[0]?.assigned_zone_id ?? null;
  }

  static async countTodayCompanionCheckIns(surveyorId: string, client?: Queryable): Promise<number> {
    await this.ensureCompanionColumns();
    const res = await run<{ count: string }>(
      client,
      `SELECT COUNT(*) AS count
       FROM timekeeping_checkins t
       WHERE t.surveyor_id = $1
         AND t.is_companion = TRUE
         AND t.deleted_at IS NULL
         AND ${WORK_DATE_SQL} = (NOW() AT TIME ZONE '${VN_TZ}')::date;`,
      [surveyorId]
    );
    return parseInt(res.rows[0]?.count || '0', 10);
  }

  /** Ca chính của KSV trong ngày VN hôm nay (đã đóng hay chưa) — dùng cho quy tắc 1 ca/ngày. */
  static async findTodayMainCheckIn(surveyorId: string, client?: Queryable): Promise<{ id: string } | null> {
    const res = await run<{ id: string }>(
      client,
      `SELECT t.id FROM timekeeping_checkins t
       WHERE t.surveyor_id = $1 AND t.is_companion = FALSE AND t.deleted_at IS NULL
         AND ${WORK_DATE_SQL} = (NOW() AT TIME ZONE '${VN_TZ}')::date
       LIMIT 1;`,
      [surveyorId]
    );
    return res.rows[0] || null;
  }

  /** Khóa tư vấn theo KSV trong transaction: tuần tự hóa check-in/check-out của cùng một người. */
  static async lockSurveyor(client: Queryable, surveyorId: string): Promise<void> {
    await client.query(`SELECT pg_advisory_xact_lock(hashtext($1));`, [`attendance:surveyor:${surveyorId}`]);
  }

  /** Khóa tư vấn theo tháng: tuần tự hóa duyệt ca với chốt / mở kỳ công của cùng tháng. */
  static async lockPeriodMonth(client: Queryable, month: string): Promise<void> {
    await client.query(`SELECT pg_advisory_xact_lock(hashtext($1));`, [`attendance:period:${month}`]);
  }

  static async createCheckIn(
    client: Queryable,
    data: {
      surveyorId: string;
      zoneId: string;
      gpsLatitude: number;
      gpsLongitude: number;
      gpsAccuracyMeters?: number | null;
      distanceToCenterMeters: number;
      isWithinBoundary: boolean;
      selfiePhotoUrl?: string | null;
      notes?: string | null;
      anomalyCodes: string[];
      anomalyReason?: string | null;
      zoneCenter: { lat: number; lng: number };
      assignedZoneAtCheckIn: string | null;
      isCompanion?: boolean;
      companionName?: string | null;
      companionRole?: string | null;
      companionPhone?: string | null;
    }
  ): Promise<TimekeepingCheckInEntity> {
    await this.ensureCompanionColumns();
    const res = await client.query<TimekeepingCheckInEntity>(
      `INSERT INTO timekeeping_checkins (
         surveyor_id, zone_id, gps_location, distance_to_zone_center_meters,
         is_within_zone_boundary, selfie_photo_url, notes, verification_status,
         has_anomaly_flag, anomaly_reason, anomaly_codes,
         is_companion, companion_name, companion_role, companion_phone,
         gps_accuracy_meters, zone_center_lng, zone_center_lat, assigned_zone_at_checkin
       ) VALUES (
         $1, $2, ST_SetSRID(ST_MakePoint($3, $4), 4326), $5,
         $6, $7, $8, 'PENDING_VERIFICATION',
         $9, $10, $11::text[],
         $12, $13, $14, $15,
         $16, $17, $18, $19
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
        data.anomalyCodes.length > 0,
        data.anomalyReason || null,
        data.anomalyCodes,
        Boolean(data.isCompanion),
        data.isCompanion ? (data.companionName?.trim() || null) : null,
        data.isCompanion ? (data.companionRole?.trim() || 'Cán bộ đo đạc & Ghi chép') : null,
        data.isCompanion ? (data.companionPhone?.trim() || null) : null,
        typeof data.gpsAccuracyMeters === 'number' ? data.gpsAccuracyMeters : null,
        data.zoneCenter.lng,
        data.zoneCenter.lat,
        data.assignedZoneAtCheckIn,
      ]
    );
    return res.rows[0];
  }

  /**
   * Các ca hôm nay (ngày VN) chưa Check-out của KSV, khóa dòng để Check-out.
   * Có checkInId thì chỉ lấy đúng ca đó (vẫn phải thuộc KSV, đúng loại, đúng ngày hôm nay).
   */
  static async findOpenTodayCheckInsForCheckOut(
    client: Queryable,
    surveyorId: string,
    isCompanion: boolean,
    checkInId?: string | null
  ): Promise<TimekeepingCheckInEntity[]> {
    await this.ensureCompanionColumns();
    const params: unknown[] = [surveyorId, isCompanion];
    let idClause = '';
    if (checkInId && checkInId.trim()) {
      params.push(checkInId.trim());
      idClause = `AND t.id = $${params.length}`;
    }
    const res = await client.query<TimekeepingCheckInEntity>(
      `SELECT t.*, ST_X(t.gps_location) AS gps_longitude, ST_Y(t.gps_location) AS gps_latitude,
              ${WORK_DATE_SQL}::text AS work_date
       FROM timekeeping_checkins t
       WHERE t.surveyor_id = $1
         AND t.is_companion = $2
         AND t.deleted_at IS NULL
         AND ${WORK_DATE_SQL} = (NOW() AT TIME ZONE '${VN_TZ}')::date
         ${idClause}
       ORDER BY (t.checkout_time IS NULL) DESC, t.checkin_time DESC
       FOR UPDATE OF t;`,
      params
    );
    return res.rows;
  }

  static async updateCheckOut(
    client: Queryable,
    data: {
      checkInId: string;
      gpsLatitude: number;
      gpsLongitude: number;
      gpsAccuracyMeters?: number | null;
      distanceToCenterMeters: number;
      selfiePhotoUrl?: string | null;
      notes?: string | null;
      anomalyCodes: string[];
      zoneCenter: { lat: number; lng: number };
    }
  ): Promise<TimekeepingCheckInEntity | null> {
    // checkout_time IS NULL: Check-out chỉ ghi được một lần, không bao giờ ghi đè.
    const res = await client.query<TimekeepingCheckInEntity>(
      `UPDATE timekeeping_checkins
       SET checkout_time = NOW(),
           checkout_gps_location = ST_SetSRID(ST_MakePoint($2, $3), 4326),
           checkout_distance_to_zone_center_meters = $4,
           checkout_selfie_photo_url = $5,
           checkout_notes = $6,
           work_duration_minutes = GREATEST(1, ROUND(EXTRACT(EPOCH FROM (NOW() - checkin_time)) / 60.0)::int),
           anomaly_codes = $7::text[],
           has_anomaly_flag = cardinality($7::text[]) > 0,
           checkout_gps_accuracy_meters = $8,
           checkout_zone_center_lng = $9,
           checkout_zone_center_lat = $10
       WHERE id = $1 AND deleted_at IS NULL AND checkout_time IS NULL
       RETURNING *,
         ST_X(gps_location) AS gps_longitude,
         ST_Y(gps_location) AS gps_latitude,
         ST_X(checkout_gps_location) AS checkout_gps_longitude,
         ST_Y(checkout_gps_location) AS checkout_gps_latitude;`,
      [
        data.checkInId,
        data.gpsLongitude,
        data.gpsLatitude,
        data.distanceToCenterMeters,
        data.selfiePhotoUrl || null,
        data.notes || null,
        data.anomalyCodes,
        typeof data.gpsAccuracyMeters === 'number' ? data.gpsAccuracyMeters : null,
        data.zoneCenter.lng,
        data.zoneCenter.lat,
      ]
    );
    return res.rows[0] || null;
  }

  static async getCheckInById(
    id: string,
    options: { client?: Queryable; forUpdate?: boolean } = {}
  ): Promise<TimekeepingCheckInEntity | null> {
    await this.ensureCompanionColumns();
    const res = await run<TimekeepingCheckInEntity>(
      options.client,
      `SELECT ${CHECKIN_SELECT}
       ${CHECKIN_FROM}
       WHERE t.id = $1 AND t.deleted_at IS NULL
       LIMIT 1
       ${options.forUpdate ? 'FOR UPDATE OF t' : ''};`,
      [id]
    );
    return res.rows[0] || null;
  }

  static async listCheckIns(filters: CheckInListFilters): Promise<{ checkIns: TimekeepingCheckInEntity[]; total: number }> {
    await this.ensureCompanionColumns();
    const params: unknown[] = [];
    const whereClause = buildFilterClause(filters, params);

    const countRes = await Database.query<{ count: string }>(
      `SELECT COUNT(*) AS count ${CHECKIN_FROM} ${whereClause};`,
      params
    );
    const total = parseInt(countRes.rows[0]?.count || '0', 10);

    const limit = filters.limit || 50;
    const offset = filters.offset || 0;
    const pageParams = [...params, limit, offset];

    // Sản lượng khảo sát của KSV trong ngày VN của ca (Q-10): đếm theo created_at / submitted_at, không dùng updated_at.
    const res = await Database.query<TimekeepingCheckInEntity>(
      `SELECT ${CHECKIN_SELECT},
              so.surveys_created_count,
              so.surveys_submitted_count
       ${CHECKIN_FROM}
       CROSS JOIN LATERAL (
         SELECT (${WORK_DATE_SQL}::timestamp AT TIME ZONE '${VN_TZ}') AS day_start,
                ((${WORK_DATE_SQL} + 1)::timestamp AT TIME ZONE '${VN_TZ}') AS day_end
       ) d
       LEFT JOIN LATERAL (
         SELECT
           COUNT(*) FILTER (WHERE r.created_at >= d.day_start AND r.created_at < d.day_end)::int AS surveys_created_count,
           COUNT(*) FILTER (WHERE r.submitted_at >= d.day_start AND r.submitted_at < d.day_end)::int AS surveys_submitted_count
         FROM base_survey_reports r
         WHERE r.surveyor_id = t.surveyor_id
           AND r.deleted_at IS NULL
           AND (
             (r.created_at >= d.day_start AND r.created_at < d.day_end)
             OR (r.submitted_at >= d.day_start AND r.submitted_at < d.day_end)
           )
       ) so ON t.is_companion = FALSE
       ${whereClause}
       ORDER BY t.checkin_time DESC
       LIMIT $${pageParams.length - 1} OFFSET $${pageParams.length};`,
      pageParams
    );

    return { checkIns: res.rows, total };
  }

  /** Lượt đi kèm cùng KSV, cùng ngày VN — để modal soi ca KSV hiển thị lồng. */
  static async listCompanionsForShift(surveyorId: string, workDate: string): Promise<TimekeepingCheckInEntity[]> {
    const res = await Database.query<TimekeepingCheckInEntity>(
      `SELECT ${CHECKIN_SELECT}
       ${CHECKIN_FROM}
       WHERE t.deleted_at IS NULL AND t.is_companion = TRUE AND t.surveyor_id = $1
         AND ${WORK_DATE_SQL} = $2::date
       ORDER BY t.checkin_time ASC;`,
      [surveyorId, workDate]
    );
    return res.rows;
  }

  static async getAuditHistory(checkInId: string): Promise<AuditHistoryRow[]> {
    const res = await Database.query<AuditHistoryRow>(
      `SELECT l.id, l.action, l.performed_by_user_id, u.full_name AS performed_by_name, l.created_at, l.diff_payload
       FROM system_audit_logs l
       LEFT JOIN users u ON u.id = l.performed_by_user_id
       WHERE l.entity_type = 'TIMEKEEPING_CHECKIN' AND l.entity_id = $1
       ORDER BY l.created_at ASC;`,
      [checkInId]
    );
    return res.rows;
  }

  static async insertAudit(
    client: Queryable,
    data: {
      entityType: string;
      entityId: string;
      action: string;
      performedBy: string | null;
      clientIp?: string | null;
      payload: Record<string, unknown>;
    }
  ): Promise<void> {
    await client.query(
      `INSERT INTO system_audit_logs (entity_type, entity_id, action, performed_by_user_id, client_ip, diff_payload)
       VALUES ($1, $2, $3, $4, $5, $6::jsonb);`,
      [data.entityType, data.entityId, data.action, data.performedBy, data.clientIp || null, JSON.stringify(data.payload)]
    );
  }

  static async updateVerification(
    client: Queryable,
    id: string,
    adminId: string,
    status: VerificationStatus,
    notes: string | null
  ): Promise<TimekeepingCheckInEntity | null> {
    const res = await client.query<TimekeepingCheckInEntity>(
      `UPDATE timekeeping_checkins
       SET verification_status = $2::verification_status_enum,
           verified_by_user_id = CASE WHEN $2::verification_status_enum = 'PENDING_VERIFICATION' THEN NULL ELSE $3::uuid END,
           verified_at = CASE WHEN $2::verification_status_enum = 'PENDING_VERIFICATION' THEN NULL ELSE NOW() END,
           verification_notes = $4
       WHERE id = $1 AND deleted_at IS NULL
       RETURNING *;`,
      [id, status, adminId, notes]
    );
    return res.rows[0] || null;
  }

  static async getCounters(zoneIds: string[] | null): Promise<AttendanceCountersRow> {
    const params: unknown[] = [];
    let zoneClause = '';
    if (zoneIds) {
      params.push(zoneIds);
      zoneClause = `AND UPPER(t.zone_id) = ANY($1::text[])`;
    }
    const todaySql = `${WORK_DATE_SQL} = (NOW() AT TIME ZONE '${VN_TZ}')::date`;
    const pendingSql = `t.verification_status = 'PENDING_VERIFICATION'`;
    const res = await Database.query<AttendanceCountersRow>(
      `SELECT
         COUNT(*) FILTER (WHERE ${todaySql} AND NOT t.is_companion)::int AS main_today,
         COUNT(*) FILTER (WHERE ${todaySql} AND t.is_companion)::int AS companion_today,
         COUNT(*) FILTER (WHERE ${todaySql} AND NOT t.is_companion AND t.checkout_time IS NULL)::int AS on_field_now,
         COUNT(*) FILTER (WHERE ${todaySql} AND NOT t.is_companion AND t.checkout_time IS NOT NULL)::int AS completed_today,
         COUNT(*) FILTER (WHERE ${pendingSql})::int AS pending_total,
         COUNT(*) FILTER (WHERE ${pendingSql} AND cardinality(${EFFECTIVE_CODES_SQL}) > 0)::int AS pending_with_anomaly,
         COUNT(*) FILTER (WHERE ${pendingSql} AND ${MISSING_CHECKOUT_SQL})::int AS pending_missing_checkout,
         COUNT(*) FILTER (WHERE ${pendingSql} AND t.anomaly_codes && ARRAY['DISTANCE_OVER_500M_IN','DISTANCE_OVER_500M_OUT']::text[])::int AS pending_distance
       FROM timekeeping_checkins t
       WHERE t.deleted_at IS NULL ${zoneClause};`,
      params
    );
    return res.rows[0];
  }

  /**
   * Bảng công tháng theo KSV (Q-1, Q-2, Q-5, Q-10). Ngày công = số ngày VN khác nhau có ca chính APPROVED/FLAGGED_WARNING.
   */
  static async getAttendanceSummary(zoneIds: string[] | null, month: string, client?: Queryable): Promise<AttendanceSummaryRow[]> {
    await this.ensureCompanionColumns();
    const params: unknown[] = [month];
    let zoneClause = '';
    let surveyZoneJoin = '';
    if (zoneIds) {
      params.push(zoneIds);
      zoneClause = `AND UPPER(t.zone_id) = ANY($2::text[])`;
      surveyZoneJoin = `JOIN parcels p ON p.id = r.parcel_id AND UPPER(p.zone_id) = ANY($2::text[])`;
    }

    const res = await run<AttendanceSummaryRow>(
      client,
      `WITH scoped AS (
         SELECT t.surveyor_id, t.is_companion, t.verification_status, t.checkout_time, t.work_duration_minutes,
                t.anomaly_codes, t.companion_name, t.companion_phone,
                ${WORK_DATE_SQL} AS work_date,
                ${MISSING_CHECKOUT_SQL} AS is_missing
         FROM timekeeping_checkins t
         WHERE t.deleted_at IS NULL
           AND t.checkin_time >= ${vnMonthStart('$1')}
           AND t.checkin_time < ${vnMonthEnd('$1')}
           ${zoneClause}
       ),
       main AS (
         SELECT surveyor_id,
           COUNT(DISTINCT work_date)::int AS total_shift_days,
           COUNT(DISTINCT work_date) FILTER (WHERE verification_status IN ('APPROVED','FLAGGED_WARNING'))::int AS work_days,
           COUNT(DISTINCT work_date) FILTER (WHERE verification_status = 'APPROVED')::int AS approved_days,
           COUNT(DISTINCT work_date) FILTER (WHERE verification_status = 'FLAGGED_WARNING')::int AS flagged_days,
           COUNT(DISTINCT work_date) FILTER (WHERE verification_status = 'REJECTED')::int AS rejected_days,
           COUNT(DISTINCT work_date) FILTER (WHERE verification_status = 'PENDING_VERIFICATION')::int AS pending_days,
           COUNT(DISTINCT work_date) FILTER (WHERE checkout_time IS NOT NULL)::int AS completed_checkout_days,
           COUNT(DISTINCT work_date) FILTER (WHERE is_missing)::int AS missing_checkout_days,
           COALESCE(SUM(work_duration_minutes) FILTER (
             WHERE checkout_time IS NOT NULL AND verification_status IN ('APPROVED','FLAGGED_WARNING')
           ), 0)::int AS total_work_minutes,
           COUNT(*) FILTER (WHERE cardinality(anomaly_codes) > 0 OR is_missing)::int AS anomaly_shift_count
         FROM scoped WHERE NOT is_companion GROUP BY surveyor_id
       ),
       comp AS (
         SELECT surveyor_id,
           COUNT(*)::int AS companion_checkins_total,
           COUNT(*) FILTER (WHERE verification_status IN ('APPROVED','FLAGGED_WARNING'))::int AS companion_accepted_count,
           COUNT(*) FILTER (WHERE verification_status = 'PENDING_VERIFICATION')::int AS companion_pending_count,
           jsonb_agg(DISTINCT jsonb_build_object('name', companion_name, 'phone', companion_phone)) AS companions
         FROM scoped WHERE is_companion GROUP BY surveyor_id
       ),
       ids AS (SELECT surveyor_id FROM main UNION SELECT surveyor_id FROM comp),
       surveys AS (
         SELECT r.surveyor_id, COUNT(*)::int AS surveys_submitted
         FROM base_survey_reports r
         ${surveyZoneJoin}
         WHERE r.deleted_at IS NULL
           AND r.submitted_at >= ${vnMonthStart('$1')}
           AND r.submitted_at < ${vnMonthEnd('$1')}
           AND r.surveyor_id IN (SELECT surveyor_id FROM ids)
         GROUP BY r.surveyor_id
       )
       SELECT
         u.id AS surveyor_id,
         u.full_name AS surveyor_name,
         u.surveyor_code,
         u.assigned_zone_id,
         COALESCE(m.total_shift_days, 0) AS total_shift_days,
         COALESCE(m.work_days, 0) AS work_days,
         COALESCE(m.approved_days, 0) AS approved_days,
         COALESCE(m.flagged_days, 0) AS flagged_days,
         COALESCE(m.rejected_days, 0) AS rejected_days,
         COALESCE(m.pending_days, 0) AS pending_days,
         COALESCE(m.completed_checkout_days, 0) AS completed_checkout_days,
         COALESCE(m.missing_checkout_days, 0) AS missing_checkout_days,
         COALESCE(m.total_work_minutes, 0) AS total_work_minutes,
         COALESCE(m.anomaly_shift_count, 0) AS anomaly_shift_count,
         COALESCE(c.companion_checkins_total, 0) AS companion_checkins_total,
         COALESCE(c.companion_accepted_count, 0) AS companion_accepted_count,
         COALESCE(c.companion_pending_count, 0) AS companion_pending_count,
         COALESCE(c.companions, '[]'::jsonb) AS companions,
         COALESCE(s.surveys_submitted, 0) AS surveys_submitted
       FROM ids
       JOIN users u ON u.id = ids.surveyor_id
       LEFT JOIN main m ON m.surveyor_id = ids.surveyor_id
       LEFT JOIN comp c ON c.surveyor_id = ids.surveyor_id
       LEFT JOIN surveys s ON s.surveyor_id = ids.surveyor_id
       ORDER BY u.full_name ASC, u.id ASC;`,
      params
    );
    return res.rows;
  }

  /** Ca PENDING thuộc bộ lọc, khóa dòng (bỏ qua dòng đang bị giao dịch khác giữ) cho Duyệt nhanh. */
  static async lockPendingBatchCandidates(
    client: Queryable,
    filters: CheckInListFilters,
    maxRows: number
  ): Promise<BatchCandidateRow[]> {
    const params: unknown[] = [];
    const whereClause = buildFilterClause({ ...filters, status: 'PENDING_VERIFICATION' }, params);
    params.push(maxRows);
    const res = await client.query<BatchCandidateRow>(
      `SELECT t.id, t.surveyor_id, t.zone_id, t.checkout_time, t.selfie_photo_url, t.is_companion,
              ${EFFECTIVE_CODES_SQL} AS effective_anomaly_codes,
              to_char(t.checkin_time AT TIME ZONE '${VN_TZ}', 'YYYY-MM') AS work_month
       ${CHECKIN_FROM}
       ${whereClause}
       ORDER BY t.checkin_time ASC
       LIMIT $${params.length}
       FOR UPDATE OF t SKIP LOCKED;`,
      params
    );
    return res.rows;
  }

  // --- KỲ CÔNG THÁNG ---

  static async listLockedPeriods(months: string[], client?: Queryable): Promise<Array<{ zone_id: string; period_month: string }>> {
    if (months.length === 0) return [];
    const res = await run<{ zone_id: string; period_month: string }>(
      client,
      `SELECT zone_id, period_month FROM attendance_periods WHERE status = 'LOCKED' AND period_month = ANY($1::text[]);`,
      [months]
    );
    return res.rows;
  }

  static async getPeriod(zoneId: string, month: string, client?: Queryable, forUpdate = false): Promise<AttendancePeriodRow | null> {
    const res = await run<AttendancePeriodRow>(
      client,
      `SELECT p.*, u.full_name AS locked_by_name
       FROM attendance_periods p
       LEFT JOIN users u ON u.id = p.locked_by
       WHERE p.zone_id = $1 AND p.period_month = $2
       LIMIT 1
       ${forUpdate ? 'FOR UPDATE OF p' : ''};`,
      [zoneId, month]
    );
    return res.rows[0] || null;
  }

  static async listSnapshots(periodId: string): Promise<AttendanceSnapshotRow[]> {
    const res = await Database.query<AttendanceSnapshotRow>(
      `SELECT s.id, s.period_id, s.zone_id, s.period_month, s.snapshot_sha256, s.locked_by,
              u.full_name AS locked_by_name, s.locked_at, s.unlocked_by, s.unlocked_at, s.unlock_reason,
              '{}'::jsonb AS snapshot_json
       FROM attendance_period_snapshots s
       LEFT JOIN users u ON u.id = s.locked_by
       WHERE s.period_id = $1
       ORDER BY s.locked_at DESC;`,
      [periodId]
    );
    return res.rows;
  }

  static async getSnapshotById(id: string): Promise<AttendanceSnapshotRow | null> {
    const res = await Database.query<AttendanceSnapshotRow>(
      `SELECT * FROM attendance_period_snapshots WHERE id = $1 LIMIT 1;`,
      [id]
    );
    return res.rows[0] || null;
  }

  static async listPendingIdsForPeriod(client: Queryable, zoneIds: string[], month: string): Promise<string[]> {
    const res = await client.query<{ id: string }>(
      `SELECT t.id FROM timekeeping_checkins t
       WHERE t.deleted_at IS NULL
         AND t.verification_status = 'PENDING_VERIFICATION'
         AND UPPER(t.zone_id) = ANY($1::text[])
         AND t.checkin_time >= ${vnMonthStart('$2')}
         AND t.checkin_time < ${vnMonthEnd('$2')}
       ORDER BY t.checkin_time ASC;`,
      [zoneIds, month]
    );
    return res.rows.map((r) => r.id);
  }

  static async lockPeriod(
    client: Queryable,
    data: { zoneId: string; month: string; adminId: string; snapshotJson: Record<string, unknown>; sha256: string }
  ): Promise<{ period: AttendancePeriodRow; snapshotId: string }> {
    const periodRes = await client.query<AttendancePeriodRow>(
      `INSERT INTO attendance_periods (zone_id, period_month, status, locked_by, locked_at, updated_at)
       VALUES ($1, $2, 'LOCKED', $3, NOW(), NOW())
       ON CONFLICT (zone_id, period_month) DO UPDATE
       SET status = 'LOCKED', locked_by = EXCLUDED.locked_by, locked_at = NOW(), updated_at = NOW()
       RETURNING *;`,
      [data.zoneId, data.month, data.adminId]
    );
    const period = periodRes.rows[0];
    const snapRes = await client.query<{ id: string }>(
      `INSERT INTO attendance_period_snapshots (period_id, zone_id, period_month, snapshot_json, snapshot_sha256, locked_by)
       VALUES ($1, $2, $3, $4::jsonb, $5, $6)
       RETURNING id;`,
      [period.id, data.zoneId, data.month, JSON.stringify(data.snapshotJson), data.sha256, data.adminId]
    );
    const snapshotId = snapRes.rows[0].id;
    await client.query(`UPDATE attendance_periods SET current_snapshot_id = $2 WHERE id = $1;`, [period.id, snapshotId]);
    return { period: { ...period, current_snapshot_id: snapshotId }, snapshotId };
  }

  static async unlockPeriod(
    client: Queryable,
    data: { periodId: string; snapshotId: string | null; adminId: string; reason: string }
  ): Promise<void> {
    await client.query(
      `UPDATE attendance_periods
       SET status = 'OPEN', unlocked_by = $2, unlocked_at = NOW(), unlock_reason = $3, updated_at = NOW()
       WHERE id = $1;`,
      [data.periodId, data.adminId, data.reason]
    );
    if (data.snapshotId) {
      await client.query(
        `UPDATE attendance_period_snapshots
         SET unlocked_by = $2, unlocked_at = NOW(), unlock_reason = $3
         WHERE id = $1 AND unlocked_at IS NULL;`,
        [data.snapshotId, data.adminId, data.reason]
      );
    }
  }
}
