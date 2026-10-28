import type { AlignmentSide } from "../progress-report.types";
import { METRO2_CENTERLINE_LNG_LAT } from "./metro2-centerline";

/**
 * Xác định Phải/Trái tuyến (hàm thuần) theo tim tuyến chi tiết 537 điểm.
 * - Chiếu điểm công trình lên đoạn tim tuyến gần nhất (mặt phẳng cục bộ equirectangular, đơn vị mét).
 * - Dấu tích có hướng (vector hướng lý trình × vector tới công trình): > 0 = TRÁI, < 0 = PHẢI.
 * Sai số equirectangular ở vĩ độ ~10.8° với khoảng cách vài trăm mét là không đáng kể.
 */

const EARTH_R = 6371008.8;
const DEG = Math.PI / 180;

type LngLat = readonly [number, number];

function toLocal(p: LngLat, refLat: number): [number, number] {
  return [p[0] * DEG * EARTH_R * Math.cos(refLat * DEG), p[1] * DEG * EARTH_R];
}

export interface SideResult {
  side: AlignmentSide | null;
  distanceM: number | null;
}

export function computeAlignmentSide(
  point: LngLat | null,
  line: ReadonlyArray<LngLat> = METRO2_CENTERLINE_LNG_LAT,
): SideResult {
  if (
    !point ||
    line.length < 2 ||
    !Number.isFinite(point[0]) ||
    !Number.isFinite(point[1])
  ) {
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
    const t = Math.max(
      0,
      Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len2),
    );
    const qx = ax + t * dx;
    const qy = ay + t * dy;
    const dist = Math.hypot(px - qx, py - qy);
    if (dist < bestDist) {
      bestDist = dist;
      bestCross = dx * (py - ay) - dy * (px - ax);
    }
  }
  if (!Number.isFinite(bestDist)) return { side: null, distanceM: null };
  const side: AlignmentSide | null =
    bestCross > 0 ? "LEFT" : bestCross < 0 ? "RIGHT" : null;
  return { side, distanceM: bestDist };
}
