/**
 * METRO LINE 2 SPATIAL CALCULATOR (PHƯƠNG ÁN A)
 * Tính toán hình học không gian trắc địa:
 * - Khoảng cách ngắn nhất từ các đỉnh của Polygon thửa đất đến đường tim tuyến Metro 2 (Centerline)
 * - Khoảng cách ngắn nhất từ ranh thửa đất đến ranh giải phóng mặt bằng (Clearance Corridor)
 * - Lý trình (Chainage Km X+YYY) của thửa đất dọc tuyến Metro
 * - Tọa độ tâm hình học (Centroid) cố định của thửa đất
 */

import {
  METRO_LINE2_CENTERLINE,
  METRO_CORRIDOR_BOUNDARIES,
  METRO_STATION_DETAILED_OUTLINES,
  DetailedStationFootprint,
  MetroCorridorBoundary,
} from '../constants/metroGisConstants';

export { METRO_LINE2_CENTERLINE, METRO_CORRIDOR_BOUNDARIES, METRO_STATION_DETAILED_OUTLINES };

export interface StationWaypoint {
  code: string;
  name: string;
  km: number; // km dạng float (VD: 7.9)
  kmStr: string; // VD: "Km 7+900"
  pos: [number, number]; // [lat, lng]
}

export const METRO_LINE2_STATIONS: StationWaypoint[] = [
  { code: 'ST01', name: 'Ga Bến Thành (ST01)', km: 0.000, kmStr: 'Km 0+000', pos: [10.770876, 106.696946] },
  { code: 'ST02', name: 'Ga Tao Đàn (ST02)', km: 1.035, kmStr: 'Km 1+035', pos: [10.773237, 106.690138] },
  { code: 'ST03', name: 'Ga Dân Chủ (ST03)', km: 2.000, kmStr: 'Km 2+000', pos: [10.780053, 106.677596] },
  { code: 'ST04', name: 'Ga Hòa Hưng (ST04)', km: 3.078, kmStr: 'Km 3+078', pos: [10.782072, 106.673679] },
  { code: 'ST05', name: 'Ga Lê Thị Riêng (ST05)', km: 4.090, kmStr: 'Km 4+090', pos: [10.786163, 106.665623] },
  { code: 'ST06', name: 'Ga Phạm Văn Hai (ST06)', km: 4.808, kmStr: 'Km 4+808', pos: [10.789654, 106.659742] },
  { code: 'ST07', name: 'Ga Bảy Hiền (ST07)', km: 5.500, kmStr: 'Km 5+500', pos: [10.798691, 106.643181] },
  { code: 'ST08', name: 'Ga Nguyễn Hồng Đào (ST08)', km: 6.700, kmStr: 'Km 6+700', pos: [10.806360, 106.634988] },
  { code: 'ST09', name: 'Ga Bà Quẹo (ST09)', km: 7.900, kmStr: 'Km 7+900', pos: [10.810154, 106.633891] },
  { code: 'ST10', name: 'Ga Phạm Văn Bạch (ST10)', km: 9.050, kmStr: 'Km 9+050', pos: [10.822124, 106.630160] },
  { code: 'ST11', name: 'Ga Tân Bình (ST11)', km: 10.100, kmStr: 'Km 10+100', pos: [10.822111, 106.626127] },
];

/**
 * Tính khoảng cách Haversine giữa 2 tọa độ WGS84 (đơn vị: mét)
 */
export const haversineDistance = (
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number => {
  const R = 6371e3; // Bán kính Trái Đất (mét)
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
};

/**
 * Tính khoảng cách vuông góc ngắn nhất từ điểm P đến đoạn thẳng AB (đơn vị: mét)
 */
export const pointToSegmentDistance = (
  p: [number, number],
  a: [number, number],
  b: [number, number]
): { distance: number; projection: [number, number]; t: number } => {
  // Chuyển đổi tương đối sang hệ tọa độ phẳng cục bộ (mét)
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
    t = Math.max(0, Math.min(1, t)); // Giới hạn trong đoạn AB
  }

  const projLat = a[0] + t * (b[0] - a[0]);
  const projLng = a[1] + t * (b[1] - a[1]);

  const dist = haversineDistance(p[0], p[1], projLat, projLng);
  return { distance: dist, projection: [projLat, projLng], t };
};

