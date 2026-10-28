import type { AlignmentSide } from '../progress-report.types';
import { METRO2_CENTERLINE_LNG_LAT } from './metro2-centerline';
import { METRO2_STATION_OUTLINES, type StationOutline } from './metro2-stations';

/**
 * Xác định Phải/Trái tuyến và khoảng cách GIS trực tiếp (Tim tuyến & Biên kết cấu)
 * theo tim tuyến chi tiết 537 điểm + 12 đường bao nhà ga/depot CAD MAUR.
 */

const EARTH_R = 6371008.8;
const DEG = Math.PI / 180;
const STATION_MAX_RADIUS_M = 300;

export type LngLat = readonly [number, number];

function toLocal(p: LngLat, refLat: number): [number, number] {
  return [p[0] * DEG * EARTH_R * Math.cos(refLat * DEG), p[1] * DEG * EARTH_R];
}

function pointToSegMeters(p: LngLat, a: LngLat, b: LngLat, refLat: number): number {
  const [px, py] = toLocal(p, refLat);
  const [ax, ay] = toLocal(a, refLat);
  const [bx, by] = toLocal(b, refLat);
  const dx = bx - ax;
  const dy = by - ay;
  const len2 = dx * dx + dy * dy;
  const t = len2 > 0 ? Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len2)) : 0;
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

function pointInPolygon(pt: LngLat, ring: ReadonlyArray<LngLat>): boolean {
  if (ring.length < 3) return false;
  const [x, y] = pt;
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    const intersect = yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

function ccw(a: LngLat, b: LngLat, c: LngLat): number {
  return (c[1] - a[1]) * (b[0] - a[0]) - (c[0] - a[0]) * (b[1] - a[1]);
}

function segmentsIntersect(p1: LngLat, p2: LngLat, p3: LngLat, p4: LngLat): boolean {
  const c1 = ccw(p1, p2, p3);
  const c2 = ccw(p1, p2, p4);
  const c3 = ccw(p3, p4, p1);
  const c4 = ccw(p3, p4, p2);
  return ((c1 > 0 && c2 < 0) || (c1 < 0 && c2 > 0)) && ((c3 > 0 && c4 < 0) || (c3 < 0 && c4 > 0));
}

function polylineIntersectsPolygon(line: ReadonlyArray<LngLat>, poly: ReadonlyArray<LngLat>): boolean {
  if (line.length < 2 || poly.length < 3) return false;
  for (const pt of line) {
    if (pointInPolygon(pt, poly)) return true;
  }
  for (let i = 0; i < line.length - 1; i++) {
    const a = line[i];
    const b = line[i + 1];
    for (let j = 0; j < poly.length; j++) {
      if (segmentsIntersect(a, b, poly[j], poly[(j + 1) % poly.length])) return true;
    }
  }
  return false;
}

function polygonsIntersect(polyA: ReadonlyArray<LngLat>, polyB: ReadonlyArray<LngLat>): boolean {
  if (polyA.length < 3 || polyB.length < 3) return false;
  for (const v of polyA) {
    if (pointInPolygon(v, polyB)) return true;
  }
  for (const v of polyB) {
    if (pointInPolygon(v, polyA)) return true;
  }
  for (let i = 0; i < polyA.length; i++) {
    const a1 = polyA[i];
    const a2 = polyA[(i + 1) % polyA.length];
    for (let j = 0; j < polyB.length; j++) {
      if (segmentsIntersect(a1, a2, polyB[j], polyB[(j + 1) % polyB.length])) return true;
    }
  }
  return false;
}

export interface SideResult {
  side: AlignmentSide | null;
  distanceM: number | null;
}

export function computeAlignmentSide(
  point: LngLat | null,
  line: ReadonlyArray<LngLat> = METRO2_CENTERLINE_LNG_LAT
): SideResult {
  if (!point || line.length < 2 || !Number.isFinite(point[0]) || !Number.isFinite(point[1])) {
    return { side: null, distanceM: null };
  }
  const refLat = point[1];
  const [px, py] = toLocal(point, refLat);
  let bestDist = Number.POSITIVE_INFINITY;
  let bestCross = 0;

  for (let i = 0; i < line.length - 1; i++) {
    const [ax, ay] = toLocal(line[i], refLat);
    const [bx, by] = toLocal(line[i + 1], refLat);
    const dx = bx - ax;
    const dy = by - ay;
    const len2 = dx * dx + dy * dy;
    if (len2 === 0) continue;
    const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len2));
    const qx = ax + t * dx;
    const qy = ay + t * dy;
    const dist = Math.hypot(px - qx, py - qy);
    if (dist < bestDist) {
      bestDist = dist;
      bestCross = dx * (py - ay) - dy * (px - ax);
    }
  }
  if (!Number.isFinite(bestDist)) return { side: null, distanceM: null };
  const side: AlignmentSide | null = bestCross > 0 ? 'LEFT' : bestCross < 0 ? 'RIGHT' : null;
  return { side, distanceM: bestDist };
}

export interface GisDistanceResult {
  distanceCenterlineM: number | null;
  distanceEdgeM: number | null;
}

