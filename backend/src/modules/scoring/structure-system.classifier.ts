/**
 * ============================================================================
 * PHÂN LOẠI HỆ KẾT CẤU CHỊU LỰC – NGUỒN SỰ THẬT DUY NHẤT (SCORING DOMAIN)
 * Dùng cho bộ chấm điểm VI (chỉ số V2) và kiểm tra tính nhất quán khi thẩm định.
 * ============================================================================
 */

export type StructureClass = 'RC' | 'MIXED' | 'MASONRY' | 'STEEL' | 'SUBSTANDARD' | 'OTHER' | 'UNKNOWN';

function normalize(raw: unknown): string {
  return typeof raw === 'string' ? raw.trim().toLowerCase() : '';
}

export function classifyStructureSystem(raw: unknown): StructureClass {
  const s = normalize(raw);
  if (!s) return 'UNKNOWN';
  // 1. Kết cấu hỗn hợp hoặc khung BTCT tường gạch tự chèn (RC_INFILL -> 2 điểm đồng bộ viCalculator.ts)
  if (s.startsWith('mixed') || s.includes('hỗn hợp') || s.includes('hon_hop') || s.includes('tự chèn') || s.includes('tu_chen') || s.includes('infill')) return 'MIXED';
  // 2. Tường gạch chịu lực (kể cả có ghi kết hợp sàn BTCT)
  if (s.startsWith('masonry') || s.includes('masonry') || s.includes('tường gạch') || s.includes('tuong_gach') || s.includes('gạch chịu lực')) return 'MASONRY';
  // 3. Tạm / kém ổn định
  if (s.includes('kém ổn định') || s.includes('kem_on_dinh') || s.includes('tạm') || s.includes('substandard') || s.includes('weak') || s.includes('temporary')) return 'SUBSTANDARD';
  // 4. Hệ khung BTCT toàn khối (RC)
  if (/^rc\b/.test(s) || s.includes('(rc)') || s.includes('rc_frame') || s.includes('toàn khối') || s.includes('toan_khoi') || s.includes('khung bê tông') || s.includes('khung_btct') || s.includes('khung btct') || s.includes('btct') || s.includes('bê tông cốt thép')) return 'RC';
  // 5. Gạch còn lại
  if (s.includes('gạch')) return 'MASONRY';
  // 6. Kết cấu thép
  if (s.startsWith('steel') || s.includes('thép') || s.includes('ket_cau_thep')) return 'STEEL';
  return 'OTHER';
}

/** Điểm V2 theo hệ kết cấu (RC 1 · Hỗn hợp/Thép/Khác/Chưa rõ 2 · Gạch chịu lực 3 · Tạm/kém ổn định 4) */
export function v2ScoreForStructure(cls: StructureClass): number {
  switch (cls) {
    case 'RC':
      return 1;
    case 'MASONRY':
      return 3;
    case 'SUBSTANDARD':
      return 4;
    default:
      return 2;
  }
}

export const STRUCTURE_LABELS: Record<StructureClass, { vi: string; en: string }> = {
  RC: {
    vi: 'Khung bê tông cốt thép toàn khối (RC) (cột, dầm, sàn BTCT)',
    en: 'Reinforced Concrete (RC) Frame (columns, beams, slabs)',
  },
  MIXED: { vi: 'Kết cấu hỗn hợp (BTCT kết hợp gạch/thép)', en: 'Composite / Mixed Structural System' },
  MASONRY: { vi: 'Tường gạch chịu lực kết hợp sàn BTCT', en: 'Load-bearing Brick Masonry with RC Slabs' },
  STEEL: { vi: 'Khung kết cấu thép', en: 'Steel Frame Structure' },
  SUBSTANDARD: { vi: 'Kết cấu tạm / kém ổn định', en: 'Temporary / Substandard Structure' },
  OTHER: { vi: 'Hệ kết cấu khác (xem ghi chú hiện trường)', en: 'Other structural system (see field notes)' },
  UNKNOWN: { vi: '--', en: '--' },
};

