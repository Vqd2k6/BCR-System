import React, { lazy, Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { MapContainer, TileLayer, ZoomControl } from 'react-leaflet';
import { Filter, X, Sparkles, Loader2 } from 'lucide-react';
import type { GisParcel, LeafletSweepMapProps } from './shared/types';
import { ChangeView, FlyToController } from './shared/MapControllers';
import { BASE_TILE_SOURCES } from './shared/baseTileSources';
import { useSweepMapState } from './sweep-map/hooks/useSweepMapState';
import { useExcludedParcels } from './sweep-map/hooks/useExcludedParcels';
import { isNonBuildingParcel } from './sweep-map/utils/sweepMapHelpers';
import { getZoneByCode } from '../../features/survey-phase1/constants/metroGisConstants';
import { SweepMapHeader } from './sweep-map/components/SweepMapHeader';
import { SweepMapFilterModal } from './sweep-map/components/SweepMapFilterModal';
import { MetroGisOverlays } from './sweep-map/components/layers/MetroGisOverlays';
import { ParcelsLayer } from './sweep-map/components/layers/ParcelsLayer';
import { PreviewParcelsLayer } from './sweep-map/components/layers/PreviewParcelsLayer';
import { FloatingImportPreviewBar } from './sweep-map/components/FloatingImportPreviewBar';
import { ParcelDetailBottomSheet } from './sweep-map/components/ParcelDetailBottomSheet';
import { ExcludedParcelsLayer } from './sweep-map/components/layers/ExcludedParcelsLayer';
import { ExcludedParcelPanel } from './sweep-map/components/ExcludedParcelPanel';
import { ExcludeParcelModal } from './shared/ExcludeParcelModal';
import { FloatingBatchActionBar } from './sweep-map/components/FloatingBatchActionBar';
import type { BatchOperationMode } from './sweep-map/components/FloatingBatchActionBar';
import { BatchGisOperationsModal } from './sweep-map/components/modals/BatchGisOperationsModal';
import { ADDRESS_BATCH_ZONES, BATCH_MAX_PARCELS } from './shared/parcelBatchApi';
import { createPortal } from 'react-dom';
import { useAuth } from '../../context/AuthContext';
import { PhotoResurveyScreen, ResurveyMarkersLayer, useResurveyTasks } from '../../features/photo-resurvey';

// Re-export GisParcel for backward compatibility across the entire system
export type { GisParcel } from './shared/types';
export type Props = LeafletSweepMapProps;

// Chế độ 3D (maplibre-gl ~200KB gzip) chỉ tải khi bấm nút 3D
const Zone3DMapView = lazy(() => import('./zone-3d/Zone3DMapView'));

export const LeafletSweepMap: React.FC<LeafletSweepMapProps> = ({
  parcels,
  selectedZone,
  onSelectZone,
  initialSelectedParcel,
  onSelectParcel,
  onStartSurvey,
  onStartPhase2,
  onOpenBuildingHub,
  onOpenAuditReview,
  onRecordAbsence,
  onProposeSplit,
  userGps,
  thematic = null,
  thematicOverlay,
  thematicFilterMatch = null,
  renderParcelInsights,
  hideBottomSheet = false,
  onSwapSuccess,
  previewImportState,
  onConfirmImportPreview,
  onCancelImportPreview,
  onParcelLifecycleChanged,
  enableBatchTools = false,
  enable3D = false,
  resolveParcel3DInfo,
}) => {
  const { excludedParcels, canViewExcluded, reloadExcluded } = useExcludedParcels(selectedZone);

  // --- Khảo sát bổ sung: dấu "!" trên thửa còn ảnh ngoài nhà cần chụp lại (KSV + Admin, không cho khách) ---
  const { user } = useAuth();
  const resurveyEnabled =
    !hideBottomSheet && (user?.role === 'SURVEYOR' || user?.role === 'ZONE_ADMIN' || user?.role === 'SUPER_ADMIN');
  const {
    tasks: resurveyTasks,
    byParcel: resurveyByParcel,
    reload: reloadResurvey,
  } = useResurveyTasks(selectedZone, resurveyEnabled);
  const [resurveyReportId, setResurveyReportId] = useState<string | null>(null);
  const [selectedExcluded, setSelectedExcluded] = useState<GisParcel | null>(null);
  const [restoreTarget, setRestoreTarget] = useState<GisParcel | null>(null);

  // --- Tác vụ đồng loạt: chỉ màn Zone Admin bật (enableBatchTools) và chỉ khi tài khoản là Admin (canViewExcluded) ---
  const canBatch = enableBatchTools && canViewExcluded;
  const [isBatchMode, setIsBatchMode] = useState(false);
  const [selectedParcelIds, setSelectedParcelIds] = useState<Set<string>>(() => new Set());
  const [selectedExcludedIds, setSelectedExcludedIds] = useState<Set<string>>(() => new Set());
  const [batchModalMode, setBatchModalMode] = useState<BatchOperationMode | null>(null);

  // --- Chế độ 3D cô lập theo Zone ---
  const [viewMode, setViewMode] = useState<'2D' | '3D'>('2D');
  const [notice3D, setNotice3D] = useState<string | null>(null);

  const clearBatchSelection = useCallback(() => {
    setSelectedParcelIds(new Set());
    setSelectedExcludedIds(new Set());
  }, []);

  const exitBatchMode = useCallback(() => {
    setIsBatchMode(false);
    setBatchModalMode(null);
    clearBatchSelection();
  }, [clearBatchSelection]);

  // Đổi phân khu thì thoát chế độ chọn nhiều để không mang lựa chọn sang Zone khác
  useEffect(() => {
    exitBatchMode();
  }, [selectedZone, exitBatchMode]);

  const toggleIdIn = (setter: React.Dispatch<React.SetStateAction<Set<string>>>) => (parcel: GisParcel) => {
    setter((prev) => {
      const next = new Set(prev);
      if (next.has(parcel.id)) next.delete(parcel.id);
      else next.add(parcel.id);
      return next;
    });
  };

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
    excludedParcels,
    onSelectExcludedParcel: setSelectedExcluded,
    selectedZone,
    onSelectZone,
    initialSelectedParcel,
    onSelectParcel,
    onRecordAbsence,
    userGps,
  });

  // Lọc chỉ định chế độ "Chỉ hiện thửa khớp": không vẽ thửa ngoài tập (luôn giữ thửa đang chọn).
  // "Chọn tất cả" của tác vụ hàng loạt cũng chỉ lấy tập này để không chọn nhầm thửa đang bị ẩn.
  const visibleParcels = useMemo(() => {
    if (!thematicFilterMatch || thematicFilterMatch.mode !== 'ISOLATE') return displayedParcels;
    const { matchedIds } = thematicFilterMatch;
    return displayedParcels.filter((p) => matchedIds.has(p.id) || p.id === activeParcel?.id);
  }, [displayedParcels, thematicFilterMatch, activeParcel?.id]);

  const isAllZones = selectedZone === 'ALL' || selectedZone === 'ALL_ZONES';
  // Không dùng currentZoneConfig: nó rơi về Zone 1 khi mã không khớp ⇒ ranh 3D sai. Thiếu ranh thì 3D dùng hình chữ nhật bao thửa.
  const zone3DPolygon = useMemo(() => getZoneByCode(selectedZone)?.polygon ?? null, [selectedZone]);
  // 3D chỉ dùng cho 1 Zone cụ thể; nhường chỗ cho chế độ chọn nhiều và xem trước nạp dữ liệu (chỉ có ở 2D)
  const can3D = enable3D && !isAllZones && !isBatchMode && !previewImportState;
  const is3D = viewMode === '3D' && can3D;

  useEffect(() => {
    if (viewMode === '3D' && !can3D) setViewMode('2D');
  }, [viewMode, can3D]);

  const handleToggleViewMode = () => {
    setNotice3D(null);
    setViewMode((prev) => (prev === '3D' ? '2D' : '3D'));
  };

  const handleFatal3D = useCallback((err: unknown) => {
    console.error('[Zone3D:fatal] Quay về bản đồ 2D', err);
    setNotice3D('Không bật được chế độ 3D trên thiết bị này. Đã quay về bản đồ 2D.');
    setViewMode('2D');
  }, []);

  const handlePick3D = useCallback(
    (parcel: GisParcel) => {
      setActiveParcel(parcel);
      onSelectParcel(parcel);
    },
    [setActiveParcel, onSelectParcel]
  );

  const handleToggleBatchMode = () => {
    if (isBatchMode) {
      exitBatchMode();
      return;
    }
    setActiveParcel(null);
    setSelectedExcluded(null);
    setIsBatchMode(true);
  };

  const handleLifecycleChanged = () => {
    setActiveParcel(null);
    setSelectedExcluded(null);
    reloadExcluded();
    onParcelLifecycleChanged?.();
  };

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
        parcels={parcels}
        canExportSvg={canViewExcluded}
        canBatch={canBatch}
        isBatchMode={isBatchMode}
        onToggleBatchMode={handleToggleBatchMode}
        can3D={enable3D}
        is3D={is3D}
        zone3DBlockedReason={
          isAllZones ? 'Chọn 1 Zone cụ thể để bật chế độ 3D' : isBatchMode || previewImportState ? 'Thoát chế độ chọn nhiều / xem trước để bật 3D' : null
        }
        onToggleViewMode={handleToggleViewMode}
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
        canViewExcluded={canViewExcluded}
        excludedCount={excludedParcels.length}
        thematicLegend={thematic ? { title: thematic.layoutLabel, rows: thematic.legendRows } : null}
      />

      {/* 2b. Bộ chọn layout chuyên đề + chú giải (features/gis-visualization), nổi dưới thanh tiêu đề */}
      {thematicOverlay && (
        <div className="absolute left-2 top-[56px] z-[1000] max-w-[calc(100%-1rem)] pointer-events-none">
          <div className="pointer-events-auto">{thematicOverlay}</div>
        </div>
      )}

      {/* 3. Leaflet Map Container with Deep Zoom (up to level 23) */}
      <div style={{ position: 'relative', flex: 1, width: '100%', height: '100%', overflow: 'hidden' }}>
        {/* Leaflet giữ nguyên khi ở 3D (ẩn bằng visibility) để quay về 2D không mất khung nhìn */}
        <div style={{ width: '100%', height: '100%', visibility: is3D ? 'hidden' : 'visible' }}>
        <MapContainer
          center={currentStation.center}
          zoom={16}
          minZoom={12}
          maxZoom={23}
          zoomControl={false}
          style={{ width: '100%', height: '100%' }}
          scrollWheelZoom={true}
        >
          <ChangeView center={currentStation.center} zoom={16} zoneKey={currentStation.code} />
          <FlyToController targetCoords={targetFlyCoords} />
          <ZoomControl position="bottomright" />

          {/* Clean Map Tiles with Deep Zoom Scaling */}
          <TileLayer
            key={mapMode}
            attribution={BASE_TILE_SOURCES[mapMode].attribution}
            url={BASE_TILE_SOURCES[mapMode].urlLeaflet}
            // Không truyền subdomains={undefined}: Leaflet ghi đè mặc định 'abc' thành undefined ⇒ _getSubdomain lỗi .length
            {...(BASE_TILE_SOURCES[mapMode].subdomains ? { subdomains: BASE_TILE_SOURCES[mapMode].subdomains } : {})}
            maxNativeZoom={BASE_TILE_SOURCES[mapMode].maxNativeZoom}
            maxZoom={23}
            className={BASE_TILE_SOURCES[mapMode].className}
          />

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
            displayedParcels={visibleParcels}
            activeParcel={activeParcel}
            setActiveParcel={setActiveParcel}
            onSelectParcel={onSelectParcel}
            thematic={thematic}
            filterMatch={thematicFilterMatch}
            isBatchMode={isBatchMode}
            selectedParcelIds={selectedParcelIds}
            onToggleSelect={toggleIdIn(setSelectedParcelIds)}
          />

          {/* Dấu "!" thửa cần khảo sát bổ sung (đỏ cam: cần chụp, vàng: chờ duyệt) */}
          {resurveyEnabled && !isBatchMode && (
            <ResurveyMarkersLayer
              tasks={resurveyTasks}
              onSelect={(task) => {
                const parcel = parcels.find((p) => p.id === task.parcelId);
                if (!parcel) {
                  console.error('[LeafletSweepMap:resurvey] Thửa của hồ sơ cần chụp lại không có trong danh sách đang tải', task.parcelId);
                  return;
                }
                setActiveParcel(parcel);
                onSelectParcel(parcel);
              }}
            />
          )}

          {/* Lớp thửa đã loại trừ: nét đứt xám, chỉ Admin bật */}
          {canViewExcluded && appliedFilters.showExcluded && (
            <ExcludedParcelsLayer
              parcels={excludedParcels}
              onSelect={(parcel) => {
                setActiveParcel(null);
                setSelectedExcluded(parcel);
              }}
              isBatchMode={isBatchMode}
              selectedIds={selectedExcludedIds}
              onToggleSelect={toggleIdIn(setSelectedExcludedIds)}
            />
          )}

          {/* 4b. Lớp đa giác nét đứt cho tệp đang xem trước (Preview Layer) */}
          {previewImportState && (
            <PreviewParcelsLayer previewParcels={previewImportState.parcels} />
          )}
        </MapContainer>
        </div>

        {is3D && (
          <Suspense
            fallback={
              <div className="absolute inset-0 z-[900] flex items-center justify-center bg-slate-100 text-sm font-bold text-slate-600">
                <Loader2 size={18} className="mr-2 animate-spin" /> Đang tải bản đồ 3D…
              </div>
            }
          >
            <Zone3DMapView
              key={selectedZone}
              parcels={visibleParcels}
              zoneParcels={parcels}
              zonePolygon={zone3DPolygon}
              thematic={thematic}
              filterMatch={thematicFilterMatch}
              resolveParcel3DInfo={resolveParcel3DInfo}
              activeParcelId={activeParcel?.id ?? null}
              onPickParcel={handlePick3D}
              targetFlyCoords={targetFlyCoords}
              onFatalError={handleFatal3D}
            />
          </Suspense>
        )}

        {notice3D && (
          <div className="absolute left-1/2 top-[56px] z-[1000] flex -translate-x-1/2 items-center gap-2 rounded-lg border border-amber-700 bg-amber-950 px-3 py-1.5 text-xs font-bold text-amber-300 shadow-lg">
            <span>{notice3D}</span>
            <button type="button" onClick={() => setNotice3D(null)} className="cursor-pointer" aria-label="Đóng thông báo">
              <X size={12} />
            </button>
          </div>
        )}

        {selectedExcluded && !activeParcel && !isBatchMode && (
          <ExcludedParcelPanel
            parcel={selectedExcluded}
            onClose={() => setSelectedExcluded(null)}
            onRestore={setRestoreTarget}
          />
        )}

        {restoreTarget && (
          <ExcludeParcelModal
            parcel={restoreTarget}
            mode="RESTORE"
            onClose={() => setRestoreTarget(null)}
            onSuccess={handleLifecycleChanged}
          />
        )}

        {/* Thanh công cụ tác vụ đồng loạt */}
        {isBatchMode && (
          <FloatingBatchActionBar
            selectedCount={selectedParcelIds.size}
            selectedExcludedCount={selectedExcludedIds.size}
            displayedCount={visibleParcels.length}
            maxParcels={BATCH_MAX_PARCELS}
            addressEnabled={ADDRESS_BATCH_ZONES.includes(selectedZone.toUpperCase())}
            onSelectAllDisplayed={() => setSelectedParcelIds(new Set(visibleParcels.map((p) => p.id)))}
            onClearSelection={clearBatchSelection}
            onOpen={setBatchModalMode}
            onExit={exitBatchMode}
          />
        )}

        {batchModalMode && (
          <BatchGisOperationsModal
            initialMode={batchModalMode}
            zoneId={selectedZone}
            parcelIds={Array.from(selectedParcelIds)}
            excludedParcelIds={Array.from(selectedExcludedIds)}
            addressEnabled={ADDRESS_BATCH_ZONES.includes(selectedZone.toUpperCase())}
            onClose={() => {
              setBatchModalMode(null);
              clearBatchSelection();
            }}
            onCompleted={handleLifecycleChanged}
          />
        )}

        {/* Thanh điều khiển nổi xem trước dữ liệu nạp (Floating Import Preview Bar) */}
        {previewImportState && onConfirmImportPreview && onCancelImportPreview && (
          <FloatingImportPreviewBar
            previewState={previewImportState}
            onConfirm={onConfirmImportPreview}
            onCancel={onCancelImportPreview}
          />
        )}

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
            backgroundColor: 'rgb(var(--bg-slate-900))',
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
          <button className="cursor-pointer"
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
      {!hideBottomSheet && !isBatchMode && (
        <ParcelDetailBottomSheet
          activeParcel={activeParcel}
          availableParcels={parcels}
          onClose={() => setActiveParcel(null)}
          onStartSurvey={onStartSurvey}
          onStartPhase2={onStartPhase2}
          onOpenBuildingHub={onOpenBuildingHub}
          onOpenAuditReview={(p) => {
            onOpenAuditReview?.(p);
          }}
          onProposeSplit={(p) => {
            setActiveParcel(null);
            onProposeSplit?.(p);
          }}
          onSwapSuccess={() => {
            setActiveParcel(null);
            onSwapSuccess?.();
          }}
          onParcelExcluded={handleLifecycleChanged}
          absenceRecordedToday={absenceRecordedToday}
          handleOpenGoogleMapsDirections={handleOpenGoogleMapsDirections}
          insights={activeParcel && renderParcelInsights ? renderParcelInsights(activeParcel) : null}
          resurveyTask={activeParcel ? resurveyByParcel.get(activeParcel.id) ?? null : null}
          onOpenResurvey={(task) => setResurveyReportId(task.reportId)}
        />
      )}

      {/* Màn khảo sát bổ sung full màn hình, đưa ra body để không bị khung bản đồ cắt */}
      {resurveyReportId &&
        createPortal(
          <PhotoResurveyScreen
            reportId={resurveyReportId}
            onClose={() => {
              setResurveyReportId(null);
              void reloadResurvey();
            }}
            onChanged={() => void reloadResurvey()}
          />,
          document.body
        )}
    </div>
  );
};
