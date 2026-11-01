import React from 'react';
import { AlertTriangle, DoorClosed, Droplets, Ruler } from 'lucide-react';
import { AuditField, withCurrentOption } from '../../../stepwise/ui/AuditField';
import { AuditSubsection } from '../../../stepwise/ui/AuditStepSection';
import { isFilled, toNumberOrNull } from '../../core/condo-normalize.utils';
import { CondoPhotoCard } from '../../core/CondoPhotoCard';
import { isBeamDetailVisible, isSettlementNotesVisible } from '../condo-unit.adapters';
import type {
  CondoAuditStepProps,
  CondoUnitFormState,
} from '../../types/condo-audit.types';

const SAG_LEVEL_LABELS = [
  { value: '0', label: 'Mức 0 — Không phát hiện võng' },
  { value: '1', label: 'Mức 1 — Võng nhẹ (< L/250)' },
  { value: '2', label: 'Mức 2 — Võng rõ, kèm nứt bụng dầm' },
  { value: '3', label: 'Mức 3 — Võng nguy hiểm (> L/150)' },
];

const SETTLEMENT_OPTIONS = [
  { value: 'NONE', label: 'Không quan sát thấy' },
  { value: 'SLIGHT', label: 'Nhẹ' },
  { value: 'NOTICEABLE', label: 'Rõ rệt' },
  { value: 'SEVERE', label: 'Nghiêm trọng' },
];

const DOOR_STATUS_OPTIONS = [
  { value: 'NORMAL', label: 'Bình thường' },
  { value: 'JAMMED', label: 'Cửa bị kẹt' },
  { value: 'RUBBING_FLOOR', label: 'Cánh cửa cọ sàn' },
  { value: 'CRACKED_GLASS', label: 'Nứt kính cửa' },
];

