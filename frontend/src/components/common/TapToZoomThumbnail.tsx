/**
 * TapToZoomThumbnail - Thẻ thumbnail ảnh có tính năng phóng to khi chạm/click
 * Tái sử dụng 100% engine Lightbox + useLightbox đã có sẵn trong PhotoCaptureInput
 * - Hỗ trợ tự động phân giải offline blob:local:// (chống chết ảnh)
 * - Pinch-to-zoom 2 ngón tay (mobile iOS/Android)
 * - Cuộn chuột & kéo rê chuột để zoom/pan (desktop)
 * - Nút bấm phóng to / thu nhỏ trực tiếp (+ / -)
 * - Nhấn vào bất kỳ đâu trên ảnh hoặc badge để phóng to
 */
import React, { useState, useEffect } from 'react';
import { ZoomIn } from 'lucide-react';
import { useLightbox } from './photo-capture/hooks/useLightbox';
import { PhotoLightboxModal } from './photo-capture/components/PhotoLightboxModal';
import { resolveOfflinePhotoUrl } from '../../core/storage/offlinePhotoStorage';

interface TapToZoomThumbnailProps {
  /** URL hoặc base64 của ảnh */
  src: string;
  /** Text hiển thị trong badge góc trên trái (VD: "#1", "Trang 2") */
  label?: string;
  /** Mã photoCode dùng cho nút Tải ảnh trong Lightbox */
  photoCode?: string;
  /** Alt text */
  alt?: string;
  /** Các nút action overlay bổ sung khi hover (xóa, chú thích, v.v.) */
  actions?: React.ReactNode;
  /** Chiều cao khung ảnh (mặc định: aspect-video) */
  aspectClass?: string;
  /** Class bổ sung cho wrapper ngoài */
  className?: string;
}

export const TapToZoomThumbnail: React.FC<TapToZoomThumbnailProps> = ({
  src,
  label,
  photoCode,
  alt = 'Ảnh khảo sát',
  actions,
  aspectClass = 'aspect-video',
  className = '',
}) => {
  const {
    isLightboxOpen,
    setIsLightboxOpen,
    lightboxZoom,
    lightboxPan,
    isLightboxPinching,
    resetLightbox,
    handleZoomIn,
    handleZoomOut,
    handleLightboxTouchStart,
    handleLightboxTouchMove,
    handleLightboxTouchEnd,
    handleLightboxMouseDown,
    handleLightboxMouseMove,
    handleLightboxMouseUp,
    handleLightboxWheel,
  } = useLightbox();

  const [imgLoaded, setImgLoaded] = useState(false);
  const [displayUrl, setDisplayUrl] = useState<string>(src || '');

  // Tự động phân giải offline blob:local:// thành Blob URL hiển thị được trên DOM
  useEffect(() => {
    let isSubscribed = true;
    if (src) {
      resolveOfflinePhotoUrl(src).then((resolved) => {
        if (isSubscribed && resolved) {
          setDisplayUrl(resolved);
        }
      });
    }
    return () => {
      isSubscribed = false;
    };
  }, [src]);

  const handleOpen = () => {
    resetLightbox();
    setIsLightboxOpen(true);
  };

  const currentDisplaySrc = displayUrl || src;

  return (
    <>
      {/* Thẻ thumbnail - Nhấn vào bất kỳ đâu trên ảnh để mở zoom */}
      <div
        onClick={handleOpen}
        className={`relative rounded-lg overflow-hidden border border-slate-300 group bg-slate-900 cursor-pointer ${aspectClass} ${className}`}
        title="Nhấn vào để phóng to"
      >
        <img
          src={currentDisplaySrc}
          alt={alt}
          className="w-full h-full object-cover transition-opacity duration-200"
          style={{ opacity: imgLoaded ? 1 : 0 }}
          onLoad={() => setImgLoaded(true)}
        />

        {/* Badge số thứ tự / nhãn */}
        {label && (
          <span className="absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded bg-black/60 backdrop-blur-sm text-white text-[10px] font-bold pointer-events-none">
            {label}
          </span>
        )}

        {/* Badge "Nhấn vào để phóng to" luôn hiển thị ở dưới cùng */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            handleOpen();
          }}
          className="absolute bottom-0 inset-x-0 flex items-center justify-center gap-1 py-1.5 bg-black/60 hover:bg-black/80 text-white text-[10px] font-semibold transition-colors cursor-zoom-in"
          title="Nhấn vào để phóng to"
          aria-label="Phóng to ảnh"
        >
          <ZoomIn size={11} strokeWidth={2.5} />
          <span>Nhấn vào để phóng to</span>
        </button>

        {/* Overlay các action bổ sung khi hover (xóa, chú thích...) */}
        {actions && (
          <div
            onClick={(e) => e.stopPropagation()}
            className="absolute inset-0 pointer-events-none group-hover:pointer-events-auto"
          >
            {actions}
          </div>
        )}
      </div>

      {/* Lightbox full-screen */}
      <PhotoLightboxModal
        isOpen={isLightboxOpen}
        onClose={() => {
          setIsLightboxOpen(false);
          resetLightbox();
        }}
        imageUrl={currentDisplaySrc}
        photoCode={photoCode}
        lightboxZoom={lightboxZoom}
        lightboxPan={lightboxPan}
        isLightboxPinching={isLightboxPinching}
        onResetZoom={resetLightbox}
        onZoomIn={handleZoomIn}
        onZoomOut={handleZoomOut}
        onTouchStart={handleLightboxTouchStart}
        onTouchMove={handleLightboxTouchMove}
        onTouchEnd={handleLightboxTouchEnd}
        onMouseDown={handleLightboxMouseDown}
        onMouseMove={handleLightboxMouseMove}
        onMouseUp={handleLightboxMouseUp}
        onWheel={handleLightboxWheel}
      />
    </>
  );
};
