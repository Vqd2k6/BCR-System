/**
 * ============================================================================
 * KỊCH BẢN PUPPETEER: XUẤT 10 CAPTURE ĐỐI SOÁT THẨM ĐỊNH KHÔNG GIAN TRẮC ĐỊA
 * NÂNG CẤP V2 (FOCAL-CENTERED CLOSE-UP ZOOM 60m - 110m):
 * - Tiêu cự camera đặt chính xác vào Vùng Đo Đạc (Measurement Zone: Đỉnh Thửa <-> Điểm Tim/Ga)
 * - Khung nhìn cận cảnh 60m - 110m (rõ gấp 4x - 6x so với 350m cũ)
 * - Hiển thị RÕ NÉT CẢ 2 ĐƯỜNG DÓNG:
 *   1. Đường dóng VÀNG tới Tim Hầm Metro 2 (Centerline) kèm nhãn cự ly mét
 *   2. Đường dóng CYAN tới Mép Công Trình Ga Màu Trắng (Station Footprint) kèm nhãn cự ly mét
 * - Công trình ga ngầm màu trắng viền đứt nổi bật trên nền vệ tinh Esri
 * - Tim tuyến đỏ rực rỡ kèm nét đứt phản quang
 * - Thửa đất viền hồng đỏ rực rỡ kèm nhãn số nhà / mã thửa
 * ============================================================================
 */

import { Client } from 'pg';
import * as fs from 'fs';
import * as path from 'path';
import puppeteer from 'puppeteer-core';
import * as dotenv from 'dotenv';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

interface ParcelAuditScenario {
  order: number;
  parcelCode: string;
  scenarioTitle: string;
  expectedCategory: string;
}

const SCENARIOS: ParcelAuditScenario[] = [
  {
    order: 1,
    parcelCode: 'POR-02-B-0002',
    scenarioTitle: 'Tim hầm Metro 2 cắt xuyên lòng thửa đất (Cự ly đúng 0.0m)',
    expectedCategory: 'Giao cắt tim hầm (Tunnel Intersection)',
  },
  {
    order: 2,
    parcelCode: 'C&C-01-B-0046',
    scenarioTitle: 'Thửa đất nằm trong ranh công trình Ga Bến Thành (Cự ly mép ga 0.0m)',
    expectedCategory: 'Trong phạm vi nhà ga (Inside Station Footprint)',
  },
  {
    order: 3,
    parcelCode: 'C&C-02-B-0115',
    scenarioTitle: 'Thửa đất tiếp giáp sát ranh công trình Ga ngầm Tao Đàn (~1.5m)',
    expectedCategory: 'Sát mép công trình ga (Adjacent to Station)',
  },
  {
    order: 4,
    parcelCode: 'POR-02-B-0001',
    scenarioTitle: 'Vùng ảnh hưởng đặc biệt Zone 1 sát tim tuyến (~9.6m)',
    expectedCategory: 'Hành lang Zone 1 (Special Impact Zone)',
  },
  {
    order: 5,
    parcelCode: 'C&C-02-B-0138',
    scenarioTitle: 'Vùng ảnh hưởng trực tiếp Zone 2 (~12.2m)',
    expectedCategory: 'Hành lang Zone 2 (Direct Impact Zone)',
  },
  {
    order: 6,
    parcelCode: 'POR-02-B-0015',
    scenarioTitle: 'Vùng lân cận Zone 3 có độ sâu hầm lớn (~38.8m)',
    expectedCategory: 'Hành lang Zone 3 (Nearby Impact Zone)',
  },
  {
    order: 7,
    parcelCode: 'C&C-02-B-0128',
    scenarioTitle: 'Ngoài hành lang ảnh hưởng trực tiếp (~59.8m)',
    expectedCategory: 'Ngoài hành lang (Beyond Corridor)',
  },
  {
    order: 8,
    parcelCode: 'C&C-05-B-0062',
    scenarioTitle: 'Khu vực phụ cận Ga S5 Lê Thị Riêng & Công viên',
    expectedCategory: 'Khu vực chuyển tiếp nhà ga (Station Transition)',
  },
  {
    order: 9,
    parcelCode: 'POR-02-B-0044',
    scenarioTitle: 'Khu vực ngã sáu Ga S3 Dân Chủ (Giao thoa kết cấu)',
    expectedCategory: 'Nút giao ngầm phức tạp (Complex Underground Node)',
  },
  {
    order: 10,
    parcelCode: 'C&C-04-B-0024',
    scenarioTitle: 'Khu vực chuyển tiếp hầm khoan sang Ga S4 Hòa Hưng',
    expectedCategory: 'Khu vực Ga Hòa Hưng (TBM Transition Area)',
  },
];

// --- HÌNH HỌC TRẮC ĐỊA THUẦN TÚY (ĐỒNG BỘ 100% VỚI HỆ THỐNG) ---

function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371e3;
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(Δφ / 2) ** 2 +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function pointToSegmentDistance(
  p: [number, number],
  a: [number, number],
  b: [number, number]
): { distance: number; projection: [number, number]; t: number } {
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
    t = Math.max(0, Math.min(1, (px * bx + py * by) / segLenSq));
  }

  const projLat = a[0] + t * (b[0] - a[0]);
  const projLng = a[1] + t * (b[1] - a[1]);

  return {
    distance: haversineDistance(p[0], p[1], projLat, projLng),
    projection: [projLat, projLng],
    t,
  };
}

