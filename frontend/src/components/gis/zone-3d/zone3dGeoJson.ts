/**
 * Chuyển dữ liệu bản đồ 2D (Leaflet, [lat, lng]) sang GeoJSON ([lng, lat]) cho chế độ 3D cô lập theo Zone.
 * Toàn bộ là hàm thuần (không import maplibre-gl) để test bằng node.
 *
 * Chiều cao chỉ để MINH HOẠ trực quan: số tầng nổi đã khảo sát (JSON) × FLOOR_HEIGHT_M.
 * Không đọc floor_count / buildingHeightM mặc định ở cấp thửa (xem Q7 TASK_DANG_DO_4.md).
 */

import type { GisParcel, Parcel3DInfo, ThematicFilterMatch, ThematicMapBinding } from '../shared/types';

export type LatLng = [number, number];
export type LngLat = [number, number];

/** Chiều cao 1 tầng dùng để minh hoạ (m). */
export const FLOOR_HEIGHT_M = 3.3;
/** Khối tượng trưng cho thửa có công trình / chưa có số liệu (m). */
export const SYMBOLIC_HEIGHT_M = 3.2;
/** Số tầng vượt ngưỡng này coi là dữ liệu bất thường ⇒ chỉ vẽ khối tượng trưng. */
export const MAX_PLAUSIBLE_FLOORS = 200;
/** Đệm quanh Zone cho maxBounds (độ, ~30 m). */
export const ZONE_BOUNDS_PAD_DEG = 0.0003;

/**
 * Màu khối "Chưa có số liệu" ở layout chuyên đề — trùng UNASSESSED_BUCKET (thematicLayouts.registry.ts).
 * Không lấy màu của binding vì binding xếp thửa chưa khảo sát có constructionArea = 0 vào nhóm "Đất trống / Hạ tầng" (đoán).
 */
export const UNASSESSED_3D_HEX = '#94a3b8';

export const DIMMED_FLAT_OPACITY = 0.08;
export const VACANT_FLAT_OPACITY = 0.45;

export type Parcel3DKind = 'FLOORS' | 'SYMBOLIC' | 'UNASSESSED' | 'FLAT_VACANT';
/** Layer vẽ: SOLID (khối đặc), GHOST (khối tượng trưng chưa số liệu, mờ hơn), FLAT (nằm sát đất). */
export type Parcel3DTier = 'SOLID' | 'GHOST' | 'FLAT';

export interface Parcel3DShape {
  heightM: number;
  kind: Parcel3DKind;
  /** Bị làm mờ bởi bộ lọc chỉ định (DIM) ⇒ nằm phẳng. */
  dimmed: boolean;
  tier: Parcel3DTier;
  /** Số tầng dùng để dựng (chỉ khi kind = FLOORS). */
  floors: number | null;
}

// ---------- GeoJSON tối thiểu (không phụ thuộc @types/geojson) ----------

export interface GeoPolygon {
  type: 'Polygon';
  coordinates: number[][][];
}
export interface GeoLineString {
  type: 'LineString';
  coordinates: number[][];
}
export interface GeoFeature<G, P> {
  type: 'Feature';
  geometry: G;
  properties: P;
}
export interface GeoFeatureCollection<G, P> {
  type: 'FeatureCollection';
  features: GeoFeature<G, P>[];
}

export type ParcelFeatureProps = {
  parcelId: string;
  code: string;
  heightM: number;
  kind: Parcel3DKind;
  tier: Parcel3DTier;
  fillHex: string;
  hoverHex: string;
  /** Độ mờ khi vẽ phẳng (layer parcels-flat-fill). */
  flatOpacity: number;
  floors: number;
};

export type ParcelFeatureCollection = GeoFeatureCollection<GeoPolygon, ParcelFeatureProps>;

// ---------- Hình học ----------

const same = (a: number[], b: number[]): boolean => a[0] === b[0] && a[1] === b[1];

