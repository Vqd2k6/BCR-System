import React from 'react';
import { Building, FileImage, History, Layers } from 'lucide-react';
import { AuditField, withCurrentOption } from '../../../stepwise/ui/AuditField';
import { AuditSubsection } from '../../../stepwise/ui/AuditStepSection';
import { toNumberOrNull } from '../../core/condo-normalize.utils';
import { CondoPhotoCard } from '../../core/CondoPhotoCard';
import type {
  CondoAuditStepProps,
  CondoMasterFormState,
} from '../../types/condo-audit.types';

const STRUCTURE_OPTIONS = [
  { value: 'RC_FRAME_SHEAR_WALL', label: 'Khung - Vách cứng BTCT + Lõi thang' },
  { value: 'RC_FRAME', label: 'Khung chịu lực BTCT toàn khối' },
  { value: 'PRECAST_PANEL', label: 'Lắp ghép tấm lớn (Chung cư cũ)' },
  { value: 'STEEL_COMPOSITE', label: 'Kết cấu liên hợp Thép - BTCT' },
];

const CAT_OPTIONS = [
  { value: '1', label: 'CAT 1 — Móng cọc sâu có hồ sơ hoàn công đầy đủ' },
  { value: '2', label: 'CAT 2 — Móng cọc / Bè BTCT có bản vẽ hoàn công' },
  { value: '3', label: 'CAT 3 — Móng băng / Cọc BTCT không đầy đủ bản vẽ' },
  { value: '4', label: 'CAT 4 — Móng cọc ngắn / Móng đơn BTCT' },
  { value: '5', label: 'CAT 5 — Không xác định được hồ sơ móng' },
];

const HISTORY_LEVEL_OPTIONS = [
  { value: '0', label: 'Mức 0 — Không ghi nhận' },
  { value: '1', label: 'Mức 1 — Nhẹ' },
  { value: '2', label: 'Mức 2 — Trung bình' },
  { value: '3', label: 'Mức 3 — Đáng kể' },
];

const HISTORY_ITEMS: Array<{ levelKey: string; notesKey: string; label: string }> = [
  { levelKey: 'renovationLoad', notesKey: 'renovationNotes', label: 'Cải tạo gia tăng tải trọng' },
  { levelKey: 'majorRepair', notesKey: 'repairNotes', label: 'Đại tu, sửa chữa lớn' },
  { levelKey: 'pastSettlement', notesKey: 'settlementNotes', label: 'Tiền sử lún, nứt' },
  { levelKey: 'neighborDamage', notesKey: 'neighborNotes', label: 'Ảnh hưởng từ công trình lân cận' },
  { levelKey: 'fireFloodIncident', notesKey: 'fireFloodNotes', label: 'Cháy, ngập' },
];

const SCALE_FIELDS: Array<{ key: keyof CondoMasterFormState & string; label: string; unit?: string; numeric?: boolean }> = [
  { key: 'aboveFloors', label: 'Số tầng nổi', numeric: true },
  { key: 'undergroundFloors', label: 'Số tầng hầm', numeric: true },
  { key: 'totalUnits', label: 'Tổng số căn', numeric: true },
  { key: 'constructionYear', label: 'Năm xây dựng' },
  { key: 'buildingHeightM', label: 'Chiều cao', unit: 'm' },
  { key: 'constructionAreaM2', label: 'Diện tích xây dựng', unit: 'm²' },
  { key: 'landAreaM2', label: 'Diện tích khuôn viên', unit: 'm²' },
];

