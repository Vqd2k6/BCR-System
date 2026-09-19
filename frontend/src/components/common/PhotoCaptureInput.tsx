import React, { useRef, useState, useEffect } from 'react';
import { Camera, Upload, Trash2, RotateCcw, X, SwitchCamera, Check, MapPin } from 'lucide-react';

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
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const fallbackCameraInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const [showCameraModal, setShowCameraModal] = useState<boolean>(false);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [cameraError, setCameraError] = useState<string | null>(null);

  // Stop camera stream on unmount or modal close
  useEffect(() => {
    return () => {
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }
    };
  }, [stream]);

  const startCamera = async (facing: 'environment' | 'user' = facingMode) => {
    setCameraError(null);
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      // Fallback to native file input capture
      fallbackCameraInputRef.current?.click();
      return;
    }

    try {
      if (stream) {
        stream.getTracks().forEach((track) => track.stop());
      }
      const newStream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: facing,
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
        audio: false,
      });
      setStream(newStream);
      setShowCameraModal(true);
      if (videoRef.current) {
        videoRef.current.srcObject = newStream;
      }
    } catch (err: any) {
      console.warn('Live webcam stream failed, falling back to input capture:', err);
      // Fallback to native capture
      fallbackCameraInputRef.current?.click();
    }
  };

  const switchCamera = () => {
    const nextFacing = facingMode === 'environment' ? 'user' : 'environment';
    setFacingMode(nextFacing);
    startCamera(nextFacing);
  };

  const closeCamera = () => {
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      setStream(null);
    }
    setShowCameraModal(false);
  };

  const capturePhoto = () => {
    if (!videoRef.current) return;
    const video = videoRef.current;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      const base64 = canvas.toDataURL('image/jpeg', 0.9);
      onChange(base64);
      if (isNotApplicable && onToggleNotApplicable) {
        onToggleNotApplicable(false);
      }
    }
    closeCamera();
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const base64 = event.target?.result as string;
      if (base64) {
        onChange(base64);
        if (isNotApplicable && onToggleNotApplicable) {
          onToggleNotApplicable(false);
        }
      }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleClear = () => {
    onChange('');
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', width: '100%' }}>
      {/* Hidden file inputs */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        style={{ display: 'none' }}
        onChange={handleFileChange}
      />
      <input
        ref={fallbackCameraInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        style={{ display: 'none' }}
        onChange={handleFileChange}
      />

      {/* Label & N/A checkbox row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        {label && (
          <label style={{ fontSize: '0.8rem', fontWeight: 700, color: '#1e293b' }}>
            {label} {required && <span style={{ color: '#ef4444' }}>*</span>}
          </label>
        )}

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
            <button
              type="button"
              onClick={() => startCamera('environment')}
              title="Chụp lại"
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
              }}
            >
              <Camera size={13} />
              <span>Chụp lại</span>
            </button>

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              title="Tải ảnh khác"
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
              }}
            >
              <Upload size={13} />
              <span>Tải khác</span>
            </button>

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
        /* Empty State with 2 distinct options: Chụp trực tiếp & Tải lên */
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

          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', justifyContent: 'center' }}>
            <button
              type="button"
              onClick={() => startCamera('environment')}
              className="btn btn-primary btn-sm"
              style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', padding: '0.45rem 0.85rem', fontWeight: 700 }}
            >
              <Camera size={15} />
              <span>Chụp trực tiếp</span>
            </button>

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="btn btn-secondary btn-sm"
              style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', padding: '0.45rem 0.85rem' }}
            >
              <Upload size={15} />
              <span>Tải ảnh lên</span>
            </button>
          </div>
        </div>
      )}

      {/* LIVE WEBCAM / CAMERA MODAL */}
      {showCameraModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 5000,
            backgroundColor: '#000000',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '1rem',
          }}
        >
          {/* Top Bar */}
          <div
            style={{
              width: '100%',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              color: '#ffffff',
              padding: '0.5rem 1rem',
              zIndex: 10,
            }}
          >
            <span style={{ fontSize: '0.9rem', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
              <Camera size={16} />
              <span>Chụp ảnh: {label || 'Hiện trường'}</span>
            </span>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button
                type="button"
                onClick={switchCamera}
                title="Đổi camera"
                style={{
                  background: 'rgba(255,255,255,0.2)',
                  border: 'none',
                  color: '#ffffff',
                  borderRadius: '50%',
                  width: '38px',
                  height: '38px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                }}
              >
                <SwitchCamera size={18} />
              </button>
              <button
                type="button"
                onClick={closeCamera}
                title="Đóng"
                style={{
                  background: 'rgba(255,255,255,0.2)',
                  border: 'none',
                  color: '#ffffff',
                  borderRadius: '50%',
                  width: '38px',
                  height: '38px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                }}
              >
                <X size={20} />
              </button>
            </div>
          </div>

          {/* Video Viewport */}
          <div
            style={{
              flex: 1,
              width: '100%',
              maxWidth: '800px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              position: 'relative',
              borderRadius: '1rem',
              overflow: 'hidden',
              backgroundColor: '#1e293b',
            }}
          >
            <video
              ref={(ref) => {
                if (ref && stream && ref.srcObject !== stream) {
                  ref.srcObject = stream;
                  ref.play().catch((e) => console.warn('Video play error:', e));
                }
              }}
              autoPlay
              playsInline
              muted
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'contain',
              }}
            />

            {watermarkText && (
              <div
                style={{
                  position: 'absolute',
                  bottom: '12px',
                  left: '12px',
                  backgroundColor: 'rgba(0,0,0,0.7)',
                  color: '#38bdf8',
                  padding: '0.3rem 0.6rem',
                  borderRadius: '0.4rem',
                  fontSize: '0.75rem',
                  fontFamily: 'monospace',
                }}
              >
                <MapPin size={11} style={{ display: 'inline', marginRight: '4px', verticalAlign: 'middle' }} />
              {watermarkText}
              </div>
            )}
          </div>

          {/* Bottom Shutter Controls */}
          <div
            style={{
              padding: '1.25rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '100%',
              zIndex: 10,
            }}
          >
            <button
              type="button"
              onClick={capturePhoto}
              title="Bấm chụp ảnh"
              style={{
                width: '72px',
                height: '72px',
                borderRadius: '50%',
                backgroundColor: '#ffffff',
                border: '4px solid #0284c7',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                boxShadow: '0 0 20px rgba(2, 132, 199, 0.6)',
              }}
            >
              <div
                style={{
                  width: '56px',
                  height: '56px',
                  borderRadius: '50%',
                  backgroundColor: '#0284c7',
                }}
              />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
