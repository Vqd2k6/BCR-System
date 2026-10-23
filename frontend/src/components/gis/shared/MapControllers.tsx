import React, { useState, useEffect } from 'react';
import { useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import { AlertCircle, HelpCircle, X } from 'lucide-react';

/**
 * Clean click-to-view Help Popover Component for Surveyors
 */
export const HelpBadge: React.FC<{
  title: string;
  content: React.ReactNode;
  type?: 'help' | 'alert';
}> = ({ title, content, type = 'help' }) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <span style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', marginLeft: '0.35rem' }}>
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setIsOpen(!isOpen);
        }}
        title="Nhấn để xem hướng dẫn"
        style={{
          background: 'none',
          border: 'none',
          padding: '0 0.15rem',
          cursor: 'pointer',
          display: 'inline-flex',
          alignItems: 'center',
          color: type === 'alert' ? 'rgb(var(--text-orange-600))' : 'rgb(var(--text-sky-600))',
          lineHeight: 1,
        }}
      >
        {type === 'alert' ? <AlertCircle size={15} /> : <HelpCircle size={15} />}
      </button>

      {isOpen && (
        <>
          <div
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              zIndex: 9998,
            }}
            onClick={() => setIsOpen(false)}
          />
          <div
            style={{
              position: 'absolute',
              top: '120%',
              left: '-10px',
              zIndex: 9999,
              width: '290px',
              backgroundColor: 'rgb(var(--bg-white))',
              border: '1px solid rgb(var(--border-slate-300))',
              borderRadius: '0.5rem',
              padding: '0.65rem 0.85rem',
              boxShadow: '0 10px 20px rgba(0, 0, 0, 0.12), 0 4px 6px rgba(0, 0, 0, 0.05)',
              fontSize: '0.725rem',
              color: 'rgb(var(--text-slate-700))',
              lineHeight: 1.5,
              textAlign: 'left',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '0.35rem',
                borderBottom: '1px solid rgb(var(--border-slate-100))',
                paddingBottom: '0.25rem',
              }}
            >
              <strong style={{ color: 'rgb(var(--text-slate-900))', fontSize: '0.75rem' }}>{title}</strong>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                style={{
                  border: 'none',
                  background: 'none',
                  cursor: 'pointer',
                  color: '#94a3b8',
                  padding: '0 0.2rem',
                  display: 'flex',
                  alignItems: 'center',
                }}
              >
                <X size={14} />
              </button>
            </div>
            <div>{content}</div>
          </div>
        </>
      )}
    </span>
  );
};

/**
 * Auto fit and center map bounds on parcel geometry with leaflet invalidateSize
 */
export const MapBoundsController: React.FC<{
  coords: [number, number][];
  zoom?: number;
}> = ({ coords, zoom = 18 }) => {
  const map = useMap();
  useEffect(() => {
    if (!map) return;
    try {
      const container = map.getContainer();
      if (!container) return;
    } catch {
      return;
    }

    try {
      map.stop();
      if (coords && coords.length >= 3) {
        const bounds = L.latLngBounds(coords.map(([lat, lng]) => [lat, lng]));
        map.fitBounds(bounds, { padding: [30, 30], maxZoom: 20 });
      } else if (coords && coords.length > 0) {
        map.setView(coords[0], zoom);
      }
    } catch (err) {
      console.debug('[MapBoundsController] Safe fitBounds ignore:', err);
    }

    const timer = setTimeout(() => {
      try {
        if (map && map.getContainer()) {
          map.invalidateSize();
        }
      } catch {
        // Safe ignore
      }
    }, 200);
    return () => clearTimeout(timer);
  }, [coords, zoom, map]);
  return null;
};

/**
 * Map click listener for click-to-draw mode
 */
export const MapClickListener: React.FC<{
  enabled: boolean;
  onMapClick: (point: [number, number]) => void;
}> = ({ enabled, onMapClick }) => {
  useMapEvents({
    click(e) {
      if (enabled) {
        onMapClick([e.latlng.lat, e.latlng.lng]);
      }
    },
  });
  return null;
};

/**
 * Controller to set view to center coordinates & persist viewport per zone in sessionStorage
 * Phòng vệ race condition: Chỉ gọi setView khi vị trí thực sự dịch chuyển đáng kể (> 0.0001 độ)
 */
