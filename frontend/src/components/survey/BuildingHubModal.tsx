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
    filteredUnits,
    displayedUnits,
    kpi,
  } = useBuildingHubState({ parcel, onUnitsUpdated });
  const [showCadModal, setShowCadModal] = React.useState(false);

  return (
    <div className="fixed inset-0 z-[99999] bg-slate-100 flex flex-col w-full h-full overflow-hidden animate-in fade-in duration-150">
      {/* 1. Top Navbar (Auto-hide on scroll) */}
      <BuildingHubHeader
        parcel={parcel}
        isHeaderVisible={isHeaderVisible}
        onClose={onClose}
        onOpenMasterView={() => setShowMasterViewModal(true)}
        onOpenCadManagement={() => setShowCadModal(true)}
      />

      {/* 2. Main Scrollable Container */}
      <main
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto p-3.5 sm:p-6 flex flex-col gap-4 max-w-7xl w-full mx-auto"
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

        {/* Quản lý & Danh sách căn hộ con */}
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
          showAddModal={showAddModal}
          onToggleAddModal={setShowAddModal}
          newUnitCode={newUnitCode}
          setNewUnitCode={setNewUnitCode}
          newFloorNumber={newFloorNumber}
          setNewFloorNumber={setNewFloorNumber}
          isSubmittingUnit={isSubmittingUnit}
          onAddUnitSubmit={handleAddUnit}
          displayedUnits={displayedUnits}
          filteredUnits={filteredUnits}
          visibleCount={visibleCount}
          onLoadMore={() => setVisibleCount((prev) => prev + 10)}
          isMasterSurveyDone={isMasterSurveyDone}
          onClose={onClose}
          onStartUnitSurvey={onStartUnitSurvey}
          onOpenCadManagement={() => setShowCadModal(true)}
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
      />

      {/* Modal: Quản lý bản vẽ CAD tầng & chia cắt căn hộ */}
      {showCadModal && (
        <FloorPlanCadManagementModal
          parcel={parcel}
          onClose={() => setShowCadModal(false)}
          onUnitsUpdated={onUnitsUpdated}
          readOnly={!isAdmin}
        />
      )}
    </div>
  );
};
