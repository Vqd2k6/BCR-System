/**
 * Chọn và đánh số điểm khống chế trên ranh khảo sát ("Boundary Building") của Zone.
 * Module thuần; đầu vào theo thứ tự Leaflet [lat, lng].
 *
 * Quy tắc (đã chốt với nghiệp vụ):
 *  1. Mở vòng, gộp đỉnh cách nhau < 0.5 m, bỏ đỉnh gần thẳng hàng (đổi hướng < 1°).
 *  2. Còn > 40 điểm → đơn giản hóa Douglas–Peucker từ dung sai 0.5 m, tăng gấp đôi tới khi ≤ 40 điểm.
 *  3. Đánh số 1..N từ đỉnh Đông-Nam, đi theo chiều kim đồng hồ (dọc cạnh Nam về Tây, rồi cạnh Bắc về Đông).
 */
import { wgs84ToVn2000 } from './vn2000';

type LatLng = [number, number];
type Meters = [number, number];

export interface ControlPoint {
  no: number;
  coord: LatLng;
  /** Northing VN2000 (m) */
  x: number;
  /** Easting VN2000 (m) */
  y: number;
}

export interface ControlPointSelection {
  points: ControlPoint[];
  /** Dung sai Douglas–Peucker đã dùng (m); 0 nếu không cần đơn giản hóa. */
  simplifyToleranceMeters: number;
}

const METERS_PER_DEGREE = 111320;
const MERGE_DISTANCE_METERS = 0.5;
const COLLINEAR_TURN_DEGREES = 1;
const MAX_CONTROL_POINTS = 40;
const INITIAL_TOLERANCE_METERS = 0.5;

interface Vertex {
  coord: LatLng;
  m: Meters;
}

const openRing = (ring: LatLng[]): LatLng[] => {
  if (ring.length < 2) return ring;
  const first = ring[0];
  const last = ring[ring.length - 1];
  return first[0] === last[0] && first[1] === last[1] ? ring.slice(0, -1) : ring;
};

const distance = (a: Meters, b: Meters): number => Math.hypot(a[0] - b[0], a[1] - b[1]);

const mergeClose = (vertices: Vertex[]): Vertex[] => {
  const result: Vertex[] = [];
  vertices.forEach((vertex) => {
    const last = result[result.length - 1];
    if (!last || distance(last.m, vertex.m) >= MERGE_DISTANCE_METERS) result.push(vertex);
  });
  while (result.length > 3 && distance(result[0].m, result[result.length - 1].m) < MERGE_DISTANCE_METERS) {
    result.pop();
  }
  return result;
};

const turnDegrees = (prev: Meters, current: Meters, next: Meters): number => {
  const a1 = Math.atan2(current[1] - prev[1], current[0] - prev[0]);
  const a2 = Math.atan2(next[1] - current[1], next[0] - current[0]);
  let turn = Math.abs(((a2 - a1) * 180) / Math.PI) % 360;
  if (turn > 180) turn = 360 - turn;
  return turn;
};

const dropCollinear = (vertices: Vertex[]): Vertex[] => {
  let current = vertices;
  let changed = true;
  while (changed && current.length > 3) {
    changed = false;
    const kept: Vertex[] = [];
    current.forEach((vertex, index) => {
      const prev = current[(index - 1 + current.length) % current.length];
      const next = current[(index + 1) % current.length];
      if (turnDegrees(prev.m, vertex.m, next.m) < COLLINEAR_TURN_DEGREES) {
        changed = true;
      } else {
        kept.push(vertex);
      }
    });
    if (kept.length < 3) return current;
    current = kept;
  }
  return current;
};

const pointToSegment = (p: Meters, a: Meters, b: Meters): number => {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const lengthSquared = dx * dx + dy * dy;
  const t =
    lengthSquared === 0
      ? 0
      : Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / lengthSquared));
  return Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy);
};

