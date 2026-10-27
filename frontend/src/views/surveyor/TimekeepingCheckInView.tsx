import React from 'react';
import { CheckCircle, AlertTriangle } from 'lucide-react';
import { CompanionCheckInModal } from '../../components/attendance/CompanionCheckInModal';
import { useTimekeepingState } from './timekeeping/hooks/useTimekeepingState';
import { TimekeepingHeader } from './timekeeping/components/TimekeepingHeader';
import { TodayCheckInSummary } from './timekeeping/components/TodayCheckInSummary';
import { CheckInForm } from './timekeeping/components/CheckInForm';
import { AttendanceHistoryTable } from './timekeeping/components/AttendanceHistoryTable';

interface Props {
  isCheckedInToday?: boolean;
  onCheckInSuccess?: (details: { time: string; distance: number; status: string }) => void;
}

export const TimekeepingCheckInView: React.FC<Props> = ({ isCheckedInToday = false, onCheckInSuccess }) => {
  const {
    user,
    gpsLoading,
    gpsCoordinates,
    gpsError,
    distanceMeters,
    selfieUrl,
    outOfBoundsReason,
    setOutOfBoundsReason,
    isSubmitting,
    submitResult,
    history,
    companionHistory,
    historyTab,
    setHistoryTab,
    hasCheckedIn,
    hasCheckedOut,
    checkInDetails,
    checkOutSelfieUrl,
    checkOutNotes,
    setCheckOutNotes,
    isCheckingOut,
    showCompanionModal,
    setShowCompanionModal,
    companionData,
    selectedZoneId,
    setSelectedZoneId,
    targetZone,
    setTargetZone,
    getLiveGps,
    loadCompanionData,
    handleNativeCameraCapture,
    handleCheckInSubmit,
    handleCheckOutSubmit,
    isOutOfBounds,
    isCompanionCheckedIn,
  } = useTimekeepingState({
    isCheckedInToday,
    onCheckInSuccess,
  });

  return (
    <div
      style={{
        padding: '1rem 1rem 6.5rem 1rem',
        maxWidth: '640px',
        margin: '0 auto',
        display: 'flex',
        flexDirection: 'column',
        gap: '1.25rem',
      }}
    >
      {/* 1. Header Info & Assigned Zone Selector */}
      <TimekeepingHeader
        selectedZoneId={selectedZoneId}
        setSelectedZoneId={setSelectedZoneId}
        setTargetZone={setTargetZone}
        getLiveGps={getLiveGps}
        hasCheckedIn={hasCheckedIn}
        gpsLoading={gpsLoading}
      />

      {/* 2. MODE 1: ĐÃ ĐIỂM DANH HÔM NAY (VERIFIED SUMMARY VIEW) */}
      {hasCheckedIn ? (
        <TodayCheckInSummary
          checkInDetails={checkInDetails}
          distanceMeters={distanceMeters}
          targetZone={targetZone}
          gpsCoordinates={gpsCoordinates}
          selfieUrl={selfieUrl}
          user={user}
          outOfBoundsReason={outOfBoundsReason}
          isCompanionCheckedIn={isCompanionCheckedIn}
          companionData={companionData}
          setShowCompanionModal={setShowCompanionModal}
          hasCheckedOut={hasCheckedOut}
          checkOutSelfieUrl={checkOutSelfieUrl}
          checkOutNotes={checkOutNotes}
          setCheckOutNotes={setCheckOutNotes}
          isCheckingOut={isCheckingOut}
          handleNativeCameraCapture={handleNativeCameraCapture}
          handleCheckOutSubmit={handleCheckOutSubmit}
        />
      ) : (
        /* MODE 2: CHƯA ĐIỂM DANH (LIVE GPS SCAN & CAMERA FORM) */
        <CheckInForm
          isOutOfBounds={isOutOfBounds}
          distanceMeters={distanceMeters}
          targetZone={targetZone}
          gpsCoordinates={gpsCoordinates}
          gpsError={gpsError}
          handleNativeCameraCapture={handleNativeCameraCapture}
          selfieUrl={selfieUrl}
          outOfBoundsReason={outOfBoundsReason}
          setOutOfBoundsReason={setOutOfBoundsReason}
          handleCheckInSubmit={handleCheckInSubmit}
          isSubmitting={isSubmitting}
          gpsLoading={gpsLoading}
          isCompanionCheckedIn={isCompanionCheckedIn}
          companionData={companionData}
          setShowCompanionModal={setShowCompanionModal}
        />
      )}

      {/* 3. Submit Result Toast (Auto-dismissed) */}
      {submitResult && (
        <div
          style={{
            padding: '0.75rem 1rem',
            borderRadius: '0.65rem',
            backgroundColor: submitResult.success ? 'rgb(var(--bg-green-50))' : 'rgb(var(--bg-red-50))',
            border: `1px solid ${submitResult.success ? 'rgb(var(--border-green-200))' : 'rgb(var(--border-red-200))'}`,
            color: submitResult.success ? 'rgb(var(--text-green-700))' : 'rgb(var(--text-red-800))',
            fontSize: '0.875rem',
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
          }}
        >
          {submitResult.success ? <CheckCircle size={18} /> : <AlertTriangle size={18} />}
          <span>{submitResult.message}</span>
        </div>
      )}

      {/* 4. SECTION: LỊCH SỬ ĐIỂM DANH (SURVEYOR VS COMPANION) */}
      <AttendanceHistoryTable
        historyTab={historyTab}
        setHistoryTab={setHistoryTab}
        history={history}
        companionHistory={companionHistory}
        user={user}
      />

      {/* 5. Companion Check-In Modal */}
      {showCompanionModal && (
        <CompanionCheckInModal
          isOpen={showCompanionModal}
          zoneId={selectedZoneId}
          onClose={() => {
            setShowCompanionModal(false);
            loadCompanionData();
          }}
          onSuccess={() => {
            setShowCompanionModal(false);
            loadCompanionData();
          }}
        />
      )}
    </div>
  );
};
