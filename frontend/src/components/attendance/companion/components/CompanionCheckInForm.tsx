import React from 'react';
import {
  MapPin,
  RefreshCw,
  Camera,
  User,
  AlertTriangle,
  UserCheck,
} from 'lucide-react';
import {
  resolveAttendancePhotoUrl,
  type MetroZoneCentroid,
} from '../../../../core/utils/metroZoneUtils';

interface CompanionCheckInFormProps {
  changeCount: number;
  distanceMeters: number;
  targetZone: MetroZoneCentroid;
  gpsCoordinates: { lat: number; lng: number; accuracy: number } | null;
  gpsError?: string | null;
  submitError?: string | null;
  getLiveGps: () => void;
  gpsLoading: boolean;
  companionName: string;
  setCompanionName: (name: string) => void;
  companionRole: string;
  setCompanionRole: (role: string) => void;
  companionPhone: string;
  setCompanionPhone: (phone: string) => void;
  selfieUrl: string;
  handleNativeCameraCapture: (e: React.ChangeEvent<HTMLInputElement>) => void;
  outOfBoundsReason: string;
  setOutOfBoundsReason: (reason: string) => void;
  isSubmitting: boolean;
  onClose: () => void;
  onSubmit: (e: React.FormEvent) => void;
}

export const CompanionCheckInForm: React.FC<CompanionCheckInFormProps> = ({
  changeCount,
  distanceMeters,
  targetZone,
  gpsCoordinates,
  gpsError,
  submitError,
  getLiveGps,
  gpsLoading,
  companionName,
  setCompanionName,
  companionRole,
  setCompanionRole,
  companionPhone,
  setCompanionPhone,
  selfieUrl,
  handleNativeCameraCapture,
  outOfBoundsReason,
  setOutOfBoundsReason,
  isSubmitting,
  onClose,
  onSubmit,
}) => {
  const isOutOfBounds = Boolean(gpsCoordinates && distanceMeters > 500);
  const displaySelfieUrl = resolveAttendancePhotoUrl(selfieUrl);

  return (
    <form onSubmit={onSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0.95rem' }}>
      <div
        style={{
          fontSize: '0.75rem',
          color: 'rgb(var(--text-slate-600))',
          lineHeight: 1.45,
          backgroundColor: 'rgb(var(--bg-slate-50))',
          padding: '0.65rem 0.85rem',
          borderRadius: '0.65rem',
          border: '1px solid rgb(var(--border-slate-200))',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: '0.5rem',
        }}
      >
        <div>
          Quy chuẩn tổ khảo sát hiện trường gồm <strong>02 cán bộ</strong> (01 điều tra viên chính + 01 cán bộ đi kèm). Vui lòng nhập thông tin và chụp ảnh selfie.
        </div>
        <span
          style={{
            backgroundColor: 'rgb(var(--bg-sky-100))',
            color: 'rgb(var(--text-sky-700))',
            border: '1px solid rgb(var(--border-sky-200))',
            padding: '2px 8px',
            borderRadius: '999px',
            fontSize: '0.7rem',
            fontWeight: 700,
            whiteSpace: 'nowrap',
            flexShrink: 0,
          }}
        >
          Lần {Math.min(3, changeCount + 1)}/3 trong ngày
        </span>
      </div>

      {/* Location info Card */}
      <div
        style={{
          padding: '0.65rem 0.85rem',
          borderRadius: '0.65rem',
          border: `1px solid ${isOutOfBounds || gpsError ? 'rgb(var(--border-red-200))' : 'rgb(var(--border-green-200))'}`,
          backgroundColor: isOutOfBounds || gpsError ? 'rgb(var(--bg-red-50))' : 'rgb(var(--bg-green-50))',
          display: 'flex',
          flexDirection: 'column',
          gap: '0.35rem',
          fontSize: '0.775rem',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
            <MapPin size={15} color={isOutOfBounds || gpsError ? '#dc2626' : '#16a34a'} />
            <span style={{ fontWeight: 700, color: isOutOfBounds || gpsError ? 'rgb(var(--text-red-800))' : 'rgb(var(--text-green-800))' }}>
              {gpsError
                ? 'Chưa nhận được tín hiệu GPS thực địa'
                : gpsLoading
                  ? 'Đang quét tọa độ GPS...'
                  : isOutOfBounds
                    ? `Ngoài bán kính 500m (${targetZone.zoneName}) (${distanceMeters}m)`
                    : `Vị trí hợp lệ (${distanceMeters}m tới ${targetZone.zoneName})`}
            </span>
          </div>
          <button
            type="button"
            onClick={getLiveGps}
            className="cursor-pointer"
            style={{
              background: 'none',
              border: 'none',
              color: 'rgb(var(--text-sky-600))',
              fontSize: '0.725rem',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '3px',
            }}
          >
            <RefreshCw size={11} className={gpsLoading ? 'animate-spin' : ''} />
            <span>Lấy lại GPS</span>
          </button>
        </div>

        {gpsCoordinates && (
          <div style={{ fontSize: '0.725rem', color: 'rgb(var(--text-slate-600))' }}>
            Tọa độ thực tế: <strong>{gpsCoordinates.lat.toFixed(6)}, {gpsCoordinates.lng.toFixed(6)} (±{gpsCoordinates.accuracy}m)</strong>
          </div>
        )}

        {gpsError && (
          <div style={{ fontSize: '0.725rem', color: 'rgb(var(--text-red-700))' }}>
            {gpsError}
          </div>
        )}
      </div>

      {/* Submit Error Banner */}
      {submitError && (
        <div
          style={{
            padding: '0.6rem 0.8rem',
            borderRadius: '0.5rem',
            backgroundColor: 'rgb(var(--bg-red-50))',
            border: '1px solid rgb(var(--border-red-200))',
            color: 'rgb(var(--text-red-800))',
            fontSize: '0.775rem',
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            gap: '0.4rem',
          }}
        >
          <AlertTriangle size={15} style={{ flexShrink: 0 }} />
          <span>{submitError}</span>
        </div>
      )}

      {/* Companion Name */}
      <div>
        <label style={{ display: 'block', fontSize: '0.775rem', fontWeight: 700, color: 'rgb(var(--text-slate-700))', marginBottom: '4px' }}>
          Họ tên cán bộ đi kèm <span style={{ color: '#ef4444' }}>*</span>
        </label>
        <input
          type="text"
          required
          placeholder="Nhập họ và tên đầy đủ..."
          value={companionName}
          onChange={(e) => setCompanionName(e.target.value)}
          style={{
            width: '100%',
            padding: '0.55rem 0.75rem',
            backgroundColor: 'rgb(var(--bg-white))',
            border: '1px solid rgb(var(--border-slate-300))',
            borderRadius: '0.5rem',
            fontSize: '0.8rem',
            color: 'rgb(var(--text-slate-900))',
            outline: 'none',
          }}
        />
      </div>

      {/* Role & Phone */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.65rem' }}>
        <div>
          <label style={{ display: 'block', fontSize: '0.775rem', fontWeight: 700, color: 'rgb(var(--text-slate-700))', marginBottom: '4px' }}>
            Vai trò / Chức danh:
          </label>
          <select
            value={companionRole}
            onChange={(e) => setCompanionRole(e.target.value)}
            style={{
              width: '100%',
              padding: '0.55rem 0.75rem',
              backgroundColor: 'rgb(var(--bg-white))',
              border: '1px solid rgb(var(--border-slate-300))',
              borderRadius: '0.5rem',
              fontSize: '0.8rem',
              color: 'rgb(var(--text-slate-900))',
              outline: 'none',
            }}
          >
            <option value="Cán bộ đo đạc & Ghi chép">Cán bộ đo đạc & Ghi chép</option>
            <option value="Trợ lý kỹ thuật hiện trường">Trợ lý kỹ thuật hiện trường</option>
            <option value="Kỹ thuật viên kết cấu">Kỹ thuật viên kết cấu</option>
            <option value="Đại diện tư vấn giám sát">Đại diện tư vấn giám sát</option>
          </select>
        </div>

        <div>
          <label style={{ display: 'block', fontSize: '0.775rem', fontWeight: 700, color: 'rgb(var(--text-slate-700))', marginBottom: '4px' }}>
            Số điện thoại liên hệ:
          </label>
          <input
            type="text"
            placeholder="09xx xxx xxx"
            value={companionPhone}
            onChange={(e) => setCompanionPhone(e.target.value)}
            style={{
              width: '100%',
              padding: '0.55rem 0.75rem',
              backgroundColor: 'rgb(var(--bg-white))',
              border: '1px solid rgb(var(--border-slate-300))',
              borderRadius: '0.5rem',
              fontSize: '0.8rem',
              color: 'rgb(var(--text-slate-900))',
              outline: 'none',
            }}
          />
        </div>
      </div>

      {/* Camera & Live Capture */}
      <div
        style={{
          backgroundColor: 'rgb(var(--bg-slate-50))',
          border: '1px solid rgb(var(--border-slate-200))',
          borderRadius: '0.75rem',
          padding: '0.85rem',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '0.65rem',
        }}
      >
        <div style={{ alignSelf: 'flex-start', display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.775rem', fontWeight: 700, color: 'rgb(var(--text-slate-900))' }}>
          <Camera size={14} color="#0284c7" />
          <span>Ảnh Chụp Sống Cán Bộ Đi Kèm (*)</span>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.65rem', width: '100%' }}>
          {displaySelfieUrl ? (
            <img
              src={displaySelfieUrl}
              alt="Companion Live Photo"
              style={{
                width: '120px',
                height: '150px',
                borderRadius: '0.65rem',
                objectFit: 'cover',
                border: '2px solid rgb(var(--border-sky-300))',
                boxShadow: '0 2px 6px rgba(2, 132, 199, 0.15)',
              }}
            />
          ) : (
            <div
              style={{
                width: '120px',
                height: '140px',
                borderRadius: '0.65rem',
                backgroundColor: 'rgb(var(--bg-white))',
                border: '2px dashed rgb(var(--border-slate-300))',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '4px',
                color: 'rgb(var(--text-slate-500))',
              }}
            >
              <User size={30} />
              <span style={{ fontSize: '0.675rem', fontWeight: 600, color: 'rgb(var(--text-slate-500))' }}>Ảnh sống hiện tại</span>
            </div>
          )}

          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem', justifyContent: 'center', position: 'relative' }}>
            <input
              id="attendance_companion_native_camera"
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
              htmlFor="attendance_companion_native_camera"
              className="cursor-pointer"
              style={{
                background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
                color: '#ffffff',
                border: 'none',
                borderRadius: '999px',
                padding: '0.5rem 1.2rem',
                fontSize: '0.775rem',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                boxShadow: '0 2px 5px rgba(2, 132, 199, 0.25)',
                userSelect: 'none',
              }}
            >
              <Camera size={14} />
              <span>{displaySelfieUrl ? 'Mở Máy Ảnh chụp lại' : 'Mở Máy Ảnh Chụp Điểm Danh'}</span>
            </label>
          </div>
        </div>
      </div>

      {/* Out of bounds reason */}
      {isOutOfBounds && (
        <div>
          <label
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              fontSize: '0.75rem',
              fontWeight: 700,
              color: 'rgb(var(--text-orange-800))',
              marginBottom: '4px',
            }}
          >
            <AlertTriangle size={13} color="#ea580c" />
            Lý do ngoài bán kính (&gt;500m) <span style={{ color: '#ef4444' }}>*</span>
          </label>
          <textarea
            rows={2}
            required
            placeholder="Nhập lý do khảo sát vùng phụ cận hoặc nhiệm vụ đột xuất..."
            value={outOfBoundsReason}
            onChange={(e) => setOutOfBoundsReason(e.target.value)}
            style={{
              width: '100%',
              padding: '0.55rem 0.75rem',
              backgroundColor: 'rgb(var(--bg-amber-50))',
              border: '1px solid rgb(var(--border-orange-200))',
              borderRadius: '0.5rem',
              fontSize: '0.8rem',
              color: 'rgb(var(--text-slate-800))',
              outline: 'none',
            }}
          />
        </div>
      )}

      {/* Submit button */}
      <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', paddingTop: '0.25rem' }}>
        <button
          type="button"
          onClick={onClose}
          className="cursor-pointer"
          style={{
            padding: '0.55rem 1rem',
            borderRadius: '0.5rem',
            border: '1px solid rgb(var(--border-slate-300))',
            backgroundColor: 'rgb(var(--bg-slate-50))',
            color: 'rgb(var(--text-slate-600))',
            fontSize: '0.775rem',
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          Hủy
        </button>
        <button
          type="submit"
          disabled={isSubmitting || gpsLoading || !gpsCoordinates}
          className={isSubmitting || gpsLoading || !gpsCoordinates ? 'disabled:opacity-50 cursor-not-allowed' : 'cursor-pointer'}
          style={{
            padding: '0.55rem 1.25rem',
            borderRadius: '0.5rem',
            border: 'none',
            background: isSubmitting || gpsLoading || !gpsCoordinates ? 'rgb(var(--bg-slate-200))' : 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
            color: isSubmitting || gpsLoading || !gpsCoordinates ? 'rgb(var(--text-slate-500))' : '#ffffff',
            fontSize: '0.775rem',
            fontWeight: 700,
            cursor: isSubmitting || gpsLoading || !gpsCoordinates ? 'not-allowed' : 'pointer',
            boxShadow: '0 2px 5px rgba(2, 132, 199, 0.25)',
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
          }}
        >
          <UserCheck size={14} />
          <span>{isSubmitting ? 'Đang gửi...' : 'Xác Nhận Điểm Danh'}</span>
        </button>
      </div>
    </form>
  );
};
