import React from 'react';
import { Clock, User, BadgeCheck } from 'lucide-react';
import type { CompanionRecord } from '../types';

interface CompanionHistoryListProps {
  companionHistory: CompanionRecord[];
}

export const CompanionHistoryList: React.FC<CompanionHistoryListProps> = ({ companionHistory }) => {
  return (
    <div style={{ marginTop: '0.5rem', borderTop: '1px solid #e2e8f0', paddingTop: '0.85rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', marginBottom: '0.65rem' }}>
        <Clock size={14} color="#0284c7" />
        <h3 style={{ margin: 0, fontSize: '0.85rem', fontWeight: 800, color: '#0f172a' }}>
          Lịch Sử Điểm Danh Cán Bộ Đi Kèm
        </h3>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        {companionHistory.length > 0 ? (
          companionHistory.map((item, idx) => {
            const dist = Math.round(item.distance ?? item.distance_meters ?? 0);
            const isItemOutOfBound = dist > 500 || item.status === 'FLAGGED_WARNING';
            const dateFormatted = item.checkin_time
              ? new Date(item.checkin_time).toLocaleString('vi-VN')
              : (item.date || 'Gần đây');

            return (
              <div
                key={item.id || idx}
                style={{
                  backgroundColor: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: '0.65rem',
                  padding: '0.65rem 0.85rem',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  gap: '0.65rem',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', minWidth: 0 }}>
                  {item.selfieUrl ? (
                    <img
                      src={item.selfieUrl}
                      alt={item.name}
                      style={{
                        width: '38px',
                        height: '38px',
                        borderRadius: '50%',
                        objectFit: 'cover',
                        border: '1.5px solid #bae6fd',
                        flexShrink: 0,
                      }}
                    />
                  ) : (
                    <div
                      style={{
                        width: '38px',
                        height: '38px',
                        borderRadius: '50%',
                        backgroundColor: '#e0f2fe',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: '#0284c7',
                        flexShrink: 0,
                      }}
                    >
                      <User size={18} />
                    </div>
                  )}

                  <div style={{ minWidth: 0 }}>
                    <div
                      style={{
                        fontSize: '0.8rem',
                        fontWeight: 800,
                        color: '#0f172a',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      {item.name}
                    </div>
                    <div style={{ fontSize: '0.7rem', color: '#0284c7', fontWeight: 600 }}>
                      {item.role || 'Cán bộ đi kèm'}
                    </div>
                    <div style={{ fontSize: '0.675rem', color: '#64748b' }}>
                      {dateFormatted} • Cách Ga: <strong>{dist}m</strong>
                      {isItemOutOfBound && <span style={{ color: '#ef4444', fontWeight: 600 }}> (Ngoài vùng)</span>}
                    </div>
                  </div>
                </div>

                <div style={{ flexShrink: 0 }}>
                  <span
                    style={{
                      fontSize: '0.65rem',
                      fontWeight: 700,
                      padding: '1px 6px',
                      borderRadius: '999px',
                      backgroundColor: isItemOutOfBound ? '#fef3c7' : '#dcfce7',
                      color: isItemOutOfBound ? '#b45309' : '#15803d',
                      border: `1px solid ${isItemOutOfBound ? '#fde68a' : '#86efac'}`,
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '2px',
                    }}
                  >
                    <BadgeCheck size={10} />
                    {isItemOutOfBound ? 'Ghi nhận' : 'Đã duyệt'}
                  </span>
                </div>
              </div>
            );
          })
        ) : (
          <div style={{ fontSize: '0.75rem', color: '#94a3b8', textAlign: 'center', padding: '0.85rem' }}>
            Chưa có lịch sử điểm danh cán bộ đi kèm nào.
          </div>
        )}
      </div>
    </div>
  );
};
