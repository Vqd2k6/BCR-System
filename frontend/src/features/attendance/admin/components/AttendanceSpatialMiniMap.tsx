import React, { useMemo } from 'react';
import { MapContainer, TileLayer, Circle, CircleMarker, Tooltip } from 'react-leaflet';
import type { LatLngTuple } from 'leaflet';
import type { GeoPoint } from '../../types/admin.types';

interface Props {
  /** Tâm Zone đã lưu lúc check-in (snapshot). null = ca cũ chưa có snapshot. */
  zoneCenter: GeoPoint | null;
  gpsIn: GeoPoint | null;
  gpsOut: GeoPoint | null;
}

/** Leaflet dùng [lat, lng] — chuyển đổi tại đây, dữ liệu API đã là {lat, lng}. */
const toLatLng = (p: GeoPoint): LatLngTuple => [p.lat, p.lng];

/** Bản đồ đối chứng: vòng bán kính 500m quanh tâm Zone + điểm Check-in (xanh) và Check-out (cam). */
export const AttendanceSpatialMiniMap: React.FC<Props> = ({ zoneCenter, gpsIn, gpsOut }) => {
  const center = useMemo<LatLngTuple | null>(() => {
    const p = zoneCenter || gpsIn || gpsOut;
    return p ? toLatLng(p) : null;
  }, [zoneCenter, gpsIn, gpsOut]);

  if (!center) {
    return (
      <div className="h-56 rounded-xl border border-dashed border-slate-300 flex items-center justify-center text-xs text-slate-400">
        Không có tọa độ để hiển thị bản đồ.
      </div>
    );
  }

  return (
    <div className="space-y-1">
      <div className="h-56 rounded-xl overflow-hidden border border-slate-200">
        <MapContainer center={center} zoom={15} scrollWheelZoom={false} style={{ height: '100%', width: '100%' }}>
          <TileLayer attribution="© OpenStreetMap" url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
          {zoneCenter && (
            <>
              <Circle center={toLatLng(zoneCenter)} radius={500} pathOptions={{ color: '#0891b2', weight: 2, fillOpacity: 0.08 }} />
              <CircleMarker center={toLatLng(zoneCenter)} radius={5} pathOptions={{ color: '#0e7490', fillOpacity: 1 }}>
                <Tooltip>Tâm Zone lúc chấm công</Tooltip>
              </CircleMarker>
            </>
          )}
          {gpsIn && (
            <CircleMarker center={toLatLng(gpsIn)} radius={7} pathOptions={{ color: '#059669', fillColor: '#10b981', fillOpacity: 0.9 }}>
              <Tooltip>Điểm Check-in</Tooltip>
            </CircleMarker>
          )}
          {gpsOut && (
            <CircleMarker center={toLatLng(gpsOut)} radius={7} pathOptions={{ color: '#c2410c', fillColor: '#f97316', fillOpacity: 0.9 }}>
              <Tooltip>Điểm Check-out</Tooltip>
            </CircleMarker>
          )}
        </MapContainer>
      </div>
      {!zoneCenter && (
        <p className="text-[11px] text-amber-700">
          Ca chấm công cũ chưa lưu tâm Zone tại thời điểm chấm công — vòng 500m không hiển thị.
        </p>
      )}
    </div>
  );
};
