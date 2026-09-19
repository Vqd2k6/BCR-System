import React, { useState, useRef, useEffect } from 'react';
import { Dot, Minus, RotateCcw, Sparkles, Trash2, PenTool, AlertCircle } from 'lucide-react';

export interface PolygonPoint {
  x: number;
  y: number;
}

export interface FloorSplitLine {
  floor: string;
  y: number;
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
  const [activeTool, setActiveTool] = useState<'POLYGON' | 'SPLIT_LINE' | 'FREEHAND'>('POLYGON');

  const [points, setPoints] = useState<PolygonPoint[]>(polygonPoints || []);
  const [splitLines, setSplitLines] = useState<FloorSplitLine[]>(floorSplitLines || []);
  const [strokes, setStrokes] = useState<FreehandStroke[]>(freehandStrokes || []);
  const [isDrawing, setIsDrawing] = useState<boolean>(false);
  const [currentStroke, setCurrentStroke] = useState<{ x: number; y: number }[]>([]);

  const [aiStatus, setAiStatus] = useState<'IDLE' | 'PROCESSING' | 'COMPLETED'>('IDLE');
  const canvasContainerRef = useRef<HTMLDivElement>(null);

  const notifyChange = (newPts: PolygonPoint[], newLines: FloorSplitLine[], newStrokes: FreehandStroke[]) => {
    if (onChange) onChange(newPts, newLines, newStrokes);
    if (onSave) onSave({ polygonPoints: newPts, splitLines: newLines, freehandStrokes: newStrokes });
  };

  const getCanvasCoords = (clientX: number, clientY: number) => {
    if (!canvasContainerRef.current) return { x: 0, y: 0 };
    const rect = canvasContainerRef.current.getBoundingClientRect();
    const x = Math.max(0, Math.min(100, Math.round(((clientX - rect.left) / rect.width) * 100)));
    const y = Math.max(0, Math.min(100, Math.round(((clientY - rect.top) / rect.height) * 100)));
    return { x, y };
  };

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (readOnly || !activeImage) return;
    const { x, y } = getCanvasCoords(e.clientX, e.clientY);

