import { AttendanceRepository } from './attendance.repository';
import { Database } from '../../database/db';
import { StorageService } from '../../common/services/storage.service';
import { NotFoundError, BadRequestError } from '../../common/errors/problem-details';

interface ZoneCentroidDef {
  zoneId: string;
  zoneName: string;
  lat: number;
  lng: number;
}

const FALLBACK_ZONE_CENTROIDS: Record<string, ZoneCentroidDef> = {
  ZONE_01: { zoneId: 'ZONE_01', zoneName: 'Zone 1: Ga S1 Bến Thành (C&C)', lat: 10.770876, lng: 106.696946 },
  ZONE_02: { zoneId: 'ZONE_02', zoneName: 'Zone 2: Hầm TBM Bến Thành -> Tao Đàn (POR)', lat: 10.771500, lng: 106.694800 },
  ZONE_03: { zoneId: 'ZONE_03', zoneName: 'Zone 3: Ga S2 Tao Đàn (C&C)', lat: 10.773237, lng: 106.690138 },
  ZONE_04: { zoneId: 'ZONE_04', zoneName: 'Zone 4: Hầm TBM Tao Đàn -> Dân Chủ (POR)', lat: 10.774500, lng: 106.687500 },
  ZONE_08: { zoneId: 'ZONE_08', zoneName: 'Zone 8: Hầm TBM Hòa Hưng -> Lê Thị Riêng (POR)', lat: 10.784328, lng: 106.669262 },
  ZONE_09: { zoneId: 'ZONE_09', zoneName: 'Zone 9: Ga S5 Lê Thị Riêng (C&C)', lat: 10.786163, lng: 106.665623 },
  ZONE_S1: { zoneId: 'ZONE_S1', zoneName: 'Ga S1 - Bến Thành', lat: 10.770830, lng: 106.696694 },
  ZONE_S2: { zoneId: 'ZONE_S2', zoneName: 'Ga S2 - Tao Đàn', lat: 10.774130, lng: 106.690134 },
  ZONE_S3: { zoneId: 'ZONE_S3', zoneName: 'Ga S3 - Dân Chủ', lat: 10.777797, lng: 106.678489 },
  ZONE_S4: { zoneId: 'ZONE_S4', zoneName: 'Ga S4 - Hòa Hưng', lat: 10.782510, lng: 106.672859 },
  ZONE_S5: { zoneId: 'ZONE_S5', zoneName: 'Ga S5 - Lê Thị Riêng', lat: 10.786061, lng: 106.665315 },
  ZONE_S6: { zoneId: 'ZONE_S6', zoneName: 'Ga S6 - Phạm Văn Hai', lat: 10.790290, lng: 106.658081 },
  ZONE_S7: { zoneId: 'ZONE_S7', zoneName: 'Ga S7 - Bảy Hiền', lat: 10.793561, lng: 106.652375 },
  ZONE_S8: { zoneId: 'ZONE_S8', zoneName: 'Ga S8 - Nguyễn Hồng Đào', lat: 10.797605, lng: 106.644632 },
  ZONE_S9: { zoneId: 'ZONE_S9', zoneName: 'Ga S9 - Bà Quẹo', lat: 10.802564, lng: 106.637211 },
  ZONE_S10: { zoneId: 'ZONE_S10', zoneName: 'Ga S10 - Phạm Văn Bạch', lat: 10.815381, lng: 106.630708 },
  ZONE_S11: { zoneId: 'ZONE_S11', zoneName: 'Ga S11 - Tân Bình / Tham Lương', lat: 10.821594, lng: 106.625132 },
};

export class AttendanceService {
  /**
   * Chuẩn hóa ngày hiện tại theo múi giờ Việt Nam (Asia/Ho_Chi_Minh) YYYY-MM-DD
   */
  private static getVietnamTodayStr(): string {
    const formatter = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Ho_Chi_Minh',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    return formatter.format(new Date());
  }

