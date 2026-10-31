/**
 * Chuẩn hóa "Công năng sử dụng" khi xuất báo cáo (KHÔNG ghi đè dữ liệu gốc trong CSDL).
 * Nhận biết theo cụm từ, không dò ký tự đơn: "ở" nằm trong cả "Trụ sở", "dân" nằm trong cả "nhân dân".
 * Giá trị không khớp nhóm nào được giữ nguyên văn (bỏ tiền tố "Khác:"), không ép vào danh mục.
 */

const HOME = /nhà ở|nhà dân|dân cư|nhà riêng|biệt thự|nhà phố/;
const SHOP = /cửa hàng|cừa hàng|shop|bách hóa|bách hoá|quán|nhà hàng|cafe|cà phê|kinh doanh|buôn bán|thương mại|ki[\s-]?ốt|kiot|tiệm/;
const OFFICE = /văn phòng|trụ sở|công ty|office|(?<![\p{L}\p{N}])(?:vp|cty)(?![\p{L}\p{N}])/u;
const LODGING = /khách sạn|nhà nghỉ|hotel|nhà trọ/;
const CONDO = /chung cư|căn hộ/;
const WAREHOUSE = /(?<!\p{L})kho(?!\p{L})|xưởng/u;

export const USAGE_MIXED = 'Hỗn hợp (Ở / Cửa hàng / VP)';
export const USAGE_SHOP = 'Cửa hàng / Kinh doanh';
export const USAGE_OFFICE = 'Văn phòng';
export const USAGE_LODGING = 'Khách sạn / Nhà nghỉ';
export const USAGE_CONDO = 'Chung cư';
export const USAGE_CONDO_UNIT = 'Căn hộ chung cư';
export const USAGE_HOME = 'Nhà ở gia đình';
export const USAGE_WAREHOUSE = 'Kho hàng / Xưởng sản xuất';

export function normalizeUsageFunction(raw: string | null | undefined, isUnit: boolean): string {
  const cleaned = (raw ?? '').normalize('NFC').trim().replace(/^khác\s*:\s*/i, '').trim();
  if (!cleaned) return isUnit ? USAGE_CONDO_UNIT : '';

  const s = cleaned.toLowerCase();
  const hasHome = HOME.test(s);
  const hasShop = SHOP.test(s);
  const hasOffice = OFFICE.test(s);

  if (Number(hasHome) + Number(hasShop) + Number(hasOffice) >= 2) return USAGE_MIXED;
  if (LODGING.test(s)) return USAGE_LODGING;
  if (hasShop) return USAGE_SHOP;
  if (hasOffice) return USAGE_OFFICE;
  if (CONDO.test(s)) return isUnit ? USAGE_CONDO_UNIT : USAGE_CONDO;
  if (WAREHOUSE.test(s)) return USAGE_WAREHOUSE;
  if (hasHome) return isUnit ? USAGE_CONDO_UNIT : USAGE_HOME;
  return cleaned;
}
