export interface BilingualReason {
  vi: string;
  en: string;
}

export interface ZoneExemptFloor {
  floorName: string;
  reason: BilingualReason;
}

// Khớp NO_ZONES_REASON_PRESETS ở frontend/src/features/survey-phase1/utils/zoneExemption.ts
const NO_ZONES_REASON_EN: Record<string, string> = {
  'Chủ nhà chỉ cho chụp tổng quan tầng, từ chối chụp chi tiết phòng':
    'Owner permitted floor overview photos only and refused room-level photography',
  'Khu vực riêng tư, hạn chế tiếp cận chi tiết bên trong': 'Private area with restricted detailed access',
  'Cửa khóa / Không thể tiếp cận khảo sát chi tiết bên trong': 'Locked door; detailed interior access not possible',
};

/** Lý do là lời khai pháp lý: lý do tự do giữ nguyên tiếng Việt, không dựng câu tiếng Anh thay KSV. */
export function toBilingualNoZonesReason(reason: unknown): BilingualReason {
  const vi = typeof reason === 'string' && reason.trim() ? reason.trim() : '---';
  return { vi, en: NO_ZONES_REASON_EN[vi] ?? vi };
}

/** Nguồn duy nhất của tầng hạn chế chi tiết là cờ ở Bước 3, nên báo cáo không phụ thuộc KSV tick lại ở Bước 6. */
export function collectZoneExemptFloors(floors: unknown): ZoneExemptFloor[] {
  if (!Array.isArray(floors)) return [];
  return floors
    .filter((floor) => floor?.hasZones === false)
    .map((floor, index) => ({
      floorName: String(floor.floorName || floor.floor_name || `Tầng ${index + 1}`),
      reason: toBilingualNoZonesReason(floor.noZonesReason),
    }));
}
