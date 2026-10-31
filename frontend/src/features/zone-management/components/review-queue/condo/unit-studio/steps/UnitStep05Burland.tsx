import React from 'react';
import { CondoBurlandSummaryCard } from '../../core/CondoBurlandSummaryCard';
import type {
  CondoAuditStepProps,
  CondoUnitFormState,
} from '../../types/condo-audit.types';

export const UnitStep05Burland: React.FC<CondoAuditStepProps<CondoUnitFormState>> = ({
  formState,
  onOpenEngineeringJudgement,
}) => (
  <CondoBurlandSummaryCard
    scopeLabel={`Cấp hư hại nội bộ căn hộ ${formState.unitCode}`}
    summary={formState.burlandSummary}
    onOpenEngineeringJudgement={onOpenEngineeringJudgement}
  />
);
