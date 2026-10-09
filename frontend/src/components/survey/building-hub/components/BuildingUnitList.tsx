import {
  Home,
  Plus,
  Search,
  X,
  RefreshCw,
  Building2,
  Layers,
} from 'lucide-react';
import type { GisParcel } from '../../../gis/LeafletSweepMap';
import type { BuildingUnit } from '../types';
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
  showAddModal?: boolean;
  onToggleAddModal?: (show: boolean) => void;
  newUnitCode?: string;
  setNewUnitCode?: (code: string) => void;
  newFloorNumber?: number | '';
  setNewFloorNumber?: (floor: number | '') => void;
  isSubmittingUnit?: boolean;
  onAddUnitSubmit?: (e: React.FormEvent) => void;
  displayedUnits: BuildingUnit[];
  filteredUnits: BuildingUnit[];
  visibleCount: number;
  onLoadMore: () => void;
  isMasterSurveyDone: boolean;
  onClose: () => void;
  onStartUnitSurvey: (parcel: GisParcel, unit: BuildingUnit, phase?: 1 | 2) => void;
  onStartMasterAreaSurvey?: (parcel: GisParcel, unit: BuildingUnit) => void;
  onOpenCadManagement?: () => void;
  activeHubTab: 'UNIT' | 'MASTER';
  onTabChange: (tab: 'UNIT' | 'MASTER') => void;
  unitItemsCount: number;
  masterItemsCount: number;
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
  onStartMasterAreaSurvey,
  onOpenCadManagement,
  activeHubTab,
  onTabChange,
  unitItemsCount,
  masterItemsCount,
}) => {
  const isMasterTab = activeHubTab === 'MASTER';

  return (
    <section className="flex flex-col gap-3">
      {/* 2 Main Icon Tabs (Căn Hộ Con vs Khu Vực Dùng Chung) */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
        <button
          type="button"
          onClick={() => onTabChange('UNIT')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-xs sm:text-sm transition-all cursor-pointer ${
            !isMasterTab
              ? 'bg-teal-600 text-white shadow-xs'
              : 'bg-white text-slate-600 hover:text-slate-900 hover:bg-slate-50 border border-slate-200'
          }`}
        >
          <Home className="w-4 h-4" />
          <span>Căn Hộ Con ({unitItemsCount})</span>
        </button>
        <button
          type="button"
          onClick={() => onTabChange('MASTER')}
          className={`flex items-center gap-2 px-4 py-2 rounded-xl font-bold text-xs sm:text-sm transition-all cursor-pointer ${
            isMasterTab
              ? 'bg-indigo-600 text-white shadow-xs'
              : 'bg-white text-slate-600 hover:text-slate-900 hover:bg-slate-50 border border-slate-200'
          }`}
        >
          <Building2 className="w-4 h-4" />
          <span>Khu Vực Dùng Chung Master ({masterItemsCount})</span>
        </button>
      </div>

      {/* Header Info */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h3 className="text-sm sm:text-base font-extrabold text-slate-900 flex items-center gap-2">
            {isMasterTab ? (
              <>
                <Building2 size={18} className="text-indigo-600" />
                <span>Danh Sách Khu Vực Dùng Chung ({masterItemsCount} vị trí)</span>
              </>
            ) : (
              <>
                <Home size={18} className="text-teal-600" />
                <span>Danh Sách Căn Hộ Con ({unitItemsCount} căn)</span>
              </>
            )}
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            {isMasterTab
              ? 'Các khu vực dùng chung (Hầm, Sảnh, Mái, Kỹ thuật) được phân chia trên bản vẽ CAD và khảo sát độc lập.'
              : 'Căn hộ con được phân chia theo bản vẽ CAD mặt bằng tầng và khảo sát độc lập.'}
          </p>
        </div>
      </div>

      {/* Search & Dynamic Filter Bar (Only show when building has units) */}
      {units.length > 0 && (
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
      )}

      {/* Units Grid with Phase 1 vs Phase 2 Logic & 10-item pagination */}
      {loading ? (
        <div className="py-16 text-center text-xs text-slate-500 flex flex-col items-center justify-center gap-2 bg-white rounded-xl border border-slate-200">
          <RefreshCw size={20} className="text-sky-600 animate-spin" />
          <span>Đang tải danh sách căn hộ...</span>
        </div>
      ) : units.length === 0 ? (
        <div className="py-14 sm:py-16 px-4 text-center bg-white rounded-2xl border-2 border-dashed border-teal-200/80 flex flex-col items-center justify-center gap-3.5 shadow-2xs">
          <div className="w-16 h-16 rounded-2xl bg-teal-50 border border-teal-200 flex items-center justify-center text-teal-600 shadow-inner">
            <Building2 size={32} />
          </div>
          <div className="max-w-md">
            <h4 className="text-sm sm:text-base font-extrabold text-slate-800">
              Tòa nhà chưa có căn hộ con nào
            </h4>
            <p className="text-xs text-slate-500 mt-1 leading-relaxed">
              Các căn hộ con cần được phân chia trực tiếp từ bản vẽ mặt bằng CAD tầng. Quản trị viên vui lòng mở Studio Quản Lý CAD để nạp bản vẽ và chia cắt các ô căn hộ con.
            </p>
          </div>
          {onOpenCadManagement && (
            <button
              type="button"
              onClick={onOpenCadManagement}
              className="mt-1.5 inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold shadow-md shadow-teal-600/25 transition-all cursor-pointer hover:scale-[1.02] active:scale-[0.98]"
            >
              <Layers size={16} />
              <span>📐 Mở Quản Lý Bản Vẽ CAD Tầng</span>
            </button>
          )}
        </div>
      ) : filteredUnits.length === 0 ? (
        <div className="py-12 px-4 text-center bg-white rounded-xl border border-dashed border-slate-300 flex flex-col items-center justify-center gap-2 text-xs text-slate-500">
          <span>Không tìm thấy căn hộ nào phù hợp với bộ lọc tìm kiếm.</span>
          <button
            type="button"
            onClick={() => {
              onSearchChange('');
              onSelectedFloorChange('ALL');
              onSelectedStatusChange('ALL');
            }}
            className="text-sky-600 font-bold hover:underline cursor-pointer"
          >
            Đặt lại bộ lọc tìm kiếm
          </button>
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
