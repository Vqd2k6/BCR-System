import React, { useState, useMemo, useEffect } from 'react';
import { MapContainer, TileLayer, Polygon, Polyline, Marker, Tooltip, ZoomControl, useMap } from 'react-leaflet';
import L from 'leaflet';
import { Compass, Navigation, Layers, Maximize2, ShieldAlert, CheckCircle2 } from 'lucide-react';
import {
  METRO_LINE2_CENTERLINE,
  polygonToPolylineDistance,
  METRO_LINE2_STATIONS,
} from '../../../../../survey-phase1/utils/metroSpatialCalculator';

interface Props {
  parcelCoordinates?: [number, number][];
  projectParcelCode?: string;
  metroOffsetDistance?: string | number;
  clearanceOffsetDistance?: string | number;
  chainage?: string;
  gpsLocation?: {
    lat: number;
    lng: number;
    accuracy?: number;
  };
}

/**
 * Controller tự động fit bounds vừa vặn cả thửa đất và tim metro
 */
const MapAutoBounds: React.FC<{
  points: [number, number][];
}> = ({ points }) => {
  const map = useMap();
  useEffect(() => {
    if (points && points.length >= 2) {
      const bounds = L.latLngBounds(points);
      map.fitBounds(bounds, { padding: [35, 35], maxZoom: 19 });
    }
    const timer = setTimeout(() => map.invalidateSize(), 250);
    return () => clearTimeout(timer);
  }, [points, map]);

  return null;
};

