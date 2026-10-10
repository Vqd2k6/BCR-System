import React from 'react';
import {
  Layers,
  Plus,
  Link as LinkIcon,
  Loader2,
  ChevronRight,
} from 'lucide-react';
import {
  getDefaultFloorCode,
  STANDARD_FLOOR_CODE_OPTIONS,
  type FloorScope,
} from '../../../../core/utils/floorUtils';

export interface BuildingFloorItem {
  floorNumber: number;
  floorName: string;
  floorCode: string;
  hasCad: boolean;
  cadPhotoUrl?: string;
  applicableFloors?: number[];
  unitCount: number;
  isInherited: boolean;
  inheritedFromFloor?: number;
  scope: FloorScope;
  areaType?: string;
}

interface FloorPlanCadSidebarProps {
  buildingFloors: BuildingFloorItem[];
  activeFloor: number;
  isLoading: boolean;
  readOnly?: boolean;
  showAddFloorInput: boolean;
  setShowAddFloorInput: (show: boolean) => void;
  newFloorInput: string;
  setNewFloorInput: (val: string) => void;
  newFloorCodeInput: string;
  setNewFloorCodeInput: (val: string) => void;
  onSelectFloor: (floorNum: number) => void;
  onAddCustomFloor: () => void;
}

export const FloorPlanCadSidebar: React.FC<FloorPlanCadSidebarProps> = ({
  buildingFloors,
  activeFloor,
  isLoading,
  readOnly = false,
  showAddFloorInput,
  setShowAddFloorInput,
  newFloorInput,
  setNewFloorInput,
  newFloorCodeInput,
  setNewFloorCodeInput,
  onSelectFloor,
  onAddCustomFloor,
}) => {
  return (
    <aside className="w-64 sm:w-72 bg-white border-r border-slate-200 flex flex-col shrink-0 overflow-hidden z-20">
      {/* Sidebar Header */}
      <div className="p-2.5 border-b border-slate-200 flex items-center justify-between text-xs font-bold text-slate-700 bg-slate-50/70">
        <span className="flex items-center gap-1.5">
          <Layers className="w-4 h-4 text-teal-600" />
          Danh Sách Tầng ({buildingFloors.length})
        </span>
        {!readOnly && (
          <button
            type="button"
            onClick={() => setShowAddFloorInput(!showAddFloorInput)}
            className="flex items-center gap-1 px-2 py-0.5 rounded-lg bg-teal-50 hover:bg-teal-100 text-teal-700 border border-teal-200 text-[11px] font-bold transition-colors cursor-pointer"
            title="Thêm tầng mới"
          >
            <Plus className="w-3 h-3" />
            <span>Thêm</span>
          </button>
        )}
      </div>

      {/* Ô thêm tầng nhanh kèm Mã Tầng */}
      {showAddFloorInput && (
        <div className="p-2.5 bg-slate-50 border-b border-slate-200 flex flex-col gap-2">
          <div className="flex items-center gap-1.5">
            <input
              type="number"
              placeholder="Số tầng (VD: 9, 0, -1)"
              value={newFloorInput}
              onChange={(e) => {
                const val = e.target.value;
                setNewFloorInput(val);
                if (val.trim() !== '') {
                  const parsed = parseFloat(val);
                  if (!isNaN(parsed)) {
                    setNewFloorCodeInput(getDefaultFloorCode(parsed));
                  }
                }
              }}
              className="w-24 px-2 py-1 rounded-lg bg-white border border-slate-300 text-xs font-bold text-slate-900 focus:outline-none focus:border-teal-500"
            />
            <input
              type="text"
              placeholder="Mã tầng (VD: MEZZ)"
              value={newFloorCodeInput}
              onChange={(e) => setNewFloorCodeInput(e.target.value.toUpperCase())}
              className="flex-1 px-2 py-1 rounded-lg bg-white border border-slate-300 text-xs font-mono font-bold text-teal-800 focus:outline-none focus:border-teal-500"
            />
          </div>
          <div className="flex items-center justify-between gap-1">
            <select
              value={
                STANDARD_FLOOR_CODE_OPTIONS.some((o) => o.code === newFloorCodeInput)
                  ? newFloorCodeInput
                  : /^F\d+$/i.test(newFloorCodeInput)
                  ? 'TYPICAL'
                  : ''
              }
              onChange={(e) => {
                const sel = e.target.value;
                if (!sel) return;
                if (sel === 'TYPICAL') {
                  const nextFl = buildingFloors.length > 0 ? Math.max(...buildingFloors.map((b) => b.floorNumber)) + 1 : 1;
                  const parsed = parseFloat(newFloorInput);
                  const fl = !isNaN(parsed) && parsed > 0 ? parsed : Math.max(1, nextFl);
                  setNewFloorInput(String(fl));
                  setNewFloorCodeInput(`F${String(fl).padStart(2, '0')}`);
                } else if (sel === 'G') {
                  setNewFloorInput('0');
                  setNewFloorCodeInput('G');
                } else if (sel === 'MEZZ') {
                  if (!newFloorInput) setNewFloorInput('0');
                  setNewFloorCodeInput('MEZZ');
                } else if (sel === 'B01') {
                  setNewFloorInput('-1');
                  setNewFloorCodeInput('B01');
                } else if (sel === 'B02') {
                  setNewFloorInput('-2');
                  setNewFloorCodeInput('B02');
                } else if (sel === 'SB') {
                  setNewFloorInput('-1');
                  setNewFloorCodeInput('SB');
                } else if (sel === 'ROOF' || sel === 'TERRACE' || sel === 'TUM') {
                  const maxFl = buildingFloors.length > 0 ? Math.max(...buildingFloors.map((b) => b.floorNumber)) : 1;
                  if (!newFloorInput) setNewFloorInput(String(maxFl + 1));
                  setNewFloorCodeInput(sel);
                } else {
                  setNewFloorCodeInput(sel);
                }
              }}
              className="text-[11px] bg-white border border-slate-300 rounded px-1.5 py-0.5 text-slate-600 cursor-pointer max-w-[125px]"
            >
              <option value="">Gợi ý mẫu...</option>
              {STANDARD_FLOOR_CODE_OPTIONS.map((o) => (
                <option key={o.code} value={o.code}>
                  {o.label}
                </option>
              ))}
            </select>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => setShowAddFloorInput(false)}
                className="px-2 py-1 rounded-lg bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-bold cursor-pointer"
              >
                Hủy
              </button>
              <button
                type="button"
                onClick={onAddCustomFloor}
                className="px-2.5 py-1 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold cursor-pointer"
              >
                Thêm
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Danh sách các tầng */}
      <div className="flex-1 overflow-y-auto p-2 space-y-1">
        {isLoading ? (
          <div className="p-6 text-center text-xs text-slate-500 flex flex-col items-center gap-2">
            <Loader2 className="w-5 h-5 animate-spin text-teal-600" />
            <span>Đang nạp cấu trúc tòa nhà...</span>
          </div>
        ) : (
          buildingFloors.map((fl) => {
            const isActive = fl.floorNumber === activeFloor;
            return (
              <div
                key={fl.floorNumber}
                onClick={() => onSelectFloor(fl.floorNumber)}
                className={`p-2 rounded-xl border transition-all cursor-pointer flex items-center justify-between group ${
                  isActive
                    ? 'border-teal-500 bg-teal-50/80 text-teal-950 shadow-xs ring-1 ring-teal-400/40'
                    : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-700'
                }`}
              >
                <div className="flex flex-col min-w-0 pr-1">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className={`text-xs font-bold truncate ${isActive ? 'text-teal-950' : 'text-slate-800'}`}>
                      {fl.floorName}
                    </span>
                    {/* Mã tầng quy chuẩn */}
                    <span className="text-[10px] font-mono font-bold px-1.5 py-0.2 rounded bg-slate-100 text-teal-900 border border-slate-200">
                      {fl.floorCode}
                    </span>
                    {/* Scope badge tự động cập nhật theo bản vẽ */}
                    {fl.scope === 'MASTER' && (
                      <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-indigo-50 text-indigo-700 border border-indigo-200">
                        Master
                      </span>
                    )}
                    {fl.scope === 'UNIT' && (
                      <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-teal-50 text-teal-700 border border-teal-200">
                        Unit
                      </span>
                    )}
                    {fl.scope === 'BOTH' && (
                      <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-amber-50 text-amber-700 border border-amber-200">
                        Hỗn hợp
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1 mt-0.5">
                    {fl.isInherited ? (
                      <span className="text-[10px] text-teal-700 flex items-center gap-0.5 font-medium truncate">
                        <LinkIcon className="w-2.5 h-2.5" /> Dùng chung T{fl.inheritedFromFloor}
                      </span>
                    ) : fl.hasCad ? (
                      <span className="text-[10px] text-emerald-700 font-medium">
                        ✓ Có CAD riêng
                      </span>
                    ) : (
                      <span className="text-[10px] text-slate-400">
                        Chưa có CAD
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  {fl.unitCount > 0 && (
                    <span
                      className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded-md ${
                        isActive
                          ? 'bg-teal-700 text-white'
                          : 'bg-slate-100 text-slate-600 border border-slate-200'
                      }`}
                    >
                      {fl.unitCount}
                    </span>
                  )}
                  <ChevronRight
                    className={`w-3.5 h-3.5 transition-transform ${
                      isActive ? 'text-teal-700 translate-x-0.5' : 'text-slate-400 group-hover:text-slate-600'
                    }`}
                  />
                </div>
              </div>
            );
          })
        )}
      </div>
    </aside>
  );
};