export function ChangeView({
  center,
  zoom,
  zoneKey,
}: {
  center: [number, number];
  zoom: number;
  zoneKey?: string;
}) {
  const map = useMap();
  const prevRef = React.useRef<{ lat: number; lng: number; zoom: number; zoneKey?: string } | null>(null);

  useMapEvents({
    moveend() {
      if (!zoneKey || !map) return;
      try {
        const c = map.getCenter();
        const z = map.getZoom();
        const raw = sessionStorage.getItem('ksqh_sweep_map_viewport_by_zone');
        const mapByZone: Record<string, { lat: number; lng: number; zoom: number }> = raw
          ? JSON.parse(raw)
          : {};
        mapByZone[zoneKey] = { lat: c.lat, lng: c.lng, zoom: z };
        sessionStorage.setItem('ksqh_sweep_map_viewport_by_zone', JSON.stringify(mapByZone));
      } catch {
        // Safe ignore
      }
    },
    zoomend() {
      if (!zoneKey || !map) return;
      try {
        const c = map.getCenter();
        const z = map.getZoom();
        const raw = sessionStorage.getItem('ksqh_sweep_map_viewport_by_zone');
        const mapByZone: Record<string, { lat: number; lng: number; zoom: number }> = raw
          ? JSON.parse(raw)
          : {};
        mapByZone[zoneKey] = { lat: c.lat, lng: c.lng, zoom: z };
        sessionStorage.setItem('ksqh_sweep_map_viewport_by_zone', JSON.stringify(mapByZone));
      } catch {
        // Safe ignore
      }
    },
  });

  useEffect(() => {
    if (!map) return;
    try {
      if (!map.getContainer()) return;
    } catch {
      return;
    }

    let [lat, lng] = center;
    let targetZoom = zoom;

    if (zoneKey) {
      try {
        const raw = sessionStorage.getItem('ksqh_sweep_map_viewport_by_zone');
        if (raw) {
          const mapByZone = JSON.parse(raw) as Record<
            string,
            { lat: number; lng: number; zoom: number }
          >;
          const saved = mapByZone[zoneKey];
          if (
            saved &&
            typeof saved.lat === 'number' &&
            typeof saved.lng === 'number' &&
            typeof saved.zoom === 'number'
          ) {
            lat = saved.lat;
            lng = saved.lng;
            targetZoom = saved.zoom;
          }
        }
      } catch {
        // Safe ignore
      }
    }

    const prev = prevRef.current;

    // Ngưỡng sai số 0.0001 độ (~11 mét) hoặc zoom / zone khác biệt
    const isDifferent =
      !prev ||
      prev.zoneKey !== zoneKey ||
      Math.abs(prev.lat - lat) > 0.0001 ||
      Math.abs(prev.lng - lng) > 0.0001 ||
      prev.zoom !== targetZoom;

    if (isDifferent) {
      prevRef.current = { lat, lng, zoom: targetZoom, zoneKey };
      try {
        map.stop(); // Hủy transition animation cũ trước khi set view mới
        map.setView([lat, lng], targetZoom);
      } catch (err) {
        console.debug('[ChangeView] Safe setView ignore:', err);
      }
    }
  }, [center, zoom, zoneKey, map]);
  return null;
}

/**
 * Controller to smoothly fly to target coordinates
 */
export function FlyToController({ targetCoords }: { targetCoords: [number, number] | null }) {
  const map = useMap();
  const prevCoordsRef = React.useRef<[number, number] | null>(null);

  useEffect(() => {
    if (!targetCoords || !map) return;
    try {
      if (!map.getContainer()) return;
    } catch {
      return;
    }

    const prev = prevCoordsRef.current;
    if (prev && prev[0] === targetCoords[0] && prev[1] === targetCoords[1]) {
      return;
    }
    prevCoordsRef.current = targetCoords;

    try {
      map.stop();
      map.flyTo(targetCoords, 21, { animate: true, duration: 0.8 });
    } catch (err) {
      console.debug('[FlyToController] Safe flyTo ignore:', err);
    }
  }, [targetCoords, map]);
  return null;
}
