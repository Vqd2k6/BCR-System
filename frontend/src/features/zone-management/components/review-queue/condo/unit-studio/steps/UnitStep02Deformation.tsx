import React from 'react';
import { AlertTriangle, CheckCircle2, DoorClosed, Droplets, Plus, Ruler, Trash2 } from 'lucide-react';
import { AuditField, withCurrentOption } from '../../../stepwise/ui/AuditField';
import { AuditSubsection } from '../../../stepwise/ui/AuditStepSection';
import { toNumberOrNull } from '../../core/condo-normalize.utils';
import { CondoPhotoCard } from '../../core/CondoPhotoCard';
import type {
  CondoAuditStepProps,
  CondoUnitFormState,
  CondoUnitLeakageItem,
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

const NoFinding: React.FC<{ text: string }> = ({ text }) => (
  <div className="flex items-center gap-2 text-xs text-emerald-700">
    <CheckCircle2 className="w-4 h-4 shrink-0" />
    <span>{text}</span>
  </div>
);

export const UnitStep02Deformation: React.FC<CondoAuditStepProps<CondoUnitFormState>> = ({
  isEditMode,
  formState,
  handleFieldChange,
  handleNestedFieldChange,
  isFieldDirty,
  onOpenPhotoZoom,
}) => {
  const { doorJamming, waterLeakageFromUpperFloor: leakage, beamSagging: beam } = formState;

  const changeLeakageItems = (items: CondoUnitLeakageItem[], label: string) =>
    handleFieldChange('waterLeakageFromUpperFloor', label, { hasLeakage: items.length > 0, items });

  const updateLeakageItem = (itemId: string, patch: Partial<CondoUnitLeakageItem>, label: string) =>
    changeLeakageItems(
      leakage.items.map((item) => (item.id === itemId ? { ...item, ...patch } : item)),
      label
    );

  const addLeakageItem = () => {
    const nextIdx = leakage.items.length + 1;
    changeLeakageItems(
      [
        ...leakage.items,
        {
          id: `leakage_${Date.now()}_${nextIdx}`,
          leakageCode: `WL-${String(nextIdx).padStart(2, '0')}`,
          location: '',
          description: '',
          suspectedUpperUnitCode: '',
          ctxPhotoUrl: '',
          cuPhotoUrl: '',
        },
      ],
      `Thêm vị trí thấm WL-${String(nextIdx).padStart(2, '0')}`
    );
  };

  return (
    <>
      <AuditSubsection icon={DoorClosed} title="2.1. Kẹt Cửa, Biến Dạng Khung Cửa">
        {isEditMode || doorJamming.hasJamming ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <AuditField
              label="Hiện trạng"
              type="select"
              value={doorJamming.status}
              options={withCurrentOption(DOOR_STATUS_OPTIONS, doorJamming.status)}
              isEditMode={isEditMode}
              isDirty={isFieldDirty('doorJamming', 'status')}
              onChange={(val) => handleNestedFieldChange('doorJamming', 'status', 'Hiện trạng kẹt cửa', val)}
            />
            <AuditField
              label="Vị trí"
              value={doorJamming.locations}
              isEditMode={isEditMode}
              isDirty={isFieldDirty('doorJamming', 'locations')}
              onChange={(val) => handleNestedFieldChange('doorJamming', 'locations', 'Vị trí cửa bị kẹt', val)}
            />
            <AuditField
              label="Ghi chú"
              value={doorJamming.notes}
              isEditMode={isEditMode}
              isDirty={isFieldDirty('doorJamming', 'notes')}
              onChange={(val) => handleNestedFieldChange('doorJamming', 'notes', 'Ghi chú kẹt cửa', val)}
            />
          </div>
        ) : (
          <NoFinding text={doorJamming.statusLabel ? `Khảo sát ghi nhận: ${doorJamming.statusLabel}` : 'Khảo sát không ghi nhận kẹt cửa.'} />
        )}
      </AuditSubsection>

      <AuditSubsection
        icon={Droplets}
        title="2.2. Thấm Nước Từ Sàn Tầng Trên"
        hint={leakage.hasLeakage ? `${leakage.items.length} vị trí` : undefined}
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
                      isEditMode={isEditMode}
                      onChange={(val) => updateLeakageItem(item.id, { location: val }, `Vị trí thấm ${code}`)}
                    />
                    <AuditField
                      label="Mô tả"
                      value={item.description}
                      isEditMode={isEditMode}
                      onChange={(val) => updateLeakageItem(item.id, { description: val }, `Mô tả thấm ${code}`)}
                    />
                    <AuditField
                      label="Căn tầng trên nghi ngờ"
                      value={item.suspectedUpperUnitCode}
                      mono
                      isEditMode={isEditMode}
                      onChange={(val) => updateLeakageItem(item.id, { suspectedUpperUnitCode: val }, `Căn tầng trên nghi ngờ ${code}`)}
                    />
                    {isEditMode && (
                      <button
                        type="button"
                        onClick={() =>
                          changeLeakageItems(
                            leakage.items.filter((other) => other.id !== item.id),
                            `Xóa vị trí thấm ${code}`
                          )
                        }
                        className="justify-self-start px-2 py-1 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-300 text-xs font-bold flex items-center gap-1 cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Xóa vị trí</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        ) : leakage.hasLeakage ? (
          <div className="text-xs font-semibold text-amber-800">Khảo sát đánh dấu có thấm nhưng chưa có chi tiết vị trí.</div>
        ) : (
          <NoFinding text="Khảo sát không ghi nhận thấm nước từ tầng trên." />
        )}
        {isEditMode && (
          <button
            type="button"
            onClick={addLeakageItem}
            className="px-2.5 py-1 bg-sky-600 hover:bg-sky-700 text-white rounded-lg text-xs font-bold flex items-center gap-1 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Thêm vị trí thấm</span>
          </button>
        )}
      </AuditSubsection>

      <AuditSubsection icon={Ruler} title="2.3. Độ Võng Dầm / Sàn & Lún Quan Sát">
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
            }}
          />
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
          <AuditField
            label="Lún quan sát trong căn"
            type="select"
            value={formState.settlementObserved}
            options={withCurrentOption(SETTLEMENT_OPTIONS, formState.settlementObserved)}
            isEditMode={isEditMode}
            isDirty={isFieldDirty('settlementObserved')}
            onChange={(val) => handleFieldChange('settlementObserved', 'Lún quan sát trong căn', val)}
          />
          <AuditField
            label="Ghi chú lún"
            className="md:col-span-2"
            value={formState.settlementNotes}
            isEditMode={isEditMode}
            isDirty={isFieldDirty('settlementNotes')}
            onChange={(val) => handleFieldChange('settlementNotes', 'Ghi chú lún quan sát', val)}
          />
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
