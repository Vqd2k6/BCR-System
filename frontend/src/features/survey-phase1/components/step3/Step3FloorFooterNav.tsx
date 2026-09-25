import React from 'react';
import { Button } from '../../../../core/components/ui/Button';
import { Plus } from 'lucide-react';

interface Step3FloorFooterNavProps {
  activeFloorIndex: number;
  totalFloors: number;
  floorName: string;
  onPrevFloor: () => void;
  onNextFloor: () => void;
  onAddFloor: () => void;
}

export const Step3FloorFooterNav: React.FC<Step3FloorFooterNavProps> = ({
  activeFloorIndex,
  totalFloors,
  floorName,
  onPrevFloor,
  onNextFloor,
  onAddFloor,
}) => {
  return (
    <div className="p-3.5 rounded-xl border border-slate-200 bg-white shadow-xs flex items-center justify-between text-xs">
      <Button
        size="sm"
        variant="outline"
        disabled={activeFloorIndex === 0}
        onClick={onPrevFloor}
      >
        ⬅️ Tầng trước
      </Button>

      <span className="font-bold text-slate-700">
        Đang khảo sát: {floorName} ({activeFloorIndex + 1}/{totalFloors})
      </span>

      <div className="flex items-center gap-2">
        {activeFloorIndex < totalFloors - 1 ? (
          <Button size="sm" variant="outline" onClick={onNextFloor}>
            Tầng tiếp theo ➔
          </Button>
        ) : (
          <Button size="sm" icon={<Plus className="w-3.5 h-3.5" />} onClick={onAddFloor}>
            Thêm Tầng Mới
          </Button>
        )}
      </div>
    </div>
  );
};
