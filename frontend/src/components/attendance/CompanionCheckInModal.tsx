import React from 'react';
import { CompanionRecord, CompanionCheckInModalProps } from './companion/types';
import { useCompanionCheckInState } from './companion/hooks/useCompanionCheckInState';
import { CompanionModalHeader } from './companion/components/CompanionModalHeader';
import { CompanionVerifiedSummary } from './companion/components/CompanionVerifiedSummary';
import { CompanionCheckInForm } from './companion/components/CompanionCheckInForm';
import { CompanionHistoryList } from './companion/components/CompanionHistoryList';

export type { CompanionRecord, CompanionCheckInModalProps };

export const CompanionCheckInModal: React.FC<CompanionCheckInModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const {
    targetZone,
    todayStr,
    companionName,
    setCompanionName,
    companionRole,
    setCompanionRole,
    companionPhone,
    setCompanionPhone,
    selfieUrl,
    outOfBoundsReason,
    setOutOfBoundsReason,
    cameraActive,
    distanceMeters,
    gpsLoading,
    isSubmitting,
    hasCheckedIn,
    setHasCheckedIn,
    changeCount,
    checkInData,
    companionHistory,
    videoRef,
    getLiveGps,
    handleStartCamera,
    handleStopCamera,
    handleCapturePhoto,
    handleSubmit,
  } = useCompanionCheckInState({ isOpen, onSuccess });

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-[999999] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-4 overflow-y-auto"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="bg-white rounded-2xl w-full max-w-lg shadow-2xl border border-slate-200 overflow-hidden my-auto animate-in fade-in zoom-in-95 duration-200"
        style={{ maxHeight: '92vh', display: 'flex', flexDirection: 'column' }}
      >
        {/* Header */}
        <CompanionModalHeader zoneName={targetZone.zoneName} onClose={onClose} />

        {/* Modal Scrollable Body */}
        <div style={{ padding: '1rem', overflowY: 'auto', flex: 1, display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          {hasCheckedIn && checkInData ? (
            <CompanionVerifiedSummary
              checkInData={checkInData}
              todayStr={todayStr}
              changeCount={changeCount}
              onReCheckIn={() => setHasCheckedIn(false)}
            />
          ) : (
            <CompanionCheckInForm
              changeCount={changeCount}
              distanceMeters={distanceMeters}
              targetZone={targetZone}
              getLiveGps={getLiveGps}
              gpsLoading={gpsLoading}
              companionName={companionName}
              setCompanionName={setCompanionName}
              companionRole={companionRole}
              setCompanionRole={setCompanionRole}
              companionPhone={companionPhone}
              setCompanionPhone={setCompanionPhone}
              cameraActive={cameraActive}
              videoRef={videoRef}
              selfieUrl={selfieUrl}
              handleStartCamera={handleStartCamera}
              handleStopCamera={handleStopCamera}
              handleCapturePhoto={handleCapturePhoto}
              outOfBoundsReason={outOfBoundsReason}
              setOutOfBoundsReason={setOutOfBoundsReason}
              isSubmitting={isSubmitting}
              onClose={onClose}
              onSubmit={handleSubmit}
            />
          )}

          {/* Section: Lịch sử điểm danh cán bộ đi kèm */}
          <CompanionHistoryList companionHistory={companionHistory} />
        </div>
      </div>
    </div>
  );
};
