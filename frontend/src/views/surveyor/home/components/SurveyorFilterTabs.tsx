import React from 'react';
import { Search, HelpCircle } from 'lucide-react';

interface SurveyorFilterTabsProps {
  searchTerm: string;
  onSearchChange: (value: string) => void;
  statusFilter: string;
  onStatusFilterChange: (status: string) => void;
  counts: {
    total: number;
    approved: number;
    inProgressOnly: number;
    submittedOnly: number;
    rejectedOnly: number;
    absent: number;
    underConstruction: number;
    notSurveyed: number;
    pendingTotal: number;
    assignedToMe?: number;
  };
  filteredCount: number;
  showStatusHelp: boolean;
  onToggleStatusHelp: () => void;
}

export const SurveyorFilterTabs: React.FC<SurveyorFilterTabsProps> = ({
  searchTerm,
  onSearchChange,
  statusFilter,
  onStatusFilterChange,
  counts,
  filteredCount,
  showStatusHelp,
  onToggleStatusHelp,
}) => {
  const tabs = [
    ...(counts.assignedToMe !== undefined && counts.assignedToMe > 0
      ? [{ id: 'ASSIGNED_TO_ME', label: `🎯 Được giao (${counts.assignedToMe})` }]
      : []),
    { id: 'PENDING_ONLY', label: `Cần làm (${counts.pendingTotal})` },
    { id: 'NOT_SURVEYED', label: `Chưa làm (${counts.notSurveyed})` },
    { id: 'IN_PROGRESS', label: `Đang làm dở (${counts.inProgressOnly})` },
    { id: 'UNDER_CONSTRUCTION', label: `Đang xây (${counts.underConstruction})` },
    { id: 'SUBMITTED', label: `Chờ duyệt (${counts.submittedOnly})` },
    ...(counts.rejectedOnly > 0 ? [{ id: 'REJECTED', label: `Cần bổ sung (${counts.rejectedOnly})` }] : []),
    { id: 'ABSENT', label: `Vắng mặt (${counts.absent})` },
    { id: 'APPROVED', label: `Đã duyệt Phase 1 (${counts.approved})` },
    { id: 'ALL', label: `Tất cả (${counts.total})` },
  ];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
      {/* Search Input */}
      <div style={{ position: 'relative', width: '100%' }}>
        <Search
          size={16}
          color="#94a3b8"
          style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)' }}
        />
        <input
          type="text"
          className="form-control"
          style={{ paddingLeft: '2.4rem' }}
          placeholder="Tìm theo số nhà, tên đường, mã B-xxx, chủ hộ..."
          value={searchTerm}
          onChange={(e) => onSearchChange(e.target.value)}
        />
      </div>

      {/* Styled Filter Tabs */}
      <div style={{ display: 'flex', gap: '0.4rem', overflowX: 'auto', paddingBottom: '0.25rem' }}>
        {tabs.map((tab) => {
          const isActive = statusFilter === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onStatusFilterChange(tab.id)}
              style={{
                fontSize: '0.775rem',
                padding: '0.45rem 0.85rem',
                whiteSpace: 'nowrap',
                fontWeight: isActive ? 700 : 500,
                borderRadius: '999px',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
                border: isActive ? '1px solid #7dd3fc' : '1px solid #e2e8f0',
                background: isActive
                  ? 'linear-gradient(135deg, #e0f2fe 0%, #f0fdf4 100%)'
                  : '#ffffff',
                color: isActive ? '#0369a1' : '#475569',
                boxShadow: isActive ? '0 2px 4px rgba(2, 132, 199, 0.12)' : 'none',
              }}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Task List Header with (?) CIRCLE BUTTON */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: '0.15rem' }}>
        <span style={{ fontSize: '0.9rem', fontWeight: 800, color: '#0f172a' }}>
          {statusFilter === 'ASSIGNED_TO_ME'
            ? `Danh sách ${filteredCount} thửa đất được giao cho bạn:`
            : statusFilter === 'PENDING_ONLY'
            ? `Danh sách ${filteredCount} thửa đất cần khảo sát:`
            : statusFilter === 'APPROVED'
            ? `Danh sách ${filteredCount} thửa đất đã duyệt Phase 1:`
            : statusFilter === 'SUBMITTED'
            ? `Danh sách ${filteredCount} thửa đất đã nộp (Chờ duyệt):`
            : statusFilter === 'IN_PROGRESS'
            ? `Danh sách ${filteredCount} thửa đất đang làm dở (Chưa nộp):`
            : statusFilter === 'UNDER_CONSTRUCTION'
            ? `Danh sách ${filteredCount} thửa đất đang xây dựng:`
            : statusFilter === 'ABSENT'
            ? `Danh sách ${filteredCount} thửa đất vắng mặt:`
            : `Danh sách thửa đất (${filteredCount}):`}
        </span>

        {/* ONLY (?) CIRCLE BUTTON */}
        <button
          type="button"
          onClick={onToggleStatusHelp}
          style={{
            width: '28px',
            height: '28px',
            borderRadius: '50%',
            backgroundColor: showStatusHelp ? '#e0f2fe' : '#f1f5f9',
            border: '1px solid #cbd5e1',
            color: '#0284c7',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            transition: 'all 0.15s ease',
          }}
          title="Ý nghĩa các nút và trạng thái"
        >
          <HelpCircle size={16} />
        </button>
      </div>
    </div>
  );
};
