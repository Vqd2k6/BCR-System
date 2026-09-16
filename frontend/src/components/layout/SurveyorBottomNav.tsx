import React from 'react';
import { Home, Map, Clock, FileText, CheckSquare } from 'lucide-react';

export type NavTab = 'home' | 'map' | 'attendance' | 'phase1' | 'phase2';

interface Props {
  activeTab: NavTab;
  onChangeTab: (tab: NavTab) => void;
}

export const SurveyorBottomNav: React.FC<Props> = ({ activeTab, onChangeTab }) => {
  const tabs = [
    { id: 'home' as NavTab, label: 'Tổng quan', icon: Home },
    { id: 'map' as NavTab, label: 'Bản đồ GIS', icon: Map },
    { id: 'attendance' as NavTab, label: 'Điểm danh', icon: Clock },
    { id: 'phase1' as NavTab, label: 'Phase 1', icon: FileText },
    { id: 'phase2' as NavTab, label: 'Phase 2', icon: CheckSquare },
  ];

  return (
    <nav
      style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        zIndex: 50,
        background: 'rgba(15, 23, 42, 0.95)',
        backdropFilter: 'blur(16px)',
        borderTop: '1px solid rgba(255, 255, 255, 0.1)',
        display: 'flex',
        justifyContent: 'space-around',
        alignItems: 'center',
        padding: '0.4rem 0.5rem',
        boxShadow: '0 -4px 20px rgba(0, 0, 0, 0.4)',
      }}
    >
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const isActive = activeTab === tab.id;

        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onChangeTab(tab.id)}
            style={{
              background: 'transparent',
              border: 'none',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.2rem',
              color: isActive ? '#38bdf8' : '#94a3b8',
              cursor: 'pointer',
              padding: '0.35rem 0.75rem',
              borderRadius: '0.5rem',
              transition: 'all 0.15s ease',
              minWidth: '58px',
            }}
          >
            <Icon size={20} strokeWidth={isActive ? 2.5 : 1.8} />
            <span
              style={{
                fontSize: '0.7rem',
                fontWeight: isActive ? 700 : 500,
                letterSpacing: '0.01em',
              }}
            >
              {tab.label}
            </span>
          </button>
        );
      })}
    </nav>
  );
};
