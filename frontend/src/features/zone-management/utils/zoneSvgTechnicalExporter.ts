/**
 * Xuất bình đồ kỹ thuật SVG theo Zone.
 * Module thuần (không phụ thuộc DOM ngoài downloadSvgFile) để kiểm thử được ngoài trình duyệt.
 * Toàn bộ tọa độ đầu vào theo thứ tự Leaflet [lat, lng]; đơn vị trang vẽ là mm.
 */

type LatLng = [number, number];
type Point = [number, number];

export interface SvgParcelInput {
  code: string;
  isCondoMaster: boolean;
  ring: LatLng[];
}

export interface SvgGeometryInput {
  name: string;
  coords: LatLng[];
}

export interface SvgExportOptions {
  zoneCode: string;
  zoneName: string;
  parcels: SvgParcelInput[];
  centerlineCoords: LatLng[];
  corridorBoundaries: SvgGeometryInput[];
  stationBoxes: SvgGeometryInput[];
  stationOutlines: SvgGeometryInput[];
  autoRotateHorizontal?: boolean;
  includeCompass?: boolean;
  includeLabels?: boolean;
  exportedAt?: Date;
}

export interface ZoneSvgResult {
  svg: string;
  rotationDeg: number;
  scaleDenominator: number;
  residualMeters: number;
  parcelCount: number;
  skippedParcels: number;
}

const METERS_PER_DEGREE = 111320;
const PX_TO_MM = 0.2646;

// Trọng số nét lấy theo ParcelsLayer và MetroGisOverlays; chỉnh GIS_PX_TO_MM để toàn bản vẽ mảnh hoặc đậm hơn
const GIS_PX_TO_MM = 0.07;
const GIS_LINE_WEIGHT = {
  parcel: 1.5,
  condoMaster: 2.5,
  stationOutline: 2.5,
  stationBox: 2,
  corridor: 2,
  centerline: 3.5,
};

const PAGE_WIDTH_MM = 420;
const PAGE_HEIGHT_MM = 297;
const PAGE_MARGIN_MM = 8;
const SIDE_STRIP_WIDTH_MM = 30;

const DRAW_RECT = {
  minX: PAGE_MARGIN_MM,
  minY: PAGE_MARGIN_MM,
  maxX: PAGE_WIDTH_MM - PAGE_MARGIN_MM - SIDE_STRIP_WIDTH_MM,
  maxY: PAGE_HEIGHT_MM - PAGE_MARGIN_MM,
};

const LABEL_MAX_FONT_MM = 13 * PX_TO_MM;
const LABEL_HORIZONTAL_MIN_FONT_MM = 8 * PX_TO_MM;
const LABEL_MIN_FONT_MM = 0.02;
const LABEL_SAFETY_FACTOR = 0.96;
const LABEL_CHAR_WIDTH_EM = 0.62;
const LABEL_BASELINE_SHIFT_EM = 0.35;
const FONT_FAMILY = "Arial, Helvetica, sans-serif";

const mm = (px: number): string => (px * PX_TO_MM).toFixed(3);
const lineWidth = (gisWeight: number): string =>
  (gisWeight * GIS_PX_TO_MM).toFixed(3);
const fmt = (value: number): string => {
  const rounded = value.toFixed(3);
  return rounded === "-0.000" ? "0.000" : rounded;
};

export const escapeXml = (value: string): string =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");

/** Lý do không cho xuất; null nghĩa là được phép. */
export const getSvgExportDisabledReason = (
  zoneId: string,
  parcelCount: number,
): string | null => {
  const zone = zoneId.trim().toUpperCase();
  if (!zone || zone === "ALL" || zone === "ALL_ZONES") {
    return "Chọn một Zone cụ thể để xuất bình đồ";
  }
  if (parcelCount === 0) {
    return "Zone này chưa có thửa đất để xuất bình đồ";
  }
  return null;
};

const openRing = <T extends Point>(ring: T[]): T[] => {
  if (ring.length < 2) return ring;
  const first = ring[0];
  const last = ring[ring.length - 1];
  return first[0] === last[0] && first[1] === last[1]
    ? ring.slice(0, -1)
    : ring;
};

