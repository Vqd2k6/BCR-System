import React from 'react';
import {
  Search,
  X,
  RefreshCw,
  Building2,
  Layers,
  Filter,
  CheckCircle2,
  Clock,
  Sparkles,
  MapPin,
} from 'lucide-react';
import type { GisParcel } from '../../../gis/LeafletSweepMap';
import type { BuildingUnit } from '../types';
import type { FloorGroupData } from '../hooks/useBuildingHubState';
import { FloorCadSurveySection } from './FloorCadSurveySection';
import { UnitInspectionDrawer } from './UnitInspectionDrawer';
import { BuildingUnitCard } from './BuildingUnitCard';

interface BuildingUnitListProps {
  parcel: GisParcel;
  units: BuildingUnit[];
  loading: boolean;
  searchTerm: string;
  onSearchChange: (value: string) => void;
  isSearchFocused: boolean;
  setIsSearchFocused: (focused: boolean) => void;
  selectedFloor: number | 'ALL';
  onSelectedFloorChange: (floor: number | 'ALL') => void;
  availableFloors: number[];
  selectedStatus: string;
  onSelectedStatusChange: (status: string) => void;
  floorsData?: FloorGroupData[];
  allFloorsData?: FloorGroupData[];
  inspectedUnit?: BuildingUnit | null;
  onSelectInspectedUnit?: (unit: BuildingUnit | null) => void;
  isAdmin?: boolean;
  isMasterSurveyDone: boolean;
  onClose: () => void;
  onStartUnitSurvey: (parcel: GisParcel, unit: BuildingUnit, phase?: 1 | 2) => void;
  onStartMasterAreaSurvey?: (parcel: GisParcel, unit: BuildingUnit) => void;
  onOpenCadManagement?: (floorNumber?: number) => void;
  // Legacy props kept for backward compatibility
  showAddModal?: boolean;
  onToggleAddModal?: (show: boolean) => void;
  newUnitCode?: string;
  setNewUnitCode?: (code: string) => void;
  newFloorNumber?: number | '';
  setNewFloorNumber?: (floor: number | '') => void;
  isSubmittingUnit?: boolean;
  onAddUnitSubmit?: (e: React.FormEvent) => void;
  displayedUnits?: BuildingUnit[];
  filteredUnits?: BuildingUnit[];
  visibleCount?: number;
  onLoadMore?: () => void;
  activeHubTab?: 'UNIT' | 'MASTER';
  onTabChange?: (tab: 'UNIT' | 'MASTER') => void;
  unitItemsCount?: number;
  masterItemsCount?: number;
}

