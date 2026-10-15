import React from 'react';
import { TileLayer } from 'react-leaflet';

export interface SafeTileLayerProps {
  mode?: 'street' | 'satellite' | 'carto';
  className?: string;
  maxNativeZoom?: number;
  maxZoom?: number;
}

/**
 * ============================================================================
 * SAFE TILE LAYER COMPONENT
 * ============================================================================
 * Thay thế triệt để các kết nối không ổn định đến tile.openstreetmap.org
 * bằng CDN chuyên nghiệp của Esri và CARTO (99.99% Uptime, không chặn IP VN).
 * Hỗ trợ native zoom đến 19 và deep zoom nội suy CSS đến 23.
 * ============================================================================
 */
export const SafeTileLayer: React.FC<SafeTileLayerProps> = ({
  mode = 'street',
  className = 'tile-street',
  maxNativeZoom = 19,
  maxZoom = 23,
}) => {
  if (mode === 'satellite') {
    return (
      <TileLayer
        attribution="Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP"
        url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
        maxNativeZoom={maxNativeZoom}
        maxZoom={maxZoom}
        className={className}
      />
    );
  }

  if (mode === 'carto') {
    return (
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
        url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
        subdomains="abcd"
        maxNativeZoom={maxNativeZoom}
        maxZoom={maxZoom}
        className={className}
      />
    );
  }

  // Mặc định: Esri World Street Map (Rất chi tiết và ổn định tuyệt đối tại Việt Nam)
  return (
    <TileLayer
      attribution="Tiles &copy; Esri &mdash; Esri World Street Map"
      url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}"
      maxNativeZoom={maxNativeZoom}
      maxZoom={maxZoom}
      className={className}
    />
  );
};
