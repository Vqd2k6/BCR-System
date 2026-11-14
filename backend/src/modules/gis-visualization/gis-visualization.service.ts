import { BadRequestError } from '../../common/errors/problem-details';
import type { JwtPayload } from '../../common/guards/auth.guard';
import { resolveZoneMapScope } from '../cadastral/utils/zone-scope.utils';
import { buildParcelMetrics, currentYearVn } from './gis-visualization.rules';
import { GisVisualizationRepository } from './gis-visualization.repository';
import type { ZoneThematicPayload } from './types';

const isAllZones = (zone: string): boolean => zone === 'ALL' || zone === 'ALL_ZONES';

export class GisVisualizationService {
  /**
   * Chỉ số chuyên đề theo thửa của 1 Zone. Phạm vi zone như GET /parcels/zone-map (resolveZoneMapScope).
   * Toàn tuyến (ALL) không hỗ trợ: bản đồ chuyên đề chỉ bật khi đã chọn 1 Zone cụ thể.
   * Payload không chứa PII (tên chủ hộ, SĐT, CCCD, ảnh) nên dùng chung cho Admin và Guest.
   */
  static async getZoneThematic(user: JwtPayload, requestedZone: string): Promise<ZoneThematicPayload> {
    const zoneId = resolveZoneMapScope(user, requestedZone);
    if (isAllZones(zoneId)) {
      throw new BadRequestError('Bản đồ chuyên đề chỉ hỗ trợ từng Zone, vui lòng chọn 1 Zone cụ thể.');
    }
    const rows = await GisVisualizationRepository.listThematicRows(zoneId);
    const nowYear = currentYearVn();
    const parcels = rows.map((row) => buildParcelMetrics(row, nowYear));
    return {
      zoneId,
      generatedAt: new Date().toISOString(),
      totalParcels: parcels.length,
      assessedParcels: parcels.filter((p) => p.reportStatus !== null).length,
      parcels,
    };
  }
}
