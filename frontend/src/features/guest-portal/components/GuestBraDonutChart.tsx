import React from 'react';
import {
  type GuestBraStats,
  type BraRiskLevel,
  getBraColor,
} from '../utils/guestPortalHelpers';
import { ShieldAlert, Info } from 'lucide-react';

interface Props {
  stats: GuestBraStats;
  selectedRiskFilter: BraRiskLevel | 'ALL';
  onSelectRiskFilter: (risk: BraRiskLevel | 'ALL') => void;
}

export const GuestBraDonutChart: React.FC<Props> = ({
  stats,
  selectedRiskFilter,
  onSelectRiskFilter,
}) => {
  const total = stats.totalAssessed + stats.unassessed || 1;

  // Donut slices geometry
  const slices: { level: BraRiskLevel; count: number; label: string; color: string }[] = [
    { level: 'VERY_HIGH', count: stats.veryHigh, label: 'Rất cao (Cấp IV)', color: getBraColor('VERY_HIGH') },
    { level: 'HIGH', count: stats.high, label: 'Cao (Cấp III)', color: getBraColor('HIGH') },
    { level: 'MEDIUM', count: stats.medium, label: 'Trung bình (Cấp II)', color: getBraColor('MEDIUM') },
    { level: 'LOW', count: stats.low, label: 'Thấp (Cấp I)', color: getBraColor('LOW') },
    { level: 'UNASSESSED', count: stats.unassessed, label: 'Chưa đánh giá', color: getBraColor('UNASSESSED') },
  ];

  // Calculate SVG stroke-dasharray & stroke-dashoffset for circular donut
  const radius = 38;
  const circumference = 2 * Math.PI * radius;
  let accumulatedOffset = 0;

  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-xs space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-orange-50 text-orange-600 flex items-center justify-center border border-orange-100">
            <ShieldAlert size={16} />
          </div>
          <div>
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
              Phân Bổ Cấp Rủi Ro Cơ Sở (BRA Matrix)
            </h3>
            <p className="text-[11px] text-slate-500">
              Đánh giá tương tác kết cấu & cự ly hầm Metro 2 (4x4 Matrix)
            </p>
          </div>
        </div>

        {selectedRiskFilter !== 'ALL' && (
          <button
            type="button"
            onClick={() => onSelectRiskFilter('ALL')}
            className="text-[11px] font-bold text-sky-600 hover:text-sky-800 underline cursor-pointer"
          >
            Bỏ lọc rủi ro
          </button>
        )}
      </div>

      {/* Donut Chart & Legend Body */}
      <div className="flex flex-col sm:flex-row items-center gap-4 pt-1">
        {/* SVG Donut */}
        <div className="relative w-32 h-32 flex-shrink-0 flex items-center justify-center">
          <svg className="w-32 h-32 transform -rotate-90" viewBox="0 0 100 100">
            {/* Background ring */}
            <circle
              cx="50"
              cy="50"
              r={radius}
              className="text-slate-100"
              strokeWidth="14"
              stroke="currentColor"
              fill="transparent"
            />

            {/* Slices */}
            {slices.map((slice) => {
              if (slice.count === 0) return null;
              const sliceRatio = slice.count / total;
              const strokeDasharray = `${sliceRatio * circumference} ${circumference}`;
              const strokeDashoffset = -accumulatedOffset;
              accumulatedOffset += sliceRatio * circumference;

              const isSelected = selectedRiskFilter === slice.level;

              return (
                <circle
                  key={slice.level}
                  cx="50"
                  cy="50"
                  r={radius}
                  stroke={slice.color}
                  strokeWidth={isSelected ? '16' : '14'}
                  strokeDasharray={strokeDasharray}
                  strokeDashoffset={strokeDashoffset}
                  fill="transparent"
                  className="transition-all duration-300 cursor-pointer hover:opacity-85"
                  onClick={() =>
                    onSelectRiskFilter(selectedRiskFilter === slice.level ? 'ALL' : slice.level)
                  }
                />
              );
            })}
          </svg>

          {/* Center Label */}
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-center">
            <span className="text-sm font-black text-slate-800 font-mono">
              {stats.totalAssessed}
            </span>
            <span className="text-[9px] text-slate-400 font-semibold uppercase">Đã phân hạng</span>
          </div>
        </div>

        {/* Legend Slices List */}
        <div className="flex-1 w-full space-y-1.5">
          {slices.map((slice) => {
            const isSelected = selectedRiskFilter === slice.level;
            const pct = Math.round((slice.count / total) * 100);

            return (
              <button
                key={slice.level}
                type="button"
                onClick={() =>
                  onSelectRiskFilter(selectedRiskFilter === slice.level ? 'ALL' : slice.level)
                }
                className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg border text-left transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-slate-100/90 border-slate-400 ring-2 ring-slate-400/20 shadow-2xs font-bold'
                    : 'bg-white border-transparent hover:bg-slate-50'
                }`}
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span
                    className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                    style={{ backgroundColor: slice.color }}
                  />
                  <span className="text-xs text-slate-700 truncate">{slice.label}</span>
                </div>

                <div className="flex items-center gap-2 flex-shrink-0 font-mono text-xs">
                  <span className="font-bold text-slate-800">{slice.count}</span>
                  <span className="text-[10px] text-slate-400 w-8 text-right">({pct}%)</span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Info note */}
      <div className="flex items-center gap-1.5 p-2 rounded-xl bg-slate-50 border border-slate-100 text-[11px] text-slate-500">
        <Info size={12} className="text-slate-400 flex-shrink-0" />
        <span>Bấm vào một cấp rủi ro để lọc danh sách căn nhà bên dưới (Bản đồ GIS giữ nguyên toàn cảnh).</span>
      </div>
    </div>
  );
};
