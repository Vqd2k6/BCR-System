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
export function extractParcelPolygonCoords(rawReport: any, json: any): [number, number][] | null {
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

  // 3. Fallback đa giác hình chữ nhật quanh tọa độ GPS (nếu có GPS)
  const gpsLat = Number(rawReport?.gps_lat ?? json?.gpsLocation?.lat ?? rawReport?.latitude ?? (typeof rawReport?.gps_coordinates === 'string' ? rawReport.gps_coordinates.split(',')[0] : null));
  const gpsLng = Number(rawReport?.gps_lng ?? json?.gpsLocation?.lng ?? rawReport?.longitude ?? (typeof rawReport?.gps_coordinates === 'string' ? rawReport.gps_coordinates.split(',')[1] : null));
  if (!isNaN(gpsLat) && !isNaN(gpsLng) && gpsLat > 0 && gpsLng > 0) {
    const dLat = 0.00007; // ~8m
    const dLng = 0.00009; // ~10m
    return [
      [gpsLat - dLat, gpsLng - dLng],
      [gpsLat - dLat, gpsLng + dLng],
      [gpsLat + dLat, gpsLng + dLng],
      [gpsLat + dLat, gpsLng - dLng],
    ];
  }

  return null;
}

/**
 * Sinh sơ đồ vector SVG vị trí không gian thửa đất đối với tuyến Metro 2:
 * - Thửa đất khảo sát (đa giác viền đỏ, nền đỏ nhạt)
 * - Tim tuyến Metro 2 (nét đứt xanh dương)
 * - Ranh công trình ga / ranh hành lang đào (nét đứt xám)
 * - La bàn chỉ hướng Bắc (N) và Thước tỷ lệ trắc địa
 * - TUYỆT ĐỐI KHÔNG vẽ 2 đường dóng cự ly (lines) theo đúng chỉ đạo
 */
