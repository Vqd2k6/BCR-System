import type { JwtPayload } from '../../common/guards/auth.guard';
import { AttendanceRepository, type AttendanceSummaryRow, type CheckInListFilters, type TimekeepingCheckInEntity } from './attendance.repository';
import { Database } from '../../database/db';
import { StorageService } from '../../common/services/storage.service';
import { AppError, NotFoundError, BadRequestError, ConflictError, ForbiddenError } from '../../common/errors/problem-details';
import {
  BATCH_MAX_APPROVE,
  ZONE_RADIUS_METERS,
  buildCheckInAnomalies,
  buildCheckOutAnomalies,
  canAdminAccessCheckInZone,
  canonicalJson,
  classifyBatchCandidate,
  getVietnamDateStr,
  getVietnamMonthStr,
  isZoneCoveredByPeriod,
  isZoneWithinAssignment,
  resolveAdminZoneScope,
  sanitizeCsvCell,
  sha256Hex,
  validateVerifyTransition,
  type BatchSkipReason,
  type VerifyAction,
} from './attendance.rules';

const PERIOD_LOCKED_MESSAGE = 'Kỳ công tháng này đã được chốt. Cần Super Admin mở khóa kỳ trước khi thay đổi.';

export class AttendanceService {
  /**
   * Giải quyết tọa độ trọng tâm của phân khu (Single Source of Truth):
   * ưu tiên ST_Centroid(ST_Union(geom)) các thửa đất của zone, sau đó center_geom trong metro_zones.
   * Không có tâm Zone, hoặc có GPS mà không tính được khoảng cách -> từ chối (không lưu khoảng cách giả).
   */
  static async resolveZoneCentroidAndDistance(
    rawZoneId: string,
    gpsLongitude?: number,
    gpsLatitude?: number
  ): Promise<{
    zoneId: string;
    zoneName: string;
    centroid: { lat: number; lng: number };
    distanceMeters: number | null;
  }> {
    const normalizedZoneId = (rawZoneId || '').trim().toUpperCase();
    if (!normalizedZoneId) {
      throw new BadRequestError('Chưa xác định được phân khu (Zone) để chấm công.');
    }

    const queryRes = await Database.query<{
      zone_code: string;
      zone_name: string | null;
      lng: number;
      lat: number;
      distance_meters: number | null;
    }>(
      `WITH target_geom AS (
         SELECT
           COALESCE(
             (
               SELECT ST_SetSRID(ST_Centroid(ST_Union(COALESCE(p.cadastral_polygon_geom, p.location_geom))), 4326)
               FROM parcels p
               WHERE UPPER(p.zone_id) = $1
                 AND (p.cadastral_polygon_geom IS NOT NULL OR p.location_geom IS NOT NULL)
             ),
             (
               SELECT mz.center_geom
               FROM metro_zones mz
               WHERE UPPER(mz.zone_code) = $1
               LIMIT 1
             )
           ) AS center_pt,
           (SELECT mz.zone_name FROM metro_zones mz WHERE UPPER(mz.zone_code) = $1 LIMIT 1) AS resolved_name
       )
       SELECT
         $1::text AS zone_code,
         resolved_name AS zone_name,
         ST_X(center_pt) AS lng,
         ST_Y(center_pt) AS lat,
         CASE
           WHEN $2::double precision IS NOT NULL AND $3::double precision IS NOT NULL
           THEN ST_Distance(
             center_pt::geography,
             ST_SetSRID(ST_MakePoint($2::double precision, $3::double precision), 4326)::geography
           )
           ELSE NULL
         END AS distance_meters
       FROM target_geom
       WHERE center_pt IS NOT NULL;`,
      [
        normalizedZoneId,
        typeof gpsLongitude === 'number' ? gpsLongitude : null,
        typeof gpsLatitude === 'number' ? gpsLatitude : null,
      ]
    );

    if (queryRes.rows.length === 0) {
      throw new BadRequestError(`Mã phân khu "${rawZoneId}" không tồn tại hoặc chưa có tọa độ trọng tâm hợp lệ.`);
    }

    const row = queryRes.rows[0];
    const distanceMeters =
      typeof row.distance_meters === 'number' && !Number.isNaN(row.distance_meters)
        ? Math.round(row.distance_meters * 100) / 100
        : null;

    return {
      zoneId: row.zone_code,
      zoneName: row.zone_name || normalizedZoneId,
      centroid: { lat: Number(row.lat), lng: Number(row.lng) },
      distanceMeters,
    };
  }

  private static async resolveRequiredDistance(zoneId: string, lng: number, lat: number) {
    const resolved = await this.resolveZoneCentroidAndDistance(zoneId, lng, lat);
    if (resolved.distanceMeters === null) {
      throw new BadRequestError('Không tính được khoảng cách GPS tới tâm phân khu. Vui lòng bật lại định vị và thử lại.');
    }
    return { ...resolved, distanceMeters: resolved.distanceMeters };
  }

