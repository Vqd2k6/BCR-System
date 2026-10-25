import React from 'react';
import type { AuditStepwiseData } from '../stepwise/types';
import type {
  CondoEntityKind,
  CondoStudioEntryProps,
} from './types/condo-audit.types';
import { CondoMasterStepwiseView } from './master-studio/CondoMasterStepwiseView';
import { CondoMasterAreaStepwiseView } from './area-studio/CondoMasterAreaStepwiseView';
import { CondoUnitStepwiseView } from './unit-studio/CondoUnitStepwiseView';

/**
 * Bộ nhận diện tự động phân hệ Chung cư (Strategy Classifier trên Frontend)
 * Trả về 'BUILDING_MASTER' | 'MASTER_AREA' | 'CONDO_UNIT' hoặc null nếu là Nhà dân (STANDALONE).
 */
export function resolveCondoEntityKind(
  data?: AuditStepwiseData | null
): CondoEntityKind | null {
  if (!data) return null;

  const rawEntityKind = (data as Record<string, unknown>).condoEntityKind as
    | CondoEntityKind
    | undefined;
  if (
    rawEntityKind === 'BUILDING_MASTER' ||
    rawEntityKind === 'MASTER_AREA' ||
    rawEntityKind === 'CONDO_UNIT'
  ) {
    return rawEntityKind;
  }

  const isMasterArea = Boolean(
    data.unitInfo?.unit_type === 'MASTER' ||
      data.reportType === 'MASTER_AREA' ||
      data.unitInfo?.unit_code?.startsWith('M-') ||
      data.unitInfo?.unit_code?.startsWith('MA-')
  );
  if (isMasterArea) return 'MASTER_AREA';

  const isCondoUnit = Boolean(
    data.unitInfo?.unit_type === 'UNIT' ||
      data.reportType === 'CONDO_UNIT' ||
      data.reportType === 'UNIT_CHILD' ||
      data.unitInfo?.unit_code?.startsWith('U-') ||
      Boolean(data.unitId)
  );
  if (isCondoUnit) return 'CONDO_UNIT';

  const isCondoMaster = Boolean(
    (data.buildingType?.includes('CONDO') ||
      data.parentBuildingInfo?.buildingType?.includes('CONDO')) &&
      !data.unitId &&
      (data.reportType === 'CONDO_MASTER' ||
        data.reportType === 'BUILDING_MASTER' ||
        !data.reportType)
  );
  if (isCondoMaster) return 'BUILDING_MASTER';

  return null;
}

export const CondoAuditStudioEntry: React.FC<CondoStudioEntryProps> = (props) => {
  const kind = resolveCondoEntityKind(props.data) || 'CONDO_UNIT';

  switch (kind) {
    case 'BUILDING_MASTER':
      return <CondoMasterStepwiseView {...props} />;
    case 'MASTER_AREA':
      return <CondoMasterAreaStepwiseView {...props} />;
    case 'CONDO_UNIT':
    default:
      return <CondoUnitStepwiseView {...props} />;
  }
};

