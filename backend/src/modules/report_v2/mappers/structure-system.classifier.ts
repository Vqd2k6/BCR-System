/**
 * ============================================================================
 * PHÂN LOẠI HỆ KẾT CẤU CHỊU LỰC – NGUỒN SỰ THẬT DUY NHẤT
 * Dùng chung cho Mục IV (loại hình kết cấu) và chỉ số V2 (BRA) để hai nơi không lệch nhau.
 *
 * Lỗi cũ: Mục IV kiểm tra chữ "thép" trước nên "RC - BTCT (Khung bê tông cốt thép toàn khối)"
 * bị in thành "Khung kết cấu thép tiền chế".
 * ============================================================================
 */

export type StructureClass = 'RC' | 'MIXED' | 'MASONRY' | 'STEEL' | 'SUBSTANDARD' | 'OTHER' | 'UNKNOWN';

function normalize(raw: unknown): string {
  return typeof raw === 'string' ? raw.trim().toLowerCase() : '';
}

export function classifyStructureSystem(raw: unknown): StructureClass {
  const s = normalize(raw);
  if (!s) return 'UNKNOWN';
  // 1. Hệ khung BTCT tường gạch tự chèn hoặc RC frame
  if (/^rc\b/.test(s) || s.includes('khung bê tông') || s.includes('khung_btct') || s.includes('khung btct')) return 'RC';
  // 2. Kết cấu hỗn hợp
  if (s.startsWith('mixed') || s.includes('hỗn hợp') || s.includes('hon_hop')) return 'MIXED';
  // 3. Tường gạch chịu lực (kể cả có ghi kết hợp sàn BTCT)
  if (s.startsWith('masonry') || s.includes('tường gạch') || s.includes('tuong_gach') || s.includes('gạch chịu lực')) return 'MASONRY';
  // 4. Bê tông cốt thép còn lại
  if (s.includes('btct') || s.includes('bê tông cốt thép')) return 'RC';
  // 5. Gạch còn lại
  if (s.includes('gạch')) return 'MASONRY';
  // 6. Kết cấu thép
  if (s.startsWith('steel') || s.includes('thép') || s.includes('ket_cau_thep')) return 'STEEL';
  // 7. Tạm / kém ổn định
  if (s.includes('kém ổn định') || s.includes('tạm') || s.includes('substandard')) return 'SUBSTANDARD';
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
