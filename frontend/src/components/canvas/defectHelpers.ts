export const isCrackRelated = (cat?: string | null, type?: string | null): boolean => {
  const catStr = (cat || '').toLowerCase();
  const typeStr = (type || '').toLowerCase();
  const full = `${catStr} ${typeStr}`;

  // Các nhóm thuần phi vết nứt (ẩm mốc, bong rộp, rỉ sét, kẹt cửa)
  if (
    full.includes('thấm dột') ||
    full.includes('ẩm mốc') ||
    full.includes('kẹt cửa') ||
    full.includes('cong vênh') ||
    full.includes('bong rộp') ||
    full.includes('bong tróc') ||
    full.includes('rỉ sét')
  ) {
    // Chỉ coi là nứt nếu cụ thể loại khuyết tật chọn là dạng nứt
    if (typeStr.includes('nứt') || typeStr.includes('crack')) {
      return true;
    }
    return false;
  }

  return full.includes('nứt') || full.includes('crack');
};
