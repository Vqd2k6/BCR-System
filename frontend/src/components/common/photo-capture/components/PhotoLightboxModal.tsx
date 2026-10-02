import React from 'react';
import { X } from 'lucide-react';

interface PhotoLightboxModalProps {
  isOpen: boolean;
  onClose: () => void;
  imageUrl: string;
  lightboxZoom: number;
  lightboxPan: { x: number; y: number };
  isLightboxPinching: boolean;
  onResetZoom: () => void;
  onTouchStart: (e: React.TouchEvent<HTMLDivElement>) => void;
  onTouchMove: (e: React.TouchEvent<HTMLDivElement>) => void;
  onTouchEnd: () => void;
  onWheel: (e: React.WheelEvent<HTMLDivElement>) => void;
}

export const PhotoLightboxModal: React.FC<PhotoLightboxModalProps> = ({
  isOpen,
  onClose,
  imageUrl,
  lightboxZoom,
  lightboxPan,
  isLightboxPinching,
  onResetZoom,
  onTouchStart,
  onTouchMove,
  onTouchEnd,
  onWheel,
}) => {
  if (!isOpen || !imageUrl) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        backgroundColor: 'rgba(0, 0, 0, 0.94)',
        display: 'flex',
        flexDirection: 'column',
        userSelect: 'none',
        touchAction: 'none',
      }}
    >
      {/* Top Bar Lightbox */}
      <div
        style={{
          padding: '0.75rem 1rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          backgroundColor: 'rgba(0,0,0,0.5)',
          zIndex: 30,
        }}
      >
        <button
          type="button"
          onClick={onResetZoom}
          style={{
            backgroundColor: lightboxZoom > 1.0 ? 'rgba(16, 185, 129, 0.9)' : 'rgba(255, 255, 255, 0.15)',
            color: '#ffffff',
            border: 'none',
            borderRadius: '9999px',
            padding: '0.3rem 0.85rem',
            fontSize: '0.85rem',
            fontWeight: 800,
            cursor: 'pointer',
          }}
          title="Chạm để đặt lại 1.0x"
        >
          <span>{lightboxZoom.toFixed(1)}x (Chạm để về 1.0x)</span>
        </button>

        <button
          type="button"
          onClick={onClose}
          style={{
            background: 'rgba(255, 255, 255, 0.2)',
            border: 'none',
            borderRadius: '50%',
            width: '40px',
            height: '40px',
            color: '#ffffff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
          }}
          title="Đóng soi ảnh"
        >
          <X size={20} />
        </button>
      </div>

      {/* Vùng cảm ứng zoom 2 ngón tay và kéo rê */}
      <div
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onWheel={onWheel}
        style={{
          position: 'relative',
          flex: 1,
          overflow: 'hidden',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <img
          src={imageUrl}
          alt="Soi ảnh chi tiết"
          style={{
            maxWidth: '100%',
            maxHeight: '100%',
            objectFit: 'contain',
            transform: `scale(${lightboxZoom}) translate(${lightboxPan.x / lightboxZoom}px, ${lightboxPan.y / lightboxZoom}px)`,
            transformOrigin: 'center center',
            transition: isLightboxPinching ? 'none' : 'transform 0.1s ease-out',
            cursor: lightboxZoom > 1 ? 'grab' : 'zoom-in',
          }}
        />

        {/* Gợi ý thao tác dưới chân Lightbox */}
        <div
          style={{
            position: 'absolute',
            bottom: '1rem',
            backgroundColor: 'rgba(0, 0, 0, 0.65)',
            color: '#f8fafc',
            fontSize: '0.72rem',
            fontWeight: 600,
            padding: '0.25rem 0.75rem',
            borderRadius: '9999px',
            backdropFilter: 'blur(3px)',
            border: '1px solid rgba(255, 255, 255, 0.2)',
            pointerEvents: 'none',
            zIndex: 10,
          }}
        >
          Chụm 2 ngón tay để phóng to soi vạch thước đo • Kéo để di chuyển
        </div>
      </div>
    </div>
  );
};