  private static async uploadSelfieIfBase64(
    rawUrl: string | null | undefined,
    meta: { prefix: string; zoneId: string; surveyorId: string; extra: Record<string, string> }
  ): Promise<string | null> {
    const url = rawUrl?.trim() || null;
    if (!url || !url.startsWith('data:image/')) return url;
    const folder = `attendance/${meta.zoneId}/${getVietnamDateStr()}`;
    const uploadRes = await StorageService.uploadBase64(url, meta.prefix, folder, {
      'surveyor-id': meta.surveyorId,
      'zone-id': meta.zoneId,
      ...meta.extra,
    });
    return uploadRes.url;
  }

  static async checkIn(
    surveyorId: string,
    data: {
      zoneId: string;
      gpsLatitude: number;
      gpsLongitude: number;
      gpsAccuracyMeters?: number | null;
      selfiePhotoUrl: string;
      notes?: string | null;
      isCompanion?: boolean;
      companionName?: string | null;
      companionRole?: string | null;
      companionPhone?: string | null;
    }
  ) {
    const isCompanion = Boolean(data.isCompanion);

    // 1. Kiểm tra sớm (trước khi upload ảnh) — kiểm tra lại trong transaction bên dưới.
    if (isCompanion) {
      const todayCompanionCount = await AttendanceRepository.countTodayCompanionCheckIns(surveyorId);
      if (todayCompanionCount >= 3) {
        throw new BadRequestError('Đã đạt giới hạn tối đa 3 lần điểm danh / đổi cán bộ đi kèm trong ngày hôm nay.');
      }
    } else if (await AttendanceRepository.findTodayMainCheckIn(surveyorId)) {
      throw new ConflictError('Bạn đã chấm công ca hôm nay. Mỗi ngày chỉ có 1 ca chính.');
    }

    // 2. Zone do KSV chọn; ngoài nhóm Zone được phân công thì gắn cờ và bắt buộc lý do (Q-4).
    const assignedZone = await AttendanceRepository.getUserAssignedZone(surveyorId);
    const zoneResolved = await this.resolveRequiredDistance(data.zoneId, data.gpsLongitude, data.gpsLatitude);
    const distanceMeters = zoneResolved.distanceMeters;
    const zoneWithinAssignment = isZoneWithinAssignment(assignedZone, zoneResolved.zoneId);
    const anomalyCodes = buildCheckInAnomalies({ distanceMeters, zoneWithinAssignment });
    const cleanNotes = data.notes?.trim() || null;

    if (distanceMeters > ZONE_RADIUS_METERS && !cleanNotes) {
      throw new BadRequestError(
        `Vị trí hiện tại cách trọng tâm ${zoneResolved.zoneName} ${Math.round(distanceMeters)}m (>${ZONE_RADIUS_METERS}m). Vui lòng nhập lý do chấm công ngoài phạm vi.`
      );
    }
    if (!zoneWithinAssignment && !cleanNotes) {
      throw new BadRequestError(
        assignedZone
          ? `Phân khu ${zoneResolved.zoneId} không thuộc phân khu được phân công (${assignedZone}). Vui lòng nhập lý do chấm công tại phân khu khác.`
          : 'Tài khoản chưa được phân công phân khu. Vui lòng nhập lý do chấm công tại phân khu đã chọn.'
      );
    }

    const reasons: string[] = [];
    if (anomalyCodes.includes('DISTANCE_OVER_500M_IN')) {
      reasons.push(`Vị trí chấm công cách tâm ${zoneResolved.zoneName} [${distanceMeters}m] (vượt ngưỡng cho phép ${ZONE_RADIUS_METERS}m)`);
    }
    if (anomalyCodes.includes('ZONE_NOT_ASSIGNED')) {
      reasons.push(`Chấm công tại ${zoneResolved.zoneId} ngoài phân khu được phân công (${assignedZone || 'chưa phân công'})`);
    }

    // 3. Ảnh selfie lưu qua StorageService (không lưu Base64 vào DB).
    const storedSelfieUrl = await this.uploadSelfieIfBase64(data.selfiePhotoUrl, {
      prefix: isCompanion ? `selfie_companion_${surveyorId.slice(0, 8)}` : `selfie_ksv_${surveyorId.slice(0, 8)}`,
      zoneId: zoneResolved.zoneId,
      surveyorId,
      extra: {
        'is-companion': String(isCompanion),
        'companion-name': isCompanion ? (data.companionName || '') : '',
        'gps-lat': String(data.gpsLatitude),
        'gps-lng': String(data.gpsLongitude),
        'distance-m': String(distanceMeters),
      },
    });

    // 4. Ghi trong transaction, tuần tự theo KSV: chặn bấm 2 lần / 2 máy cùng lúc.
    const { checkIn, todayCompanionCount } = await Database.transaction(async (client) => {
      await AttendanceRepository.lockSurveyor(client, surveyorId);
      let companionCount = 0;
      if (isCompanion) {
        companionCount = await AttendanceRepository.countTodayCompanionCheckIns(surveyorId, client);
        if (companionCount >= 3) {
          throw new BadRequestError('Đã đạt giới hạn tối đa 3 lần điểm danh / đổi cán bộ đi kèm trong ngày hôm nay.');
        }
      } else if (await AttendanceRepository.findTodayMainCheckIn(surveyorId, client)) {
        throw new ConflictError('Bạn đã chấm công ca hôm nay. Mỗi ngày chỉ có 1 ca chính.');
      }
      const created = await AttendanceRepository.createCheckIn(client, {
        surveyorId,
        zoneId: zoneResolved.zoneId,
        gpsLatitude: data.gpsLatitude,
        gpsLongitude: data.gpsLongitude,
        gpsAccuracyMeters: data.gpsAccuracyMeters,
        distanceToCenterMeters: distanceMeters,
        isWithinBoundary: distanceMeters <= ZONE_RADIUS_METERS,
        selfiePhotoUrl: storedSelfieUrl,
        notes: cleanNotes,
        anomalyCodes,
        anomalyReason: reasons.length > 0 ? reasons.join('; ') : null,
        zoneCenter: zoneResolved.centroid,
        assignedZoneAtCheckIn: assignedZone,
        isCompanion,
        companionName: data.companionName,
        companionRole: data.companionRole,
        companionPhone: data.companionPhone,
      });
      return { checkIn: created, todayCompanionCount: companionCount };
    });

    return {
      checkInId: checkIn.id,
      checkInTime: checkIn.checkin_time,
      zoneId: checkIn.zone_id,
      zoneName: zoneResolved.zoneName,
      distanceToCenterMeters: distanceMeters,
      verificationStatus: checkIn.verification_status,
      hasAnomalyFlag: checkIn.has_anomaly_flag,
      anomalyReason: checkIn.anomaly_reason,
      anomalyCodes: checkIn.anomaly_codes,
      selfiePhotoUrl: checkIn.selfie_photo_url,
      isCompanion: checkIn.is_companion,
      companionName: checkIn.companion_name,
      companionRole: checkIn.companion_role,
      companionPhone: checkIn.companion_phone,
      todayCompanionCount: isCompanion ? todayCompanionCount + 1 : undefined,
      message: anomalyCodes.length > 0
        ? 'Chấm công thành công nhưng hệ thống ghi nhận cảnh báo cần Admin hậu kiểm'
        : 'Chấm công GPS thành công trong phạm vi Ga',
    };
  }

