import React from 'react';
import { AuditStep9SignaturesAbsence } from '../../../stepwise/steps/AuditStep9SignaturesAbsence';
import type { AuditStepwiseFormState } from '../../../stepwise/types';
import type {
  CondoAuditStepProps,
  CondoMasterFormState,
} from '../../types/condo-audit.types';

/** Gắn thẳng bước 09 Nhà dân để chữ ký, biên bản và người chứng kiến sửa được như nhau. */
export const MasterStep09Signoff: React.FC<CondoAuditStepProps<CondoMasterFormState>> = ({
  isEditMode,
  formState,
  data,
  handleFieldChange,
  handleNestedFieldChange,
  isFieldDirty,
  stagedPhotoActions,
  onUndoPhotoAction,
  onOpenPhotoZoom,
  onOpenPhotoReplace,
  onOpenPhotoAction,
  onOpenPhotoHistory,
}) => (
  <AuditStep9SignaturesAbsence
    isEditMode={isEditMode}
    formState={formState as unknown as AuditStepwiseFormState}
    data={data}
    absenteeView={{
      isAbsentee: Boolean(data.isRefusedOrAbsent),
      title: 'Ghi Nhận Không Tiếp Cận Được Tòa Nhà (Vắng Đại Diện Ban Quản Lý)',
      description: 'Đại diện Ban Quản Lý vắng mặt tại thời điểm thực địa. Nhật ký tiếp cận và minh chứng được lưu chiểu bên dưới.',
    }}
    handleFieldChange={handleFieldChange}
    handleNestedFieldChange={handleNestedFieldChange}
    isFieldDirty={isFieldDirty}
    stagedPhotoActions={stagedPhotoActions}
    onUndoPhotoAction={onUndoPhotoAction}
    onOpenPhotoZoom={onOpenPhotoZoom}
    onOpenPhotoReplace={onOpenPhotoReplace}
    onOpenPhotoAction={onOpenPhotoAction}
    onOpenPhotoHistory={onOpenPhotoHistory}
  />
);
