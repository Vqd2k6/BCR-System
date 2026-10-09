import L from 'leaflet';

/**
 * Custom handle icon for draggable polygon handles with customizable theme color
 */
export const createHandleIcon = (num: number, color: string = '#f59e0b') => {
  return L.divIcon({
    className: 'custom-handle-marker',
    html: `<div style="
      width: 22px;
      height: 22px;
      background-color: ${color};
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
      user-select: none;
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
 * Loại bỏ điểm đóng vòng lặp lại ở cuối (GeoJSON closed ring) để giữ đúng số lượng đỉnh thực của đa giác
 */
export const cleanPolygonRing = (coords: [number, number][]): [number, number][] => {
  if (!coords || coords.length < 3) return coords || [];
  const first = coords[0];
  const last = coords[coords.length - 1];
  if (Math.abs(first[0] - last[0]) < 1e-7 && Math.abs(first[1] - last[1]) < 1e-7) {
    return coords.slice(0, coords.length - 1);
  }
  return coords;
};

/**
 * Tính khoảng cách xấp xỉ mét giữa 2 tọa độ WGS84
 */
export const getDistanceM = (p1: [number, number], p2: [number, number]): number => {
  const dLat = (p2[0] - p1[0]) * 111320;
  const dLng = (p2[1] - p1[1]) * 111320 * Math.cos(((p1[0] + p2[0]) / 2 * Math.PI) / 180);
  return Math.sqrt(dLat * dLat + dLng * dLng);
};

/**
 * Chuẩn hóa 4 đỉnh tứ giác theo trục địa hình (mặt tiền / chiều sâu) bất kể góc xoay
 * Trả về 4 đỉnh sắp xếp theo thứ tự: [FrontLeft, FrontRight, BackRight, BackLeft]
 */
export const normalizeQuadEdges = (
  coords: [number, number][]
): {
  frontL: [number, number];
  frontR: [number, number];
  backR: [number, number];
  backL: [number, number];
} => {
  const clean = cleanPolygonRing(coords);
  if (clean.length < 4) {
    const p0 = clean[0] || [0, 0];
    const p1 = clean[1] || p0;
    const p2 = clean[2] || p1;
    const p3 = clean[3] || p2;
    return { frontL: p0, frontR: p1, backR: p2, backL: p3 };
  }

  const p0 = clean[0];
  const p1 = clean[1];
  const p2 = clean[2];
  const p3 = clean[3];

  const l0 = getDistanceM(p0, p1);
  const l1 = getDistanceM(p1, p2);
  const l2 = getDistanceM(p2, p3);
  const l3 = getDistanceM(p3, p0);

  // So sánh cặp cạnh đối diện: (e0, e2) vs (e1, e3)
  const pair02 = l0 + l2;
  const pair13 = l1 + l3;

  if (pair02 >= pair13) {
    // e0 và e2 là 2 cạnh dài (chiều sâu)
    return {
      frontL: p2,
      frontR: p1,
      backR: p0,
      backL: p3,
    };
  } else {
    // e1 và e3 là 2 cạnh dài (chiều sâu)
    return {
      frontL: p0,
      frontR: p1,
      backR: p2,
      backL: p3,
    };
  }
};

/**
 * Split quad into Horizontal A (front) and B (rear) - Chia ngang theo chiều sâu nhà
 */
export const splitQuadHorizontal = (
  coords: [number, number][],
  ratio: number = 0.6
): { polyA: [number, number][]; polyB: [number, number][] } => {
  const clean = cleanPolygonRing(coords);
  if (!clean || clean.length < 3) {
    return { polyA: clean || [], polyB: clean || [] };
  }

  const { frontL, frontR, backR, backL } = normalizeQuadEdges(clean);

  // Cắt ngang là chia 2 cạnh chiều sâu (frontL -> backL và frontR -> backR)
  const cutL = interpolatePoint(frontL, backL, ratio);
  const cutR = interpolatePoint(frontR, backR, ratio);

  // Lô A ở mặt tiền (Front), Lô B ở phía sau (Rear)
  const polyA: [number, number][] = [frontL, frontR, cutR, cutL];
  const polyB: [number, number][] = [cutL, cutR, backR, backL];

  return { polyA, polyB };
};

/**
 * Split quad into Vertical A (left) and B (right) - Chia dọc xuyên suốt từ trước ra sau
 */
export const splitQuadVertical = (
  coords: [number, number][],
  ratio: number = 0.5
): { polyA: [number, number][]; polyB: [number, number][] } => {
  const clean = cleanPolygonRing(coords);
  if (!clean || clean.length < 3) {
    return { polyA: clean || [], polyB: clean || [] };
  }

  const { frontL, frontR, backR, backL } = normalizeQuadEdges(clean);

  // Cắt dọc là chia cạnh mặt tiền (frontL -> frontR) và cạnh mặt hậu (backL -> backR)
  const cutFront = interpolatePoint(frontL, frontR, ratio);
  const cutBack = interpolatePoint(backL, backR, ratio);

  // Lô A ở bên Trái (Left), Lô B ở bên Phải (Right)
  const polyA: [number, number][] = [frontL, cutFront, cutBack, backL];
  const polyB: [number, number][] = [cutFront, frontR, backR, cutBack];

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

export interface GeoJsonCoordinateSource {
  cadastral_geojson?: unknown;
  cadastralGeojson?: unknown;
  polygonGeoJson?: unknown;
  coordinates?: [number, number][];
  type?: string;
  [key: string]: unknown;
}

/**
 * Trích xuất tọa độ an toàn từ GeoJSON Polygon hoặc MultiPolygon sang mảng Leaflet [lat, lng][]
 */
export const parseCoordinatesFromGeoJson = (p: unknown): [number, number][] => {
  if (!p || typeof p !== 'object') return [];
  const src = p as GeoJsonCoordinateSource;
  let coords: [number, number][] = [];
  let geo: unknown = src.cadastral_geojson || src.cadastralGeojson || src.polygonGeoJson || p;
  if (typeof geo === 'string') {
    try {
      geo = JSON.parse(geo);
    } catch (_) {}
  }
  if (geo && typeof geo === 'object') {
    const geoObj = geo as { type?: string; coordinates?: unknown };
    if (geoObj.type === 'Polygon' && Array.isArray(geoObj.coordinates) && Array.isArray(geoObj.coordinates[0])) {
      coords = (geoObj.coordinates[0] as [number, number][]).map(
        ([lng, lat]) => [lat, lng] as [number, number]
      );
    } else if (geoObj.type === 'MultiPolygon' && Array.isArray(geoObj.coordinates) && Array.isArray(geoObj.coordinates[0]) && Array.isArray(geoObj.coordinates[0][0])) {
      coords = (geoObj.coordinates[0][0] as [number, number][]).map(
        ([lng, lat]) => [lat, lng] as [number, number]
      );
    }
  }
  if (coords.length < 3 && Array.isArray(src.coordinates) && src.coordinates.length >= 3) {
    coords = src.coordinates;
  }
  return coords;
};