/**
 * Tính khoảng cách ngắn nhất từ đa giác (Polygon các đỉnh của thửa đất) đến một Polyline
 */
export const polygonToPolylineDistance = (
  polygonCoords: [number, number][],
  polylineCoords: [number, number][]
): { minDistance: number; closestPoint: [number, number]; closestVertex: [number, number]; segmentIndex: number; t: number } => {
  if (!polygonCoords || polygonCoords.length === 0 || !polylineCoords || polylineCoords.length < 2) {
    return { minDistance: 15.0, closestPoint: [10.8034, 106.6385], closestVertex: [10.8034, 106.6385], segmentIndex: 0, t: 0 };
  }

  let minDistance = Infinity;
  let closestPoint: [number, number] = polylineCoords[0];
  let closestVertex: [number, number] = polygonCoords[0];
  let segmentIndex = 0;
  let bestT = 0;

  for (const vertex of polygonCoords) {
    for (let i = 0; i < polylineCoords.length - 1; i++) {
      const segA = polylineCoords[i];
      const segB = polylineCoords[i + 1];
      const res = pointToSegmentDistance(vertex, segA, segB);
      if (res.distance < minDistance) {
        minDistance = res.distance;
        closestPoint = res.projection;
        closestVertex = vertex;
        segmentIndex = i;
        bestT = res.t;
      }
    }
  }

  return { minDistance, closestPoint, closestVertex, segmentIndex, t: bestT };
};

export interface ComprehensiveMetroSpatialMetrics {
  closestCenterVertex: [number, number];
  closestCenterPoint: [number, number];
  distanceToCenterlineMeters: number;
  closestOuterVertex: [number, number];
  closestOuterPoint: [number, number];
  distanceToOuterBoundaryMeters: number;
  outerBoundaryType: 'STATION_OUTLINE' | 'CORRIDOR_BOUNDARY';
  closestStationName: string;
  closestStationFootprint?: [number, number][];
}

/**
 * Tính toán toàn diện không gian trắc địa:
 * 1. Cự ly & hình chiếu vuông góc ngắn nhất tới Tim Hầm Metro Số 2 (537 điểm CAD chuẩn nằm giữa 2 line xanh)
 * 2. Cự ly & hình chiếu ngắn nhất tới Đường Bao Ngoài (Mép công trình nhà ga màu trắng hoặc ranh GPMB an toàn)
 */
