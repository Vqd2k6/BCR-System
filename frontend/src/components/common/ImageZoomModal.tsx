import React, { useState, useRef, useEffect } from 'react';
import { X, ZoomIn, ZoomOut, RotateCw, Maximize2 } from 'lucide-react';
import { resolveOfflinePhotoUrl } from '../../core/storage/offlinePhotoStorage';

interface Props {
  isOpen: boolean;
  imageUrl: string;
  title?: string;
  photoCode?: string;
  onClose: () => void;
}

export const ImageZoomModal: React.FC<Props> = ({
  isOpen,
  imageUrl,
  title = 'Soi nét chi tiết ảnh hiện trường',
  photoCode,
  onClose,
}) => {
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [rotation, setRotation] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef({ x: 0, y: 0 });
  const touchStartDistRef = useRef<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
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

  // Reset transform when modal opens with a new image
  useEffect(() => {
    if (isOpen) {
      setScale(1);
      setPosition({ x: 0, y: 0 });
      setRotation(0);
    }
  }, [isOpen, imageUrl]);

  // Handle ESC key
  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  const handleZoomIn = () => setScale((s) => Math.min(s + 0.5, 6));
  const handleZoomOut = () => setScale((s) => Math.max(s - 0.5, 0.5));
  const handleReset = () => {
    setScale(1);
    setPosition({ x: 0, y: 0 });
    setRotation(0);
  };
  const handleRotate = () => setRotation((r) => (r + 90) % 360);

  // Mouse wheel zoom
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const delta = e.deltaY < 0 ? 0.25 : -0.25;
    setScale((s) => Math.min(Math.max(s + delta, 0.5), 6));
  };

  // Mouse drag
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    setIsDragging(true);
    dragStartRef.current = { x: e.clientX - position.x, y: e.clientY - position.y };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    setPosition({
      x: e.clientX - dragStartRef.current.x,
      y: e.clientY - dragStartRef.current.y,
    });
  };

  const handleMouseUp = () => setIsDragging(false);

  // Touch pinch-to-zoom & 1-finger pan
  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      // 2 fingers: pinch zoom
      const touch1 = e.touches[0];
      const touch2 = e.touches[1];
      const dist = Math.hypot(touch2.clientX - touch1.clientX, touch2.clientY - touch1.clientY);
      touchStartDistRef.current = dist;
    } else if (e.touches.length === 1) {
      // 1 finger: pan
      const touch = e.touches[0];
      setIsDragging(true);
      dragStartRef.current = { x: touch.clientX - position.x, y: touch.clientY - position.y };
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 2 && touchStartDistRef.current !== null) {
      // 2 fingers: pinch
      const touch1 = e.touches[0];
      const touch2 = e.touches[1];
      const currentDist = Math.hypot(touch2.clientX - touch1.clientX, touch2.clientY - touch1.clientY);
      const ratio = currentDist / touchStartDistRef.current;
      setScale((s) => Math.min(Math.max(s * ratio, 0.5), 6));
      touchStartDistRef.current = currentDist;
    } else if (e.touches.length === 1 && isDragging) {
      // 1 finger: pan
      const touch = e.touches[0];
      setPosition({
        x: touch.clientX - dragStartRef.current.x,
        y: touch.clientY - dragStartRef.current.y,
      });
    }
  };

  const handleTouchEnd = () => {
    setIsDragging(false);
    touchStartDistRef.current = null;
  };

  if (!isOpen || !imageUrl) return null;

  return (
    <div
      className="fixed inset-0 z-[9999] bg-black/90 backdrop-blur-md flex flex-col select-none touch-none animate-fadeIn"
      onClick={onClose}
    >
      {/* Header bar */}
      <div
        className="flex items-center justify-between px-4 py-3 bg-slate-900/90 border-b border-slate-800 text-white z-10"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex flex-col min-w-0 pr-4">
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-white truncate">{title}</span>
            <span className="text-[11px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 font-mono font-medium">
              {Math.round(scale * 100)}%
            </span>
          </div>
          {photoCode && (
            <span className="text-[11px] font-mono text-slate-400 truncate mt-0.5">
              Mã ảnh: {photoCode}
            </span>
          )}
        </div>

        {/* Zoom & Transform Controls */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          <div className="px-2.5 py-1 rounded-lg bg-slate-800 text-xs font-mono font-bold text-sky-400 border border-slate-700">
            {Math.round(scale * 100)}%
          </div>
          <button
            type="button"
            onClick={handleZoomIn}
            className="p-2 rounded-lg bg-slate-800 text-slate-200 hover:bg-slate-700 hover:text-white transition-colors"
            title="Phóng to"
          >
            <ZoomIn className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={handleZoomOut}
            className="p-2 rounded-lg bg-slate-800 text-slate-200 hover:bg-slate-700 hover:text-white transition-colors"
            title="Thu nhỏ"
          >
            <ZoomOut className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={handleRotate}
            className="p-2 rounded-lg bg-slate-800 text-slate-200 hover:bg-slate-700 hover:text-white transition-colors"
            title="Xoay 90°"
          >
            <RotateCw className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={handleReset}
            className="p-2 rounded-lg bg-slate-800 text-slate-200 hover:bg-slate-700 hover:text-white transition-colors"
            title="Đặt lại góc nhìn"
          >
            <Maximize2 className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-lg bg-red-600/80 text-white hover:bg-red-600 transition-colors ml-2"
            title="Đóng (ESC)"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Main Viewport Container */}
      <div
        ref={containerRef}
        className="flex-1 relative overflow-hidden flex items-center justify-center cursor-grab active:cursor-grabbing p-4"
        onClick={(e) => e.stopPropagation()}
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <img
          src={displayUrl || imageUrl}
          alt={title}
          draggable={false}
          className="max-w-none max-h-none transition-transform duration-75 ease-out shadow-2xl pointer-events-none rounded-sm"
          style={{
            transform: `translate(${position.x}px, ${position.y}px) scale(${scale}) rotate(${rotation}deg)`,
            transformOrigin: 'center center',
          }}
        />

        {/* Scroll zoom helper pill */}
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 px-4 py-1.5 rounded-full bg-slate-900/90 backdrop-blur-md border border-slate-700 text-slate-200 text-xs flex items-center gap-2 pointer-events-none shadow-xl">
          <span>🖱️ <strong>Cuộn chuột</strong> để Phóng to/Thu nhỏ &bull; <strong>Kéo chuột</strong> để soi từng milimet vết nứt</span>
        </div>
      </div>
    </div>
  );
};
