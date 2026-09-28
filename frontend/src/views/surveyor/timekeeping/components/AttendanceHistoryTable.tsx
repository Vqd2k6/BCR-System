import React from 'react';
import {
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Clock,
  User,
  BadgeCheck,
} from 'lucide-react';

interface AttendanceHistoryTableProps {
  historyTab: 'surveyor' | 'companion';
  setHistoryTab: (tab: 'surveyor' | 'companion') => void;
  history: any[];
  companionHistory: any[];
  user: any;
}

export const AttendanceHistoryTable: React.FC<AttendanceHistoryTableProps> = ({
  historyTab,
  setHistoryTab,
  history,
  companionHistory,
  user,
}) => {
  return (
    <div style={{ marginTop: '0.5rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
        <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 800, color: '#0f172a' }}>
          Lịch sử điểm danh thực địa
        </h3>

        {/* Toggle Tab between Surveyor and Companion */}
        <div style={{ display: 'flex', backgroundColor: '#f1f5f9', padding: '2px', borderRadius: '0.5rem', border: '1px solid #e2e8f0' }}>
          <button
            type="button"
            onClick={() => setHistoryTab('surveyor')}
            style={{
              border: 'none',
              backgroundColor: historyTab === 'surveyor' ? '#ffffff' : 'transparent',
              color: historyTab === 'surveyor' ? '#0284c7' : '#64748b',
              fontWeight: 700,
              fontSize: '0.725rem',
              padding: '0.3rem 0.65rem',
              borderRadius: '0.35rem',
              cursor: 'pointer',
              boxShadow: historyTab === 'surveyor' ? '0 1px 2px rgba(0,0,0,0.08)' : 'none',
            }}
          >
            Điều tra viên chính
          </button>
          <button
            type="button"
            onClick={() => setHistoryTab('companion')}
            style={{
              border: 'none',
              backgroundColor: historyTab === 'companion' ? '#ffffff' : 'transparent',
              color: historyTab === 'companion' ? '#0284c7' : '#64748b',
              fontWeight: 700,
              fontSize: '0.725rem',
              padding: '0.3rem 0.65rem',
              borderRadius: '0.35rem',
              cursor: 'pointer',
              boxShadow: historyTab === 'companion' ? '0 1px 2px rgba(0,0,0,0.08)' : 'none',
            }}
          >
            Cán bộ đi kèm ({companionHistory.length})
          </button>
        </div>
      </div>

      {/* TAB 1: SURVEYOR'S OWN HISTORY */}
      {historyTab === 'surveyor' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {history.map((h, i) => {
            const distance = Math.round(h.distance_to_zone_center_meters ?? h.distance_meters ?? 0);
            const isOutOfBoundItem = distance > 500 || h.is_out_of_bounds || !h.is_within_zone_boundary;
            const photo = h.selfie_photo_url || h.photo_selfie_url || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=300';
            const status = h.verification_status;

            return (
              <div
                key={h.id || i}
                className="card"
                style={{
                  backgroundColor: '#ffffff',
                  padding: '0.75rem 1rem',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  borderRadius: '0.75rem',
                  boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)',
                  gap: '0.75rem',
                  border: '1px solid #e2e8f0',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', minWidth: 0, flex: 1 }}>
                  <img
                    src={photo}
                    alt="Selfie Record"
                    style={{
                      width: '44px',
                      height: '44px',
                      borderRadius: '50%',
                      objectFit: 'cover',
                      border: '1.5px solid #bae6fd',
                      flexShrink: 0,
                    }}
                  />
                  <div style={{ minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                      <span style={{ fontSize: '0.85rem', fontWeight: 800, color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                        {user?.fullName || 'Nguyễn Văn Khảo Sát'}
                      </span>
                      <span style={{ fontSize: '0.65rem', fontWeight: 700, backgroundColor: '#e0f2fe', color: '#0369a1', padding: '1px 5px', borderRadius: '4px' }}>
                        Chính
                      </span>
                    </div>
                    <div style={{ fontSize: '0.725rem', color: '#64748b', marginTop: '2px' }}>
                      {new Date(h.checkin_time).toLocaleString('vi-VN')} • Cách Ga: <strong>{distance}m</strong>
                      {isOutOfBoundItem && <span style={{ color: '#ef4444', fontWeight: 600 }}> (Ngoài vùng)</span>}
                    </div>
                  </div>
                </div>

                <div style={{ flexShrink: 0 }}>
                  {status === 'APPROVED' || status === 'VERIFIED' ? (
                    <span className="badge badge-success" style={{ whiteSpace: 'nowrap', display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                      <CheckCircle2 size={12} />
                      Đã duyệt
                    </span>
                  ) : status === 'FLAGGED_WARNING' || status === 'FLAGGED' ? (
                    <span className="badge badge-danger" style={{ whiteSpace: 'nowrap', display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                      <AlertTriangle size={12} />
                      Gắn cờ
                    </span>
                  ) : status === 'REJECTED' ? (
                    <span className="badge badge-danger" style={{ whiteSpace: 'nowrap', display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                      <XCircle size={12} />
                      Từ chối
                    </span>
                  ) : (
                    <span className="badge badge-warning" style={{ whiteSpace: 'nowrap', display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                      <Clock size={12} />
                      Chờ duyệt
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* TAB 2: CO-SURVEYOR'S HISTORY */}
      {historyTab === 'companion' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {companionHistory.length > 0 ? (
            companionHistory.map((comp, idx) => {
              const dist = Math.round(comp.distance ?? comp.distance_meters ?? 0);
              const isItemOutOfBound = dist > 500 || comp.status === 'FLAGGED_WARNING';
              const timeStr = comp.checkin_time ? new Date(comp.checkin_time).toLocaleString('vi-VN') : (comp.date || 'Gần đây');

              return (
                <div
                  key={comp.id || idx}
                  className="card"
                  style={{
                    backgroundColor: '#ffffff',
                    padding: '0.75rem 1rem',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    borderRadius: '0.75rem',
                    boxShadow: '0 1px 3px rgba(0, 0, 0, 0.05)',
                    gap: '0.75rem',
                    border: '1px solid #bae6fd',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', minWidth: 0, flex: 1 }}>
                    {comp.selfieUrl ? (
                      <img
                        src={comp.selfieUrl}
                        alt={comp.name}
                        style={{
                          width: '44px',
                          height: '44px',
                          borderRadius: '50%',
                          objectFit: 'cover',
                          border: '1.5px solid #7dd3fc',
                          flexShrink: 0,
                        }}
                      />
                    ) : (
                      <div
                        style={{
                          width: '44px',
                          height: '44px',
                          borderRadius: '50%',
                          backgroundColor: '#e0f2fe',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: '#0284c7',
                          flexShrink: 0,
                        }}
                      >
                        <User size={22} />
                      </div>
                    )}

                    <div style={{ minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                        <span style={{ fontSize: '0.85rem', fontWeight: 800, color: '#0f172a', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {comp.name}
                        </span>
                        <span style={{ fontSize: '0.65rem', fontWeight: 700, backgroundColor: '#f0f9ff', color: '#0284c7', padding: '1px 5px', borderRadius: '4px', border: '1px solid #bae6fd' }}>
                          Đi kèm
                        </span>
                      </div>
                      <div style={{ fontSize: '0.725rem', color: '#0284c7', fontWeight: 600 }}>
                        {comp.role || 'Cán bộ đo đạc & Ghi chép'}
                      </div>
                      <div style={{ fontSize: '0.7rem', color: '#64748b' }}>
                        {timeStr} • Cách Ga: <strong>{dist}m</strong>
                        {isItemOutOfBound && <span style={{ color: '#ef4444', fontWeight: 600 }}> (Ngoài vùng)</span>}
                      </div>
                    </div>
                  </div>

                  <div style={{ flexShrink: 0 }}>
                    <span
                      className={`badge ${isItemOutOfBound ? 'badge-warning' : 'badge-success'}`}
                      style={{ whiteSpace: 'nowrap', display: 'inline-flex', alignItems: 'center', gap: '3px', fontSize: '0.7rem' }}
                    >
                      <BadgeCheck size={11} />
                      {isItemOutOfBound ? 'Ghi nhận' : 'Đã duyệt'}
                    </span>
                  </div>
                </div>
              );
            })
          ) : (
            <div style={{ fontSize: '0.8rem', color: '#94a3b8', textAlign: 'center', padding: '1.5rem', backgroundColor: '#ffffff', borderRadius: '0.75rem', border: '1px dashed #cbd5e1' }}>
              Chưa có lịch sử điểm danh cán bộ đi kèm nào.
            </div>
          )}
        </div>
      )}
    </div>
  );
};
