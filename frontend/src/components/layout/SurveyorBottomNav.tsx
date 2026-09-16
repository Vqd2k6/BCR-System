import React from 'react';
import { Home, Map, Clock } from 'lucide-react';

export type NavTab = 'home' | 'map' | 'attendance' | 'phase1' | 'phase2';

interface Props {
  activeTab: NavTab;
  onChangeTab: (tab: NavTab) => void;
}

export const SurveyorBottomNav: React.FC<Props> = ({ activeTab, onChangeTab }) => {
  const tabs = [
    { id: 'home' as NavTab, title: 'Tổng quan danh sách thửa đất', icon: Home },
    { id: 'map' as NavTab, title: 'Bản đồ số GIS tuyến Metro 2', icon: Map },
    { id: 'attendance' as NavTab, title: 'Điểm danh GPS thực địa', icon: Clock },
  ];

  return (
    <nav
      style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 50,
        backgroundColor: '#ffffff',
        borderTop: '1px solid #e2e8f0',
        display: 'flex',
        justifyContent: 'space-around',
        alignItems: 'center',
        padding: '0.5rem 1rem calc(0.5rem + env(safe-area-inset-bottom)) 1rem',
        boxShadow: '0 -2px 12px rgba(0, 0, 0, 0.06)',
        backdropFilter: 'blur(8px)',
        height: '52px',
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
              padding: '0.55rem 1.75rem',
              borderRadius: '9999px',
              transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
              boxShadow: isActive ? '0 2px 6px rgba(2, 132, 199, 0.15)' : 'none',
            }}
          >
            <Icon size={22} strokeWidth={isActive ? 2.5 : 1.8} />
          </button>
        );
      })}
    </nav>
  );
};
