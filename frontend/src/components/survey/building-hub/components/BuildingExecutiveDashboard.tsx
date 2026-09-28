import React from 'react';
import {
  LayoutDashboard,
  Layers,
  ChevronRight,
  CheckCircle2,
  Clock,
  AlertCircle,
} from 'lucide-react';

interface BuildingExecutiveDashboardProps {
  completedCount: number;
  pendingApprovalCount: number;
  inProgressCount: number;
  absentCount: number;
  totalUnits: number;
  onOpenFloorProgress: () => void;
}

export const BuildingExecutiveDashboard: React.FC<BuildingExecutiveDashboardProps> = ({
  completedCount,
  pendingApprovalCount,
  inProgressCount,
  absentCount,
  totalUnits,
  onOpenFloorProgress,
}) => {
  return (
    <section className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 shadow-sm">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-sky-50 border border-sky-200 flex items-center justify-center text-sky-600">
            <LayoutDashboard size={18} />
          </div>
          <div>
            <h2 className="text-sm sm:text-base font-extrabold text-slate-900">
              Bảng Điều Khiển Tiến Độ Khảo Sát
            </h2>
            <p className="text-xs text-slate-500">
              Tổng hợp tiến độ toàn bộ căn hộ con trong tòa nhà
            </p>
          </div>
        </div>

        {/* Popover trigger button */}
        <button
          type="button"
          onClick={onOpenFloorProgress}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-sky-50 hover:bg-sky-100 border border-sky-200 text-sky-700 text-xs font-bold transition-all shadow-2xs self-start sm:self-auto cursor-pointer"
        >
          <Layers size={14} />
          <span>Xem chi tiết tiến độ theo tầng</span>
          <ChevronRight size={14} />
        </button>
      </div>

      {/* 4 KPI Dashboard Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-3.5">
        {/* KPI 1: Đã hoàn thành / Tổng căn */}
        <div className="bg-emerald-50/70 border border-emerald-200 rounded-xl p-3.5 flex flex-col justify-between gap-1">
          <div className="flex items-center justify-between text-emerald-700 text-xs font-semibold">
            <span>Đã hoàn thành</span>
            <CheckCircle2 size={16} className="text-emerald-600" />
          </div>
          <div className="text-xl sm:text-2xl font-black text-emerald-700">
            {completedCount} <span className="text-sm font-bold text-emerald-600/80">/ {totalUnits} căn</span>
          </div>
          <div className="text-[11px] text-emerald-600 font-medium">Căn đã duyệt / Tổng số căn</div>
        </div>

        {/* KPI 2: Chờ duyệt */}
        <div className="bg-sky-50/70 border border-sky-200 rounded-xl p-3.5 flex flex-col justify-between gap-1">
          <div className="flex items-center justify-between text-sky-700 text-xs font-semibold">
            <span>Chờ duyệt</span>
            <Clock size={16} className="text-sky-600" />
          </div>
          <div className="text-xl sm:text-2xl font-black text-sky-700">{pendingApprovalCount}</div>
          <div className="text-[11px] text-sky-600 font-medium">Đã nộp hồ sơ chờ duyệt</div>
        </div>

        {/* KPI 3: Đang làm */}
        <div className="bg-amber-50/70 border border-amber-200 rounded-xl p-3.5 flex flex-col justify-between gap-1">
          <div className="flex items-center justify-between text-amber-700 text-xs font-semibold">
            <span>Đang làm</span>
            <Clock size={16} className="text-amber-600" />
          </div>
          <div className="text-xl sm:text-2xl font-black text-amber-700">{inProgressCount}</div>
          <div className="text-[11px] text-amber-600 font-medium">Đang đo vẽ / ghi chép</div>
        </div>

        {/* KPI 4: Vắng mặt */}
        <div className="bg-purple-50/70 border border-purple-200 rounded-xl p-3.5 flex flex-col justify-between gap-1">
          <div className="flex items-center justify-between text-purple-700 text-xs font-semibold">
            <span>Vắng mặt</span>
            <AlertCircle size={16} className="text-purple-600" />
          </div>
          <div className="text-xl sm:text-2xl font-black text-purple-700">{absentCount}</div>
          <div className="text-[11px] text-purple-600 font-medium">Chủ hộ vắng / Hẹn lại</div>
        </div>
      </div>
    </section>
  );
};
