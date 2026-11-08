/**
 * Bảng quy ước cấp Burland (Burland et al. 1977 / BRE Digest 251) theo bề rộng vết nứt, dùng chung cho
 * chấm điểm, chốt duyệt, thẩm định chung cư và báo cáo. Đồng bộ 1:1 với frontend/src/components/canvas/burlandGrade.ts.
 *
 * Chỉ D loại nứt mới có cấp Burland: thấm, bong, kẹt cửa… có thể ghi "bề rộng" (kích thước vết thấm) nhưng không phải vết nứt.
 */

/** Khuyết tật có phải dạng vết nứt không (đồng bộ 1:1 với frontend/src/components/canvas/defectHelpers.ts). */
export function isCrackRelatedDefect(cat?: unknown, type?: unknown): boolean {
  const catStr = String(cat ?? '').toLowerCase();
  const typeStr = String(type ?? '').toLowerCase();
  const full = `${catStr} ${typeStr}`;

  if (
    full.includes('thấm dột') ||
    full.includes('ẩm mốc') ||
    full.includes('kẹt cửa') ||
    full.includes('cong vênh') ||
    full.includes('bong rộp') ||
    full.includes('bong tróc') ||
    full.includes('rỉ sét')
  ) {
    return typeStr.includes('nứt') || typeStr.includes('crack');
  }

  return full.includes('nứt') || full.includes('crack');
}

/** Quy đổi bề rộng vết nứt (mm) sang cấp Burland 0..5. */
export function getBurlandGradeFromWidth(w: number): number {
  if (w <= 0.1) return 0;
  if (w <= 1) return 1;
  if (w <= 5) return 2;
  if (w <= 15) return 3;
  if (w <= 25) return 4;
  return 5;
}

export interface BurlandDefectLike {
  screeningCategory?: unknown;
  screening_category?: unknown;
  defectType?: unknown;
  defect_type?: unknown;
  widthMaxMm?: unknown;
  width_max_mm?: unknown;
  widthMm?: unknown;
  isDeleted?: unknown;
  is_deleted?: unknown;
}

const isAlive = (d: BurlandDefectLike | null | undefined): d is BurlandDefectLike =>
  !!d && d.isDeleted !== true && d.is_deleted !== true;

/** Bề rộng (mm) đã nhập của một D; 0 khi trống. */
export function defectWidthMm(d: BurlandDefectLike): number {
  const n = Number(d.widthMaxMm ?? d.width_max_mm ?? d.widthMm ?? 0);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

export function isCrackDefect(d: BurlandDefectLike): boolean {
  return isCrackRelatedDefect(
    d.screeningCategory ?? d.screening_category,
    d.defectType ?? d.defect_type
  );
}

export interface ZoneCrackSummary {
  /** Cấp Burland theo bề rộng D loại nứt lớn nhất; null khi vùng không có D loại nứt. */
  grade: number | null;
  /** Bề rộng lớn nhất của D loại nứt (mm); 0 khi không có. */
  wmaxMm: number;
  crackCount: number;
}

/** Tóm tắt vết nứt của một vùng Z từ danh sách D (bỏ D đã xóa mềm và D không phải nứt). */
export function summarizeZoneCracks(defects: unknown): ZoneCrackSummary {
  const list = Array.isArray(defects) ? (defects as BurlandDefectLike[]) : [];
  let wmax = 0;
  let count = 0;
  for (const d of list) {
    if (!isAlive(d) || !isCrackDefect(d)) continue;
    count++;
    wmax = Math.max(wmax, defectWidthMm(d));
  }
  return { grade: count > 0 ? getBurlandGradeFromWidth(wmax) : null, wmaxMm: wmax, crackCount: count };
}
