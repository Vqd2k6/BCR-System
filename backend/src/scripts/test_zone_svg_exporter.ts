/**
 * Kiểm thử exporter bình đồ SVG trên dữ liệu thật của mọi Zone có thửa (chỉ đọc DB).
 * Chạy: cd backend && npx ts-node --transpile-only src/scripts/test_zone_svg_exporter.ts
 * Kiểm định kết quả bằng cách đọc lại file SVG, không dựa vào trạng thái nội bộ của exporter.
 */
import { execFileSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';
import Module from 'module';
import { Client } from 'pg';
import ts from 'typescript';

type Point = [number, number];

// frontend là ESM ("type": "module") nên phải transpile sang CommonJS mới nạp được từ ts-node
const loadExporter = () => {
  const source = path.resolve(__dirname, '../../../frontend/src/features/zone-management/utils/zoneSvgTechnicalExporter.ts');
  const { outputText } = ts.transpileModule(fs.readFileSync(source, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2021 },
  });
  const compiled = new Module(source) as Module & { _compile: (code: string, filename: string) => void };
  compiled._compile(outputText, source);
  return compiled.exports as typeof import('../../../frontend/src/features/zone-management/utils/zoneSvgTechnicalExporter');
};

const { generateZoneTechnicalSvg } = loadExporter();

interface BoundaryFile {
  centerline: Point[];
  corridorBoundaries: { name: string; coords: Point[] }[];
  stationPolygons: { name: string; coords: Point[] }[];
  stationDetailedFootprints: { name: string; coords: Point[] }[];
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
    'chung-cu-master': '0.175',
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

const main = async () => {
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
    const options = {
      zoneCode: zone,
      zoneName: `${zone} (C&C) -> kiểm thử`,
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