export const UnitStep02Deformation: React.FC<CondoAuditStepProps<CondoUnitFormState>> = ({
  isEditMode,
  formState,
  handleFieldChange,
  handleNestedFieldChange,
  isFieldDirty,
  onOpenPhotoZoom,
}) => {
  const { doorJamming, waterLeakageFromUpperFloor: leakage, beamSagging: beam } = formState;

  // KSV nay ghi kẹt cửa, thấm dột bằng D trong Z/E; 2 khối này chỉ còn để đọc chứng cứ của hồ sơ cũ
  const hasLegacyDoorJam = doorJamming.hasJamming;
  const hasLegacyLeakage = leakage.hasLeakage || leakage.items.length > 0;
  const deformationSectionNumber = 1 + Number(hasLegacyDoorJam) + Number(hasLegacyLeakage);

  // Báo cáo coi sagMm > 0 là có võng, nên về Mức 0 phải xóa số đo chứ không chỉ ẩn ô; ảnh SAG-01 giữ lại
  const clearBeamDetails = () => {
    if (isFilled(beam.sagMm)) handleNestedFieldChange('beamSagging', 'sagMm', 'Độ võng dầm/sàn (mm)', null);
    if (isFilled(beam.spanM)) handleNestedFieldChange('beamSagging', 'spanM', 'Nhịp dầm/sàn (m)', null);
    if (isFilled(beam.ratioText)) handleNestedFieldChange('beamSagging', 'ratioText', 'Tỉ số võng f/L', '');
    if (isFilled(beam.position)) handleNestedFieldChange('beamSagging', 'position', 'Vị trí dầm/sàn võng', '');
    if (isFilled(beam.notes)) handleNestedFieldChange('beamSagging', 'notes', 'Ghi chú võng dầm/sàn', '');
  };

  return (
    <>
      {hasLegacyDoorJam && (
      <AuditSubsection icon={DoorClosed} title="2.1. Kẹt Cửa, Biến Dạng Khung Cửa" hint="Dữ liệu cũ, chỉ đọc">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <AuditField
              label="Hiện trạng"
              type="select"
              value={doorJamming.status}
              options={withCurrentOption(DOOR_STATUS_OPTIONS, doorJamming.status)}
              isEditMode={false}
            />
            <AuditField
              label="Vị trí"
              value={doorJamming.locations}
              isEditMode={false}
            />
            <AuditField
              label="Ghi chú"
              value={doorJamming.notes}
              isEditMode={false}
            />
          </div>
      </AuditSubsection>
      )}
      {hasLegacyLeakage && (
      <AuditSubsection
        icon={Droplets}
        title={`2.${hasLegacyDoorJam ? 2 : 1}. Thấm Nước Từ Sàn Tầng Trên`}
        hint={`Dữ liệu cũ, chỉ đọc • ${leakage.items.length} vị trí`}
      >
        {leakage.items.length > 0 ? (
          <div className="space-y-3">
            {leakage.items.map((item, idx) => {
              const code = item.leakageCode || `WL-${String(idx + 1).padStart(2, '0')}`;
              return (
                <div key={item.id} className="p-3 rounded-xl border border-slate-200 bg-slate-50/60 grid grid-cols-1 md:grid-cols-4 gap-3">
                  <CondoPhotoCard isEditMode={false} onOpenPhotoZoom={onOpenPhotoZoom} url={item.ctxPhotoUrl} photoCode={`${code}-CTX`} title={`Bối cảnh thấm ${code}`} category="WATER_LEAKAGE" targetPhotoType="WATER_LEAKAGE_CTX" targetPhotoId={item.id} aspectRatio="h-24" badgeColor="sky" />
                  <CondoPhotoCard isEditMode={false} onOpenPhotoZoom={onOpenPhotoZoom} url={item.cuPhotoUrl} photoCode={`${code}-CU`} title={`Cận cảnh thấm ${code}`} category="WATER_LEAKAGE" targetPhotoType="WATER_LEAKAGE_CU" targetPhotoId={item.id} aspectRatio="h-24" badgeColor="sky" />
                  <div className="md:col-span-2 grid grid-cols-1 gap-3 content-start">
                    <AuditField
                      label="Vị trí"
                      value={item.location}
                      isEditMode={false}
                    />
                    <AuditField
                      label="Mô tả"
                      value={item.description}
                      isEditMode={false}
                    />
                    <AuditField
                      label="Căn tầng trên nghi ngờ"
                      value={item.suspectedUpperUnitCode}
                      mono
                      isEditMode={false}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        ) : leakage.hasLeakage ? (
          <div className="text-xs font-semibold text-amber-800">Khảo sát đánh dấu có thấm nhưng chưa có chi tiết vị trí.</div>
        ) : null}
      </AuditSubsection>
      )}
      <AuditSubsection icon={Ruler} title={`2.${deformationSectionNumber}. Độ Võng Dầm / Sàn & Lún Quan Sát`} hint="Phiếu KSV: Bước 3">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <AuditField
            label="Cấp độ võng"
            type="select"
            value={beam.level}
            options={SAG_LEVEL_LABELS}
            isEditMode={isEditMode}
            isDirty={isFieldDirty('beamSagging', 'level')}
            onChange={(val) => {
              const level = toNumberOrNull(val);
              handleNestedFieldChange('beamSagging', 'level', 'Cấp độ võng dầm/sàn', level);
              handleNestedFieldChange('beamSagging', 'hasSagging', 'Hiện tượng võng dầm/sàn', Number(level) > 0);
              if (!level) clearBeamDetails();
            }}
          />
          {isBeamDetailVisible(beam) && (
            <>
              <AuditField
                label="Độ võng đo được"
                type="number"
                unit="mm"
                mono
                value={beam.sagMm}
                isEditMode={isEditMode}
                isDirty={isFieldDirty('beamSagging', 'sagMm')}
                onChange={(val) => handleNestedFieldChange('beamSagging', 'sagMm', 'Độ võng dầm/sàn (mm)', toNumberOrNull(val))}
              />
              <AuditField
                label="Nhịp dầm / sàn"
                type="number"
                unit="m"
                mono
                value={beam.spanM}
                isEditMode={isEditMode}
                isDirty={isFieldDirty('beamSagging', 'spanM')}
                onChange={(val) => handleNestedFieldChange('beamSagging', 'spanM', 'Nhịp dầm/sàn (m)', toNumberOrNull(val))}
              />
              <AuditField
                label="Tỉ số f/L"
                mono
                value={beam.ratioText}
                isEditMode={isEditMode}
                isDirty={isFieldDirty('beamSagging', 'ratioText')}
                onChange={(val) => handleNestedFieldChange('beamSagging', 'ratioText', 'Tỉ số võng f/L', val)}
              />
              <AuditField
                label="Vị trí dầm / sàn"
                value={beam.position}
                isEditMode={isEditMode}
                isDirty={isFieldDirty('beamSagging', 'position')}
                onChange={(val) => handleNestedFieldChange('beamSagging', 'position', 'Vị trí dầm/sàn võng', val)}
              />
              <AuditField
                label="Ghi chú kỹ thuật"
                className="md:col-span-2"
                value={beam.notes}
                isEditMode={isEditMode}
                isDirty={isFieldDirty('beamSagging', 'notes')}
                onChange={(val) => handleNestedFieldChange('beamSagging', 'notes', 'Ghi chú võng dầm/sàn', val)}
              />
            </>
          )}
          <AuditField
            label="Lún quan sát trong căn"
            type="select"
            value={formState.settlementObserved}
            options={withCurrentOption(SETTLEMENT_OPTIONS, formState.settlementObserved)}
            isEditMode={isEditMode}
            isDirty={isFieldDirty('settlementObserved')}
            onChange={(val) => {
              handleFieldChange('settlementObserved', 'Lún quan sát trong căn', val);
              if (val === 'NONE' && isFilled(formState.settlementNotes)) {
                handleFieldChange('settlementNotes', 'Ghi chú lún quan sát', '');
              }
            }}
          />
          {isSettlementNotesVisible(formState.settlementObserved, formState.settlementNotes) && (
            <AuditField
              label="Ghi chú lún"
              className="md:col-span-2"
              value={formState.settlementNotes}
              isEditMode={isEditMode}
              isDirty={isFieldDirty('settlementNotes')}
              onChange={(val) => handleFieldChange('settlementNotes', 'Ghi chú lún quan sát', val)}
            />
          )}
        </div>

        {beam.photoUrl && (
          <div className="w-full md:w-1/3">
            <CondoPhotoCard isEditMode={false} onOpenPhotoZoom={onOpenPhotoZoom} url={beam.photoUrl} photoCode="SAG-01" title="Ảnh đo võng dầm/sàn" category="BEAM_SAGGING" targetPhotoType="BEAM_SAGGING" badgeColor="sky" />
          </div>
        )}

        {Number(beam.level) >= 2 && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-rose-50 border border-rose-200 text-xs text-rose-700 font-semibold">
            <AlertTriangle className="w-4 h-4 shrink-0" />
            <span>Độ võng từ Mức 2 trở lên yêu cầu Kỹ sư Kết cấu kiểm định chuyên sâu (Burland ≥ Cấp 3).</span>
          </div>
        )}
      </AuditSubsection>
    </>
  );
};
