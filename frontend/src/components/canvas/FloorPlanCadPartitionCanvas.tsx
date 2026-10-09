import React, { useState, useRef, useCallback, useEffect } from 'react';
import {
  Square,
  Trash2,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  CheckCircle2,
  Hand,
  PenTool,
  Sparkles,
  Info,
  Maximize2,
  Eye,
  EyeOff,
} from 'lucide-react';
import { useInteractiveCanvasZoom } from './useInteractiveCanvasZoom';
import { CanvasZoomToolbar } from './CanvasZoomToolbar';
import { getSafeDisplayUrl, resolveOfflinePhotoUrl } from '../../core/storage/offlinePhotoStorage';

export interface UnitPartitionBox {
  id: string;
  unitCode: string; // VD: "03.01"
  x: number; // 0..100% (tỷ lệ chuẩn hóa)
  y: number; // 0..100%
  width: number; // 0..100%
  height: number; // 0..100%
  polygon?: { x: number; y: number }[];
  unitCadUrl?: string; // Data URL hoặc photo URL sau khi crop
}

interface Props {
  cadPhotoUrl: string;
  floorNumber: number;
  initialPartitions?: UnitPartitionBox[];
  onChangePartitions?: (partitions: UnitPartitionBox[]) => void;
  onSave?: (partitions: UnitPartitionBox[]) => void;
  readOnly?: boolean;
}

/**
 * Hàm crop một vùng chữ nhật từ ảnh gốc bằng HTML5 Canvas ngầm (Offscreen Canvas)
 */
export async function cropImageBoundingBox(
  imageSrc: string,
  box: { x: number; y: number; width: number; height: number },
  paddingPercent: number = 0.05
): Promise<string> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const origW = img.naturalWidth || img.width;
      const origH = img.naturalHeight || img.height;

      // Tính padding (mở rộng 5% mỗi chiều để thấy viền tường xung quanh)
      const padW = box.width * paddingPercent;
      const padH = box.height * paddingPercent;

      const normX = Math.max(0, box.x - padW);
      const normY = Math.max(0, box.y - padH);
      const normW = Math.min(100 - normX, box.width + padW * 2);
      const normH = Math.min(100 - normY, box.height + padH * 2);

      const srcX = (normX / 100) * origW;
      const srcY = (normY / 100) * origH;
      const srcW = (normW / 100) * origW;
      const srcH = (normH / 100) * origH;

      const canvas = document.createElement('canvas');
      canvas.width = Math.max(100, Math.round(srcW));
      canvas.height = Math.max(100, Math.round(srcH));
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(imageSrc);
        return;
      }

      // Nền trắng rõ nét
      ctx.fillStyle = '#FFFFFF';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      ctx.drawImage(img, srcX, srcY, srcW, srcH, 0, 0, canvas.width, canvas.height);
      const croppedDataUrl = canvas.toDataURL('image/jpeg', 0.92);
      resolve(croppedDataUrl);
    };
    img.onerror = () => resolve(imageSrc);
    img.src = imageSrc;
  });
}

