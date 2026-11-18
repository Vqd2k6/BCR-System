/** Nguồn nền raster dùng chung cho bản đồ 2D (Leaflet) và 3D (MapLibre). */
export type BaseTileMode = 'standard' | 'satellite' | 'osm';

export interface BaseTileSource {
  /** Mẫu URL dạng {z}/{x}/{y} (Leaflet có thêm {s}/{r} cho OSM → dùng urlLeaflet). */
  urlLeaflet: string;
  /** Mẫu URL không có subdomain / retina, dùng cho MapLibre. */
  urlGl: string[];
  attribution: string;
  maxNativeZoom: number;
  subdomains?: string;
  /** className Leaflet cho lớp đường phố (lọc màu theo theme). */
  className?: string;
}

export const BASE_TILE_SOURCES: Record<BaseTileMode, BaseTileSource> = {
  satellite: {
    urlLeaflet: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    urlGl: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'],
    attribution:
      'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP',
    maxNativeZoom: 19,
  },
  osm: {
    urlLeaflet: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
    urlGl: [
      'https://a.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png',
      'https://b.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png',
      'https://c.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png',
    ],
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
    maxNativeZoom: 19,
    subdomains: 'abcd',
    className: 'tile-street',
  },
  standard: {
    urlLeaflet: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}',
    urlGl: ['https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}'],
    attribution: 'Tiles &copy; Esri &mdash; Esri World Street Map',
    maxNativeZoom: 19,
    className: 'tile-street',
  },
};
