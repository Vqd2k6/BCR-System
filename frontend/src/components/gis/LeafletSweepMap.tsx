import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Polygon, Marker, Circle, ZoomControl, useMap } from 'react-leaflet';
import L from 'leaflet';
import {
  UserX,
  PlusCircle,
  Layers,
  X,
  Navigation,
  Check,
  HelpCircle,
  CheckCircle2,
  Clock,
  Sparkles,
} from 'lucide-react';

function ChangeView({ center, zoom }: { center: [number, number]; zoom: number }) {
  const map = useMap();
  useEffect(() => {
    map.setView(center, zoom);
  }, [center, zoom, map]);
  return null;
}

export interface GisParcel {
  id: string;
  projectParcelCode: string;
  officialCadastralCode: string;
  houseNumber: string;
  street: string;
  ownerName?: string;
  surveyStatus: 'NOT_SURVEYED' | 'IN_PROGRESS' | 'SUBMITTED' | 'APPROVED' | 'REJECTED' | 'POSTPONED_ABSENT';
  absenceAttemptCount?: number;
  coordinates: [number, number][]; // LatLng polygon
  distanceMeters?: number;
}

interface Props {
  parcels: GisParcel[];
  selectedZone: string;
  onSelectZone: (zone: string) => void;
  onSelectParcel: (parcel: GisParcel) => void;
  onStartSurvey?: (parcel: GisParcel) => void;
  onRecordAbsence?: (parcel: GisParcel) => void;
  onProposeSplit?: (parcel: GisParcel) => void;
  userGps?: { lat: number; lng: number; accuracy?: number } | null;
}

const STATIONS: { code: string; name: string; center: [number, number] }[] = [
  { code: 'ZONE_S1', name: 'Ga S1 - Bến Thành', center: [10.7715, 106.6983] },
  { code: 'ZONE_S2', name: 'Ga S2 - Tao Đàn', center: [10.7761, 106.6908] },
  { code: 'ZONE_S3', name: 'Ga S3 - Dân Chủ', center: [10.7818, 106.6811] },
  { code: 'ZONE_S4', name: 'Ga S4 - Hòa Hưng', center: [10.7845, 106.6734] },
  { code: 'ZONE_S5', name: 'Ga S5 - Lê Thị Riêng', center: [10.7876, 106.6662] },
  { code: 'ZONE_S6', name: 'Ga S6 - Phạm Văn Hai', center: [10.7912, 106.6578] },
  { code: 'ZONE_S7', name: 'Ga S7 - Bảy Hiền', center: [10.7947, 106.6515] },
  { code: 'ZONE_S8', name: 'Ga S8 - Nguyễn Hồng Đào', center: [10.7988, 106.6453] },
  { code: 'ZONE_S9', name: 'Ga S9 - Bà Quẹo', center: [10.8034, 106.6385] },
  { code: 'ZONE_S10', name: 'Ga S10 - Phạm Văn Bạch', center: [10.8123, 106.6301] },
  { code: 'ZONE_S11', name: 'Ga S11 - Tân Bình', center: [10.8245, 106.6192] },
];

