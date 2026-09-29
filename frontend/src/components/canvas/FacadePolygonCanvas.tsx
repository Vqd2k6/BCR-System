import React, { useState, useRef } from 'react';
import { Dot, Minus, RotateCcw, Sparkles, Trash2, PenTool, AlertCircle, Check, X, Hand, ZoomIn, ZoomOut, Maximize2 } from 'lucide-react';

export interface PolygonPoint {
  x: number;
  y: number;
}

export interface FloorSplitLine {
  id?: string;
  floor: string;
  lineType?: 'GROUND' | 'MEZZANINE' | 'FLOOR' | 'ROOF' | string;
  x1?: number; // 0..100%
  y1?: number; // 0..100%
  x2?: number; // 0..100%
  y2?: number; // 0..100%
  y?: number;  // legacy horizontal line fallback
}

export interface FreehandStroke {
  points: { x: number; y: number }[];
  color: string;
  width: number;
}

export interface FacadePolygonCanvasProps {
  imageUrl?: string;
  photoUrl?: string;
  polygonPoints?: PolygonPoint[];
  floorSplitLines?: FloorSplitLine[];
  freehandStrokes?: FreehandStroke[];
  onChange?: (
    points: PolygonPoint[],
    floorSplitLines: FloorSplitLine[],
    strokes: FreehandStroke[]
  ) => void;
  onSave?: (data: {
    polygonPoints: PolygonPoint[];
    splitLines: FloorSplitLine[];
    freehandStrokes: FreehandStroke[];
  }) => void;
  onTriggerAiRectify?: () => Promise<void>;
  readOnly?: boolean;
}

