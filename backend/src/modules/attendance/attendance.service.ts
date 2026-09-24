import { AttendanceRepository } from './attendance.repository';
import { Database } from '../../database/db';
import { NotFoundError, BadRequestError } from '../../common/errors/problem-details';

export class AttendanceService {
  static async checkIn(
    surveyorId: string,
    data: {
      zoneId: string;
      gpsLatitude: number;
      gpsLongitude: number;
      selfiePhotoUrl?: string | null;
      notes?: string | null;
    }
  ) {
    // 1. Lấy tọa độ tâm của Ga từ metro_zones
    const zoneRes = await Database.query<{
      zone_code: string;
      zone_name: string;
      distance_meters: number;
    }>(
      `SELECT zone_code, zone_name,
              ST_Distance(
                center_geom::geography,
                ST_SetSRID(ST_MakePoint($2, $3), 4326)::geography
              ) AS distance_meters
       FROM metro_zones
       WHERE zone_code = $1 LIMIT 1;`,
      [data.zoneId, data.gpsLongitude, data.gpsLatitude]
    );

    const distanceMeters = zoneRes.rows[0]?.distance_meters ? Math.round(zoneRes.rows[0].distance_meters * 100) / 100 : 0.0;
    const isWithin500m = distanceMeters <= 500.0;
    const hasAnomalyFlag = !isWithin500m;
    const anomalyReason = hasAnomalyFlag
      ? `Vị trí chấm công cách tâm ${zoneRes.rows[0]?.zone_name || data.zoneId} [${distanceMeters}m] (vượt ngưỡng cho phép 500m)`
      : null;

    const checkIn = await AttendanceRepository.createCheckIn({
      surveyorId,
      zoneId: data.zoneId,
      gpsLatitude: data.gpsLatitude,
      gpsLongitude: data.gpsLongitude,
      distanceToCenterMeters: distanceMeters,
      isWithinBoundary: isWithin500m,
      selfiePhotoUrl: data.selfiePhotoUrl,
      notes: data.notes,
      hasAnomalyFlag,
      anomalyReason,
    });

    return {
      checkInId: checkIn.id,
      checkInTime: checkIn.checkin_time,
      distanceToCenterMeters: distanceMeters,
      verificationStatus: checkIn.verification_status,
      hasAnomalyFlag: checkIn.has_anomaly_flag,
      anomalyReason: checkIn.anomaly_reason,
      message: hasAnomalyFlag
        ? 'Chấm công thành công nhưng hệ thống ghi nhận cảnh báo lệch tọa độ Ga (>500m)'
        : 'Chấm công GPS thành công trong phạm vi Ga',
    };
  }

  static async getZoneInfo(zoneId: string) {
    const zoneRes = await Database.query<{
      zone_code: string;
      zone_name: string;
      lng: number;
      lat: number;
    }>(
      `SELECT zone_code, zone_name,
              ST_X(center_geom) as lng,
              ST_Y(center_geom) as lat
       FROM metro_zones
       WHERE zone_code = $1 LIMIT 1;`,
      [zoneId]
    );

    if (zoneRes.rows.length > 0) {
      const row = zoneRes.rows[0];
      return {
        zoneId: row.zone_code,
        zoneName: row.zone_name,
        centroid: {
          lat: parseFloat(row.lat.toString()),
          lng: parseFloat(row.lng.toString()),
        },
      };
    }

    return {
      zoneId: 'ZONE_S9',
      zoneName: 'Ga S9 - Bà Quẹo',
      centroid: {
        lat: 10.802564,
        lng: 106.637211,
      },
    };
  }

  static async getMyHistory(surveyorId: string, startDate?: string, endDate?: string) {
    return AttendanceRepository.listCheckIns({
      surveyorId,
      startDate,
      endDate,
    });
  }

  static async listZoneCheckIns(filters: {
    zoneId?: string;
    status?: string;
    startDate?: string;
    endDate?: string;
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
    notes?: string | null
  ) {
    const checkIn = await AttendanceRepository.getCheckInById(id);
    if (!checkIn) {
      throw new NotFoundError(`Không tìm thấy lượt chấm công với ID: ${id}`);
    }

    let status = 'APPROVED';
    if (action === 'REJECT') status = 'REJECTED';
    else if (action === 'FLAG_WARNING') status = 'FLAGGED_WARNING';

    const updated = await AttendanceRepository.verifyCheckIn(id, adminId, status, notes);
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