export function generateMetroSpatialVisualSvg(
  polygonCoords: [number, number][] | null,
  parcelCode: string = 'Thửa đất'
): string {
  const boundaryData = getMetroBoundaryData();
  if (!polygonCoords || polygonCoords.length < 3) {
    return '';
  }

  // 1. Tính tâm thửa đất
  const centerLat = polygonCoords.reduce((sum, p) => sum + p[0], 0) / polygonCoords.length;
  const centerLng = polygonCoords.reduce((sum, p) => sum + p[1], 0) / polygonCoords.length;

  const cosLat = Math.cos((centerLat * Math.PI) / 180);
  const mPerDegLat = 111320;
  const mPerDegLng = 111320 * cosLat;

  // Chuyển đổi WGS84 -> tọa độ mét cục bộ [x, y]
  const toLocal = (p: [number, number]): [number, number] => {
    return [(p[1] - centerLng) * mPerDegLng, (p[0] - centerLat) * mPerDegLat];
  };

  const localParcel = polygonCoords.map(toLocal);

  // 2. Thu thập đối tượng Metro lân cận trong bán kính ~180m
  const maxSearchRadiusM = 180;
  const centerline = boundaryData?.centerline || [];
  const nearbyCenterline: [number, number][] = [];
  for (const pt of centerline) {
    const loc = toLocal(pt);
    if (Math.hypot(loc[0], loc[1]) <= maxSearchRadiusM) {
      nearbyCenterline.push(loc);
    }
  }

  const nearbyStations: Array<{ name: string; pts: [number, number][] }> = [];
  for (const st of boundaryData?.stationDetailedFootprints || []) {
    const localStPts = (st.coords || []).map(toLocal);
    const isNear = localStPts.some(pt => Math.hypot(pt[0], pt[1]) <= maxSearchRadiusM);
    if (isNear) {
      nearbyStations.push({ name: st.name, pts: localStPts });
    }
  }

  const nearbyCorridors: Array<[number, number][]> = [];
  for (const cor of boundaryData?.corridorBoundaries || []) {
    const localCorPts = (cor.coords || []).map(toLocal);
    const isNear = localCorPts.some(pt => Math.hypot(pt[0], pt[1]) <= maxSearchRadiusM);
    if (isNear) {
      nearbyCorridors.push(localCorPts);
    }
  }

  // 3. Tính toán Bounding Box
  const allPoints: [number, number][] = [...localParcel];
  if (nearbyCenterline.length > 0) allPoints.push(...nearbyCenterline);
  for (const st of nearbyStations) allPoints.push(...st.pts);
  for (const cor of nearbyCorridors) allPoints.push(...cor);

  let minX = Math.min(...allPoints.map(p => p[0]));
  let maxX = Math.max(...allPoints.map(p => p[0]));
  let minY = Math.min(...allPoints.map(p => p[1]));
  let maxY = Math.max(...allPoints.map(p => p[1]));

  const padM = 12;
  minX -= padM;
  maxX += padM;
  minY -= padM;
  maxY += padM;

  const widthM = Math.max(maxX - minX, 20);
  const heightM = Math.max(maxY - minY, 20);

  const svgWidth = 420;
  const svgHeight = 280;
  const padPx = 25;

  const drawW = svgWidth - 2 * padPx;
  const drawH = svgHeight - 2 * padPx;

  const scale = Math.min(drawW / widthM, drawH / heightM);

  const cxPx = svgWidth / 2;
  const cyPx = svgHeight / 2;
  const midXM = (minX + maxX) / 2;
  const midYM = (minY + maxY) / 2;

  const toSvgX = (xM: number) => cxPx + (xM - midXM) * scale;
  const toSvgY = (yM: number) => cyPx - (yM - midYM) * scale;

  const parcelSvgPts = localParcel.map(p => `${toSvgX(p[0]).toFixed(1)},${toSvgY(p[1]).toFixed(1)}`).join(' ');

  let svgContent = '';

  // Nền lưới kỹ thuật ô vuông
  svgContent += `<rect width="${svgWidth}" height="${svgHeight}" fill="#f8fafc" stroke="#000000" stroke-width="1"/>`;
  svgContent += `<defs>
    <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
      <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#e2e8f0" stroke-width="0.75"/>
    </pattern>
  </defs>`;
  svgContent += `<rect width="${svgWidth}" height="${svgHeight}" fill="url(#grid)"/>`;

  // Ranh công trình ga
  for (const st of nearbyStations) {
    const pts = st.pts.map(p => `${toSvgX(p[0]).toFixed(1)},${toSvgY(p[1]).toFixed(1)}`).join(' ');
    svgContent += `<polygon points="${pts}" fill="rgba(226, 232, 240, 0.7)" stroke="#64748b" stroke-width="1.5" stroke-dasharray="4,2"/>`;
    if (st.pts.length > 0) {
      const avgX = st.pts.reduce((s, p) => s + p[0], 0) / st.pts.length;
      const avgY = st.pts.reduce((s, p) => s + p[1], 0) / st.pts.length;
      svgContent += `<text x="${toSvgX(avgX).toFixed(1)}" y="${toSvgY(avgY).toFixed(1)}" fill="#475569" font-size="9" font-family="'Latin Modern Roman', serif" font-weight="bold" text-anchor="middle">${st.name || 'Công trình Ga'}</text>`;
    }
  }

  // Ranh hành lang đào
  for (const cor of nearbyCorridors) {
    const pts = cor.map(p => `${toSvgX(p[0]).toFixed(1)},${toSvgY(p[1]).toFixed(1)}`).join(' ');
    svgContent += `<polyline points="${pts}" fill="none" stroke="#94a3b8" stroke-width="1" stroke-dasharray="3,3"/>`;
  }

  // Tim tuyến Metro 2
  if (nearbyCenterline.length > 1) {
    const pts = nearbyCenterline.map(p => `${toSvgX(p[0]).toFixed(1)},${toSvgY(p[1]).toFixed(1)}`).join(' ');
    svgContent += `<polyline points="${pts}" fill="none" stroke="#0284c7" stroke-width="2.5" stroke-dasharray="6,3"/>`;
    const midIdx = Math.floor(nearbyCenterline.length / 2);
    const midPt = nearbyCenterline[midIdx];
    svgContent += `<text x="${toSvgX(midPt[0]).toFixed(1)}" y="${(toSvgY(midPt[1]) - 6).toFixed(1)}" fill="#0284c7" font-size="8.5" font-family="'Latin Modern Roman', serif" font-weight="bold" text-anchor="middle">Tim tuyến Metro 2</text>`;
  }

  // Đa giác thửa đất khảo sát
  svgContent += `<polygon points="${parcelSvgPts}" fill="rgba(239, 68, 68, 0.25)" stroke="#dc2626" stroke-width="2.5"/>`;

  // Nhãn thửa đất
  const pAvgX = localParcel.reduce((s, p) => s + p[0], 0) / localParcel.length;
  const pAvgY = localParcel.reduce((s, p) => s + p[1], 0) / localParcel.length;
  svgContent += `<text x="${toSvgX(pAvgX).toFixed(1)}" y="${(toSvgY(pAvgY) + 3).toFixed(1)}" fill="#b91c1c" font-size="9.5" font-family="'Latin Modern Roman', serif" font-weight="bold" text-anchor="middle">${parcelCode || 'Thửa đất'}</text>`;

  // La bàn chỉ hướng Bắc (North Arrow) góc trên bên phải
  svgContent += `
    <g transform="translate(${svgWidth - 32}, 30)">
      <circle cx="0" cy="0" r="14" fill="#ffffff" stroke="#000000" stroke-width="1"/>
      <polygon points="0,-11 -4,-1 0,1 4,-1" fill="#000000"/>
      <polygon points="0,11 -4,1 0,-1 4,1" fill="#ffffff" stroke="#000000" stroke-width="0.5"/>
      <text x="0" y="-13" fill="#000000" font-size="9" font-family="'Latin Modern Roman', serif" font-weight="bold" text-anchor="middle">N</text>
    </g>
  `;

  // Thước tỷ lệ trắc địa (Scale bar) góc dưới bên trái
  const scaleBarM = widthM > 100 ? 50 : (widthM > 40 ? 20 : 10);
  const scaleBarPx = scaleBarM * scale;
  svgContent += `
    <g transform="translate(14, ${svgHeight - 16})">
      <rect x="0" y="-12" width="${scaleBarPx + 20}" height="18" fill="rgba(255,255,255,0.85)" stroke="#cbd5e1" stroke-width="0.5"/>
      <line x1="10" y1="0" x2="${10 + scaleBarPx}" y2="0" stroke="#000000" stroke-width="2"/>
      <line x1="10" y1="-3" x2="10" y2="3" stroke="#000000" stroke-width="1.5"/>
      <line x1="${10 + scaleBarPx}" y1="-3" x2="${10 + scaleBarPx}" y2="3" stroke="#000000" stroke-width="1.5"/>
      <text x="${10 + scaleBarPx / 2}" y="-4" fill="#000000" font-size="7.5" font-family="'Latin Modern Roman', serif" font-weight="bold" text-anchor="middle">${scaleBarM} m</text>
    </g>
  `;

  // Chú thích góc dưới bên phải (Legend)
  svgContent += `
    <g transform="translate(${svgWidth - 145}, ${svgHeight - 28})">
      <rect x="0" y="0" width="138" height="24" fill="rgba(255,255,255,0.9)" stroke="#cbd5e1" stroke-width="0.5"/>
      <rect x="6" y="5" width="10" height="6" fill="rgba(239, 68, 68, 0.3)" stroke="#dc2626" stroke-width="1.2"/>
      <text x="20" y="11" font-size="7" font-family="'Latin Modern Roman', serif" fill="#000000">Thửa đất khảo sát</text>
      <line x1="6" y1="18" x2="16" y2="18" stroke="#0284c7" stroke-width="1.8" stroke-dasharray="3,1.5"/>
      <text x="20" y="20" font-size="7" font-family="'Latin Modern Roman', serif" fill="#000000">Tim tuyến Metro 2</text>
    </g>
  `;

  const finalSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${svgWidth} ${svgHeight}" width="100%" height="100%">${svgContent}</svg>`;
  return `data:image/svg+xml;base64,${Buffer.from(finalSvg, 'utf8').toString('base64')}`;
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
  // LUÔN LUÔN ưu tiên đường bao ngoài màu trắng của công trình ga nếu có nhà ga trong khu vực (< 300m)
  // Tuyệt đối không lấy theo đường mép hố đào nét đứt màu xanh
  const hasStationFootprint = minStationDist < 300 && minStationDist < Infinity;
  if (hasStationFootprint) {
    outerBoundaryDist = minStationDist;
  } else {
    // Đoạn hầm thuần túy không có công trình ga: để null để báo cáo hiển thị 'Không có công trình ga trong zone'
    outerBoundaryDist = null;
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
