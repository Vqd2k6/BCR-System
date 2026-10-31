import React from 'react';
import { AuditStep5SettlementTilt } from '../../../stepwise/steps/AuditStep5SettlementTilt';
import { AuditStep8Conclusions } from '../../../stepwise/steps/AuditStep8Conclusions';
import type { AuditStepwiseFormState } from '../../../stepwise/types';
import type {
  CondoAuditStepProps,
  CondoMasterFormState,
} from '../../types/condo-audit.types';

/** Gắn thẳng các step Nhà dân có cùng cấu trúc dữ liệu với Tòa nhà mẹ. */
const toHouseFormState = (formState: CondoMasterFormState) => formState as unknown as AuditStepwiseFormState;

export const MasterStep02Deformation: React.FC<CondoAuditStepProps<CondoMasterFormState>> = ({
  isEditMode,
  formState,
  handleNestedFieldChange,
  isFieldDirty,
  stagedPhotoActions,
  onUndoPhotoAction,
  onOpenPhotoZoom,
  onOpenPhotoReplace,
  onOpenPhotoAction,
  onOpenPhotoHistory,
}) => (
  <AuditStep5SettlementTilt
    isEditMode={isEditMode}
    formState={toHouseFormState(formState)}
    handleNestedFieldChange={handleNestedFieldChange}
    onOpenPhotoZoom={onOpenPhotoZoom}
    onOpenPhotoReplace={onOpenPhotoReplace}
    onOpenPhotoAction={onOpenPhotoAction}
    onOpenPhotoHistory={onOpenPhotoHistory}
    isFieldDirty={isFieldDirty}
    stagedPhotoActions={stagedPhotoActions}
    onUndoPhotoAction={onUndoPhotoAction}
  />
);

export const MasterStep08Conclusions: React.FC<CondoAuditStepProps<CondoMasterFormState>> = ({
  isEditMode,
  formState,
  handleFieldChange,
  handleNestedFieldChange,
  isFieldDirty,
}) => (
  <AuditStep8Conclusions
    isEditMode={isEditMode}
    formState={toHouseFormState(formState)}
    handleFieldChange={handleFieldChange}
    handleNestedFieldChange={handleNestedFieldChange}
    isFieldDirty={isFieldDirty}
    isScoreUnavailable={formState.vi?.avgVi === undefined && !formState.vi?.viClass}
  />
);
