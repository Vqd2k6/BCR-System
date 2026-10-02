import React, { useState, useMemo, useEffect } from 'react';
import { MapContainer, TileLayer, Polygon, Polyline, Marker, Tooltip, ZoomControl, useMap } from 'react-leaflet';
import L from 'leaflet';
import { Compass, Navigation, Layers, Building, ShieldCheck, CheckCircle2 } from 'lucide-react';
import {
  METRO_LINE2_CENTERLINE,
  METRO_CORRIDOR_BOUNDARIES,
  METRO_STATION_DETAILED_OUTLINES,
  calculateComprehensiveMetroSpatialMetrics,
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
 * Controller tự động fit bounds vừa vặn cả thửa đất, tim metro và công trình ga/ranh bao ngoài
 */
const MapAutoBounds: React.FC<{
  points: [number, number][];
}> = ({ points }) => {
  const map = useMap();
  useEffect(() => {
    if (points && points.length >= 2) {
      const bounds = L.latLngBounds(points);
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 19 });
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

  // Tính toán toàn diện cự ly trắc địa:
  // 1. Cự ly tới Tim Tuyến Metro 2 (537 điểm CAD chuẩn nằm giữa 2 line xanh)
  // 2. Cự ly tới Đường Bao Ngoài (Mép công trình ga màu trắng hoặc mép hố đào Tả/Hữu)
  const spatialMetrics = useMemo(() => {
    return calculateComprehensiveMetroSpatialMetrics(effectivePolygon);
  }, [effectivePolygon]);

  const {
    closestCenterVertex,
    closestCenterPoint,
    distanceToCenterlineMeters,
    closestOuterVertex,
    closestOuterPoint,
    distanceToOuterBoundaryMeters,
    outerBoundaryType,
    closestStationName,
    closestStationFootprint,
  } = spatialMetrics;

  // Điểm giữa của đường dóng 1 (tim tuyến) để đặt nhãn khoảng cách
  const centerMidpoint = useMemo<[number, number]>(() => {
    return [
      (closestCenterVertex[0] + closestCenterPoint[0]) / 2,
      (closestCenterVertex[1] + closestCenterPoint[1]) / 2,
    ];
  }, [closestCenterVertex, closestCenterPoint]);

  // Điểm giữa của đường dóng 2 (đường bao ngoài / ga) để đặt nhãn khoảng cách
  const outerMidpoint = useMemo<[number, number]>(() => {
    return [
      (closestOuterVertex[0] + closestOuterPoint[0]) / 2,
      (closestOuterVertex[1] + closestOuterPoint[1]) / 2,
    ];
  }, [closestOuterVertex, closestOuterPoint]);

  // Toàn bộ các điểm cần fitBounds (Polygon + Closest Point Tim + Closest Point Bao Ngoài)
  const allFitPoints = useMemo<[number, number][]>(() => {
    const pts = [
      ...effectivePolygon,
      closestCenterPoint,
      closestCenterVertex,
      closestOuterPoint,
      closestOuterVertex,
    ];
    if (closestStationFootprint && closestStationFootprint.length > 0) {
      // Lấy thêm 2 điểm đầu/cuối của footprint ga để góc nhìn cân đối
      pts.push(closestStationFootprint[0], closestStationFootprint[Math.floor(closestStationFootprint.length / 2)]);
    }
    return pts;
  }, [effectivePolygon, closestCenterPoint, closestCenterVertex, closestOuterPoint, closestOuterVertex, closestStationFootprint]);

  // Helper bóc tách số an toàn (loại bỏ hậu tố 'm', 'm2' nếu có như "9.3m")
  const parseCleanNumber = (val: any, fallback: number): number => {
    if (val === undefined || val === null || val === '') return fallback;
    if (typeof val === 'number' && !isNaN(val)) return val;
    const cleaned = String(val).replace(/[^\d.-]/g, '');
    const parsed = parseFloat(cleaned);
    return isNaN(parsed) ? fallback : parsed;
  };

  // Cự ly thực tế hiển thị (chống NaN khi string có đơn vị 'm')
  const distCenterNumber = parseCleanNumber(metroOffsetDistance, distanceToCenterlineMeters);
  const distOuterNumber = parseCleanNumber(clearanceOffsetDistance, distanceToOuterBoundaryMeters);

  // Phân hạng vùng ảnh hưởng
  const riskZone = useMemo(() => {
    if (distCenterNumber <= 10) {
      return {
        label: 'Zone 1 (Vùng ảnh hưởng đặc biệt ≤10m)',
        color: 'bg-red-100 text-red-800 border-red-300',
        badge: '🚨 Nguy cơ rất cao',
      };
    } else if (distCenterNumber <= 30) {
      return {
        label: 'Zone 2 (Vùng ảnh hưởng trực tiếp ≤30m)',
        color: 'bg-amber-100 text-amber-800 border-amber-300',
        badge: '⚠️ Vùng ảnh hưởng trực tiếp',
      };
    } else if (distCenterNumber <= 50) {
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
  }, [distCenterNumber]);

  // Custom DivIcon cho nhãn cự ly tim hầm (Vàng)
  const centerDistanceLabelIcon = useMemo(() => {
    return L.divIcon({
      className: 'custom-dist-center-label',
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
          d_tim = ${distCenterNumber.toFixed(1)}m
        </div>
      `,
      iconSize: [0, 0],
    });
  }, [distCenterNumber]);

  // Custom DivIcon cho nhãn cự ly đường bao ngoài / công trình ga (Xanh ngọc / Cyan hoặc Đỏ Cam khi cán qua)
  const outerDistanceLabelIcon = useMemo(() => {
    const isStation = outerBoundaryType === 'STATION_OUTLINE';
    const isZeroOrIntersects = distOuterNumber === 0 || spatialMetrics.isStationIntersectsParcel;

    let badgeText = `${isStation ? 'd_mép ga' : 'd_mép hố đào'} = ${distOuterNumber.toFixed(1)}m`;
    let bgColor = '#0c4a6e';
    let textColor = '#bae6fd';
    let borderColor = '#38bdf8';
    let dotColor = '#38bdf8';

    if (isZeroOrIntersects) {
      badgeText = isStation ? 'd_ga = 0m (Ga cán qua thửa đất)' : 'd_hố đào = 0m (Trong mép hố đào)';
      bgColor = '#7f1d1d';
      textColor = '#fecaca';
      borderColor = '#ef4444';
      dotColor = '#ef4444';
    }

    return L.divIcon({
      className: 'custom-dist-outer-label',
      html: `
        <div style="
          background-color: ${bgColor};
          color: ${textColor};
          border: 1.5px solid ${borderColor};
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
          <span style="display:inline-block; width:6px; height:6px; border-radius:9999px; background-color:${dotColor};"></span>
          ${badgeText}
        </div>
      `,
      iconSize: [0, 0],
    });
  }, [distOuterNumber, outerBoundaryType, spatialMetrics.isStationIntersectsParcel]);

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
              Thửa {projectParcelCode || 'hiện tại'} &bull; Khu vực:{' '}
              <strong className="text-sky-700">{closestStationName || 'Tuyến Metro Số 2'}</strong>
              {chainage ? ` • ${chainage}` : ''}
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
      <div className="relative w-full h-[340px] sm:h-[400px] bg-slate-900">
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

          {/* 1. MÉP HỐ ĐÀO TẢ TUYẾN & HỮU TUYẾN (2 đường line nét đứt màu xanh kẹp 2 bên tim) */}
          {METRO_CORRIDOR_BOUNDARIES.map((boundary, idx) => (
            <Polyline
              key={`corridor-boundary-${idx}`}
              positions={boundary.coords}
              pathOptions={{
                color: '#0284c7',
                weight: 2,
                dashArray: '6, 5',
                opacity: 0.85,
              }}
            >
              <Tooltip sticky>
                <div className="text-xs font-bold text-sky-800">
                  🛡️ {boundary.name} (Line Mép Hố Đào Tuyến Metro 2)
                </div>
              </Tooltip>
            </Polyline>
          ))}

          {/* 2. CÔNG TRÌNH NHÀ GA MÀU TRẮNG (Phác họa chi tiết các nhà ga ngầm & Depot) */}
          {METRO_STATION_DETAILED_OUTLINES.map((station, idx) => (
            <Polygon
              key={`station-detailed-${station.code}-${idx}`}
              positions={station.coords}
              pathOptions={{
                color: '#ffffff',
                weight: 2.5,
                fillColor: '#ffffff',
                fillOpacity: 0.28,
                opacity: 0.95,
                className: 'metro-station-white-outline',
              }}
            >
              <Tooltip sticky>
                <div className="text-xs font-bold text-slate-900">
                  🏛️ {station.name}
                  {station.desc && (
                    <div className="text-[10px] text-slate-600 font-normal mt-0.5 max-w-[280px]">
                      {station.desc}
                    </div>
                  )}
                  <div className="text-[10px] text-sky-600 font-semibold mt-1">
                    Mặt bằng công trình ga (Line viền trắng)
                  </div>
                </div>
              </Tooltip>
            </Polygon>
          ))}

          {/* 3. TIM TUYẾN METRO SỐ 2 (Polyline đỏ rực rỡ chuẩn CAD 537 điểm chạy chính giữa 2 line xanh) */}
          <Polyline
            positions={METRO_LINE2_CENTERLINE}
            pathOptions={{
              color: '#dc2626',
              weight: 4,
              opacity: 0.95,
            }}
          >
            <Tooltip direction="top" sticky>
              <div className="text-xs font-bold text-red-600">
                🚇 Tim Tuyến Metro Số 2 (Chạy chính giữa 2 đường mép hố đào nét đứt xanh)
              </div>
            </Tooltip>
          </Polyline>

          {/* 4. ĐA GIÁC THỬA ĐẤT (Polygon xanh dương) */}
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

          {/* 5. ĐƯỜNG DÓNG 1: TRẮC ĐỊA VUÔNG GÓC TỚI TIM HẦM (Nét đứt màu vàng) */}
          <Polyline
            positions={[closestCenterVertex, closestCenterPoint]}
            pathOptions={{
              color: '#facc15',
              weight: 3.5,
              dashArray: '6, 6',
              opacity: 1,
            }}
          />
          {/* Nhãn khoảng cách tim hầm */}
          <Marker position={centerMidpoint} icon={centerDistanceLabelIcon} />

          {/* 6. ĐƯỜNG DÓNG 2: CỰ LY TỚI ĐƯỜNG BAO NGOÀI / CÔNG TRÌNH GA TRẮNG (Nét đứt màu xanh ngọc) */}
          {distOuterNumber > 0 && (
            <Polyline
              positions={[closestOuterVertex, closestOuterPoint]}
              pathOptions={{
                color: '#38bdf8',
                weight: 3,
                dashArray: '4, 4',
                opacity: 1,
              }}
            />
          )}
          {/* Nhãn khoảng cách đường bao ngoài */}
          <Marker
            position={distOuterNumber > 0 ? outerMidpoint : [closestCenterVertex[0] + 0.00008, closestCenterVertex[1]]}
            icon={outerDistanceLabelIcon}
          />

          {/* 7. ĐIỂM ĐO GPS THỰC ĐỊA */}
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
            <span className="text-red-700 font-bold">Tim Metro (Đỏ giữa)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-4 h-0.5 border-t-2 border-dashed border-sky-600 inline-block" />
            <span className="text-sky-800">Mép hố đào (Xanh nét đứt)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded bg-white border border-slate-400 inline-block shadow-2xs" />
            <span className="text-slate-800">Công trình ga (Line trắng)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-4 h-0.5 border-t-2 border-dashed border-amber-500 inline-block" />
            <span className="text-amber-800 font-bold">Dóng tim hầm</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-4 h-0.5 border-t-2 border-dashed border-sky-400 inline-block" />
            <span className="text-sky-700 font-bold">Dóng bao ngoài/ga</span>
          </div>
        </div>

        {/* Số đo trắc địa chuẩn xác */}
        <div className="flex items-center gap-2 font-mono text-slate-800">
          <span className="text-slate-500 font-sans text-xs">Cự ly:</span>
          <span
            className="px-2 py-0.5 rounded bg-amber-50 text-amber-900 font-black text-xs border border-amber-300"
            title="Khoảng cách vuông góc tới tim hầm Metro 2 (đường đỏ ở giữa)"
          >
            Tim: {distCenterNumber.toFixed(1)}m
          </span>
          <span
            className="px-2 py-0.5 rounded bg-sky-50 text-sky-900 font-black text-xs border border-sky-300"
            title={`Khoảng cách tới đường bao ngoài (${outerBoundaryType === 'STATION_OUTLINE' ? (distOuterNumber === 0 ? 'Ga cán qua thửa đất' : 'Mép công trình ga trắng') : 'Mép hố đào'})`}
          >
            Bao ngoài: {distOuterNumber === 0 ? '0.0m (Ga cán qua)' : `${distOuterNumber.toFixed(1)}m`}
          </span>
        </div>
      </div>
    </div>
  );
};