  static async checkOut(
    surveyorId: string,
    data: {
      checkInId?: string | null;
      gpsLatitude: number;
      gpsLongitude: number;
      gpsAccuracyMeters?: number | null;
      selfiePhotoUrl?: string | null;
      notes?: string | null;
      isCompanion?: boolean;
    }
  ) {
    const isCompanion = Boolean(data.isCompanion);
    const cleanNotes = data.notes?.trim() || null;

    // Kiểm tra sớm để xác định ca + Zone trước khi upload ảnh (không khóa dòng).
    const preview = await Database.transaction(async (client) =>
      AttendanceRepository.findOpenTodayCheckInsForCheckOut(client, surveyorId, isCompanion, data.checkInId)
    );
    const target = this.pickCheckOutTarget(preview, isCompanion, data.checkInId);

    // Zone của Check-out luôn là Zone của ca (A5), không nhận Zone từ client.
    const zoneResolved = await this.resolveRequiredDistance(target.zone_id, data.gpsLongitude, data.gpsLatitude);
    const distanceMeters = zoneResolved.distanceMeters;
    if (distanceMeters > ZONE_RADIUS_METERS && !cleanNotes) {
      throw new BadRequestError(
        `Vị trí Check-out cách trọng tâm ${zoneResolved.zoneName} ${Math.round(distanceMeters)}m (>${ZONE_RADIUS_METERS}m). Vui lòng nhập lý do Check-out ngoài phạm vi.`
      );
    }

    const storedCheckoutSelfieUrl = await this.uploadSelfieIfBase64(data.selfiePhotoUrl, {
      prefix: isCompanion ? `checkout_companion_${surveyorId.slice(0, 8)}` : `checkout_ksv_${surveyorId.slice(0, 8)}`,
      zoneId: zoneResolved.zoneId,
      surveyorId,
      extra: {
        'is-companion': String(isCompanion),
        'action-type': 'CHECK_OUT',
        'gps-lat': String(data.gpsLatitude),
        'gps-lng': String(data.gpsLongitude),
        'distance-m': String(distanceMeters),
      },
    });

    const updated = await Database.transaction(async (client) => {
      await AttendanceRepository.lockSurveyor(client, surveyorId);
      const rows = await AttendanceRepository.findOpenTodayCheckInsForCheckOut(client, surveyorId, isCompanion, target.id);
      const existing = this.pickCheckOutTarget(rows, isCompanion, target.id);

      const month = getVietnamMonthStr(new Date(existing.checkin_time));
      await this.assertPeriodOpen(existing.zone_id, month, client);

      const durationMinutes = Math.max(1, Math.round((Date.now() - new Date(existing.checkin_time).getTime()) / 60000));
      const anomalyCodes = buildCheckOutAnomalies({
        existing: existing.anomaly_codes || [],
        distanceMeters,
        durationMinutes,
      });

      const row = await AttendanceRepository.updateCheckOut(client, {
        checkInId: existing.id,
        gpsLatitude: data.gpsLatitude,
        gpsLongitude: data.gpsLongitude,
        gpsAccuracyMeters: data.gpsAccuracyMeters,
        distanceToCenterMeters: distanceMeters,
        selfiePhotoUrl: storedCheckoutSelfieUrl,
        notes: cleanNotes,
        anomalyCodes,
        zoneCenter: zoneResolved.centroid,
      });
      if (!row) {
        throw new ConflictError('Ca làm việc này đã Check-out trước đó, không thể ghi đè giờ ra.');
      }
      return row;
    });

    return {
      checkInId: updated.id,
      checkInTime: updated.checkin_time,
      checkOutTime: updated.checkout_time,
      zoneId: updated.zone_id,
      zoneName: zoneResolved.zoneName,
      distanceToCenterMeters: Number(updated.distance_to_zone_center_meters),
      checkOutDistanceToCenterMeters: Number(updated.checkout_distance_to_zone_center_meters),
      selfiePhotoUrl: updated.selfie_photo_url,
      checkOutSelfiePhotoUrl: updated.checkout_selfie_photo_url,
      checkOutNotes: updated.checkout_notes,
      workDurationMinutes: updated.work_duration_minutes ?? null,
      verificationStatus: updated.verification_status,
      anomalyCodes: updated.anomaly_codes,
      isCompanion: updated.is_companion,
      companionName: updated.companion_name,
      companionRole: updated.companion_role,
      companionPhone: updated.companion_phone,
      message: isCompanion
        ? `Đã Check-out kết thúc ca cho cán bộ đi kèm (${updated.companion_name || 'Cán bộ đi kèm'}) thành công!`
        : 'Đã Check-out kết thúc ca làm việc thực địa thành công!',
    };
  }

