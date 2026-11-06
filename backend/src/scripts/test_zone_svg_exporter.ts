/**
 * Kiểm thử exporter bình đồ SVG trên dữ liệu thật của mọi Zone có thửa (chỉ đọc DB).
 * Chạy: cd backend && npx ts-node --transpile-only src/scripts/test_zone_svg_exporter.ts
 * Kiểm định kết quả bằng cách đọc lại file SVG, không dựa vào trạng thái nội bộ của exporter.
 * Bố cục đối chiếu bộ mẫu CAD-templete/ST01_ID building_A3_0x.pdf; tọa độ VN2000 đối chiếu 20 điểm khống chế của PDF.
 */
import { execFileSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';
import Module from 'module';
import { Client } from 'pg';
import ts from 'typescript';

type Point = [number, number];

// frontend là ESM ("type": "module") nên mọi file .ts của frontend phải transpile sang CommonJS khi nạp từ ts-node
const FRONTEND_SRC = path.resolve(__dirname, '../../../frontend/src');
type CompilableModule = Module & { _compile: (code: string, filename: string) => void };
type TsLoader = (module: CompilableModule, filename: string) => void;
const extensions = (Module as unknown as { _extensions: Record<string, TsLoader> })._extensions;
const originalTsLoader = extensions['.ts'];
extensions['.ts'] = (module, filename) => {
  if (!filename.startsWith(FRONTEND_SRC)) {
    originalTsLoader(module, filename);
    return;
  }
  const { outputText } = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2021,
      esModuleInterop: true,
      resolveJsonModule: true,
    },
  });
  module._compile(outputText, filename);
};

type ExporterModule = typeof import('../../../frontend/src/features/zone-management/utils/zoneSvgTechnicalExporter');
type Vn2000Module = typeof import('../../../frontend/src/features/zone-management/utils/vn2000');
type GisModule = typeof import('../../../frontend/src/features/survey-phase1/constants/metroGisConstants');

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { generateZoneTechnicalSvg, DEFAULT_TITLE_BLOCK }: ExporterModule = require(path.join(FRONTEND_SRC, 'features/zone-management/utils/zoneSvgTechnicalExporter.ts'));
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { wgs84ToVn2000 }: Vn2000Module = require(path.join(FRONTEND_SRC, 'features/zone-management/utils/vn2000.ts'));
// eslint-disable-next-line @typescript-eslint/no-require-imports
const gis: GisModule = require(path.join(FRONTEND_SRC, 'features/survey-phase1/constants/metroGisConstants.ts'));

type LogosModule = typeof import('../../../frontend/src/assets/cadTitleBlockLogos');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { CAD_TITLE_BLOCK_LOGOS }: LogosModule = require(path.join(FRONTEND_SRC, 'assets/cadTitleBlockLogos.ts'));

const STATION_INPUTS = gis.METRO_STATIONS.map((station) => ({ code: station.code, name: station.name, coord: station.pos }));

interface BoundaryFile {
  centerline: Point[];
  corridorBoundaries: { name: string; coords: Point[] }[];
  stationPolygons: { name: string; coords: Point[] }[];
  stationDetailedFootprints: { name: string; coords: Point[] }[];
  allCorridorSegments: { id: string; code: string; coords: Point[] }[];
}

const boundary: BoundaryFile = JSON.parse(
  fs.readFileSync(
    path.resolve(__dirname, '../../../frontend/src/features/survey-phase1/constants/metro_boundary_data.json'),
    'utf8'
  )
);

const failures: string[] = [];
const check = (zone: string, name: string, passed: boolean, detail = '') => {
  if (!passed) failures.push(`[${zone}] ${name} ${detail}`);
};

const inRing = (p: Point, ring: Point[]): boolean => {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    if (
      ring[i][1] > p[1] !== ring[j][1] > p[1] &&
      p[0] < ((ring[j][0] - ring[i][0]) * (p[1] - ring[i][1])) / (ring[j][1] - ring[i][1]) + ring[i][0]
    ) {
      inside = !inside;
    }
  }
  return inside;
};

const parsePath = (d: string): Point[] =>
  d
    .replace(/Z$/, '')
    .slice(1)
    .split('L')
    .map((pair) => pair.trim().split(/\s+/).map(Number) as Point);

const layer = (svg: string, id: string): string => svg.match(new RegExp(`<g id="${id}"[^>]*>([\\s\\S]*?)</g>\\n`))?.[1] ?? '';
const decodeXml = (value: string): string => value.replace(/&amp;/g, '&');

