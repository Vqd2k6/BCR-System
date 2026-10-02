import React from 'react';
import { X, RefreshCw, Camera, AlertTriangle } from 'lucide-react';

interface LiveCameraModalProps {
  isOpen: boolean;
  onClose: () => void;
  videoRef: React.RefObject<HTMLVideoElement>;
  zoomLevel: number;
  isPinching: boolean;
  cameraLoading: boolean;
  cameraError: string | null;
  onResetZoom: () => void;
  onSwitchCamera: () => void;
  onTriggerNativeCamera: () => void;
  onCaptureFrame: () => void;
  onTouchStart: (e: React.TouchEvent<HTMLDivElement>) => void;
  onTouchMove: (e: React.TouchEvent<HTMLDivElement>) => void;
  onTouchEnd: () => void;
  onWheel: (e: React.WheelEvent<HTMLDivElement>) => void;
}

export const LiveCameraModal: React.FC<LiveCameraModalProps> = ({
  isOpen,
  onClose,
  videoRef,
  zoomLevel,
  isPinching,
  cameraLoading,
  cameraError,
  onResetZoom,
  onSwitchCamera,
  onTriggerNativeCamera,
  onCaptureFrame,
  onTouchStart,
  onTouchMove,
  onTouchEnd,
  onWheel,
}) => {
  if (!isOpen) return null;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999,
        backgroundColor: '#000000',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        userSelect: 'none',
        touchAction: 'none',
      }}
    >
      {/* Top Bar: Đóng, Chỉ số Zoom (chạm để về 1.0x), Đổi camera */}
      <div
        style={{
          padding: '0.75rem 1rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          backgroundColor: 'rgba(0, 0, 0, 0.65)',
          zIndex: 20,
        }}
      >
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
          title="Đóng camera"
        >
          <X size={20} />
        </button>

        {/* Floating Zoom Indicator - Chạm vào để về ngay 1.0x */}
        <button
          type="button"
          onClick={onResetZoom}
          style={{
            backgroundColor: zoomLevel > 1.0 ? 'rgba(16, 185, 129, 0.9)' : 'rgba(255, 255, 255, 0.15)',
            color: '#ffffff',
            border: 'none',
            borderRadius: '9999px',
            padding: '0.3rem 0.85rem',
            fontSize: '0.85rem',
            fontWeight: 800,
            cursor: 'pointer',
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.25rem',
            boxShadow: '0 2px 4px rgba(0,0,0,0.3)',
          }}
          title="Chạm để đưa về 1.0x"
        >
          <span>{zoomLevel.toFixed(1)}x</span>
        </button>

        {/* Switch Camera trước/sau */}
        <button
          type="button"
          onClick={onSwitchCamera}
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
          title="Đổi camera trước / sau"
        >
          <RefreshCw size={18} />
        </button>
      </div>

      {/* Viewfinder cảm ứng 2 ngón tay Pinch-to-zoom */}
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
          backgroundColor: '#000000',
        }}
      >
        <video
          ref={videoRef}
          autoPlay
          playsInline
          muted
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            transform: `scale(${zoomLevel})`,
            transformOrigin: 'center center',
            transition: isPinching ? 'none' : 'transform 0.1s ease-out',
            display: cameraError ? 'none' : 'block',
          }}
        />

        {/* Loading Overlay */}
        {cameraLoading && !cameraError && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              backgroundColor: 'rgba(0, 0, 0, 0.75)',
              backdropFilter: 'blur(6px)',
              color: '#ffffff',
              fontSize: '0.85rem',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.65rem',
              zIndex: 15,
            }}
          >
            <RefreshCw size={28} className="animate-spin text-emerald-400" />
            <span style={{ fontWeight: 600 }}>Đang khởi động camera...</span>
            <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>
              Vui lòng cho phép quyền truy cập camera nếu trình duyệt yêu cầu
            </span>
          </div>
        )}

        {/* Error State */}
        {cameraError && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              backgroundColor: '#0f172a',
              color: '#f87171',
              padding: '1.5rem',
              textAlign: 'center',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '0.85rem',
              zIndex: 20,
            }}
          >
            <AlertTriangle size={36} />
            <div style={{ fontSize: '0.85rem', maxWidth: '300px', lineHeight: 1.4 }}>{cameraError}</div>
            <button
              type="button"
              onClick={onTriggerNativeCamera}
              style={{
                backgroundColor: '#0284c7',
                color: '#ffffff',
                padding: '0.55rem 1.25rem',
                borderRadius: '0.5rem',
                fontSize: '0.8rem',
                fontWeight: 700,
                cursor: 'pointer',
                border: 'none',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.4rem',
                boxShadow: '0 2px 8px rgba(2, 132, 199, 0.4)',
              }}
            >
              <Camera size={16} />
              <span>Mở Máy ảnh hệ thống</span>
            </button>
          </div>
        )}

        {/* Khung hướng dẫn 4:3 và Gợi ý cử chỉ zoom 2 ngón tay */}
        {!cameraLoading && !cameraError && (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              pointerEvents: 'none',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '1rem',
            }}
          >
            <div
              style={{
                position: 'absolute',
                inset: '12px',
                border: '1.5px dashed rgba(255, 255, 255, 0.35)',
                borderRadius: '0.75rem',
                pointerEvents: 'none',
              }}
            />

            <div
              style={{
                marginTop: 'auto',
                marginBottom: '0.5rem',
                backgroundColor: 'rgba(0, 0, 0, 0.6)',
                color: '#f8fafc',
                fontSize: '0.72rem',
                fontWeight: 600,
                padding: '0.25rem 0.75rem',
                borderRadius: '9999px',
                backdropFilter: 'blur(3px)',
                border: '1px solid rgba(255, 255, 255, 0.2)',
                zIndex: 10,
              }}
            >
              Chụm / mở 2 ngón tay để zoom
            </div>
          </div>
        )}
      </div>

      {/* Bottom Bar: Nút chuyển Camera hệ thống & Nút Chụp chính */}
      <div
        style={{
          padding: '1.25rem 1.5rem',
          backgroundColor: 'rgba(0,0,0,0.85)',
          display: 'flex',
          justifyContent: 'space-around',
          alignItems: 'center',
          zIndex: 20,
        }}
      >
        <button
          type="button"
          onClick={onTriggerNativeCamera}
          title="Chuyển sang Máy ảnh hệ điều hành (12MP/48MP, có Flash & Macro)"
          style={{
            background: 'rgba(255,255,255,0.18)',
            border: '1px solid rgba(255,255,255,0.25)',
            borderRadius: '50%',
            width: '44px',
            height: '44px',
            color: '#ffffff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            backdropFilter: 'blur(4px)',
          }}
        >
          <Camera size={20} />
        </button>

        {/* Shutter Button */}
        <button
          type="button"
          onClick={onCaptureFrame}
          disabled={cameraLoading || !!cameraError}
          style={{
            width: '72px',
            height: '72px',
            borderRadius: '50%',
            backgroundColor: '#ffffff',
            border: '4px solid #10b981',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 0 18px rgba(16, 185, 129, 0.55)',
            transition: 'transform 0.1s ease',
          }}
          onPointerDown={(e) => (e.currentTarget.style.transform = 'scale(0.94)')}
          onPointerUp={(e) => (e.currentTarget.style.transform = 'scale(1)')}
        >
          <div
            style={{
              width: '56px',
              height: '56px',
              borderRadius: '50%',
              backgroundColor: '#10b981',
            }}
          />
        </button>

        <div style={{ width: '44px', height: '44px' }} />
      </div>
    </div>
  );
};