  /** Chọn đúng ca để Check-out; không tự đoán khi có nhiều lượt đi kèm đang mở (D-3). */
  private static pickCheckOutTarget(
    rows: TimekeepingCheckInEntity[],
    isCompanion: boolean,
    checkInId?: string | null
  ): TimekeepingCheckInEntity {
    if (rows.length === 0) {
      throw new BadRequestError(
        checkInId
          ? 'Không tìm thấy ca chấm công hôm nay tương ứng để Check-out.'
          : isCompanion
            ? 'Cán bộ đi kèm chưa thực hiện Check-in hôm nay nên không thể Check-out.'
            : 'Bạn chưa thực hiện Check-in bắt đầu ca hôm nay nên không thể Check-out.'
      );
    }
    const open = rows.filter((r) => !r.checkout_time);
    if (open.length === 0) {
      throw new ConflictError('Ca làm việc hôm nay đã Check-out trước đó, không thể ghi đè giờ ra.');
    }
    if (open.length > 1 && !checkInId) {
      throw new BadRequestError('Đang có nhiều cán bộ đi kèm chưa Check-out. Vui lòng chọn đúng người cần Check-out.');
    }
    const target = open[0];
    if (target.verification_status !== 'PENDING_VERIFICATION') {
      throw new ConflictError('Ca chấm công đã được Admin xử lý, không thể thay đổi thông tin Check-out.');
    }
    return target;
  }

  /** Thông tin tâm Zone; kèm cờ Zone có thuộc phân công của người hỏi không (để form bắt buộc lý do đúng lúc). */
  static async getZoneInfo(zoneId: string, userId?: string) {
    const resolved = await this.resolveZoneCentroidAndDistance(zoneId);
    const assignedZoneId = userId ? await AttendanceRepository.getUserAssignedZone(userId) : null;
    return {
      zoneId: resolved.zoneId,
      zoneName: resolved.zoneName,
      centroid: resolved.centroid,
      assignedZoneId,
      isWithinAssignment: userId ? isZoneWithinAssignment(assignedZoneId, resolved.zoneId) : null,
    };
  }

  static async getMyHistory(
    surveyorId: string,
    fromDate?: string,
    toDate?: string,
    isCompanion?: boolean
  ) {
    return AttendanceRepository.listCheckIns({
      surveyorId,
      fromDate,
      toDate,
      isCompanion,
      limit: 100,
    });
  }

  // --- ADMIN ---

  static async listZoneCheckIns(user: JwtPayload, requestedZone: string | undefined, filters: Omit<CheckInListFilters, 'zoneIds'>) {
    const scope = resolveAdminZoneScope(user, requestedZone);
    const result = await AttendanceRepository.listCheckIns({ ...filters, zoneIds: scope.zoneIds });
    const lockedMap = await this.buildLockedLookup(result.checkIns.map((c) => ({ zoneId: c.zone_id, checkinTime: c.checkin_time })));
    return {
      scope: scope.scopeKey,
      total: result.total,
      checkIns: result.checkIns.map((c) => ({
        ...c,
        is_period_locked: lockedMap(c.zone_id, getVietnamMonthStr(new Date(c.checkin_time))),
      })),
    };
  }

