import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { X, Layers, Building2, CheckCircle2, Eye } from 'lucide-react';
import type { GisParcel } from '../../../gis/shared/types';
import { api } from '../../../../services/api';
import { formatShortUnitDisplay } from '../../../../core/utils/codeFormattingUtils';

interface SurveyorCadReadOnlyModalProps {
  parcel: GisParcel;
  onClose: () => void;
}

interface UnitItem {
  id: string;
  unit_code: string;
  floor_number: number;
  cad_bbox?: { x: number; y: number; width: number; height: number } | null;
  cadBbox?: { x: number; y: number; width: number; height: number } | null;
  unit_type?: 'UNIT' | 'MASTER';
  unitType?: 'UNIT' | 'MASTER';
  status?: string;
}

interface FloorPlanItem {
  id: string;
  floor_number: number;
  floor_name: string;
  cad_photo_url: string;
  applicable_floors?: number[];
}

export const SurveyorCadReadOnlyModal: React.FC<SurveyorCadReadOnlyModalProps> = ({
  parcel,
  onClose,
}) => {
  const [plans, setPlans] = useState<FloorPlanItem[]>([]);
  const [units, setUnits] = useState<UnitItem[]>([]);
  const [deletedFloors, setDeletedFloors] = useState<number[]>(
    parcel.deletedFloors || parcel.deleted_floors || []
  );
  const [loading, setLoading] = useState<boolean>(true);
  const [filterFloor, setFilterFloor] = useState<number | 'ALL'>('ALL');

  const parcelId = parcel.id;

  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      const [plansRes, unitsRes] = await Promise.all([
        api.get(`/parcels/${parcelId}/floor-plans`).catch((err) => {
          console.warn('[SurveyorCadModal] Lỗi nạp floor plans:', err);
          return { data: { data: { plans: [] } } };
        }),
        api.get(`/parcels/${parcelId}/units`).catch((err) => {
          console.warn('[SurveyorCadModal] Lỗi nạp units:', err);
          return { data: { data: { units: [] } } };
        }),
      ]);

      setPlans(plansRes.data?.data?.plans || []);
      setUnits(unitsRes.data?.data?.units || []);
      if (Array.isArray(plansRes.data?.data?.deletedFloors)) {
        setDeletedFloors(plansRes.data.data.deletedFloors);
      }
    } catch (err) {
      console.warn('[SurveyorCadModal] Lỗi nạp dữ liệu CAD:', err);
    } finally {
      setLoading(false);
    }
  }, [parcelId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Sắp xếp danh sách tầng theo thứ tự TỪ CAO XUỐNG THẤP (Top to Bottom)
  const floorList = useMemo(() => {
    const floorSet = new Set<number>();

    // 1. Từ số tầng thiết kế của thửa đất
    const maxFloors = Number(parcel.floorCount) || 1;
    for (let i = 1; i <= maxFloors; i++) {
      floorSet.add(i);
    }

    // 2. Từ floor plans đã có
    plans.forEach((p) => {
      floorSet.add(p.floor_number);
      if (p.applicable_floors) {
        p.applicable_floors.forEach((f) => floorSet.add(f));
      }
    });

    // 3. Từ danh sách căn hộ
    units.forEach((u) => {
      if (typeof u.floor_number === 'number') {
        floorSet.add(u.floor_number);
      }
    });

    // Loại trừ các tầng đã bị xóa và sắp xếp Top to Bottom
    const activeFloors = Array.from(floorSet).filter((f) => !deletedFloors.includes(f));
    if (activeFloors.length === 0) activeFloors.push(1);

    const sorted = activeFloors.sort((a, b) => b - a);

    return sorted.map((floorNum) => {
      // Tìm plan tương ứng (ưu tiên plan trực tiếp, sau đó plan dùng chung)
      const directPlan = plans.find((p) => p.floor_number === floorNum);
      const sharedPlan = plans.find(
        (p) => p.floor_number !== floorNum && p.applicable_floors && p.applicable_floors.includes(floorNum)
      );

      const effectivePlan = directPlan || sharedPlan;
      const isInherited = !directPlan && Boolean(sharedPlan);
      const floorUnits = units.filter((u) => (u.floor_number ?? 1) === floorNum);

      let defaultLabel = `Tầng ${floorNum}`;
      if (floorNum === 0) defaultLabel = 'Tầng Trệt / G';
      if (floorNum < 0) defaultLabel = `Tầng Hầm B${Math.abs(floorNum)}`;

      const floorDisplayName = directPlan?.floor_name || defaultLabel;

      return {
        floorNumber: floorNum,
        floorLabel: floorDisplayName,
        floorName: floorDisplayName,
        cadUrl: effectivePlan?.cad_photo_url || '',
        isInherited,
        inheritedFromFloor: sharedPlan?.floor_number,
        units: floorUnits,
      };
    });
  }, [parcel.floorCount, plans, units, deletedFloors]);

  // Các tầng được hiển thị theo bộ lọc
  const displayedFloors = useMemo(() => {
    if (filterFloor === 'ALL') return floorList;
    return floorList.filter((f) => f.floorNumber === filterFloor);
  }, [floorList, filterFloor]);

  return (
    <div className="fixed inset-0 z-[100000] bg-slate-900/70 backdrop-blur-xs flex flex-col w-full h-full overflow-hidden animate-in fade-in duration-200">
      {/* 1. Header Trình Xem CAD Tối Giản */}
      <header className="bg-white border-b border-slate-200 px-4 py-3 flex items-center justify-between shadow-xs shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 rounded-xl bg-teal-50 border border-teal-200 flex items-center justify-center text-teal-700 shrink-0">
            <Eye size={18} />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-teal-800 bg-teal-50 px-2 py-0.5 rounded border border-teal-200">
                CHỈ ĐỌC (SURVEYOR)
              </span>
              <span className="text-xs font-mono font-bold text-slate-700 truncate">
                Mã: {parcel.projectParcelCode || parcel.officialCadastralCode || parcel.id}
              </span>
            </div>
            <h1 className="text-sm font-extrabold text-slate-900 truncate mt-0.5">
              Sơ Đồ Bản Vẽ CAD Mặt Bằng Tòa Nhà • {parcel.houseNumber ? `Số ${parcel.houseNumber}, ` : ''}{parcel.street || ''}
            </h1>
          </div>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="p-2 rounded-xl text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer shrink-0 ml-2"
          title="Đóng xem CAD"
        >
          <X size={20} />
        </button>
      </header>

      {/* 2. Quick Floor Filter Chips (Thứ tự tăng dần) */}
      <div className="bg-slate-50 border-b border-slate-200 px-3 py-2 flex items-center gap-1.5 overflow-x-auto shrink-0 no-scrollbar">
        <button
          type="button"
          onClick={() => setFilterFloor('ALL')}
          className={`px-3 py-1 rounded-lg text-xs font-bold transition-all shrink-0 cursor-pointer ${
            filterFloor === 'ALL'
              ? 'bg-teal-600 text-white shadow-xs'
              : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-100'
          }`}
        >
          Tất cả các tầng ({floorList.length})
        </button>
        {floorList.map((f) => (
          <button
            key={f.floorNumber}
            type="button"
            onClick={() => setFilterFloor(f.floorNumber)}
            className={`px-3 py-1 rounded-lg text-xs font-bold transition-all shrink-0 flex items-center gap-1.5 cursor-pointer ${
              filterFloor === f.floorNumber
                ? 'bg-teal-600 text-white shadow-xs'
                : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100'
            }`}
          >
            <span>{f.floorLabel}</span>
            <span
              className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                filterFloor === f.floorNumber
                  ? 'bg-white/20 text-white'
                  : 'bg-slate-100 text-slate-500'
              }`}
            >
              {f.units.length} căn
            </span>
          </button>
        ))}
      </div>

      {/* 3. Main Scrollable Container (Danh sách mặt bằng cuộn lướt nhẹ nhàng) */}
      <main className="flex-1 overflow-y-auto p-3 sm:p-6 bg-slate-100/90 space-y-6">
        {loading ? (
          <div className="py-20 flex flex-col items-center justify-center gap-3 text-slate-500 text-xs">
            <div className="w-8 h-8 border-3 border-teal-600 border-t-transparent rounded-full animate-spin" />
            <span>Đang tải danh sách bản vẽ CAD tòa nhà...</span>
          </div>
        ) : displayedFloors.length === 0 ? (
          <div className="py-20 text-center bg-white rounded-2xl border border-slate-200 p-6 max-w-lg mx-auto">
            <Layers className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <h3 className="text-sm font-bold text-slate-800">Chưa có dữ liệu bản vẽ CAD</h3>
            <p className="text-xs text-slate-500 mt-1">
              Quản trị viên Zone Admin chưa tải lên bản vẽ CAD cho các tầng của tòa nhà này.
            </p>
          </div>
        ) : (
          displayedFloors.map((floor) => (
            <div
              key={floor.floorNumber}
              className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden"
            >
              {/* Floor Card Header */}
              <div className="px-4 py-3 bg-white border-b border-slate-100 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <span className="w-7 h-7 rounded-lg bg-teal-50 border border-teal-200 text-teal-800 font-bold text-xs flex items-center justify-center font-mono">
                    {floor.floorNumber}
                  </span>
                  <div>
                    <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                      <span>{floor.floorLabel}</span>
                      {floor.isInherited && (
                        <span className="text-[10px] font-medium text-teal-700 bg-teal-50 border border-teal-200 px-2 py-0.2 rounded-full">
                          Dùng chung mặt bằng Tầng {floor.inheritedFromFloor}
                        </span>
                      )}
                    </h3>
                    <p className="text-[11px] text-slate-500">
                      Quy mô: <strong>{floor.units.length} căn hộ con</strong>
                    </p>
                  </div>
                </div>

                {floor.cadUrl && (
                  <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
                    <CheckCircle2 size={13} />
                    <span>Đã có CAD</span>
                  </span>
                )}
              </div>

              {/* Floor CAD Canvas Viewport (Cấm chọn, chỉ xem) */}
              <div className="p-3 sm:p-4 bg-slate-50/70 border-b border-slate-100">
                {floor.cadUrl ? (
                  <div className="relative w-full rounded-xl overflow-hidden bg-white border border-slate-200 shadow-inner flex items-center justify-center min-h-[260px] max-h-[65vh]">
                    {/* CAD Blueprint Image */}
                    <img
                      src={floor.cadUrl}
                      alt={`Bản vẽ CAD ${floor.floorLabel}`}
                      className="w-full h-auto max-h-[65vh] object-contain select-none pointer-events-none"
                    />

                    {/* Overlay Unit Partition Boxes (pointer-events-none: Cấm thao tác chọn) */}
                    <div className="absolute inset-0 pointer-events-none">
                      {floor.units.map((unit) => {
                        const bbox = unit.cad_bbox || unit.cadBbox;
                        if (!bbox) return null;

                        return (
                          <div
                            key={unit.id}
                            style={{
                              position: 'absolute',
                              left: `${bbox.x}%`,
                              top: `${bbox.y}%`,
                              width: `${bbox.width}%`,
                              height: `${bbox.height}%`,
                            }}
                            className="border-2 border-teal-600 bg-teal-500/20 rounded flex items-center justify-center shadow-xs overflow-hidden"
                          >
                            <span
                              title={`Mã căn ngầm: ${unit.unit_code}`}
                              className="px-1 py-0.5 rounded bg-teal-900/90 text-white font-mono font-black text-[9px] sm:text-xs shadow-xs tracking-wider max-w-[92%] truncate text-center"
                            >
                              {formatShortUnitDisplay(unit.unit_code, (unit.unit_type || unit.unitType) === 'MASTER' ? 'MASTER' : 'UNIT')}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  <div className="py-12 text-center text-xs text-slate-400 flex flex-col items-center justify-center gap-2">
                    <Building2 className="w-8 h-8 text-slate-300" />
                    <span>Tầng này chưa được nạp bản vẽ mặt bằng CAD</span>
                  </div>
                )}
              </div>

              {/* Unit Code Chips Summary */}
              {floor.units.length > 0 && (
                <div className="px-4 py-2.5 bg-white flex flex-wrap items-center gap-1.5 text-xs">
                  <span className="text-slate-400 font-medium mr-1 text-[11px]">Danh sách căn:</span>
                  {floor.units.map((u) => (
                    <span
                      key={u.id}
                      title={`Mã căn ngầm: ${u.unit_code}`}
                      className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 font-mono font-bold text-[11px] border border-slate-200"
                    >
                      {formatShortUnitDisplay(u.unit_code, (u.unit_type || u.unitType) === 'MASTER' ? 'MASTER' : 'UNIT')}
                    </span>
                  ))}
                </div>
              )}
            </div>
          ))
        )}
      </main>

      {/* 4. Footer */}
      <footer className="bg-white border-t border-slate-200 px-4 py-3 flex items-center justify-between text-xs shrink-0">
        <span className="text-slate-500">
          Chế độ xem sơ đồ CAD tham khảo cho Khảo sát viên (Vuốt để lướt xem các tầng).
        </span>
        <button
          type="button"
          onClick={onClose}
          className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold transition-colors cursor-pointer"
        >
          Đóng
        </button>
      </footer>
    </div>
  );
};
