/**
 * ============================================================================
 * AUDIT METRO SPATIAL GEOMETRY UTILS
 * Tiện ích hình học không gian phục vụ cập nhật khoảng cách Metro 2 khi
 * Thẩm định viên (Zone Admin) hiệu chỉnh tọa độ đa giác thửa đất.
 * ============================================================================
 */

import fs from 'fs';
import path from 'path';

function pointToSegmentDistance(
  pt: [number, number],
  v: [number, number],
  w: [number, number]
): { distance: number; projection: [number, number] } {
  const latScale = 111320;
  const lngScale = 111320 * Math.cos((pt[0] * Math.PI) / 180);

  const px = pt[1] * lngScale;
  const py = pt[0] * latScale;
  const vx = v[1] * lngScale;
  const vy = v[0] * latScale;
  const wx = w[1] * lngScale;
  const wy = w[0] * latScale;

  const l2 = (wx - vx) ** 2 + (wy - vy) ** 2;
  if (l2 === 0) {
    const dist = Math.hypot(px - vx, py - vy);
    return { distance: dist, projection: v };
  }

  let t = ((px - vx) * (wx - vx) + (py - vy) * (wy - vy)) / l2;
  t = Math.max(0, Math.min(1, t));

  const projX = vx + t * (wx - vx);
  const projY = vy + t * (wy - vy);
  const dist = Math.hypot(px - projX, py - projY);

  return {
    distance: dist,
    projection: [projY / latScale, projX / lngScale],
  };
}

