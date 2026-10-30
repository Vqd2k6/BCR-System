/**
 * Kiểm tra chéo Diện tích xây dựng (footprint) và Tổng diện tích sàn (GFA).
 * Dùng chung cho form khảo sát Phase 1 (Step 2) và Audit Studio thẩm định.
 */

type NumLike = number | string | null | undefined;

// Dung sai cho tầng lửng / tum / ban công khi so GFA với footprint × số tầng
const GFA_OVERFLOW_TOLERANCE = 1.2;

const toPositive = (v: NumLike): number | null => {
  if (v === '' || v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isFinite(n) && n > 0 ? n : null;
};

/** Gợi ý GFA = Diện tích xây dựng × Số tầng nổi (tối thiểu 1). */
export const suggestGfa = (constructionAreaM2: NumLike, aboveFloors: NumLike): number | null => {
  const area = toPositive(constructionAreaM2);
  if (area === null) return null;
  const floors = Math.max(1, Number(aboveFloors) || 1);
  return Number((area * floors).toFixed(1));
};

export interface FloorAreaInput {
  constructionAreaM2: NumLike;
  totalFloorAreaM2: NumLike;
  aboveFloors: NumLike;
  undergroundFloors?: NumLike;
}

/** Trả về danh sách cảnh báo mềm (không chặn lưu). */
export const getFloorAreaWarnings = (input: FloorAreaInput): string[] => {
  const area = toPositive(input.constructionAreaM2);
  const gfa = toPositive(input.totalFloorAreaM2);
  const warnings: string[] = [];

  if (area === null) warnings.push('Chưa nhập Diện tích xây dựng.');
  if (gfa === null) warnings.push('Chưa nhập Tổng diện tích sàn.');
  if (area === null || gfa === null) return warnings;

  if (gfa < area) {
    warnings.push(`Tổng diện tích sàn (${gfa} m²) đang nhỏ hơn diện tích xây dựng (${area} m²).`);
  }

  const totalFloors = Math.max(1, Number(input.aboveFloors) || 1) + Math.max(0, Number(input.undergroundFloors) || 0);
  const maxExpected = area * totalFloors * GFA_OVERFLOW_TOLERANCE;
  if (gfa > maxExpected) {
    warnings.push(
      `Tổng diện tích sàn (${gfa} m²) vượt bất thường so với ${totalFloors} tầng × ${area} m² (ngưỡng ≈ ${maxExpected.toFixed(1)} m²).`
    );
  }

  return warnings;
};
