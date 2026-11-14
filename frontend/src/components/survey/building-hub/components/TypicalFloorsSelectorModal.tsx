import React, { useMemo, useState } from 'react';
import { X, Layers, Check, AlertTriangle, Lock, Plus } from 'lucide-react';
import { FLOOR_NUMBER_MAX, FLOOR_NUMBER_MIN, isValidFloorNumber } from '../../../../core/utils/floorCodeRules';

interface TypicalFloorsSelectorModalProps {
  isOpen: boolean;
  baseFloorNumber: number;
  baseFloorName: string;
  /** hasOwnPlan: tầng đã có mặt bằng riêng (không được gộp vào dải); inheritedFromFloor: đang theo bản vẽ tầng khác */
  allBuildingFloors: { floorNumber: number; floorName: string; hasOwnPlan?: boolean; inheritedFromFloor?: number }[];
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
    // Dữ liệu cũ có thể còn chồng dải lên tầng đã có mặt bằng riêng: bỏ ra khỏi lựa chọn
    const ownPlan = new Set(allBuildingFloors.filter((f) => f.hasOwnPlan).map((f) => f.floorNumber));
    return Array.from(new Set(list))
      .filter((f) => f === baseFloorNumber || !ownPlan.has(f))
      .sort((a, b) => a - b);
  });

  const [rangeFrom, setRangeFrom] = useState<string>('');
  const [rangeTo, setRangeTo] = useState<string>('');
  const [rangeError, setRangeError] = useState<string>('');

  const ownPlanFloors = useMemo(
    () => new Set(allBuildingFloors.filter((f) => f.hasOwnPlan).map((f) => f.floorNumber)),
    [allBuildingFloors]
  );

  // Tầng hiển thị = tầng của tòa + tầng mới chọn theo dải (chưa có trong danh sách)
  const displayFloors = useMemo(() => {
    const known = new Map(allBuildingFloors.map((f) => [f.floorNumber, f]));
    for (const f of selectedFloors) {
      if (!known.has(f)) known.set(f, { floorNumber: f, floorName: `Tầng ${f} (mới)` });
    }
    return Array.from(known.values()).sort((a, b) => a.floorNumber - b.floorNumber);
  }, [allBuildingFloors, selectedFloors]);

  if (!isOpen) return null;

  const handleAddRange = () => {
    const from = Number(rangeFrom.trim());
    const to = Number(rangeTo.trim());
    if (rangeFrom.trim() === '' || rangeTo.trim() === '' || !Number.isInteger(from) || !Number.isInteger(to)) {
      setRangeError('Nhập số tầng nguyên cho cả "Từ" và "Đến".');
      return;
    }
    const lo = Math.min(from, to);
    const hi = Math.max(from, to);
    if (!isValidFloorNumber(lo) || !isValidFloorNumber(hi)) {
      setRangeError(`Số tầng phải từ ${FLOOR_NUMBER_MIN} đến ${FLOOR_NUMBER_MAX}.`);
      return;
    }
    const added: number[] = [];
    const skipped: number[] = [];
    for (let f = lo; f <= hi; f++) {
      if (f === baseFloorNumber) continue;
      if (ownPlanFloors.has(f)) skipped.push(f);
      else added.push(f);
    }
    setSelectedFloors((prev) => Array.from(new Set([...prev, ...added])).sort((a, b) => a - b));
    setRangeError(skipped.length > 0 ? `Đã bỏ qua tầng có mặt bằng riêng: ${skipped.join(', ')}` : '');
  };

  const toggleFloor = (floorNum: number) => {
    if (floorNum === baseFloorNumber) return; // Không thể bỏ chọn tầng gốc
    if (ownPlanFloors.has(floorNum)) return; // Tầng có mặt bằng riêng không gộp vào dải
    setSelectedFloors((prev) =>
      prev.includes(floorNum) ? prev.filter((f) => f !== floorNum) : [...prev, floorNum].sort((a, b) => a - b)
    );
  };

  const handleSelectAllAbove = () => {
    const aboveFloors = allBuildingFloors
      .filter((f) => !f.hasOwnPlan)
      .map((f) => f.floorNumber)
      .filter((f) => f >= baseFloorNumber);
    setSelectedFloors(Array.from(new Set([...selectedFloors, ...aboveFloors])).sort((a, b) => a - b));
  };

  const handleClearOthers = () => {
    setSelectedFloors([baseFloorNumber]);
  };

  return (
    <div
      className="fixed inset-0 z-[100005] bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-150 cursor-pointer"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="bg-white border border-slate-200 rounded-3xl shadow-2xl max-w-lg w-full flex flex-col overflow-hidden text-slate-800 animate-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 bg-slate-50 border-b border-slate-200">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-teal-50 text-teal-600 border border-teal-200">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">
                Thiết Lập Dải Tầng Điển Hình
              </h3>
              <p className="text-xs text-slate-500">
                Sơ đồ kiến trúc <strong className="text-teal-700">{baseFloorName || `Tầng ${baseFloorNumber}`}</strong>{' '}
                sẽ được dùng chung cho các tầng sau:
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Quick Toolbar */}
        <div className="flex items-center justify-between px-5 py-2.5 bg-slate-50/50 border-b border-slate-200 text-xs">
          <span className="text-slate-600 font-medium">
            Đã chọn: <strong className="text-teal-700 font-mono">{selectedFloors.length} tầng</strong>
          </span>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleSelectAllAbove}
              className="text-teal-600 hover:text-teal-700 hover:underline font-bold cursor-pointer"
            >
              + Chọn tất cả tầng trên
            </button>
            <span className="text-slate-400">•</span>
            <button
              type="button"
              onClick={handleClearOthers}
              className="text-slate-500 hover:text-slate-800 hover:underline cursor-pointer"
            >
              Chỉ tầng gốc
            </button>
          </div>
        </div>

        {/* Chọn nhanh theo dải số tầng (kể cả tầng chưa tạo trong danh sách) */}
        <div className="px-5 py-2.5 border-b border-slate-200 flex flex-col gap-1.5">
          <div className="flex items-center gap-2 text-xs">
            <span className="text-slate-600 font-medium shrink-0">Dải tầng:</span>
            <input
              type="number"
              step="1"
              placeholder="Từ"
              value={rangeFrom}
              onChange={(e) => setRangeFrom(e.target.value)}
              className="w-16 px-2 py-1 rounded-lg bg-white border border-slate-300 font-bold text-slate-900 focus:outline-none focus:border-teal-500"
            />
            <span className="text-slate-400">→</span>
            <input
              type="number"
              step="1"
              placeholder="Đến"
              value={rangeTo}
              onChange={(e) => setRangeTo(e.target.value)}
              className="w-16 px-2 py-1 rounded-lg bg-white border border-slate-300 font-bold text-slate-900 focus:outline-none focus:border-teal-500"
            />
            <button
              type="button"
              onClick={handleAddRange}
              className="px-2.5 py-1 rounded-lg bg-teal-600 hover:bg-teal-700 text-white font-bold flex items-center gap-1 cursor-pointer"
            >
              <Plus className="w-3 h-3" /> Thêm dải
            </button>
          </div>
          {rangeError && <span className="text-[11px] text-amber-700 font-medium">{rangeError}</span>}
        </div>

        {/* Floor Chips Grid */}
        <div className="p-5 max-h-[55vh] overflow-y-auto">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
            {displayFloors.map((fl) => {
              const isBase = fl.floorNumber === baseFloorNumber;
              const isChecked = selectedFloors.includes(fl.floorNumber);
              const isOwnPlan = !isBase && Boolean(fl.hasOwnPlan);

              return (
                <div
                  key={fl.floorNumber}
                  onClick={() => toggleFloor(fl.floorNumber)}
                  className={`p-3 rounded-2xl border-2 flex items-center justify-between transition-all select-none ${
                    isBase
                      ? 'border-teal-500 bg-teal-50 text-teal-900 cursor-default shadow-xs'
                      : isOwnPlan
                      ? 'border-slate-200 bg-slate-100 text-slate-400 cursor-not-allowed'
                      : isChecked
                      ? 'border-teal-500 bg-teal-50/70 text-teal-950 cursor-pointer hover:border-teal-600'
                      : 'border-slate-200 bg-white text-slate-700 cursor-pointer hover:border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  <div className="flex flex-col">
                    <span className="text-xs font-bold flex items-center gap-1.5">
                      {fl.floorName || `Tầng ${fl.floorNumber}`}
                      {isBase && (
                        <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-teal-200 text-teal-800 font-normal">
                          Gốc
                        </span>
                      )}
                    </span>
                    {isOwnPlan && (
                      <span className="text-[10px] text-slate-500 font-medium flex items-center gap-0.5 mt-0.5">
                        <Lock className="w-2.5 h-2.5" /> Có mặt bằng riêng
                      </span>
                    )}
                    {!isBase && !isOwnPlan && fl.inheritedFromFloor !== undefined && (
                      <span className="text-[10px] text-amber-600 font-medium flex items-center gap-0.5 mt-0.5">
                        <AlertTriangle className="w-2.5 h-2.5" />
                        {isChecked ? `Chuyển từ Tầng ${fl.inheritedFromFloor} sang tầng này` : `Đang theo Tầng ${fl.inheritedFromFloor}`}
                      </span>
                    )}
                  </div>

                  <div className="shrink-0">
                    {isChecked ? (
                      <div className="w-5 h-5 rounded-md bg-teal-600 flex items-center justify-center text-white shadow-xs">
                        <Check className="w-3.5 h-3.5 stroke-[3]" />
                      </div>
                    ) : (
                      <div className="w-5 h-5 rounded-md border border-slate-300 bg-slate-50" />
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex items-center justify-between px-5 py-3.5 bg-slate-50 border-t border-slate-200">
          <span className="text-xs text-slate-500 truncate max-w-[200px] font-mono">
            [{selectedFloors.join(', ')}]
          </span>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-2 rounded-xl bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 text-xs font-bold transition-colors cursor-pointer"
            >
              Hủy
            </button>
            <button
              type="button"
              onClick={() => {
                onConfirm(selectedFloors);
                onClose();
              }}
              className="px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold shadow-sm transition-all active:scale-95 cursor-pointer"
            >
              Áp Dụng Cho {selectedFloors.length} Tầng
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
