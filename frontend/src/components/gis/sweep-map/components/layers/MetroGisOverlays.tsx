import React from 'react';
import { Polygon, Polyline, CircleMarker, Circle, Marker, Tooltip } from 'react-leaflet';
import {
  METRO_LINE2_CENTERLINE,
  METRO_STATIONS,
  METRO_CORRIDOR_BOUNDARIES,
  METRO_STATION_POLYGONS,
  METRO_TBM_POLYGONS,
  METRO_STATION_DETAILED_OUTLINES,
} from '../../../../../features/survey-phase1/constants/metroGisConstants';
import { userGpsIcon } from '../../utils/sweepMapHelpers';

interface MetroGisOverlaysProps {
  showCenterline: boolean;
  showZonesZoi: boolean;
  showStationMarkers: boolean;
  showStationOutlines?: boolean;
  currentStationCenter: [number, number];
  userGps?: { lat: number; lng: number; accuracy?: number } | null;
}

export const MetroGisOverlays: React.FC<MetroGisOverlaysProps> = ({
  showCenterline,
  showZonesZoi,
  showStationMarkers,
  showStationOutlines = true,
  currentStationCenter,
  userGps,
}) => {
  return (
    <>
      {/* 1. MÉP HỐ ĐÀO TẢ TUYẾN & HỮU TUYẾN (File gốc CAD / KML) */}
      {showZonesZoi &&
        METRO_CORRIDOR_BOUNDARIES.map((boundary, idx) => (
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
        METRO_STATION_POLYGONS.map((poly, idx) => (
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

      {/* 2b. CÁC ĐOẠN HẦM TBM NỐI LIỀN GA (ĐÃ HÀN GẮN & KHÉP KÍN 100% THÀNH TUYẾN LIỀN MẠCH) */}
      {showZonesZoi &&
        METRO_TBM_POLYGONS.map((poly, idx) => {
          const tbmNames = [
            'Hầm TBM Bến Thành (ST01) ➔ Tao Đàn (ST02)',
            'Hầm TBM Tao Đàn (ST02) ➔ Dân Chủ (ST03)',
            'Hầm TBM Dân Chủ (ST03) ➔ Hòa Hưng (ST04)',
            'Hầm TBM Hòa Hưng (ST04) ➔ Lê Thị Riêng (ST05)',
            'Hầm TBM Lê Thị Riêng (ST05) ➔ Phạm Văn Hai (ST06)',
            'Hầm TBM Phạm Văn Hai (ST06) ➔ Bảy Hiền (ST07)',
            'Hầm TBM Bảy Hiền (ST07) ➔ Nguyễn Hồng Đào (ST08)',
            'Hầm TBM Nguyễn Hồng Đào (ST08) ➔ Bà Quẹo (ST09)',
            'Hầm TBM Bà Quẹo (ST09) ➔ Phạm Văn Bạch (ST10)',
            'Hầm TBM & Portal Phạm Văn Bạch (ST10) ➔ Tân Bình (ST11)',
          ];
          const segName = tbmNames[idx] || `Hầm TBM Phân đoạn #${idx + 1}`;

          return (
            <Polygon
              key={`tbm-tunnel-${idx}`}
              positions={poly.coords}
              pathOptions={{
                color: '#0284c7',
                weight: 2,
                fillColor: '#0284c7',
                fillOpacity: 0.16,
              }}
            >
              <Tooltip sticky>
                <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#0369a1' }}>
                  🚇 {segName}
                  <div style={{ fontSize: '0.7rem', color: '#475569', fontWeight: 500 }}>
                    Hành lang hầm ngầm khép kín liên tục (Ban QLDA MAUR)
                  </div>
                </div>
              </Tooltip>
            </Polygon>
          );
        })}

      {/* 2c. PHÁC HOẠ CÔNG TRÌNH NHÀ GA MÀU TRẮNG (GOOGLE MY MAPS / CAD MAUR) */}
      {showStationOutlines &&
        METRO_STATION_DETAILED_OUTLINES.map((station, idx) => (
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
              <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#0f172a' }}>
                🏛️ {station.name}
                {station.desc && (
                  <div style={{ fontSize: '0.7rem', color: '#475569', fontWeight: 500, marginTop: '2px', maxWidth: '300px' }}>
                    {station.desc}
                  </div>
                )}
                <div style={{ fontSize: '0.675rem', color: '#0284c7', marginTop: '3px' }}>
                  📐 Phác họa công trình: {station.coords.length} đỉnh tọa độ chi tiết
                </div>
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
        METRO_STATIONS.map((st) => (
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
