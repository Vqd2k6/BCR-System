import React from 'react';
import { CondoBurlandSummaryCard } from '../../core/CondoBurlandSummaryCard';
import type {
  CondoAreaFormState,
  CondoAuditStepProps,
} from '../../types/condo-audit.types';

export const AreaStep05Burland: React.FC<CondoAuditStepProps<CondoAreaFormState>> = ({
  formState,
  onOpenEngineeringJudgement,
}) => (
  <CondoBurlandSummaryCard
    scopeLabel={`Cấp hư hại đại diện phân vùng ${formState.unitCode}`}
    summary={formState.burlandSummary}
    onOpenEngineeringJudgement={onOpenEngineeringJudgement}
  />
);
