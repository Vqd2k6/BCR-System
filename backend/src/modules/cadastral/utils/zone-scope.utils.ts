import type { JwtPayload } from '../../../common/guards/auth.guard';
import { ForbiddenError } from '../../../common/errors/problem-details';
import { canAccessZone } from '../../report/utils/zone-access.utils';

const DEFAULT_ZONE = 'ZONE_01';

function isAllZones(zone: string): boolean {
  return zone === 'ALL' || zone === 'ALL_ZONES';
}

/**
 * Phạm vi zone của GET /parcels/zone-map.
 * Zone Admin được gán zone cụ thể chỉ thấy zone đó: xin "toàn tuyến" bị thu hẹp về zone được gán,
 * xin zone khác bị từ chối. Tài khoản gán ALL/ALL_ZONES và Super Admin giữ toàn quyền.
 */
export function resolveZoneMapScope(user: JwtPayload | undefined, requestedZone: string | undefined): string {
  const assigned = (user?.assignedZoneId || '').trim().toUpperCase();
  const requested = (requestedZone || '').trim().toUpperCase();

  if (user?.role === 'GUEST' && assigned && !isAllZones(assigned)) return assigned;

  if (user?.role === 'ZONE_ADMIN') {
    if (!assigned) throw new ForbiddenError('Tài khoản chưa được phân công phân khu, vui lòng liên hệ Super Admin.');
    if (isAllZones(assigned)) return requested || assigned;
    if (!requested || isAllZones(requested)) return assigned;
    if (!canAccessZone(user, requested)) {
      throw new ForbiddenError(`Bạn không có quyền xem danh sách thửa đất của phân khu [${requested}].`);
    }
    return requested;
  }

  return requested || assigned || DEFAULT_ZONE;
}
