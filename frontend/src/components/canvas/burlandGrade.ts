/**
 * Bảng quy ước cấp Burland (Burland et al. 1977 / BRE Digest 251) theo bề rộng vết nứt — nguồn DUY NHẤT phía frontend.
 * Đồng bộ 1:1 với backend/src/modules/scoring/burland-grade.ts.
 *
 * Chỉ D loại nứt mới có cấp Burland: thấm, bong, kẹt cửa… có thể ghi "bề rộng" (kích thước mảng thấm) nhưng không phải vết nứt.
 */
import { isCrackRelated } from './defectHelpers';

/** Quy đổi bề rộng vết nứt (mm) sang cấp Burland 0..5. */
export const getBurlandGradeFromWidth = (w: number): number => {
  if (w <= 0.1) return 0;
  if (w <= 1) return 1;
  if (w <= 5) return 2;
  if (w <= 15) return 3;
  if (w <= 25) return 4;
  return 5;
};

export interface BurlandDefectLike {
  screeningCategory?: string | null;
  defectType?: string | null;
  widthMaxMm?: number | string | null;
  width_max_mm?: number | string | null;
  isDeleted?: boolean;
  is_deleted?: boolean;
}

const isAlive = (d: BurlandDefectLike | null | undefined): d is BurlandDefectLike =>
  !!d && d.isDeleted !== true && d.is_deleted !== true;

/** Bề rộng (mm) đã nhập của một D; 0 khi trống. */
export const defectWidthMm = (d: BurlandDefectLike): number => {
  const n = Number(d.widthMaxMm ?? d.width_max_mm ?? 0);
  return Number.isFinite(n) && n > 0 ? n : 0;
};

/** Cấp Burland của một D; null khi D không phải loại nứt. */
export const crackGradeOf = (d: BurlandDefectLike): number | null =>
  isCrackRelated(d.screeningCategory, d.defectType) ? getBurlandGradeFromWidth(defectWidthMm(d)) : null;

export interface ZoneCrackSummary {
  /** Cấp theo D loại nứt rộng nhất; null khi vùng không có D loại nứt. */
  grade: number | null;
  wmaxMm: number;
  crackCount: number;
}

/** Tóm tắt vết nứt của một vùng Z (bỏ D xóa mềm và D không phải nứt). */
export const summarizeZoneCracks = (defects: readonly BurlandDefectLike[] | null | undefined): ZoneCrackSummary => {
  let wmax = 0;
  let count = 0;
  for (const d of defects || []) {
    if (!isAlive(d) || !isCrackRelated(d.screeningCategory, d.defectType)) continue;
    count++;
    wmax = Math.max(wmax, defectWidthMm(d));
  }
  return { grade: count > 0 ? getBurlandGradeFromWidth(wmax) : null, wmaxMm: wmax, crackCount: count };
};

/** Cấp Burland của vùng Z để lưu: cấp theo D loại nứt, 0 khi không có vết nứt. */
export const zoneCrackGrade = (defects: readonly BurlandDefectLike[] | null | undefined): number =>
  summarizeZoneCracks(defects).grade ?? 0;

export interface BurlandZoneRef {
  floorIndex: number;
  floorName: string;
  zoneCode: string;
  grade: number;
  wmaxMm: number;
}

export interface BurlandSummaryDerived {
  localMaxGrade: number;
  predominantGrade: number;
  /** Vùng chi phối: cấp cao nhất, cùng cấp thì wmax lớn nhất. null khi không có vết nứt. */
  governing: BurlandZoneRef | null;
  crackCount: number;
}

interface FloorLike {
  floorName?: string;
  isDeleted?: boolean;
  is_deleted?: boolean;
  zones?: ReadonlyArray<{
    zoneCode?: string;
    isDeleted?: boolean;
    is_deleted?: boolean;
    defects?: readonly BurlandDefectLike[];
  }>;
}

/**
 * Tổng hợp Burland toàn nhà từ D loại nứt trong vùng Z (cùng quy tắc ở Bước 4 KSV và Bước 4 thẩm định).
 * Cấp chủ đạo = cấp xuất hiện nhiều nhất trong các vết nứt (hòa thì lấy cấp cao hơn).
 */
export const deriveBurlandSummary = (floors: readonly FloorLike[] | null | undefined): BurlandSummaryDerived => {
  const counts: Record<number, number> = {};
  let crackCount = 0;
  let governing: BurlandZoneRef | null = null;
  (floors || []).forEach((f, floorIndex) => {
    if (!f || f.isDeleted || f.is_deleted) return;
    for (const z of f.zones || []) {
      if (!z || z.isDeleted || z.is_deleted) continue;
      for (const d of z.defects || []) {
        if (!isAlive(d)) continue;
        const g = crackGradeOf(d);
        if (g === null) continue;
        crackCount++;
        counts[g] = (counts[g] || 0) + 1;
      }
      const s = summarizeZoneCracks(z.defects);
      if (s.grade === null) continue;
      if (!governing || s.grade > governing.grade || (s.grade === governing.grade && s.wmaxMm > governing.wmaxMm)) {
        governing = { floorIndex, floorName: f.floorName || '', zoneCode: z.zoneCode || 'Z-01', grade: s.grade, wmaxMm: s.wmaxMm };
      }
    }
  });
  let predominantGrade = 0;
  let maxCount = -1;
  Object.entries(counts).forEach(([gStr, c]) => {
    const g = Number(gStr);
    if (c > maxCount || (c === maxCount && g > predominantGrade)) {
      maxCount = c;
      predominantGrade = g;
    }
  });
  const gov = governing as BurlandZoneRef | null;
  return { localMaxGrade: gov ? gov.grade : 0, predominantGrade, governing: gov, crackCount };
};
