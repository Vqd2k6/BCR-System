/**
 * Tờ bản vẽ của tầng chung cư: CAD_Z (kiến trúc), CAD_E (kết cấu) và Kho tài nguyên tầng.
 * Kiểu khớp `backend/src/modules/cadastral/utils/floor-cad-resources.ts`.
 */

export type FloorCadCategory = 'CAD_Z' | 'CAD_E' | 'OTHER';

export interface FloorCadResource {
  id: string;
  title: string;
  category: FloorCadCategory;
  url: string;
  createdAt: string;
  createdBy?: string | null;
  deletedAt?: string | null;
}

export interface CadBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface CadSheetSource {
  id: string;
  category: FloorCadCategory;
  title: string;
  url: string;
  bbox?: CadBox | null;
}

export const MAX_FLOOR_CAD_RESOURCES = 20;

export const CAD_CATEGORY_LABEL: Record<FloorCadCategory, string> = {
  CAD_Z: 'CAD_Z Kiến trúc',
  CAD_E: 'CAD_E Kết cấu',
  OTHER: 'Khác',
};

export const MAIN_Z_SOURCE_ID = 'floor-cad-z';
export const MAIN_E_SOURCE_ID = 'floor-cad-e';

const isCategory = (v: unknown): v is FloorCadCategory => v === 'CAD_Z' || v === 'CAD_E' || v === 'OTHER';

/** Đọc `cad_resources_json` từ API (bỏ phần tử hỏng, có log) */
export function parseFloorCadResources(raw: unknown): FloorCadResource[] {
  if (!Array.isArray(raw)) return [];
  const out: FloorCadResource[] = [];
  for (const item of raw) {
    if (typeof item !== 'object' || item === null) continue;
    const r = item as Record<string, unknown>;
    if (typeof r.id === 'string' && typeof r.url === 'string' && isCategory(r.category)) {
      out.push({
        id: r.id,
        title: typeof r.title === 'string' ? r.title : '',
        category: r.category,
        url: r.url,
        createdAt: typeof r.createdAt === 'string' ? r.createdAt : '',
        createdBy: typeof r.createdBy === 'string' ? r.createdBy : null,
        deletedAt: typeof r.deletedAt === 'string' ? r.deletedAt : null,
      });
    } else {
      console.error('[cadSources:parseFloorCadResources] Bỏ qua tờ kho CAD không hợp lệ:', item);
    }
  }
  return out;
}

export const activeFloorCadResources = (list: FloorCadResource[]): FloorCadResource[] => list.filter((r) => !r.deletedAt);

/**
 * Danh sách tờ để cắt cho một U/M.
 * Thứ tự: CAD_E tầng (kèm khung E nếu Admin đã đặt) → tờ CAD_E / Khác / CAD_Z trong kho → CAD_Z tầng (kèm khung Z).
 * Toạ độ khung chỉ gắn vào đúng tờ của nó: khung Z không áp lên tờ E (quy tắc 3A).
 */
export function buildCadSheetSources(opts: {
  zUrl?: string | null;
  eUrl?: string | null;
  resources?: FloorCadResource[];
  zBbox?: CadBox | null;
  eBbox?: CadBox | null;
}): CadSheetSource[] {
  const out: CadSheetSource[] = [];
  if (opts.eUrl) out.push({ id: MAIN_E_SOURCE_ID, category: 'CAD_E', title: 'CAD_E tầng', url: opts.eUrl, bbox: opts.eBbox ?? null });
  const order: FloorCadCategory[] = ['CAD_E', 'OTHER', 'CAD_Z'];
  for (const cat of order) {
    for (const r of activeFloorCadResources(opts.resources || [])) {
      if (r.category !== cat) continue;
      if (r.url === opts.eUrl || r.url === opts.zUrl) continue;
      out.push({ id: r.id, category: r.category, title: r.title || CAD_CATEGORY_LABEL[r.category], url: r.url, bbox: null });
    }
  }
  if (opts.zUrl) out.push({ id: MAIN_Z_SOURCE_ID, category: 'CAD_Z', title: 'CAD_Z tầng', url: opts.zUrl, bbox: opts.zBbox ?? null });
  return out;
}

export type StructuralCadAutoLoad =
  | { kind: 'USE_UNIT_E'; url: string }
  | { kind: 'CROP_FLOOR_E'; floorEUrl: string; bbox: CadBox }
  | { kind: 'SUGGEST_FLOOR_E'; floorEUrl: string }
  | { kind: 'NONE' };

/**
 * Quy tắc 3A khi KSV mở U/M:
 * - Admin đã cắt CAD_E riêng cho U/M → dùng luôn;
 * - Admin đã đặt khung E trên CAD_E tầng → cắt theo khung E;
 * - Tầng chỉ có CAD_E chung → KHÔNG tự cắt bằng khung Z, chỉ gợi ý KSV tự cắt;
 * - Không có CAD_E → không làm gì.
 */
export function resolveStructuralCadAutoLoad(opts: {
  unitStructuralCadUrl?: string | null;
  structuralBbox?: CadBox | null;
  floorStructuralUrl?: string | null;
}): StructuralCadAutoLoad {
  if (opts.unitStructuralCadUrl) return { kind: 'USE_UNIT_E', url: opts.unitStructuralCadUrl };
  if (opts.floorStructuralUrl && opts.structuralBbox) {
    return { kind: 'CROP_FLOOR_E', floorEUrl: opts.floorStructuralUrl, bbox: opts.structuralBbox };
  }
  if (opts.floorStructuralUrl) return { kind: 'SUGGEST_FLOOR_E', floorEUrl: opts.floorStructuralUrl };
  return { kind: 'NONE' };
}

/** Tạo id tờ kho phía client (máy chủ giữ nguyên id) */
export const newFloorCadResourceId = (): string => `res_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;

/** Đo kích thước thật của ảnh (để kiểm tỷ lệ Z/E trước khi áp nhanh khung) */
export function loadImageSize(url: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
    img.onerror = (ev) => reject(new Error(`Không tải được ảnh để đo kích thước: ${String(ev)}`));
    img.src = url;
  });
}

/** Chênh lệch tỷ lệ khung hình giữa 2 ảnh (0.01 = 1%) */
export const aspectRatioDiff = (a: { width: number; height: number }, b: { width: number; height: number }): number => {
  const ra = a.width / a.height;
  const rb = b.width / b.height;
  return Math.abs(ra - rb) / Math.max(ra, rb);
};