export const AuditMetroSpatialVisualMap: React.FC<Props> = ({
  parcelCoordinates,
  projectParcelCode,
  metroOffsetDistance,
  clearanceOffsetDistance,
  chainage,
  gpsLocation,
}) => {
  const [tileMode, setTileMode] = useState<'satellite' | 'street'>('satellite');

  // Chuẩn hóa tọa độ thửa đất
  const effectivePolygon = useMemo<[number, number][]>(() => {
    if (Array.isArray(parcelCoordinates) && parcelCoordinates.length >= 3) {
      return parcelCoordinates;
    }
    // Fallback đa giác hình chữ nhật quanh tọa độ GPS nếu DB chưa có polygon
    const lat = gpsLocation?.lat && !isNaN(gpsLocation.lat) ? Number(gpsLocation.lat) : 10.79241;
    const lng = gpsLocation?.lng && !isNaN(gpsLocation.lng) ? Number(gpsLocation.lng) : 106.71152;
    const dLat = 0.00007; // ~8m
    const dLng = 0.00009; // ~10m
    return [
      [lat - dLat, lng - dLng],
      [lat - dLat, lng + dLng],
      [lat + dLat, lng + dLng],
      [lat + dLat, lng - dLng],
    ];
  }, [parcelCoordinates, gpsLocation]);

  // Tính tâm hình học của thửa đất
  const parcelCentroid = useMemo<[number, number]>(() => {
    const latSum = effectivePolygon.reduce((acc, p) => acc + p[0], 0);
    const lngSum = effectivePolygon.reduce((acc, p) => acc + p[1], 0);
    return [latSum / effectivePolygon.length, lngSum / effectivePolygon.length];
  }, [effectivePolygon]);

  // Tính toán hình chiếu vuông góc và cự ly ngắn nhất từ thửa đất đến tim Metro 2
  const spatialResult = useMemo(() => {
    const res = polygonToPolylineDistance(effectivePolygon, METRO_LINE2_CENTERLINE);
    return res;
  }, [effectivePolygon]);

  const { closestVertex, closestPoint, minDistance } = spatialResult;

  // Điểm giữa của đường dóng để đặt nhãn khoảng cách
  const midpoint = useMemo<[number, number]>(() => {
    return [
      (closestVertex[0] + closestPoint[0]) / 2,
      (closestVertex[1] + closestPoint[1]) / 2,
    ];
  }, [closestVertex, closestPoint]);

  // Toàn bộ các điểm cần fitBounds (Polygon + Closest Point trên tim tuyến)
  const allFitPoints = useMemo<[number, number][]>(() => {
    return [...effectivePolygon, closestPoint, closestVertex];
  }, [effectivePolygon, closestPoint, closestVertex]);

  // Phân hạng vùng ảnh hưởng
  const distNumber = Number(metroOffsetDistance || minDistance);
  const riskZone = useMemo(() => {
    if (distNumber <= 10) {
      return {
        label: 'Zone 1 (Vùng ảnh hưởng đặc biệt ≤10m)',
        color: 'bg-red-100 text-red-800 border-red-300',
        badge: '🚨 Nguy cơ rất cao',
      };
    } else if (distNumber <= 30) {
      return {
        label: 'Zone 2 (Vùng ảnh hưởng trực tiếp ≤30m)',
        color: 'bg-amber-100 text-amber-800 border-amber-300',
        badge: '⚠️ Vùng ảnh hưởng trực tiếp',
      };
    } else if (distNumber <= 50) {
      return {
        label: 'Zone 3 (Vùng lân cận cự ly ≤50m)',
        color: 'bg-blue-100 text-blue-800 border-blue-300',
        badge: 'ℹ️ Vùng lân cận',
      };
    }
    return {
      label: 'Ngoài phạm vi ảnh hưởng (>50m)',
      color: 'bg-slate-100 text-slate-700 border-slate-300',
      badge: '✓ Ngoài hành lang',
    };
  }, [distNumber]);

  // Custom DivIcon cho nhãn khoảng cách nổi trên đường dóng
  const distanceLabelIcon = useMemo(() => {
    const distText = metroOffsetDistance
      ? `${Number(metroOffsetDistance).toFixed(1)} m`
      : `${minDistance.toFixed(1)} m`;

    return L.divIcon({
      className: 'custom-dist-label',
      html: `
        <div style="
          background-color: #1e293b;
          color: #fef08a;
          border: 1.5px solid #facc15;
          border-radius: 9999px;
          padding: 2px 7px;
          font-family: monospace;
          font-size: 11px;
          font-weight: 900;
          white-space: nowrap;
          box-shadow: 0 4px 6px -1px rgba(0,0,0,0.3);
          transform: translate(-50%, -50%);
          display: inline-flex;
          align-items: center;
          gap: 4px;
        ">
          <span style="display:inline-block; width:6px; height:6px; border-radius:9999px; background-color:#facc15;"></span>
          ${distText}
        </div>
      `,
      iconSize: [0, 0],
    });
  }, [metroOffsetDistance, minDistance]);

  // Custom DivIcon cho điểm đo GPS
  const gpsMarkerIcon = useMemo(() => {
    return L.divIcon({
      className: 'custom-gps-marker',
      html: `
        <div style="
          position: relative;
          width: 16px;
          height: 16px;
          transform: translate(-50%, -50%);
        ">
          <div style="
            position: absolute;
            width: 100%;
            height: 100%;
            border-radius: 9999px;
            background-color: rgba(14, 165, 233, 0.4);
            animation: ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite;
          "></div>
          <div style="
            position: relative;
            width: 12px;
            height: 12px;
            margin: 2px;
            border-radius: 9999px;
            background-color: #0284c7;
            border: 2px solid #ffffff;
            box-shadow: 0 1px 3px rgba(0,0,0,0.4);
          "></div>
        </div>
      `,
      iconSize: [16, 16],
    });
  }, []);

  return (
    <div className="rounded-xl overflow-hidden border border-sky-300 bg-white shadow-xs space-y-0 mt-3">
      {/* Top Header Controls */}
      <div className="p-3 bg-gradient-to-r from-sky-50 to-slate-50 border-b border-sky-200 flex flex-wrap items-center justify-between gap-2 text-xs">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-lg bg-sky-600 flex items-center justify-center text-white">
            <Compass className="w-3.5 h-3.5" />
          </div>
          <div>
            <span className="font-bold text-slate-800">
              Đối Soát Cự Ly Trắc Địa & Tim Tuyến Metro Số 2
            </span>
            <span className="text-[11px] text-slate-500 block">
              Thửa {projectParcelCode || 'hiện tại'} &bull; Lý trình:{' '}
              <strong className="text-slate-700">{chainage || 'Km 4+800'}</strong>
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Badge phân hạng vùng */}
          <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${riskZone.color}`}>
            {riskZone.badge}
          </span>

          {/* Nút chuyển đổi kiểu bản đồ */}
          <div className="flex items-center bg-white border border-slate-200 rounded-lg p-0.5 shadow-2xs">
            <button
              type="button"
              onClick={() => setTileMode('satellite')}
              className={`px-2 py-1 rounded text-[11px] font-bold transition-all ${
                tileMode === 'satellite'
                  ? 'bg-sky-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Vệ tinh
            </button>
            <button
              type="button"
              onClick={() => setTileMode('street')}
              className={`px-2 py-1 rounded text-[11px] font-bold transition-all ${
                tileMode === 'street'
                  ? 'bg-sky-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Giao thông
            </button>
          </div>
        </div>
      </div>

      {/* Map Container */}
      <div className="relative w-full h-[320px] bg-slate-900">
        <MapContainer
          center={parcelCentroid}
          zoom={18}
          maxZoom={22}
          zoomControl={false}
          scrollWheelZoom={true}
          style={{ width: '100%', height: '100%' }}
        >
          <MapAutoBounds points={allFitPoints} />
          <ZoomControl position="bottomright" />

          {/* Tile Layer */}
          {tileMode === 'satellite' ? (
            <TileLayer
              attribution="Esri World Imagery"
              url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
              maxNativeZoom={19}
              maxZoom={22}
            />
          ) : (
            <TileLayer
              attribution="&copy; OpenStreetMap &copy; CARTO"
              url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
              subdomains="abcd"
              maxNativeZoom={19}
              maxZoom={22}
            />
          )}

          {/* 1. Tim Tuyến Metro Số 2 (Polyline đỏ rực rỡ) */}
          <Polyline
            positions={METRO_LINE2_CENTERLINE}
            pathOptions={{
              color: '#dc2626',
              weight: 4.5,
              opacity: 0.95,
            }}
          >
            <Tooltip direction="top" sticky>
              <div className="text-xs font-bold text-red-600">
                🚇 Tim Tuyến Metro Số 2 (Bến Thành - Tham Lương)
              </div>
            </Tooltip>
          </Polyline>

          {/* 2. Đa giác Thửa Đất (Polygon xanh dương) */}
          <Polygon
            positions={effectivePolygon}
            pathOptions={{
              color: '#0284c7',
              fillColor: '#38bdf8',
              fillOpacity: 0.45,
              weight: 2.5,
            }}
          >
            <Tooltip direction="center">
              <div className="text-xs font-bold text-sky-800">
                🏠 Thửa: {projectParcelCode || 'Đang thẩm định'}
              </div>
            </Tooltip>
          </Polygon>

          {/* 3. Đường dóng trắc địa vuông góc (Nét đứt màu vàng) */}
          <Polyline
            positions={[closestVertex, closestPoint]}
            pathOptions={{
              color: '#facc15',
              weight: 3.5,
              dashArray: '6, 6',
              opacity: 1,
            }}
          />

          {/* 4. Nhãn khoảng cách ở giữa đường dóng */}
          <Marker position={midpoint} icon={distanceLabelIcon} />

          {/* 5. Điểm đo GPS thực địa */}
          {gpsLocation?.lat && gpsLocation?.lng && (
            <Marker
              position={[Number(gpsLocation.lat), Number(gpsLocation.lng)]}
              icon={gpsMarkerIcon}
            >
              <Tooltip direction="bottom">
                <div className="text-[11px] font-mono text-slate-700">
                  GPS: {gpsLocation.lat.toFixed(6)}, {gpsLocation.lng.toFixed(6)}
                  <br />
                  Sai số: ±{gpsLocation.accuracy || 3.5}m
                </div>
              </Tooltip>
            </Marker>
          )}
        </MapContainer>
      </div>

      {/* Legend & Summary Info Bar */}
      <div className="p-3 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3 text-[11px]">
        {/* Chú giải trực quan */}
        <div className="flex flex-wrap items-center gap-3 font-semibold text-slate-700">
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded bg-sky-400 border border-sky-600 inline-block" />
            <span>Thửa đất {projectParcelCode || ''}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-4 h-1 bg-red-600 inline-block rounded" />
            <span className="text-red-700 font-bold">Tim Metro Số 2</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-4 h-0.5 border-t-2 border-dashed border-amber-500 inline-block" />
            <span className="text-amber-800 font-bold">Đường dóng cự ly ngắn nhất</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-sky-600 border border-white shadow-xs inline-block" />
            <span>Tọa độ GPS thực địa</span>
          </div>
        </div>

        {/* Số đo trắc địa chuẩn xác */}
        <div className="flex items-center gap-2 font-mono text-slate-800">
          <span>Khoảng cách kiểm toán:</span>
          <span className="px-2 py-0.5 rounded bg-sky-100 text-sky-900 font-black text-xs border border-sky-300">
            {distNumber.toFixed(1)} m
          </span>
          {clearanceOffsetDistance && (
            <span className="text-slate-500 text-[10px]">
              (GPMB: <strong>{clearanceOffsetDistance}m</strong>)
            </span>
          )}
        </div>
      </div>
    </div>
  );
};
