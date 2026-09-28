import React from 'react';
import { Layers, Search, RefreshCw, Download } from 'lucide-react';
import { METRO_22_ZONES, MetroZoneConfig } from '../../../../survey-phase1/constants/metroGisConstants';

interface Phase1FilterToolbarProps {
  selectedZone: string;
  setSelectedZone: (zone: string) => void;
  statusFilter: string;
  setStatusFilter: (status: string) => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  isLoading: boolean;
  onRefresh: () => void;
  isBatchExporting: boolean;
  selectedCount: number;
  totalFilteredCount: number;
  onCreateBatchExport: () => void;
}

export const Phase1FilterToolbar: React.FC<Phase1FilterToolbarProps> = ({
  selectedZone,
  setSelectedZone,
  statusFilter,
  setStatusFilter,
  searchQuery,
  setSearchQuery,
  isLoading,
  onRefresh,
  isBatchExporting,
  selectedCount,
  totalFilteredCount,
  onCreateBatchExport,
}) => {
  return (
    <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
      <div className="flex flex-wrap items-center gap-3">
        {/* Phân Khu (Zone) */}
        <div className="flex items-center gap-2">
          <Layers size={16} className="text-slate-400" />
          <select
            value={selectedZone}
            onChange={(e) => setSelectedZone(e.target.value)}
            className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500"
          >
            <option value="ALL">🌐 Tất cả các Phân khu (Toàn tuyến Metro 2 - 1.227 thửa)</option>
            <optgroup label="⭐ 5 Phân đoạn dữ liệu chuẩn (Đã có số liệu khảo sát)">
              {METRO_22_ZONES.filter((z: MetroZoneConfig) => z.isDataReady).map((z: MetroZoneConfig) => (
                <option key={z.code} value={z.code}>
                  {z.name} ({z.rawParcelCount} thửa)
                </option>
              ))}
            </optgroup>
            <optgroup label="Tất cả 22 Phân đoạn toàn tuyến">
              {METRO_22_ZONES.map((z: MetroZoneConfig) => (
                <option key={z.code} value={z.code}>
                  {z.name}
                </option>
              ))}
            </optgroup>
          </select>
        </div>

        {/* Trạng thái Lô */}
        <div className="flex items-center gap-2">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-sky-500"
          >
            <option value="ALL">Tất cả trạng thái lô</option>
            <option value="COMPLETED_ONLY">Chỉ lô đã xong Phase 1 (APPROVED / COMPLETED)</option>
            <option value="APPROVED">Đã Phê Duyệt (APPROVED)</option>
            <option value="SUBMITTED">Đã Nộp (SUBMITTED)</option>
            <option value="IN_PROGRESS">Đang Khảo Sát (IN_PROGRESS)</option>
          </select>
        </div>

        {/* Tìm kiếm */}
        <div className="relative min-w-[200px] flex-1 sm:flex-none">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Tìm theo Mã lô, Chủ hộ, Địa chỉ..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-800 font-medium focus:outline-none focus:ring-2 focus:ring-sky-500"
          />
        </div>
      </div>

      <div className="flex items-center gap-2 self-end md:self-auto">
        <button
          onClick={onRefresh}
          disabled={isLoading}
          className="p-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5"
          title="Làm mới dữ liệu từ API"
        >
          <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />
          <span className="hidden sm:inline">Tải lại</span>
        </button>

        <button
          onClick={onCreateBatchExport}
          disabled={isBatchExporting || totalFilteredCount === 0}
          className="px-4 py-2 bg-sky-600 hover:bg-sky-700 text-white rounded-xl text-xs font-bold transition-all shadow-md shadow-sky-200 flex items-center gap-2 disabled:opacity-50"
        >
          <Download size={14} />
          <span>
            {selectedCount > 0
              ? `Xuất mẻ (${selectedCount} lô đã chọn)`
              : 'Xuất mẻ toàn Phân khu'}
          </span>
        </button>
      </div>
    </div>
  );
};
