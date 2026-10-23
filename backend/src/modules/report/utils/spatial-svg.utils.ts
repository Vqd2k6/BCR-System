/**
 * ============================================================================
 * SPATIAL SVG RENDERING UTILS (PURE VISUALIZATION — ZERO DISTANCE CALCULATION)
 * Chỉ phục vụ trích xuất tọa độ đa giác đã lưu và dựng sơ đồ trực quan SVG
 * trên nền ảnh vệ tinh Esri World Imagery (LOD 18) cho Trang Bìa & Chương II.
 * TUYỆT ĐỐI KHÔNG tự tính toán khoảng cách hoặc suy luận vùng ảnh hưởng.
 * ============================================================================
 */

import {
  getMetroBoundaryData,
  extractParcelPolygonCoords,
  fetchSatelliteTileBase64Sync,
  fetchSatelliteTileBase64,
  preloadSatelliteTiles,
} from './satellite-tile.utils';

export {
  extractParcelPolygonCoords,
  fetchSatelliteTileBase64Sync,
  fetchSatelliteTileBase64,
  preloadSatelliteTiles,
};

function pointToSegmentProjection(
  pt: [number, number],
  v: [number, number],
  w: [number, number]
): { distance: number; projection: [number, number] } {
  const latScale = 111320;
  const lngScale = 111320 * Math.cos((pt[0] * Math.PI) / 180);

  const px = pt[1] * lngScale;
  const py = pt[0] * latScale;
  const vx = v[1] * lngScale;
  const vy = v[0] * latScale;
  const wx = w[1] * lngScale;
  const wy = w[0] * latScale;

  const l2 = (wx - vx) ** 2 + (wy - vy) ** 2;
  if (l2 === 0) {
    return { distance: Math.hypot(px - vx, py - vy), projection: v };
  }

  let t = ((px - vx) * (wx - vx) + (py - vy) * (wy - vy)) / l2;
  t = Math.max(0, Math.min(1, t));

  const projX = vx + t * (wx - vx);
  const projY = vy + t * (wy - vy);
  return {
    distance: Math.hypot(px - projX, py - projY),
    projection: [projY / latScale, projX / lngScale],
  };
}

/**
 * Sinh sơ đồ không gian trang bìa khổ dọc 3:4 (Portrait Crop: 300x400)
 */
