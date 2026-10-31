import React, { useMemo, useState } from 'react';
import { Layers, Search, Menu, Map, Compass, X, MapPin, FileCode } from 'lucide-react';
import type { GisParcel } from '../../shared/types';
import { METRO_22_ZONES, getZoneByCode } from '../../../../features/survey-phase1/constants/metroGisConstants';
import { getStatusBadge } from '../utils/sweepMapHelpers';
import { isExcludedParcel } from '../../shared/parcelExclusion';
import { ZoneSvgPreviewModal } from '../../../../features/zone-management/components/modals/ZoneSvgPreviewModal';
import { getSvgExportDisabledReason } from '../../../../features/zone-management/utils/zoneSvgTechnicalExporter';
import { useAuth } from '../../../../context/AuthContext';
import { getLockedZone } from '../../../../utils/zoneScope';

interface SweepMapHeaderProps {
  selectedZone: string;
  onSelectZone: (zone: string) => void;
  setTargetFlyCoords: (coords: [number, number]) => void;
  mapMode: 'standard' | 'satellite' | 'osm';
  setMapMode: (mode: 'standard' | 'satellite' | 'osm') => void;
  showLayerMenu: boolean;
  setShowLayerMenu: (show: boolean | ((prev: boolean) => boolean)) => void;
  showCenterline: boolean;
  setShowCenterline: (show: boolean) => void;
  showZonesZoi: boolean;
  setShowZonesZoi: (show: boolean) => void;
  showStationMarkers: boolean;
  setShowStationMarkers: (show: boolean) => void;
  showStationOutlines?: boolean;
  setShowStationOutlines?: (show: boolean) => void;
  isSearchOpen: boolean;
  setIsSearchOpen: (open: boolean | ((prev: boolean) => boolean)) => void;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  searchInputRef: React.RefObject<HTMLInputElement>;
  searchSuggestions: GisParcel[];
  handleSearchKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  handleSelectSearchResult: (parcel: GisParcel) => void;
  isCustomFilterActive: boolean;
  setShowFilterModal: (show: boolean) => void;
  parcels?: GisParcel[];
  canExportSvg?: boolean;
}

