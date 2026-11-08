/**
 * Thứ tự tầng hiển thị trong báo cáo: từ dưới lên (Hầm → Trệt → Lửng → Lầu 1, 2… → Sân thượng → Mái → Tum).
 * Mảng `floors` lưu theo thứ tự KSV thêm tầng (vd. Trệt, Tầng 2, Tầng 1) nên phải sắp lại khi in.
 *
 * Chỉ dùng để SẮP XẾP: không đổi `resolveFloorCode` (mã đó được dập lên ảnh) và không ghi lại thứ tự vào DB.
 * Mỗi phần tử giữ `sourceIndex` = vị trí gốc trong mảng, vì khóa xoay ảnh (`floor_${idx}_cad`, `zone_f${idx}_…`)
 * dựa vào vị trí gốc đó.
 */
import { resolveFloorCode } from './metro-photo-code.utils';

export interface OrderedFloor<T> {
  floor: T;
  sourceIndex: number;
}

interface FloorLabelSource {
  floorName?: unknown;
  name?: unknown;
  floorCode?: unknown;
  floorNumber?: unknown;
}

const isRecord = (v: unknown): v is FloorLabelSource => typeof v === 'object' && v !== null;

/** Hạng cao độ của một tầng; null khi không nhận diện được (giữ vị trí tương đối như mảng gốc). */
export function floorElevationRank(floor: unknown): number | null {
  if (!isRecord(floor)) return null;
  const label = String(floor.floorName ?? floor.name ?? '').trim().toUpperCase();

  // Nhãn resolveFloorCode không nhận ra nhưng hay gặp trong dữ liệu thật.
  if (label) {
    if (label.includes('THƯỢNG')) return 900;
    if (label.includes('KỸ THUẬT')) return 899;
    if (label.includes('LỬNG') || label.includes('LỮNG') || label.includes('GÁC')) return 0.5;
    if (label.includes('HẦM') && !/HẦM\s*\d/.test(label) && !label.includes('BÁN HẦM')) return -1;
  }

  const code = resolveFloorCode({
    floorName: typeof floor.floorName === 'string' ? floor.floorName : undefined,
    name: typeof floor.name === 'string' ? floor.name : undefined,
    floorCode: typeof floor.floorCode === 'string' ? floor.floorCode : undefined,
    floorNumber:
      typeof floor.floorNumber === 'number' || typeof floor.floorNumber === 'string' ? floor.floorNumber : undefined,
  });
  const b = code.match(/^B(\d{2})$/);
  if (b) return -Number(b[1]);
  if (code === 'SB') return -0.5;
  if (code === 'MEZZ') return 0.5;
  const f = code.match(/^F(\d{2})$/);
  if (f) return Number(f[1]);
  if (code === 'TERRACE') return 900;
  if (code === 'ROOF') return 901;
  if (code === 'TUM') return 902;
  return null;
}

/**
 * Sắp tầng theo cao độ, ổn định: tầng không nhận diện được đứng ngay sau tầng đứng trước nó trong mảng gốc.
 */
export function sortFloorsByElevation<T>(floors: T[] | null | undefined): OrderedFloor<T>[] {
  const list = Array.isArray(floors) ? floors : [];
  let lastRank = -Infinity;
  const keyed = list.map((floor, sourceIndex) => {
    const rank = floorElevationRank(floor);
    const effective = rank ?? (lastRank === -Infinity ? -1000 : lastRank) + 0.0001 * (sourceIndex + 1);
    if (rank !== null) lastRank = rank;
    return { floor, sourceIndex, key: effective };
  });
  return keyed
    .slice()
    .sort((a, b) => a.key - b.key || a.sourceIndex - b.sourceIndex)
    .map(({ floor, sourceIndex }) => ({ floor, sourceIndex }));
}
