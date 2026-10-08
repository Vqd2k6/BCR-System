import React from 'react';
import { X, RefreshCw, Camera, AlertTriangle, Zap, ZapOff, Sparkles } from 'lucide-react';

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
  onVideoReady?: () => void;
  onDismissLoading?: () => void;
  // Props mở rộng cho 0.5x và Flash
  activeLensMode?: '0.5x' | '1.0x';
  hasUltraWide?: boolean;
  onSelectLensMode?: (mode: '0.5x' | '1.0x') => void;
  isTorchOn?: boolean;
  isTorchSupported?: boolean;
  onToggleTorch?: () => void;
  torchMessage?: string | null;
  onDismissTorchMessage?: () => void;
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
  onVideoReady,
  onDismissLoading,
  activeLensMode = '1.0x',
  hasUltraWide = false,
  onSelectLensMode,
  isTorchOn = false,
  isTorchSupported = false,
  onToggleTorch,
  torchMessage,
  onDismissTorchMessage,
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
      {/* Top Bar: Đóng, Nút chọn nhanh ống kính 0.5x / 1.0x / Zoom, Bật Flash, Đổi Camera */}
      <div
        style={{
          padding: '0.75rem 1rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          backgroundColor: 'rgba(0, 0, 0, 0.75)',
          zIndex: 30,
          backdropFilter: 'blur(8px)',
        }}
      >
        {/* Nút đóng camera */}
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

        {/* Center: Cụm nút chọn nhanh ống kính [ 0.5x | 1.0x | 2.0x ] */}
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            backgroundColor: 'rgba(30, 41, 59, 0.85)',
            borderRadius: '9999px',
            padding: '3px',
            border: '1px solid rgba(255, 255, 255, 0.2)',
            boxShadow: '0 2px 8px rgba(0, 0, 0, 0.4)',
          }}
        >
          {/* Nút 0.5x Ultra-Wide */}
          <button
            type="button"
            onClick={() => onSelectLensMode && onSelectLensMode('0.5x')}
            style={{
              padding: '0.25rem 0.65rem',
              borderRadius: '9999px',
              fontSize: '0.75rem',
              fontWeight: 800,
              backgroundColor: activeLensMode === '0.5x' || zoomLevel === 0.5 ? '#10b981' : 'transparent',
              color: '#ffffff',
              border: 'none',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
              display: 'flex',
              alignItems: 'center',
              gap: '2px',
            }}
            title="Góc siêu rộng 0.5x (Chụm 2 ngón tay thu nhỏ để kích hoạt)"
          >
            <span>0.5x</span>
            {hasUltraWide && (
              <span style={{ fontSize: '9px', opacity: 0.85 }}>•</span>
            )}
          </button>

          {/* Nút 1.0x Standard Wide */}
          <button
            type="button"
            onClick={() => onSelectLensMode && onSelectLensMode('1.0x')}
            style={{
              padding: '0.25rem 0.65rem',
              borderRadius: '9999px',
              fontSize: '0.75rem',
              fontWeight: 800,
              backgroundColor: activeLensMode === '1.0x' && zoomLevel === 1.0 ? '#10b981' : 'transparent',
              color: '#ffffff',
              border: 'none',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
            title="Ống kính chuẩn 1.0x"
          >
            1.0x
          </button>

          {/* Nút Zoom số (2.0x hoặc mức zoom hiện tại) */}
          <button
            type="button"
            onClick={onResetZoom}
            style={{
              padding: '0.25rem 0.65rem',
              borderRadius: '9999px',
              fontSize: '0.75rem',
              fontWeight: 800,
              backgroundColor: zoomLevel > 1.0 ? '#0284c7' : 'transparent',
              color: zoomLevel > 1.0 ? '#ffffff' : '#94a3b8',
              border: 'none',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
            title={zoomLevel > 1.0 ? 'Chạm để đưa về 1.0x' : 'Zoom 2.0x'}
          >
            {zoomLevel > 1.0 ? `${zoomLevel.toFixed(1)}x` : '2.0x'}
          </button>
        </div>

        {/* Right Cluster: Bật Đèn Flash & Đổi Camera */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          {/* Nút Flash (Torch) */}
          <button
            type="button"
            onClick={onToggleTorch}
            style={{
              background: isTorchOn ? '#facc15' : 'rgba(255, 255, 255, 0.2)',
              border: isTorchOn ? '2px solid #eab308' : '1px solid rgba(255, 255, 255, 0.25)',
              borderRadius: '50%',
              width: '40px',
              height: '40px',
              color: isTorchOn ? '#0f172a' : '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              boxShadow: isTorchOn ? '0 0 12px rgba(250, 204, 21, 0.8)' : 'none',
              transition: 'all 0.15s ease',
            }}
            title={
              isTorchSupported
                ? isTorchOn
                  ? 'Tắt đèn Flash LED'
                  : 'Bật đèn Flash LED'
                : 'Đèn Flash (Bấm để xem hướng dẫn)'
            }
          >
            {isTorchOn ? <Zap size={18} fill="#0f172a" /> : <ZapOff size={18} />}
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
      </div>

      {/* Thông báo hướng dẫn Flash trên iOS Safari nếu có */}
      {torchMessage && (
        <div
          style={{
            position: 'absolute',
            top: '64px',
            left: '12px',
            right: '12px',
            backgroundColor: 'rgba(15, 23, 42, 0.95)',
            border: '1px solid #38bdf8',
            borderRadius: '0.75rem',
            padding: '0.65rem 0.85rem',
            color: '#f8fafc',
            fontSize: '0.75rem',
            lineHeight: 1.4,
            display: 'flex',
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            gap: '0.5rem',
            zIndex: 40,
            boxShadow: '0 4px 15px rgba(0,0,0,0.5)',
            backdropFilter: 'blur(8px)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '0.4rem' }}>
            <AlertTriangle size={15} className="text-amber-400 shrink-0 mt-0.5" />
            <span>{torchMessage}</span>
          </div>
          <button
            type="button"
            onClick={onDismissTorchMessage}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#94a3b8',
              cursor: 'pointer',
              padding: '2px',
            }}
          >
            <X size={15} />
          </button>
        </div>
      )}

      {/* Viewfinder cảm ứng 2 ngón tay Pinch-to-zoom & chuyển 0.5x */}
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
          onLoadedMetadata={onVideoReady}
          onCanPlay={onVideoReady}
          onPlaying={onVideoReady}
          {...({ 'webkit-playsinline': 'true' } as any)}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            transform: zoomLevel > 1.0 ? `scale(${zoomLevel})` : 'scale(1)',
            transformOrigin: 'center center',
            transition: isPinching ? 'none' : 'transform 0.1s ease-out',
            display: cameraError ? 'none' : 'block',
          }}
        />

        {/* Loading Overlay */}
        {cameraLoading && !cameraError && (
          <div
            onClick={onDismissLoading}
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
              cursor: 'pointer',
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

        {/* Khung hướng dẫn 4:3 và Gợi ý cử chỉ pinch 0.5x */}
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

            {/* Floating Live Zoom Indicator */}
            {activeLensMode === '0.5x' && (
              <div
                style={{
                  marginTop: '0.5rem',
                  backgroundColor: 'rgba(16, 185, 129, 0.9)',
                  color: '#ffffff',
                  fontSize: '0.72rem',
                  fontWeight: 800,
                  padding: '0.2rem 0.65rem',
                  borderRadius: '9999px',
                  boxShadow: '0 2px 6px rgba(0,0,0,0.4)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.25rem',
                }}
              >
                <Sparkles size={11} />
                <span>GÓC SIÊU RỘNG 0.5x</span>
              </div>
            )}

            <div
              style={{
                marginTop: 'auto',
                marginBottom: '0.5rem',
                backgroundColor: 'rgba(0, 0, 0, 0.65)',
                color: '#f8fafc',
                fontSize: '0.72rem',
                fontWeight: 600,
                padding: '0.25rem 0.85rem',
                borderRadius: '9999px',
                backdropFilter: 'blur(4px)',
                border: '1px solid rgba(255, 255, 255, 0.2)',
                zIndex: 10,
              }}
            >
              Chụm 2 ngón tay thu nhỏ để kích hoạt 0.5x | Mở để zoom
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
        {/* Nút mở Máy ảnh hệ thống (Native Camera) */}
        <button
          type="button"
          onClick={onTriggerNativeCamera}
          title="Chuyển sang Máy ảnh hệ điều hành (12MP/48MP, có Flash phần cứng & Macro)"
          style={{
            background: 'rgba(255,255,255,0.18)',
            border: '1px solid rgba(255,255,255,0.25)',
            borderRadius: '50%',
            width: '46px',
            height: '46px',
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
            width: '74px',
            height: '74px',
            borderRadius: '50%',
            backgroundColor: '#ffffff',
            border: '4px solid #10b981',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 0 20px rgba(16, 185, 129, 0.6)',
            transition: 'transform 0.1s ease',
          }}
          onPointerDown={(e) => (e.currentTarget.style.transform = 'scale(0.94)')}
          onPointerUp={(e) => (e.currentTarget.style.transform = 'scale(1)')}
        >
          <div
            style={{
              width: '58px',
              height: '58px',
              borderRadius: '50%',
              backgroundColor: '#10b981',
            }}
          />
        </button>

        {/* Lens badge góc phải */}
        <div
          style={{
            width: '46px',
            height: '46px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: activeLensMode === '0.5x' ? '#34d399' : '#94a3b8',
            fontFamily: 'monospace',
            fontWeight: 800,
            fontSize: '0.8rem',
            background: 'rgba(255,255,255,0.1)',
            borderRadius: '50%',
            border: '1px solid rgba(255,255,255,0.15)',
          }}
          title="Chế độ ống kính hiện tại"
        >
          {activeLensMode === '0.5x' ? '0.5x' : `${zoomLevel.toFixed(1)}x`}
        </div>
      </div>
    </div>
  );
};
