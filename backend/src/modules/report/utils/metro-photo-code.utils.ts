/**
 * ============================================================================
 * METRO PHOTO CODE UTILS
 * Chuẩn mã ảnh báo cáo: HCM_M2.1_[<mã thửa>]_[<mã căn>_]<hậu tố>
 *   - "1" = phân đoạn tuyến / gói thầu (hằng số toàn dự án).
 *   - Trong ngoặc luôn là MÃ THỬA (C&C-05-B-0001), không dùng Building ID.
 *   - Căn hộ con / khu vực chung chung cư: chèn nguyên unit_code như trên Hub (U-060, M-005).
 * Mã tầng suy theo SỐ LẦU (Tầng N = Lầu N), không bao giờ theo chỉ số mảng.
 * ============================================================================
 */

export const METRO_LINE_SEGMENT = '1';
export const METRO_PHOTO_CODE_PREFIX = `HCM_M2.${METRO_LINE_SEGMENT}_`;

/** Tách tiền tố cũ/mới: "HCM_M2.[X]_S" | "HCM_M2.1_[X]_S" → { bracket: X, suffix: S } */
const CODE_WITH_BRACKET = /^HCM_M2(?:\.\d+)?[._]\[([^\]]*)\]_?(.*)$/i;

function cleanSuffix(suffix: string): string {
  return suffix.trim().replace(/^_+/, '');
}

function withUnit(suffix: string, unitCode?: string | null): string {
  const unit = (unitCode || '').trim();
  if (!unit) return suffix;
  if (suffix.toUpperCase().startsWith(`${unit.toUpperCase()}_`) || suffix.toUpperCase() === unit.toUpperCase()) {
    return suffix;
  }
  return suffix ? `${unit}_${suffix}` : unit;
}

export function buildMetroPhotoCode(parcelCode: string, suffix: string, unitCode?: string | null): string {
  return `${METRO_PHOTO_CODE_PREFIX}[${parcelCode}]_${withUnit(cleanSuffix(suffix), unitCode)}`;
}

/** Phần hậu tố (sau ngoặc) của một mã bất kỳ dạng; mã không có ngoặc coi như toàn bộ là hậu tố. */
export function extractPhotoCodeSuffix(code: string): string {
  const trimmed = (code || '').trim();
  const m = trimmed.match(CODE_WITH_BRACKET);
  return cleanSuffix(m ? m[2] : trimmed);
}

/**
 * Chuẩn hóa mọi dạng mã (cũ "HCM_M2.[X]_S", mới "HCM_M2.1_[X]_S", hoặc chỉ hậu tố "S")
 * về HCM_M2.1_[parcelCode]_[unit_]S. Không bao giờ lặp tiền tố.
 */
export function normalizeMetroPhotoCode(code: string, parcelCode: string, unitCode?: string | null): string {
  return buildMetroPhotoCode(parcelCode, extractPhotoCodeSuffix(code), unitCode);
}

/**
 * Đọc mã chuẩn hóa nằm trong tên file R2:
 * ".../HCM_M2__C_C-05-B-0001__F00_OVERVIEW_01_1790651232797_1d3ea8.jpg"
 *   → { parcel: 'C&C-05-B-0001', suffix: 'F00_OVERVIEW_01' }
 */
export function parseCodeFromPhotoUrl(url?: string | null): { parcel: string; suffix: string } | null {
  if (!url) return null;
  const fileName = decodeURIComponent(url.split('?')[0].split('/').pop() || '');
  const m = fileName.match(/^HCM_M2__(.+?)__(.+?)_\d{13}(?:_[0-9a-z]+)?\.[a-z]+$/i);
  if (!m) return null;
  return { parcel: m[1].replace(/^C_C-/i, 'C&C-'), suffix: m[2] };
}

