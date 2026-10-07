import React, { useRef, useState, useEffect } from 'react';
import {
  Camera,
  Trash2,
  MapPin,
  Edit3,
  Image as ImageIcon,
  RefreshCw,
  RotateCw,
  MoreVertical,
  ZoomIn,
} from 'lucide-react';
import { UploadStatus } from '../types';
import { PhotoWatermarkOverlay } from './PhotoWatermarkOverlay';
import { getSafeDisplayUrl } from '../../../../core/storage/offlinePhotoStorage';
import { useStorageInfo } from '../../../../core/services/storageInfoService';

interface PhotoPreviewCardProps {
  value: string;
  localPreview: string | null;
  hasLoadError: boolean;
  onSetHasLoadError: (err: boolean) => void;
  height: number | string;
  photoCode?: string;
  displayPhotoCode: string;
  label?: string;
  uploadStatus: UploadStatus;
  allowAnnotation?: boolean;
  readOnly?: boolean;
  cameraInputId: string;
  galleryInputId: string;
  onOpenLightbox: () => void;
  onTriggerCapture: () => void;
  onRotate90: () => void;
  onStartAnnotating: () => void;
  onClear: () => void;
  onRetryUpload?: () => void;
}

export const PhotoPreviewCard: React.FC<PhotoPreviewCardProps> = ({
  value,
  localPreview,
  hasLoadError,
  onSetHasLoadError,
  height,
  photoCode,
  displayPhotoCode,
  label,
  uploadStatus,
  allowAnnotation = true,
  readOnly = false,
  cameraInputId,
  galleryInputId,
  onOpenLightbox,
  onTriggerCapture,
  onRotate90,
  onStartAnnotating,
  onClear,
  onRetryUpload,
}) => {
  const storageInfo = useStorageInfo();
  const [isMoreMenuOpen, setIsMoreMenuOpen] = useState(false);
  const moreMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isMoreMenuOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (moreMenuRef.current && !moreMenuRef.current.contains(e.target as Node)) {
        setIsMoreMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isMoreMenuOpen]);

  const safeSrc = localPreview || getSafeDisplayUrl(value);

  return (
    <div
      onClick={onOpenLightbox}
      style={{
        position: 'relative',
        width: '100%',
        height,
        borderRadius: '0.65rem',
        border: '1px solid #cbd5e1',
        backgroundColor: '#0f172a',
        cursor: 'pointer',
        userSelect: 'none',
      }}
      title="Nhấn vào để phóng to soi vạch thước đo nứt"
    >
      {/* Khung nội dung ảnh và Watermark overlay được bo góc & clip riêng biệt */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          borderRadius: '0.65rem',
          overflow: 'hidden',
          pointerEvents: 'none',
        }}
      >
        {safeSrc ? (
          <img
            id={photoCode || displayPhotoCode || undefined}
            data-photo-code={photoCode || displayPhotoCode || undefined}
            src={safeSrc}
            alt={displayPhotoCode || label || 'Photo preview'}
            onError={() => {
              if (safeSrc && !hasLoadError) {
                onSetHasLoadError(true);
              }
            }}
            style={{ width: '100%', height: '100%', objectFit: 'contain' }}
          />
        ) : (
          <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', fontSize: '0.75rem', gap: '0.25rem', padding: '0.5rem', textAlign: 'center' }}>
            <span>{uploadStatus === 'UPLOADING' ? 'Đang nạp ảnh từ bộ nhớ thiết bị...' : 'Ảnh chưa được đồng bộ từ thiết bị KSV'}</span>
            <span style={{ fontSize: '0.65rem', color: '#64748b' }}>(Cần mở trên điện thoại KSV đã chụp để đẩy lên Cloud)</span>
          </div>
        )}

        {/* Lớp phủ Watermark động bằng CSS thuần không tốn RAM Canvas */}
        <PhotoWatermarkOverlay
          photoCode={photoCode || displayPhotoCode}
          variant="compact"
        />
      </div>

      {/* Top-Left: Photo ID chip + Cloudflare R2 Status & Nút thử lại */}
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          position: 'absolute',
          top: '6px',
          left: '6px',
          display: 'flex',
          alignItems: 'center',
          gap: '0.3rem',
          maxWidth: '60%',
          zIndex: 20,
        }}
      >
        {displayPhotoCode && (
          <div
            style={{
              backgroundColor: 'rgba(15, 23, 42, 0.88)',
              color: '#34d399',
              fontSize: '0.65rem',
              fontWeight: 700,
              padding: '0.2rem 0.5rem',
              borderRadius: '9999px',
              fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
              backdropFilter: 'blur(4px)',
              border: '1px solid rgba(52, 211, 153, 0.35)',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              boxShadow: '0 2px 5px rgba(0, 0, 0, 0.35)',
              display: 'flex',
              alignItems: 'center',
              gap: '0.25rem',
            }}
            title={`Photo ID: ${displayPhotoCode}`}
          >
            <MapPin size={10} style={{ color: '#10b981', flexShrink: 0 }} />
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{displayPhotoCode}</span>
          </div>
        )}

        {/* Storage Status Badge (Dynamic Local vs R2) */}
        {uploadStatus === 'UPLOADING' && (
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.25rem',
              backgroundColor: 'rgba(217, 119, 6, 0.9)',
              color: '#ffffff',
              fontSize: '0.625rem',
              fontWeight: 700,
              padding: '0.18rem 0.45rem',
              borderRadius: '9999px',
              backdropFilter: 'blur(4px)',
              boxShadow: '0 2px 5px rgba(0, 0, 0, 0.35)',
              whiteSpace: 'nowrap',
            }}
            title={storageInfo.syncingText}
          >
            <RefreshCw size={9} className="animate-spin shrink-0" />
            <span>{storageInfo.shortUploadingBadge}</span>
          </span>
        )}

        {(uploadStatus === 'SUCCESS' || (value && (value.startsWith('http') || value.startsWith('/uploads')))) && uploadStatus !== 'UPLOADING' && (
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.2rem',
              backgroundColor: storageInfo.isLocal ? 'rgba(30, 41, 59, 0.9)' : 'rgba(6, 78, 59, 0.9)',
              border: storageInfo.isLocal ? '1px solid rgba(129, 140, 248, 0.5)' : '1px solid rgba(52, 211, 153, 0.5)',
              color: storageInfo.isLocal ? '#a5b4fc' : '#34d399',
              fontSize: '0.625rem',
              fontWeight: 700,
              padding: '0.18rem 0.45rem',
              borderRadius: '9999px',
              backdropFilter: 'blur(4px)',
              boxShadow: '0 2px 5px rgba(0, 0, 0, 0.35)',
              whiteSpace: 'nowrap',
            }}
            title={storageInfo.syncedText}
          >
            <span
              style={{
                width: '5px',
                height: '5px',
                borderRadius: '50%',
                backgroundColor: storageInfo.isLocal ? '#818cf8' : '#34d399',
                flexShrink: 0,
              }}
            />
            <span>{storageInfo.shortBadge}</span>
          </span>
        )}

        {value && !(uploadStatus === 'SUCCESS' || (value && (value.startsWith('http') || value.startsWith('/uploads')))) && uploadStatus !== 'UPLOADING' && uploadStatus !== 'ERROR' && (
          <span
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.2rem',
              backgroundColor: 'rgba(120, 53, 15, 0.9)',
              border: '1px solid rgba(251, 191, 36, 0.5)',
              color: '#fde68a',
              fontSize: '0.625rem',
              fontWeight: 700,
              padding: '0.18rem 0.45rem',
              borderRadius: '9999px',
              backdropFilter: 'blur(4px)',
              boxShadow: '0 2px 5px rgba(0, 0, 0, 0.35)',
              whiteSpace: 'nowrap',
            }}
            title={`Chưa lưu vào ${storageInfo.providerLabel} (Lưu tạm trên thiết bị)`}
          >
            <span
              style={{
                width: '5px',
                height: '5px',
                borderRadius: '50%',
                backgroundColor: '#fbbf24',
                flexShrink: 0,
              }}
            />
            <span>{storageInfo.unsyncedText}</span>
          </span>
        )}

        {uploadStatus === 'ERROR' && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              if (onRetryUpload) onRetryUpload();
            }}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.25rem',
              backgroundColor: '#dc2626',
              border: '1px solid rgba(254, 202, 202, 0.5)',
              color: '#ffffff',
              fontSize: '0.625rem',
              fontWeight: 700,
              padding: '0.2rem 0.5rem',
              borderRadius: '9999px',
              cursor: 'pointer',
              boxShadow: '0 2px 6px rgba(220, 38, 38, 0.4)',
              whiteSpace: 'nowrap',
            }}
            title="Lỗi đồng bộ R2. Nhấn vào đây để thử lại ngay!"
          >
            <RefreshCw size={9} />
            <span>Thử lại R2</span>
          </button>
        )}
      </div>

      {/* Top-Right: Minimalist Action Cluster (Chụp Lại + Menu ⋯) */}
      {!readOnly && (
        <div
          ref={moreMenuRef}
          style={{
            position: 'absolute',
            top: '6px',
            right: '6px',
            display: 'flex',
            alignItems: 'center',
            gap: '0.35rem',
            zIndex: 20,
          }}
        >
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onTriggerCapture();
          }}
          title="Mở camera chụp lại ảnh này (có zoom 2 ngón tay)"
          style={{
            backgroundColor: 'rgba(5, 150, 105, 0.92)',
            color: '#ffffff',
            border: '1px solid rgba(255, 255, 255, 0.25)',
            borderRadius: '9999px',
            padding: '0.25rem 0.65rem',
            fontSize: '0.72rem',
            fontWeight: 700,
            display: 'flex',
            alignItems: 'center',
            gap: '0.25rem',
            cursor: 'pointer',
            backdropFilter: 'blur(4px)',
            boxShadow: '0 2px 6px rgba(0, 0, 0, 0.3)',
            userSelect: 'none',
          }}
        >
          <Camera size={12} />
          <span>Chụp lại</span>
        </button>

        <div style={{ position: 'relative' }} onClick={(e) => e.stopPropagation()}>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setIsMoreMenuOpen(!isMoreMenuOpen);
            }}
            title="Tùy chọn thao tác khác (Soi, Xoay, Vẽ, Đổi ảnh, Xóa)"
            style={{
              backgroundColor: 'rgba(15, 23, 42, 0.85)',
              color: '#ffffff',
              border: '1px solid rgba(255, 255, 255, 0.2)',
              borderRadius: '50%',
              width: '28px',
              height: '28px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              backdropFilter: 'blur(4px)',
              boxShadow: '0 2px 6px rgba(0, 0, 0, 0.3)',
            }}
          >
            <MoreVertical size={14} />
          </button>

          {isMoreMenuOpen && (
            <div
              style={{
                position: 'absolute',
                top: '32px',
                right: 0,
                backgroundColor: 'rgba(15, 23, 42, 0.96)',
                color: '#f8fafc',
                borderRadius: '0.65rem',
                padding: '0.35rem',
                boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.5), 0 8px 10px -6px rgba(0, 0, 0, 0.5)',
                border: '1px solid rgba(51, 65, 85, 0.8)',
                minWidth: '180px',
                maxHeight: '220px',
                overflowY: 'auto',
                overscrollBehavior: 'contain',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.2rem',
                fontSize: '0.75rem',
                backdropFilter: 'blur(8px)',
                zIndex: 60,
              }}
            >
              {/* Thử lại R2 trong menu */}
              {uploadStatus !== 'SUCCESS' && onRetryUpload && (
                <button
                  type="button"
                  onClick={() => {
                    setIsMoreMenuOpen(false);
                    onRetryUpload();
                  }}
                  style={{
                    width: '100%',
                    padding: '0.4rem 0.6rem',
                    borderRadius: '0.4rem',
                    border: 'none',
                    backgroundColor: 'transparent',
                    color: '#38bdf8',
                    textAlign: 'left',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.45rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'rgba(51, 65, 85, 0.6)')}
                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                >
                  <RefreshCw size={13} style={{ color: '#38bdf8' }} />
                  <span>Đồng bộ lại lên R2</span>
                </button>
              )}
              {/* Xoay 90 độ */}
              <button
                type="button"
                onClick={() => {
                  setIsMoreMenuOpen(false);
                  onRotate90();
                }}
                style={{
                  width: '100%',
                  padding: '0.4rem 0.6rem',
                  borderRadius: '0.4rem',
                  border: 'none',
                  backgroundColor: 'transparent',
                  color: '#f8fafc',
                  textAlign: 'left',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.45rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'rgba(51, 65, 85, 0.6)')}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
              >
                <RotateCw size={13} style={{ color: '#fbbf24' }} />
                <span>Xoay ảnh 90°</span>
              </button>

              {/* Vẽ / Chú thích */}
              {allowAnnotation && (
                <button
                  type="button"
                  onClick={() => {
                    setIsMoreMenuOpen(false);
                    onStartAnnotating();
                  }}
                  style={{
                    width: '100%',
                    padding: '0.4rem 0.6rem',
                    borderRadius: '0.4rem',
                    border: 'none',
                    backgroundColor: 'transparent',
                    color: '#f8fafc',
                    textAlign: 'left',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.45rem',
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'rgba(51, 65, 85, 0.6)')}
                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                >
                  <Edit3 size={13} style={{ color: '#34d399' }} />
                  <span>Vẽ / Ghi chú nứt</span>
                </button>
              )}

              {/* Chụp bằng máy ảnh máy (Native) */}
              <label
                htmlFor={cameraInputId}
                onClick={() => setIsMoreMenuOpen(false)}
                style={{
                  width: '100%',
                  padding: '0.4rem 0.6rem',
                  borderRadius: '0.4rem',
                  backgroundColor: 'transparent',
                  color: '#f8fafc',
                  textAlign: 'left',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.45rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  boxSizing: 'border-box',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'rgba(51, 65, 85, 0.6)')}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
              >
                <Camera size={13} style={{ color: '#38bdf8' }} />
                <span>Dùng máy ảnh máy (Native)</span>
              </label>

              {/* Chọn ảnh từ máy */}
              <label
                htmlFor={galleryInputId}
                onClick={() => setIsMoreMenuOpen(false)}
                style={{
                  width: '100%',
                  padding: '0.4rem 0.6rem',
                  borderRadius: '0.4rem',
                  backgroundColor: 'transparent',
                  color: '#f8fafc',
                  textAlign: 'left',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.45rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  boxSizing: 'border-box',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'rgba(51, 65, 85, 0.6)')}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
              >
                <ImageIcon size={13} style={{ color: '#60a5fa' }} />
                <span>Chọn từ thư viện máy</span>
              </label>

              <div style={{ borderTop: '1px solid rgba(51, 65, 85, 0.8)', margin: '0.2rem 0' }} />

              {/* Xóa ảnh */}
              <button
                type="button"
                onClick={() => {
                  setIsMoreMenuOpen(false);
                  onClear();
                }}
                style={{
                  width: '100%',
                  padding: '0.4rem 0.6rem',
                  borderRadius: '0.4rem',
                  border: 'none',
                  backgroundColor: 'transparent',
                  color: '#f87171',
                  textAlign: 'left',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.45rem',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
                onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.2)')}
                onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
              >
                <Trash2 size={13} />
                <span>Xóa ảnh này</span>
              </button>
            </div>
          )}
        </div>
      </div>
      )}

      {/* Bottom Center: Nút Nhấn vào để phóng to */}
      <div
        style={{
          position: 'absolute',
          bottom: '6px',
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 10,
        }}
      >
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onOpenLightbox();
          }}
          style={{
            fontSize: '0.65rem',
            color: 'rgba(255, 255, 255, 0.95)',
            backgroundColor: 'rgba(0, 0, 0, 0.6)',
            padding: '0.2rem 0.65rem',
            borderRadius: '9999px',
            backdropFilter: 'blur(3px)',
            fontWeight: 600,
            whiteSpace: 'nowrap',
            border: '1px solid rgba(255, 255, 255, 0.25)',
            display: 'flex',
            alignItems: 'center',
            gap: '0.25rem',
            cursor: 'pointer',
          }}
          title="Nhấn vào để phóng to ảnh soi chi tiết vạch thước đo nứt"
          aria-label="Phóng to ảnh"
        >
          <ZoomIn size={11} strokeWidth={2.5} />
          <span>Nhấn vào để phóng to</span>
        </button>
      </div>
    </div>
  );
};
