import React from 'react';
import { Building2, ExternalLink, Lock } from 'lucide-react';
import { AuditField } from '../../stepwise/ui/AuditField';
import type { AuditStepwiseData } from '../../stepwise/types';
import type { CondoParentMasterSummary } from '../types/condo-audit.types';
import { firstNonEmptyString } from './condo-normalize.utils';

interface CondoParentInheritancePanelProps {
  data: AuditStepwiseData;
  parent?: CondoParentMasterSummary;
  onOpenMasterReportById?: (masterReportId: string) => void;
}

/** Thông số kế thừa từ Tòa nhà mẹ, luôn chỉ đọc. */
export const CondoParentInheritancePanel: React.FC<CondoParentInheritancePanelProps> = ({
  data,
  parent,
  onOpenMasterReportById,
}) => {
  const parentInfo = data.parentBuildingInfo;
  const masterReportId = firstNonEmptyString(parent?.masterReportId, parentInfo?.masterReportId);
  const masterStatus = firstNonEmptyString(parent?.masterStatus, parentInfo?.masterStatus);
  const isMasterApproved = masterStatus === 'APPROVED' || masterStatus === 'COMPLETED';
  const isLocked = Boolean(parent?.isLocked || parentInfo?.isLocked);
  const floorsText =
    parent?.aboveFloors !== null && parent?.aboveFloors !== undefined
      ? `${parent.aboveFloors} nổi / ${parent.undergroundFloors ?? parent.basementFloors ?? '---'} hầm`
      : '';

  return (
    <div className="p-3.5 rounded-xl bg-sky-50/50 border border-sky-200 space-y-3">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2 text-xs font-black text-slate-800">
          <Building2 className="w-4 h-4 text-sky-600 shrink-0" />
          <span>Kế thừa từ tòa mẹ: {firstNonEmptyString(parent?.buildingName, parentInfo?.buildingName, data.projectParcelCode) || '---'}</span>
          <span
            className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
              isMasterApproved
                ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                : 'bg-amber-100 text-amber-800 border-amber-300'
            }`}
          >
            {masterStatus || 'Chưa có hồ sơ'}
          </span>
          {isLocked && (
            <span className="text-emerald-700 text-[11px] font-bold flex items-center gap-0.5">
              <Lock className="w-3 h-3" /> Đã khóa sổ
            </span>
          )}
        </div>
        {masterReportId && onOpenMasterReportById && (
          <button
            type="button"
            onClick={() => onOpenMasterReportById(masterReportId)}
            className="px-2.5 py-1 rounded-lg bg-white hover:bg-sky-100 border border-sky-200 text-sky-800 text-[11px] font-bold flex items-center gap-1 cursor-pointer"
          >
            <ExternalLink className="w-3 h-3" />
            <span>Mở Hồ Sơ Tòa Mẹ</span>
          </button>
        )}
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <AuditField label="Mã thửa" mono value={firstNonEmptyString(parent?.projectParcelCode, parentInfo?.projectParcelCode, data.projectParcelCode)} />
        <AuditField label="Quy mô" value={floorsText} />
        <AuditField label="Hệ kết cấu" value={parent?.structureSystem} />
        <AuditField label="Hạng móng" value={parent?.foundationCatScore !== null && parent?.foundationCatScore !== undefined ? `CAT ${parent.foundationCatScore}` : ''} />
        <AuditField label="Cự ly tim hầm" unit="m" mono value={parent?.distanceToCenterlineM} />
        <AuditField label="ECS" mono value={parent?.totalEcs} />
        <AuditField label="VI" mono value={parent?.avgVi} />
        <AuditField label="BRA" mono value={parent?.braRating} />
      </div>
    </div>
  );
};
