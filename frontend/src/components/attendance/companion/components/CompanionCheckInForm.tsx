import React from 'react';
import {
  MapPin,
  RefreshCw,
  Camera,
  User,
  AlertTriangle,
  UserCheck,
} from 'lucide-react';
import { MetroZoneCentroid } from '../../../../core/utils/metroZoneUtils';

interface CompanionCheckInFormProps {
  changeCount: number;
  distanceMeters: number;
  targetZone: MetroZoneCentroid;
  getLiveGps: () => void;
  gpsLoading: boolean;
  companionName: string;
  setCompanionName: (name: string) => void;
  companionRole: string;
  setCompanionRole: (role: string) => void;
  companionPhone: string;
  setCompanionPhone: (phone: string) => void;
  cameraActive: boolean;
  videoRef: React.RefObject<HTMLVideoElement>;
  selfieUrl: string;
  handleStartCamera: () => void;
  handleStopCamera: () => void;
  handleCapturePhoto: () => void;
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
  getLiveGps,
  gpsLoading,
  companionName,
  setCompanionName,
  companionRole,
  setCompanionRole,
  companionPhone,
  setCompanionPhone,
  cameraActive,
  videoRef,
  selfieUrl,
  handleStartCamera,
  handleStopCamera,
  handleCapturePhoto,
  outOfBoundsReason,
  setOutOfBoundsReason,
  isSubmitting,
  onClose,
  onSubmit,
}) => {
  const isOutOfBounds = distanceMeters > 500;

  return (
    <form onSubmit={onSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '0.95rem' }}>
      <div
        style={{
          fontSize: '0.75rem',
          color: '#475569',
          lineHeight: 1.45,
          backgroundColor: '#f8fafc',
          padding: '0.65rem 0.85rem',
          borderRadius: '0.65rem',
          border: '1px solid #e2e8f0',
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
            backgroundColor: '#e0f2fe',
            color: '#0369a1',
            border: '1px solid #bae6fd',
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
          border: `1px solid ${isOutOfBounds ? '#fecaca' : '#bbf7d0'}`,
          backgroundColor: isOutOfBounds ? '#fef2f2' : '#f0fdf4',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          fontSize: '0.775rem',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <MapPin size={15} color={isOutOfBounds ? '#dc2626' : '#16a34a'} />
          <span style={{ fontWeight: 700, color: isOutOfBounds ? '#991b1b' : '#166534' }}>
            {isOutOfBounds ? `Ngoài bán kính 500m (${targetZone.zoneName})` : `Vị trí hợp lệ`} ({distanceMeters}m)
          </span>
        </div>
        <button
          type="button"
          onClick={getLiveGps}
          style={{
            background: 'none',
            border: 'none',
            color: '#0284c7',
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

      {/* Companion Name */}
      <div>
        <label style={{ display: 'block', fontSize: '0.775rem', fontWeight: 700, color: '#334155', marginBottom: '4px' }}>
          Họ tên cán bộ đi kèm <span style={{ color: '#ef4444' }}>*</span>
        </label>
        <input
          type="text"
          required
          placeholder="VD: Trần Văn Bình..."
          value={companionName}
          onChange={(e) => setCompanionName(e.target.value)}
          style={{
            width: '100%',
            padding: '0.55rem 0.75rem',
            backgroundColor: '#ffffff',
            border: '1px solid #cbd5e1',
            borderRadius: '0.5rem',
            fontSize: '0.8rem',
            color: '#0f172a',
            outline: 'none',
          }}
        />
      </div>

      {/* Role & Phone */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.65rem' }}>
        <div>
          <label style={{ display: 'block', fontSize: '0.775rem', fontWeight: 700, color: '#334155', marginBottom: '4px' }}>
            Vai trò / Chức danh:
          </label>
          <select
            value={companionRole}
            onChange={(e) => setCompanionRole(e.target.value)}
            style={{
              width: '100%',
              padding: '0.55rem 0.75rem',
              backgroundColor: '#ffffff',
              border: '1px solid #cbd5e1',
              borderRadius: '0.5rem',
              fontSize: '0.8rem',
              color: '#0f172a',
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
          <label style={{ display: 'block', fontSize: '0.775rem', fontWeight: 700, color: '#334155', marginBottom: '4px' }}>
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
              backgroundColor: '#ffffff',
              border: '1px solid #cbd5e1',
              borderRadius: '0.5rem',
              fontSize: '0.8rem',
              color: '#0f172a',
              outline: 'none',
            }}
          />
        </div>
      </div>

      {/* Camera & Selfie Capture */}
      <div
        style={{
          backgroundColor: '#f8fafc',
          border: '1px solid #e2e8f0',
          borderRadius: '0.75rem',
          padding: '0.85rem',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '0.65rem',
        }}
      >
        <div style={{ alignSelf: 'flex-start', display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.775rem', fontWeight: 700, color: '#0f172a' }}>
          <Camera size={14} color="#0284c7" />
          <span>Ảnh Selfie Cán Bộ Đi Kèm (*)</span>
        </div>

        {cameraActive ? (
          <div
            style={{
              width: '100%',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '0.5rem',
              backgroundColor: '#0f172a',
              padding: '0.65rem',
              borderRadius: '0.65rem',
            }}
          >
            <video
              ref={videoRef}
              autoPlay
              playsInline
              style={{ width: '100%', maxHeight: '200px', borderRadius: '0.5rem', objectFit: 'cover' }}
            />
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button
                type="button"
                onClick={handleCapturePhoto}
                style={{
                  background: '#0284c7',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '0.45rem',
                  padding: '0.45rem 1rem',
                  fontSize: '0.75rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                }}
              >
                <Camera size={13} />
                Chụp ảnh
              </button>
              <button
                type="button"
                onClick={handleStopCamera}
                style={{
                  background: '#475569',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '0.45rem',
                  padding: '0.45rem 0.85rem',
                  fontSize: '0.75rem',
                  cursor: 'pointer',
                }}
              >
                Hủy
              </button>
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.65rem' }}>
            {selfieUrl ? (
              <img
                src={selfieUrl}
                alt="Companion Selfie"
                style={{
                  width: '120px',
                  height: '150px',
                  borderRadius: '0.65rem',
                  objectFit: 'cover',
                  border: '2px solid #7dd3fc',
                  boxShadow: '0 2px 6px rgba(2, 132, 199, 0.15)',
                }}
              />
            ) : (
              <div
                style={{
                  width: '120px',
                  height: '140px',
                  borderRadius: '0.65rem',
                  backgroundColor: '#ffffff',
                  border: '2px dashed #cbd5e1',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '4px',
                  color: '#94a3b8',
                }}
              >
                <User size={30} color="#cbd5e1" />
                <span style={{ fontSize: '0.675rem', fontWeight: 600, color: '#94a3b8' }}>Khung chân dung</span>
              </div>
            )}

            <button
              type="button"
              onClick={handleStartCamera}
              style={{
                background: '#e0f2fe',
                color: '#0284c7',
                border: '1px solid #bae6fd',
                borderRadius: '999px',
                padding: '0.4rem 1rem',
                fontSize: '0.75rem',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
              }}
            >
              <Camera size={13} />
              <span>{selfieUrl ? 'Chụp lại ảnh' : 'Bật Camera Chụp Selfie'}</span>
            </button>
          </div>
        )}
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
              color: '#9a3412',
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
              backgroundColor: '#fffaf5',
              border: '1px solid #fed7aa',
              borderRadius: '0.5rem',
              fontSize: '0.8rem',
              color: '#1e293b',
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
          style={{
            padding: '0.55rem 1rem',
            borderRadius: '0.5rem',
            border: '1px solid #cbd5e1',
            backgroundColor: '#f8fafc',
            color: '#475569',
            fontSize: '0.775rem',
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          Hủy
        </button>
        <button
          type="submit"
          disabled={isSubmitting}
          style={{
            padding: '0.55rem 1.25rem',
            borderRadius: '0.5rem',
            border: 'none',
            background: 'linear-gradient(135deg, #0284c7 0%, #0369a1 100%)',
            color: '#ffffff',
            fontSize: '0.775rem',
            fontWeight: 700,
            cursor: isSubmitting ? 'not-allowed' : 'pointer',
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
