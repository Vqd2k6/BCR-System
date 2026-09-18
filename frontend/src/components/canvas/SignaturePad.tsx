import React, { useRef, useState, useEffect } from 'react';
import { Eraser, PenTool, Camera, Upload, CheckCircle2 } from 'lucide-react';
import { PhotoCaptureInput } from '../common/PhotoCaptureInput';

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
  const [mode, setMode] = useState<'DRAW' | 'PHOTO'>('DRAW');
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState<boolean>(false);
  const [hasDrawn, setHasDrawn] = useState<boolean>(!!initialSignatureUrl);
  const [signatureUrl, setSignatureUrl] = useState<string | undefined>(initialSignatureUrl);

  useEffect(() => {
    if (mode !== 'DRAW') return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * window.devicePixelRatio || 400;
    canvas.height = rect.height * window.devicePixelRatio || 180;
    ctx.scale(window.devicePixelRatio || 1, window.devicePixelRatio || 1);

    ctx.strokeStyle = '#0284c7';
    ctx.lineWidth = 2.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    if (initialSignatureUrl && initialSignatureUrl.startsWith('data:image')) {
      const img = new Image();
      img.onload = () => {
        ctx.drawImage(img, 0, 0, rect.width, rect.height);
      };
      img.src = initialSignatureUrl;
    }
  }, [initialSignatureUrl, mode]);

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
    if (canvas) {
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
    }
    setHasDrawn(false);
    setSignatureUrl(undefined);
    onSave('');
  };

  return (
    <div
      className="card"
      style={{
        backgroundColor: '#ffffff',
        border: '1px solid #e2e8f0',
        padding: '1rem',
        display: 'flex',
        flexDirection: 'column',
        gap: '0.65rem',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.4rem' }}>
        <div>
          <span style={{ fontWeight: 700, color: '#0f172a', fontSize: '0.9rem' }}>{label}</span>
          <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
            Họ tên: <strong style={{ color: '#0f172a' }}>{signerName || 'Chưa nhập'}</strong> ({role})
          </div>
        </div>

        {!readOnly && (
          <div style={{ display: 'flex', gap: '0.35rem', alignItems: 'center' }}>
            {/* Mode switch */}
            <div style={{ display: 'flex', backgroundColor: '#f1f5f9', borderRadius: '0.4rem', padding: '2px' }}>
              <button
                type="button"
                onClick={() => setMode('DRAW')}
                style={{
                  border: 'none',
                  backgroundColor: mode === 'DRAW' ? '#ffffff' : 'transparent',
                  color: mode === 'DRAW' ? '#0284c7' : '#64748b',
                  fontSize: '0.725rem',
                  fontWeight: mode === 'DRAW' ? 700 : 500,
                  padding: '0.25rem 0.5rem',
                  borderRadius: '0.35rem',
                  cursor: 'pointer',
                  boxShadow: mode === 'DRAW' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                }}
              >
                ✍️ Ký tay
              </button>
              <button
                type="button"
                onClick={() => setMode('PHOTO')}
                style={{
                  border: 'none',
                  backgroundColor: mode === 'PHOTO' ? '#ffffff' : 'transparent',
                  color: mode === 'PHOTO' ? '#0284c7' : '#64748b',
                  fontSize: '0.725rem',
                  fontWeight: mode === 'PHOTO' ? 700 : 500,
                  padding: '0.25rem 0.5rem',
                  borderRadius: '0.35rem',
                  cursor: 'pointer',
                  boxShadow: mode === 'PHOTO' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                }}
              >
                📷 Chụp ảnh
              </button>
            </div>

            {mode === 'DRAW' && (
              <button
                type="button"
                onClick={clearCanvas}
                className="btn btn-sm btn-secondary"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.25rem',
                  fontSize: '0.725rem',
                  padding: '0.25rem 0.5rem',
                }}
              >
                <Eraser size={12} />
                <span>Ký lại</span>
              </button>
            )}
          </div>
        )}
      </div>

      {mode === 'DRAW' ? (
        <div
          style={{
            position: 'relative',
            width: '100%',
            height: '140px',
            backgroundColor: '#f8fafc',
            borderRadius: '0.5rem',
            border: '1px dashed #cbd5e1',
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
                color: '#94a3b8',
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
                fontSize: '0.825rem',
              }}
            >
              <PenTool size={16} />
              <span>Ký tên trực tiếp tại đây</span>
            </div>
          )}
        </div>
      ) : (
        <PhotoCaptureInput
          value={signatureUrl || ''}
          onChange={(url) => {
            setSignatureUrl(url);
            setHasDrawn(!!url);
            onSave(url);
          }}
          height="140px"
          watermarkText={`KÝ XÁC NHẬN: ${signerName || role}`}
        />
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.75rem', color: '#64748b' }}>
        <span>Cam kết nội dung phản ánh trung thực hiện trạng công trình</span>
        {hasDrawn && (
          <span style={{ color: '#15803d', fontWeight: 700, display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
            <CheckCircle2 size={13} />
            Đã có chữ ký
          </span>
        )}
      </div>
    </div>
  );
};
