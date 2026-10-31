import React, { useMemo } from 'react';
import { Clock, UserX } from 'lucide-react';
import { AbsenceVerificationPanel } from '../../../stepwise/components/AbsenceVerificationPanel';
import { AuditStep9SignaturesAbsence } from '../../../stepwise/steps/AuditStep9SignaturesAbsence';
import type { AuditStepwiseFormState } from '../../../stepwise/types';
import { AuditField, withCurrentOption } from '../../../stepwise/ui/AuditField';
import { AuditSubsection } from '../../../stepwise/ui/AuditStepSection';
import { CondoAbsenceDecisionCard } from '../../core/CondoAbsenceDecisionCard';
import { CondoAbsentExcludedDataPanel } from '../../core/CondoAbsentExcludedDataPanel';
import { CondoPhotoCard } from '../../core/CondoPhotoCard';
import { toNumberOrNull, toRecord } from '../../core/condo-normalize.utils';
import { adaptUnitAbsentee } from '../condo-unit.adapters';
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

  const handleDecide = (decision: CondoAbsenceDecisionValue, reason: string) => {
    handleFieldChange('absenceDecision', 'Quyết định phân loại vắng chủ', {
      decision,
      reason,
      decidedAt: new Date().toISOString(),
    });
  };

  return (
    <>
      <AuditStep9SignaturesAbsence
        isEditMode={isEditMode}
        formState={formState as unknown as AuditStepwiseFormState}
        data={data}
        absenteeView={absenteeView}
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

      {!absence.isHardAbsent && (
        <CondoAbsenceDecisionCard
          state={absence.state}
          signals={absence.signals}
          isEditMode={isEditMode}
          onDecide={handleDecide}
        />
      )}

      {formState.isRefusedOrAbsent && <CondoAbsentExcludedDataPanel formState={formState} />}

      {formState.isRefusedOrAbsent && (
        <section className="mt-6 p-4 sm:p-5 bg-white rounded-2xl border border-slate-200 shadow-xs">
        <AuditSubsection icon={UserX} title="Xác Thực Hồ Sơ Vắng Chủ / Từ Chối Tiếp Cận">
          <div className="p-3.5 rounded-xl border border-purple-200 bg-purple-50/50 space-y-3">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="text-xs text-purple-900">
                Lý do: <strong>{absentee?.reason || '---'}</strong>
              </div>
            </div>

            <AbsenceVerificationPanel
              reportId={reportId}
              unitId={typeof unitInfo.id === 'string' ? unitInfo.id : null}
              entityLabel={`căn hộ ${formState.unitCode}`}
              missingEvidence={data.absenceEvidence?.missing ?? []}
              isVerified={isAlreadyVerified}
              isApproved={data.status === 'APPROVED'}
              onRefresh={onRefresh}
            />
            {absentee && (
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                <AuditField
                  label="Lý do vắng"
                  type="select"
                  className="md:col-span-2"
                  value={absentee.reasonCode}
                  options={withCurrentOption(ABSENCE_REASON_OPTIONS, absentee.reasonCode)}
                  isEditMode={isEditMode && !ksvAbsentee?.reasonCode}
                  isDirty={isFieldDirty('absenteeInfo', 'reasonCode')}
                  onChange={(val) => absenteeField('reasonCode', 'Lý do vắng chủ', val)}
                />
                <AuditField
                  label="Người chứng kiến"
                  value={absentee.witnessName}
                  isEditMode={isEditMode && !ksvAbsentee?.witnessName}
                  isDirty={isFieldDirty('absenteeInfo', 'witnessName')}
                  onChange={(val) => absenteeField('witnessName', 'Người chứng kiến vắng chủ', val)}
                />
                <AuditField
                  label="Vai trò"
                  value={absentee.witnessRole}
                  isEditMode={isEditMode && !ksvAbsentee?.witnessRole}
                  isDirty={isFieldDirty('absenteeInfo', 'witnessRole')}
                  onChange={(val) => absenteeField('witnessRole', 'Vai trò người chứng kiến', val)}
                />
                <AuditField
                  label="Số điện thoại"
                  value={absentee.witnessPhone}
                  mono
                  isEditMode={isEditMode && !ksvAbsentee?.witnessPhone}
                  isDirty={isFieldDirty('absenteeInfo', 'witnessPhone')}
                  onChange={(val) => absenteeField('witnessPhone', 'SĐT người chứng kiến', val)}
                />
                <AuditField
                  label="Số lần tiếp cận"
                  type="number"
                  value={absentee.attemptCount}
                  isEditMode={isEditMode && ksvAbsentee?.attemptCount === null}
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
                <AuditField
                  label="Ghi chú"
                  className="md:col-span-4"
                  value={absentee.notes}
                  isEditMode={isEditMode}
                  isDirty={isFieldDirty('absenteeInfo', 'notes')}
                  onChange={(val) => absenteeField('notes', 'Ghi chú vắng chủ', val)}
                />
              </div>
            )}

            {formState.absenceLogs.length > 0 && (
              <div className="space-y-2">
                <div className="text-xs font-bold text-purple-900 flex items-center gap-1.5">
                  <Clock className="w-3.5 h-3.5" />
                  <span>Nhật ký tiếp cận ({formState.absenceLogs.length} lượt)</span>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-2.5">
                  {formState.absenceLogs.map((log, idx) => (
                    <div key={log.id || idx} className="rounded-xl border border-purple-200 bg-white p-3 text-xs space-y-1">
                      <div className="flex items-center justify-between font-bold text-purple-800">
                        <span>Lượt {log.attemptNumber || log.attempt_number || idx + 1}</span>
                        <span className="font-mono text-[11px]">
                          {log.attemptDate ? new Date(log.attemptDate).toLocaleDateString('vi-VN') : '---'}
                        </span>
                      </div>
                      <p className="text-slate-600 text-[11px]">{log.notes || log.reason || '---'}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {absentee && absentee.photos.length > 0 && (
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {absentee.photos.map((url, idx) => (
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
            )}
          </div>
        </AuditSubsection>
        </section>
      )}
    </>
  );
};
