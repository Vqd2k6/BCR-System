import React from 'react';
import { CheckCircle } from 'lucide-react';
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
    cameraActive,
    hasCheckedIn,
    checkInDetails,
    showCompanionModal,
    setShowCompanionModal,
    companionData,
    isSimulatedGps,
    videoRef,
    selectedZoneId,
    setSelectedZoneId,
    targetZone,
    setTargetZone,
    getLiveGps,
    loadCompanionData,
    handleStartCamera,
    handleStopCamera,
    handleCapturePhoto,
    handleCheckInSubmit,
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
        />
      ) : (
        /* MODE 2: CHƯA ĐIỂM DANH (LIVE GPS SCAN & CAMERA FORM) */
        <CheckInForm
          isOutOfBounds={isOutOfBounds}
          distanceMeters={distanceMeters}
          targetZone={targetZone}
          gpsCoordinates={gpsCoordinates}
          isSimulatedGps={isSimulatedGps}
          cameraActive={cameraActive}
          videoRef={videoRef}
          handleCapturePhoto={handleCapturePhoto}
          handleStopCamera={handleStopCamera}
          handleStartCamera={handleStartCamera}
          selfieUrl={selfieUrl}
          outOfBoundsReason={outOfBoundsReason}
          setOutOfBoundsReason={setOutOfBoundsReason}
          handleCheckInSubmit={handleCheckInSubmit}
          isSubmitting={isSubmitting}
          gpsLoading={gpsLoading}
        />
      )}

      {/* 3. Submit Result Toast (Auto-dismissed) */}
      {submitResult && (
        <div
          style={{
            padding: '0.75rem 1rem',
            borderRadius: '0.65rem',
            backgroundColor: submitResult.success ? '#f0fdf4' : '#fef2f2',
            border: `1px solid ${submitResult.success ? '#bbf7d0' : '#fecaca'}`,
            color: submitResult.success ? '#15803d' : '#991b1b',
            fontSize: '0.875rem',
            fontWeight: 600,
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
          }}
        >
          <CheckCircle size={18} />
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
          onClose={() => {
            setShowCompanionModal(false);
            loadCompanionData();
          }}
          onSuccess={(data) => {
            setShowCompanionModal(false);
            loadCompanionData();
          }}
        />
      )}
    </div>
  );
};