/**
 * [lat, lng] (Leaflet) → vòng [lng, lat] (GeoJSON), bỏ điểm trùng liên tiếp và điểm không hữu hạn, tự đóng vòng.
 * Ít hơn 3 đỉnh hợp lệ ⇒ [].
 */
export function toLngLatRing(latLngRing: ReadonlyArray<readonly number[]> | null | undefined): LngLat[] {
  if (!latLngRing) return [];
  const out: LngLat[] = [];
  for (const pt of latLngRing) {
    const lat = Number(pt?.[0]);
    const lng = Number(pt?.[1]);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
    const next: LngLat = [lng, lat];
    if (out.length > 0 && same(out[out.length - 1], next)) continue;
    out.push(next);
  }
  // Nếu dữ liệu đã đóng vòng sẵn thì bỏ điểm cuối trước khi đếm đỉnh
  if (out.length > 1 && same(out[0], out[out.length - 1])) out.pop();
  if (out.length < 3) return [];
  out.push([out[0][0], out[0][1]]);
  return out;
}

export interface Bbox {
  minLng: number;
  minLat: number;
  maxLng: number;
  maxLat: number;
}

export function bboxOfPoints(points: ReadonlyArray<readonly number[]>): Bbox | null {
  let b: Bbox | null = null;
  for (const [lng, lat] of points) {
    if (!Number.isFinite(lng) || !Number.isFinite(lat)) continue;
    if (!b) b = { minLng: lng, minLat: lat, maxLng: lng, maxLat: lat };
    else {
      if (lng < b.minLng) b.minLng = lng;
      if (lng > b.maxLng) b.maxLng = lng;
      if (lat < b.minLat) b.minLat = lat;
      if (lat > b.maxLat) b.maxLat = lat;
    }
  }
  return b;
}

export function unionBbox(a: Bbox | null, b: Bbox | null): Bbox | null {
  if (!a) return b;
  if (!b) return a;
  return {
    minLng: Math.min(a.minLng, b.minLng),
    minLat: Math.min(a.minLat, b.minLat),
    maxLng: Math.max(a.maxLng, b.maxLng),
    maxLat: Math.max(a.maxLat, b.maxLat),
  };
}

export function bboxIntersects(a: Bbox, b: Bbox): boolean {
  return a.minLng <= b.maxLng && a.maxLng >= b.minLng && a.minLat <= b.maxLat && a.maxLat >= b.minLat;
}

export function expandBbox(b: Bbox, padDeg: number): Bbox {
  return { minLng: b.minLng - padDeg, minLat: b.minLat - padDeg, maxLng: b.maxLng + padDeg, maxLat: b.maxLat + padDeg };
}

// ---------- Chiều cao & hình khối ----------

type ParcelCodeSource = Pick<GisParcel, 'projectParcelCode' | 'project_parcel_code' | 'parcelType' | 'parcel_type'>;

/** Thửa dư (-DU / RESIDUAL) sinh ra từ gộp / tách thửa: luôn nằm phẳng. */
export function isResidualParcel(parcel: ParcelCodeSource): boolean {
  const code = String(parcel.projectParcelCode || parcel.project_parcel_code || '').toUpperCase();
  return code.endsWith('-DU') || parcel.parcelType === 'RESIDUAL' || parcel.parcel_type === 'RESIDUAL';
}

function validFloors(n: number | null | undefined): number | null {
  if (n === null || n === undefined) return null;
  return Number.isInteger(n) && n >= 1 && n <= MAX_PLAUSIBLE_FLOORS ? n : null;
}

/**
 * Hình khối minh hoạ của 1 thửa.
 * - Chỉ nằm phẳng khi hồ sơ ghi đất trống / thửa dư / bị làm mờ (DIM). KHÔNG đoán đất trống từ constructionArea = 0.
 * - Có số tầng khảo sát ⇒ số tầng × 3,3 m. Có hồ sơ nhưng thiếu số tầng ⇒ 3,2 m. Chưa có hồ sơ ⇒ 3,2 m (GHOST).
 */
