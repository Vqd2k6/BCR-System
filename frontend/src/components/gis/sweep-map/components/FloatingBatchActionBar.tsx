import React from 'react';
import { Landmark, MapPin, EyeOff, RotateCcw, X, CheckCheck, Eraser } from 'lucide-react';

export type BatchOperationMode = 'LOCAL_AUTHORITY' | 'ADDRESS' | 'EXCLUDE' | 'RESTORE';

interface FloatingBatchActionBarProps {
  selectedCount: number;
  selectedExcludedCount: number;
  displayedCount: number;
  maxParcels: number;
  /** Phân khu hiện tại đã có quy tắc chuẩn hóa địa chỉ (Zone 3, 7, 9) */
  addressEnabled: boolean;
  onSelectAllDisplayed: () => void;
  onClearSelection: () => void;
  onOpen: (mode: BatchOperationMode) => void;
  onExit: () => void;
}

const actionClass =
  'cursor-pointer flex items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-bold text-white disabled:opacity-50 disabled:cursor-not-allowed';

/** Thanh công cụ nổi ở chân bản đồ khi đang chọn nhiều thửa. */
export const FloatingBatchActionBar: React.FC<FloatingBatchActionBarProps> = ({
  selectedCount,
  selectedExcludedCount,
  displayedCount,
  maxParcels,
  addressEnabled,
  onSelectAllDisplayed,
  onClearSelection,
  onOpen,
  onExit,
}) => {
  const hasActive = selectedCount > 0;
  const overLimit = selectedCount > maxParcels || selectedExcludedCount > maxParcels;

  return (
    <div className="absolute bottom-4 left-1/2 z-[1000] w-[min(96%,860px)] -translate-x-1/2 rounded-2xl border border-fuchsia-300 bg-white/95 p-3 shadow-2xl backdrop-blur-md">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2 text-xs font-bold text-slate-800">
          <span className="rounded-lg border border-fuchsia-300 bg-fuchsia-50 px-2 py-1 text-fuchsia-700">
            Đã chọn {selectedCount} thửa
            {selectedExcludedCount > 0 ? ` · ${selectedExcludedCount} thửa đã ẩn` : ''}
          </span>
          <button
            type="button"
            onClick={onSelectAllDisplayed}
            disabled={displayedCount === 0}
            className="cursor-pointer flex items-center gap-1 rounded-lg border border-slate-200 px-2 py-1 text-slate-600 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
            title="Chọn tất cả thửa đang hiển thị theo bộ lọc"
          >
            <CheckCheck size={13} /> Chọn tất cả đang hiển thị ({displayedCount})
          </button>
          <button
            type="button"
            onClick={onClearSelection}
            disabled={selectedCount === 0 && selectedExcludedCount === 0}
            className="cursor-pointer flex items-center gap-1 rounded-lg border border-slate-200 px-2 py-1 text-slate-600 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Eraser size={13} /> Bỏ chọn
          </button>
        </div>
        <button
          type="button"
          onClick={onExit}
          className="cursor-pointer rounded-lg p-1 text-slate-500 hover:bg-slate-100"
          title="Thoát chế độ chọn nhiều"
        >
          <X size={18} />
        </button>
      </div>

      {overLimit && (
        <p className="mt-2 rounded-lg border border-amber-300 bg-amber-50 px-2 py-1 text-[11px] font-medium text-amber-800">
          Mỗi lô tối đa {maxParcels} thửa. Vui lòng bỏ bớt thửa trước khi thực hiện.
        </p>
      )}

      <div className="mt-2 flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={!hasActive || overLimit}
          onClick={() => onOpen('LOCAL_AUTHORITY')}
          className={`${actionClass} bg-indigo-600 hover:bg-indigo-700`}
        >
          <Landmark size={14} /> Setup CQĐP
        </button>
        <button
          type="button"
          disabled={!hasActive || overLimit || !addressEnabled}
          onClick={() => onOpen('ADDRESS')}
          title={addressEnabled ? 'Chuẩn hóa địa chỉ các thửa đã chọn' : 'Chuẩn hóa địa chỉ hiện chỉ áp dụng cho Zone 3, 7, 9'}
          className={`${actionClass} bg-sky-600 hover:bg-sky-700`}
        >
          <MapPin size={14} /> Đồng bộ địa chỉ
        </button>
        <button
          type="button"
          disabled={!hasActive || overLimit}
          onClick={() => onOpen('EXCLUDE')}
          className={`${actionClass} bg-rose-600 hover:bg-rose-700`}
        >
          <EyeOff size={14} /> Ẩn thửa
        </button>
        <button
          type="button"
          disabled={selectedExcludedCount === 0 || overLimit}
          onClick={() => onOpen('RESTORE')}
          title="Bật lớp 'Thửa đã loại trừ' trong bộ lọc để chọn thửa cần khôi phục"
          className={`${actionClass} bg-emerald-600 hover:bg-emerald-700`}
        >
          <RotateCcw size={14} /> Khôi phục ({selectedExcludedCount})
        </button>
      </div>
    </div>
  );
};
