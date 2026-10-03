import React, { useRef, useState, useEffect } from 'react';
import {
  Camera,
  Trash2,
  MapPin,
  Edit3,
  Image as ImageIcon,
  RefreshCw,
  RotateCw,
  MoreVertical,
} from 'lucide-react';
import { UploadStatus } from '../types';
import { PhotoWatermarkOverlay } from './PhotoWatermarkOverlay';

interface PhotoPreviewCardProps {
  value: string;
  localPreview: string | null;
  hasLoadError: boolean;
  onSetHasLoadError: (err: boolean) => void;
  height: number | string;
  photoCode?: string;
  displayPhotoCode: string;
  label?: string;
  uploadStatus: UploadStatus;
  allowAnnotation?: boolean;
  cameraInputId: string;
  galleryInputId: string;
  onOpenLightbox: () => void;
  onTriggerCapture: () => void;
  onRotate90: () => void;
  onStartAnnotating: () => void;
  onClear: () => void;
}

export const PhotoPreviewCard: React.FC<PhotoPreviewCardProps> = ({
  value,
  localPreview,
  hasLoadError,
  onSetHasLoadError,
  height,
  photoCode,
  displayPhotoCode,
  label,
  uploadStatus,
  allowAnnotation = true,
  cameraInputId,
  galleryInputId,
  onOpenLightbox,
  onTriggerCapture,
  onRotate90,
  onStartAnnotating,
  onClear,
}) => {
  const [isMoreMenuOpen, setIsMoreMenuOpen] = useState(false);
  const moreMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isMoreMenuOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (moreMenuRef.current && !moreMenuRef.current.contains(e.target as Node)) {
        setIsMoreMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isMoreMenuOpen]);

  return (
    <div
      style={{
        position: 'relative',
        width: '100%',
        height,
        borderRadius: '0.65rem',
        overflow: 'hidden',
        border: '1px solid #cbd5e1',
        backgroundColor: '#0f172a',
      }}
    >
      <img
        id={photoCode || displayPhotoCode || undefined}
        data-photo-code={photoCode || displayPhotoCode || undefined}
        src={hasLoadError && localPreview ? localPreview : value}
        alt={displayPhotoCode || label || 'Photo preview'}
        onError={() => {
          if (localPreview && !hasLoadError) {
            onSetHasLoadError(true);
          }
        }}
        onClick={onOpenLightbox}
        title="Chạm vào ảnh để phóng to soi vạch thước đo nứt (2 ngón tay)"
        style={{ width: '100%', height: '100%', objectFit: 'contain', cursor: 'pointer' }}
      />

      {/* Lớp phủ Watermark động bằng CSS thuần không tốn RAM Canvas */}
      <PhotoWatermarkOverlay
        photoCode={photoCode || displayPhotoCode}
        variant="compact"
      />

      {/* Top-Left: Minimalist Photo ID chip + Cloud Status */}
      {displayPhotoCode && (
        <div
          style={{
            position: 'absolute',
            top: '6px',
            left: '6px',
            backgroundColor: 'rgba(15, 23, 42, 0.85)',
            color: '#34d399',
            fontSize: '0.65rem',
            fontWeight: 700,
            padding: '0.2rem 0.5rem',
            borderRadius: '9999px',
            fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
            backdropFilter: 'blur(4px)',
            border: '1px solid rgba(52, 211, 153, 0.35)',
            maxWidth: '48%',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            boxShadow: '0 2px 5px rgba(0, 0, 0, 0.35)',
            zIndex: 10,
            display: 'flex',
            alignItems: 'center',
            gap: '0.25rem',
          }}
          title={`Photo ID: ${displayPhotoCode}`}
        >
          <MapPin size={10} style={{ color: '#10b981', flexShrink: 0 }} />
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{displayPhotoCode}</span>
          {uploadStatus === 'UPLOADING' && <RefreshCw size={9} className="animate-spin text-amber-400 shrink-0" />}
          {uploadStatus === 'SUCCESS' && (
            <span
              style={{
                width: '6px',
                height: '6px',
                borderRadius: '50%',
                backgroundColor: '#10b981',
                flexShrink: 0,
              }}
              title="Đã lưu Cloudflare R2 an toàn"
            />
          )}
          {uploadStatus === 'ERROR' && (
            <span
              style={{
                width: '6px',
                height: '6px',
                borderRadius: '50%',
                backgroundColor: '#ef4444',
                flexShrink: 0,
              }}
              title="Lỗi tải R2"
            />
          )}
        </div>
      )}

      {/* Top-Right: Minimalist Action Cluster (Chụp Lại + Menu ⋯) */}
      <div
        ref={moreMenuRef}
        style={{
          position: 'absolute',
          top: '6px',
          right: '6px',
          display: 'flex',
          alignItems: 'center',
          gap: '0.35rem',
          zIndex: 20,
        }}
      >
        <button
          type="button"
          onClick={onTriggerCapture}
          title="Mở camera chụp lại ảnh này (có zoom 2 ngón tay)"
          style={{
            backgroundColor: 'rgba(5, 150, 105, 0.92)',
            color: '#ffffff',
            border: '1px solid rgba(255, 255, 255, 0.25)',
            borderRadius: '9999px',
            padding: '0.25rem 0.65rem',
            fontSize: '0.72rem',
            fontWeight: 700,
            display: 'flex',
            alignItems: 'center',
            gap: '0.25rem',
            cursor: 'pointer',
            backdropFilter: 'blur(4px)',
            boxShadow: '0 2px 6px rgba(0, 0, 0, 0.3)',
            userSelect: 'none',
          }}
        >
          <Camera size={12} />
          <span>Chụp lại</span>
        </button>

        <div style={{ position: 'relative' }}>
          <button
            type="button"
            onClick={() => setIsMoreMenuOpen(!isMoreMenuOpen)}
            title="Tùy chọn thao tác khác (Soi, Xoay, Vẽ, Đổi ảnh, Xóa)"
            style={{
              backgroundColor: 'rgba(15, 23, 42, 0.85)',
              color: '#ffffff',
              border: '1px solid rgba(255, 255, 255, 0.2)',
              borderRadius: '50%',
              width: '28px',
              height: '28px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              backdropFilter: 'blur(4px)',
              boxShadow: '0 2px 6px rgba(0, 0, 0, 0.3)',
            }}
          >
            <MoreVertical size={14} />
          </button>

          {isMoreMenuOpen && (
            <div
              style={{
                position: 'absolute',
                top: '32px',
                right: 0,
                backgroundColor: 'rgba(15, 23, 42, 0.96)',
                color: '#f8fafc',
                borderRadius: '0.65rem',
                padding: '0.3rem',
                boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.5), 0 8px 10px -6px rgba(0, 0, 0, 0.5)',
                border: '1px solid rgba(51, 65, 85, 0.8)',
                minWidth: '165px',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.15rem',
                fontSize: '0.75rem',
                backdropFilter: 'blur(8px)',
                zIndex: 30,
              }}
            >
              {/* Xoay 90 độ */}
              <button
                type="button"
                onClick={() => {
                  setIsMoreMenuOpen(false);
                  onRotate90();
                }}
                style={{
                  width: '100%',
                  padding: '0.4rem 0.6rem',
                  borderRadius: '0.4rem',
                  border: 'none',
                  backgroundColor: 'transparent',
                  color: '#f8fafc',
                  textAlign: 'left',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.45rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'rgba(51, 65, 85, 0.6)')}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
              >
                <RotateCw size={13} style={{ color: '#fbbf24' }} />
                <span>Xoay ảnh 90°</span>
              </button>

              {/* Vẽ / Chú thích */}
              {allowAnnotation && (
                <button
                  type="button"
                  onClick={() => {
                    setIsMoreMenuOpen(false);
                    onStartAnnotating();
                  }}
                  style={{
                    width: '100%',
                    padding: '0.4rem 0.6rem',
                    borderRadius: '0.4rem',
                    border: 'none',
                    backgroundColor: 'transparent',
                    color: '#f8fafc',
                    textAlign: 'left',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.45rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'rgba(51, 65, 85, 0.6)')}
                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                >
                  <Edit3 size={13} style={{ color: '#34d399' }} />
                  <span>Vẽ / Ghi chú nứt</span>
                </button>
              )}

              {/* Chụp bằng máy ảnh máy (Native) */}
              <label
                htmlFor={cameraInputId}
                onClick={() => setIsMoreMenuOpen(false)}
                style={{
                  width: '100%',
                  padding: '0.4rem 0.6rem',
                  borderRadius: '0.4rem',
                  backgroundColor: 'transparent',
                  color: '#f8fafc',
                  textAlign: 'left',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.45rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  boxSizing: 'border-box',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'rgba(51, 65, 85, 0.6)')}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
              >
                <Camera size={13} style={{ color: '#38bdf8' }} />
                <span>Dùng máy ảnh máy (Native)</span>
              </label>

              {/* Chọn ảnh từ máy */}
              <label
                htmlFor={galleryInputId}
                onClick={() => setIsMoreMenuOpen(false)}
                style={{
                  width: '100%',
                  padding: '0.4rem 0.6rem',
                  borderRadius: '0.4rem',
                  backgroundColor: 'transparent',
                  color: '#f8fafc',
                  textAlign: 'left',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.45rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  boxSizing: 'border-box',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'rgba(51, 65, 85, 0.6)')}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
              >
                <ImageIcon size={13} style={{ color: '#60a5fa' }} />
                <span>Chọn từ thư viện máy</span>
              </label>

              <div style={{ borderTop: '1px solid rgba(51, 65, 85, 0.8)', margin: '0.2rem 0' }} />

              {/* Xóa ảnh */}
              <button
                type="button"
                onClick={() => {
                  setIsMoreMenuOpen(false);
                  onClear();
                }}
                style={{
                  width: '100%',
                  padding: '0.4rem 0.6rem',
                  borderRadius: '0.4rem',
                  border: 'none',
                  backgroundColor: 'transparent',
                  color: '#f87171',
                  textAlign: 'left',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.45rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.2)')}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
              >
                <Trash2 size={13} />
                <span>Xóa ảnh này</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Bottom Center: Hint */}
      <div
        style={{
          position: 'absolute',
          bottom: '6px',
          left: '50%',
          transform: 'translateX(-50%)',
          pointerEvents: 'none',
          zIndex: 10,
        }}
      >
        <span
          style={{
            fontSize: '0.62rem',
            color: 'rgba(255, 255, 255, 0.75)',
            backgroundColor: 'rgba(0, 0, 0, 0.45)',
            padding: '0.15rem 0.5rem',
            borderRadius: '9999px',
            backdropFilter: 'blur(2px)',
            fontWeight: 500,
            whiteSpace: 'nowrap',
          }}
        >
          Chạm ảnh để phóng to
        </span>
      </div>
    </div>
  );
};