export function resolveParcel3DShape(
  parcel: ParcelCodeSource,
  info: Parcel3DInfo | null,
  opts: { dimmed: boolean }
): Parcel3DShape {
  const dimmed = opts.dimmed;
  let kind: Parcel3DKind;
  let heightM: number;
  let floors: number | null = null;

  if (info?.isVacantLand || isResidualParcel(parcel)) {
    kind = 'FLAT_VACANT';
    heightM = 0;
  } else if (!info || !info.hasReport) {
    kind = 'UNASSESSED';
    heightM = SYMBOLIC_HEIGHT_M;
  } else {
    floors = validFloors(info.aboveFloors);
    if (floors !== null) {
      kind = 'FLOORS';
      heightM = Math.round(floors * FLOOR_HEIGHT_M * 10) / 10;
    } else {
      kind = 'SYMBOLIC';
      heightM = SYMBOLIC_HEIGHT_M;
    }
  }

  if (dimmed) heightM = 0;
  const tier: Parcel3DTier = heightM === 0 ? 'FLAT' : kind === 'UNASSESSED' ? 'GHOST' : 'SOLID';
  return { heightM, kind, dimmed, tier, floors };
}

/** Dòng mô tả chiều cao cho tooltip; luôn ghi rõ là minh hoạ, không phải số đo. */
export function describeParcel3DHeight(shape: Pick<Parcel3DShape, 'kind' | 'floors'>): string {
  switch (shape.kind) {
    case 'FLOORS': {
      const floors = shape.floors ?? 0;
      return `${floors} tầng · ~${(floors * FLOOR_HEIGHT_M).toFixed(1)} m (minh hoạ)`;
    }
    case 'SYMBOLIC':
      return 'Chưa rõ số tầng · khối tượng trưng';
    case 'UNASSESSED':
      return 'Chưa có số liệu · khối tượng trưng';
    case 'FLAT_VACANT':
      return 'Đất trống / thửa dư · nằm phẳng';
  }
}

// ---------- Màu ----------

const HEX_RE = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i;

/** Làm sáng màu hex về phía trắng (amount 0–1). Chuỗi không phải hex ⇒ trả nguyên. */
export function lightenHex(hex: string, amount: number): string {
  if (!HEX_RE.test(hex)) return hex;
  let h = hex.slice(1);
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  const to = (i: number): string => {
    const v = parseInt(h.slice(i, i + 2), 16);
    const out = Math.round(v + (255 - v) * amount);
    return out.toString(16).padStart(2, '0');
  };
  return `#${to(0)}${to(2)}${to(4)}`;
}

/** Màu trạng thái tác nghiệp (WORKFLOW), khớp ParcelsLayer.workflowPathOptions. */
export function workflowFillHex(
  parcel: Pick<GisParcel, 'buildingType'>,
  status: string,
  statusHex: string
): string {
  const isCondo = parcel.buildingType === 'CONDOMINIUM';
  if (!isCondo) return statusHex;
  return status === 'NOT_SURVEYED' ? '#8b5cf6' : '#7c3aed';
}

export interface Parcel3DBuildContext {
  resolveInfo?: (parcel: GisParcel) => Parcel3DInfo | null;
  /** Có binding ⇒ màu theo layout chuyên đề; null ⇒ màu trạng thái tác nghiệp (do getWorkflowHex cấp). */
  thematic: Pick<ThematicMapBinding, 'resolveStyle'> | null;
  /** Trả màu WORKFLOW cho 1 thửa (tách ra để file này không phụ thuộc localStorage / sweepMapHelpers). */
  getWorkflowHex: (parcel: GisParcel) => string;
  filterMatch: ThematicFilterMatch | null;
}

