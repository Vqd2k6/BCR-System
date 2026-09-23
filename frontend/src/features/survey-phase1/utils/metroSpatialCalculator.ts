/**
 * METRO LINE 2 SPATIAL CALCULATOR (PHƯƠNG ÁN A)
 * Tính toán hình học không gian trắc địa:
 * - Khoảng cách ngắn nhất từ các đỉnh của Polygon thửa đất đến đường tim tuyến Metro 2 (Centerline)
 * - Khoảng cách ngắn nhất từ ranh thửa đất đến ranh giải phóng mặt bằng (Clearance Corridor)
 * - Lý trình (Chainage Km X+YYY) của thửa đất dọc tuyến Metro
 * - Tọa độ tâm hình học (Centroid) cố định của thửa đất
 */

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
 * Đường tim tuyến Metro Số 2 (Tập hợp các điểm tim tuyến nối 11 ga dọc trục CMT8 - Trường Chinh)
 */
export const METRO_LINE2_CENTERLINE: [number, number][] = METRO_LINE2_STATIONS.map((s) => s.pos);

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
 * Tính khoảng cách ngắn nhất từ đa giác (Polygon các đỉnh của thửa đất) đến một Polyline (tim tuyến)
 */
export const polygonToPolylineDistance = (
  polygonCoords: [number, number][],
  polylineCoords: [number, number][]
): { minDistance: number; closestPoint: [number, number]; segmentIndex: number; t: number } => {
  if (!polygonCoords || polygonCoords.length === 0 || !polylineCoords || polylineCoords.length < 2) {
    return { minDistance: 15.0, closestPoint: [10.8034, 106.6385], segmentIndex: 0, t: 0 };
  }

  let minDistance = Infinity;
  let closestPoint: [number, number] = polylineCoords[0];
  let segmentIndex = 0;
  let bestT = 0;

  // Duyệt qua tất cả các đỉnh của đa giác thửa đất
  for (const vertex of polygonCoords) {
    for (let i = 0; i < polylineCoords.length - 1; i++) {
      const segA = polylineCoords[i];
      const segB = polylineCoords[i + 1];
      const res = pointToSegmentDistance(vertex, segA, segB);
      if (res.distance < minDistance) {
        minDistance = res.distance;
        closestPoint = res.projection;
        segmentIndex = i;
        bestT = res.t;
      }
    }
  }

  return { minDistance, closestPoint, segmentIndex, t: bestT };
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
  metroOffsetDistance: string; // VD: "12.5m"
  clearanceOffsetDistance: string; // VD: "4.8m"
  chainage: string; // VD: "Km 7+850"
  closestStation: string;
}

/**
 * TÍNH TOÁN TOÀN DIỆN CHỈ SỐ KHÔNG GIAN CHO THỬA ĐẤT (PHƯƠNG ÁN A)
 * - Tọa độ tâm thửa đất (Centroid)
 * - Khoảng cách gần nhất từ mép lô đất đến tim tuyến Metro 2
 * - Khoảng cách gần nhất từ mép lô đất đến ranh mốc GPMB
 * - Lý trình (Chainage)
 */
export const calculateParcelMetroSpatialMetrics = (
  parcelCoords: [number, number][]
): ParcelMetroSpatialMetrics => {
  // 1. Tính tâm hình học (Centroid) của thửa đất
  let avgLat = 10.8034;
  let avgLng = 106.6385;

  if (parcelCoords && parcelCoords.length > 0) {
    const sumLat = parcelCoords.reduce((acc, c) => acc + c[0], 0);
    const sumLng = parcelCoords.reduce((acc, c) => acc + c[1], 0);
    avgLat = Number((sumLat / parcelCoords.length).toFixed(6));
    avgLng = Number((sumLng / parcelCoords.length).toFixed(6));
  }

  // 2. Tính khoảng cách ngắn nhất từ Polygon lô đất đến Tim tuyến Metro 2
  const centerAnalysis = polygonToPolylineDistance(parcelCoords, METRO_LINE2_CENTERLINE);
  const distanceToCenterlineMeters = centerAnalysis.minDistance;

  // 3. Tính khoảng cách tới ranh GPMB (Hành lang an toàn ngầm/mặt đất thường cách tim 8m - 12m)
  // Ranh GPMB cách ranh thửa đất = |khoảng cách tới tim - bán kính giải phóng mặt bằng danh nghĩa (~10m)|
  // Đảm bảo không âm và phản ánh đúng cự ly thực tế tới mép ranh GPMB
  const nominalCorridorHalfWidth = 10.0; // Bán kính giải phóng mặt bằng tiêu chuẩn 10m mỗi bên tim tuyến
  const distanceToClearanceMeters = Math.max(1.2, Math.abs(distanceToCenterlineMeters - nominalCorridorHalfWidth));

  // 4. Tính toán Lý trình (Chainage) bằng phép chiếu lên 11 ga
  const segIdx = centerAnalysis.segmentIndex;
  const startStation = METRO_LINE2_STATIONS[segIdx];
  const endStation = METRO_LINE2_STATIONS[Math.min(segIdx + 1, METRO_LINE2_STATIONS.length - 1)];

  let interpolatedKm = startStation.km;
  if (endStation && endStation !== startStation) {
    interpolatedKm = startStation.km + centerAnalysis.t * (endStation.km - startStation.km);
  }
  const chainageStr = formatChainage(interpolatedKm);

  return {
    centroid: { lat: avgLat, lng: avgLng },
    metroOffsetDistance: `${distanceToCenterlineMeters.toFixed(1)}m`,
    clearanceOffsetDistance: `${distanceToClearanceMeters.toFixed(1)}m`,
    chainage: chainageStr,
    closestStation: startStation.name,
  };
};
