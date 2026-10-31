import React from 'react';
import { AlertTriangle, RotateCcw, Trash2 } from 'lucide-react';
import { isCrackRelated } from '../../../../../../components/canvas/defectHelpers';
import {
  ACTIVITY_STATE_OPTIONS,
  ARCH_DEFECT_TYPES,
  ARCH_SCREENING_CATEGORIES,
  CRACK_DIRECTION_OPTIONS,
  STRUCT_DEFECT_TYPES,
  STRUCT_SCREENING_CATEGORIES,
} from '../../stepwise/constants/defect-taxonomy';
import { AuditField, withCurrentOption } from '../../stepwise/ui/AuditField';
import { AuditCuPhotoStrip, AuditDefectCardShell } from '../../stepwise/ui/AuditDefectStrip';
import { getOptimisticAddedPhotos } from '../../stepwise/utils/optimisticPhotoResolver';
import type { CondoDefectItemData } from '../types/condo-audit.types';
import { toNumberOrNull } from './condo-normalize.utils';
import { calcBurlandGradeFromWidthFrontend } from './condo-zone.mappers';
import { CondoPhotoCard, type CondoPhotoHandlers } from './CondoPhotoCard';

const toOptions = (values: string[]) => values.map((value) => ({ value, label: value }));

interface CondoDefectCardProps extends CondoPhotoHandlers {
  kind: 'zone' | 'element';
  defect: CondoDefectItemData;
  parentCode: string;
  isHighlighted?: boolean;
  onFieldChange: (field: keyof CondoDefectItemData, value: unknown, label: string) => void;
  onToggleDelete: () => void;
}

