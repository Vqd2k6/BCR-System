import React from 'react';
import { Layers, X } from 'lucide-react';
import { GisParcel } from '../../../gis/LeafletSweepMap';
import { BuildingUnit } from '../types';

interface FloorProgressPopoverProps {
  isOpen: boolean;
  onClose: () => void;
  parcel: GisParcel;
  availableFloors: number[];
  units: BuildingUnit[];
}

export const FloorProgressPopover: React.FC<FloorProgressPopoverProps> = ({
  isOpen,
  onClose,
  parcel,
  availableFloors,
  units,
}) => {
  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[100000] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-white rounded-2xl w-full max-w-3xl max-h-[85vh] flex flex-col shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Popover Header */}
        <div className="bg-white border-b border-slate-200 p-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-sky-50 border border-sky-200 flex items-center justify-center text-sky-600">
              <Layers size={18} />
            </div>
            <div>
              <h3 className="text-sm font-extrabold text-slate-900">
                Tiến Độ Khảo Sát Chi Tiết Theo Từng Tầng
              </h3>
              <p className="text-[11px] text-slate-500">
                Tòa nhà {parcel.projectParcelCode || 'Chung cư'} • Tổng {availableFloors.length} tầng ({units.length} căn)
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Popover Floor Summary Table / Cards */}
        <div className="p-4 overflow-y-auto flex-1 flex flex-col gap-3">
          {availableFloors.length === 0 ? (
            <div className="py-12 text-center text-xs text-slate-500 bg-slate-50 rounded-xl border border-dashed border-slate-300">
              Tòa nhà chưa có dữ liệu tầng lầu hoặc căn hộ con nào.
            </div>
          ) : (
            <>
              <div className="hidden sm:grid grid-cols-6 gap-2 px-3 py-2 bg-slate-100/80 rounded-lg text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                <div>Tầng / Lầu</div>
                <div className="text-center">Tổng số căn</div>
                <div className="text-center text-emerald-700">Đã xong</div>
                <div className="text-center text-sky-700">Chờ duyệt</div>
                <div className="text-center text-amber-700">Đang làm</div>
                <div className="text-center text-purple-700">Vắng mặt</div>
              </div>

              {availableFloors.map((floorNum) => {
                const floorUnits = units.filter((u) => u.floor_number === floorNum);
                const floorDone = floorUnits.filter((u) => u.status === 'APPROVED' || !!u.phase2_report_id).length;
                const floorPending = floorUnits.filter((u) => u.status === 'SUBMITTED').length;
                const floorInProgress = floorUnits.filter((u) => u.status === 'IN_PROGRESS').length;
                const floorAbsent = floorUnits.filter((u) => u.status === 'POSTPONED_ABSENT').length;

                return (
                  <div
                    key={floorNum}
                    className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 flex flex-col sm:grid sm:grid-cols-6 sm:items-center gap-2 sm:gap-2 shadow-2xs"
                  >
                    {/* Floor Name & Counter */}
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-black text-slate-900 bg-white px-2.5 py-1 rounded-md border border-slate-200 shadow-2xs">
                        Lầu {floorNum}
                      </span>
                      <span className="sm:hidden text-xs text-slate-500 font-semibold">
                        ({floorUnits.length} căn)
                      </span>
                    </div>

                    {/* Total units */}
                    <div className="hidden sm:block text-center text-xs font-extrabold text-slate-800">
                      {floorUnits.length} căn
                    </div>

                    {/* Done */}
                    <div className="flex sm:justify-center items-center justify-between text-xs">
                      <span className="sm:hidden text-slate-500 font-medium">Đã xong:</span>
                      <span className="font-extrabold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                        {floorDone} căn
                      </span>
                    </div>

                    {/* Pending */}
                    <div className="flex sm:justify-center items-center justify-between text-xs">
                      <span className="sm:hidden text-slate-500 font-medium">Chờ duyệt:</span>
                      <span className="font-extrabold text-sky-700 bg-sky-50 px-2 py-0.5 rounded border border-sky-200">
                        {floorPending} căn
                      </span>
                    </div>

                    {/* In Progress */}
                    <div className="flex sm:justify-center items-center justify-between text-xs">
                      <span className="sm:hidden text-slate-500 font-medium">Đang làm:</span>
                      <span className="font-extrabold text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                        {floorInProgress} căn
                      </span>
                    </div>

                    {/* Absent */}
                    <div className="flex sm:justify-center items-center justify-between text-xs">
                      <span className="sm:hidden text-slate-500 font-medium">Vắng mặt:</span>
                      <span className="font-extrabold text-purple-700 bg-purple-50 px-2 py-0.5 rounded border border-purple-200">
                        {floorAbsent} căn
                      </span>
                    </div>
                  </div>
                );
              })}
            </>
          )}
        </div>

        {/* Popover Footer */}
        <div className="p-3 bg-slate-50 border-t border-slate-200 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-lg bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-bold cursor-pointer"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
};
