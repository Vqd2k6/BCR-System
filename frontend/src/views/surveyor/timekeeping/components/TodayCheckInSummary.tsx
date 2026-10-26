import React from 'react';
import {
  ShieldCheck,
  Camera,
  User,
  AlertTriangle,
  CheckCircle2,
  Users,
  UserCheck,
} from 'lucide-react';
import {
  resolveAttendancePhotoUrl,
  type MetroZoneCentroid,
} from '../../../../core/utils/metroZoneUtils';

import type { User as DomainUser } from '../../../../core/types/domain.types';
import type { CheckInDetails, CompanionRecord } from '../types';

interface TodayCheckInSummaryProps {
  checkInDetails: CheckInDetails | null;
  distanceMeters: number;
  targetZone: MetroZoneCentroid;
  gpsCoordinates: { lat: number; lng: number; accuracy: number } | null;
  selfieUrl: string;
  user: DomainUser | null;
  outOfBoundsReason: string;
  isCompanionCheckedIn: boolean;
  companionData: CompanionRecord | null;
  setShowCompanionModal: (show: boolean) => void;
}

export const TodayCheckInSummary: React.FC<TodayCheckInSummaryProps> = ({
  checkInDetails,
  distanceMeters,
  targetZone,
  gpsCoordinates,
  selfieUrl,
  user,
  outOfBoundsReason,
  isCompanionCheckedIn,
  companionData,
  setShowCompanionModal,
}) => {
  const displaySelfieUrl = resolveAttendancePhotoUrl(selfieUrl || checkInDetails?.selfiePhotoUrl);
  const displayCompanionSelfieUrl = resolveAttendancePhotoUrl(companionData?.selfieUrl);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      {/* Verified Header Banner */}
      <div
        className="card"
        style={{
          background: 'linear-gradient(135deg, rgb(var(--bg-green-50)) 0%, rgb(var(--bg-green-100)) 100%)',
          border: '1.5px solid rgb(var(--border-green-300))',
          borderRadius: '1rem',
          padding: '1.15rem',
          display: 'flex',
          alignItems: 'flex-start',
          gap: '0.85rem',
          boxShadow: '0 2px 8px rgba(22, 163, 74, 0.12)',
        }}
      >
        <div
          style={{
            width: '42px',
            height: '42px',
            borderRadius: '10px',
            backgroundColor: 'rgb(var(--bg-green-200))',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            color: 'rgb(var(--text-green-700))',
          }}
        >
          <ShieldCheck size={24} />
        </div>

        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
            <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 800, color: 'rgb(var(--text-green-900))' }}>
              ĐÃ ĐIỂM DANH THỰC ĐỊA HÔM NAY
            </h3>
            <span
              style={{
                backgroundColor: distanceMeters > 500 ? 'rgb(var(--bg-amber-100))' : 'rgb(var(--bg-green-100))',
                color: distanceMeters > 500 ? 'rgb(var(--text-amber-700))' : 'rgb(var(--text-green-700))',
                border: `1px solid ${distanceMeters > 500 ? 'rgb(var(--border-amber-200))' : 'rgb(var(--border-green-300))'}`,
                borderRadius: '999px',
                padding: '2px 8px',
                fontSize: '0.7rem',
                fontWeight: 700,
              }}
            >
              {distanceMeters > 500 ? 'Cảnh báo vị trí (>500m)' : 'Vị trí hợp lệ'}
            </span>
          </div>

          <div style={{ marginTop: '0.45rem', fontSize: '0.775rem', color: 'rgb(var(--text-green-800))', display: 'flex', flexWrap: 'wrap', gap: '0.75rem' }}>
            <span>
              Thời gian: <strong>{checkInDetails?.time || 'Hôm nay'}</strong>
            </span>
            <span>
              Khoảng cách: <strong>{distanceMeters}m</strong> tới {targetZone.zoneName}
            </span>
            {gpsCoordinates && (
              <span>
                GPS: <strong>{gpsCoordinates.lat.toFixed(5)}, {gpsCoordinates.lng.toFixed(5)}</strong>
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Real Photo & Verification Details Card */}
      <div
        className="card"
        style={{
          backgroundColor: 'rgb(var(--bg-white))',
          border: '1px solid rgb(var(--border-slate-200))',
          borderRadius: '1rem',
          padding: '1.15rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '1rem',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <Camera size={16} color="#0284c7" />
          <span style={{ fontWeight: 700, fontSize: '0.9rem', color: 'rgb(var(--text-slate-900))' }}>
            Ảnh Selfie Xác Thực Đã Chụp Hôm Nay
          </span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'row', flexWrap: 'wrap', gap: '1rem', alignItems: 'center' }}>
          {displaySelfieUrl ? (
            <img
              src={displaySelfieUrl}
              alt="Surveyor Selfie"
              style={{
                width: '130px',
                height: '160px',
                borderRadius: '0.75rem',
                objectFit: 'cover',
                border: '2px solid rgb(var(--border-sky-300))',
                boxShadow: '0 4px 10px rgba(2, 132, 199, 0.15)',
                flexShrink: 0,
              }}
            />
          ) : (
            <div
              style={{
                width: '130px',
                height: '160px',
                borderRadius: '0.75rem',
                backgroundColor: 'rgb(var(--bg-slate-50))',
                border: '2px dashed rgb(var(--border-slate-300))',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'rgb(var(--text-slate-400))',
                flexShrink: 0,
              }}
            >
              <User size={36} />
              <span style={{ fontSize: '0.7rem', marginTop: '4px', fontWeight: 600 }}>Ảnh selfie</span>
            </div>
          )}

          <div style={{ flex: 1, width: '100%', display: 'flex', flexDirection: 'column', gap: '0.5rem', fontSize: '0.8rem' }}>
            <div style={{ paddingBottom: '0.5rem', borderBottom: '1px solid rgb(var(--border-slate-100))' }}>
              <span style={{ color: 'rgb(var(--text-slate-400))', fontSize: '0.725rem', display: 'block' }}>Điều tra viên chính:</span>
              <span style={{ fontSize: '0.95rem', fontWeight: 800, color: 'rgb(var(--text-slate-900))' }}>
                {user?.fullName || 'Khảo Sát Viên'}
              </span>
              <span style={{ color: 'rgb(var(--text-slate-500))', fontSize: '0.75rem', display: 'block', marginTop: '2px' }}>
                Khu vực: <strong>{targetZone.zoneName}</strong>
              </span>
            </div>

            {outOfBoundsReason ? (
              <div
                style={{
                  backgroundColor: 'rgb(var(--bg-amber-50))',
                  border: '1px solid rgb(var(--border-amber-200))',
                  borderRadius: '0.65rem',
                  padding: '0.65rem 0.75rem',
                  color: 'rgb(var(--text-amber-800))',
                }}
              >
                <div style={{ fontWeight: 700, fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.35rem', marginBottom: '2px' }}>
                  <AlertTriangle size={13} color="#d97706" />
                  <span>Lý do chấm công ngoài vùng (&gt;500m) đã khai báo:</span>
                </div>
                <p style={{ margin: 0, fontSize: '0.775rem', fontStyle: 'italic', color: 'rgb(var(--text-amber-900))', lineHeight: 1.4 }}>
                  &quot;{outOfBoundsReason}&quot;
                </p>
              </div>
            ) : (
              <div style={{ color: 'rgb(var(--text-green-600))', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '4px', fontStyle: 'italic' }}>
                <CheckCircle2 size={13} />
                <span>Vị trí nằm trong bán kính quy chuẩn ≤ 500m quanh {targetZone.zoneName}.</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Section: Cán Bộ Đi Kèm (Co-Surveyor) */}
      <div
        className="card"
        style={{
          backgroundColor: 'rgb(var(--bg-white))',
          border: isCompanionCheckedIn ? '1.5px solid rgb(var(--border-sky-200))' : '1.5px dashed rgb(var(--border-slate-300))',
          borderRadius: '1rem',
          padding: '1.15rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.85rem',
          background: isCompanionCheckedIn ? 'linear-gradient(135deg, rgb(var(--bg-sky-50)) 0%, rgb(var(--bg-sky-100)) 100%)' : 'rgb(var(--bg-slate-50))',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <div
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '8px',
                backgroundColor: 'rgb(var(--bg-sky-100))',
                color: 'rgb(var(--text-sky-600))',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Users size={18} />
            </div>
            <div>
              <h4 style={{ margin: 0, fontSize: '0.875rem', fontWeight: 800, color: 'rgb(var(--text-sky-700))' }}>
                Cán Bộ Đi Kèm (Tổ 02 người)
              </h4>
              <span style={{ fontSize: '0.7rem', color: 'rgb(var(--text-slate-500))' }}>
                Quy chuẩn tổ khảo sát hiện trường Metro Line 2
              </span>
            </div>
          </div>

          <span
            style={{
              backgroundColor: isCompanionCheckedIn ? 'rgb(var(--bg-green-100))' : 'rgb(var(--bg-amber-100))',
              color: isCompanionCheckedIn ? 'rgb(var(--text-green-700))' : 'rgb(var(--text-amber-700))',
              border: `1px solid ${isCompanionCheckedIn ? 'rgb(var(--border-green-300))' : 'rgb(var(--border-amber-200))'}`,
              borderRadius: '999px',
              padding: '2px 8px',
              fontSize: '0.7rem',
              fontWeight: 700,
            }}
          >
            {isCompanionCheckedIn ? '✓ Đã điểm danh' : 'Chưa điểm danh'}
          </span>
        </div>

        {isCompanionCheckedIn && companionData ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', backgroundColor: 'rgb(var(--bg-white))', padding: '0.65rem 0.85rem', borderRadius: '0.65rem', border: '1px solid rgb(var(--border-sky-200))' }}>
            {displayCompanionSelfieUrl ? (
              <img
                src={displayCompanionSelfieUrl}
                alt={companionData.name}
                style={{ width: '42px', height: '42px', borderRadius: '50%', objectFit: 'cover', border: '1.5px solid rgb(var(--border-sky-300))' }}
              />
            ) : (
              <div style={{ width: '42px', height: '42px', borderRadius: '50%', backgroundColor: 'rgb(var(--bg-sky-100))', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgb(var(--text-sky-600))' }}>
                <User size={20} />
              </div>
            )}
            <div style={{ flex: 1, minWidth: 0, fontSize: '0.775rem' }}>
              <div style={{ fontWeight: 800, color: 'rgb(var(--text-slate-900))' }}>{companionData.name}</div>
              <div style={{ color: 'rgb(var(--text-sky-600))', fontSize: '0.7rem', fontWeight: 600 }}>{companionData.role} • Lúc {companionData.time}</div>
            </div>
            <button
              type="button"
              onClick={() => setShowCompanionModal(true)}
              className="btn btn-secondary btn-sm cursor-pointer"
              style={{
                padding: '0.35rem 0.65rem',
                fontSize: '0.725rem',
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              Xem chi tiết
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '0.75rem', color: 'rgb(var(--text-slate-500))' }}>
              Chưa ghi nhận điểm danh cho cán bộ đi cùng.
            </span>
            <button
              type="button"
              onClick={() => setShowCompanionModal(true)}
              className="cursor-pointer"
              style={{
                backgroundColor: 'rgb(var(--bg-sky-600))',
                color: 'rgb(var(--text-white))',
                border: 'none',
                borderRadius: '8px',
                padding: '0.45rem 0.95rem',
                fontSize: '0.775rem',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.35rem',
                boxShadow: '0 2px 5px rgba(2, 132, 199, 0.25)',
              }}
            >
              <UserCheck size={14} />
              <span>Điểm danh cán bộ đi kèm</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
