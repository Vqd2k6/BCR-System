import React from 'react';
import { Camera, MapPin } from 'lucide-react';
import { AuditField, withCurrentOption } from '../../../stepwise/ui/AuditField';
import { AuditSubsection } from '../../../stepwise/ui/AuditStepSection';
import { CondoParentInheritancePanel } from '../../core/CondoParentInheritancePanel';
import { CondoPhotoCard } from '../../core/CondoPhotoCard';
import type {
  CondoAreaFormState,
  CondoAuditStepProps,
} from '../../types/condo-audit.types';

const AREA_CATEGORY_OPTIONS = [
  { value: 'BASEMENT_PARKING', label: 'Tầng hầm để xe / Vách hầm' },
  { value: 'CORRIDOR_LOBBY', label: 'Sảnh chính / Hành lang tầng' },
  { value: 'ELEVATOR_STAIR_CORE', label: 'Lõi thang máy / Thang bộ thoát hiểm' },
  { value: 'TECHNICAL_MEP_ROOM', label: 'Phòng kỹ thuật MEP / Trạm bơm PCCC' },
  { value: 'ROOF_TERRACE', label: 'Tầng mái / Sân thượng kỹ thuật' },
  { value: 'EXTERIOR_PODIUM', label: 'Mặt ngoài khối đế / Khuôn viên' },
];

const ACCESS_STATUS_OPTIONS = [
  { value: 'FULL', label: 'Tiếp cận đầy đủ 100%' },
  { value: 'PARTIAL', label: 'Tiếp cận một phần' },
  { value: 'LOCKED', label: 'Phòng kỹ thuật khóa cửa' },
];

export const AreaStep01Identification: React.FC<CondoAuditStepProps<CondoAreaFormState>> = ({
  isEditMode,
  formState,
  data,
  parentMasterSummary,
  handleFieldChange,
  isFieldDirty,
  stagedPhotoActions,
  onUndoPhotoAction,
  onOpenPhotoZoom,
  onOpenPhotoAction,
  onOpenPhotoHistory,
  onOpenMasterReportById,
}) => {
  const photoHandlers = {
    isEditMode,
    stagedPhotoActions,
    onUndoPhotoAction,
    onOpenPhotoZoom,
    onOpenPhotoAction,
    onOpenPhotoHistory,
  };

  return (
    <>
      <CondoParentInheritancePanel
        data={data}
        parent={parentMasterSummary}
        onOpenMasterReportById={onOpenMasterReportById}
      />

      <AuditSubsection icon={MapPin} title="1.1. Định Danh Phân Vùng Dùng Chung">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <AuditField label="Mã phân vùng" value={formState.unitCode} mono />
          <AuditField
            label="Tên khu vực"
            value={formState.areaName}
            isEditMode={isEditMode}
            isDirty={isFieldDirty('areaName')}
            onChange={(val) => handleFieldChange('areaName', 'Tên khu vực dùng chung', val)}
          />
          <AuditField
            label="Tầng"
            type="number"
            value={formState.floorNumber}
            isEditMode={isEditMode}
            isDirty={isFieldDirty('floorNumber')}
            onChange={(val) => handleFieldChange('floorNumber', 'Tầng khu vực', Number(val))}
          />
          <AuditField
            label="Phân loại khu vực"
            type="select"
            value={formState.areaCategory}
            options={withCurrentOption(AREA_CATEGORY_OPTIONS, formState.areaCategory)}
            isEditMode={isEditMode}
            isDirty={isFieldDirty('areaCategory')}
            onChange={(val) => handleFieldChange('areaCategory', 'Phân loại khu vực', val)}
          />
          <AuditField
            label="Mức độ tiếp cận"
            type="select"
            value={formState.accessStatus}
            options={withCurrentOption(ACCESS_STATUS_OPTIONS, formState.accessStatus)}
            isEditMode={isEditMode}
            isDirty={isFieldDirty('accessStatus')}
            onChange={(val) => handleFieldChange('accessStatus', 'Mức độ tiếp cận', val)}
          />
          <AuditField
            label="Lý do giới hạn tiếp cận"
            value={formState.lockedReason}
            isEditMode={isEditMode}
            isDirty={isFieldDirty('lockedReason')}
            onChange={(val) => handleFieldChange('lockedReason', 'Lý do giới hạn tiếp cận', val)}
          />
          <AuditField
            label="Mô tả vị trí"
            type="textarea"
            className="md:col-span-3"
            value={formState.locationDescription}
            isEditMode={isEditMode}
            isDirty={isFieldDirty('locationDescription')}
            onChange={(val) => handleFieldChange('locationDescription', 'Mô tả vị trí khu vực', val)}
          />
        </div>
      </AuditSubsection>

      <AuditSubsection icon={Camera} title="1.2. Ảnh Tổng Quan Phân Vùng" hint={`${formState.overviewPhotos.length} ảnh`}>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {formState.overviewPhotos.map((url, idx) => (
            <CondoPhotoCard
              key={url}
              {...photoHandlers}
              url={url}
              photoCode={`${formState.unitCode}-OV-0${idx + 1}`}
              title={`Ảnh tổng quan #${idx + 1}`}
              category="FLOOR_OVERVIEW"
              targetPhotoType="AREA_OVERVIEW_PHOTO"
              photoIndex={idx}
              badgeColor="sky"
            />
          ))}
          {isEditMode && (
            <CondoPhotoCard
              {...photoHandlers}
              url=""
              photoCode={`${formState.unitCode}-OV-0${formState.overviewPhotos.length + 1}`}
              title="Bổ sung ảnh tổng quan"
              category="FLOOR_OVERVIEW"
              targetPhotoType="AREA_OVERVIEW_PHOTO"
              badgeColor="sky"
            />
          )}
        </div>
      </AuditSubsection>
    </>
  );
};
