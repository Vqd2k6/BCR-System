import React, { useMemo } from 'react';
import { CheckCheck, UserX } from 'lucide-react';
import { AbsenceVerificationPanel } from '../../../stepwise/components/AbsenceVerificationPanel';
import { AuditStep9SignaturesAbsence } from '../../../stepwise/steps/AuditStep9SignaturesAbsence';
import type { AbsentMergedField, CondoAbsentMergeProps } from '../../../stepwise/steps/AuditStep9SignaturesAbsence';
import type { AuditStepwiseFormState } from '../../../stepwise/types';
import { AuditField, withCurrentOption } from '../../../stepwise/ui/AuditField';
import { AuditSubsection } from '../../../stepwise/ui/AuditStepSection';
import { CondoAbsenceDecisionCard } from '../../core/CondoAbsenceDecisionCard';
import { CondoAbsentExcludedDataPanel } from '../../core/CondoAbsentExcludedDataPanel';
import { CondoPhotoCard } from '../../core/CondoPhotoCard';
import { toNumberOrNull, toRecord } from '../../core/condo-normalize.utils';
import {
  ABSENCE_DECISION_LABEL,
  adaptUnitAbsentee,
  buildCondoAbsenceDecision,
  getMeaningfulOwnerFeedback,
  getPhotosOutsideAbsenceLogs,
} from '../condo-unit.adapters';
import type {
  CondoAbsenceDecisionValue,
  CondoAuditStepProps,
  CondoUnitAbsenteeView,
  CondoUnitFormState,
} from '../../types/condo-audit.types';

const ABSENCE_REASON_OPTIONS = [
  { value: 'HOMEOWNER_ABSENT', label: 'Chủ nhà đi vắng / Khóa cửa ngoài' },
  { value: 'UNOCCUPIED_EMPTY', label: 'Căn hộ bỏ trống / Chưa về ở' },
  { value: 'REFUSED_ACCESS', label: 'Chủ nhà hoặc khách thuê từ chối tiếp cận' },
  { value: 'LOCKED_SECURITY', label: 'Căn hộ niêm phong / BQL không có chìa khóa' },
  { value: 'OTHER', label: 'Lý do khác (Ghi rõ tại ghi chú)' },
];

