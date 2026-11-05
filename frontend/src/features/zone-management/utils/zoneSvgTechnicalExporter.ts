/**
 * Xuất bình đồ kỹ thuật SVG theo Zone, bố cục theo bộ mẫu CAD-templete/ST01_ID building_A3_0x.pdf
 * (khung 10 mm, khung tên 7 khối cao 25 mm, sơ đồ tuyến, bảng điểm khống chế VN2000, ô chỉ dẫn tờ).
 * Module thuần (không phụ thuộc DOM ngoài downloadSvgFile) để kiểm thử được ngoài trình duyệt.
 * Toàn bộ tọa độ đầu vào theo thứ tự Leaflet [lat, lng]; đơn vị trang vẽ là mm.
 */
import { selectControlPoints } from "./controlPoints";
import type { ControlPoint } from "./controlPoints";
import { VN2000_CALIBRATION_SOURCE } from "./vn2000";

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

export type ZoneKind = "C&C" | "POR" | "ELV" | "DEP";

export interface SvgStationInput {
  /** ST01..ST11 hoặc DEP */
  code: string;
  name: string;
  coord: LatLng;
}

export interface DrawingRevision {
  revision: string;
  /** YYYY-MM-DD; null nếu chưa ghi ngày */
  issueDate: string | null;
  description: string;
}

export interface TitleBlockInput {
  preparedBy: string;
  reviewedBy: string;
  approvedBy: string;
  manager: string;
  projectManager: string;
  drawingNo: string;
  /** Tăng dần theo thời gian phát hành */
  revisions: DrawingRevision[];
}

export type TitleBlockLogoKey =
  | "hcmcMetro"
  | "guangzhouMetro"
  | "yooshin"
  | "tediSouth"
  | "portcoast"
  | "thacoCrec";

export type TitleBlockLogos = Partial<Record<TitleBlockLogoKey, string>>;

/** Giá trị trên bản vẽ mẫu PDF, dùng khi Zone chưa có cấu hình đã lưu. */
export const DEFAULT_TITLE_BLOCK: TitleBlockInput = {
  preparedBy: "NGUYỄN VĂN THẠO",
  reviewedBy: "DENG XIAO MING",
  approvedBy: "LUO TAO",
  manager: "",
  projectManager: "",
  drawingNo: "",
  revisions: [],
};

export interface SvgExportOptions {
  zoneCode: string;
  zoneName: string;
  zoneKind: ZoneKind;
  /** Số thứ tự Zone 1..22 theo METRO_22_ZONES */
  zoneIndex: number;
  parcels: SvgParcelInput[];
  centerlineCoords: LatLng[];
  corridorBoundaries: SvgGeometryInput[];
  stationBoxes: SvgGeometryInput[];
  stationOutlines: SvgGeometryInput[];
  /** Ranh khảo sát "Boundary Building" của Zone; thiếu thì bỏ ranh và bảng tọa độ */
  surveyBoundary?: LatLng[];
  stations?: SvgStationInput[];
  titleBlock?: TitleBlockInput;
  logos?: TitleBlockLogos;
  autoRotateHorizontal?: boolean;
  includeCompass?: boolean;
  includeLabels?: boolean;
  includeRouteScheme?: boolean;
  includeControlTable?: boolean;
  includeLegend?: boolean;
  includeScaleBar?: boolean;
  exportedAt?: Date;
}

export interface ZoneDrawingIdentity {
  kind: ZoneKind;
  /** ST04 | POR-04 | DEP-01 */
  drawingCode: string;
  /** Ga được tô đỏ trên sơ đồ tuyến (C&C: 1 ga; POR: 2 ga đầu mút) */
  highlightStations: string[];
  highlightDepot: boolean;
  titleEn: string;
  titleVi: string;
}