/** So sánh nội dung mã (bỏ qua tiền tố HCM_M2. / HCM_M2.1_ và khác biệt C_C / C&C). */
export function isSamePhotoCodeContent(a: string, b: string): boolean {
  const norm = (s: string) => extractPhotoCodeSuffix(s).toUpperCase().replace(/C_C/g, 'C&C');
  return norm(a) === norm(b);
}

const FLOOR_SEGMENT = /^(F\d{2}|B\d{2}|MEZZ|SB|ROOF|TERRACE|TUM|FOUND|EXT|DOC)(?=_|$)/i;

/** Thay đoạn mã tầng đầu hậu tố (F02_OVERVIEW_01 → F01_OVERVIEW_01). Không có đoạn tầng thì giữ nguyên. */
export function replaceFloorSegment(suffix: string, floorCode: string): string {
  if (!floorCode || !FLOOR_SEGMENT.test(suffix)) return suffix;
  return suffix.replace(FLOOR_SEGMENT, floorCode);
}

export interface FloorLike {
  floorCode?: string | null;
  floorName?: string | null;
  name?: string | null;
  floorNumber?: number | string | null;
}

/**
 * Mã tầng chuẩn Metro 2 theo SỐ LẦU (memory floor-lau-numbering):
 * "Tầng trệt" → F00, "Tầng 1 (Lầu 1)" → F01, "Tầng 4 (Lầu 3)" → F03, "Tầng 2" → F02,
 * lửng → MEZZ, bán hầm → SB, hầm n → Bnn, mái → ROOF, sân thượng → TERRACE, tum → TUM.
 * Không nhận ra → log lỗi và trả nhãn đã làm sạch (không suy từ chỉ số mảng).
 */
export function resolveFloorCode(fl: FloorLike): string {
  const explicit = String(fl.floorCode || '').trim().toUpperCase();
  if (/^(F\d{2}|B\d{2}|MEZZ|SB|ROOF|TERRACE|TUM)$/.test(explicit)) return explicit;

  const label = String(fl.floorName || fl.name || '').trim();
  const upper = label.toUpperCase();
  const pad = (n: number) => String(n).padStart(2, '0');

  if (upper) {
    if (upper.includes('BÁN HẦM')) return 'SB';
    const ham = upper.match(/HẦM\s*(\d+)/);
    if (ham) return `B${pad(parseInt(ham[1], 10))}`;
    if (upper.includes('LỬNG') || upper.includes('MEZZ')) return 'MEZZ';
    if (upper.includes('SÂN THƯỢNG') || upper.includes('TERRACE')) return 'TERRACE';
    if (upper.includes('MÁI') || upper.includes('ROOF')) return 'ROOF';
    if (/\bTUM\b/.test(upper)) return 'TUM';
    if (upper.includes('TRỆT')) return 'F00';
    const lau = upper.match(/LẦU\s*(\d+)/);
    if (lau) return `F${pad(parseInt(lau[1], 10))}`;
    const tang = upper.match(/TẦNG\s*(\d+)/);
    if (tang) return `F${pad(parseInt(tang[1], 10))}`;
    const fCode = upper.match(/^F(\d{1,2})$/);
    if (fCode) return `F${pad(parseInt(fCode[1], 10))}`;
  }

  const num = Number(fl.floorNumber);
  if (fl.floorNumber !== null && fl.floorNumber !== undefined && fl.floorNumber !== '' && Number.isFinite(num)) {
    if (num === 0.5) return 'MEZZ';
    if (num < 0) return `B${pad(Math.abs(Math.round(num)))}`;
    return `F${pad(Math.floor(num))}`;
  }

  const cleaned =
    upper
      .normalize('NFD')
      .replace(/[̀-ͯ]/g, '')
      .replace(/Đ/g, 'D')
      .replace(/\s+/g, '_')
      .replace(/[^A-Z0-9_-]/g, '') || 'UNKNOWN';
  console.error(`[MetroPhotoCode:floor] Không nhận diện được mã tầng từ "${label}", dùng nhãn "${cleaned}"`);
  return cleaned;
}