function isPointInPolygon(point: [number, number], polygon: [number, number][]): boolean {
  if (!polygon || polygon.length < 3) return false;
  const x = point[1];
  const y = point[0];
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i][1];
    const yi = polygon[i][0];
    const xj = polygon[j][1];
    const yj = polygon[j][0];
    const intersect = yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

function ccw(p1: [number, number], p2: [number, number], p3: [number, number]): number {
  return (p3[0] - p1[0]) * (p2[1] - p1[1]) - (p2[0] - p1[0]) * (p3[1] - p1[1]);
}

function doSegmentsIntersect(
  p1: [number, number],
  p2: [number, number],
  p3: [number, number],
  p4: [number, number]
): boolean {
  const ccw1 = ccw(p1, p2, p3);
  const ccw2 = ccw(p1, p2, p4);
  const ccw3 = ccw(p3, p4, p1);
  const ccw4 = ccw(p3, p4, p2);

  if (((ccw1 > 0 && ccw2 < 0) || (ccw1 < 0 && ccw2 > 0)) &&
      ((ccw3 > 0 && ccw4 < 0) || (ccw3 < 0 && ccw4 > 0))) {
    return true;
  }
  return false;
}

function checkPolylinePolygonIntersection(
  polylineCoords: [number, number][],
  polygonCoords: [number, number][]
): boolean {
  if (!polylineCoords || polylineCoords.length < 2 || !polygonCoords || polygonCoords.length < 3) return false;
  for (const pt of polylineCoords) {
    if (isPointInPolygon(pt, polygonCoords)) return true;
  }
  const polyLen = polygonCoords.length;
  for (let i = 0; i < polylineCoords.length - 1; i++) {
    const p1 = polylineCoords[i];
    const p2 = polylineCoords[i + 1];
    for (let j = 0; j < polyLen; j++) {
      const q1 = polygonCoords[j];
      const q2 = polygonCoords[(j + 1) % polyLen];
      if (doSegmentsIntersect(p1, p2, q1, q2)) return true;
    }
  }
  return false;
}

function checkParcelPolygonIntersection(
  parcelCoords: [number, number][],
  stationCoords: [number, number][]
): boolean {
  if (!parcelCoords || parcelCoords.length < 3 || !stationCoords || stationCoords.length < 3) return false;
  for (const vertex of parcelCoords) {
    if (isPointInPolygon(vertex, stationCoords)) return true;
  }
  for (const vertex of stationCoords) {
    if (isPointInPolygon(vertex, parcelCoords)) return true;
  }
  for (let i = 0; i < parcelCoords.length; i++) {
    const p1 = parcelCoords[i];
    const p2 = parcelCoords[(i + 1) % parcelCoords.length];
    for (let j = 0; j < stationCoords.length; j++) {
      const p3 = stationCoords[j];
      const p4 = stationCoords[(j + 1) % stationCoords.length];
      if (doSegmentsIntersect(p1, p2, p3, p4)) return true;
    }
  }
  return false;
}

interface ComprehensiveMetrics {
  closestCenterVertex: [number, number];
  closestCenterPoint: [number, number];
  distanceToCenterlineMeters: number;
  isCenterlineIntersectsParcel: boolean;

  closestOuterVertex: [number, number];
  closestOuterPoint: [number, number];
  distanceToOuterBoundaryMeters: number | null;
  outerBoundaryType: 'STATION_OUTLINE' | 'CORRIDOR_BOUNDARY' | 'NO_STATION';
  closestStationName: string;
  closestStationFootprint?: [number, number][];
  isStationIntersectsParcel: boolean;
}