  /** Ngoài phạm vi Zone của Admin -> 404 (không lộ việc ca tồn tại). */
  private static assertAdminCanSee(user: JwtPayload, checkIn: TimekeepingCheckInEntity | null, id: string): TimekeepingCheckInEntity {
    if (!checkIn || !canAdminAccessCheckInZone(user, checkIn.zone_id)) {
      throw new NotFoundError(`Không tìm thấy lượt chấm công với ID: ${id}`);
    }
    return checkIn;
  }

  static async getCheckInDetail(user: JwtPayload, id: string) {
    const checkIn = this.assertAdminCanSee(user, await AttendanceRepository.getCheckInById(id), id);
    const month = getVietnamMonthStr(new Date(checkIn.checkin_time));
    const [history, companions, lockedMap] = await Promise.all([
      AttendanceRepository.getAuditHistory(id),
      checkIn.is_companion || !checkIn.work_date
        ? Promise.resolve([] as TimekeepingCheckInEntity[])
        : AttendanceRepository.listCompanionsForShift(checkIn.surveyor_id, checkIn.work_date),
      this.buildLockedLookup([{ zoneId: checkIn.zone_id, checkinTime: checkIn.checkin_time }]),
    ]);
    return {
      ...checkIn,
      is_period_locked: lockedMap(checkIn.zone_id, month),
      is_own_checkin: checkIn.surveyor_id === user.userId,
      verification_history: history,
      companions: companions.filter((c) => canAdminAccessCheckInZone(user, c.zone_id)),
    };
  }

  static async verifyAttendance(
    user: JwtPayload,
    id: string,
    action: VerifyAction,
    notes?: string | null,
    clientIp?: string
  ) {
    const cleanNotes = notes?.trim() || null;

    return Database.transaction(async (client) => {
      const preview = this.assertAdminCanSee(user, await AttendanceRepository.getCheckInById(id, { client }), id);
      const month = getVietnamMonthStr(new Date(preview.checkin_time));
      await AttendanceRepository.lockPeriodMonth(client, month);

      const checkIn = this.assertAdminCanSee(user, await AttendanceRepository.getCheckInById(id, { client, forUpdate: true }), id);
      if (checkIn.surveyor_id === user.userId) {
        throw new ForbiddenError('Không được tự duyệt ca chấm công của chính mình. Ca này do Super Admin duyệt.');
      }
      await this.assertPeriodOpen(checkIn.zone_id, month, client);

      const transition = validateVerifyTransition({
        previousStatus: checkIn.verification_status,
        action,
        notes: cleanNotes,
      });
      if (transition.error) {
        if (transition.nextStatus === checkIn.verification_status) throw new ConflictError(transition.error);
        throw new BadRequestError(transition.error);
      }

      const updated = await AttendanceRepository.updateVerification(client, id, user.userId, transition.nextStatus, cleanNotes);
      if (!updated) throw new NotFoundError(`Không tìm thấy lượt chấm công với ID: ${id}`);

      await AttendanceRepository.insertAudit(client, {
        entityType: 'TIMEKEEPING_CHECKIN',
        entityId: id,
        action: `VERIFY_${action}`,
        performedBy: user.userId,
        clientIp,
        payload: {
          previousStatus: checkIn.verification_status,
          newStatus: transition.nextStatus,
          isCompanion: checkIn.is_companion,
          companionName: checkIn.companion_name,
          anomalyCodes: checkIn.effective_anomaly_codes ?? checkIn.anomaly_codes,
          notes: cleanNotes,
          recordSha256: this.hashCheckInRecord(checkIn),
        },
      });

      return {
        checkInId: updated.id,
        verificationStatus: updated.verification_status,
        verifiedAt: updated.verified_at,
        verificationNotes: updated.verification_notes,
        message: action === 'APPROVE' ? 'Đã xác nhận ngày công hợp lệ' : `Đã chuyển trạng thái chấm công thành [${transition.nextStatus}]`,
      };
    });
  }

  /** Mã băm nội dung chứng cứ của ca (vị trí, thời gian, ảnh) tại thời điểm duyệt. */
  private static hashCheckInRecord(c: TimekeepingCheckInEntity): string {
    return sha256Hex(canonicalJson({
      id: c.id,
      surveyorId: c.surveyor_id,
      zoneId: c.zone_id,
      checkinTime: c.checkin_time,
      gps: [c.gps_longitude ?? null, c.gps_latitude ?? null],
      distance: c.distance_to_zone_center_meters,
      selfie: c.selfie_photo_url,
      notes: c.notes,
      checkoutTime: c.checkout_time ?? null,
      checkoutGps: [c.checkout_gps_longitude ?? null, c.checkout_gps_latitude ?? null],
      checkoutDistance: c.checkout_distance_to_zone_center_meters ?? null,
      checkoutSelfie: c.checkout_selfie_photo_url ?? null,
      checkoutNotes: c.checkout_notes ?? null,
      durationMinutes: c.work_duration_minutes ?? null,
      anomalyCodes: c.anomaly_codes,
      isCompanion: c.is_companion,
      companionName: c.companion_name,
      companionPhone: c.companion_phone,
    }));
  }