export const BuildingUnitList: React.FC<BuildingUnitListProps> = ({
  parcel,
  units,
  loading,
  searchTerm,
  onSearchChange,
  isSearchFocused,
  setIsSearchFocused,
  selectedFloor,
  onSelectedFloorChange,
  availableFloors,
  selectedStatus,
  onSelectedStatusChange,
  floorsData = [],
  allFloorsData = [],
  inspectedUnit = null,
  onSelectInspectedUnit,
  isAdmin = false,
  isMasterSurveyDone,
  onClose,
  onStartUnitSurvey,
  onStartMasterAreaSurvey,
  onOpenCadManagement,
}) => {
  const [internalSelectedUnit, setInternalSelectedUnit] = React.useState<BuildingUnit | null>(null);

  const activeUnit = inspectedUnit !== undefined ? inspectedUnit : internalSelectedUnit;
  const handleSelectUnit = (unit: BuildingUnit | null) => {
    if (onSelectInspectedUnit) {
      onSelectInspectedUnit(unit);
    } else {
      setInternalSelectedUnit(unit);
    }
  };

  const totalPositions = units.length;
  const totalFloorsCount = allFloorsData.length > 0 ? allFloorsData.length : availableFloors.length;

  return (
    <section className="flex flex-col gap-4 relative pb-16">
      {/* 1. Thanh Công Cụ Lọc Nhanh & Nhảy Tầng (Sticky Filter & Floor Jump Bar) */}
      <div className="bg-white rounded-2xl border border-slate-200/90 p-3 sm:p-4 shadow-xs flex flex-col gap-3">
        {/* Hàng 1: Tìm kiếm & Lọc trạng thái & Nút Mở CAD */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
          {/* Ô Tìm Kiếm */}
          <div className="relative flex-1">
            <Search
              size={16}
              className={`absolute left-3 top-1/2 -translate-y-1/2 transition-colors ${
                isSearchFocused ? 'text-teal-600' : 'text-slate-400'
              }`}
            />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => onSearchChange(e.target.value)}
              onFocus={() => setIsSearchFocused(true)}
              onBlur={() => setIsSearchFocused(false)}
              placeholder="Tìm mã căn (VD: 01, 801) hoặc tên chủ hộ..."
              className="w-full pl-9 pr-8 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs font-semibold text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => onSearchChange('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 rounded-md"
              >
                <X size={14} />
              </button>
            )}
          </div>

          {/* Lọc Trạng Thái */}
          <div className="flex items-center gap-2">
            <select
              value={selectedStatus}
              onChange={(e) => onSelectedStatusChange(e.target.value)}
              className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 cursor-pointer"
            >
              <option value="ALL">Tất cả trạng thái</option>
              <option value="APPROVED">Đã duyệt Phase 1</option>
              <option value="SUBMITTED">Đã nộp (Chờ duyệt)</option>
              <option value="IN_PROGRESS">Đang làm dở</option>
              <option value="ABSENT">Vắng mặt (Hoãn)</option>
              <option value="NOT_SURVEYED">Chưa khảo sát</option>
            </select>

            {onOpenCadManagement && (
              <button
                type="button"
                onClick={() => onOpenCadManagement?.()}
                className="px-3.5 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs shrink-0"
                title="Mở Quản lý / Nạp bản vẽ CAD các tầng"
              >
                <Layers size={14} />
                <span className="hidden sm:inline">Quản Lý CAD</span>
              </button>
            )}
          </div>
        </div>

        {/* Hàng 2: Dải Nút Nhảy Tầng Nhanh (Floor Jump Pills) */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 pt-1 no-scrollbar text-xs">
          <span className="text-slate-400 font-bold text-[11px] shrink-0 mr-1 flex items-center gap-1">
            <MapPin size={12} />
            <span>Chọn tầng:</span>
          </span>

          <button
            type="button"
            onClick={() => onSelectedFloorChange('ALL')}
            className={`px-3 py-1.5 rounded-xl font-bold text-xs shrink-0 transition-all cursor-pointer ${
              selectedFloor === 'ALL'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
            }`}
          >
            Tất Cả ({totalFloorsCount} tầng)
          </button>

          {(allFloorsData.length > 0 ? allFloorsData : availableFloors.map((f) => ({ floorNumber: f, floorLabel: `Tầng ${f}`, totalUnits: 0 }))).map((fl) => {
            const isSelected = selectedFloor === fl.floorNumber;
            return (
              <button
                key={fl.floorNumber}
                type="button"
                onClick={() => onSelectedFloorChange(fl.floorNumber)}
                className={`px-3 py-1.5 rounded-xl font-bold text-xs shrink-0 flex items-center gap-1.5 transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-teal-600 text-white shadow-xs ring-2 ring-teal-300'
                    : 'bg-slate-100 hover:bg-teal-50 text-slate-700 hover:text-teal-700 border border-slate-200'
                }`}
              >
                <span>{fl.floorLabel}</span>
                {fl.totalUnits > 0 && (
                  <span
                    className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${
                      isSelected ? 'bg-teal-800 text-white' : 'bg-slate-200 text-slate-600'
                    }`}
                  >
                    {fl.totalUnits}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* 2. Danh Sách Tầng Cuộn Lần Lượt (Floor-by-Floor Feed) */}
      {loading ? (
        <div className="py-20 text-center text-xs text-slate-500 flex flex-col items-center justify-center gap-2.5 bg-white rounded-2xl border border-slate-200 shadow-2xs">
          <RefreshCw size={24} className="text-teal-600 animate-spin" />
          <span className="font-semibold">Đang nạp sơ đồ CAD và dữ liệu các tầng...</span>
        </div>
      ) : floorsData.length === 0 ? (
        <div className="py-14 sm:py-16 px-4 text-center bg-white rounded-2xl border-2 border-dashed border-slate-300 flex flex-col items-center justify-center gap-3">
          <div className="w-14 h-14 rounded-2xl bg-slate-50 border border-slate-200 flex items-center justify-center text-slate-400">
            <Building2 size={28} />
          </div>
          <div className="max-w-md">
            <h4 className="text-sm font-extrabold text-slate-800">
              Không tìm thấy vị trí nào phù hợp
            </h4>
            <p className="text-xs text-slate-500 mt-1">
              Thử tìm kiếm với từ khóa khác hoặc đặt lại bộ lọc tầng/trạng thái.
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              onSearchChange('');
              onSelectedFloorChange('ALL');
              onSelectedStatusChange('ALL');
            }}
            className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs cursor-pointer"
          >
            Đặt lại bộ lọc
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-5">
          {floorsData.map((floor) => (
            <FloorCadSurveySection
              key={floor.floorNumber}
              floor={floor}
              parcel={parcel}
              selectedUnitId={activeUnit?.id}
              onSelectUnit={(unit) => handleSelectUnit(unit)}
              isAdmin={isAdmin}
              onOpenCadManagement={onOpenCadManagement}
              onStartUnitSurvey={onStartUnitSurvey}
              onStartMasterAreaSurvey={onStartMasterAreaSurvey}
            />
          ))}
        </div>
      )}

      {/* 3. Ngăn Kéo / Thẻ Nổi Xem Thông Tin Ô & Bắt Đầu Khảo Sát (Sticky Inspection Drawer) */}
      {activeUnit && (
        <div className="sticky bottom-3 z-50 w-full max-w-3xl mx-auto">
          <UnitInspectionDrawer
            unit={activeUnit}
            parcel={parcel}
            floorLabel={`Tầng ${activeUnit.floor_number ?? 1}`}
            isMasterSurveyDone={isMasterSurveyDone}
            onClose={() => handleSelectUnit(null)}
            onStartUnitSurvey={onStartUnitSurvey}
            onStartMasterAreaSurvey={onStartMasterAreaSurvey}
          />
        </div>
      )}
    </section>
  );
};
