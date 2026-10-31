import React, { useMemo } from 'react';
import { useCondoBaseAuditForm } from '../core/useCondoBaseAuditForm';
import { CondoStepwiseStudioShell } from '../core/CondoStepwiseStudioShell';
import {
  normalizeCondoUnitData,
  recomputeCondoUnitBurlandOnChange,
  buildCondoUnitUpdatesPayload,
} from './condo-unit.normalizer';
import { resolveCondoAbsenceView } from './condo-unit.adapters';
import { CONDO_UNIT_STEPS } from './condo-unit.steps-registry';
import type {
  CondoFloorPlanItem,
  CondoParentMasterSummary,
  CondoStudioEntryProps,
  CondoUnitFormState,
} from '../types/condo-audit.types';

const ABSENT_UNIT_STEP_IDS = ['step-1', 'step-9'];

export const CondoUnitStepwiseView: React.FC<CondoStudioEntryProps> = ({
  data,
  reportId,
  onOpenPhotoZoom,
  onOpenPhotoReplace,
  onOpenPhotoAction,
  onOpenPhotoHistory,
  onOpenDiffModal,
  onOpenEngineeringJudgement,
  onSwitchReportId,
  onDirtyChange,
  stagedPhotoActions = [],
  onUndoPhotoAction,
  onRefresh,
  registerStudioCommitHandler,
}) => {
  // Căn vắng chỉ có định danh và biên bản: các bước nội thất là dữ liệu điền cho đủ form của hồ sơ cũ
  const isAbsentUnit = resolveCondoAbsenceView(data).state === 'ABSENT';
  const visibleSteps = useMemo(
    () => (isAbsentUnit ? CONDO_UNIT_STEPS.filter((s) => ABSENT_UNIT_STEP_IDS.includes(s.stepId)) : CONDO_UNIT_STEPS),
    [isAbsentUnit]
  );
  const stepIds = useMemo(() => visibleSteps.map((s) => s.stepId), [visibleSteps]);

  const {
    isEditMode,
    setIsEditMode,
    activeStepId,
    scrollToStep,
    formState,
    dirtyCount,
    handleFieldChange,
    handleNestedFieldChange,
    isFieldDirty,
    discardField,
    discardAll,
    computeDiffPayloadAndUpdates,
  } = useCondoBaseAuditForm<CondoUnitFormState>({
    data,
    stepIds,
    registerStudioCommitHandler,
    normalizeData: normalizeCondoUnitData,
    recomputeDerivedOnChange: recomputeCondoUnitBurlandOnChange,
    buildUpdatesPayload: buildCondoUnitUpdatesPayload,
    onDirtyChange,
  });

  const floorPlans = (
    Array.isArray((data as Record<string, unknown>).floorPlans)
      ? (data as Record<string, unknown>).floorPlans
      : Array.isArray((data.leftPane as Record<string, unknown> | undefined)?.floorPlans)
        ? (data.leftPane as Record<string, unknown>).floorPlans
        : []
  ) as CondoFloorPlanItem[];

  const parentMasterSummary = (
    (data as Record<string, unknown>).parentMasterSummary ||
    (data.leftPane as Record<string, unknown> | undefined)?.parentMasterSummary
  ) as CondoParentMasterSummary | undefined;

  const handleSaveDiff = () => {
    const { diffItems, updates } = computeDiffPayloadAndUpdates();
    onOpenDiffModal(diffItems, updates);
  };

  const activeZonesCount = formState.damageZones.filter((z) => !z.isDeleted).length;

  return (
    <CondoStepwiseStudioShell<CondoUnitFormState>
      entityKind="CONDO_UNIT"
      entityTitle={
        formState.ownerName
          ? `Căn hộ ${formState.unitCode} — ${formState.ownerName}`
          : `Căn hộ ${formState.unitCode}`
      }
      entityCode={formState.unitCode || data.unitCode || '---'}
      entitySubtitle={
        isAbsentUnit
          ? `Tầng ${formState.floorNumber ?? '---'} • Không tiếp cận được căn hộ`
          : `Tầng ${formState.floorNumber ?? '---'} • ${activeZonesCount} vùng hư hại Z • Burland Grade ${formState.burlandSummary.localMaxGrade}`
      }
      status={data.status}
      isParentLocked={Boolean(data.parentBuildingInfo?.isLocked)}
      steps={visibleSteps}
      activeStepId={activeStepId}
      onSelectStep={scrollToStep}
      isEditMode={isEditMode}
      onToggleEditMode={() => setIsEditMode(!isEditMode)}
      dirtyCount={dirtyCount}
      stagedPhotoCount={stagedPhotoActions.length}
      onSaveDiff={handleSaveDiff}
      onDiscardAll={() => discardAll(false)}
      onOpenEngineeringJudgement={onOpenEngineeringJudgement}
      stepProps={{
        isEditMode,
        formState,
        data,
        reportId,
        onRefresh,
        parentMasterSummary,
        floorPlans,
        handleFieldChange,
        handleNestedFieldChange,
        isFieldDirty,
        discardField,
        onOpenPhotoZoom,
        onOpenPhotoReplace,
        onOpenPhotoAction,
        onOpenPhotoHistory,
        onOpenEngineeringJudgement,
        onOpenMasterReportById: onSwitchReportId,
        stagedPhotoActions,
        onUndoPhotoAction,
      }}
    />
  );
};

