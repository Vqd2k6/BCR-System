import { ReportService } from '../modules/report/report-v3.service';
import { extractParcelPolygonCoords } from '../modules/report/utils/metro-spatial.utils';
import { PdfRenderEngine } from '../modules/report/engine/pdf-render.engine';
import * as fs from 'fs';
import * as path from 'path';

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

export function generateSmartFocusedMetroSvg(
  polygonCoords: [number, number][],
  parcelCode: string,
  boundaryData: any
): string {
  const centerline: [number, number][] = boundaryData.centerline || [];
  const stations: Array<{ name: string; coords: [number, number][] }> = boundaryData.stationDetailedFootprints || [];
  const corridorBoundaries: Array<{ name: string; coords: [number, number][] }> = boundaryData.corridorBoundaries || [];

  // 1. Tìm điểm dóng tim hầm ngắn nhất
  let minCenterDist = Infinity;
  let bestCenterProj: [number, number] = [0, 0];
  let bestCenterVertex: [number, number] = polygonCoords[0];
  for (const v of polygonCoords) {
    for (let i = 0; i < centerline.length - 1; i++) {
      const d = pointToSegmentDistance(v, centerline[i], centerline[i + 1]);
      if (d.distance < minCenterDist) {
        minCenterDist = d.distance;
        bestCenterProj = d.projection;
        bestCenterVertex = v;
      }
    }
  }

  // 2. Tìm điểm dóng công trình ga ngắn nhất
  let minStDist = Infinity;
  let bestStProj: [number, number] = [0, 0];
  let bestStVertex: [number, number] = polygonCoords[0];
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
          bestStVertex = v;
          bestStName = st.name;
        }
      }
    }
  }

  // 3. Hệ quy chiếu cục bộ [x, y] (đơn vị mét) quanh tâm thửa đất
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
  const localCenterVert = toLocal(bestCenterVertex);
  const hasStation = minStDist < 250 && minStDist < Infinity;
  const localStProj = toLocal(bestStProj);
  const localStVert = toLocal(bestStVertex);

  // 4. Xác định Focus Bounding Box & Midpoint
  const focusPts: [number, number][] = [...localParcel, localCenterProj, localCenterVert];
  if (hasStation) {
    focusPts.push(localStProj, localStVert);
  }

  const fMinX = Math.min(...focusPts.map((p) => p[0]));
  const fMaxX = Math.max(...focusPts.map((p) => p[0]));
  const fMinY = Math.min(...focusPts.map((p) => p[1]));
  const fMaxY = Math.max(...focusPts.map((p) => p[1]));

  const midX = (fMinX + fMaxX) / 2;
  const midY = (fMinY + fMaxY) / 2;
  const spanX = fMaxX - fMinX;
  const spanY = fMaxY - fMinY;

  // Đệm lề xung quanh trung điểm theo tỉ lệ khung hình (Aspect Ratio = 420 / 280 = 1.5)
  const padM = 32;
  const minSpanW = 120;
  const minSpanH = 80;

  let viewW = Math.max(spanX + 2 * padM, minSpanW);
  let viewH = Math.max(spanY + 2 * padM, minSpanH);

  if (viewW / viewH < 1.5) {
    viewW = viewH * 1.5;
  } else {
    viewH = viewW / 1.5;
  }

  const svgWidth = 420;
  const svgHeight = 280;
  const padPx = 20;
  const drawW = svgWidth - 2 * padPx;
  const drawH = svgHeight - 2 * padPx;

  const scale = Math.min(drawW / viewW, drawH / viewH);

  const cxPx = svgWidth / 2;
  const cyPx = svgHeight / 2;

  const toSvgX = (xM: number) => cxPx + (xM - midX) * scale;
  const toSvgY = (yM: number) => cyPx - (yM - midY) * scale;

  // Lọc đối tượng trong khung nhìn mở rộng (+50m)
  const viewRadiusM = Math.hypot(viewW, viewH) / 2 + 50;
  const isNearView = (loc: [number, number]) => Math.hypot(loc[0] - midX, loc[1] - midY) <= viewRadiusM;

  // SVG Elements
  let svgContent = '';

  // Background Grid & Defs
  svgContent += `<rect width="${svgWidth}" height="${svgHeight}" fill="#fafaf9" stroke="#000000" stroke-width="1"/>`;
  svgContent += `<defs>
    <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
      <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#e7e5e4" stroke-width="0.7"/>
    </pattern>
  </defs><rect width="${svgWidth}" height="${svgHeight}" fill="url(#grid)"/>`;

  // 1. Ranh công trình ga (Mép ga chi tiết)
  for (const st of stations) {
    const locs = st.coords.map(toLocal);
    if (locs.some(isNearView)) {
      const ptsStr = locs.map((p) => `${toSvgX(p[0]).toFixed(1)},${toSvgY(p[1]).toFixed(1)}`).join(' ');
      svgContent += `<polygon points="${ptsStr}" fill="rgba(226, 232, 240, 0.75)" stroke="#64748b" stroke-width="1.5" stroke-dasharray="4,2"/>`;
      const avgX = locs.reduce((s, p) => s + p[0], 0) / locs.length;
      const avgY = locs.reduce((s, p) => s + p[1], 0) / locs.length;
      svgContent += `<text x="${toSvgX(avgX).toFixed(1)}" y="${toSvgY(avgY).toFixed(1)}" fill="#475569" font-size="8.5" font-family="'Latin Modern Roman', serif" font-weight="bold" text-anchor="middle">${escapeXml(st.name)}</text>`;
    }
  }

  // 2. Ranh hành lang đào (Corridor lines)
  for (const cor of corridorBoundaries) {
    const locs = cor.coords.map(toLocal);
    if (locs.some(isNearView)) {
      const ptsStr = locs.map((p) => `${toSvgX(p[0]).toFixed(1)},${toSvgY(p[1]).toFixed(1)}`).join(' ');
      svgContent += `<polyline points="${ptsStr}" fill="none" stroke="#0284c7" stroke-width="1.2" stroke-dasharray="4,3"/>`;
    }
  }

  // 3. Tim tuyến Metro 2
  const localCenterline = centerline.map(toLocal);
  const nearCenterline = localCenterline.filter(isNearView);
  if (nearCenterline.length > 1) {
    // Vẽ vệt corridor buffer đỏ nhạt xung quanh tim tuyến
    const ptsStr = localCenterline.map((p) => `${toSvgX(p[0]).toFixed(1)},${toSvgY(p[1]).toFixed(1)}`).join(' ');
    svgContent += `<polyline points="${ptsStr}" fill="none" stroke="rgba(239, 68, 68, 0.18)" stroke-width="20" stroke-linecap="round"/>`;
    svgContent += `<polyline points="${ptsStr}" fill="none" stroke="#dc2626" stroke-width="2.5"/>`;

    // Nhãn tim tuyến và tên đường
    const midIdx = Math.floor(nearCenterline.length / 2);
    const midCenterPt = nearCenterline[midIdx];
    const nextCenterPt = nearCenterline[Math.min(midIdx + 1, nearCenterline.length - 1)];
    const dx = toSvgX(nextCenterPt[0]) - toSvgX(midCenterPt[0]);
    const dy = toSvgY(nextCenterPt[1]) - toSvgY(midCenterPt[1]);
    let angleDeg = (Math.atan2(dy, dx) * 180) / Math.PI;
    if (angleDeg > 90) angleDeg -= 180;
    if (angleDeg < -90) angleDeg += 180;

    svgContent += `
      <g transform="translate(${toSvgX(midCenterPt[0]).toFixed(1)}, ${toSvgY(midCenterPt[1]).toFixed(1)}) rotate(${angleDeg.toFixed(1)})">
        <text x="0" y="-5" fill="#dc2626" font-size="8" font-family="'Latin Modern Roman', serif" font-weight="bold" text-anchor="middle">Tim tuyến Metro 2 (Đ. Cách Mạng Tháng 8)</text>
      </g>
    `;
  }

  // 4. Đường dóng cự ly tới Tim tuyến (Màu Vàng / Hổ phách có Pill Badge)
  const cx1 = toSvgX(localCenterVert[0]);
  const cy1 = toSvgY(localCenterVert[1]);
  const cx2 = toSvgX(localCenterProj[0]);
  const cy2 = toSvgY(localCenterProj[1]);
  svgContent += `<line x1="${cx1.toFixed(1)}" y1="${cy1.toFixed(1)}" x2="${cx2.toFixed(1)}" y2="${cy2.toFixed(1)}" stroke="#d97706" stroke-width="1.8" stroke-dasharray="4,2.5"/>`;
  svgContent += `<circle cx="${cx2.toFixed(1)}" cy="${cy2.toFixed(1)}" r="3" fill="#d97706"/>`;

  // Tính vị trí ban đầu của 2 badge
  const tC = 0.35;
  let cBadgeX = (1 - tC) * cx2 + tC * cx1;
  let cBadgeY = (1 - tC) * cy2 + tC * cy1;

  let sBadgeX = 0;
  let sBadgeY = 0;
  if (hasStation) {
    const sx1 = toSvgX(localStVert[0]);
    const sy1 = toSvgY(localStVert[1]);
    const sx2 = toSvgX(localStProj[0]);
    const sy2 = toSvgY(localStProj[1]);

    const tS = 0.70;
    sBadgeX = (1 - tS) * sx2 + tS * sx1;
    sBadgeY = (1 - tS) * sy2 + tS * sy1;

    // Kiểm tra va chạm khoảng cách giữa 2 badge
    const badgeDist = Math.hypot(sBadgeX - cBadgeX, sBadgeY - cBadgeY);
    if (badgeDist < 30) {
      // Dịch badge cự ly tim sang trái/lên và badge ga sang phải/xuống
      cBadgeX -= 18;
      cBadgeY -= 8;
      sBadgeX += 18;
      sBadgeY += 8;
    }
  }

  const cDistText = `${minCenterDist.toFixed(1)} m`;
  const cBadgeW = cDistText.length * 6.5 + 16;
  svgContent += `
    <g transform="translate(${cBadgeX.toFixed(1)}, ${cBadgeY.toFixed(1)})">
      <rect x="${-cBadgeW / 2}" y="-8" width="${cBadgeW}" height="16" rx="8" fill="rgba(30, 41, 59, 0.95)" stroke="#f59e0b" stroke-width="1"/>
      <circle cx="${-cBadgeW / 2 + 6}" cy="0" r="2.5" fill="#f59e0b"/>
      <text x="3" y="3.5" fill="#fef08a" font-size="8.5" font-family="'Latin Modern Roman', serif" font-weight="bold" text-anchor="middle">${cDistText}</text>
    </g>
  `;

  // 5. Đường dóng cự ly tới Mép ga (Màu Xanh Biển có Pill Badge)
  if (hasStation) {
    const sx1 = toSvgX(localStVert[0]);
    const sy1 = toSvgY(localStVert[1]);
    const sx2 = toSvgX(localStProj[0]);
    const sy2 = toSvgY(localStProj[1]);
    svgContent += `<line x1="${sx1.toFixed(1)}" y1="${sy1.toFixed(1)}" x2="${sx2.toFixed(1)}" y2="${sy2.toFixed(1)}" stroke="#0284c7" stroke-width="1.8" stroke-dasharray="4,2.5"/>`;
    svgContent += `<circle cx="${sx2.toFixed(1)}" cy="${sy2.toFixed(1)}" r="3" fill="#0284c7"/>`;

    const sDistText = `${minStDist.toFixed(1)} m (Mép ga)`;
    const sBadgeW = sDistText.length * 5.8 + 16;
    svgContent += `
      <g transform="translate(${sBadgeX.toFixed(1)}, ${sBadgeY.toFixed(1)})">
        <rect x="${-sBadgeW / 2}" y="-8" width="${sBadgeW}" height="16" rx="8" fill="rgba(12, 74, 110, 0.95)" stroke="#38bdf8" stroke-width="1"/>
        <circle cx="${-sBadgeW / 2 + 6}" cy="0" r="2.5" fill="#38bdf8"/>
        <text x="3" y="3.5" fill="#bae6fd" font-size="8" font-family="'Latin Modern Roman', serif" font-weight="bold" text-anchor="middle">${sDistText}</text>
      </g>
    `;
  }

  // 6. Đa giác thửa đất khảo sát (Nhà dân)
  const parcelPtsStr = localParcel.map((p) => `${toSvgX(p[0]).toFixed(1)},${toSvgY(p[1]).toFixed(1)}`).join(' ');
  svgContent += `<polygon points="${parcelPtsStr}" fill="rgba(14, 165, 233, 0.35)" stroke="#0284c7" stroke-width="2.5"/>`;

  // Target pin tại đỉnh gần tim nhất
  svgContent += `
    <circle cx="${toSvgX(localCenterVert[0])}" cy="${toSvgY(localCenterVert[1])}" r="4" fill="#0284c7" stroke="#ffffff" stroke-width="1.5"/>
  `;

  // Nhãn thửa đất
  const pAvgX = localParcel.reduce((s, p) => s + p[0], 0) / localParcel.length;
  const pAvgY = localParcel.reduce((s, p) => s + p[1], 0) / localParcel.length;
  svgContent += `<text x="${toSvgX(pAvgX).toFixed(1)}" y="${(toSvgY(pAvgY) - 8).toFixed(1)}" fill="#0369a1" font-size="9" font-family="'Latin Modern Roman', serif" font-weight="bold" text-anchor="middle">${escapeXml(parcelCode)}</text>`;

  // 7. La bàn chỉ hướng Bắc (N) góc trên bên phải
  svgContent += `
    <g transform="translate(${svgWidth - 28}, 28)">
      <circle cx="0" cy="0" r="13" fill="#ffffff" stroke="#000000" stroke-width="0.8"/>
      <polygon points="0,-10 -3.5,-1 0,1 3.5,-1" fill="#000000"/>
      <polygon points="0,10 -3.5,1 0,-1 3.5,1" fill="#ffffff" stroke="#000000" stroke-width="0.5"/>
      <text x="0" y="-12" fill="#000000" font-size="8.5" font-family="'Latin Modern Roman', serif" font-weight="bold" text-anchor="middle">N</text>
    </g>
  `;

  // 8. Thước tỷ lệ trắc địa (Scale bar) góc dưới bên trái
  const scaleBarM = viewW > 150 ? 50 : viewW > 60 ? 20 : 10;
  const scaleBarPx = scaleBarM * scale;
  svgContent += `
    <g transform="translate(14, ${svgHeight - 16})">
      <rect x="0" y="-12" width="${scaleBarPx + 20}" height="18" fill="rgba(255,255,255,0.9)" stroke="#cbd5e1" stroke-width="0.5"/>
      <line x1="10" y1="0" x2="${10 + scaleBarPx}" y2="0" stroke="#000000" stroke-width="2"/>
      <line x1="10" y1="-3" x2="10" y2="3" stroke="#000000" stroke-width="1.5"/>
      <line x1="${10 + scaleBarPx}" y1="-3" x2="${10 + scaleBarPx}" y2="3" stroke="#000000" stroke-width="1.5"/>
      <text x="${10 + scaleBarPx / 2}" y="-4" fill="#000000" font-size="7.5" font-family="'Latin Modern Roman', serif" font-weight="bold" text-anchor="middle">${scaleBarM} m</text>
    </g>
  `;

  // 9. Chú thích góc dưới bên phải (Legend)
  svgContent += `
    <g transform="translate(${svgWidth - 148}, ${svgHeight - 26})">
      <rect x="0" y="0" width="140" height="22" fill="rgba(255,255,255,0.92)" stroke="#cbd5e1" stroke-width="0.5"/>
      <rect x="6" y="4" width="8" height="5" fill="rgba(14, 165, 233, 0.35)" stroke="#0284c7" stroke-width="1"/>
      <text x="18" y="9" font-size="6.5" font-family="'Latin Modern Roman', serif" fill="#000000">Thửa đất</text>
      <line x1="56" y1="6.5" x2="66" y2="6.5" stroke="#dc2626" stroke-width="1.8"/>
      <text x="70" y="9" font-size="6.5" font-family="'Latin Modern Roman', serif" fill="#000000">Tim Metro 2</text>
      <line x1="6" y1="16" x2="16" y2="16" stroke="#0284c7" stroke-width="1.2" stroke-dasharray="3,1.5"/>
      <text x="18" y="18" font-size="6.5" font-family="'Latin Modern Roman', serif" fill="#000000">Ranh ga/hành lang</text>
    </g>
  `;

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${svgWidth} ${svgHeight}" width="100%" height="100%">${svgContent}</svg>`;
}

