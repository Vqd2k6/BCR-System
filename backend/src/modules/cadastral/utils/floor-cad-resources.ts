/**
 * Kho tài nguyên CAD của tầng (`building_floor_plans.cad_resources_json`).
 * Bản vẽ là hồ sơ pháp lý: phần tử KHÔNG bao giờ bị bỏ khỏi mảng, chỉ đánh dấu `deletedAt`.
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

export const MAX_FLOOR_CAD_RESOURCES = 20;

const isCategory = (v: unknown): v is FloorCadCategory => v === 'CAD_Z' || v === 'CAD_E' || v === 'OTHER';

/** Đọc mảng JSONB từ DB (bỏ phần tử hỏng, có log). */
export function parseFloorCadResources(raw: unknown): FloorCadResource[] {
  if (!Array.isArray(raw)) return [];
  const out: FloorCadResource[] = [];
  for (const item of raw) {
    if (
      typeof item === 'object' &&
      item !== null &&
      typeof (item as FloorCadResource).id === 'string' &&
      typeof (item as FloorCadResource).url === 'string' &&
      isCategory((item as FloorCadResource).category)
    ) {
      const r = item as FloorCadResource;
      out.push({
        id: r.id,
        title: typeof r.title === 'string' ? r.title : '',
        category: r.category,
        url: r.url,
        createdAt: typeof r.createdAt === 'string' ? r.createdAt : '',
        createdBy: r.createdBy ?? null,
        deletedAt: r.deletedAt ?? null,
      });
    } else {
      console.error('[FloorCadResources:parse] Bỏ qua phần tử kho CAD không hợp lệ:', item);
    }
  }
  return out;
}

/**
 * Gộp kho do client gửi vào kho hiện có:
 * - phần tử mới (id chưa có) được thêm;
 * - phần tử đã có: cập nhật tiêu đề / nhãn / xóa mềm; URL đã lưu không bị thay;
 * - phần tử client bỏ khỏi danh sách → giữ lại và đánh dấu `deletedAt`;
 * - đã xóa mềm thì không "hồi sinh" bằng cách gửi deletedAt = null (phải thêm tờ mới).
 * `replacedStructuralUrl`: CAD_E chính cũ bị thay → lưu thành tờ đã xóa mềm để rollback được.
 */
export function mergeFloorCadResources(
  existing: FloorCadResource[],
  incoming: FloorCadResource[] | undefined,
  opts: { nowIso: string; replacedStructuralUrl?: string | null; userId?: string | null }
): FloorCadResource[] {
  const byId = new Map(existing.map((r) => [r.id, { ...r }]));

  if (incoming) {
    const incomingIds = new Set(incoming.map((r) => r.id));
    for (const r of incoming) {
      const prev = byId.get(r.id);
      if (!prev) {
        byId.set(r.id, {
          ...r,
          createdAt: r.createdAt || opts.nowIso,
          createdBy: r.createdBy ?? opts.userId ?? null,
          deletedAt: r.deletedAt ?? null,
        });
      } else {
        byId.set(r.id, {
          ...prev,
          title: r.title,
          category: r.category,
          deletedAt: prev.deletedAt || r.deletedAt || null,
        });
      }
    }
    for (const [id, prev] of byId) {
      if (!incomingIds.has(id) && !prev.deletedAt && existing.some((e) => e.id === id)) {
        byId.set(id, { ...prev, deletedAt: opts.nowIso });
      }
    }
  }

  const merged = Array.from(byId.values());
  if (opts.replacedStructuralUrl && !merged.some((r) => r.url === opts.replacedStructuralUrl)) {
    merged.push({
      id: `cad_e_replaced_${Date.parse(opts.nowIso) || 0}`,
      title: 'CAD_E chính (bản đã thay)',
      category: 'CAD_E',
      url: opts.replacedStructuralUrl,
      createdAt: opts.nowIso,
      createdBy: opts.userId ?? null,
      deletedAt: opts.nowIso,
    });
  }
  return merged;
}

export const countActiveFloorCadResources = (list: FloorCadResource[]): number => list.filter((r) => !r.deletedAt).length;
