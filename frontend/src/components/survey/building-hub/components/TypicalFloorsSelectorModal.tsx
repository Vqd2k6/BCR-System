import React, { useState } from 'react';
import { X, Layers, Check, CheckSquare, Square, AlertTriangle } from 'lucide-react';

interface TypicalFloorsSelectorModalProps {
  isOpen: boolean;
  baseFloorNumber: number;
  baseFloorName: string;
  allBuildingFloors: { floorNumber: number; floorName: string; hasOwnCad?: boolean }[];
  currentApplicableFloors: number[];
  onConfirm: (selectedFloors: number[]) => void;
  onClose: () => void;
}

export const TypicalFloorsSelectorModal: React.FC<TypicalFloorsSelectorModalProps> = ({
  isOpen,
  baseFloorNumber,
  baseFloorName,
  allBuildingFloors,
  currentApplicableFloors,
  onConfirm,
  onClose,
}) => {
  // Ensure baseFloorNumber is always in the selection
  const [selectedFloors, setSelectedFloors] = useState<number[]>(() => {
    const list = currentApplicableFloors.includes(baseFloorNumber)
      ? [...currentApplicableFloors]
      : [baseFloorNumber, ...currentApplicableFloors];
    return Array.from(new Set(list)).sort((a, b) => a - b);
  });

  if (!isOpen) return null;

  const toggleFloor = (floorNum: number) => {
    if (floorNum === baseFloorNumber) return; // Không thể bỏ chọn tầng gốc
    setSelectedFloors((prev) =>
      prev.includes(floorNum) ? prev.filter((f) => f !== floorNum) : [...prev, floorNum].sort((a, b) => a - b)
    );
  };

  const handleSelectAllAbove = () => {
    const aboveFloors = allBuildingFloors
      .map((f) => f.floorNumber)
      .filter((f) => f >= baseFloorNumber);
    setSelectedFloors(Array.from(new Set([...selectedFloors, ...aboveFloors])).sort((a, b) => a - b));
  };

  const handleClearOthers = () => {
    setSelectedFloors([baseFloorNumber]);
  };

  return (
    <div
      className="fixed inset-0 z-[100005] bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-150"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-slate-900 border border-slate-750 rounded-3xl shadow-2xl max-w-lg w-full flex flex-col overflow-hidden text-white animate-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 bg-slate-850 border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-teal-500/20 text-teal-400">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">
                Thiết Lập Dải Tầng Điển Hình
              </h3>
              <p className="text-xs text-slate-400">
                Sơ đồ kiến trúc <strong className="text-teal-300">{baseFloorName || `Tầng ${baseFloorNumber}`}</strong>{' '}
                sẽ được dùng chung cho các tầng sau:
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Quick Toolbar */}
        <div className="flex items-center justify-between px-5 py-2.5 bg-slate-850/50 border-b border-slate-800/80 text-xs">
          <span className="text-slate-400 font-medium">
            Đã chọn: <strong className="text-teal-300 font-mono">{selectedFloors.length} tầng</strong>
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleSelectAllAbove}
              className="text-teal-400 hover:text-teal-300 hover:underline font-bold cursor-pointer"
            >
              + Chọn tất cả tầng trên
            </button>
            <span className="text-slate-600">•</span>
            <button
              type="button"
              onClick={handleClearOthers}
              className="text-slate-400 hover:text-slate-200 hover:underline cursor-pointer"
            >
              Chỉ tầng gốc
            </button>
          </div>
        </div>

        {/* Floor Chips Grid */}
        <div className="p-5 max-h-[55vh] overflow-y-auto">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
            {allBuildingFloors.map((fl) => {
              const isBase = fl.floorNumber === baseFloorNumber;
              const isChecked = selectedFloors.includes(fl.floorNumber);

              return (
                <div
                  key={fl.floorNumber}
                  onClick={() => toggleFloor(fl.floorNumber)}
                  className={`p-3 rounded-2xl border-2 flex items-center justify-between transition-all select-none ${
                    isBase
                      ? 'border-teal-400 bg-teal-950/60 text-teal-200 cursor-default shadow-xs'
                      : isChecked
                      ? 'border-teal-500/80 bg-teal-950/30 text-white cursor-pointer hover:border-teal-400'
                      : 'border-slate-800 bg-slate-850 text-slate-400 cursor-pointer hover:border-slate-700 hover:text-slate-200'
                  }`}
                >
                  <div className="flex flex-col">
                    <span className="text-xs font-bold flex items-center gap-1.5">
                      {fl.floorName || `Tầng ${fl.floorNumber}`}
                      {isBase && (
                        <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-teal-800 text-teal-200 font-normal">
                          Gốc
                        </span>
                      )}
                    </span>
                    {!isBase && fl.hasOwnCad && isChecked && (
                      <span className="text-[10px] text-amber-400 font-medium flex items-center gap-0.5 mt-0.5">
                        <AlertTriangle className="w-2.5 h-2.5" /> Ghi đè CAD
                      </span>
                    )}
                  </div>

                  <div className="shrink-0">
                    {isChecked ? (
                      <div className="w-5 h-5 rounded-md bg-teal-600 flex items-center justify-center text-white shadow-xs">
                        <Check className="w-3.5 h-3.5 stroke-[3]" />
                      </div>
                    ) : (
                      <div className="w-5 h-5 rounded-md border border-slate-700 bg-slate-800" />
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between px-5 py-3.5 bg-slate-850 border-t border-slate-800">
          <span className="text-xs text-slate-400 truncate max-w-[200px] font-mono">
            [{selectedFloors.join(', ')}]
          </span>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-bold transition-colors cursor-pointer"
            >
              Hủy
            </button>
            <button
              type="button"
              onClick={() => {
                onConfirm(selectedFloors);
                onClose();
              }}
              className="px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-500 text-white text-xs font-bold shadow-lg transition-all active:scale-95 cursor-pointer"
            >
              Áp Dụng Cho {selectedFloors.length} Tầng
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
