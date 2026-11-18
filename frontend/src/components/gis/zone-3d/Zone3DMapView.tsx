import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Map as MapLibreMap, NavigationControl, setWorkerUrl } from 'maplibre-gl';
// maplibre-gl 6 tìm worker theo đường dẫn tương đối với file chunk (không còn tồn tại sau khi Vite gói) ⇒ phải chỉ rõ.
// `?worker&url` để Vite gói worker cùng các phụ thuộc (maplibre-gl-shared.mjs) thành 1 file riêng.
import maplibreWorkerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url';
import type { GeoJSONSource, MapMouseEvent } from 'maplibre-gl';
import type { ExpressionSpecification, LayerSpecification, StyleSpecification } from '@maplibre/maplibre-gl-style-spec';
import 'maplibre-gl/dist/maplibre-gl.css';
import type { GisParcel, Parcel3DInfo, ThematicFilterMatch, ThematicMapBinding } from '../shared/types';
import { BASE_TILE_SOURCES } from '../shared/baseTileSources';
import {
  METRO_CORRIDOR_BOUNDARIES,
  METRO_LINE2_CENTERLINE,
  METRO_STATION_POLYGONS,
  METRO_TBM_POLYGONS,
} from '../../../features/survey-phase1/constants/metroGisConstants';
import { getEffectiveParcelStatus, getStatusBadge, getStatusColor } from '../sweep-map/utils/sweepMapHelpers';
import { getErrorMessage } from '../../../utils/errorUtils';
import {
  buildMetroFeatures,
  buildParcelsFeatureCollection,
  buildZoneIsolation,
  describeParcel3DHeight,
  workflowFillHex,
} from './zone3dGeoJson';
import type { MetroSources, Parcel3DKind } from './zone3dGeoJson';
import { Zone3DCameraControls } from './Zone3DCameraControls';
import type { Zone3DBaseMode } from './Zone3DCameraControls';

export interface Zone3DMapViewProps {
  /** Thửa cần vẽ (đã lọc ISOLATE / trạng thái ở bản đồ 2D). */
  parcels: GisParcel[];
  /** Toàn bộ thửa của Zone, chỉ dùng để tính ranh và khung camera (không đổi khi lọc). */
  zoneParcels: GisParcel[];
  /** Ranh Zone dạng [lat, lng]; thiếu ⇒ dùng hình chữ nhật bao các thửa. */
  zonePolygon?: [number, number][] | null;
  thematic: ThematicMapBinding | null;
  filterMatch: ThematicFilterMatch | null;
  resolveParcel3DInfo?: (parcel: GisParcel) => Parcel3DInfo | null;
  activeParcelId: string | null;
  /** Click khối nhà: caller gọi setActiveParcel + onSelectParcel. */
  onPickParcel: (parcel: GisParcel) => void;
  /** Toạ độ [lat, lng] cần bay tới (tìm kiếm / chọn từ danh sách). */
  targetFlyCoords: [number, number] | null;
  /** WebGL không khởi tạo được hoặc mất context ⇒ caller quay về 2D. */
  onFatalError: (err: unknown) => void;
}

// ---------- Hằng số bản đồ ----------

setWorkerUrl(maplibreWorkerUrl);

const PARCELS_SRC = 'parcels-3d';
const GROUND_SRC = 'zone-ground';
const MASK_SRC = 'zone-mask';
const METRO_POLY_SRC = 'metro-polys';
const METRO_LINE_SRC = 'metro-lines';
const RASTER_SRC = 'base-raster';

const L_BACKGROUND = 'background';
const L_RASTER = 'base-raster';
const L_GROUND = 'zone-ground-fill';
const L_MASK = 'zone-outside-mask';
const L_BOUNDARY = 'zone-boundary-line';
const L_FLAT = 'parcels-flat-fill';
const L_FLAT_LINE = 'parcels-flat-line';
const L_SOLID = 'parcels-3d-solid';
const L_GHOST = 'parcels-3d-ghost';
const L_SELECTED = 'parcel-selected-outline';
const PICK_LAYERS = [L_SOLID, L_GHOST, L_FLAT];

const DEFAULT_CENTER: [number, number] = [106.69925, 10.771096];
const DEFAULT_PITCH = 48;
const DEFAULT_BEARING = -25;
const SELECTED_HEX = '#0284c7';

const METRO_STATION_HEX = '#7c3aed';
const METRO_TBM_HEX = '#0ea5e9';
const METRO_CORRIDOR_HEX = '#2563eb';
const METRO_CENTERLINE_HEX = '#dc2626';

