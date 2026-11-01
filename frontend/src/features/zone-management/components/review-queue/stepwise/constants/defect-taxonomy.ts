/** Danh mục phân loại khuyết tật dùng chung cho thẩm định Nhà dân và Chung cư. */
export const DEFECT_TYPE_PRESETS = [
  'Vết nứt thẳng đứng',
  'Vết nứt xiên 45 độ',
  'Vết nứt ngang',
  'Nứt chân chim',
  'Bong tróc vữa/sơn',
  'Bong vỡ bê tông',
  'Rỉ ố ẩm mốc / Thấm dột',
  'Lún sụt / Nứt sàn',
  'Nứt tiếp giáp cấu kiện',
  'Nghiêng lệch cấu kiện',
  'Vết nứt tường',
  'Vết nứt dầm/cột',
  'Khác',
];

export {
  ARCH_DEFECT_TYPES,
  ARCH_SCREENING_CATEGORIES,
  STRUCT_DEFECT_TYPES,
  STRUCT_SCREENING_CATEGORIES,
} from '../../../../../../components/canvas/defectTaxonomy';

export const CRACK_DIRECTION_OPTIONS = ['Ngang', 'Dọc', 'Xiên 45°', 'Chân chim / Đa hướng'];

export const ACTIVITY_STATE_OPTIONS: Array<{ value: 'U' | 'S' | 'A'; label: string }> = [
  { value: 'S', label: 'S - Ổn định' },
  { value: 'A', label: 'A - Đang phát triển' },
  { value: 'U', label: 'U - Chưa rõ' },
];
