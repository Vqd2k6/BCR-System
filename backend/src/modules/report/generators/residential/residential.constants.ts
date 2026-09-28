/**
 * Các bảng tra cứu nhãn chuẩn (Dictionaries) & Badge helpers cho Báo cáo Khảo sát Phase 1 CRLG
 */

export const structuralSystemLabels: Record<string, string> = {
  KHUNG_BTCT_CHIU_LUC: 'Khung bê tông cốt thép (BTCT) chịu lực',
  TUONG_GACH_CHIU_LUC: 'Tường gạch chịu lực',
  KET_CAU_THEP: 'Khung nhà kết cấu thép tiền chế',
  NHA_GO: 'Nhà khung gỗ truyền thống',
  KET_CAU_HON_HOP: 'Kết cấu hỗn hợp (BTCT kết hợp tường gạch)',
  'Masonry - Tường gạch chịu lực': 'Tường gạch chịu lực',
  'RC - Bê tông cốt thép': 'Khung bê tông cốt thép (BTCT) chịu lực',
};

export const foundationLabels: Record<string, string> = {
  CAT_1_MONG_NONG_GIA_CO: 'CAT 1: Móng nông gia cố cừ tràm / đệm cát',
  CAT_2_MONG_DON_BTCT: 'CAT 2: Móng đơn bê tông cốt thép',
  CAT_3_MONG_BANG_BTCT: 'CAT 3: Móng băng bê tông cốt thép',
  CAT_4_MONG_COC_BTCT: 'CAT 4: Móng cọc bê tông cốt thép (Cọc ép/khoan nhồi)',
  CAT_5_KHONG_XAC_DINH: 'CAT 5: Không xác định / Chưa có hồ sơ móng',
};

export const burlandLabels: string[] = [
  'Không đáng kể (Negligible)',
  'Rất nhẹ (Very slight)',
  'Nhẹ (Slight)',
  'Trung bình (Moderate)',
  'Nặng (Severe)',
  'Rất nặng (Very severe)',
];

export const activityStateLabels: Record<string, string> = {
  U: 'Chưa rõ (Unknown)',
  S: 'Ổn định / Cũ (Stable)',
  A: 'Đang phát triển (Active)',
};

export const structuralSigLabels: Record<number, string> = {
  0: 'Không ảnh hưởng (N/A)',
  1: 'Thấp (Low)',
  2: 'Trung bình (Moderate)',
  3: 'Cao (High)',
  4: 'Nguy cấp (Critical)',
};

export const objectGroupLabels: Record<string, string> = {
  GENERAL: 'Công trình thông thường (Nhà dân cư / Trụ sở thương mại thấp tầng)',
  IMPORTANT: 'Công trình quan trọng / Tập trung đông người (Trường học, Bệnh viện, Khách sạn)',
  SENSITIVE: 'Công trình đặc biệt nhạy cảm với biến dạng (Di tích lịch sử, Tòa nhà công nghệ cao)',
};

export const surveyCaseLabels: Record<string, string> = {
  NORMAL: 'Khảo sát bình thường (Đầy đủ từ móng đến mái)',
  ABSENTEE: 'Chủ hộ vắng mặt / Không tiếp cận được hiện trường',
  VACANT_LAND: 'Khu đất trống chưa có công trình xây dựng kiên cố',
  APARTMENT: 'Căn hộ con trong khối nhà chung cư / Tập thể',
  UNDER_CONSTRUCTION: 'Công trình đang thi công dở dang',
};

export const structuralFlagLabels: Record<string, string> = {
  NONE: 'None - Không có cờ kết cấu (0đ)',
  LOW: 'Low - Cờ kết cấu thấp (1đ)',
  MODERATE: 'Moderate - Cờ kết cấu trung bình (2đ)',
  HIGH: 'High - Cờ kết cấu cao / Nguy cơ chịu lực (3đ)',
  CRITICAL: 'Critical - Cờ kết cấu nguy cấp / Cảnh báo sập (4đ)',
};

export const RENOVATION_LABELS: Record<number, string> = {
  0: 'Không',
  1: 'Nhẹ - Đã xử lý ổn định',
  2: 'Nhiều - Chưa rõ kết cấu',
  3: 'Thay đổi lớn - Nghiêm trọng',
};

export const MAJOR_REPAIR_LABELS: Record<number, string> = {
  0: 'Không',
  1: 'Nhẹ - Đã xử lý',
  2: 'Nhiều - Chưa rõ hồ sơ',
  3: 'Cải tạo lớn ảnh hưởng chịu lực',
};

export const PAST_SETTLEMENT_LABELS: Record<number, string> = {
  0: 'Không',
  1: 'Nhẹ - Đã ổn định',
  2: 'Rõ - Tiếp diễn',
  3: 'Nghiêm trọng',
};

export const NEIGHBOR_DAMAGE_LABELS: Record<number, string> = {
  0: 'Không',
  1: 'Nhẹ - Đã bồi thường',
  2: 'Đáng kể',
  3: 'Tranh chấp - Nghiêm trọng',
};

export const FIRE_FLOOD_LABELS: Record<number, string> = {
  0: 'Không',
  1: 'Nhẹ - Đã khắc phục',
  2: 'Trung bình - Chưa rõ mức ảnh hưởng',
  3: 'Nghiêm trọng',
};

export function getEcsBadge(c: string): string {
  switch (c) {
    case 'GOOD': return 'badge-good';
    case 'MEDIUM': return 'badge-medium';
    case 'DEFICIENT': return 'badge-deficient';
    case 'CRITICAL': return 'badge-critical';
    default: return 'badge-medium';
  }
}

export function getViBadge(c: string): string {
  switch (c) {
    case 'LOW': return 'badge-good';
    case 'MEDIUM': return 'badge-medium';
    case 'HIGH': return 'badge-deficient';
    case 'VERY_HIGH': return 'badge-critical';
    default: return 'badge-medium';
  }
}

export function getBraBadge(c: string): string {
  if (c?.includes('LOW')) return 'badge-good';
  if (c?.includes('MEDIUM')) return 'badge-medium';
  if (c?.includes('VERY_HIGH')) return 'badge-critical';
  if (c?.includes('HIGH')) return 'badge-deficient';
  return 'badge-medium';
}
