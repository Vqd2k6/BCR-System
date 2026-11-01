/** Xin xác nhận trước khi xóa toàn bộ D khi bỏ đánh dấu "CÓ hư hỏng" của một Vùng Z / Cấu kiện E. */
export function confirmClearDefects(params: {
  ownerCode: string;
  defectCount: number;
  burlandGrade?: number;
}): boolean {
  const { ownerCode, defectCount, burlandGrade } = params;
  const gradeNote = burlandGrade ? ` (Burland Grade ${burlandGrade})` : '';
  return confirm(
    `${ownerCode} đang có ${defectCount} khuyết tật D đã ghi sổ${gradeNote}. Bạn có chắc chắn muốn XÓA TOÀN BỘ số đo, ghi chú của các D này và hủy đánh dấu hư hỏng?`
  );
}
