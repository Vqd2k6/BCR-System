import React, { useRef, useState, useEffect, useId } from 'react';
import { Camera, Trash2, MapPin, Edit3, AlertTriangle, Compass, Image as ImageIcon, RefreshCw, X, Video } from 'lucide-react';
import { ImageAnnotationModal } from './ImageAnnotationModal';

interface Props {
  value: string; // Base64 or image URL
  onChange: (photoUrl: string) => void;
  label?: string;
  watermarkText?: string;
  allowNotApplicable?: boolean;
  isNotApplicable?: boolean;
  onToggleNotApplicable?: (na: boolean) => void;
  naReason?: string;
  onNaReasonChange?: (reason: string) => void;
  required?: boolean;
  height?: number | string;
  recommendedOrientation?: 'landscape' | 'portrait' | 'square';
  orientationHint?: string;
  allowAnnotation?: boolean;
  annotationTitle?: string;
  initialAnnotationTool?: 'ARROW' | 'PEN' | 'CIRCLE' | 'RECT' | 'TEXT';
}

export const PhotoCaptureInput: React.FC<Props> = ({
  value,
  onChange,
  label,
  watermarkText,
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
  const [detectedAspectRatio, setDetectedAspectRatio] = useState<'landscape' | 'portrait' | 'square' | null>(null);

  // In-App Live Camera State
  const [isLiveCameraOpen, setIsLiveCameraOpen] = useState(false);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [cameraLoading, setCameraLoading] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

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

  const compressImage = (file: File): Promise<string> => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (event) => {
        const rawBase64 = event.target?.result as string;
        if (!rawBase64) {
          resolve('');
          return;
        }
        const img = new Image();
        img.onload = () => {
          const maxDim = 1920;
          let width = img.naturalWidth;
          let height = img.naturalHeight;

          if (width > maxDim || height > maxDim) {
            if (width > height) {
              height = Math.round((height * maxDim) / width);
              width = maxDim;
            } else {
              width = Math.round((width * maxDim) / height);
              height = maxDim;
            }
          }

          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            resolve(rawBase64);
            return;
          }

          ctx.drawImage(img, 0, 0, width, height);
          const compressed = canvas.toDataURL('image/jpeg', 0.82);
          resolve(compressed);
        };
        img.onerror = () => resolve(rawBase64);
        img.src = rawBase64;
      };
      reader.onerror = () => resolve('');
      reader.readAsDataURL(file);
    });
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const base64 = await compressImage(file);
      if (base64) {
        onChange(base64);
        if (isNotApplicable && onToggleNotApplicable) {
          onToggleNotApplicable(false);
        }
      }
    } catch (_err) {
      console.warn('Image compression fallback');
    }
    e.target.value = '';
  };

  const handleClear = () => {
    onChange('');
    setDetectedAspectRatio(null);
  };

  // Dừng stream camera khi đóng
  const stopLiveCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setIsLiveCameraOpen(false);
    setCameraLoading(false);
    setCameraError(null);
  };

  // Khởi động luồng WebRTC camera
  useEffect(() => {
    if (!isLiveCameraOpen) return;
    let active = true;
    setCameraLoading(true);
    setCameraError(null);

    const startStream = async () => {
      try {
        if (!navigator?.mediaDevices?.getUserMedia) {
          throw new Error('Thiết bị không hỗ trợ live camera hoặc cần kết nối HTTPS.');
        }
        if (streamRef.current) {
          streamRef.current.getTracks().forEach((t) => t.stop());
        }
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: facingMode },
            width: { ideal: 1920 },
            height: { ideal: 1080 },
          },
          audio: false,
        });

        if (active && videoRef.current) {
          streamRef.current = stream;
          videoRef.current.srcObject = stream;
          videoRef.current.play();
          setCameraLoading(false);
        } else {
          stream.getTracks().forEach((t) => t.stop());
        }
      } catch (err: any) {
        if (active) {
          console.warn('Lỗi mở WebRTC camera:', err);
          setCameraLoading(false);
          setCameraError(err?.message || 'Không thể truy cập camera. Vui lòng cấp quyền hoặc dùng nút camera hệ thống.');
        }
      }
    };

    startStream();

    return () => {
      active = false;
      if (streamRef.current) {
        streamRef.current.getTracks().forEach((t) => t.stop());
        streamRef.current = null;
      }
    };
  }, [isLiveCameraOpen, facingMode]);

  // Chụp ảnh từ luồng WebRTC
  const handleCaptureLiveFrame = () => {
    if (!videoRef.current) return;
    const video = videoRef.current;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
    onChange(dataUrl);
    if (isNotApplicable && onToggleNotApplicable) {
      onToggleNotApplicable(false);
    }
    stopLiveCamera();
  };

  const isOrientationMismatch =
    value &&
    recommendedOrientation &&
    detectedAspectRatio &&
    detectedAspectRatio !== 'square' &&
    detectedAspectRatio !== recommendedOrientation;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', width: '100%' }}>
      {/* 1. Hardware Camera Input (capture="environment") kích hoạt trực tiếp từ <label htmlFor={cameraInputId}> */}
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

      {/* 2. Gallery Input (tải ảnh từ thư viện thiết bị) */}
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

          {/* Orientation Recommendation Badge */}
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
              title="Khuyến nghị xoay ngang điện thoại để trang in báo cáo không bị méo"
            >
              📐 Khuyến nghị: Ảnh NGANG (16:9 / 4:3)
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
              title="Khuyến nghị cầm dọc điện thoại để chụp trọn vẹn tầng cao"
            >
              📐 Khuyến nghị: Ảnh DỌC (3:4 / 9:16)
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
              ? 'Ảnh đang là ảnh dọc. Báo cáo khuyến nghị dùng ảnh ngang để tránh méo layout.'
              : 'Ảnh đang là ảnh ngang. Báo cáo khuyến nghị dùng ảnh dọc để vừa khung mẫu.'}
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
        /* Image Preview Box */
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
            src={value}
            alt={label || 'Photo preview'}
            style={{ width: '100%', height: '100%', objectFit: 'contain' }}
          />

          {/* Watermark Tag */}
          {watermarkText && (
            <div
              style={{
                position: 'absolute',
                bottom: '6px',
                left: '6px',
                backgroundColor: 'rgba(0, 0, 0, 0.75)',
                color: '#38bdf8',
                fontSize: '0.65rem',
                padding: '0.2rem 0.45rem',
                borderRadius: '0.35rem',
                fontFamily: 'monospace',
                backdropFilter: 'blur(2px)',
                maxWidth: '90%',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              <MapPin size={11} style={{ display: 'inline', marginRight: '4px', verticalAlign: 'middle' }} />
              {watermarkText}
            </div>
          )}

          {/* Action floating buttons */}
          <div style={{ position: 'absolute', top: '6px', right: '6px', display: 'flex', gap: '0.35rem' }}>
            {allowAnnotation && (
              <button
                type="button"
                onClick={() => setIsAnnotating(true)}
                title="Vẽ, đánh dấu mũi tên hoặc ghi chú lên ảnh"
                style={{
                  backgroundColor: 'rgba(16, 185, 129, 0.9)',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '0.4rem',
                  padding: '0.35rem 0.55rem',
                  fontSize: '0.7rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.25rem',
                  cursor: 'pointer',
                  backdropFilter: 'blur(2px)',
                  fontWeight: 600,
                  boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
                }}
              >
                <Edit3 size={13} />
                <span>Vẽ / Chú thích</span>
              </button>
            )}

            {/* Chụp lại bằng Camera */}
            <label
              htmlFor={cameraInputId}
              title="Mở camera điện thoại chụp lại"
              style={{
                backgroundColor: 'rgba(5, 150, 105, 0.92)',
                color: '#ffffff',
                border: 'none',
                borderRadius: '0.4rem',
                padding: '0.35rem 0.55rem',
                fontSize: '0.7rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.25rem',
                cursor: 'pointer',
                backdropFilter: 'blur(2px)',
                fontWeight: 600,
                userSelect: 'none',
              }}
            >
              <Camera size={13} />
              <span>Chụp lại</span>
            </label>

            {/* Đổi ảnh từ máy */}
            <label
              htmlFor={galleryInputId}
              title="Chọn ảnh từ thư viện thiết bị"
              style={{
                backgroundColor: 'rgba(15, 23, 42, 0.85)',
                color: '#ffffff',
                border: 'none',
                borderRadius: '0.4rem',
                padding: '0.35rem 0.55rem',
                fontSize: '0.7rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.25rem',
                cursor: 'pointer',
                backdropFilter: 'blur(2px)',
                fontWeight: 600,
                userSelect: 'none',
              }}
            >
              <ImageIcon size={13} />
              <span>Đổi ảnh</span>
            </label>

            <button
              type="button"
              onClick={handleClear}
              title="Xóa ảnh"
              style={{
                backgroundColor: 'rgba(239, 68, 68, 0.9)',
                color: '#ffffff',
                border: 'none',
                borderRadius: '0.4rem',
                padding: '0.35rem 0.5rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
              }}
            >
              <Trash2 size={13} />
            </button>
          </div>
        </div>
      ) : (
        /* Empty State with direct Camera, Live Camera, and Gallery options */
        <div
          style={{
            width: '100%',
            height,
            border: '2px dashed #cbd5e1',
            borderRadius: '0.65rem',
            backgroundColor: '#f8fafc',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.65rem',
            padding: '1rem',
          }}
        >
          <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600, textAlign: 'center' }}>
            {label ? `Chụp hoặc tải ảnh cho ${label}` : 'Chưa có ảnh'}
          </div>

          {orientationHint && (
            <div style={{ fontSize: '0.7rem', color: '#0369a1', fontStyle: 'italic', textAlign: 'center' }}>
              {orientationHint}
            </div>
          )}

          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', justifyContent: 'center' }}>
            {/* Direct Hardware Camera trigger via Label */}
            <label
              htmlFor={cameraInputId}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.4rem',
                padding: '0.45rem 0.85rem',
                fontWeight: 700,
                backgroundColor: '#059669',
                color: '#ffffff',
                borderRadius: '0.5rem',
                cursor: 'pointer',
                fontSize: '0.75rem',
                boxShadow: '0 2px 4px rgba(5, 150, 105, 0.25)',
                userSelect: 'none',
              }}
            >
              <Camera size={15} />
              <span>Chụp Camera</span>
            </label>

            {/* In-app live camera modal button */}
            <button
              type="button"
              onClick={() => setIsLiveCameraOpen(true)}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.4rem',
                padding: '0.45rem 0.85rem',
                fontWeight: 600,
                backgroundColor: '#0284c7',
                color: '#ffffff',
                border: 'none',
                borderRadius: '0.5rem',
                cursor: 'pointer',
                fontSize: '0.75rem',
                boxShadow: '0 2px 4px rgba(2, 132, 199, 0.2)',
              }}
            >
              <Video size={15} />
              <span>Camera Live</span>
            </button>

            {/* Gallery File input trigger via Label */}
            <label
              htmlFor={galleryInputId}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.4rem',
                padding: '0.45rem 0.85rem',
                fontWeight: 600,
                backgroundColor: '#ffffff',
                color: '#334155',
                border: '1px solid #cbd5e1',
                borderRadius: '0.5rem',
                cursor: 'pointer',
                fontSize: '0.75rem',
                boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                userSelect: 'none',
              }}
            >
              <ImageIcon size={15} />
              <span>Chọn từ máy</span>
            </label>
          </div>
        </div>
      )}

      {/* Modal for image annotations */}
      {isAnnotating && value && (
        <ImageAnnotationModal
          isOpen={isAnnotating}
          imageUrl={value}
          title={annotationTitle || `Ghi chú & Vẽ trên ${label || 'ảnh'}`}
          initialTool={initialAnnotationTool || (label?.includes('P-04') ? 'ARROW' : 'PEN')}
          onSave={(annotated) => {
            onChange(annotated);
            setIsAnnotating(false);
          }}
          onClose={() => setIsAnnotating(false)}
        />
      )}

      {/* Live In-App Camera Viewfinder Modal */}
      {isLiveCameraOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 99999,
            backgroundColor: '#000000',
            display: 'flex',
            flexDirection: 'column',
          }}
        >
          {/* Top Bar */}
          <div
            style={{
              padding: '0.75rem 1rem',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              backgroundColor: 'rgba(0,0,0,0.7)',
              color: '#ffffff',
              zIndex: 10,
            }}
          >
            <div style={{ fontSize: '0.85rem', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              <Camera size={18} color="#10b981" />
              <span>{label || 'Chụp ảnh khảo sát'}</span>
            </div>
            <button
              type="button"
              onClick={stopLiveCamera}
              style={{
                background: 'rgba(255,255,255,0.15)',
                border: 'none',
                borderRadius: '50%',
                width: '32px',
                height: '32px',
                color: '#ffffff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
              }}
            >
              <X size={18} />
            </button>
          </div>

          {/* Viewfinder area */}
          <div
            style={{
              flex: 1,
              position: 'relative',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              overflow: 'hidden',
              backgroundColor: '#000000',
            }}
          >
            {cameraLoading && (
              <div style={{ color: '#ffffff', fontSize: '0.85rem', textAlign: 'center' }}>
                Đang khởi động camera...
              </div>
            )}

            {cameraError ? (
              <div style={{ color: '#ef4444', textAlign: 'center', padding: '1rem', maxWidth: '300px' }}>
                <AlertTriangle size={32} style={{ margin: '0 auto 0.5rem auto' }} />
                <p style={{ fontSize: '0.8rem', marginBottom: '1rem' }}>{cameraError}</p>
                <label
                  htmlFor={cameraInputId}
                  onClick={stopLiveCamera}
                  style={{
                    backgroundColor: '#059669',
                    color: '#ffffff',
                    padding: '0.5rem 1rem',
                    borderRadius: '0.5rem',
                    fontSize: '0.8rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    display: 'inline-block',
                  }}
                >
                  Mở máy ảnh mặc định
                </label>
              </div>
            ) : (
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                }}
              />
            )}

            {/* Grid overlay */}
            <div
              style={{
                position: 'absolute',
                inset: 0,
                pointerEvents: 'none',
                border: '2px dashed rgba(255,255,255,0.2)',
                margin: '1.5rem',
                borderRadius: '0.75rem',
              }}
            />
          </div>

          {/* Bottom Controls */}
          <div
            style={{
              padding: '1.25rem 1.5rem',
              backgroundColor: 'rgba(0,0,0,0.85)',
              display: 'flex',
              justifyContent: 'space-around',
              alignItems: 'center',
              zIndex: 10,
            }}
          >
            {/* Switch Camera */}
            <button
              type="button"
              onClick={() => setFacingMode((prev) => (prev === 'environment' ? 'user' : 'environment'))}
              title="Đổi camera trước / sau"
              style={{
                background: 'rgba(255,255,255,0.15)',
                border: 'none',
                borderRadius: '50%',
                width: '44px',
                height: '44px',
                color: '#ffffff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
              }}
            >
              <RefreshCw size={20} />
            </button>

            {/* Shutter Button */}
            <button
              type="button"
              onClick={handleCaptureLiveFrame}
              disabled={cameraLoading || !!cameraError}
              style={{
                width: '68px',
                height: '68px',
                borderRadius: '50%',
                backgroundColor: '#ffffff',
                border: '4px solid #10b981',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 0 15px rgba(16, 185, 129, 0.5)',
              }}
            >
              <div
                style={{
                  width: '52px',
                  height: '52px',
                  borderRadius: '50%',
                  backgroundColor: '#10b981',
                }}
              />
            </button>

            {/* Fallback to Native Camera */}
            <label
              htmlFor={cameraInputId}
              onClick={stopLiveCamera}
              title="Dùng camera hệ thống"
              style={{
                background: 'rgba(255,255,255,0.15)',
                border: 'none',
                borderRadius: '50%',
                width: '44px',
                height: '44px',
                color: '#ffffff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
              }}
            >
              <Camera size={20} />
            </label>
          </div>
        </div>
      )}
    </div>
  );
};