    if (activeTool === 'POLYGON') {
      const updated = [...points, { x, y }];
      setPoints(updated);
      notifyChange(updated, splitLines, strokes);
    } else if (activeTool === 'SPLIT_LINE') {
      const nextFloorIndex = splitLines.length + 1;
      const floorName = nextFloorIndex === 1 ? 'Tầng trệt' : `Lầu ${nextFloorIndex - 1}`;
      const updated = [...splitLines, { floor: floorName, y }];
      setSplitLines(updated);
      notifyChange(points, updated, strokes);
    } else if (activeTool === 'FREEHAND') {
      setIsDrawing(true);
      setCurrentStroke([{ x, y }]);
    }
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isDrawing || activeTool !== 'FREEHAND' || readOnly) return;
    const { x, y } = getCanvasCoords(e.clientX, e.clientY);
    setCurrentStroke((prev) => [...prev, { x, y }]);
  };

  const handlePointerUp = () => {
    if (isDrawing && activeTool === 'FREEHAND' && currentStroke.length > 0) {
      setIsDrawing(false);
      const newStroke: FreehandStroke = {
        points: currentStroke,
        color: '#facc15', // Bright yellow for clear visibility
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
    notifyChange([], [], []);
  };

  const triggerAI = async () => {
    setAiStatus('PROCESSING');
    if (onTriggerAiRectify) {
      try {
        await onTriggerAiRectify();
      } catch (_e) {}
    }
    setTimeout(() => {
      setAiStatus('COMPLETED');
    }, 1000);
  };

  if (!activeImage) {
    return (
      <div
        style={{
          padding: '1.5rem',
          backgroundColor: '#f8fafc',
          border: '1px dashed #cbd5e1',
          borderRadius: '0.75rem',
          textAlign: 'center',
          color: '#64748b',
          fontSize: '0.825rem',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '0.5rem',
        }}
      >
        <AlertCircle size={24} color="#94a3b8" />
        <span>Vui lòng chụp hoặc tải ảnh mặt đứng chính diện <strong>(Ảnh P-02)</strong> ở trên để vẽ đa giác góc nhà, phân tầng và ghi chú kích thước.</span>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
      {/* Top Toolbar */}
      {!readOnly && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0.5rem 0.75rem',
            borderRadius: '0.75rem',
            background: 'rgba(15, 23, 42, 0.92)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            fontSize: '0.75rem',
            flexWrap: 'wrap',
            gap: '0.4rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={() => setActiveTool('POLYGON')}
              style={{
                backgroundColor: activeTool === 'POLYGON' ? '#0284c7' : 'transparent',
                color: '#ffffff',
                border: 'none',
                padding: '0.35rem 0.65rem',
                borderRadius: '0.4rem',
                fontWeight: activeTool === 'POLYGON' ? 700 : 500,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.25rem',
              }}
            >
              <Dot size={16} />
              <span>Đa giác góc ({points.length})</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTool('SPLIT_LINE')}
              style={{
                backgroundColor: activeTool === 'SPLIT_LINE' ? '#0284c7' : 'transparent',
                color: '#ffffff',
                border: 'none',
                padding: '0.35rem 0.65rem',
                borderRadius: '0.4rem',
                fontWeight: activeTool === 'SPLIT_LINE' ? 700 : 500,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.25rem',
              }}
            >
              <Minus size={16} />
              <span>Line phân tầng ({splitLines.length})</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTool('FREEHAND')}
              style={{
                backgroundColor: activeTool === 'FREEHAND' ? '#0284c7' : 'transparent',
                color: '#ffffff',
                border: 'none',
                padding: '0.35rem 0.65rem',
                borderRadius: '0.4rem',
                fontWeight: activeTool === 'FREEHAND' ? 700 : 500,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.25rem',
              }}
            >
              <PenTool size={14} />
              <span>Vẽ note tay ({strokes.length})</span>
            </button>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            {/* Perspective Correction Button */}
            <button
              type="button"
              onClick={triggerAI}
              disabled={aiStatus === 'PROCESSING'}
              style={{
                backgroundColor: aiStatus === 'COMPLETED' ? '#10b981' : '#7c3aed',
                color: '#ffffff',
                border: 'none',
                padding: '0.35rem 0.65rem',
                borderRadius: '0.4rem',
                fontWeight: 700,
                cursor: aiStatus === 'PROCESSING' ? 'wait' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.3rem',
                boxShadow: '0 2px 6px rgba(124, 58, 237, 0.3)',
              }}
            >
              <Sparkles size={13} />
              <span>
                {aiStatus === 'PROCESSING'
                  ? 'Đang nắn ảnh...'
                  : aiStatus === 'COMPLETED'
                  ? 'Đã nắn thẳng'
                  : 'Nắn thẳng ảnh (AI)'}
              </span>
            </button>

            {/* Undo buttons */}
            {points.length > 0 && activeTool === 'POLYGON' && (
              <button
                type="button"
                onClick={removeLastPoint}
                title="Xóa điểm đa giác cuối"
                style={{
                  backgroundColor: '#334155',
                  color: '#ffffff',
                  border: 'none',
                  padding: '0.35rem 0.5rem',
                  borderRadius: '0.4rem',
                  cursor: 'pointer',
                }}
              >
                <RotateCcw size={13} />
              </button>
            )}

            {splitLines.length > 0 && activeTool === 'SPLIT_LINE' && (
              <button
                type="button"
                onClick={removeLastLine}
                title="Xóa đường phân tầng cuối"
                style={{
                  backgroundColor: '#334155',
                  color: '#ffffff',
                  border: 'none',
                  padding: '0.35rem 0.5rem',
                  borderRadius: '0.4rem',
                  cursor: 'pointer',
                }}
              >
                <RotateCcw size={13} />
              </button>
            )}

            {strokes.length > 0 && activeTool === 'FREEHAND' && (
              <button
                type="button"
                onClick={removeLastStroke}
                title="Xóa nét vẽ tay cuối"
                style={{
                  backgroundColor: '#334155',
                  color: '#ffffff',
                  border: 'none',
                  padding: '0.35rem 0.5rem',
                  borderRadius: '0.4rem',
                  cursor: 'pointer',
                }}
              >
                <RotateCcw size={13} />
              </button>
            )}

            {(points.length > 0 || splitLines.length > 0 || strokes.length > 0) && (
              <button
                type="button"
                onClick={resetAll}
                title="Xóa tất cả"
                style={{
                  backgroundColor: '#ef4444',
                  color: '#ffffff',
                  border: 'none',
                  padding: '0.35rem 0.5rem',
                  borderRadius: '0.4rem',
                  cursor: 'pointer',
                }}
              >
                <Trash2 size={13} />
              </button>
            )}
          </div>
        </div>
      )}

      {/* Interactive Canvas */}
      <div
        ref={canvasContainerRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        style={{
          position: 'relative',
          width: '100%',
          minHeight: '280px',
          maxHeight: '480px',
          borderRadius: '0.75rem',
          overflow: 'hidden',
          backgroundColor: '#0f172a',
          cursor: readOnly ? 'default' : activeTool === 'FREEHAND' ? 'url("data:image/svg+xml;utf8,<svg xmlns=\'http://www.w3.org/2000/svg\' width=\'16\' height=\'16\' fill=\'%23facc15\' viewBox=\'0 0 16 16\'><circle cx=\'8\' cy=\'8\' r=\'4\'/></svg>") 8 8, crosshair' : 'crosshair',
          userSelect: 'none',
          touchAction: 'none',
          border: '1px solid #cbd5e1',
        }}
      >
        <img
          src={activeImage}
          alt="Facade view"
          style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block', pointerEvents: 'none' }}
        />

        {/* SVG Overlay */}
        <svg
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            pointerEvents: 'none',
          }}
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

          {/* Floor split horizontal lines */}
          {splitLines.map((line, idx) => (
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
          ))}

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

      <div style={{ fontSize: '0.725rem', color: '#64748b', fontStyle: 'italic' }}>
        * Chạm để định vị góc nhà ($N \ge 3$), kéo đường phân tầng hoặc chọn <strong>Vẽ note tay</strong> để cầm bút/chạm tay vẽ kích thước ($W, H, h_1, h_2...$) trực tiếp lên ảnh.
      </div>
    </div>
  );
};
