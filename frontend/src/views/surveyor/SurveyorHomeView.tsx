import React from 'react';
import type { GisParcel } from '../../components/gis/LeafletSweepMap';
import {
  BuildingHubModal,
  type BuildingUnit,
} from '../../components/survey/BuildingHubModal';
import { useSurveyorHomeState } from './home/hooks/useSurveyorHomeState';
import { SurveyorBanner } from './home/components/SurveyorBanner';
import { SurveyorFilterTabs } from './home/components/SurveyorFilterTabs';
import { StatusHelpModal } from './home/components/StatusHelpModal';
import { ParcelListContainer } from './home/components/ParcelListContainer';

export interface SurveyorHomeViewProps {
  parcels: GisParcel[];
  isCheckedInToday: boolean;
  checkInDetails?: { time: string; distance: number; status: string } | null;
  userGps?: { lat: number; lng: number; accuracy?: number } | null;
  onNavigateToMap: (parcelToFocus?: GisParcel) => void;
  onNavigateToCheckIn: () => void;
  onStartPhase1: (parcel: GisParcel, readOnly?: boolean) => void;
  onStartUnitSurvey?: (parcel: GisParcel, unit: BuildingUnit, phase?: 1 | 2) => void;
  onStartPhase2: (parcel: GisParcel) => void;
  onRecordAbsence: (parcel: GisParcel) => void;
  onResumeSurveyPresent?: (parcel: GisParcel) => void;
  onRefresh?: () => void;
}

export const SurveyorHomeView: React.FC<SurveyorHomeViewProps> = ({
  parcels,
  isCheckedInToday,
  checkInDetails,
  userGps,
  onNavigateToMap: _onNavigateToMap,
  onNavigateToCheckIn,
  onStartPhase1,
  onStartUnitSurvey,
  onStartPhase2,
  onRecordAbsence,
  onResumeSurveyPresent,
  onRefresh,
}) => {
  const {
    user,
    canApproveOrReject,
    searchTerm,
    setSearchTerm,
    hubParcel,
    setHubParcel,
    statusFilter,
    setStatusFilter,
    showStatusHelp,
    setShowStatusHelp,
    displayLimit,
    setDisplayLimit,
    todayTarget,
    todayCompleted,
    weekTarget,
    weekCompleted,
    counts,
    filteredParcels,
    handleOpenDirections,
    handleAdminApprove,
    handleAdminReject,
  } = useSurveyorHomeState({
    parcels,
    userGps,
    onRecordAbsence,
    onRefresh,
  });

  return (
    <div
      style={{
        padding: '1rem 1rem 6.5rem 1rem',
        maxWidth: '780px',
        margin: '0 auto',
        display: 'flex',
        flexDirection: 'column',
        gap: '1.15rem',
      }}
    >
      {/* 1. Header Zone Banner & 2. Work Progress Cards */}
      <SurveyorBanner
        user={user}
        isCheckedInToday={isCheckedInToday}
        checkInDetails={checkInDetails}
        onNavigateToCheckIn={onNavigateToCheckIn}
        parcels={parcels}
        onStartPhase1={onStartPhase1}
        todayCompleted={todayCompleted}
        todayTarget={todayTarget}
        weekCompleted={weekCompleted}
        weekTarget={weekTarget}
      />

      {/* 3. Search & Styled Filter Tabs & List Header */}
      <SurveyorFilterTabs
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        statusFilter={statusFilter}
        onStatusFilterChange={setStatusFilter}
        counts={counts}
        filteredCount={filteredParcels.length}
        showStatusHelp={showStatusHelp}
        onToggleStatusHelp={() => setShowStatusHelp((prev) => !prev)}
      />

      {/* 4. Status Guidance Help Box */}
      <StatusHelpModal show={showStatusHelp} />

      {/* 5. Parcel Tasks List with Pagination */}
      <ParcelListContainer
        filteredParcels={filteredParcels}
        displayLimit={displayLimit}
        onLoadMore={() => setDisplayLimit((prev) => prev + 10)}
        onLoadAll={() => setDisplayLimit(filteredParcels.length)}
        canApproveOrReject={canApproveOrReject}
        onStartPhase1={onStartPhase1}
        onStartPhase2={onStartPhase2}
        onOpenHub={(p) => setHubParcel(p)}
        onOpenDirections={handleOpenDirections}
        onAdminApprove={handleAdminApprove}
        onAdminReject={handleAdminReject}
        onResumeSurveyPresent={onResumeSurveyPresent}
      />

      {/* Condominium Hub Modal */}
      {hubParcel && (
        <BuildingHubModal
          parcel={hubParcel}
          onClose={() => setHubParcel(null)}
          onStartMasterSurvey={(p) => {
            setHubParcel(null);
            onStartPhase1(p);
          }}
          onStartUnitSurvey={(p, unit, phase) => {
            setHubParcel(null);
            if (onStartUnitSurvey) {
              onStartUnitSurvey(p, unit, phase);
            } else {
              onStartPhase1(p);
            }
          }}
        />
      )}
    </div>
  );
};
