/**
 * CAD căn/khu vực cũ được lưu base64 ngay trong building_units (360–555 KB mỗi trường).
 * Màn khảo sát chỉ cần CAD của ĐÚNG căn đang mở; CAD của các căn khác trên tầng chỉ làm nặng response
 * (mỗi lượt gọi lặp từng tốn ~1 MB dữ liệu di động). Hàm này bỏ chuỗi base64 của các căn khác, kèm cờ báo.
 */

export interface InlineCadUnit {
  id?: string;
  unit_code?: string;
  unit_cad_url?: string | null;
  unit_structural_cad_url?: string | null;
}

const isInlineData = (v: string | null | undefined): boolean => typeof v === 'string' && v.startsWith('data:');

export function omitInlineCadExcept<T extends InlineCadUnit>(
  units: T[],
  keepFor: string
): Array<T & { has_inline_unit_cad?: boolean; has_inline_structural_cad?: boolean }> {
  const keep = keepFor.trim();
  return units.map((u) => {
    if (keep && (u.id === keep || u.unit_code === keep)) return u;
    const z = isInlineData(u.unit_cad_url);
    const e = isInlineData(u.unit_structural_cad_url);
    if (!z && !e) return u;
    return {
      ...u,
      unit_cad_url: z ? null : u.unit_cad_url,
      unit_structural_cad_url: e ? null : u.unit_structural_cad_url,
      has_inline_unit_cad: z || undefined,
      has_inline_structural_cad: e || undefined,
    };
  });
}
