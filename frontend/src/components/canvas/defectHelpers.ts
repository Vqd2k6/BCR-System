/**
 * Kiểm tra xem một khuyết tật ghi sổ D có thuộc dạng vết nứt hay không.
 * - Trả về true nếu nhóm chỉ báo hoặc loại khuyết tật chứa từ 'nứt' hoặc 'crack'.
 * - Trả về false đối với các khuyết tật phi vết nứt như: Thấm dột, Ẩm mốc, Bong rộp, Kẹt cửa, Võng dầm sàn, Vỡ bê tông...
 */
export const isCrackRelated = (cat?: string | null, type?: string | null): boolean => {
  const t = `${cat || ''} ${type || ''}`.toLowerCase();
  return t.includes('nứt') || t.includes('crack');
};