export function generateMetroSpatialVisualSvg(
  polygonCoords: [number, number][] | null,
  _parcelCode: string = 'Thửa đất',
  boundaryDataInput?: any
): string {
  const boundaryData = boundaryDataInput || getMetroBoundaryData();
  if (!polygonCoords || polygonCoords.length < 3) {
    return '';
  }

  const normalizedCoords = polygonCoords.map((p) => (p[0] > p[1] ? [p[1], p[0]] : p) as [number, number]);
  const centerline: [number, number][] = boundaryData?.centerline || [];
  const stations: Array<{ name: string; coords: [number, number][] }> = boundaryData?.stationDetailedFootprints || [];
  const corridorBoundaries: Array<{ name: string; coords: [number, number][] }> = boundaryData?.corridorBoundaries || [];

  let minCenterDist = Infinity;
  let bestCenterProj: [number, number] = [0, 0];
  for (const v of normalizedCoords) {
    for (let i = 0; i < centerline.length - 1; i++) {
      const d = pointToSegmentProjection(v, centerline[i], centerline[i + 1]);
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
        const d = pointToSegmentProjection(v, p1, p2);
        if (d.distance < minStDist) {
          minStDist = d.distance;
          bestStProj = d.projection;
        }
      }
    }
  }

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

  const focusPts: [number, number][] = [...localParcel];
  if (minCenterDist < 1000 && minCenterDist < Infinity) focusPts.push(localCenterProj);
  if (hasStation) focusPts.push(localStProj);

  const fMinX = Math.min(...focusPts.map((p) => p[0]));
  const fMaxX = Math.max(...focusPts.map((p) => p[0]));
  const fMinY = Math.min(...focusPts.map((p) => p[1]));
  const fMaxY = Math.max(...focusPts.map((p) => p[1]));

  const midX = (fMinX + fMaxX) / 2;
  const midY = (fMinY + fMaxY) / 2;
  const spanX = fMaxX - fMinX;
  const spanY = fMaxY - fMinY;

  const svgWidth = 300;
  const svgHeight = 400;
  const aspectRatio = svgWidth / svgHeight;

  let viewW = Math.max(spanX + 80, 110);
  let viewH = Math.max(spanY + 80, 146);
  if (viewW / viewH < aspectRatio) viewW = viewH * aspectRatio;
  else viewH = viewW / aspectRatio;

  const padPx = 15;
  const scale = Math.min((svgWidth - 2 * padPx) / viewW, (svgHeight - 2 * padPx) / viewH);
  const cxPx = svgWidth / 2;
  const cyPx = svgHeight / 2;

  const toSvgX = (xM: number) => cxPx + (xM - midX) * scale;
  const toSvgY = (yM: number) => cyPx - (yM - midY) * scale;

  const zoom = 18;
  const n = 2 ** zoom;

  const leftLng = parcelCenterLng + ((0 - cxPx) / scale + midX) / mPerDegLng;
  const rightLng = parcelCenterLng + ((svgWidth - cxPx) / scale + midX) / mPerDegLng;
  const topLat = parcelCenterLat + ((cyPx - 0) / scale + midY) / mPerDegLat;
  const bottomLat = parcelCenterLat + ((cyPx - svgHeight) / scale + midY) / mPerDegLat;

  const minTileX = Math.floor(((leftLng + 180) / 360) * n);
  const maxTileX = Math.floor(((rightLng + 180) / 360) * n);
  const minTileY = Math.floor(((1 - Math.log(Math.tan((topLat * Math.PI) / 180) + 1 / Math.cos((topLat * Math.PI) / 180)) / Math.PI) / 2) * n);
  const maxTileY = Math.floor(((1 - Math.log(Math.tan((bottomLat * Math.PI) / 180) + 1 / Math.cos((bottomLat * Math.PI) / 180)) / Math.PI) / 2) * n);

  let tilesSvg = '';
  if (Math.abs(maxTileX - minTileX) + 1 <= 10 && Math.abs(maxTileY - minTileY) + 1 <= 10) {
    for (let tx = Math.min(minTileX, maxTileX); tx <= Math.max(minTileX, maxTileX); tx++) {
      for (let ty = Math.min(minTileY, maxTileY); ty <= Math.max(minTileY, maxTileY); ty++) {
        const tileBase64 = fetchSatelliteTileBase64Sync(zoom, ty, tx);
        if (!tileBase64) continue;

        const tileLng = (tx / n) * 360 - 180;
        const tileLat = (Math.atan(Math.sinh(Math.PI * (1 - (2 * ty) / n))) * 180) / Math.PI;
        const nextTileLng = ((tx + 1) / n) * 360 - 180;
        const nextTileLat = (Math.atan(Math.sinh(Math.PI * (1 - (2 * (ty + 1)) / n))) * 180) / Math.PI;

        const locTopLeft = toLocal([tileLat, tileLng]);
        const locBottomRight = toLocal([nextTileLat, nextTileLng]);

        const xPx = toSvgX(locTopLeft[0]);
        const yPx = toSvgY(locTopLeft[1]);
        const wPx = toSvgX(locBottomRight[0]) - xPx;
        const hPx = toSvgY(locBottomRight[1]) - yPx;

        tilesSvg += `<image href="${tileBase64}" x="${xPx.toFixed(2)}" y="${yPx.toFixed(2)}" width="${(wPx + 0.6).toFixed(2)}" height="${(hPx + 0.6).toFixed(2)}" preserveAspectRatio="none" />`;
      }
    }
  }

  let gridSvg = '';
  const gridStepM = 20;
  const hasTiles = tilesSvg.length > 0;
  const gridStroke = hasTiles ? 'rgba(255,255,255,0.14)' : '#e2e8f0';
  for (let gx = Math.floor((midX - viewW) / gridStepM) * gridStepM; gx <= Math.ceil((midX + viewW) / gridStepM) * gridStepM; gx += gridStepM) {
    const sx = toSvgX(gx);
    if (sx >= 0 && sx <= svgWidth) gridSvg += `<line x1="${sx.toFixed(1)}" y1="0" x2="${sx.toFixed(1)}" y2="${svgHeight}" stroke="${gridStroke}" stroke-width="0.6" />`;
  }
  for (let gy = Math.floor((midY - viewH) / gridStepM) * gridStepM; gy <= Math.ceil((midY + viewH) / gridStepM) * gridStepM; gy += gridStepM) {
    const sy = toSvgY(gy);
    if (sy >= 0 && sy <= svgHeight) gridSvg += `<line x1="0" y1="${sy.toFixed(1)}" x2="${svgWidth}" y2="${sy.toFixed(1)}" stroke="${gridStroke}" stroke-width="0.6" />`;
  }

  let corridorsSvg = '';
  for (const cor of corridorBoundaries) {
    if (!cor.coords || cor.coords.length < 2) continue;
    const pts = cor.coords.map((c) => {
      const lc = toLocal(c);
      return `${toSvgX(lc[0]).toFixed(1)},${toSvgY(lc[1]).toFixed(1)}`;
    });
    corridorsSvg += `<polyline points="${pts.join(' ')}" fill="none" stroke="${hasTiles ? '#fde047' : '#64748b'}" stroke-width="1.3" stroke-dasharray="5,3" opacity="0.9" />`;
  }

  let stationsSvg = '';
  for (const st of stations) {
    if (!st.coords || st.coords.length < 3) continue;
    const pts = st.coords.map((c) => {
      const lc = toLocal(c);
      return `${toSvgX(lc[0]).toFixed(1)},${toSvgY(lc[1]).toFixed(1)}`;
    });
    stationsSvg += `<polygon points="${pts.join(' ')}" fill="${hasTiles ? 'rgba(56,189,248,0.22)' : 'rgba(148,163,184,0.22)'}" stroke="${hasTiles ? '#38bdf8' : '#475569'}" stroke-width="1.4" stroke-dasharray="4,2" />`;
  }

  let centerlineSvg = '';
  if (centerline.length >= 2) {
    const pts = centerline.map((c) => {
      const lc = toLocal(c);
      return `${toSvgX(lc[0]).toFixed(1)},${toSvgY(lc[1]).toFixed(1)}`;
    });
    centerlineSvg = `
      <polyline points="${pts.join(' ')}" fill="none" stroke="#ffffff" stroke-width="3.6" opacity="${hasTiles ? '0.85' : '0.5'}" />
      <polyline points="${pts.join(' ')}" fill="none" stroke="#2563eb" stroke-width="2.2" stroke-dasharray="8,4" />
    `;
  }

  const parcelPts = localParcel.map((p) => `${toSvgX(p[0]).toFixed(1)},${toSvgY(p[1]).toFixed(1)}`).join(' ');
  const parcelCentroidX = toSvgX(localParcel.reduce((s, p) => s + p[0], 0) / localParcel.length);
  const parcelCentroidY = toSvgY(localParcel.reduce((s, p) => s + p[1], 0) / localParcel.length);

  let scaleM = 20;
  if (scale * 50 <= 90) scaleM = 50;
  else if (scale * 10 >= 35) scaleM = 10;
  const scaleBarPx = scaleM * scale;

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${svgWidth} ${svgHeight}" width="100%" height="100%" style="display:block; background:${hasTiles ? '#0f172a' : '#f8fafc'}; font-family:'Times New Roman', serif;">
    <defs>
      <clipPath id="mapViewportClip">
        <rect x="0" y="0" width="${svgWidth}" height="${svgHeight}" />
      </clipPath>
    </defs>
    <g clip-path="url(#mapViewportClip)">
      ${tilesSvg}
      ${gridSvg}
      ${corridorsSvg}
      ${stationsSvg}
      ${centerlineSvg}
      <polygon points="${parcelPts}" fill="rgba(239, 68, 68, 0.35)" stroke="#ffffff" stroke-width="3.2" stroke-linejoin="round" />
      <polygon points="${parcelPts}" fill="rgba(220, 38, 38, 0.28)" stroke="#dc2626" stroke-width="2" stroke-linejoin="round" />
      <circle cx="${parcelCentroidX.toFixed(1)}" cy="${parcelCentroidY.toFixed(1)}" r="3.2" fill="#dc2626" stroke="#ffffff" stroke-width="1.2" />
    </g>
    <g transform="translate(${svgWidth - 26}, 28)">
      <circle cx="0" cy="0" r="15" fill="rgba(15,23,42,0.72)" stroke="#ffffff" stroke-width="1" />
      <polygon points="0,-11 -4,3 0,0 4,3" fill="#ef4444" />
      <polygon points="0,9 -4,3 0,0 4,3" fill="#cbd5e1" />
      <text x="0" y="-17" text-anchor="middle" font-size="8.5" font-weight="bold" fill="${hasTiles ? '#ffffff' : '#0f172a'}">N</text>
    </g>
    <g transform="translate(12, ${svgHeight - 16})">
      <rect x="-4" y="-12" width="${(scaleBarPx + 36).toFixed(1)}" height="16" rx="2" fill="rgba(15,23,42,0.72)" />
      <line x1="2" y1="-3" x2="${(2 + scaleBarPx).toFixed(1)}" y2="-3" stroke="#ffffff" stroke-width="2" />
      <line x1="2" y1="-7" x2="2" y2="1" stroke="#ffffff" stroke-width="1.5" />
      <line x1="${(2 + scaleBarPx).toFixed(1)}" y1="-7" x2="${(2 + scaleBarPx).toFixed(1)}" y2="1" stroke="#ffffff" stroke-width="1.5" />
      <text x="${(6 + scaleBarPx).toFixed(1)}" y="-1" font-size="8" font-weight="bold" fill="#ffffff">${scaleM}m</text>
    </g>
  </svg>`;
}

