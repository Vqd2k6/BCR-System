import React from 'react';
import { Camera, User } from 'lucide-react';
import { AuditField, withCurrentOption } from '../../../stepwise/ui/AuditField';
import { AuditSubsection } from '../../../stepwise/ui/AuditStepSection';
import { toNumberOrNull } from '../../core/condo-normalize.utils';
import { CondoAbsenceDecisionCard } from '../../core/CondoAbsenceDecisionCard';
import { CondoParentInheritancePanel } from '../../core/CondoParentInheritancePanel';
import { CondoPhotoCard } from '../../core/CondoPhotoCard';
import type {
  CondoAuditStepProps,
  CondoUnitFormState,
} from '../../types/condo-audit.types';
import {
  ABSENCE_DECISION_LABEL,
  buildCondoAbsenceDecision,
  isLeavingCondoAbsence,
  needsCondoAbsenceDecision,
} from '../condo-unit.adapters';

const RESIDENT_STATUS_OPTIONS = [
  { value: 'CHỦ_HỘ_Ở', label: 'Chủ hộ đang ở' },
  { value: 'CHO_THUÊ', label: 'Cho thuê' },
  { value: 'BỎ_TRỐNG_CHƯA_VỀ_Ở', label: 'Bỏ trống / Chưa về ở' },
  { value: 'VẮNG_MẶT_KHÓA_CỬA', label: 'Vắng mặt / Khóa cửa' },
];

const IDENTITY_FIELD_LABELS = {
  ownerName: 'Họ tên',
  ownerPhone: 'SĐT',
  ownerIdCard: 'CCCD',
  unitAreaM2: 'Diện tích',
};

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
  // Ở chế độ xem: với căn vắng, tên/SĐT là KSV điền nháp thì ẩn hoặc gắn nhãn
  // Ở chế độ sửa: cho phép hiển thị đầy đủ giá trị thực tế để Admin có thể sửa hoặc xóa bỏ dữ liệu rác (như CCCD 1111)
  const ownerNameValue = isEditMode
    ? (formState.ownerName ?? '')
    : (isAbsentUnit && hasUnknownOwnerName ? '' : (formState.ownerName ?? ''));
  const ownerPhoneValue = isEditMode
    ? (formState.ownerPhone ?? '')
    : (isAbsentUnit && hasUnknownOwnerPhone ? '' : (formState.ownerPhone ?? ''));
  const { identityOverrideKeys, ksvOriginalIdentity } = formState;
  const getOwnerSuffix = (key: 'ownerName' | 'ownerPhone') =>
    isAbsentUnit && !identityOverrideKeys.includes(key) ? ' (KSV nhập, chưa xác minh)' : '';
  const originalIdentityNotes = identityOverrideKeys.map((key) => {
    const value = ksvOriginalIdentity[key];
    return `${IDENTITY_FIELD_LABELS[key]}: ${value === null || value === '' ? '---' : value}`;
  });
  // Hiệu chỉnh của Admin nằm ở lớp phủ riêng, giá trị KSV giữ nguyên nên rollback được
  const isOwnerInfoEditable = isEditMode;
  const isIdentityEditable = isEditMode && !isAbsentUnit;
  // Admin có thể đổi tình trạng cư trú bất kỳ lúc nào ở chế độ sửa
  const isResidentStatusEditable = isEditMode;

  const isDecisionRequired =
    isEditMode &&
    needsCondoAbsenceDecision(
      formState.absence,
      formState.residentStatus,
      formState.loadedResidentStatus,
      formState.loadedAbsenceState
    );

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

      <AuditSubsection icon={User} title="1.2. Định Danh Căn Hộ & Chủ Hộ" hint="Phiếu KSV: Bước 2 (2.1, 2.2)">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <AuditField
            label="Mã căn hộ"
            value={formState.unitCode}
            mono
            isEditMode={isIdentityEditable}
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
            isEditMode={isIdentityEditable}
            isDirty={isFieldDirty('floorNumber')}
            onChange={(val) => handleFieldChange('floorNumber', 'Tầng căn hộ', toNumberOrNull(val))}
          />
          <AuditField
            label="Diện tích căn hộ"
            type="number"
            unit="m²"
            value={formState.unitAreaM2}
            isEditMode={isOwnerInfoEditable}
            isDirty={isFieldDirty('unitAreaM2')}
            onChange={(val) => handleFieldChange('unitAreaM2', 'Diện tích căn hộ', toNumberOrNull(val))}
          />
          <AuditField
            label="Tình trạng cư trú"
            type="select"
            value={formState.residentStatus}
            options={withCurrentOption(RESIDENT_STATUS_OPTIONS, formState.residentStatus)}
            isEditMode={isResidentStatusEditable}
            isDirty={isFieldDirty('residentStatus')}
            onChange={(val) => handleFieldChange('residentStatus', 'Tình trạng cư trú', val)}
          />
          <AuditField
            label={`Họ tên chủ hộ${getOwnerSuffix('ownerName')}`}
            value={ownerNameValue}
            isEditMode={isOwnerInfoEditable}
            isDirty={isFieldDirty('ownerName')}
            onChange={(val) => handleFieldChange('ownerName', 'Họ tên chủ hộ căn hộ', val)}
          />
          <AuditField
            label={`Số điện thoại${getOwnerSuffix('ownerPhone')}`}
            value={ownerPhoneValue}
            mono
            isEditMode={isOwnerInfoEditable}
            isDirty={isFieldDirty('ownerPhone')}
            onChange={(val) => handleFieldChange('ownerPhone', 'Số điện thoại chủ hộ', val)}
          />
          <AuditField
            label="Số CCCD"
            value={formState.ownerIdCard}
            mono
            isEditMode={isOwnerInfoEditable}
            isDirty={isFieldDirty('ownerIdCard')}
            onChange={(val) => handleFieldChange('ownerIdCard', 'Số CCCD chủ hộ', val)}
          />
        </div>
        {originalIdentityNotes.length > 0 && (
          <p className="text-xs text-slate-500 font-semibold">
            Bản gốc KSV (giữ nguyên, rollback được): {originalIdentityNotes.join(' • ')}
          </p>
        )}
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
        {isDecisionRequired && (
          <CondoAbsenceDecisionCard
            state={state}
            signals={formState.absence.signals}
            isEditMode={isEditMode}
            hasPendingDecision={false}
            isDecisionRequired
            isLeavingAbsence={isLeavingCondoAbsence(formState.absence, formState.loadedAbsenceState)}
            onDecide={(decision, reason) =>
              handleFieldChange('absenceDecision', ABSENCE_DECISION_LABEL, buildCondoAbsenceDecision(decision, reason))
            }
          />
        )}
      </AuditSubsection>
    </>
  );
};
