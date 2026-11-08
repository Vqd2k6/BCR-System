/**
 * Câu 4 (Thiệt hại lân cận) và câu 5 (Cháy nổ / ngập) trong `historyInterview` có 2 tên khóa:
 *   - Khóa mới, do mọi form frontend (khảo sát + thẩm định) đọc/ghi: `neighborDamage`, `fireFloodIncident`.
 *   - Khóa cũ, chỉ do backend chép sang để tương thích: `neighborImpact`, `fireFloodHistory`.
 *
 * Luôn đọc KHÓA MỚI TRƯỚC. Nếu ưu tiên khóa cũ, lần sửa thứ 2 trở đi của Admin trên form thẩm định
 * (form chỉ sửa khóa mới nhưng gửi cả object còn mang khóa cũ) sẽ bị trả về giá trị cũ.
 */
export interface HistoryInterviewAliasSource {
  neighborDamage?: unknown;
  neighborImpact?: unknown;
  fireFloodIncident?: unknown;
  fireFloodHistory?: unknown;
}

export function resolveHistoryInterviewAliases(hi: HistoryInterviewAliasSource | null | undefined): {
  neighbor: unknown;
  fireFlood: unknown;
} {
  return {
    neighbor: hi?.neighborDamage ?? hi?.neighborImpact,
    fireFlood: hi?.fireFloodIncident ?? hi?.fireFloodHistory,
  };
}
