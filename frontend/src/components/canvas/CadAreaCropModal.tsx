import React, { useState, useRef, useMemo, useEffect } from 'react';
import {
  X,
  Crop,
  Check,
  RotateCcw,
  AlertCircle,
  Square,
  Hand,
  Loader2,
  Layers,
  Sparkles,
} from 'lucide-react';
import { useInteractiveCanvasZoom } from './useInteractiveCanvasZoom';
import { CanvasZoomToolbar } from './CanvasZoomToolbar';
import { cropImageBoundingBox } from './FloorPlanCadPartitionCanvas';

export interface NormalizedBbox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export function normalizeBbox(
  raw: [number, number, number, number] | { x: number; y: number; width: number; height: number } | null | undefined
): NormalizedBbox | null {
  if (!raw) return null;
  if (Array.isArray(raw)) {
    if (raw.length < 4) return null;
    return {
      x: raw[0],
      y: raw[1],
      width: raw[2] >= raw[0] ? raw[2] - raw[0] : raw[2],
      height: raw[3] >= raw[1] ? raw[3] - raw[1] : raw[3],
    };
  }
  if (typeof raw === 'object' && 'x' in raw && 'y' in raw && 'width' in raw && 'height' in raw) {
    return {
      x: Number(raw.x) || 0,
      y: Number(raw.y) || 0,
      width: Number(raw.width) || 0,
      height: Number(raw.height) || 0,
    };
  }
  return null;
}

export interface CadCropPartitionItem {
  id: string;
  unit_code: string;
  display_code?: string | null;
  floor_number?: number;
  cad_bbox?: [number, number, number, number] | { x: number; y: number; width: number; height: number } | null;
  unit_cad_url?: string;
  unit_type?: 'UNIT' | 'MASTER' | string;
}

export interface CadCropFloorPlanItem {
  id: string;
  floor_number: number;
  floor_name: string;
  cad_photo_url: string;
  floor_code?: string;
}

export interface CadAreaCropModalProps {
  isOpen: boolean;
  onClose: () => void;
  cadPhotoUrl: string;
  floorName: string;
  unitCode: string;
  initialBbox: NormalizedBbox | null;
  otherPartitions?: CadCropPartitionItem[];
  onConfirmCrop: (croppedDataUrl: string, newBbox: NormalizedBbox) => void;
  onUseFullFloorCad?: (fullFloorCadUrl: string) => void;
  floorPlans?: CadCropFloorPlanItem[];
  onSelectFloorPlan?: (plan: CadCropFloorPlanItem) => void | Promise<void>;
}