  /** Duyệt nhanh các ca sạch hoàn toàn trong bộ lọc hiện tại (Q-9). Server tự chọn ca, không nhận danh sách id. */
  static async batchVerifyClean(
    user: JwtPayload,
    requestedZone: string | undefined,
    filters: Omit<CheckInListFilters, 'zoneIds' | 'status' | 'limit' | 'offset' | 'surveyorId'>,
    dryRun: boolean,
    clientIp?: string
  ) {
    const scope = resolveAdminZoneScope(user, requestedZone);

    return Database.transaction(async (client) => {
      const candidates = await AttendanceRepository.lockPendingBatchCandidates(
        client,
        { ...filters, zoneIds: scope.zoneIds },
        5000
      );
      const months = Array.from(new Set(candidates.map((c) => c.work_month)));
      for (const m of months.sort()) await AttendanceRepository.lockPeriodMonth(client, m);
      const lockedPeriods = await AttendanceRepository.listLockedPeriods(months, client);
      const isLocked = (zoneId: string, month: string) =>
        lockedPeriods.some((p) => p.period_month === month && isZoneCoveredByPeriod(p.zone_id, zoneId));

      const skipped: Record<BatchSkipReason, number> = {
        SELF_CHECKIN: 0,
        NOT_CHECKED_OUT: 0,
        HAS_ANOMALY: 0,
        NO_SELFIE: 0,
        PERIOD_LOCKED: 0,
        OUT_OF_SCOPE: 0,
        BATCH_LIMIT: 0,
      };
      const eligible: string[] = [];
      for (const c of candidates) {
        if (!canAdminAccessCheckInZone(user, c.zone_id)) {
          skipped.OUT_OF_SCOPE += 1;
          continue;
        }
        const reason = classifyBatchCandidate({
          surveyorId: c.surveyor_id,
          adminId: user.userId,
          checkoutTime: c.checkout_time,
          anomalyCodes: c.effective_anomaly_codes || [],
          selfiePhotoUrl: c.selfie_photo_url,
          periodLocked: isLocked(c.zone_id, c.work_month),
        });
        if (reason) {
          skipped[reason] += 1;
        } else if (eligible.length >= BATCH_MAX_APPROVE) {
          skipped.BATCH_LIMIT += 1;
        } else {
          eligible.push(c.id);
        }
      }

      if (!dryRun) {
        const batchNote = 'Duyệt nhanh: ca hợp lệ, không có cảnh báo hệ thống';
        for (const id of eligible) {
          const checkIn = await AttendanceRepository.getCheckInById(id, { client });
          await AttendanceRepository.updateVerification(client, id, user.userId, 'APPROVED', batchNote);
          await AttendanceRepository.insertAudit(client, {
            entityType: 'TIMEKEEPING_CHECKIN',
            entityId: id,
            action: 'VERIFY_APPROVE_BATCH',
            performedBy: user.userId,
            clientIp,
            payload: {
              previousStatus: 'PENDING_VERIFICATION',
              newStatus: 'APPROVED',
              isCompanion: checkIn?.is_companion ?? null,
              notes: batchNote,
              recordSha256: checkIn ? this.hashCheckInRecord(checkIn) : null,
            },
          });
        }
      }

      return {
        dryRun,
        scope: scope.scopeKey,
        eligibleCount: eligible.length,
        approvedIds: dryRun ? [] : eligible,
        skipped,
      };
    });
  }

  static async getCounters(user: JwtPayload, requestedZone: string | undefined) {
    const scope = resolveAdminZoneScope(user, requestedZone);
    const row = await AttendanceRepository.getCounters(scope.zoneIds);
    return { scope: scope.scopeKey, ...row };
  }

  static async getSummary(user: JwtPayload, requestedZone: string | undefined, month: string) {
    const scope = resolveAdminZoneScope(user, requestedZone);
    const rows = await AttendanceRepository.getAttendanceSummary(scope.zoneIds, month);
    const period = scope.scopeKey === 'ALL' ? null : await AttendanceRepository.getPeriod(scope.scopeKey, month);
    return {
      scope: scope.scopeKey,
      month,
      period: period
        ? { status: period.status, lockedAt: period.locked_at, lockedByName: period.locked_by_name ?? null, currentSnapshotId: period.current_snapshot_id }
        : { status: 'OPEN', lockedAt: null, lockedByName: null, currentSnapshotId: null },
      rows: rows.map((r) => this.normalizeSummaryRow(r)),
    };
  }