  /**
   * Giải quyết tọa độ trọng tâm của phân khu (Single Source of Truth):
   * 1. Ưu tiên tính ST_Centroid(ST_Union(geom)) từ các thửa đất thực tế của zone_id trong bảng parcels
   *    hoặc lấy center_geom trong bảng metro_zones.
   * 2. Nếu DB chưa có bản ghi cho mã phân khu đó, dùng tọa độ chuẩn FALLBACK_ZONE_CENTROIDS.
   */
  static async resolveZoneCentroidAndDistance(
    rawZoneId: string,
    gpsLongitude?: number,
    gpsLatitude?: number
  ): Promise<{
    zoneId: string;
    zoneName: string;
    centroid: { lat: number; lng: number };
    distanceMeters: number;
  }> {
    const normalizedZoneId = (rawZoneId || 'ZONE_09').trim().toUpperCase();
    const fallbackDef = FALLBACK_ZONE_CENTROIDS[normalizedZoneId];

    // 1. Thử truy vấn trực tiếp từ metro_zones kết hợp trọng tâm bảng parcels bằng PostGIS
    const queryRes = await Database.query<{
      zone_code: string;
      zone_name: string;
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
             ),
             CASE
               WHEN $4::double precision IS NOT NULL AND $5::double precision IS NOT NULL
               THEN ST_SetSRID(ST_MakePoint($4::double precision, $5::double precision), 4326)
               ELSE NULL
             END
           ) AS center_pt,
           COALESCE(
             (SELECT mz.zone_name FROM metro_zones mz WHERE UPPER(mz.zone_code) = $1 LIMIT 1),
             $6::text
           ) AS resolved_name
       )
       SELECT
         $1::text AS zone_code,
         resolved_name AS zone_name,
         ST_X(center_pt) AS lng,
         ST_Y(center_pt) AS lat,
         CASE
           WHEN $2::double precision IS NOT NULL AND $3::double precision IS NOT NULL AND center_pt IS NOT NULL
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
        fallbackDef ? fallbackDef.lng : null,
        fallbackDef ? fallbackDef.lat : null,
        fallbackDef ? fallbackDef.zoneName : normalizedZoneId,
      ]
    );

    if (queryRes.rows.length === 0) {
      throw new BadRequestError(`Mã phân khu "${rawZoneId}" không tồn tại hoặc chưa có tọa độ trọng tâm hợp lệ.`);
    }

    const row = queryRes.rows[0];
    const distanceMeters =
      typeof row.distance_meters === 'number' && !Number.isNaN(row.distance_meters)
        ? Math.round(row.distance_meters * 100) / 100
        : 0;

    return {
      zoneId: row.zone_code,
      zoneName: row.zone_name || fallbackDef?.zoneName || normalizedZoneId,
      centroid: {
        lat: Number(row.lat),
        lng: Number(row.lng),
      },
      distanceMeters,
    };
  }

  static async checkIn(
    surveyorId: string,
    data: {
      zoneId: string;
      gpsLatitude: number;
      gpsLongitude: number;
      selfiePhotoUrl: string;
      notes?: string | null;
      isCompanion?: boolean;
      companionName?: string | null;
      companionRole?: string | null;
      companionPhone?: string | null;
    }
  ) {
    const isCompanion = Boolean(data.isCompanion);

    // 1. Nếu là điểm danh Người đi cùng: Kiểm tra giới hạn tối đa 3 lần/ngày trên Server
    let todayCompanionCount = 0;
    if (isCompanion) {
      todayCompanionCount = await AttendanceRepository.countTodayCompanionCheckIns(surveyorId);
      if (todayCompanionCount >= 3) {
        throw new BadRequestError(
          'Đã đạt giới hạn tối đa 3 lần điểm danh / đổi cán bộ đi kèm trong ngày hôm nay.'
        );
      }
    }

    // 2. Tính khoảng cách PostGIS chính xác tới tâm phân khu
    const zoneResolved = await this.resolveZoneCentroidAndDistance(
      data.zoneId,
      data.gpsLongitude,
      data.gpsLatitude
    );

    const distanceMeters = zoneResolved.distanceMeters;
    const isWithin500m = distanceMeters <= 500.0;
    const hasAnomalyFlag = !isWithin500m;
    const cleanNotes = data.notes?.trim() || null;

    if (hasAnomalyFlag && !cleanNotes) {
      throw new BadRequestError(
        `Vị trí hiện tại cách trọng tâm ${zoneResolved.zoneName} ${Math.round(distanceMeters)}m (>500m). Vui lòng nhập lý do chấm công ngoài phạm vi.`
      );
    }

    const anomalyReason = hasAnomalyFlag
      ? `Vị trí chấm công cách tâm ${zoneResolved.zoneName} [${distanceMeters}m] (vượt ngưỡng cho phép 500m)`
      : null;

    // 3. Xử lý lưu trữ hình ảnh Selfie qua StorageService (Cloudflare R2 / Local Disk)
    // Tuyệt đối không lưu chuỗi Base64 khổng lồ vào bảng timekeeping_checkins
    let storedSelfieUrl = data.selfiePhotoUrl.trim();
    if (storedSelfieUrl.startsWith('data:image/')) {
      const todayVn = this.getVietnamTodayStr();
      const prefix = isCompanion
        ? `selfie_companion_${surveyorId.slice(0, 8)}`
        : `selfie_ksv_${surveyorId.slice(0, 8)}`;
      const folder = `attendance/${zoneResolved.zoneId}/${todayVn}`;

      const uploadRes = await StorageService.uploadBase64(storedSelfieUrl, prefix, folder, {
        'surveyor-id': surveyorId,
        'zone-id': zoneResolved.zoneId,
        'is-companion': String(isCompanion),
        'companion-name': isCompanion ? (data.companionName || '') : '',
        'gps-lat': String(data.gpsLatitude),
        'gps-lng': String(data.gpsLongitude),
        'distance-m': String(distanceMeters),
      });
      storedSelfieUrl = uploadRes.url;
    }

    // 4. Lưu bản ghi vào bảng timekeeping_checkins
    const checkIn = await AttendanceRepository.createCheckIn({
      surveyorId,
      zoneId: zoneResolved.zoneId,
      gpsLatitude: data.gpsLatitude,
      gpsLongitude: data.gpsLongitude,
      distanceToCenterMeters: distanceMeters,
      isWithinBoundary: isWithin500m,
      selfiePhotoUrl: storedSelfieUrl,
      notes: cleanNotes,
      hasAnomalyFlag,
      anomalyReason,
      isCompanion,
      companionName: data.companionName,
      companionRole: data.companionRole,
      companionPhone: data.companionPhone,
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
      selfiePhotoUrl: checkIn.selfie_photo_url,
      isCompanion: checkIn.is_companion,
      companionName: checkIn.companion_name,
      companionRole: checkIn.companion_role,
      companionPhone: checkIn.companion_phone,
      todayCompanionCount: isCompanion ? todayCompanionCount + 1 : undefined,
      message: hasAnomalyFlag
        ? 'Chấm công thành công nhưng hệ thống ghi nhận cảnh báo lệch tọa độ Ga (>500m)'
        : 'Chấm công GPS thành công trong phạm vi Ga',
    };
  }

  static async checkOut(
    surveyorId: string,
    data: {
      checkInId?: string | null;
      zoneId?: string | null;
      gpsLatitude: number;
      gpsLongitude: number;
      selfiePhotoUrl?: string | null;
      notes?: string | null;
      isCompanion?: boolean;
    }
  ) {
    const isCompanion = Boolean(data.isCompanion);
    const existing = await AttendanceRepository.findTodayCheckInForCheckOut(
      surveyorId,
      isCompanion,
      data.checkInId
    );

    if (!existing) {
      throw new BadRequestError(
        isCompanion
          ? 'Cán bộ đi kèm chưa thực hiện Check-in hôm nay nên không thể Check-out.'
          : 'Bạn chưa thực hiện Check-in bắt đầu ca hôm nay nên không thể Check-out.'
      );
    }

    const effectiveZoneId = (data.zoneId || existing.zone_id || 'ZONE_09').trim();
    const zoneResolved = await this.resolveZoneCentroidAndDistance(
      effectiveZoneId,
      data.gpsLongitude,
      data.gpsLatitude
    );

    const distanceMeters = zoneResolved.distanceMeters;
    const cleanNotes = data.notes?.trim() || null;

    let storedCheckoutSelfieUrl: string | null = data.selfiePhotoUrl?.trim() || null;
    if (storedCheckoutSelfieUrl && storedCheckoutSelfieUrl.startsWith('data:image/')) {
      const todayVn = this.getVietnamTodayStr();
      const prefix = isCompanion
        ? `checkout_companion_${surveyorId.slice(0, 8)}`
        : `checkout_ksv_${surveyorId.slice(0, 8)}`;
      const folder = `attendance/${zoneResolved.zoneId}/${todayVn}`;

      const uploadRes = await StorageService.uploadBase64(storedCheckoutSelfieUrl, prefix, folder, {
        'surveyor-id': surveyorId,
        'zone-id': zoneResolved.zoneId,
        'is-companion': String(isCompanion),
        'action-type': 'CHECK_OUT',
        'gps-lat': String(data.gpsLatitude),
        'gps-lng': String(data.gpsLongitude),
        'distance-m': String(distanceMeters),
      });
      storedCheckoutSelfieUrl = uploadRes.url;
    }

    const updated = await AttendanceRepository.updateCheckOut({
      checkInId: existing.id,
      gpsLatitude: data.gpsLatitude,
      gpsLongitude: data.gpsLongitude,
      distanceToCenterMeters: distanceMeters,
      selfiePhotoUrl: storedCheckoutSelfieUrl,
      notes: cleanNotes,
    });

    if (!updated) {
      throw new NotFoundError('Không thể cập nhật thông tin Check-out cho ca làm việc này.');
    }

    return {
      checkInId: updated.id,
      checkInTime: updated.checkin_time,
      checkOutTime: updated.checkout_time,
      zoneId: updated.zone_id,
      zoneName: zoneResolved.zoneName,
      distanceToCenterMeters: Number(updated.distance_to_zone_center_meters ?? 0),
      checkOutDistanceToCenterMeters: Number(updated.checkout_distance_to_zone_center_meters ?? distanceMeters),
      selfiePhotoUrl: updated.selfie_photo_url,
      checkOutSelfiePhotoUrl: updated.checkout_selfie_photo_url,
      checkOutNotes: updated.checkout_notes,
      workDurationMinutes: Number(updated.work_duration_minutes ?? 1),
      verificationStatus: updated.verification_status,
      isCompanion: updated.is_companion,
      companionName: updated.companion_name,
      companionRole: updated.companion_role,
      companionPhone: updated.companion_phone,
      message: isCompanion
        ? `Đã Check-out kết thúc ca cho cán bộ đi kèm (${updated.companion_name || 'Cán bộ đi kèm'}) thành công!`
        : 'Đã Check-out kết thúc ca làm việc thực địa thành công!',
    };
  }

  static async getZoneInfo(zoneId: string) {
    const resolved = await this.resolveZoneCentroidAndDistance(zoneId);
    return {
      zoneId: resolved.zoneId,
      zoneName: resolved.zoneName,
      centroid: resolved.centroid,
    };
  }

  static async getMyHistory(
    surveyorId: string,
    startDate?: string,
    endDate?: string,
    isCompanion?: boolean
  ) {
    return AttendanceRepository.listCheckIns({
      surveyorId,
      startDate,
      endDate,
      isCompanion,
    });
  }

  static async listZoneCheckIns(filters: {
    zoneId?: string;
    status?: string;
    startDate?: string;
    endDate?: string;
    isCompanion?: boolean;
    limit?: number;
    offset?: number;
  }) {
    return AttendanceRepository.listCheckIns(filters);
  }

  static async getCheckInDetail(id: string) {
    const checkIn = await AttendanceRepository.getCheckInById(id);
    if (!checkIn) {
      throw new NotFoundError(`Không tìm thấy lượt chấm công với ID: ${id}`);
    }
    return checkIn;
  }

  static async verifyAttendance(
    id: string,
    adminId: string,
    action: 'APPROVE' | 'REJECT' | 'FLAG_WARNING',
    notes?: string | null,
    clientIp?: string
  ) {
    const checkIn = await AttendanceRepository.getCheckInById(id);
    if (!checkIn) {
      throw new NotFoundError(`Không tìm thấy lượt chấm công với ID: ${id}`);
    }

    let status = 'APPROVED';
    if (action === 'REJECT') status = 'REJECTED';
    else if (action === 'FLAG_WARNING') status = 'FLAGGED_WARNING';

    const updated = await AttendanceRepository.verifyCheckIn(id, adminId, status, notes);

    try {
      await Database.query(
        `INSERT INTO system_audit_logs (entity_type, entity_id, action, performed_by_user_id, client_ip, diff_payload)
         VALUES ('TIMEKEEPING_CHECKIN', $1, $2, $3, $4, $5::jsonb);`,
        [
          id,
          `VERIFY_${action}`,
          adminId,
          clientIp || null,
          JSON.stringify({
            previousStatus: checkIn.verification_status,
            newStatus: status,
            isCompanion: checkIn.is_companion,
            companionName: checkIn.companion_name,
            notes: notes || null,
          }),
        ]
      );
    } catch (auditErr: unknown) {
      console.error('[AttendanceService:verifyAttendance] Failed to write audit log:', auditErr);
    }

    return {
      checkInId: updated?.id,
      verificationStatus: updated?.verification_status,
      verifiedAt: updated?.verified_at,
      verificationNotes: updated?.verification_notes,
      message: action === 'APPROVE' ? 'Đã xác nhận ngày công hợp lệ' : `Đã chuyển trạng thái chấm công thành [${status}]`,
    };
  }

  static async getSummary(zoneId?: string, month?: string) {
    return AttendanceRepository.getAttendanceSummary(zoneId, month);
  }
}
