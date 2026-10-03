import React from 'react';
import { GuestKpiStats } from '../utils/guestPortalHelpers';
import {
  CheckCircle2,
  Clock,
  AlertTriangle,
  Building2,
  HardHat,
  DoorClosed,
  TrendingUp,
} from 'lucide-react';

interface Props {
  stats: GuestKpiStats;
  selectedFilter: string;
  onFilterChange: (status: string) => void;
}

export const GuestKpiSummaryCard: React.FC<Props> = ({
  stats,
  selectedFilter,
  onFilterChange,
}) => {
  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-xs space-y-3.5">
      {/* Header & Overall Completion */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-100">
            <TrendingUp size={16} />
          </div>
          <div>
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
              Tiến Độ Khảo Sát Toàn Khu Vực
            </h3>
            <p className="text-[11px] text-slate-500">
              Tổng số <strong>{stats.total}</strong> công trình được bàn giao khảo sát
            </p>
          </div>
        </div>

        <div className="text-right">
          <span className="text-xl font-black text-emerald-600 font-mono">
            {stats.completionRate}%
          </span>
          <span className="block text-[10px] text-slate-400 font-medium">Hoàn tất</span>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden flex">
        <div
          style={{ width: `${(stats.approved / (stats.total || 1)) * 100}%` }}
          className="bg-emerald-500 h-full transition-all duration-500"
          title={`Đã duyệt: ${stats.approved}`}
        />
        <div
          style={{ width: `${(stats.submitted / (stats.total || 1)) * 100}%` }}
          className="bg-sky-500 h-full transition-all duration-500"
          title={`Chờ duyệt: ${stats.submitted}`}
        />
        <div
          style={{ width: `${(stats.inProgress / (stats.total || 1)) * 100}%` }}
          className="bg-amber-500 h-full transition-all duration-500"
          title={`Đang đo: ${stats.inProgress}`}
        />
        <div
          style={{ width: `${(stats.absentee / (stats.total || 1)) * 100}%` }}
          className="bg-purple-500 h-full transition-all duration-500"
          title={`Vắng nhà: ${stats.absentee}`}
        />
      </div>

      {/* Quick Filter Badges Grid */}
      <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5 pt-1">
        {/* Đã duyệt */}
        <button
          type="button"
          onClick={() => onFilterChange(selectedFilter === 'APPROVED' ? 'ALL' : 'APPROVED')}
          className={`p-2 rounded-xl text-left border transition-all cursor-pointer ${
            selectedFilter === 'APPROVED'
              ? 'bg-emerald-50 border-emerald-400 ring-2 ring-emerald-500/20'
              : 'bg-slate-50/60 border-slate-200/80 hover:bg-emerald-50/40'
          }`}
        >
          <div className="flex items-center justify-between">
            <CheckCircle2 size={13} className="text-emerald-600" />
            <span className="font-mono text-xs font-bold text-emerald-700">{stats.approved}</span>
          </div>
          <span className="text-[10px] text-slate-600 font-semibold block mt-1 truncate">
            Đã duyệt
          </span>
        </button>

        {/* Chờ duyệt */}
        <button
          type="button"
          onClick={() => onFilterChange(selectedFilter === 'SUBMITTED' ? 'ALL' : 'SUBMITTED')}
          className={`p-2 rounded-xl text-left border transition-all cursor-pointer ${
            selectedFilter === 'SUBMITTED'
              ? 'bg-sky-50 border-sky-400 ring-2 ring-sky-500/20'
              : 'bg-slate-50/60 border-slate-200/80 hover:bg-sky-50/40'
          }`}
        >
          <div className="flex items-center justify-between">
            <Clock size={13} className="text-sky-600" />
            <span className="font-mono text-xs font-bold text-sky-700">{stats.submitted}</span>
          </div>
          <span className="text-[10px] text-slate-600 font-semibold block mt-1 truncate">
            Chờ duyệt
          </span>
        </button>

        {/* Đang khảo sát */}
        <button
          type="button"
          onClick={() => onFilterChange(selectedFilter === 'IN_PROGRESS' ? 'ALL' : 'IN_PROGRESS')}
          className={`p-2 rounded-xl text-left border transition-all cursor-pointer ${
            selectedFilter === 'IN_PROGRESS'
              ? 'bg-amber-50 border-amber-400 ring-2 ring-amber-500/20'
              : 'bg-slate-50/60 border-slate-200/80 hover:bg-amber-50/40'
          }`}
        >
          <div className="flex items-center justify-between">
            <Building2 size={13} className="text-amber-600" />
            <span className="font-mono text-xs font-bold text-amber-700">{stats.inProgress}</span>
          </div>
          <span className="text-[10px] text-slate-600 font-semibold block mt-1 truncate">
            Đang đo
          </span>
        </button>

        {/* Vắng nhà */}
        <button
          type="button"
          onClick={() => onFilterChange(selectedFilter === 'ABSENTEE' ? 'ALL' : 'ABSENTEE')}
          className={`p-2 rounded-xl text-left border transition-all cursor-pointer ${
            selectedFilter === 'ABSENTEE'
              ? 'bg-purple-50 border-purple-400 ring-2 ring-purple-500/20'
              : 'bg-slate-50/60 border-slate-200/80 hover:bg-purple-50/40'
          }`}
        >
          <div className="flex items-center justify-between">
            <DoorClosed size={13} className="text-purple-600" />
            <span className="font-mono text-xs font-bold text-purple-700">{stats.absentee}</span>
          </div>
          <span className="text-[10px] text-slate-600 font-semibold block mt-1 truncate">
            Vắng nhà
          </span>
        </button>

        {/* Đang xây / Đất trống */}
        <button
          type="button"
          onClick={() => onFilterChange(selectedFilter === 'UNDER_CONSTRUCTION' ? 'ALL' : 'UNDER_CONSTRUCTION')}
          className={`p-2 rounded-xl text-left border transition-all cursor-pointer ${
            selectedFilter === 'UNDER_CONSTRUCTION'
              ? 'bg-orange-50 border-orange-400 ring-2 ring-orange-500/20'
              : 'bg-slate-50/60 border-slate-200/80 hover:bg-orange-50/40'
          }`}
        >
          <div className="flex items-center justify-between">
            <HardHat size={13} className="text-orange-600" />
            <span className="font-mono text-xs font-bold text-orange-700">{stats.underConstruction}</span>
          </div>
          <span className="text-[10px] text-slate-600 font-semibold block mt-1 truncate">
            Đang xây
          </span>
        </button>

        {/* Chưa đo */}
        <button
          type="button"
          onClick={() => onFilterChange(selectedFilter === 'PENDING' ? 'ALL' : 'PENDING')}
          className={`p-2 rounded-xl text-left border transition-all cursor-pointer ${
            selectedFilter === 'PENDING'
              ? 'bg-slate-200 border-slate-400 ring-2 ring-slate-400/20'
              : 'bg-slate-50/60 border-slate-200/80 hover:bg-slate-100'
          }`}
        >
          <div className="flex items-center justify-between">
            <AlertTriangle size={13} className="text-slate-500" />
            <span className="font-mono text-xs font-bold text-slate-700">{stats.pending}</span>
          </div>
          <span className="text-[10px] text-slate-600 font-semibold block mt-1 truncate">
            Chưa đo
          </span>
        </button>
      </div>
    </div>
  );
};
