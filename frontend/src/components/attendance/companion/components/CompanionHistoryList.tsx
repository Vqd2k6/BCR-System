import React from 'react';
import { Clock, User, BadgeCheck } from 'lucide-react';
import type { CompanionRecord } from '../types';

interface CompanionHistoryListProps {
  companionHistory: CompanionRecord[];
}

export const CompanionHistoryList: React.FC<CompanionHistoryListProps> = ({ companionHistory }) => {
  return (
    <div style={{ marginTop: '0.5rem', borderTop: '1px solid rgb(var(--border-slate-200))', paddingTop: '0.85rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', marginBottom: '0.65rem' }}>
        <Clock size={14} color="#0284c7" />
        <h3 style={{ margin: 0, fontSize: '0.85rem', fontWeight: 800, color: 'rgb(var(--text-slate-900))' }}>
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
                  backgroundColor: 'rgb(var(--bg-slate-50))',
                  border: '1px solid rgb(var(--border-slate-200))',
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
                        border: '1.5px solid rgb(var(--border-sky-200))',
                        flexShrink: 0,
                      }}
                    />
                  ) : (
                    <div
                      style={{
                        width: '38px',
                        height: '38px',
                        borderRadius: '50%',
                        backgroundColor: 'rgb(var(--bg-sky-100))',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'rgb(var(--text-sky-600))',
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
                        color: 'rgb(var(--text-slate-900))',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      {item.name}
                    </div>
                    <div style={{ fontSize: '0.7rem', color: 'rgb(var(--text-sky-600))', fontWeight: 600 }}>
                      {item.role || 'Cán bộ đi kèm'}
                    </div>
                    <div style={{ fontSize: '0.675rem', color: 'rgb(var(--text-slate-500))' }}>
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
                      backgroundColor: isItemOutOfBound ? 'rgb(var(--bg-amber-100))' : 'rgb(var(--bg-green-100))',
                      color: isItemOutOfBound ? 'rgb(var(--text-amber-700))' : 'rgb(var(--text-green-700))',
                      border: `1px solid ${isItemOutOfBound ? 'rgb(var(--border-amber-200))' : 'rgb(var(--border-green-300))'}`,
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
