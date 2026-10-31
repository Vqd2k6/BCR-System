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

export const ARCH_SCREENING_CATEGORIES = [
  'A. Hư hỏng bề mặt & Hoàn thiện',
  'B. Thấm, Ẩm & Nước xâm nhập',
  'C. Biến dạng & Lệch hình học',
  'D. Hư hỏng bộ phận phi kết cấu',
];

export const ARCH_DEFECT_TYPES = [
  'Nứt tường gạch / Vữa trát hoàn thiện',
  'Bong tróc / Phồng rộp lớp sơn - vữa',
  'Rêu mốc / ố vàng / Thấm nước bề mặt',
  'Vỡ / Bong bật gạch lát nền - ốp tường',
  'Võng / Nứt tấm trần thạch cao - trần giả',
  'Kẹt / Xệ cánh cửa đi - cửa sổ',
  'Nứt gãy lan can / Tay vịn cầu thang',
  'Khác (Ghi rõ tại ghi chú)',
];

export const STRUCT_SCREENING_CATEGORIES = [
  'A. Nứt kết cấu (Structural Cracking)',
  'B. Biến dạng & Chuyển vị kết cấu',
  'C. Suy thoái vật liệu kết cấu',
  'D. Thấm - Ẩm ảnh hưởng kết cấu',
  'E. Mất liên kết & Hư hỏng nút khung',
];

export const STRUCT_DEFECT_TYPES = [
  'Nứt cắt xiên (45°) đầu dầm / chân cột',
  'Nứt uốn giữa nhịp dầm / Đáy bản sàn chịu lực',
  'Nứt dọc theo cốt thép chủ (Do ăn mòn cốt thép)',
  'Bong bật lớp bê tông bảo vệ / Lộ cốt thép gỉ',
  'Rỗ tổ ong / Phân tầng bê tông cấu kiện chính',
  'Thấm nước xuyên sàn BTCT / Khe lún - Cổ ống',
  'Võng bản sàn / Võng dầm vượt giới hạn mắt thường',
  'Biến dạng / Nứt tách tại nút giao Cột - Dầm',
  'Khác (Ghi rõ tại ghi chú)',
];

export const CRACK_DIRECTION_OPTIONS = ['Ngang', 'Dọc', 'Xiên 45°', 'Chân chim / Đa hướng'];

export const ACTIVITY_STATE_OPTIONS: Array<{ value: 'U' | 'S' | 'A'; label: string }> = [
  { value: 'S', label: 'S - Ổn định' },
  { value: 'A', label: 'A - Đang phát triển' },
  { value: 'U', label: 'U - Chưa rõ' },
];