const douglasPeuckerOpen = (vertices: Vertex[], tolerance: number): Vertex[] => {
  if (vertices.length < 3) return vertices;
  const first = vertices[0];
  const last = vertices[vertices.length - 1];
  let maxDistance = -1;
  let splitIndex = 0;
  for (let i = 1; i < vertices.length - 1; i++) {
    const d = pointToSegment(vertices[i].m, first.m, last.m);
    if (d > maxDistance) {
      maxDistance = d;
      splitIndex = i;
    }
  }
  if (maxDistance <= tolerance) return [first, last];
  const left = douglasPeuckerOpen(vertices.slice(0, splitIndex + 1), tolerance);
  const right = douglasPeuckerOpen(vertices.slice(splitIndex), tolerance);
  return [...left.slice(0, -1), ...right];
};

/** DP cho vòng kín: tách tại đỉnh xa đỉnh 0 nhất để hai nửa đều là polyline mở. */
const douglasPeuckerRing = (vertices: Vertex[], tolerance: number): Vertex[] => {
  if (vertices.length <= 3) return vertices;
  let farIndex = 1;
  vertices.forEach((vertex, index) => {
    if (distance(vertex.m, vertices[0].m) > distance(vertices[farIndex].m, vertices[0].m)) farIndex = index;
  });
  const firstHalf = douglasPeuckerOpen(vertices.slice(0, farIndex + 1), tolerance);
  const secondHalf = douglasPeuckerOpen([...vertices.slice(farIndex), vertices[0]], tolerance);
  return [...firstHalf.slice(0, -1), ...secondHalf.slice(0, -1)];
};

const signedArea = (vertices: Vertex[]): number => {
  let area = 0;
  for (let i = 0, j = vertices.length - 1; i < vertices.length; j = i++) {
    area += vertices[j].m[0] * vertices[i].m[1] - vertices[i].m[0] * vertices[j].m[1];
  }
  return area / 2;
};

const cleanup = (vertices: Vertex[]): Vertex[] => dropCollinear(mergeClose(vertices));

export function selectControlPoints(ring: LatLng[]): ControlPointSelection {
  const opened = openRing(ring);
  if (opened.length < 3) return { points: [], simplifyToleranceMeters: 0 };

  const lat0 = opened.reduce((sum, p) => sum + p[0], 0) / opened.length;
  const lng0 = opened.reduce((sum, p) => sum + p[1], 0) / opened.length;
  const cosLat0 = Math.cos((lat0 * Math.PI) / 180);
  // Hệ mét cục bộ: x hướng Đông, y hướng Bắc
  const toMeters = ([lat, lng]: LatLng): Meters => [
    (lng - lng0) * METERS_PER_DEGREE * cosLat0,
    (lat - lat0) * METERS_PER_DEGREE,
  ];

  let vertices = cleanup(opened.map((coord) => ({ coord, m: toMeters(coord) })));
  let tolerance = 0;
  if (vertices.length > MAX_CONTROL_POINTS) {
    tolerance = INITIAL_TOLERANCE_METERS;
    const base = vertices;
    vertices = cleanup(douglasPeuckerRing(base, tolerance));
    while (vertices.length > MAX_CONTROL_POINTS) {
      tolerance *= 2;
      vertices = cleanup(douglasPeuckerRing(base, tolerance));
    }
  }

  // Chiều kim đồng hồ trong hệ (Đông, Bắc) ⇔ diện tích có dấu âm
  if (signedArea(vertices) > 0) vertices = [...vertices].reverse();

  let startIndex = 0;
  vertices.forEach((vertex, index) => {
    const score = vertex.m[0] - vertex.m[1];
    const best = vertices[startIndex].m[0] - vertices[startIndex].m[1];
    if (score > best) startIndex = index;
  });
  const ordered = [...vertices.slice(startIndex), ...vertices.slice(0, startIndex)];

  return {
    points: ordered.map((vertex, index) => {
      const vn = wgs84ToVn2000(vertex.coord);
      return { no: index + 1, coord: vertex.coord, x: vn.x, y: vn.y };
    }),
    simplifyToleranceMeters: tolerance,
  };
}
