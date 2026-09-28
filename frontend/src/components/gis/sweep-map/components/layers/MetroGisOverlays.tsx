import React from 'react';
import { Polygon, Polyline, CircleMarker, Circle, Marker, Tooltip } from 'react-leaflet';
import {
  METRO_LINE2_CENTERLINE,
  METRO_STATIONS,
  METRO_CORRIDOR_BOUNDARIES,
  METRO_STATION_POLYGONS,
  METRO_TBM_POLYGONS,
} from '../../../../../features/survey-phase1/constants/metroGisConstants';
import { userGpsIcon } from '../../utils/sweepMapHelpers';

interface MetroGisOverlaysProps {
  showCenterline: boolean;
  showZonesZoi: boolean;
  showStationMarkers: boolean;
  currentStationCenter: [number, number];
  userGps?: { lat: number; lng: number; accuracy?: number } | null;
}

export const MetroGisOverlays: React.FC<MetroGisOverlaysProps> = ({
  showCenterline,
  showZonesZoi,
  showStationMarkers,
  currentStationCenter,
  userGps,
}) => {
  return (
    <>
      {/* 1. RANH GIẢI PHÓNG MẶT BẰNG TẢ TUYẾN & HỮU TUYẾN (File gốc CAD / KML) */}
      {showZonesZoi &&
        METRO_CORRIDOR_BOUNDARIES.map((boundary: any, idx: number) => (
          <Polyline
            key={`cad-boundary-${idx}`}
            positions={boundary.coords}
            pathOptions={{
              color: '#0284c7',
              weight: 2,
              dashArray: '6, 5',
              opacity: 0.85,
            }}
          >
            <Tooltip sticky>
              <span style={{ fontSize: '0.75rem', fontWeight: 600 }}>{boundary.name}</span>
            </Tooltip>
          </Polyline>
        ))}

      {/* 2. CÁC HỘP GA METRO THỰC TẾ (11 Hộp ga CAD MAUR) */}
      {showZonesZoi &&
        METRO_STATION_POLYGONS.map((poly: any, idx: number) => (
          <Polygon
            key={`station-box-${idx}`}
            positions={poly.coords}
            pathOptions={{
              color: '#ef4444',
              weight: 2,
              fillColor: '#ef4444',
              fillOpacity: 0.18,
            }}
          >
            <Tooltip sticky>
              <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#b91c1c' }}>
                🏢 {poly.name}
                {poly.km && <div style={{ fontSize: '0.7rem', color: '#475569' }}>Lý trình: {poly.km}</div>}
                {poly.desc && <div style={{ fontSize: '0.7rem', color: '#64748b' }}>{poly.desc}</div>}
              </div>
            </Tooltip>
          </Polygon>
        ))}

      {/* 2b. CÁC ĐOẠN HẦM TBM NỐI LIỀN GA (CAD chuẩn MAUR) */}
      {showZonesZoi &&
        METRO_TBM_POLYGONS.map((poly: any, idx: number) => (
          <Polygon
            key={`tbm-tunnel-${idx}`}
            positions={poly.coords}
            pathOptions={{
              color: '#0284c7',
              weight: 1.5,
              dashArray: '5, 5',
              fillColor: '#0284c7',
              fillOpacity: 0.12,
            }}
          >
            <Tooltip sticky>
              <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#0369a1' }}>
                🚇 Đoạn Hầm TBM Khoan Ngầm #{idx + 1}
                <div style={{ fontSize: '0.7rem', color: '#475569' }}>Hành lang tuyến Metro Số 2 (Ban QLDA MAUR)</div>
              </div>
            </Tooltip>
          </Polygon>
        ))}

      {/* 3. ĐƯỜNG TIM TUYẾN GỐC (Red Centerline Polyline) */}
      {showCenterline && (
        <Polyline
          positions={METRO_LINE2_CENTERLINE}
          pathOptions={{
            color: '#ef4444',
            weight: 3.5,
            opacity: 0.9,
          }}
        />
      )}

      {/* 4. CÁC TRẠM GA METRO (Markers) */}
      {showStationMarkers &&
        METRO_STATIONS.map((st: any) => (
          <CircleMarker
            key={`st-${st.code}`}
            center={st.pos}
            radius={st.code === 'DEP' ? 7 : 5}
            pathOptions={{
              color: '#ffffff',
              fillColor: st.code === 'DEP' ? '#059669' : '#ef4444',
              fillOpacity: 1,
              weight: 2,
            }}
          >
            <Tooltip permanent={false} direction="top" offset={[0, -6]}>
              <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#0f172a' }}>
                {st.name}
                {st.km && <div style={{ fontSize: '0.7rem', color: '#64748b', fontWeight: 500 }}>{st.km}</div>}
              </div>
            </Tooltip>
          </CircleMarker>
        ))}

      {/* 500m Ga Geofence Circle */}
      <Circle
        center={currentStationCenter}
        radius={500}
        pathOptions={{
          color: '#0284c7',
          fillColor: '#0284c7',
          fillOpacity: 0.04,
          dashArray: '6, 6',
          weight: 1.5,
        }}
      />

      {/* User GPS Pin */}
      {userGps && <Marker position={[userGps.lat, userGps.lng]} icon={userGpsIcon} />}
    </>
  );
};
