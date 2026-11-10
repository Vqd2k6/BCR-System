/**
 * ============================================================================
 * SPATIAL SVG RENDERING UTILS (PURE VISUALIZATION — ZERO DISTANCE CALCULATION)
 * Chỉ phục vụ trích xuất tọa độ đa giác đã lưu và dựng sơ đồ SVG Mục II theo ngôn ngữ nét
 * của Bình đồ khảo sát (frontend/src/features/zone-management/utils/zoneSvgTechnicalExporter.ts):
 * nền trắng, ranh thửa lân cận nét đen mảnh, thửa khảo sát tô đỏ nổi bật.
 * TUYỆT ĐỐI KHÔNG tự tính toán khoảng cách hoặc suy luận vùng ảnh hưởng.
 * ============================================================================
 */

import {
  getMetroBoundaryData,
  extractParcelPolygonCoords,
  fetchSatelliteTileBase64Sync,
  fetchSatelliteTileBase64,
  preloadSatelliteTiles,
} from "./satellite-tile.utils";

export {
  extractParcelPolygonCoords,
  fetchSatelliteTileBase64Sync,
  fetchSatelliteTileBase64,
  preloadSatelliteTiles,
};

function pointToSegmentProjection(
  pt: [number, number],
  v: [number, number],
  w: [number, number],
): { distance: number; projection: [number, number] } {
  const { mPerDegLat: latScale, mPerDegLng: lngScale } = metersPerDegreeWgs84(
    pt[0],
  );

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
 * Kích thước khung SVG sơ đồ (đơn vị SVG). Mặc định khổ dọc 3:4 (300x400);
 * Mục II báo cáo dùng khổ ngang để phủ kín bề ngang trang A4.
 */
export interface SpatialSvgSize {
  width: number;
  height: number;
}

/** Elipsoid WGS-84 (EPSG:4326): bán trục lớn a và bình phương tâm sai e². */
const WGS84_A = 6378137;
const WGS84_E2 = 0.00669437999014;

/**
 * Độ dài 1 độ vĩ / 1 độ kinh (mét) tại vĩ độ latDeg theo elipsoid WGS-84
 * (bán kính kinh tuyến M và bán kính vòng thẳng đứng N). Dùng cho phép chiếu phẳng cục bộ quanh thửa.
 */
export function metersPerDegreeWgs84(latDeg: number): {
  mPerDegLat: number;
  mPerDegLng: number;
} {
  const phi = (latDeg * Math.PI) / 180;
  const w = 1 - WGS84_E2 * Math.sin(phi) ** 2;
  return {
    mPerDegLat: (Math.PI * WGS84_A * (1 - WGS84_E2)) / (180 * w ** 1.5),
    mPerDegLng: (Math.PI * WGS84_A * Math.cos(phi)) / (180 * Math.sqrt(w)),
  };
}

const DEFAULT_SPATIAL_SVG_SIZE: SpatialSvgSize = { width: 300, height: 400 };
/*
 * ===== ĐỘ ZOOM SƠ ĐỒ MỤC II (chỉnh 3 hằng số dưới đây) =====
 * Khung gốc = max(phạm vi thửa + tim tuyến/ga + 80 m, MIN_VIEW_SHORT_SIDE_M),
 * sau đó chia cho SECTION_ZOOM_FACTOR, nhưng không bao giờ hẹp hơn mức cần để thấy
 * trọn thửa và điểm tim tuyến/ga gần nhất cộng FIT_MARGIN_M mỗi bên.
 */
/** Cạnh ngắn tối thiểu của khung gốc (mét), trước khi chia hệ số phóng. Tăng = thấy rộng hơn với thửa nhỏ. */
const MIN_VIEW_SHORT_SIDE_M = 50; //110
/** Hệ số phóng: lớn hơn = gần hơn (khung hẹp lại); 1 = không phóng thêm. Giảm (vd 1.6) để thấy nhiều thửa xung quanh. */
const SECTION_ZOOM_FACTOR = 3.5;
/** Đệm luôn giữ quanh thửa và điểm tim tuyến/ga (mét); giới hạn dưới của khung dù tăng hệ số phóng. */
const FIT_MARGIN_M = 2.5; //15
/** Chỉ dóng tới đường bao công trình ga khi ga trong phạm vi này (khớp màn Thẩm định). */
const STATION_LINE_MAX_M = 300;

/**
 * Cự ly đã lưu (chuỗi 1 chữ số thập phân, '' khi chưa có số) để in lên nhãn đường dóng.
 * Sơ đồ KHÔNG tự đo khoảng cách: chỉ vẽ nét minh họa và in đúng số đã lưu như bảng Mục II.
 */
export interface SpatialDistanceLabels {
  alignM: string;
  edgeM: string;
}

type Px = [number, number];

/**
 * Token nét theo Bình đồ khảo sát (zoneSvgTechnicalExporter.ts: màu lớp & GIS_LINE_WEIGHT),
 * quy đổi về đơn vị SVG của sơ đồ 870x300.
 */
const BINH_DO_STYLE = {
  background: "#ffffff",
  grid: "#eef2f6",
  neighbourStroke: "#1f2937",
  neighbourFill: "rgba(148,163,184,0.12)",
  neighbourWidth: 0.6,
  targetFill: "rgba(220,38,38,0.35)",
  targetStroke: "#b91c1c",
  targetWidth: 1.6,
  corridor: "#0284c7",
  corridorWidth: 1.1,
  corridorDash: "6,4",
  station: "#7c3aed",
  stationFill: "rgba(124,58,237,0.06)",
  stationWidth: 1.3,
  centerline: "#fe0000",
  centerlineWidth: 1.6,
  centerlineDash: "14,3,2.4,3",
  ink: "#111827",
} as const;

const LINE_ALIGN_COLOR = "#d97706";
const LINE_EDGE_COLOR = "#0284c7";
const LABEL_FONT_PX = 9;
const LABEL_H_PX = 12;
/** Đệm ngang mỗi bên của nhãn (px). */
const LABEL_PAD_X_PX = 4;
const LABEL_MIN_GAP_PX = 40;
const LABEL_NORMAL_SHIFT_PX = 10;

/** Cắt đoạn AB theo hình chữ nhật (Liang–Barsky); trả [t0, t1] phần nằm trong khung hoặc null. */
function clipSegmentToRect(
  a: Px,
  b: Px,
  minX: number,
  minY: number,
  maxX: number,
  maxY: number,
): [number, number] | null {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  let t0 = 0;
  let t1 = 1;
  const edges: Array<[number, number]> = [
    [-dx, a[0] - minX],
    [dx, maxX - a[0]],
    [-dy, a[1] - minY],
    [dy, maxY - a[1]],
  ];
  for (const [p, q] of edges) {
    if (p === 0) {
      if (q < 0) return null;
      continue;
    }
    const r = q / p;
    if (p < 0) {
      if (r > t1) return null;
      if (r > t0) t0 = r;
    } else {
      if (r < t0) return null;
      if (r < t1) t1 = r;
    }
  }
  return [t0, t1];
}

/** Góc xoay nhãn song song đường dóng, chuẩn hoá về [-90°, 90°] để chữ luôn đọc xuôi. */
function readableAngleDeg(a: Px, b: Px): number {
  let angle = (Math.atan2(b[1] - a[1], b[0] - a[0]) * 180) / Math.PI;
  if (angle > 90) angle -= 180;
  else if (angle < -90) angle += 180;
  return angle;
}

function escapeSvgText(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

/**
 * Sinh sơ đồ vị trí thửa đất & tuyến Metro 2 (mặc định khổ dọc 300x400, truyền size để đổi khổ)
 */
export function generateMetroSpatialVisualSvg(
  polygonCoords: [number, number][] | null,
  _parcelCode: string = "Thửa đất",
  boundaryDataInput?: any,
  size: SpatialSvgSize = DEFAULT_SPATIAL_SVG_SIZE,
  distanceLabels?: SpatialDistanceLabels,
  neighbourRings: [number, number][][] = [],
): string {
  const boundaryData = boundaryDataInput || getMetroBoundaryData();
  if (!polygonCoords || polygonCoords.length < 3) {
    return "";
  }

  const normalizedCoords = polygonCoords.map(
    (p) => (p[0] > p[1] ? [p[1], p[0]] : p) as [number, number],
  );
  const centerline: [number, number][] = boundaryData?.centerline || [];
  const stations: Array<{ name: string; coords: [number, number][] }> =
    boundaryData?.stationDetailedFootprints || [];
  const corridorBoundaries: Array<{
    name: string;
    coords: [number, number][];
  }> = boundaryData?.corridorBoundaries || [];

  let minCenterDist = Infinity;
  let bestCenterProj: [number, number] = [0, 0];
  let bestCenterVertex: [number, number] = normalizedCoords[0];
  for (const v of normalizedCoords) {
    for (let i = 0; i < centerline.length - 1; i++) {
      const d = pointToSegmentProjection(v, centerline[i], centerline[i + 1]);
      if (d.distance < minCenterDist) {
        minCenterDist = d.distance;
        bestCenterProj = d.projection;
        bestCenterVertex = v;
      }
    }
  }

  // Cặp điểm gần nhất thửa ↔ đường bao ga, chiếu 2 chiều như màn Thẩm định (chỉ dùng để vẽ).
  let minStDist = Infinity;
  let bestStProj: [number, number] = [0, 0];
  let bestStVertex: [number, number] = normalizedCoords[0];
  const parcelLen = normalizedCoords.length;
  for (const st of stations) {
    if (!st.coords || st.coords.length < 2) continue;
    for (const v of normalizedCoords) {
      for (let j = 0; j < st.coords.length; j++) {
        const p1 = st.coords[j];
        const p2 = st.coords[(j + 1) % st.coords.length];
        const d = pointToSegmentProjection(v, p1, p2);
        if (d.distance < minStDist) {
          minStDist = d.distance;
          bestStProj = d.projection;
          bestStVertex = v;
        }
      }
    }
    for (const sv of st.coords) {
      for (let j = 0; j < parcelLen; j++) {
        const d = pointToSegmentProjection(
          sv,
          normalizedCoords[j],
          normalizedCoords[(j + 1) % parcelLen],
        );
        if (d.distance < minStDist) {
          minStDist = d.distance;
          bestStProj = sv;
          bestStVertex = d.projection;
        }
      }
    }
  }

  const parcelCenterLat =
    normalizedCoords.reduce((s, p) => s + p[0], 0) / normalizedCoords.length;
  const parcelCenterLng =
    normalizedCoords.reduce((s, p) => s + p[1], 0) / normalizedCoords.length;
  const { mPerDegLat, mPerDegLng } = metersPerDegreeWgs84(parcelCenterLat);
  const toLocal = (p: [number, number]): [number, number] => [
    (p[1] - parcelCenterLng) * mPerDegLng,
    (p[0] - parcelCenterLat) * mPerDegLat,
  ];

  const localParcel = normalizedCoords.map(toLocal);
  const localCenterProj = toLocal(bestCenterProj);
  const hasStation = minStDist < 250 && minStDist < Infinity;
  const localStProj = toLocal(bestStProj);

  const focusPts: [number, number][] = [...localParcel];
  if (minCenterDist < 1000 && minCenterDist < Infinity)
    focusPts.push(localCenterProj);
  if (hasStation) focusPts.push(localStProj);

  const fMinX = Math.min(...focusPts.map((p) => p[0]));
  const fMaxX = Math.max(...focusPts.map((p) => p[0]));
  const fMinY = Math.min(...focusPts.map((p) => p[1]));
  const fMaxY = Math.max(...focusPts.map((p) => p[1]));

  const spanX = fMaxX - fMinX;
  const spanY = fMaxY - fMinY;

  // Tâm khung: trung điểm giữa tâm thửa (gốc local [0,0]) và điểm gần thửa nhất trên viền ga;
  // không có ga gần thì lấy trung điểm thửa – tim tuyến; không có cả hai thì lấy tâm thửa.
  const hasCenterline = minCenterDist < 1000 && minCenterDist < Infinity;
  const anchorPt: [number, number] | null = hasStation
    ? localStProj
    : hasCenterline
      ? localCenterProj
      : null;
  const midX = anchorPt ? anchorPt[0] / 2 : 0;
  const midY = anchorPt ? anchorPt[1] / 2 : 0;
  const mustSeePts: [number, number][] = anchorPt
    ? [...localParcel, anchorPt]
    : [...localParcel];

  const svgWidth = size.width;
  const svgHeight = size.height;
  const aspectRatio = svgWidth / svgHeight;
  const fitAspect = (w: number, h: number): [number, number] =>
    w / h < aspectRatio ? [h * aspectRatio, h] : [w, w / aspectRatio];

  const minViewW =
    aspectRatio >= 1
      ? MIN_VIEW_SHORT_SIDE_M * aspectRatio
      : MIN_VIEW_SHORT_SIDE_M;
  const minViewH =
    aspectRatio >= 1
      ? MIN_VIEW_SHORT_SIDE_M
      : MIN_VIEW_SHORT_SIDE_M / aspectRatio;
  let [viewW, viewH] = fitAspect(
    Math.max(spanX + 80, minViewW),
    Math.max(spanY + 80, minViewH),
  );

  // Phóng to thêm 25%, nhưng không bao giờ cắt thửa hoặc điểm ga/tim tuyến ra khỏi khung.
  viewW /= SECTION_ZOOM_FACTOR;
  viewH /= SECTION_ZOOM_FACTOR;
  const needW =
    2 * Math.max(...mustSeePts.map((p) => Math.abs(p[0] - midX))) +
    2 * FIT_MARGIN_M;
  const needH =
    2 * Math.max(...mustSeePts.map((p) => Math.abs(p[1] - midY))) +
    2 * FIT_MARGIN_M;
  [viewW, viewH] = fitAspect(Math.max(viewW, needW), Math.max(viewH, needH));

  const padPx = 15;
  const scale = Math.min(
    (svgWidth - 2 * padPx) / viewW,
    (svgHeight - 2 * padPx) / viewH,
  );
  const cxPx = svgWidth / 2;
  const cyPx = svgHeight / 2;

  const toSvgX = (xM: number) => cxPx + (xM - midX) * scale;
  const toSvgY = (yM: number) => cyPx - (yM - midY) * scale;

  const ptsOf = (ring: [number, number][]) =>
    ring
      .map((c) => {
        const lc = toLocal(c);
        return `${toSvgX(lc[0]).toFixed(1)},${toSvgY(lc[1]).toFixed(1)}`;
      })
      .join(" ");

  // Lưới mảnh 20 m giúp đọc tỉ lệ (như lưới Bình đồ), không lấn nét thửa.
  let gridSvg = "";
  const gridStepM = 20;
  for (
    let gx = Math.floor((midX - viewW) / gridStepM) * gridStepM;
    gx <= Math.ceil((midX + viewW) / gridStepM) * gridStepM;
    gx += gridStepM
  ) {
    const sx = toSvgX(gx);
    if (sx >= 0 && sx <= svgWidth)
      gridSvg += `<line x1="${sx.toFixed(1)}" y1="0" x2="${sx.toFixed(1)}" y2="${svgHeight}" stroke="${BINH_DO_STYLE.grid}" stroke-width="0.5" />`;
  }
  for (
    let gy = Math.floor((midY - viewH) / gridStepM) * gridStepM;
    gy <= Math.ceil((midY + viewH) / gridStepM) * gridStepM;
    gy += gridStepM
  ) {
    const sy = toSvgY(gy);
    if (sy >= 0 && sy <= svgHeight)
      gridSvg += `<line x1="0" y1="${sy.toFixed(1)}" x2="${svgWidth}" y2="${sy.toFixed(1)}" stroke="${BINH_DO_STYLE.grid}" stroke-width="0.5" />`;
  }

  // Thửa lân cận: chỉ vẽ ranh, không nhãn. Bỏ vòng trùng thửa khảo sát (dữ liệu nhân bản).
  const targetKey = ptsOf(normalizedCoords);
  let neighboursSvg = "";
  for (const ring of neighbourRings) {
    if (!Array.isArray(ring) || ring.length < 3) continue;
    const pts = ptsOf(
      ring.map((p) => (p[0] > p[1] ? [p[1], p[0]] : p) as [number, number]),
    );
    if (pts === targetKey) continue;
    neighboursSvg += `<polygon points="${pts}" />`;
  }

  let corridorsSvg = "";
  for (const cor of corridorBoundaries) {
    if (!cor.coords || cor.coords.length < 2) continue;
    corridorsSvg += `<polyline points="${ptsOf(cor.coords)}" />`;
  }

  let stationsSvg = "";
  for (const st of stations) {
    if (!st.coords || st.coords.length < 3) continue;
    stationsSvg += `<polygon points="${ptsOf(st.coords)}" />`;
  }

  const centerlineSvg =
    centerline.length >= 2 ? `<polyline points="${ptsOf(centerline)}" />` : "";

  // Thước tỉ lệ: đoạn tròn số mét gần 1/5 bề ngang khung.
  const niceSteps = [5, 10, 20, 25, 50, 100, 200];
  const targetBarM = viewW / 5;
  const barM = niceSteps.reduce(
    (best, v) =>
      Math.abs(v - targetBarM) < Math.abs(best - targetBarM) ? v : best,
    niceSteps[0],
  );
  const barPx = barM * scale;
  const scaleBarSvg = `<g transform="translate(14, ${svgHeight - 16})" font-size="8" fill="${BINH_DO_STYLE.ink}">
      <rect x="-4" y="-12" width="${(barPx + 34).toFixed(1)}" height="20" fill="rgba(255,255,255,0.9)" />
      <rect x="0" y="-3" width="${(barPx / 2).toFixed(1)}" height="4" fill="${BINH_DO_STYLE.ink}" />
      <rect x="${(barPx / 2).toFixed(1)}" y="-3" width="${(barPx / 2).toFixed(1)}" height="4" fill="#ffffff" stroke="${BINH_DO_STYLE.ink}" stroke-width="0.6" />
      <rect x="0" y="-3" width="${barPx.toFixed(1)}" height="4" fill="none" stroke="${BINH_DO_STYLE.ink}" stroke-width="0.6" />
      <text x="0" y="-5">0</text>
      <text x="${barPx.toFixed(1)}" y="-5" text-anchor="middle">${barM} m</text>
    </g>`;

  const parcelPts = localParcel
    .map((p) => `${toSvgX(p[0]).toFixed(1)},${toSvgY(p[1]).toFixed(1)}`)
    .join(" ");
  const parcelCentroidX = toSvgX(
    localParcel.reduce((s, p) => s + p[0], 0) / localParcel.length,
  );
  const parcelCentroidY = toSvgY(
    localParcel.reduce((s, p) => s + p[1], 0) / localParcel.length,
  );

  // ---------------- Đường dóng & nhãn cự ly (số đã lưu, không tự đo) ----------------
  const toPx = (p: [number, number]): Px => {
    const lc = toLocal(p);
    return [toSvgX(lc[0]), toSvgY(lc[1])];
  };
  const alignText = distanceLabels?.alignM ?? "";
  const edgeText = distanceLabels?.edgeM ?? "";
  const showAlign =
    alignText !== "" && centerline.length >= 2 && minCenterDist < Infinity;
  const stationNear = minStDist < STATION_LINE_MAX_M;
  const showEdge = edgeText !== "" && stationNear;
  const edgeIsZero = showEdge && Number(edgeText) === 0;

  interface DistanceLine {
    a: Px;
    b: Px;
    color: string;
    dash: string;
    width: number;
    text: string;
    visible: [number, number] | null;
  }
  const VIS_MARGIN = 6;
  const makeLine = (
    a: Px,
    b: Px,
    color: string,
    dash: string,
    width: number,
    text: string,
  ): DistanceLine => ({
    a,
    b,
    color,
    dash,
    width,
    text,
    visible: clipSegmentToRect(
      a,
      b,
      VIS_MARGIN,
      VIS_MARGIN,
      svgWidth - VIS_MARGIN,
      svgHeight - VIS_MARGIN,
    ),
  });

  const drawnLines: DistanceLine[] = [];
  const alignLine = showAlign
    ? makeLine(
        toPx(bestCenterVertex),
        toPx(bestCenterProj),
        LINE_ALIGN_COLOR,
        "6,4",
        2.4,
        `${alignText} m`,
      )
    : null;
  if (alignLine) drawnLines.push(alignLine);
  const edgeLine =
    showEdge && !edgeIsZero
      ? makeLine(
          toPx(bestStVertex),
          toPx(bestStProj),
          LINE_EDGE_COLOR,
          "4,3",
          2.2,
          `${edgeText} m`,
        )
      : null;
  if (edgeLine) drawnLines.push(edgeLine);

  let distanceLinesSvg = "";
  for (const ln of drawnLines) {
    const coords = `x1="${ln.a[0].toFixed(1)}" y1="${ln.a[1].toFixed(1)}" x2="${ln.b[0].toFixed(1)}" y2="${ln.b[1].toFixed(1)}"`;
    distanceLinesSvg += `<line ${coords} stroke="#ffffff" stroke-width="${(ln.width + 1.6).toFixed(1)}" stroke-linecap="round" />`;
    distanceLinesSvg += `<line ${coords} stroke="${ln.color}" stroke-width="${ln.width}" stroke-dasharray="${ln.dash}" stroke-linecap="round" />`;
    for (const p of [ln.a, ln.b]) {
      distanceLinesSvg += `<circle cx="${p[0].toFixed(1)}" cy="${p[1].toFixed(1)}" r="2.5" fill="${ln.color}" stroke="#ffffff" stroke-width="1" />`;
    }
  }

  interface DistanceLabel {
    x: number;
    y: number;
    angle: number;
    text: string;
    color: string;
  }
  const pointOnVisible = (ln: DistanceLine, f: number): Px => {
    const [t0, t1] = ln.visible ?? [0, 1];
    const t = t0 + (t1 - t0) * f;
    return [
      ln.a[0] + (ln.b[0] - ln.a[0]) * t,
      ln.a[1] + (ln.b[1] - ln.a[1]) * t,
    ];
  };
  const unitNormal = (ln: DistanceLine): Px => {
    const dx = ln.b[0] - ln.a[0];
    const dy = ln.b[1] - ln.a[1];
    const len = Math.hypot(dx, dy) || 1;
    return [-dy / len, dx / len];
  };
  // Ước lượng bề rộng chữ Times New Roman đậm theo từng ký tự (em) để đệm nhãn sát chữ.
  const charEm = (ch: string) =>
    /[0-9]/.test(ch)
      ? 0.5
      : ch === "." || ch === " "
        ? 0.25
        : ch === "m"
          ? 0.83
          : 0.56;
  const labelWidth = (text: string) =>
    [...text].reduce((s, ch) => s + charEm(ch), 0) * LABEL_FONT_PX +
    2 * LABEL_PAD_X_PX;

  const labels: DistanceLabel[] = [];
  const lineLabelFor = (
    ln: DistanceLine,
    f: number,
    shift: number,
  ): DistanceLabel => {
    const p = pointOnVisible(ln, f);
    const n = unitNormal(ln);
    return {
      x: p[0] + n[0] * shift,
      y: p[1] + n[1] * shift,
      angle: readableAngleDeg(ln.a, ln.b),
      text: ln.text,
      color: ln.color,
    };
  };
  const labelGap = (l1: DistanceLabel, l2: DistanceLabel) =>
    Math.hypot(l1.x - l2.x, l1.y - l2.y);

  const visibleLines = drawnLines.filter((ln) => ln.visible !== null);
  if (visibleLines.length === 2) {
    const [l1, l2] = visibleLines;
    let lab1 = lineLabelFor(l1, 0.5, 0);
    let lab2 = lineLabelFor(l2, 0.5, 0);
    if (labelGap(lab1, lab2) < LABEL_MIN_GAP_PX) {
      lab1 = lineLabelFor(l1, 0.35, 0);
      lab2 = lineLabelFor(l2, 0.65, 0);
    }
    if (labelGap(lab1, lab2) < LABEL_MIN_GAP_PX) {
      lab1 = lineLabelFor(l1, 0.35, LABEL_NORMAL_SHIFT_PX);
      lab2 = lineLabelFor(l2, 0.65, -LABEL_NORMAL_SHIFT_PX);
    }
    labels.push(lab1, lab2);
  } else if (visibleLines.length === 1) {
    labels.push(lineLabelFor(visibleLines[0], 0.5, 0));
  }

  // Ga cán qua thửa (cự ly đã lưu = 0): không có đường dóng, đặt nhãn sát thửa.
  if (edgeIsZero) {
    const zeroLabel: DistanceLabel = {
      x: parcelCentroidX,
      y: parcelCentroidY - 20,
      angle: 0,
      text: `${edgeText} m`,
      color: LINE_EDGE_COLOR,
    };
    if (labels.some((l) => labelGap(l, zeroLabel) < LABEL_MIN_GAP_PX)) {
      zeroLabel.y = parcelCentroidY + 20;
    }
    labels.push(zeroLabel);
  }

  let distanceLabelsSvg = "";
  for (const lab of labels) {
    const w = labelWidth(lab.text);
    const rad = (lab.angle * Math.PI) / 180;
    const hx =
      (Math.abs(Math.cos(rad)) * w) / 2 +
      (Math.abs(Math.sin(rad)) * LABEL_H_PX) / 2;
    const hy =
      (Math.abs(Math.sin(rad)) * w) / 2 +
      (Math.abs(Math.cos(rad)) * LABEL_H_PX) / 2;
    const x = Math.min(Math.max(lab.x, hx + 4), svgWidth - hx - 4);
    let y = Math.min(Math.max(lab.y, hy + 4), svgHeight - hy - 4);
    // Tránh vùng la bàn ở góc trên phải.
    if (x + hx > svgWidth - 46 && y - hy < 48) y = 48 + hy;
    distanceLabelsSvg += `<g transform="translate(${x.toFixed(1)}, ${y.toFixed(1)}) rotate(${lab.angle.toFixed(1)})">
      <rect x="${(-w / 2).toFixed(1)}" y="${(-LABEL_H_PX / 2).toFixed(1)}" width="${w.toFixed(1)}" height="${LABEL_H_PX}" rx="3" fill="rgba(255,255,255,0.92)" stroke="${lab.color}" stroke-width="1" />
      <text x="0" y="3.2" text-anchor="middle" font-size="${LABEL_FONT_PX}" font-weight="bold" fill="#0f172a">${escapeSvgText(lab.text)}</text>
    </g>`;
  }

  const codeText = escapeSvgText(_parcelCode || "");
  const S = BINH_DO_STYLE;
  const svgMarkup = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${svgWidth} ${svgHeight}" width="100%" height="100%" style="display:block; background:${S.background}; font-family:'Times New Roman', serif;">
    <defs>
      <clipPath id="mapViewportClip">
        <rect x="0" y="0" width="${svgWidth}" height="${svgHeight}" />
      </clipPath>
    </defs>
    <rect x="0" y="0" width="${svgWidth}" height="${svgHeight}" fill="${S.background}" />
    <g clip-path="url(#mapViewportClip)">
      ${gridSvg}
      <g id="thua-lan-can" fill="${S.neighbourFill}" stroke="${S.neighbourStroke}" stroke-width="${S.neighbourWidth}" stroke-linejoin="round">${neighboursSvg}</g>
      <g id="cong-trinh-nha-ga" fill="${S.stationFill}" stroke="${S.station}" stroke-width="${S.stationWidth}" stroke-linejoin="round">${stationsSvg}</g>
      <g id="mep-ho-dao" fill="none" stroke="${S.corridor}" stroke-width="${S.corridorWidth}" stroke-dasharray="${S.corridorDash}">${corridorsSvg}</g>
      <g id="tim-tuyen" fill="none" stroke="${S.centerline}" stroke-width="${S.centerlineWidth}" stroke-dasharray="${S.centerlineDash}">${centerlineSvg}</g>
      <polygon id="thua-khao-sat" points="${parcelPts}" fill="${S.targetFill}" stroke="${S.targetStroke}" stroke-width="${S.targetWidth}" stroke-linejoin="round" />
      ${distanceLinesSvg}
      ${codeText ? `<text x="${parcelCentroidX.toFixed(1)}" y="${(parcelCentroidY + 3).toFixed(1)}" text-anchor="middle" font-size="9" font-weight="bold" fill="${S.targetStroke}" stroke="#ffffff" stroke-width="2.4" paint-order="stroke">${codeText}</text>` : ""}
    </g>
    ${distanceLabelsSvg}
    ${scaleBarSvg}
    <g transform="translate(${svgWidth - 26}, 28)">
      <circle cx="0" cy="0" r="15" fill="#ffffff" stroke="${S.ink}" stroke-width="0.8" />
      <polygon points="0,-11 -4,3 0,0 4,3" fill="${S.ink}" />
      <polygon points="0,9 -4,3 0,0 4,3" fill="#ffffff" stroke="${S.ink}" stroke-width="0.6" />
      <text x="0" y="-17" text-anchor="middle" font-size="8.5" font-weight="bold" fill="${S.ink}">N</text>
    </g>
  </svg>`;

  return `data:image/svg+xml;base64,${Buffer.from(svgMarkup, "utf8").toString("base64")}`;
}
