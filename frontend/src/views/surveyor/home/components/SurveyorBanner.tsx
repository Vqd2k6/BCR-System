import React from 'react';
import {
  Clock,
  CheckCircle2,
  Target,
  Calendar,
  ArrowRight,
} from 'lucide-react';

interface SurveyorBannerProps {
  user: any;
  isCheckedInToday: boolean;
  checkInDetails?: { time: string; distance: number; status: string } | null;
  onNavigateToCheckIn: () => void;
  todayCompleted: number;
  todayTarget: number;
  weekCompleted: number;
  weekTarget: number;
}

export const SurveyorBanner: React.FC<SurveyorBannerProps> = ({
  user,
  isCheckedInToday,
  checkInDetails,
  onNavigateToCheckIn,
  todayCompleted,
  todayTarget,
  weekCompleted,
  weekTarget,
}) => {
  return (
    <>
      {/* 1. Header Zone Banner (Subtle indicator, check-in moved to Profile) */}
      <div
        className="card"
        style={{
          background: '#ffffff',
          border: '1px solid #e2e8f0',
          padding: '0.85rem 1.15rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '0.65rem',
        }}
      >
        <div>
          <div style={{ fontSize: '0.725rem', color: '#64748b', fontWeight: 600 }}>
            Tuyến Metro 2 Bến Thành – Tham Lương
          </div>
          <h2 style={{ margin: '2px 0 0 0', fontSize: '1.05rem', fontWeight: 800, color: '#0f172a' }}>
            Khu vực phụ trách:{' '}
            {user?.assignedZoneId === 'ZONE_S9' || user?.assignedZoneId === 'ZONE_ST09' || !user?.assignedZoneId
              ? 'Zone_ST09'
              : user.assignedZoneId.replace('ZONE_', 'Zone_').replace('S', 'ST0')}
          </h2>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '3px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '0.775rem', fontWeight: 700, color: '#334155' }}>
              {user?.fullName}
            </span>
            {user?.role === 'SURVEYOR' && (
              <span
                style={{
                  backgroundColor: '#e0f2fe',
                  color: '#0369a1',
                  fontSize: '0.675rem',
                  fontWeight: 800,
                  padding: '1px 6px',
                  borderRadius: '4px',
                  border: '1px solid #bae6fd',
                  fontFamily: 'monospace',
                }}
              >
                ID: {user?.surveyorCode || 'Chưa kích hoạt'}
              </span>
            )}
            {user?.phone && (
              <span style={{ fontSize: '0.725rem', color: '#64748b' }}>
                • SĐT: {user.phone}
              </span>
            )}
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          {isCheckedInToday ? (
            <div
              style={{
                fontSize: '0.75rem',
                color: '#166534',
                backgroundColor: '#f0fdf4',
                border: '1px solid #bbf7d0',
                padding: '0.3rem 0.65rem',
                borderRadius: '999px',
                display: 'flex',
                alignItems: 'center',
                gap: '0.35rem',
                fontWeight: 700,
              }}
            >
              <CheckCircle2 size={14} color="#16a34a" />
              <span>Đã chấm công ({checkInDetails?.time || '07:45'})</span>
            </div>
          ) : (
            <button
              type="button"
              onClick={onNavigateToCheckIn}
              style={{
                fontSize: '0.75rem',
                color: '#92400e',
                backgroundColor: '#fef3c7',
                border: '1px solid #fde68a',
                padding: '0.3rem 0.65rem',
                borderRadius: '999px',
                display: 'flex',
                alignItems: 'center',
                gap: '0.35rem',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              <Clock size={14} color="#d97706" />
              <span>Chưa chấm công GPS</span>
              <ArrowRight size={13} color="#d97706" />
            </button>
          )}
        </div>
      </div>

      {/* 2. Daily & Weekly Targets */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '0.75rem' }}>
        {/* Today */}
        <div className="card" style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#64748b', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <Target size={15} color="#0284c7" />
              Tiến độ hôm nay
            </span>
            <span className="badge badge-primary">
              {todayCompleted}/{todayTarget} căn ({Math.round((todayCompleted / todayTarget) * 100)}%)
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.35rem' }}>
            <span style={{ fontSize: '1.75rem', fontWeight: 800, color: '#0f172a' }}>{todayCompleted}</span>
            <span style={{ fontSize: '0.925rem', color: '#64748b' }}>/ {todayTarget} căn cần khảo sát</span>
          </div>

          <div style={{ width: '100%', height: '8px', backgroundColor: '#e2e8f0', borderRadius: '999px', overflow: 'hidden' }}>
            <div
              style={{
                width: `${(todayCompleted / todayTarget) * 100}%`,
                height: '100%',
                backgroundColor: '#0284c7',
                borderRadius: '999px',
              }}
            />
          </div>
          <div style={{ fontSize: '0.725rem', color: '#64748b' }}>
            Còn <strong>{todayTarget - todayCompleted} căn</strong> trong danh sách ca hôm nay
          </div>
        </div>

        {/* Weekly */}
        <div className="card" style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '0.8rem', fontWeight: 600, color: '#64748b', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              <Calendar size={15} color="#10b981" />
              Tiến độ tuần này
            </span>
            <span className="badge badge-success">
              {weekCompleted}/{weekTarget} căn ({Math.round((weekCompleted / weekTarget) * 100)}%)
            </span>
          </div>

          <div style={{ display: 'flex', alignItems: 'baseline', gap: '0.35rem' }}>
            <span style={{ fontSize: '1.75rem', fontWeight: 800, color: '#0f172a' }}>{weekCompleted}</span>
            <span style={{ fontSize: '0.925rem', color: '#64748b' }}>/ {weekTarget} căn toàn ga</span>
          </div>

          <div style={{ width: '100%', height: '8px', backgroundColor: '#e2e8f0', borderRadius: '999px', overflow: 'hidden' }}>
            <div
              style={{
                width: `${(weekCompleted / weekTarget) * 100}%`,
                height: '100%',
                backgroundColor: '#10b981',
                borderRadius: '999px',
              }}
            />
          </div>
          <div style={{ fontSize: '0.725rem', color: '#64748b' }}>
            Đã hoàn tất duyệt <strong>{weekCompleted} căn</strong>
          </div>
        </div>
      </div>
    </>
  );
};
