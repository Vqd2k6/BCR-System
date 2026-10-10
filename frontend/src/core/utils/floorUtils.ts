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
