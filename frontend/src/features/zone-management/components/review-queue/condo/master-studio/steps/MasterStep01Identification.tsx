import React from 'react';
import { Building2, Camera, DoorOpen, Users } from 'lucide-react';
import { SmartAddressSuggestionCard } from '../../../stepwise/components/SmartAddressSuggestionCard';
import { useAddressStandardization } from '../../../stepwise/hooks/useAddressStandardization';
import { AuditField, withCurrentOption } from '../../../stepwise/ui/AuditField';
import { AuditSubsection } from '../../../stepwise/ui/AuditStepSection';
import { CondoPhotoCard } from '../../core/CondoPhotoCard';
import type {
  CondoAuditStepProps,
  CondoMasterFormState,
} from '../../types/condo-audit.types';

const ACCESS_OPTIONS = [
  { value: 'FULL_100', label: 'Tiếp cận 100% khu vực chung & kỹ thuật' },
  { value: 'PARTIAL', label: 'Tiếp cận một phần (Có phòng kỹ thuật khóa)' },
  { value: 'EXTERNAL_ONLY', label: 'Chỉ khảo sát mặt ngoài khối tháp' },
];

const ADJACENT_SIDES = [
  { key: 'left', label: 'Bên trái' },
  { key: 'right', label: 'Bên phải' },
  { key: 'back', label: 'Phía sau' },
];

const ADDRESS_FIELD_KEYS = ['houseNumber', 'street', 'ward'];

const TEXT_FIELDS: Array<{ key: keyof CondoMasterFormState & string; label: string; mono?: boolean }> = [
  { key: 'buildingName', label: 'Tên thương mại / Khối tháp' },
  { key: 'officialCadastralCode', label: 'Số hiệu tờ / thửa địa chính', mono: true },
  { key: 'houseNumber', label: 'Số nhà / Ký hiệu lô' },
  { key: 'street', label: 'Tên đường' },
  { key: 'ward', label: 'Phường / Xã' },
];

