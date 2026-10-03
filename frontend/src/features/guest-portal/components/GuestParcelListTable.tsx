import React, { useState, useMemo, useEffect } from 'react';
import { GisParcel } from '../../../components/gis/shared/types';
import {
  getEffectiveParcelStatus,
  getStatusColor,
} from '../../../components/gis/sweep-map/utils/sweepMapHelpers';
import {
  getParcelBraRiskLevel,
  getBraBadgeStyle,
  BraRiskLevel,
} from '../utils/guestPortalHelpers';
import { Search, MapPin, Building, ChevronRight, Plus, ChevronDown } from 'lucide-react';

interface Props {
  parcels: GisParcel[];
  activeParcel: GisParcel | null;
  onSelectParcel: (parcel: GisParcel) => void;
  statusFilter: string;
  riskFilter: BraRiskLevel | 'ALL';
}

export const GuestParcelListTable: React.FC<Props> = ({
  parcels,
  activeParcel,
  onSelectParcel,
  statusFilter,
  riskFilter,
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [visibleCount, setVisibleCount] = useState<number>(50);

  // Reset pagination when filter or search changes
  useEffect(() => {
    setVisibleCount(50);
  }, [statusFilter, riskFilter, searchTerm]);

  // Filtered parcels
  const filtered = useMemo(() => {
    return parcels.filter((p) => {
      // 1. Status Filter
      if (statusFilter !== 'ALL') {
        const effStatus = getEffectiveParcelStatus(p);
        if (statusFilter === 'APPROVED' && effStatus !== 'APPROVED' && effStatus !== 'PHASE2_COMPLETED' && effStatus !== 'APPROVED_PHASE2') {
          return false;
        }
        if (statusFilter === 'SUBMITTED' && effStatus !== 'SUBMITTED') return false;
        if (statusFilter === 'IN_PROGRESS' && effStatus !== 'IN_PROGRESS') return false;
        if (statusFilter === 'ABSENTEE' && effStatus !== 'POSTPONED_ABSENT') return false;
        if (statusFilter === 'UNDER_CONSTRUCTION' && effStatus !== 'UNDER_CONSTRUCTION') return false;
        if (statusFilter === 'PENDING' && effStatus !== 'NOT_SURVEYED') return false;
      }

      // 2. Risk Filter
      if (riskFilter !== 'ALL') {
        const r = getParcelBraRiskLevel(p);
        if (r !== riskFilter) return false;
      }

      // 3. Search Term
      if (searchTerm.trim()) {
        const query = searchTerm.toLowerCase();
        const codeMatch = (p.projectParcelCode || '').toLowerCase().includes(query);
        const cadMatch = (p.officialCadastralCode || '').toLowerCase().includes(query);
        const houseMatch = (p.houseNumber || '').toLowerCase().includes(query);
        const streetMatch = (p.street || '').toLowerCase().includes(query);
        return codeMatch || cadMatch || houseMatch || streetMatch;
      }

      return true;
    });
  }, [parcels, statusFilter, riskFilter, searchTerm]);

  // Max 50 items initially, then expand with load more
  const displayed = useMemo(() => {
    return filtered.slice(0, visibleCount);
  }, [filtered, visibleCount]);

  const getStatusLabel = (effStatus: string) => {
    switch (effStatus) {
      case 'APPROVED':
      case 'PHASE2_COMPLETED':
      case 'APPROVED_PHASE2':
        return 'Đã duyệt';
      case 'SUBMITTED':
        return 'Chờ duyệt';
      case 'IN_PROGRESS':
        return 'Đang đo';
      case 'POSTPONED_ABSENT':
        return 'Vắng nhà';
      case 'REJECTED':
        return 'Đo lại';
      case 'UNDER_CONSTRUCTION':
        return 'Đang xây';
      case 'NOT_SURVEYED':
      default:
        return 'Chưa đo';
    }
  };

  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs flex flex-col overflow-hidden">
      {/* Table Header & Search */}
      <div className="p-3 border-b border-slate-100 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 bg-slate-50/50">
        <div className="flex items-center gap-1.5">
          <Building size={15} className="text-slate-600" />
          <span className="text-xs font-bold text-slate-800 uppercase tracking-wider">
            Danh Sách Công Trình ({filtered.length}/{parcels.length})
          </span>
        </div>

        {/* Search input */}
        <div className="relative min-w-[200px] flex-1 max-w-xs">
          <Search size={13} className="absolute left-2.5 top-2.5 text-slate-400" />
          <input
            type="text"
            placeholder="Tìm số nhà, mã thửa, đường..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-8 pr-3 py-1.5 text-xs bg-white border border-slate-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-sky-500 shadow-2xs"
          />
        </div>
      </div>

      {/* Table Content List */}
      <div className="max-h-[340px] overflow-y-auto divide-y divide-slate-100 no-scrollbar">
        {filtered.length === 0 ? (
          <div className="p-8 text-center text-slate-400 text-xs">
            Không tìm thấy công trình nào phù hợp với bộ lọc hiện tại.
          </div>
        ) : (
          <>
            {displayed.map((parcel) => {
              const isSelected = activeParcel?.id === parcel.id;
              const effStatus = getEffectiveParcelStatus(parcel);
              const statusColor = getStatusColor(effStatus);
              const braLevel = getParcelBraRiskLevel(parcel);
              const braStyle = getBraBadgeStyle(braLevel);

              return (
                <div
                  key={parcel.id}
                  onClick={() => onSelectParcel(parcel)}
                  className={`px-3.5 py-2.5 flex items-center justify-between gap-2 cursor-pointer transition-colors ${
                    isSelected
                      ? 'bg-sky-50/80 border-l-4 border-l-sky-600'
                      : 'hover:bg-slate-50 border-l-4 border-l-transparent'
                  }`}
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold text-slate-900 truncate">
                        {parcel.projectParcelCode}
                      </span>
                      <span
                        className="px-1.5 py-0.5 rounded text-[10px] font-bold text-white shrink-0"
                        style={{ backgroundColor: statusColor }}
                      >
                        {getStatusLabel(effStatus)}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5 mt-0.5 text-xs text-slate-600 truncate">
                      <MapPin size={11} className="text-slate-400 shrink-0" />
                      <span className="truncate">
                        {parcel.houseNumber ? `${parcel.houseNumber} ` : ''}
                        {parcel.street || 'Đang cập nhật địa chỉ'}
                      </span>
                    </div>
                  </div>

                  {/* Right side: BRA risk badge & Action chevron */}
                  <div className="flex items-center gap-2 shrink-0">
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${braStyle.bg} ${braStyle.text} ${braStyle.border}`}
                    >
                      {braStyle.label.split(' ')[0]}
                    </span>
                    <ChevronRight size={14} className="text-slate-300" />
                  </div>
                </div>
              );
            })}

            {/* Load More (+50) Controls */}
            {filtered.length > visibleCount && (
              <div className="p-2.5 bg-slate-50 border-t border-slate-100 flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={() => setVisibleCount((prev) => prev + 50)}
                  className="flex-1 py-1.5 px-3 rounded-lg bg-white border border-slate-200 hover:bg-sky-50 hover:border-sky-300 text-sky-700 text-xs font-bold flex items-center justify-center gap-1.5 shadow-2xs transition-all cursor-pointer"
                >
                  <Plus size={14} className="text-sky-600" />
                  <span>
                    Xem thêm {Math.min(50, filtered.length - visibleCount)} công trình tiếp theo
                  </span>
                </button>
                <span className="text-[11px] text-slate-400 font-mono font-medium shrink-0">
                  {displayed.length}/{filtered.length}
                </span>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};