function isPointInPolygon(point: [number, number], vs: [number, number][]): boolean {
  const x = point[1];
  const y = point[0];
  let inside = false;
  for (let i = 0, j = vs.length - 1; i < vs.length; j = i++) {
    const xi = vs[i][1];
    const yi = vs[i][0];
    const xj = vs[j][1];
    const yj = vs[j][0];
    const intersect = yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi + 1e-12) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

function doSegmentsIntersect(
  p1: [number, number],
  p2: [number, number],
  p3: [number, number],
  p4: [number, number]
): boolean {
  const ccw = (A: [number, number], B: [number, number], C: [number, number]) =>
    (C[0] - A[0]) * (B[1] - A[1]) > (B[0] - A[0]) * (C[1] - A[1]);
  return ccw(p1, p3, p4) !== ccw(p2, p3, p4) && ccw(p1, p2, p3) !== ccw(p1, p2, p4);
}

function doPolygonsOverlap(
  parcelCoords: [number, number][],
  stationCoords: [number, number][]
): boolean {
  if (!parcelCoords || parcelCoords.length < 3 || !stationCoords || stationCoords.length < 3) {
    return false;
  }

  for (const vertex of parcelCoords) {
    if (isPointInPolygon(vertex, stationCoords)) {
      return true;
    }
  }

  for (const vertex of stationCoords) {
    if (isPointInPolygon(vertex, parcelCoords)) {
      return true;
    }
  }

  for (let i = 0; i < parcelCoords.length; i++) {
    const p1 = parcelCoords[i];
    const p2 = parcelCoords[(i + 1) % parcelCoords.length];
    for (let j = 0; j < stationCoords.length; j++) {
      const p3 = stationCoords[j];
      const p4 = stationCoords[(j + 1) % stationCoords.length];
      if (doSegmentsIntersect(p1, p2, p3, p4)) {
        return true;
      }
    }
  }

  return false;
}

let cachedBoundaryData: {
  centerline?: [number, number][];
  stationDetailedFootprints?: Array<{ name: string; coords: [number, number][] }>;
  corridorBoundaries?: Array<{ name: string; coords: [number, number][] }>;
} | null = null;

function getMetroBoundaryData() {
  if (cachedBoundaryData) return cachedBoundaryData;

  const candidatePaths = [
    path.resolve(process.cwd(), '../data/metro_boundary_data.json'),
    path.resolve(process.cwd(), 'data/metro_boundary_data.json'),
    path.resolve(__dirname, '../../../../../data/metro_boundary_data.json'),
    path.resolve(__dirname, '../../../../../frontend/src/features/survey-phase1/constants/metro_boundary_data.json'),
  ];

  for (const p of candidatePaths) {
    if (fs.existsSync(p)) {
      try {
        const raw = fs.readFileSync(p, 'utf8');
        cachedBoundaryData = JSON.parse(raw);
        return cachedBoundaryData;
      } catch {
        // Tiếp tục thử đường dẫn khác
      }
    }
  }

  return null;
}

export function calculateDistancesFromPolygon(polygonCoords: [number, number][] | null): {
  distanceToAlignmentM: number | null;
  distanceToBoundaryM: number | null;
  centerlineDist: number | null;
  outerBoundaryDist: number | null;
  nearestStationName: string | null;
} {
  const boundaryData = getMetroBoundaryData();
  if (!polygonCoords || polygonCoords.length === 0 || !boundaryData) {
    return {
      distanceToAlignmentM: null,
      distanceToBoundaryM: null,
      centerlineDist: null,
      outerBoundaryDist: null,
      nearestStationName: null,
    };
  }

  const normalized = polygonCoords.map((p) => (p[0] > p[1] ? [p[1], p[0]] : p) as [number, number]);
  const centerline: [number, number][] = boundaryData.centerline || [];
  const stations: Array<{ name: string; coords: [number, number][] }> = boundaryData.stationDetailedFootprints || [];
  const corridors: Array<{ name: string; coords: [number, number][] }> = boundaryData.corridorBoundaries || [];

  let minCenterDist = Infinity;
  let centerlineCrossesParcel = false;

  if (normalized.length >= 3) {
    for (let i = 0; i < centerline.length - 1; i++) {
      const c1 = centerline[i];
      const c2 = centerline[i + 1];
      if (isPointInPolygon(c1, normalized) || isPointInPolygon(c2, normalized)) {
        centerlineCrossesParcel = true;
        break;
      }
      for (let k = 0; k < normalized.length; k++) {
        const p1 = normalized[k];
        const p2 = normalized[(k + 1) % normalized.length];
        if (doSegmentsIntersect(p1, p2, c1, c2)) {
          centerlineCrossesParcel = true;
          break;
        }
      }
      if (centerlineCrossesParcel) break;
    }
  }

  if (centerlineCrossesParcel) {
    minCenterDist = 0;
  } else {
    for (const v of normalized) {
      for (let i = 0; i < centerline.length - 1; i++) {
        const d = pointToSegmentDistance(v, centerline[i], centerline[i + 1]);
        if (d.distance < minCenterDist) {
          minCenterDist = d.distance;
        }
      }
    }
    if (normalized.length >= 3) {
      for (const cPt of centerline) {
        for (let k = 0; k < normalized.length; k++) {
          const p1 = normalized[k];
          const p2 = normalized[(k + 1) % normalized.length];
          const d = pointToSegmentDistance(cPt, p1, p2);
          if (d.distance < minCenterDist) {
            minCenterDist = d.distance;
          }
        }
      }
    }
  }

  let minStDist = Infinity;
  let nearestStationName: string | null = null;

  for (const st of stations) {
    if (doPolygonsOverlap(normalized, st.coords)) {
      minStDist = 0;
      nearestStationName = st.name;
      break;
    }

    for (const v of normalized) {
      for (let j = 0; j < st.coords.length; j++) {
        const p1 = st.coords[j];
        const p2 = st.coords[(j + 1) % st.coords.length];
        const d = pointToSegmentDistance(v, p1, p2);
        if (d.distance < minStDist) {
          minStDist = d.distance;
          nearestStationName = st.name;
        }
      }
    }

    if (normalized.length >= 3) {
      for (const stVertex of st.coords) {
        for (let k = 0; k < normalized.length; k++) {
          const p1 = normalized[k];
          const p2 = normalized[(k + 1) % normalized.length];
          const d = pointToSegmentDistance(stVertex, p1, p2);
          if (d.distance < minStDist) {
            minStDist = d.distance;
            nearestStationName = st.name;
          }
        }
      }
    }
  }

  for (const cor of corridors) {
    if (!cor.coords || cor.coords.length < 2) continue;
    for (const v of normalized) {
      for (let j = 0; j < cor.coords.length - 1; j++) {
        const d = pointToSegmentDistance(v, cor.coords[j], cor.coords[j + 1]);
        if (d.distance < minStDist) {
          minStDist = d.distance;
        }
      }
    }
  }

  const distanceToAlignmentM = minCenterDist < Infinity ? Number(minCenterDist.toFixed(1)) : null;
  const distanceToBoundaryM = minStDist < Infinity ? Number(minStDist.toFixed(1)) : null;

  return {
    distanceToAlignmentM,
    distanceToBoundaryM,
    centerlineDist: distanceToAlignmentM,
    outerBoundaryDist: distanceToBoundaryM,
    nearestStationName,
  };
}
