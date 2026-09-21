import React, { useRef } from 'react';
import { Camera, Trash2, MapPin } from 'lucide-react';

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
}) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

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
  };

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
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        {label && (
          <label style={{ fontSize: '0.8rem', fontWeight: 700, color: '#1e293b' }}>
            {label} {required && <span style={{ color: '#ef4444' }}>*</span>}
          </label>
        )}

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
              <span>Chụp / Đổi ảnh</span>
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
            gap: '0.65rem',
            padding: '1rem',
          }}
        >
          <div style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600, textAlign: 'center' }}>
            {label ? `Chụp hoặc tải ảnh cho ${label}` : 'Chưa có ảnh'}
          </div>

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
    </div>
  );
};
