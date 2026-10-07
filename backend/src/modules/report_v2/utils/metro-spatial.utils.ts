/**
 * ============================================================================
 * METRO SPATIAL UTILITIES (PHASE 1 BCS REPORT V2)
 * Tính toán hình học không gian trắc địa chuẩn xác:
 * - Tim tuyến Metro 2 (Centerline)
 * - Mép hố đào / Đường bao ngoài công trình ga (Outer boundary)
 * - Đồng bộ 100% với Động cơ Thẩm định của Admin (Stepwise Audit Engine)
 * ============================================================================
 */

import * as fs from 'fs';
import * as path from 'path';

/**
 * Trích xuất và chuẩn hóa số thực từ chuỗi (hỗ trợ định dạng "21.5m", "34.9 m", 21.5)
 */
export function parseCleanDistanceNumber(val: any): number | null {
  if (val === undefined || val === null || val === '') return null;
  if (typeof val === 'number') {
    return isNaN(val) ? null : val;
  }
  const str = String(val).trim();
  const cleaned = str.replace(/[^\d.-]/g, '');
  const parsed = parseFloat(cleaned);
  return isNaN(parsed) ? null : parsed;
}

export interface MetroDistanceResult {
  distanceToAlignmentM: string;
  distanceToEdgeM: string;
  hasAlignmentDistance: boolean;
  hasEdgeDistance: boolean;
  displayVi: string;
  displayEn: string;
}

/**
 * Tính khoảng cách Haversine giữa 2 tọa độ WGS84 (đơn vị: mét)
 */
function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371e3;
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Tính khoảng cách vuông góc ngắn nhất từ điểm P đến đoạn thẳng AB (đơn vị: mét)
 */
function pointToSegmentDistance(
  p: [number, number],
  a: [number, number],
  b: [number, number]
): { distance: number; projection: [number, number] } {
  const cosLat = Math.cos((p[0] * Math.PI) / 180);
  const mPerDegLat = 111320;
  const mPerDegLng = 111320 * cosLat;

  const px = (p[1] - a[1]) * mPerDegLng;
  const py = (p[0] - a[0]) * mPerDegLat;
  const bx = (b[1] - a[1]) * mPerDegLng;
  const by = (b[0] - a[0]) * mPerDegLat;

  const segLenSq = bx * bx + by * by;
  let t = 0;
  if (segLenSq > 0) {
    t = (px * bx + py * by) / segLenSq;
    t = Math.max(0, Math.min(1, t));
  }

  const projLat = a[0] + t * (b[0] - a[0]);
  const projLng = a[1] + t * (b[1] - a[1]);
  const dist = haversineDistance(p[0], p[1], projLat, projLng);
  return { distance: dist, projection: [projLat, projLng] };
}

// Bộ nhớ đệm dữ liệu bản đồ ranh giới Metro 2
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
      } catch (err) {
        // Tiếp tục thử đường dẫn khác
      }
    }
  }

  return null;
}

/**
 * Trích xuất mảng tọa độ [lat, lng] từ dữ liệu thửa đất
 */
function extractParcelPolygonCoords(rawReport: any, json: any): [number, number][] | null {
  // 1. Thử từ json.polygonCoords
  if (Array.isArray(json?.polygonCoords) && json.polygonCoords.length >= 3) {
    return json.polygonCoords;
  }

  // 2. Thử từ rawReport.parcel_polygon_geojson
  if (rawReport?.parcel_polygon_geojson) {
    try {
      const geojson = typeof rawReport.parcel_polygon_geojson === 'string'
        ? JSON.parse(rawReport.parcel_polygon_geojson)
        : rawReport.parcel_polygon_geojson;
      if (geojson && geojson.coordinates && Array.isArray(geojson.coordinates[0])) {
        // Chuyển [lng, lat] thành [lat, lng]
        const ring = geojson.coordinates[0];
        return ring.map((pt: any) => [Number(pt[1]), Number(pt[0])] as [number, number]);
      }
    } catch (e) {
      // Bỏ qua lỗi parse
    }
  }

  return null;
}

/**
 * Tính khoảng cách thủ công từ điểm polygon thửa đất gần nhất đến tim hầm và biên kết cấu Metro,
 * đồng bộ 100% với Động cơ Thẩm định của Zone Admin.
 */
