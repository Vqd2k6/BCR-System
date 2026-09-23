import React, { useRef, useState, useEffect } from 'react';
import { Camera, Trash2, MapPin, Edit3, AlertTriangle, Compass } from 'lucide-react';
import { ImageAnnotationModal } from './ImageAnnotationModal';

interface Props {
  value: string; // Base64 or image URL
  onChange: (photoUrl: string) => void;
  label?: string;
  watermarkText?: string;
  allowNotApplicable?: boolean;
  isNotApplicable?: boolean;
  onToggleNotApplicable?: (na: boolean) => void;
  naReason?: string;
  onNaReasonChange?: (reason: string) => void;
  required?: boolean;
  height?: number | string;
  recommendedOrientation?: 'landscape' | 'portrait' | 'square';
  orientationHint?: string;
  allowAnnotation?: boolean;
  annotationTitle?: string;
  initialAnnotationTool?: 'ARROW' | 'PEN' | 'CIRCLE' | 'RECT' | 'TEXT';
}

export const PhotoCaptureInput: React.FC<Props> = ({
  value,
  onChange,
  label,
  watermarkText,
  allowNotApplicable = false,
  isNotApplicable = false,
  onToggleNotApplicable,
  naReason = '',
  onNaReasonChange,
  required = false,
  height = '180px',
  recommendedOrientation,
  orientationHint,
  allowAnnotation = true,
  annotationTitle,
  initialAnnotationTool,
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isAnnotating, setIsAnnotating] = useState(false);
  const [detectedAspectRatio, setDetectedAspectRatio] = useState<'landscape' | 'portrait' | 'square' | null>(null);

  // Detect image aspect ratio when value changes
  useEffect(() => {
    if (!value) {
      setDetectedAspectRatio(null);
      return;
    }
    const img = new Image();
    img.onload = () => {
      if (img.naturalWidth > img.naturalHeight * 1.08) {
        setDetectedAspectRatio('landscape');
      } else if (img.naturalHeight > img.naturalWidth * 1.08) {
        setDetectedAspectRatio('portrait');
      } else {
        setDetectedAspectRatio('square');
      }
    };
    img.src = value;
  }, [value]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const base64 = event.target?.result as string;
      if (base64) {
        onChange(base64);
        if (isNotApplicable && onToggleNotApplicable) {
          onToggleNotApplicable(false);
        }
      }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleClear = () => {
    onChange('');
    setDetectedAspectRatio(null);
  };

  const isOrientationMismatch =
    value &&
    recommendedOrientation &&
    detectedAspectRatio &&
    detectedAspectRatio !== 'square' &&
    detectedAspectRatio !== recommendedOrientation;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', width: '100%' }}>
      {/* Hidden native file input (Triggers OS Camera / Gallery sheet on Mobile) */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        style={{ display: 'none' }}
        onChange={handleFileChange}
      />

      {/* Label & N/A checkbox row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.35rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', flexWrap: 'wrap' }}>
          {label && (
            <label style={{ fontSize: '0.8rem', fontWeight: 700, color: '#1e293b' }}>
              {label} {required && <span style={{ color: '#ef4444' }}>*</span>}
            </label>
          )}

          {/* Orientation Recommendation Badge */}
          {recommendedOrientation === 'landscape' && (
            <span
              style={{
                fontSize: '0.675rem',
                fontWeight: 700,
                padding: '0.15rem 0.5rem',
                borderRadius: '9999px',
                backgroundColor: '#f0f9ff',
                color: '#0369a1',
                border: '1px solid #bae6fd',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.25rem',
              }}
              title="Khuyến nghị xoay ngang điện thoại để trang in báo cáo không bị méo"
            >
              📐 Khuyến nghị: Ảnh NGANG (16:9 / 4:3)
            </span>
          )}

          {recommendedOrientation === 'portrait' && (
            <span
              style={{
                fontSize: '0.675rem',
                fontWeight: 700,
                padding: '0.15rem 0.5rem',
                borderRadius: '9999px',
                backgroundColor: '#faf5ff',
                color: '#7e22ce',
                border: '1px solid #e9d5ff',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.25rem',
              }}
              title="Khuyến nghị cầm dọc điện thoại để chụp trọn vẹn tầng cao"
            >
              📐 Khuyến nghị: Ảnh DỌC (3:4 / 9:16)
            </span>
          )}
        </div>

        {allowNotApplicable && onToggleNotApplicable && (
          <label
            style={{
              fontSize: '0.75rem',
              color: '#64748b',
              display: 'flex',
              alignItems: 'center',
              gap: '0.35rem',
              cursor: 'pointer',
            }}
          >
            <input
              type="checkbox"
              checked={isNotApplicable}
              onChange={(e) => {
                onToggleNotApplicable(e.target.checked);
                if (e.target.checked) onChange('');
              }}
              style={{ accentColor: '#0284c7' }}
            />
            <span>Không tồn tại / N/A</span>
          </label>
        )}
      </div>

      {/* Orientation mismatch gentle warning banner */}
      {isOrientationMismatch && (
        <div
          style={{
            fontSize: '0.72rem',
            padding: '0.35rem 0.65rem',
            backgroundColor: '#fffbeb',
            border: '1px solid #fde68a',
            color: '#b45309',
            borderRadius: '0.5rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.35rem',
          }}
        >
          <AlertTriangle size={13} style={{ flexShrink: 0 }} />
          <span>
            {recommendedOrientation === 'landscape'
              ? 'Ảnh đang là ảnh dọc. Báo cáo khuyến nghị dùng ảnh ngang để tránh méo layout.'
              : 'Ảnh đang là ảnh ngang. Báo cáo khuyến nghị dùng ảnh dọc để vừa khung mẫu.'}
          </span>
        </div>
      )}

      {/* N/A Reason box if N/A is checked */}
      {isNotApplicable ? (
        <div
          style={{
            padding: '0.75rem',
            backgroundColor: '#f8fafc',
            border: '1px dashed #cbd5e1',
            borderRadius: '0.65rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.35rem',
          }}
        >
          <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>
            Lý do không có ảnh / N/A:
          </span>
          <input
            type="text"
            className="form-control"
            placeholder="Ví dụ: Nhà không gắn biển số / Bị nhà đối diện che khuất hoàn toàn..."
            value={naReason}
            onChange={(e) => onNaReasonChange && onNaReasonChange(e.target.value)}
            style={{ fontSize: '0.775rem' }}
          />
        </div>
      ) : value ? (
        /* Image Preview Box */
        <div
          style={{
            position: 'relative',
            width: '100%',
            height,
            borderRadius: '0.65rem',
            overflow: 'hidden',
            border: '1px solid #cbd5e1',
            backgroundColor: '#0f172a',
          }}
        >
          <img
            src={value}
            alt={label || 'Photo preview'}
            style={{ width: '100%', height: '100%', objectFit: 'contain' }}
          />

          {/* Watermark Tag */}
          {watermarkText && (
            <div
              style={{
                position: 'absolute',
                bottom: '6px',
                left: '6px',
                backgroundColor: 'rgba(0, 0, 0, 0.75)',
                color: '#38bdf8',
                fontSize: '0.65rem',
                padding: '0.2rem 0.45rem',
                borderRadius: '0.35rem',
                fontFamily: 'monospace',
                backdropFilter: 'blur(2px)',
                maxWidth: '90%',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              <MapPin size={11} style={{ display: 'inline', marginRight: '4px', verticalAlign: 'middle' }} />
              {watermarkText}
            </div>
          )}

          {/* Action floating buttons */}
          <div style={{ position: 'absolute', top: '6px', right: '6px', display: 'flex', gap: '0.35rem' }}>
            {allowAnnotation && (
              <button
                type="button"
                onClick={() => setIsAnnotating(true)}
                title="Vẽ, đánh dấu mũi tên hoặc ghi chú lên ảnh"
                style={{
                  backgroundColor: 'rgba(16, 185, 129, 0.9)',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '0.4rem',
                  padding: '0.35rem 0.55rem',
                  fontSize: '0.7rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.25rem',
                  cursor: 'pointer',
                  backdropFilter: 'blur(2px)',
                  fontWeight: 600,
                  boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
                }}
              >
                <Edit3 size={13} />
                <span>Vẽ / Chú thích</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              title="Chụp hoặc đổi ảnh khác"
              style={{
                backgroundColor: 'rgba(15, 23, 42, 0.85)',
                color: '#ffffff',
                border: 'none',
                borderRadius: '0.4rem',
                padding: '0.35rem 0.55rem',
                fontSize: '0.7rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.25rem',
                cursor: 'pointer',
                backdropFilter: 'blur(2px)',
                fontWeight: 600,
              }}
            >
              <Camera size={13} />
              <span>Chụp / Đổi</span>
            </button>

            <button
              type="button"
              onClick={handleClear}
              title="Xóa ảnh"
              style={{
                backgroundColor: 'rgba(239, 68, 68, 0.9)',
                color: '#ffffff',
                border: 'none',
                borderRadius: '0.4rem',
                padding: '0.35rem 0.5rem',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
              }}
            >
              <Trash2 size={13} />
            </button>
          </div>
        </div>
      ) : (
        /* Empty State with single robust native photo button */
        <div
          style={{
            width: '100%',
            height,
            border: '2px dashed #cbd5e1',
            borderRadius: '0.65rem',
            backgroundColor: '#f8fafc',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.5rem',
            padding: '1rem',
          }}
        >
          <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600, textAlign: 'center' }}>
            {label ? `Chụp hoặc tải ảnh cho ${label}` : 'Chưa có ảnh'}
          </div>

          {orientationHint && (
            <div style={{ fontSize: '0.7rem', color: '#0369a1', fontStyle: 'italic', textAlign: 'center' }}>
              {orientationHint}
            </div>
          )}

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="btn btn-primary btn-sm"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.4rem',
              padding: '0.5rem 1rem',
              fontWeight: 700,
              backgroundColor: '#059669',
              borderColor: '#059669',
              color: '#ffffff',
              borderRadius: '0.5rem',
              cursor: 'pointer',
            }}
          >
            <Camera size={16} />
            <span>Chụp / Tải ảnh lên</span>
          </button>
        </div>
      )}

      {/* Modal for image annotations */}
      {isAnnotating && value && (
        <ImageAnnotationModal
          isOpen={isAnnotating}
          imageUrl={value}
          title={annotationTitle || `Ghi chú & Vẽ trên ${label || 'ảnh'}`}
          initialTool={initialAnnotationTool || (label?.includes('P-04') ? 'ARROW' : 'PEN')}
          onSave={(annotated) => {
            onChange(annotated);
            setIsAnnotating(false);
          }}
          onClose={() => setIsAnnotating(false)}
        />
      )}
    </div>
  );
};
