import type { UserProfile } from '../context/AuthContext';

type ZoneUser = Pick<UserProfile, 'role' | 'assignedZoneId'> | null | undefined;

function isAllZones(zone: string): boolean {
  return zone === 'ALL' || zone === 'ALL_ZONES';
}

/** Zone cố định của Zone Admin được gán zone cụ thể; null nếu tài khoản được tự chọn zone. */
export function getLockedZone(user: ZoneUser): string | null {
  if (user?.role !== 'ZONE_ADMIN') return null;
  const assigned = (user.assignedZoneId || '').trim().toUpperCase();
  return assigned && !isAllZones(assigned) ? assigned : null;
}

export function isUnassignedZoneAdmin(user: ZoneUser): boolean {
  return user?.role === 'ZONE_ADMIN' && !(user.assignedZoneId || '').trim();
}

/**
 * Zone khi mở màn hình từ giá trị khôi phục (URL/storage):
 * Zone Admin bị khóa luôn về zone được gán; Super Admin không tự tải toàn tuyến, phải chọn tay.
 */
export function resolveInitialZone(user: ZoneUser, requested: string | null | undefined, fallback: string): string {
  const locked = getLockedZone(user);
  if (locked) return locked;
  const zone = (requested || fallback).toUpperCase();
  return user?.role === 'SUPER_ADMIN' && isAllZones(zone) ? fallback : zone;
}