const verifySvg = (zone: string, svg: string, expectedCount: number) => {
  const file = path.join(os.tmpdir(), `zone_svg_${zone}_${process.pid}.svg`);
  fs.writeFileSync(file, svg);
  try {
    execFileSync('xmllint', ['--noout', file], { stdio: 'pipe' });
  } catch (err) {
    check(zone, 'XML hợp lệ', false, String(err));
  } finally {
    fs.unlinkSync(file);
  }

  const expectedStrokes: Record<string, string> = {
    'thua-dat': '0.105',
    'chung-cu-master': '0.350',
    'cong-trinh-nha-ga': '0.175',
    'hop-ga': '0.140',
    'mep-ho-dao': '0.140',
    'tim-tuyen': '0.245',
  };
  for (const [id, width] of Object.entries(expectedStrokes)) {
    const actual = svg.match(new RegExp(`<g id="${id}"[^>]*stroke-width="([^"]*)"`))?.[1];
    check(zone, `Nét lớp ${id}`, actual === width, `${actual}`);
  }
  for (const id of Object.keys(expectedStrokes)) {
    check(zone, `Lớp ${id} không tô nền`, new RegExp(`<g id="${id}" fill="none"`).test(svg));
  }
  check(zone, 'Không còn nền tím', !svg.includes('#8b5cf6') && !svg.includes('fill-opacity'));
  check(zone, 'Tim tuyến nét gạch–chấm', /<g id="tim-tuyen"[^>]*stroke-dasharray="7,1.5,1.2,1.5"/.test(svg));
  // Ranh ga/Depot cắt bằng polyline: không có đoạn nào chạy dọc mép khung vẽ
  const onFrameEdge = (a: Point, b: Point) =>
    [10, 410].some((x) => Math.abs(a[0] - x) < 0.01 && Math.abs(b[0] - x) < 0.01) ||
    [10, 262].some((y) => Math.abs(a[1] - y) < 0.01 && Math.abs(b[1] - y) < 0.01);
  const stationEdgeOnFrame = [...layer(svg, 'cong-trinh-nha-ga').matchAll(/ d="([^"]*)"/g)].some((match) => {
    const pts = parsePath(match[1]);
    return pts.some((pt, i) => i > 0 && onFrameEdge(pts[i - 1], pt));
  });
  check(zone, 'Nét nhà ga không chạy dọc mép khung', !stationEdgeOnFrame);
  check(zone, 'Ô REV căn giữa', /<text x="403\.850"[^>]*data-field="revision">/.test(svg));

  const parcelRings = new Map<string, Point[]>();
  for (const id of ['thua-dat', 'chung-cu-master']) {
    for (const match of layer(svg, id).matchAll(/<path data-code="([^"]*)" d="([^"]*)"/g)) {
      parcelRings.set(decodeXml(match[1]), parsePath(match[2]));
    }
  }
  check(zone, 'Số thửa vẽ ra', parcelRings.size === expectedCount, `${parcelRings.size}/${expectedCount}`);

  for (const id of ['thua-dat', 'chung-cu-master', 'cong-trinh-nha-ga', 'hop-ga', 'mep-ho-dao', 'tim-tuyen']) {
    for (const match of layer(svg, id).matchAll(/ d="([^"]*)"/g)) {
      const outside = parsePath(match[1]).find(([x, y]) => x < -0.01 || x > 420.01 || y < -0.01 || y > 297.01);
      check(zone, `Đỉnh trong viewBox (${id})`, !outside, String(outside));
    }
  }

  const labels = [...layer(svg, 'nhan-ma-thua').matchAll(
    /<text data-code="([^"]*)" x="([^"]*)" y="([^"]*)" font-size="([^"]*)"(?: transform="rotate\(([^ ]*) ([^ ]*) ([^)]*)\)")?>/g
  )];
  check(zone, 'Mỗi thửa một nhãn', labels.length === expectedCount, `${labels.length}/${expectedCount}`);

  let rotatedLabels = 0;
  const fontSizes: number[] = [];
  for (const [, rawCode, x, y, size, angle, pivotX, pivotY] of labels) {
    const code = decodeXml(rawCode);
    const ring = parcelRings.get(code);
    if (!ring) {
      check(zone, 'Nhãn khớp thửa', false, code);
      continue;
    }
    const fontSize = Number(size);
    fontSizes.push(fontSize);
    const degrees = angle ? Number(angle) : 0;
    if (angle) rotatedLabels++;
    check(zone, 'Chữ không lộn ngược', degrees > -90 && degrees <= 90, `${code} ${degrees}`);

    const cx = angle ? Number(pivotX) : Number(x);
    const cy = angle ? Number(pivotY) : Number(y) - 0.35 * fontSize;
    const halfWidth = (code.length * 0.62 * fontSize) / 2;
    const halfHeight = fontSize / 2;
    const cos = Math.cos((degrees * Math.PI) / 180);
    const sin = Math.sin((degrees * Math.PI) / 180);
    const corners: Point[] = [[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([u, v]) => [
      cx + u * halfWidth * cos - v * halfHeight * sin,
      cy + u * halfWidth * sin + v * halfHeight * cos,
    ]);
    check(zone, 'Khung nhãn nằm trong thửa', corners.every((corner) => inRing(corner, ring)), code);
  }
  return { rotatedLabels, fontSizes: fontSizes.sort((a, b) => a - b) };
};