const isPointInRing = (point: Point, ring: Point[]): boolean => {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (
      yi > point[1] !== yj > point[1] &&
      point[0] < ((xj - xi) * (point[1] - yi)) / (yj - yi) + xi
    ) {
      inside = !inside;
    }
  }
  return inside;
};

const distanceToSegmentSquared = (p: Point, a: Point, b: Point): number => {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const lengthSquared = dx * dx + dy * dy;
  const t =
    lengthSquared === 0
      ? 0
      : Math.max(
          0,
          Math.min(
            1,
            ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / lengthSquared,
          ),
        );
  const ex = p[0] - a[0] - t * dx;
  const ey = p[1] - a[1] - t * dy;
  return ex * ex + ey * ey;
};

const distanceToRing = (point: Point, ring: Point[]): number => {
  let minSquared = Infinity;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    minSquared = Math.min(
      minSquared,
      distanceToSegmentSquared(point, ring[j], ring[i]),
    );
  }
  return Math.sqrt(minSquared);
};

/** Chỉ số đoạn tim tuyến gần điểm nhất. */
const nearestSegmentIndex = (point: Point, line: Point[]): number => {
  let bestIndex = 0;
  let bestDistance = Infinity;
  for (let i = 0; i < line.length - 1; i++) {
    const distance = distanceToSegmentSquared(point, line[i], line[i + 1]);
    if (distance < bestDistance) {
      bestDistance = distance;
      bestIndex = i;
    }
  }
  return bestIndex;
};

/** Góc trục chính của polyline (hệ trang, y xuống), trọng số theo chiều dài đoạn. Kết quả thuộc (-π/2, π/2]. */
const principalAxisAngle = (line: Point[]): number => {
  let totalLength = 0;
  let meanX = 0;
  let meanY = 0;
  const segments = line.slice(1).map((point, index) => {
    const start = line[index];
    const length = Math.hypot(point[0] - start[0], point[1] - start[1]);
    const mid: Point = [(point[0] + start[0]) / 2, (point[1] + start[1]) / 2];
    totalLength += length;
    meanX += mid[0] * length;
    meanY += mid[1] * length;
    return { mid, length };
  });
  meanX /= totalLength;
  meanY /= totalLength;

  let sxx = 0;
  let syy = 0;
  let sxy = 0;
  segments.forEach(({ mid, length }) => {
    sxx += length * (mid[0] - meanX) ** 2;
    syy += length * (mid[1] - meanY) ** 2;
    sxy += length * (mid[0] - meanX) * (mid[1] - meanY);
  });
  return 0.5 * Math.atan2(2 * sxy, sxx - syy);
};

/** Liang–Barsky: cắt một đoạn vào khung vẽ, trả null nếu nằm ngoài hoàn toàn. */
const clipSegment = (a: Point, b: Point): [Point, Point] | null => {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const checks: [number, number][] = [
    [-dx, a[0] - DRAW_RECT.minX],
    [dx, DRAW_RECT.maxX - a[0]],
    [-dy, a[1] - DRAW_RECT.minY],
    [dy, DRAW_RECT.maxY - a[1]],
  ];
  let t0 = 0;
  let t1 = 1;
  for (const [p, q] of checks) {
    if (p === 0) {
      if (q < 0) return null;
    } else {
      const r = q / p;
      if (p < 0) t0 = Math.max(t0, r);
      else t1 = Math.min(t1, r);
      if (t0 > t1) return null;
    }
  }
  return [
    [a[0] + t0 * dx, a[1] + t0 * dy],
    [a[0] + t1 * dx, a[1] + t1 * dy],
  ];
};

const clipPolyline = (line: Point[]): Point[][] => {
  const chunks: Point[][] = [];
  let current: Point[] = [];
  for (let i = 0; i < line.length - 1; i++) {
    const clipped = clipSegment(line[i], line[i + 1]);
    if (!clipped) {
      if (current.length > 1) chunks.push(current);
      current = [];
      continue;
    }
    const [start, end] = clipped;
    const last = current[current.length - 1];
    if (!last || last[0] !== start[0] || last[1] !== start[1]) {
      if (current.length > 1) chunks.push(current);
      current = [start];
    }
    current.push(end);
  }
  if (current.length > 1) chunks.push(current);
  return chunks;
};

