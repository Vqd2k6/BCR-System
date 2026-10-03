import React from 'react';
import { Camera, Image as ImageIcon } from 'lucide-react';

interface PhotoEmptyStateProps {
  height: number | string;
  label?: string;
  orientationHint?: string;
  cameraInputId: string;
  galleryInputId: string;
  onTriggerCapture: () => void;
}

export const PhotoEmptyState: React.FC<PhotoEmptyStateProps> = ({
  height,
  label,
  orientationHint,
  cameraInputId,
  galleryInputId,
  onTriggerCapture,
}) => {
  const isCompact = typeof height === 'number' ? height <= 125 : parseInt(String(height), 10) <= 125;

  return (
    <div
      style={{
        width: '100%',
        minHeight: height,
        height: 'auto',
        border: '1.5px dashed #cbd5e1',
        borderRadius: '0.65rem',
        backgroundColor: '#f8fafc',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: isCompact ? '0.35rem' : '0.65rem',
        padding: isCompact ? '0.45rem' : '0.85rem 1rem',
        boxSizing: 'border-box',
        overflow: 'hidden',
      }}
    >
      {label && (
        <div
          style={{
            fontSize: isCompact ? '0.7rem' : '0.75rem',
            color: '#64748b',
            fontWeight: 600,
            textAlign: 'center',
            lineHeight: 1.2,
          }}
        >
          {label}
        </div>
      )}

      {orientationHint && !isCompact && (
        <div style={{ fontSize: '0.7rem', color: '#0369a1', fontStyle: 'italic', textAlign: 'center' }}>
          {orientationHint}
        </div>
      )}

      <div style={{ display: 'flex', gap: isCompact ? '0.35rem' : '0.6rem', flexWrap: 'wrap', justifyContent: 'center' }}>
        {/* 1. NÚT CHÍNH: Chụp ảnh */}
        <button
          type="button"
          onClick={onTriggerCapture}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: isCompact ? '0.25rem' : '0.45rem',
            padding: isCompact ? '0.4rem 0.65rem' : '0.5rem 0.95rem',
            fontWeight: 700,
            backgroundColor: '#059669',
            color: '#ffffff',
            border: 'none',
            borderRadius: '0.5rem',
            cursor: 'pointer',
            fontSize: isCompact ? '0.72rem' : '0.8rem',
            boxShadow: '0 2px 4px rgba(5, 150, 105, 0.25)',
            userSelect: 'none',
            whiteSpace: 'nowrap',
            transition: 'all 0.15s ease',
          }}
          title="Mở máy ảnh chụp trực tiếp (có khung ngắm chuẩn & zoom 2 ngón tay)"
        >
          <Camera size={isCompact ? 13 : 15} />
          <span>{isCompact ? 'Chụp ảnh' : 'Chụp ảnh'}</span>
        </button>

        {/* 2. NÚT PHỤ: Chọn từ máy */}
        <label
          htmlFor={galleryInputId}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: isCompact ? '0.25rem' : '0.45rem',
            padding: isCompact ? '0.4rem 0.65rem' : '0.5rem 0.85rem',
            fontWeight: 600,
            backgroundColor: '#ffffff',
            color: '#334155',
            border: '1px solid #cbd5e1',
            borderRadius: '0.5rem',
            cursor: 'pointer',
            fontSize: isCompact ? '0.72rem' : '0.775rem',
            boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
            userSelect: 'none',
            whiteSpace: 'nowrap',
            transition: 'all 0.15s ease',
          }}
          title="Chọn ảnh đã chụp sẵn từ thư viện thiết bị"
        >
          <ImageIcon size={isCompact ? 13 : 14} color="#64748b" />
          <span>{isCompact ? 'Chọn ảnh' : 'Chọn từ máy'}</span>
        </label>
      </div>
    </div>
  );
};
