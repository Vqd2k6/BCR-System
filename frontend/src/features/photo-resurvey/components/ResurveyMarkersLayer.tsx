import React from 'react';
import L from 'leaflet';
import { Marker, Tooltip } from 'react-leaflet';
import type { ResurveyTask } from '../types';

/**
 * Dấu chấm than trên thửa cần khảo sát bổ sung:
 * - Đỏ cam nhấp nháy: còn ảnh ngoài nhà cần chụp lại.
 * - Vàng hổ phách: KSV đã nộp, chờ Zone Admin duyệt.
 * Toạ độ server trả về (ST_PointOnSurface – luôn nằm trong thửa), Leaflet dùng [lat, lng].
 */
function exclamationIcon(state: ResurveyTask['state']): L.DivIcon {
  const color = state === 'SUBMITTED' ? '#f59e0b' : '#ef4444';
  const pulse = state === 'PENDING' ? 'animation: resurvey-pulse 1.6s ease-in-out infinite;' : '';
  return L.divIcon({
    className: 'resurvey-exclamation-pin',
    html: `
      <style>@keyframes resurvey-pulse{0%,100%{transform:scale(1)}50%{transform:scale(1.18)}}</style>
      <div style="width:24px;height:24px;border-radius:50%;background:${color};border:2px solid #ffffff;
        box-shadow:0 0 8px ${color};display:flex;align-items:center;justify-content:center;
        color:#ffffff;font-weight:900;font-size:15px;line-height:1;${pulse}">!</div>`,
    iconSize: [24, 24],
    iconAnchor: [12, 12],
  });
}

const ICONS: Record<ResurveyTask['state'], L.DivIcon> = {
  PENDING: exclamationIcon('PENDING'),
  SUBMITTED: exclamationIcon('SUBMITTED'),
};

interface ResurveyMarkersLayerProps {
  tasks: ResurveyTask[];
  onSelect: (task: ResurveyTask) => void;
}

export const ResurveyMarkersLayer: React.FC<ResurveyMarkersLayerProps> = ({ tasks, onSelect }) => (
  <>
    {tasks.map((t) =>
      t.lat === null || t.lng === null ? null : (
        <Marker
          key={t.reportId}
          position={[t.lat, t.lng]}
          icon={ICONS[t.state]}
          zIndexOffset={1000}
          eventHandlers={{ click: () => onSelect(t) }}
        >
          <Tooltip direction="top" offset={[0, -12]}>
            {t.parcelCode || t.reportCode} •{' '}
            {t.state === 'SUBMITTED' ? 'Chờ duyệt ảnh chụp lại' : `${t.openOutdoorCount} ảnh cần chụp lại`}
          </Tooltip>
        </Marker>
      )
    )}
  </>
);
