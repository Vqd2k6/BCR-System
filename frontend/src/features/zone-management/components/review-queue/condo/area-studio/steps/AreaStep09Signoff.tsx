import React from 'react';
import { CondoSignoffSection } from '../../core/CondoSignoffSection';
import type {
  CondoAreaFormState,
  CondoAuditStepProps,
} from '../../types/condo-audit.types';

export const AreaStep09Signoff: React.FC<CondoAuditStepProps<CondoAreaFormState>> = ({
  formState,
  onOpenPhotoZoom,
}) => (
  <CondoSignoffSection
    signatures={formState.signatures}
    counterpartRole="Đại diện Ban Quản Lý"
    counterpartName={formState.signatures.ownerName}
    onOpenPhotoZoom={onOpenPhotoZoom}
  />
);
