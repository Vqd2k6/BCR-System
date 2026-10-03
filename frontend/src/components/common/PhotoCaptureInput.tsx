import React, { useState, useEffect, useId, useMemo } from 'react';
import { AlertTriangle } from 'lucide-react';
import { ImageAnnotationModal } from './ImageAnnotationModal';
import {
  generateMetroPhotoCode,
  MetroWatermarkOptions,
} from '../../utils/watermarkEngine';
import { PhotoCaptureProps, AspectRatioType } from './photo-capture/types';
import { usePhotoUpload } from './photo-capture/hooks/usePhotoUpload';
import { useLiveCamera } from './photo-capture/hooks/useLiveCamera';
import { useLightbox } from './photo-capture/hooks/useLightbox';
import { LiveCameraModal } from './photo-capture/components/LiveCameraModal';
import { PhotoLightboxModal } from './photo-capture/components/PhotoLightboxModal';
import { PhotoPreviewCard } from './photo-capture/components/PhotoPreviewCard';
import { PhotoEmptyState } from './photo-capture/components/PhotoEmptyState';

export type { PhotoCaptureProps };

export const PhotoCaptureInput: React.FC<PhotoCaptureProps> = ({
  value,
  onChange,
  label,
  watermarkText,
  watermarkOptions,
  photoCode,
  allowNotApplicable = false,
  isNotApplicable = false,
  onToggleNotApplicable,
  naReason = '',
  onNaReasonChange,
  required = false,
  height = '180px',
  recommendedOrientation,
  orientationHint,
  allowAnnotation = true,
  annotationTitle,
  initialAnnotationTool,
}) => {
  const uniqueId = useId().replace(/:/g, '_');
  const cameraInputId = `cam_${uniqueId}`;
  const galleryInputId = `gal_${uniqueId}`;

  const [isAnnotating, setIsAnnotating] = useState(false);
  const [detectedAspectRatio, setDetectedAspectRatio] = useState<AspectRatioType | null>(null);

  // Tính toán options watermark hợp nhất (ưu tiên watermarkOptions, fallback watermarkText)
  const effectiveWatermarkOptions = useMemo<MetroWatermarkOptions | undefined>(() => {
    if (watermarkOptions) return watermarkOptions;
    if (watermarkText) return { customCode: watermarkText };
    return undefined;
  }, [watermarkOptions, watermarkText]);

  // Mã định danh hiển thị
  const displayPhotoCode = useMemo(() => {
    if (photoCode) return photoCode;
    if (effectiveWatermarkOptions) return generateMetroPhotoCode(effectiveWatermarkOptions);
    return watermarkText || '';
  }, [photoCode, effectiveWatermarkOptions, watermarkText]);

  // Detect image aspect ratio when value changes
  useEffect(() => {
    if (!value) {
      setDetectedAspectRatio(null);
      return;
    }
    const img = new Image();
    img.onload = () => {
      if (img.naturalWidth > img.naturalHeight * 1.08) {
        setDetectedAspectRatio('landscape');
      } else if (img.naturalHeight > img.naturalWidth * 1.08) {
        setDetectedAspectRatio('portrait');
      } else {
        setDetectedAspectRatio('square');
      }
    };
    img.src = value;
  }, [value]);

  // Quản lý upload & xử lý ảnh
  const {
    uploadStatus,
    localPreview,
    setLocalPreview,
    hasLoadError,
    setHasLoadError,
    startDirectUpload,
    uploadToServer,
    processAndStoreCleanPhoto,
    handleFileChange,
    handleClear,
    handleRotate90,
  } = usePhotoUpload({
    value,
    onChange,
    effectiveWatermarkOptions,
    displayPhotoCode,
    label,
    isNotApplicable,
    onToggleNotApplicable,
    onClearAspectRatio: () => setDetectedAspectRatio(null),
  });

  // Quản lý Live Camera
  const {
    isLiveCameraOpen,
    setIsLiveCameraOpen,
    cameraLoading,
    cameraError,
    zoomLevel,
    setZoomLevel,
    isPinching,
    videoRef,
    applyHardwareZoom,
    handleTriggerNativeCamera,
    handleTriggerCapture,
    handleCameraTouchStart,
    handleCameraTouchMove,
    handleCameraTouchEnd,
    handleCameraWheel,
    handleCaptureLiveFrame,
    setFacingMode,
  } = useLiveCamera({
    effectiveWatermarkOptions,
    cameraInputId,
    onSuccessCapture: async ({ blob, photoCode }) => {
      try {
        const { blobUrl, localId } = await processAndStoreCleanPhoto(blob);
        setLocalPreview(blobUrl);
        onChange(blobUrl, photoCode);
        if (isNotApplicable && onToggleNotApplicable) {
          onToggleNotApplicable(false);
        }
        startDirectUpload(blob, photoCode, localId);
      } catch (err) {
        console.warn('[PhotoCaptureInput] Lỗi lưu ảnh camera:', err);
      }
    },
  });

  // Quản lý Lightbox soi ảnh chi tiết
  const {
    isLightboxOpen,
    setIsLightboxOpen,
    lightboxZoom,
    setLightboxZoom,
    lightboxPan,
    setLightboxPan,
    isLightboxPinching,
    resetLightbox,
    handleLightboxTouchStart,
    handleLightboxTouchMove,
    handleLightboxTouchEnd,
    handleLightboxWheel,
  } = useLightbox();

  const isOrientationMismatch =
    value &&
    recommendedOrientation &&
    detectedAspectRatio &&
    (recommendedOrientation === 'square'
      ? detectedAspectRatio !== 'square'
      : detectedAspectRatio !== 'square' && detectedAspectRatio !== recommendedOrientation);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', width: '100%' }}>
      {/* 1. Hardware Camera Input (capture="environment") */}
      <input
        id={cameraInputId}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleFileChange}
        style={{
          position: 'absolute',
          width: '1px',
          height: '1px',
          padding: 0,
          margin: '-1px',
          overflow: 'hidden',
          clip: 'rect(0, 0, 0, 0)',
          whiteSpace: 'nowrap',
          border: 0,
          opacity: 0,
          pointerEvents: 'none',
        }}
      />

      {/* 2. Gallery Input */}
      <input
        id={galleryInputId}
        type="file"
        accept="image/*"
        onChange={handleFileChange}
        style={{
          position: 'absolute',
          width: '1px',
          height: '1px',
          padding: 0,
          margin: '-1px',
          overflow: 'hidden',
          clip: 'rect(0, 0, 0, 0)',
          whiteSpace: 'nowrap',
          border: 0,
          opacity: 0,
          pointerEvents: 'none',
        }}
      />

      {/* Label & N/A checkbox row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.35rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', flexWrap: 'wrap' }}>
          {label && (
            <label style={{ fontSize: '0.8rem', fontWeight: 700, color: '#1e293b' }}>
              {label} {required && <span style={{ color: '#ef4444' }}>*</span>}
            </label>
          )}

          {recommendedOrientation === 'landscape' && (
            <span
              style={{
                fontSize: '0.675rem',
                fontWeight: 700,
                padding: '0.15rem 0.5rem',
                borderRadius: '9999px',
                backgroundColor: '#f0f9ff',
                color: '#0369a1',
                border: '1px solid #bae6fd',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.25rem',
              }}
              title="Khảo sát viên vui lòng xoay ngang điện thoại khi chụp để ảnh đạt chuẩn ngang 4:3 của báo cáo"
            >
              🔄 Xoay ngang máy khi chụp (4:3)
            </span>
          )}

          {recommendedOrientation === 'portrait' && (
            <span
              style={{
                fontSize: '0.675rem',
                fontWeight: 700,
                padding: '0.15rem 0.5rem',
                borderRadius: '9999px',
                backgroundColor: '#faf5ff',
                color: '#7e22ce',
                border: '1px solid #e9d5ff',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.25rem',
              }}
              title="Khảo sát viên cầm dọc điện thoại để chụp trọn vẹn chiều cao công trình"
            >
              📱 Cầm dọc máy khi chụp (3:4)
            </span>
          )}
        </div>

        {allowNotApplicable && onToggleNotApplicable && (
          <label
            style={{
              fontSize: '0.75rem',
              color: '#64748b',
              display: 'flex',
              alignItems: 'center',
              gap: '0.35rem',
              cursor: 'pointer',
            }}
          >
            <input
              type="checkbox"
              checked={isNotApplicable}
              onChange={(e) => {
                onToggleNotApplicable(e.target.checked);
                if (e.target.checked) onChange('');
              }}
              style={{ accentColor: '#0284c7' }}
            />
            <span>Không tồn tại / N/A</span>
          </label>
        )}
      </div>

      {/* Orientation mismatch gentle warning banner */}
      {isOrientationMismatch && (
        <div
          style={{
            fontSize: '0.72rem',
            padding: '0.35rem 0.65rem',
            backgroundColor: '#fffbeb',
            border: '1px solid #fde68a',
            color: '#b45309',
            borderRadius: '0.5rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.35rem',
          }}
        >
          <AlertTriangle size={13} style={{ flexShrink: 0 }} />
          <span>
            {recommendedOrientation === 'landscape'
              ? 'Ảnh đang là ảnh dọc. Báo cáo khuyến nghị xoay ngang điện thoại (4:3) để vừa khung in báo cáo.'
              : 'Ảnh đang là ảnh ngang. Báo cáo khuyến nghị cầm dọc điện thoại (3:4) để lấy trọn chiều cao công trình.'}
          </span>
        </div>
      )}

      {/* N/A Reason box if N/A is checked */}
      {isNotApplicable ? (
        <div
          style={{
            padding: '0.75rem',
            backgroundColor: '#f8fafc',
            border: '1px dashed #cbd5e1',
            borderRadius: '0.65rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.35rem',
          }}
        >
          <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>
            Lý do không có ảnh / N/A:
          </span>
          <input
            type="text"
            className="form-control"
            placeholder="Ví dụ: Nhà không gắn biển số / Bị nhà đối diện che khuất hoàn toàn..."
            value={naReason}
            onChange={(e) => onNaReasonChange && onNaReasonChange(e.target.value)}
            style={{ fontSize: '0.775rem' }}
          />
        </div>
      ) : value ? (
        /* Image Preview Card */
        <PhotoPreviewCard
          value={value}
          localPreview={localPreview}
          hasLoadError={hasLoadError}
          onSetHasLoadError={setHasLoadError}
          height={height}
          photoCode={photoCode}
          displayPhotoCode={displayPhotoCode}
          label={label}
          uploadStatus={uploadStatus}
          allowAnnotation={allowAnnotation}
          cameraInputId={cameraInputId}
          galleryInputId={galleryInputId}
          onOpenLightbox={() => setIsLightboxOpen(true)}
          onTriggerCapture={handleTriggerCapture}
          onRotate90={handleRotate90}
          onStartAnnotating={() => setIsAnnotating(true)}
          onClear={handleClear}
        />
      ) : (
        /* Empty State */
        <PhotoEmptyState
          height={height}
          label={label}
          orientationHint={orientationHint}
          cameraInputId={cameraInputId}
          galleryInputId={galleryInputId}
          onTriggerCapture={handleTriggerCapture}
        />
      )}

      {/* Modal for image annotations */}
      {isAnnotating && value && (
        <ImageAnnotationModal
          isOpen={isAnnotating}
          imageUrl={value}
          title={annotationTitle || `Ghi chú & Vẽ trên ${label || 'ảnh'}`}
          initialTool={initialAnnotationTool || (label?.includes('P-04') ? 'ARROW' : 'PEN')}
          onSave={(annotated) => {
            setLocalPreview(annotated);
            onChange(annotated);
            uploadToServer(annotated, displayPhotoCode);
            setIsAnnotating(false);
          }}
          onClose={() => setIsAnnotating(false)}
        />
      )}

      {/* Live Camera Viewfinder Modal */}
      <LiveCameraModal
        isOpen={isLiveCameraOpen}
        onClose={() => setIsLiveCameraOpen(false)}
        videoRef={videoRef}
        zoomLevel={zoomLevel}
        isPinching={isPinching}
        cameraLoading={cameraLoading}
        cameraError={cameraError}
        onResetZoom={() => {
          setZoomLevel(1.0);
          applyHardwareZoom(1.0);
        }}
        onSwitchCamera={() => setFacingMode((prev) => (prev === 'environment' ? 'user' : 'environment'))}
        onTriggerNativeCamera={handleTriggerNativeCamera}
        onCaptureFrame={handleCaptureLiveFrame}
        onTouchStart={handleCameraTouchStart}
        onTouchMove={handleCameraTouchMove}
        onTouchEnd={handleCameraTouchEnd}
        onWheel={handleCameraWheel}
      />

      {/* Lightbox Soi Ảnh Chi Tiết */}
      <PhotoLightboxModal
        isOpen={isLightboxOpen}
        onClose={() => {
          setIsLightboxOpen(false);
          resetLightbox();
        }}
        imageUrl={hasLoadError && localPreview ? localPreview : value}
        photoCode={displayPhotoCode}
        lightboxZoom={lightboxZoom}
        lightboxPan={lightboxPan}
        isLightboxPinching={isLightboxPinching}
        onResetZoom={resetLightbox}
        onTouchStart={handleLightboxTouchStart}
        onTouchMove={handleLightboxTouchMove}
        onTouchEnd={handleLightboxTouchEnd}
        onWheel={handleLightboxWheel}
      />
    </div>
  );
};