// ============================================================================
// Kiểm tra bố cục CAD theo PDF mẫu (khung, khung tên, ô phụ, sơ đồ tuyến, bảng tọa độ)
// ============================================================================

const decodeEntities = (value: string): string =>
  value
    .replace(/&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&');

const TITLE_BLOCK_STRINGS = [
  'EMPLOYER / CHỦ ĐẦU TƯ',
  "HCMC PEOPLE'S COMMITTE",
  'MANAGEMENT AUTHORITY FOR URBAN RAILWAYS',
  'UBND TP HCM-BAN QUẢN LÝ ĐƯỜNG SẮT ĐÔ THỊ',
  'PICC / TƯ VẤN KIỂM SOÁT THỰC HIỆN DỰ ÁN',
  'GMG - YOOSHIN - TEDIS - PCC JOINT VENTURE',
  'LIÊN DANH GMG - YOOSHIN - TEDIS - PCC',
  'CONTRACTOR/ NHÀ THẦU',
  'TRUONG HAI GROUP CORPORATION',
  'CHINA RAILWAY GROUP LIMITED',
  'SUB CONSTRUCTION CONTRACTOR/ NHÀ THẦU PHỤ THI CÔNG',
  'China Railway Southwest Research Institute Co., Ltd.',
  'PREPARED',
  'REVIEWER',
  'APPROVED BY',
  'NGƯỜI DUYỆT',
  'MANAGER',
  'PROJECT MANAGER',
  'SCALE / TỶ LỆ',
  'FORMAT / KHỔ BẢN VẼ',
  'A3',
  'DATE ISSUE / NGÀY PHÁT HÀNH',
  'CONSTRUCTION DRAWING DESIGN (PHASE 2)',
  'THIẾT KẾ BẢN VẼ THI CÔNG (GIAI ĐOẠN 2)',
  'HO CHI MINH CITY MASS RAPID TRANSIT LINE 2 BEN THANH - THAM LUONG',
  'DRAWING TITLE / TÊN BẢN VẼ',
  'DRAWING NO',
  'REV / BẢN',
  'DESCRIPTION / NỘI DUNG SỬA ĐỔI',
];

interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

const panelRect = (svg: string, id: string): Rect | null => {
  const match = svg.match(new RegExp(`<g id="${id}"[^>]*><rect x="([^"]*)" y="([^"]*)" width="([^"]*)" height="([^"]*)"`));
  return match ? { x: Number(match[1]), y: Number(match[2]), width: Number(match[3]), height: Number(match[4]) } : null;
};

const overlaps = (a: Rect, b: Rect): boolean =>
  a.x < b.x + b.width - 0.01 && b.x < a.x + a.width - 0.01 && a.y < b.y + b.height - 0.01 && b.y < a.y + a.height - 0.01;

const verifyCadLayout = (
  zone: string,
  svg: string,
  result: ReturnType<typeof generateZoneTechnicalSvg>,
  expected: { drawingCode: string; titleVi: string; highlight: 'station' | 'section' | 'depot'; stations: string[] }
) => {
  const text = decodeEntities(svg);
  check(zone, 'Khung bản vẽ lề 10 mm', svg.includes('<rect x="10" y="10" width="400" height="277"'));
  check(zone, 'Khung tên cao 25 mm từ Y=262', /<g id="khung-ten"[^>]*><rect x="10" y="262" width="400" height="25"/.test(svg));
  check(zone, 'Không còn lưới chữ-số mép', !svg.includes('id="luoi-toa-do"'));
  check(zone, 'Ô chỉ dẫn tờ 1/1', svg.includes('data-sheet="1/1"') && svg.includes('data-current="true"'));
  for (const s of TITLE_BLOCK_STRINGS) check(zone, 'Khung tên có chuỗi PDF', text.includes(`>${s}<`), s);
  check(zone, 'Tên bản vẽ tiếng Việt', text.includes(`data-field="title-vi">${expected.titleVi}<`), expected.titleVi);
  check(zone, 'Tỷ lệ in trong khung tên', svg.includes(`data-field="scale">1:${result.scaleDenominator}<`));
  check(zone, 'Lần ban hành mặc định R00', svg.includes('data-field="revision">R00<') && svg.includes('data-revision="R00"'));
  check(zone, 'Ngày phát hành mặc định .../.../YYYY', /data-field="issue-date">\.\.\.\/\.\.\.\/\d{4}</.test(svg));
  check(zone, 'Người vẽ mặc định theo PDF', text.includes(`>${DEFAULT_TITLE_BLOCK.preparedBy}<`));
  check(zone, 'Mã bản vẽ', result.identity.drawingCode === expected.drawingCode, result.identity.drawingCode);

  // Mọi tọa độ chữ/hình phải nằm trong trang A3
  for (const match of svg.matchAll(/ (x|y|cx|cy)="(-?[\d.]+)"/g)) {
    const value = Number(match[2]);
    const max = match[1] === 'x' || match[1] === 'cx' ? 420 : 297;
    if (value < 0 || value > max) {
      check(zone, 'Tọa độ trong trang A3', false, `${match[1]}=${value}`);
      break;
    }
  }

  // Ô phụ nằm trong vùng vẽ, không đè nhau, không đè ô chỉ dẫn tờ
  const drawRect: Rect = { x: 10, y: 10, width: 400, height: 252 };
  const sheetKey: Rect = { x: 358, y: 10, width: 52, height: 19 };
  const panels = ['so-do-tuyen', 'bang-diem-khong-che', 'chu-giai']
    .map((id) => ({ id, rect: panelRect(svg, id) }))
    .filter((panel): panel is { id: string; rect: Rect } => panel.rect !== null);
  check(zone, 'Có sơ đồ tuyến', panels.some((panel) => panel.id === 'so-do-tuyen'));
  panels.forEach(({ id, rect }) => {
    const inside =
      rect.x >= drawRect.x - 0.01 &&
      rect.y >= drawRect.y - 0.01 &&
      rect.x + rect.width <= drawRect.x + drawRect.width + 0.01 &&
      rect.y + rect.height <= drawRect.y + drawRect.height + 0.01;
    check(zone, `Ô ${id} nằm trong vùng vẽ`, inside, JSON.stringify(rect));
    check(zone, `Ô ${id} không đè ô chỉ dẫn tờ`, !overlaps(rect, sheetKey));
  });
  for (let i = 0; i < panels.length; i++) {
    for (let j = i + 1; j < panels.length; j++) {
      check(zone, 'Các ô phụ không đè nhau', !overlaps(panels[i].rect, panels[j].rect), `${panels[i].id} × ${panels[j].id}`);
    }
  }

  // Sơ đồ tuyến tô đúng ga / đoạn hầm / Depot
  check(zone, 'Sơ đồ tuyến đánh dấu đúng mã', svg.includes(`<g id="so-do-tuyen" data-highlight="${expected.drawingCode}"`));
  const highlighted = [...svg.matchAll(/data-station="([^"]*)" data-highlight="true"/g)].map((m) => m[1]);
  if (expected.highlight === 'station') {
    check(zone, 'Chấm đỏ đúng 1 ga', highlighted.length === 1 && highlighted[0] === expected.stations[0], highlighted.join(','));
  } else if (expected.highlight === 'section') {
    check(zone, 'Tô đoạn hầm giữa 2 ga', svg.includes(`data-highlight-section="${expected.drawingCode}"`) && highlighted.length === 0);
  } else {
    check(zone, 'Tô Depot', highlighted.length === 1 && highlighted[0] === 'DEP', highlighted.join(','));
  }
  const routeRect = panelRect(svg, 'so-do-tuyen');
  const depotGroup = svg.match(/<g data-station="DEP"[\s\S]*?<\/g>/)?.[0] ?? '';
  // Mọi điểm của nhánh (path d="M.. Q.. ..", khối "M..L..Z") và nhãn (x, y)
  const depotNumbers: Point[] = [
    ...[...depotGroup.matchAll(/ d="([^"]*)"/g)].flatMap((m) => {
      const values = m[1].match(/-?[\d.]+/g)?.map(Number) ?? [];
      return values.flatMap((value, i) => (i % 2 === 0 ? [[value, values[i + 1]] as Point] : []));
    }),
    ...[...depotGroup.matchAll(/<text x="(-?[\d.]+)" y="(-?[\d.]+)"/g)].map((m) => [Number(m[1]), Number(m[2])] as Point),
  ];
  check(zone, 'Depot là nhánh cong', /data-depot-branch="true" d="M[^"]*Q/.test(depotGroup));
  check(
    zone,
    'Nhánh Depot nằm trong ô sơ đồ',
    !!routeRect && depotNumbers.length > 0 && depotNumbers.every(([x, y]) => x >= routeRect.x && x <= routeRect.x + routeRect.width && y >= routeRect.y && y <= routeRect.y + routeRect.height),
    JSON.stringify(depotNumbers.slice(0, 3)),
  );
  check(zone, 'Sơ đồ tuyến đủ 11 ga + Depot', (svg.match(/<g data-station="/g) ?? []).length === 12);
  check(zone, 'Nhãn ga không dấu đúng mẫu', text.includes('>Ben Thanh, ST01<') && text.includes('>Tan Binh, ST11<') && text.includes('>Depot<'));

  // Bảng điểm khống chế: đủ điểm, tọa độ VN2000 hợp lý, số trên bản vẽ khớp bảng
  if (expected.highlight !== 'depot') {
    const tableLayer = svg.match(/<g id="bang-diem-khong-che">[\s\S]*?\n/)?.[0] ?? '';
    const xs = [...tableLayer.matchAll(/data-axis="x">([\d.]+)</g)].map((m) => Number(m[1]));
    const ys = [...tableLayer.matchAll(/data-axis="y">([\d.]+)</g)].map((m) => Number(m[1]));
    check(zone, 'Bảng tọa độ ≥ 3 điểm, đủ số điểm', xs.length >= 3 && xs.length === result.controlPoints.length, `${xs.length}/${result.controlPoints.length}`);
    check(zone, 'X (Northing) trong miền TP.HCM', xs.every((x) => x > 1.18e6 && x < 1.21e6), String(xs[0]));
    check(zone, 'Y (Easting) trong miền TP.HCM', ys.every((y) => y > 5.8e5 && y < 6.2e5), String(ys[0]));
    check(zone, 'Bảng tọa độ có tiêu đề song ngữ', text.includes('>TỌA ĐỘ ĐIỂM KHỐNG CHẾ<') && text.includes('>COORDINATES OF CONTROL POINTS<'));
    const numbersOnMap = (svg.match(/<g id="so-hieu-diem-khong-che">[\s\S]*?\n/)?.[0].match(/data-control-point="/g) ?? []).length;
    check(zone, 'Số hiệu điểm trên bản vẽ = số dòng bảng', numbersOnMap === result.controlPoints.length, `${numbersOnMap}/${result.controlPoints.length}`);
    check(zone, 'Có nhãn Boundary Building', text.includes('>Boundary Building<'));
    check(zone, 'Không tô chấm vùng khảo sát', !svg.includes('cham-xanh') && !svg.includes('id="vung-khao-sat"'));
  }
};

/** 20 điểm khống chế ST01 trên PDF chính thức ↔ đỉnh SEG_01 trong metro_boundary_data.json */
const PDF_CONTROL_POINTS_ST01: { vertex: number; x: number; y: number }[] = [
  { vertex: 17, x: 1191215.042, y: 603674.034 },
  { vertex: 16, x: 1191217.214, y: 603617.037 },
  { vertex: 12, x: 1191187.987, y: 603545.269 },
  { vertex: 8, x: 1191219.42, y: 603518.361 },
  { vertex: 7, x: 1191222.686, y: 603432.638 },
  { vertex: 6, x: 1191135.463, y: 603337.764 },
  { vertex: 4, x: 1191234.906, y: 603298.064 },
  { vertex: 3, x: 1191239.499, y: 603262.771 },
  { vertex: 2, x: 1191245.84, y: 603119.254 },
  { vertex: 1, x: 1191245.039, y: 603102.223 },
  { vertex: 0, x: 1191251.466, y: 603021.805 },
  { vertex: 27, x: 1191392.761, y: 603031.256 },
  { vertex: 26, x: 1191387.396, y: 603111.463 },
  { vertex: 25, x: 1191386.36, y: 603117.74 },
  { vertex: 24, x: 1191376.796, y: 603342.476 },
  { vertex: 23, x: 1191396.69, y: 603391.325 },
  { vertex: 22, x: 1191377.0, y: 603403.04 },
  { vertex: 20, x: 1191368.278, y: 603639.747 },
  { vertex: 19, x: 1191364.882, y: 603641.557 },
  { vertex: 18, x: 1191363.429, y: 603679.688 },
];

const verifyVn2000AgainstPdf = () => {
  const seg = boundary.allCorridorSegments[0].coords;
  let worst = 0;
  for (const point of PDF_CONTROL_POINTS_ST01) {
    const vn = wgs84ToVn2000(seg[point.vertex]);
    const error = Math.hypot(vn.x - point.x, vn.y - point.y);
    worst = Math.max(worst, error);
    check('VN2000', `Điểm đỉnh ${point.vertex} lệch PDF ≤ 0.10 m`, error <= 0.1, error.toFixed(3));
  }
  console.log(`VN2000: 20 điểm khống chế ST01 lệch PDF tối đa ${worst.toFixed(3)} m sau hiệu chỉnh`);
};

const ZONE_KIND_BY_INDEX = (index: number): 'C&C' | 'POR' | 'DEP' => (index === 22 ? 'DEP' : index % 2 === 1 ? 'C&C' : 'POR');

const expectationFor = (index: number) => {
  const kind = ZONE_KIND_BY_INDEX(index);
  const pad = (n: number) => String(n).padStart(2, '0');
  if (kind === 'C&C') {
    const st = `ST${pad(Math.ceil(index / 2))}`;
    return { kind, drawingCode: st, titleVi: `BẢN VẼ KHẢO SÁT HIỆN TRẠNG NHÀ TẠI GA ${st}`, highlight: 'station' as const, stations: [st] };
  }
  if (kind === 'DEP') {
    return { kind, drawingCode: 'DEP-01', titleVi: 'BẢN VẼ KHẢO SÁT HIỆN TRẠNG NHÀ TẠI DEPOT DEP-01', highlight: 'depot' as const, stations: [] };
  }
  const seq = index / 2;
  const code = `POR-${pad(seq)}`;
  return {
    kind,
    drawingCode: code,
    titleVi: `BẢN VẼ KHẢO SÁT HIỆN TRẠNG NHÀ ĐOẠN HẦM ${code} (GA ST${pad(seq)} – GA ST${pad(seq + 1)})`,
    highlight: 'section' as const,
    stations: [`ST${pad(seq)}`, `ST${pad(seq + 1)}`],
  };
};

const main = async () => {
  verifyVn2000AgainstPdf();

  const client = new Client({
    host: process.env.DB_HOST || 'localhost',
    port: Number(process.env.DB_PORT || 5433),
    user: process.env.DB_USER || 'metro2_user',
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME || 'metro2_gis_db',
  });
  await client.connect();
  await client.query('BEGIN READ ONLY');
  const { rows } = await client.query(
    `SELECT zone_id, project_parcel_code, building_type, ST_AsGeoJSON(cadastral_polygon_geom)::json AS geo
     FROM parcels WHERE lifecycle_status = 'ACTIVE' ORDER BY zone_id, project_parcel_code`
  );
  await client.query('ROLLBACK');
  await client.end();

  const byZone = new Map<string, typeof rows>();
  rows.forEach((row) => byZone.set(row.zone_id, [...(byZone.get(row.zone_id) ?? []), row]));

  for (const [zone, zoneRows] of byZone) {
    const zoneIndex = Number(zone.replace(/\D/g, ''));
    const expected = expectationFor(zoneIndex);
    const options = {
      zoneCode: zone,
      zoneName: `${zone} -> kiểm thử`,
      zoneKind: expected.kind,
      zoneIndex,
      surveyBoundary: boundary.allCorridorSegments[zoneIndex - 1]?.coords,
      stations: STATION_INPUTS,
      parcels: zoneRows.map((row) => ({
        code: row.project_parcel_code as string,
        isCondoMaster: row.building_type === 'CONDOMINIUM',
        ring: (row.geo.coordinates[0] as Point[]).map(([lng, lat]) => [lat, lng] as Point),
      })),
      centerlineCoords: boundary.centerline,
      corridorBoundaries: boundary.corridorBoundaries,
      stationBoxes: boundary.stationPolygons,
      stationOutlines: boundary.stationDetailedFootprints,
    };

    const result = generateZoneTechnicalSvg(options);
    const stats = verifySvg(zone, result.svg, zoneRows.length);
    verifyCadLayout(zone, result.svg, result, expected);
    check(zone, 'Bắc ở nửa trên trang', Math.cos((result.rotationDeg * Math.PI) / 180) > 0, String(result.rotationDeg));

    // Đối chứng toán xoay độc lập: lấy lại cung tim tuyến của Zone, xoay theo góc đã xuất, độ dốc phải về 0
    const lat0 = options.parcels[0].ring[0][0];
    const metersPerLng = 111320 * Math.cos((lat0 * Math.PI) / 180);
    const toMeters = ([lat, lng]: Point): Point => [lng * metersPerLng, -lat * 111320];
    const line = boundary.centerline.map(toMeters);
    const segmentDistance = (p: Point, a: Point, b: Point) => {
      const dx = b[0] - a[0];
      const dy = b[1] - a[1];
      const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / (dx * dx + dy * dy || 1)));
      return Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy);
    };
    const nearestSegment = (p: Point) => {
      let best = 0;
      for (let i = 1; i < line.length - 1; i++) {
        if (segmentDistance(p, line[i], line[i + 1]) < segmentDistance(p, line[best], line[best + 1])) best = i;
      }
      return best;
    };
    const segmentIndexes = options.parcels.map((parcel) => {
      const ring = parcel.ring.slice(0, -1).map(toMeters);
      return nearestSegment([ring.reduce((sum, p) => sum + p[0], 0) / ring.length, ring.reduce((sum, p) => sum + p[1], 0) / ring.length]);
    });
    const arc = line.slice(Math.min(...segmentIndexes), Math.max(...segmentIndexes) + 2);
    const radians = (result.rotationDeg * Math.PI) / 180;
    const rotated = arc.map(([x, y]): Point => [x * Math.cos(radians) - y * Math.sin(radians), x * Math.sin(radians) + y * Math.cos(radians)]);
    const weighted = rotated.slice(1).map((p, i) => ({
      x: (p[0] + rotated[i][0]) / 2,
      y: (p[1] + rotated[i][1]) / 2,
      w: Math.hypot(p[0] - rotated[i][0], p[1] - rotated[i][1]),
    }));
    const totalWeight = weighted.reduce((sum, s) => sum + s.w, 0);
    const meanX = weighted.reduce((sum, s) => sum + s.w * s.x, 0) / totalWeight;
    const meanY = weighted.reduce((sum, s) => sum + s.w * s.y, 0) / totalWeight;
    const slopeDeg =
      (Math.atan2(
        weighted.reduce((sum, s) => sum + s.w * (s.x - meanX) * (s.y - meanY), 0),
        weighted.reduce((sum, s) => sum + s.w * (s.x - meanX) ** 2, 0)
      ) *
        180) /
      Math.PI;
    check(zone, 'Tim tuyến nằm ngang', Math.abs(slopeDeg) < 0.5, slopeDeg.toFixed(3));
    if (process.env.SVG_OUT_DIR) {
      fs.writeFileSync(path.join(process.env.SVG_OUT_DIR, `${zone}.svg`), result.svg);
    }

    const unrotated = generateZoneTechnicalSvg({ ...options, autoRotateHorizontal: false });
    check(zone, 'Tắt xoay thì α = 0', unrotated.rotationDeg === 0, String(unrotated.rotationDeg));
    const noLabels = generateZoneTechnicalSvg({ ...options, includeLabels: false, includeCompass: false });
    check(zone, 'Tắt nhãn và la bàn', !noLabels.svg.includes('<text data-code') && !noLabels.svg.includes('id="la-ban"'));
    const withExtras = generateZoneTechnicalSvg({ ...options, includeLegend: true, includeScaleBar: true });
    check(zone, 'Bật chú giải & thước tỷ lệ', withExtras.svg.includes('id="chu-giai"') && withExtras.svg.includes('id="thuoc-ty-le"'));
    verifyCadLayout(zone, withExtras.svg, withExtras, expected);
    const plain = generateZoneTechnicalSvg(options);
    check(zone, 'Mặc định không có chú giải & thước tỷ lệ (như PDF)', !plain.svg.includes('id="chu-giai"') && !plain.svg.includes('id="thuoc-ty-le"'));
    check(zone, 'Mặc định nhãn mã khảo sát, tiêu đề khảo sát', plain.labelMode === 'SURVEY_CODE' && !plain.svg.includes('BIỆN PHÁP'));

    // Chế độ Mã Biện Pháp: mã giả lập (không phụ thuộc cột method_code của DB đang kiểm thử)
    const withMethod = options.parcels.map((parcel) => ({ ...parcel, methodCode: `MC-${parcel.code}` }));
    const method = generateZoneTechnicalSvg({ ...options, parcels: withMethod, parcelLabelMode: 'METHOD_CODE' });
    const labelTexts = [...method.svg.matchAll(/<text data-code="[^"]*" data-method-code="([^"]*)"[^>]*>([^<]*)<\/text>/g)];
    check(zone, 'Biện pháp: nhãn in mã biện pháp', labelTexts.length > 0 && labelTexts.every((m) => m[1] === m[2]), String(labelTexts.length));
    check(zone, 'Biện pháp: path giữ data-code & thêm data-method-code', (method.svg.match(/<path data-code="[^"]*" data-method-code="/g) ?? []).length === method.parcelCount);
    check(zone, 'Biện pháp: tiêu đề khung tên VI/EN', method.svg.includes('BẢN VẼ BIỆN PHÁP KHẢO SÁT HIỆN TRẠNG') && method.svg.includes('METHOD STATEMENT DRAWING') && method.identity.drawingCode === result.identity.drawingCode);
    let missingThrown = false;
    try {
      generateZoneTechnicalSvg({ ...options, parcels: withMethod.map((p, i) => (i === 0 ? { ...p, methodCode: null } : p)), parcelLabelMode: 'METHOD_CODE' });
    } catch (err: unknown) {
      missingThrown = err instanceof Error && err.message.includes('chưa có mã biện pháp');
    }
    check(zone, 'Biện pháp: thiếu mã thì chặn, không fallback', missingThrown);

    if (zone === 'ZONE_01') {
      // Khung tên đã lưu: tên ký, số bản vẽ và 8 lần phát hành (chỉ hiện 7 lần mới nhất)
      const revisions = Array.from({ length: 8 }, (_, i) => ({
        revision: `R${String(i).padStart(2, '0')}`,
        issueDate: `2026-11-${String(i + 1).padStart(2, '0')}`,
        description: `Lần ${i}`,
      }));
      const configuredResult = generateZoneTechnicalSvg({
        ...options,
        logos: CAD_TITLE_BLOCK_LOGOS,
        titleBlock: { ...DEFAULT_TITLE_BLOCK, manager: 'Trần Văn A', drawingNo: 'M2-ST01-001', revisions },
      });
      const configured = configuredResult.svg;
      check(zone, 'Đủ 6 logo khung tên', configuredResult.missingLogos.length === 0 && (configured.match(/data-logo="/g) ?? []).length === 6, configuredResult.missingLogos.join(','));
      if (process.env.SVG_OUT_DIR) fs.writeFileSync(path.join(process.env.SVG_OUT_DIR, `${zone}_logos.svg`), configured);
      check(zone, 'Khung tên dùng cấu hình đã lưu', configured.includes('>TRẦN VĂN A<') && configured.includes('data-field="drawing-no">M2-ST01-001<'));
      check(zone, 'REV mới nhất & ngày dd/mm/yyyy', configured.includes('data-field="revision">R07<') && configured.includes('data-field="issue-date">08/11/2026<'));
      check(zone, 'Khối REV hiện 7 lần mới nhất', !configured.includes('data-revision="R00"') && configured.includes('data-revision="R01"') && configured.includes('data-revision="R07"'));

      // Zone Depot: tô Depot, không có ranh/bảng tọa độ khi thiếu polygon ranh
      const depotExpected = expectationFor(22);
      const depot = generateZoneTechnicalSvg({ ...options, zoneKind: 'DEP', zoneIndex: 22, surveyBoundary: undefined });
      verifyCadLayout('DEP(synthetic)', depot.svg, depot, depotExpected);
      check('DEP(synthetic)', 'Thiếu ranh thì không có bảng tọa độ', !depot.svg.includes('id="bang-diem-khong-che"') && depot.controlPoints.length === 0);
      check('DEP(synthetic)', 'Thiếu logo được báo', depot.missingLogos.length === 6);
    }

    const { fontSizes, rotatedLabels } = stats;
    const median = fontSizes[Math.floor(fontSizes.length / 2)] ?? 0;
    console.log(
      `${zone}: ${zoneRows.length} thửa | α=${result.rotationDeg.toFixed(2)}° | dốc ${slopeDeg.toFixed(3)}° | 1:${result.scaleDenominator} | lệch ±${result.residualMeters.toFixed(1)} m | nhãn xoay ${rotatedLabels} | cỡ chữ min/median ${fontSizes[0]?.toFixed(2)}/${median.toFixed(2)} mm | ${(result.svg.length / 1024).toFixed(0)} KB`
    );
  }

  // Đối chứng nghịch đảo tọa độ: hình vuông phía Bắc tim tuyến phải nằm trên tim tuyến trong bản vẽ không xoay
  const reference = boundary.centerline[Math.floor(boundary.centerline.length / 2)];
  const delta = 0.0004;
  const square = (lat: number, code: string) => ({
    code,
    isCondoMaster: false,
    ring: [[lat, reference[1]], [lat, reference[1] + delta], [lat + delta, reference[1] + delta], [lat + delta, reference[1]]] as Point[],
  });
  const orientation = generateZoneTechnicalSvg({
    zoneCode: 'TEST',
    zoneName: 'TEST',
    zoneKind: 'C&C',
    zoneIndex: 1,
    parcels: [square(reference[0] + 0.0005, 'NORTH'), square(reference[0] - 0.0009, 'SOUTH')],
    centerlineCoords: boundary.centerline,
    corridorBoundaries: [],
    stationBoxes: [],
    stationOutlines: [],
    autoRotateHorizontal: false,
  }).svg;
  const textY = (code: string) => Number(orientation.match(new RegExp(`data-code="${code}" x="[^"]*" y="([^"]*)"`))?.[1]);
  check('TEST', 'Thửa phía Bắc nằm trên thửa phía Nam', textY('NORTH') < textY('SOUTH'));

  if (failures.length > 0) {
    console.error(`\nFAILED ${failures.length} kiểm tra:`);
    failures.slice(0, 40).forEach((failure) => console.error(`  ${failure}`));
    process.exit(1);
  }
  console.log('\nPASSED: tất cả kiểm tra đạt.');
};

main().catch((err) => {
  console.error('[ZoneSvgExporterTest] Failed:', err);
  process.exit(1);
});