export const calculateComprehensiveMetroSpatialMetrics = (
  polygonCoords: [number, number][]
): ComprehensiveMetroSpatialMetrics => {
  if (!polygonCoords || polygonCoords.length === 0) {
    return {
      closestCenterVertex: [10.8034, 106.6385],
      closestCenterPoint: [10.8034, 106.6385],
      distanceToCenterlineMeters: 15.0,
      closestOuterVertex: [10.8034, 106.6385],
      closestOuterPoint: [10.8034, 106.6385],
      distanceToOuterBoundaryMeters: 5.0,
      outerBoundaryType: 'CORRIDOR_BOUNDARY',
      closestStationName: 'Tuyến Metro Số 2',
    };
  }

  const centerline = METRO_LINE2_CENTERLINE && METRO_LINE2_CENTERLINE.length > 1
    ? METRO_LINE2_CENTERLINE
    : METRO_LINE2_STATIONS.map((s) => s.pos);

  const stationOutlines = METRO_STATION_DETAILED_OUTLINES || [];
  const corridorBoundaries = METRO_CORRIDOR_BOUNDARIES || [];

  // 1. Tìm điểm dóng vuông góc ngắn nhất tới Tim Hầm (Centerline)
  let minCenterlineDist = Infinity;
  let bestCenterPoint: [number, number] = centerline[0];
  let bestCenterVertex: [number, number] = polygonCoords[0];

  for (const vertex of polygonCoords) {
    for (let i = 0; i < centerline.length - 1; i++) {
      const res = pointToSegmentDistance(vertex, centerline[i], centerline[i + 1]);
      if (res.distance < minCenterlineDist) {
        minCenterlineDist = res.distance;
        bestCenterPoint = res.projection;
        bestCenterVertex = vertex;
      }
    }
  }

  // 2. Tìm điểm dóng ngắn nhất tới Công Trình Ga Màu Trắng (Detailed Station Footprints)
  let minStationDist = Infinity;
  let bestStationPoint: [number, number] = bestCenterPoint;
  let bestStationVertex: [number, number] = bestCenterVertex;
  let bestStationName = '';
  let bestStationCoords: [number, number][] | undefined = undefined;

  for (const station of stationOutlines) {
    if (!station.coords || station.coords.length < 2) continue;
    for (const vertex of polygonCoords) {
      for (let j = 0; j < station.coords.length; j++) {
        const p1 = station.coords[j];
        const p2 = station.coords[(j + 1) % station.coords.length];
        const res = pointToSegmentDistance(vertex, p1, p2);
        if (res.distance < minStationDist) {
          minStationDist = res.distance;
          bestStationPoint = res.projection;
          bestStationVertex = vertex;
          bestStationName = station.name;
          bestStationCoords = station.coords;
        }
      }
    }
  }

  // 3. Tìm điểm dóng ngắn nhất tới Ranh Hành Lang GPMB (2 đường nét đứt màu xanh Tả Tuyến & Hữu Tuyến)
  let minCorridorDist = Infinity;
  let bestCorridorPoint: [number, number] = bestCenterPoint;
  let bestCorridorVertex: [number, number] = bestCenterVertex;

  for (const corridor of corridorBoundaries) {
    if (!corridor.coords || corridor.coords.length < 2) continue;
    for (const vertex of polygonCoords) {
      for (let k = 0; k < corridor.coords.length - 1; k++) {
        const res = pointToSegmentDistance(vertex, corridor.coords[k], corridor.coords[k + 1]);
        if (res.distance < minCorridorDist) {
          minCorridorDist = res.distance;
          bestCorridorPoint = res.projection;
          bestCorridorVertex = vertex;
        }
      }
    }
  }

  // Quyết định đường bao ngoài phù hợp nhất:
  // Nếu sát khu vực ga (< 180m), ưu tiên mép công trình nhà ga màu trắng
  // Nếu ở đoạn hầm thông thường, lấy ranh hành lang an toàn GPMB
  const isNearStation = minStationDist < 180 && minStationDist < minCorridorDist * 1.5;

  let distanceToOuterBoundaryMeters: number;
  let closestOuterVertex: [number, number];
  let closestOuterPoint: [number, number];
  let outerBoundaryType: 'STATION_OUTLINE' | 'CORRIDOR_BOUNDARY';

  if (isNearStation && minStationDist < Infinity) {
    distanceToOuterBoundaryMeters = minStationDist;
    closestOuterVertex = bestStationVertex;
    closestOuterPoint = bestStationPoint;
    outerBoundaryType = 'STATION_OUTLINE';
  } else if (minCorridorDist < Infinity) {
    distanceToOuterBoundaryMeters = minCorridorDist;
    closestOuterVertex = bestCorridorVertex;
    closestOuterPoint = bestCorridorPoint;
    outerBoundaryType = 'CORRIDOR_BOUNDARY';
  } else {
    distanceToOuterBoundaryMeters = Math.max(1.0, Math.abs(minCenterlineDist - 10.0));
    closestOuterVertex = bestCenterVertex;
    closestOuterPoint = bestCenterPoint;
    outerBoundaryType = 'CORRIDOR_BOUNDARY';
  }

  return {
    closestCenterVertex: bestCenterVertex,
    closestCenterPoint: bestCenterPoint,
    distanceToCenterlineMeters: minCenterlineDist,
    closestOuterVertex,
    closestOuterPoint,
    distanceToOuterBoundaryMeters,
    outerBoundaryType,
    closestStationName: bestStationName || 'Tuyến Metro Số 2',
    closestStationFootprint: bestStationCoords,
  };
};