export const LeafletSweepMap: React.FC<Props> = ({
  parcels,
  selectedZone,
  onSelectZone,
  onSelectParcel,
  onStartSurvey,
  onRecordAbsence,
  onProposeSplit,
  userGps,
}) => {
  const currentStation = STATIONS.find((s) => s.code === selectedZone) || STATIONS[8];
  const [activeParcel, setActiveParcel] = useState<GisParcel | null>(null);

  // Requirement 4: Map Mode Switcher (Standard / Satellite / OSM)
  const [mapMode, setMapMode] = useState<'standard' | 'satellite' | 'osm'>('standard');
  const [showLayerMenu, setShowLayerMenu] = useState<boolean>(false);

  // Requirement 6: Help modal for 4 color dots
  const [showColorLegendModal, setShowColorLegendModal] = useState<boolean>(false);

  // Absence log
  const [absenceRecordedToday, setAbsenceRecordedToday] = useState<{ [parcelId: string]: string }>(() => {
    try {
      const saved = localStorage.getItem('metro2_absence_log');
      return saved ? JSON.parse(saved) : { 'c0000000-0000-0000-0000-000000000004': '08:15' };
    } catch (_e) {
      return { 'c0000000-0000-0000-0000-000000000004': '08:15' };
    }
  });

  const getStatusColor = (status: GisParcel['surveyStatus']) => {
    switch (status) {
      case 'APPROVED':
        return '#10b981'; // Green
      case 'SUBMITTED':
      case 'IN_PROGRESS':
        return '#f59e0b'; // Amber
      case 'POSTPONED_ABSENT':
        return '#8b5cf6'; // Purple
      case 'REJECTED':
        return '#ef4444'; // Red
      case 'NOT_SURVEYED':
      default:
        return '#64748b'; // Slate
    }
  };

  const getStatusBadge = (status: GisParcel['surveyStatus']) => {
    switch (status) {
      case 'APPROVED':
        return <span className="badge badge-success">✓ Đã duyệt</span>;
      case 'SUBMITTED':
        return <span className="badge badge-warning">⏳ Chờ duyệt</span>;
      case 'IN_PROGRESS':
        return <span className="badge badge-warning">🔄 Đang làm</span>;
      case 'POSTPONED_ABSENT':
        return <span className="badge" style={{ backgroundColor: '#f3e8ff', color: '#7e22ce', border: '1px solid #d8b4fe' }}>🏠 Vắng mặt</span>;
      case 'REJECTED':
        return <span className="badge badge-danger">✕ Cần bổ sung</span>;
      case 'NOT_SURVEYED':
      default:
        return <span className="badge badge-info">Chưa bắt đầu</span>;
    }
  };

  // Requirement 1: Open Google Maps directions from user GPS to parcel
  const handleOpenGoogleMapsDirections = (parcel: GisParcel) => {
    const destLat = parcel.coordinates[0]?.[0] || currentStation.center[0];
    const destLng = parcel.coordinates[0]?.[1] || currentStation.center[1];

    let url = `https://www.google.com/maps/dir/?api=1&destination=${destLat},${destLng}&travelmode=walking`;
    if (userGps?.lat && userGps?.lng) {
      url = `https://www.google.com/maps/dir/?api=1&origin=${userGps.lat},${userGps.lng}&destination=${destLat},${destLng}&travelmode=walking`;
    }
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  const handleRecordAbsenceClick = (parcel: GisParcel) => {
    const nowTime = new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' });
    const updated = { ...absenceRecordedToday, [parcel.id]: nowTime };
    setAbsenceRecordedToday(updated);
    try {
      localStorage.setItem('metro2_absence_log', JSON.stringify(updated));
    } catch (_e) {}
    if (onRecordAbsence) {
      onRecordAbsence(parcel);
    }
  };

  const userGpsIcon = L.divIcon({
    className: 'custom-gps-pin',
    html: `
      <div style="
        position: relative;
        width: 18px;
        height: 18px;
        background: #0284c7;
        border: 3px solid #ffffff;
        border-radius: 50%;
        box-shadow: 0 0 10px rgba(2, 132, 199, 0.8);
      ">
        <div style="
          position: absolute;
          width: 32px;
          height: 32px;
          top: -10px;
          left: -10px;
          border-radius: 50%;
          background: rgba(2, 132, 199, 0.25);
          animation: pulse 1.8s infinite ease-out;
        "></div>
      </div>
    `,
    iconSize: [18, 18],
    iconAnchor: [9, 9],
  });

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* Requirement 6: Ultra-compact Top Bar on a single line */}
      <div
        style={{
          position: 'absolute',
          top: '8px',
          left: '8px',
          right: '8px',
          zIndex: 1000,
          display: 'flex',
          gap: '0.45rem',
          alignItems: 'center',
          backgroundColor: '#ffffff',
          padding: '0.4rem 0.65rem',
          borderRadius: '0.75rem',
          border: '1px solid #cbd5e1',
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.08)',
        }}
      >
        {/* Station Select Dropdown (Flex 1, no icon) */}
        <select
          value={selectedZone}
          onChange={(e) => onSelectZone(e.target.value)}
          className="form-control"
          style={{
            flex: 1,
            minWidth: 0,
            fontSize: '0.825rem',
            padding: '0.35rem 0.5rem',
            backgroundColor: '#f8fafc',
            color: '#0f172a',
            border: '1px solid #cbd5e1',
            borderRadius: '0.5rem',
            fontWeight: 600,
          }}
        >
          {STATIONS.map((s) => (
            <option key={s.code} value={s.code}>
              {s.name}
            </option>
          ))}
        </select>

        {/* Requirement 4: Map Layer Switcher Button */}
        <div style={{ position: 'relative' }}>
          <button
            type="button"
            onClick={() => setShowLayerMenu(!showLayerMenu)}
            title="Chế độ bản đồ (Đường phố / Vệ tinh / OSM)"
            style={{
              background: mapMode === 'satellite' ? '#0f172a' : '#f1f5f9',
              color: mapMode === 'satellite' ? '#ffffff' : '#0284c7',
              border: '1px solid #cbd5e1',
              borderRadius: '0.5rem',
              padding: '0.35rem 0.55rem',
              fontSize: '0.75rem',
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              gap: '0.25rem',
              cursor: 'pointer',
              whiteSpace: 'nowrap',
            }}
          >
            <Layers size={14} />
            <span>{mapMode === 'satellite' ? 'Vệ tinh' : mapMode === 'osm' ? 'OSM' : 'Phố'}</span>
          </button>

          {/* Layer switcher dropdown */}
          {showLayerMenu && (
            <div
              style={{
                position: 'absolute',
                top: 'calc(100% + 6px)',
                right: 0,
                backgroundColor: '#ffffff',
                border: '1px solid #cbd5e1',
                borderRadius: '0.65rem',
                boxShadow: '0 8px 20px rgba(0,0,0,0.15)',
                padding: '0.4rem',
                zIndex: 1050,
                display: 'flex',
                flexDirection: 'column',
                gap: '0.25rem',
                minWidth: '130px',
              }}
            >
              <button
                type="button"
                onClick={() => {
                  setMapMode('standard');
                  setShowLayerMenu(false);
                }}
                style={{
                  background: mapMode === 'standard' ? '#e0f2fe' : 'transparent',
                  color: mapMode === 'standard' ? '#0284c7' : '#0f172a',
                  border: 'none',
                  borderRadius: '0.4rem',
                  padding: '0.4rem 0.6rem',
                  fontSize: '0.775rem',
                  fontWeight: 600,
                  textAlign: 'left',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                }}
              >
                <span>🗺️ Đường phố (Carto)</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setMapMode('satellite');
                  setShowLayerMenu(false);
                }}
                style={{
                  background: mapMode === 'satellite' ? '#e0f2fe' : 'transparent',
                  color: mapMode === 'satellite' ? '#0284c7' : '#0f172a',
                  border: 'none',
                  borderRadius: '0.4rem',
                  padding: '0.4rem 0.6rem',
                  fontSize: '0.775rem',
                  fontWeight: 600,
                  textAlign: 'left',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                }}
              >
                <span>🛰️ Ảnh Vệ tinh (Esri)</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setMapMode('osm');
                  setShowLayerMenu(false);
                }}
                style={{
                  background: mapMode === 'osm' ? '#e0f2fe' : 'transparent',
                  color: mapMode === 'osm' ? '#0284c7' : '#0f172a',
                  border: 'none',
                  borderRadius: '0.4rem',
                  padding: '0.4rem 0.6rem',
                  fontSize: '0.775rem',
                  fontWeight: 600,
                  textAlign: 'left',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                }}
              >
                <span>🏙️ Bản đồ OSM</span>
              </button>
            </div>
          )}
        </div>

        {/* Requirement 6: 4 colored dots + (?) question mark button */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.3rem',
            backgroundColor: '#f8fafc',
            padding: '0.3rem 0.45rem',
            borderRadius: '9999px',
            border: '1px solid #e2e8f0',
            flexShrink: 0,
          }}
        >
          {/* 4 dots */}
          <span title="Đã duyệt" style={{ width: 9, height: 9, borderRadius: '50%', background: '#10b981', display: 'inline-block' }} />
          <span title="Đang làm" style={{ width: 9, height: 9, borderRadius: '50%', background: '#f59e0b', display: 'inline-block' }} />
          <span title="Vắng mặt" style={{ width: 9, height: 9, borderRadius: '50%', background: '#8b5cf6', display: 'inline-block' }} />
          <span title="Chưa khảo sát" style={{ width: 9, height: 9, borderRadius: '50%', background: '#64748b', display: 'inline-block' }} />

          {/* (?) Question mark button */}
          <button
            type="button"
            onClick={() => setShowColorLegendModal(true)}
            title="Xem giải thích màu sắc thửa đất"
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#0284c7',
              padding: 0,
              marginLeft: '2px',
            }}
          >
            <HelpCircle size={15} />
          </button>
        </div>
      </div>

      {/* Requirement 6: Legend Modal */}
      {showColorLegendModal && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            zIndex: 2000,
            backgroundColor: 'rgba(15, 23, 42, 0.4)',
            backdropFilter: 'blur(3px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1rem',
          }}
          onClick={() => setShowColorLegendModal(false)}
        >
          <div
            className="card"
            style={{
              backgroundColor: '#ffffff',
              borderRadius: '1rem',
              padding: '1.25rem',
              maxWidth: '320px',
              width: '100%',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2)',
              border: '1px solid #e2e8f0',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
              <h4 style={{ margin: 0, fontSize: '0.95rem', fontWeight: 800, color: '#0f172a' }}>
                Ý Nghĩa Màu Thửa Đất GIS
              </h4>
              <button
                type="button"
                onClick={() => setShowColorLegendModal(false)}
                style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer' }}
              >
                <X size={18} />
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.6rem', fontSize: '0.825rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ width: 12, height: 12, borderRadius: '50%', background: '#10b981', flexShrink: 0 }} />
                <span><strong style={{ color: '#15803d' }}>Xanh lá:</strong> Đã duyệt hoàn thành Phase 1</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ width: 12, height: 12, borderRadius: '50%', background: '#f59e0b', flexShrink: 0 }} />
                <span><strong style={{ color: '#b45309' }}>Vàng cam:</strong> Đang khảo sát / Chờ thẩm định</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ width: 12, height: 12, borderRadius: '50%', background: '#8b5cf6', flexShrink: 0 }} />
                <span><strong style={{ color: '#7e22ce' }}>Tím:</strong> Chủ nhà vắng mặt (Hẹn lại)</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ width: 12, height: 12, borderRadius: '50%', background: '#64748b', flexShrink: 0 }} />
                <span><strong style={{ color: '#475569' }}>Xám:</strong> Chưa khảo sát thực địa</span>
              </div>
            </div>

            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={() => setShowColorLegendModal(false)}
              style={{ width: '100%', marginTop: '1rem', padding: '0.45rem', fontWeight: 700 }}
            >
              Đã hiểu
            </button>
          </div>
        </div>
      )}

      {/* Leaflet Map Container (Zoom controls repositioned to bottomright) */}
      <div style={{ flex: 1, width: '100%', height: '100%', overflow: 'hidden' }}>
        <MapContainer
          center={currentStation.center}
          zoom={18}
          zoomControl={false} // Requirement 3: Disable top-left zoom control to avoid overlap
          style={{ width: '100%', height: '100%' }}
          scrollWheelZoom={true}
        >
          <ChangeView center={currentStation.center} zoom={18} />

          {/* Requirement 3: Place zoom control at bottomright */}
          <ZoomControl position="bottomright" />

          {/* Requirement 4: Tile layer switches dynamically */}
          {mapMode === 'satellite' ? (
            <TileLayer
              attribution='Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community'
              url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
              maxZoom={19}
            />
          ) : mapMode === 'osm' ? (
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
              maxZoom={19}
            />
          ) : (
            <TileLayer
              attribution='&copy; <a href="https://carto.com/">CARTO</a>'
              url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
              maxZoom={20}
            />
          )}

          {/* 500m Ga Geofence Circle */}
          <Circle
            center={currentStation.center}
            radius={500}
            pathOptions={{
              color: '#0284c7',
              fillColor: '#0284c7',
              fillOpacity: 0.04,
              dashArray: '6, 6',
              weight: 1.5,
            }}
          />

          {userGps && (
            <Marker position={[userGps.lat, userGps.lng]} icon={userGpsIcon} />
          )}

          {/* Polygons - Requirement 5: NO popup attached to polygon, ONLY bottom card */}
          {parcels.map((parcel) => {
            const isSelected = activeParcel?.id === parcel.id;
            const color = getStatusColor(parcel.surveyStatus);

            return (
              <Polygon
                key={parcel.id}
                positions={parcel.coordinates}
                pathOptions={{
                  color: isSelected ? '#0284c7' : color,
                  fillColor: color,
                  fillOpacity: isSelected ? 0.8 : 0.45,
                  weight: isSelected ? 3.5 : 1.5,
                }}
                eventHandlers={{
                  click: () => {
                    setActiveParcel(parcel);
                    onSelectParcel(parcel);
                  },
                }}
              />
            );
          })}
        </MapContainer>
      </div>

      {/* Requirement 5: Selected Parcel Bottom Drawer MATCHING SurveyorHomeView card design */}
      {activeParcel && (
        <div
          style={{
            position: 'absolute',
            bottom: '12px',
            left: '12px',
            right: '12px',
            zIndex: 1000,
            backgroundColor: '#ffffff',
            borderRadius: '1rem',
            border: '1px solid #cbd5e1',
            boxShadow: '0 12px 28px -5px rgba(0, 0, 0, 0.2)',
            padding: '1rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.65rem',
            animation: 'slideUp 0.2s ease-out',
          }}
        >
          {/* Header Row */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '1.15rem', fontWeight: 800, color: '#0284c7' }}>
                {activeParcel.projectParcelCode}
              </span>
              {getStatusBadge(activeParcel.surveyStatus)}
              {activeParcel.absenceAttemptCount ? (
                <span className="badge badge-danger">Vắng {activeParcel.absenceAttemptCount} lần</span>
              ) : null}
            </div>

            <button
              onClick={() => setActiveParcel(null)}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#94a3b8',
                cursor: 'pointer',
                padding: '0.2rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <X size={20} />
            </button>
          </div>

          {/* Address & Cadastral info */}
          <div>
            <div style={{ fontSize: '0.95rem', color: '#0f172a', fontWeight: 700 }}>
              Số {activeParcel.houseNumber} {activeParcel.street}
            </div>
            <div style={{ fontSize: '0.775rem', color: '#64748b', marginTop: '2px' }}>
              Mã ĐC: <strong style={{ color: '#334155' }}>{activeParcel.officialCadastralCode}</strong> • Chủ hộ: {activeParcel.ownerName || 'Chưa cập nhật'}
            </div>
          </div>

          {/* Absence announcement banner if recorded today */}
          {absenceRecordedToday[activeParcel.id] && (
            <div
              style={{
                backgroundColor: '#faf5ff',
                border: '1px solid #e9d5ff',
                borderRadius: '0.5rem',
                padding: '0.45rem 0.65rem',
                fontSize: '0.775rem',
                color: '#7e22ce',
                display: 'flex',
                alignItems: 'center',
                gap: '0.4rem',
                fontWeight: 600,
              }}
            >
              <Clock size={13} color="#9333ea" />
              <span>Đã khai báo vắng mặt hôm nay lúc {absenceRecordedToday[activeParcel.id]} (Đã dán giấy hẹn)</span>
            </div>
          )}

          {/* Action buttons matching Main Menu */}
          <div style={{ display: 'flex', gap: '0.45rem', flexWrap: 'wrap', marginTop: '0.25rem' }}>
            {/* Survey Button (Phase 1 or Phase 2) */}
            {activeParcel.surveyStatus === 'APPROVED' ? (
              <button
                type="button"
                className="btn btn-sm"
                onClick={() => onStartSurvey && onStartSurvey(activeParcel)}
                style={{
                  flex: 1,
                  minWidth: '130px',
                  backgroundColor: '#059669',
                  color: '#ffffff',
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.35rem',
                  padding: '0.5rem',
                }}
              >
                <Sparkles size={14} />
                Khảo sát Phase 2
              </button>
            ) : (
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={() => onStartSurvey && onStartSurvey(activeParcel)}
                style={{
                  flex: 1,
                  minWidth: '130px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.35rem',
                  padding: '0.5rem',
                  fontWeight: 700,
                }}
              >
                <PlusCircle size={14} />
                Khảo sát Phase 1
              </button>
            )}

            {/* Requirement 1: Chỉ đường button linking to Google Maps */}
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => handleOpenGoogleMapsDirections(activeParcel)}
              style={{
                fontSize: '0.775rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.3rem',
                color: '#0284c7',
                borderColor: '#bae6fd',
                backgroundColor: '#f0f9ff',
                padding: '0.5rem 0.75rem',
                fontWeight: 600,
              }}
              title="Mở chỉ đường Google Maps từ vị trí của bạn"
            >
              <Navigation size={14} color="#0284c7" />
              Chỉ đường
            </button>

            {/* Absence Button */}
            {activeParcel.surveyStatus !== 'APPROVED' && (
              <button
                type="button"
                className="btn btn-sm"
                disabled={!!absenceRecordedToday[activeParcel.id]}
                onClick={() => handleRecordAbsenceClick(activeParcel)}
                style={{
                  fontSize: '0.775rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.3rem',
                  backgroundColor: absenceRecordedToday[activeParcel.id] ? '#f1f5f9' : '#fffbeb',
                  color: absenceRecordedToday[activeParcel.id] ? '#94a3b8' : '#b45309',
                  borderColor: absenceRecordedToday[activeParcel.id] ? '#e2e8f0' : '#fde68a',
                  cursor: absenceRecordedToday[activeParcel.id] ? 'not-allowed' : 'pointer',
                  padding: '0.5rem 0.75rem',
                  fontWeight: 600,
                }}
              >
                {absenceRecordedToday[activeParcel.id] ? (
                  <>
                    <Check size={13} color="#10b981" />
                    Đã báo vắng
                  </>
                ) : (
                  <>
                    <UserX size={13} />
                    Báo vắng mặt
                  </>
                )}
              </button>
            )}

            {/* Split parcel button */}
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => onProposeSplit && onProposeSplit(activeParcel)}
              style={{ display: 'flex', alignItems: 'center', gap: '0.3rem', padding: '0.5rem 0.75rem' }}
            >
              <Layers size={13} />
              Tách thửa
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
