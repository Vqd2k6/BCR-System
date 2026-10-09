import React, { useState, useEffect } from 'react';
import {
  ZoneAdminSidebar,
  type ZoneNavView,
} from './ZoneAdminSidebar';
import { ZoneAdminTopBar } from './ZoneAdminTopBar';
import { useAuth } from '../../../../context/AuthContext';

interface Props {
  activeNav: ZoneNavView;
  onChangeNav: (nav: ZoneNavView) => void;
  selectedZone: string;
  onSelectZone: (zone: string) => void;
  pendingCount?: number;
  criticalAlertCount?: number;
  isLoading?: boolean;
  onRefresh?: () => void;
  children: React.ReactNode;
}

export const ZoneAdminAppShell: React.FC<Props> = ({
  activeNav,
  onChangeNav,
  selectedZone,
  onSelectZone,
  pendingCount = 0,
  criticalAlertCount = 0,
  isLoading = false,
  onRefresh,
  children,
}) => {
  const { user, logout } = useAuth();

  const [isCollapsed, setIsCollapsed] = useState<boolean>(() => {
    try {
      return localStorage.getItem('metro2_zone_admin_sidebar_collapsed') === 'true';
    } catch {
      return false;
    }
  });

  const toggleCollapse = () => {
    setIsCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('metro2_zone_admin_sidebar_collapsed', String(next));
      } catch {}
      return next;
    });
  };

  const getPageTitle = (nav: ZoneNavView) => {
    switch (nav) {
      case 'dashboard':
        return 'Dashboard Chỉ Huy & Tiến Độ';
      case 'review':
        return 'Hàng Đợi Thẩm Định & Phê Duyệt Hồ Sơ';
      case 'map':
        return 'Bản Đồ Số Không Gian GIS Tuyến';
      case 'parcels':
        return 'Danh Sách Thửa Đất & Địa Chính';
      case 'export':
        return 'Phân Hệ Xuất Báo Cáo Phase 1 (Mẫu 0410 Song Ngữ)';
      default:
        return 'Dashboard Trưởng Zone';
    }
  };

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-slate-100 text-slate-900">
      {/* 1. Left Sidebar */}
      <ZoneAdminSidebar
        activeNav={activeNav}
        onChangeNav={onChangeNav}
        selectedZone={selectedZone}
        onSelectZone={onSelectZone}
        isCollapsed={isCollapsed}
        onToggleCollapse={toggleCollapse}
        pendingCount={pendingCount}
        criticalCount={criticalAlertCount}
        userName={user?.fullName || 'Zone Admin'}
        userRole={user?.role || 'ZONE_ADMIN'}
        onLogout={logout}
      />

      {/* 2. Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
        {/* Top Action Bar */}
        <ZoneAdminTopBar
          title={getPageTitle(activeNav)}
          selectedZone={selectedZone}
          criticalAlertCount={criticalAlertCount}
          isLoading={isLoading}
          onRefresh={onRefresh}
          onAlertClick={() => onChangeNav('review')}
        />

        {/* Scrollable Viewport */}
        <main
          className={`flex-1 min-h-0 bg-slate-50/70 ${
            activeNav === 'map'
              ? 'overflow-hidden p-0'
              : 'overflow-y-auto px-4 py-5 sm:px-6 sm:py-6 2xl:px-8 2xl:py-8'
          }`}
        >
          {activeNav === 'map' ? (
            <div className="w-full h-full relative">
              {children}
            </div>
          ) : (
            <div className="w-full max-w-[1920px] mx-auto space-y-6">
              {children}
            </div>
          )}
        </main>
      </div>
    </div>
  );
};