/** Sutherland–Hodgman với khung vẽ chữ nhật. */
const clipPolygon = (polygon: Point[]): Point[] => {
  const edges: {
    inside: (p: Point) => boolean;
    cross: (a: Point, b: Point) => Point;
  }[] = [
    {
      inside: (p) => p[0] >= DRAW_RECT.minX,
      cross: (a, b) => [
        DRAW_RECT.minX,
        a[1] + ((b[1] - a[1]) * (DRAW_RECT.minX - a[0])) / (b[0] - a[0]),
      ],
    },
    {
      inside: (p) => p[0] <= DRAW_RECT.maxX,
      cross: (a, b) => [
        DRAW_RECT.maxX,
        a[1] + ((b[1] - a[1]) * (DRAW_RECT.maxX - a[0])) / (b[0] - a[0]),
      ],
    },
    {
      inside: (p) => p[1] >= DRAW_RECT.minY,
      cross: (a, b) => [
        a[0] + ((b[0] - a[0]) * (DRAW_RECT.minY - a[1])) / (b[1] - a[1]),
        DRAW_RECT.minY,
      ],
    },
    {
      inside: (p) => p[1] <= DRAW_RECT.maxY,
      cross: (a, b) => [
        a[0] + ((b[0] - a[0]) * (DRAW_RECT.maxY - a[1])) / (b[1] - a[1]),
        DRAW_RECT.maxY,
      ],
    },
  ];

  let output = polygon;
  for (const { inside, cross } of edges) {
    const input = output;
    output = [];
    input.forEach((current, index) => {
      const previous = input[(index + input.length - 1) % input.length];
      if (inside(current)) {
        if (!inside(previous)) output.push(cross(previous, current));
        output.push(current);
      } else if (inside(previous)) {
        output.push(cross(previous, current));
      }
    });
    if (output.length === 0) return [];
  }
  return output;
};

const toPathData = (points: Point[], closed: boolean): string =>
  `M${points.map(([x, y]) => `${fmt(x)} ${fmt(y)}`).join("L")}${closed ? "Z" : ""}`;

/** Điểm nằm sâu nhất trong thửa (pole of inaccessibility) bằng lưới tinh dần. */
const findLabelAnchor = (ring: Point[]): Point | null => {
  const xs = ring.map((p) => p[0]);
  const ys = ring.map((p) => p[1]);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);

  for (const gridSize of [16, 64]) {
    let best: Point | null = null;
    let bestDistance = -1;
    let centerX = (minX + maxX) / 2;
    let centerY = (minY + maxY) / 2;
    let halfWidth = (maxX - minX) / 2;
    let halfHeight = (maxY - minY) / 2;

    for (let level = 0; level < 6; level++) {
      for (let i = 0; i < gridSize; i++) {
        for (let j = 0; j < gridSize; j++) {
          const candidate: Point = [
            centerX - halfWidth + ((i + 0.5) * 2 * halfWidth) / gridSize,
            centerY - halfHeight + ((j + 0.5) * 2 * halfHeight) / gridSize,
          ];
          if (!isPointInRing(candidate, ring)) continue;
          const distance = distanceToRing(candidate, ring);
          if (distance > bestDistance) {
            bestDistance = distance;
            best = candidate;
          }
        }
      }
      if (!best) break;
      [centerX, centerY] = best;
      halfWidth *= 4 / gridSize;
      halfHeight *= 4 / gridSize;
    }
    if (best) return best;
  }
  return null;
};

/** Tâm diện tích; có thể nằm ngoài thửa lõm nên chỉ dùng làm ứng viên. */
const areaCentroid = (ring: Point[]): Point | null => {
  let doubleArea = 0;
  let cx = 0;
  let cy = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const cross = ring[j][0] * ring[i][1] - ring[i][0] * ring[j][1];
    doubleArea += cross;
    cx += (ring[j][0] + ring[i][0]) * cross;
    cy += (ring[j][1] + ring[i][1]) * cross;
  }
  if (doubleArea === 0) return null;
  const centroid: Point = [cx / (3 * doubleArea), cy / (3 * doubleArea)];
  return isPointInRing(centroid, ring) ? centroid : null;
};

/** Chuẩn hóa góc chữ về (-90°, 90°] để không bị lộn ngược. */
const normalizeTextAngle = (degrees: number): number => {
  let angle = degrees % 180;
  if (angle > 90) angle -= 180;
  if (angle <= -90) angle += 180;
  return angle;
};

