import React, { useMemo } from 'react';
import { useCondoBaseAuditForm } from '../core/useCondoBaseAuditForm';
import { CondoStepwiseStudioShell } from '../core/CondoStepwiseStudioShell';
import {
  normalizeCondoMasterData,
  recomputeCondoMasterScoresOnChange,
} from './condo-master.normalizer';
import { CONDO_MASTER_STEPS } from './condo-master.steps-registry';
import type {
  CondoFloorPlanItem,
  CondoMasterFormState,
  CondoParentMasterSummary,
  CondoStudioEntryProps,
} from '../types/condo-audit.types';

export const CondoMasterStepwiseView: React.FC<CondoStudioEntryProps> = ({
  data,
  reportId,
  onOpenPhotoZoom,
  onOpenPhotoReplace,
  onOpenPhotoAction,
  onOpenPhotoHistory,
  onOpenDiffModal,
  onOpenEngineeringJudgement,
  onDirtyChange,
  stagedPhotoActions = [],
  onUndoPhotoAction,
}) => {
  const stepIds = useMemo(
    () => CONDO_MASTER_STEPS.map((s) => s.stepId),
    []
  );

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
  } = useCondoBaseAuditForm<CondoMasterFormState>({
    data,
    stepIds,
    normalizeData: normalizeCondoMasterData,
    recomputeDerivedOnChange: recomputeCondoMasterScoresOnChange,
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

  return (
    <CondoStepwiseStudioShell<CondoMasterFormState>
      entityKind="BUILDING_MASTER"
      entityTitle={formState.buildingName || data.houseNumber || 'Khối Tháp Chung Cư'}
      entityCode={formState.projectParcelCode || data.projectParcelCode || reportId}
      entitySubtitle={`${formState.aboveFloors} tầng nổi / ${formState.undergroundFloors} hầm • Hạng móng CAT ${formState.foundationCatScore}`}
      status={data.status}
      isParentLocked={Boolean(data.parentBuildingInfo?.isLocked)}
      steps={CONDO_MASTER_STEPS}
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
        stagedPhotoActions,
        onUndoPhotoAction,
      }}
    />
  );
};