const EMPTY_FC: GeoJSON.FeatureCollection = { type: 'FeatureCollection', features: [] };

const COLOR_EXPR: ExpressionSpecification = [
  'case',
  ['boolean', ['feature-state', 'selected'], false],
  SELECTED_HEX,
  ['boolean', ['feature-state', 'hovered'], false],
  ['get', 'hoverHex'],
  ['get', 'fillHex'],
];

const heightExpr = (scale: number): ExpressionSpecification => ['*', ['get', 'heightM'], scale];

// ---------- Theme token → màu MapLibre ----------

interface MapTheme {
  background: string;
  ground: string;
  border: string;
}

/** Token dạng "r g b" (themeTokens.js) → rgb(r, g, b) cho MapLibre. */
function cssRgb(varName: string, fallback: string): string {
  const raw = getComputedStyle(document.documentElement).getPropertyValue(varName).trim();
  const parts = raw.split(/\s+/).map(Number);
  if (parts.length === 3 && parts.every((n) => Number.isFinite(n))) return `rgb(${parts[0]}, ${parts[1]}, ${parts[2]})`;
  return fallback;
}

function readMapTheme(): MapTheme {
  return {
    background: cssRgb('--bg-slate-100', 'rgb(241, 245, 249)'),
    ground: cssRgb('--bg-slate-50', 'rgb(248, 250, 252)'),
    border: cssRgb('--border-slate-400', 'rgb(148, 163, 184)'),
  };
}

// ---------- Kiểu & guard ----------

const isGeoJsonSource = (s: unknown): s is GeoJSONSource =>
  typeof s === 'object' && s !== null && 'setData' in s && typeof (s as { setData: unknown }).setData === 'function';

const KINDS: readonly Parcel3DKind[] = ['FLOORS', 'SYMBOLIC', 'UNASSESSED', 'FLAT_VACANT'];
const isKind = (v: unknown): v is Parcel3DKind => typeof v === 'string' && (KINDS as readonly string[]).includes(v);

function setSourceData(map: MapLibreMap, id: string, data: GeoJSON.GeoJSON): void {
  const src = map.getSource(id);
  if (isGeoJsonSource(src)) src.setData(data);
}

const METRO_SOURCES: MetroSources = {
  corridors: METRO_CORRIDOR_BOUNDARIES,
  stations: METRO_STATION_POLYGONS,
  tbm: METRO_TBM_POLYGONS,
  centerline: METRO_LINE2_CENTERLINE,
};

function buildLayers(scale: number, theme: MapTheme): LayerSpecification[] {
  return [
    {
      id: L_GROUND,
      type: 'fill',
      source: GROUND_SRC,
      paint: { 'fill-color': theme.ground, 'fill-opacity': 1 },
    },
    {
      id: 'metro-tbm-fill',
      type: 'fill',
      source: METRO_POLY_SRC,
      filter: ['==', ['get', 'kind'], 'TBM'],
      paint: { 'fill-color': METRO_TBM_HEX, 'fill-opacity': 0.22 },
    },
    {
      id: 'metro-station-fill',
      type: 'fill',
      source: METRO_POLY_SRC,
      filter: ['==', ['get', 'kind'], 'STATION'],
      paint: { 'fill-color': METRO_STATION_HEX, 'fill-opacity': 0.3 },
    },
    {
      id: 'metro-poly-line',
      type: 'line',
      source: METRO_POLY_SRC,
      paint: { 'line-color': METRO_STATION_HEX, 'line-width': 1, 'line-opacity': 0.7 },
    },
    {
      id: 'metro-corridor-line',
      type: 'line',
      source: METRO_LINE_SRC,
      filter: ['==', ['get', 'kind'], 'CORRIDOR'],
      paint: { 'line-color': METRO_CORRIDOR_HEX, 'line-width': 1.5, 'line-dasharray': [3, 2] },
    },
    {
      id: 'metro-centerline-line',
      type: 'line',
      source: METRO_LINE_SRC,
      filter: ['==', ['get', 'kind'], 'CENTERLINE'],
      paint: { 'line-color': METRO_CENTERLINE_HEX, 'line-width': 2.5 },
    },
    {
      id: L_MASK,
      type: 'fill',
      source: MASK_SRC,
      paint: { 'fill-color': theme.background, 'fill-opacity': 1 },
    },
    {
      id: L_BOUNDARY,
      type: 'line',
      source: GROUND_SRC,
      paint: { 'line-color': theme.border, 'line-width': 1.5 },
    },
    {
      id: L_FLAT,
      type: 'fill',
      source: PARCELS_SRC,
      filter: ['==', ['get', 'tier'], 'FLAT'],
      paint: { 'fill-color': COLOR_EXPR, 'fill-opacity': ['get', 'flatOpacity'] },
    },
    {
      id: L_FLAT_LINE,
      type: 'line',
      source: PARCELS_SRC,
      filter: ['==', ['get', 'tier'], 'FLAT'],
      paint: { 'line-color': theme.border, 'line-width': 0.8, 'line-opacity': 0.8 },
    },
    {
      id: L_GHOST,
      type: 'fill-extrusion',
      source: PARCELS_SRC,
      filter: ['==', ['get', 'tier'], 'GHOST'],
      paint: {
        'fill-extrusion-color': COLOR_EXPR,
        'fill-extrusion-height': heightExpr(scale),
        'fill-extrusion-base': 0,
        'fill-extrusion-opacity': 0.55,
      },
    },
    {
      id: L_SOLID,
      type: 'fill-extrusion',
      source: PARCELS_SRC,
      filter: ['==', ['get', 'tier'], 'SOLID'],
      paint: {
        'fill-extrusion-color': COLOR_EXPR,
        'fill-extrusion-height': heightExpr(scale),
        'fill-extrusion-base': 0,
        'fill-extrusion-opacity': 0.9,
      },
    },
    {
      id: L_SELECTED,
      type: 'line',
      source: PARCELS_SRC,
      filter: ['==', ['get', 'parcelId'], ''],
      paint: { 'line-color': SELECTED_HEX, 'line-width': 3 },
    },
  ];
}

