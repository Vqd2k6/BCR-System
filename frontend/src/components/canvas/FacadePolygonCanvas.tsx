import React, { useState, useRef } from 'react';
import { Dot, Minus, RotateCcw, Sparkles, Check, Trash2 } from 'lucide-react';

export interface PolygonPoint {
  x: number;
  y: number;
}

export interface FloorSplitLine {
  floor: string;
  y: number;
}

export interface FacadePolygonCanvasProps {
  imageUrl?: string;
  photoUrl?: string;
  polygonPoints?: PolygonPoint[];
  floorSplitLines?: FloorSplitLine[];
  dimensions?: Record<string, string>;
  onChange?: (points: PolygonPoint[], floorSplitLines: FloorSplitLine[], dimensions: Record<string, string>) => void;
  onSave?: (data: {
    polygonPoints: PolygonPoint[];
    splitLines: FloorSplitLine[];
    dimensions: Record<string, string>;
  }) => void;
  onTriggerAiRectify?: () => Promise<void>;
  readOnly?: boolean;
}

export const FacadePolygonCanvas: React.FC<FacadePolygonCanvasProps> = ({
  imageUrl,
  photoUrl,
  polygonPoints,
  floorSplitLines,
  dimensions,
  onChange,
  onSave,
  onTriggerAiRectify,
  readOnly = false,
}) => {
  const activeImage = imageUrl || photoUrl || 'https://images.unsplash.com/photo-1513694203232-719a280e022f?w=1000&auto=format&fit=crop&q=80';
  const [activeTool, setActiveTool] = useState<'POLYGON' | 'SPLIT_LINE' | 'DIMENSION'>('POLYGON');

  const [points, setPoints] = useState<PolygonPoint[]>(
    polygonPoints || [
      { x: 15, y: 15 },
      { x: 85, y: 15 },
      { x: 85, y: 85 },
      { x: 15, y: 85 },
    ]
  );
  const [splitLines, setSplitLines] = useState<FloorSplitLine[]>(
    floorSplitLines || [
      { floor: 'Tầng trệt', y: 70 },
      { floor: 'Lầu 1', y: 45 },
      { floor: 'Lầu 2', y: 20 },
    ]
  );
  const [currentDimensions, setCurrentDimensions] = useState<Record<string, string>>(
    dimensions || {
      width: '4.5m',
      h_floor1: '3.8m',
      h_floor2: '3.4m',
      h_total: '12.5m',
    }
  );

  const [aiStatus, setAiStatus] = useState<'IDLE' | 'PROCESSING' | 'COMPLETED'>('IDLE');
  const canvasRef = useRef<HTMLDivElement>(null);

  const notifyChange = (newPts: PolygonPoint[], newLines: FloorSplitLine[], newDims: Record<string, string>) => {
    if (onChange) onChange(newPts, newLines, newDims);
    if (onSave) onSave({ polygonPoints: newPts, splitLines: newLines, dimensions: newDims });
  };

  const handleCanvasClick = (e: React.MouseEvent<HTMLDivElement> | React.TouchEvent<HTMLDivElement>) => {
    if (readOnly || !canvasRef.current) return;
    const rect = canvasRef.current.getBoundingClientRect();

    let clientX = 0;
    let clientY = 0;
    if ('touches' in e) {
      if (e.touches.length === 0) return;
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }

    const x = Math.round(((clientX - rect.left) / rect.width) * 100);
    const y = Math.round(((clientY - rect.top) / rect.height) * 100);

    if (activeTool === 'POLYGON') {
      const updated = [...points, { x, y }];
      setPoints(updated);
      notifyChange(updated, splitLines, currentDimensions);
    } else if (activeTool === 'SPLIT_LINE') {
      const nextFloorIndex = splitLines.length + 1;
      const updated = [...splitLines, { floor: `Tầng ${nextFloorIndex}`, y }];
      setSplitLines(updated);
      notifyChange(points, updated, currentDimensions);
    }
  };

  const removeLastPoint = () => {
    if (readOnly || points.length === 0) return;
    const updated = points.slice(0, -1);
    setPoints(updated);
    notifyChange(updated, splitLines, currentDimensions);
  };

  const resetAll = () => {
    if (readOnly) return;
    setPoints([]);
    setSplitLines([]);
    notifyChange([], [], currentDimensions);
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
    }, 1200);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
      {/* Tool Selector Bar */}
      {!readOnly && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0.5rem 0.75rem',
            borderRadius: '0.75rem',
            background: 'rgba(15, 23, 42, 0.85)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            fontSize: '0.75rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <button
              type="button"
              onClick={() => setActiveTool('POLYGON')}
              className={`btn btn-sm ${activeTool === 'POLYGON' ? 'btn-primary' : 'btn-secondary'}`}
              style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.75rem', padding: '0.3rem 0.6rem' }}
            >
              <Dot size={16} color="#f87171" />
              Đa giác góc ({points.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTool('SPLIT_LINE')}
              className={`btn btn-sm ${activeTool === 'SPLIT_LINE' ? 'btn-primary' : 'btn-secondary'}`}
              style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', fontSize: '0.75rem', padding: '0.3rem 0.6rem' }}
            >
              <Minus size={16} color="#fbbf24" />
              Line phân tầng ({splitLines.length})
            </button>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
            <button
              type="button"
              onClick={removeLastPoint}
              className="btn btn-sm btn-secondary"
              title="Xóa điểm vừa chạm"
              style={{ padding: '0.3rem 0.5rem' }}
            >
              <RotateCcw size={14} />
            </button>
            <button
              type="button"
              onClick={resetAll}
              className="btn btn-sm btn-danger"
              title="Xóa hết vẽ lại"
              style={{ padding: '0.3rem 0.5rem' }}
            >
              <Trash2 size={14} />
            </button>
          </div>
        </div>
      )}

      {/* Interactive Photo Canvas */}
      <div
        ref={canvasRef}
        onClick={handleCanvasClick}
        onTouchStart={handleCanvasClick}
        style={{
          position: 'relative',
          width: '100%',
          height: '320px',
          borderRadius: '0.75rem',
          border: '2px dashed rgba(56, 189, 248, 0.3)',
          overflow: 'hidden',
          cursor: readOnly ? 'default' : 'crosshair',
          userSelect: 'none',
          touchAction: 'none',
          backgroundColor: '#0f172a',
        }}
      >
        <img
          src={activeImage}
          alt="Mặt đứng P-02"
          style={{ width: '100%', height: '100%', objectFit: 'contain', pointerEvents: 'none' }}
        />

        {/* SVG Overlay for Polygon & Split Lines */}
        <svg style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', pointerEvents: 'none' }}>
          {/* N-Point Polygon */}
          {points.length >= 3 && (
            <polygon
              points={points.map((p) => `${p.x}%,${p.y}%`).join(' ')}
              fill="rgba(14, 165, 233, 0.25)"
              stroke="#38bdf8"
              strokeWidth="2.5"
              strokeDasharray="4 2"
            />
          )}

          {/* Lines connecting points if < 3 */}
          {points.length === 2 && (
            <line
              x1={`${points[0].x}%`}
              y1={`${points[0].y}%`}
              x2={`${points[1].x}%`}
              y2={`${points[1].y}%`}
              stroke="#38bdf8"
              strokeWidth="2"
            />
          )}

          {/* Floor Split Lines */}
          {splitLines.map((line, idx) => (
            <g key={idx}>
              <line
                x1="0%"
                y1={`${line.y}%`}
                x2="100%"
                y2={`${line.y}%`}
                stroke="#f59e0b"
                strokeWidth="2"
                strokeDasharray="5 3"
              />
              <rect x="8" y={`calc(${line.y}% - 10px)`} width="65" height="18" rx="4" fill="rgba(15, 23, 42, 0.85)" />
              <text x="12" y={`calc(${line.y}% + 3px)`} fill="#fbbf24" fontSize="10" fontWeight="bold">
                {line.floor}
              </text>
            </g>
          ))}
        </svg>

        {/* Point Badges */}
        {points.map((p, idx) => (
          <div
            key={idx}
            style={{
              position: 'absolute',
              left: `${p.x}%`,
              top: `${p.y}%`,
              transform: 'translate(-50%, -50%)',
              width: '20px',
              height: '20px',
              borderRadius: '50%',
              backgroundColor: '#ef4444',
              border: '2px solid #ffffff',
              color: '#ffffff',
              fontSize: '10px',
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 2px 6px rgba(0,0,0,0.5)',
            }}
          >
            {idx + 1}
          </div>
        ))}
      </div>

      {/* AI Rectify trigger & guide */}
      <div
        style={{
          fontSize: '0.75rem',
          color: '#94a3b8',
          background: 'rgba(30, 41, 59, 0.6)',
          padding: '0.6rem 0.75rem',
          borderRadius: '0.5rem',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          border: '1px solid rgba(255, 255, 255, 0.05)',
        }}
      >
        <span>💡 Chạm các góc bao quanh nhà ($N \ge 3$) + Thêm đường phân tầng</span>
        <button
          type="button"
          onClick={triggerAI}
          disabled={aiStatus === 'PROCESSING'}
          className="btn btn-sm"
          style={{
            background: aiStatus === 'COMPLETED' ? '#059669' : '#4f46e5',
            color: '#ffffff',
            display: 'flex',
            alignItems: 'center',
            gap: '0.25rem',
            fontSize: '0.75rem',
            padding: '0.25rem 0.5rem',
          }}
        >
          <Sparkles size={13} />
          {aiStatus === 'PROCESSING' ? 'AI đang nắn...' : aiStatus === 'COMPLETED' ? 'Đã nắn CAD' : 'AI Nắn Mặt Đứng'}
        </button>
      </div>
    </div>
  );
};
export default FacadePolygonCanvas;
