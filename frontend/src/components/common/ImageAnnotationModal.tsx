import React, { useState, useRef, useEffect } from 'react';
import {
  ArrowRight,
  PenTool,
  Circle,
  Square,
  Type,
  RotateCcw,
  Trash2,
  Check,
  X,
  Sparkles,
} from 'lucide-react';

export interface ImageAnnotationModalProps {
  isOpen: boolean;
  imageUrl: string;
  title?: string;
  initialTool?: 'ARROW' | 'PEN' | 'CIRCLE' | 'RECT' | 'TEXT';
  onSave: (annotatedBase64: string) => void;
  onClose: () => void;
}

type AnnotationType =
  | { type: 'PEN'; points: { x: number; y: number }[]; color: string; width: number }
  | { type: 'ARROW'; from: { x: number; y: number }; to: { x: number; y: number }; color: string; width: number; label?: string }
  | { type: 'CIRCLE'; cx: number; cy: number; rx: number; ry: number; color: string; width: number }
  | { type: 'RECT'; x: number; y: number; w: number; h: number; color: string; width: number }
  | { type: 'TEXT'; x: number; y: number; text: string; color: string; fontSize: number };

const COLORS = [
  { label: 'Đỏ', value: '#ef4444' },
  { label: 'Vàng', value: '#facc15' },
  { label: 'Xanh lục', value: '#22c55e' },
  { label: 'Xanh dương', value: '#38bdf8' },
  { label: 'Trắng', value: '#ffffff' },
];