  private static normalizeSummaryRow(r: AttendanceSummaryRow): AttendanceSummaryRow {
    const companions = (r.companions || [])
      .filter((c) => c.name || c.phone)
      .sort((a, b) => `${a.name || ''}|${a.phone || ''}`.localeCompare(`${b.name || ''}|${b.phone || ''}`, 'vi'));
    return { ...r, companions };
  }

  // --- KỲ CÔNG ---

  private static async buildLockedLookup(items: Array<{ zoneId: string; checkinTime: Date }>) {
    const months = Array.from(new Set(items.map((i) => getVietnamMonthStr(new Date(i.checkinTime)))));
    const locked = await AttendanceRepository.listLockedPeriods(months);
    return (zoneId: string, month: string) =>
      locked.some((p) => p.period_month === month && isZoneCoveredByPeriod(p.zone_id, zoneId));
  }

  private static async assertPeriodOpen(zoneId: string, month: string, client: Parameters<typeof AttendanceRepository.listLockedPeriods>[1]) {
    const locked = await AttendanceRepository.listLockedPeriods([month], client);
    if (locked.some((p) => isZoneCoveredByPeriod(p.zone_id, zoneId))) {
      throw new AppError(PERIOD_LOCKED_MESSAGE, 409, 'PERIOD_LOCKED');
    }
  }

  /** Kỳ chốt phải là một Zone cụ thể. */
  private static resolvePeriodZone(user: JwtPayload, requestedZone: string | undefined): { zoneKey: string; zoneIds: string[] } {
    const scope = resolveAdminZoneScope(user, requestedZone);
    if (!scope.zoneIds) {
      throw new BadRequestError('Vui lòng chọn một phân khu cụ thể để chốt / mở kỳ công.');
    }
    return { zoneKey: scope.scopeKey, zoneIds: scope.zoneIds };
  }

  static async getPeriodStatus(user: JwtPayload, requestedZone: string | undefined, month: string) {
    const { zoneKey, zoneIds } = this.resolvePeriodZone(user, requestedZone);
    const period = await AttendanceRepository.getPeriod(zoneKey, month);
    const pendingIds = await Database.transaction(async (client) =>
      AttendanceRepository.listPendingIdsForPeriod(client, zoneIds, month)
    );
    const snapshots = period ? await AttendanceRepository.listSnapshots(period.id) : [];
    return {
      zoneId: zoneKey,
      month,
      status: period?.status ?? 'OPEN',
      lockedAt: period?.locked_at ?? null,
      lockedByName: period?.locked_by_name ?? null,
      currentSnapshotId: period?.current_snapshot_id ?? null,
      canLock: this.isLockableMonth(month) && pendingIds.length === 0 && period?.status !== 'LOCKED',
      lockableMonth: this.isLockableMonth(month),
      pendingCount: pendingIds.length,
      pendingIds: pendingIds.slice(0, 200),
      snapshots: snapshots.map((s) => ({
        id: s.id,
        sha256: s.snapshot_sha256,
        lockedAt: s.locked_at,
        lockedByName: s.locked_by_name ?? null,
        unlockedAt: s.unlocked_at,
        unlockReason: s.unlock_reason,
      })),
    };
  }

  /** Chỉ chốt được tháng đã kết thúc (giờ VN), để check-in mới không rơi vào kỳ đã khóa. */
  private static isLockableMonth(month: string): boolean {
    return month < getVietnamMonthStr();
  }

  static async lockPeriod(user: JwtPayload, requestedZone: string | undefined, month: string, clientIp?: string) {
    const { zoneKey, zoneIds } = this.resolvePeriodZone(user, requestedZone);
    if (!this.isLockableMonth(month)) {
      throw new BadRequestError('Chỉ chốt được kỳ công của tháng đã kết thúc.');
    }

    return Database.transaction(async (client) => {
      await AttendanceRepository.lockPeriodMonth(client, month);
      const existing = await AttendanceRepository.getPeriod(zoneKey, month, client, true);
      if (existing?.status === 'LOCKED') {
        throw new ConflictError('Kỳ công này đã được chốt trước đó.');
      }
      const pendingIds = await AttendanceRepository.listPendingIdsForPeriod(client, zoneIds, month);
      if (pendingIds.length > 0) {
        throw new AppError(`Còn ${pendingIds.length} ca chờ duyệt trong kỳ. Cần xử lý hết trước khi chốt kỳ công.`, 409, 'PERIOD_HAS_PENDING');
      }

      const rows = (await AttendanceRepository.getAttendanceSummary(zoneIds, month, client)).map((r) => this.normalizeSummaryRow(r));
      const snapshotJson = {
        schemaVersion: 1,
        zoneId: zoneKey,
        zoneIds,
        month,
        lockedBy: user.userId,
        rows,
      };
      const sha256 = sha256Hex(canonicalJson(snapshotJson));
      const { period, snapshotId } = await AttendanceRepository.lockPeriod(client, {
        zoneId: zoneKey,
        month,
        adminId: user.userId,
        snapshotJson,
        sha256,
      });
      await AttendanceRepository.insertAudit(client, {
        entityType: 'ATTENDANCE_PERIOD',
        entityId: period.id,
        action: 'PERIOD_LOCK',
        performedBy: user.userId,
        clientIp,
        payload: { zoneId: zoneKey, month, snapshotId, snapshotSha256: sha256, rowCount: rows.length },
      });
      return { periodId: period.id, zoneId: zoneKey, month, status: 'LOCKED', snapshotId, sha256 };
    });
  }