export function resolveParcel3DFillHex(parcel: GisParcel, ctx: Pick<Parcel3DBuildContext, 'thematic' | 'getWorkflowHex'>): string {
  return ctx.thematic ? ctx.thematic.resolveStyle(parcel).fillHex : ctx.getWorkflowHex(parcel);
}

export function buildParcelsFeatureCollection(parcels: readonly GisParcel[], ctx: Parcel3DBuildContext): ParcelFeatureCollection {
  const features: GeoFeature<GeoPolygon, ParcelFeatureProps>[] = [];
  for (const parcel of parcels) {
    const ring = toLngLatRing(parcel.coordinates);
    if (ring.length === 0) continue;
    const dimmed = ctx.filterMatch !== null && ctx.filterMatch.mode === 'DIM' && !ctx.filterMatch.matchedIds.has(parcel.id);
    const shape = resolveParcel3DShape(parcel, ctx.resolveInfo ? ctx.resolveInfo(parcel) : null, { dimmed });
    // Chưa có hồ sơ: luôn xám trung tính ở layout chuyên đề; WORKFLOW giữ màu trạng thái (làm dở / vắng mặt...)
    const fillHex = shape.kind === 'UNASSESSED' && ctx.thematic ? UNASSESSED_3D_HEX : resolveParcel3DFillHex(parcel, ctx);
    features.push({
      type: 'Feature',
      geometry: { type: 'Polygon', coordinates: [ring] },
      properties: {
        parcelId: parcel.id,
        code: parcel.officialCadastralCode || parcel.projectParcelCode || parcel.id,
        heightM: shape.heightM,
        kind: shape.kind,
        tier: shape.tier,
        fillHex,
        hoverHex: lightenHex(fillHex, 0.18),
        flatOpacity: shape.dimmed ? DIMMED_FLAT_OPACITY : VACANT_FLAT_OPACITY,
        floors: shape.floors ?? -1,
      },
    });
  }
  return { type: 'FeatureCollection', features };
}

// ---------- Cô lập Zone ----------

export interface ZoneIsolation {
  zoneGround: GeoFeature<GeoPolygon, Record<string, never>>;
  /** Polygon toàn cầu khoét lỗ theo ranh Zone, che mọi thứ ngoài Zone. */
  outsideMask: GeoFeature<GeoPolygon, Record<string, never>>;
  maxBounds: [[number, number], [number, number]];
  /** bbox của Zone ∪ các thửa (chưa đệm). */
  bbox: Bbox;
  center: LngLat;
  /** true ⇒ không có polygon Zone hợp lệ, đã dùng hình chữ nhật bao các thửa. */
  usedFallbackRing: boolean;
}

const WORLD_RING: LngLat[] = [
  [-180, -85],
  [180, -85],
  [180, 85],
  [-180, 85],
  [-180, -85],
];

function bboxRing(b: Bbox): LngLat[] {
  return [
    [b.minLng, b.minLat],
    [b.maxLng, b.minLat],
    [b.maxLng, b.maxLat],
    [b.minLng, b.maxLat],
    [b.minLng, b.minLat],
  ];
}

/**
 * @param zonePolygon ranh Zone dạng [lat, lng] (METRO_22_ZONES[i].polygon) hoặc null
 * @returns null khi không có bất kỳ toạ độ hợp lệ nào (Zone trống) — caller giữ 2D.
 */
