import React from 'react';
import { GuestKpiStats } from '../utils/guestPortalHelpers';
import {
  CheckCircle2,
  Clock,
  Building2,
  DoorClosed,
  TrendingUp,
  Hammer,
  AlertCircle,
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
    <div className="bg-white rounded-xl border border-slate-200/80 p-4 shadow-xs space-y-3.5">
      {/* Header & Overall Completion */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-100 shrink-0">
            <TrendingUp size={16} />
          </div>
          <div>
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
              Tiến Độ Khảo Sát Toàn Khu Vực
            </h3>
            <p className="text-[11px] text-slate-500">
              Tổng số <strong className="text-slate-800 font-semibold">{stats.total}</strong> công trình được bàn giao khảo sát
            </p>
          </div>
        </div>

        <div className="text-right shrink-0">
          <span className="text-xl font-black text-emerald-600 font-mono tracking-tight">
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
        <div
          style={{ width: `${(stats.underConstruction / (stats.total || 1)) * 100}%` }}
          className="bg-orange-500 h-full transition-all duration-500"
          title={`Đang xây: ${stats.underConstruction}`}
        />
      </div>

      {/* 2-Row x 3-Col Quick Filter Badges Grid (Không bao giờ bị truncate cắt chữ) */}
      <div className="grid grid-cols-3 gap-2 pt-1">
        {/* Đã duyệt */}
        <button
          type="button"
          onClick={() => onFilterChange(selectedFilter === 'APPROVED' ? 'ALL' : 'APPROVED')}
          className={`p-2.5 rounded-xl text-left border transition-all cursor-pointer ${
            selectedFilter === 'APPROVED'
              ? 'bg-emerald-50 border-emerald-400 ring-2 ring-emerald-500/20 shadow-xs'
              : 'bg-slate-50/70 border-slate-200/80 hover:bg-emerald-50/40 hover:border-emerald-200'
          }`}
        >
          <div className="flex items-center justify-between">
            <CheckCircle2 size={13} className="text-emerald-600" />
            <span className="font-mono text-xs font-bold text-emerald-700">{stats.approved}</span>
          </div>
          <span className="text-[11px] text-slate-700 font-semibold block mt-1">
            Đã duyệt
          </span>
        </button>

        {/* Chờ duyệt */}
        <button
          type="button"
          onClick={() => onFilterChange(selectedFilter === 'SUBMITTED' ? 'ALL' : 'SUBMITTED')}
          className={`p-2.5 rounded-xl text-left border transition-all cursor-pointer ${
            selectedFilter === 'SUBMITTED'
              ? 'bg-sky-50 border-sky-400 ring-2 ring-sky-500/20 shadow-xs'
              : 'bg-slate-50/70 border-slate-200/80 hover:bg-sky-50/40 hover:border-sky-200'
          }`}
        >
          <div className="flex items-center justify-between">
            <Clock size={13} className="text-sky-600" />
            <span className="font-mono text-xs font-bold text-sky-700">{stats.submitted}</span>
          </div>
          <span className="text-[11px] text-slate-700 font-semibold block mt-1">
            Chờ duyệt
          </span>
        </button>

        {/* Đang khảo sát */}
        <button
          type="button"
          onClick={() => onFilterChange(selectedFilter === 'IN_PROGRESS' ? 'ALL' : 'IN_PROGRESS')}
          className={`p-2.5 rounded-xl text-left border transition-all cursor-pointer ${
            selectedFilter === 'IN_PROGRESS'
              ? 'bg-amber-50 border-amber-400 ring-2 ring-amber-500/20 shadow-xs'
              : 'bg-slate-50/70 border-slate-200/80 hover:bg-amber-50/40 hover:border-amber-200'
          }`}
        >
          <div className="flex items-center justify-between">
            <Building2 size={13} className="text-amber-600" />
            <span className="font-mono text-xs font-bold text-amber-700">{stats.inProgress}</span>
          </div>
          <span className="text-[11px] text-slate-700 font-semibold block mt-1">
            Đang đo
          </span>
        </button>

        {/* Vắng nhà */}
        <button
          type="button"
          onClick={() => onFilterChange(selectedFilter === 'ABSENTEE' ? 'ALL' : 'ABSENTEE')}
          className={`p-2.5 rounded-xl text-left border transition-all cursor-pointer ${
            selectedFilter === 'ABSENTEE'
              ? 'bg-purple-50 border-purple-400 ring-2 ring-purple-500/20 shadow-xs'
              : 'bg-slate-50/70 border-slate-200/80 hover:bg-purple-50/40 hover:border-purple-200'
          }`}
        >
          <div className="flex items-center justify-between">
            <DoorClosed size={13} className="text-purple-600" />
            <span className="font-mono text-xs font-bold text-purple-700">{stats.absentee}</span>
          </div>
          <span className="text-[11px] text-slate-700 font-semibold block mt-1">
            Vắng nhà
          </span>
        </button>

        {/* Đang xây */}
        <button
          type="button"
          onClick={() => onFilterChange(selectedFilter === 'UNDER_CONSTRUCTION' ? 'ALL' : 'UNDER_CONSTRUCTION')}
          className={`p-2.5 rounded-xl text-left border transition-all cursor-pointer ${
            selectedFilter === 'UNDER_CONSTRUCTION'
              ? 'bg-orange-50 border-orange-400 ring-2 ring-orange-500/20 shadow-xs'
              : 'bg-slate-50/70 border-slate-200/80 hover:bg-orange-50/40 hover:border-orange-200'
          }`}
        >
          <div className="flex items-center justify-between">
            <Hammer size={13} className="text-orange-600" />
            <span className="font-mono text-xs font-bold text-orange-700">{stats.underConstruction}</span>
          </div>
          <span className="text-[11px] text-slate-700 font-semibold block mt-1">
            Đang xây
          </span>
        </button>

        {/* Chưa đo / Tồn đọng */}
        <button
          type="button"
          onClick={() => onFilterChange(selectedFilter === 'PENDING' ? 'ALL' : 'PENDING')}
          className={`p-2.5 rounded-xl text-left border transition-all cursor-pointer ${
            selectedFilter === 'PENDING'
              ? 'bg-slate-200 border-slate-400 ring-2 ring-slate-400/20 shadow-xs'
              : 'bg-slate-50/70 border-slate-200/80 hover:bg-slate-100 hover:border-slate-300'
          }`}
        >
          <div className="flex items-center justify-between">
            <AlertCircle size={13} className="text-slate-500" />
            <span className="font-mono text-xs font-bold text-slate-700">{stats.pending}</span>
          </div>
          <span className="text-[11px] text-slate-700 font-semibold block mt-1">
            Chưa đo
          </span>
        </button>
      </div>
    </div>
  );
};
