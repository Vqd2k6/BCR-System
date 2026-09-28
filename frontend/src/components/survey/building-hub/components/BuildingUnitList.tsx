import React from 'react';
import {
  Home,
  Plus,
  Search,
  X,
  RefreshCw,
} from 'lucide-react';
import { GisParcel } from '../../../gis/LeafletSweepMap';
import { BuildingUnit } from '../types';
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
  showAddModal: boolean;
  onToggleAddModal: (show: boolean) => void;
  newUnitCode: string;
  setNewUnitCode: (code: string) => void;
  newFloorNumber: number | '';
  setNewFloorNumber: (floor: number | '') => void;
  isSubmittingUnit: boolean;
  onAddUnitSubmit: (e: React.FormEvent) => void;
  displayedUnits: BuildingUnit[];
  filteredUnits: BuildingUnit[];
  visibleCount: number;
  onLoadMore: () => void;
  isMasterSurveyDone: boolean;
  onClose: () => void;
  onStartUnitSurvey: (parcel: GisParcel, unit: BuildingUnit, phase?: 1 | 2) => void;
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
  showAddModal,
  onToggleAddModal,
  newUnitCode,
  setNewUnitCode,
  newFloorNumber,
  setNewFloorNumber,
  isSubmittingUnit,
  onAddUnitSubmit,
  displayedUnits,
  filteredUnits,
  visibleCount,
  onLoadMore,
  isMasterSurveyDone,
  onClose,
  onStartUnitSurvey,
}) => {
  return (
    <section className="flex flex-col gap-3">
      {/* Header & Add Unit Button */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h3 className="text-sm sm:text-base font-extrabold text-slate-900 flex items-center gap-2">
            <Home size={18} className="text-sky-600" />
            <span>Danh Sách Căn Hộ Con ({units.length} căn)</span>
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Khảo sát chi tiết từng căn hộ con theo Phase 1 (Hiện trạng kết cấu) và Phase 2 (Nội thất chi tiết).
          </p>
        </div>

        <button
          type="button"
          onClick={() => onToggleAddModal(true)}
          className="inline-flex items-center justify-center gap-1.5 px-3.5 py-2 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold shadow-sm shadow-sky-600/20 transition-all self-start sm:self-auto cursor-pointer"
        >
          <Plus size={15} />
          <span>Thêm Căn Hộ Mới</span>
        </button>
      </div>

      {/* Search & Dynamic Filter Bar (Collapse on focus) */}
      <div className="bg-white p-2.5 sm:p-3 rounded-xl border border-slate-200 flex items-center gap-2.5 shadow-sm">
        {/* Search Input */}
        <div
          className={`relative transition-all duration-300 ease-in-out ${
            isSearchFocused || searchTerm ? 'flex-1' : 'w-48 sm:w-64'
          }`}
        >
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Tìm phòng (P.101) hoặc chủ hộ..."
            value={searchTerm}
            onFocus={() => setIsSearchFocused(true)}
            onBlur={() => {
              if (!searchTerm) setIsSearchFocused(false);
            }}
            onChange={(e) => onSearchChange(e.target.value)}
            className="w-full pl-9 pr-8 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500 transition-all"
          />
          {searchTerm && (
            <button
              type="button"
              onClick={() => {
                onSearchChange('');
                setIsSearchFocused(false);
              }}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-0.5 cursor-pointer"
            >
              <X size={13} />
            </button>
          )}
        </div>

        {/* Filters (Hidden when search is focused) */}
        {!(isSearchFocused || searchTerm) && (
          <div className="flex items-center gap-2 animate-in fade-in duration-200">
            {/* Floor Filter */}
            <div className="flex items-center gap-1.5">
              <select
                value={selectedFloor}
                onChange={(e) => onSelectedFloorChange(e.target.value === 'ALL' ? 'ALL' : parseInt(e.target.value, 10))}
                className="bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500"
              >
                <option value="ALL">Tất cả tầng ({units.length})</option>
                {availableFloors.map((fl) => (
                  <option key={fl} value={fl}>
                    Lầu {fl}
                  </option>
                ))}
              </select>
            </div>

            {/* Status Filter */}
            <div className="flex items-center gap-1.5">
              <select
                value={selectedStatus}
                onChange={(e) => onSelectedStatusChange(e.target.value)}
                className="bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs font-semibold text-slate-700 focus:outline-none focus:ring-2 focus:ring-sky-500/20 focus:border-sky-500"
              >
                <option value="ALL">Tất cả trạng thái</option>
                <option value="APPROVED">Đã duyệt P1</option>
                <option value="SUBMITTED">Chờ duyệt P1</option>
                <option value="IN_PROGRESS">Đang làm P1</option>
                <option value="ABSENT">Chủ hộ vắng mặt</option>
                <option value="NOT_SURVEYED">Chưa khảo sát</option>
              </select>
            </div>
          </div>
        )}
      </div>

      {/* Inline Form: Thêm căn hộ mới */}
      {showAddModal && (
        <form
          onSubmit={onAddUnitSubmit}
          className="bg-sky-50/80 border border-sky-200 rounded-xl p-4 flex flex-col gap-3 animate-in fade-in"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-sky-900">
              + Thêm căn hộ mới vào tòa nhà
            </span>
            <button
              type="button"
              onClick={() => onToggleAddModal(false)}
              className="text-slate-400 hover:text-slate-600 cursor-pointer"
            >
              <X size={16} />
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                Mã / Số phòng (*):
              </label>
              <input
                type="text"
                required
                placeholder="VD: P.402, A-12..."
                value={newUnitCode}
                onChange={(e) => setNewUnitCode(e.target.value)}
                className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-sky-500"
              />
            </div>
            <div>
              <label className="block text-[11px] font-semibold text-slate-700 mb-1">
                Tầng / Lầu (*):
              </label>
              <input
                type="number"
                required
                min="1"
                max="80"
                value={newFloorNumber}
                onChange={(e) => setNewFloorNumber(e.target.value === '' ? '' : parseInt(e.target.value, 10))}
                className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs text-slate-800 focus:outline-none focus:ring-1 focus:ring-sky-500"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={() => onToggleAddModal(false)}
              className="px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs text-slate-600 font-medium hover:bg-slate-50 cursor-pointer"
            >
              Hủy
            </button>
            <button
              type="submit"
              disabled={isSubmittingUnit}
              className="px-4 py-1.5 bg-sky-600 text-white rounded-lg text-xs font-bold hover:bg-sky-700 disabled:opacity-50 shadow-sm cursor-pointer"
            >
              {isSubmittingUnit ? 'Đang lưu...' : 'Lưu Căn Hộ'}
            </button>
          </div>
        </form>
      )}

      {/* Units Grid with Phase 1 vs Phase 2 Logic & 10-item pagination */}
      {loading ? (
        <div className="py-16 text-center text-xs text-slate-500 flex flex-col items-center justify-center gap-2 bg-white rounded-xl border border-slate-200">
          <RefreshCw size={20} className="text-sky-600 animate-spin" />
          <span>Đang tải danh sách căn hộ...</span>
        </div>
      ) : filteredUnits.length === 0 ? (
        <div className="py-12 text-center bg-white rounded-xl border border-dashed border-slate-300 text-xs text-slate-500">
          Không tìm thấy căn hộ nào phù hợp với bộ lọc tìm kiếm.
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3.5">
            {displayedUnits.map((unit) => (
              <BuildingUnitCard
                key={unit.id}
                unit={unit}
                parcel={parcel}
                isMasterSurveyDone={isMasterSurveyDone}
                onClose={onClose}
                onStartUnitSurvey={onStartUnitSurvey}
              />
            ))}
          </div>

          {/* Load More Pagination (10 per batch) */}
          {filteredUnits.length > visibleCount && (
            <div className="pt-2 flex flex-col items-center justify-center gap-1.5">
              <button
                type="button"
                onClick={onLoadMore}
                className="inline-flex items-center gap-2 px-5 py-2 rounded-xl bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-bold shadow-2xs transition-all hover:border-sky-400 hover:text-sky-700 cursor-pointer"
              >
                <RefreshCw size={14} className="text-sky-600" />
                <span>Xem thêm (+{Math.min(10, filteredUnits.length - visibleCount)} căn hộ)</span>
              </button>
              <span className="text-[11px] text-slate-400">
                Đang hiển thị {Math.min(visibleCount, filteredUnits.length)} / {filteredUnits.length} căn hộ
              </span>
            </div>
          )}
        </div>
      )}
    </section>
  );
};
