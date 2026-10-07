import React from 'react';
import {
  TrendingUp,
  AlertTriangle,
  Clock,
  UserX,
  CheckCircle2,
  Calendar,
  Zap,
  ShieldAlert,
  ArrowUpRight,
  Filter,
  BarChart3,
  Layers,
  ChevronRight,
  Sparkles,
} from 'lucide-react';

export interface ZoneIntelligenceStats {
  totalParcels: number;
  approved: number;
  submitted: number;
  inProgress: number;
  absent: number;
  rejected: number;
  notSurveyed: number;

  // Burland severity
  burlandGrade0: number;
  burlandGrade12: number;
  burlandGrade3: number;
  burlandGrade45: number;
  totalCriticalBurland: number;

  // SLA
  slaOverdue48h: number;
  slaWarning24h: number;

  // Absent
  absentAttempt1: number;
  absentAttempt2: number;
  absentAttempt3Plus: number;

  // Velocity & Burndown
  velocityPerDay: number;
  estimatedCompletionDays: number;
}

interface Props {
  stats: ZoneIntelligenceStats;
  selectedZone: string;
  onFilterClick?: (filterCategory: string, filterValue: string, label: string) => void;
  activeFilterLabel?: string;
  onClearFilter?: () => void;
}

export const ZoneIntelligenceDashboard: React.FC<Props> = ({
  stats,
  selectedZone,
  onFilterClick,
  activeFilterLabel,
  onClearFilter,
}) => {
  const percentApproved = stats.totalParcels > 0
    ? Number(((stats.approved / stats.totalParcels) * 100).toFixed(1))
    : 0;
  const percentSubmitted = stats.totalParcels > 0
    ? Number(((stats.submitted / stats.totalParcels) * 100).toFixed(1))
    : 0;
  const percentInProgress = stats.totalParcels > 0
    ? Number(((stats.inProgress / stats.totalParcels) * 100).toFixed(1))
    : 0;
  const percentAbsent = stats.totalParcels > 0
    ? Number(((stats.absent / stats.totalParcels) * 100).toFixed(1))
    : 0;
  const percentNotSurveyed = Math.max(0, 100 - percentApproved - percentSubmitted - percentInProgress - percentAbsent);

  return (
    <div className="space-y-4">
      {/* 1. Tuyến Metro 2 Multi-Segment Progress Strip */}
      <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                Tiến Độ Phủ Sóng Khảo Sát Hiện Trường Toàn Phân Khu
              </span>
            </div>
            <div className="flex items-baseline gap-2 mt-0.5">
              <span className="text-2xl font-black text-slate-900">{percentApproved}%</span>
              <span className="text-xs text-slate-500 font-medium">
                đã phê duyệt chính thức ({stats.approved} / {stats.totalParcels} thửa)
              </span>
            </div>
          </div>

          {/* Quick Velocity Pill */}
          <div className="flex items-center gap-2.5 shrink-0">
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-bold whitespace-nowrap shrink-0 shadow-2xs">
              <Zap className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
              <span>Tốc độ: ~{stats.velocityPerDay || 1.5} thửa/ngày</span>
            </div>
            <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-100 border border-slate-200 text-slate-700 text-xs font-bold whitespace-nowrap shrink-0 shadow-2xs">
              <Calendar className="w-3.5 h-3.5 text-slate-500 shrink-0" />
              <span>Dự kiến: {stats.estimatedCompletionDays || 30} ngày nữa</span>
            </div>
          </div>
        </div>

        {/* Multi-segment Progress Bar */}
        <div className="w-full h-3 rounded-full bg-slate-100 overflow-hidden flex shadow-inner">
          <div
            style={{ width: `${percentApproved}%` }}
            className="h-full bg-emerald-500 transition-all duration-500"
            title={`Đã phê duyệt: ${stats.approved} (${percentApproved}%)`}
          />
          <div
            style={{ width: `${percentSubmitted}%` }}
            className="h-full bg-sky-500 transition-all duration-500"
            title={`Chờ duyệt: ${stats.submitted} (${percentSubmitted}%)`}
          />
          <div
            style={{ width: `${percentInProgress}%` }}
            className="h-full bg-amber-400 transition-all duration-500"
            title={`Đang khảo sát: ${stats.inProgress} (${percentInProgress}%)`}
          />
          <div
            style={{ width: `${percentAbsent}%` }}
            className="h-full bg-purple-500 transition-all duration-500"
            title={`Vắng mặt: ${stats.absent} (${percentAbsent}%)`}
          />
          <div
            style={{ width: `${percentNotSurveyed}%` }}
            className="h-full bg-slate-200 transition-all duration-500"
            title={`Chưa khảo sát: ${stats.notSurveyed}`}
          />
        </div>

        {/* Progress Legend */}
        <div className="flex items-center justify-between flex-wrap gap-2 text-[11px] text-slate-600 font-medium mt-3 pt-2.5 border-t border-slate-100">
          <button
            type="button"
            onClick={() => onFilterClick?.('STATUS', 'APPROVED', 'Đã phê duyệt (APPROVED)')}
            className="flex items-center gap-1.5 hover:text-emerald-700 transition-colors cursor-pointer"
          >
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
            <span>Đã duyệt: <strong>{stats.approved}</strong> ({percentApproved}%)</span>
          </button>

          <button
            type="button"
            onClick={() => onFilterClick?.('STATUS', 'SUBMITTED', 'Chờ thẩm định (SUBMITTED)')}
            className="flex items-center gap-1.5 hover:text-sky-700 transition-colors cursor-pointer"
          >
            <span className="w-2.5 h-2.5 rounded-full bg-sky-500" />
            <span>Chờ duyệt: <strong>{stats.submitted}</strong> ({percentSubmitted}%)</span>
          </button>

          <button
            type="button"
            onClick={() => onFilterClick?.('STATUS', 'IN_PROGRESS', 'Đang khảo sát dở')}
            className="flex items-center gap-1.5 hover:text-amber-700 transition-colors cursor-pointer"
          >
            <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
            <span>Đang làm: <strong>{stats.inProgress}</strong></span>
          </button>

          <button
            type="button"
            onClick={() => onFilterClick?.('STATUS', 'POSTPONED_ABSENT', 'Vắng mặt chủ hộ')}
            className="flex items-center gap-1.5 hover:text-purple-700 transition-colors cursor-pointer"
          >
            <span className="w-2.5 h-2.5 rounded-full bg-purple-500" />
            <span>Vắng mặt: <strong>{stats.absent}</strong></span>
          </button>

          <div className="flex items-center gap-1.5 text-slate-400">
            <span className="w-2.5 h-2.5 rounded-full bg-slate-300" />
            <span>Chưa đo: <strong>{stats.notSurveyed}</strong></span>
          </div>
        </div>
      </div>

      {/* Active Filter Banner if selected */}
      {activeFilterLabel && (
        <div className="flex items-center justify-between px-4 py-2.5 rounded-xl bg-sky-50 border border-sky-200 text-xs font-bold text-sky-900 animate-in fade-in">
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-sky-600" />
            <span>Đang lọc hàng đợi theo chỉ số: <strong className="text-sky-700">{activeFilterLabel}</strong></span>
          </div>
          <button
            type="button"
            onClick={onClearFilter}
            className="px-2.5 py-1 rounded-lg bg-white border border-sky-200 text-sky-700 hover:bg-sky-100 text-[11px] font-bold cursor-pointer transition-colors"
          >
            Xóa bộ lọc
          </button>
        </div>
      )}

      {/* 2. Cụm 4 Thẻ Phân Tích Điều Hành Trí Tuệ (Executive Intelligence Cards) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 2xl:gap-6">
        {/* Card 1: Khối lượng Tổng thể */}
        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs hover:border-slate-300 transition-all flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-slate-500 mb-1.5">
              <span className="text-[11px] font-bold uppercase tracking-wider">Tổng Thửa Quy Hoạch</span>
              <Layers className="w-4 h-4 text-slate-400" />
            </div>
            <div className="text-2xl font-black text-slate-900">{stats.totalParcels}</div>
            <div className="text-xs text-slate-500 mt-1">
              Phân khu: <strong className="text-slate-700">{selectedZone === 'ALL' ? 'Toàn tuyến Metro 2' : selectedZone}</strong>
            </div>
          </div>

          <div className="pt-3 mt-3 border-t border-slate-100 flex items-center justify-between text-[11px]">
            <span className="text-slate-500">Khảo sát dở dang:</span>
            <span className="font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200">
              {stats.inProgress} thửa
            </span>
          </div>
        </div>

        {/* Card 2: Ma Trận Cảnh Báo Rủi Ro Kết Cấu Burland */}
        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs hover:border-orange-300 transition-all flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-slate-500 mb-1.5">
              <span className="text-[11px] font-bold uppercase tracking-wider text-orange-700">Rủi Ro Kết Cấu (Burland)</span>
              <ShieldAlert className="w-4 h-4 text-orange-600" />
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-black text-orange-600">
                {stats.totalCriticalBurland || stats.burlandGrade45 + stats.burlandGrade3}
              </span>
              <span className="text-xs font-bold text-orange-700">nhà Cấp ≥ 3</span>
            </div>
            <p className="text-[11px] text-slate-500 mt-1">
              Có nứt kết cấu/tường nguy hiểm cần giám sát
            </p>
          </div>

          {/* Interactive Breakdown Pills */}
          <div className="pt-3 mt-3 border-t border-slate-100 flex items-center gap-1.5 overflow-x-auto no-scrollbar">
            <button
              type="button"
              onClick={() => onFilterClick?.('BURLAND', 'GRADE_4_5', 'Rủi ro Cấp 4-5 (Nặng / Rất nặng)')}
              className="flex-1 py-1 px-2 rounded-lg bg-red-50 hover:bg-red-100 border border-red-200 text-red-700 text-[11px] font-bold text-center cursor-pointer transition-colors whitespace-nowrap shrink-0"
              title="Lọc nhà cấp 4-5 nứt nặng"
            >
              Cấp 4-5: <strong>{stats.burlandGrade45}</strong>
            </button>
            <button
              type="button"
              onClick={() => onFilterClick?.('BURLAND', 'GRADE_3', 'Rủi ro Cấp 3 (Trung bình)')}
              className="flex-1 py-1 px-2 rounded-lg bg-orange-50 hover:bg-orange-100 border border-orange-200 text-orange-700 text-[11px] font-bold text-center cursor-pointer transition-colors whitespace-nowrap shrink-0"
              title="Lọc nhà cấp 3 nứt vừa"
            >
              Cấp 3: <strong>{stats.burlandGrade3}</strong>
            </button>
            <button
              type="button"
              onClick={() => onFilterClick?.('BURLAND', 'GRADE_1_2', 'Rủi ro Cấp 1-2 (Nhẹ)')}
              className="py-1 px-2 rounded-lg bg-slate-50 hover:bg-slate-100 border border-slate-200 text-slate-600 text-[11px] font-bold cursor-pointer transition-colors whitespace-nowrap shrink-0"
              title="Lọc nhà cấp 1-2"
            >
              Cấp 1-2: <strong>{stats.burlandGrade12}</strong>
            </button>
          </div>
        </div>

        {/* Card 3: Cảnh Báo Tắc Nghẽn Thẩm Định SLA */}
        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs hover:border-sky-300 transition-all flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-slate-500 mb-1.5">
              <span className="text-[11px] font-bold uppercase tracking-wider text-sky-700">Nghẽn Thẩm Định (SLA)</span>
              <Clock className="w-4 h-4 text-sky-600" />
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-black text-sky-700">{stats.submitted}</span>
              <span className="text-xs font-bold text-slate-600">hồ sơ chờ duyệt</span>
            </div>
            <p className="text-[11px] text-slate-500 mt-1">
              Thời gian cam kết thẩm định ≤ 48 giờ
            </p>
          </div>

          {/* Interactive SLA Breakdown */}
          <div className="pt-3 mt-3 border-t border-slate-100 flex items-center gap-1.5 overflow-x-auto no-scrollbar">
            <button
              type="button"
              onClick={() => onFilterClick?.('SLA', 'OVERDUE_48H', 'Tồn đọng quá 48h chưa duyệt (Khẩn cấp)')}
              className="flex-1 py-1 px-2 rounded-lg bg-red-50 hover:bg-red-100 border border-red-200 text-red-700 text-[11px] font-bold text-center cursor-pointer transition-colors whitespace-nowrap shrink-0"
              title="Hồ sơ đã nộp quá 48h chưa duyệt"
            >
              Quá 48h: <strong>{stats.slaOverdue48h}</strong>
            </button>
            <button
              type="button"
              onClick={() => onFilterClick?.('SLA', 'WARNING_24H', 'Tồn đọng 24h - 48h')}
              className="flex-1 py-1 px-2 rounded-lg bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-700 text-[11px] font-bold text-center cursor-pointer transition-colors whitespace-nowrap shrink-0"
              title="Hồ sơ nộp 24h-48h"
            >
              24h-48h: <strong>{stats.slaWarning24h}</strong>
            </button>
          </div>
        </div>

        {/* Card 4: Tình Trạng Vắng Mặt & Phối Hợp Địa Phương */}
        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-xs hover:border-purple-300 transition-all flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-slate-500 mb-1.5">
              <span className="text-[11px] font-bold uppercase tracking-wider text-purple-700">Vắng Mặt & Khó Tiếp Cận</span>
              <UserX className="w-4 h-4 text-purple-600" />
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-black text-purple-700">{stats.absent}</span>
              <span className="text-xs font-bold text-slate-600">thửa vắng chủ</span>
            </div>
            <p className="text-[11px] text-slate-500 mt-1">
              Cần phối hợp Ban Bồi thường / UBND Phường
            </p>
          </div>

          {/* Interactive Absenteeism Breakdown */}
          <div className="pt-3 mt-3 border-t border-slate-100 flex items-center gap-1.5 overflow-x-auto no-scrollbar">
            <button
              type="button"
              onClick={() => onFilterClick?.('STATUS', 'POSTPONED_ABSENT', 'Hồ sơ vắng chủ hộ')}
              className="flex-1 py-1 px-2 rounded-lg bg-purple-50 hover:bg-purple-100 border border-purple-200 text-purple-700 text-[11px] font-bold text-center cursor-pointer transition-colors whitespace-nowrap shrink-0"
              title="Tất cả hồ sơ vắng mặt"
            >
              Vắng 1-2 lần: <strong>{stats.absentAttempt1 + stats.absentAttempt2}</strong>
            </button>
            <button
              type="button"
              onClick={() => onFilterClick?.('ABSENT', 'ATTEMPT_3_PLUS', 'Vắng mặt quá 3 lần (Cần văn bản)')}
              className="py-1 px-2 rounded-lg bg-purple-100 hover:bg-purple-200 border border-purple-300 text-purple-900 text-[11px] font-bold cursor-pointer transition-colors whitespace-nowrap shrink-0"
              title="Vắng mặt ≥ 3 lần"
            >
              ≥ 3 lần: <strong>{stats.absentAttempt3Plus}</strong>
            </button>
            {stats.rejected > 0 && (
              <button
                type="button"
                onClick={() => onFilterClick?.('STATUS', 'REJECTED', 'Hồ sơ bị trả về')}
                className="py-1 px-2 rounded-lg bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-700 text-[11px] font-bold cursor-pointer transition-colors whitespace-nowrap shrink-0"
              >
                Trả về: {stats.rejected}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
