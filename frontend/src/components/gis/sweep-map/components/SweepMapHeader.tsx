import React from 'react';
import { Layers, Search, Menu, Map, Compass, X, MapPin } from 'lucide-react';
import type { GisParcel } from '../../shared/types';
import { METRO_22_ZONES, getZoneByCode } from '../../../../features/survey-phase1/constants/metroGisConstants';
import { getStatusBadge } from '../utils/sweepMapHelpers';

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
}) => {
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
          backgroundColor: '#ffffff',
          padding: '0.4rem 0.65rem',
          borderRadius: '0.75rem',
          border: '1px solid #cbd5e1',
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.08)',
        }}
      >
        {/* Zone Select Dropdown */}
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
            backgroundColor: '#f8fafc',
            color: '#0f172a',
            border: '1px solid #cbd5e1',
            borderRadius: '0.5rem',
            fontWeight: 600,
          }}
        >
          <optgroup label="⭐ Xem toàn tuyến hoặc 5 Phân đoạn">
            <option value="ALL">
              ⭐ Toàn Tuyến Metro 2 (Hiện tất cả 1.227 thửa đất)
            </option>
            {METRO_22_ZONES.filter((z) => z.isDataReady).map((z) => (
              <option key={z.code} value={z.code}>
                {z.name} ({z.rawParcelCount} thửa)
              </option>
            ))}
          </optgroup>
          <optgroup label="Toàn Tuyến Metro 2 (22 Zone)">
            {METRO_22_ZONES.map((z) => (
              <option key={z.code} value={z.code}>
                {z.name} [{z.startKm} &rarr; {z.endKm}]
              </option>
            ))}
          </optgroup>
        </select>

        {/* Map Layer Switcher Button */}
        <div style={{ position: 'relative' }}>
          <button
            type="button"
            onClick={() => setShowLayerMenu((prev) => !prev)}
            title="Lớp bản đồ & Tùy chọn GIS Metro 2"
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
            <span>Lớp GIS</span>
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
                boxShadow: '0 8px 24px rgba(0,0,0,0.18)',
                padding: '0.5rem',
                zIndex: 1050,
                display: 'flex',
                flexDirection: 'column',
                gap: '0.3rem',
                minWidth: '190px',
              }}
            >
              <div style={{ fontSize: '0.7rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', padding: '0.2rem 0.4rem' }}>
                Nền bản đồ
              </div>
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
                  background: mapMode === 'satellite' ? '#e0f2fe' : 'transparent',
                  color: mapMode === 'satellite' ? '#0284c7' : '#0f172a',
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
                  background: mapMode === 'osm' ? '#e0f2fe' : 'transparent',
                  color: mapMode === 'osm' ? '#0284c7' : '#0f172a',
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

              <div style={{ height: '1px', backgroundColor: '#e2e8f0', margin: '0.3rem 0' }} />

              <div style={{ fontSize: '0.7rem', fontWeight: 800, color: '#64748b', textTransform: 'uppercase', padding: '0.2rem 0.4rem' }}>
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
                  color: '#0f172a',
                  padding: '0.3rem 0.5rem',
                  borderRadius: '0.4rem',
                  cursor: 'pointer',
                  backgroundColor: showCenterline ? '#f8fafc' : 'transparent',
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
                  color: '#0f172a',
                  padding: '0.3rem 0.5rem',
                  borderRadius: '0.4rem',
                  cursor: 'pointer',
                  backgroundColor: showZonesZoi ? '#f8fafc' : 'transparent',
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
                  color: '#0f172a',
                  padding: '0.3rem 0.5rem',
                  borderRadius: '0.4rem',
                  cursor: 'pointer',
                  backgroundColor: showStationMarkers ? '#f8fafc' : 'transparent',
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
                  color: '#0f172a',
                  padding: '0.3rem 0.5rem',
                  borderRadius: '0.4rem',
                  cursor: 'pointer',
                  backgroundColor: showStationOutlines ? '#f8fafc' : 'transparent',
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
                        {getStatusBadge(parcel.surveyStatus, parcel)}
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
    </>
  );
};
