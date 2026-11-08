import type { BilingualText } from '../../report.types';

/**
 * Nhãn CAT móng chép nguyên văn từ ô chọn "Phân loại CAT móng" trên form thẩm định (AuditStep2OwnerInterview.tsx).
 * Một nguồn cho Mục IV (căn cứ hồ sơ móng) và Mục VIII (V3, chân Bảng VIII.2): không tự đặt câu căn cứ khác.
 */
export const FOUNDATION_CAT_LABELS: Record<number, BilingualText> = {
  1: { vi: 'CAT 1 - Có bản vẽ hoàn công phê duyệt', en: 'CAT 1 - Approved as-built drawings available' },
  2: { vi: 'CAT 2 - Có bản vẽ thiết kế kết cấu chủ nhà giữ', en: 'CAT 2 - Structural design drawings kept by owner' },
  3: { vi: 'CAT 3 - Không bản vẽ, chủ nhà nhớ và khai rõ', en: 'CAT 3 - No drawings, clearly recalled and declared by owner' },
  4: { vi: 'CAT 4 - Suy luận từ số tầng & kết cấu', en: 'CAT 4 - Inferred from storey count & structure' },
  5: { vi: 'CAT 5 - Hoàn toàn không có dữ liệu', en: 'CAT 5 - No data available at all' },
};

export const FOUNDATION_CAT_UNKNOWN: BilingualText = { vi: 'Chưa xác định CAT móng', en: 'Foundation CAT not determined' };
