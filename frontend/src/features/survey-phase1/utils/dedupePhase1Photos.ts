import type { Phase1SurveyFormData, FloorSurveyData } from '../types/phase1.types';

/**
 * Lọc trùng mảng ảnh tổng quan tầng (overviewPhotos)
 * Bảo toàn caption và photoCode của ảnh xuất hiện trước, loại bỏ các bản ghi nhân bản do bất đồng bộ
 */
export function dedupeFloorOverviewPhotos(
  photos: (string | { id?: string; url?: string; caption?: string; photoCode?: string })[] | undefined
): { id: string; url: string; caption?: string; photoCode?: string }[] {
  if (!Array.isArray(photos) || photos.length === 0) return [];

  const seenUrls = new Set<string>();
  const seenCodes = new Set<string>();
  const result: { id: string; url: string; caption?: string; photoCode?: string }[] = [];

  for (let idx = 0; idx < photos.length; idx++) {
    const raw = photos[idx];
    const item = typeof raw === 'string'
      ? { id: `fl_ov_${idx}`, url: raw, caption: '', photoCode: '' }
      : {
          id: raw?.id || `fl_ov_${idx}`,
          url: raw?.url || '',
          caption: raw?.caption || '',
          photoCode: raw?.photoCode || '',
        };

    const trimmedUrl = item.url.trim();
    if (trimmedUrl) {
      if (seenUrls.has(trimmedUrl)) {
        // Nếu bản ghi trước chưa có caption mà bản ghi sau có caption, cập nhật caption
        if (item.caption) {
          const existing = result.find((p) => p.url === trimmedUrl);
          if (existing && !existing.caption) {
            existing.caption = item.caption;
          }
        }
        continue;
      }
      seenUrls.add(trimmedUrl);
    }

    const trimmedCode = item.photoCode?.trim();
    if (trimmedCode) {
      if (seenCodes.has(trimmedCode)) {
        continue;
      }
      seenCodes.add(trimmedCode);
    }

    result.push(item);
  }

  return result;
}

/**
 * Lọc trùng toàn diện cho toàn bộ dữ liệu khảo sát Phase 1
 */
export function dedupePhase1FormData(data: Phase1SurveyFormData): Phase1SurveyFormData {
  if (!data || !Array.isArray(data.floors)) return data;

  const dedupedFloors: FloorSurveyData[] = data.floors.map((floor) => {
    // 1. Lọc trùng ảnh tổng quan tầng
    const dedupedFloorPhotos = dedupeFloorOverviewPhotos(floor.overviewPhotos);

    // 2. Lọc trùng ảnh tổng quan Vùng Z
    const dedupedZones = (floor.zones || []).map((z) => ({
      ...z,
      overviewPhotos: Array.isArray(z.overviewPhotos)
        ? Array.from(new Set(z.overviewPhotos.filter((u): u is string => typeof u === 'string' && u.trim() !== '')))
        : [],
    }));

    // 3. Lọc trùng ảnh tổng quan Cấu kiện E
    const dedupedElements = (floor.structuralElements || []).map((e) => ({
      ...e,
      overviewPhotos: Array.isArray(e.overviewPhotos)
        ? Array.from(new Set(e.overviewPhotos.filter((u): u is string => typeof u === 'string' && u.trim() !== '')))
        : [],
    }));

    return {
      ...floor,
      overviewPhotos: dedupedFloorPhotos,
      zones: dedupedZones,
      structuralElements: dedupedElements,
    };
  });

  return {
    ...data,
    floors: dedupedFloors,
  };
}
