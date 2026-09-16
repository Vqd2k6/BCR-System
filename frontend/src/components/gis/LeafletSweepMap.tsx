import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Polygon, Marker, Popup, Circle, useMap } from 'react-leaflet';
import L from 'leaflet';
import { MapPin, UserX, PlusCircle, Layers, X } from 'lucide-react';

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
        return <span className="badge badge-warning">🔄 Đang khảo sát</span>;
      case 'POSTPONED_ABSENT':
        return <span className="badge" style={{ backgroundColor: '#f3e8ff', color: '#7e22ce' }}>🏠 Vắng mặt</span>;
      case 'REJECTED':
        return <span className="badge badge-danger">✕ Cần bổ sung</span>;
      case 'NOT_SURVEYED':
      default:
        return <span className="badge badge-info">Chưa khảo sát</span>;
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
    <div style={{ position: 'relative', width: '100%', height: '100%', minHeight: '520px', display: 'flex', flexDirection: 'column' }}>
      {/* Top Station Selector & Stats Bar */}
      <div
        style={{
          position: 'absolute',
          top: '12px',
          left: '12px',
          right: '12px',
          zIndex: 1000,
          display: 'flex',
          gap: '0.5rem',
          flexWrap: 'wrap',
          alignItems: 'center',
          backgroundColor: '#ffffff',
          padding: '0.65rem 0.85rem',
          borderRadius: '0.75rem',
          border: '1px solid #cbd5e1',
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.08)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
          <MapPin size={16} color="#0284c7" />
          <span style={{ fontSize: '0.85rem', fontWeight: 700, color: '#0f172a' }}>Ga Metro:</span>
        </div>

        <select
          value={selectedZone}
          onChange={(e) => onSelectZone(e.target.value)}
          className="form-control"
          style={{
            flex: 1,
            minWidth: '170px',
            fontSize: '0.85rem',
            padding: '0.35rem 0.6rem',
            backgroundColor: '#f8fafc',
            color: '#0f172a',
            border: '1px solid #cbd5e1',
          }}
        >
          {STATIONS.map((s) => (
            <option key={s.code} value={s.code}>
              {s.name}
            </option>
          ))}
        </select>

        {/* Legend pills */}
        <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap', fontSize: '0.75rem' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: '3px', color: '#15803d', fontWeight: 600 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#10b981' }} />
            Đã duyệt
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: '3px', color: '#b45309', fontWeight: 600 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#f59e0b' }} />
            Đang làm
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: '3px', color: '#7e22ce', fontWeight: 600 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#8b5cf6' }} />
            Vắng mặt
          </span>
          <span style={{ display: 'flex', alignItems: 'center', gap: '3px', color: '#64748b', fontWeight: 600 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#64748b' }} />
            Chưa KS
          </span>
        </div>
      </div>

      {/* Leaflet Map Container */}
      <div style={{ flex: 1, minHeight: '520px', borderRadius: '0.75rem', overflow: 'hidden', border: '1px solid #cbd5e1' }}>
        <MapContainer
          center={currentStation.center}
          zoom={18}
          style={{ width: '100%', height: '100%' }}
          scrollWheelZoom={true}
        >
          <ChangeView center={currentStation.center} zoom={18} />

          <TileLayer
            attribution='&copy; <a href="https://carto.com/">CARTO</a>'
            url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
          />

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
            <>
              <Marker position={[userGps.lat, userGps.lng]} icon={userGpsIcon}>
                <Popup>
                  <div style={{ color: '#0f172a', fontWeight: 600 }}>
                    Vị trí hiện tại của bạn
                    {userGps.accuracy && <div style={{ fontSize: '0.75rem', color: '#64748b' }}>Độ chính xác: ±{Math.round(userGps.accuracy)}m</div>}
                  </div>
                </Popup>
              </Marker>
            </>
          )}

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
                  fillOpacity: isSelected ? 0.75 : 0.45,
                  weight: isSelected ? 3 : 1.5,
                }}
                eventHandlers={{
                  click: () => {
                    setActiveParcel(parcel);
                    onSelectParcel(parcel);
                  },
                }}
              >
                <Popup>
                  <div style={{ color: '#0f172a' }}>
                    <div style={{ fontWeight: 800, fontSize: '0.9rem', color: '#0284c7' }}>
                      {parcel.projectParcelCode}
                    </div>
                    <div style={{ fontSize: '0.8rem', fontWeight: 600 }}>
                      Số {parcel.houseNumber} {parcel.street}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '2px' }}>
                      Mã ĐC: {parcel.officialCadastralCode}
                    </div>
                    <div style={{ marginTop: '4px' }}>{getStatusBadge(parcel.surveyStatus)}</div>
                  </div>
                </Popup>
              </Polygon>
            );
          })}
        </MapContainer>
      </div>

      {/* Selected Parcel Bottom Drawer */}
      {activeParcel && (
        <div
          style={{
            position: 'absolute',
            bottom: '16px',
            left: '16px',
            right: '16px',
            zIndex: 1000,
            backgroundColor: '#ffffff',
            borderRadius: '1rem',
            border: '1px solid #cbd5e1',
            boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.15)',
            padding: '1rem',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.75rem' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ fontSize: '1.1rem', fontWeight: 800, color: '#0284c7' }}>
                  {activeParcel.projectParcelCode}
                </span>
                {getStatusBadge(activeParcel.surveyStatus)}
                {activeParcel.absenceAttemptCount ? (
                  <span className="badge badge-danger">Vắng {activeParcel.absenceAttemptCount} lần</span>
                ) : null}
              </div>
              <div style={{ fontSize: '0.925rem', color: '#0f172a', marginTop: '2px', fontWeight: 600 }}>
                Số {activeParcel.houseNumber} {activeParcel.street}
              </div>
              <div style={{ fontSize: '0.775rem', color: '#64748b' }}>
                Mã địa chính: <strong style={{ color: '#334155' }}>{activeParcel.officialCadastralCode}</strong> • Chủ hộ: {activeParcel.ownerName || 'Chưa cập nhật'}
              </div>
            </div>

            <button
              onClick={() => setActiveParcel(null)}
              style={{
                background: 'transparent',
                border: 'none',
                color: '#94a3b8',
                fontSize: '1.2rem',
                cursor: 'pointer',
              }}
            >
              <X size={20} />
            </button>
          </div>

          <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={() => onStartSurvey && onStartSurvey(activeParcel)}
              style={{ flex: 1, minWidth: '140px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.35rem' }}
            >
              <PlusCircle size={14} />
              Khảo sát Phase 1
            </button>

            <button
              type="button"
              className="btn btn-warning btn-sm"
              onClick={() => onRecordAbsence && onRecordAbsence(activeParcel)}
              style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}
            >
              <UserX size={14} />
              Báo vắng mặt
            </button>

            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => onProposeSplit && onProposeSplit(activeParcel)}
              style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}
            >
              <Layers size={14} />
              Tách thửa
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