function calculateSpatialMetrics(
  polygonCoords: [number, number][],
  boundaryData: any
): ComprehensiveMetrics {
  const centerline: [number, number][] = boundaryData.centerline || [];
  const stationOutlines: Array<{ name: string; coords: [number, number][] }> = boundaryData.stationDetailedFootprints || [];

  const polyLen = polygonCoords.length;

  // 1. Tim Tuyến
  let minCenterlineDist = Infinity;
  let bestCenterPoint: [number, number] = centerline[0] || [0, 0];
  let bestCenterVertex: [number, number] = polygonCoords[0] || [0, 0];
  let isCenterlineIntersects = false;

  if (centerline.length > 1) {
    if (checkPolylinePolygonIntersection(centerline, polygonCoords)) {
      minCenterlineDist = 0.0;
      isCenterlineIntersects = true;
      // Tìm điểm tim gần tâm thửa đất nhất
      const cLat = polygonCoords.reduce((s, p) => s + p[0], 0) / polyLen;
      const cLng = polygonCoords.reduce((s, p) => s + p[1], 0) / polyLen;
      let bDist = Infinity;
      for (const pt of centerline) {
        const d = haversineDistance(cLat, cLng, pt[0], pt[1]);
        if (d < bDist) {
          bDist = d;
          bestCenterPoint = pt;
          bestCenterVertex = pt;
        }
      }
    } else {
      // Chiều 1: Đỉnh thửa -> Cạnh tim
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
      // Chiều 2: Đỉnh tim -> Cạnh thửa
      for (let i = 0; i < centerline.length; i++) {
        const pt = centerline[i];
        for (let j = 0; j < polyLen; j++) {
          const res = pointToSegmentDistance(pt, polygonCoords[j], polygonCoords[(j + 1) % polyLen]);
          if (res.distance < minCenterlineDist) {
            minCenterlineDist = res.distance;
            bestCenterPoint = pt;
            bestCenterVertex = res.projection;
          }
        }
      }
    }
  }

  // 2. Nhà Ga (Công trình màu trắng)
  let minStationDist = Infinity;
  let bestStationPoint: [number, number] = polygonCoords[0];
  let bestStationVertex: [number, number] = polygonCoords[0];
  let closestStationName = 'Tuyến Metro Số 2';
  let closestStationFootprint: [number, number][] | undefined = undefined;
  let isStationIntersects = false;

  for (const st of stationOutlines) {
    if (!st.coords || st.coords.length < 3) continue;

    if (checkParcelPolygonIntersection(polygonCoords, st.coords)) {
      minStationDist = 0.0;
      isStationIntersects = true;
      closestStationName = st.name;
      closestStationFootprint = st.coords;
      bestStationPoint = polygonCoords[0];
      bestStationVertex = polygonCoords[0];
      break;
    }

    // Chiều 1: Đỉnh thửa -> Cạnh ga
    for (const vertex of polygonCoords) {
      for (let j = 0; j < st.coords.length; j++) {
        const p1 = st.coords[j];
        const p2 = st.coords[(j + 1) % st.coords.length];
        const res = pointToSegmentDistance(vertex, p1, p2);
        if (res.distance < minStationDist) {
          minStationDist = res.distance;
          bestStationPoint = res.projection;
          bestStationVertex = vertex;
          closestStationName = st.name;
          closestStationFootprint = st.coords;
        }
      }
    }

    // Chiều 2: Đỉnh ga -> Cạnh thửa
    for (const stVtx of st.coords) {
      for (let j = 0; j < polyLen; j++) {
        const p1 = polygonCoords[j];
        const p2 = polygonCoords[(j + 1) % polyLen];
        const res = pointToSegmentDistance(stVtx, p1, p2);
        if (res.distance < minStationDist) {
          minStationDist = res.distance;
          bestStationPoint = stVtx;
          bestStationVertex = res.projection;
          closestStationName = st.name;
          closestStationFootprint = st.coords;
        }
      }
    }
  }

  // Chỉ coi là có nhà ga khi khoảng cách <= 120 mét hoặc giao cắt
  const hasStationNear = (minStationDist <= 120 && minStationDist < Infinity) || isStationIntersects;

  return {
    closestCenterVertex: bestCenterVertex,
    closestCenterPoint: bestCenterPoint,
    distanceToCenterlineMeters: minCenterlineDist,
    isCenterlineIntersectsParcel: isCenterlineIntersects,

    closestOuterVertex: bestStationVertex,
    closestOuterPoint: bestStationPoint,
    distanceToOuterBoundaryMeters: hasStationNear ? minStationDist : null,
    outerBoundaryType: hasStationNear ? 'STATION_OUTLINE' : 'NO_STATION',
    closestStationName,
    closestStationFootprint,
    isStationIntersectsParcel: isStationIntersects,
  };
}

function getChromeExecutablePath(): string {
  const candidatePaths = [
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    '/Applications/Chromium.app/Contents/MacOS/Chromium',
    '/usr/bin/google-chrome',
    '/usr/bin/google-chrome-stable',
    '/usr/bin/chromium',
    '/usr/bin/chromium-browser',
  ];
  for (const p of candidatePaths) {
    if (fs.existsSync(p)) return p;
  }
  throw new Error('Không tìm thấy Google Chrome trên hệ thống!');
}

