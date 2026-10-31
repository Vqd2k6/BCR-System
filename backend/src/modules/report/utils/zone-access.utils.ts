import type { JwtPayload } from '../../../common/guards/auth.guard';
import { CadastralRepository } from '../../cadastral/cadastral.repository';

/** Quyền theo phân khu: Super Admin toàn tuyến; Zone Admin chỉ Zone được gán (kể cả mã Zone cũ). */
export function canAccessZone(user: JwtPayload, zoneId: string | null | undefined): boolean {
  if (user.role === 'SUPER_ADMIN') return true;
  if (user.role !== 'ZONE_ADMIN' || !user.assignedZoneId) return false;

  const assigned = user.assignedZoneId.trim().toUpperCase();
  if (assigned === 'ALL' || assigned === 'ALL_ZONES') return true;
  if (!zoneId) return false;
  return CadastralRepository.getZoneAliases(assigned).includes(zoneId.trim().toUpperCase());
}
