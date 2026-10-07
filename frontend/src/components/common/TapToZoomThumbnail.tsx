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
import { ZoomIn, RefreshCw } from 'lucide-react';
import { useLightbox } from './photo-capture/hooks/useLightbox';
import { PhotoLightboxModal } from './photo-capture/components/PhotoLightboxModal';
import { resolveOfflinePhotoUrl, getSafeDisplayUrl } from '../../core/storage/offlinePhotoStorage';
import { useStorageInfo } from '../../core/services/storageInfoService';

interface TapToZoomThumbnailProps {
  /** URL hoặc base64 của ảnh */
  src: string;
  /** Text hiển thị trong badge góc trên trái (VD: "#1", "Trang 2") */
  label?: string;
  /** Mã photoCode dùng cho nút Tải ảnh trong Lightbox */
  photoCode?: string;
  /** Alt text */
  alt?: string;
  /** Tooltip hoặc tiêu đề mô tả ảnh */
  title?: string;
  /** Các nút action overlay bổ sung khi hover (xóa, chú thích, v.v.) */
  actions?: React.ReactNode;
  /** Chiều cao khung ảnh (mặc định: aspect-video) */
  aspectClass?: string;
  /** Tỉ lệ khung hình tiện lợi */
  aspectRatio?: 'video' | 'square' | 'portrait' | 'auto' | string;
  /** Class bổ sung cho wrapper ngoài */
  className?: string;
  /** Trạng thái upload R2 nếu có */
  uploadStatus?: 'UPLOADING' | 'SUCCESS' | 'ERROR' | 'IDLE';
  /** Hàm thử lại upload R2 */
  onRetryUpload?: () => void;
}

