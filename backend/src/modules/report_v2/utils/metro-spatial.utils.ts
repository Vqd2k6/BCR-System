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
function getSatelliteCacheDir(): string {
  const candidates = [
    path.resolve(process.cwd(), 'data/cache/satellite_tiles'),
    path.resolve(process.cwd(), 'backend/data/cache/satellite_tiles'),
    path.resolve(__dirname, '../../../../data/cache/satellite_tiles'),
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  const defaultDir = path.resolve(process.cwd(), 'data/cache/satellite_tiles');
  try {
    fs.mkdirSync(defaultDir, { recursive: true });
  } catch (e) {}
  return defaultDir;
}

export function fetchSatelliteTileBase64Sync(z: number, y: number, x: number): string | null {
  const cacheDir = getSatelliteCacheDir();
  const cacheFile = path.join(cacheDir, `${z}_${y}_${x}.jpg`);
  if (fs.existsSync(cacheFile)) {
    try {
      const buf = fs.readFileSync(cacheFile);
      return `data:image/jpeg;base64,${buf.toString('base64')}`;
    } catch (e) {}
  }
  return null;
}

export async function fetchSatelliteTileBase64(z: number, y: number, x: number): Promise<string | null> {
  const cacheDir = getSatelliteCacheDir();
  const cacheFile = path.join(cacheDir, `${z}_${y}_${x}.jpg`);
  if (fs.existsSync(cacheFile)) {
    try {
      const buf = fs.readFileSync(cacheFile);
      return `data:image/jpeg;base64,${buf.toString('base64')}`;
    } catch (e) {}
  }

  const url = `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${z}/${y}/${x}`;
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000);
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);
    if (res.ok) {
      const arrayBuffer = await res.arrayBuffer();
      const buffer = Buffer.from(arrayBuffer);
      try {
        fs.writeFileSync(cacheFile, buffer);
      } catch (e) {}
      return `data:image/jpeg;base64,${buffer.toString('base64')}`;
    }
  } catch (e) {}
  return null;
}

export async function preloadSatelliteTiles(polygonCoords: [number, number][]): Promise<void> {
  if (!polygonCoords || polygonCoords.length === 0) return;
  const normalized = polygonCoords.map(p => (p[0] > p[1] ? [p[1], p[0]] : p) as [number, number]);
  const centerLat = normalized.reduce((s, p) => s + p[0], 0) / normalized.length;
  const centerLng = normalized.reduce((s, p) => s + p[1], 0) / normalized.length;

  const zoom = 18;
  const n = 2 ** zoom;
  const dLat = 0.0015;
  const dLng = 0.0015;

  const leftLng = centerLng - dLng;
  const rightLng = centerLng + dLng;
  const topLat = centerLat + dLat;
  const bottomLat = centerLat - dLat;

  const minTileX = Math.floor(((leftLng + 180) / 360) * n);
  const maxTileX = Math.floor(((rightLng + 180) / 360) * n);
  const minTileY = Math.floor((1 - Math.log(Math.tan((topLat * Math.PI) / 180) + 1 / Math.cos((topLat * Math.PI) / 180)) / Math.PI) / 2 * n);
  const maxTileY = Math.floor((1 - Math.log(Math.tan((bottomLat * Math.PI) / 180) + 1 / Math.cos((bottomLat * Math.PI) / 180)) / Math.PI) / 2 * n);

  const tasks: Promise<any>[] = [];
  for (let tx = minTileX; tx <= maxTileX; tx++) {
    for (let ty = minTileY; ty <= maxTileY; ty++) {
      tasks.push(fetchSatelliteTileBase64(zoom, ty, tx));
    }
  }
  await Promise.allSettled(tasks);
}