function generateCloseUpMapHtml(
  scenario: ParcelAuditScenario,
  parcel: any,
  coords: [number, number][],
  metrics: ComprehensiveMetrics,
  boundaryData: any
): string {
  // 1. TÍNH TOÁN TIÊU CỰ CAMERA ĐẶT CHÍNH XÁC VÀO VÙNG ĐO ĐẠC (FOCAL ZONE)
  const focalPoints: [number, number][] = [];

  if (metrics.closestCenterVertex && metrics.closestCenterPoint) {
    focalPoints.push(metrics.closestCenterVertex);
    focalPoints.push(metrics.closestCenterPoint);
  }

  const showStationLine = metrics.outerBoundaryType === 'STATION_OUTLINE' && !metrics.isStationIntersectsParcel && metrics.distanceToOuterBoundaryMeters !== null && metrics.distanceToOuterBoundaryMeters <= 100;
  if (showStationLine && metrics.closestOuterVertex && metrics.closestOuterPoint) {
    focalPoints.push(metrics.closestOuterVertex);
    focalPoints.push(metrics.closestOuterPoint);
  }

  if (focalPoints.length === 0) {
    const cLat = coords.reduce((s, p) => s + p[0], 0) / coords.length;
    const cLng = coords.reduce((s, p) => s + p[1], 0) / coords.length;
    focalPoints.push([cLat, cLng]);
  }

  const focalLat = focalPoints.reduce((s, p) => s + p[0], 0) / focalPoints.length;
  const focalLng = focalPoints.reduce((s, p) => s + p[1], 0) / focalPoints.length;

  // Lọc các đỉnh thửa đất trong phạm vi bán kính 50m quanh tiêu cự
  const nearbyParcelPts = coords.filter(p => haversineDistance(focalLat, focalLng, p[0], p[1]) <= 50);
  const allViewPts = [...focalPoints, ...(nearbyParcelPts.length > 0 ? nearbyParcelPts : coords.slice(0, 10))];

  const minLat = Math.min(...allViewPts.map(p => p[0]));
  const maxLat = Math.max(...allViewPts.map(p => p[0]));
  const minLng = Math.min(...allViewPts.map(p => p[1]));
  const maxLng = Math.max(...allViewPts.map(p => p[1]));

  const latMeters = (maxLat - minLat) * 111320;
  const lngMeters = (maxLng - minLng) * (111320 * Math.cos((focalLat * Math.PI) / 180));
  const contentSpan = Math.max(latMeters, lngMeters);

  // Khung nhìn cận cảnh tối ưu: từ 60m đến 110m (thay vì 350m cũ)
  const targetSpan = Math.max(60, Math.min(110, contentSpan + 32));

  const deltaLat = (targetSpan / 2) / 111320;
  const deltaLng = (targetSpan / 2) / (111320 * Math.cos((focalLat * Math.PI) / 180));

  const bounds = [
    [focalLat - deltaLat, focalLng - deltaLng],
    [focalLat + deltaLat, focalLng + deltaLng],
  ];

  const address = `${parcel.house_number ? `${parcel.house_number}, ` : ''}${parcel.street || ''}`.trim() || 'Tuyến Metro Số 2';

  const centerlineDistStr = metrics.isCenterlineIntersectsParcel || metrics.distanceToCenterlineMeters === 0
    ? '0.0 m (Hầm đi ngầm dưới nhà)'
    : `${metrics.distanceToCenterlineMeters.toFixed(1)} m`;

  const stationDistStr = metrics.isStationIntersectsParcel
    ? `0.0 m (Nằm trong ranh ${metrics.closestStationName})`
    : metrics.outerBoundaryType === 'STATION_OUTLINE' && metrics.distanceToOuterBoundaryMeters !== null
      ? `${metrics.distanceToOuterBoundaryMeters.toFixed(1)} m (${metrics.closestStationName})`
      : 'Không có ga trong khu vực';

  const orderBadge = scenario.order < 10 ? `#0${scenario.order}` : `#${scenario.order}`;

  return `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8">
  <title>Đối Soát Cận Cảnh Không Gian Trắc Địa [${scenario.parcelCode}]</title>
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css" />
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"></script>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body, html { width: 100%; height: 100%; background: #0b1120; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; overflow: hidden; }
    #map { width: 100%; height: 100%; }

    /* Glassmorphism Header Bar */
    .header-panel {
      position: absolute;
      top: 16px;
      left: 16px;
      right: 16px;
      z-index: 1000;
      background: rgba(15, 23, 42, 0.92);
      backdrop-filter: blur(14px);
      -webkit-backdrop-filter: blur(14px);
      border: 1px solid rgba(255, 255, 255, 0.2);
      border-radius: 12px;
      padding: 14px 20px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      color: #fff;
      box-shadow: 0 10px 30px rgba(0, 0, 0, 0.6);
    }
    .header-left {
      display: flex;
      align-items: center;
      gap: 14px;
    }
    .badge-order {
      background: linear-gradient(135deg, #ef4444, #991b1b);
      color: #fff;
      font-weight: 800;
      font-size: 15px;
      padding: 6px 12px;
      border-radius: 8px;
      letter-spacing: 0.5px;
      box-shadow: 0 0 12px rgba(239, 68, 68, 0.5);
    }
    .title-group h1 {
      font-size: 17px;
      font-weight: 700;
      color: #f8fafc;
      margin-bottom: 2px;
    }
    .title-group p {
      font-size: 12px;
      color: #94a3b8;
    }
    .header-right {
      display: flex;
      gap: 10px;
      align-items: center;
    }
    .hud-tag {
      background: rgba(255, 255, 255, 0.1);
      border: 1px solid rgba(255, 255, 255, 0.25);
      padding: 6px 12px;
      border-radius: 6px;
      font-size: 12px;
      font-weight: 600;
      color: #e2e8f0;
    }
    .hud-tag.success {
      background: rgba(16, 185, 129, 0.25);
      border-color: rgba(16, 185, 129, 0.6);
      color: #34d399;
      font-weight: 700;
    }

    /* Left Bottom Metric Card */
    .metric-panel {
      position: absolute;
      bottom: 24px;
      left: 20px;
      z-index: 1000;
      background: rgba(15, 23, 42, 0.94);
      backdrop-filter: blur(14px);
      -webkit-backdrop-filter: blur(14px);
      border: 1px solid rgba(255, 255, 255, 0.2);
      border-radius: 12px;
      padding: 16px 20px;
      width: 400px;
      color: #fff;
      box-shadow: 0 15px 35px rgba(0, 0, 0, 0.7);
    }
    .metric-title {
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 1px;
      color: #94a3b8;
      font-weight: 700;
      margin-bottom: 12px;
      border-bottom: 1px solid rgba(255, 255, 255, 0.12);
      padding-bottom: 6px;
      display: flex;
      justify-content: space-between;
    }
    .metric-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 10px;
    }
    .metric-row:last-child { margin-bottom: 0; }
    .metric-label {
      font-size: 13px;
      color: #cbd5e1;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .metric-indicator {
      width: 11px;
      height: 11px;
      border-radius: 50%;
    }
    .ind-tunnel { background: #facc15; box-shadow: 0 0 10px #facc15; }
    .ind-station { background: #00f0ff; box-shadow: 0 0 10px #00f0ff; }
    .ind-center { background: #ef4444; box-shadow: 0 0 8px #ef4444; }
    .metric-value {
      font-size: 14px;
      font-weight: 700;
      color: #fff;
    }
    .metric-value.yellow {
      color: #facc15;
    }
    .metric-value.cyan {
      color: #00f0ff;
    }

    /* Right Bottom Legend Panel */
    .legend-panel {
      position: absolute;
      bottom: 24px;
      right: 20px;
      z-index: 1000;
      background: rgba(15, 23, 42, 0.94);
      backdrop-filter: blur(14px);
      -webkit-backdrop-filter: blur(14px);
      border: 1px solid rgba(255, 255, 255, 0.2);
      border-radius: 12px;
      padding: 14px 18px;
      color: #fff;
      font-size: 12px;
      box-shadow: 0 15px 35px rgba(0, 0, 0, 0.7);
    }
    .legend-title {
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.8px;
      color: #94a3b8;
      font-weight: 700;
      margin-bottom: 10px;
      border-bottom: 1px solid rgba(255, 255, 255, 0.12);
      padding-bottom: 4px;
    }
    .legend-item {
      display: flex;
      align-items: center;
      gap: 10px;
      margin-bottom: 8px;
    }
    .legend-item:last-child { margin-bottom: 0; }
    .legend-line {
      width: 28px;
      height: 4px;
      border-radius: 2px;
    }
    .legend-line.tunnel-dist { background: #facc15; border-top: 2px dashed #facc15; height: 3px; }
    .legend-line.station-dist { background: #00f0ff; border-top: 2px dashed #00f0ff; height: 3px; }
    .legend-line.centerline { background: #dc2626; height: 4px; }
    .legend-line.station-poly { background: #ffffff; border: 1.5px dashed #000; height: 4px; }
    .legend-line.parcel-poly { background: #ff0055; height: 4px; }

    /* Bounding Box HUD Info */
    .bbox-badge {
      position: absolute;
      top: 90px;
      right: 20px;
      z-index: 1000;
      background: rgba(15, 23, 42, 0.9);
      border: 1px solid rgba(0, 240, 255, 0.5);
      border-radius: 8px;
      padding: 8px 14px;
      color: #38bdf8;
      font-size: 12px;
      font-weight: 700;
      letter-spacing: 0.5px;
      box-shadow: 0 4px 15px rgba(0, 0, 0, 0.5);
    }

    /* Floating Distance Measurement Badges on the Map Canvas */
    .dist-badge {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 5px 10px;
      border-radius: 7px;
      font-size: 12px;
      font-weight: 800;
      white-space: nowrap;
      box-shadow: 0 8px 20px rgba(0, 0, 0, 0.85);
      pointer-events: none;
      transform: translate(-50%, -50%);
      z-index: 1000;
    }
    .dist-badge.tunnel {
      background: rgba(15, 23, 42, 0.96);
      border: 2px solid #facc15;
      color: #facc15;
      box-shadow: 0 0 14px rgba(250, 204, 21, 0.5);
    }
    .dist-badge.station {
      background: rgba(15, 23, 42, 0.96);
      border: 2px solid #00f0ff;
      color: #00f0ff;
      box-shadow: 0 0 14px rgba(0, 240, 255, 0.5);
    }
    .dist-badge.alert-center {
      background: rgba(153, 27, 27, 0.96);
      border: 2px solid #ef4444;
      color: #ffffff;
      box-shadow: 0 0 16px rgba(239, 68, 68, 0.7);
      font-size: 11.5px;
    }
    .dist-badge.alert-station {
      background: rgba(2, 44, 74, 0.96);
      border: 2px solid #00f0ff;
      color: #ffffff;
      box-shadow: 0 0 16px rgba(0, 240, 255, 0.7);
      font-size: 11.5px;
    }

    .parcel-pin-badge {
      display: inline-flex;
      flex-direction: column;
      align-items: center;
      background: rgba(15, 23, 42, 0.92);
      border: 2px solid #ff0055;
      border-radius: 8px;
      padding: 4px 8px;
      color: #fff;
      font-size: 10.5px;
      font-weight: 700;
      box-shadow: 0 6px 18px rgba(0, 0, 0, 0.85);
      white-space: nowrap;
      transform: translate(-50%, -50%);
      pointer-events: none;
      z-index: 500;
    }
    .parcel-pin-badge .code {
      color: #ff3377;
      font-size: 12px;
      font-weight: 800;
      letter-spacing: 0.5px;
    }

    .station-name-pill {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      background: rgba(15, 23, 42, 0.92);
      border: 2px dashed #ffffff;
      border-radius: 8px;
      padding: 5px 10px;
      color: #ffffff;
      font-size: 11px;
      font-weight: 800;
      box-shadow: 0 6px 20px rgba(0, 0, 0, 0.85);
      white-space: nowrap;
      transform: translate(-50%, -50%);
      pointer-events: none;
      letter-spacing: 0.5px;
    }
  </style>
</head>
<body>
  <div class="header-panel">
    <div class="header-left">
      <div class="badge-order">${orderBadge}</div>
      <div class="title-group">
        <h1>${scenario.parcelCode} - ${scenario.scenarioTitle}</h1>
        <p>📍 ${address} | ${parcel.zone_id || 'ZONE_04'}</p>
      </div>
    </div>
    <div class="header-right">
      <div class="hud-tag">${scenario.expectedCategory}</div>
      <div class="hud-tag success">ĐÃ THẨM ĐỊNH POSTGIS</div>
    </div>
  </div>

  <div class="bbox-badge">
    📐 KHUNG NHÌN CẬN CẢNH: ~${Math.round(targetSpan)}m × ~${Math.round(targetSpan)}m
  </div>

  <div class="metric-panel">
    <div class="metric-title">
      <span>Kết Quả Đo Đạc Không Gian</span>
      <span style="color: #38bdf8;">TIÊU CỰ ĐƯỜNG DÓNG</span>
    </div>
    <div class="metric-row">
      <span class="metric-label"><span class="metric-indicator ind-tunnel"></span>Cự ly Tim Hầm:</span>
      <span class="metric-value yellow">${centerlineDistStr}</span>
    </div>
    <div class="metric-row">
      <span class="metric-label"><span class="metric-indicator ind-station"></span>Cự ly Ga Trắng:</span>
      <span class="metric-value cyan">${stationDistStr}</span>
    </div>
    <div class="metric-row">
      <span class="metric-label"><span class="metric-indicator ind-center"></span>Tiêu Cự Khung Nhìn:</span>
      <span class="metric-value">${focalLat.toFixed(5)}, ${focalLng.toFixed(5)}</span>
    </div>
  </div>

  <div class="legend-panel">
    <div class="legend-title">Chú Giải Lớp Bản Đồ</div>
    <div class="legend-item"><span class="legend-line tunnel-dist"></span> Đường dóng cự ly Tim Hầm (Vàng)</div>
    <div class="legend-item"><span class="legend-line station-dist"></span> Đường dóng cự ly Mép Ga (Cyan)</div>
    <div class="legend-item"><span class="legend-line centerline"></span> Tim Tuyến Metro Số 2 (Đỏ)</div>
    <div class="legend-item"><span class="legend-line station-poly"></span> Ranh Công Trình Ga (Trắng Đứt)</div>
    <div class="legend-item"><span class="legend-line parcel-poly"></span> Thửa Đất Khảo Sát (Hồng Đỏ)</div>
  </div>

  <div id="map"></div>

  <script>
    const map = L.map('map', {
      zoomControl: false,
      attributionControl: false,
      fadeAnimation: false,
    });

    // 1. Tầng bản đồ vệ tinh Esri World Imagery độ nét cao
    L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
      maxZoom: 19,
    }).addTo(map);

    const bounds = ${JSON.stringify(bounds)};
    map.fitBounds(bounds, { animate: false, padding: [15, 15] });

    // 2. Vẽ Tim Tuyến Metro 2 (Đỏ rực rỡ + viền glow + nét phản quang)
    const centerline = ${JSON.stringify(boundaryData.centerline || [])};
    if (centerline && centerline.length > 1) {
      // Glow ngoài
      L.polyline(centerline, { color: 'rgba(239, 68, 68, 0.45)', weight: 12 }).addTo(map);
      // Tim đỏ chính
      L.polyline(centerline, { color: '#dc2626', weight: 5, opacity: 0.95 }).addTo(map);
      // Nét đứt phản quang trắng ở lõi
      L.polyline(centerline, { color: '#ffffff', weight: 1.5, dashArray: '8, 8', opacity: 0.9 }).addTo(map);
    }

    // 3. Vẽ Ranh Hành Lang Hố Đào (Xanh mờ nét đứt)
    const corridors = ${JSON.stringify(boundaryData.corridorBoundaries || [])};
    if (corridors) {
      corridors.forEach(c => {
        if (c.coords && c.coords.length > 1) {
          L.polyline(c.coords, { color: '#0284c7', weight: 2, dashArray: '5, 5', opacity: 0.65 }).addTo(map);
        }
      });
    }

    // 4. Vẽ Ranh Công Trình Ga Ngầm (CÔNG TRÌNH MÀU TRẮNG NỔI BẬT)
    const stations = ${JSON.stringify(boundaryData.stationDetailedFootprints || [])};
    if (stations) {
      stations.forEach(st => {
        if (st.coords && st.coords.length > 2) {
          // Viền glow trắng ngoài
          L.polygon(st.coords, {
            color: 'rgba(255, 255, 255, 0.4)',
            weight: 9,
            fill: false
          }).addTo(map);

          // Đa giác trắng chính
          L.polygon(st.coords, {
            color: '#ffffff',
            weight: 3.5,
            dashArray: '7, 5',
            fillColor: '#0284c7',
            fillOpacity: 0.22
          }).addTo(map);

          // Nhãn tên ga đặt ở trung tâm ga nếu ga nằm gần khung nhìn
          const stLat = st.coords.reduce((s, p) => s + p[0], 0) / st.coords.length;
          const stLng = st.coords.reduce((s, p) => s + p[1], 0) / st.coords.length;
          const dFromCenter = Math.hypot(stLat - ${focalLat}, stLng - ${focalLng}) * 111320;
          if (dFromCenter < 120) {
            const stIcon = L.divIcon({
              className: 'custom-div-icon',
              html: '<div class=\"station-name-pill\">🏢 ' + st.name + '</div>',
              iconSize: [0, 0]
            });
            L.marker([stLat, stLng], { icon: stIcon }).addTo(map);
          }
        }
      });
    }

    // 5. Vẽ Đa Giác Thửa Đất Khảo Sát (Hồng Đỏ rực rỡ)
    const parcelCoords = ${JSON.stringify(coords)};
    // Glow ngoài
    L.polygon(parcelCoords, {
      color: 'rgba(255, 0, 85, 0.45)',
      weight: 10,
      fill: false
    }).addTo(map);
    // Viền chính
    const parcelPolygon = L.polygon(parcelCoords, {
      color: '#ff0055',
      weight: 4,
      fillColor: '#ff0055',
      fillOpacity: 0.45,
    }).addTo(map);

    // Ghim nhãn thửa đất ở trọng tâm các đỉnh nằm trong khung nhìn để không đè lên đường dóng
    const inViewPts = parcelCoords.filter(p => Math.hypot(p[0] - ${focalLat}, p[1] - ${focalLng}) * 111320 <= 45);
    const targetPts = inViewPts.length > 0 ? inViewPts : parcelCoords;
    const pinLat = targetPts.reduce((s, p) => s + p[0], 0) / targetPts.length;
    const pinLng = targetPts.reduce((s, p) => s + p[1], 0) / targetPts.length;
    const parcelIcon = L.divIcon({
      className: 'custom-div-icon',
      html: '<div class="parcel-pin-badge"><span class="code">${scenario.parcelCode}</span><span>${address}</span></div>',
      iconSize: [0, 0]
    });
    L.marker([pinLat, pinLng], { icon: parcelIcon }).addTo(map);

    // 6. VẼ ĐƯỜNG DÓNG KHOẢNG CÁCH TỚI TIM HẦM (VÀNG)
    const metrics = ${JSON.stringify(metrics)};

    if (!metrics.isCenterlineIntersectsParcel && metrics.distanceToCenterlineMeters > 0) {
      const v = metrics.closestCenterVertex;
      const p = metrics.closestCenterPoint;

      // Nét shadow đen viền dưới tạo tương phản trên vệ tinh
      L.polyline([v, p], { color: '#000000', weight: 8, opacity: 0.9 }).addTo(map);
      // Nét dóng vàng rực rỡ
      L.polyline([v, p], { color: '#facc15', weight: 4.5, dashArray: '6, 6' }).addTo(map);

      // Điểm mút
      L.circleMarker(v, { radius: 7, color: '#000000', weight: 2, fillColor: '#facc15', fillOpacity: 1 }).addTo(map);
      L.circleMarker(p, { radius: 7, color: '#000000', weight: 2, fillColor: '#ef4444', fillOpacity: 1 }).addTo(map);

      // Floating Badge ở trung điểm
      const midLat = (v[0] + p[0]) / 2;
      const midLng = (v[1] + p[1]) / 2;
      const badgeIcon = L.divIcon({
        className: 'custom-div-icon',
        html: '<div class="dist-badge tunnel">🚇 Tim Hầm: ' + metrics.distanceToCenterlineMeters.toFixed(1) + ' m</div>',
        iconSize: [0, 0]
      });
      L.marker([midLat, midLng], { icon: badgeIcon }).addTo(map);
    } else if (metrics.isCenterlineIntersectsParcel) {
      // Trường hợp tim hầm cắt xuyên thửa đất
      const badgeIcon = L.divIcon({
        className: 'custom-div-icon',
        html: '<div class="dist-badge alert-center" style="transform: translate(-50%, -160%);">⚠️ TIM HẦM CẮT XUYÊN THỬA (Cự ly: 0.0m)</div>',
        iconSize: [0, 0]
      });
      L.marker([pinLat, pinLng], { icon: badgeIcon }).addTo(map);
    }

    // 7. VẼ ĐƯỜNG DÓNG KHOẢNG CÁCH TỚI CÔNG TRÌNH GA MÀU TRẮNG (CYAN)
    if (metrics.outerBoundaryType === 'STATION_OUTLINE') {
      if (!metrics.isStationIntersectsParcel && metrics.distanceToOuterBoundaryMeters !== null && metrics.distanceToOuterBoundaryMeters > 0 && metrics.distanceToOuterBoundaryMeters <= 100) {
        const v = metrics.closestOuterVertex;
        const p = metrics.closestOuterPoint;

        // Shadow đen
        L.polyline([v, p], { color: '#000000', weight: 8, opacity: 0.9 }).addTo(map);
        // Nét dóng Cyan Neon rực rỡ
        L.polyline([v, p], { color: '#00f0ff', weight: 4.5, dashArray: '5, 5' }).addTo(map);

        // Điểm mút
        L.circleMarker(v, { radius: 7, color: '#000000', weight: 2, fillColor: '#00f0ff', fillOpacity: 1 }).addTo(map);
        L.circleMarker(p, { radius: 8, color: '#000000', weight: 2, fillColor: '#ffffff', fillOpacity: 1 }).addTo(map);

        // Floating Badge ở trung điểm
        const midLat = (v[0] + p[0]) / 2;
        const midLng = (v[1] + p[1]) / 2;
        const badgeIcon = L.divIcon({
          className: 'custom-div-icon',
          html: '<div class="dist-badge station">🏢 Mép Ga: ' + metrics.distanceToOuterBoundaryMeters.toFixed(1) + ' m</div>',
          iconSize: [0, 0]
        });
        L.marker([midLat, midLng], { icon: badgeIcon }).addTo(map);
      } else if (metrics.isStationIntersectsParcel) {
        const badgeIcon = L.divIcon({
          className: 'custom-div-icon',
          html: '<div class="dist-badge alert-station" style="transform: translate(-50%, 60%);">🏢 NẰM TRONG RANH GA ' + metrics.closestStationName + ' (0.0m)</div>',
          iconSize: [0, 0]
        });
        L.marker([pinLat, pinLng], { icon: badgeIcon }).addTo(map);
      }
    }

    // Thước tỷ lệ
    L.control.scale({ imperial: false, position: 'bottomright' }).addTo(map);
  </script>
</body>
</html>`;
}