export function calculateDistancesFromPolygon(
  polygonCoords: [number, number][]
): { centerlineDist: number | null; outerBoundaryDist: number | null } {
  const boundaryData = getMetroBoundaryData();
  if (!boundaryData || !polygonCoords || polygonCoords.length < 3) {
    return { centerlineDist: null, outerBoundaryDist: null };
  }

  // 1. Cự ly tới Tim Hầm (Centerline)
  let minCenterlineDist = Infinity;
  const centerline = boundaryData.centerline || [];
  if (centerline.length > 1) {
    for (const vertex of polygonCoords) {
      for (let i = 0; i < centerline.length - 1; i++) {
        const res = pointToSegmentDistance(vertex, centerline[i], centerline[i + 1]);
        if (res.distance < minCenterlineDist) {
          minCenterlineDist = res.distance;
        }
      }
    }
  }

  // 2. Cự ly tới Nhà Ga / Biên Hố Đào (Mép công trình ga màu trắng hoặc ranh hành lang)
  let minStationDist = Infinity;
  const stationOutlines = boundaryData.stationDetailedFootprints || [];
  for (const station of stationOutlines) {
    if (!station.coords || station.coords.length < 2) continue;
    for (const vertex of polygonCoords) {
      for (let j = 0; j < station.coords.length; j++) {
        const p1 = station.coords[j];
        const p2 = station.coords[(j + 1) % station.coords.length];
        const res = pointToSegmentDistance(vertex, p1, p2);
        if (res.distance < minStationDist) {
          minStationDist = res.distance;
        }
      }
    }
  }

  let minCorridorDist = Infinity;
  const corridorBoundaries = boundaryData.corridorBoundaries || [];
  for (const corridor of corridorBoundaries) {
    if (!corridor.coords || corridor.coords.length < 2) continue;
    for (const vertex of polygonCoords) {
      for (let k = 0; k < corridor.coords.length - 1; k++) {
        const res = pointToSegmentDistance(vertex, corridor.coords[k], corridor.coords[k + 1]);
        if (res.distance < minCorridorDist) {
          minCorridorDist = res.distance;
        }
      }
    }
  }

  let outerBoundaryDist: number | null = null;
  const isNearStation = minStationDist < 180 && minStationDist < minCorridorDist * 1.5;
  if (isNearStation && minStationDist < Infinity) {
    outerBoundaryDist = minStationDist;
  } else if (minCorridorDist < Infinity) {
    outerBoundaryDist = minCorridorDist;
  }

  return {
    centerlineDist: minCenterlineDist < Infinity ? minCenterlineDist : null,
    outerBoundaryDist,
  };
}

/**
 * Tính toán cự ly tới Metro cho Báo cáo V2 từ Payload khảo sát và Polygon thửa đất
 * Nguyên tắc:
 * 1. Ưu tiên số liệu đo đạc/thẩm định trực tiếp trong survey_data_json (manualMetroDistanceM, clearanceOffsetDistance, stationEdgeDistance)
 * 2. Kế đến lấy số liệu GIS trắc địa từ database (distance_to_centerline_m)
 * 3. Nếu thiếu cự ly mép hố đào/tim hầm: tính toán thủ công từ đỉnh polygon thửa đất gần nhất đến tim/ga (đồng bộ Động cơ Thẩm định)
 * 4. TUYỆT ĐỐI KHÔNG tự động trừ 15.0m giả định.
 */
export function calculateMetroDistances(
  rawReport: any,
  json: any
): MetroDistanceResult {
  // 1. Khoảng cách tới Tim tuyến Metro (Centerline)
  const manualDist = parseCleanDistanceNumber(json.manualMetroDistanceM);
  const jsonMetroOffset = parseCleanDistanceNumber(json.metroOffsetDistance);
  const dbCenterlineDist = parseCleanDistanceNumber(rawReport.distance_to_centerline_m);

  let alignmentM: number | null = manualDist ?? jsonMetroOffset ?? dbCenterlineDist;

  // 2. Khoảng cách tới Biên hố đào / Mép kết cấu Metro (Outer Boundary / Excavation Edge)
  const jsonClearance = parseCleanDistanceNumber(json.clearanceOffsetDistance);
  const jsonStationEdge = parseCleanDistanceNumber(json.stationEdgeDistance);

  let edgeM: number | null = jsonClearance ?? jsonStationEdge;

  // 3. Nếu thiếu, tính toán tự động từ đỉnh polygon gần nhất của thửa đất (như ở màn hình thẩm định admin)
  if (edgeM === null || alignmentM === null) {
    const polygon = extractParcelPolygonCoords(rawReport, json);
    if (polygon && polygon.length >= 3) {
      const computed = calculateDistancesFromPolygon(polygon);
      if (alignmentM === null && computed.centerlineDist !== null) {
        alignmentM = computed.centerlineDist;
      }
      if (edgeM === null && computed.outerBoundaryDist !== null) {
        edgeM = computed.outerBoundaryDist;
      }
    }
  }

  const distanceToAlignmentM = alignmentM !== null ? alignmentM.toFixed(1) : '';
  const distanceToEdgeM = edgeM !== null ? edgeM.toFixed(1) : '';

  const hasAlignmentDistance = distanceToAlignmentM !== '';
  const hasEdgeDistance = distanceToEdgeM !== '';

  let displayVi: string;
  let displayEn: string;

  if (hasAlignmentDistance && hasEdgeDistance) {
    displayVi = `Tim tuyến: ${distanceToAlignmentM} m | Biên hố đào/kết cấu: ${distanceToEdgeM} m`;
    displayEn = `To alignment centerline: ${distanceToAlignmentM} m | To excavation boundary: ${distanceToEdgeM} m`;
  } else if (hasAlignmentDistance) {
    displayVi = `Tim tuyến: ${distanceToAlignmentM} m (Biên hố đào/kết cấu: Tham chiếu bản vẽ hướng tuyến)`;
    displayEn = `To alignment centerline: ${distanceToAlignmentM} m (To excavation boundary: Reference alignment plan)`;
  } else if (hasEdgeDistance) {
    displayVi = `Biên hố đào/kết cấu: ${distanceToEdgeM} m`;
    displayEn = `To excavation boundary: ${distanceToEdgeM} m`;
  } else {
    displayVi = 'Chưa xác định khoảng cách đến Metro';
    displayEn = 'Distance to Metro alignment unrecorded';
  }

  return {
    distanceToAlignmentM,
    distanceToEdgeM,
    hasAlignmentDistance,
    hasEdgeDistance,
    displayVi,
    displayEn,
  };
}
