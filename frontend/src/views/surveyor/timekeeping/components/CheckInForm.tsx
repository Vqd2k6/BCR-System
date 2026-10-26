import React from 'react';
import {
  MapPin,
  AlertTriangle,
  Camera,
  X,
  User,
  Clock,
} from 'lucide-react';
import {
  resolveAttendancePhotoUrl,
  type MetroZoneCentroid,
} from '../../../../core/utils/metroZoneUtils';

interface CheckInFormProps {
  isOutOfBounds: boolean;
  distanceMeters: number;
  targetZone: MetroZoneCentroid;
  gpsCoordinates: { lat: number; lng: number; accuracy: number } | null;
  gpsError?: string | null;
  isSimulatedGps: boolean;
  cameraActive: boolean;
  videoRef: React.RefObject<HTMLVideoElement>;
  handleCapturePhoto: () => void;
  handleStopCamera: () => void;
  handleStartCamera: () => void;
  selfieUrl: string;
  outOfBoundsReason: string;
  setOutOfBoundsReason: (val: string) => void;
  handleCheckInSubmit: (e: React.FormEvent) => void;
  isSubmitting: boolean;
  gpsLoading: boolean;
}

export const CheckInForm: React.FC<CheckInFormProps> = ({
  isOutOfBounds,
  distanceMeters,
  targetZone,
  gpsCoordinates,
  gpsError,
  cameraActive,
  videoRef,
  handleCapturePhoto,
  handleStopCamera,
  handleStartCamera,
  selfieUrl,
  outOfBoundsReason,
  setOutOfBoundsReason,
  handleCheckInSubmit,
  isSubmitting,
  gpsLoading,
}) => {
  const displaySelfieUrl = resolveAttendancePhotoUrl(selfieUrl);

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
              Ảnh chụp Selfie xác thực (*)
            </span>
          </div>

          {cameraActive ? (
            <div
              className="bg-slate-900"
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '0.75rem',
                alignItems: 'center',
                padding: '0.85rem',
                borderRadius: '0.75rem',
              }}
            >
              <video
                ref={videoRef}
                autoPlay
                playsInline
                style={{ width: '100%', maxHeight: '280px', borderRadius: '0.5rem', objectFit: 'cover' }}
              />
              <div style={{ display: 'flex', gap: '0.5rem', width: '100%', justifyContent: 'center' }}>
                <button
                  type="button"
                  onClick={handleCapturePhoto}
                  className="btn btn-primary btn-sm cursor-pointer"
                  style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', padding: '0.55rem 1.35rem', fontWeight: 700 }}
                >
                  <Camera size={15} />
                  Chụp ảnh ngay
                </button>
                <button
                  type="button"
                  onClick={handleStopCamera}
                  className="btn btn-secondary btn-sm cursor-pointer"
                  style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', padding: '0.55rem 1rem' }}
                >
                  <X size={15} />
                  Hủy
                </button>
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.85rem', width: '100%' }}>
              <div style={{ position: 'relative', width: '100%', maxWidth: '280px', display: 'flex', justifyContent: 'center' }}>
                {displaySelfieUrl ? (
                  <img
                    src={displaySelfieUrl}
                    alt="Surveyor Selfie"
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
                      color: 'rgb(var(--text-slate-400))',
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
                      Khung chân dung người điểm danh
                    </span>
                  </div>
                )}
              </div>

              <div style={{ fontSize: '0.8rem', color: 'rgb(var(--text-slate-500))', textAlign: 'center' }}>
                {displaySelfieUrl
                  ? 'Đã chụp ảnh xác thực danh tính thực địa.'
                  : 'Vui lòng bật camera để chụp ảnh khuôn mặt trước khi điểm danh.'}
              </div>

              <button
                type="button"
                onClick={handleStartCamera}
                className="cursor-pointer"
                style={{
                  background: 'rgb(var(--bg-sky-100))',
                  color: 'rgb(var(--text-sky-700))',
                  border: '1px solid rgb(var(--border-sky-300))',
                  borderRadius: '9999px',
                  padding: '0.5rem 1.25rem',
                  fontSize: '0.85rem',
                  fontWeight: 700,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.45rem',
                  cursor: 'pointer',
                  boxShadow: '0 2px 4px rgba(3, 105, 161, 0.08)',
                  transition: 'all 0.15s ease',
                }}
              >
                <Camera size={15} />
                <span>{displaySelfieUrl ? 'Bật Camera chụp lại' : 'Bật Camera Chụp Selfie'}</span>
              </button>
            </div>
          )}
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
            background: isSubmitting || gpsLoading || !gpsCoordinates ? 'rgb(var(--bg-slate-100))' : 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
            color: isSubmitting || gpsLoading || !gpsCoordinates ? 'rgb(var(--text-slate-400))' : 'rgb(var(--text-white))',
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
    </div>
  );
};