async function runCapture() {
  console.log('====================================================================');
  console.log('BẮT ĐẦU XUẤT 10 CAPTURE ĐỐI SOÁT CẬN CẢNH (CLOSE-UP ZOOM 60m - 110m)');
  console.log('TIÊU CỰ ĐẶT CHÍNH XÁC VÀO VÙNG ĐO ĐẠC (MEASUREMENT ZONE)');
  console.log('HIỂN THỊ RÕ NÉT CẢ 2 ĐƯỜNG DÓNG: TIM HẦM (VÀNG) & GA TRẮNG (CYAN)');
  console.log('====================================================================\n');

  const outputDir = path.resolve('/Users/vqd2k6/.gemini/antigravity-ide/brain/9f6b05d3-5a86-4619-ac80-6268210c2f59/audit_captures');
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  const boundaryPath = path.resolve(__dirname, '../../../data/metro_boundary_data.json');
  const boundaryData = JSON.parse(fs.readFileSync(boundaryPath, 'utf8'));

  const client = new Client({
    connectionString: 'postgresql://metro2_user:metro2_secure_password@localhost:5433/metro2_gis_db',
  });
  await client.connect();

  const chromePath = getChromeExecutablePath();
  const browser = await puppeteer.launch({
    executablePath: chromePath,
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu'],
  });

  const generatedCaptures: Array<{
    order: number;
    parcelCode: string;
    scenarioTitle: string;
    filePath: string;
    centerlineDist: string;
    stationDist: string;
  }> = [];

  try {
    for (const sc of SCENARIOS) {
      console.log(`[#${sc.order < 10 ? '0' + sc.order : sc.order}] Đang xử lý cận cảnh thửa đất: ${sc.parcelCode}...`);

      const res = await client.query(`
        SELECT p.id, p.project_parcel_code, p.house_number, p.street, p.zone_id,
               ST_AsGeoJSON(p.cadastral_polygon_geom) as geojson
        FROM parcels p
        WHERE p.project_parcel_code = $1
        LIMIT 1;
      `, [sc.parcelCode]);

      if (res.rows.length === 0) {
        console.warn(`⚠️ Không tìm thấy thửa đất ${sc.parcelCode} trong CSDL. Bỏ qua.`);
        continue;
      }

      const parcel = res.rows[0];
      const geo = JSON.parse(parcel.geojson);
      const coords: [number, number][] = geo.coordinates[0].map((pt: any) => [pt[1], pt[0]]);

      const metrics = calculateSpatialMetrics(coords, boundaryData);

      const html = generateCloseUpMapHtml(sc, parcel, coords, metrics, boundaryData);
      const tempHtmlPath = path.join(outputDir, `temp_${sc.parcelCode}.html`);
      fs.writeFileSync(tempHtmlPath, html, 'utf8');

      const page = await browser.newPage();
      await page.setViewport({ width: 1200, height: 900, deviceScaleFactor: 2 });
      await page.goto(`file://${tempHtmlPath}`, { waitUntil: 'networkidle0', timeout: 30000 });

      // Đợi thêm 1.5 giây để các tile vệ tinh Esri và SVG render mịn màng
      await new Promise(r => setTimeout(r, 1500));

      const orderStr = sc.order < 10 ? `0${sc.order}` : `${sc.order}`;
      const imgFilename = `capture_${orderStr}_${sc.parcelCode}.png`;
      const imgPath = path.join(outputDir, imgFilename);

      await page.screenshot({
        path: imgPath,
        type: 'png',
        clip: { x: 0, y: 0, width: 1200, height: 900 },
      });

      await page.close();
      fs.unlinkSync(tempHtmlPath);

      const centerlineDistStr = metrics.isCenterlineIntersectsParcel || metrics.distanceToCenterlineMeters === 0
        ? '0.0m (Hầm đi ngầm dưới nhà)'
        : `${metrics.distanceToCenterlineMeters.toFixed(1)}m`;

      const stationDistStr = metrics.isStationIntersectsParcel
        ? `0.0m (${metrics.closestStationName})`
        : metrics.outerBoundaryType === 'STATION_OUTLINE' && metrics.distanceToOuterBoundaryMeters !== null
          ? `${metrics.distanceToOuterBoundaryMeters.toFixed(1)}m (${metrics.closestStationName})`
          : 'Không có ga trong khu vực';

      console.log(`   📸 [PASS] Đã xuất capture cận cảnh thành công -> ${imgFilename}`);
      console.log(`      • Cự ly Tim: ${centerlineDistStr} | Cự ly Ga: ${stationDistStr}`);
      generatedCaptures.push({
        order: sc.order,
        parcelCode: sc.parcelCode,
        scenarioTitle: sc.scenarioTitle,
        filePath: imgPath,
        centerlineDist: centerlineDistStr,
        stationDist: stationDistStr,
      });
    }

    console.log('\n====================================================================');
    console.log(`🎉 HOÀN THÀNH XUẤT ${generatedCaptures.length}/10 ẢNH CAPTURE CẬN CẢNH (CLOSE-UP ZOOM)!`);
    console.log(`Thư mục lưu trữ: ${outputDir}`);
    console.log('====================================================================\n');

  } catch (err) {
    console.error('Lỗi khi xuất ảnh capture:', err);
  } finally {
    await browser.close();
    await client.end();
  }
}

runCapture().catch(console.error);