async function run() {
  const boundaryData = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../../../data/metro_boundary_data.json'), 'utf8'));
  const outDir = path.resolve(__dirname, '../../test_output/audit/spatial_test');
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });

  const browser = await PdfRenderEngine.getBrowser();
  const page = await browser.newPage();
  await page.setViewport({ width: 840, height: 560, deviceScaleFactor: 2 });

  const testCases = [
    { id: '73ce904b-8c9b-45c6-a07e-091aaa55354a', code: 'B-00050-C&C (ST05)' },
    { id: 'd730fc32-3c55-4d4f-94d2-14d4bdcf5060', code: 'B-00026-C&C (ST05)' },
    { id: '52eff9ab-90fa-4ed3-9b05-90d5bfcd6793', code: 'B-0063-C&C (ST05)' },
  ];

  for (const tc of testCases) {
    const res = await ReportService.resolve(tc.id);
    const raw = res.raw as any;
    const polygonCoords = extractParcelPolygonCoords(raw, raw.survey_data)!;

    const svg = generateSmartFocusedMetroSvg(polygonCoords, tc.code, boundaryData);
    const filenameBase = tc.code.split('-')[1] ? `B${tc.code.split('-')[1].split('(')[0].trim()}` : tc.code;

    const svgPath = path.join(outDir, `${filenameBase}_focused.svg`);
    fs.writeFileSync(svgPath, svg, 'utf8');

    await page.setContent(`<!DOCTYPE html><html><body style="margin:0;padding:0;background:#ffffff;">${svg}</body></html>`);
    const pngPath = path.join(outDir, `${filenameBase}_focused.png`);
    await page.screenshot({ path: pngPath });
    console.log(`Saved: ${pngPath}`);
  }

  await page.close();
}

if (require.main === module) {
  run()
    .then(() => process.exit(0))
    .catch((e) => {
      console.error(e);
      process.exit(1);
    });
}
