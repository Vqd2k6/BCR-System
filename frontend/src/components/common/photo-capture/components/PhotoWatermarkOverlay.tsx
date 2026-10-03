import React from 'react';
import { LOGO_THACO_CREC_BASE64 } from '../../../../assets/logoThacoCrecBase64';

export interface PhotoWatermarkOverlayProps {
  photoCode?: string;
  timestamp?: Date | string | number;
  gps?: { lat: number; lng: number };
  variant?: 'compact' | 'full';
  showLogo?: boolean;
}

/**
 * ĐỊNH DẠNG THỜI GIAN CHUẨN PHÁP LÝ METRO 2: DD/MM/YYYY HH:mm:ss
 */
function formatTimestamp(ts?: Date | string | number): string {
  const d = ts ? new Date(ts) : new Date();
  const day = String(d.getDate()).padStart(2, '0');
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const year = d.getFullYear();
  const hours = String(d.getHours()).padStart(2, '0');
  const minutes = String(d.getMinutes()).padStart(2, '0');
  const seconds = String(d.getSeconds()).padStart(2, '0');
  return `${day}/${month}/${year} ${hours}:${minutes}:${seconds}`;
}

export const PhotoWatermarkOverlay: React.FC<PhotoWatermarkOverlayProps> = ({
  photoCode,
  timestamp,
  gps,
  variant = 'compact',
  showLogo = true,
}) => {
  if (!photoCode) return null;

  const timeStr = formatTimestamp(timestamp);
  const isFull = variant === 'full';

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        pointerEvents: 'none',
        zIndex: 5,
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        padding: isFull ? '16px' : '8px',
      }}
    >
      {/* Góc trên bên phải: Logo THACO - CREC */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', width: '100%' }}>
        {showLogo && (
          <div
            style={{
              padding: isFull ? '4px 8px' : '2px 6px',
              backgroundColor: 'rgba(255, 255, 255, 0.85)',
              borderRadius: isFull ? '6px' : '4px',
              boxShadow: '0 2px 6px rgba(0, 0, 0, 0.35)',
              backdropFilter: 'blur(3px)',
            }}
          >
            <img
              src={LOGO_THACO_CREC_BASE64}
              alt="THACO-CREC Logo"
              style={{
                height: isFull ? '28px' : '18px',
                width: 'auto',
                display: 'block',
                objectFit: 'contain',
              }}
            />
          </div>
        )}
      </div>

      {/* Góc dưới bên phải: Ngày giờ + Mã định danh Photo ID (+ Tọa độ GPS) */}
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-end',
          textAlign: 'right',
          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif',
          lineHeight: 1.25,
          color: '#FFFFFF',
          textShadow: '0 1px 3px rgba(0, 0, 0, 0.95), 0 2px 6px rgba(0, 0, 0, 0.85), 0 0 2px #000',
        }}
      >
        <span
          style={{
            fontSize: isFull ? '14px' : '10px',
            fontWeight: 700,
            letterSpacing: '0.02em',
          }}
        >
          {timeStr}
        </span>
        <span
          style={{
            fontSize: isFull ? '13px' : '9.5px',
            fontWeight: 800,
            color: '#38bdf8', // Sky blue nhẹ nhàng nổi bật trên nền ảnh
            letterSpacing: '0.03em',
            textShadow: '0 1px 3px rgba(0, 0, 0, 0.95), 0 0 4px #000',
          }}
        >
          {photoCode}
        </span>
        {gps && gps.lat && gps.lng && (
          <span
            style={{
              fontSize: isFull ? '11px' : '8.5px',
              fontWeight: 600,
              color: '#a7f3d0',
              opacity: 0.95,
            }}
          >
            GPS: {gps.lat.toFixed(6)}, {gps.lng.toFixed(6)}
          </span>
        )}
      </div>
    </div>
  );
};
