/**
 * Tiện ích quản lý và đồng bộ danh sách tầng giữa Hub và CAD Studio.
 * Đảm bảo Single Source of Truth, triệt tiêu tầng giả định (phantom floors)
 * và giữ tính bất biến cho các tầng đã có dữ liệu thực tế.
 */

export interface FloorDerivationOptions {
  floorPlans?: Array<{ floor_number: number; applicable_floors?: number[] }>;
  units?: Array<{ floor_number?: number; floorNumber?: number }>;
  customFloors?: number[];
  deletedFloors?: number[];
}

/**
 * Tính toán danh sách số tầng thực tế của tòa nhà.
 * Nguyên tắc:
 * 1. Thu thập tầng từ floorPlans (các tầng đã có bản vẽ hoặc được áp dụng bản vẽ).
 * 2. Thu thập tầng từ units (các tầng đã có căn hộ hoặc khu vực master).
 * 3. Thu thập tầng từ customFloors (các tầng người dùng vừa thêm trong phiên CAD).
 * 4. Loại trừ các tầng nằm trong deletedFloors.
 * 5. KHÔNG chạy vòng lặp giả định 1..floorCount để tránh ép tầng 1 & 2 khi chưa tạo tầng.
 * 6. Sắp xếp từ tầng cao nhất xuống tầng thấp nhất (Top to Bottom: b - a).
 */
export function deriveBuildingFloorNumbers(opts: FloorDerivationOptions): number[] {
  const floorSet = new Set<number>();

  // 1. Tầng từ các bản vẽ CAD đã cấu hình
  (opts.floorPlans || []).forEach((p) => {
    if (typeof p.floor_number === 'number' && !isNaN(p.floor_number)) {
      floorSet.add(p.floor_number);
    }
    if (Array.isArray(p.applicable_floors)) {
      p.applicable_floors.forEach((af) => {
        if (typeof af === 'number' && !isNaN(af)) {
          floorSet.add(af);
        }
      });
    }
  });

  // 2. Tầng từ danh sách các căn hộ / khu vực đã tạo (Đảm bảo CAD không bao giờ sót tầng so với Hub)
  (opts.units || []).forEach((u) => {
    const fn = u.floor_number ?? u.floorNumber;
    if (typeof fn === 'number' && !isNaN(fn)) {
      floorSet.add(fn);
    }
  });

  // 3. Tầng tùy chỉnh đang thao tác trong phiên CAD
  (opts.customFloors || []).forEach((f) => {
    if (typeof f === 'number' && !isNaN(f)) {
      floorSet.add(f);
    }
  });

  // 4. Loại trừ các tầng nằm trong danh sách đã xóa (deleted_floors)
  const deleted = opts.deletedFloors || [];
  const activeFloors = Array.from(floorSet).filter((f) => !deleted.includes(f));

// 5. Sắp xếp từ tầng cao nhất xuống tầng thấp nhất (Top to Bottom: b - a)
  return activeFloors.sort((a, b) => b - a);
}

export type FloorScope = 'MASTER' | 'UNIT' | 'BOTH';

export interface FloorCodeOption {
  code: string;
  label: string;
  defaultScope: FloorScope;
  defaultArea: string;
}

export const STANDARD_FLOOR_CODE_OPTIONS: FloorCodeOption[] = [
  { code: 'TYPICAL', label: 'Tầng nổi tiêu chuẩn (F01..F99)', defaultScope: 'BOTH', defaultArea: 'TYPICAL_UNIT' },
  { code: 'G', label: 'Trệt / Sảnh (G)', defaultScope: 'BOTH', defaultArea: 'GROUND_LOBBY' },
  { code: 'MEZZ', label: 'Tầng Lửng Trệt (MEZZ)', defaultScope: 'BOTH', defaultArea: 'MEZZANINE' },
  { code: 'B01', label: 'Tầng Hầm 1 (B01)', defaultScope: 'MASTER', defaultArea: 'BASEMENT' },
  { code: 'B02', label: 'Tầng Hầm 2 (B02)', defaultScope: 'MASTER', defaultArea: 'BASEMENT' },
  { code: 'SB', label: 'Tầng Bán Hầm (SB)', defaultScope: 'MASTER', defaultArea: 'SEMI_BASEMENT' },
  { code: 'TECH', label: 'Tầng Kỹ Thuật (TECH)', defaultScope: 'MASTER', defaultArea: 'TECHNICAL' },
  { code: 'REF', label: 'Tầng Lánh Nạn (REF)', defaultScope: 'MASTER', defaultArea: 'REFUGE' },
  { code: 'TUM', label: 'Tầng Tum (TUM)', defaultScope: 'BOTH', defaultArea: 'TUM' },
  { code: 'TERRACE', label: 'Sân Thượng (TERRACE)', defaultScope: 'MASTER', defaultArea: 'ROOFTOP' },
  { code: 'ROOF', label: 'Tầng Mái (ROOF)', defaultScope: 'MASTER', defaultArea: 'ROOFTOP' },
];

export const detectDefaultFloorScope = (
  floorNum: number,
  name: string
): { scope: FloorScope; areaType: string } => {
  const lower = name.toLowerCase();
  if (floorNum < 0 || lower.includes('hầm') || lower.includes('basement')) {
    return { scope: 'MASTER', areaType: 'BASEMENT' };
  }
  if (lower.includes('mái') || lower.includes('thượng') || lower.includes('rooftop')) {
    return { scope: 'MASTER', areaType: 'ROOFTOP' };
  }
  if (lower.includes('kỹ thuật') || lower.includes('lánh nạn') || lower.includes('refuge')) {
    return { scope: 'MASTER', areaType: 'TECHNICAL_REFUGE' };
  }
  if (floorNum === 0 || lower.includes('trệt') || lower.includes('sảnh') || lower.includes('lobby')) {
    return { scope: 'BOTH', areaType: 'GROUND_LOBBY' };
  }
  return { scope: 'UNIT', areaType: 'TYPICAL_UNIT' };
};

export const getDefaultFloorCode = (floorNum: number, floorName?: string): string => {
  const lower = (floorName || '').toLowerCase();
  if (lower.includes('lửng') || lower.includes('mezzanine')) return 'MEZZ';
  if (lower.includes('bán hầm') || lower.includes('semi-basement')) return 'SB';
  if (floorNum < 0 || lower.includes('hầm') || lower.includes('basement')) {
    const match = lower.match(/(?:hầm|basement|b)\s*(\d+)/i);
    const bNum = match ? parseInt(match[1], 10) : (floorNum < 0 ? Math.abs(floorNum) : 1);
    return `B${String(bNum).padStart(2, '0')}`;
  }
  if (lower.includes('kỹ thuật')) return 'TECH';
  if (lower.includes('lánh nạn')) return 'REF';
  if (lower.includes('tum')) return 'TUM';
  if (lower.includes('sân thượng')) return 'TERRACE';
  if (lower.includes('mái') || lower.includes('roof')) return 'ROOF';
  if (floorNum === 0 || lower.includes('trệt')) return 'G';
  return `F${String(floorNum).padStart(2, '0')}`;
};

