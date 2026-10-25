import React from 'react';
import { CondoZonesDefectsCrudEditor } from '../../core/CondoZonesDefectsCrudEditor';
import type {
  CondoAreaFormState,
  CondoAuditStepProps,
} from '../../types/condo-audit.types';

export const AreaStep3DamageZones: React.FC<
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
    <CondoZonesDefectsCrudEditor
      isEditMode={isEditMode}
      zones={formState.damageZones}
      defaultFloorName={
        formState.floorNumber < 0
          ? `Hầm B${Math.abs(formState.floorNumber)}`
          : `Tầng ${formState.floorNumber}`
      }
      onChangeZones={(nextZones, actionLabel) =>
        handleFieldChange('damageZones', actionLabel, nextZones)
      }
      onOpenPhotoZoom={onOpenPhotoZoom}
      onOpenPhotoAction={onOpenPhotoAction}
      onOpenPhotoHistory={onOpenPhotoHistory}
    />
  );
};

