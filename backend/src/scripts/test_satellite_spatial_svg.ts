import { ReportV3Service } from '../modules/report_v3/report-v3.service';
import { extractParcelPolygonCoords } from '../modules/report_v2/utils/metro-spatial.utils';
import { PdfRenderV2Engine } from '../modules/report_v2/engine/pdf-render-v2.engine';
import * as fs from 'fs';
import * as path from 'path';
import * as https from 'https';
import * as dotenv from 'dotenv';

dotenv.config({ path: path.resolve(__dirname, '../../.env') });
dotenv.config();

/**
 * Tải 1 tile vệ tinh Esri với disk cache
 */
async function fetchTileBase64(z: number, y: number, x: number): Promise<string | null> {
  const cacheDir = path.resolve(process.cwd(), 'data/cache/satellite_tiles');
  if (!fs.existsSync(cacheDir)) {
    fs.mkdirSync(cacheDir, { recursive: true });
  }

  const cacheFile = path.join(cacheDir, `${z}_${y}_${x}.jpg`);
  if (fs.existsSync(cacheFile)) {
    const buf = fs.readFileSync(cacheFile);
    return `data:image/jpeg;base64,${buf.toString('base64')}`;
  }

  const url = `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${z}/${y}/${x}`;
  return new Promise((resolve) => {
    https.get(url, { timeout: 6000 }, (res) => {
      if (res.statusCode !== 200) {
        return resolve(null);
      }
      const chunks: Buffer[] = [];
      res.on('data', (d) => chunks.push(d));
      res.on('end', () => {
        const fullBuf = Buffer.concat(chunks);
        try {
          fs.writeFileSync(cacheFile, fullBuf);
        } catch (e) {}
        resolve(`data:image/jpeg;base64,${fullBuf.toString('base64')}`);
      });
    }).on('error', () => resolve(null));
  });
}

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
    t = Math.max(0, Math.min(1, (px * bx + py * by) / segLenSq));
  }
  const projLat = a[0] + t * (b[0] - a[0]);
  const projLng = a[1] + t * (b[1] - a[1]);
  const dist = Math.hypot((p[1] - projLng) * mPerDegLng, (p[0] - projLat) * mPerDegLat);
  return { distance: dist, projection: [projLat, projLng] };
}

