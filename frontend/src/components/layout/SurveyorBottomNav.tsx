import React from 'react';
import { Home, Map, FileText } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';

export type NavTab = 'home' | 'map' | 'attendance' | 'phase1' | 'phase2' | 'condo-master' | 'condo-unit' | 'admin-export';

interface Props {
  activeTab: NavTab;
  onChangeTab: (tab: NavTab) => void;
}

export const SurveyorBottomNav: React.FC<Props> = ({ activeTab, onChangeTab }) => {
  const { user } = useAuth();
  const isAdmin = user?.role === 'ZONE_ADMIN' || user?.role === 'SUPER_ADMIN';

  const tabs = [
    { id: 'home' as NavTab, title: 'Tổng quan danh sách thửa đất', icon: Home },
    { id: 'map' as NavTab, title: 'Bản đồ số GIS tuyến Metro 2', icon: Map },
    ...(isAdmin ? [{ 
      id: 'admin-export' as NavTab, 
      title: user?.role === 'SUPER_ADMIN' ? 'Trung Tâm Quản Trị Hệ Thống' : 'Dashboard Quản Trị Zone', 
      icon: FileText 
    }] : []),
  ];

  return (
    <nav
      style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 50,
        backgroundColor: 'rgba(255, 255, 255, 0.95)',
        borderTop: '1px solid #e2e8f0',
        display: 'flex',
        justifyContent: 'space-around',
        alignItems: 'center',
        boxSizing: 'border-box',
        paddingTop: '0.35rem',
        paddingBottom: 'calc(0.35rem + env(safe-area-inset-bottom, 0px))',
        paddingLeft: '0.75rem',
        paddingRight: '0.75rem',
        boxShadow: '0 -2px 10px rgba(0, 0, 0, 0.05)',
        backdropFilter: 'blur(10px)',
        WebkitBackdropFilter: 'blur(10px)',
        minHeight: 'calc(50px + env(safe-area-inset-bottom, 0px))',
        height: 'calc(50px + env(safe-area-inset-bottom, 0px))',
      }}
    >
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const isActive = activeTab === tab.id;

        return (
          <button
            key={tab.id}
            type="button"
            title={tab.title}
            aria-label={tab.title}
            onClick={() => onChangeTab(tab.id)}
            style={{
              background: isActive
                ? 'linear-gradient(135deg, #e0f2fe 0%, #dbeafe 100%)'
                : 'transparent',
              border: isActive ? '1px solid #7dd3fc' : 'none',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: isActive ? '#0284c7' : '#64748b',
              cursor: 'pointer',
              padding: '0.35rem 1.35rem',
              borderRadius: '9999px',
              transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
              boxShadow: isActive ? '0 2px 5px rgba(2, 132, 199, 0.15)' : 'none',
            }}
          >
            <Icon size={19} strokeWidth={isActive ? 2.5 : 1.8} />
          </button>
        );
      })}
    </nav>
  );
};
