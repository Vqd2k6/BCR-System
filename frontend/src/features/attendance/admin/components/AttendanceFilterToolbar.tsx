import React from 'react';
import { Search, Zap, RefreshCw } from 'lucide-react';
import type { AttendanceFilterState, DatePreset, PersonFilter } from '../hooks/useAdminAttendanceAudit';
import type { AttendanceAnomalyFilter, AttendanceVerificationStatus } from '../../types/admin.types';
import { ANOMALY_LABEL, STATUS_LABEL } from './AttendanceBadges';

interface Props {
  filters: AttendanceFilterState;
  onChange: (patch: Partial<AttendanceFilterState>) => void;
  onRefresh: () => void;
  onQuickApprove: () => void;
  isLoading: boolean;
  isBatchRunning: boolean;
}

const PRESETS: Array<{ key: DatePreset; label: string }> = [
  { key: 'today', label: 'Hôm nay' },
  { key: 'yesterday', label: 'Hôm qua' },
  { key: '7d', label: '7 ngày qua' },
  { key: 'month', label: 'Tháng này' },
  { key: 'custom', label: 'Tùy chọn' },
];

const PERSONS: Array<{ key: PersonFilter; label: string }> = [
  { key: 'all', label: 'Tất cả' },
  { key: 'main', label: 'KSV chính' },
  { key: 'companion', label: 'Người đi kèm' },
];

const selectClass =
  'px-2.5 py-1.5 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-700 cursor-pointer';

export const AttendanceFilterToolbar: React.FC<Props> = ({
  filters,
  onChange,
  onRefresh,
  onQuickApprove,
  isLoading,
  isBatchRunning,
}) => (
  <div className="p-3 rounded-2xl bg-white border border-slate-200 space-y-3">
    <div className="flex flex-wrap items-center gap-2">
      <div className="flex items-center gap-1 p-1 rounded-xl bg-slate-100">
        {PRESETS.map((p) => (
          <button
            key={p.key}
            type="button"
            onClick={() => onChange({ preset: p.key })}
            className={`px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
              filters.preset === p.key ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>
      {filters.preset === 'custom' && (
        <div className="flex items-center gap-1.5 text-xs text-slate-500">
          <input
            type="date"
            value={filters.fromDate}
            max={filters.toDate}
            onChange={(e) => onChange({ fromDate: e.target.value })}
            className="px-2 py-1 rounded-lg border border-slate-200 text-xs"
          />
          <span>→</span>
          <input
            type="date"
            value={filters.toDate}
            min={filters.fromDate}
            onChange={(e) => onChange({ toDate: e.target.value })}
            className="px-2 py-1 rounded-lg border border-slate-200 text-xs"
          />
        </div>
      )}
      <div className="flex items-center gap-1 p-1 rounded-xl bg-slate-100">
        {PERSONS.map((p) => (
          <button
            key={p.key}
            type="button"
            onClick={() => onChange({ person: p.key })}
            className={`px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer ${
              filters.person === p.key ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-500 hover:text-slate-800'
            }`}
          >
            {p.label}
          </button>
        ))}
      </div>
    </div>

    <div className="flex flex-wrap items-center gap-2">
      <select
        value={filters.status}
        onChange={(e) => onChange({ status: e.target.value as AttendanceVerificationStatus | '' })}
        className={selectClass}
      >
        <option value="">Mọi trạng thái</option>
        {(Object.keys(STATUS_LABEL) as AttendanceVerificationStatus[]).map((s) => (
          <option key={s} value={s}>
            {STATUS_LABEL[s]}
          </option>
        ))}
      </select>
      <select
        value={filters.anomaly}
        onChange={(e) => onChange({ anomaly: e.target.value as AttendanceAnomalyFilter | '' })}
        className={selectClass}
      >
        <option value="">Mọi cảnh báo</option>
        <option value="ANY">Có cảnh báo bất kỳ</option>
        <option value="NONE">Không cảnh báo</option>
        {(Object.keys(ANOMALY_LABEL) as Array<keyof typeof ANOMALY_LABEL>).map((c) => (
          <option key={c} value={c}>
            {ANOMALY_LABEL[c]}
          </option>
        ))}
      </select>
      <div className="relative flex-1 min-w-[180px]">
        <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          type="search"
          value={filters.search}
          onChange={(e) => onChange({ search: e.target.value })}
          placeholder="Tìm tên / mã KSV, tên hoặc SĐT người đi kèm…"
          className="w-full pl-8 pr-3 py-1.5 rounded-xl border border-slate-200 text-xs"
        />
      </div>
      <button
        type="button"
        onClick={onRefresh}
        disabled={isLoading}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 bg-white text-xs font-bold text-slate-700 hover:bg-slate-50 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <RefreshCw size={13} className={isLoading ? 'animate-spin' : ''} /> Làm mới
      </button>
      <button
        type="button"
        onClick={onQuickApprove}
        disabled={isBatchRunning}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
        title="Server tự chọn các ca sạch hoàn toàn trong bộ lọc ngày / nhân sự / tìm kiếm hiện tại"
      >
        <Zap size={13} /> Duyệt nhanh ca hợp lệ
      </button>
    </div>
  </div>
);
