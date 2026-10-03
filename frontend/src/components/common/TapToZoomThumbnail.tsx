/**
 * TapToZoomThumbnail - Thẻ thumbnail ảnh có tính năng phóng to khi chạm/click
 * Tái sử dụng 100% engine Lightbox + useLightbox đã có sẵn trong PhotoCaptureInput
 * - Pinch-to-zoom 2 ngón tay (mobile iOS/Android)
 * - Cuộn chuột để zoom (desktop)
 * - Kéo rê ảnh khi zoom > 1x
 * - Nhấn "1.0x" hoặc nút X để đóng / reset zoom
 */
import React, { useState } from 'react';
import { ZoomIn } from 'lucide-react';
import { useLightbox } from './photo-capture/hooks/useLightbox';
import { PhotoLightboxModal } from './photo-capture/components/PhotoLightboxModal';

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
    handleLightboxTouchStart,
    handleLightboxTouchMove,
    handleLightboxTouchEnd,
    handleLightboxWheel,
  } = useLightbox();

  const [imgLoaded, setImgLoaded] = useState(false);

  const handleOpen = () => {
    resetLightbox();
    setIsLightboxOpen(true);
  };

  return (
    <>
      {/* Thẻ thumbnail */}
      <div
        className={`relative rounded-lg overflow-hidden border border-slate-300 group bg-slate-900 ${aspectClass} ${className}`}
      >
        <img
          src={src}
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

        {/* Badge "Chạm để phóng to" luôn hiển thị ở dưới cùng */}
        <button
          type="button"
          onClick={handleOpen}
          className="absolute bottom-0 inset-x-0 flex items-center justify-center gap-1 py-1.5 bg-black/55 hover:bg-black/75 text-white text-[10px] font-semibold transition-colors cursor-zoom-in"
          title="Chạm để phóng to"
          aria-label="Phóng to ảnh"
        >
          <ZoomIn size={11} strokeWidth={2.5} />
          <span>Chạm để phóng to</span>
        </button>

        {/* Overlay các action bổ sung khi hover (xóa, chú thích...) */}
        {actions && (
          <div className="absolute inset-0 pointer-events-none group-hover:pointer-events-auto">
            {actions}
          </div>
        )}
      </div>

      {/* Lightbox full-screen giống PhotoCaptureInput */}
      <PhotoLightboxModal
        isOpen={isLightboxOpen}
        onClose={() => {
          setIsLightboxOpen(false);
          resetLightbox();
        }}
        imageUrl={src}
        photoCode={photoCode}
        lightboxZoom={lightboxZoom}
        lightboxPan={lightboxPan}
        isLightboxPinching={isLightboxPinching}
        onResetZoom={resetLightbox}
        onTouchStart={handleLightboxTouchStart}
        onTouchMove={handleLightboxTouchMove}
        onTouchEnd={handleLightboxTouchEnd}
        onWheel={handleLightboxWheel}
      />
    </>
  );
};
