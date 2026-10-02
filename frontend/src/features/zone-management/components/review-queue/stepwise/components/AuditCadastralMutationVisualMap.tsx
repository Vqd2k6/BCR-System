import React, { useState, useMemo, useEffect } from 'react';
import { MapContainer, TileLayer, Polygon, Polyline, Tooltip, ZoomControl, useMap } from 'react-leaflet';
import L from 'leaflet';
import {
  Layers,
  MapPin,
  CheckCircle2,
  Split,
  Merge,
  ExternalLink,
  ShieldCheck,
  Building,
} from 'lucide-react';
import { interpolatePoint, computePolygonAreaM2 } from '../../../../../../components/gis/shared/geoMath';

interface Props {
  parcelCoordinates?: [number, number][];
  projectParcelCode?: string;
  mutationType?: 'MATCH' | 'SPLIT' | 'MERGE' | 'ORIGINAL' | string;
  mutationDetails?: any;
  landAreaM2?: number | string;
  frontageWidth?: number | string;
  lotDepth?: number | string;
  gpsLocation?: {
    lat: number;
    lng: number;
    accuracy?: number;
  };
  onOpenEditorModal?: () => void;
}

/**
 * Controller tự động căn chỉnh khung nhìn bản đồ fit toàn bộ polygon
 */
const MapAutoBounds: React.FC<{
  points: [number, number][];
}> = ({ points }) => {
  const map = useMap();
  useEffect(() => {
    if (points && points.length >= 2) {
      const bounds = L.latLngBounds(points);
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 20 });
    }
    const timer = setTimeout(() => map.invalidateSize(), 250);
    return () => clearTimeout(timer);
  }, [points, map]);

  return null;
};

