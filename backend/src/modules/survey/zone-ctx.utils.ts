/**
 * Đọc ảnh CTX của vùng Z và cấu kiện E khi cột `damage_zones.ctx_photo_url` lệch với `survey_data_json`.
 * Một lượt thay ảnh ngày 17/10 từng ghi đè cột này trên mọi hồ sơ cùng mã vùng, còn JSON do KSV nộp vẫn đúng.
 * Chỉ sửa kết quả đọc, không ghi lại DB.
 */

type JsonRecord = Record<string, unknown>;

interface ZoneCtxRow {
  zone_code?: string | null;
  floor_name?: string | null;
  ctx_photo_url?: string | null;
}

const PARCEL_CODE_IN_URL = /[A-Z]{1,3}(?:&|_|%26)?[A-Z]?-\d{2}-[A-Z]-\d{3,5}/;

const isRecord = (val: unknown): val is JsonRecord => typeof val === 'object' && val !== null && !Array.isArray(val);
const toRecords = (val: unknown): JsonRecord[] => (Array.isArray(val) ? val.filter(isRecord) : []);
const normalizeParcelCode = (code: string): string => code.replace('%26', '').replace(/[^A-Za-z0-9]/g, '').toUpperCase();

/** Tên file ảnh mang mã thửa viết theo nhiều cách: `C&C-05-B-0148`, `C_C-05-B-0148`, `CC-05-B-0148`. */
export function isForeignParcelUrl(url: unknown, parcelCode: unknown): boolean {
  if (typeof url !== 'string' || typeof parcelCode !== 'string' || !parcelCode) return false;
  const found = url.match(PARCEL_CODE_IN_URL)?.[0];
  if (!found) return false;
  const urlCode = normalizeParcelCode(found);
  const ownCode = normalizeParcelCode(parcelCode);
  // Thửa tách như `...-0129-DU` vẫn dùng ảnh mang mã thửa gốc
  return !urlCode.startsWith(ownCode) && !ownCode.startsWith(urlCode);
}

function readRealCtxUrl(item: JsonRecord): string {
  const url = item.ctxPhotoUrl ?? item.ctx_photo_url;
  return typeof url === 'string' && url.trim() !== '' && !url.startsWith('blob:') ? url : '';
}

function buildJsonCtxLookup(surveyJson: unknown) {
  const byFloorAndCode = new Map<string, string>();
  const urlsByCode = new Map<string, Set<string>>();

  const collect = (item: JsonRecord, floorName: unknown) => {
    const code = String(item.zoneCode || item.zone_code || item.elementCode || item.element_code || '');
    const url = readRealCtxUrl(item);
    if (!code || !url) return;
    const floor = String(item.floorName || item.floor_name || floorName || '');
    if (!byFloorAndCode.has(`${floor}|${code}`)) byFloorAndCode.set(`${floor}|${code}`, url);
    if (!floor) urlsByCode.set(code, (urlsByCode.get(code) ?? new Set<string>()).add(url));
  };

  const json = isRecord(surveyJson) ? surveyJson : {};
  for (const floor of toRecords(json.floors)) {
    const floorName = floor.floorName || floor.floor_name;
    [...toRecords(floor.zones), ...toRecords(floor.structuralElements)].forEach((item) => collect(item, floorName));
  }
  [...toRecords(json.damageZones), ...toRecords(json.zones), ...toRecords(json.structuralElements)].forEach((item) =>
    collect(item, '')
  );

  return (row: ZoneCtxRow): string => {
    const code = String(row.zone_code || '');
    const exact = byFloorAndCode.get(`${row.floor_name || ''}|${code}`);
    if (exact) return exact;
    // Chỉ JSON phẳng không ghi tầng mới so theo mã; vùng có ghi tầng mà rỗng thì không mượn ảnh tầng khác
    const urls = urlsByCode.get(code);
    return urls?.size === 1 ? [...urls][0] : '';
  };
}

export function overlayZoneCtxFromJson<T extends ZoneCtxRow>(rows: T[], surveyJson: unknown, parcelCode: unknown): T[] {
  const readJsonCtx = buildJsonCtxLookup(surveyJson);
  return rows.map((row) => {
    const rawJsonUrl = readJsonCtx(row);
    // JSON cũng có thể đã nhận ảnh sai nếu Admin lưu lại từ màn hình đang hiển thị ảnh nhiễm
    const jsonUrl = isForeignParcelUrl(rawJsonUrl, parcelCode) ? '' : rawJsonUrl;
    if (jsonUrl && jsonUrl !== row.ctx_photo_url) return { ...row, ctx_photo_url: jsonUrl };
    if (!jsonUrl && isForeignParcelUrl(row.ctx_photo_url, parcelCode)) return { ...row, ctx_photo_url: '' };
    return row;
  });
}