/** Thẻ khuyết tật D, cùng thứ tự với Nhà dân: tiêu đề, biểu mẫu, dải ảnh cận cảnh. */
export const CondoDefectCard: React.FC<CondoDefectCardProps> = ({
  kind,
  defect,
  parentCode,
  isHighlighted = false,
  onFieldChange,
  onToggleDelete,
  ...photoHandlers
}) => {
  const { isEditMode, stagedPhotoActions } = photoHandlers;
  const isDeleted = Boolean(defect.isDeleted);
  const canEdit = isEditMode && !isDeleted;
  const isElement = kind === 'element';
  const isCrack = isCrackRelated(defect.screeningCategory, defect.defectType);
  const code = defect.defectCode;
  const burlandGrade = calcBurlandGradeFromWidthFrontend(Number(defect.widthMaxMm || 0), defect.isStructuralCritical);
  const cuPhotos = (defect.cuPhotos || []).filter(Boolean);
  const cuContext = {
    category: 'DEFECT_CU',
    targetPhotoType: 'DEFECT_CU_PHOTO',
    targetPhotoId: defect.id,
    defectId: defect.id,
    defectCode: code,
    zoneCode: parentCode,
  };
  const addedCuPhotos = getOptimisticAddedPhotos(stagedPhotoActions, cuContext);
  const cuPhotoCode = (idx: number) => `${defect.cuPhotoCode || `${parentCode}-${code}-CU`}${idx > 0 ? `-${idx + 1}` : ''}`;

  return (
    <AuditDefectCardShell
      variant={kind}
      isDeleted={isDeleted}
      id={`condo-defect-${parentCode}-${code}`}
      isHighlighted={isHighlighted}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="px-2 py-0.5 rounded font-mono font-black text-[11px] bg-slate-800 text-white">{code}</span>
          {isCrack && (
            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-sky-50 text-sky-700 border border-sky-200">
              Burland Cấp {burlandGrade}
            </span>
          )}
          {defect.isStructuralCritical && (
            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-700 border border-rose-300 flex items-center gap-0.5">
              <AlertTriangle className="w-3 h-3" /> Kết cấu
            </span>
          )}
          {!isEditMode && !defect.hasScaleCard && (
            <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
              Chưa có thước đo
            </span>
          )}
        </div>
        {isEditMode && (
          <button
            type="button"
            onClick={onToggleDelete}
            className={`p-1.5 rounded border cursor-pointer ${
              isDeleted
                ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                : 'bg-rose-50 hover:bg-rose-100 text-rose-600 border-rose-200'
            }`}
            title={isDeleted ? 'Khôi phục khuyết tật' : 'Xóa mềm khuyết tật'}
          >
            {isDeleted ? <RotateCcw className="w-3.5 h-3.5" /> : <Trash2 className="w-3.5 h-3.5" />}
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        <AuditField
          label="Nhóm sàng lọc"
          type="select"
          value={defect.screeningCategory}
          options={withCurrentOption(
            toOptions(isElement ? STRUCT_SCREENING_CATEGORIES : ARCH_SCREENING_CATEGORIES),
            defect.screeningCategory
          )}
          isEditMode={canEdit}
          onChange={(val) => onFieldChange('screeningCategory', val, `Nhóm sàng lọc ${code} (${parentCode})`)}
        />
        <AuditField
          label="Dạng khuyết tật"
          type="select"
          value={defect.defectType}
          options={withCurrentOption(toOptions(isElement ? STRUCT_DEFECT_TYPES : ARCH_DEFECT_TYPES), defect.defectType)}
          isEditMode={canEdit}
          onChange={(val) => onFieldChange('defectType', val, `Dạng khuyết tật ${code} (${parentCode})`)}
        />
      </div>

      {isCrack && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-2 border-t border-slate-100">
          <AuditField
            label="Rộng W"
            type="number"
            unit="mm"
            mono
            value={defect.widthMaxMm}
            isEditMode={canEdit}
            onChange={(val) => onFieldChange('widthMaxMm', toNumberOrNull(val), `Bề rộng vết nứt ${code} (${parentCode})`)}
          />
          <AuditField
            label="Dài L"
            type="number"
            unit="mm"
            mono
            value={defect.lengthMm}
            isEditMode={canEdit}
            onChange={(val) => onFieldChange('lengthMm', toNumberOrNull(val), `Chiều dài vết nứt ${code} (${parentCode})`)}
          />
          <AuditField
            label="Hướng nứt"
            type="select"
            value={defect.crackDirection}
            options={withCurrentOption(toOptions(CRACK_DIRECTION_OPTIONS), defect.crackDirection)}
            isEditMode={canEdit}
            onChange={(val) => onFieldChange('crackDirection', val, `Hướng nứt ${code} (${parentCode})`)}
          />
          <AuditField
            label="Trạng thái"
            type="select"
            value={defect.activityState}
            options={ACTIVITY_STATE_OPTIONS}
            isEditMode={canEdit}
            onChange={(val) => onFieldChange('activityState', val, `Trạng thái nứt ${code} (${parentCode})`)}
          />
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-2 border-t border-slate-100">
        {isElement ? (
          <>
            <AuditField
              label="Mức kết cấu E2"
              type="number"
              mono
              value={defect.structuralSignificanceE2}
              isEditMode={canEdit}
              onChange={(val) => onFieldChange('structuralSignificanceE2', toNumberOrNull(val), `Chỉ số E2 ${code} (${parentCode})`)}
            />
            <AuditField
              label="Suy thoái vật liệu E4"
              type="number"
              mono
              value={defect.materialDegradationE4}
              isEditMode={canEdit}
              onChange={(val) => onFieldChange('materialDegradationE4', toNumberOrNull(val), `Chỉ số E4 ${code} (${parentCode})`)}
            />
          </>
        ) : (
          <AuditField
            label="Ảnh hưởng công năng E6"
            type="number"
            mono
            value={defect.functionalImpactE6}
            isEditMode={canEdit}
            onChange={(val) => onFieldChange('functionalImpactE6', toNumberOrNull(val), `Chỉ số E6 ${code} (${parentCode})`)}
          />
        )}
        <AuditField
          label={`Ghi chú ${code}`}
          className={isElement ? '' : 'sm:col-span-2'}
          value={defect.notes}
          isEditMode={canEdit}
          onChange={(val) => onFieldChange('notes', val, `Ghi chú ${code} (${parentCode})`)}
        />
      </div>

      {canEdit && (
        <div className="flex items-center gap-4">
          <label className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-slate-700 cursor-pointer">
            <input
              type="checkbox"
              checked={Boolean(defect.hasScaleCard)}
              onChange={(e) => onFieldChange('hasScaleCard', e.target.checked, `Thước đo tỉ lệ ${code}`)}
              className="cursor-pointer"
            />
            <span>Có thước đo</span>
          </label>
          <label className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-rose-700 cursor-pointer">
            <input
              type="checkbox"
              checked={Boolean(defect.isStructuralCritical)}
              onChange={(e) => onFieldChange('isStructuralCritical', e.target.checked, `Cờ nguy hiểm kết cấu ${code}`)}
              className="cursor-pointer"
            />
            <span>Nứt kết cấu</span>
          </label>
        </div>
      )}

      <div className="space-y-2">
        <span className="text-[10px] font-bold text-slate-500 block uppercase">
          Ảnh Cận Cảnh CU ({cuPhotos.length + addedCuPhotos.length} ảnh)
        </span>
        <AuditCuPhotoStrip>
          {cuPhotos.map((url, idx) => (
            <CondoPhotoCard
              key={url}
              {...photoHandlers}
              {...cuContext}
              url={url}
              photoIndex={idx}
              photoCode={cuPhotoCode(idx)}
              title={`Cận cảnh ${parentCode} / ${code}`}
              hasHistory={defect.hasHistory}
              historyCount={defect.historyCount}
              aspectRatio="h-80"
              maxHeightPx={340}
              badgeColor="rose"
            />
          ))}
          {addedCuPhotos.map((added, idx) => (
            <CondoPhotoCard
              key={added.displayUrl}
              {...photoHandlers}
              {...cuContext}
              url={added.displayUrl}
              photoIndex={cuPhotos.length + idx}
              photoCode={cuPhotoCode(cuPhotos.length + idx)}
              title={`Cận cảnh ${parentCode} / ${code} (Mới thêm)`}
              aspectRatio="h-80"
              maxHeightPx={340}
              badgeColor="rose"
            />
          ))}
          {canEdit && (
            <CondoPhotoCard
              {...photoHandlers}
              {...cuContext}
              url=""
              photoIndex={cuPhotos.length + addedCuPhotos.length}
              photoCode={cuPhotoCode(cuPhotos.length + addedCuPhotos.length)}
              title="Bổ sung ảnh cận cảnh"
              aspectRatio="h-80"
              maxHeightPx={340}
              badgeColor="rose"
            />
          )}
        </AuditCuPhotoStrip>
        {!canEdit && cuPhotos.length === 0 && addedCuPhotos.length === 0 && (
          <div className="text-xs text-slate-400 italic">Chưa có ảnh cận cảnh.</div>
        )}
      </div>
    </AuditDefectCardShell>
  );
};
