import React from 'react';
import { useCondoUnitSurveyStore } from '../store/useCondoUnitSurveyStore';
import { SyncStatusBadge } from '../../survey-phase1/components/SyncStatusBadge';
import { ArrowLeft, Home, Check, Cloud } from 'lucide-react';
import clsx from 'clsx';
import { auditCondoUnitPhotos } from '../utils/condoUnitPhotoAudit';
import { CondoUnitPhotoAuditModal } from './CondoUnitPhotoAuditModal';

export const CONDO_UNIT_STEPS = [
  '1. Đối soát toà mẹ & 2 ảnh',
  '2. Thông tin căn hộ',
  '3. Import CAD & Khuyết tật',
  '4. Tóm tắt & Nộp hồ sơ',
];

interface Props {
  onBackToHub: () => void;
}

export const CondoUnitWizardNav: React.FC<Props> = ({ onBackToHub }) => {
  const {
    currentStep,
    setStep,
    formData,
    syncStatus,
    lastSavedAt,
    syncDraftToServer,
    releaseDraftLock,
  } = useCondoUnitSurveyStore();

  const [isPhotoAuditOpen, setIsPhotoAuditOpen] = React.useState(false);
  const audit = React.useMemo(() => auditCondoUnitPhotos(formData), [formData]);

  const activeUnitLabel = formData.displayCode || formData.unitCode || '---';

  // Map store sync status to SyncStatusBadge props
  const badgeSyncStatus = syncStatus === 'SAVING' ? 'SYNCING' : syncStatus;

  // Xác định trạng thái hoàn thành của từng bước để hiển thị checkmark trực quan
  const isStepDone = (stepNum: number) => {
    switch (stepNum) {
      case 1:
        return Boolean(
          (formData.photoP01?.url || formData.photoP01?.notApplicable) &&
          (formData.photoP04?.url || formData.photoP04?.notApplicable)
        );
      case 2:
        return Boolean(
          formData.unitCode?.trim() &&
          formData.displayCode?.trim() &&
          formData.ownerName?.trim()
        );
      case 3:
        return Boolean(formData.zones && formData.zones.length > 0);
      case 4:
        return Boolean(
          (formData.workingMinutesPhotos && formData.workingMinutesPhotos.length > 0) ||
          formData.ownerFeedback?.trim()
        );
      default:
        return false;
    }
  };

  return (
    <header
      className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200/80 shadow-xs"
      style={{
        paddingTop: 'env(safe-area-inset-top, 0px)',
      }}
    >
      {/* Top action header */}
      <div className="px-2.5 sm:px-4 py-2 flex items-center justify-between gap-1.5 sm:gap-3 max-w-7xl mx-auto">
        {/* Left Info & Back */}
        <div className="flex items-center gap-1.5 sm:gap-2.5 min-w-0 max-w-[55%] sm:max-w-none">
          <button
            type="button"
            onClick={onBackToHub}
            className="inline-flex items-center gap-1 sm:gap-1.5 text-xs sm:text-sm font-semibold text-slate-700 hover:text-slate-900 px-2 sm:px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200/80 transition-colors cursor-pointer shrink-0"
            title="Quay lại danh sách căn hộ"
          >
            <ArrowLeft className="w-4 h-4 shrink-0" />
            <span className="hidden sm:inline">Quay lại Hub</span>
            <span className="sm:hidden text-xs">Về Hub</span>
          </button>

          <div className="flex items-center gap-2 min-w-0">
            <div className="p-1.5 rounded-lg bg-teal-50 border border-teal-200 text-teal-600 shrink-0">
              <Home className="w-4 h-4 sm:w-5 sm:h-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] sm:text-xs font-bold bg-teal-50 text-teal-700 border border-teal-200 px-2 py-0.5 rounded font-mono truncate">
                  CĂN {activeUnitLabel}
                </span>
                <span className="text-[11px] sm:text-xs font-bold text-slate-800 whitespace-nowrap">
                  Tầng {formData.floorNumber ?? 1}
                </span>
              </div>
              <span className="text-[10px] sm:text-[11px] text-slate-500 block truncate max-w-[200px] sm:max-w-[320px]">
                {formData.parentInfo?.buildingName || 'Tòa Chung Cư'}
              </span>
            </div>
          </div>
        </div>

        {/* Auto save badge & Cloud R2 photo sync badge */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {/* Cloud R2 Photo Sync Badge */}
          {audit.total > 0 && (
            <button
              type="button"
              onClick={() => setIsPhotoAuditOpen(true)}
              className={`inline-flex items-center gap-1 sm:gap-1.5 px-2 sm:px-2.5 py-1 rounded-lg text-xs font-bold transition-all shadow-2xs cursor-pointer border ${
                audit.unsynced === 0
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200 hover:bg-emerald-100'
                  : 'bg-amber-50 text-amber-800 border-amber-300 hover:bg-amber-100'
              }`}
              title="Bấm để kiểm toán chi tiết từng ảnh & tải lại lên Cloud R2"
            >
              <Cloud className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">
                {audit.unsynced === 0
                  ? `Cloud R2 (${audit.synced}/${audit.total} ảnh)`
                  : `${audit.unsynced}/${audit.total} ảnh chưa lên Cloud`}
              </span>
              <span className="sm:hidden">
                {audit.unsynced === 0 ? `${audit.total} ảnh` : `${audit.unsynced} chờ sync`}
              </span>
            </button>
          )}

          <SyncStatusBadge
            syncStatus={badgeSyncStatus}
            lastSyncedAt={lastSavedAt}
            isDirty={false}
            onManualSync={() => {
              void syncDraftToServer();
            }}
            onReleaseLock={() => {
              void releaseDraftLock();
            }}
          />
        </div>
      </div>

      {/* 4 Step Tabs */}
      <div className="px-2 sm:px-4 pb-2 max-w-7xl mx-auto overflow-x-auto no-scrollbar" role="tablist">
        <div className="flex items-center gap-1.5 min-w-[560px] sm:min-w-0">
          {CONDO_UNIT_STEPS.map((label, idx) => {
            const stepNum = idx + 1;
            const isPassed = stepNum < currentStep;
            const isCurrent = stepNum === currentStep;
            const completed = isStepDone(stepNum);

            return (
              <button
                key={stepNum}
                type="button"
                role="tab"
                aria-selected={isCurrent}
                id={`condo-unit-tab-step-${stepNum}`}
                onClick={() => setStep(stepNum)}
                className={clsx(
                  'flex-1 py-1.5 px-2 rounded-lg text-xs font-medium text-center transition-all flex items-center justify-center gap-1.5 truncate border cursor-pointer select-none',
                  isCurrent
                    ? 'bg-teal-700 text-white border-teal-700 shadow-xs font-bold ring-2 ring-teal-500/30'
                    : isPassed || completed
                    ? 'bg-teal-50 text-teal-800 border-teal-300 hover:bg-teal-100/80 hover:border-teal-400'
                    : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100 hover:text-slate-900'
                )}
                title={`Chuyển tới ${label}`}
              >
                <span
                  className={clsx(
                    'w-4 h-4 rounded-full text-[10px] flex items-center justify-center shrink-0 font-bold transition-all',
                    isCurrent
                      ? 'bg-white text-teal-700'
                      : completed
                      ? 'bg-emerald-600 text-white'
                      : isPassed
                      ? 'bg-teal-200 text-teal-800'
                      : 'bg-slate-200 text-slate-600'
                  )}
                >
                  {completed && !isCurrent ? (
                    <Check className="w-2.5 h-2.5 stroke-[3]" />
                  ) : (
                    stepNum
                  )}
                </span>
                <span className="truncate">{label.includes('. ') ? label.split('. ')[1] : label}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Modal Kiểm Toán Chi Tiết Toàn Bộ Ảnh Khảo Sát */}
      <CondoUnitPhotoAuditModal
        isOpen={isPhotoAuditOpen}
        onClose={() => setIsPhotoAuditOpen(false)}
        onNavigateToStep={(s) => setStep(s)}
      />
    </header>
  );
};
