import React from 'react';
import { usePhase1SurveyStore } from '../store/usePhase1SurveyStore';
import { ArrowLeft } from 'lucide-react';
import clsx from 'clsx';
import { SyncStatusBadge } from './SyncStatusBadge';
import { CloudPhotoStatusBadge } from './CloudPhotoStatusBadge';

export const DEFAULT_STEP_LABELS = [
  '1. Tiếp cận & Ảnh',
  '2. Phỏng vấn chủ hộ',
  '3. Khảo sát các tầng',
  '4. Chốt Burland & Cờ KC',
  '5. Phạm vi & Ranh GIS',
  '6. Bảng điểm ECS & VI',
  '7. Tổng hợp Dashboard',
  '8. Ký biên bản 3 bên',
];

export interface StepWizardNavProps {
  onBackToHome: () => void;
  backLabel?: string;
  stepLabels?: string[];
  themeColor?: 'emerald' | 'indigo' | 'sky' | 'teal';
  leftBadge?: React.ReactNode;
  subtitleBadge?: React.ReactNode;
  onOpenPhotoAuditModal?: () => void;
}

export const StepWizardNav: React.FC<StepWizardNavProps> = ({
  onBackToHome,
  backLabel = 'Về danh sách',
  stepLabels = DEFAULT_STEP_LABELS,
  themeColor = 'emerald',
  leftBadge,
  subtitleBadge,
  onOpenPhotoAuditModal,
}) => {
  const {
    currentStep,
    requestStepNavigation,
    lastSavedAt,
    saveDraftToStorage,
    syncStatus,
    lastSyncedAt,
    isDirty,
    syncDraftToServer,
    releaseDraftLock,
    isReadOnly,
  } = usePhase1SurveyStore();

  const totalSteps = stepLabels.length;

  // Color config according to theme
  const themeClasses = {
    emerald: {
      badge: 'text-emerald-700 bg-emerald-50 border-emerald-200',
      saveBtn: 'text-emerald-700 bg-emerald-50/80 hover:bg-emerald-100 border-emerald-200',
      saveBtnActive: 'bg-emerald-600 text-white border-emerald-600',
      saveIcon: 'text-emerald-600',
      activeTab: 'bg-emerald-700 text-white border-emerald-700 shadow-xs font-bold',
      passedTab: 'bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100/70',
      activeTabBadge: 'bg-white text-emerald-700',
      passedTabBadge: 'bg-emerald-200 text-emerald-800',
    },
    indigo: {
      badge: 'text-indigo-700 bg-indigo-50 border-indigo-200',
      saveBtn: 'text-indigo-700 bg-indigo-50/80 hover:bg-indigo-100 border-indigo-200',
      saveBtnActive: 'bg-indigo-600 text-white border-indigo-600',
      saveIcon: 'text-indigo-600',
      activeTab: 'bg-indigo-700 text-white border-indigo-700 shadow-xs font-bold',
      passedTab: 'bg-indigo-50 text-indigo-800 border-indigo-200 hover:bg-indigo-100/70',
      activeTabBadge: 'bg-white text-indigo-700',
      passedTabBadge: 'bg-indigo-200 text-indigo-800',
    },
    sky: {
      badge: 'text-sky-700 bg-sky-50 border-sky-200',
      saveBtn: 'text-sky-700 bg-sky-50/80 hover:bg-sky-100 border-sky-200',
      saveBtnActive: 'bg-sky-600 text-white border-sky-600',
      saveIcon: 'text-sky-600',
      activeTab: 'bg-sky-700 text-white border-sky-700 shadow-xs font-bold',
      passedTab: 'bg-sky-50 text-sky-800 border-sky-200 hover:bg-sky-100/70',
      activeTabBadge: 'bg-white text-sky-700',
      passedTabBadge: 'bg-sky-200 text-sky-800',
    },
    teal: {
      badge: 'text-teal-700 bg-teal-50 border-teal-200',
      saveBtn: 'text-teal-700 bg-teal-50/80 hover:bg-teal-100 border-teal-200',
      saveBtnActive: 'bg-teal-600 text-white border-teal-600',
      saveIcon: 'text-teal-600',
      activeTab: 'bg-teal-700 text-white border-teal-700 shadow-xs font-bold',
      passedTab: 'bg-teal-50 text-teal-800 border-teal-200 hover:bg-teal-100/70',
      activeTabBadge: 'bg-white text-teal-700',
      passedTabBadge: 'bg-teal-200 text-teal-800',
    },
  }[themeColor];

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
        <div className="flex items-center gap-1.5 sm:gap-2.5 min-w-0 max-w-[45%] sm:max-w-none">
          <button
            type="button"
            onClick={onBackToHome}
            className="inline-flex items-center gap-1 sm:gap-1.5 text-xs sm:text-sm font-semibold text-slate-700 hover:text-slate-900 px-2 sm:px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200/80 transition-colors cursor-pointer shrink-0"
            title={backLabel}
          >
            <ArrowLeft className="w-4 h-4 shrink-0" />
            <span className="hidden sm:inline">{backLabel}</span>
            <span className="sm:hidden text-xs">Về</span>
          </button>
          {leftBadge && <div className="truncate min-w-0">{leftBadge}</div>}
          {subtitleBadge && <div className="hidden md:block truncate min-w-0">{subtitleBadge}</div>}
        </div>

        {/* Auto save badge & photo sync status */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          {onOpenPhotoAuditModal && (
            <CloudPhotoStatusBadge onOpenAuditModal={onOpenPhotoAuditModal} />
          )}
          <SyncStatusBadge
            syncStatus={syncStatus}
            lastSyncedAt={lastSyncedAt || lastSavedAt}
            isDirty={isDirty}
            onManualSync={() => {
              saveDraftToStorage();
              syncDraftToServer();
            }}
            onReleaseLock={releaseDraftLock}
            disabled={isReadOnly}
          />
        </div>
      </div>

      {/* Desktop Step Tabs */}
      <div className="px-4 pb-2 max-w-7xl mx-auto overflow-x-auto no-scrollbar">
        <div className="flex items-center gap-1 min-w-[750px]">
          {stepLabels.map((label, idx) => {
            const stepNum = idx + 1;
            const isPassed = stepNum < currentStep;
            const isCurrent = stepNum === currentStep;

            return (
              <button
                key={stepNum}
                type="button"
                onClick={() => requestStepNavigation(stepNum)}
                className={clsx(
                  'flex-1 py-1.5 px-2 rounded-lg text-xs font-medium text-center transition-all flex items-center justify-center gap-1.5 truncate border cursor-pointer',
                  isCurrent
                    ? themeClasses.activeTab
                    : isPassed
                    ? themeClasses.passedTab
                    : 'bg-slate-50 text-slate-500 border-slate-200 hover:bg-slate-100'
                )}
              >
                <span
                  className={clsx(
                    'w-4 h-4 rounded-full text-[10px] flex items-center justify-center shrink-0 font-bold',
                    isCurrent
                      ? themeClasses.activeTabBadge
                      : isPassed
                      ? themeClasses.passedTabBadge
                      : 'bg-slate-200 text-slate-600'
                  )}
                >
                  {stepNum}
                </span>
                <span className="truncate">{label.includes('. ') ? label.split('. ')[1] : label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </header>
  );
};
