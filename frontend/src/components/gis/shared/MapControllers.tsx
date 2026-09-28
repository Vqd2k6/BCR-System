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
          color: type === 'alert' ? '#ea580c' : '#0284c7',
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
              backgroundColor: '#ffffff',
              border: '1px solid #cbd5e1',
              borderRadius: '0.5rem',
              padding: '0.65rem 0.85rem',
              boxShadow: '0 10px 20px rgba(0, 0, 0, 0.12), 0 4px 6px rgba(0, 0, 0, 0.05)',
              fontSize: '0.725rem',
              color: '#334155',
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
                borderBottom: '1px solid #f1f5f9',
                paddingBottom: '0.25rem',
              }}
            >
              <strong style={{ color: '#0f172a', fontSize: '0.75rem' }}>{title}</strong>
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
    if (coords && coords.length >= 3) {
      const bounds = L.latLngBounds(coords.map(([lat, lng]) => [lat, lng]));
      map.fitBounds(bounds, { padding: [30, 30], maxZoom: 20 });
    } else if (coords && coords.length > 0) {
      map.setView(coords[0], zoom);
    }
    const timer = setTimeout(() => {
      map.invalidateSize();
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
 * Controller to set view to center coordinates
 */
export function ChangeView({ center, zoom }: { center: [number, number]; zoom: number }) {
  const map = useMap();
  useEffect(() => {
    map.setView(center, zoom);
  }, [center, zoom, map]);
  return null;
}

/**
 * Controller to smoothly fly to target coordinates
 */
export function FlyToController({ targetCoords }: { targetCoords: [number, number] | null }) {
  const map = useMap();
  useEffect(() => {
    if (targetCoords) {
      map.flyTo(targetCoords, 21, { animate: true, duration: 0.8 });
    }
  }, [targetCoords, map]);
  return null;
}
