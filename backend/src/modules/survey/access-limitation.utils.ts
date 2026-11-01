interface AccessLimitationLike {
  restrictedAreas?: unknown;
  restrictedFloorLevels?: unknown;
  customRestrictedAreas?: unknown;
  customRestrictedArea?: unknown;
  notes?: unknown;
}

const LEGACY_AREA_TAGS = /\[Khu vực khác:\s*(.*?)\]/g;

/** Khu vực khác dạng danh sách; hồ sơ cũ chỉ có một chuỗi hoặc thẻ trong ghi chú. */
export function readCustomRestrictedAreas(accessLimitation: AccessLimitationLike | null | undefined): string[] {
  const list = accessLimitation?.customRestrictedAreas;
  const items = Array.isArray(list)
    ? list.filter((item): item is string => typeof item === 'string').map((item) => item.trim()).filter(Boolean)
    : [];
  if (items.length > 0) return items;

  const single = String(accessLimitation?.customRestrictedArea || '').trim();
  if (single) return [single];

  return [...String(accessLimitation?.notes || '').matchAll(LEGACY_AREA_TAGS)]
    .map((tag) => tag[1].trim())
    .filter(Boolean);
}

/** Dựng chuỗi `inaccessible_areas` từ lựa chọn của KSV; `Khác` phải ra nội dung thật, gồm cả thẻ cũ trong ghi chú. */
export function formatRestrictedAreas(accessLimitation: AccessLimitationLike | null | undefined): string | null {
  const areas = accessLimitation?.restrictedAreas;
  if (!Array.isArray(areas) || areas.length === 0) return null;

  const floorLevels = accessLimitation?.restrictedFloorLevels;
  const hasFloorLevels = Array.isArray(floorLevels) ? floorLevels.length > 0 : Boolean(floorLevels);
  const customAreas = readCustomRestrictedAreas(accessLimitation);

  return areas
    .filter((area): area is string => typeof area === 'string')
    .map((area) => {
      if ((area === 'Các tầng trên' || area === 'Các tầng lầu trên cao' || area.startsWith('Các tầng')) && hasFloorLevels) {
        return `${area} (${floorLevels})`;
      }
      if ((area === 'Khác' || area.startsWith('Khác')) && customAreas.length > 0) return customAreas.join(', ');
      return area;
    })
    .join(', ');
}
