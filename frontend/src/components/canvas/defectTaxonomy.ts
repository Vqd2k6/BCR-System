/** Danh mục khuyết tật dùng chung cho Khảo sát và Thẩm định, để D ghi ở hai nơi cùng một ngôn ngữ phân loại. */
export const LEAK_SCREENING_CATEGORY = 'Thấm dột / Ẩm mốc bề mặt';
export const DOOR_SCREENING_CATEGORY = 'Kẹt cửa / Cong vênh phụ kiện';

export const ARCH_SCREENING_CATEGORIES = [
  'Nứt tường gạch / Vữa trát hoàn thiện',
  'Nứt tiếp giáp khuôn cửa / Trần',
  'Nứt vỡ gạch ốp lát / Đá ốp',
  'Bong rộp / Bong tróc gạch ốp lát',
  LEAK_SCREENING_CATEGORY,
  DOOR_SCREENING_CATEGORY,
  'Khác',
];

export const ARCH_DEFECT_TYPES = [
  'Nứt chân chim / Mạng nhện vữa trát (<0.5mm)',
  'Nứt ziczac theo mạch vữa gạch',
  'Nứt góc cửa sổ / Cửa đi',
  'Nứt tiếp giáp Cột - Tường gạch',
  'Nứt tiếp giáp Dầm - Tường gạch',
  'Bong rộp sơn vôi / Ẩm mốc loang lổ',
  'Bong tách gạch ốp tường / Gạch lát nền',
  'Nứt trần thạch cao / Khe tiếp giáp la phông',
  'Khác',
];

export const STRUCT_SCREENING_CATEGORIES = [
  'Nứt cấu kiện kết cấu chịu lực (Cột/Dầm/Sàn)',
  'Vỡ bê tông / Trơ rỉ cốt thép chịu lực',
  'Nứt nút khung / Mối nối liên kết chịu lực',
  'Võng uốn dầm sàn / Biến dạng cấu kiện',
  'Nứt gãy cổ cột / Móng tiếp giáp nền',
  LEAK_SCREENING_CATEGORY,
  'Khác',
];

export const STRUCT_DEFECT_TYPES = [
  'Nứt xiên 45° chịu cắt gần đầu cột / gối dầm (Nguy hiểm)',
  'Nứt dọc thân cột bê tông (Quá tải nén dọc)',
  'Nứt uốn giữa nhịp dầm / Đáy bản sàn chịu lực',
  'Nứt toác / Bong bê tông lộ cốt thép gỉ sét',
  'Nứt tách mép tấm sàn BTCT chịu lực',
  'Nứt tách rời nút khung Cột - Dầm',
  'Nứt gãy chân cột / Cổ móng',
  'Lỏng rơ bu lông / Rách mối hàn liên kết thép',
  'Khác',
];

// Giá trị D theo thang của `ecsCalculator`: 1-4 là mức nước, 5 là kẹt cửa (quy về 2 điểm khi tính E6)
const LEAK_TYPE_E6: Record<string, number> = {
  'Ẩm mốc bề mặt': 1,
  'Thấm nước': 2,
  'Dột nước': 3,
  'Rò rỉ nước tràn': 4,
};
const MOLD_TYPE_E6: Record<string, number> = { 'Bong rộp sơn vôi / Ẩm mốc loang lổ': 1 };
const DOOR_JAMMED_E6 = 5;

export const LEAK_DEFECT_TYPES = Object.keys(LEAK_TYPE_E6);
export const DOOR_DEFECT_TYPES = ['Kẹt cửa đi', 'Kẹt cửa sổ', 'Cong vênh khung cửa / phụ kiện', 'Khác'];

/** Dạng khuyết tật được chọn tùy nhóm: nhóm thấm dột phải chỉ rõ mức nước vì mức đó quyết định E6. */
export function getDefectTypesForCategory(category: string, baseTypes: string[]): string[] {
  if (category === LEAK_SCREENING_CATEGORY) return LEAK_DEFECT_TYPES;
  if (category === DOOR_SCREENING_CATEGORY) return DOOR_DEFECT_TYPES;
  return baseTypes;
}

export function isLeakTypeMissing(category: string, defectType: string): boolean {
  return category === LEAK_SCREENING_CATEGORY && !(defectType in LEAK_TYPE_E6);
}

/** Ảnh hưởng công năng là hệ quả của loại khuyết tật; `ecsCalculator` đọc giá trị này để tổng hợp E6. */
export function deriveDefectE6(screeningCategory: string, defectType: string): number {
  if (screeningCategory === DOOR_SCREENING_CATEGORY) return DOOR_JAMMED_E6;
  return LEAK_TYPE_E6[defectType] ?? MOLD_TYPE_E6[defectType] ?? 0;
}

export function describeDefectE6(value: number | null | undefined): string {
  if (value === null || value === undefined) return 'Chưa ghi nhận';
  const labels = ['Không ảnh hưởng', 'Ẩm mốc', 'Thấm nước', 'Dột nước', 'Rò rỉ nước tràn', 'Kẹt cửa'];
  return labels[value] ?? String(value);
}