export interface ZoneSvgResult {
  svg: string;
  rotationDeg: number;
  scaleDenominator: number;
  residualMeters: number;
  parcelCount: number;
  skippedParcels: number;
  controlPoints: ControlPoint[];
  missingLogos: TitleBlockLogoKey[];
  identity: ZoneDrawingIdentity;
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
/** Khung bản vẽ: lề đều 10 mm theo PDF mẫu */
const FRAME = { x0: 10, y0: 10, x1: 410, y1: 287 };
/** Mép trên khung tên (khung tên cao 25 mm) */
const TITLE_BLOCK_TOP = 262;
/** Ô chỉ dẫn tờ ở góc trên phải */
const SHEET_KEY = { x0: 358, y0: 10, x1: 410, y1: 29 };

const DRAW_RECT = {
  minX: FRAME.x0,
  minY: FRAME.y0,
  maxX: FRAME.x1,
  maxY: TITLE_BLOCK_TOP,
};

const LABEL_MAX_FONT_MM = 13 * PX_TO_MM;
const LABEL_HORIZONTAL_MIN_FONT_MM = 8 * PX_TO_MM;
const LABEL_MIN_FONT_MM = 0.02;
const LABEL_SAFETY_FACTOR = 0.96;
const LABEL_CHAR_WIDTH_EM = 0.62;
const LABEL_BASELINE_SHIFT_EM = 0.35;
const FONT_FAMILY = "Arial, Helvetica, sans-serif";
const SERIF_FAMILY = "'Times New Roman', Times, serif";

/** Màu nét khung/khung tên theo PDF mẫu (xám đậm) */
const INK = "#404040";
const RED = "#ff0000";

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
  // Làm tròn tới 0.01° trước khi chuẩn hóa để góc kiểm tra vừa thửa trùng đúng góc ghi ra SVG (tránh -89.999 → "-90.00")
  return normalizeTextAngle(Math.round(angle * 100) / 100);
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
  // Thửa lõm: đỉnh thọc vào giữa các điểm lấy mẫu chu vi thì khung chữ vẫn đè ra ngoài thửa
  return ring.every(([x, y]) => {
    const dx = x - center[0];
    const dy = y - center[1];
    const u = dx * cos + dy * sin;
    const v = -dx * sin + dy * cos;
    return Math.abs(u) >= halfWidth || Math.abs(v) >= halfHeight;
  });
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

// ============================================================================
// Nhận diện Zone → mã bản vẽ & tên bản vẽ song ngữ
// ============================================================================

const pad2 = (value: number): string => String(value).padStart(2, "0");

export const resolveZoneDrawingIdentity = (
  kind: ZoneKind,
  zoneIndex: number,
): ZoneDrawingIdentity => {
  const prefixEn = "BUILDING CONDITION SURVEY";
  const prefixVi = "BẢN VẼ KHẢO SÁT HIỆN TRẠNG NHÀ";
  if (kind === "C&C") {
    const station = `ST${pad2(Math.ceil(zoneIndex / 2))}`;
    return {
      kind,
      drawingCode: station,
      highlightStations: [station],
      highlightDepot: false,
      titleEn: `${prefixEn} STATION ${station} DRAWING`,
      titleVi: `${prefixVi} TẠI GA ${station}`,
    };
  }
  if (kind === "DEP") {
    return {
      kind,
      drawingCode: "DEP-01",
      highlightStations: [],
      highlightDepot: true,
      titleEn: `${prefixEn} AT DEPOT DEP-01 DRAWING`,
      titleVi: `${prefixVi} TẠI DEPOT DEP-01`,
    };
  }
  const seq = Math.max(1, Math.floor(zoneIndex / 2));
  const code = `${kind}-${pad2(seq)}`;
  const from = `ST${pad2(seq)}`;
  const to = `ST${pad2(seq + 1)}`;
  return {
    kind,
    drawingCode: code,
    highlightStations: [from, to],
    highlightDepot: false,
    titleEn: `${prefixEn} TUNNEL SECTION ${code} (${from} – ${to}) DRAWING`,
    titleVi: `${prefixVi} ĐOẠN HẦM ${code} (GA ${from} – GA ${to})`,
  };
};

// ============================================================================
// Tiện ích vẽ chữ & nét cho khung tên
// ============================================================================

/** Bề rộng ký tự trung bình (em) dùng để co chữ cho vừa ô */
const TEXT_CHAR_WIDTH_EM = 0.58;

const fitFont = (text: string, maxWidth: number, maxFont: number): number =>
  Math.min(maxFont, maxWidth / Math.max(1, text.length * TEXT_CHAR_WIDTH_EM));

interface TextOptions {
  anchor?: "start" | "middle" | "end";
  bold?: boolean;
  fill?: string;
  maxWidth?: number;
  family?: string;
  attrs?: string;
}

const svgText = (
  x: number,
  y: number,
  text: string,
  size: number,
  { anchor = "middle", bold = false, fill = INK, maxWidth, family, attrs = "" }: TextOptions = {},
): string => {
  if (!text) return "";
  const fontSize = maxWidth ? fitFont(text, maxWidth, size) : size;
  return `<text x="${fmt(x)}" y="${fmt(y)}" font-size="${fontSize.toFixed(3)}" text-anchor="${anchor}" fill="${fill}"${bold ? ' font-weight="bold"' : ""}${family ? ` font-family="${family}"` : ""}${attrs}>${escapeXml(text)}</text>`;
};

const hLine = (x0: number, x1: number, y: number, width: number): string =>
  `<path d="M${fmt(x0)} ${fmt(y)}H${fmt(x1)}" stroke-width="${width}"/>`;
const vLine = (x: number, y0: number, y1: number, width: number): string =>
  `<path d="M${fmt(x)} ${fmt(y0)}V${fmt(y1)}" stroke-width="${width}"/>`;

const formatIssueDate = (isoDate: string | null, fallbackYear: number): string => {
  if (!isoDate) return `.../.../${fallbackYear}`;
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(isoDate);
  return match ? `${match[3]}/${match[2]}/${match[1]}` : isoDate;
};

interface LogoSlot {
  key: TitleBlockLogoKey;
  label: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

const buildLogo = (
  slot: LogoSlot,
  logos: TitleBlockLogos,
  missing: Set<TitleBlockLogoKey>,
): string => {
  const href = logos[slot.key];
  if (href) {
    return `<image data-logo="${slot.key}" x="${fmt(slot.x)}" y="${fmt(slot.y)}" width="${fmt(slot.width)}" height="${fmt(slot.height)}" preserveAspectRatio="xMidYMid meet" xlink:href="${escapeXml(href)}"/>`;
  }
  missing.add(slot.key);
  return `<g data-logo-missing="${slot.key}"><rect x="${fmt(slot.x)}" y="${fmt(slot.y)}" width="${fmt(slot.width)}" height="${fmt(slot.height)}" fill="none" stroke="${INK}" stroke-width="0.1" stroke-dasharray="0.6,0.4"/>${svgText(slot.x + slot.width / 2, slot.y + slot.height / 2 + 0.5, slot.label, 1.5, { bold: true, maxWidth: slot.width - 1 })}</g>`;
};

// ============================================================================
// Khung bản vẽ, ô chỉ dẫn tờ, khung tên 7 khối (số đo theo PDF mẫu, đơn vị mm)
// ============================================================================

const buildFrame = (): string =>
  `<g id="khung-ban-ve" fill="none" stroke="${INK}"><rect x="0.5" y="0.5" width="${PAGE_WIDTH_MM - 1}" height="${PAGE_HEIGHT_MM - 1}" stroke-width="0.18"/><rect x="${FRAME.x0}" y="${FRAME.y0}" width="${FRAME.x1 - FRAME.x0}" height="${FRAME.y1 - FRAME.y0}" stroke-width="0.7"/></g>`;

const buildSheetKey = (sheetNo: number, sheetCount: number): string => {
  const cellWidth = 14;
  const cellHeight = 14;
  const totalWidth = cellWidth * sheetCount;
  const startX = (SHEET_KEY.x0 + SHEET_KEY.x1 - totalWidth) / 2;
  const top = (SHEET_KEY.y0 + SHEET_KEY.y1 - cellHeight) / 2;
  const cells = Array.from({ length: sheetCount }, (_, index) => {
    const x = startX + index * cellWidth;
    const isCurrent = index + 1 === sheetNo;
    return `<rect x="${fmt(x)}" y="${fmt(top)}" width="${cellWidth}" height="${cellHeight}" fill="${isCurrent ? "url(#gach-cheo)" : "#ffffff"}" stroke="${INK}" stroke-width="0.25"/>${svgText(x + cellWidth / 2, top + cellHeight / 2 + 2.9, String(index + 1), 8.5, { bold: true, attrs: isCurrent ? ' data-current="true"' : "" })}`;
  }).join("");
  return `<g id="o-chi-dan-to" data-sheet="${sheetNo}/${sheetCount}"><rect x="${SHEET_KEY.x0}" y="${SHEET_KEY.y0}" width="${SHEET_KEY.x1 - SHEET_KEY.x0}" height="${SHEET_KEY.y1 - SHEET_KEY.y0}" fill="#ffffff" stroke="${INK}" stroke-width="0.25"/>${cells}</g>`;
};

type SignatureField = "preparedBy" | "reviewedBy" | "approvedBy" | "manager" | "projectManager";

const SIGNATURE_ROWS: { en: string; vi: string; field: SignatureField }[] = [
  { en: "PREPARED", vi: "NGƯỜI VẼ", field: "preparedBy" },
  { en: "REVIEWER", vi: "NGƯỜI KIỂM TRA", field: "reviewedBy" },
  { en: "APPROVED BY", vi: "NGƯỜI DUYỆT", field: "approvedBy" },
  { en: "MANAGER", vi: "CHỦ NHIỆM", field: "manager" },
  { en: "PROJECT MANAGER", vi: "GIÁM ĐỐC DỰ ÁN", field: "projectManager" },
];

const REVISION_ROWS = 7;

const buildTitleBlock = (
  titleBlock: TitleBlockInput,
  identity: ZoneDrawingIdentity,
  scaleDenominator: number,
  logos: TitleBlockLogos,
  missing: Set<TitleBlockLogoKey>,
  exportedAt: Date,
): string => {
  const top = TITLE_BLOCK_TOP;
  const bottom = FRAME.y1;
  const parts: string[] = [];
  const lines: string[] = [];

  // Khung ngoài & các vách khối
  lines.push(hLine(FRAME.x0, FRAME.x1, top, 0.5));
  [68, 109, 149, 207, 269, 327].forEach((x) => lines.push(vLine(x, top, bottom, 0.35)));

  // Khối 1: Lịch sử sửa đổi (header ở đáy, R00 ở hàng trên cùng)
  const rowHeight = (bottom - top) / (REVISION_ROWS + 1);
  for (let i = 1; i <= REVISION_ROWS; i++) lines.push(hLine(FRAME.x0, 68, top + i * rowHeight, 0.18));
  lines.push(vLine(17, top, bottom, 0.18), vLine(28, top, bottom, 0.18));
  const revisions = titleBlock.revisions.length > 0
    ? titleBlock.revisions.slice(-REVISION_ROWS)
    : [{ revision: "R00", issueDate: null, description: "" }];
  revisions.forEach((rev, index) => {
    const baseline = top + index * rowHeight + rowHeight / 2 + 0.5;
    parts.push(
      `<g data-revision="${escapeXml(rev.revision)}">${svgText(13.5, baseline, rev.revision, 1.4)}${rev.issueDate ? svgText(22.5, baseline, formatIssueDate(rev.issueDate, exportedAt.getFullYear()), 1.2, { maxWidth: 10.4 }) : ""}${svgText(29, baseline, rev.description, 1.3, { anchor: "start", maxWidth: 38.4 })}</g>`,
    );
  });
  const headerTop = top + REVISION_ROWS * rowHeight;
  parts.push(
    svgText(13.5, headerTop + 1.45, "REV", 1.2),
    svgText(13.5, headerTop + 2.85, "LẦN XB", 0.9),
    svgText(22.5, headerTop + 1.45, "DATE", 1.2),
    svgText(22.5, headerTop + 2.85, "NGÀY", 1.0),
    svgText(29.5, headerTop + 2.1, "DESCRIPTION / NỘI DUNG SỬA ĐỔI", 1.25, { anchor: "start", maxWidth: 38 }),
  );

  // Khối 2: Chủ đầu tư
  parts.push(
    svgText(69.5, top + 2.6, "EMPLOYER / CHỦ ĐẦU TƯ", 1.3, { anchor: "start", maxWidth: 38 }),
    buildLogo({ key: "hcmcMetro", label: "HCMC METRO", x: 76, y: top + 3.6, width: 25, height: 10 }, logos, missing),
    svgText(88.5, top + 16.2, "HCMC PEOPLE'S COMMITTE", 1.2, { maxWidth: 39 }),
    svgText(88.5, top + 18.2, "MANAGEMENT AUTHORITY FOR URBAN RAILWAYS", 1.2, { maxWidth: 39 }),
    svgText(88.5, top + 20.2, "UBND TP HCM-BAN QUẢN LÝ ĐƯỜNG SẮT ĐÔ THỊ", 1.2, { maxWidth: 39 }),
  );

  // Khối 3: Tư vấn kiểm soát thực hiện dự án (PICC)
  parts.push(
    svgText(110.5, top + 2.6, "PICC / TƯ VẤN KIỂM SOÁT THỰC HIỆN DỰ ÁN", 1.3, { anchor: "start", maxWidth: 37.5 }),
    buildLogo({ key: "guangzhouMetro", label: "GMG", x: 112, y: top + 3.6, width: 15, height: 4.6 }, logos, missing),
    buildLogo({ key: "yooshin", label: "YOOSHIN", x: 128, y: top + 3.6, width: 18, height: 4.6 }, logos, missing),
    buildLogo({ key: "tediSouth", label: "TEDI", x: 114, y: top + 8.6, width: 9, height: 8 }, logos, missing),
    buildLogo({ key: "portcoast", label: "PORTCOAST", x: 124, y: top + 9.6, width: 21, height: 5.5 }, logos, missing),
    svgText(129, top + 19.3, "GMG - YOOSHIN - TEDIS - PCC JOINT VENTURE", 1.3, { maxWidth: 38 }),
    svgText(129, top + 21.3, "LIÊN DANH GMG - YOOSHIN - TEDIS - PCC", 1.1, { maxWidth: 38 }),
  );

  // Khối 4: Nhà thầu & nhà thầu phụ thi công
  lines.push(hLine(149, 207, top + 12, 0.18));
  parts.push(
    svgText(150.5, top + 2.6, "CONTRACTOR/ NHÀ THẦU", 1.4, { anchor: "start" }),
    buildLogo({ key: "thacoCrec", label: "THACO | CREC", x: 162, y: top + 3.2, width: 38, height: 6.2 }, logos, missing),
    svgText(171.5, top + 10.4, "TRUONG HAI GROUP CORPORATION", 0.7, { maxWidth: 19 }),
    svgText(171.5, top + 11.4, "CÔNG TY CỔ PHẦN TẬP ĐOÀN TRƯỜNG HẢI", 0.7, { maxWidth: 19 }),
    svgText(194, top + 10.4, "CHINA RAILWAY GROUP LIMITED", 0.7, { maxWidth: 12.5 }),
    svgText(194, top + 11.4, "TẬP ĐOÀN ĐƯỜNG SẮT TRUNG QUỐC", 0.7, { maxWidth: 12.5 }),
    svgText(150.5, top + 14.6, "SUB CONSTRUCTION CONTRACTOR/ NHÀ THẦU PHỤ THI CÔNG", 1.4, { anchor: "start", maxWidth: 55.5 }),
    svgText(178, top + 23.6, "China Railway Southwest Research Institute Co., Ltd.", 1.0, { maxWidth: 55 }),
  );

  // Khối 5: Chức danh & chữ ký
  const signatureHeaderBottom = top + 5;
  const signatureRowHeight = (bottom - signatureHeaderBottom) / SIGNATURE_ROWS.length;
  lines.push(vLine(231, top, bottom, 0.18), vLine(256, top, bottom, 0.18));
  lines.push(hLine(207, 269, signatureHeaderBottom, 0.18));
  SIGNATURE_ROWS.forEach((_, index) => {
    if (index > 0) lines.push(hLine(207, 269, signatureHeaderBottom + index * signatureRowHeight, 0.18));
  });
  parts.push(
    svgText(219, top + 2.1, "POSITION", 1.2),
    svgText(219, top + 4.0, "CHỨC DANH", 1.2),
    svgText(243.5, top + 3.1, "NAME / TÊN", 1.2),
    svgText(262.5, top + 2.1, "SIGNATURE", 1.05),
    svgText(262.5, top + 4.0, "CHỮ KÝ", 1.05),
  );
  SIGNATURE_ROWS.forEach((row, index) => {
    const rowTop = signatureHeaderBottom + index * signatureRowHeight;
    const name = titleBlock[row.field].trim();
    parts.push(
      `<g data-role="${row.field}">${svgText(207.6, rowTop + 1.6, row.en, 0.95, { anchor: "start", maxWidth: 23 })}${svgText(207.6, rowTop + 3.3, row.vi, 0.95, { anchor: "start", maxWidth: 23 })}${svgText(232, rowTop + 2.7, name.toUpperCase(), 1.3, { anchor: "start", maxWidth: 23.4 })}</g>`,
    );
  });

  // Khối 6: Thông số bản vẽ
  const specRow1 = top + 6.8;
  const specRow2 = top + 14.4;
  lines.push(hLine(269, 327, specRow1, 0.18), hLine(269, 327, specRow2, 0.18), vLine(295.4, top, specRow1, 0.18));
  const latestRevision = titleBlock.revisions[titleBlock.revisions.length - 1];
  parts.push(
    svgText(270, top + 2.2, "SCALE / TỶ LỆ", 1.2, { anchor: "start" }),
    svgText(282.2, top + 5.6, `1:${scaleDenominator}`, 2.0, { bold: true, attrs: ' data-field="scale"' }),
    svgText(296.2, top + 2.2, "FORMAT / KHỔ BẢN VẼ", 1.2, { anchor: "start", maxWidth: 30 }),
    svgText(311.2, top + 6.1, "A3", 3.0),
    svgText(298, specRow1 + 2.2, "DATE ISSUE / NGÀY PHÁT HÀNH", 1.2),
    svgText(298, specRow1 + 6.4, formatIssueDate(latestRevision?.issueDate ?? null, exportedAt.getFullYear()), 1.9, { attrs: ' data-field="issue-date"' }),
    svgText(270, specRow2 + 2.0, "PHASE / GIAI ĐOẠN", 1.2, { anchor: "start" }),
    svgText(298, specRow2 + 5.6, "CONSTRUCTION DRAWING DESIGN (PHASE 2)", 1.9, { maxWidth: 56 }),
    svgText(298, specRow2 + 9.0, "THIẾT KẾ BẢN VẼ THI CÔNG (GIAI ĐOẠN 2)", 1.9, { maxWidth: 56 }),
  );

  // Khối 7: Dự án, tên bản vẽ, số bản vẽ & lần ban hành
  const projectRow1 = top + 6.8;
  const projectRow2 = top + 18.1;
  lines.push(hLine(327, 410, projectRow1, 0.18), hLine(327, 410, projectRow2, 0.18), vLine(397.7, projectRow2, bottom, 0.18));
  parts.push(
    svgText(328, top + 2.4, "PROJECT", 1.15, { anchor: "start" }),
    svgText(328, top + 4.5, "DỰ ÁN", 1.15, { anchor: "start" }),
    svgText(374, top + 2.7, "HO CHI MINH CITY MASS RAPID TRANSIT LINE 2 BEN THANH - THAM LUONG", 1.6, { maxWidth: 70 }),
    svgText(374, top + 5.4, "XÂY DỰNG TUYẾN TÀU ĐIỆN NGẦM SỐ 2 TP. HỒ CHÍ MINH BẾN THÀNH - THAM LƯƠNG", 1.4, { maxWidth: 70 }),
    svgText(328, projectRow1 + 2.2, "DRAWING TITLE / TÊN BẢN VẼ", 1.2, { anchor: "start" }),
    svgText(368.5, projectRow1 + 6.3, identity.titleEn, 2.1, { maxWidth: 80, attrs: ' data-field="title-en"' }),
    svgText(368.5, projectRow1 + 9.7, identity.titleVi, 2.1, { maxWidth: 80, attrs: ' data-field="title-vi"' }),
    svgText(328, projectRow2 + 2.2, "DRAWING NO", 1.2, { anchor: "start" }),
    svgText(328, projectRow2 + 4.2, "BẢN VẼ SỐ", 1.2, { anchor: "start" }),
    svgText(368, projectRow2 + 5.4, titleBlock.drawingNo.trim(), 2.0, { maxWidth: 48, attrs: ' data-field="drawing-no"' }),
    svgText(398.5, projectRow2 + 2.2, "REV / BẢN", 1.1, { anchor: "start" }),
    svgText(404, projectRow2 + 5.6, latestRevision?.revision ?? "R00", 1.9, { attrs: ' data-field="revision"' }),
  );

  return `<g id="khung-ten" font-family="${FONT_FAMILY}"><rect x="${FRAME.x0}" y="${top}" width="${FRAME.x1 - FRAME.x0}" height="${bottom - top}" fill="#ffffff"/><g fill="none" stroke="${INK}">${lines.join("")}</g>${parts.join("")}</g>`;
};

// ============================================================================
// Ô phụ trong vùng vẽ: sơ đồ tuyến, bảng điểm khống chế, la bàn, chú giải
// ============================================================================

interface PanelRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

type Corner = "BL" | "TL" | "BR" | "TR";
const CORNERS: Corner[] = ["BL", "TL", "BR", "TR"];

const cornerRect = (corner: Corner, width: number, height: number): PanelRect => {
  const left = corner === "BL" || corner === "TL";
  const topSide = corner === "TL" || corner === "TR";
  const topY = corner === "TR" ? SHEET_KEY.y1 : DRAW_RECT.minY;
  return {
    x: left ? DRAW_RECT.minX : DRAW_RECT.maxX - width,
    y: topSide ? topY : DRAW_RECT.maxY - height,
    width,
    height,
  };
};

const countPointsInRect = (points: Point[], rect: PanelRect, margin = 1.5): number =>
  points.reduce(
    (count, [x, y]) =>
      x >= rect.x - margin &&
      x <= rect.x + rect.width + margin &&
      y >= rect.y - margin &&
      y <= rect.y + rect.height + margin
        ? count + 1
        : count,
    0,
  );

/** Gán mỗi ô phụ vào một góc khác nhau, ưu tiên góc ít đè lên nét vẽ nhất (ô lớn chọn trước). */
const assignPanelCorners = (
  panels: { id: string; width: number; height: number }[],
  occupied: Point[],
): { placements: Map<string, PanelRect>; cost: number } => {
  const placements = new Map<string, PanelRect>();
  const usedCorners = new Set<Corner>();
  let cost = 0;
  [...panels]
    .sort((a, b) => b.width * b.height - a.width * a.height)
    .forEach((panel) => {
      let best: { corner: Corner; rect: PanelRect; count: number } | null = null;
      for (const corner of CORNERS) {
        if (usedCorners.has(corner)) continue;
        const rect = cornerRect(corner, panel.width, panel.height);
        const count = countPointsInRect(occupied, rect);
        if (!best || count < best.count) best = { corner, rect, count };
      }
      if (best) {
        usedCorners.add(best.corner);
        placements.set(panel.id, best.rect);
        cost += best.count;
      }
    });
  return { placements, cost };
};

const ROUTE_PANEL = { width: 43, height: 74 };
const COMPASS_PANEL = { width: 20, height: 28 };
const SCALE_BAR_EXTRA_HEIGHT = 10;
const LEGEND_PANEL = { width: 64, height: 32 };
const CONTROL_TABLE = {
  maxRowsPerColumn: 20,
  groupWidth: 59,
  noWidth: 8,
  coordWidth: 25.5,
  titleHeight: 7.6,
  headerHeight: 3.4,
  rowHeight: 3.0,
};

const controlTableSize = (count: number): { width: number; height: number; rowsPerColumn: number; groups: number } => {
  const rowsPerColumn = Math.min(CONTROL_TABLE.maxRowsPerColumn, Math.max(1, count));
  const groups = Math.max(1, Math.ceil(count / rowsPerColumn));
  return {
    width: CONTROL_TABLE.groupWidth * groups,
    height: CONTROL_TABLE.titleHeight + CONTROL_TABLE.headerHeight + rowsPerColumn * CONTROL_TABLE.rowHeight + 0.6,
    rowsPerColumn,
    groups,
  };
};

const buildControlTable = (points: ControlPoint[], rect: PanelRect): string => {
  const { rowsPerColumn, groups } = controlTableSize(points.length);
  const parts: string[] = [];
  const lines: string[] = [];
  const headerTop = rect.y + CONTROL_TABLE.titleHeight;
  const rowsTop = headerTop + CONTROL_TABLE.headerHeight;
  const bottom = rect.y + rect.height;
  parts.push(
    svgText(rect.x + rect.width / 2, rect.y + 3.1, "TỌA ĐỘ ĐIỂM KHỐNG CHẾ", 1.9, { bold: true, family: SERIF_FAMILY }),
    svgText(rect.x + rect.width / 2, rect.y + 6.1, "COORDINATES OF CONTROL POINTS", 1.9, { bold: true, family: SERIF_FAMILY }),
  );
  lines.push(hLine(rect.x, rect.x + rect.width, headerTop, 0.25), hLine(rect.x, rect.x + rect.width, rowsTop, 0.18));
  for (let group = 0; group < groups; group++) {
    const gx = rect.x + group * CONTROL_TABLE.groupWidth;
    const colX = gx + CONTROL_TABLE.noWidth;
    const colY = colX + CONTROL_TABLE.coordWidth;
    if (group > 0) lines.push(vLine(gx, headerTop, bottom, 0.25));
    lines.push(vLine(colX, headerTop, bottom, 0.18), vLine(colY, headerTop, bottom, 0.18));
    parts.push(
      svgText(gx + CONTROL_TABLE.noWidth / 2, headerTop + 2.4, "NO.", 1.5, { family: SERIF_FAMILY }),
      svgText(colX + CONTROL_TABLE.coordWidth / 2, headerTop + 2.4, "X (m)", 1.5, { family: SERIF_FAMILY }),
      svgText(colY + CONTROL_TABLE.coordWidth / 2, headerTop + 2.4, "Y (m)", 1.5, { family: SERIF_FAMILY }),
    );
    points.slice(group * rowsPerColumn, (group + 1) * rowsPerColumn).forEach((point, row) => {
      const rowTop = rowsTop + row * CONTROL_TABLE.rowHeight;
      if (row > 0) lines.push(hLine(gx, gx + CONTROL_TABLE.groupWidth, rowTop, 0.1));
      const baseline = rowTop + 2.15;
      parts.push(
        `<g data-control-point="${point.no}">${svgText(gx + CONTROL_TABLE.noWidth / 2, baseline, String(point.no), 1.5, { family: SERIF_FAMILY })}${svgText(colX + CONTROL_TABLE.coordWidth / 2, baseline, point.x.toFixed(3), 1.5, { family: SERIF_FAMILY, attrs: ' data-axis="x"' })}${svgText(colY + CONTROL_TABLE.coordWidth / 2, baseline, point.y.toFixed(3), 1.5, { family: SERIF_FAMILY, attrs: ' data-axis="y"' })}</g>`,
      );
    });
  }
  return `<g id="bang-diem-khong-che"><rect x="${fmt(rect.x)}" y="${fmt(rect.y)}" width="${fmt(rect.width)}" height="${fmt(rect.height)}" fill="#ffffff" stroke="${INK}" stroke-width="0.35"/><g fill="none" stroke="${INK}">${lines.join("")}</g>${parts.join("")}</g>`;
};

/** Tên ga không dấu theo mẫu: "Ga Bến Thành (ST01)" → "Ben Thanh, ST01" */
export const toRouteLabel = (code: string, name: string): string => {
  if (code === "DEP") return "Depot";
  const plain = name
    .replace(/^Ga\s+/i, "")
    .replace(/\s*\([^)]*\)\s*$/, "")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d")
    .replace(/Đ/g, "D")
    .trim();
  return `${plain}, ${code}`;
};

const northArrow = (cx: number, cy: number, rotationDeg: number, radius: number, letter: string): string => {
  const radians = (rotationDeg * Math.PI) / 180;
  const letterX = cx + (radius + radius * 0.45) * Math.sin(radians);
  const letterY = cy - (radius + radius * 0.45) * Math.cos(radians);
  const halfWidth = radius * 0.32;
  return `<g transform="rotate(${rotationDeg.toFixed(2)} ${fmt(cx)} ${fmt(cy)})"><path d="M${fmt(cx)} ${fmt(cy - radius)}L${fmt(cx + halfWidth)} ${fmt(cy + radius)}L${fmt(cx)} ${fmt(cy + radius * 0.64)}Z" fill="#000000"/><path d="M${fmt(cx)} ${fmt(cy - radius)}L${fmt(cx - halfWidth)} ${fmt(cy + radius)}L${fmt(cx)} ${fmt(cy + radius * 0.64)}Z" fill="#ffffff" stroke="#000000" stroke-width="${lineWidth(GIS_LINE_WEIGHT.parcel)}"/></g><text x="${fmt(letterX)}" y="${fmt(letterY + radius * 0.11)}" font-size="${(radius * 0.33).toFixed(3)}" font-weight="bold" dominant-baseline="middle">${letter}</text>`;
};

/** Góc trục chính (hệ y xuống) của dãy điểm, không trọng số. */
const pointsPrincipalAngle = (points: Point[]): number => {
  const meanX = points.reduce((sum, p) => sum + p[0], 0) / points.length;
  const meanY = points.reduce((sum, p) => sum + p[1], 0) / points.length;
  let sxx = 0;
  let syy = 0;
  let sxy = 0;
  points.forEach(([x, y]) => {
    sxx += (x - meanX) ** 2;
    syy += (y - meanY) ** 2;
    sxy += (x - meanX) * (y - meanY);
  });
  return 0.5 * Math.atan2(2 * sxy, sxx - syy);
};

const buildRouteScheme = (
  stations: SvgStationInput[],
  identity: ZoneDrawingIdentity,
  rect: PanelRect,
): string => {
  const lineStations = stations
    .filter((station) => /^ST\d{2}$/.test(station.code))
    .sort((a, b) => a.code.localeCompare(b.code));
  const depot = stations.find((station) => station.code === "DEP");
  const ordered = depot ? [...lineStations, depot] : lineStations;
  if (ordered.length < 2) return "";

  // Hướng Bắc lên trên, rồi xoay để trục chính của tuyến thẳng đứng (vừa ô dọc), Bến Thành ở dưới
  const lat0 = ordered.reduce((sum, s) => sum + s.coord[0], 0) / ordered.length;
  const cosLat0 = Math.cos((lat0 * Math.PI) / 180);
  const meters = ordered.map(({ coord: [lat, lng] }): Point => [lng * METERS_PER_DEGREE * cosLat0, -lat * METERS_PER_DEGREE]);
  let beta = Math.PI / 2 - pointsPrincipalAngle(meters);
  const rotateBy = (angle: number) => ([x, y]: Point): Point => [
    x * Math.cos(angle) - y * Math.sin(angle),
    x * Math.sin(angle) + y * Math.cos(angle),
  ];
  let rotated = meters.map(rotateBy(beta));
  if (rotated[0][1] < rotated[lineStations.length - 1][1]) {
    beta += Math.PI;
    rotated = meters.map(rotateBy(beta));
  }

  const padTop = 14;
  const padBottom = 4;
  const padLeft = 5;
  const labelSpace = 16;
  const innerWidth = rect.width - padLeft - labelSpace;
  const innerHeight = rect.height - padTop - padBottom;
  const xs = rotated.map((p) => p[0]);
  const ys = rotated.map((p) => p[1]);
  const spanX = Math.max(...xs) - Math.min(...xs) || 1;
  const spanY = Math.max(...ys) - Math.min(...ys) || 1;
  const scale = Math.min(innerWidth / spanX, innerHeight / spanY);
  const offsetX = rect.x + padLeft + (innerWidth - spanX * scale) / 2;
  const offsetY = rect.y + padTop + (innerHeight - spanY * scale) / 2;
  const page = rotated.map(([x, y]): Point => [
    offsetX + (x - Math.min(...xs)) * scale,
    offsetY + (y - Math.min(...ys)) * scale,
  ]);

  const parts: string[] = [];
  parts.push(`<path d="${toPathData(page, false)}" fill="none" stroke="${INK}" stroke-width="0.45" stroke-linejoin="round"/>`);

  if (identity.highlightStations.length === 2) {
    const from = lineStations.findIndex((s) => s.code === identity.highlightStations[0]);
    const to = lineStations.findIndex((s) => s.code === identity.highlightStations[1]);
    if (from >= 0 && to >= 0) {
      parts.push(
        `<path data-highlight-section="${identity.drawingCode}" d="${toPathData(page.slice(Math.min(from, to), Math.max(from, to) + 1), false)}" fill="none" stroke="${RED}" stroke-width="1.1" stroke-linecap="round"/>`,
      );
    }
  }

  ordered.forEach((station, index) => {
    const [x, y] = page[index];
    const isDepot = station.code === "DEP";
    const highlighted = isDepot
      ? identity.highlightDepot
      : identity.kind === "C&C" && identity.highlightStations.includes(station.code);
    const marker = isDepot
      ? `<rect x="${fmt(x - 1)}" y="${fmt(y - 1.8)}" width="2" height="3.6" fill="${highlighted ? RED : INK}"/>`
      : `<circle cx="${fmt(x)}" cy="${fmt(y)}" r="${highlighted ? "1.1" : "0.75"}" fill="${highlighted ? RED : INK}"/>`;
    parts.push(
      `<g data-station="${station.code}"${highlighted ? ' data-highlight="true"' : ""}>${marker}${svgText(x + 1.8, y + 0.45, toRouteLabel(station.code, station.name), 1.2, { anchor: "start", maxWidth: labelSpace + 2 })}</g>`,
    );
  });

  // La bàn "N" của sơ đồ: hướng Bắc sau phép xoay β
  const northDeg = (beta * 180) / Math.PI;
  parts.push(northArrow(rect.x + 9, rect.y + 7.5, northDeg, 4.2, "N"));

  return `<g id="so-do-tuyen" data-highlight="${identity.drawingCode}"><rect x="${fmt(rect.x)}" y="${fmt(rect.y)}" width="${fmt(rect.width)}" height="${fmt(rect.height)}" fill="#ffffff" stroke="${INK}" stroke-width="0.5"/>${parts.join("")}</g>`;
};

const buildCompass = (rotationDeg: number, rect: PanelRect): string =>
  `<g id="la-ban">${northArrow(rect.x + rect.width / 2, rect.y + 16, rotationDeg, 9, "B")}</g>`;

const niceScaleBarMeters = (maxMeters: number): number => {
  const magnitude = 10 ** Math.floor(Math.log10(maxMeters));
  const nice = [5, 2, 1].find((step) => step * magnitude <= maxMeters);
  return (nice ?? 1) * magnitude;
};

const buildScaleBar = (scaleDenominator: number, rect: PanelRect): string => {
  const mmPerMeter = 1000 / scaleDenominator;
  const barMeters = niceScaleBarMeters((rect.width - 4) / mmPerMeter);
  const barMm = barMeters * mmPerMeter;
  const left = rect.x + (rect.width - barMm) / 2;
  const y = rect.y + rect.height - 3.5;
  const stroke = `stroke="#000000" stroke-width="${lineWidth(GIS_LINE_WEIGHT.parcel)}"`;
  return `<g id="thuoc-ty-le"><path d="M${fmt(left)} ${fmt(y - 1.5)}V${fmt(y)}H${fmt(left + barMm)}V${fmt(y - 1.5)}" fill="none" ${stroke}/><text x="${fmt(left + barMm / 2)}" y="${fmt(y + 3)}" font-size="2.4">${barMeters} m</text><text x="${fmt(left + barMm / 2)}" y="${fmt(y - 2.4)}" font-size="2.4" font-weight="bold">1:${scaleDenominator}</text></g>`;
};

const LEGEND_ITEMS: { label: string; stroke: string; width: string; dash?: string; overlay?: boolean }[] = [
  { label: "Ranh khảo sát (Boundary Building)", stroke: RED, width: "0.25", overlay: true },
  { label: "Ranh thửa đất khảo sát", stroke: "#000000", width: lineWidth(GIS_LINE_WEIGHT.parcel) },
  { label: "Ranh tòa nhà chung cư mẹ", stroke: "#000000", width: lineWidth(GIS_LINE_WEIGHT.condoMaster) },
  { label: "Công trình nhà ga", stroke: "#7c3aed", width: lineWidth(GIS_LINE_WEIGHT.stationOutline) },
  { label: "Hộp ga Metro", stroke: RED, width: lineWidth(GIS_LINE_WEIGHT.stationBox) },
  { label: "Mép hố đào / ranh hành lang", stroke: "#0284c7", width: lineWidth(GIS_LINE_WEIGHT.corridor), dash: `${mm(8)},${mm(6)}` },
  { label: "Tim tuyến Metro số 2", stroke: "#fe0000", width: lineWidth(GIS_LINE_WEIGHT.centerline) },
];

const buildLegend = (rect: PanelRect): string => {
  const rows = LEGEND_ITEMS.map((item, index) => {
    const y = rect.y + 7 + index * 3.5;
    const sample = `M${fmt(rect.x + 3)} ${fmt(y)}H${fmt(rect.x + 15)}`;
    const overlay = item.overlay
      ? `<path d="${sample}" stroke="${INK}" stroke-width="0.35" stroke-dasharray="1.6,0.8" fill="none"/>`
      : "";
    return `${overlay}<path d="${sample}" stroke="${item.stroke}" stroke-width="${item.width}"${item.dash ? ` stroke-dasharray="${item.dash}"` : ""} fill="none"/>${svgText(rect.x + 17, y + 0.6, item.label, 1.7, { anchor: "start", maxWidth: rect.width - 19 })}`;
  }).join("");
  return `<g id="chu-giai"><rect x="${fmt(rect.x)}" y="${fmt(rect.y)}" width="${fmt(rect.width)}" height="${fmt(rect.height)}" fill="#ffffff" stroke="${INK}" stroke-width="0.35"/>${svgText(rect.x + rect.width / 2, rect.y + 3.4, "CHÚ GIẢI / LEGEND", 1.9, { bold: true })}${rows}</g>`;
};

// ============================================================================
// Ranh khảo sát "Boundary Building": tô chấm, nét đỏ + đứt xám, số hiệu điểm khống chế
// ============================================================================

const buildSurveyBoundary = (
  ringPage: Point[],
  points: { no: number; page: Point }[],
): { fill: string; lines: string } => {
  const closed = [...ringPage, ringPage[0]];
  const clippedFill = clipPolygon(ringPage);
  const fill =
    clippedFill.length >= 3
      ? `<g id="vung-khao-sat"><path d="${toPathData(clippedFill, true)}" fill="url(#cham-xanh)" stroke="none"/></g>`
      : "";

  const chunks = clipPolyline(closed);
  const dashed = chunks.map((chunk) => `<path d="${toPathData(chunk, false)}"/>`).join("");
  const centroid: Point = [
    ringPage.reduce((sum, p) => sum + p[0], 0) / ringPage.length,
    ringPage.reduce((sum, p) => sum + p[1], 0) / ringPage.length,
  ];
  const outward = ([x, y]: Point, distanceMm: number): Point => {
    const dx = x - centroid[0];
    const dy = y - centroid[1];
    const length = Math.hypot(dx, dy) || 1;
    return [x + (dx / length) * distanceMm, y + (dy / length) * distanceMm];
  };
  const inside = ([x, y]: Point): boolean =>
    x >= DRAW_RECT.minX && x <= DRAW_RECT.maxX && y >= DRAW_RECT.minY && y <= DRAW_RECT.maxY;

  const numbers = points
    .filter(({ page }) => inside(page))
    .map(({ no, page }) => {
      const [lx, ly] = outward(page, 2.4);
      return `<g data-control-point="${no}"><circle cx="${fmt(page[0])}" cy="${fmt(page[1])}" r="0.35" fill="${RED}"/>${svgText(lx, ly + 0.85, String(no), 2.4, { fill: RED })}</g>`;
    })
    .join("");

  // Nhãn "Boundary Building" dọc cạnh dài nhất còn nằm trong khung vẽ
  let label = "";
  let longest = 0;
  chunks.forEach((chunk) => {
    for (let i = 0; i < chunk.length - 1; i++) {
      const length = Math.hypot(chunk[i + 1][0] - chunk[i][0], chunk[i + 1][1] - chunk[i][1]);
      if (length > longest && length > 25) {
        longest = length;
        const mid: Point = [(chunk[i][0] + chunk[i + 1][0]) / 2, (chunk[i][1] + chunk[i + 1][1]) / 2];
        const angle = normalizeTextAngle(
          (Math.atan2(chunk[i + 1][1] - chunk[i][1], chunk[i + 1][0] - chunk[i][0]) * 180) / Math.PI,
        );
        const [lx, ly] = outward(mid, 2.6);
        label = svgText(lx, ly + 0.9, "Boundary Building", 2.6, {
          attrs: ` transform="rotate(${angle.toFixed(2)} ${fmt(lx)} ${fmt(ly)})"`,
        });
      }
    }
  });

  return {
    fill,
    lines: `<g id="ranh-khao-sat" fill="none" stroke-linejoin="round"><g stroke="${INK}" stroke-width="0.35" stroke-dasharray="1.6,0.8">${dashed}</g><g stroke="${RED}" stroke-width="0.25">${dashed}</g></g><g id="so-hieu-diem-khong-che">${numbers}${label}</g>`,
  };
};

// ============================================================================
// Hàm chính
// ============================================================================

const MAX_SCALE_STEPS = 40;

export function generateZoneTechnicalSvg(
  options: SvgExportOptions,
): ZoneSvgResult {
  const {
    zoneCode,
    zoneName,
    zoneKind,
    zoneIndex,
    parcels,
    centerlineCoords,
    corridorBoundaries,
    stationBoxes,
    stationOutlines,
    surveyBoundary,
    stations = [],
    titleBlock = DEFAULT_TITLE_BLOCK,
    logos = {},
    autoRotateHorizontal = true,
    includeCompass = true,
    includeLabels = true,
    includeRouteScheme = true,
    includeControlTable = true,
    includeLegend = false,
    includeScaleBar = false,
    exportedAt = new Date(),
  } = options;

  const identity = resolveZoneDrawingIdentity(zoneKind, zoneIndex);

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

  const boundaryRing = surveyBoundary ? openRing(surveyBoundary) : [];
  const hasBoundary = boundaryRing.length >= 3;
  const controlSelection = hasBoundary
    ? selectControlPoints(boundaryRing)
    : { points: [], simplifyToleranceMeters: 0 };
  const controlPoints = controlSelection.points;

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

  // 5. Fit theo khung thửa + ranh khảo sát sau xoay (để mọi điểm khống chế hiện trên bản vẽ)
  const rotatedParcels = projectedParcels.map((parcel) => ({
    ...parcel,
    rotated: parcel.meters.map(rotate),
  }));
  const rotatedBoundary = boundaryRing.map((coord) => rotate(project(coord)));
  const extentVertices = [
    ...rotatedParcels.flatMap((parcel) => parcel.rotated),
    ...rotatedBoundary,
  ];
  const minX = Math.min(...extentVertices.map((p) => p[0]));
  const maxX = Math.max(...extentVertices.map((p) => p[0]));
  const minY = Math.min(...extentVertices.map((p) => p[1]));
  const maxY = Math.max(...extentVertices.map((p) => p[1]));
  const drawWidth = DRAW_RECT.maxX - DRAW_RECT.minX;
  const drawHeight = DRAW_RECT.maxY - DRAW_RECT.minY;
  const fitDenominator =
    1000 * Math.max((maxX - minX) / drawWidth, (maxY - minY) / drawHeight);
  const baseDenominator = Math.max(Math.ceil(fitDenominator / 100) * 100, 100);

  // 6. Các ô phụ đặt vào góc trống; nếu mọi góc đều đè lên nét vẽ thì nới tỷ lệ thêm từng bậc 100
  const tableSize = controlTableSize(controlPoints.length);
  const panels = [
    ...(includeRouteScheme && stations.length >= 2 ? [{ id: "route", ...ROUTE_PANEL }] : []),
    ...(includeControlTable && controlPoints.length > 0
      ? [{ id: "table", width: tableSize.width, height: tableSize.height }]
      : []),
    ...(includeCompass || includeScaleBar
      ? [{ id: "compass", width: COMPASS_PANEL.width + (includeScaleBar ? 10 : 0), height: COMPASS_PANEL.height + (includeScaleBar ? SCALE_BAR_EXTRA_HEIGHT : 0) }]
      : []),
    ...(includeLegend ? [{ id: "legend", ...LEGEND_PANEL }] : []),
  ];

  const layoutAt = (denominator: number) => {
    const scale = 1000 / denominator;
    const offsetX = DRAW_RECT.minX + (drawWidth - (maxX - minX) * scale) / 2;
    const offsetY = DRAW_RECT.minY + (drawHeight - (maxY - minY) * scale) / 2;
    const toPage = ([x, y]: Point): Point => [
      offsetX + (x - minX) * scale,
      offsetY + (y - minY) * scale,
    ];
    const occupied = [...extentVertices.map(toPage)];
    return { toPage, ...assignPanelCorners(panels, occupied) };
  };

  let scaleDenominator = baseDenominator;
  let layout = layoutAt(scaleDenominator);
  if (panels.length > 0) {
    let best = { denominator: scaleDenominator, layout };
    for (let step = 1; step <= MAX_SCALE_STEPS && best.layout.cost > 0; step++) {
      const denominator = baseDenominator + step * 100;
      const candidate = layoutAt(denominator);
      if (candidate.cost < best.layout.cost) best = { denominator, layout: candidate };
    }
    scaleDenominator = best.denominator;
    layout = best.layout;
  }
  const toPageFromRotated = layout.toPage;
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

  const boundaryLayers = hasBoundary
    ? buildSurveyBoundary(
        toPage(boundaryRing),
        controlPoints.map((point) => ({ no: point.no, page: toPage([point.coord])[0] })),
      )
    : { fill: "", lines: "" };

  const rotationDeg = (alpha * 180) / Math.PI;
  const placements = layout.placements;
  const routeRect = placements.get("route");
  const tableRect = placements.get("table");
  const compassRect = placements.get("compass");
  const legendRect = placements.get("legend");
  const panelLayers = [
    routeRect ? buildRouteScheme(stations, identity, routeRect) : "",
    tableRect ? buildControlTable(controlPoints, tableRect) : "",
    compassRect && includeCompass ? buildCompass(rotationDeg, compassRect) : "",
    compassRect && includeScaleBar ? buildScaleBar(scaleDenominator, compassRect) : "",
    legendRect ? buildLegend(legendRect) : "",
  ];

  const missingLogos = new Set<TitleBlockLogoKey>();
  const titleBlockLayer = buildTitleBlock(
    titleBlock,
    identity,
    scaleDenominator,
    logos,
    missingLogos,
    exportedAt,
  );

  const skippedParcels = parcels.length - validParcels.length;
  const description = [
    `Zone: ${zoneCode} - ${zoneName}`,
    `Bản vẽ: ${identity.drawingCode}`,
    `Góc xoay bình đồ: ${rotationDeg.toFixed(2)} độ`,
    `Độ lệch tim tuyến so với trục ngang: ±${residualMeters.toFixed(1)} m`,
    `Tỷ lệ: 1:${scaleDenominator}`,
    `Số thửa: ${validParcels.length}`,
    `Điểm khống chế: ${controlPoints.length} (VN2000 TM-3 105°45', ${VN2000_CALIBRATION_SOURCE}${controlSelection.simplifyToleranceMeters > 0 ? `; đơn giản hóa ranh ${controlSelection.simplifyToleranceMeters} m` : ""})`,
    `Thời điểm xuất: ${exportedAt.toISOString()}`,
  ].join("; ");

  const defs = `<defs><pattern id="cham-xanh" width="2" height="2" patternUnits="userSpaceOnUse"><circle cx="1" cy="1" r="0.13" fill="#1e88e5"/></pattern><pattern id="gach-cheo" width="1.6" height="1.6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><path d="M0 0V1.6" stroke="${INK}" stroke-width="0.2"/></pattern></defs>`;

  const svg = [
    '<?xml version="1.0" encoding="UTF-8"?>',
    `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${PAGE_WIDTH_MM}mm" height="${PAGE_HEIGHT_MM}mm" viewBox="0 0 ${PAGE_WIDTH_MM} ${PAGE_HEIGHT_MM}" font-family="${FONT_FAMILY}" text-anchor="middle">`,
    `<title>${escapeXml(`${identity.titleVi} - ${zoneCode}`)}</title>`,
    `<desc>${escapeXml(description)}</desc>`,
    defs,
    `<rect width="${PAGE_WIDTH_MM}" height="${PAGE_HEIGHT_MM}" fill="#ffffff"/>`,
    boundaryLayers.fill,
    `<g id="thua-dat" fill="none" stroke="#000000" stroke-width="${lineWidth(GIS_LINE_WEIGHT.parcel)}" stroke-linejoin="round">${regularPaths}</g>`,
    `<g id="chung-cu-master" fill="none" stroke="#000000" stroke-width="${lineWidth(GIS_LINE_WEIGHT.condoMaster)}" stroke-linejoin="round">${condoPaths}</g>`,
    `<g id="cong-trinh-nha-ga" fill="none" stroke="#7c3aed" stroke-width="${lineWidth(GIS_LINE_WEIGHT.stationOutline)}" stroke-linejoin="round">${outlinePaths}</g>`,
    `<g id="hop-ga" fill="none" stroke="#ff0000" stroke-width="${lineWidth(GIS_LINE_WEIGHT.stationBox)}" stroke-linecap="round">${boxPaths}</g>`,
    `<g id="mep-ho-dao" fill="none" stroke="#0284c7" stroke-width="${lineWidth(GIS_LINE_WEIGHT.corridor)}" stroke-dasharray="${mm(8)},${mm(6)}">${corridorPaths}</g>`,
    `<g id="tim-tuyen" fill="none" stroke="#fe0000" stroke-width="${lineWidth(GIS_LINE_WEIGHT.centerline)}">${centerlinePaths}</g>`,
    boundaryLayers.lines,
    `<g id="nhan-ma-thua" fill="#000000">${labels}</g>`,
    ...panelLayers,
    buildSheetKey(1, 1),
    titleBlockLayer,
    buildFrame(),
    "</svg>",
  ]
    .filter((line) => line !== "")
    .join("\n");

  return {
    svg,
    rotationDeg,
    scaleDenominator,
    residualMeters,
    parcelCount: validParcels.length,
    skippedParcels,
    controlPoints,
    missingLogos: [...missingLogos],
    identity,
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
