import React from 'react';
import {
  Bell,
  RefreshCw,
  Search,
  ShieldAlert,
  ChevronRight,
  ExternalLink,
  Layers,
} from 'lucide-react';

interface Props {
  title: string;
  subtitle?: string;
  selectedZone: string;
  criticalAlertCount?: number;
  isLoading?: boolean;
  onRefresh?: () => void;
  onAlertClick?: () => void;
}

export const ZoneAdminTopBar: React.FC<Props> = ({
  title,
  subtitle,
  selectedZone,
  criticalAlertCount = 0,
  isLoading = false,
  onRefresh,
  onAlertClick,
}) => {
  return (
    <header className="h-16 px-4 sm:px-6 bg-white border-b border-slate-200 flex items-center justify-between gap-4 shrink-0 shadow-xs z-20">
      {/* Breadcrumbs & Title */}
      <div className="flex items-center gap-2 overflow-hidden">
        <span className="text-xs font-bold text-slate-400 hidden sm:inline">Phân hệ Quản trị Zone</span>
        <ChevronRight size={14} className="text-slate-300 hidden sm:inline" />
        <div className="flex items-center gap-2 truncate">
          <h1 className="text-sm sm:text-base font-black text-slate-800 truncate">
            {title}
          </h1>
          <span className="px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-slate-100 text-slate-700 border border-slate-200 shrink-0">
            {selectedZone === 'ALL' ? 'Toàn tuyến' : selectedZone}
          </span>
        </div>
      </div>

      {/* Right Action Icons */}
      <div className="flex items-center gap-2 shrink-0">
        {/* Cờ cảnh báo khẩn nếu có */}
        {criticalAlertCount > 0 && (
          <button
            type="button"
            onClick={onAlertClick}
            className="px-2.5 py-1.5 rounded-xl bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer animate-in fade-in"
            title="Xem danh sách hồ sơ có cờ cảnh báo rủi ro"
          >
            <ShieldAlert className="w-3.5 h-3.5 text-red-600 animate-pulse" />
            <span className="hidden md:inline">{criticalAlertCount} Hồ sơ rủi ro cao</span>
            <span className="md:hidden">{criticalAlertCount}</span>
          </button>
        )}

        {/* Nút Làm mới */}
        {onRefresh && (
          <button
            type="button"
            onClick={onRefresh}
            disabled={isLoading}
            className="p-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-slate-900 transition-colors cursor-pointer"
            title="Làm mới số liệu"
          >
            <RefreshCw
              size={15}
              className={isLoading ? 'animate-spin text-emerald-600' : ''}
            />
          </button>
        )}
      </div>
    </header>
  );
};
