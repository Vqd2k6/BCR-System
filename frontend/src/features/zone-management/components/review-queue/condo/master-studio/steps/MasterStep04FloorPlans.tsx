import React from 'react';
import { Layers } from 'lucide-react';
import { AuditSubsection } from '../../../stepwise/ui/AuditStepSection';
import { CondoPhotoCard } from '../../core/CondoPhotoCard';
import type {
  CondoAuditStepProps,
  CondoFloorPlanItem,
  CondoMasterFormState,
} from '../../types/condo-audit.types';

const getFloorLabel = (plan: CondoFloorPlanItem) =>
  plan.floor_name || (plan.floor_number < 0 ? `B${Math.abs(plan.floor_number)}` : `Tầng ${plan.floor_number}`);

/** Vùng Z, cấu kiện E và Burland của Tòa mẹ nằm ở hồ sơ Khu vực dùng chung; bước này chỉ đối chiếu bản vẽ các tầng. */
export const MasterStep04FloorPlans: React.FC<CondoAuditStepProps<CondoMasterFormState>> = ({
  floorPlans = [],
  onOpenPhotoZoom,
}) => (
  <AuditSubsection icon={Layers} title="4.1. Mặt Bằng CAD Các Tầng" hint={`${floorPlans.length} tầng`}>
    {floorPlans.length === 0 ? (
      <div className="p-4 rounded-xl border border-dashed border-slate-300 text-xs text-slate-500 text-center">
        Chưa có bản vẽ mặt bằng CAD tầng nào được tải lên cho khối tháp này.
      </div>
    ) : (
      <div className="force-light grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
        {floorPlans.map((plan) => (
          <CondoPhotoCard
            key={plan.id}
            isEditMode={false}
            onOpenPhotoZoom={onOpenPhotoZoom}
            url={plan.cad_photo_url || undefined}
            photoCode={getFloorLabel(plan)}
            title={`Mặt bằng CAD ${getFloorLabel(plan)}`}
            category="CAD_FLOOR"
            targetPhotoType="FLOOR_PLAN"
            targetPhotoId={plan.id}
            badgeColor="sky"
          />
        ))}
      </div>
    )}
  </AuditSubsection>
);
