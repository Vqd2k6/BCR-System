import React from 'react';
import { ZoomIn, ZoomOut, RotateCcw, Hand, Crosshair } from 'lucide-react';

interface CanvasZoomToolbarProps {
  zoomScale: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onResetZoom: () => void;
  onSelectPreset?: (scale: number) => void;
  isPinMode?: boolean;
  onTogglePinMode?: () => void;
  pinModeLabel?: string;
}

export const CanvasZoomToolbar: React.FC<CanvasZoomToolbarProps> = ({
  zoomScale,
  onZoomIn,
  onZoomOut,
  onResetZoom,
  onSelectPreset,
  isPinMode,
  onTogglePinMode,
  pinModeLabel = 'Chấm ghim',
}) => {
  const percentage = Math.round(zoomScale * 100);

  return (
    <div
      className="absolute bottom-2.5 left-2.5 z-40 flex items-center gap-1.5 p-1 rounded-xl bg-slate-900/85 backdrop-blur-md border border-white/20 shadow-lg text-white select-none"
      onClick={(e) => e.stopPropagation()}
    >
      {/* Nút Chuyển Mode Chấm Ghim / Kéo Pan (nếu có) */}
      {onTogglePinMode && (
        <button
          type="button"
          onClick={onTogglePinMode}
          className={`px-2 py-1 rounded-lg text-[11px] font-bold flex items-center gap-1 transition-all ${
            isPinMode
              ? 'bg-emerald-600 text-white shadow-xs'
              : 'bg-white/10 hover:bg-white/20 text-slate-300'
          }`}
          title={isPinMode ? 'Đang bật chạm chấm ghim (Chạm vào ảnh để cắm)' : 'Đang bật chế độ kéo rê di chuyển ảnh'}
        >
          {isPinMode ? <Crosshair size={13} className="text-white" /> : <Hand size={13} className="text-amber-300" />}
          <span className="hidden sm:inline">{isPinMode ? pinModeLabel : 'Kéo xem'}</span>
        </button>
      )}

      {/* Divider */}
      {onTogglePinMode && <div className="h-4 w-px bg-white/20 my-auto" />}

      {/* Zoom Out Button */}
      <button
        type="button"
        onClick={onZoomOut}
        disabled={zoomScale <= 1.0}
        className="w-7 h-7 rounded-lg bg-white/10 hover:bg-white/20 disabled:opacity-35 disabled:hover:bg-white/10 flex items-center justify-center text-white transition-all cursor-pointer"
        title="Thu nhỏ ảnh"
      >
        <ZoomOut size={13} />
      </button>

      {/* Zoom Level Indicator / Presets */}
      <div className="flex items-center gap-1 px-1">
        {[1.0, 2.0, 3.0].map((preset) => {
          const isCurrent = Math.abs(zoomScale - preset) < 0.2;
          return (
            <button
              key={`zoom_preset_${preset}`}
              type="button"
              onClick={() => onSelectPreset && onSelectPreset(preset)}
              className={`px-1.5 py-0.5 rounded text-[10px] font-extrabold transition-all cursor-pointer ${
                isCurrent
                  ? 'bg-blue-600 text-white'
                  : 'bg-white/5 hover:bg-white/15 text-slate-300'
              }`}
            >
              {preset}x
            </button>
          );
        })}
      </div>

      {/* Zoom In Button */}
      <button
        type="button"
        onClick={onZoomIn}
        disabled={zoomScale >= 4.0}
        className="w-7 h-7 rounded-lg bg-white/10 hover:bg-white/20 disabled:opacity-35 disabled:hover:bg-white/10 flex items-center justify-center text-white transition-all cursor-pointer"
        title="Phóng to ảnh (hoặc dùng 2 ngón tay bung ra)"
      >
        <ZoomIn size={13} />
      </button>

      {/* Reset Zoom Button */}
      {zoomScale > 1.05 && (
        <button
          type="button"
          onClick={onResetZoom}
          className="w-7 h-7 rounded-lg bg-white/10 hover:bg-white/20 flex items-center justify-center text-amber-300 transition-all cursor-pointer ml-0.5"
          title="Đưa về kích thước gốc 100%"
        >
          <RotateCcw size={12} />
        </button>
      )}
    </div>
  );
};