const longestEdgeAngle = (ring: Point[]): number => {
  let longest = 0;
  let angle = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const dx = ring[i][0] - ring[j][0];
    const dy = ring[i][1] - ring[j][1];
    const length = Math.hypot(dx, dy);
    if (length > longest) {
      longest = length;
      angle = (Math.atan2(dy, dx) * 180) / Math.PI;
    }
  }
  return normalizeTextAngle(angle);
};

/** Kiểm tra khung chữ: 4 góc và các điểm trung gian trên chu vi đều phải nằm trong thửa. */
const labelBoxFits = (
  center: Point,
  angleDeg: number,
  fontSize: number,
  charCount: number,
  ring: Point[],
): boolean => {
  const halfWidth = (charCount * LABEL_CHAR_WIDTH_EM * fontSize) / 2;
  const halfHeight = fontSize / 2;
  const radians = (angleDeg * Math.PI) / 180;
  const cos = Math.cos(radians);
  const sin = Math.sin(radians);

  for (let i = -4; i <= 4; i++) {
    for (let j = -2; j <= 2; j++) {
      if (Math.abs(i) !== 4 && Math.abs(j) !== 2) continue;
      const u = (i / 4) * halfWidth;
      const v = (j / 2) * halfHeight;
      if (
        !isPointInRing(
          [center[0] + u * cos - v * sin, center[1] + u * sin + v * cos],
          ring,
        )
      ) {
        return false;
      }
    }
  }
  return true;
};

const largestFittingFont = (
  center: Point,
  angleDeg: number,
  charCount: number,
  ring: Point[],
): number => {
  if (labelBoxFits(center, angleDeg, LABEL_MAX_FONT_MM, charCount, ring))
    return LABEL_MAX_FONT_MM;
  let low = LABEL_MIN_FONT_MM;
  let high = LABEL_MAX_FONT_MM;
  for (let i = 0; i < 16; i++) {
    const mid = (low + high) / 2;
    if (labelBoxFits(center, angleDeg, mid, charCount, ring)) low = mid;
    else high = mid;
  }
  return low;
};

const buildLabel = (code: string, ring: Point[]): string | null => {
  // Trên lô chữ nhật, điểm sâu nhất trải đều dọc đường giữa nên cần thêm tâm diện tích làm ứng viên
  const anchors = [findLabelAnchor(ring), areaCentroid(ring)].filter(
    (point): point is Point => point !== null,
  );
  if (anchors.length === 0) return null;

  const bestAt = (angleDeg: number) =>
    anchors
      .map((anchor) => ({
        anchor,
        angle: angleDeg,
        fontSize: largestFittingFont(anchor, angleDeg, code.length, ring),
      }))
      .reduce((best, candidate) =>
        candidate.fontSize > best.fontSize ? candidate : best,
      );

  let placement = bestAt(0);
  if (placement.fontSize < LABEL_HORIZONTAL_MIN_FONT_MM) {
    const alongEdge = bestAt(longestEdgeAngle(ring));
    if (alongEdge.fontSize > placement.fontSize) placement = alongEdge;
  }

  const { angle, fontSize } = placement;
  const safeFontSize = Math.max(
    Math.floor(fontSize * LABEL_SAFETY_FACTOR * 1000) / 1000,
    LABEL_MIN_FONT_MM,
  );
  const [cx, cy] = placement.anchor;
  const rotation =
    angle === 0
      ? ""
      : ` transform="rotate(${angle.toFixed(2)} ${cx.toFixed(3)} ${cy.toFixed(3)})"`;
  return `<text data-code="${escapeXml(code)}" x="${cx.toFixed(3)}" y="${(cy + LABEL_BASELINE_SHIFT_EM * safeFontSize).toFixed(3)}" font-size="${safeFontSize.toFixed(3)}"${rotation}>${escapeXml(code)}</text>`;
};

