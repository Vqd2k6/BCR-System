import React from 'react';
import {
  Clock,
  CheckCircle2,
  ArrowRight,
} from 'lucide-react';
import type { GisParcel } from '../../../../components/gis/LeafletSweepMap';
import { METRO_ZONE_CENTROIDS } from '../../../../core/utils/metroZoneUtils';
import { SurveyorWorkProgressCards } from './SurveyorWorkProgressCards';

import type { User } from '@/core/types/domain.types';

interface SurveyorBannerProps {
  user: User | null | undefined;
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
          background: 'rgb(var(--bg-white))',
          border: '1px solid rgb(var(--border-slate-200))',
          padding: '0.85rem 1.15rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '0.65rem',
        }}
      >
        <div>
          <div style={{ fontSize: '0.725rem', color: 'rgb(var(--text-slate-500))', fontWeight: 600 }}>
            Tuyến Metro 2 Bến Thành – Tham Lương
          </div>
          <h2 style={{ margin: '2px 0 0 0', fontSize: '1.05rem', fontWeight: 800, color: 'rgb(var(--text-slate-900))' }}>
            Khu vực phụ trách:{' '}
            {(() => {
              const zoneId = (user?.assignedZoneId || 'ZONE_09').toUpperCase();
              const zoneInfo = METRO_ZONE_CENTROIDS[zoneId] || METRO_ZONE_CENTROIDS[zoneId.replace('ZONE_', 'ZONE_S')];
              const displayName = zoneId.replace('ZONE_', 'Zone_');
              return zoneInfo ? `${displayName} (${zoneInfo.zoneName.replace(/Zone\s*\d+:\s*/i, '')})` : displayName;
            })()}
          </h2>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '3px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '0.775rem', fontWeight: 700, color: 'rgb(var(--text-slate-700))' }}>
              {user?.fullName}
            </span>
            {user?.role === 'SURVEYOR' && (
              <span
                style={{
                  backgroundColor: 'rgb(var(--bg-sky-100))',
                  color: 'rgb(var(--text-sky-700))',
                  fontSize: '0.675rem',
                  fontWeight: 800,
                  padding: '1px 6px',
                  borderRadius: '4px',
                  border: '1px solid rgb(var(--border-sky-200))',
                  fontFamily: 'monospace',
                }}
              >
                ID: {user?.surveyorCode || 'Chưa kích hoạt'}
              </span>
            )}
            {user?.phone && (
              <span style={{ fontSize: '0.725rem', color: 'rgb(var(--text-slate-500))' }}>
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
                color: 'rgb(var(--text-green-800))',
                backgroundColor: 'rgb(var(--bg-green-50))',
                border: '1px solid rgb(var(--border-green-200))',
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
                color: 'rgb(var(--text-amber-800))',
                backgroundColor: 'rgb(var(--bg-amber-100))',
                border: '1px solid rgb(var(--border-amber-200))',
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
        currentUser={user}
      />
    </>
  );
};