/**
 * Parse chuỗi GeoJSON Polygon / MultiPolygon từ PostGIS thành mảng đỉnh [lng, lat] của vòng ngoài.
 */
export function parseGeoJsonOuterRingLngLat(geoJsonText: string | null | undefined): ReadonlyArray<LngLat> | null {
  if (!geoJsonText) return null;
  try {
    const parsed: unknown = JSON.parse(geoJsonText);
    if (!parsed || typeof parsed !== 'object') return null;
    const g = parsed as { type?: string; coordinates?: unknown };
    let rawRing: unknown = null;
    if (g.type === 'Polygon' && Array.isArray(g.coordinates)) {
      rawRing = g.coordinates[0];
    } else if (g.type === 'MultiPolygon' && Array.isArray(g.coordinates) && Array.isArray(g.coordinates[0])) {
      rawRing = (g.coordinates[0] as unknown[])[0];
    }
    if (!Array.isArray(rawRing) || rawRing.length < 3) return null;
    const pts: LngLat[] = [];
    for (const item of rawRing) {
      if (Array.isArray(item) && item.length >= 2) {
        const lng = Number(item[0]);
        const lat = Number(item[1]);
        if (Number.isFinite(lng) && Number.isFinite(lat)) pts.push([lng, lat]);
      }
    }
    return pts.length >= 3 ? pts : null;
  } catch (err: unknown) {
    console.error('[ProgressReport] Không parse được GeoJSON polygon:', err);
    return null;
  }
}

/**
 * Tính khoảng cách GIS hiện tại:
 * - Tim tuyến (distanceCenterlineM): khoảng cách ngắn nhất từ ranh công trình (hoặc điểm tâm) tới tim tuyến Metro 2 (537 đỉnh).
 * - Biên kết cấu (distanceEdgeM): khoảng cách ngắn nhất từ ranh công trình tới đường bao công trình ga/depot (< 300m).
 */
export function computeGisDistances(
  polygonLngLat: ReadonlyArray<LngLat> | null,
  pointLngLat: LngLat | null,
  centerline: ReadonlyArray<LngLat> = METRO2_CENTERLINE_LNG_LAT,
  stations: ReadonlyArray<StationOutline> = METRO2_STATION_OUTLINES
): GisDistanceResult {
  const vertices: ReadonlyArray<LngLat> =
    polygonLngLat && polygonLngLat.length >= 3 ? polygonLngLat : pointLngLat ? [pointLngLat] : [];
  if (vertices.length === 0) return { distanceCenterlineM: null, distanceEdgeM: null };

  const refLat = vertices[0][1];
  const hasPoly = vertices.length >= 3;

  // 1. Khoảng cách tới Tim tuyến
  let minCenterDist = Number.POSITIVE_INFINITY;
  if (centerline.length >= 2) {
    if (hasPoly && polylineIntersectsPolygon(centerline, vertices)) {
      minCenterDist = 0;
    } else {
      for (const v of vertices) {
        for (let i = 0; i < centerline.length - 1; i++) {
          const d = pointToSegMeters(v, centerline[i], centerline[i + 1], refLat);
          if (d < minCenterDist) minCenterDist = d;
        }
      }
      if (hasPoly) {
        for (const cPt of centerline) {
          for (let j = 0; j < vertices.length; j++) {
            const d = pointToSegMeters(cPt, vertices[j], vertices[(j + 1) % vertices.length], refLat);
            if (d < minCenterDist) minCenterDist = d;
          }
        }
      }
    }
  }

  // 2. Khoảng cách tới Biên kết cấu (Đường bao nhà ga / depot)
  let minStationDist = Number.POSITIVE_INFINITY;
  for (const st of stations) {
    const stRing = st.coordsLngLat;
    if (stRing.length < 3) continue;
    // Lọc nhanh theo tâm ga (nếu cách > 1000m thì bỏ qua)
    const quickDist = pointToSegMeters(vertices[0], stRing[0], stRing[0], refLat);
    if (quickDist > 1200) continue;

    if (hasPoly && polygonsIntersect(vertices, stRing)) {
      minStationDist = 0;
      break;
    }
    if (!hasPoly && pointInPolygon(vertices[0], stRing)) {
      minStationDist = 0;
      break;
    }

    for (const v of vertices) {
      for (let i = 0; i < stRing.length; i++) {
        const d = pointToSegMeters(v, stRing[i], stRing[(i + 1) % stRing.length], refLat);
        if (d < minStationDist) minStationDist = d;
      }
    }
    if (hasPoly) {
      for (const sPt of stRing) {
        for (let j = 0; j < vertices.length; j++) {
          const d = pointToSegMeters(sPt, vertices[j], vertices[(j + 1) % vertices.length], refLat);
          if (d < minStationDist) minStationDist = d;
        }
      }
    }
  }

  const distanceCenterlineM = Number.isFinite(minCenterDist) ? Math.round(minCenterDist * 10) / 10 : null;
  const distanceEdgeM =
    Number.isFinite(minStationDist) && minStationDist < STATION_MAX_RADIUS_M
      ? Math.round(minStationDist * 10) / 10
      : null;

  return { distanceCenterlineM, distanceEdgeM };
}