export const AuditCadastralMutationVisualMap: React.FC<Props> = ({
  parcelCoordinates,
  projectParcelCode = '---',
  mutationType = 'MATCH',
  mutationDetails = {},
  landAreaM2,
  frontageWidth,
  lotDepth,
  gpsLocation,
  onOpenEditorModal,
}) => {
  const [tileMode, setTileMode] = useState<'satellite' | 'street'>('satellite');

  // Chuẩn hóa tọa độ đa giác thửa đất gốc
  const basePolygon = useMemo<[number, number][]>(() => {
    if (Array.isArray(parcelCoordinates) && parcelCoordinates.length >= 3) {
      return parcelCoordinates;
    }
    // Fallback đa giác hình chữ nhật quanh tọa độ GPS nếu DB chưa có polygon
    const lat = gpsLocation?.lat && !isNaN(gpsLocation.lat) ? Number(gpsLocation.lat) : 10.79241;
    const lng = gpsLocation?.lng && !isNaN(gpsLocation.lng) ? Number(gpsLocation.lng) : 106.71152;
    const dLat = 0.00008; // ~9m
    const dLng = 0.00010; // ~11m
    return [
      [lat - dLat, lng - dLng],
      [lat - dLat, lng + dLng],
      [lat + dLat, lng + dLng],
      [lat + dLat, lng - dLng],
    ];
  }, [parcelCoordinates, gpsLocation]);

  // Tâm hình học của thửa đất
  const baseCentroid = useMemo<[number, number]>(() => {
    const latSum = basePolygon.reduce((acc, p) => acc + p[0], 0);
    const lngSum = basePolygon.reduce((acc, p) => acc + p[1], 0);
    return [latSum / basePolygon.length, lngSum / basePolygon.length];
  }, [basePolygon]);

  // Tính diện tích thửa gốc
  const computedBaseArea = useMemo(() => {
    if (landAreaM2 !== undefined && landAreaM2 !== '' && !isNaN(Number(landAreaM2))) {
      return Number(landAreaM2);
    }
    return computePolygonAreaM2(basePolygon);
  }, [landAreaM2, basePolygon]);

  // Chuẩn bị đa giác con A và B cho trường hợp SPLIT (Tách thửa)
  const splitPolygons = useMemo(() => {
    if (mutationType !== 'SPLIT') return null;

    const children = Array.isArray(mutationDetails.splitChildren) ? mutationDetails.splitChildren : [];
    const childA = children[0] || {};
    const childB = children[1] || {};

    let polyA: [number, number][] = [];
    let polyB: [number, number][] = [];

    // Nếu KSV đã chấm điểm / kéo nắn cụ thể cho Căn A
    if (Array.isArray(mutationDetails.splitCustomPointsA) && mutationDetails.splitCustomPointsA.length >= 3) {
      polyA = mutationDetails.splitCustomPointsA;
    }
    // Nếu có điểm riêng cho Căn B
    if (Array.isArray(mutationDetails.splitCustomPointsB) && mutationDetails.splitCustomPointsB.length >= 3) {
      polyB = mutationDetails.splitCustomPointsB;
    }

    // Nếu chưa có tọa độ tự do, tự động tính phân chia hình học 2 phần dựa trên tỷ lệ diện tích
    if (polyA.length < 3 && basePolygon.length >= 4) {
      const p0 = basePolygon[0];
      const p1 = basePolygon[1];
      const p2 = basePolygon[2];
      const p3 = basePolygon[3] || basePolygon[2];

      const areaRatioA = childA.landAreaM2 && computedBaseArea > 0
        ? Math.min(0.85, Math.max(0.15, Number(childA.landAreaM2) / computedBaseArea))
        : 0.55;

      const cutL = interpolatePoint(p0, p3, areaRatioA);
      const cutR = interpolatePoint(p1, p2, areaRatioA);

      polyA = [p0, p1, cutR, cutL];
      if (polyB.length < 3) {
        polyB = [cutL, cutR, p2, p3];
      }
    }

    const areaA = childA.landAreaM2 || computePolygonAreaM2(polyA);
    const areaB = childB.landAreaM2 || computePolygonAreaM2(polyB);

    return {
      polyA,
      polyB,
      childA: {
        code: childA.parcelCode || childA.code || `${projectParcelCode}A`,
        area: areaA,
        owner: childA.ownerName || 'Chủ hộ Căn A',
      },
      childB: {
        code: childB.parcelCode || childB.code || `${projectParcelCode}B`,
        area: areaB,
        owner: childB.ownerName || 'Chủ hộ Căn B',
      },
    };
  }, [mutationType, mutationDetails, basePolygon, computedBaseArea, projectParcelCode]);

  // Toàn bộ các điểm cần fitBounds
  const allFitPoints = useMemo<[number, number][]>(() => {
    if (mutationType === 'SPLIT' && splitPolygons) {
      const pts = [...basePolygon];
      if (splitPolygons.polyA.length >= 3) pts.push(...splitPolygons.polyA);
      if (splitPolygons.polyB.length >= 3) pts.push(...splitPolygons.polyB);
      return pts;
    }
    return basePolygon;
  }, [basePolygon, mutationType, splitPolygons]);

  const selectedMergeCodes = Array.isArray(mutationDetails.selectedMergeCodes) ? mutationDetails.selectedMergeCodes : [];
  const mergeTargetCode = mutationDetails.mergeTargetCode || projectParcelCode;

  return (
    <div className="w-full bg-slate-900 rounded-2xl overflow-hidden border border-slate-700/60 shadow-lg relative flex flex-col">
      {/* 1. Header Toolbar trên bản đồ */}
      <div className="px-4 py-2.5 bg-slate-800/90 backdrop-blur-md border-b border-slate-700/60 flex items-center justify-between flex-wrap gap-2.5 z-10">
        <div className="flex items-center gap-2">
          {mutationType === 'SPLIT' ? (
            <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-500/20 text-amber-300 border border-amber-500/30 text-xs font-bold font-mono">
              <Split className="w-3.5 h-3.5" />
              TÁCH THỬA THỰC ĐỊA ({splitPolygons?.childA.code} & {splitPolygons?.childB.code})
            </span>
          ) : mutationType === 'MERGE' ? (
            <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-sky-500/20 text-sky-300 border border-sky-500/30 text-xs font-bold font-mono">
              <Merge className="w-3.5 h-3.5" />
              GỘP THỬA GIS (Đích: {mergeTargetCode})
            </span>
          ) : (
            <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 text-xs font-bold font-mono">
              <ShieldCheck className="w-3.5 h-3.5" />
              NGUYÊN TRẠNG (KHỚP RANH 100%)
            </span>
          )}

          <span className="text-xs text-slate-300 font-mono font-bold">
            Mã: [{projectParcelCode}] • {computedBaseArea} m²
          </span>
        </div>

        {/* Nút chuyển đổi Vệ tinh / Bản đồ + Mở Modal */}
        <div className="flex items-center gap-2">
          <div className="flex items-center bg-slate-700/70 p-0.5 rounded-lg border border-slate-600/60 text-[11px]">
            <button
              type="button"
              onClick={() => setTileMode('satellite')}
              className={`px-2.5 py-1 rounded-md font-bold transition-all ${
                tileMode === 'satellite'
                  ? 'bg-sky-600 text-white shadow-xs'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              Vệ tinh ESRI
            </button>
            <button
              type="button"
              onClick={() => setTileMode('street')}
              className={`px-2.5 py-1 rounded-md font-bold transition-all ${
                tileMode === 'street'
                  ? 'bg-sky-600 text-white shadow-xs'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              Bản đồ giao thông
            </button>
          </div>

          {onOpenEditorModal && (
            <button
              type="button"
              onClick={onOpenEditorModal}
              className="px-3 py-1 rounded-lg bg-sky-600 hover:bg-sky-500 text-white text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs border border-sky-400/40"
              title="Mở hộp thoại tách hoặc gộp thửa GIS với quy trình phê duyệt"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>Biên Tập Tách/Gộp</span>
            </button>
          )}
        </div>
      </div>

      {/* 2. Bản đồ tương tác Leaflet */}
      <div className="relative w-full h-[320px] sm:h-[380px] bg-slate-950">
        <MapContainer
          center={baseCentroid}
          zoom={18}
          maxZoom={21}
          scrollWheelZoom={false}
          attributionControl={false}
          zoomControl={false}
          className="w-full h-full"
        >
          {/* Lớp nền bản đồ */}
          {tileMode === 'satellite' ? (
            <TileLayer
              url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
              maxZoom={21}
              maxNativeZoom={19}
            />
          ) : (
            <TileLayer
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              maxZoom={21}
              maxNativeZoom={19}
            />
          )}

          <ZoomControl position="topright" />
          <MapAutoBounds points={allFitPoints} />

          {/* TRƯỜNG HỢP 1: TÁCH THỬA (SPLIT) */}
          {mutationType === 'SPLIT' && splitPolygons && (
            <>
              {/* Ranh thửa gốc - nét đứt mờ */}
              <Polygon
                positions={basePolygon}
                pathOptions={{
                  color: '#94a3b8',
                  weight: 2,
                  dashArray: '5, 5',
                  fillColor: '#64748b',
                  fillOpacity: 0.08,
                }}
              >
                <Tooltip direction="center" opacity={0.9}>
                  <div className="font-mono text-xs font-bold text-slate-800">
                    Ranh thửa gốc: [{projectParcelCode}] ({computedBaseArea} m²)
                  </div>
                </Tooltip>
              </Polygon>

              {/* Polygon Căn A (Đang khảo sát) - Màu Vàng Cam / Hổ phách */}
              {splitPolygons.polyA.length >= 3 && (
                <Polygon
                  positions={splitPolygons.polyA}
                  pathOptions={{
                    color: '#f59e0b',
                    weight: 3.5,
                    fillColor: '#fbbf24',
                    fillOpacity: 0.45,
                  }}
                >
                  <Tooltip permanent direction="center" opacity={0.95} className="cadastral-split-tooltip">
                    <div className="text-center font-sans">
                      <div className="font-black text-xs text-amber-900 font-mono">
                        {splitPolygons.childA.code}
                      </div>
                      <div className="text-[10px] font-bold text-amber-800">
                        {splitPolygons.childA.area} m²
                      </div>
                    </div>
                  </Tooltip>
                </Polygon>
              )}

              {/* Polygon Căn B (Thửa tách mới / Đất thừa) - Màu Cam Đậm */}
              {splitPolygons.polyB.length >= 3 && (
                <Polygon
                  positions={splitPolygons.polyB}
                  pathOptions={{
                    color: '#ea580c',
                    weight: 3.5,
                    fillColor: '#f97316',
                    fillOpacity: 0.45,
                  }}
                >
                  <Tooltip permanent direction="center" opacity={0.95} className="cadastral-split-tooltip">
                    <div className="text-center font-sans">
                      <div className="font-black text-xs text-orange-950 font-mono">
                        {splitPolygons.childB.code}
                      </div>
                      <div className="text-[10px] font-bold text-orange-900">
                        {splitPolygons.childB.area} m²
                      </div>
                    </div>
                  </Tooltip>
                </Polygon>
              )}
            </>
          )}

          {/* TRƯỜNG HỢP 2: GỘP THỬA (MERGE) */}
          {mutationType === 'MERGE' && (
            <Polygon
              positions={basePolygon}
              pathOptions={{
                color: '#0284c7',
                weight: 4,
                fillColor: '#38bdf8',
                fillOpacity: 0.4,
              }}
            >
              <Tooltip permanent direction="center" opacity={0.95}>
                <div className="text-center font-sans p-1">
                  <div className="font-black text-xs text-sky-950 font-mono">
                    THỬA GỘP: {mergeTargetCode}
                  </div>
                  <div className="text-[10px] font-bold text-sky-800">
                    Khuôn viên chung: {computedBaseArea} m²
                  </div>
                  {selectedMergeCodes.length > 0 && (
                    <div className="text-[9px] text-slate-600 mt-0.5">
                      Gồm: {selectedMergeCodes.join(', ')}
                    </div>
                  )}
                </div>
              </Tooltip>
            </Polygon>
          )}

          {/* TRƯỜNG HỢP 3: NGUYÊN TRẠNG / KHỚP RANH 100% (MATCH HOẶC ORIGINAL) */}
          {mutationType !== 'SPLIT' && mutationType !== 'MERGE' && (
            <Polygon
              positions={basePolygon}
              pathOptions={{
                color: '#16a34a',
                weight: 3.5,
                fillColor: '#22c55e',
                fillOpacity: 0.35,
              }}
            >
              <Tooltip permanent direction="center" opacity={0.95}>
                <div className="text-center font-sans p-1">
                  <div className="font-black text-xs text-emerald-950 font-mono">
                    {projectParcelCode}
                  </div>
                  <div className="text-[10px] font-bold text-emerald-800">
                    Khớp ranh: {computedBaseArea} m²
                  </div>
                  {(frontageWidth || lotDepth) && (
                    <div className="text-[9px] text-slate-600 font-mono mt-0.5">
                      Rộng {frontageWidth || '?'}m × Sâu {lotDepth || '?'}m
                    </div>
                  )}
                </div>
              </Tooltip>
            </Polygon>
          )}
        </MapContainer>

        {/* Chú giải nổi góc dưới trái (Floating Legend) */}
        <div className="absolute bottom-2.5 left-2.5 z-400 bg-slate-900/90 backdrop-blur-md px-3 py-2 rounded-xl border border-slate-700/80 shadow-lg text-[11px] text-slate-200 space-y-1.5 pointer-events-auto max-w-[280px]">
          <div className="font-bold text-slate-300 uppercase tracking-wider text-[10px] flex items-center justify-between">
            <span>Chú Giải Ranh Thửa Thực Địa</span>
            <span className="font-mono text-slate-400">PostGIS</span>
          </div>

          {mutationType === 'SPLIT' && splitPolygons ? (
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="w-3.5 h-3 rounded bg-amber-400 border border-amber-500 inline-block shadow-xs" />
                <span className="text-slate-300 font-bold truncate">
                  Căn A: <span className="font-mono text-amber-300">{splitPolygons.childA.code}</span> ({splitPolygons.childA.area}m²)
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3.5 h-3 rounded bg-orange-500 border border-orange-600 inline-block shadow-xs" />
                <span className="text-slate-300 font-bold truncate">
                  Căn B: <span className="font-mono text-orange-300">{splitPolygons.childB.code}</span> ({splitPolygons.childB.area}m²)
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3.5 h-1 border-t-2 border-dashed border-slate-400 inline-block" />
                <span className="text-slate-400 text-[10px]">Ranh thửa gốc ban đầu</span>
              </div>
            </div>
          ) : mutationType === 'MERGE' ? (
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="w-3.5 h-3 rounded bg-sky-500 border border-sky-600 inline-block shadow-xs" />
                <span className="text-slate-300 font-bold">
                  Khuôn viên thửa gộp: <span className="font-mono text-sky-300">{mergeTargetCode}</span>
                </span>
              </div>
              <div className="text-[10px] text-slate-400">
                Gồm {selectedMergeCodes.length > 0 ? selectedMergeCodes.length : 1} thửa liền kề hợp khối
              </div>
            </div>
          ) : (
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <span className="w-3.5 h-3 rounded bg-emerald-500 border border-emerald-600 inline-block shadow-xs" />
                <span className="text-emerald-300 font-bold">
                  Khớp ranh 100% ({computedBaseArea} m²)
                </span>
              </div>
              <div className="text-[10px] text-slate-400">
                Toạ độ trùng khớp bản đồ địa chính hệ tọa độ VN-2000
              </div>
            </div>
          )}
        </div>

        {/* Tọa độ tâm góc dưới phải */}
        <div className="absolute bottom-2.5 right-2.5 z-400 bg-slate-900/80 backdrop-blur-sm px-2.5 py-1 rounded-lg border border-slate-700/60 text-[10px] font-mono text-slate-400 pointer-events-none">
          Tâm thửa: {baseCentroid[0].toFixed(6)}, {baseCentroid[1].toFixed(6)}
        </div>
      </div>
    </div>
  );
};