export const TapToZoomThumbnail: React.FC<TapToZoomThumbnailProps> = ({
  src,
  label,
  photoCode,
  alt = 'Ảnh khảo sát',
  title,
  actions,
  aspectClass,
  aspectRatio,
  className = '',
  uploadStatus,
  onRetryUpload,
}) => {
  const storageInfo = useStorageInfo();
  const effectiveAspect = aspectClass || (
    aspectRatio === 'square' ? 'aspect-square' :
    aspectRatio === 'portrait' ? 'aspect-[3/4]' :
    aspectRatio === 'auto' ? '' :
    'aspect-video'
  );
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
  const [displayUrl, setDisplayUrl] = useState<string>(() => getSafeDisplayUrl(src));

  // Tự động phân giải offline blob:local:// thành Blob URL hiển thị được trên DOM
  useEffect(() => {
    let isSubscribed = true;
    if (src) {
      const immediate = getSafeDisplayUrl(src);
      if (immediate && isSubscribed) {
        setDisplayUrl(immediate);
      }
      resolveOfflinePhotoUrl(src).then((resolved) => {
        if (isSubscribed && resolved) {
          setDisplayUrl(resolved);
        }
      });
    } else {
      setDisplayUrl('');
    }
    return () => {
      isSubscribed = false;
    };
  }, [src]);

  const handleOpen = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    resetLightbox();
    setIsLightboxOpen(true);
  };

  const currentDisplaySrc = displayUrl || getSafeDisplayUrl(src);
  const isR2Synced = uploadStatus === 'SUCCESS' || (src && (src.startsWith('http') || src.startsWith('/uploads')));
  const isR2Uploading = uploadStatus === 'UPLOADING';
  const isR2Error = uploadStatus === 'ERROR';

  return (
    <>
      {/* Thẻ thumbnail - Nhấn vào bất kỳ đâu trên ảnh để mở zoom */}
      <div
        onClick={handleOpen}
        className={`relative rounded-lg overflow-hidden border border-slate-300 group bg-slate-900 cursor-pointer select-none ${effectiveAspect} ${className}`}
        title={title || "Nhấn vào để phóng to"}
      >
        {currentDisplaySrc ? (
          <img
            src={currentDisplaySrc}
            alt={alt}
            className="w-full h-full object-cover transition-opacity duration-200"
            style={{ opacity: imgLoaded ? 1 : 0.85 }}
            onLoad={() => setImgLoaded(true)}
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center bg-slate-800 text-slate-400 text-[10px] p-1 text-center leading-tight">
            <span>Chưa có trên máy</span>
            <span className="text-[8px] text-slate-500 mt-0.5">(Cần KSV đẩy lên Cloud)</span>
          </div>
        )}

        {/* Top-Left: Badge số thứ tự + Trạng thái Cloudflare R2 */}
        <div className="absolute top-1.5 left-1.5 flex items-center gap-1 z-10">
          {label && (
            <span className="px-1.5 py-0.5 rounded bg-black/60 backdrop-blur-xs text-white text-[10px] font-bold pointer-events-none">
              {label}
            </span>
          )}

          {isR2Uploading && (
            <span
              className="px-1.5 py-0.5 rounded-full bg-amber-950/80 border border-amber-500/40 text-amber-300 text-[9px] font-bold flex items-center gap-1 shadow-xs backdrop-blur-xs pointer-events-none"
              title={storageInfo.syncingText}
            >
              <RefreshCw size={8} className="animate-spin text-amber-400" />
              <span>{storageInfo.shortUploadingBadge}</span>
            </span>
          )}

          {isR2Synced && !isR2Uploading && (
            <span
              className={`px-1.5 py-0.5 rounded-full border text-[9px] font-bold flex items-center gap-1 shadow-xs backdrop-blur-xs pointer-events-none ${
                storageInfo.isLocal
                  ? 'bg-slate-950/80 border-indigo-500/40 text-indigo-300'
                  : 'bg-emerald-950/80 border-emerald-500/40 text-emerald-400'
              }`}
              title={storageInfo.syncedText}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${storageInfo.isLocal ? 'bg-indigo-400' : 'bg-emerald-400'}`} />
              <span>{storageInfo.shortBadge}</span>
            </span>
          )}

          {!isR2Synced && !isR2Uploading && !isR2Error && (
            <span
              className="px-1.5 py-0.5 rounded-full bg-amber-950/80 border border-amber-500/40 text-amber-300 text-[9px] font-bold flex items-center gap-1 shadow-xs backdrop-blur-xs pointer-events-none"
              title={`Chưa lưu vào ${storageInfo.providerLabel} (Lưu tạm trên thiết bị)`}
            >
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
              <span>{storageInfo.unsyncedText}</span>
            </span>
          )}

          {isR2Error && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                if (onRetryUpload) onRetryUpload();
              }}
              className="px-2 py-0.5 rounded-full bg-red-600 hover:bg-red-700 text-white text-[9px] font-bold flex items-center gap-1 shadow-xs pointer-events-auto cursor-pointer animate-pulse"
              title="Lỗi đồng bộ R2 - Nhấn để thử lại"
            >
              <RefreshCw size={8} />
              <span>Thử lại R2</span>
            </button>
          )}
        </div>

        {/* Badge "Nhấn vào để phóng to" luôn hiển thị ở dưới cùng */}
        <button
          type="button"
          onClick={handleOpen}
          className="absolute bottom-0 inset-x-0 flex items-center justify-center gap-1 py-1.5 bg-black/60 hover:bg-black/80 text-white text-[10px] font-semibold transition-colors cursor-pointer z-10"
          title="Nhấn vào để phóng to"
          aria-label="Phóng to ảnh"
        >
          <ZoomIn size={11} strokeWidth={2.5} />
          <span>Nhấn vào để phóng to</span>
        </button>

        {/* Overlay các action bổ sung: luôn giữ pointer-events-none ở wrapper để không chặn click zoom của thẻ, từng nút con tự bật pointer-events-auto */}
        {actions && (
          <div className="absolute inset-0 pointer-events-none z-20">
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
