import React from 'react';
import { CondoStructuralElementsCrudEditor } from '../../core/CondoStructuralElementsCrudEditor';
import type {
  CondoAreaFormState,
  CondoAuditStepProps,
} from '../../types/condo-audit.types';

export const AreaStep4StructuralElements: React.FC<
  CondoAuditStepProps<CondoAreaFormState>
> = ({
  isEditMode,
  formState,
  handleFieldChange,
  onOpenPhotoZoom,
  onOpenPhotoAction,
  onOpenPhotoHistory,
}) => {
  return (
    <CondoStructuralElementsCrudEditor
      isEditMode={isEditMode}
      elements={formState.structuralElements}
      defaultFloorName={
        formState.floorNumber < 0
          ? `Hầm B${Math.abs(formState.floorNumber)}`
          : `Tầng ${formState.floorNumber}`
      }
      onChangeElements={(nextElements, actionLabel) =>
        handleFieldChange('structuralElements', actionLabel, nextElements)
      }
      onOpenPhotoZoom={onOpenPhotoZoom}
      onOpenPhotoAction={onOpenPhotoAction}
      onOpenPhotoHistory={onOpenPhotoHistory}
    />
  );
};