const buildCompass = (rotationDeg: number): string => {
  const cx = PAGE_WIDTH_MM - PAGE_MARGIN_MM - SIDE_STRIP_WIDTH_MM / 2;
  const cy = PAGE_MARGIN_MM + 18;
  const radius = 11;
  const radians = (rotationDeg * Math.PI) / 180;
  const letterX = cx + (radius + 4.5) * Math.sin(radians);
  const letterY = cy - (radius + 4.5) * Math.cos(radians);
  return `<g id="la-ban"><g transform="rotate(${rotationDeg.toFixed(2)} ${fmt(cx)} ${fmt(cy)})"><path d="M${fmt(cx)} ${fmt(cy - radius)}L${fmt(cx + 3.5)} ${fmt(cy + radius)}L${fmt(cx)} ${fmt(cy + radius - 4)}Z" fill="#000000"/><path d="M${fmt(cx)} ${fmt(cy - radius)}L${fmt(cx - 3.5)} ${fmt(cy + radius)}L${fmt(cx)} ${fmt(cy + radius - 4)}Z" fill="#ffffff" stroke="#000000" stroke-width="${lineWidth(GIS_LINE_WEIGHT.parcel)}"/></g><text x="${fmt(letterX)}" y="${fmt(letterY + 1.2)}" font-size="3.6" font-weight="bold">B</text></g>`;
};

const niceScaleBarMeters = (maxMeters: number): number => {
  const magnitude = 10 ** Math.floor(Math.log10(maxMeters));
  const nice = [5, 2, 1].find((step) => step * magnitude <= maxMeters);
  return (nice ?? 1) * magnitude;
};

const buildScaleBar = (scaleDenominator: number): string => {
  const mmPerMeter = 1000 / scaleDenominator;
  const barMeters = niceScaleBarMeters((SIDE_STRIP_WIDTH_MM - 6) / mmPerMeter);
  const barMm = barMeters * mmPerMeter;
  const left =
    PAGE_WIDTH_MM -
    PAGE_MARGIN_MM -
    SIDE_STRIP_WIDTH_MM +
    (SIDE_STRIP_WIDTH_MM - barMm) / 2;
  const y = PAGE_HEIGHT_MM - PAGE_MARGIN_MM - 8;
  const stroke = `stroke="#000000" stroke-width="${lineWidth(GIS_LINE_WEIGHT.parcel)}"`;
  return `<g id="thuoc-ty-le"><path d="M${fmt(left)} ${fmt(y - 1.5)}V${fmt(y)}H${fmt(left + barMm)}V${fmt(y - 1.5)}" fill="none" ${stroke}/><text x="${fmt(left + barMm / 2)}" y="${fmt(y + 4)}" font-size="2.8">${barMeters} m</text><text x="${fmt(left + barMm / 2)}" y="${fmt(y - 3)}" font-size="3" font-weight="bold">1:${scaleDenominator}</text></g>`;
};

