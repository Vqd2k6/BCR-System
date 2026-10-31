import React from 'react';
import { Camera, User } from 'lucide-react';
import { AuditField, withCurrentOption } from '../../../stepwise/ui/AuditField';
import { AuditSubsection } from '../../../stepwise/ui/AuditStepSection';
import { toNumberOrNull, toRecord } from '../../core/condo-normalize.utils';
import { CondoParentInheritancePanel } from '../../core/CondoParentInheritancePanel';
import { CondoPhotoCard } from '../../core/CondoPhotoCard';
import type {
  CondoAuditStepProps,
  CondoUnitFormState,
} from '../../types/condo-audit.types';

const RESIDENT_STATUS_OPTIONS = [
  { value: 'CHỦ_HỘ_Ở', label: 'Chủ hộ đang ở' },
  { value: 'CHO_THUÊ', label: 'Cho thuê' },
  { value: 'BỎ_TRỐNG_CHƯA_VỀ_Ở', label: 'Bỏ trống / Chưa về ở' },
  { value: 'VẮNG_MẶT_KHÓA_CỬA', label: 'Vắng mặt / Khóa cửa' },
];

export const UnitStep01Identification: React.FC<CondoAuditStepProps<CondoUnitFormState>> = ({
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
  const { state, hasUnknownOwnerName, hasUnknownOwnerPhone } = formState.absence;
  const isAbsentUnit = state === 'ABSENT';
  // Với căn vắng, tên/SĐT là KSV điền cho qua form: không trình bày như thông tin đã xác minh
  const ownerNameValue = isAbsentUnit && hasUnknownOwnerName && !isEditMode ? '' : formState.ownerName;
  const ownerPhoneValue = isAbsentUnit && hasUnknownOwnerPhone && !isEditMode ? '' : formState.ownerPhone;
  const ownerSuffix = isAbsentUnit ? ' (KSV nhập, chưa xác minh)' : '';
  const unitAreaValue =
    isAbsentUnit && !isEditMode ? toNumberOrNull(toRecord(data.unitInfo).unit_area_m2) : formState.unitAreaM2;

  const photos = [
    { key: 'photoP01', code: 'P-01', type: 'P01_HOUSE_NUMBER', title: 'Biển số cửa căn hộ', item: formState.photoP01 },
    { key: 'photoP04', code: 'P-04', type: 'P04_CONTEXT_STREET', title: 'Cửa & hành lang trước căn hộ', item: formState.photoP04 },
  ];

  return (
    <>
      <CondoParentInheritancePanel
        data={data}
        parent={parentMasterSummary}
        onOpenMasterReportById={onOpenMasterReportById}
      />

      <AuditSubsection icon={Camera} title="1.1. Bộ Ảnh Định Danh Căn Hộ (P-01, P-04)">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {photos.map((photo) => (
            <CondoPhotoCard
              key={photo.code}
              isEditMode={isEditMode}
              stagedPhotoActions={stagedPhotoActions}
              onUndoPhotoAction={onUndoPhotoAction}
              onOpenPhotoZoom={onOpenPhotoZoom}
              onOpenPhotoAction={onOpenPhotoAction}
              onOpenPhotoHistory={onOpenPhotoHistory}
              url={photo.item?.url}
              photoCode={photo.code}
              title={photo.title}
              category="IDENTIFICATION"
              targetPhotoType={photo.type}
              targetPhotoId={photo.key}
              badgeColor="sky"
            />
          ))}
        </div>
      </AuditSubsection>

      <AuditSubsection icon={User} title="1.2. Định Danh Căn Hộ & Chủ Hộ">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <AuditField
            label="Mã căn hộ"
            value={formState.unitCode}
            mono
            isEditMode={isEditMode}
            isDirty={isFieldDirty('unitCode')}
            onChange={(val) => handleFieldChange('unitCode', 'Mã căn hộ', val)}
          />
          <AuditField
            label="Biển số thực tế"
            value={formState.displayCode}
            mono
            isEditMode={isEditMode}
            isDirty={isFieldDirty('displayCode')}
            onChange={(val) => handleFieldChange('displayCode', 'Biển số căn hộ thực tế', val)}
          />
          <AuditField
            label="Tầng"
            type="number"
            value={formState.floorNumber}
            isEditMode={isEditMode}
            isDirty={isFieldDirty('floorNumber')}
            onChange={(val) => handleFieldChange('floorNumber', 'Tầng căn hộ', toNumberOrNull(val))}
          />
          <AuditField
            label="Diện tích căn hộ"
            type="number"
            unit="m²"
            value={unitAreaValue}
            isEditMode={isEditMode}
            isDirty={isFieldDirty('unitAreaM2')}
            onChange={(val) => handleFieldChange('unitAreaM2', 'Diện tích căn hộ', toNumberOrNull(val))}
          />
          <AuditField
            label="Tình trạng cư trú"
            type="select"
            value={formState.residentStatus}
            options={withCurrentOption(RESIDENT_STATUS_OPTIONS, formState.residentStatus)}
            isEditMode={isEditMode}
            isDirty={isFieldDirty('residentStatus')}
            onChange={(val) => handleFieldChange('residentStatus', 'Tình trạng cư trú', val)}
          />
          <AuditField
            label={`Họ tên chủ hộ${ownerSuffix}`}
            value={ownerNameValue}
            isEditMode={isEditMode}
            isDirty={isFieldDirty('ownerName')}
            onChange={(val) => handleFieldChange('ownerName', 'Họ tên chủ hộ căn hộ', val)}
          />
          <AuditField
            label={`Số điện thoại${ownerSuffix}`}
            value={ownerPhoneValue}
            mono
            isEditMode={isEditMode}
            isDirty={isFieldDirty('ownerPhone')}
            onChange={(val) => handleFieldChange('ownerPhone', 'Số điện thoại chủ hộ', val)}
          />
          <AuditField
            label="Số CCCD"
            value={formState.ownerIdCard}
            mono
            isEditMode={isEditMode}
            isDirty={isFieldDirty('ownerIdCard')}
            onChange={(val) => handleFieldChange('ownerIdCard', 'Số CCCD chủ hộ', val)}
          />
        </div>
        {isFieldDirty('unitCode') && (
          <p className="text-xs text-amber-700 font-semibold">
            Mã căn là khóa nhập CAD: nhập lại CAD với mã cũ sẽ tạo căn trùng. Mã báo cáo đã cấp vẫn giữ mã cũ.
          </p>
        )}
        {isFieldDirty('floorNumber') && (
          <p className="text-xs text-amber-700 font-semibold">
            Đổi tầng sẽ xóa vị trí căn trên mặt bằng CAD cũ, cần đặt lại vị trí trong CAD Studio sau khi lưu.
          </p>
        )}
      </AuditSubsection>
    </>
  );
};
