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
import { MetroZoneCentroid } from '../../../../core/utils/metroZoneUtils';

interface TodayCheckInSummaryProps {
  checkInDetails: any;
  distanceMeters: number;
  targetZone: MetroZoneCentroid;
  gpsCoordinates: { lat: number; lng: number; accuracy: number } | null;
  selfieUrl: string;
  user: any;
  outOfBoundsReason: string;
  isCompanionCheckedIn: boolean;
  companionData: any;
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
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      {/* Verified Header Banner */}
      <div
        className="card"
        style={{
          background: 'linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%)',
          border: '1.5px solid #86efac',
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
            backgroundColor: '#bbf7d0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
            color: '#15803d',
          }}
        >
          <ShieldCheck size={24} />
        </div>

        <div style={{ flex: 1 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
            <h3 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 800, color: '#14532d' }}>
              ĐÃ ĐIỂM DANH THỰC ĐỊA HÔM NAY
            </h3>
            <span
              style={{
                backgroundColor: distanceMeters > 500 ? '#fef3c7' : '#dcfce7',
                color: distanceMeters > 500 ? '#b45309' : '#15803d',
                border: `1px solid ${distanceMeters > 500 ? '#fde68a' : '#86efac'}`,
                borderRadius: '999px',
                padding: '2px 8px',
                fontSize: '0.7rem',
                fontWeight: 700,
              }}
            >
              {distanceMeters > 500 ? 'Cảnh báo vị trí (>500m)' : 'Vị trí hợp lệ'}
            </span>
          </div>

          <div style={{ marginTop: '0.45rem', fontSize: '0.775rem', color: '#166534', display: 'flex', flexWrap: 'wrap', gap: '0.75rem' }}>
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
          backgroundColor: '#ffffff',
          border: '1px solid #e2e8f0',
          borderRadius: '1rem',
          padding: '1.15rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '1rem',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <Camera size={16} color="#0284c7" />
          <span style={{ fontWeight: 700, fontSize: '0.9rem', color: '#0f172a' }}>
            Ảnh Selfie Xác Thực Đã Chụp Hôm Nay
          </span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'row', flexWrap: 'wrap', gap: '1rem', alignItems: 'center' }}>
          {selfieUrl ? (
            <img
              src={selfieUrl}
              alt="Surveyor Selfie"
              style={{
                width: '130px',
                height: '160px',
                borderRadius: '0.75rem',
                objectFit: 'cover',
                border: '2px solid #7dd3fc',
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
                backgroundColor: '#f8fafc',
                border: '2px dashed #cbd5e1',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#94a3b8',
                flexShrink: 0,
              }}
            >
              <User size={36} />
              <span style={{ fontSize: '0.7rem', marginTop: '4px', fontWeight: 600 }}>Ảnh selfie</span>
            </div>
          )}

          <div style={{ flex: 1, width: '100%', display: 'flex', flexDirection: 'column', gap: '0.5rem', fontSize: '0.8rem' }}>
            <div style={{ paddingBottom: '0.5rem', borderBottom: '1px solid #f1f5f9' }}>
              <span style={{ color: '#94a3b8', fontSize: '0.725rem', display: 'block' }}>Điều tra viên chính:</span>
              <span style={{ fontSize: '0.95rem', fontWeight: 800, color: '#0f172a' }}>
                {user?.fullName || 'Nguyễn Văn Khảo Sát'}
              </span>
              <span style={{ color: '#64748b', fontSize: '0.75rem', display: 'block', marginTop: '2px' }}>
                Khu vực: <strong>{user?.assignedZoneId || 'Ga S9 - Bà Quẹo'}</strong>
              </span>
            </div>

            {outOfBoundsReason ? (
              <div
                style={{
                  backgroundColor: '#fffbeb',
                  border: '1px solid #fde68a',
                  borderRadius: '0.65rem',
                  padding: '0.65rem 0.75rem',
                  color: '#92400e',
                }}
              >
                <div style={{ fontWeight: 700, fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.35rem', marginBottom: '2px' }}>
                  <AlertTriangle size={13} color="#d97706" />
                  <span>Lý do chấm công ngoài vùng (&gt;500m) đã khai báo:</span>
                </div>
                <p style={{ margin: 0, fontSize: '0.775rem', fontStyle: 'italic', color: '#78350f', lineHeight: 1.4 }}>
                  &quot;{outOfBoundsReason}&quot;
                </p>
              </div>
            ) : (
              <div style={{ color: '#16a34a', fontSize: '0.75rem', display: 'flex', alignItems: 'center', gap: '4px', fontStyle: 'italic' }}>
                <CheckCircle2 size={13} />
                <span>Vị trí nằm trong bán kính quy chuẩn ≤ 500m quanh Ga Metro 2.</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Section: Cán Bộ Đi Kèm (Co-Surveyor) */}
      <div
        className="card"
        style={{
          backgroundColor: '#ffffff',
          border: isCompanionCheckedIn ? '1.5px solid #bae6fd' : '1.5px dashed #cbd5e1',
          borderRadius: '1rem',
          padding: '1.15rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.85rem',
          background: isCompanionCheckedIn ? 'linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 100%)' : '#f8fafc',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <div
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '8px',
                backgroundColor: '#e0f2fe',
                color: '#0284c7',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Users size={18} />
            </div>
            <div>
              <h4 style={{ margin: 0, fontSize: '0.875rem', fontWeight: 800, color: '#0369a1' }}>
                Cán Bộ Đi Kèm (Tổ 02 người)
              </h4>
              <span style={{ fontSize: '0.7rem', color: '#64748b' }}>
                Quy chuẩn tổ khảo sát hiện trường Metro Line 2
              </span>
            </div>
          </div>

          <span
            style={{
              backgroundColor: isCompanionCheckedIn ? '#dcfce7' : '#fef3c7',
              color: isCompanionCheckedIn ? '#15803d' : '#b45309',
              border: `1px solid ${isCompanionCheckedIn ? '#86efac' : '#fde68a'}`,
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
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', backgroundColor: '#ffffff', padding: '0.65rem 0.85rem', borderRadius: '0.65rem', border: '1px solid #bae6fd' }}>
            {companionData.selfieUrl ? (
              <img
                src={companionData.selfieUrl}
                alt={companionData.name}
                style={{ width: '42px', height: '42px', borderRadius: '50%', objectFit: 'cover', border: '1.5px solid #7dd3fc' }}
              />
            ) : (
              <div style={{ width: '42px', height: '42px', borderRadius: '50%', backgroundColor: '#e0f2fe', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#0284c7' }}>
                <User size={20} />
              </div>
            )}
            <div style={{ flex: 1, minWidth: 0, fontSize: '0.775rem' }}>
              <div style={{ fontWeight: 800, color: '#0f172a' }}>{companionData.name}</div>
              <div style={{ color: '#0284c7', fontSize: '0.7rem', fontWeight: 600 }}>{companionData.role} • Lúc {companionData.time}</div>
            </div>
            <button
              type="button"
              onClick={() => setShowCompanionModal(true)}
              className="btn btn-secondary btn-sm"
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
            <span style={{ fontSize: '0.75rem', color: '#64748b' }}>
              Chưa ghi nhận điểm danh cho cán bộ đi cùng.
            </span>
            <button
              type="button"
              onClick={() => setShowCompanionModal(true)}
              style={{
                backgroundColor: '#0284c7',
                color: '#ffffff',
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