function escapeXml(unsafe: string): string {
  return String(unsafe || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Sinh sơ đồ không gian trang bìa khổ dọc 3:4 (Portrait Crop: 300x400)
 * Nền ảnh vệ tinh Esri World Imagery (LOD 18) có bộ nhớ đệm đĩa và graceful fallback.
 * Phong cách Pure Clean Map: loại bỏ toàn bộ đường dóng, ô badge cự ly, nhãn mã công trình và chú thích thừa.
 */
export function generateMetroSpatialVisualSvg(
  polygonCoords: [number, number][] | null,
  parcelCode: string = 'Thửa đất',
  boundaryDataInput?: any
): string {
  const boundaryData = boundaryDataInput || getMetroBoundaryData();
  if (!polygonCoords || polygonCoords.length < 3) {
    return '';
  }

  // Chuẩn hóa tọa độ [lat, lng]
  const normalizedCoords = polygonCoords.map(p => (p[0] > p[1] ? [p[1], p[0]] : p) as [number, number]);
  const centerline: [number, number][] = boundaryData?.centerline || [];
  const stations: Array<{ name: string; coords: [number, number][] }> = boundaryData?.stationDetailedFootprints || [];
  const corridorBoundaries: Array<{ name: string; coords: [number, number][] }> = boundaryData?.corridorBoundaries || [];

  // Điểm dóng tim tuyến và ga gần nhất
  let minCenterDist = Infinity;
  let bestCenterProj: [number, number] = [0, 0];
  for (const v of normalizedCoords) {
    for (let i = 0; i < centerline.length - 1; i++) {
      const d = pointToSegmentDistance(v, centerline[i], centerline[i + 1]);
      if (d.distance < minCenterDist) {
        minCenterDist = d.distance;
        bestCenterProj = d.projection;
      }
    }
  }

  let minStDist = Infinity;
  let bestStProj: [number, number] = [0, 0];
  for (const st of stations) {
    for (const v of normalizedCoords) {
      for (let j = 0; j < st.coords.length; j++) {
        const p1 = st.coords[j];
        const p2 = st.coords[(j + 1) % st.coords.length];
        const d = pointToSegmentDistance(v, p1, p2);
        if (d.distance < minStDist) {
          minStDist = d.distance;
          bestStProj = d.projection;
        }
      }
    }
  }

  // Hệ quy chiếu cục bộ [x, y] (đơn vị mét) quanh tâm thửa đất
  const parcelCenterLat = normalizedCoords.reduce((s, p) => s + p[0], 0) / normalizedCoords.length;
  const parcelCenterLng = normalizedCoords.reduce((s, p) => s + p[1], 0) / normalizedCoords.length;
  const cosLat = Math.cos((parcelCenterLat * Math.PI) / 180);
  const mPerDegLat = 111320;
  const mPerDegLng = 111320 * cosLat;
  const toLocal = (p: [number, number]): [number, number] => [
    (p[1] - parcelCenterLng) * mPerDegLng,
    (p[0] - parcelCenterLat) * mPerDegLat,
  ];

  const localParcel = normalizedCoords.map(toLocal);
  const localCenterProj = toLocal(bestCenterProj);
  const hasStation = minStDist < 250 && minStDist < Infinity;
  const localStProj = toLocal(bestStProj);

  // Focal Bounding Box
  const focusPts: [number, number][] = [...localParcel];
  if (minCenterDist < 1000 && minCenterDist < Infinity) {
    focusPts.push(localCenterProj);
  }
  if (hasStation) {
    focusPts.push(localStProj);
  }

  const fMinX = Math.min(...focusPts.map((p) => p[0]));
  const fMaxX = Math.max(...focusPts.map((p) => p[0]));
  const fMinY = Math.min(...focusPts.map((p) => p[1]));
  const fMaxY = Math.max(...focusPts.map((p) => p[1]));

  const midX = (fMinX + fMaxX) / 2;
  const midY = (fMinY + fMaxY) / 2;
  const spanX = fMaxX - fMinX;
  const spanY = fMaxY - fMinY;

  // Khổ dọc 3:4 (SVG width: 300, height: 400)
  const svgWidth = 300;
  const svgHeight = 400;
  const aspectRatio = svgWidth / svgHeight; // 0.75

  const padM = 40;
  const minSpanW = 110;
  const minSpanH = 146;

  let viewW = Math.max(spanX + 2 * padM, minSpanW);
  let viewH = Math.max(spanY + 2 * padM, minSpanH);

  if (viewW / viewH < aspectRatio) {
    viewW = viewH * aspectRatio;
  } else {
    viewH = viewW / aspectRatio;
  }

  const padPx = 15;
  const drawW = svgWidth - 2 * padPx;
  const drawH = svgHeight - 2 * padPx;
  const scale = Math.min(drawW / viewW, drawH / viewH);

  const cxPx = svgWidth / 2;
  const cyPx = svgHeight / 2;

  const toSvgX = (xM: number) => cxPx + (xM - midX) * scale;
  const toSvgY = (yM: number) => cyPx - (yM - midY) * scale;

  // Mảnh ảnh vệ tinh (XYZ Tiles) ở zoom 18
  const zoom = 18;
  const n = 2 ** zoom;

  const leftLng = parcelCenterLng + ((0 - cxPx) / scale + midX) / mPerDegLng;
  const rightLng = parcelCenterLng + ((svgWidth - cxPx) / scale + midX) / mPerDegLng;
  const topLat = parcelCenterLat + ((cyPx - 0) / scale + midY) / mPerDegLat;
  const bottomLat = parcelCenterLat + ((cyPx - svgHeight) / scale + midY) / mPerDegLat;

  const minTileX = Math.floor(((leftLng + 180) / 360) * n);
  const maxTileX = Math.floor(((rightLng + 180) / 360) * n);
  const minTileY = Math.floor((1 - Math.log(Math.tan((topLat * Math.PI) / 180) + 1 / Math.cos((topLat * Math.PI) / 180)) / Math.PI) / 2 * n);
  const maxTileY = Math.floor((1 - Math.log(Math.tan((bottomLat * Math.PI) / 180) + 1 / Math.cos((bottomLat * Math.PI) / 180)) / Math.PI) / 2 * n);

  let tilesSvg = '';
  const tileCountX = Math.abs(maxTileX - minTileX) + 1;
  const tileCountY = Math.abs(maxTileY - minTileY) + 1;
  if (tileCountX <= 10 && tileCountY <= 10) {
    for (let tx = Math.min(minTileX, maxTileX); tx <= Math.max(minTileX, maxTileX); tx++) {
      for (let ty = Math.min(minTileY, maxTileY); ty <= Math.max(minTileY, maxTileY); ty++) {
      const tileBase64 = fetchSatelliteTileBase64Sync(zoom, ty, tx);
      if (!tileBase64) continue;

      const tileLng = (tx / n) * 360 - 180;
      const tileLatRad = Math.atan(Math.sinh(Math.PI * (1 - (2 * ty) / n)));
      const tileLat = (tileLatRad * 180) / Math.PI;

      const nextTileLng = ((tx + 1) / n) * 360 - 180;
      const nextTileLatRad = Math.atan(Math.sinh(Math.PI * (1 - (2 * (ty + 1)) / n)));
      const nextTileLat = (nextTileLatRad * 180) / Math.PI;

      const locTopLeft = toLocal([tileLat, tileLng]);
      const locBottomRight = toLocal([nextTileLat, nextTileLng]);

      const xPx = toSvgX(locTopLeft[0]);
      const yPx = toSvgY(locTopLeft[1]);
      const wPx = toSvgX(locBottomRight[0]) - xPx;
      const hPx = toSvgY(locBottomRight[1]) - yPx;

      tilesSvg += `<image href="${tileBase64}" x="${xPx.toFixed(1)}" y="${yPx.toFixed(1)}" width="${wPx.toFixed(1)}" height="${hPx.toFixed(1)}" preserveAspectRatio="none"/>`;
      }
    }
  }

  let svgContent = '';
  // Nền sáng chuẩn báo cáo A4
  svgContent += `<rect width="${svgWidth}" height="${svgHeight}" fill="#f8fafc"/>`;

  if (tilesSvg) {
    svgContent += `<g id="satellite-tiles">${tilesSvg}</g>`;
    svgContent += `<rect width="${svgWidth}" height="${svgHeight}" fill="rgba(0,0,0,0.12)"/>`;
  }

  // Khung viền ngoài
  svgContent += `<rect width="${svgWidth}" height="${svgHeight}" fill="none" stroke="#000000" stroke-width="1"/>`;

  const viewRadiusM = Math.hypot(viewW, viewH) / 2 + 50;
  const isNearView = (loc: [number, number]) => Math.hypot(loc[0] - midX, loc[1] - midY) <= viewRadiusM;

  // 1. Ranh công trình ga (Màu vàng/trắng nét đứt)
  for (const st of stations) {
    const locs = st.coords.map(toLocal);
    if (locs.some(isNearView)) {
      const ptsStr = locs.map((p) => `${toSvgX(p[0]).toFixed(1)},${toSvgY(p[1]).toFixed(1)}`).join(' ');
      svgContent += `<polygon points="${ptsStr}" fill="rgba(255, 255, 255, 0.15)" stroke="#fef08a" stroke-width="2" stroke-dasharray="5,3"/>`;
    }
  }

  // 2. Ranh hành lang đào (Corridor)
  for (const cor of corridorBoundaries) {
    const locs = cor.coords.map(toLocal);
    if (locs.some(isNearView)) {
      const ptsStr = locs.map((p) => `${toSvgX(p[0]).toFixed(1)},${toSvgY(p[1]).toFixed(1)}`).join(' ');
      svgContent += `<polyline points="${ptsStr}" fill="none" stroke="#38bdf8" stroke-width="1.5" stroke-dasharray="4,3"/>`;
    }
  }

  // 3. Tim tuyến Metro 2 (Đỏ đậm nổi bật)
  const localCenterline = centerline.map(toLocal);
  const nearCenterline = localCenterline.filter(isNearView);
  if (nearCenterline.length > 1) {
    const ptsStr = localCenterline.map((p) => `${toSvgX(p[0]).toFixed(1)},${toSvgY(p[1]).toFixed(1)}`).join(' ');
    // Buffer ribbon đỏ nhạt
    svgContent += `<polyline points="${ptsStr}" fill="none" stroke="rgba(239, 68, 68, 0.28)" stroke-width="18" stroke-linecap="round"/>`;
    // Tim tuyến đỏ nét liền đậm
    svgContent += `<polyline points="${ptsStr}" fill="none" stroke="#ef4444" stroke-width="3"/>`;
  }

  // 4. Đa giác Thửa đất nhà dân (Viền Đỏ đậm, viền kép phát sáng trắng)
  const parcelPtsStr = localParcel.map((p) => `${toSvgX(p[0]).toFixed(1)},${toSvgY(p[1]).toFixed(1)}`).join(' ');
  svgContent += `<polygon points="${parcelPtsStr}" fill="none" stroke="#ffffff" stroke-width="4.5" stroke-linejoin="round"/>`;
  svgContent += `<polygon points="${parcelPtsStr}" fill="rgba(239, 68, 68, 0.45)" stroke="#dc2626" stroke-width="2.5" stroke-linejoin="round"/>`;

  // 5. La bàn chỉ hướng Bắc (N) góc trên bên phải
  svgContent += `
    <g transform="translate(${svgWidth - 24}, 24)">
      <circle cx="0" cy="0" r="12" fill="rgba(255,255,255,0.92)" stroke="#000000" stroke-width="0.8"/>
      <polygon points="0,-9 -3,-1 0,1 3,-1" fill="#dc2626"/>
      <polygon points="0,9 -3,1 0,-1 3,1" fill="#ffffff" stroke="#000000" stroke-width="0.5"/>
      <text x="0" y="-11" fill="#000000" font-size="8" font-family="'Latin Modern Roman', serif" font-weight="bold" text-anchor="middle">N</text>
    </g>
  `;

  const finalSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${svgWidth} ${svgHeight}" width="${svgWidth}" height="${svgHeight}" data-parcel="${escapeXml(parcelCode)}">${svgContent}</svg>`;
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