export const FloorPlanCadPartitionCanvas: React.FC<Props> = ({
  cadPhotoUrl,
  floorNumber,
  initialPartitions = [],
  onChangePartitions,
  onSave,
  readOnly = false,
}) => {
  const [partitions, setPartitions] = useState<UnitPartitionBox[]>(initialPartitions);
  const [activeTool, setActiveTool] = useState<'BOX' | 'PAN'>(readOnly ? 'PAN' : 'BOX');
  const [selectedBoxId, setSelectedBoxId] = useState<string | null>(null);
  const [showBoxes, setShowBoxes] = useState<boolean>(true);
  const [safeCadUrl, setSafeCadUrl] = useState<string>(() => getSafeDisplayUrl(cadPhotoUrl));

  useEffect(() => {
    if (readOnly) {
      setActiveTool('PAN');
    }
  }, [readOnly]);

  // State cho việc kéo vẽ ô chữ nhật mới
  const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(null);
  const [currentDrag, setCurrentDrag] = useState<{ x: number; y: number } | null>(null);
  const isDrawingRef = useRef<boolean>(false);

  useEffect(() => {
    let isSubscribed = true;
    if (cadPhotoUrl) {
      resolveOfflinePhotoUrl(cadPhotoUrl).then((resolved) => {
        if (isSubscribed && resolved) setSafeCadUrl(resolved);
      });
    }
    return () => {
      isSubscribed = false;
    };
  }, [cadPhotoUrl]);

  useEffect(() => {
    if (initialPartitions && initialPartitions.length > 0) {
      setPartitions(initialPartitions);
    }
  }, [initialPartitions]);

  // Hook tương tác Zoom & Pan
  const {
    zoomScale,
    containerRef,
    tightBoxRef,
    handleZoomIn,
    handleZoomOut,
    handleResetZoom,
    handleSetZoomPreset,
    handleWheel,
    handleTouchStart,
    handleTouchMove,
    handleTouchEnd,
    startPan,
    updatePan,
    endPan,
    calculateNormalizedCoords,
    transformStyle,
    pinCounterScale,
  } = useInteractiveCanvasZoom();

  // Sinh mã phòng tiếp theo theo quy ước mm.nn
  const getNextUnitCode = useCallback((): string => {
    const mm = String(floorNumber).padStart(2, '0');
    const usedNumbers = new Set<number>();
    const regex = new RegExp(`^${mm}\\.(\\d+)`, 'i');
    for (const p of partitions) {
      const match = p.unitCode.match(regex);
      if (match) {
        usedNumbers.add(parseInt(match[1], 10));
      }
    }
    let nn = 1;
    while (usedNumbers.has(nn)) {
      nn++;
    }
    return `${mm}.${String(nn).padStart(2, '0')}`;
  }, [floorNumber, partitions]);

  // Bắt đầu kéo vẽ ô hoặc di chuyển
  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (readOnly || activeTool === 'PAN' || e.button === 1 || e.buttons === 4) {
      startPan(e.clientX, e.clientY);
      return;
    }

    if (activeTool === 'BOX') {
      const coords = calculateNormalizedCoords(e.clientX, e.clientY);
      if (coords) {
        isDrawingRef.current = true;
        setDragStart(coords);
        setCurrentDrag(coords);
      }
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (readOnly || activeTool === 'PAN' || e.buttons === 4) {
      updatePan(e.clientX, e.clientY);
      return;
    }

    if (isDrawingRef.current && dragStart) {
      const coords = calculateNormalizedCoords(e.clientX, e.clientY);
      if (coords) {
        setCurrentDrag(coords);
      }
    }
  };

  const handlePointerUp = async (e: React.PointerEvent<HTMLDivElement>) => {
    if (readOnly || activeTool === 'PAN' || e.buttons === 4) {
      endPan();
      return;
    }

    if (isDrawingRef.current && dragStart && currentDrag) {
      isDrawingRef.current = false;

      const minX = Math.min(dragStart.x, currentDrag.x);
      const maxX = Math.max(dragStart.x, currentDrag.x);
      const minY = Math.min(dragStart.y, currentDrag.y);
      const maxY = Math.max(dragStart.y, currentDrag.y);

      const width = maxX - minX;
      const height = maxY - minY;

      // Chỉ chấp nhận nếu kích thước ô kéo vẽ lớn hơn 2% chiều rộng/chiều cao
      if (width >= 2 && height >= 2) {
        const nextCode = getNextUnitCode();
        const newBox: UnitPartitionBox = {
          id: `unit_box_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
          unitCode: nextCode,
          x: Math.round(minX * 10) / 10,
          y: Math.round(minY * 10) / 10,
          width: Math.round(width * 10) / 10,
          height: Math.round(height * 10) / 10,
        };

        // Tự động tạo ảnh crop ngầm cho căn hộ này
        try {
          const cropped = await cropImageBoundingBox(safeCadUrl || cadPhotoUrl, newBox);
          newBox.unitCadUrl = cropped;
        } catch (_e) {}

        const updated = [...partitions, newBox];
        setPartitions(updated);
        setSelectedBoxId(newBox.id);
        if (onChangePartitions) onChangePartitions(updated);
      }

      setDragStart(null);
      setCurrentDrag(null);
    }
  };

  const handleDeleteBox = (id: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const updated = partitions.filter((p) => p.id !== id);
    setPartitions(updated);
    if (selectedBoxId === id) setSelectedBoxId(null);
    if (onChangePartitions) onChangePartitions(updated);
  };

  const handleRenameBox = (id: string, newCode: string) => {
    const updated = partitions.map((p) => (p.id === id ? { ...p, unitCode: newCode } : p));
    setPartitions(updated);
    if (onChangePartitions) onChangePartitions(updated);
  };

  const handleSaveAll = async () => {
    // Đảm bảo tất cả các box đều đã có crop ảnh CAD
    const withCrops: UnitPartitionBox[] = [];
    for (const b of partitions) {
      if (!b.unitCadUrl) {
        try {
          const cropped = await cropImageBoundingBox(safeCadUrl || cadPhotoUrl, b);
          withCrops.push({ ...b, unitCadUrl: cropped });
        } catch {
          withCrops.push(b);
        }
      } else {
        withCrops.push(b);
      }
    }
    setPartitions(withCrops);
    if (onSave) onSave(withCrops);
  };

  return (
    <div className="flex flex-col h-full bg-slate-900 rounded-2xl overflow-hidden border border-slate-800 shadow-xl select-none">
      {/* 1. Header Toolbar */}
      <div className="flex items-center justify-between px-4 py-2.5 bg-slate-850 border-b border-slate-750 text-white">
        <div className="flex items-center gap-3">
          <div className="p-1.5 rounded-lg bg-teal-500/20 text-teal-400 border border-teal-500/30">
            <Square className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-bold text-white flex items-center gap-2">
              Chia Cắt Mặt Bằng CAD • Tầng {floorNumber}
              <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-teal-900/60 text-teal-300 border border-teal-700/50">
                {partitions.length} Căn Hộ
              </span>
            </h3>
            <p className="text-[11px] text-slate-400">
              Kéo thả các khung chữ nhật bao quanh từng căn hộ theo quy ước <code className="text-teal-300 font-mono">mm.nn</code>
            </p>
          </div>
        </div>

        {/* Chuyển đổi công cụ */}
        <div className="flex items-center gap-2">
          {!readOnly && (
            <div className="flex bg-slate-800 p-0.5 rounded-xl border border-slate-700">
              <button
                type="button"
                onClick={() => setActiveTool('BOX')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  activeTool === 'BOX'
                    ? 'bg-teal-600 text-white shadow-xs'
                    : 'text-slate-300 hover:text-white hover:bg-slate-700'
                }`}
              >
                <Square className="w-3.5 h-3.5" />
                Vẽ Ô Căn
              </button>
              <button
                type="button"
                onClick={() => setActiveTool('PAN')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  activeTool === 'PAN'
                    ? 'bg-teal-600 text-white shadow-xs'
                    : 'text-slate-300 hover:text-white hover:bg-slate-700'
                }`}
              >
                <Hand className="w-3.5 h-3.5" />
                Di Chuyển
              </button>
            </div>
          )}

          <button
            type="button"
            onClick={() => setShowBoxes(!showBoxes)}
            className={`p-1.5 rounded-lg border text-xs font-medium transition-all ${
              showBoxes
                ? 'bg-slate-800 text-teal-300 border-teal-500/40'
                : 'bg-slate-800 text-slate-400 border-slate-700 hover:text-white'
            }`}
            title={showBoxes ? 'Ẩn các ô căn hộ' : 'Hiện các ô căn hộ'}
          >
            {showBoxes ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
          </button>

          {!readOnly && onSave && (
            <button
              type="button"
              onClick={handleSaveAll}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-teal-600 hover:bg-teal-500 text-white text-xs font-bold shadow-md transition-all active:scale-95"
            >
              <CheckCircle2 className="w-4 h-4" />
              Lưu Phân Chia
            </button>
          )}
        </div>
      </div>

      {/* 2. Interactive Canvas Container */}
      <div
        ref={containerRef}
        onWheel={handleWheel}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        className={`relative flex-1 overflow-hidden bg-slate-950 flex items-center justify-center ${
          readOnly || activeTool === 'PAN' ? 'cursor-grab active:cursor-grabbing' : 'cursor-crosshair'
        }`}
      >
        <div
          ref={tightBoxRef}
          style={transformStyle}
          className="relative inline-block max-w-full max-h-full transition-transform duration-75 origin-center"
        >
          {/* Ảnh CAD Mặt Bằng Toàn Tầng */}
          <img
            src={safeCadUrl || cadPhotoUrl}
            alt={`Mặt bằng Tầng ${floorNumber}`}
            draggable={false}
            className="block max-w-full max-h-[70vh] sm:max-h-[78vh] object-contain pointer-events-none select-none rounded-lg"
          />

          {/* Lớp các ô phân chia căn hộ đã vẽ */}
          {showBoxes &&
            partitions.map((box) => {
              const isSelected = selectedBoxId === box.id;
              return (
                <div
                  key={box.id}
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedBoxId(box.id);
                  }}
                  style={{
                    left: `${box.x}%`,
                    top: `${box.y}%`,
                    width: `${box.width}%`,
                    height: `${box.height}%`,
                  }}
                  className={`absolute rounded-md border-2 transition-all cursor-pointer flex flex-col justify-between p-1 ${
                    isSelected
                      ? 'border-amber-400 bg-amber-500/25 ring-2 ring-amber-400/50 z-20 shadow-lg'
                      : 'border-teal-400 bg-teal-500/20 hover:bg-teal-500/30 z-10'
                  }`}
                >
                  {/* Badge số căn mm.nn */}
                  <div className="flex items-center justify-between gap-1">
                    <span
                      style={{ transform: `scale(${pinCounterScale})`, transformOrigin: 'top left' }}
                      className="px-1.5 py-0.5 rounded font-mono font-bold text-[10px] sm:text-xs bg-slate-900/90 text-white border border-teal-400/80 shadow-md backdrop-blur-xs"
                    >
                      {box.unitCode}
                    </span>
                    {!readOnly && isSelected && (
                      <button
                        type="button"
                        onClick={(e) => handleDeleteBox(box.id, e)}
                        className="p-1 rounded bg-rose-600 hover:bg-rose-500 text-white shadow-xs transition-transform hover:scale-110"
                        title="Xóa ô căn này"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    )}
                  </div>

                  {/* Icon crop status */}
                  <div className="flex justify-end">
                    {box.unitCadUrl && (
                      <span className="text-[9px] font-bold px-1 rounded bg-teal-900/80 text-teal-300 border border-teal-600/50">
                        CAD ✓
                      </span>
                    )}
                  </div>
                </div>
              );
            })}

          {/* Preview ô đang kéo vẽ dở */}
          {!readOnly && dragStart && currentDrag && (
            <div
              style={{
                left: `${Math.min(dragStart.x, currentDrag.x)}%`,
                top: `${Math.min(dragStart.y, currentDrag.y)}%`,
                width: `${Math.abs(currentDrag.x - dragStart.x)}%`,
                height: `${Math.abs(currentDrag.y - dragStart.y)}%`,
              }}
              className="absolute border-2 border-dashed border-teal-300 bg-teal-400/25 rounded-md pointer-events-none z-30 animate-pulse"
            >
              <div className="p-1">
                <span className="px-1.5 py-0.5 rounded font-mono text-[10px] font-bold bg-teal-700 text-white">
                  {getNextUnitCode()}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Floating Zoom Toolbar */}
        <div className="absolute bottom-4 right-4 z-40">
          <CanvasZoomToolbar
            zoomScale={zoomScale}
            onZoomIn={handleZoomIn}
            onZoomOut={handleZoomOut}
            onResetZoom={handleResetZoom}
            onSelectPreset={handleSetZoomPreset}
          />
        </div>
      </div>

      {/* 3. Bottom Partition Drawer / Inspector */}
      {selectedBoxId && (
        <div className="px-4 py-2.5 bg-slate-850 border-t border-slate-750 flex items-center justify-between text-white animate-in slide-in-from-bottom duration-150">
          {(() => {
            const activeBox = partitions.find((p) => p.id === selectedBoxId);
            if (!activeBox) return null;
            return (
              <div className="flex items-center gap-4 w-full">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-slate-400">Đang chọn căn:</span>
                  {readOnly ? (
                    <span className="px-2.5 py-1 rounded bg-teal-900/60 border border-teal-500/50 font-mono font-bold text-xs text-teal-300">
                      {activeBox.unitCode}
                    </span>
                  ) : (
                    <input
                      type="text"
                      value={activeBox.unitCode}
                      onChange={(e) => handleRenameBox(activeBox.id, e.target.value)}
                      className="w-24 px-2 py-1 rounded bg-slate-800 border border-slate-600 font-mono font-bold text-xs text-teal-300 focus:outline-none focus:border-teal-500"
                      placeholder="03.01"
                    />
                  )}
                </div>

                <div className="text-xs text-slate-400 flex items-center gap-3">
                  <span>
                    Tọa độ: <span className="text-slate-200">{activeBox.x}%</span>,{' '}
                    <span className="text-slate-200">{activeBox.y}%</span>
                  </span>
                  <span>
                    Kích thước: <span className="text-slate-200">{activeBox.width}% × {activeBox.height}%</span>
                  </span>
                </div>

                <div className="ml-auto flex items-center gap-2">
                  {!readOnly && (
                    <button
                      type="button"
                      onClick={() => handleDeleteBox(activeBox.id)}
                      className="flex items-center gap-1 px-2.5 py-1 rounded bg-rose-900/60 hover:bg-rose-800 text-rose-200 text-xs font-bold border border-rose-700/60 transition-colors cursor-pointer"
                    >
                      <Trash2 className="w-3 h-3" />
                      Xóa Ô Này
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setSelectedBoxId(null)}
                    className="px-2.5 py-1 rounded bg-slate-750 hover:bg-slate-700 text-xs font-bold text-slate-300 transition-colors cursor-pointer"
                  >
                    Đóng
                  </button>
                </div>
              </div>
            );
          })()}
        </div>
      )}
    </div>
  );
};