function escapeXml(unsafe: string): string {
  return String(unsafe || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export async function generatePortraitSatelliteMetroSvg(
  polygonCoords: [number, number][],
  parcelCode: string,
  boundaryData: any
): Promise<string> {
  const centerline: [number, number][] = boundaryData.centerline || [];
  const stations: Array<{ name: string; coords: [number, number][] }> = boundaryData.stationDetailedFootprints || [];
  const corridorBoundaries: Array<{ name: string; coords: [number, number][] }> = boundaryData.corridorBoundaries || [];

  // 1. Điểm dóng tim tuyến và ga gần nhất
  let minCenterDist = Infinity;
  let bestCenterProj: [number, number] = [0, 0];
  for (const v of polygonCoords) {
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
  let bestStName = '';
  for (const st of stations) {
    for (const v of polygonCoords) {
      for (let j = 0; j < st.coords.length; j++) {
        const p1 = st.coords[j];
        const p2 = st.coords[(j + 1) % st.coords.length];
        const d = pointToSegmentDistance(v, p1, p2);
        if (d.distance < minStDist) {
          minStDist = d.distance;
          bestStProj = d.projection;
          bestStName = st.name;
        }
      }
    }
  }

  // 2. Hệ quy chiếu cục bộ [x, y] (đơn vị mét) quanh tâm thửa đất
  const parcelCenterLat = polygonCoords.reduce((s, p) => s + p[0], 0) / polygonCoords.length;
  const parcelCenterLng = polygonCoords.reduce((s, p) => s + p[1], 0) / polygonCoords.length;
  const cosLat = Math.cos((parcelCenterLat * Math.PI) / 180);
  const mPerDegLat = 111320;
  const mPerDegLng = 111320 * cosLat;
  const toLocal = (p: [number, number]): [number, number] => [
    (p[1] - parcelCenterLng) * mPerDegLng,
    (p[0] - parcelCenterLat) * mPerDegLat,
  ];

  const localParcel = polygonCoords.map(toLocal);
  const localCenterProj = toLocal(bestCenterProj);
  const hasStation = minStDist < 250 && minStDist < Infinity;
  const localStProj = toLocal(bestStProj);

  // 3. Focal Bounding Box & Midpoint
  const focusPts: [number, number][] = [...localParcel, localCenterProj];
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

  // 4. Khổ dọc 3:4 (SVG width: 300, height: 400)
  const svgWidth = 300;
  const svgHeight = 400;
  const aspectRatio = svgWidth / svgHeight; // 0.75 (khổ dọc 3:4)

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

  // 5. Tải các mảnh ảnh vệ tinh (XYZ Tiles) ở zoom 18
  const zoom = 18;
  const n = 2 ** zoom;

  // Bounding box kinh vĩ độ của khung SVG
  const leftLng = parcelCenterLng + ((0 - cxPx) / scale + midX) / mPerDegLng;
  const rightLng = parcelCenterLng + ((svgWidth - cxPx) / scale + midX) / mPerDegLng;
  const topLat = parcelCenterLat + ((cyPx - 0) / scale + midY) / mPerDegLat;
  const bottomLat = parcelCenterLat + ((cyPx - svgHeight) / scale + midY) / mPerDegLat;

  const minTileX = Math.floor(((leftLng + 180) / 360) * n);
  const maxTileX = Math.floor(((rightLng + 180) / 360) * n);
  const minTileY = Math.floor((1 - Math.log(Math.tan((topLat * Math.PI) / 180) + 1 / Math.cos((topLat * Math.PI) / 180)) / Math.PI) / 2 * n);
  const maxTileY = Math.floor((1 - Math.log(Math.tan((bottomLat * Math.PI) / 180) + 1 / Math.cos((bottomLat * Math.PI) / 180)) / Math.PI) / 2 * n);

  let tilesSvg = '';
  for (let tx = minTileX; tx <= maxTileX; tx++) {
    for (let ty = minTileY; ty <= maxTileY; ty++) {
      const tileBase64 = await fetchTileBase64(zoom, ty, tx);
      if (!tileBase64) continue;

      // Tọa độ góc trên bên trái của tile tx, ty
      const tileLng = (tx / n) * 360 - 180;
      const tileLatRad = Math.atan(Math.sinh(Math.PI * (1 - (2 * ty) / n)));
      const tileLat = (tileLatRad * 180) / Math.PI;

      // Tọa độ góc dưới bên phải của tile
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

  let svgContent = '';
  // Nền tối dự phòng nếu mất mạng hoàn toàn
  svgContent += `<rect width="${svgWidth}" height="${svgHeight}" fill="#1e293b"/>`;

  if (tilesSvg) {
    svgContent += `<g id="satellite-tiles">${tilesSvg}</g>`;
    // Phủ mờ nhẹ 12% để vector nổi bật
    svgContent += `<rect width="${svgWidth}" height="${svgHeight}" fill="rgba(0,0,0,0.12)"/>`;
  }

  // Khung viền đen ngoài
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

  // 4. Đa giác Thửa đất nhà dân (Viền Đỏ đậm, nền đỏ nhạt)
  const parcelPtsStr = localParcel.map((p) => `${toSvgX(p[0]).toFixed(1)},${toSvgY(p[1]).toFixed(1)}`).join(' ');
  // Đổ bóng phát sáng viền trắng dưới đa giác để tách khỏi nền vệ tinh tối
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



  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${svgWidth} ${svgHeight}" width="${svgWidth}" height="${svgHeight}">${svgContent}</svg>`;
}

async function run() {
  console.log('=== TEST PROTOTYPE SATELLITE PORTRAIT SPATIAL MAP ===');
  const boundaryPath = fs.existsSync(path.resolve(process.cwd(), 'data/metro_boundary_data.json'))
    ? path.resolve(process.cwd(), 'data/metro_boundary_data.json')
    : path.resolve(process.cwd(), '../data/metro_boundary_data.json');
  const boundaryData = JSON.parse(fs.readFileSync(boundaryPath, 'utf8'));

  const testCases = [
    { id: '73ce904b-8c9b-45c6-a07e-091aaa55354a', code: 'B00050' },
    { id: 'd730fc32-3c55-4d4f-94d2-14d4bdcf5060', code: 'B00026' },
  ];

  const outDir = path.resolve(__dirname, '../../test_output/audit/satellite_test');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

  const browser = await PdfRenderV2Engine.getBrowser();
  const page = await browser.newPage();

  for (const tc of testCases) {
    const resolved = await ReportV3Service.resolve(tc.id);
    const polygon = extractParcelPolygonCoords(resolved.raw, resolved.json);
    if (!polygon) {
      console.log(`No polygon for ${tc.code}`);
      continue;
    }

    const svg = await generatePortraitSatelliteMetroSvg(polygon, tc.code, boundaryData);
    const svgPath = path.join(outDir, `${tc.code}_satellite_portrait.svg`);
    fs.writeFileSync(svgPath, svg, 'utf8');

    // Render to PNG
    await page.setViewport({ width: 300, height: 400, deviceScaleFactor: 2 });
    await page.setContent(`<!DOCTYPE html><html><body style="margin:0;padding:0;background:transparent;">${svg}</body></html>`, { waitUntil: 'load' });
    const pngPath = path.join(outDir, `${tc.code}_satellite_portrait.png`);
    await page.screenshot({ path: pngPath, type: 'png', omitBackground: true });

    console.log(`Rendered ${tc.code} to ${pngPath}`);
  }

  await page.close();
  console.log('Done!');
}

run().catch(console.error);
