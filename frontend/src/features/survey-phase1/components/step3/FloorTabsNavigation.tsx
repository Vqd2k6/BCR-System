import React, { useState } from 'react';
import { Button } from '../../../../core/components/ui/Button';
import { Layers, Plus, Edit2, Trash2, Check, X } from 'lucide-react';
import { FloorSurveyData } from '../../types/phase1.types';

interface FloorTabsNavigationProps {
  floors: FloorSurveyData[];
  activeFloorIndex: number;
  onSelectFloor: (index: number) => void;
  onAddFloor: () => void;
  onRenameFloor: (index: number, newName: string) => void;
  onDeleteFloor: (index: number) => void;
}

export const FloorTabsNavigation: React.FC<FloorTabsNavigationProps> = ({
  floors,
  activeFloorIndex,
  onSelectFloor,
  onAddFloor,
  onRenameFloor,
  onDeleteFloor,
}) => {
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [editName, setEditName] = useState<string>('');

  const startEditing = (idx: number, currentName: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setEditingIndex(idx);
    setEditName(currentName);
  };

  const handleSaveRename = (idx: number, e?: React.MouseEvent | React.FormEvent) => {
    e?.stopPropagation();
    e?.preventDefault();
    if (editName.trim()) {
      onRenameFloor(idx, editName.trim());
    }
    setEditingIndex(null);
  };

  const handleCancelRename = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    setEditingIndex(null);
  };

  const handleDelete = (idx: number, e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (floors.length <= 1) {
      alert('Công trình bắt buộc phải có ít nhất 1 tầng.');
      return;
    }
    onDeleteFloor(idx);
  };

  const currentActiveFloor = floors[activeFloorIndex] || floors[0];

  return (
    <div className="space-y-3">
      {/* Header & Button Thêm / Đổi tên / Xóa tầng */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <h2 className="text-base sm:text-lg font-bold text-slate-800 flex items-center gap-2">
            <Layers className="w-5 h-5 text-emerald-600" />
            <span>3. Khảo Sát Hiện Trạng Chi Tiết: {currentActiveFloor?.floorName}</span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Đánh dấu tự sinh các Vùng trên sơ đồ CAD, khảo sát tuần tự và tự động kế thừa thông tin
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Button
            size="sm"
            variant="outline"
            icon={<Edit2 className="w-3.5 h-3.5" />}
            onClick={() => startEditing(activeFloorIndex, currentActiveFloor?.floorName || '')}
            title="Đổi tên tầng đang chọn"
          >
            Đổi Tên Tầng
          </Button>

          {floors.length > 1 && (
            <Button
              size="sm"
              variant="danger"
              icon={<Trash2 className="w-3.5 h-3.5" />}
              onClick={() => handleDelete(activeFloorIndex)}
              title="Xóa tầng đang chọn"
            >
              Xóa Tầng
            </Button>
          )}

          <Button size="sm" icon={<Plus className="w-4 h-4" />} onClick={onAddFloor}>
            Thêm Tầng Mới
          </Button>
        </div>
      </div>

      {/* Tabs chọn Tầng */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 border-b border-slate-200 no-scrollbar">
        {floors.map((fl, idx) => {
          const isActive = activeFloorIndex === idx;
          const isEditing = editingIndex === idx;

          if (isEditing) {
            return (
              <div
                key={fl.id || idx}
                className="px-3 py-1.5 rounded-xl border border-emerald-500 bg-emerald-50/50 flex items-center gap-1.5 shadow-xs"
              >
                <input
                  type="text"
                  autoFocus
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSaveRename(idx, e);
                    if (e.key === 'Escape') handleCancelRename();
                  }}
                  className="px-2 py-1 bg-white border border-emerald-400 rounded-lg text-xs font-bold text-slate-800 w-28 sm:w-36 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
                <button
                  type="button"
                  onClick={(e) => handleSaveRename(idx, e)}
                  className="p-1 rounded bg-emerald-600 text-white hover:bg-emerald-700 cursor-pointer"
                  title="Lưu tên mới"
                >
                  <Check size={13} />
                </button>
                <button
                  type="button"
                  onClick={handleCancelRename}
                  className="p-1 rounded bg-slate-200 text-slate-600 hover:bg-slate-300 cursor-pointer"
                  title="Hủy"
                >
                  <X size={13} />
                </button>
              </div>
            );
          }

          return (
            <div
              key={fl.id || idx}
              onClick={() => onSelectFloor(idx)}
              className={`px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all whitespace-nowrap flex items-center gap-2 border cursor-pointer group ${
                isActive
                  ? 'bg-emerald-700 text-white border-emerald-700 shadow-xs'
                  : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
              }`}
            >
              <span>{fl.floorName}</span>
              <span
                className={`px-1.5 py-0.5 rounded-full text-[10px] font-mono ${
                  isActive ? 'bg-emerald-800 text-emerald-100' : 'bg-slate-100 text-slate-600'
                }`}
              >
                {fl.zones?.length || 0} Z • {fl.structuralElements?.length || 0} E
              </span>

              {/* Quick action buttons on active tab */}
              {isActive && (
                <div className="flex items-center gap-1 pl-1 ml-0.5 border-l border-emerald-600/60">
                  <button
                    type="button"
                    onClick={(e) => startEditing(idx, fl.floorName, e)}
                    className="p-1 rounded hover:bg-emerald-600 text-emerald-100 hover:text-white transition-colors cursor-pointer"
                    title="Đổi tên tầng"
                  >
                    <Edit2 size={12} />
                  </button>
                  {floors.length > 1 && (
                    <button
                      type="button"
                      onClick={(e) => handleDelete(idx, e)}
                      className="p-1 rounded hover:bg-red-600 text-emerald-100 hover:text-white transition-colors cursor-pointer"
                      title="Xóa tầng này"
                    >
                      <Trash2 size={12} />
                    </button>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
