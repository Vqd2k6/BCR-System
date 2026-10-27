import React from 'react';
import {
  MapPin,
  AlertTriangle,
  Camera,
  User,
  Clock,
  Users,
  UserCheck,
} from 'lucide-react';
import {
  resolveAttendancePhotoUrl,
  type MetroZoneCentroid,
} from '../../../../core/utils/metroZoneUtils';
import type { CompanionRecord } from '../types';

interface CheckInFormProps {
  isOutOfBounds: boolean;
  distanceMeters: number;
  targetZone: MetroZoneCentroid;
  gpsCoordinates: { lat: number; lng: number; accuracy: number } | null;
  gpsError?: string | null;
  handleNativeCameraCapture: (e: React.ChangeEvent<HTMLInputElement>) => void;
  selfieUrl: string;
  outOfBoundsReason: string;
  setOutOfBoundsReason: (val: string) => void;
  handleCheckInSubmit: (e: React.FormEvent) => void;
  isSubmitting: boolean;
  gpsLoading: boolean;
  isCompanionCheckedIn: boolean;
  companionData: CompanionRecord | null;
  setShowCompanionModal: (show: boolean) => void;
}

export const CheckInForm: React.FC<CheckInFormProps> = ({
  isOutOfBounds,
  distanceMeters,
  targetZone,
  gpsCoordinates,
  gpsError,
  handleNativeCameraCapture,
  selfieUrl,
  outOfBoundsReason,
  setOutOfBoundsReason,
  handleCheckInSubmit,
  isSubmitting,
  gpsLoading,
  isCompanionCheckedIn,
  companionData,
  setShowCompanionModal,
}) => {
  const displaySelfieUrl = resolveAttendancePhotoUrl(selfieUrl);
  const displayCompanionSelfieUrl = resolveAttendancePhotoUrl(companionData?.selfieUrl);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      {/* GPS Live Status Card */}
      <div
        className="card"
        style={{
          background: isOutOfBounds || gpsError ? 'rgb(var(--bg-red-50))' : 'rgb(var(--bg-green-50))',
          border: isOutOfBounds || gpsError ? '1px solid rgb(var(--border-red-200))' : '1px solid rgb(var(--border-green-200))',
          padding: '1.15rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.75rem',
          borderRadius: '0.85rem',
        }}
      >
        {/* Header row */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', minWidth: 0 }}>
            <MapPin size={18} color={isOutOfBounds || gpsError ? '#dc2626' : '#16a34a'} style={{ flexShrink: 0 }} />
            <span
              style={{
                fontWeight: 700,
                color: isOutOfBounds || gpsError ? 'rgb(var(--text-red-800))' : 'rgb(var(--text-green-800))',
                fontSize: '0.925rem',
                lineHeight: 1.3,
              }}
            >
              {gpsError
                ? 'Chưa nhận được tín hiệu GPS thực địa'
                : isOutOfBounds
                  ? `Cảnh báo: Ngoài bán kính 500m (${targetZone.zoneName})`
                  : `Vị trí hợp lệ (${distanceMeters}m ≤ 500m)`}
            </span>
          </div>
          {gpsCoordinates && (
            <span
              className={`badge ${isOutOfBounds ? 'badge-danger' : 'badge-success'}`}
              style={{ flexShrink: 0, whiteSpace: 'nowrap', fontSize: '0.75rem', fontWeight: 700 }}
            >
              Cách trọng tâm {targetZone.zoneName}: {distanceMeters}m
            </span>
          )}
        </div>

        {/* Coordinates row */}
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: '0.5rem',
            fontSize: '0.8rem',
            color: 'rgb(var(--text-slate-600))',
            backgroundColor: isOutOfBounds || gpsError ? 'rgba(254, 226, 226, 0.4)' : 'rgba(220, 252, 231, 0.5)',
            padding: '0.45rem 0.75rem',
            borderRadius: '0.5rem',
          }}
        >
          <div>
            Tọa độ thực tế:{' '}
            <strong>
              {gpsCoordinates
                ? `${gpsCoordinates.lat.toFixed(6)}, ${gpsCoordinates.lng.toFixed(6)} (±${gpsCoordinates.accuracy}m)`
                : gpsLoading
                  ? '📡 Đang quét vệ tinh...'
                  : 'Chưa có tọa độ'}
            </strong>
          </div>
          <div>
            Trọng tâm {targetZone.zoneName}: <strong>{targetZone.lat.toFixed(6)}, {targetZone.lng.toFixed(6)}</strong>
          </div>
        </div>

        {/* GPS Error callout */}
        {gpsError && (
          <div
            style={{
              backgroundColor: 'rgb(var(--bg-red-100))',
              padding: '0.6rem 0.8rem',
              borderRadius: '0.5rem',
              fontSize: '0.775rem',
              color: 'rgb(var(--text-red-800))',
              display: 'flex',
              alignItems: 'flex-start',
              gap: '0.5rem',
              lineHeight: 1.45,
            }}
          >
            <AlertTriangle size={15} style={{ flexShrink: 0, marginTop: '2px', color: 'rgb(var(--text-red-600))' }} />
            <span>{gpsError}</span>
          </div>
        )}

        {/* Warning callout */}
        {!gpsError && isOutOfBounds && (
          <div
            style={{
              backgroundColor: 'rgb(var(--bg-red-100))',
              padding: '0.6rem 0.8rem',
              borderRadius: '0.5rem',
              fontSize: '0.775rem',
              color: 'rgb(var(--text-red-800))',
              display: 'flex',
              alignItems: 'flex-start',
              gap: '0.5rem',
              lineHeight: 1.45,
            }}
          >
            <AlertTriangle size={15} style={{ flexShrink: 0, marginTop: '2px', color: 'rgb(var(--text-red-600))' }} />
            <span>
              Bạn đang cách trọng tâm {targetZone.zoneName} <strong>{distanceMeters}m</strong> (&gt;500m). Vui lòng nhập lý do thực địa bên dưới để báo cáo Zone Admin.
            </span>
          </div>
        )}
      </div>

      {/* Check-In Form */}
      <form onSubmit={handleCheckInSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1.15rem' }}>
        <div
          className="card"
          style={{
            backgroundColor: 'rgb(var(--bg-white))',
            padding: '1.25rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '1rem',
            borderRadius: '0.85rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <Camera size={17} color="#0284c7" />
            <span style={{ fontWeight: 700, fontSize: '0.925rem', color: 'rgb(var(--text-slate-900))' }}>
              Ảnh Chụp Thực Địa Trực Tiếp (*)
            </span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.85rem', width: '100%' }}>
            <div style={{ position: 'relative', width: '100%', maxWidth: '280px', display: 'flex', justifyContent: 'center' }}>
              {displaySelfieUrl ? (
                <img
                  src={displaySelfieUrl}
                  alt="Surveyor Live Photo"
                  style={{
                    width: '100%',
                    height: '210px',
                    borderRadius: '0.85rem',
                    objectFit: 'cover',
                    border: '2px solid rgb(var(--border-sky-200))',
                    boxShadow: '0 4px 14px rgba(2, 132, 199, 0.14)',
                  }}
                />
              ) : (
                <div
                  style={{
                    width: '100%',
                    height: '200px',
                    borderRadius: '0.85rem',
                    backgroundColor: 'rgb(var(--bg-slate-50))',
                    border: '2px dashed rgb(var(--border-slate-300))',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.5rem',
                    color: 'rgb(var(--text-slate-500))',
                  }}
                >
                  <div
                    style={{
                      width: '72px',
                      height: '72px',
                      borderRadius: '50%',
                      backgroundColor: 'rgb(var(--bg-slate-200))',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      color: 'rgb(var(--text-slate-500))',
                    }}
                  >
                    <User size={40} />
                  </div>
                  <span style={{ fontSize: '0.8rem', fontWeight: 600, color: 'rgb(var(--text-slate-500))' }}>
                    Khung ảnh sống người điểm danh
                  </span>
                </div>
              )}
            </div>

            <div style={{ fontSize: '0.8rem', color: 'rgb(var(--text-slate-500))', textAlign: 'center' }}>
              {displaySelfieUrl
                ? 'Đã chụp ảnh sống xác thực tại hiện trường.'
                : 'Chỉ chấp nhận ảnh chụp trực tiếp bằng Camera tại thời điểm hiện tại (không tải ảnh có sẵn).'}
            </div>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', justifyContent: 'center', position: 'relative' }}>
              <input
                id="attendance_ksv_checkin_native_camera"
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handleNativeCameraCapture}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '1px',
                  height: '1px',
                  padding: 0,
                  margin: 0,
                  overflow: 'hidden',
                  clip: 'rect(0, 0, 0, 0)',
                  whiteSpace: 'nowrap',
                  border: 0,
                  opacity: 0,
                  pointerEvents: 'none',
                }}
              />
              <label
                htmlFor="attendance_ksv_checkin_native_camera"
                className="cursor-pointer"
                style={{
                  background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '9999px',
                  padding: '0.55rem 1.45rem',
                  fontSize: '0.85rem',
                  fontWeight: 700,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.45rem',
                  cursor: 'pointer',
                  boxShadow: '0 2px 6px rgba(2, 132, 199, 0.25)',
                  transition: 'all 0.15s ease',
                  userSelect: 'none',
                }}
              >
                <Camera size={16} />
                <span>{displaySelfieUrl ? 'Mở Máy Ảnh chụp lại' : 'Mở Máy Ảnh Chụp Điểm Danh'}</span>
              </label>
            </div>
          </div>
        </div>

        {/* Out of bounds reason textarea */}
        {isOutOfBounds && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
            <label
              style={{
                fontSize: '0.85rem',
                fontWeight: 700,
                color: 'rgb(var(--text-orange-800))',
                display: 'flex',
                alignItems: 'center',
                gap: '0.35rem',
              }}
            >
              <AlertTriangle size={15} color="#ea580c" />
              Lý do chấm công ngoài vùng (&gt;500m) <span style={{ color: '#ef4444' }}>*</span>
            </label>
            <textarea
              className="form-control"
              rows={3}
              required
              value={outOfBoundsReason}
              onChange={(e) => setOutOfBoundsReason(e.target.value)}
              placeholder="Nhập lý do khảo sát vùng phụ cận hoặc nhiệm vụ đột xuất..."
              style={{
                fontSize: '0.875rem',
                padding: '0.65rem 0.85rem',
                borderRadius: '0.65rem',
                border: '1.5px solid rgb(var(--border-orange-200))',
                backgroundColor: 'rgb(var(--bg-amber-50))',
                lineHeight: '1.45',
                color: 'rgb(var(--text-slate-800))',
                boxShadow: 'none',
              }}
            />
          </div>
        )}

        {/* Submit button */}
        <button
          type="submit"
          disabled={isSubmitting || gpsLoading || !gpsCoordinates}
          className={isSubmitting || gpsLoading || !gpsCoordinates ? 'disabled:opacity-50 cursor-not-allowed' : 'cursor-pointer'}
          style={{
            background: isSubmitting || gpsLoading || !gpsCoordinates ? 'rgb(var(--bg-slate-200))' : 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
            color: isSubmitting || gpsLoading || !gpsCoordinates ? 'rgb(var(--text-slate-500))' : '#ffffff',
            border: 'none',
            borderRadius: '9999px',
            padding: '0.85rem 1.75rem',
            fontWeight: 700,
            fontSize: '0.95rem',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.5rem',
            cursor: isSubmitting || gpsLoading || !gpsCoordinates ? 'not-allowed' : 'pointer',
            boxShadow: '0 4px 10px rgba(2, 132, 199, 0.25)',
            transition: 'all 0.2s ease',
            width: '100%',
          }}
        >
          <Clock size={18} />
          {isSubmitting ? 'Đang gửi điểm danh...' : 'Xác Nhận Chấm Công GPS'}
        </button>
      </form>

      {/* Section: Cán Bộ Đi Kèm (Luôn hiển thị để KSV dễ dàng mở chụp ảnh & điểm danh người đi cùng) */}
      <div
        className="card"
        style={{
          backgroundColor: 'rgb(var(--bg-white))',
          border: isCompanionCheckedIn ? '1.5px solid rgb(var(--border-sky-200))' : '1.5px dashed rgb(var(--border-slate-300))',
          borderRadius: '0.85rem',
          padding: '1rem 1.15rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.75rem',
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
                Chụp ảnh selfie & điểm danh cho người đi cùng
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
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', backgroundColor: 'rgb(var(--bg-white))', padding: '0.6rem 0.85rem', borderRadius: '0.65rem', border: '1px solid rgb(var(--border-sky-200))' }}>
            {displayCompanionSelfieUrl ? (
              <img
                src={displayCompanionSelfieUrl}
                alt={companionData.name}
                style={{ width: '40px', height: '40px', borderRadius: '50%', objectFit: 'cover', border: '1.5px solid rgb(var(--border-sky-300))' }}
              />
            ) : (
              <div style={{ width: '40px', height: '40px', borderRadius: '50%', backgroundColor: 'rgb(var(--bg-sky-100))', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgb(var(--text-sky-600))' }}>
                <User size={19} />
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
              Xem / Chụp lại
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '0.75rem', color: 'rgb(var(--text-slate-500))' }}>
              Bấm nút bên cạnh để mở Camera chụp ảnh và điểm danh người đi kèm:
            </span>
            <button
              type="button"
              onClick={() => setShowCompanionModal(true)}
              className="cursor-pointer"
              style={{
                background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
                color: '#ffffff',
                border: 'none',
                borderRadius: '8px',
                padding: '0.5rem 1rem',
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
              <span>Chụp ảnh & Điểm danh người đi kèm</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
