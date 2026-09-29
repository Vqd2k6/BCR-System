import React from 'react';
import {
  Clock,
  CheckCircle2,
  ArrowRight,
} from 'lucide-react';
import { GisParcel } from '../../../../components/gis/LeafletSweepMap';
import { METRO_ZONE_CENTROIDS } from '../../../../core/utils/metroZoneUtils';
import { SurveyorWorkProgressCards } from './SurveyorWorkProgressCards';

interface SurveyorBannerProps {
  user: any;
  isCheckedInToday: boolean;
  checkInDetails?: { time: string; distance: number; status: string } | null;
  onNavigateToCheckIn: () => void;
  parcels: GisParcel[];
  onStartPhase1: (parcel: GisParcel, readOnly?: boolean) => void;
  todayCompleted?: number;
  todayTarget?: number;
  weekCompleted?: number;
  weekTarget?: number;
}

export const SurveyorBanner: React.FC<SurveyorBannerProps> = ({
  user,
  isCheckedInToday,
  checkInDetails,
  onNavigateToCheckIn,
  parcels,
  onStartPhase1,
  todayCompleted = 2,
  todayTarget = 5,
  weekCompleted = 8,
  weekTarget = 20,
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
            {(() => {
              const zoneId = (user?.assignedZoneId || 'ZONE_09').toUpperCase();
              const zoneInfo = METRO_ZONE_CENTROIDS[zoneId] || METRO_ZONE_CENTROIDS[zoneId.replace('ZONE_', 'ZONE_S')];
              const displayName = zoneId.replace('ZONE_', 'Zone_');
              return zoneInfo ? `${displayName} (${zoneInfo.zoneName.replace(/Zone\s*\d+:\s*/i, '')})` : displayName;
            })()}
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

      {/* 2. Cụm Thẻ Tiến Độ Công Việc Thực Tế (Tạm ẩn 2 ô tiến độ thanh mục tiêu theo yêu cầu) */}
      <SurveyorWorkProgressCards
        parcels={parcels}
        onStartPhase1={onStartPhase1}
      />
    </>
  );
};
