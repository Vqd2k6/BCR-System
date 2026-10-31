import React, { useRef, useState } from 'react';
import { Trash2 } from 'lucide-react';
import { RotatableImageFrame } from '../components/RotatableImageFrame';
import { clampPinCoord } from '../utils/pinCoordinates';

export interface AuditBoardPin {
  code: string;
  x: number;
  y: number;
}

type AuditPinTone = 'zone' | 'element' | 'defect';

const PIN_TONE_CLASS: Record<AuditPinTone, { label: string; dot: string }> = {
  zone: { label: 'bg-emerald-600 text-white', dot: 'bg-emerald-400' },
  element: { label: 'bg-amber-600 text-white', dot: 'bg-amber-400' },
  defect: { label: 'bg-rose-600 text-white', dot: 'bg-rose-600' },
};

interface AuditPinBoardProps {
  url: string;
  alt: string;
  rotation?: number;
  pins: AuditBoardPin[];
  tone: AuditPinTone;
  isEditMode?: boolean;
  showPins?: boolean;
  isPinning?: boolean;
  selectedCode?: string | null;
  maxHeightPx?: number;
  className?: string;
  onAddAt?: (x: number, y: number) => void;
  onMove?: (code: string, x: number, y: number) => void;
  onSelectPin?: (code: string) => void;
  onRemovePin?: (code: string) => void;
}

/** Ảnh CAD/CTX kèm lớp ghim: tọa độ theo % ảnh sau xoay, kéo để dời, bấm ảnh khi đang ghim để thêm mới. */
export const AuditPinBoard: React.FC<AuditPinBoardProps> = ({
  url,
  alt,
  rotation = 0,
  pins,
  tone,
  isEditMode = false,
  showPins = true,
  isPinning = false,
  selectedCode,
  maxHeightPx = 520,
  className = '',
  onAddAt,
  onMove,
  onSelectPin,
  onRemovePin,
}) => {
  const [dragging, setDragging] = useState<AuditBoardPin | null>(null);
  const pointerStartRef = useRef<{ x: number; y: number } | null>(null);
  const hasDraggedRef = useRef(false);
  const toneClass = PIN_TONE_CLASS[tone];
  const canDrag = isEditMode && Boolean(onMove);

  const handleStageClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!isPinning || !onAddAt) return;
    const rect = e.currentTarget.getBoundingClientRect();
    onAddAt(
      clampPinCoord(((e.clientX - rect.left) / rect.width) * 100, 2, 98),
      clampPinCoord(((e.clientY - rect.top) / rect.height) * 100, 2, 98)
    );
  };

  return (
    <div
      className={`force-light relative w-full rounded-xl overflow-hidden bg-slate-950/95 flex items-center justify-center p-1 ${
        isPinning ? 'ring-2 ring-rose-500' : ''
      } ${className}`}
    >
      <RotatableImageFrame
        url={url}
        alt={alt}
        rotation={rotation}
        maxHeightPx={maxHeightPx}
        onStageClick={handleStageClick}
        stageClassName={isPinning ? 'cursor-crosshair' : ''}
      >
        {showPins &&
          pins.map((pin) => {
            const isDragging = dragging?.code === pin.code;
            const displayX = isDragging ? dragging.x : pin.x;
            const displayY = isDragging ? dragging.y : pin.y;
            const isSelected = selectedCode === pin.code;

            return (
              <div
                key={pin.code}
                title={pin.code}
                style={{
                  position: 'absolute',
                  top: `${displayY}%`,
                  left: `${displayX}%`,
                  transform: 'translate(-50%, -100%)',
                  zIndex: isDragging ? 50 : isSelected ? 40 : 30,
                  touchAction: 'none',
                }}
                className={`flex flex-col items-center pointer-events-auto select-none group ${
                  canDrag ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer'
                }`}
                onPointerDown={(e) => {
                  if (!canDrag) return;
                  e.stopPropagation();
                  hasDraggedRef.current = false;
                  pointerStartRef.current = { x: e.clientX, y: e.clientY };
                  e.currentTarget.setPointerCapture(e.pointerId);
                  setDragging(pin);
                }}
                onPointerMove={(e) => {
                  if (!isDragging) return;
                  e.stopPropagation();
                  const start = pointerStartRef.current;
                  if (start && Math.hypot(e.clientX - start.x, e.clientY - start.y) > 3) {
                    hasDraggedRef.current = true;
                  }
                  const container = e.currentTarget.parentElement;
                  if (!container) return;
                  const rect = container.getBoundingClientRect();
                  setDragging({
                    code: pin.code,
                    x: clampPinCoord(((e.clientX - rect.left) / rect.width) * 100, 1, 99),
                    y: clampPinCoord(((e.clientY - rect.top) / rect.height) * 100, 1, 99),
                  });
                }}
                onPointerUp={(e) => {
                  if (!isDragging) return;
                  e.stopPropagation();
                  e.currentTarget.releasePointerCapture(e.pointerId);
                  const { x, y } = dragging;
                  setDragging(null);
                  pointerStartRef.current = null;
                  if (Math.abs(x - pin.x) > 0.2 || Math.abs(y - pin.y) > 0.2) {
                    hasDraggedRef.current = true;
                    onMove?.(pin.code, x, y);
                  }
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  if (hasDraggedRef.current) {
                    hasDraggedRef.current = false;
                    return;
                  }
                  onSelectPin?.(pin.code);
                }}
              >
                <div
                  className={`px-1.5 py-0.5 rounded font-mono font-black text-[10px] shadow-md border border-white flex items-center gap-0.5 ${
                    isSelected ? 'bg-amber-500 text-slate-950 ring-2 ring-white' : toneClass.label
                  }`}
                >
                  <span>{pin.code}</span>
                  {isEditMode && onRemovePin && (
                    <button
                      type="button"
                      title={`Xóa ghim ${pin.code}`}
                      onPointerDown={(ev) => ev.stopPropagation()}
                      onClick={(ev) => {
                        ev.stopPropagation();
                        onRemovePin(pin.code);
                      }}
                      className="ml-0.5 p-0.5 rounded hover:bg-black/25 text-white/90 hover:text-white cursor-pointer"
                    >
                      <Trash2 className="w-2.5 h-2.5" />
                    </button>
                  )}
                </div>
                <div className={`w-2.5 h-2.5 rounded-full border-2 border-white shadow-md -mt-0.5 ${toneClass.dot}`} />
              </div>
            );
          })}
      </RotatableImageFrame>
    </div>
  );
};
