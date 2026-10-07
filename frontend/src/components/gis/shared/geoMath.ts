import L from 'leaflet';

/**
 * Custom handle icon for draggable polygon handles
 */
export const createHandleIcon = (num: number) => {
  return L.divIcon({
    className: 'custom-handle-marker',
    html: `<div style="
      width: 22px;
      height: 22px;
      background-color: #f59e0b;
      border: 2px solid #ffffff;
      border-radius: 50%;
      box-shadow: 0 2px 6px rgba(0,0,0,0.35);
      color: #ffffff;
      font-weight: 800;
      font-size: 10px;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: grab;
    ">${num}</div>`,
    iconSize: [22, 22],
    iconAnchor: [11, 11],
  });
};

/**
 * Interpolation helper between 2 points
 */
export const interpolatePoint = (
  pA: [number, number],
  pB: [number, number],
  ratio: number
): [number, number] => {
  return [
    pA[0] + (pB[0] - pA[0]) * ratio,
    pA[1] + (pB[1] - pA[1]) * ratio,
  ];
};

/**
 * Shoelace area calculation in square meters (spherical projection approx on WGS84)
 */
export const computePolygonAreaM2 = (coords: [number, number][]): number => {
  if (!coords || coords.length < 3) return 0;
  const R = 6378137;
  let area = 0;
  for (let i = 0; i < coords.length; i++) {
    const j = (i + 1) % coords.length;
    const lat1 = (coords[i][0] * Math.PI) / 180;
    const lat2 = (coords[j][0] * Math.PI) / 180;
    const dLng = ((coords[j][1] - coords[i][1]) * Math.PI) / 180;
    area += dLng * (2 + Math.sin(lat1) + Math.sin(lat2));
  }
  area = Math.abs((area * R * R) / 2);
  return Math.round(area * 10) / 10;
};

/**
 * Centroid calculation for a polygon
 */
export const computeCentroid = (coords: [number, number][]): [number, number] => {
  if (!coords || coords.length === 0) return [10.798123, 106.645678];
  const sumLat = coords.reduce((acc, c) => acc + c[0], 0);
  const sumLng = coords.reduce((acc, c) => acc + c[1], 0);
  return [sumLat / coords.length, sumLng / coords.length];
};

/**
 * Split quad into Horizontal A (front) and B (rear)
 */
export const splitQuadHorizontal = (
  coords: [number, number][],
  ratio: number = 0.6
): { polyA: [number, number][]; polyB: [number, number][] } => {
  if (!coords || coords.length < 3) {
    return { polyA: coords || [], polyB: coords || [] };
  }
  const p0 = coords[0];
  const p1 = coords[1];
  const p2 = coords[2];
  const p3 = coords[3] || coords[2];

  const cutL = interpolatePoint(p0, p3, ratio);
  const cutR = interpolatePoint(p1, p2, ratio);

  const polyA: [number, number][] = [p0, p1, cutR, cutL];
  const polyB: [number, number][] = [cutL, cutR, p2, p3];

  return { polyA, polyB };
};

/**
 * Split quad into Vertical A (left) and B (right)
 */
export const splitQuadVertical = (
  coords: [number, number][],
  ratio: number = 0.5
): { polyA: [number, number][]; polyB: [number, number][] } => {
  if (!coords || coords.length < 3) {
    return { polyA: coords || [], polyB: coords || [] };
  }
  const p0 = coords[0];
  const p1 = coords[1];
  const p2 = coords[2];
  const p3 = coords[3] || coords[2];

  const cutTop = interpolatePoint(p0, p1, ratio);
  const cutBottom = interpolatePoint(p3, p2, ratio);

  const polyA: [number, number][] = [p0, cutTop, cutBottom, p3];
  const polyB: [number, number][] = [cutTop, p1, p2, cutBottom];

  return { polyA, polyB };
};

/**
 * Chuyển mảng đỉnh Leaflet [lat, lng][] sang GeoJSON Polygon chuẩn PostGIS ([lng, lat])
 */
export const leafletCoordsToGeoJsonPolygon = (
  coords: [number, number][]
): { type: 'Polygon'; coordinates: [number, number][][] } | null => {
  if (!coords || coords.length < 3) return null;
  const ring: [number, number][] = coords.map(([lat, lng]) => [lng, lat]);
  // Khép kín vòng nếu cần
  if (
    ring[0][0] !== ring[ring.length - 1][0] ||
    ring[0][1] !== ring[ring.length - 1][1]
  ) {
    ring.push([ring[0][0], ring[0][1]]);
  }
  return {
    type: 'Polygon',
    coordinates: [ring],
  };
};

/**
 * Trích xuất tọa độ an toàn từ GeoJSON Polygon hoặc MultiPolygon sang mảng Leaflet [lat, lng][]
 */
export const parseCoordinatesFromGeoJson = (p: any): [number, number][] => {
  if (!p) return [];
  let coords: [number, number][] = [];
  let geo = p.cadastral_geojson || p.cadastralGeojson || p.polygonGeoJson || p;
  if (typeof geo === 'string') {
    try {
      geo = JSON.parse(geo);
    } catch (_) {}
  }
  if (geo && typeof geo === 'object') {
    if (geo.type === 'Polygon' && Array.isArray(geo.coordinates?.[0])) {
      coords = (geo.coordinates[0] as [number, number][]).map(
        ([lng, lat]) => [lat, lng] as [number, number]
      );
    } else if (geo.type === 'MultiPolygon' && Array.isArray(geo.coordinates?.[0]?.[0])) {
      coords = (geo.coordinates[0][0] as [number, number][]).map(
        ([lng, lat]) => [lat, lng] as [number, number]
      );
    }
  }
  if (coords.length < 3 && p.coordinates && Array.isArray(p.coordinates) && p.coordinates.length >= 3) {
    coords = p.coordinates;
  }
  return coords;
};