export const ImageAnnotationModal: React.FC<ImageAnnotationModalProps> = ({
  isOpen,
  imageUrl,
  title = 'Ghi chú & Đánh dấu trên ảnh',
  initialTool = 'ARROW',
  onSave,
  onClose,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [imageLoaded, setImageLoaded] = useState(false);
  const imageObjRef = useRef<HTMLImageElement | null>(null);

  const [activeTool, setActiveTool] = useState<'ARROW' | 'PEN' | 'CIRCLE' | 'RECT' | 'TEXT'>(initialTool);
  const [selectedColor, setSelectedColor] = useState<string>('#ef4444');
  const [lineWidth, setLineWidth] = useState<number>(3);
  const [arrowLabel, setArrowLabel] = useState<string>('Công trình khảo sát');
  const [customText, setCustomText] = useState<string>('');

  const [annotations, setAnnotations] = useState<AnnotationType[]>([]);
  const [isDrawing, setIsDrawing] = useState(false);
  const [startPos, setStartPos] = useState<{ x: number; y: number } | null>(null);
  const [currentPenPoints, setCurrentPenPoints] = useState<{ x: number; y: number }[]>([]);
  const [previewPos, setPreviewPos] = useState<{ x: number; y: number } | null>(null);

  // Load Image when modal opens
  useEffect(() => {
    if (!isOpen || !imageUrl) return;

    setImageLoaded(false);
    setAnnotations([]);
    setActiveTool(initialTool);

    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      imageObjRef.current = img;
      setImageLoaded(true);
    };
    img.src = imageUrl;
  }, [isOpen, imageUrl, initialTool]);

  // Redraw Canvas whenever annotations or preview changes
  const redraw = () => {
    const canvas = canvasRef.current;
    if (!canvas || !imageObjRef.current) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Clear
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw base image
    ctx.drawImage(imageObjRef.current, 0, 0, canvas.width, canvas.height);

    // Draw committed annotations
    annotations.forEach((item) => {
      drawSingleAnnotation(ctx, item);
    });

    // Draw active drawing preview
    if (isDrawing && startPos && previewPos) {
      if (activeTool === 'PEN' && currentPenPoints.length > 1) {
        ctx.beginPath();
        ctx.strokeStyle = selectedColor;
        ctx.lineWidth = lineWidth;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        ctx.moveTo(currentPenPoints[0].x, currentPenPoints[0].y);
        for (let i = 1; i < currentPenPoints.length; i++) {
          ctx.lineTo(currentPenPoints[i].x, currentPenPoints[i].y);
        }
        ctx.stroke();
      } else if (activeTool === 'ARROW') {
        drawArrow(ctx, startPos.x, startPos.y, previewPos.x, previewPos.y, selectedColor, lineWidth, arrowLabel);
      } else if (activeTool === 'RECT') {
        const x = Math.min(startPos.x, previewPos.x);
        const y = Math.min(startPos.y, previewPos.y);
        const w = Math.abs(previewPos.x - startPos.x);
        const h = Math.abs(previewPos.y - startPos.y);
        ctx.beginPath();
        ctx.strokeStyle = selectedColor;
        ctx.lineWidth = lineWidth;
        ctx.strokeRect(x, y, w, h);
      } else if (activeTool === 'CIRCLE') {
        const rx = Math.abs(previewPos.x - startPos.x) / 2;
        const ry = Math.abs(previewPos.y - startPos.y) / 2;
        const cx = Math.min(startPos.x, previewPos.x) + rx;
        const cy = Math.min(startPos.y, previewPos.y) + ry;
        ctx.beginPath();
        ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
        ctx.strokeStyle = selectedColor;
        ctx.lineWidth = lineWidth;
        ctx.stroke();
      }
    }
  };

  useEffect(() => {
    if (imageLoaded) {
      redraw();
    }
  }, [imageLoaded, annotations, isDrawing, previewPos, currentPenPoints]);

  const drawSingleAnnotation = (ctx: CanvasRenderingContext2D, item: AnnotationType) => {
    ctx.save();
    if (item.type === 'PEN') {
      if (item.points.length < 2) return;
      ctx.beginPath();
      ctx.strokeStyle = item.color;
      ctx.lineWidth = item.width;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.moveTo(item.points[0].x, item.points[0].y);
      for (let i = 1; i < item.points.length; i++) {
        ctx.lineTo(item.points[i].x, item.points[i].y);
      }
      ctx.stroke();
    } else if (item.type === 'ARROW') {
      drawArrow(ctx, item.from.x, item.from.y, item.to.x, item.to.y, item.color, item.width, item.label);
    } else if (item.type === 'RECT') {
      ctx.beginPath();
      ctx.strokeStyle = item.color;
      ctx.lineWidth = item.width;
      ctx.strokeRect(item.x, item.y, item.w, item.h);
    } else if (item.type === 'CIRCLE') {
      ctx.beginPath();
      ctx.ellipse(item.cx, item.cy, item.rx, item.ry, 0, 0, Math.PI * 2);
      ctx.strokeStyle = item.color;
      ctx.lineWidth = item.width;
      ctx.stroke();
    } else if (item.type === 'TEXT') {
      ctx.font = `bold ${item.fontSize}px sans-serif`;
      const metrics = ctx.measureText(item.text);
      const padding = 6;
      ctx.fillStyle = 'rgba(15, 23, 42, 0.8)';
      ctx.fillRect(
        item.x - padding,
        item.y - item.fontSize - padding / 2,
        metrics.width + padding * 2,
        item.fontSize + padding
      );
      ctx.fillStyle = item.color;
      ctx.fillText(item.text, item.x, item.y);
    }
    ctx.restore();
  };

  const drawArrow = (
    ctx: CanvasRenderingContext2D,
    fromX: number,
    fromY: number,
    toX: number,
    toY: number,
    color: string,
    width: number,
    label?: string
  ) => {
    ctx.save();
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = width;

    const headlen = Math.max(14, width * 4); // length of head in pixels
    const dx = toX - fromX;
    const dy = toY - fromY;
    const angle = Math.atan2(dy, dx);

    // Arrow line
    ctx.beginPath();
    ctx.moveTo(fromX, fromY);
    ctx.lineTo(toX, toY);
    ctx.stroke();

    // Arrowhead
    ctx.beginPath();
    ctx.moveTo(toX, toY);
    ctx.lineTo(toX - headlen * Math.cos(angle - Math.PI / 6), toY - headlen * Math.sin(angle - Math.PI / 6));
    ctx.lineTo(toX - headlen * Math.cos(angle + Math.PI / 6), toY - headlen * Math.sin(angle + Math.PI / 6));
    ctx.closePath();
    ctx.fill();

    // Arrow origin dot
    ctx.beginPath();
    ctx.arc(fromX, fromY, width * 1.5, 0, Math.PI * 2);
    ctx.fill();

    // Optional text label near start of arrow
    if (label && label.trim().length > 0) {
      const fontSize = Math.max(13, width * 3.5);
      ctx.font = `bold ${fontSize}px sans-serif`;
      const metrics = ctx.measureText(label);
      const pad = 6;
      const labelX = fromX - metrics.width / 2;
      const labelY = fromY - 14;

      ctx.fillStyle = 'rgba(15, 23, 42, 0.85)';
      ctx.fillRect(labelX - pad, labelY - fontSize, metrics.width + pad * 2, fontSize + pad);

      ctx.fillStyle = color;
      ctx.fillText(label, labelX, labelY - 2);
    }
    ctx.restore();
  };

  const getCanvasCoords = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();

    let clientX = 0;
    let clientY = 0;

    if ('touches' in e && e.touches.length > 0) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else if ('clientX' in e) {
      clientX = (e as React.MouseEvent).clientX;
      clientY = (e as React.MouseEvent).clientY;
    }

    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY,
    };
  };

  const handlePointerDown = (e: any) => {
    const coords = getCanvasCoords(e);

    if (activeTool === 'TEXT') {
      const textToUse = customText.trim() || prompt('Nhập nội dung ghi chú:') || '';
      if (textToUse) {
        setAnnotations((prev) => [
          ...prev,
          {
            type: 'TEXT',
            x: coords.x,
            y: coords.y,
            text: textToUse,
            color: selectedColor,
            fontSize: Math.max(16, lineWidth * 4),
          },
        ]);
      }
      return;
    }

    setIsDrawing(true);
    setStartPos(coords);
    setPreviewPos(coords);

    if (activeTool === 'PEN') {
      setCurrentPenPoints([coords]);
    }
  };

  const handlePointerMove = (e: any) => {
    if (!isDrawing) return;
    const coords = getCanvasCoords(e);
    setPreviewPos(coords);

    if (activeTool === 'PEN') {
      setCurrentPenPoints((prev) => [...prev, coords]);
    }
  };

  const handlePointerUp = () => {
    if (!isDrawing || !startPos || !previewPos) {
      setIsDrawing(false);
      return;
    }

    if (activeTool === 'PEN' && currentPenPoints.length > 1) {
      setAnnotations((prev) => [
        ...prev,
        {
          type: 'PEN',
          points: currentPenPoints,
          color: selectedColor,
          width: lineWidth,
        },
      ]);
    } else if (activeTool === 'ARROW') {
      const dist = Math.hypot(previewPos.x - startPos.x, previewPos.y - startPos.y);
      if (dist > 10) {
        setAnnotations((prev) => [
          ...prev,
          {
            type: 'ARROW',
            from: startPos,
            to: previewPos,
            color: selectedColor,
            width: lineWidth,
            label: arrowLabel,
          },
        ]);
      }
    } else if (activeTool === 'RECT') {
      const x = Math.min(startPos.x, previewPos.x);
      const y = Math.min(startPos.y, previewPos.y);
      const w = Math.abs(previewPos.x - startPos.x);
      const h = Math.abs(previewPos.y - startPos.y);
      if (w > 5 && h > 5) {
        setAnnotations((prev) => [
          ...prev,
          {
            type: 'RECT',
            x,
            y,
            w,
            h,
            color: selectedColor,
            width: lineWidth,
          },
        ]);
      }
    } else if (activeTool === 'CIRCLE') {
      const rx = Math.abs(previewPos.x - startPos.x) / 2;
      const ry = Math.abs(previewPos.y - startPos.y) / 2;
      const cx = Math.min(startPos.x, previewPos.x) + rx;
      const cy = Math.min(startPos.y, previewPos.y) + ry;
      if (rx > 3 && ry > 3) {
        setAnnotations((prev) => [
          ...prev,
          {
            type: 'CIRCLE',
            cx,
            cy,
            rx,
            ry,
            color: selectedColor,
            width: lineWidth,
          },
        ]);
      }
    }

    setIsDrawing(false);
    setStartPos(null);
    setPreviewPos(null);
    setCurrentPenPoints([]);
  };

  const handleUndo = () => {
    setAnnotations((prev) => prev.slice(0, -1));
  };

  const handleClear = () => {
    setAnnotations([]);
  };

  const handleSave = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const base64 = canvas.toDataURL('image/jpeg', 0.92);
    onSave(base64);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-xs p-2 sm:p-4">
      <div className="bg-slate-900 border border-slate-700 text-white rounded-2xl w-full max-w-4xl max-h-[95vh] flex flex-col overflow-hidden shadow-2xl animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-slate-800 bg-slate-950">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-emerald-400" />
            <span className="font-bold text-sm sm:text-base text-slate-100">{title}</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Toolbar */}
        <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 bg-slate-900 border-b border-slate-800 text-xs">
          {/* Tools */}
          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              type="button"
              onClick={() => setActiveTool('ARROW')}
              className={`px-3 py-1.5 rounded-lg font-bold flex items-center gap-1.5 transition-all ${
                activeTool === 'ARROW' ? 'bg-emerald-600 text-white shadow-sm' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              <ArrowRight className="w-3.5 h-3.5" />
              <span>Mũi tên chỉ điểm</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTool('PEN')}
              className={`px-3 py-1.5 rounded-lg font-bold flex items-center gap-1.5 transition-all ${
                activeTool === 'PEN' ? 'bg-emerald-600 text-white shadow-sm' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              <PenTool className="w-3.5 h-3.5" />
              <span>Bút vẽ tự do</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTool('CIRCLE')}
              className={`px-2.5 py-1.5 rounded-lg font-bold flex items-center gap-1 transition-all ${
                activeTool === 'CIRCLE' ? 'bg-emerald-600 text-white shadow-sm' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              <Circle className="w-3.5 h-3.5" />
              <span>Vòng tròn</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTool('RECT')}
              className={`px-2.5 py-1.5 rounded-lg font-bold flex items-center gap-1 transition-all ${
                activeTool === 'RECT' ? 'bg-emerald-600 text-white shadow-sm' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              <Square className="w-3.5 h-3.5" />
              <span>Khung vuông</span>
            </button>

            <button
              type="button"
              onClick={() => setActiveTool('TEXT')}
              className={`px-2.5 py-1.5 rounded-lg font-bold flex items-center gap-1 transition-all ${
                activeTool === 'TEXT' ? 'bg-emerald-600 text-white shadow-sm' : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
              }`}
            >
              <Type className="w-3.5 h-3.5" />
              <span>Chèn chữ</span>
            </button>
          </div>

          {/* Color & Size & Actions */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* Color swatches */}
            <div className="flex items-center gap-1 bg-slate-950 p-1 rounded-lg border border-slate-800">
              {COLORS.map((c) => (
                <button
                  key={c.value}
                  type="button"
                  onClick={() => setSelectedColor(c.value)}
                  style={{ backgroundColor: c.value }}
                  title={c.label}
                  className={`w-5 h-5 rounded-full transition-transform ${
                    selectedColor === c.value ? 'ring-2 ring-white scale-110' : 'opacity-70 hover:opacity-100'
                  }`}
                />
              ))}
            </div>

            {/* Line width */}
            <select
              value={lineWidth}
              onChange={(e) => setLineWidth(Number(e.target.value))}
              className="bg-slate-800 text-slate-200 border border-slate-700 rounded-lg px-2 py-1 text-xs"
            >
              <option value={2}>Nét mảnh (2px)</option>
              <option value={3}>Nét vừa (3px)</option>
              <option value={5}>Nét đậm (5px)</option>
            </select>

            {/* Undo & Clear */}
            <button
              type="button"
              onClick={handleUndo}
              disabled={annotations.length === 0}
              className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 disabled:opacity-40 rounded-lg"
              title="Hoàn tác"
            >
              <RotateCcw className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={handleClear}
              disabled={annotations.length === 0}
              className="p-1.5 bg-red-950/60 hover:bg-red-900 border border-red-800 text-red-300 disabled:opacity-40 rounded-lg"
              title="Xóa tất cả"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Extra option input based on tool */}
        {activeTool === 'ARROW' && (
          <div className="flex items-center gap-2 px-4 py-1.5 bg-slate-950/80 border-b border-slate-800 text-xs">
            <span className="text-slate-400 font-medium">Nhãn gắn mũi tên:</span>
            <input
              type="text"
              value={arrowLabel}
              onChange={(e) => setArrowLabel(e.target.value)}
              placeholder="VD: Công trình khảo sát / Vết nứt D-01"
              className="bg-slate-900 border border-slate-700 rounded px-2 py-0.5 text-xs text-slate-100 flex-1 max-w-xs focus:ring-1 focus:ring-emerald-500"
            />
            <span className="text-slate-500 text-[11px] italic">
              * Kéo từ vị trí nhãn và thả tại ngôi nhà/vết nứt mục tiêu
            </span>
          </div>
        )}

        {activeTool === 'TEXT' && (
          <div className="flex items-center gap-2 px-4 py-1.5 bg-slate-950/80 border-b border-slate-800 text-xs">
            <span className="text-slate-400 font-medium">Chữ cần chèn:</span>
            <input
              type="text"
              value={customText}
              onChange={(e) => setCustomText(e.target.value)}
              placeholder="Nhập nội dung rồi chạm vào ảnh để đặt..."
              className="bg-slate-900 border border-slate-700 rounded px-2 py-0.5 text-xs text-slate-100 flex-1 max-w-sm focus:ring-1 focus:ring-emerald-500"
            />
          </div>
        )}

        {/* Canvas Workspace */}
        <div className="flex-1 bg-black flex items-center justify-center p-2 overflow-auto select-none">
          {imageObjRef.current && (
            <canvas
              ref={canvasRef}
              width={imageObjRef.current.naturalWidth || 800}
              height={imageObjRef.current.naturalHeight || 600}
              onMouseDown={handlePointerDown}
              onMouseMove={handlePointerMove}
              onMouseUp={handlePointerUp}
              onTouchStart={handlePointerDown}
              onTouchMove={handlePointerMove}
              onTouchEnd={handlePointerUp}
              className="max-h-[60vh] max-w-full object-contain cursor-crosshair border border-slate-800 rounded shadow-lg touch-none"
            />
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-4 py-3 border-t border-slate-800 bg-slate-950">
          <div className="text-[11px] text-slate-400">
            {activeTool === 'ARROW'
              ? 'Kéo chuột/chạm để kẻ mũi tên chỉ mục tiêu'
              : activeTool === 'PEN'
              ? 'Vẽ tự do khoanh vùng hoặc đánh dấu'
              : activeTool === 'TEXT'
              ? 'Chạm vị trí bất kỳ trên ảnh để dán chữ'
              : 'Kéo chuột để vẽ hình'}
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors"
            >
              Hủy bỏ
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="px-4 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white flex items-center gap-1.5 shadow-sm transition-all"
            >
              <Check className="w-4 h-4" />
              <span>Lưu & Áp dụng ảnh</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