export const CadAreaCropModal: React.FC<CadAreaCropModalProps> = ({
  isOpen,
  onClose,
  cadPhotoUrl,
  floorName,
  unitCode,
  initialBbox,
  otherPartitions = [],
  onConfirmCrop,
  onUseFullFloorCad,
  floorPlans = [],
  onSelectFloorPlan,
}) => {
  const [activeTool, setActiveTool] = useState<'PAN' | 'CROP'>('CROP');
  const [currentBox, setCurrentBox] = useState<NormalizedBbox | null>(initialBbox);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [activeCadUrl, setActiveCadUrl] = useState<string>(cadPhotoUrl);

  // Cập nhật activeCadUrl khi prop cadPhotoUrl thay đổi
  useEffect(() => {
    if (cadPhotoUrl) {
      setActiveCadUrl(cadPhotoUrl);
    }
  }, [cadPhotoUrl]);

  // Kéo thả tạo box mới
  const isDraggingRef = useRef<boolean>(false);
  const dragStartRef = useRef<{ x: number; y: number } | null>(null);
  const [dragCurrent, setDragCurrent] = useState<{ x: number; y: number } | null>(null);

  // Zoom & Pan
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
  } = useInteractiveCanvasZoom({ minZoom: 0.6, maxZoom: 4.0, initialZoom: 1.0 });

  useEffect(() => {
    if (isOpen) {
      setCurrentBox(initialBbox);
      setDragCurrent(null);
      isDraggingRef.current = false;
      dragStartRef.current = null;
    }
  }, [isOpen, initialBbox]);

  // Pointer events trên CAD
  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (activeTool === 'PAN' || e.button === 1 || e.buttons === 4) {
      startPan(e.clientX, e.clientY);
      return;
    }

    if (activeTool === 'CROP' && e.button === 0) {
      const coords = calculateNormalizedCoords(e.clientX, e.clientY);
      if (coords) {
        isDraggingRef.current = true;
        dragStartRef.current = coords;
        setDragCurrent(coords);
      }
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (activeTool === 'PAN' || e.buttons === 4) {
      updatePan(e.clientX, e.clientY);
      return;
    }

    if (isDraggingRef.current && dragStartRef.current) {
      const coords = calculateNormalizedCoords(e.clientX, e.clientY);
      if (coords) {
        setDragCurrent(coords);
      }
    }
  };

  const handlePointerUp = () => {
    if (activeTool === 'PAN') {
      endPan();
      return;
    }

    if (isDraggingRef.current && dragStartRef.current && dragCurrent) {
      isDraggingRef.current = false;
      const minX = Math.min(dragStartRef.current.x, dragCurrent.x);
      const maxX = Math.max(dragStartRef.current.x, dragCurrent.x);
      const minY = Math.min(dragStartRef.current.y, dragCurrent.y);
      const maxY = Math.max(dragStartRef.current.y, dragCurrent.y);

      const width = maxX - minX;
      const height = maxY - minY;

      // Giới hạn tối thiểu 2% diện tích để tránh click nhầm
      if (width >= 2 && height >= 2) {
        setCurrentBox({
          x: Math.round(minX * 10) / 10,
          y: Math.round(minY * 10) / 10,
          width: Math.round(width * 10) / 10,
          height: Math.round(height * 10) / 10,
        });
      }
      dragStartRef.current = null;
      setDragCurrent(null);
    }
  };

  // Xem trước box đang kéo
  const liveDraggingBox = useMemo<NormalizedBbox | null>(() => {
    if (!isDraggingRef.current || !dragStartRef.current || !dragCurrent) return null;
    const minX = Math.min(dragStartRef.current.x, dragCurrent.x);
    const maxX = Math.max(dragStartRef.current.x, dragCurrent.x);
    const minY = Math.min(dragStartRef.current.y, dragCurrent.y);
    const maxY = Math.max(dragStartRef.current.y, dragCurrent.y);
    return {
      x: minX,
      y: minY,
      width: maxX - minX,
      height: maxY - minY,
    };
  }, [dragCurrent]);

  const handleConfirm = async () => {
    if (!currentBox) {
      alert('Vui lòng kéo chuột hoặc ngón tay để vẽ khung chữ nhật bao quanh khu vực cần cắt, hoặc chọn một ô phân vùng có sẵn!');
      return;
    }

    try {
      setIsProcessing(true);
      const croppedUrl = await cropImageBoundingBox(activeCadUrl || cadPhotoUrl, currentBox, 0.05);
      onConfirmCrop(croppedUrl, currentBox);
      onClose();
    } catch (err) {
      console.error('[CadAreaCropModal] Lỗi crop ảnh:', err);
      alert('Không thể cắt ảnh từ CAD tầng. Vui lòng thử lại!');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleApplyFullFloorCad = () => {
    const targetUrl = activeCadUrl || cadPhotoUrl;
    if (!targetUrl) return;
    if (onUseFullFloorCad) {
      onUseFullFloorCad(targetUrl);
    } else {
      onConfirmCrop(targetUrl, { x: 0, y: 0, width: 100, height: 100 });
    }
    onClose();
  };

  const handleResetToInitial = () => {
    setCurrentBox(initialBbox);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[120000] bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-2 sm:p-4 select-none animate-in fade-in duration-150">
      <div className="bg-white border border-slate-200 rounded-2xl shadow-2xl w-full max-w-5xl h-[94dvh] flex flex-col overflow-hidden text-slate-800">
        {/* Header Modal */}
        <div className="bg-white border-b border-slate-200 px-4 py-3 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-indigo-50 text-indigo-600 border border-indigo-100">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-sm sm:text-base font-bold text-slate-900">
                  Chọn & Cắt Bản Vẽ Cho {unitCode}
                </h3>
                <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-200">
                  {floorName}
                </span>
              </div>
              <p className="text-xs text-slate-500">
                Bấm vào ô phân vùng trên bản vẽ, chọn nhanh trong danh sách hoặc kéo vẽ ô tự do để làm sơ đồ.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <X size={20} />
          </button>
        </div>

        {/* Bộ chuyển đổi Tầng (nếu tòa nhà có nhiều tầng có CAD) */}
        {floorPlans && floorPlans.length > 1 && (
          <div className="bg-slate-100/90 border-b border-slate-200 px-3 py-1.5 flex items-center gap-2 overflow-x-auto shrink-0 scrollbar-none">
            <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider shrink-0 flex items-center gap-1">
              <Layers size={13} className="text-indigo-600" /> Bản vẽ tòa:
            </span>
            <div className="flex items-center gap-1.5 shrink-0">
              {floorPlans.map((fp) => {
                const isSelected = (activeCadUrl || cadPhotoUrl) === fp.cad_photo_url;
                return (
                  <button
                    key={fp.id || fp.floor_number}
                    type="button"
                    onClick={() => {
                      setActiveCadUrl(fp.cad_photo_url);
                      if (onSelectFloorPlan) onSelectFloorPlan(fp);
                    }}
                    className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer shrink-0 border ${
                      isSelected
                        ? 'bg-indigo-600 text-white border-indigo-600 shadow-2xs'
                        : 'bg-white hover:bg-slate-50 text-slate-700 border-slate-200'
                    }`}
                  >
                    {fp.floor_name || `Tầng ${fp.floor_number}`}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Thanh chọn nhanh phân vùng & Dùng toàn bộ CAD */}
        <div className="bg-slate-50 border-b border-slate-200 px-3 py-1.5 flex items-center gap-2 overflow-x-auto shrink-0 scrollbar-none">
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider shrink-0">
            Chọn nhanh:
          </span>

          <button
            type="button"
            onClick={handleApplyFullFloorCad}
            className="px-2.5 py-1 rounded-lg text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white flex items-center gap-1 shrink-0 cursor-pointer shadow-2xs transition-colors"
            title="Sử dụng toàn bộ bản vẽ tầng này làm sơ đồ mà không cần cắt"
          >
            <Sparkles size={13} />
            <span>Dùng toàn bộ CAD tầng</span>
          </button>

          {otherPartitions.map((part) => {
            const pBox = normalizeBbox(part.cad_bbox);
            if (!pBox) return null;
            const isTarget = part.unit_code === unitCode;
            const isSelected =
              currentBox &&
              Math.abs(currentBox.x - pBox.x) < 0.5 &&
              Math.abs(currentBox.y - pBox.y) < 0.5;

            return (
              <button
                key={part.id}
                type="button"
                onClick={() => setCurrentBox(pBox)}
                className={`px-2.5 py-1 rounded-lg text-xs transition-all cursor-pointer shrink-0 border flex items-center gap-1 ${
                  isSelected
                    ? 'bg-indigo-600 text-white border-indigo-600 font-bold shadow-2xs'
                    : isTarget
                    ? 'bg-emerald-50 text-emerald-800 border-emerald-300 font-bold'
                    : 'bg-white hover:bg-slate-100 text-slate-700 border-slate-200'
                }`}
              >
                <span>Ô {part.display_code || part.unit_code}</span>
                {isTarget && <span className="text-[10px] text-emerald-600 font-normal">(Hiện tại)</span>}
              </button>
            );
          })}
        </div>

        {/* Toolbar công cụ vẽ & Zoom */}
        <div className="bg-white border-b border-slate-200 px-4 py-2 flex items-center justify-between gap-3 shrink-0 flex-wrap">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setActiveTool('CROP')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                activeTool === 'CROP'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100'
              }`}
            >
              <Square size={14} />
              <span>Kéo vẽ ô cắt</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTool('PAN')}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer ${
                activeTool === 'PAN'
                  ? 'bg-indigo-600 text-white shadow-xs'
                  : 'bg-white text-slate-700 border border-slate-200 hover:bg-slate-100'
              }`}
            >
              <Hand size={14} />
              <span>Di chuyển / Pan</span>
            </button>

            {initialBbox && (
              <button
                type="button"
                onClick={handleResetToInitial}
                className="px-2.5 py-1.5 rounded-xl text-xs font-medium text-slate-600 border border-slate-200 bg-white hover:bg-slate-100 flex items-center gap-1 cursor-pointer"
                title="Khôi phục ô ban đầu"
              >
                <RotateCcw size={13} />
                <span className="hidden sm:inline">Ô ban đầu</span>
              </button>
            )}
          </div>

          {/* Toạ độ ô hiện tại */}
          <div className="text-[11px] font-mono text-slate-600 bg-slate-50 px-2.5 py-1 rounded-lg border border-slate-200 flex items-center gap-2">
            {currentBox ? (
              <>
                <span className="text-emerald-700 font-bold">Ô cắt:</span>
                <span>
                  [{currentBox.x}%, {currentBox.y}%, {currentBox.width}%, {currentBox.height}%]
                </span>
              </>
            ) : (
              <span className="text-amber-700 flex items-center gap-1">
                <AlertCircle size={12} /> Chưa chọn ô cắt (hãy bấm vào ô hoặc kéo vẽ)
              </span>
            )}
          </div>
        </div>

        {/* Khung Canvas hiển thị CAD Tầng */}
        <div className="flex-1 bg-slate-100 relative overflow-hidden flex items-center justify-center p-2 sm:p-4">
          <div
            ref={containerRef}
            onWheel={handleWheel}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            className={`w-full h-full flex items-center justify-center overflow-hidden ${
              activeTool === 'CROP' ? 'cursor-crosshair' : 'cursor-grab active:cursor-grabbing'
            }`}
          >
            <div
              ref={tightBoxRef}
              style={transformStyle}
              className="relative inline-block select-none shadow-xl rounded-xl bg-white border border-slate-300 force-light"
            >
              <img
                src={activeCadUrl || cadPhotoUrl}
                alt="CAD Tầng"
                className="block max-w-full max-h-[68vh] object-contain pointer-events-none rounded-xl"
                draggable={false}
              />

              {/* Các phân vùng trên tầng (BẤM ĐƯỢC để chọn trực quan) */}
              {otherPartitions.map((part) => {
                const pBox = normalizeBbox(part.cad_bbox);
                if (!pBox) return null;
                const isTarget = part.unit_code === unitCode;
                const isSelected =
                  currentBox &&
                  Math.abs(currentBox.x - pBox.x) < 0.5 &&
                  Math.abs(currentBox.y - pBox.y) < 0.5;

                return (
                  <div
                    key={part.id}
                    style={{
                      left: `${pBox.x}%`,
                      top: `${pBox.y}%`,
                      width: `${pBox.width}%`,
                      height: `${pBox.height}%`,
                    }}
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={(e) => {
                      e.stopPropagation();
                      setCurrentBox(pBox);
                    }}
                    className={`absolute border-2 transition-all cursor-pointer rounded-md flex items-center justify-center ${
                      isSelected
                        ? 'border-indigo-600 bg-indigo-500/30 ring-2 ring-indigo-400 z-10'
                        : isTarget
                        ? 'border-emerald-500 bg-emerald-500/25 hover:bg-emerald-500/40 z-5'
                        : 'border-slate-400/80 bg-slate-500/15 hover:bg-slate-500/30'
                    }`}
                    title={`Bấm để chọn ô phân vùng ${part.display_code || part.unit_code}`}
                  >
                    <span
                      className={`absolute top-0.5 left-0.5 text-[9px] font-bold px-1 rounded shadow-xs select-none ${
                        isSelected
                          ? 'bg-indigo-600 text-white'
                          : isTarget
                          ? 'bg-emerald-600 text-white'
                          : 'bg-white/90 text-slate-700'
                      }`}
                    >
                      {part.display_code || part.unit_code} {isTarget ? '(Khu này)' : ''}
                    </span>
                  </div>
                );
              })}

              {/* Ô cắt đã xác định (Current Box) */}
              {currentBox && (
                <div
                  style={{
                    left: `${currentBox.x}%`,
                    top: `${currentBox.y}%`,
                    width: `${currentBox.width}%`,
                    height: `${currentBox.height}%`,
                  }}
                  className="absolute border-2 border-indigo-600 bg-indigo-500/25 pointer-events-none rounded-md shadow-lg"
                >
                  <div className="absolute top-1 left-1 px-2 py-0.5 rounded bg-indigo-600 text-white text-[10px] font-bold shadow-xs flex items-center gap-1">
                    <Crop size={10} />
                    <span>{unitCode} (Vùng cắt)</span>
                  </div>
                </div>
              )}

              {/* Ô cắt đang kéo trực tiếp */}
              {liveDraggingBox && (
                <div
                  style={{
                    left: `${liveDraggingBox.x}%`,
                    top: `${liveDraggingBox.y}%`,
                    width: `${liveDraggingBox.width}%`,
                    height: `${liveDraggingBox.height}%`,
                  }}
                  className="absolute border-2 border-dashed border-amber-500 bg-amber-500/20 pointer-events-none rounded-md"
                >
                  <span className="absolute bottom-1 right-1 px-1.5 py-0.5 rounded bg-amber-600 text-white text-[9px] font-mono">
                    {Math.round(liveDraggingBox.width)}% × {Math.round(liveDraggingBox.height)}%
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Thanh công cụ Zoom ở chân modal */}
          <div className="absolute bottom-4 left-4 z-10">
            <CanvasZoomToolbar
              zoomScale={zoomScale}
              onZoomIn={handleZoomIn}
              onZoomOut={handleZoomOut}
              onResetZoom={handleResetZoom}
              onSelectPreset={handleSetZoomPreset}
            />
          </div>
        </div>

        {/* Footer hành động */}
        <div className="bg-white border-t border-slate-200 px-4 py-3 flex items-center justify-between shrink-0 gap-3 flex-wrap">
          <button
            type="button"
            onClick={onClose}
            disabled={isProcessing}
            className="px-4 py-2 rounded-xl border border-slate-300 text-xs font-bold text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
          >
            Hủy bỏ
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleApplyFullFloorCad}
              disabled={isProcessing}
              className="px-4 py-2 rounded-xl border border-emerald-300 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 text-xs sm:text-sm font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-2xs"
            >
              <Sparkles size={14} />
              <span>Dùng toàn bộ CAD</span>
            </button>

            <button
              type="button"
              onClick={handleConfirm}
              disabled={!currentBox || isProcessing}
              className="px-5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs sm:text-sm font-bold flex items-center gap-2 shadow-md disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer transition-all"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Đang trích xuất ảnh...</span>
                </>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  <span>Xác Nhận Cắt Vùng Này</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
