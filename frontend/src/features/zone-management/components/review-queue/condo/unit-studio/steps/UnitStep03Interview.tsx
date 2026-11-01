import React from 'react';
import { History, Radio } from 'lucide-react';
import { AuditField, withCurrentOption } from '../../../stepwise/ui/AuditField';
import { AuditSubsection } from '../../../stepwise/ui/AuditStepSection';
import { isFilled, isInterviewNotesVisible, toNumberOrNull } from '../../core/condo-normalize.utils';
import { isRenovationDescVisible } from '../condo-unit.adapters';
import type {
  CondoAuditStepProps,
  CondoUnitFormState,
} from '../../types/condo-audit.types';

const HISTORY_LEVEL_OPTIONS = [
  { value: '0', label: 'Mức 0 — Không ghi nhận' },
  { value: '1', label: 'Mức 1 — Nhẹ' },
  { value: '2', label: 'Mức 2 — Trung bình' },
  { value: '3', label: 'Mức 3 — Đáng kể' },
];

const HISTORY_ITEMS = [
  { key: 'renovationLoad', notesKey: 'renovationNotes', label: 'Cải tạo gia tăng tải trọng' },
  { key: 'majorRepair', notesKey: 'repairNotes', label: 'Đại tu, sửa chữa lớn' },
  { key: 'pastSettlement', notesKey: 'settlementNotes', label: 'Tiền sử lún, nứt' },
  { key: 'neighborDamage', notesKey: 'neighborNotes', label: 'Ảnh hưởng từ căn lân cận' },
  { key: 'fireFloodIncident', notesKey: 'fireFloodNotes', label: 'Cháy, ngập' },
];

const YES_NO_OPTIONS = [
  { value: 'true', label: 'Có' },
  { value: 'false', label: 'Không' },
];

const USAGE_STATUS_OPTIONS = [
  { value: 'Đầy đủ', label: 'Đầy đủ' },
  { value: 'Đang sử dụng một phần', label: 'Đang sử dụng một phần' },
  { value: 'Bỏ trống - Không sử dụng', label: 'Bỏ trống - Không sử dụng' },
];

export const UnitStep03Interview: React.FC<CondoAuditStepProps<CondoUnitFormState>> = ({
  isEditMode,
  formState,
  handleFieldChange,
  handleNestedFieldChange,
  isFieldDirty,
}) => {
  const history = formState.historyInterview || {};
  const renovation = formState.interiorRenovationHistory;
  const usageStatus = history.usageStatus as string | undefined;
  const rawContinuousOperation = history.continuousOperation247;
  const hasContinuousOperation =
    typeof rawContinuousOperation === 'boolean'
      ? rawContinuousOperation
      : (rawContinuousOperation as { has?: boolean } | undefined)?.has;

  return (
    <>
      <AuditSubsection icon={History} title="3.1. Phỏng Vấn Lịch Sử Căn Hộ" hint="Phiếu KSV: Bước 2 (2.3)">
        <div className="space-y-3">
          {HISTORY_ITEMS.map((item) => {
            const notes = history[item.notesKey] as string | undefined;
            return (
              <div key={item.key} className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <AuditField
                  label={item.label}
                  type="select"
                  value={history[item.key] as number | undefined}
                  options={HISTORY_LEVEL_OPTIONS}
                  isEditMode={isEditMode}
                  isDirty={isFieldDirty('historyInterview', item.key)}
                  onChange={(val) => {
                    const level = toNumberOrNull(val);
                    handleNestedFieldChange('historyInterview', item.key, item.label, level);
                    // Báo cáo vẫn in diễn giải ở Mức 0, nên chỉ ẩn ô là chưa đủ
                    if (!level && isFilled(notes)) {
                      handleNestedFieldChange('historyInterview', item.notesKey, `Diễn giải: ${item.label}`, '');
                    }
                  }}
                />
                {isInterviewNotesVisible(history[item.key], notes) && (
                  <AuditField
                    label="Diễn giải"
                    className="md:col-span-2"
                    value={notes}
                    isEditMode={isEditMode}
                    isDirty={isFieldDirty('historyInterview', item.notesKey)}
                    onChange={(val) =>
                      handleNestedFieldChange('historyInterview', item.notesKey, `Diễn giải: ${item.label}`, val)
                    }
                  />
                )}
              </div>
            );
          })}
          <AuditField
            label="Hiện trạng sử dụng"
            type="select"
            value={usageStatus}
            options={withCurrentOption(USAGE_STATUS_OPTIONS, usageStatus)}
            isEditMode={isEditMode}
            isDirty={isFieldDirty('historyInterview', 'usageStatus')}
            onChange={(val) => handleNestedFieldChange('historyInterview', 'usageStatus', 'Hiện trạng sử dụng căn hộ', val)}
          />
        </div>
      </AuditSubsection>

      <AuditSubsection icon={Radio} title="3.2. Thiết Bị Nhạy Cảm & Cải Tạo Nội Thất" hint="Phiếu KSV: Bước 2 (2.3)">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <AuditField
            label="Có thiết bị nhạy cảm"
            type="select"
            value={String(formState.hasSensitiveEquipment)}
            options={YES_NO_OPTIONS}
            isEditMode={isEditMode}
            isDirty={isFieldDirty('hasSensitiveEquipment')}
            onChange={(val) => {
              const hasEquipment = val === 'true';
              handleFieldChange('hasSensitiveEquipment', 'Có thiết bị nhạy cảm', hasEquipment);
              if (!hasEquipment && isFilled(formState.sensitiveEquipmentDesc)) {
                handleFieldChange('sensitiveEquipmentDesc', 'Mô tả thiết bị nhạy cảm', '');
              }
            }}
          />
          {(formState.hasSensitiveEquipment || isFilled(formState.sensitiveEquipmentDesc)) && (
            <AuditField
              label="Mô tả thiết bị"
              value={formState.sensitiveEquipmentDesc}
              isEditMode={isEditMode}
              isDirty={isFieldDirty('sensitiveEquipmentDesc')}
              onChange={(val) => handleFieldChange('sensitiveEquipmentDesc', 'Mô tả thiết bị nhạy cảm', val)}
            />
          )}
          <AuditField
            label="Đã cải tạo nội thất"
            type="select"
            value={String(renovation.hasRenovated)}
            options={YES_NO_OPTIONS}
            isEditMode={isEditMode}
            isDirty={isFieldDirty('interiorRenovationHistory', 'hasRenovated')}
            onChange={(val) => {
              const hasRenovated = val === 'true';
              handleNestedFieldChange('interiorRenovationHistory', 'hasRenovated', 'Đã cải tạo nội thất', hasRenovated);
              if (!hasRenovated && isFilled(renovation.description)) {
                handleNestedFieldChange('interiorRenovationHistory', 'description', 'Mô tả cải tạo nội thất', '');
              }
            }}
          />
          {isRenovationDescVisible(renovation, history) && (
            <AuditField
              label="Mô tả cải tạo"
              value={renovation.description}
              isEditMode={isEditMode}
              isDirty={isFieldDirty('interiorRenovationHistory', 'description')}
              onChange={(val) =>
                handleNestedFieldChange('interiorRenovationHistory', 'description', 'Mô tả cải tạo nội thất', val)
              }
            />
          )}
          {/* Chỉ đọc: strategy căn hộ không tính lại V6 nên sửa ở đây sẽ lệch điểm */}
          <AuditField
            label="Vận hành liên tục 24/7"
            value={hasContinuousOperation === undefined ? '' : hasContinuousOperation ? 'Có' : 'Không'}
          />
        </div>
      </AuditSubsection>
    </>
  );
};
