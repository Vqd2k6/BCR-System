import type { AlignmentSide } from '../progress-report.types';
import type { SideOverride } from '../config/config.schema';

/**
 * Phải/Trái tuyến: kết quả hình học (tim tuyến chi tiết) + override thủ công trong config.
 * Override khớp theo phường / đường / danh sách số nhà (điều kiện nào có khai báo thì phải khớp).
 * Áp dụng khi không tính được (thiếu tọa độ) hoặc khi đặt force=true.
 */

function norm(s: string): string {
  return s
    .normalize('NFC')
    .toLowerCase()
    .replace(/^(phường|p\.|đường|đ\.|số)\s*/i, '')
    .replace(/\s+/g, ' ')
    .trim();
}

export interface SideLocation {
  ward: string;
  street: string;
  houseNumber: string;
}

function overrideMatches(o: SideOverride, loc: SideLocation): boolean {
  const houses = o.houseNumbers ?? [];
  if (!o.ward && !o.street && houses.length === 0) return false;
  if (o.ward && norm(o.ward) !== norm(loc.ward)) return false;
  if (o.street && norm(o.street) !== norm(loc.street)) return false;
  if (houses.length > 0 && !houses.some((h) => norm(h) === norm(loc.houseNumber))) return false;
  return true;
}

export function resolveAlignmentSide(
  computed: AlignmentSide | null,
  loc: SideLocation,
  overrides: SideOverride[]
): AlignmentSide | null {
  const forced = overrides.find((o) => o.force && overrideMatches(o, loc));
  if (forced) return forced.side;
  if (computed) return computed;
  const fallback = overrides.find((o) => overrideMatches(o, loc));
  return fallback ? fallback.side : null;
}

/** "Zone 9: Ga S5 Lê Thị Riêng (C&C)" → "ST05"; zone không phải ga → giữ mã zone (VD "ZONE_08"). */
export function resolveStationCode(zoneId: string, zoneName: string | null): string {
  const fromName = (zoneName ?? '').match(/\bGa\s+S(\d{1,2})\b/i);
  if (fromName) return `ST${fromName[1].padStart(2, '0')}`;
  const fromCode = zoneId.match(/^ZONE_S(\d{1,2})$/i);
  if (fromCode) return `ST${fromCode[1].padStart(2, '0')}`;
  return zoneId;
}
