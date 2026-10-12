import React from 'react';
import type { BuildingUnit, BuildingHubModalProps } from './building-hub/types';
import { useBuildingHubState } from './building-hub/hooks/useBuildingHubState';
import { BuildingHubHeader } from './building-hub/components/BuildingHubHeader';
import { MasterWarningBanner } from './building-hub/components/MasterWarningBanner';
import { BuildingExecutiveDashboard } from './building-hub/components/BuildingExecutiveDashboard';
import { BuildingUnitList } from './building-hub/components/BuildingUnitList';
import { MasterSurveyViewModal } from './building-hub/components/MasterSurveyViewModal';
import { FloorProgressPopover } from './building-hub/components/FloorProgressPopover';
import { FloorPlanCadManagementModal } from './building-hub/components/FloorPlanCadManagementModal';
import { SurveyorCadReadOnlyModal } from './building-hub/components/SurveyorCadReadOnlyModal';
import { SurveyCondoMasterAreaModal } from '../../features/survey-condo-master/components/SurveyCondoMasterAreaModal';
import { useAuth } from '../../context/AuthContext';

export type { BuildingUnit, BuildingHubModalProps };

export const BuildingHubModal: React.FC<BuildingHubModalProps> = ({
  parcel,
  onClose,
  onStartMasterSurvey,
  onStartUnitSurvey,
  onUnitsUpdated,
}) => {
  const { user } = useAuth();
  const isAdmin = user?.role === 'ZONE_ADMIN' || user?.role === 'SUPER_ADMIN';
  const {
    isMasterSurveyDone,
    masterReportData,
    isUpdatePending,
    units,
    loading,
    searchTerm,
    setSearchTerm,
    isSearchFocused,
    setIsSearchFocused,
    selectedFloor,
    setSelectedFloor,
    selectedStatus,
    setSelectedStatus,
    visibleCount,
    setVisibleCount,
    isHeaderVisible,
    handleScroll,
    showAddModal,
    setShowAddModal,
    showFloorProgressPopover,
    setShowFloorProgressPopover,
    showMasterViewModal,
    setShowMasterViewModal,
    updateNotes,
    setUpdateNotes,
    newUnitCode,
    setNewUnitCode,
    newFloorNumber,
    setNewFloorNumber,
    isSubmittingUnit,
    handleAddUnit,
    handleSendMasterUpdate,
    availableFloors,
    activeHubTab,
    setActiveHubTab,
    unitItemsCount,
    masterItemsCount,
    floorsData,
    allFloorsData,
    inspectedUnit,
    setInspectedUnit,
    refetchUnits,
    refetchFloorPlans,
    kpi,
  } = useBuildingHubState({ parcel, onUnitsUpdated });
  const [showCadModal, setShowCadModal] = React.useState(false);
  const [cadModalInitialFloor, setCadModalInitialFloor] = React.useState<number | undefined>(undefined);
  const [selectedMasterAreaUnit, setSelectedMasterAreaUnit] = React.useState<BuildingUnit | null>(null);

  const handleOpenCad = (floorNum?: number) => {
    const targetFloor = floorNum !== undefined
      ? floorNum
      : (allFloorsData.length > 0 ? allFloorsData[0].floorNumber : (availableFloors.length > 0 ? availableFloors[0] : 1));
    setCadModalInitialFloor(targetFloor);
    setShowCadModal(true);
  };

  // Khóa cuộn document.body khi mở Building Hub Modal
  React.useEffect(() => {
    const originalOverflow = document.body.style.overflow;
    const originalPosition = document.body.style.position;
    const originalTop = document.body.style.top;
    const originalWidth = document.body.style.width;
    const scrollY = window.scrollY;

    document.body.style.overflow = 'hidden';
    document.body.style.position = 'fixed';
    document.body.style.top = `-${scrollY}px`;
    document.body.style.width = '100%';

    return () => {
      document.body.style.overflow = originalOverflow;
      document.body.style.position = originalPosition;
      document.body.style.top = originalTop;
      document.body.style.width = originalWidth;
      window.scrollTo(0, scrollY);
    };
  }, []);

  return (
    <div className="fixed top-0 left-0 right-0 bottom-0 z-[99999] bg-slate-100 flex flex-col w-full h-full max-h-[100dvh] overflow-hidden overscroll-none touch-pan-y animate-in fade-in duration-150">
      {/* 1. Top Navbar (Auto-hide on scroll) */}
      <BuildingHubHeader
        parcel={parcel}
        isHeaderVisible={isHeaderVisible}
        isMasterSurveyDone={isMasterSurveyDone}
        onClose={onClose}
        onOpenMasterView={() => setShowMasterViewModal(true)}
        onOpenCadManagement={() => handleOpenCad()}
      />

      {/* 2. Main Scrollable Container */}
      <main
        onScroll={handleScroll}
        className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-3.5 sm:p-6 flex flex-col gap-4 max-w-7xl w-full mx-auto"
      >
        {/* Banner cảnh báo chưa khảo sát tổng quan */}
        <MasterWarningBanner
          parcel={parcel}
          isMasterSurveyDone={isMasterSurveyDone}
          onClose={onClose}
          onStartMasterSurvey={onStartMasterSurvey}
        />

        {/* Executive Dashboard (4 KPI cards) */}
        <BuildingExecutiveDashboard
          completedCount={kpi.completedCount}
          pendingApprovalCount={kpi.pendingApprovalCount}
          inProgressCount={kpi.inProgressCount}
          absentCount={kpi.absentCount}
          totalUnits={kpi.totalUnits}
          onOpenFloorProgress={() => setShowFloorProgressPopover(true)}
        />

        {/* Quản lý & Danh sách căn hộ con / khu vực dùng chung theo tầng (Spatial CAD Hub) */}
        <BuildingUnitList
          parcel={parcel}
          units={units}
          loading={loading}
          searchTerm={searchTerm}
          onSearchChange={setSearchTerm}
          isSearchFocused={isSearchFocused}
          setIsSearchFocused={setIsSearchFocused}
          selectedFloor={selectedFloor}
          onSelectedFloorChange={setSelectedFloor}
          availableFloors={availableFloors}
          selectedStatus={selectedStatus}
          onSelectedStatusChange={setSelectedStatus}
          floorsData={floorsData}
          allFloorsData={allFloorsData}
          inspectedUnit={inspectedUnit}
          onSelectInspectedUnit={setInspectedUnit}
          isAdmin={isAdmin}
          showAddModal={showAddModal}
          onToggleAddModal={setShowAddModal}
          newUnitCode={newUnitCode}
          setNewUnitCode={setNewUnitCode}
          newFloorNumber={newFloorNumber}
          setNewFloorNumber={setNewFloorNumber}
          isSubmittingUnit={isSubmittingUnit}
          onAddUnitSubmit={handleAddUnit}
          isMasterSurveyDone={isMasterSurveyDone}
          onClose={onClose}
          onStartUnitSurvey={onStartUnitSurvey}
          onStartMasterAreaSurvey={(_p, u) => setSelectedMasterAreaUnit(u)}
          onOpenCadManagement={handleOpenCad}
          activeHubTab={activeHubTab}
          onTabChange={setActiveHubTab}
          unitItemsCount={unitItemsCount}
          masterItemsCount={masterItemsCount}
          onUnitStatusUpdated={refetchUnits}
        />
      </main>

      {/* Modal: Xem & Gửi bản cập nhật hạng mục dùng chung */}
      <MasterSurveyViewModal
        isOpen={showMasterViewModal}
        onClose={() => setShowMasterViewModal(false)}
        parcel={parcel}
        isMasterSurveyDone={isMasterSurveyDone}
        masterReportData={masterReportData}
        isUpdatePending={isUpdatePending}
        updateNotes={updateNotes}
        setUpdateNotes={setUpdateNotes}
        onSendMasterUpdate={handleSendMasterUpdate}
        onStartMasterSurvey={onStartMasterSurvey}
        onParentClose={onClose}
        availableFloorsCount={availableFloors.length}
      />

      {/* Popover: Chi tiết tiến độ theo tầng */}
      <FloorProgressPopover
        isOpen={showFloorProgressPopover}
        onClose={() => setShowFloorProgressPopover(false)}
        parcel={parcel}
        availableFloors={availableFloors}
        units={units}
        allFloorsData={allFloorsData}
      />

      {/* Modal: Quản lý bản vẽ CAD tầng & chia cắt căn hộ */}
      {showCadModal && (
        isAdmin ? (
          <FloorPlanCadManagementModal
            parcel={parcel}
            initialFloor={cadModalInitialFloor}
            onClose={() => {
              setShowCadModal(false);
              refetchFloorPlans();
            }}
            onUnitsUpdated={() => {
              refetchUnits();
              refetchFloorPlans();
              if (onUnitsUpdated) onUnitsUpdated();
            }}
            readOnly={false}
          />
        ) : (
          <SurveyorCadReadOnlyModal
            parcel={parcel}
            onClose={() => {
              setShowCadModal(false);
              refetchFloorPlans();
            }}
          />
        )
      )}

      {/* Modal: Khảo sát chi tiết phân vùng dùng chung (Master Area) với CAD Highlight */}
      {selectedMasterAreaUnit && (
        <SurveyCondoMasterAreaModal
          parcel={parcel}
          unit={selectedMasterAreaUnit}
          floorCadUrl={
            allFloorsData.find(
              (f) => Number(f.floorNumber) === Number(selectedMasterAreaUnit.floor_number ?? selectedMasterAreaUnit.floorNumber)
            )?.cadUrl
          }
          floorPlans={allFloorsData
            .filter((f) => Boolean(f.cadUrl))
            .map((f) => ({
              id: `floor-${f.floorNumber}`,
              floor_number: Number(f.floorNumber),
              floor_name: f.floorName || `Tầng ${f.floorNumber}`,
              floor_code: f.floorCode,
              cad_photo_url: f.cadUrl,
            }))}
          onClose={() => {
            setSelectedMasterAreaUnit(null);
            refetchUnits();
            if (onUnitsUpdated) onUnitsUpdated();
          }}
          onSurveyCompleted={() => {
            setSelectedMasterAreaUnit(null);
            refetchUnits();
            if (onUnitsUpdated) onUnitsUpdated();
          }}
        />
      )}
    </div>
  );
};
