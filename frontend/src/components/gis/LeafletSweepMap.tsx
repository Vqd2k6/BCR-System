import React, { useState, useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Polygon, Marker, Circle, ZoomControl, useMap } from 'react-leaflet';
import L from 'leaflet';
import {
  UserX,
  Layers,
  X,
  Navigation,
  Check,
  Menu,
  Clock,
  Sparkles,
  Search,
  CheckCircle2,
  PlusCircle,
  MapPin,
  Filter,
} from 'lucide-react';

function ChangeView({ center, zoom }: { center: [number, number]; zoom: number }) {
  const map = useMap();
  useEffect(() => {
    map.setView(center, zoom);
  }, [center, zoom, map]);
  return null;
}

function FlyToController({ targetCoords }: { targetCoords: [number, number] | null }) {
  const map = useMap();
  useEffect(() => {
    if (targetCoords) {
      map.flyTo(targetCoords, 19, { animate: true, duration: 0.8 });
    }
  }, [targetCoords, map]);
  return null;
}

export interface GisParcel {
  id: string;
  projectParcelCode: string;
  officialCadastralCode: string;
  houseNumber: string;
  street: string;
  ownerName?: string;
  surveyStatus:
    | 'NOT_SURVEYED'
    | 'IN_PROGRESS'
    | 'SUBMITTED'
    | 'APPROVED'
    | 'REJECTED'
    | 'POSTPONED_ABSENT'
    | 'PHASE2_COMPLETED'
    | 'APPROVED_PHASE2';
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
  userGps,
}) => {
  const currentStation = STATIONS.find((s) => s.code === selectedZone) || STATIONS[8];
  const [activeParcel, setActiveParcel] = useState<GisParcel | null>(null);

  // Search Parcel state
  const [isSearchOpen, setIsSearchOpen] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [targetFlyCoords, setTargetFlyCoords] = useState<[number, number] | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Map Mode Switcher (Standard Esri Streets / Satellite / OSM)
  const [mapMode, setMapMode] = useState<'standard' | 'satellite' | 'osm'>('standard');
  const [showLayerMenu, setShowLayerMenu] = useState<boolean>(false);

  // 3-Bar Filter & Legend Drawer/Modal state
  const [showFilterModal, setShowFilterModal] = useState<boolean>(false);
  const [appliedFilters, setAppliedFilters] = useState<{
    APPROVED: boolean;
    PHASE2_COMPLETED: boolean;
    IN_PROGRESS: boolean;
    POSTPONED_ABSENT: boolean;
    NOT_SURVEYED: boolean;
  }>({
    APPROVED: true,
    PHASE2_COMPLETED: true,
    IN_PROGRESS: true,
    POSTPONED_ABSENT: true,
    NOT_SURVEYED: true,
  });

  // Draft filters while modal is open
  const [draftFilters, setDraftFilters] = useState(appliedFilters);

  // Sync draft filters when modal opens
  useEffect(() => {
    if (showFilterModal) {
      setDraftFilters(appliedFilters);
    }
  }, [showFilterModal, appliedFilters]);

  // Absence log loaded from localStorage
  const [absenceRecordedToday, setAbsenceRecordedToday] = useState<{ [parcelId: string]: string }>(() => {
    try {
      const saved = localStorage.getItem('metro2_absence_log');
      return saved ? JSON.parse(saved) : { 'c0000000-0000-0000-0000-000000000004': '08:15' };
    } catch (_e) {
      return { 'c0000000-0000-0000-0000-000000000004': '08:15' };
    }
  });

  // Calculate polygon center for smooth map flyTo
  const getParcelCenter = (parcel: GisParcel): [number, number] => {
    if (!parcel.coordinates || parcel.coordinates.length === 0) return currentStation.center;
    const lats = parcel.coordinates.map((c) => c[0]);
    const lngs = parcel.coordinates.map((c) => c[1]);
    const avgLat = lats.reduce((a, b) => a + b, 0) / lats.length;
    const avgLng = lngs.reduce((a, b) => a + b, 0) / lngs.length;
    return [avgLat, avgLng];
  };

  // Focus input when search opens
  useEffect(() => {
    if (isSearchOpen && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [isSearchOpen]);

  // Filtered parcels based on applied checklist
  const displayedParcels = (parcels || []).filter((parcel) => {
    const status = parcel.surveyStatus || (parcel as any).survey_status || 'NOT_SURVEYED';
    if (status === 'APPROVED') return appliedFilters.APPROVED;
    if (status === 'PHASE2_COMPLETED' || status === 'APPROVED_PHASE2') return appliedFilters.PHASE2_COMPLETED;
    if (status === 'IN_PROGRESS' || status === 'SUBMITTED' || status === 'REJECTED') return appliedFilters.IN_PROGRESS;
    if (status === 'POSTPONED_ABSENT') return appliedFilters.POSTPONED_ABSENT;
    if (status === 'NOT_SURVEYED') return appliedFilters.NOT_SURVEYED;
    return true;
  });

  // Filter suggestions based on searchQuery & displayed parcels
  const searchSuggestions = (displayedParcels || []).filter((p) => {
    if (!searchQuery.trim()) return false;
    const query = searchQuery.toLowerCase().trim();
    const code = String(p.projectParcelCode || (p as any).project_parcel_code || '').toLowerCase();
    const cadastral = String(p.officialCadastralCode || (p as any).official_cadastral_code || '').toLowerCase();
    const house = String(p.houseNumber || (p as any).house_number || '').toLowerCase();
    const street = String(p.street || '').toLowerCase();
    const owner = String(p.ownerName || (p as any).owner_name || '').toLowerCase();

    return (
      code.includes(query) ||
      cadastral.includes(query) ||
      house.includes(query) ||
      street.includes(query) ||
      owner.includes(query)
    );
  });

  const handleSelectSearchResult = (parcel: GisParcel) => {
    const center = getParcelCenter(parcel);
    setTargetFlyCoords(center);
    setActiveParcel(parcel);
    onSelectParcel(parcel);
    setIsSearchOpen(false);
    setSearchQuery('');
  };

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      if (searchSuggestions.length > 0) {
        handleSelectSearchResult(searchSuggestions[0]);
      }
    } else if (e.key === 'Escape') {
      setIsSearchOpen(false);
    }
  };

  // 5-color GIS scheme
  const getStatusColor = (status: GisParcel['surveyStatus']) => {
    switch (status) {
      case 'APPROVED':
        return '#10b981'; // Green: Phase 1 Approved (Ready for Phase 2)
      case 'PHASE2_COMPLETED':
      case 'APPROVED_PHASE2':
        return '#2563eb'; // Blue: Phase 2 Completed (Prior to construction)
      case 'SUBMITTED':
      case 'IN_PROGRESS':
        return '#f59e0b'; // Amber: In progress / Pending review
      case 'POSTPONED_ABSENT':
        return '#8b5cf6'; // Purple: Absent (Postponed)
      case 'REJECTED':
        return '#ef4444'; // Red: Rejected (Need remeasurement)
      case 'NOT_SURVEYED':
      default:
        return '#64748b'; // Slate: Phase 1 Not surveyed
    }
  };

  const getStatusBadge = (status: GisParcel['surveyStatus']) => {
    switch (status) {
      case 'APPROVED':
        return (
          <span
            className="badge"
            style={{ backgroundColor: '#dcfce7', color: '#15803d', border: '1px solid #86efac', fontWeight: 700 }}
          >
            ✓ Đã duyệt Phase 1
          </span>
        );
      case 'PHASE2_COMPLETED':
      case 'APPROVED_PHASE2':
        return (
          <span
            className="badge"
            style={{ backgroundColor: '#dbeafe', color: '#1d4ed8', border: '1px solid #93c5fd', fontWeight: 700 }}
          >
            ★ Hoàn tất Phase 2
          </span>
        );
      case 'SUBMITTED':
        return (
          <span
            className="badge"
            style={{ backgroundColor: '#fef3c7', color: '#b45309', border: '1px solid #fde68a', fontWeight: 700 }}
          >
            ⏳ Chờ duyệt Phase 1
          </span>
        );
      case 'IN_PROGRESS':
        return (
          <span
            className="badge"
            style={{ backgroundColor: '#fffbeb', color: '#b45309', border: '1px solid #fde68a', fontWeight: 700 }}
          >
            🔄 Đang làm Phase 1
          </span>
        );
      case 'POSTPONED_ABSENT':
        return (
          <span
            className="badge"
            style={{ backgroundColor: '#f3e8ff', color: '#7e22ce', border: '1px solid #d8b4fe', fontWeight: 700 }}
          >
            🏠 Vắng mặt
          </span>
        );
      case 'REJECTED':
        return (
          <span
            className="badge"
            style={{ backgroundColor: '#fee2e2', color: '#b91c1c', border: '1px solid #fca5a5', fontWeight: 700 }}
          >
            ✕ Cần bổ sung
          </span>
        );
      case 'NOT_SURVEYED':
      default:
        return (
          <span
            className="badge"
            style={{ backgroundColor: '#f1f5f9', color: '#475569', border: '1px solid #cbd5e1', fontWeight: 600 }}
          >
            Chưa làm Phase 1
          </span>
        );
    }
  };

  // Open Google Maps directions from user GPS to parcel
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

  // Quick Preset Filters
  const setAllFilters = (enable: boolean) => {
    setDraftFilters({
      APPROVED: enable,
      PHASE2_COMPLETED: enable,
      IN_PROGRESS: enable,
      POSTPONED_ABSENT: enable,
      NOT_SURVEYED: enable,
    });
  };

  const setPhase1Only = () => {
    setDraftFilters({
      APPROVED: false,
      PHASE2_COMPLETED: false,
      IN_PROGRESS: true,
      POSTPONED_ABSENT: true,
      NOT_SURVEYED: true,
    });
  };

  const setPhase2Only = () => {
    setDraftFilters({
      APPROVED: true,
      PHASE2_COMPLETED: true,
      IN_PROGRESS: false,
      POSTPONED_ABSENT: false,
      NOT_SURVEYED: false,
    });
  };

  const isCustomFilterActive =
    !appliedFilters.APPROVED ||
    !appliedFilters.PHASE2_COMPLETED ||
    !appliedFilters.IN_PROGRESS ||
    !appliedFilters.POSTPONED_ABSENT ||
    !appliedFilters.NOT_SURVEYED;

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
      {/* Top Bar with 3-Bar Menu Icon & Search */}
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
        {/* Station Select Dropdown */}
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

        {/* Map Layer Switcher Button */}
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
                minWidth: '135px',
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
                <span>🗺️ Đường phố</span>
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
                <span>🛰️ Ảnh Vệ tinh</span>
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

        {/* Search Parcel Button */}
        <button
          type="button"
          onClick={() => setIsSearchOpen(!isSearchOpen)}
          title="Tìm kiếm thửa đất theo số nhà, mã, chủ hộ"
          style={{
            width: '32px',
            height: '32px',
            borderRadius: '0.5rem',
            backgroundColor: isSearchOpen ? '#0284c7' : '#f1f5f9',
            border: isSearchOpen ? '1px solid #0284c7' : '1px solid #cbd5e1',
            color: isSearchOpen ? '#ffffff' : '#0284c7',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            flexShrink: 0,
            transition: 'all 0.15s ease',
          }}
        >
          <Search size={16} />
        </button>

        {/* 3-Bar Menu Icon Button (Replaces ? icon) */}
        <button
          type="button"
          onClick={() => setShowFilterModal(true)}
          title="Bộ lọc hiển thị Phase & Chú thích màu sắc"
          style={{
            position: 'relative',
            width: '32px',
            height: '32px',
            borderRadius: '0.5rem',
            backgroundColor: isCustomFilterActive ? '#e0f2fe' : '#f8fafc',
            border: isCustomFilterActive ? '1.5px solid #0284c7' : '1px solid #cbd5e1',
            color: isCustomFilterActive ? '#0284c7' : '#334155',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            flexShrink: 0,
            transition: 'all 0.15s ease',
          }}
        >
          <Menu size={18} />
          {isCustomFilterActive && (
            <span
              style={{
                position: 'absolute',
                top: '-2px',
                right: '-2px',
                width: '8px',
                height: '8px',
                borderRadius: '50%',
                backgroundColor: '#0284c7',
                border: '1.5px solid #ffffff',
              }}
            />
          )}
        </button>
      </div>

      {/* Expandable Search Overlay with Auto Suggestions */}
      {isSearchOpen && (
        <div
          style={{
            position: 'absolute',
            top: '56px',
            left: '8px',
            right: '8px',
            zIndex: 1100,
            display: 'flex',
            flexDirection: 'column',
            gap: '0.35rem',
            animation: 'fadeIn 0.15s ease-out',
          }}
        >
          <div
            style={{
              position: 'relative',
              display: 'flex',
              alignItems: 'center',
              backgroundColor: '#ffffff',
              borderRadius: '0.75rem',
              border: '2px solid #0284c7',
              boxShadow: '0 8px 24px rgba(0, 0, 0, 0.16)',
              overflow: 'hidden',
            }}
          >
            <Search size={16} color="#0284c7" style={{ marginLeft: '12px', flexShrink: 0 }} />
            <input
              ref={searchInputRef}
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={handleSearchKeyDown}
              placeholder="Nhập số nhà, tên đường, mã B-xxx, chủ hộ..."
              style={{
                width: '100%',
                padding: '0.65rem 0.6rem',
                fontSize: '0.85rem',
                border: 'none',
                outline: 'none',
                color: '#0f172a',
                backgroundColor: 'transparent',
              }}
            />
            {searchQuery ? (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                style={{
                  background: 'transparent',
                  border: 'none',
                  padding: '0.5rem',
                  color: '#94a3b8',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                }}
              >
                <X size={16} />
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => setIsSearchOpen(false)}
              style={{
                backgroundColor: '#f1f5f9',
                border: 'none',
                borderLeft: '1px solid #e2e8f0',
                padding: '0.65rem 0.85rem',
                fontSize: '0.775rem',
                color: '#475569',
                cursor: 'pointer',
                fontWeight: 600,
              }}
            >
              Đóng
            </button>
          </div>

          {searchQuery.trim() && (
            <div
              style={{
                backgroundColor: '#ffffff',
                borderRadius: '0.75rem',
                border: '1px solid #cbd5e1',
                boxShadow: '0 12px 28px rgba(0, 0, 0, 0.18)',
                maxHeight: '260px',
                overflowY: 'auto',
                display: 'flex',
                flexDirection: 'column',
              }}
            >
              {searchSuggestions.length === 0 ? (
                <div style={{ padding: '0.85rem 1rem', fontSize: '0.8rem', color: '#64748b', textAlign: 'center' }}>
                  Không tìm thấy thửa đất nào phù hợp với &quot;<strong>{searchQuery}</strong>&quot;
                </div>
              ) : (
                searchSuggestions.map((parcel) => (
                  <div
                    key={parcel.id}
                    onClick={() => handleSelectSearchResult(parcel)}
                    style={{
                      padding: '0.65rem 0.85rem',
                      borderBottom: '1px solid #f1f5f9',
                      cursor: 'pointer',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      transition: 'background 0.1s ease',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#f0f9ff')}
                    onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#ffffff')}
                  >
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                        <span style={{ fontSize: '0.9rem', fontWeight: 800, color: '#0284c7' }}>
                          {parcel.projectParcelCode}
                        </span>
                        {getStatusBadge(parcel.surveyStatus)}
                      </div>
                      <div style={{ fontSize: '0.8rem', color: '#0f172a', fontWeight: 600, marginTop: '2px' }}>
                        Số {parcel.houseNumber} {parcel.street}
                      </div>
                      <div style={{ fontSize: '0.725rem', color: '#64748b' }}>
                        Mã ĐC: {parcel.officialCadastralCode} • Chủ hộ: {parcel.ownerName || 'Chưa cập nhật'}
                      </div>
                    </div>
                    <MapPin size={16} color="#0284c7" style={{ flexShrink: 0, marginLeft: '0.5rem' }} />
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      )}

      {/* 3-Bar Filter & Legend Drawer/Modal */}
      {showFilterModal && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            zIndex: 2000,
            backgroundColor: 'rgba(15, 23, 42, 0.45)',
            backdropFilter: 'blur(3px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1rem',
          }}
          onClick={() => setShowFilterModal(false)}
        >
          <div
            className="card"
            style={{
              backgroundColor: '#ffffff',
              borderRadius: '1rem',
              padding: '1.25rem',
              maxWidth: '360px',
              width: '100%',
              maxHeight: '88vh',
              overflowY: 'auto',
              boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.2)',
              border: '1px solid #e2e8f0',
              display: 'flex',
              flexDirection: 'column',
              gap: '0.85rem',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                <Filter size={18} color="#0284c7" />
                <h4 style={{ margin: 0, fontSize: '0.975rem', fontWeight: 800, color: '#0f172a' }}>
                  Bộ Lọc Hiển Thị Thửa Đất
                </h4>
              </div>
              <button
                type="button"
                onClick={() => setShowFilterModal(false)}
                style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer' }}
              >
                <X size={18} />
              </button>
            </div>

            {/* Quick Preset Buttons */}
            <div style={{ display: 'flex', gap: '0.35rem' }}>
              <button
                type="button"
                onClick={() => setAllFilters(true)}
                style={{
                  flex: 1,
                  fontSize: '0.725rem',
                  padding: '0.35rem 0.45rem',
                  borderRadius: '0.45rem',
                  border: '1px solid #cbd5e1',
                  background: '#f8fafc',
                  fontWeight: 600,
                  cursor: 'pointer',
                  color: '#334155',
                }}
              >
                Tất cả ({parcels.length})
              </button>
              <button
                type="button"
                onClick={setPhase1Only}
                style={{
                  flex: 1,
                  fontSize: '0.725rem',
                  padding: '0.35rem 0.45rem',
                  borderRadius: '0.45rem',
                  border: '1px solid #cbd5e1',
                  background: '#fffbeb',
                  fontWeight: 600,
                  cursor: 'pointer',
                  color: '#b45309',
                }}
              >
                Chỉ Phase 1
              </button>
              <button
                type="button"
                onClick={setPhase2Only}
                style={{
                  flex: 1,
                  fontSize: '0.725rem',
                  padding: '0.35rem 0.45rem',
                  borderRadius: '0.45rem',
                  border: '1px solid #cbd5e1',
                  background: '#f0fdf4',
                  fontWeight: 600,
                  cursor: 'pointer',
                  color: '#15803d',
                }}
              >
                Chỉ Phase 2
              </button>
            </div>

            {/* Checklist Options */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.55rem',
                  fontSize: '0.825rem',
                  cursor: 'pointer',
                  padding: '0.35rem 0.45rem',
                  borderRadius: '0.45rem',
                  backgroundColor: draftFilters.APPROVED ? '#f0fdf4' : '#ffffff',
                }}
              >
                <input
                  type="checkbox"
                  checked={draftFilters.APPROVED}
                  onChange={(e) => setDraftFilters({ ...draftFilters, APPROVED: e.target.checked })}
                  style={{ width: '16px', height: '16px', accentColor: '#10b981', cursor: 'pointer' }}
                />
                <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#10b981', flexShrink: 0 }} />
                <span style={{ fontWeight: 600, color: '#15803d' }}>Đã duyệt Phase 1 (Chờ làm Phase 2)</span>
              </label>

              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.55rem',
                  fontSize: '0.825rem',
                  cursor: 'pointer',
                  padding: '0.35rem 0.45rem',
                  borderRadius: '0.45rem',
                  backgroundColor: draftFilters.PHASE2_COMPLETED ? '#eff6ff' : '#ffffff',
                }}
              >
                <input
                  type="checkbox"
                  checked={draftFilters.PHASE2_COMPLETED}
                  onChange={(e) => setDraftFilters({ ...draftFilters, PHASE2_COMPLETED: e.target.checked })}
                  style={{ width: '16px', height: '16px', accentColor: '#2563eb', cursor: 'pointer' }}
                />
                <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#2563eb', flexShrink: 0 }} />
                <span style={{ fontWeight: 600, color: '#1d4ed8' }}>Đã hoàn tất Phase 2 (Trước thi công)</span>
              </label>

              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.55rem',
                  fontSize: '0.825rem',
                  cursor: 'pointer',
                  padding: '0.35rem 0.45rem',
                  borderRadius: '0.45rem',
                  backgroundColor: draftFilters.IN_PROGRESS ? '#fffbeb' : '#ffffff',
                }}
              >
                <input
                  type="checkbox"
                  checked={draftFilters.IN_PROGRESS}
                  onChange={(e) => setDraftFilters({ ...draftFilters, IN_PROGRESS: e.target.checked })}
                  style={{ width: '16px', height: '16px', accentColor: '#f59e0b', cursor: 'pointer' }}
                />
                <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#f59e0b', flexShrink: 0 }} />
                <span style={{ fontWeight: 600, color: '#b45309' }}>Đang khảo sát / Chờ duyệt Phase 1</span>
              </label>

              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.55rem',
                  fontSize: '0.825rem',
                  cursor: 'pointer',
                  padding: '0.35rem 0.45rem',
                  borderRadius: '0.45rem',
                  backgroundColor: draftFilters.POSTPONED_ABSENT ? '#faf5ff' : '#ffffff',
                }}
              >
                <input
                  type="checkbox"
                  checked={draftFilters.POSTPONED_ABSENT}
                  onChange={(e) => setDraftFilters({ ...draftFilters, POSTPONED_ABSENT: e.target.checked })}
                  style={{ width: '16px', height: '16px', accentColor: '#8b5cf6', cursor: 'pointer' }}
                />
                <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#8b5cf6', flexShrink: 0 }} />
                <span style={{ fontWeight: 600, color: '#7e22ce' }}>Chủ nhà vắng mặt (Đã dán giấy hẹn)</span>
              </label>

              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.55rem',
                  fontSize: '0.825rem',
                  cursor: 'pointer',
                  padding: '0.35rem 0.45rem',
                  borderRadius: '0.45rem',
                  backgroundColor: draftFilters.NOT_SURVEYED ? '#f8fafc' : '#ffffff',
                }}
              >
                <input
                  type="checkbox"
                  checked={draftFilters.NOT_SURVEYED}
                  onChange={(e) => setDraftFilters({ ...draftFilters, NOT_SURVEYED: e.target.checked })}
                  style={{ width: '16px', height: '16px', accentColor: '#64748b', cursor: 'pointer' }}
                />
                <span style={{ width: 10, height: 10, borderRadius: '50%', background: '#64748b', flexShrink: 0 }} />
                <span style={{ fontWeight: 600, color: '#475569' }}>Chưa khảo sát Phase 1</span>
              </label>
            </div>

            {/* Confirm Filter Button */}
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={() => {
                setAppliedFilters(draftFilters);
                setShowFilterModal(false);
              }}
              style={{
                width: '100%',
                padding: '0.55rem',
                fontWeight: 700,
                fontSize: '0.85rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '0.4rem',
                boxShadow: '0 4px 10px rgba(2, 132, 199, 0.25)',
              }}
            >
              <Check size={16} />
              Xác Nhận Áp Dụng Bộ Lọc
            </button>

            {/* Bottom Color Legend Description */}
            <div
              style={{
                borderTop: '1px solid #e2e8f0',
                paddingTop: '0.65rem',
                display: 'flex',
                flexDirection: 'column',
                gap: '0.4rem',
                fontSize: '0.75rem',
                backgroundColor: '#f8fafc',
                padding: '0.6rem 0.75rem',
                borderRadius: '0.5rem',
              }}
            >
              <div style={{ fontWeight: 700, color: '#334155', marginBottom: '2px' }}>
                📖 Chú thích màu sắc hiển thị trên Map:
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <span style={{ width: 9, height: 9, borderRadius: '50%', background: '#10b981', flexShrink: 0 }} />
                <span>
                  <strong style={{ color: '#15803d' }}>Xanh lá:</strong> Đã duyệt Phase 1 (Chờ Phase 2)
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <span style={{ width: 9, height: 9, borderRadius: '50%', background: '#2563eb', flexShrink: 0 }} />
                <span>
                  <strong style={{ color: '#1d4ed8' }}>Xanh dương:</strong> Đã hoàn tất Phase 2
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <span style={{ width: 9, height: 9, borderRadius: '50%', background: '#f59e0b', flexShrink: 0 }} />
                <span>
                  <strong style={{ color: '#b45309' }}>Vàng cam:</strong> Đang làm / Chờ duyệt Phase 1
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <span style={{ width: 9, height: 9, borderRadius: '50%', background: '#8b5cf6', flexShrink: 0 }} />
                <span>
                  <strong style={{ color: '#7e22ce' }}>Tím:</strong> Vắng mặt (Đã dán giấy hẹn)
                </span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                <span style={{ width: 9, height: 9, borderRadius: '50%', background: '#64748b', flexShrink: 0 }} />
                <span>
                  <strong style={{ color: '#475569' }}>Xám tro:</strong> Chưa khảo sát Phase 1
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Leaflet Map Container */}
      <div style={{ flex: 1, width: '100%', height: '100%', overflow: 'hidden' }}>
        <MapContainer
          center={currentStation.center}
          zoom={18}
          zoomControl={false}
          style={{ width: '100%', height: '100%' }}
          scrollWheelZoom={true}
        >
          <ChangeView center={currentStation.center} zoom={18} />
          <FlyToController targetCoords={targetFlyCoords} />

          {/* Zoom controls on bottomright */}
          <ZoomControl position="bottomright" />

          {/* Clean Map Tiles */}
          {mapMode === 'satellite' ? (
            <TileLayer
              attribution="Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP"
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
              attribution="Tiles &copy; Esri &mdash; Esri World Street Map"
              url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}"
              maxZoom={19}
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

          {userGps && <Marker position={[userGps.lat, userGps.lng]} icon={userGpsIcon} />}

          {/* Render Only Filtered Polygons */}
          {displayedParcels.map((parcel) => {
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

      {/* Floating Filter Status Badge if custom filtering is applied */}
      {isCustomFilterActive && (
        <div
          style={{
            position: 'absolute',
            top: '56px',
            right: '8px',
            zIndex: 900,
            backgroundColor: '#0f172a',
            color: '#ffffff',
            fontSize: '0.725rem',
            padding: '0.3rem 0.6rem',
            borderRadius: '999px',
            boxShadow: '0 4px 8px rgba(0,0,0,0.2)',
            display: 'flex',
            alignItems: 'center',
            gap: '0.35rem',
          }}
        >
          <Filter size={11} color="#38bdf8" />
          <span>
            Đang lọc: <strong>{displayedParcels.length}/{parcels.length}</strong> thửa
          </span>
          <button
            type="button"
            onClick={() => setAllFilters(true)}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#94a3b8',
              cursor: 'pointer',
              padding: 0,
              marginLeft: '2px',
              display: 'flex',
              alignItems: 'center',
            }}
            title="Bỏ lọc"
          >
            <X size={12} />
          </button>
        </div>
      )}

      {/* Selected Parcel Bottom Drawer */}
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
              Mã ĐC: <strong style={{ color: '#334155' }}>{activeParcel.officialCadastralCode}</strong> • Chủ hộ:{' '}
              {activeParcel.ownerName || 'Chưa cập nhật'}
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

          {/* Action buttons */}
          <div style={{ display: 'flex', gap: '0.45rem', flexWrap: 'wrap', marginTop: '0.25rem' }}>
            {activeParcel.surveyStatus === 'APPROVED' ? (
              <button
                type="button"
                className="btn btn-sm"
                onClick={() => onStartSurvey && onStartSurvey(activeParcel)}
                style={{
                  flex: 1.5,
                  minWidth: '150px',
                  backgroundColor: '#7c3aed',
                  color: '#ffffff',
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.35rem',
                  padding: '0.5rem',
                  boxShadow: '0 2px 6px rgba(124, 58, 237, 0.25)',
                }}
              >
                <Sparkles size={14} />
                Khảo sát Phase 2 (Trước thi công)
              </button>
            ) : activeParcel.surveyStatus === 'PHASE2_COMPLETED' || activeParcel.surveyStatus === 'APPROVED_PHASE2' ? (
              <div
                style={{
                  flex: 1.5,
                  minWidth: '150px',
                  backgroundColor: '#dbeafe',
                  color: '#1d4ed8',
                  padding: '0.45rem 0.65rem',
                  borderRadius: '0.5rem',
                  fontSize: '0.775rem',
                  fontWeight: 700,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.35rem',
                  border: '1px solid #93c5fd',
                }}
              >
                <CheckCircle2 size={14} color="#2563eb" />
                Đã Hoàn Tất Khảo Sát Phase 2
              </div>
            ) : (
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={() => onStartSurvey && onStartSurvey(activeParcel)}
                style={{
                  flex: 1.5,
                  minWidth: '150px',
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

            {/* Chỉ đường button linking to Google Maps */}
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

            {/* Absence Button ONLY for Phase 1 incomplete */}
            {activeParcel.surveyStatus !== 'APPROVED' &&
              activeParcel.surveyStatus !== 'PHASE2_COMPLETED' &&
              activeParcel.surveyStatus !== 'APPROVED_PHASE2' && (
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
          </div>
        </div>
      )}
    </div>
  );
};