export const FacadePolygonCanvas: React.FC<FacadePolygonCanvasProps> = ({
  imageUrl,
  photoUrl,
  polygonPoints,
  floorSplitLines,
  freehandStrokes,
  onChange,
  onSave,
  onTriggerAiRectify,
  readOnly = false,
}) => {
  const activeImage = imageUrl || photoUrl || '';
  const [activeTool, setActiveTool] = useState<'POLYGON' | 'SPLIT_LINE' | 'FREEHAND' | 'PAN'>('POLYGON');

  const [points, setPoints] = useState<PolygonPoint[]>(polygonPoints || []);
  const [splitLines, setSplitLines] = useState<FloorSplitLine[]>(floorSplitLines || []);
  const [strokes, setStrokes] = useState<FreehandStroke[]>(freehandStrokes || []);
  const [isDrawing, setIsDrawing] = useState<boolean>(false);
  const [currentStroke, setCurrentStroke] = useState<{ x: number; y: number }[]>([]);

  // Zoom & Pan state
  const [zoom, setZoom] = useState<number>(1);
  const [pan, setPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState<boolean>(false);
  const panStartRef = useRef<{ startX: number; startY: number; initialPanX: number; initialPanY: number }>({
    startX: 0,
    startY: 0,
    initialPanX: 0,
    initialPanY: 0,
  });
  const touchDistanceRef = useRef<number | null>(null);

  // 2-point line state for SPLIT_LINE
  const [pendingLineStart, setPendingLineStart] = useState<{ x: number; y: number } | null>(null);
  const [hoverCoords, setHoverCoords] = useState<{ x: number; y: number } | null>(null);
  const [activeLineType, setActiveLineType] = useState<'GROUND' | 'MEZZANINE' | 'FLOOR' | 'ROOF'>('FLOOR');

  const [aiStatus, setAiStatus] = useState<'IDLE' | 'PROCESSING' | 'COMPLETED'>('IDLE');
  const canvasContainerRef = useRef<HTMLDivElement>(null);

  const notifyChange = (newPts: PolygonPoint[], newLines: FloorSplitLine[], newStrokes: FreehandStroke[]) => {
    if (onChange) onChange(newPts, newLines, newStrokes);
  };

  const getCanvasCoords = (clientX: number, clientY: number) => {
    if (!canvasContainerRef.current) return { x: 0, y: 0 };
    const rect = canvasContainerRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(100, Math.round(((clientX - rect.left) / rect.width) * 100)));
    const y = Math.max(0, Math.min(100, Math.round(((clientY - rect.top) / rect.height) * 100)));
    return { x, y };
  };

  const handleZoomIn = () => {
    setZoom((prev) => Math.min(4, Math.round((prev + 0.5) * 10) / 10));
  };

  const handleZoomOut = () => {
    setZoom((prev) => {
      const next = Math.max(1, Math.round((prev - 0.5) * 10) / 10);
      if (next === 1) setPan({ x: 0, y: 0 });
      return next;
    });
  };

  const handleResetZoom = () => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      touchDistanceRef.current = Math.hypot(dx, dy);
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 2 && touchDistanceRef.current !== null) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const newDist = Math.hypot(dx, dy);
      const factor = newDist / touchDistanceRef.current;
      if (Math.abs(factor - 1) > 0.04) {
        setZoom((prev) => {
          const next = Math.max(1, Math.min(4, Math.round(prev * factor * 10) / 10));
          if (next === 1) setPan({ x: 0, y: 0 });
          return next;
        });
        touchDistanceRef.current = newDist;
      }
    }
  };

  const handleTouchEnd = () => {
    touchDistanceRef.current = null;
  };

  // Calculate default floor name based on current lines
  const getFloorName = (type: 'GROUND' | 'MEZZANINE' | 'FLOOR' | 'ROOF') => {
    if (type === 'GROUND') return 'Line tầng trệt';
    if (type === 'MEZZANINE') return 'Line tầng lửng';
    if (type === 'ROOF') return 'Line mái / Sân thượng';

    const floorLines = splitLines.filter(
      (l) => l.lineType === 'FLOOR' || (!l.lineType && !l.floor.includes('trệt') && !l.floor.includes('lửng') && !l.floor.includes('mái'))
    );
    const nextIdx = floorLines.length + 1;
    return `Lầu ${nextIdx}`;
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (readOnly || !activeImage) return;

    // Pan Mode or middle-click
    if (activeTool === 'PAN' || e.button === 1) {
      setIsPanning(true);
      panStartRef.current = {
        startX: e.clientX,
        startY: e.clientY,
        initialPanX: pan.x,
        initialPanY: pan.y,
      };
      (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
      return;
    }

    const { x, y } = getCanvasCoords(e.clientX, e.clientY);

    if (activeTool === 'POLYGON') {
      const updated = [...points, { x, y }];
      setPoints(updated);
      notifyChange(updated, splitLines, strokes);
    } else if (activeTool === 'SPLIT_LINE') {
      if (!pendingLineStart) {
        // Point 1: Start of line
        setPendingLineStart({ x, y });
      } else {
        // Point 2: End of line -> create 2-point slanted/horizontal line
        const floorName = getFloorName(activeLineType);
        const newLine: FloorSplitLine = {
          id: `line_${Date.now()}`,
          floor: floorName,
          lineType: activeLineType,
          x1: pendingLineStart.x,
          y1: pendingLineStart.y,
          x2: x,
          y2: y,
        };
        const updated = [...splitLines, newLine];
        setSplitLines(updated);
        setPendingLineStart(null);
        notifyChange(points, updated, strokes);
      }
    } else if (activeTool === 'FREEHAND') {
      setIsDrawing(true);
      setCurrentStroke([{ x, y }]);
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (readOnly) return;

    if (isPanning) {
      const dx = e.clientX - panStartRef.current.startX;
      const dy = e.clientY - panStartRef.current.startY;
      setPan({
        x: panStartRef.current.initialPanX + dx,
        y: panStartRef.current.initialPanY + dy,
      });
      return;
    }

    const { x, y } = getCanvasCoords(e.clientX, e.clientY);
    setHoverCoords({ x, y });

    if (isDrawing && activeTool === 'FREEHAND') {
      setCurrentStroke((prev) => [...prev, { x, y }]);
    }
  };

  const handlePointerUp = (e?: React.PointerEvent<HTMLDivElement>) => {
    if (isPanning) {
      setIsPanning(false);
      if (e) {
        (e.currentTarget as HTMLElement).releasePointerCapture?.(e.pointerId);
      }
      return;
    }

    if (isDrawing && activeTool === 'FREEHAND' && currentStroke.length > 0) {
      setIsDrawing(false);
      const newStroke: FreehandStroke = {
        points: currentStroke,
        color: '#facc15',
        width: 1.5,
      };
      const updated = [...strokes, newStroke];
      setStrokes(updated);
      setCurrentStroke([]);
      notifyChange(points, splitLines, updated);
    }
  };

  const removeLastPoint = () => {
    if (readOnly || points.length === 0) return;
    const updated = points.slice(0, -1);
    setPoints(updated);
    notifyChange(updated, splitLines, strokes);
  };

  const removeLastLine = () => {
    if (readOnly || splitLines.length === 0) return;
    const updated = splitLines.slice(0, -1);
    setSplitLines(updated);
    notifyChange(points, updated, strokes);
  };

  const removeLastStroke = () => {
    if (readOnly || strokes.length === 0) return;
    const updated = strokes.slice(0, -1);
    setStrokes(updated);
    notifyChange(points, splitLines, updated);
  };

  const resetAll = () => {
    if (readOnly) return;
    setPoints([]);
    setSplitLines([]);
    setStrokes([]);
    setPendingLineStart(null);
    notifyChange([], [], []);
  };

  const handleSaveExplicit = () => {
    if (onSave) {
      onSave({
        polygonPoints: points,
        splitLines: splitLines,
        freehandStrokes: strokes,
      });
    }
  };

  if (!activeImage) {
    return (
      <div className="p-6 bg-slate-50 border border-dashed border-slate-300 rounded-xl text-center text-slate-500 text-xs flex flex-col items-center gap-2">
        <AlertCircle className="w-6 h-6 text-slate-400" />
        <span>Vui lòng chụp hoặc tải ảnh mặt đứng chính diện <strong>(Ảnh P-02)</strong> ở trên để vẽ đa giác góc nhà và phân tầng.</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full gap-2">
      {/* Top Toolbar */}
      {!readOnly && (
        <div className="flex flex-col gap-2 p-2 sm:p-2.5 rounded-xl bg-white border border-slate-200/90 shadow-2xs text-xs text-slate-700">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex items-center gap-1.5 flex-wrap">
              <button
                type="button"
                onClick={() => {
                  setActiveTool('POLYGON');
                  setPendingLineStart(null);
                }}
                className={`px-2.5 py-1.5 rounded-lg font-bold flex items-center gap-1 transition-colors cursor-pointer ${
                  activeTool === 'POLYGON'
                    ? 'bg-sky-600 text-white shadow-xs'
                    : 'text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-200'
                }`}
              >
                <Dot className="w-4 h-4 text-red-500" />
                <span>Chấm góc bao ({points.length})</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTool('SPLIT_LINE')}
                className={`px-2.5 py-1.5 rounded-lg font-bold flex items-center gap-1 transition-colors cursor-pointer ${
                  activeTool === 'SPLIT_LINE'
                    ? 'bg-sky-600 text-white shadow-xs'
                    : 'text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-200'
                }`}
              >
                <Minus className="w-4 h-4 text-amber-500" />
                <span>Line phân tầng ({splitLines.length})</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setActiveTool('FREEHAND');
                  setPendingLineStart(null);
                }}
                className={`px-2.5 py-1.5 rounded-lg font-bold flex items-center gap-1 transition-colors cursor-pointer ${
                  activeTool === 'FREEHAND'
                    ? 'bg-sky-600 text-white shadow-xs'
                    : 'text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-200'
                }`}
              >
                <PenTool className="w-3.5 h-3.5 text-yellow-600" />
                <span>Vẽ note tay ({strokes.length})</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setActiveTool('PAN');
                  setPendingLineStart(null);
                }}
                className={`px-2 sm:px-2.5 py-1.5 rounded-lg font-bold flex items-center gap-1 transition-colors cursor-pointer ${
                  activeTool === 'PAN'
                    ? 'bg-amber-600 text-white shadow-xs'
                    : 'text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-200'
                }`}
                title="Kéo & di chuyển toàn bộ ảnh khi phóng to"
              >
                <Hand className="w-3.5 h-3.5 text-amber-500" />
                <span>Kéo ảnh</span>
              </button>
            </div>

            <div className="flex items-center gap-1.5">
              {/* Undo buttons */}
              {points.length > 0 && activeTool === 'POLYGON' && (
                <button
                  type="button"
                  onClick={removeLastPoint}
                  title="Xóa điểm đa giác cuối"
                  className="p-1.5 bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200 rounded-lg cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>
              )}

              {splitLines.length > 0 && activeTool === 'SPLIT_LINE' && (
                <button
                  type="button"
                  onClick={removeLastLine}
                  title="Xóa đường phân tầng cuối"
                  className="p-1.5 bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200 rounded-lg cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>
              )}

              {strokes.length > 0 && activeTool === 'FREEHAND' && (
                <button
                  type="button"
                  onClick={removeLastStroke}
                  title="Xóa nét vẽ tay cuối"
                  className="p-1.5 bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-200 rounded-lg cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>
              )}

              {(points.length > 0 || splitLines.length > 0 || strokes.length > 0) && (
                <button
                  type="button"
                  onClick={resetAll}
                  title="Xóa tất cả"
                  className="p-1.5 bg-red-50 text-red-600 hover:bg-red-600 hover:text-white border border-red-200 rounded-lg transition-colors cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}

              {/* Explicit Save button */}
              {onSave && (
                <button
                  type="button"
                  onClick={handleSaveExplicit}
                  className="px-3 py-1.5 rounded-lg font-bold flex items-center gap-1 bg-emerald-600 text-white hover:bg-emerald-700 transition-colors shadow-sm ml-1 cursor-pointer"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>Lưu & Đóng</span>
                </button>
              )}
            </div>
          </div>

          {/* Sub-toolbar for SPLIT_LINE options */}
          {activeTool === 'SPLIT_LINE' && (
            <div className="flex items-center justify-between flex-wrap gap-2 pt-2 border-t border-slate-200 text-[11px] text-slate-600">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-slate-600 font-semibold">Loại line tiếp theo:</span>
                <button
                  type="button"
                  onClick={() => setActiveLineType('GROUND')}
                  className={`px-2 py-0.5 rounded transition-colors cursor-pointer ${
                    activeLineType === 'GROUND' ? 'bg-amber-500 text-white font-bold shadow-2xs' : 'bg-slate-100 text-slate-700 border border-slate-200 hover:bg-slate-200'
                  }`}
                >
                  Line tầng trệt
                </button>
                <button
                  type="button"
                  onClick={() => setActiveLineType('MEZZANINE')}
                  className={`px-2 py-0.5 rounded transition-colors cursor-pointer ${
                    activeLineType === 'MEZZANINE' ? 'bg-amber-500 text-white font-bold shadow-2xs' : 'bg-slate-100 text-slate-700 border border-slate-200 hover:bg-slate-200'
                  }`}
                >
                  Line tầng lửng
                </button>
                <button
                  type="button"
                  onClick={() => setActiveLineType('FLOOR')}
                  className={`px-2 py-0.5 rounded transition-colors cursor-pointer ${
                    activeLineType === 'FLOOR' ? 'bg-amber-500 text-white font-bold shadow-2xs' : 'bg-slate-100 text-slate-700 border border-slate-200 hover:bg-slate-200'
                  }`}
                >
                  {getFloorName('FLOOR')}
                </button>
                <button
                  type="button"
                  onClick={() => setActiveLineType('ROOF')}
                  className={`px-2 py-0.5 rounded transition-colors cursor-pointer ${
                    activeLineType === 'ROOF' ? 'bg-amber-500 text-white font-bold shadow-2xs' : 'bg-slate-100 text-slate-700 border border-slate-200 hover:bg-slate-200'
                  }`}
                >
                  Line mái / Sân thượng
                </button>
              </div>

              <div className="flex items-center gap-2">
                {pendingLineStart ? (
                  <span className="text-amber-700 font-bold flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping inline-block" />
                    Chấm điểm 2 để nối line...
                    <button
                      type="button"
                      onClick={() => setPendingLineStart(null)}
                      className="ml-1 p-0.5 text-slate-500 hover:text-slate-800"
                      title="Hủy điểm đầu"
                    >
                      <X className="w-3 h-3 inline" />
                    </button>
                  </span>
                ) : (
                  <span className="text-slate-500 italic">
                    * Chấm 2 đầu của dầm/sàn để nối thành 1 line (hỗ trợ góc chụp nghiêng)
                  </span>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Interactive Canvas Viewport - Scales cleanly for 9:16 portrait or 4:3 */}
      <div className="flex-1 w-full min-h-0 relative overflow-hidden rounded-xl bg-slate-100/90 border border-slate-300/80 flex items-center justify-center select-none shadow-inner">
        <div
          ref={canvasContainerRef}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          onPointerUp={handlePointerUp}
          onPointerCancel={handlePointerUp}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          className={`relative max-w-full max-h-full flex items-center justify-center touch-none select-none transition-transform duration-75 ${
            activeTool === 'PAN' ? (isPanning ? 'cursor-grabbing' : 'cursor-grab') : 'cursor-crosshair'
          }`}
          style={{
            transform: `scale(${zoom}) translate(${pan.x / zoom}px, ${pan.y / zoom}px)`,
            transformOrigin: 'center center',
            userSelect: 'none',
          }}
        >
          <img
            src={activeImage}
            alt="Facade view"
            className="max-h-[calc(100vh-210px)] max-w-full object-contain pointer-events-none rounded shadow-2xl block"
          />

          {/* SVG Overlay matches exact image bounding box */}
          <svg
            className="absolute inset-0 w-full h-full pointer-events-none"
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
          >
            {/* Polygon area */}
            {points.length >= 3 && (
              <polygon
                points={points.map((p) => `${p.x},${p.y}`).join(' ')}
                fill="rgba(2, 132, 199, 0.25)"
                stroke="#38bdf8"
                strokeWidth="0.8"
                strokeDasharray="1.5, 1"
              />
            )}

            {/* Polygon lines if < 3 points */}
            {points.length < 3 && points.length > 1 && (
              <polyline
                points={points.map((p) => `${p.x},${p.y}`).join(' ')}
                fill="none"
                stroke="#38bdf8"
                strokeWidth="0.8"
              />
            )}

            {/* Polygon points */}
            {points.map((p, idx) => (
              <g key={idx}>
                <circle cx={p.x} cy={p.y} r="1.8" fill="#ef4444" stroke="#ffffff" strokeWidth="0.6" />
                <text x={p.x + 2} y={p.y - 2} fontSize="3" fill="#ffffff" fontWeight="bold">
                  P{idx + 1}
                </text>
              </g>
            ))}

            {/* Floor split lines */}
            {splitLines.map((line, idx) => {
              if (line.x1 !== undefined && line.x2 !== undefined && line.y1 !== undefined && line.y2 !== undefined) {
                // 2-point slanted / horizontal line
                const midX = (line.x1 + line.x2) / 2;
                const midY = (line.y1 + line.y2) / 2;
                return (
                  <g key={idx}>
                    <line
                      x1={line.x1}
                      y1={line.y1}
                      x2={line.x2}
                      y2={line.y2}
                      stroke="#f59e0b"
                      strokeWidth="0.8"
                      strokeDasharray="2, 1.5"
                    />
                    <circle cx={line.x1} cy={line.y1} r="1.2" fill="#f59e0b" stroke="#ffffff" strokeWidth="0.4" />
                    <circle cx={line.x2} cy={line.y2} r="1.2" fill="#f59e0b" stroke="#ffffff" strokeWidth="0.4" />
                    <rect x={midX - 10} y={midY - 2.2} width="20" height="3.6" fill="rgba(15, 23, 42, 0.9)" rx="0.8" />
                    <text x={midX} y={midY + 0.3} fontSize="2.2" fill="#fef08a" fontWeight="bold" textAnchor="middle">
                      {line.floor}
                    </text>
                  </g>
                );
              } else if (line.y !== undefined) {
                // Legacy horizontal line fallback
                return (
                  <g key={idx}>
                    <line
                      x1="0"
                      y1={line.y}
                      x2="100"
                      y2={line.y}
                      stroke="#f59e0b"
                      strokeWidth="0.7"
                      strokeDasharray="2, 1.5"
                    />
                    <rect x="2" y={line.y - 4} width="22" height="3.6" fill="rgba(15, 23, 42, 0.85)" rx="0.8" />
                    <text x="3" y={line.y - 1.5} fontSize="2.4" fill="#fef08a" fontWeight="bold">
                      ── {line.floor}
                    </text>
                  </g>
                );
              }
              return null;
            })}

            {/* Split line preview during 2-point drawing */}
            {activeTool === 'SPLIT_LINE' && pendingLineStart && hoverCoords && (
              <g>
                <circle cx={pendingLineStart.x} cy={pendingLineStart.y} r="1.5" fill="#f59e0b" stroke="#ffffff" strokeWidth="0.5" />
                <line
                  x1={pendingLineStart.x}
                  y1={pendingLineStart.y}
                  x2={hoverCoords.x}
                  y2={hoverCoords.y}
                  stroke="#fbbf24"
                  strokeWidth="0.8"
                  strokeDasharray="1.5, 1"
                />
                <circle cx={hoverCoords.x} cy={hoverCoords.y} r="1.2" fill="#fbbf24" opacity="0.8" />
              </g>
            )}

            {/* Saved Freehand Strokes */}
            {strokes.map((stroke, idx) => {
              if (stroke.points.length < 2) return null;
              const d = stroke.points.map((pt, i) => `${i === 0 ? 'M' : 'L'} ${pt.x} ${pt.y}`).join(' ');
              return (
                <path
                  key={idx}
                  d={d}
                  fill="none"
                  stroke={stroke.color || '#facc15'}
                  strokeWidth={stroke.width || 1.2}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              );
            })}

            {/* Active drawing stroke */}
            {isDrawing && currentStroke.length > 1 && (
              <path
                d={currentStroke.map((pt, i) => `${i === 0 ? 'M' : 'L'} ${pt.x} ${pt.y}`).join(' ')}
                fill="none"
                stroke="#facc15"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            )}
          </svg>
        </div>

        {/* Floating Zoom & Pan Controls Widget */}
        <div className="absolute bottom-3 right-3 z-30 flex items-center gap-1 bg-white/95 text-slate-800 backdrop-blur-md border border-slate-200 p-1 rounded-xl shadow-lg select-none">
          <button
            type="button"
            onClick={handleZoomOut}
            disabled={zoom <= 1}
            className="p-1.5 rounded-lg hover:bg-slate-100 disabled:opacity-30 disabled:pointer-events-none text-slate-700 transition-colors cursor-pointer"
            title="Thu nhỏ (Zoom -)"
          >
            <ZoomOut className="w-4 h-4" />
          </button>

          <span className="px-1.5 font-mono text-[11px] font-bold min-w-[38px] text-center text-sky-600">
            {Math.round(zoom * 100)}%
          </span>

          <button
            type="button"
            onClick={handleZoomIn}
            disabled={zoom >= 4}
            className="p-1.5 rounded-lg hover:bg-slate-100 disabled:opacity-30 disabled:pointer-events-none text-slate-700 transition-colors cursor-pointer"
            title="Phóng to (Zoom +)"
          >
            <ZoomIn className="w-4 h-4" />
          </button>

          {(zoom > 1 || pan.x !== 0 || pan.y !== 0) && (
            <button
              type="button"
              onClick={handleResetZoom}
              className="p-1.5 rounded-lg hover:bg-slate-100 text-amber-600 hover:text-amber-700 transition-colors cursor-pointer ml-0.5 border-l border-slate-200 pl-2"
              title="Vừa vặn khung hình 100% (Fit)"
            >
              <Maximize2 className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
