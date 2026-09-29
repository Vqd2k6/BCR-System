import React, { useState, useEffect, useRef } from 'react';
import { usePhase1SurveyStore } from '../store/usePhase1SurveyStore';
import { Save, ArrowLeft, ArrowRight, Check, ChevronDown } from 'lucide-react';
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
    nextStep,
    prevStep,
    lastSavedAt,
    saveDraftToStorage,
    syncStatus,
    lastSyncedAt,
    isDirty,
    syncDraftToServer,
    releaseDraftLock,
    isReadOnly,
  } = usePhase1SurveyStore();

  const [savedToast, setSavedToast] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const lastScrollYRef = useRef(0);

  // Theo dõi cuộn trang: cuộn xuống -> thu nhỏ, cuộn lên -> hiển thị đầy đủ
  useEffect(() => {
    let ticking = false;
    const handleScroll = () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          const currentScrollY = window.scrollY || document.documentElement.scrollTop;
          const delta = currentScrollY - lastScrollYRef.current;

          if (currentScrollY > 60 && delta > 4) {
            setIsCollapsed(true);
          } else if (delta < -8 || currentScrollY <= 30) {
            setIsCollapsed(false);
          }

          lastScrollYRef.current = currentScrollY;
          ticking = false;
        });
        ticking = true;
      }
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const handleManualSave = () => {
    saveDraftToStorage();
    setSavedToast(true);
    setTimeout(() => setSavedToast(false), 2500);
  };

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

  // Khi cuộn xuống: Chỉ hiển thị thanh mini bar siêu mỏng (~38px) gồm ô thời gian sao lưu và nút sao lưu nhỏ
  if (isCollapsed) {
    return (
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200/80 shadow-xs transition-all duration-300">
        <div className="px-3 py-1.5 flex items-center justify-between gap-2 max-w-7xl mx-auto">
          {/* Bên trái: Huy hiệu bước nhỏ */}
          <div className="flex items-center gap-2">
            <span className={clsx('text-[11px] font-bold px-2 py-0.5 rounded-full border', themeClasses.badge)}>
              Bước {currentStep}/{totalSteps}
            </span>
            <span className="text-xs font-semibold text-slate-700 truncate max-w-[160px] sm:max-w-xs">
              {stepLabels[currentStep - 1] || ''}
            </span>
          </div>

          {/* Ở giữa & bên phải: Ô thời gian sao lưu và nút sao lưu nhỏ */}
          <div className="flex items-center gap-2">
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

            <button
              type="button"
              onClick={prevStep}
              disabled={currentStep === 1}
              className="p-1 text-slate-600 hover:bg-slate-100 disabled:opacity-30 disabled:pointer-events-none rounded border border-slate-200 transition-all cursor-pointer"
              title="Bước trước"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
            </button>

            <button
              type="button"
              onClick={nextStep}
              disabled={currentStep === totalSteps}
              className="p-1 text-slate-600 hover:bg-slate-100 disabled:opacity-30 disabled:pointer-events-none rounded border border-slate-200 transition-all cursor-pointer"
              title="Bước tiếp theo"
            >
              <ArrowRight className="w-3.5 h-3.5" />
            </button>

            <button
              type="button"
              onClick={() => setIsCollapsed(false)}
              className="p-1 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded transition-colors cursor-pointer"
              title="Mở rộng đầy đủ các tab bước"
            >
              <ChevronDown className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </header>
    );
  }

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200/80 shadow-xs transition-all duration-300">
      {/* Top action header */}
      <div className="px-4 py-2.5 flex flex-col sm:flex-row items-center justify-between gap-3 max-w-7xl mx-auto">
        {/* Left Info & Back */}
        <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-start">
          <button
            type="button"
            onClick={onBackToHome}
            className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-semibold text-slate-600 hover:text-slate-900 px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200/80 transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>{backLabel}</span>
          </button>
          {leftBadge}
        </div>

        {/* Step indicator pills on mobile */}
        <div className="flex items-center gap-2">
          {subtitleBadge}
          <span className={clsx('text-xs font-bold px-2.5 py-1 rounded-full border', themeClasses.badge)}>
            Bước {currentStep}/{totalSteps}
          </span>
          <span className="text-xs sm:text-sm font-semibold text-slate-800 hidden sm:inline">
            {stepLabels[currentStep - 1] || ''}
          </span>
        </div>

        {/* Auto save badge & navigation buttons */}
        <div className="flex items-center gap-2">
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

          <button
            type="button"
            onClick={prevStep}
            disabled={currentStep === 1}
            className="p-1.5 text-slate-600 hover:bg-slate-100 disabled:opacity-30 disabled:pointer-events-none rounded-lg border border-slate-200 transition-all cursor-pointer"
            title="Bước trước"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>

          <button
            type="button"
            onClick={nextStep}
            disabled={currentStep === totalSteps}
            className="p-1.5 text-slate-600 hover:bg-slate-100 disabled:opacity-30 disabled:pointer-events-none rounded-lg border border-slate-200 transition-all cursor-pointer"
            title="Bước tiếp theo"
          >
            <ArrowRight className="w-4 h-4" />
          </button>
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