interface HoverInfo {
  parcelId: string;
  kind: Parcel3DKind;
  floors: number | null;
}

const Zone3DMapView: React.FC<Zone3DMapViewProps> = ({
  parcels,
  zoneParcels,
  zonePolygon,
  thematic,
  filterMatch,
  resolveParcel3DInfo,
  activeParcelId,
  onPickParcel,
  targetFlyCoords,
  onFatalError,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const hoveredIdRef = useRef<string | null>(null);
  const selectedIdRef = useRef<string | null>(null);
  const fitSigRef = useRef<string | null>(null);
  const initialFlyRef = useRef<[number, number] | null>(targetFlyCoords);

  const [ready, setReady] = useState(false);
  const [pitchDeg, setPitchDeg] = useState(DEFAULT_PITCH);
  const [baseMode, setBaseMode] = useState<Zone3DBaseMode>('maquette');
  const [scale, setScale] = useState(1);
  const [hover, setHover] = useState<HoverInfo | null>(null);

  // Giá trị mới nhất cho handler đăng ký 1 lần lúc khởi tạo map
  const latest = useRef({ onPickParcel, onFatalError, scale, parcelById: new Map<string, GisParcel>() });
  latest.current.onPickParcel = onPickParcel;
  latest.current.onFatalError = onFatalError;
  latest.current.scale = scale;

  const parcelById = useMemo(() => new Map(parcels.map((p) => [p.id, p])), [parcels]);
  latest.current.parcelById = parcelById;

  const isolation = useMemo(() => buildZoneIsolation(zonePolygon, zoneParcels), [zonePolygon, zoneParcels]);
  const isolationRef = useRef(isolation);
  isolationRef.current = isolation;

  const metro = useMemo(() => (isolation ? buildMetroFeatures(isolation.bbox, METRO_SOURCES) : null), [isolation]);

  const parcelsFc = useMemo(
    () =>
      buildParcelsFeatureCollection(parcels, {
        resolveInfo: resolveParcel3DInfo,
        thematic,
        getWorkflowHex: (p) => {
          const status = getEffectiveParcelStatus(p) ?? 'NOT_SURVEYED';
          return workflowFillHex(p, status, getStatusColor(status));
        },
        filterMatch,
      }),
    [parcels, resolveParcel3DInfo, thematic, filterMatch]
  );

  // ---------- Khởi tạo / huỷ map (1 lần) ----------
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return undefined;

    let map: MapLibreMap;
    const theme = readMapTheme();
    const style: StyleSpecification = {
      version: 8,
      sources: {},
      layers: [{ id: L_BACKGROUND, type: 'background', paint: { 'background-color': theme.background } }],
    };
    try {
      const iso = isolationRef.current;
      map = new MapLibreMap({
        container: el,
        style,
        center: iso ? iso.center : DEFAULT_CENTER,
        zoom: 16,
        pitch: DEFAULT_PITCH,
        bearing: DEFAULT_BEARING,
        maxPitch: 75,
        minZoom: 12,
        maxZoom: 21,
        attributionControl: { compact: true },
        canvasContextAttributes: { antialias: true },
      });
    } catch (err) {
      console.error('[Zone3D:init] Không khởi tạo được WebGL', err);
      latest.current.onFatalError(err);
      return undefined;
    }
    mapRef.current = map;
    // Tránh render thừa 3x–4x điểm ảnh trên màn Retina / 4K
    map.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    map.addControl(new NavigationControl({ showCompass: false }), 'bottom-right');

    const canvas = map.getCanvas();
    const handleContextLost = (ev: Event): void => {
      ev.preventDefault();
      console.error('[Zone3D:webgl] Mất WebGL context, quay về bản đồ 2D');
      latest.current.onFatalError(new Error('WEBGL_CONTEXT_LOST'));
    };
    canvas.addEventListener('webglcontextlost', handleContextLost);

    map.on('error', (e) => {
      const sourceId = (e as { sourceId?: string }).sourceId;
      // Lỗi tile nền (mạng / 404 ngoài vùng phủ) không chặn bản đồ 3D
      if (sourceId === RASTER_SRC) console.warn('[Zone3D:tiles] Không tải được tile nền', getErrorMessage(e.error));
      else console.error('[Zone3D:map] Lỗi MapLibre', e.error);
    });

    map.on('load', () => {
      try {
        map.addSource(GROUND_SRC, { type: 'geojson', data: EMPTY_FC });
        map.addSource(MASK_SRC, { type: 'geojson', data: EMPTY_FC });
        map.addSource(METRO_POLY_SRC, { type: 'geojson', data: EMPTY_FC });
        map.addSource(METRO_LINE_SRC, { type: 'geojson', data: EMPTY_FC });
        map.addSource(PARCELS_SRC, { type: 'geojson', data: EMPTY_FC, promoteId: 'parcelId' });
        for (const layer of buildLayers(latest.current.scale, readMapTheme())) map.addLayer(layer);
        setReady(true);
      } catch (err) {
        console.error('[Zone3D:init] Không dựng được layer 3D', err);
        latest.current.onFatalError(err);
      }
    });

    map.on('pitchend', () => setPitchDeg(Math.round(map.getPitch())));

    // --- Hover (throttle bằng rAF, chỉ cập nhật state khi parcelId đổi) ---
    let raf = 0;
    let lastPoint: MapMouseEvent['point'] | null = null;
    const clearHover = (): void => {
      if (hoveredIdRef.current) {
        map.setFeatureState({ source: PARCELS_SRC, id: hoveredIdRef.current }, { hovered: false });
        hoveredIdRef.current = null;
      }
      canvas.style.cursor = '';
      setHover(null);
    };
    const runHover = (): void => {
      raf = 0;
      if (!lastPoint) return;
      const feature = map.queryRenderedFeatures(lastPoint, { layers: PICK_LAYERS })[0];
      const tip = tooltipRef.current;
      if (tip) tip.style.transform = `translate(${lastPoint.x + 14}px, ${lastPoint.y + 14}px)`;
      const id = feature ? String(feature.properties.parcelId) : null;
      if (id === hoveredIdRef.current) return;
      if (hoveredIdRef.current) map.setFeatureState({ source: PARCELS_SRC, id: hoveredIdRef.current }, { hovered: false });
      hoveredIdRef.current = id;
      if (!feature || !id) {
        canvas.style.cursor = '';
        setHover(null);
        return;
      }
      map.setFeatureState({ source: PARCELS_SRC, id }, { hovered: true });
      canvas.style.cursor = 'pointer';
      const kind: unknown = feature.properties.kind;
      const floors = Number(feature.properties.floors);
      setHover({ parcelId: id, kind: isKind(kind) ? kind : 'UNASSESSED', floors: Number.isFinite(floors) && floors > 0 ? floors : null });
    };
    map.on('mousemove', (e) => {
      lastPoint = e.point;
      if (!raf) raf = requestAnimationFrame(runHover);
    });
    canvas.addEventListener('mouseleave', clearHover);

    map.on('click', (e) => {
      const feature = map.queryRenderedFeatures(e.point, { layers: PICK_LAYERS })[0];
      if (!feature) return;
      const parcel = latest.current.parcelById.get(String(feature.properties.parcelId));
      if (parcel) latest.current.onPickParcel(parcel);
    });

    return () => {
      if (raf) cancelAnimationFrame(raf);
      canvas.removeEventListener('webglcontextlost', handleContextLost);
      canvas.removeEventListener('mouseleave', clearHover);
      hoveredIdRef.current = null;
      selectedIdRef.current = null;
      fitSigRef.current = null;
      mapRef.current = null;
      setReady(false);
      // Giải phóng WebGL context (tránh "Too many active WebGL contexts" khi bật/tắt 3D nhiều lần)
      map.remove();
    };
  }, []);

  // ---------- Dữ liệu tĩnh theo Zone: nền, mask, Metro, khung camera ----------
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready || !isolation) return;
    if (isolation.usedFallbackRing) {
      console.warn('[Zone3D:zone] Thiếu ranh Zone, dùng hình chữ nhật bao các thửa');
    }
    setSourceData(map, GROUND_SRC, isolation.zoneGround);
    setSourceData(map, MASK_SRC, isolation.outsideMask);
    if (metro) {
      setSourceData(map, METRO_POLY_SRC, metro.polygons);
      setSourceData(map, METRO_LINE_SRC, metro.lines);
    }
    map.setMaxBounds(isolation.maxBounds);
    const { minLng, minLat, maxLng, maxLat } = isolation.bbox;
    const sig = [minLng, minLat, maxLng, maxLat].map((n) => n.toFixed(5)).join(',');
    if (fitSigRef.current !== sig) {
      fitSigRef.current = sig;
      map.fitBounds(
        [
          [minLng, minLat],
          [maxLng, maxLat],
        ],
        { padding: 40, pitch: DEFAULT_PITCH, bearing: DEFAULT_BEARING, duration: 0, maxZoom: 19 }
      );
    }
  }, [ready, isolation, metro]);

  // ---------- Dữ liệu thửa: chỉ đẩy lên GPU khi danh sách / màu / bộ lọc đổi ----------
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    setSourceData(map, PARCELS_SRC, parcelsFc);
  }, [ready, parcelsFc]);

  // ---------- Thửa đang chọn ----------
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    if (selectedIdRef.current) map.setFeatureState({ source: PARCELS_SRC, id: selectedIdRef.current }, { selected: false });
    if (activeParcelId) map.setFeatureState({ source: PARCELS_SRC, id: activeParcelId }, { selected: true });
    selectedIdRef.current = activeParcelId;
    map.setFilter(L_SELECTED, ['==', ['get', 'parcelId'], activeParcelId ?? '']);
  }, [ready, activeParcelId, parcelsFc]);

  // ---------- Tỉ lệ chiều cao: chỉ đổi paint trên GPU ----------
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    map.setPaintProperty(L_SOLID, 'fill-extrusion-height', heightExpr(scale));
    map.setPaintProperty(L_GHOST, 'fill-extrusion-height', heightExpr(scale));
  }, [ready, scale]);

  // ---------- Nền raster (chỉ tải tile khi người dùng chủ động chọn) ----------
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;
    if (map.getLayer(L_RASTER)) map.removeLayer(L_RASTER);
    if (map.getSource(RASTER_SRC)) map.removeSource(RASTER_SRC);
    if (baseMode === 'maquette') {
      map.setLayoutProperty(L_GROUND, 'visibility', 'visible');
      return;
    }
    const def = BASE_TILE_SOURCES[baseMode === 'satellite' ? 'satellite' : 'standard'];
    try {
      map.addSource(RASTER_SRC, {
        type: 'raster',
        tiles: def.urlGl,
        tileSize: 256,
        maxzoom: def.maxNativeZoom,
        attribution: def.attribution,
      });
      map.addLayer({ id: L_RASTER, type: 'raster', source: RASTER_SRC }, L_GROUND);
      // Mặt đất sa bàn che mất tile ⇒ ẩn khi có nền thật
      map.setLayoutProperty(L_GROUND, 'visibility', 'none');
    } catch (err) {
      console.error('[Zone3D:base] Không bật được nền bản đồ', err);
      setBaseMode('maquette');
    }
  }, [ready, baseMode]);

  // ---------- Dark mode: đổi màu theo token khi class `dark` của <html> đổi ----------
  useEffect(() => {
    if (!ready) return undefined;
    const apply = (): void => {
      const map = mapRef.current;
      if (!map) return;
      const t = readMapTheme();
      map.setPaintProperty(L_BACKGROUND, 'background-color', t.background);
      map.setPaintProperty(L_MASK, 'fill-color', t.background);
      map.setPaintProperty(L_GROUND, 'fill-color', t.ground);
      map.setPaintProperty(L_BOUNDARY, 'line-color', t.border);
      map.setPaintProperty(L_FLAT_LINE, 'line-color', t.border);
    };
    const observer = new MutationObserver(apply);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] });
    return () => observer.disconnect();
  }, [ready]);

  // ---------- Bay tới thửa (tìm kiếm / chọn từ danh sách) ----------
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready || !targetFlyCoords) return;
    // Giá trị còn sót từ lúc ở 2D: không bay, để giữ khung cả Zone
    if (targetFlyCoords === initialFlyRef.current) return;
    map.flyTo({ center: [targetFlyCoords[1], targetFlyCoords[0]], zoom: Math.max(map.getZoom(), 18), duration: 800 });
  }, [ready, targetFlyCoords]);

  // ---------- Điều khiển góc nhìn ----------
  const handlePitch = useCallback((deg: number) => {
    mapRef.current?.easeTo({ pitch: deg, duration: 400 });
  }, []);
  const handleRotate = useCallback((delta: number) => {
    const map = mapRef.current;
    if (map) map.easeTo({ bearing: map.getBearing() + delta, duration: 400 });
  }, []);
  const handleResetNorth = useCallback(() => {
    mapRef.current?.easeTo({ bearing: 0, duration: 400 });
  }, []);

  const hoverParcel = hover ? parcelById.get(hover.parcelId) : undefined;
  const hoverStatus = hoverParcel ? getEffectiveParcelStatus(hoverParcel) ?? 'NOT_SURVEYED' : null;
  const hoverLines: string[] = hover && hoverParcel
    ? [
        ...(thematic ? thematic.tooltipLines(hoverParcel) : [hoverParcel.officialCadastralCode || hoverParcel.projectParcelCode || hoverParcel.id]),
        describeParcel3DHeight({ kind: hover.kind, floors: hover.floors }),
      ]
    : [];

  return (
    <div className="absolute inset-0 z-[900]">
      <div ref={containerRef} className="h-full w-full" />

      {/* Tooltip rê chuột: vị trí cập nhật trực tiếp bằng ref, nội dung theo state */}
      <div
        ref={tooltipRef}
        className="pointer-events-none absolute left-0 top-0 z-[960] max-w-[260px] rounded-lg border border-slate-700 bg-slate-900/95 px-2.5 py-1.5 text-[11px] leading-snug text-slate-100 shadow-lg"
        style={{ display: hoverLines.length > 0 ? 'block' : 'none' }}
      >
        {hoverLines.map((line, i) => (
          <div key={`${i}-${line}`} className={i === 0 ? 'font-mono font-bold text-teal-300' : ''}>
            {line}
          </div>
        ))}
        {/* WORKFLOW: thêm trạng thái hồ sơ như bản đồ 2D */}
        {/* Không truyền parcel cho NOT_SURVEYED: nhánh đó đoán "Đất dôi dư" từ constructionArea = 0, trái với khối 3D */}
        {!thematic && hoverStatus && (
          <div className="mt-1">{getStatusBadge(hoverStatus, hoverStatus === 'NOT_SURVEYED' ? undefined : hoverParcel)}</div>
        )}
      </div>

      <Zone3DCameraControls
        pitchDeg={pitchDeg}
        onPitch={handlePitch}
        onRotate={handleRotate}
        onResetNorth={handleResetNorth}
        baseMode={baseMode}
        onBaseMode={setBaseMode}
        scale={scale}
        onScale={setScale}
      />

      <div className="pointer-events-none absolute bottom-8 left-2 z-[950] max-w-[260px] rounded-md border border-slate-200 bg-white/90 px-2 py-1 text-[10px] leading-tight text-slate-600 backdrop-blur-md">
        Chiều cao chỉ mang tính minh hoạ (số tầng × 3,3 m). Thửa chưa có hồ sơ hiện khối xám thấp. Thửa ẩn, GPS và điểm chụp
        lại chỉ có ở bản đồ 2D.
      </div>
    </div>
  );
};

export default Zone3DMapView;