export const SweepMapHeader: React.FC<SweepMapHeaderProps> = ({
  selectedZone,
  onSelectZone,
  setTargetFlyCoords,
  mapMode,
  setMapMode,
  showLayerMenu,
  setShowLayerMenu,
  showCenterline,
  setShowCenterline,
  showZonesZoi,
  setShowZonesZoi,
  showStationMarkers,
  setShowStationMarkers,
  showStationOutlines = true,
  setShowStationOutlines = () => {},
  isSearchOpen,
  setIsSearchOpen,
  searchQuery,
  setSearchQuery,
  searchInputRef,
  searchSuggestions,
  handleSearchKeyDown,
  handleSelectSearchResult,
  isCustomFilterActive,
  setShowFilterModal,
  parcels,
  canExportSvg = false,
}) => {
  const { user } = useAuth();
  const lockedZone = getLockedZone(user);
  const [showSvgExportModal, setShowSvgExportModal] = useState<boolean>(false);
  const svgExportDisabledReason = getSvgExportDisabledReason(selectedZone, parcels?.length ?? 0);

  const parcelsCountByZone = useMemo(() => {
    const map: Record<string, number> = {};
    if (parcels && parcels.length > 0) {
      for (const p of parcels) {
        const z = (p.zoneId || p.zone_id || '').toUpperCase();
        if (z) {
          map[z] = (map[z] || 0) + 1;
        }
      }
    }
    return map;
  }, [parcels]);

  const totalKnownParcels = useMemo(() => {
    if (parcels && parcels.length > 0 && selectedZone === 'ALL') {
      return parcels.length;
    }
    return METRO_22_ZONES.reduce((sum, z) => sum + (z.isDataReady ? (z.rawParcelCount || 0) : 0), 0);
  }, [parcels, selectedZone]);

  return (
    <>
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
          backgroundColor: 'rgb(var(--bg-white))',
          padding: '0.4rem 0.65rem',
          borderRadius: '0.75rem',
          border: '1px solid rgb(var(--border-slate-300))',
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.08)',
        }}
      >
        {/* Zone Select Dropdown (Zone Admin được gán zone cụ thể chỉ xem mã phân khu) */}
        {lockedZone ? (
          <div className="flex-1 min-w-0 rounded-lg px-2 py-1 text-xs border bg-cyan-950 text-cyan-300 border-cyan-700 font-mono font-bold">
            {lockedZone}
          </div>
        ) : (
        <select
          value={selectedZone}
          onChange={(e) => {
            const val = e.target.value;
            onSelectZone(val);
            if (val === 'ALL') {
              setTargetFlyCoords([10.785, 106.665]);
            } else {
              const zCfg = getZoneByCode(val);
              if (zCfg) {
                setTargetFlyCoords(zCfg.center);
              }
            }
          }}
          className="form-control"
          style={{
            flex: 1,
            minWidth: 0,
            fontSize: '0.825rem',
            padding: '0.35rem 0.5rem',
            backgroundColor: 'rgb(var(--bg-slate-50))',
            color: 'rgb(var(--text-slate-900))',
            border: '1px solid rgb(var(--border-slate-300))',
            borderRadius: '0.5rem',
            fontWeight: 600,
          }}
        >
          <option value="ALL">
            ⭐ Toàn Tuyến Metro 2 {totalKnownParcels > 0 ? `(Hiện tất cả ${totalKnownParcels.toLocaleString('vi-VN')} thửa đất)` : ''}
          </option>
          <optgroup label="22 Zone Tuyến Metro 2 (Bến Thành ➔ Tham Lương)">
            {METRO_22_ZONES.map((z) => {
              const count = parcelsCountByZone[z.code] ?? (z.isDataReady ? z.rawParcelCount : 0);
              return (
                <option key={z.code} value={z.code}>
                  {z.name} {count && count > 0 ? `(${count.toLocaleString('vi-VN')} thửa)` : `(Chưa có dữ liệu)`}
                </option>
              );
            })}
          </optgroup>
        </select>
        )}

        {/* Xuất bình đồ kỹ thuật SVG (chỉ Admin) */}
        {canExportSvg && (
          <button
            type="button"
            onClick={() => setShowSvgExportModal(true)}
            disabled={svgExportDisabledReason !== null}
            title={svgExportDisabledReason ?? 'Xuất bình đồ kỹ thuật mặt bằng Zone (định dạng SVG)'}
            className="cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            style={{
              background: 'rgb(var(--bg-slate-100))',
              color: 'rgb(var(--text-sky-600))',
              border: '1px solid rgb(var(--border-slate-300))',
              borderRadius: '0.5rem',
              padding: '0.35rem 0.55rem',
              fontSize: '0.75rem',
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              gap: '0.25rem',
              whiteSpace: 'nowrap',
            }}
          >
            <FileCode size={14} />
            <span className="hidden sm:inline">Xuất Bình Đồ (SVG)</span>
          </button>
        )}

        {/* Map Layer Switcher Button */}
        <div style={{ position: 'relative' }}>
          <button
            type="button"
            onClick={() => setShowLayerMenu((prev) => !prev)}
            title="Lớp bản đồ & Tùy chọn GIS Metro 2"
            style={{
              background: mapMode === 'satellite' ? 'rgb(var(--bg-slate-900))' : 'rgb(var(--bg-slate-100))',
              color: mapMode === 'satellite' ? '#ffffff' : 'rgb(var(--text-sky-600))',
              border: '1px solid rgb(var(--border-slate-300))',
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
            <span>Lớp GIS</span>
          </button>

          {showLayerMenu && (
            <div
              style={{
                position: 'absolute',
                top: 'calc(100% + 6px)',
                right: 0,
                backgroundColor: 'rgb(var(--bg-white))',
                border: '1px solid rgb(var(--border-slate-300))',
                borderRadius: '0.65rem',
                boxShadow: '0 8px 24px rgba(0,0,0,0.18)',
                padding: '0.5rem',
                zIndex: 1050,
                display: 'flex',
                flexDirection: 'column',
                gap: '0.3rem',
                minWidth: '190px',
              }}
            >
              <div style={{ fontSize: '0.7rem', fontWeight: 800, color: 'rgb(var(--text-slate-500))', textTransform: 'uppercase', padding: '0.2rem 0.4rem' }}>
                Nền bản đồ
              </div>
              <button
                type="button"
                onClick={() => {
                  setMapMode('standard');
                  setShowLayerMenu(false);
                }}
                style={{
                  background: mapMode === 'standard' ? 'rgb(var(--bg-sky-100))' : 'transparent',
                  color: mapMode === 'standard' ? 'rgb(var(--text-sky-600))' : 'rgb(var(--text-slate-900))',
                  border: 'none',
                  borderRadius: '0.4rem',
                  padding: '0.35rem 0.5rem',
                  fontSize: '0.775rem',
                  fontWeight: 600,
                  textAlign: 'left',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                }}
              >
                <Map size={14} />
                <span>Đường phố</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setMapMode('satellite');
                  setShowLayerMenu(false);
                }}
                style={{
                  background: mapMode === 'satellite' ? 'rgb(var(--bg-sky-100))' : 'transparent',
                  color: mapMode === 'satellite' ? 'rgb(var(--text-sky-600))' : 'rgb(var(--text-slate-900))',
                  border: 'none',
                  borderRadius: '0.4rem',
                  padding: '0.35rem 0.5rem',
                  fontSize: '0.775rem',
                  fontWeight: 600,
                  textAlign: 'left',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                }}
              >
                <Compass size={14} />
                <span>Ảnh Vệ tinh</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setMapMode('osm');
                  setShowLayerMenu(false);
                }}
                style={{
                  background: mapMode === 'osm' ? 'rgb(var(--bg-sky-100))' : 'transparent',
                  color: mapMode === 'osm' ? 'rgb(var(--text-sky-600))' : 'rgb(var(--text-slate-900))',
                  border: 'none',
                  borderRadius: '0.4rem',
                  padding: '0.35rem 0.5rem',
                  fontSize: '0.775rem',
                  fontWeight: 600,
                  textAlign: 'left',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.4rem',
                }}
              >
                <Layers size={14} />
                <span>Bản đồ OSM</span>
              </button>

              <div style={{ height: '1px', backgroundColor: 'rgb(var(--bg-slate-200))', margin: '0.3rem 0' }} />

              <div style={{ fontSize: '0.7rem', fontWeight: 800, color: 'rgb(var(--text-slate-500))', textTransform: 'uppercase', padding: '0.2rem 0.4rem' }}>
                Lớp chuyên đề Metro 2
              </div>

              {/* Toggle Tim tuyến */}
              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  color: 'rgb(var(--text-slate-900))',
                  padding: '0.3rem 0.5rem',
                  borderRadius: '0.4rem',
                  cursor: 'pointer',
                  backgroundColor: showCenterline ? 'rgb(var(--bg-slate-50))' : 'transparent',
                }}
              >
                <input
                  type="checkbox"
                  checked={showCenterline}
                  onChange={(e) => setShowCenterline(e.target.checked)}
                  style={{ accentColor: '#e11d48' }}
                />
                <span>🚇 Tim tuyến Metro 2 (11.04 km)</span>
              </label>

              {/* Toggle 22 Vùng Zone & ZOI */}
              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  color: 'rgb(var(--text-slate-900))',
                  padding: '0.3rem 0.5rem',
                  borderRadius: '0.4rem',
                  cursor: 'pointer',
                  backgroundColor: showZonesZoi ? 'rgb(var(--bg-slate-50))' : 'transparent',
                }}
              >
                <input
                  type="checkbox"
                  checked={showZonesZoi}
                  onChange={(e) => setShowZonesZoi(e.target.checked)}
                  style={{ accentColor: '#0284c7' }}
                />
                <span>🗺️ Vùng 22 Zone &amp; ZOI</span>
              </label>

              {/* Toggle Nhà ga */}
              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  color: 'rgb(var(--text-slate-900))',
                  padding: '0.3rem 0.5rem',
                  borderRadius: '0.4rem',
                  cursor: 'pointer',
                  backgroundColor: showStationMarkers ? 'rgb(var(--bg-slate-50))' : 'transparent',
                }}
              >
                <input
                  type="checkbox"
                  checked={showStationMarkers}
                  onChange={(e) => setShowStationMarkers(e.target.checked)}
                  style={{ accentColor: '#ea580c' }}
                />
                <span>🚉 12 Nhà ga &amp; Depot</span>
              </label>

              {/* Toggle Phác họa công trình nhà ga màu trắng */}
              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  fontSize: '0.75rem',
                  fontWeight: 600,
                  color: 'rgb(var(--text-slate-900))',
                  padding: '0.3rem 0.5rem',
                  borderRadius: '0.4rem',
                  cursor: 'pointer',
                  backgroundColor: showStationOutlines ? 'rgb(var(--bg-slate-50))' : 'transparent',
                }}
              >
                <input
                  type="checkbox"
                  checked={showStationOutlines}
                  onChange={(e) => setShowStationOutlines(e.target.checked)}
                  style={{ accentColor: '#0284c7' }}
                />
                <span>🏛️ Phác họa công trình ga (Trắng)</span>
              </label>
            </div>
          )}
        </div>

        {/* Search Parcel Button */}
        <button
          type="button"
          onClick={() => setIsSearchOpen((prev) => !prev)}
          title="Tìm kiếm thửa đất theo số nhà, mã, chủ hộ"
          style={{
            width: '32px',
            height: '32px',
            borderRadius: '0.5rem',
            backgroundColor: isSearchOpen ? '#0284c7' : 'rgb(var(--bg-slate-100))',
            border: isSearchOpen ? '1px solid #0284c7' : '1px solid rgb(var(--border-slate-300))',
            color: isSearchOpen ? '#ffffff' : 'rgb(var(--text-sky-600))',
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

        {/* 3-Bar Menu Icon Button */}
        <button
          type="button"
          onClick={() => setShowFilterModal(true)}
          title="Bộ lọc hiển thị Phase & Chú thích màu sắc"
          style={{
            position: 'relative',
            width: '32px',
            height: '32px',
            borderRadius: '0.5rem',
            backgroundColor: isCustomFilterActive ? 'rgb(var(--bg-sky-100))' : 'rgb(var(--bg-slate-50))',
            border: isCustomFilterActive ? '1.5px solid #0284c7' : '1px solid rgb(var(--border-slate-300))',
            color: isCustomFilterActive ? 'rgb(var(--text-sky-600))' : 'rgb(var(--text-slate-700))',
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
                border: '1.5px solid rgb(var(--border-white))',
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
              backgroundColor: 'rgb(var(--bg-white))',
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
                color: 'rgb(var(--text-slate-900))',
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
                backgroundColor: 'rgb(var(--bg-slate-100))',
                border: 'none',
                borderLeft: '1px solid rgb(var(--border-slate-200))',
                padding: '0.65rem 0.85rem',
                fontSize: '0.775rem',
                color: 'rgb(var(--text-slate-600))',
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
                backgroundColor: 'rgb(var(--bg-white))',
                borderRadius: '0.75rem',
                border: '1px solid rgb(var(--border-slate-300))',
                boxShadow: '0 12px 28px rgba(0, 0, 0, 0.18)',
                maxHeight: '260px',
                overflowY: 'auto',
                display: 'flex',
                flexDirection: 'column',
              }}
            >
              {searchSuggestions.length === 0 ? (
                <div style={{ padding: '0.85rem 1rem', fontSize: '0.8rem', color: 'rgb(var(--text-slate-500))', textAlign: 'center' }}>
                  Không tìm thấy thửa đất nào phù hợp với &quot;<strong>{searchQuery}</strong>&quot;
                </div>
              ) : (
                searchSuggestions.map((parcel) => (
                  <div
                    key={parcel.id}
                    onClick={() => handleSelectSearchResult(parcel)}
                    style={{
                      padding: '0.65rem 0.85rem',
                      borderBottom: '1px solid rgb(var(--border-slate-100))',
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
                        <span style={{ fontSize: '0.9rem', fontWeight: 800, color: 'rgb(var(--text-sky-600))' }}>
                          {parcel.projectParcelCode}
                        </span>
                        {isExcludedParcel(parcel) ? (
                          <span className="badge bg-slate-800 text-slate-300 border border-slate-600 font-bold">Đã ẩn</span>
                        ) : (
                          getStatusBadge(parcel.surveyStatus, parcel)
                        )}
                      </div>
                      <div style={{ fontSize: '0.8rem', color: 'rgb(var(--text-slate-900))', fontWeight: 600, marginTop: '2px' }}>
                        Số {parcel.houseNumber} {parcel.street}
                      </div>
                      <div style={{ fontSize: '0.725rem', color: 'rgb(var(--text-slate-500))' }}>
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

      {showSvgExportModal && (
        <ZoneSvgPreviewModal zoneId={selectedZone} onClose={() => setShowSvgExportModal(false)} />
      )}
    </>
  );
};