export const MasterStep03StructureInterview: React.FC<CondoAuditStepProps<CondoMasterFormState>> = ({
  isEditMode,
  formState,
  handleFieldChange,
  handleNestedFieldChange,
  isFieldDirty,
  stagedPhotoActions,
  onUndoPhotoAction,
  onOpenPhotoZoom,
  onOpenPhotoAction,
  onOpenPhotoHistory,
}) => {
  const history = formState.historyInterview || {};
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
      <AuditSubsection icon={Building} title="3.1. Quy Mô Kiến Trúc Khối Tháp">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3">
          {SCALE_FIELDS.map((field) => (
            <AuditField
              key={field.key}
              label={field.label}
              type={field.numeric ? 'number' : 'text'}
              unit={field.unit}
              value={formState[field.key] as string | number | null}
              isEditMode={isEditMode}
              isDirty={isFieldDirty(field.key)}
              onChange={(val) =>
                handleFieldChange(field.key, field.label, field.numeric ? toNumberOrNull(val) : val)
              }
            />
          ))}
        </div>
      </AuditSubsection>

      <AuditSubsection icon={Layers} title="3.2. Hệ Kết Cấu & Phân Hạng Móng">
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          <AuditField
            label="Hệ kết cấu chịu lực"
            type="select"
            value={formState.structureSystem}
            options={withCurrentOption(STRUCTURE_OPTIONS, formState.structureSystem)}
            isEditMode={isEditMode}
            isDirty={isFieldDirty('structureSystem')}
            onChange={(val) => handleFieldChange('structureSystem', 'Hệ kết cấu chịu lực', val)}
          />
          <AuditField
            label="Hạng móng CAT"
            type="select"
            value={formState.foundationCatScore}
            options={CAT_OPTIONS}
            isEditMode={isEditMode}
            isDirty={isFieldDirty('foundationCatScore')}
            onChange={(val) => handleFieldChange('foundationCatScore', 'Hạng móng CAT', toNumberOrNull(val))}
          />
          <AuditField
            label="Chiều sâu móng"
            type="number"
            unit="m"
            value={formState.foundationDepthM}
            isEditMode={isEditMode}
            isDirty={isFieldDirty('foundationDepthM')}
            onChange={(val) => handleFieldChange('foundationDepthM', 'Chiều sâu móng', val)}
          />
          <AuditField
            label="Bước cọc"
            type="number"
            unit="m"
            value={formState.foundationSpacingM}
            isEditMode={isEditMode}
            isDirty={isFieldDirty('foundationSpacingM')}
            onChange={(val) => handleFieldChange('foundationSpacingM', 'Bước cọc', val)}
          />
          <AuditField
            label="Kích thước cọc"
            value={formState.pileDimensionMm}
            mono
            isEditMode={isEditMode}
            isDirty={isFieldDirty('pileDimensionMm')}
            onChange={(val) => handleFieldChange('pileDimensionMm', 'Kích thước cọc', val)}
          />
          <AuditField
            label="Ghi chú móng"
            value={formState.foundationNotes}
            isEditMode={isEditMode}
            isDirty={isFieldDirty('foundationNotes')}
            onChange={(val) => handleFieldChange('foundationNotes', 'Ghi chú móng', val)}
          />
        </div>
      </AuditSubsection>

      <AuditSubsection
        icon={FileImage}
        title="3.3. Bản Vẽ Hoàn Công"
        hint={`${formState.asBuiltDrawingPhotos.length} bản vẽ`}
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {formState.asBuiltDrawingPhotos.map((item, idx) => (
            <CondoPhotoCard
              key={item.url}
              {...photoHandlers}
              url={item.url}
              photoCode={item.photoCode || `AS-BUILT-0${idx + 1}`}
              title={item.notes || `Bản vẽ hoàn công ${idx + 1}`}
              category="AS_BUILT"
              targetPhotoType="AS_BUILT_DRAWING"
              badgeColor="sky"
            />
          ))}
          {isEditMode && (
            <CondoPhotoCard
              {...photoHandlers}
              url=""
              photoCode={`AS-BUILT-0${formState.asBuiltDrawingPhotos.length + 1}`}
              title="Bổ sung bản vẽ hoàn công"
              category="AS_BUILT"
              targetPhotoType="AS_BUILT_DRAWING"
              badgeColor="sky"
            />
          )}
        </div>
      </AuditSubsection>

      <AuditSubsection icon={History} title="3.4. Phỏng Vấn Lịch Sử Vận Hành (Ban Quản Lý)">
        <div className="space-y-3">
          {HISTORY_ITEMS.map((item) => (
            <div key={item.levelKey} className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <AuditField
                label={item.label}
                type="select"
                value={history[item.levelKey] as number | undefined}
                options={HISTORY_LEVEL_OPTIONS}
                isEditMode={isEditMode}
                isDirty={isFieldDirty('historyInterview', item.levelKey)}
                onChange={(val) =>
                  handleNestedFieldChange('historyInterview', item.levelKey, item.label, toNumberOrNull(val))
                }
              />
              <AuditField
                label="Diễn giải"
                className="md:col-span-2"
                value={history[item.notesKey] as string | undefined}
                isEditMode={isEditMode}
                isDirty={isFieldDirty('historyInterview', item.notesKey)}
                onChange={(val) =>
                  handleNestedFieldChange('historyInterview', item.notesKey, `Diễn giải: ${item.label}`, val)
                }
              />
            </div>
          ))}
        </div>
      </AuditSubsection>
    </>
  );
};
