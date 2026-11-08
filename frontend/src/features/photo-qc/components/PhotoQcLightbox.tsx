import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { ChevronLeft, ChevronRight, Crop, Flag, X } from 'lucide-react';
import type { PhotoQcSlotView } from '../types';
import { RotatedPhoto } from './RotatedPhoto';

interface PhotoQcLightboxProps {
  photos: PhotoQcSlotView[];
  index: number;
  onIndex: (index: number) => void;
  onClose: () => void;
  /** Có thì phím F / nút cờ hoạt động. */
  onToggleFlag?: (slot: PhotoQcSlotView) => void;
  /** Có thì phím C / nút crop hoạt động (tài liệu scan không crop). */
  onCrop?: (slot: PhotoQcSlotView) => void;
}

function useViewport(): { w: number; h: number } {
  const [vp, setVp] = useState({ w: window.innerWidth, h: window.innerHeight });
  useEffect(() => {
    const onResize = () => setVp({ w: window.innerWidth, h: window.innerHeight });
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);
  return vp;
}

/**
 * Xem ảnh gốc cỡ lớn theo đúng góc in. ← → chuyển ảnh, Esc đóng, F gắn/bỏ cờ chụp lại, C mở crop.
 * Ảnh kế tiếp được tải trước để chuyển ảnh không phải chờ.
 */
export const PhotoQcLightbox: React.FC<PhotoQcLightboxProps> = ({ photos, index, onIndex, onClose, onToggleFlag, onCrop }) => {
  const vp = useViewport();
  const [showCrop, setShowCrop] = useState(true);
  const slot = photos[index];
  const canCrop = Boolean(onCrop && slot && slot.section !== 'DOCUMENT');

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!slot) return;
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'SELECT' || target.tagName === 'TEXTAREA')) return;
      if (e.key === 'Escape') onClose();
      else if (e.key === 'ArrowRight' && index < photos.length - 1) onIndex(index + 1);
      else if (e.key === 'ArrowLeft' && index > 0) onIndex(index - 1);
      else if ((e.key === 'f' || e.key === 'F') && onToggleFlag) onToggleFlag(slot);
      else if ((e.key === 'c' || e.key === 'C') && canCrop && onCrop) onCrop(slot);
      else return;
      e.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [slot, index, photos.length, onIndex, onClose, onToggleFlag, onCrop, canCrop]);

  useEffect(() => {
    const next = photos[index + 1];
    if (next) {
      const img = new Image();
      img.src = next.url;
    }
  }, [photos, index]);

  if (!slot) return null;
  const validCrop = slot.qc?.crop && !slot.qcStale ? slot.qc.crop : null;
  const flagged = Boolean(slot.qc?.recapture && slot.qc.status !== 'RESOLVED');

  // Portal ra body: lớp cha có transform (animate-in) làm position: fixed bám sai khung.
  return createPortal(
    <div className="fixed inset-0 z-[80] bg-slate-950 flex flex-col">
      <div className="flex items-center gap-3 px-4 py-3 text-slate-100">
        <span className="text-sm font-bold truncate">{slot.label}</span>
        <span className="text-xs text-slate-400 shrink-0">
          {index + 1}/{photos.length} • xoay {slot.rotation}°{slot.printed ? '' : ' • chưa in trong report'}
        </span>
        <div className="ml-auto flex items-center gap-2">
          {validCrop && (
            <button
              type="button"
              onClick={() => setShowCrop((v) => !v)}
              className="px-3 py-1.5 rounded-lg text-xs font-bold border border-slate-600 text-slate-200 hover:bg-slate-800 cursor-pointer"
            >
              {showCrop ? 'Xem ảnh nguyên' : 'Xem như in (crop)'}
            </button>
          )}
          {onToggleFlag && (
            <button
              type="button"
              onClick={() => onToggleFlag(slot)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold border flex items-center gap-1 cursor-pointer ${flagged ? 'bg-rose-600 border-rose-600 text-white' : 'border-slate-600 text-slate-200 hover:bg-slate-800'}`}
              title="Phím F"
            >
              <Flag className="w-3.5 h-3.5" /> {flagged ? 'Cần chụp lại' : 'Chụp lại'}
            </button>
          )}
          {canCrop && onCrop && (
            <button
              type="button"
              onClick={() => onCrop(slot)}
              className="px-3 py-1.5 rounded-lg text-xs font-bold border border-slate-600 text-slate-200 hover:bg-slate-800 flex items-center gap-1 cursor-pointer"
              title="Phím C"
            >
              <Crop className="w-3.5 h-3.5" /> Crop
            </button>
          )}
          <button type="button" onClick={onClose} className="p-1.5 rounded-lg text-slate-300 hover:bg-slate-800 cursor-pointer" title="Esc">
            <X className="w-5 h-5" />
          </button>
        </div>
      </div>

      <div className="relative flex-1 flex items-center justify-center min-h-0">
        <button
          type="button"
          disabled={index === 0}
          onClick={() => onIndex(index - 1)}
          className="absolute left-3 p-2 rounded-full bg-slate-800/80 text-white hover:bg-slate-700 cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <ChevronLeft className="w-6 h-6" />
        </button>
        <RotatedPhoto
          key={`${slot.url}|${showCrop ? 'crop' : 'full'}`}
          url={slot.url}
          rotation={slot.rotation}
          boxWidth={Math.max(320, vp.w - 140)}
          boxHeight={Math.max(240, vp.h - 110)}
          crop={showCrop ? validCrop : null}
          className="bg-transparent"
        />
        <button
          type="button"
          disabled={index >= photos.length - 1}
          onClick={() => onIndex(index + 1)}
          className="absolute right-3 p-2 rounded-full bg-slate-800/80 text-white hover:bg-slate-700 cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <ChevronRight className="w-6 h-6" />
        </button>
      </div>
      <p className="text-center text-[11px] text-slate-500 pb-2">← → chuyển ảnh • Esc đóng{onToggleFlag ? ' • F gắn cờ' : ''}{canCrop ? ' • C crop' : ''}</p>
    </div>,
    document.body
  );
};