  static async unlockPeriod(user: JwtPayload, requestedZone: string | undefined, month: string, reason: string, clientIp?: string) {
    if (user.role !== 'SUPER_ADMIN') {
      throw new ForbiddenError('Chỉ Super Admin được mở khóa kỳ công.');
    }
    const cleanReason = reason.trim();
    if (!cleanReason) throw new BadRequestError('Bắt buộc nhập lý do mở khóa kỳ công.');
    const { zoneKey } = this.resolvePeriodZone(user, requestedZone);

    return Database.transaction(async (client) => {
      await AttendanceRepository.lockPeriodMonth(client, month);
      const period = await AttendanceRepository.getPeriod(zoneKey, month, client, true);
      if (!period || period.status !== 'LOCKED') {
        throw new ConflictError('Kỳ công này chưa được chốt.');
      }
      await AttendanceRepository.unlockPeriod(client, {
        periodId: period.id,
        snapshotId: period.current_snapshot_id,
        adminId: user.userId,
        reason: cleanReason,
      });
      await AttendanceRepository.insertAudit(client, {
        entityType: 'ATTENDANCE_PERIOD',
        entityId: period.id,
        action: 'PERIOD_UNLOCK',
        performedBy: user.userId,
        clientIp,
        payload: { zoneId: zoneKey, month, snapshotId: period.current_snapshot_id, reason: cleanReason },
      });
      return { periodId: period.id, zoneId: zoneKey, month, status: 'OPEN' };
    });
  }

  /**
   * Xuất CSV bảng công tháng (UTF-8 BOM, chống formula injection).
   * Kỳ đã khóa xuất từ snapshot để khớp từng chữ với bản đã chốt.
   */
  static async exportSummaryCsv(user: JwtPayload, requestedZone: string | undefined, month: string) {
    const scope = resolveAdminZoneScope(user, requestedZone);
    let rows: AttendanceSummaryRow[];
    let sourceLine: string;

    const period = scope.scopeKey === 'ALL' ? null : await AttendanceRepository.getPeriod(scope.scopeKey, month);
    if (period?.status === 'LOCKED' && period.current_snapshot_id) {
      const snapshot = await AttendanceRepository.getSnapshotById(period.current_snapshot_id);
      if (!snapshot) throw new NotFoundError('Không tìm thấy snapshot của kỳ công đã chốt.');
      rows = (snapshot.snapshot_json as { rows?: AttendanceSummaryRow[] }).rows || [];
      sourceLine = `Kỳ đã chốt lúc ${new Date(snapshot.locked_at).toISOString()} | SHA-256: ${snapshot.snapshot_sha256}`;
    } else {
      rows = (await AttendanceRepository.getAttendanceSummary(scope.zoneIds, month)).map((r) => this.normalizeSummaryRow(r));
      sourceLine = 'Số liệu tạm tính (kỳ chưa chốt)';
    }

    const header = [
      'STT', 'Mã KSV', 'Họ tên KSV', 'Zone phân công', 'Số ngày có ca', 'Ngày công',
      'Duyệt', 'Nhắc nhở', 'Từ chối', 'Chờ duyệt', 'Ngày đủ Check-out', 'Ngày thiếu Check-out',
      'Giờ thực địa (giờ)', 'Ca có cảnh báo', 'Lượt đi kèm', 'Lượt đi kèm đã duyệt', 'Danh sách người đi kèm', 'Hồ sơ đã nộp',
    ];
    const lines = [
      [`Bảng chấm công tháng ${month} - Phạm vi ${scope.scopeKey}`].map(sanitizeCsvCell).join(','),
      [sourceLine].map(sanitizeCsvCell).join(','),
      header.map(sanitizeCsvCell).join(','),
      ...rows.map((r, idx) =>
        [
          idx + 1,
          r.surveyor_code,
          r.surveyor_name,
          r.assigned_zone_id,
          r.total_shift_days,
          r.work_days,
          r.approved_days,
          r.flagged_days,
          r.rejected_days,
          r.pending_days,
          r.completed_checkout_days,
          r.missing_checkout_days,
          (Number(r.total_work_minutes) / 60).toFixed(2),
          r.anomaly_shift_count,
          r.companion_checkins_total,
          r.companion_accepted_count,
          r.companions.map((c) => [c.name, c.phone].filter(Boolean).join(' - ')).join('; '),
          r.surveys_submitted,
        ].map(sanitizeCsvCell).join(',')
      ),
    ];
    return {
      filename: `bang-cham-cong-${scope.scopeKey}-${month}.csv`,
      content: `﻿${lines.join('\r\n')}\r\n`,
    };
  }
}