export const UnitStep09SignaturesAbsentee: React.FC<CondoAuditStepProps<CondoUnitFormState>> = ({
  isEditMode,
  formState,
  data,
  reportId,
  handleFieldChange,
  handleNestedFieldChange,
  isFieldDirty,
  discardField,
  hasUnsavedChanges,
  stagedPhotoActions,
  onUndoPhotoAction,
  onOpenPhotoZoom,
  onOpenPhotoReplace,
  onOpenPhotoAction,
  onOpenPhotoHistory,
  onRefresh,
}) => {
  const absentee = formState.absenteeInfo;
  // Sau xác thực, báo cáo chuyển APPROVED; trạng thái vắng chủ nằm ở bản ghi căn hộ
  const unitInfo = toRecord(data.unitInfo);
  const isAlreadyVerified = unitInfo.status === 'POSTPONED_ABSENT_VERIFIED';
  // Giá trị KSV đã khai là chứng cứ gốc nên chỉ đọc; ô hồ sơ cũ còn trống vẫn cho Admin bổ sung kèm diff
  const ksvAbsentee = useMemo(
    () => adaptUnitAbsentee(toRecord(data.surveyJson), formState.absenceLogs),
    [data.surveyJson, formState.absenceLogs]
  );

  const absenteeField = (key: keyof CondoUnitAbsenteeView, label: string, value: unknown) =>
    handleNestedFieldChange('absenteeInfo', key, label, value);

  const absence = formState.absence;
  const absenteeView = {
    isAbsentee: absence.state === 'ABSENT',
    title:
      absence.state === 'ABSENT'
        ? 'Ghi Nhận Không Tiếp Cận Được Căn Hộ (Vắng Chủ)'
        : 'Lịch Sử Tiếp Cận Không Thành Công',
    description:
      absence.state === 'ABSENT'
        ? 'Khảo sát viên không tiếp cận được bên trong căn hộ. Nhật ký tiếp cận và minh chứng được lưu chiểu bên dưới.'
        : 'Các lượt tiếp cận chưa thành công trước khi khảo sát được căn hộ.',
  };

  // Khu vực chung đi qua cùng màn hình nhưng backend không phân loại vắng chủ
  const isAbsenceApplicable = Boolean(toRecord(data).condoAbsence);

  const handleDecide = (decision: CondoAbsenceDecisionValue, reason: string) =>
    handleFieldChange('absenceDecision', ABSENCE_DECISION_LABEL, buildCondoAbsenceDecision(decision, reason));

  const witnessField = (
    key: 'witnessName' | 'witnessRole' | 'witnessPhone',
    label: string,
    value: string
  ): AbsentMergedField => ({
    value,
    // Giá trị KSV đã khai là bản gốc nên không sửa đè, Admin chỉ bổ sung ô còn trống
    isEditable: isEditMode && !ksvAbsentee?.[key],
    isDirty: isFieldDirty('absenteeInfo', key) || isFieldDirty('signatures', key),
    onChange: (val) => {
      absenteeField(key, label, val);
      if (handleNestedFieldChange) {
        handleNestedFieldChange('signatures', key, label, val);
      }
    },
  });

  const extraEvidencePhotos = absentee ? getPhotosOutsideAbsenceLogs(absentee.photos, formState.absenceLogs) : [];
  const condoAbsentMerge: CondoAbsentMergeProps | undefined =
    formState.isRefusedOrAbsent && absentee
      ? {
          witness: {
            name: witnessField('witnessName', 'Người chứng kiến vắng chủ', absentee.witnessName),
            role: witnessField('witnessRole', 'Vai trò người chứng kiến', absentee.witnessRole),
            phone: witnessField('witnessPhone', 'SĐT người chứng kiến', absentee.witnessPhone),
          },
          fieldNotes: {
            value: absentee.notes,
            isEditable: isEditMode,
            isDirty: isFieldDirty('absenteeInfo', 'notes'),
            onChange: (val) => absenteeField('notes', 'Ghi chú vắng chủ', val),
          },
          ownerFeedbackNote: getMeaningfulOwnerFeedback(formState.ownerFeedback),
          extraEvidence: extraEvidencePhotos.length > 0 && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {extraEvidencePhotos.map((url, idx) => (
                <CondoPhotoCard
                  key={url}
                  isEditMode={false}
                  onOpenPhotoZoom={onOpenPhotoZoom}
                  url={url}
                  photoCode={`VC-${String(idx + 1).padStart(2, '0')}`}
                  title={`Minh chứng vắng chủ ${idx + 1}`}
                  category="ABSENTEE"
                  targetPhotoType="ABSENTEE_MINUTES"
                  badgeColor="slate"
                />
              ))}
            </div>
          ),
        }
      : undefined;

  const missingEvidence = data.absenceEvidence?.missing ?? [];
  const hasCompleteEvidence =
    Boolean(data.absenceEvidence) && missingEvidence.length === 0 && !isAlreadyVerified && data.status !== 'APPROVED';

  return (
    <>
      <AuditStep9SignaturesAbsence
        isEditMode={isEditMode}
        formState={formState as unknown as AuditStepwiseFormState}
        data={data}
        absenteeView={absenteeView}
        handleFieldChange={handleFieldChange}
        handleNestedFieldChange={handleNestedFieldChange}
        condoAbsentMerge={condoAbsentMerge}
        isFieldDirty={isFieldDirty}
        stagedPhotoActions={stagedPhotoActions}
        onUndoPhotoAction={onUndoPhotoAction}
        onOpenPhotoZoom={onOpenPhotoZoom}
        onOpenPhotoReplace={onOpenPhotoReplace}
        onOpenPhotoAction={onOpenPhotoAction}
        onOpenPhotoHistory={onOpenPhotoHistory}
      />

      {isAbsenceApplicable && !absence.isHardAbsent && (
        <CondoAbsenceDecisionCard
          state={absence.state}
          signals={absence.signals}
          isEditMode={isEditMode}
          hasPendingDecision={isFieldDirty('absenceDecision')}
          onDecide={handleDecide}
          onUndoDecision={() => discardField('absenceDecision')}
        />
      )}

      {formState.isRefusedOrAbsent && <CondoAbsentExcludedDataPanel formState={formState} />}

      {formState.isRefusedOrAbsent && (
        <section className="mt-6 p-4 sm:p-5 bg-white rounded-2xl border border-slate-200 shadow-xs">
        <AuditSubsection icon={UserX} title="Xác Thực Hồ Sơ Vắng Chủ / Từ Chối Tiếp Cận">
          <div className="p-3.5 rounded-xl border border-purple-200 bg-purple-50/50 space-y-3">
            {hasCompleteEvidence && (
              <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-800">
                <CheckCheck className="w-4 h-4" />
                <span>Đủ minh chứng vắng mặt</span>
              </div>
            )}

            <AbsenceVerificationPanel
              reportId={reportId}
              unitId={typeof unitInfo.id === 'string' ? unitInfo.id : null}
              entityLabel={`căn hộ ${formState.unitCode}`}
              missingEvidence={missingEvidence}
              isVerified={isAlreadyVerified}
              isApproved={data.status === 'APPROVED'}
              hasUnsavedChanges={hasUnsavedChanges}
              onRefresh={onRefresh}
            />
            {absentee && (
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                <AuditField
                  label="Lý do vắng"
                  type="select"
                  value={absentee.reasonCode}
                  options={withCurrentOption(ABSENCE_REASON_OPTIONS, absentee.reasonCode)}
                  isEditMode={isEditMode && !ksvAbsentee?.reasonCode}
                  isDirty={isFieldDirty('absenteeInfo', 'reasonCode')}
                  onChange={(val) => absenteeField('reasonCode', 'Lý do vắng chủ', val)}
                />
                <AuditField
                  label="Số lần tiếp cận"
                  type="number"
                  value={absentee.attemptCount}
                  isEditMode={isEditMode && (ksvAbsentee?.attemptCount ?? null) === null}
                  isDirty={isFieldDirty('absenteeInfo', 'attemptCount')}
                  onChange={(val) => absenteeField('attemptCount', 'Số lần tiếp cận', toNumberOrNull(val))}
                />
                <AuditField
                  label="Đã niêm yết thông báo"
                  type="select"
                  value={String(absentee.noticeDelivered)}
                  options={[
                    { value: 'true', label: 'Có' },
                    { value: 'false', label: 'Không' },
                  ]}
                  isEditMode={isEditMode && !ksvAbsentee?.noticeDelivered}
                  isDirty={isFieldDirty('absenteeInfo', 'noticeDelivered')}
                  onChange={(val) => absenteeField('noticeDelivered', 'Đã niêm yết thông báo', val === 'true')}
                />
                <AuditField
                  label="Hẹn lại"
                  value={absentee.rescheduleDate}
                  isEditMode={isEditMode && !ksvAbsentee?.rescheduleDate}
                  isDirty={isFieldDirty('absenteeInfo', 'rescheduleDate')}
                  onChange={(val) => absenteeField('rescheduleDate', 'Ngày hẹn khảo sát lại', val)}
                />
              </div>
            )}
          </div>
        </AuditSubsection>
        </section>
      )}
    </>
  );
};
