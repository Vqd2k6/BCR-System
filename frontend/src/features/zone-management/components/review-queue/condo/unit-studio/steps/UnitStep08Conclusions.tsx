import React from 'react';
import { AuditField } from '../../../stepwise/ui/AuditField';
import type {
  CondoUnitFormState,
  CondoAuditStepProps,
} from '../../types/condo-audit.types';

export const UnitStep08Conclusions: React.FC<CondoAuditStepProps<CondoUnitFormState>> = ({
  isEditMode,
  formState,
  handleFieldChange,
  isFieldDirty,
}) => (
  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
    <AuditField
      label="Kết luận hiện trạng căn hộ"
      type="textarea"
      rows={4}
      value={formState.summaryConclusions}
      isEditMode={isEditMode}
      isDirty={isFieldDirty('summaryConclusions')}
      onChange={(val) => handleFieldChange('summaryConclusions', 'Kết luận hiện trạng căn hộ', val)}
    />
    <AuditField
      label="Kiến nghị kỹ thuật / Quan trắc"
      type="textarea"
      rows={4}
      value={formState.engineeringRecommendations}
      isEditMode={isEditMode}
      isDirty={isFieldDirty('engineeringRecommendations')}
      onChange={(val) => handleFieldChange('engineeringRecommendations', 'Kiến nghị kỹ thuật căn hộ', val)}
    />
  </div>
);