export function generateZoneTechnicalSvg(
  options: SvgExportOptions,
): ZoneSvgResult {
  const {
    zoneCode,
    zoneName,
    parcels,
    centerlineCoords,
    corridorBoundaries,
    stationBoxes,
    stationOutlines,
    autoRotateHorizontal = true,
    includeCompass = true,
    includeLabels = true,
    exportedAt = new Date(),
  } = options;

  const validParcels = parcels
    .map((parcel) => ({
      ...parcel,
      code: parcel.code.trim(),
      ring: openRing(parcel.ring),
    }))
    .filter((parcel) => parcel.code && parcel.ring.length >= 3);

  if (validParcels.length === 0) {
    throw new Error(
      `Zone ${zoneCode} không có thửa đất đủ mã và hình học để vẽ`,
    );
  }
  if (centerlineCoords.length < 2) {
    throw new Error("Thiếu dữ liệu tim tuyến Metro 2");
  }

  // 1. Chiếu sang mét, trục y hướng xuống như hệ tọa độ SVG
  const allVertices = validParcels.flatMap((parcel) => parcel.ring);
  const lat0 =
    allVertices.reduce((sum, p) => sum + p[0], 0) / allVertices.length;
  const lng0 =
    allVertices.reduce((sum, p) => sum + p[1], 0) / allVertices.length;
  const cosLat0 = Math.cos((lat0 * Math.PI) / 180);
  const project = ([lat, lng]: LatLng): Point => [
    (lng - lng0) * METERS_PER_DEGREE * cosLat0,
    (lat0 - lat) * METERS_PER_DEGREE,
  ];

  // 2. Cung tim tuyến phục vụ Zone: từ hình chiếu xa nhất về hai phía của các thửa
  const centerlineMeters = centerlineCoords.map(project);
  const projectedParcels = validParcels.map((parcel) => ({
    ...parcel,
    meters: parcel.ring.map(project),
  }));
  const segmentIndexes = projectedParcels.map(({ meters }) => {
    const centroid: Point = [
      meters.reduce((sum, p) => sum + p[0], 0) / meters.length,
      meters.reduce((sum, p) => sum + p[1], 0) / meters.length,
    ];
    return nearestSegmentIndex(centroid, centerlineMeters);
  });
  const zoneArc = centerlineMeters.slice(
    Math.min(...segmentIndexes),
    Math.max(...segmentIndexes) + 2,
  );

  // 3–4. PCA trả φ ∈ (-90°, 90°] nên α = -φ giữ hướng Bắc luôn ở nửa trên trang
  const alpha = autoRotateHorizontal ? -principalAxisAngle(zoneArc) : 0;
  const cosAlpha = Math.cos(alpha);
  const sinAlpha = Math.sin(alpha);
  const rotate = ([x, y]: Point): Point => [
    x * cosAlpha - y * sinAlpha,
    x * sinAlpha + y * cosAlpha,
  ];

  const rotatedArcY = zoneArc.map((point) => rotate(point)[1]);
  const residualMeters =
    (Math.max(...rotatedArcY) - Math.min(...rotatedArcY)) / 2;

  // 5. Fit lại theo khung thửa sau xoay, làm tròn lên mẫu số tỷ lệ để tỷ lệ in là chính xác
  const rotatedParcels = projectedParcels.map((parcel) => ({
    ...parcel,
    rotated: parcel.meters.map(rotate),
  }));
  const rotatedVertices = rotatedParcels.flatMap((parcel) => parcel.rotated);
  const minX = Math.min(...rotatedVertices.map((p) => p[0]));
  const maxX = Math.max(...rotatedVertices.map((p) => p[0]));
  const minY = Math.min(...rotatedVertices.map((p) => p[1]));
  const maxY = Math.max(...rotatedVertices.map((p) => p[1]));
  const drawWidth = DRAW_RECT.maxX - DRAW_RECT.minX;
  const drawHeight = DRAW_RECT.maxY - DRAW_RECT.minY;
  const fitDenominator =
    1000 * Math.max((maxX - minX) / drawWidth, (maxY - minY) / drawHeight);
  const scaleDenominator = Math.max(Math.ceil(fitDenominator / 100) * 100, 100);
  const mmPerMeter = 1000 / scaleDenominator;
  const offsetX = DRAW_RECT.minX + (drawWidth - (maxX - minX) * mmPerMeter) / 2;
  const offsetY =
    DRAW_RECT.minY + (drawHeight - (maxY - minY) * mmPerMeter) / 2;
  const toPageFromRotated = ([x, y]: Point): Point => [
    offsetX + (x - minX) * mmPerMeter,
    offsetY + (y - minY) * mmPerMeter,
  ];
  const toPage = (coords: LatLng[]): Point[] =>
    coords.map((coord) => toPageFromRotated(rotate(project(coord))));

  const pageParcels = rotatedParcels.map((parcel) => ({
    code: parcel.code,
    isCondoMaster: parcel.isCondoMaster,
    page: parcel.rotated.map(toPageFromRotated),
  }));

  const parcelPath = (parcel: { code: string; page: Point[] }): string =>
    `<path data-code="${escapeXml(parcel.code)}" d="${toPathData(parcel.page, true)}"/>`;

  const regularPaths = pageParcels
    .filter((parcel) => !parcel.isCondoMaster)
    .map(parcelPath)
    .join("");
  const condoPaths = pageParcels
    .filter((parcel) => parcel.isCondoMaster)
    .map(parcelPath)
    .join("");

  const outlinePaths = stationOutlines
    .map((station) => ({
      name: station.name,
      clipped: clipPolygon(openRing(toPage(station.coords))),
    }))
    .filter(({ clipped }) => clipped.length >= 3)
    .map(
      ({ name, clipped }) =>
        `<path data-name="${escapeXml(name)}" d="${toPathData(clipped, true)}"/>`,
    )
    .join("");

  const polylineLayer = (items: { name: string; line: Point[] }[]): string =>
    items
      .flatMap(({ name, line }) =>
        clipPolyline(line).map(
          (chunk) =>
            `<path data-name="${escapeXml(name)}" d="${toPathData(chunk, false)}"/>`,
        ),
      )
      .join("");

  const boxPaths = polylineLayer(
    stationBoxes.map(({ name, coords }) => {
      const ring = openRing(toPage(coords));
      return { name, line: [...ring, ring[0]] };
    }),
  );
  const corridorPaths = polylineLayer(
    corridorBoundaries.map(({ name, coords }) => ({
      name,
      line: toPage(coords),
    })),
  );
  const centerlinePaths = polylineLayer([
    { name: "Tim tuyến Metro 2", line: toPage(centerlineCoords) },
  ]);

  const labels = includeLabels
    ? pageParcels
        .map((parcel) => buildLabel(parcel.code, parcel.page))
        .filter((label): label is string => label !== null)
        .join("")
    : "";

  const rotationDeg = (alpha * 180) / Math.PI;
  const skippedParcels = parcels.length - validParcels.length;
  const description = [
    `Zone: ${zoneCode} - ${zoneName}`,
    `Góc xoay bình đồ: ${rotationDeg.toFixed(2)} độ`,
    `Độ lệch tim tuyến so với trục ngang: ±${residualMeters.toFixed(1)} m`,
    `Tỷ lệ: 1:${scaleDenominator}`,
    `Số thửa: ${validParcels.length}`,
    `Thời điểm xuất: ${exportedAt.toISOString()}`,
  ].join("; ");

  const svg = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    `<svg xmlns="http://www.w3.org/2000/svg" width="${PAGE_WIDTH_MM}mm" height="${PAGE_HEIGHT_MM}mm" viewBox="0 0 ${PAGE_WIDTH_MM} ${PAGE_HEIGHT_MM}" font-family="${FONT_FAMILY}" text-anchor="middle">`,
    `<title>${escapeXml(`Bình đồ kỹ thuật ${zoneCode} - ${zoneName}`)}</title>`,
    `<desc>${escapeXml(description)}</desc>`,
    `<rect width="${PAGE_WIDTH_MM}" height="${PAGE_HEIGHT_MM}" fill="#ffffff"/>`,
    `<g id="thua-dat" fill="none" stroke="#000000" stroke-width="${lineWidth(GIS_LINE_WEIGHT.parcel)}" stroke-linejoin="round">${regularPaths}</g>`,
    `<g id="chung-cu-master" fill="none" stroke="#000000" stroke-width="${lineWidth(GIS_LINE_WEIGHT.condoMaster)}" stroke-linejoin="round">${condoPaths}</g>`,
    `<g id="cong-trinh-nha-ga" fill="none" stroke="#7c3aed" stroke-width="${lineWidth(GIS_LINE_WEIGHT.stationOutline)}" stroke-linejoin="round">${outlinePaths}</g>`,
    `<g id="hop-ga" fill="none" stroke="#ff0000" stroke-width="${lineWidth(GIS_LINE_WEIGHT.stationBox)}" stroke-linecap="round">${boxPaths}</g>`,
    `<g id="mep-ho-dao" fill="none" stroke="#0284c7" stroke-width="${lineWidth(GIS_LINE_WEIGHT.corridor)}" stroke-dasharray="${mm(8)},${mm(6)}">${corridorPaths}</g>`,
    `<g id="tim-tuyen" fill="none" stroke="#fe0000" stroke-width="${lineWidth(GIS_LINE_WEIGHT.centerline)}">${centerlinePaths}</g>`,
    `<g id="nhan-ma-thua" fill="#000000">${labels}</g>`,
    includeCompass ? buildCompass(rotationDeg) : "",
    buildScaleBar(scaleDenominator),
    "</svg>",
  ].join("\n");

  return {
    svg,
    rotationDeg,
    scaleDenominator,
    residualMeters,
    parcelCount: validParcels.length,
    skippedParcels,
  };
}

export function downloadSvgFile(svgContent: string, fileName: string): void {
  const url = URL.createObjectURL(
    new Blob([svgContent], { type: "image/svg+xml;charset=utf-8" }),
  );
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}
