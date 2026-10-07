import React from 'react';
import {
  BarChart3,
  CheckCircle2,
  FileSpreadsheet,
  Map,
  List,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  Building,
  Layers,
  Sparkles,
  LogOut,
  User,
  ExternalLink,
} from 'lucide-react';
import { METRO_22_ZONES } from '../../../survey-phase1/constants/metroGisConstants';

export type ZoneNavView = 'dashboard' | 'review' | 'map' | 'parcels' | 'export';

interface Props {
  activeNav: ZoneNavView;
  onChangeNav: (nav: ZoneNavView) => void;
  selectedZone: string;
  onSelectZone: (zone: string) => void;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  pendingCount?: number;
  criticalCount?: number;
  userName?: string;
  userRole?: string;
  onLogout?: () => void;
}

export const ZoneAdminSidebar: React.FC<Props> = ({
  activeNav,
  onChangeNav,
  selectedZone,
  onSelectZone,
  isCollapsed,
  onToggleCollapse,
  pendingCount = 0,
  criticalCount = 0,
  userName = 'Zone Admin',
  userRole = 'ZONE_ADMIN',
  onLogout,
}) => {
  const readyZones = METRO_22_ZONES.filter((z) => z.isDataReady);

  const navItems = [
    {
      id: 'dashboard' as ZoneNavView,
      label: 'Chỉ Huy & Tiến Độ',
      icon: BarChart3,
      badge: null,
    },
    {
      id: 'review' as ZoneNavView,
      label: 'Hàng Đợi Thẩm Định',
      icon: CheckCircle2,
      badge: pendingCount > 0 ? pendingCount : null,
      badgeColor: 'bg-sky-500 text-white',
    },
    {
      id: 'map' as ZoneNavView,
      label: 'Bản Đồ Số GIS',
      icon: Map,
      badge: null,
    },
    {
      id: 'parcels' as ZoneNavView,
      label: 'Danh Sách Thửa Đất',
      icon: List,
      badge: null,
    },
    {
      id: 'export' as ZoneNavView,
      label: 'Xuất Báo Cáo Phase 1',
      icon: FileSpreadsheet,
      badge: 'Mẫu 0410',
      badgeColor: 'bg-amber-100 text-amber-900 border border-amber-300 font-mono',
    },
  ];

  return (
    <aside
      className={`relative flex flex-col bg-white text-slate-800 border-r border-slate-200/90 shadow-xs transition-all duration-300 shrink-0 z-30 select-none ${
        isCollapsed ? 'w-18' : 'w-64'
      }`}
    >
      {/* 1. Brand & Header */}
      <div className="h-16 px-4 flex items-center justify-between border-b border-slate-100">
        <div className="flex items-center gap-2.5 overflow-hidden">
          <div className="w-9 h-9 rounded-xl bg-indigo-600 flex items-center justify-center font-black text-white text-sm shadow-xs shrink-0">
            M2
          </div>
          {!isCollapsed && (
            <div className="truncate">
              <div className="text-xs font-black tracking-tight text-slate-900 flex items-center gap-1.5">
                <span>METRO 2</span>
                <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-indigo-50 text-indigo-700 border border-indigo-200">
                  ZONE
                </span>
              </div>
              <div className="text-[10px] text-slate-400 font-medium truncate">
                CRLG-CRSRI-TT Consortium
              </div>
            </div>
          )}
        </div>

        {/* Nút Thu gọn/Mở rộng */}
        <button
          type="button"
          onClick={onToggleCollapse}
          className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800 transition-colors cursor-pointer"
          title={isCollapsed ? 'Mở rộng thanh bên' : 'Thu gọn thanh bên'}
        >
          {isCollapsed ? <ChevronRight size={14} /> : <ChevronLeft size={14} />}
        </button>
      </div>

      {/* 2. Zone Selector (Dropdown khi mở rộng, Badge khi thu gọn) */}
      <div className="p-3 border-b border-slate-100 bg-slate-50/50">
        {isCollapsed ? (
          <div
            className="w-full text-center py-2 px-1 rounded-xl bg-white text-[10px] font-mono font-bold text-indigo-700 border border-slate-200 shadow-2xs truncate"
            title={`Phân khu: ${selectedZone}`}
          >
            {selectedZone === 'ALL' ? 'ALL' : selectedZone.replace('ZONE_', 'Z')}
          </div>
        ) : (
          <div className="space-y-1">
            <label className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
              Phân Khu Đang Quản Trị:
            </label>
            <select
              value={selectedZone}
              onChange={(e) => onSelectZone(e.target.value)}
              className="w-full rounded-xl bg-white border border-slate-200 px-3 py-2 text-xs font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 shadow-2xs cursor-pointer"
            >
              <option value="ALL">🌐 Toàn tuyến Metro 2 (1.227 thửa)</option>
              <optgroup label="⭐ Phân đoạn có dữ liệu">
                {readyZones.map((z) => (
                  <option key={z.code} value={z.code}>
                    {z.name} ({z.rawParcelCount} thửa)
                  </option>
                ))}
              </optgroup>
              <optgroup label="Tất cả 22 phân đoạn">
                {METRO_22_ZONES.map((z) => (
                  <option key={z.code} value={z.code}>
                    {z.name}
                  </option>
                ))}
              </optgroup>
            </select>
          </div>
        )}
      </div>

      {/* 3. Navigation List */}
      <nav className="flex-1 p-2.5 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeNav === item.id;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => onChangeNav(item.id)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-bold transition-all group cursor-pointer ${
                isActive
                  ? 'bg-indigo-50 text-indigo-700 font-bold border border-indigo-200/80 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/80 font-semibold'
              }`}
              title={isCollapsed ? item.label : undefined}
            >
              <Icon
                className={`w-4 h-4 shrink-0 transition-colors ${
                  isActive ? 'text-indigo-600' : 'text-slate-400 group-hover:text-slate-600'
                }`}
              />
              {!isCollapsed && (
                <div className="flex-1 flex items-center justify-between truncate">
                  <span className="truncate">{item.label}</span>
                  {item.badge !== null && item.badge !== undefined && (
                    <span
                      className={`text-[10px] px-2 py-0.5 rounded-full font-bold ml-2 shrink-0 ${
                        isActive
                          ? 'bg-indigo-600 text-white'
                          : item.badgeColor || 'bg-slate-100 text-slate-600 border border-slate-200'
                      }`}
                    >
                      {item.badge}
                    </span>
                  )}
                </div>
              )}
            </button>
          );
        })}
      </nav>

      {/* 4. Footer User Info & Logout */}
      <div className="p-3 border-t border-slate-100 bg-slate-50/70">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5 overflow-hidden">
            <div className="w-8 h-8 rounded-full bg-indigo-100 border border-indigo-200 text-indigo-700 flex items-center justify-center font-bold text-xs shrink-0">
              {userName.charAt(0)}
            </div>
            {!isCollapsed && (
              <div className="truncate">
                <div className="text-xs font-bold text-slate-800 truncate">{userName}</div>
                <div className="text-[10px] text-slate-500 font-mono truncate">{userRole}</div>
              </div>
            )}
          </div>

          {!isCollapsed && onLogout && (
            <button
              type="button"
              onClick={onLogout}
              className="p-1.5 rounded-lg text-slate-400 hover:text-red-600 hover:bg-red-50 transition-colors cursor-pointer"
              title="Đăng xuất"
            >
              <LogOut size={14} />
            </button>
          )}
        </div>
      </div>
    </aside>
  );
};