export const MasterStep01Identification: React.FC<CondoAuditStepProps<CondoMasterFormState>> = ({
  isEditMode,
  formState,
  data,
  handleFieldChange,
  handleNestedFieldChange,
  isFieldDirty,
  stagedPhotoActions,
  onUndoPhotoAction,
  onOpenPhotoZoom,
  onOpenPhotoAction,
  onOpenPhotoHistory,
}) => {
  const photosList = [
    { key: 'photoP01', code: 'P-01', type: 'P01_HOUSE_NUMBER', title: 'Biển tên tòa nhà / Số nhà cổng chính', item: formState.photoP01 },
    { key: 'photoP02', code: 'P-02', type: 'P02_MAIN_FACADE', title: 'Mặt đứng chính khối tháp', item: formState.photoP02 },
    { key: 'photoP03', code: 'P-03', type: 'P03_SIDE_OR_REAR', title: 'Mặt bên / Khối đế tiếp giáp', item: formState.photoP03 },
    { key: 'photoP04', code: 'P-04', type: 'P04_CONTEXT_STREET', title: 'Ngữ cảnh đường phố / Hành lang Metro', item: formState.photoP04 },
  ];
  const access = formState.accessLimitation || {};
  const surveyJson = (data.surveyJson || data.survey_data_json || {}) as Record<string, unknown>;
  const {
    zoneId,
    addressEvaluation,
    activeStandardizedAddress,
    isAddressAccepted,
    handleAcceptAddress,
    handleEditAddress,
    handleChangeStandardizedAddress,
  } = useAddressStandardization({
    formState,
    surveyJson,
    data,
    handleFieldChange: (key, label, val) => handleFieldChange(key as keyof CondoMasterFormState & string, label, val),
  });

  return (
    <>
      <AuditSubsection icon={Camera} title="1.1. Bộ Ảnh Định Danh Khối Tháp (P-01 → P-04)">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {photosList.map((photo) => (
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

      <AuditSubsection icon={Building2} title="1.2. Định Danh Pháp Lý Khối Tháp">
        <SmartAddressSuggestionCard
          evaluation={addressEvaluation}
          zoneId={zoneId}
          isEditMode={isEditMode}
          standardizedAddressValue={activeStandardizedAddress}
          isAccepted={isAddressAccepted}
          onAccept={handleAcceptAddress}
          onEdit={handleEditAddress}
          onChangeStandardizedAddress={handleChangeStandardizedAddress}
          onApplyField={(fieldKey, label, val) => handleFieldChange(fieldKey, label, val)}
        />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <AuditField label="Mã thửa dự án" value={formState.projectParcelCode} mono />
          {TEXT_FIELDS.map((field) => {
            const isLockedAddress = isAddressAccepted && ADDRESS_FIELD_KEYS.includes(field.key);
            return (
              <div
                key={field.key}
                className={`transition-all duration-200 ${isLockedAddress ? 'opacity-40 pointer-events-none select-none' : 'opacity-100'}`}
              >
                <AuditField
                  label={field.label}
                  value={formState[field.key] as string}
                  mono={field.mono}
                  isEditMode={isEditMode}
                  isDirty={isFieldDirty(field.key)}
                  onChange={(val) => handleFieldChange(field.key, field.label, val)}
                />
              </div>
            );
          })}
        </div>
      </AuditSubsection>

      <AuditSubsection icon={Users} title="1.3. Ban Quản Lý & Điều Kiện Tiếp Cận">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <AuditField
            label="Đơn vị quản lý vận hành"
            value={formState.managementBoardName}
            isEditMode={isEditMode}
            isDirty={isFieldDirty('managementBoardName')}
            onChange={(val) => handleFieldChange('managementBoardName', 'Đơn vị quản lý vận hành', val)}
          />
          <AuditField
            label="Người đại diện BQL"
            value={formState.managementContactName}
            isEditMode={isEditMode}
            isDirty={isFieldDirty('managementContactName')}
            onChange={(val) => handleFieldChange('managementContactName', 'Đại diện BQL phối hợp', val)}
          />
          <AuditField
            label="Số điện thoại BQL"
            value={formState.managementContactPhone}
            mono
            isEditMode={isEditMode}
            isDirty={isFieldDirty('managementContactPhone')}
            onChange={(val) => handleFieldChange('managementContactPhone', 'SĐT liên hệ BQL', val)}
          />
          <AuditField
            label="Mức độ tiếp cận"
            type="select"
            value={access.type}
            options={withCurrentOption(ACCESS_OPTIONS, access.type)}
            isEditMode={isEditMode}
            isDirty={isFieldDirty('accessLimitation', 'type')}
            onChange={(val) =>
              handleNestedFieldChange('accessLimitation', 'type', 'Mức độ tiếp cận khối tháp', val)
            }
          />
          <AuditField
            label="Ghi chú giới hạn tiếp cận"
            className="md:col-span-2"
            value={access.notes}
            isEditMode={isEditMode}
            isDirty={isFieldDirty('accessLimitation', 'notes')}
            onChange={(val) =>
              handleNestedFieldChange('accessLimitation', 'notes', 'Ghi chú tiếp cận khối tháp', val)
            }
          />
        </div>
      </AuditSubsection>

      <AuditSubsection icon={DoorOpen} title="1.4. Công Trình Lân Cận">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {ADJACENT_SIDES.map((side) => {
            const adjacent = formState.adjacentBuildings?.[side.key];
            return (
              <AuditField
                key={side.key}
                label={side.label}
                value={adjacent?.details ?? adjacent?.note ?? adjacent?.notes ?? ''}
                isEditMode={isEditMode}
                isDirty={isFieldDirty('adjacentBuildings', side.key)}
                onChange={(val) =>
                  handleNestedFieldChange('adjacentBuildings', side.key, `Công trình lân cận: ${side.label}`, {
                    ...adjacent,
                    details: val,
                  })
                }
              />
            );
          })}
        </div>
      </AuditSubsection>
    </>
  );
};
