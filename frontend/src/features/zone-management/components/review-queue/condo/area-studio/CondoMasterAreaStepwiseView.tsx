import React, { useMemo } from 'react';
import { useCondoBaseAuditForm } from '../core/useCondoBaseAuditForm';
import { CondoStepwiseStudioShell } from '../core/CondoStepwiseStudioShell';
import {
  normalizeCondoAreaData,
  recomputeCondoAreaBurlandOnChange,
  buildCondoAreaUpdatesPayload,
} from './condo-area.normalizer';
import { CONDO_AREA_STEPS } from './condo-area.steps-registry';
import type {
  CondoAreaFormState,
  CondoFloorPlanItem,
  CondoParentMasterSummary,
  CondoStudioEntryProps,
} from '../types/condo-audit.types';

export const CondoMasterAreaStepwiseView: React.FC<CondoStudioEntryProps> = ({
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
}) => {
  const stepIds = useMemo(
    () => CONDO_AREA_STEPS.map((s) => s.stepId),
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
  } = useCondoBaseAuditForm<CondoAreaFormState>({
    data,
    stepIds,
    normalizeData: normalizeCondoAreaData,
    recomputeDerivedOnChange: recomputeCondoAreaBurlandOnChange,
    buildUpdatesPayload: buildCondoAreaUpdatesPayload,
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
  const activeElemsCount = formState.structuralElements.filter((e) => !e.isDeleted).length;

  return (
    <CondoStepwiseStudioShell<CondoAreaFormState>
      entityKind="MASTER_AREA"
      entityTitle={formState.areaName || 'Khu vực kỹ thuật / hành lang chung'}
      entityCode={formState.unitCode || data.unitCode || 'MA'}
      entitySubtitle={`Tầng ${formState.floorNumber} • ${activeZonesCount} vùng Z • ${activeElemsCount} cấu kiện E • Burland Grade ${formState.burlandSummary.localMaxGrade}`}
      status={data.status}
      isParentLocked={Boolean(data.parentBuildingInfo?.isLocked)}
      steps={CONDO_AREA_STEPS}
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
        onOpenMasterReportById: onSwitchReportId,
        stagedPhotoActions,
        onUndoPhotoAction,
      }}
    />
  );
};
