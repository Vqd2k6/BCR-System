import React from 'react';
import { Button } from '../../../../core/components/ui/Button';
import { Layers, Plus } from 'lucide-react';
import { FloorSurveyData } from '../../types/phase1.types';

interface FloorTabsNavigationProps {
  floors: FloorSurveyData[];
  activeFloorIndex: number;
  onSelectFloor: (index: number) => void;
  onAddFloor: () => void;
}

export const FloorTabsNavigation: React.FC<FloorTabsNavigationProps> = ({
  floors,
  activeFloorIndex,
  onSelectFloor,
  onAddFloor,
}) => {
  return (
    <div className="space-y-3">
      {/* Header & Button Thêm tầng */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <h2 className="text-base sm:text-lg font-bold text-slate-800 flex items-center gap-2">
            <Layers className="w-5 h-5 text-emerald-600" />
            <span>3. Khảo Sát Hiện Trạng Chi Tiết</span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Đánh dấu tự sinh các Vùng trên sơ đồ CAD, khảo sát tuần tự và tự động kế thừa thông tin
          </p>
        </div>

        <Button size="sm" icon={<Plus className="w-4 h-4" />} onClick={onAddFloor}>
          Thêm Tầng Mới
        </Button>
      </div>

      {/* Tabs chọn Tầng */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 border-b border-slate-200 no-scrollbar">
        {floors.map((fl, idx) => (
          <button
            key={fl.id || idx}
            type="button"
            onClick={() => onSelectFloor(idx)}
            className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all whitespace-nowrap flex items-center gap-2 border cursor-pointer ${
              activeFloorIndex === idx
                ? 'bg-emerald-700 text-white border-emerald-700 shadow-xs'
                : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
            }`}
          >
            <span>{fl.floorName}</span>
            <span
              className={`px-1.5 py-0.5 rounded-full text-[10px] font-mono ${
                activeFloorIndex === idx ? 'bg-emerald-800 text-emerald-100' : 'bg-slate-100 text-slate-600'
              }`}
            >
              {fl.zones?.length || 0} Z • {fl.structuralElements?.length || 0} E
            </span>
          </button>
        ))}
      </div>
    </div>
  );
};
