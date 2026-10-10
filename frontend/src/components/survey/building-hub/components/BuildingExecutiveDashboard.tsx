import React, { useState } from 'react';
import {
  LayoutDashboard,
  Layers,
  ChevronRight,
  ChevronDown,
  ChevronUp,
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
  const [isMobileExpanded, setIsMobileExpanded] = useState<boolean>(false);

  const percentCompleted =
    totalUnits > 0 ? Math.round((completedCount / totalUnits) * 100) : 0;

  return (
    <section className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden transition-all">
      {/* 1. Mobile Compact KPI Micro-Bar (Dành riêng cho màn hình điện thoại < 640px) */}
      <div className="sm:hidden px-3.5 py-2.5 flex items-center justify-between gap-2 bg-slate-50/90 border-b border-slate-100">
        <div className="flex items-center gap-1.5 flex-wrap min-w-0">
          {/* Badge Tiến độ hoàn thành */}
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-xs font-black bg-emerald-100 text-emerald-800 border border-emerald-300 shadow-2xs">
            <CheckCircle2 size={12} className="text-emerald-700" />
            <span>{completedCount}/{totalUnits} căn</span>
            <span className="text-[10px] text-emerald-700/80 font-normal">({percentCompleted}%)</span>
          </span>

          {/* Badge Chờ duyệt */}
          {pendingApprovalCount > 0 && (
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-lg text-[11px] font-bold bg-sky-100 text-sky-800 border border-sky-300">
              <Clock size={11} className="text-sky-700" />
              <span>{pendingApprovalCount}</span>
            </span>
          )}

          {/* Badge Đang làm */}
          {inProgressCount > 0 && (
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-lg text-[11px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-600 animate-pulse" />
              <span>{inProgressCount}</span>
            </span>
          )}

          {/* Badge Vắng mặt */}
          {absentCount > 0 && (
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-lg text-[11px] font-bold bg-purple-100 text-purple-800 border border-purple-300">
              <AlertCircle size={11} className="text-purple-700" />
              <span>{absentCount}</span>
            </span>
          )}
        </div>

        {/* Nút thao tác mở rộng / xem tiến độ tầng */}
        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={onOpenFloorProgress}
            className="p-1.5 rounded-lg bg-white border border-slate-200 text-sky-700 hover:bg-sky-50 text-xs font-bold transition-colors cursor-pointer"
            title="Xem chi tiết tiến độ theo tầng"
          >
            <Layers size={14} />
          </button>
          <button
            type="button"
            onClick={() => setIsMobileExpanded(!isMobileExpanded)}
            className="p-1.5 rounded-lg bg-white border border-slate-200 text-slate-600 hover:bg-slate-100 text-xs font-bold transition-colors cursor-pointer"
            title={isMobileExpanded ? 'Thu gọn bảng điều khiển' : 'Mở rộng chi tiết KPI'}
          >
            {isMobileExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
        </div>
      </div>

      {/* 2. Full Dashboard Content: Luôn hiện trên Desktop (sm:block), Trên Mobile chỉ hiện khi nhấn mở rộng */}
      <div className={`p-4 sm:p-5 ${isMobileExpanded ? 'block' : 'hidden sm:block'}`}>
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
      </div>
    </section>
  );
};
