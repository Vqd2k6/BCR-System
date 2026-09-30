export const RESIDUAL_FUNCTION_OPTIONS = [
  { value: 'RESIDUAL_SURPLUS', label: '1. Đất thừa / Sai số biên ranh (Mặc định - Đất dôi dư)' },
  { value: 'Nhà ở gia đình (Nhà phố / Biệt thự / Căn hộ)', label: '2. Nhà ở gia đình (Nhà phố / Biệt thự / Căn hộ)' },
  { value: 'Cửa hàng / Shop / Bách hóa', label: '3. Cửa hàng / Shop / Bách hóa' },
  { value: 'Quán ăn / Nhà hàng / Cafe', label: '4. Quán ăn / Nhà hàng / Cafe' },
  { value: 'Văn phòng / Trụ sở công ty', label: '5. Văn phòng / Trụ sở công ty' },
  { value: 'Kho hàng / Xưởng sản xuất', label: '6. Kho hàng / Xưởng sản xuất' },
  { value: 'Đất trống / Sân vườn', label: '7. Đất trống / Sân vườn' },
  { value: 'Ngõ đi chung / Lối thoát hiểm', label: '8. Ngõ đi chung / Lối thoát hiểm' },
  { value: 'OTHER', label: '9. Khác (Nhập công năng cụ thể...)' },
];

export const NON_BUILDING_RESIDUAL_OPTIONS = [
  { value: 'RESIDUAL_SURPLUS', label: '1. Đất thừa / Sai số biên ranh (Mặc định)' },
  { value: 'Đất trống / Sân vườn', label: '2. Đất trống / Sân vườn' },
  { value: 'Ngõ đi chung / Lối thoát hiểm', label: '3. Ngõ đi chung / Lối thoát hiểm' },
  { value: 'Ao hồ / Mương nước / Cây xanh', label: '4. Ao hồ / Mương nước / Cây xanh' },
  { value: 'OTHER', label: '5. Khác (Nhập công năng cụ thể...)' },
];

export const BUILDING_RESIDUAL_OPTIONS = [
  { value: 'Nhà ở gia đình (Nhà phố / Biệt thự / Căn hộ)', label: '1. Nhà ở gia đình (Nhà phố / Biệt thự / Căn hộ)' },
  { value: 'Cửa hàng / Shop / Bách hóa', label: '2. Cửa hàng / Shop / Bách hóa' },
  { value: 'Quán ăn / Nhà hàng / Cafe', label: '3. Quán ăn / Nhà hàng / Cafe' },
  { value: 'Văn phòng / Trụ sở công ty', label: '4. Văn phòng / Trụ sở công ty' },
  { value: 'Kho hàng / Xưởng sản xuất', label: '5. Kho hàng / Xưởng sản xuất' },
  { value: 'OTHER', label: '6. Khác (Nhập công năng cụ thể...)' },
];

export const COMMON_SPLIT_REASONS = [
  'Nhà gốc chia tách 2 căn riêng biệt có lối đi độc lập',
  'Chủ nhà đã chuyển nhượng 1 phần diện tích phía sau',
  'Thừa kế phân chia quyền sử dụng đất cho các con',
  'Tách phần đất dôi dư ngoài ranh xây dựng công trình',
  'Thực tế xây dựng 2 căn có đồng hồ điện nước riêng',
  'Tách thửa do sai lệch ranh đo đạc địa chính hiện trường',
];

export const COMMON_MERGE_REASONS = [
  'Chủ hộ mua lại các thửa lân cận và xây dựng hợp khối một công trình duy nhất',
  'Thừa kế nhiều thửa liền kề, gia đình sử dụng chung một khối nhà',
  'Xây dựng công trình/nhà xưởng vượt qua ranh giới nhiều thửa đất',
  'Đã được cấp Giấy chứng nhận gộp thửa mới nhưng bản đồ địa chính cũ chưa hợp nhất',
];
