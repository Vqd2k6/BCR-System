import React, { useRef, useState, useEffect } from 'react';
import { Eraser, Check, RotateCcw, PenTool } from 'lucide-react';

interface Props {
  label: string;
  signerName: string;
  role: string;
  initialSignatureUrl?: string;
  onSave: (signatureDataUrl: string) => void;
  readOnly?: boolean;
}

export const SignaturePad: React.FC<Props> = ({
  label,
  signerName,
  role,
  initialSignatureUrl,
  onSave,
  readOnly = false,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState<boolean>(false);
  const [hasDrawn, setHasDrawn] = useState<boolean>(!!initialSignatureUrl);
  const [signatureUrl, setSignatureUrl] = useState<string | undefined>(initialSignatureUrl);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Set canvas dimensions based on CSS display size for sharp rendering
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * window.devicePixelRatio || 400;
    canvas.height = rect.height * window.devicePixelRatio || 180;
    ctx.scale(window.devicePixelRatio || 1, window.devicePixelRatio || 1);

    ctx.strokeStyle = '#38bdf8';
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    if (initialSignatureUrl) {
      const img = new Image();
      img.onload = () => {
        ctx.drawImage(img, 0, 0, rect.width, rect.height);
      };
      img.src = initialSignatureUrl;
    }
  }, [initialSignatureUrl]);

  const getPos = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    if ('touches' in e) {
      const touch = e.touches[0];
      return {
        x: touch.clientX - rect.left,
        y: touch.clientY - rect.top,
      };
    }
    return {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    };
  };

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (readOnly) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    setIsDrawing(true);
    setHasDrawn(true);
    const { x, y } = getPos(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing || readOnly) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const { x, y } = getPos(e);
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const stopDrawing = () => {
    if (!isDrawing) return;
    setIsDrawing(false);
    const canvas = canvasRef.current;
    if (!canvas) return;
    const dataUrl = canvas.toDataURL('image/png');
    setSignatureUrl(dataUrl);
    onSave(dataUrl);
  };

  const clearCanvas = () => {
    if (readOnly) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasDrawn(false);
    setSignatureUrl(undefined);
    onSave('');
  };

  return (
    <div
      className="card"
      style={{
        background: 'rgba(15, 23, 42, 0.75)',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        borderRadius: '0.75rem',
        padding: '1rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.5rem',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <span style={{ fontWeight: 600, color: '#f8fafc', fontSize: '0.9rem' }}>{label}</span>
          <div style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
            Họ và tên: <strong style={{ color: '#e2e8f0' }}>{signerName || 'Chưa nhập'}</strong> ({role})
          </div>
        </div>

        {!readOnly && (
          <button
            type="button"
            onClick={clearCanvas}
            className="btn btn-sm"
            style={{
              background: 'rgba(239, 68, 68, 0.15)',
              color: '#f87171',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              display: 'flex',
              alignItems: 'center',
              gap: '0.25rem',
              fontSize: '0.75rem',
              padding: '0.25rem 0.5rem',
            }}
          >
            <Eraser size={12} />
            Ký lại
          </button>
        )}
      </div>

      <div
        style={{
          position: 'relative',
          width: '100%',
          height: '140px',
          backgroundColor: '#090d16',
          borderRadius: '0.5rem',
          border: '1px dashed rgba(56, 189, 248, 0.4)',
          overflow: 'hidden',
          touchAction: 'none',
        }}
      >
        <canvas
          ref={canvasRef}
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseLeave={stopDrawing}
          onTouchStart={startDrawing}
          onTouchMove={draw}
          onTouchEnd={stopDrawing}
          style={{
            width: '100%',
            height: '100%',
            cursor: readOnly ? 'default' : 'crosshair',
          }}
        />

        {!hasDrawn && (
          <div
            style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              transform: 'translate(-50%, -50%)',
              pointerEvents: 'none',
              color: 'rgba(148, 163, 184, 0.4)',
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
              fontSize: '0.85rem',
            }}
          >
            <PenTool size={16} />
            <span>Ký tên trực tiếp tại đây</span>
          </div>
        )}
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.75rem', color: '#64748b' }}>
        <span>Cam kết nội dung phản ánh trung thực hiện trạng công trình</span>
        {hasDrawn && <span style={{ color: '#10b981', fontWeight: 600 }}>✓ Đã có chữ ký</span>}
      </div>
    </div>
  );
};
