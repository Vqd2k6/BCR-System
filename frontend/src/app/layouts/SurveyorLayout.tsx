import React from 'react';
import { Outlet } from 'react-router-dom';
import { SurveyorNavbar } from '../../components/layout/SurveyorNavbar';
import { SurveyorBottomNav, NavTab } from '../../components/layout/SurveyorBottomNav';

interface SurveyorLayoutProps {
  activeTab?: NavTab;
  onTabChange?: (tab: NavTab) => void;
  selectedZone?: string;
  onZoneChange?: (zone: string) => void;
  children?: React.ReactNode;
}

export const SurveyorLayout: React.FC<SurveyorLayoutProps> = ({
  activeTab = 'home',
  onTabChange,
  children,
}) => {
  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <SurveyorNavbar
        onNavigateHome={() => onTabChange && onTabChange('home')}
        onNavigateToCheckIn={() => onTabChange && onTabChange('attendance')}
      />

      <main className="flex-1 pb-16">
        {children || <Outlet />}
      </main>

      {onTabChange && (
        <SurveyorBottomNav
          activeTab={activeTab}
          onChangeTab={onTabChange}
        />
      )}
    </div>
  );
};
