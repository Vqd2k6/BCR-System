/**
 * Chuẩn hóa ngày khảo sát trước khi ghi vào CSDL. Biểu mẫu lưu dạng `dd/mm/yyyy`, trong khi
 * PostgreSQL chạy DateStyle MDY sẽ đảo ngày/tháng (12/10 thành 10/12) nếu truyền chuỗi thô.
 *
 * Trả về chuỗi ISO, hoặc `null` nếu không phải ngày hợp lệ.
 */
export function normalizeSurveyDate(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const value = raw.trim();

  if (/^\d{4}-\d{2}-\d{2}(T.*)?$/.test(value)) {
    return Number.isNaN(Date.parse(value)) ? null : value;
  }

  const match = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(value);
  if (!match) return null;

  const [, day, month, year] = match;
  const iso = `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
  const parsed = new Date(`${iso}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().startsWith(iso) ? iso : null;
}
