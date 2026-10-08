import React from 'react';
import { Camera, Image as ImageIcon } from 'lucide-react';

interface PhotoEmptyStateProps {
  height: number | string;
  label?: string;
  orientationHint?: string;
  cameraInputId: string;
  galleryInputId: string;
  onTriggerCapture: () => void;
  readOnly?: boolean;
  allowPdf?: boolean;
}

export const PhotoEmptyState: React.FC<PhotoEmptyStateProps> = ({
  height,
  label,
  orientationHint,
  cameraInputId,
  galleryInputId,
  onTriggerCapture,
  readOnly = false,
  allowPdf = false,
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

      {readOnly ? (
        <div style={{ fontSize: '0.75rem', color: '#94a3b8', fontStyle: 'italic', padding: '0.5rem' }}>
          (Chưa có ảnh khảo sát)
        </div>
      ) : (
      <div style={{ display: 'flex', gap: isCompact ? '0.35rem' : '0.6rem', flexWrap: 'wrap', justifyContent: 'center' }}>
        {/* 1. NÚT CHÍNH: Chụp Live trực tiếp */}
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
          title="Mở máy ảnh trực tiếp trên web (khung ngắm 0.5x, zoom 2 ngón tay)"
        >
          <Camera size={isCompact ? 13 : 15} />
          <span>{isCompact ? 'Chụp Live' : 'Chụp Live'}</span>
        </button>

        {/* 2. NÚT CAMERA GỐC: Mát máy & tận dụng 100% cảm biến phần cứng */}
        <label
          htmlFor={cameraInputId}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: isCompact ? '0.25rem' : '0.4rem',
            padding: isCompact ? '0.4rem 0.65rem' : '0.5rem 0.85rem',
            fontWeight: 600,
            backgroundColor: '#f0fdf4',
            color: '#166534',
            border: '1px solid #bbf7d0',
            borderRadius: '0.5rem',
            cursor: 'pointer',
            fontSize: isCompact ? '0.72rem' : '0.775rem',
            boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
            userSelect: 'none',
            whiteSpace: 'nowrap',
            transition: 'all 0.15s ease',
          }}
          title="Mở máy ảnh gốc hệ điều hành (mát máy ngoài trời, tận dụng Flash phần cứng & AI của hãng)"
        >
          <Camera size={isCompact ? 12 : 14} color="#166534" />
          <span>{isCompact ? 'Cam gốc' : 'Máy ảnh gốc'}</span>
        </label>

        {/* 3. NÚT PHỤ: Chọn từ thư viện thiết bị / PDF */}
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
          title={allowPdf ? 'Chọn ảnh sơ đồ hoặc file PDF bản vẽ thiết kế/hoàn công' : 'Chọn ảnh đã chụp sẵn từ thư viện thiết bị'}
        >
          <ImageIcon size={isCompact ? 13 : 14} color="#64748b" />
          <span>{allowPdf ? (isCompact ? 'Ảnh / PDF' : 'Tải ảnh / PDF') : isCompact ? 'Thư viện' : 'Chọn từ máy'}</span>
        </label>
      </div>
      )}
    </div>
  );
};