export function buildZoneIsolation(
  zonePolygon: ReadonlyArray<readonly number[]> | null | undefined,
  parcels: readonly GisParcel[]
): ZoneIsolation | null {
  const zoneRing = toLngLatRing(zonePolygon);
  let parcelsBbox: Bbox | null = null;
  for (const p of parcels) parcelsBbox = unionBbox(parcelsBbox, bboxOfPoints(toLngLatRing(p.coordinates)));
  const zoneBbox = zoneRing.length > 0 ? bboxOfPoints(zoneRing) : null;
  const bbox = unionBbox(zoneBbox, parcelsBbox);
  if (!bbox) return null;

  const usedFallbackRing = zoneRing.length === 0;
  const ground = usedFallbackRing ? bboxRing(parcelsBbox ?? bbox) : zoneRing;
  const padded = expandBbox(bbox, ZONE_BOUNDS_PAD_DEG);
  return {
    zoneGround: { type: 'Feature', geometry: { type: 'Polygon', coordinates: [ground] }, properties: {} },
    outsideMask: { type: 'Feature', geometry: { type: 'Polygon', coordinates: [WORLD_RING, ground] }, properties: {} },
    maxBounds: [
      [padded.minLng, padded.minLat],
      [padded.maxLng, padded.maxLat],
    ],
    bbox,
    center: [(bbox.minLng + bbox.maxLng) / 2, (bbox.minLat + bbox.maxLat) / 2],
    usedFallbackRing,
  };
}

// ---------- Hạ tầng Metro trong Zone ----------

export interface MetroSources {
  corridors: ReadonlyArray<{ name: string; coords: ReadonlyArray<readonly number[]> }>;
  stations: ReadonlyArray<{ code: string; name: string; coords: ReadonlyArray<readonly number[]> }>;
  tbm: ReadonlyArray<{ rawName: string; coords: ReadonlyArray<readonly number[]> }>;
  centerline: ReadonlyArray<readonly number[]>;
}

export type MetroFeatureProps = {
  kind: 'STATION' | 'TBM' | 'CORRIDOR' | 'CENTERLINE';
  name: string;
};

export interface MetroFeatures {
  polygons: GeoFeatureCollection<GeoPolygon, MetroFeatureProps>;
  lines: GeoFeatureCollection<GeoLineString, MetroFeatureProps>;
}

/** Lấy các đối tượng Metro có bbox giao với vùng Zone (đã đệm). Toạ độ nguồn là [lat, lng]. */
export function buildMetroFeatures(zoneBbox: Bbox, src: MetroSources): MetroFeatures {
  const area = expandBbox(zoneBbox, ZONE_BOUNDS_PAD_DEG);
  const polygons: GeoFeature<GeoPolygon, MetroFeatureProps>[] = [];
  const lines: GeoFeature<GeoLineString, MetroFeatureProps>[] = [];

  const addPolygon = (kind: MetroFeatureProps['kind'], name: string, coords: ReadonlyArray<readonly number[]>): void => {
    const ring = toLngLatRing(coords);
    if (ring.length === 0) return;
    const b = bboxOfPoints(ring);
    if (!b || !bboxIntersects(b, area)) return;
    polygons.push({ type: 'Feature', geometry: { type: 'Polygon', coordinates: [ring] }, properties: { kind, name } });
  };
  const addLine = (kind: MetroFeatureProps['kind'], name: string, coords: ReadonlyArray<readonly number[]>): void => {
    const pts: LngLat[] = [];
    for (const c of coords) {
      const lat = Number(c?.[0]);
      const lng = Number(c?.[1]);
      if (Number.isFinite(lat) && Number.isFinite(lng)) pts.push([lng, lat]);
    }
    if (pts.length < 2) return;
    const b = bboxOfPoints(pts);
    if (!b || !bboxIntersects(b, area)) return;
    lines.push({ type: 'Feature', geometry: { type: 'LineString', coordinates: pts }, properties: { kind, name } });
  };

  for (const s of src.stations) addPolygon('STATION', s.name || s.code, s.coords);
  for (const t of src.tbm) addPolygon('TBM', t.rawName, t.coords);
  for (const c of src.corridors) addLine('CORRIDOR', c.name, c.coords);
  addLine('CENTERLINE', 'Tim tuyến Metro 2', src.centerline);

  return {
    polygons: { type: 'FeatureCollection', features: polygons },
    lines: { type: 'FeatureCollection', features: lines },
  };
}
