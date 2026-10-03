import React, { useState, useEffect } from 'react';
import { X, Download, Loader2, ZoomIn, ZoomOut } from 'lucide-react';
import { PhotoWatermarkOverlay } from './PhotoWatermarkOverlay';
import { downloadWatermarkedImage } from '../../../../utils/cleanImageCompressor';
import { resolveOfflinePhotoUrl } from '../../../../core/storage/offlinePhotoStorage';

interface PhotoLightboxModalProps {
  isOpen: boolean;
  onClose: () => void;
  imageUrl: string;
  photoCode?: string;
  lightboxZoom: number;
  lightboxPan: { x: number; y: number };
  isLightboxPinching: boolean;
  onResetZoom: () => void;
  onZoomIn?: () => void;
  onZoomOut?: () => void;
  onTouchStart: (e: React.TouchEvent<HTMLDivElement>) => void;
  onTouchMove: (e: React.TouchEvent<HTMLDivElement>) => void;
  onTouchEnd: () => void;
  onWheel: (e: React.WheelEvent<HTMLDivElement>) => void;
  onMouseDown?: (e: React.MouseEvent<HTMLDivElement>) => void;
  onMouseMove?: (e: React.MouseEvent<HTMLDivElement>) => void;
  onMouseUp?: () => void;
}

export const PhotoLightboxModal: React.FC<PhotoLightboxModalProps> = ({
  isOpen,
  onClose,
  imageUrl,
  photoCode,
  lightboxZoom,
  lightboxPan,
  isLightboxPinching,
  onResetZoom,
  onZoomIn,
  onZoomOut,
  onTouchStart,
  onTouchMove,
  onTouchEnd,
  onWheel,
  onMouseDown,
  onMouseMove,
  onMouseUp,
}) => {
  const [isExporting, setIsExporting] = useState(false);
  const [displayUrl, setDisplayUrl] = useState<string>(imageUrl || '');

  // Tự động phân giải offline blob:local:// thành Blob URL hiển thị được trên DOM
  useEffect(() => {
    let isSubscribed = true;
    if (imageUrl) {
      resolveOfflinePhotoUrl(imageUrl).then((resolved) => {
        if (isSubscribed && resolved) {
          setDisplayUrl(resolved);
        }
      });
    }
    return () => {
      isSubscribed = false;
    };
  }, [imageUrl]);

  if (!isOpen || !imageUrl) return null;

  const currentDisplaySrc = displayUrl || imageUrl;

  const handleDownload = async () => {
    try {
      setIsExporting(true);
      const filename = `${photoCode || 'photo'}_${Date.now()}.jpg`;
      await downloadWatermarkedImage(currentDisplaySrc, filename, {
        photoCode,
        timestamp: new Date().toLocaleString('vi-VN'),
      });
    } catch (err) {
      console.error('Không thể xuất ảnh có watermark:', err);
    } finally {
      setIsExporting(false);
    }
  };

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
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          {onZoomOut && (
            <button
              type="button"
              onClick={onZoomOut}
              disabled={lightboxZoom <= 1.0}
              style={{
                backgroundColor: 'rgba(255, 255, 255, 0.15)',
                color: '#ffffff',
                border: 'none',
                borderRadius: '50%',
                width: '32px',
                height: '32px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: lightboxZoom <= 1.0 ? 'not-allowed' : 'pointer',
                opacity: lightboxZoom <= 1.0 ? 0.4 : 1,
              }}
              title="Thu nhỏ"
            >
              <ZoomOut size={16} />
            </button>
          )}

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
            <span>{lightboxZoom.toFixed(1)}x (Về 1.0x)</span>
          </button>

          {onZoomIn && (
            <button
              type="button"
              onClick={onZoomIn}
              disabled={lightboxZoom >= 4.0}
              style={{
                backgroundColor: 'rgba(255, 255, 255, 0.15)',
                color: '#ffffff',
                border: 'none',
                borderRadius: '50%',
                width: '32px',
                height: '32px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: lightboxZoom >= 4.0 ? 'not-allowed' : 'pointer',
                opacity: lightboxZoom >= 4.0 ? 0.4 : 1,
              }}
              title="Phóng to"
            >
              <ZoomIn size={16} />
            </button>
          )}

          <button
            type="button"
            onClick={handleDownload}
            disabled={isExporting}
            style={{
              backgroundColor: 'rgba(37, 99, 235, 0.85)',
              color: '#ffffff',
              border: 'none',
              borderRadius: '9999px',
              padding: '0.3rem 0.85rem',
              fontSize: '0.82rem',
              fontWeight: 700,
              cursor: isExporting ? 'wait' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
            title="Tải ảnh JPEG có dập sẵn dấu chuẩn CRLG-CRSRI-TT"
          >
            {isExporting ? <Loader2 size={15} className="animate-spin" /> : <Download size={15} />}
            <span>{isExporting ? 'Đang xuất...' : 'Tải ảnh có dấu (JPG)'}</span>
          </button>
        </div>

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

      {/* Vùng cảm ứng zoom 2 ngón tay và kéo rê (Mobile Touch + Desktop Mouse) */}
      <div
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        onWheel={onWheel}
        onMouseDown={onMouseDown}
        onMouseMove={onMouseMove}
        onMouseUp={onMouseUp}
        style={{
          position: 'relative',
          flex: 1,
          overflow: 'hidden',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: lightboxZoom > 1.0 ? 'grab' : 'zoom-in',
        }}
      >
        <img
          src={currentDisplaySrc}
          alt="Soi ảnh chi tiết"
          draggable={false}
          style={{
            maxWidth: '100%',
            maxHeight: '100%',
            objectFit: 'contain',
            transform: `scale(${lightboxZoom}) translate(${lightboxPan.x / lightboxZoom}px, ${lightboxPan.y / lightboxZoom}px)`,
            transformOrigin: 'center center',
            transition: isLightboxPinching ? 'none' : 'transform 0.1s ease-out',
            pointerEvents: 'none',
          }}
        />

        {/* Lớp phủ Watermark toàn màn hình sắc nét */}
        {photoCode && (
          <PhotoWatermarkOverlay
            photoCode={photoCode}
            variant="full"
          />
        )}

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
          Chụm 2 ngón tay hoặc cuộn chuột để phóng to soi vạch thước đo • Kéo để di chuyển
        </div>
      </div>
    </div>
  );
};
