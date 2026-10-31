import React from 'react';
import { Building2, DoorOpen, Layers, Lock, Sparkles } from 'lucide-react';
import type {
  CondoAuditEntityKind,
  CondoAuditStepProps,
  CondoStepRegistryItem,
} from '../types/condo-audit.types';
import { useAuditStudioImgOptional } from '../../stepwise/context/AuditStudioImgContext';
import { AuditStudioSidebar } from '../../stepwise/ui/AuditStudioSidebar';
import { AuditStepSection } from '../../stepwise/ui/AuditStepSection';

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

const ENTITY_META: Record<CondoAuditEntityKind, { label: string; icon: typeof Building2 }> = {
  BUILDING_MASTER: { label: 'Hồ sơ Tòa Nhà Mẹ', icon: Building2 },
  MASTER_AREA: { label: 'Khu Vực Dùng Chung', icon: Layers },
  CONDO_UNIT: { label: 'Căn Hộ Con', icon: DoorOpen },
};

// Ánh xạ cờ cảnh báo của hồ sơ về đúng bước cần kiểm tra trên mục lục
const WARNING_CODE_TO_STEP: Record<string, string> = {
  MASTER_REPORT_NOT_APPROVED: 'step-1',
  MISSING_PHOTO_P01: 'step-1',
  MISSING_PHOTO_P04: 'step-1',
  UPPER_FLOOR_WATER_LEAKAGE: 'step-2',
  DOOR_JAMMING_STRUCTURAL: 'step-2',
  MISSING_SCALE_CARD: 'step-4',
  HIGH_CRACK_WIDTH_UNMARKED: 'step-4',
  ABSENT_WITHOUT_INVITATION_PHOTO: 'step-9',
};

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
  const isReadOnlyLocked = Boolean(isParentLocked || status === 'APPROVED');
  const studioImgCtx = useAuditStudioImgOptional();
  const EntityIcon = ENTITY_META[entityKind].icon;

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

  const warningStepIds = React.useMemo(() => {
    const flags = stepProps.data.auditWarningFlags;
    const stepIds = new Set<string>();
    (Array.isArray(flags) ? flags : []).forEach((flag) => {
      const stepId = WARNING_CODE_TO_STEP[flag.code];
      if (stepId) stepIds.add(stepId);
    });
    return stepIds;
  }, [stepProps.data.auditWarningFlags]);

  return (
    <div className="relative flex flex-col lg:flex-row gap-4 w-full min-h-[600px] min-w-0 max-w-full">
      <AuditStudioSidebar
        heading={`${steps.length} Bước Thẩm Định`}
        steps={steps.map((step) => ({
          id: step.stepId,
          number: step.number,
          title: step.title,
          icon: step.icon,
          hasWarning: warningStepIds.has(step.stepId),
        }))}
        activeStepId={activeStepId}
        onSelectStep={onSelectStep}
        isLocked={isReadOnlyLocked}
        isEditMode={isEditMode}
        onToggleEditMode={onToggleEditMode}
        pendingCount={dirtyCount + stagedPhotoCount}
        stagedPhotoCount={stagedPhotoCount}
        onSave={onSaveDiff}
        onDiscard={onDiscardAll}
        renderTopSlot={(isCollapsed) =>
          isCollapsed ? null : (
            <>
              <div className="px-2.5 py-2 rounded-xl bg-slate-50 border border-slate-200/90 space-y-0.5 shrink-0">
                <div className="flex items-center gap-1.5 text-[10px] font-black text-sky-700">
                  <EntityIcon className="w-3 h-3 shrink-0" />
                  <span className="truncate">{ENTITY_META[entityKind].label}</span>
                </div>
                <div className="text-[11px] font-black text-slate-800 truncate" title={entityTitle}>
                  {entityTitle}
                </div>
                <div className="flex items-center justify-between gap-1 text-[10px] font-mono text-slate-500">
                  <span className="truncate">{entityCode}</span>
                  {isParentLocked && (
                    <span className="text-emerald-700 font-bold flex items-center gap-0.5 shrink-0">
                      <Lock className="w-3 h-3" /> Đã khóa sổ
                    </span>
                  )}
                </div>
                {entitySubtitle && (
                  <div className="text-[10px] text-slate-500 leading-snug pt-0.5">{entitySubtitle}</div>
                )}
              </div>
              {entityKind === 'BUILDING_MASTER' && onOpenEngineeringJudgement && !isReadOnlyLocked && (
                <button
                  type="button"
                  onClick={onOpenEngineeringJudgement}
                  className="w-full px-2.5 py-1.5 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-800 border border-indigo-200 text-[11px] font-bold flex items-center gap-1.5 transition-all cursor-pointer shrink-0"
                >
                  <Sparkles className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                  <span className="truncate">Phán Quyết Kỹ Sư Trưởng</span>
                </button>
              )}
            </>
          )
        }
      />

      <div className="flex-1 space-y-6 min-w-0 max-w-full overflow-x-hidden">
        {steps.map((step) => {
          const StepComponent = step.Component;
          if (step.selfFramed) {
            return <StepComponent key={step.stepId} {...stepProps} />;
          }
          return (
            <AuditStepSection key={step.stepId} id={step.stepId} number={step.number} title={step.title}>
              <StepComponent {...stepProps} />
            </AuditStepSection>
          );
        })}
      </div>
    </div>
  );
}