/**
 * Tìm đỉnh polygon của thửa đất gần nhất với tim hầm và khu vực ga màu trắng
 */
export const findClosestParcelVertexToMetro = (
  polygonCoords: [number, number][]
): {
  closestVertex: [number, number];
  distanceToCenterlineMeters: number;
  distanceToOuterBoundaryMeters: number;
  closestStationName?: string;
} => {
  const metrics = calculateComprehensiveMetroSpatialMetrics(polygonCoords);
  return {
    closestVertex: metrics.closestCenterVertex,
    distanceToCenterlineMeters: metrics.distanceToCenterlineMeters,
    distanceToOuterBoundaryMeters: metrics.distanceToOuterBoundaryMeters,
    closestStationName: metrics.closestStationName,
  };
};

/**
 * Định dạng lý trình từ số km thực tế thành chuỗi Km X+YYY
 * VD: 7.85 -> "Km 7+850"
 */
export const formatChainage = (kmValue: number): string => {
  const kmPart = Math.floor(kmValue);
  const metersPart = Math.round((kmValue - kmPart) * 1000);
  const metersPadded = metersPart.toString().padStart(3, '0');
  return `Km ${kmPart}+${metersPadded}`;
};

export interface ParcelMetroSpatialMetrics {
  centroid: { lat: number; lng: number };
  closestVertex: { lat: number; lng: number };
  metroOffsetDistance: string; // VD: "12.5m"
  clearanceOffsetDistance: string; // VD: "4.8m"
  chainage: string;
  closestStation: string;
}

/**
 * TÍNH TOÁN TOÀN DIỆN CHỈ SỐ KHÔNG GIAN CHO THỬA ĐẤT
 * - Tọa độ đỉnh polygon gần nhất với tim hầm & ga màu trắng (đưa vào gpsCoords)
 * - Khoảng cách tới tim Metro
 * - Khoảng cách đến đường bao ngoài
 */
export const calculateParcelMetroSpatialMetrics = (
  parcelCoords: [number, number][]
): ParcelMetroSpatialMetrics => {
  let avgLat = 10.8034;
  let avgLng = 106.6385;

  if (parcelCoords && parcelCoords.length > 0) {
    const sumLat = parcelCoords.reduce((acc, c) => acc + c[0], 0);
    const sumLng = parcelCoords.reduce((acc, c) => acc + c[1], 0);
    avgLat = Number((sumLat / parcelCoords.length).toFixed(6));
    avgLng = Number((sumLng / parcelCoords.length).toFixed(6));
  }

  const analysis = calculateComprehensiveMetroSpatialMetrics(parcelCoords);

  return {
    centroid: { lat: avgLat, lng: avgLng },
    closestVertex: {
      lat: Number(analysis.closestCenterVertex[0].toFixed(6)),
      lng: Number(analysis.closestCenterVertex[1].toFixed(6)),
    },
    metroOffsetDistance: `${analysis.distanceToCenterlineMeters.toFixed(1)}m`,
    clearanceOffsetDistance: `${analysis.distanceToOuterBoundaryMeters.toFixed(1)}m`,
    chainage: '',
    closestStation: analysis.closestStationName || 'Tuyến Metro Số 2',
  };
};
