import React from 'react';
import { MapContainer, TileLayer, ZoomControl } from 'react-leaflet';
import { Filter, X, Sparkles } from 'lucide-react';
import { GisParcel, LeafletSweepMapProps } from './shared/types';
import { ChangeView, FlyToController } from './shared/MapControllers';
import { useSweepMapState } from './sweep-map/hooks/useSweepMapState';
import { isNonBuildingParcel } from './sweep-map/utils/sweepMapHelpers';
import { SweepMapHeader } from './sweep-map/components/SweepMapHeader';
import { SweepMapFilterModal } from './sweep-map/components/SweepMapFilterModal';
import { MetroGisOverlays } from './sweep-map/components/layers/MetroGisOverlays';
import { ParcelsLayer } from './sweep-map/components/layers/ParcelsLayer';
import { ParcelDetailBottomSheet } from './sweep-map/components/ParcelDetailBottomSheet';

// Re-export GisParcel for backward compatibility across the entire system
export type { GisParcel } from './shared/types';
export type Props = LeafletSweepMapProps;

export const LeafletSweepMap: React.FC<LeafletSweepMapProps> = ({
  parcels,
  selectedZone,
  onSelectZone,
  onSelectParcel,
  onStartSurvey,
  onStartPhase2,
  onOpenBuildingHub,
  onRecordAbsence,
  onProposeSplit,
  userGps,
  thematicMode,
  hideBottomSheet = false,
}) => {
  const {
    currentZoneConfig,
    currentStation,
    activeParcel,
    setActiveParcel,
    showCenterline,
    setShowCenterline,
    showZonesZoi,
    setShowZonesZoi,
    showStationMarkers,
    setShowStationMarkers,
    showStationOutlines,
    setShowStationOutlines,
    isSearchOpen,
    setIsSearchOpen,
    searchQuery,
    setSearchQuery,
    targetFlyCoords,
    setTargetFlyCoords,
    searchInputRef,
    mapMode,
    setMapMode,
    showLayerMenu,
    setShowLayerMenu,
    showFilterModal,
    setShowFilterModal,
    appliedFilters,
    setAppliedFilters,
    draftFilters,
    setDraftFilters,
    displayedParcels,
    searchSuggestions,
    absenceRecordedToday,
    handleSelectSearchResult,
    handleSearchKeyDown,
    handleOpenGoogleMapsDirections,
    setAllFilters,
    setPhase1Only,
    setPhase2Only,
    isCustomFilterActive,
  } = useSweepMapState({
    parcels,
    selectedZone,
    onSelectZone,
    onSelectParcel,
    onRecordAbsence,
    userGps,
  });

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', display: 'flex', flexDirection: 'column' }}>
      {/* 1. Top Bar: Search, Zone selector, GIS layer toggles */}
      <SweepMapHeader
        selectedZone={selectedZone}
        onSelectZone={onSelectZone}
        setTargetFlyCoords={setTargetFlyCoords}
        mapMode={mapMode}
        setMapMode={setMapMode}
        showLayerMenu={showLayerMenu}
        setShowLayerMenu={setShowLayerMenu}
        showCenterline={showCenterline}
        setShowCenterline={setShowCenterline}
        showZonesZoi={showZonesZoi}
        setShowZonesZoi={setShowZonesZoi}
        showStationMarkers={showStationMarkers}
        setShowStationMarkers={setShowStationMarkers}
        showStationOutlines={showStationOutlines}
        setShowStationOutlines={setShowStationOutlines}
        isSearchOpen={isSearchOpen}
        setIsSearchOpen={setIsSearchOpen}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        searchInputRef={searchInputRef}
        searchSuggestions={searchSuggestions}
        handleSearchKeyDown={handleSearchKeyDown}
        handleSelectSearchResult={handleSelectSearchResult}
        isCustomFilterActive={isCustomFilterActive}
        setShowFilterModal={setShowFilterModal}
      />

      {/* 2. 3-Bar Filter & Legend Drawer/Modal */}
      <SweepMapFilterModal
        showFilterModal={showFilterModal}
        setShowFilterModal={setShowFilterModal}
        parcels={parcels}
        draftFilters={draftFilters}
        setDraftFilters={setDraftFilters}
        setAppliedFilters={setAppliedFilters}
        setAllFilters={setAllFilters}
        setPhase1Only={setPhase1Only}
        setPhase2Only={setPhase2Only}
        isNonBuildingParcel={isNonBuildingParcel}
      />

      {/* 3. Leaflet Map Container with Deep Zoom (up to level 23) */}
      <div style={{ flex: 1, width: '100%', height: '100%', overflow: 'hidden' }}>
        <MapContainer
          center={currentStation.center}
          zoom={16}
          minZoom={12}
          maxZoom={23}
          zoomControl={false}
          style={{ width: '100%', height: '100%' }}
          scrollWheelZoom={true}
        >
          <ChangeView center={currentStation.center} zoom={16} />
          <FlyToController targetCoords={targetFlyCoords} />
          <ZoomControl position="bottomright" />

          {/* Clean Map Tiles with Deep Zoom Scaling */}
          {mapMode === 'satellite' ? (
            <TileLayer
              attribution="Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP"
              url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
              maxNativeZoom={19}
              maxZoom={23}
            />
          ) : mapMode === 'osm' ? (
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/">CARTO</a>'
              url="https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png"
              subdomains="abcd"
              maxNativeZoom={19}
              maxZoom={23}
            />
          ) : (
            <TileLayer
              attribution="Tiles &copy; Esri &mdash; Esri World Street Map"
              url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}"
              maxNativeZoom={19}
              maxZoom={23}
            />
          )}

          {/* Metro 2 Corridor, Stations, TBM and GPS Overlays */}
          <MetroGisOverlays
            showCenterline={showCenterline}
            showZonesZoi={showZonesZoi}
            showStationMarkers={showStationMarkers}
            showStationOutlines={showStationOutlines}
            currentStationCenter={currentStation.center}
            userGps={userGps}
          />

          {/* Render Only Filtered Polygons */}
          <ParcelsLayer
            displayedParcels={displayedParcels}
            activeParcel={activeParcel}
            setActiveParcel={setActiveParcel}
            onSelectParcel={onSelectParcel}
            thematicMode={thematicMode}
          />
        </MapContainer>

        {/* Clean DB / Zero Parcels Status Floating Banner */}
        {displayedParcels.length === 0 && (
          <div
            style={{
              position: 'absolute',
              bottom: '16px',
              left: '50%',
              transform: 'translateX(-50%)',
              zIndex: 1000,
              backgroundColor: 'rgba(15, 23, 42, 0.92)',
              backdropFilter: 'blur(8px)',
              color: '#ffffff',
              padding: '0.55rem 1rem',
              borderRadius: '999px',
              border: '1px solid rgba(56, 189, 248, 0.35)',
              boxShadow: '0 8px 24px rgba(0, 0, 0, 0.25)',
              display: 'flex',
              alignItems: 'center',
              gap: '0.6rem',
              fontSize: '0.775rem',
              maxWidth: '92%',
              whiteSpace: 'nowrap',
              animation: 'fadeIn 0.25s ease-out',
            }}
          >
            <Sparkles size={15} color="#38bdf8" />
            <span>
              <strong>CSDL sạch (0 thửa):</strong> {currentZoneConfig.name} sẵn sàng để bắt đầu kiểm thử từ zero
            </span>
          </div>
        )}
      </div>

      {/* 4. Floating Filter Status Badge if custom filtering is applied */}
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

      {/* 5. Selected Parcel Bottom Drawer (Disabled in Guest view to prevent showing Surveyor action buttons) */}
      {!hideBottomSheet && (
        <ParcelDetailBottomSheet
          activeParcel={activeParcel}
          onClose={() => setActiveParcel(null)}
          onStartSurvey={onStartSurvey}
          onStartPhase2={onStartPhase2}
          onOpenBuildingHub={onOpenBuildingHub}
          onProposeSplit={onProposeSplit}
          absenceRecordedToday={absenceRecordedToday}
          handleOpenGoogleMapsDirections={handleOpenGoogleMapsDirections}
        />
      )}
    </div>
  );
};
