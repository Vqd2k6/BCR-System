import React from 'react';
import {
  Edit3,
  Save,
  RotateCcw,
  Lock,
  CheckCircle2,
  Sparkles,
  Building2,
  Layers,
  DoorOpen,
} from 'lucide-react';
import type {
  CondoAuditEntityKind,
  CondoAuditStepProps,
  CondoStepRegistryItem,
} from '../types/condo-audit.types';
import { useAuditStudioImgOptional } from '../../stepwise/context/AuditStudioImgContext';

interface CondoStepwiseStudioShellProps<TFormState extends Record<string, unknown>> {
  entityKind: CondoAuditEntityKind;
  entityTitle: string;
  entityCode: string;
  entitySubtitle?: string;
  status?: string;
  isParentLocked?: boolean;
  steps: CondoStepRegistryItem<TFormState>[];
  activeStepId: string;
  onSelectStep: (stepId: string) => void;
  isEditMode: boolean;
  onToggleEditMode: () => void;
  dirtyCount: number;
  stagedPhotoCount?: number;
  onSaveDiff: () => void;
  onDiscardAll: () => void;
  onOpenEngineeringJudgement?: () => void;
  stepProps: CondoAuditStepProps<TFormState>;
}

export function CondoStepwiseStudioShell<TFormState extends Record<string, unknown>>({
  entityKind,
  entityTitle,
  entityCode,
  entitySubtitle,
  status,
  isParentLocked,
  steps,
  activeStepId,
  onSelectStep,
  isEditMode,
  onToggleEditMode,
  dirtyCount,
  stagedPhotoCount = 0,
  onSaveDiff,
  onDiscardAll,
  onOpenEngineeringJudgement,
  stepProps,
}: CondoStepwiseStudioShellProps<TFormState>) {
  const isApproved = status === 'APPROVED';
  const isReadOnlyLocked = Boolean(isParentLocked || isApproved);
  const totalChanges = dirtyCount + stagedPhotoCount;
  const studioImgCtx = useAuditStudioImgOptional();

  // Phím tắt E: Bật/tắt chế độ Edit nhanh khi không đang gõ chữ trong ô nhập liệu
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey || e.repeat) return;
      const target = e.target as HTMLElement | null;
      if (target) {
        const tag = target.tagName.toUpperCase();
        if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || target.isContentEditable) {
          return;
        }
      }
      if (studioImgCtx?.isStudioModalOpen) return;
      if (isReadOnlyLocked) return;

      if (e.code === 'KeyE' || e.key === 'e' || e.key === 'E') {
        e.preventDefault();
        onToggleEditMode();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [studioImgCtx?.isStudioModalOpen, isReadOnlyLocked, onToggleEditMode]);

  const badgeMeta =
    entityKind === 'BUILDING_MASTER'
      ? {
          label: 'HỒ SƠ TÒA NHÀ MẸ (MASTER)',
          icon: Building2,
          color: 'bg-indigo-100 text-indigo-800 border-indigo-300 dark:bg-indigo-950/60 dark:text-indigo-300 dark:border-indigo-800',
        }
      : entityKind === 'MASTER_AREA'
        ? {
            label: 'KHU VỰC DÙNG CHUNG (M-AREA)',
            icon: Layers,
            color: 'bg-amber-100 text-amber-800 border-amber-300 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-800',
          }
        : {
            label: 'CĂN HỘ CON (CONDO UNIT)',
            icon: DoorOpen,
            color: 'bg-teal-100 text-teal-800 border-teal-300 dark:bg-teal-950/60 dark:text-teal-300 dark:border-teal-800',
          };

  const BadgeIcon = badgeMeta.icon;

  return (
    <div className="flex flex-col lg:flex-row gap-4 items-start w-full max-w-[1600px] mx-auto">
      {/* Left Sticky Navigation Sidebar (Step Registry TOC) */}
      <aside className="w-full lg:w-64 shrink-0 lg:sticky lg:top-2 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 p-3 shadow-xs space-y-3">
        <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/70 border border-slate-200/80 dark:border-slate-700/70 space-y-1.5">
          <div className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[10px] font-black border ${badgeMeta.color}`}>
            <BadgeIcon className="w-3 h-3 shrink-0" />
            <span>{badgeMeta.label}</span>
          </div>
          <div className="font-black text-xs text-slate-900 dark:text-slate-100 truncate">
            {entityTitle}
          </div>
          <div className="flex items-center justify-between text-[11px] font-mono text-slate-500 dark:text-slate-400">
            <span>Mã: {entityCode}</span>
            {isParentLocked ? (
              <span className="text-emerald-600 font-bold flex items-center gap-0.5">
                <Lock className="w-3 h-3" /> Đã khóa sổ
              </span>
            ) : isApproved ? (
              <span className="text-emerald-600 font-bold flex items-center gap-0.5">
                <CheckCircle2 className="w-3 h-3" /> Đã duyệt
              </span>
            ) : null}
          </div>
          {entitySubtitle && (
            <div className="text-[11px] text-slate-500 dark:text-slate-400 leading-snug pt-0.5 border-t border-slate-200/60 dark:border-slate-700/60">
              {entitySubtitle}
            </div>
          )}
        </div>

        {/* Nút Studio Img trên đầu Sidebar (nếu có AuditStudioImgProvider) */}
        {studioImgCtx && (
          <button
            type="button"
            onClick={() => studioImgCtx.setIsStudioModalOpen(true)}
            title="Mở Studio Img • Nhấn giữ phím S + Click vào ảnh bất kỳ để chọn/bỏ chọn đưa vào Studio"
            className={`w-full px-3 py-2 rounded-xl text-xs font-bold transition-all flex items-center justify-between cursor-pointer border ${
              studioImgCtx.isHoldingSKey
                ? 'bg-indigo-600 text-white border-indigo-700 ring-2 ring-indigo-400/60 shadow-sm'
                : studioImgCtx.selectedPhotos.length > 0
                  ? 'bg-indigo-50 text-indigo-900 border-indigo-300 hover:bg-indigo-100 shadow-2xs'
                  : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-indigo-50/70 hover:text-indigo-800 hover:border-indigo-200'
            }`}
          >
            <div className="flex items-center gap-1.5 min-w-0">
              <Sparkles
                className={`w-3.5 h-3.5 shrink-0 ${
                  studioImgCtx.isHoldingSKey
                    ? 'text-white animate-pulse'
                    : studioImgCtx.selectedPhotos.length > 0
                      ? 'text-indigo-600'
                      : 'text-slate-500'
                }`}
              />
              <span className="truncate">
                {studioImgCtx.isHoldingSKey ? 'Đang giữ S • Click ảnh' : 'Studio Img'}
              </span>
            </div>
            <span
              className={`text-[10px] font-black px-1.5 py-0.5 rounded-full shrink-0 ${
                studioImgCtx.isHoldingSKey
                  ? 'bg-white/20 text-white'
                  : studioImgCtx.selectedPhotos.length > 0
                    ? 'bg-indigo-600 text-white'
                    : 'bg-slate-200/80 text-slate-600 font-mono'
              }`}
            >
              {studioImgCtx.selectedPhotos.length > 0
                ? `${studioImgCtx.selectedPhotos.length} ảnh`
                : 'S+Click'}
            </span>
          </button>
        )}

        {/* Step Navigation Items */}
        <nav className="space-y-1" aria-label="Các bước thẩm định chung cư">
          {steps.map((step) => {
            const StepIcon = step.icon;
            const isActive = activeStepId === step.stepId;
            const hasDirtyInStep = step.dirtyWatchKeys.some((k) =>
              stepProps.isFieldDirty(k)
            );

            return (
              <button
                key={step.stepId}
                type="button"
                onClick={() => onSelectStep(step.stepId)}
                className={`w-full text-left px-3 py-2.5 rounded-xl text-xs font-bold transition-all flex items-center justify-between gap-2 cursor-pointer ${
                  isActive
                    ? 'bg-indigo-600 text-white shadow-xs'
                    : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <span
                    className={`w-5 h-5 rounded-lg text-[10px] font-black flex items-center justify-center shrink-0 ${
                      isActive
                        ? 'bg-white/20 text-white'
                        : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'
                    }`}
                  >
                    {step.stepNumber}
                  </span>
                  <StepIcon className="w-3.5 h-3.5 shrink-0 opacity-85" />
                  <span className="truncate">{step.navLabel}</span>
                </div>

                {hasDirtyInStep && (
                  <span
                    className={`w-2 h-2 rounded-full shrink-0 ${
                      isActive ? 'bg-amber-300' : 'bg-amber-500'
                    }`}
                    title="Bước này có thông số đã chỉnh sửa chưa lưu"
                  />
                )}
              </button>
            );
          })}
        </nav>

        {/* Quick Edit Mode Control in Sidebar */}
        <div className="pt-2 border-t border-slate-200 dark:border-slate-800 space-y-2">
          {!isReadOnlyLocked ? (
            <button
              type="button"
              onClick={onToggleEditMode}
              title="Phím tắt: nhấn E để bật/tắt chế độ chỉnh sửa"
              className={`w-full px-3 py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer border ${
                isEditMode
                  ? 'bg-amber-500 text-slate-950 border-amber-600 shadow-xs'
                  : 'bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-200 border-slate-200 dark:border-slate-700'
              }`}
            >
              <Edit3 className="w-3.5 h-3.5" />
              <span>{isEditMode ? 'Đang Bật Chỉnh Sửa (CRUD)' : 'Bật Chế Độ Chỉnh Sửa'}</span>
              <kbd className="ml-1 px-1.5 py-0.5 rounded text-[9px] font-mono bg-black/10 border border-black/15">
                E
              </kbd>
            </button>
          ) : (
            <div className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 text-[11px] text-emerald-800 dark:text-emerald-300 font-semibold flex items-center gap-1.5">
              <Lock className="w-3.5 h-3.5 shrink-0 text-emerald-600" />
              <span>Hồ sơ đã khóa bất biến.</span>
            </div>
          )}

          {totalChanges > 0 && (
            <div className="space-y-1.5 pt-1">
              <button
                type="button"
                onClick={onSaveDiff}
                className="w-full px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-black flex items-center justify-center gap-1.5 shadow-sm transition-all cursor-pointer"
              >
                <Save className="w-3.5 h-3.5" />
                <span>Lưu Thay Đổi ({totalChanges})</span>
              </button>
              <button
                type="button"
                onClick={onDiscardAll}
                className="w-full px-3 py-1.5 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 text-[11px] font-bold flex items-center justify-center gap-1 transition-all cursor-pointer"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Hoàn tác nháp</span>
              </button>
            </div>
          )}

          {entityKind === 'BUILDING_MASTER' && onOpenEngineeringJudgement && (
            <button
              type="button"
              onClick={onOpenEngineeringJudgement}
              className="w-full px-3 py-2 rounded-xl bg-indigo-50 dark:bg-indigo-950/50 hover:bg-indigo-100 text-indigo-700 dark:text-indigo-300 border border-indigo-200 dark:border-indigo-800 text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5" />
              <span>Phán Quyết Kỹ Sư Trưởng</span>
            </button>
          )}
        </div>
      </aside>

      {/* Main Stepwise Content Stream (No Duplicate Bottom Footer) */}
      <div className="flex-1 min-w-0 space-y-5 pb-8">
        {steps.map((step) => {
          const StepComponent = step.Component;
          const StepIcon = step.icon;
          const hasDirtyInStep = step.dirtyWatchKeys.some((k) =>
            stepProps.isFieldDirty(k)
          );

          return (
            <section
              key={step.stepId}
              id={step.stepId}
              className="scroll-mt-4 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-xs overflow-hidden"
            >
              {/* Step Section Header */}
              <div className="px-4 sm:px-6 py-3.5 bg-slate-50/90 dark:bg-slate-800/60 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3 flex-wrap">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-indigo-600 text-white font-black text-xs flex items-center justify-center shadow-2xs shrink-0">
                    B{step.stepNumber}
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <StepIcon className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
                      <h2 className="text-sm font-black text-slate-900 dark:text-slate-100">
                        {step.title}
                      </h2>
                      {hasDirtyInStep && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
                          Đã chỉnh sửa
                        </span>
                      )}
                    </div>
                    {step.subtitle && (
                      <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                        {step.subtitle}
                      </p>
                    )}
                  </div>
                </div>

                {!isReadOnlyLocked && (
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={onToggleEditMode}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-bold border transition-all flex items-center gap-1 cursor-pointer ${
                        isEditMode
                          ? 'bg-amber-100 text-amber-900 border-amber-300'
                          : 'bg-white dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-200 dark:border-slate-700 hover:bg-slate-100'
                      }`}
                    >
                      <Edit3 className="w-3 h-3" />
                      <span>{isEditMode ? 'Đang sửa' : 'Sửa bước này'}</span>
                    </button>
                  </div>
                )}
              </div>

              {/* Step Content Body */}
              <div className="p-4 sm:p-6">
                <StepComponent {...stepProps} />
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}

