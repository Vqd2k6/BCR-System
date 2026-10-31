import React from 'react';
import { Award, Scale } from 'lucide-react';
import { ScoreExplanationPopover } from '../../../stepwise/components/ScoreExplanationPopover';
import { AUDIT_EMPTY_VALUE, AuditField } from '../../../stepwise/ui/AuditField';
import { AuditSubsection } from '../../../stepwise/ui/AuditStepSection';
import { toNumberOrNull } from '../../core/condo-normalize.utils';
import type {
  CondoAuditStepProps,
  CondoMasterFormState,
} from '../../types/condo-audit.types';

const ECS_ROWS = [
  { key: 'e1', label: 'E1 Burland' },
  { key: 'e2', label: 'E2 Kết cấu' },
  { key: 'e3', label: 'E3 Biến dạng' },
  { key: 'e4', label: 'E4 Vật liệu' },
  { key: 'e5', label: 'E5 Lịch sử' },
  { key: 'e6', label: 'E6 Công năng' },
];

const VI_ROWS = [
  { key: 'v1', label: 'V1 Tầm quan trọng' },
  { key: 'v2', label: 'V2 Kết cấu' },
  { key: 'v3', label: 'V3 Móng' },
  { key: 'v4', label: 'V4 Tuổi công trình' },
  { key: 'v5', label: 'V5 Hiện trạng' },
  { key: 'v6', label: 'V6 Nhạy cảm' },
];

export const MasterStep07Scores: React.FC<CondoAuditStepProps<CondoMasterFormState>> = ({
  isEditMode,
  formState,
  handleNestedFieldChange,
  isFieldDirty,
}) => {
  const ecs = formState.ecs || {};
  const vi = formState.vi || {};

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <AuditSubsection icon={Award} title="7.1. Điểm Hiện Trạng ECS">
        <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-2 text-xs">
          <div className="flex items-center justify-between">
            <span className="font-bold text-slate-600 uppercase text-[11px]">Tổng ECS</span>
            <div className="flex items-center gap-2">
              <span className="font-mono font-black text-slate-900">
                {ecs.totalEcs ?? AUDIT_EMPTY_VALUE} {ecs.ecsClass ? `(${ecs.ecsClass})` : ''}
              </span>
              <ScoreExplanationPopover metric="ECS" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-2 pt-2 border-t border-slate-200">
            {ECS_ROWS.map((row) => (
              <AuditField
                key={row.key}
                label={row.label}
                type="number"
                mono
                value={ecs[row.key] as number | undefined}
                isEditMode={isEditMode}
                isDirty={isFieldDirty('ecs', row.key)}
                onChange={(val) => handleNestedFieldChange('ecs', row.key, `Điểm ${row.label}`, toNumberOrNull(val))}
              />
            ))}
          </div>
        </div>
      </AuditSubsection>

      <AuditSubsection icon={Scale} title="7.2. Chỉ Số Tổn Thương VI">
        <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-2 text-xs">
          <div className="flex items-center justify-between">
            <span className="font-bold text-slate-600 uppercase text-[11px]">VI trung bình</span>
            <div className="flex items-center gap-2">
              <span className="font-mono font-black text-slate-900">
                {vi.avgVi ?? AUDIT_EMPTY_VALUE} {vi.viClass ? `(${vi.viClass})` : ''}
              </span>
              <ScoreExplanationPopover metric="VI" />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-2 pt-2 border-t border-slate-200">
            {VI_ROWS.map((row) => (
              <AuditField
                key={row.key}
                label={row.label}
                type="number"
                mono
                value={vi[row.key] as number | undefined}
                isEditMode={isEditMode}
                isDirty={isFieldDirty('vi', row.key)}
                onChange={(val) => handleNestedFieldChange('vi', row.key, `Điểm ${row.label}`, toNumberOrNull(val))}
              />
            ))}
          </div>
        </div>
      </AuditSubsection>
    </div>
  );
};
