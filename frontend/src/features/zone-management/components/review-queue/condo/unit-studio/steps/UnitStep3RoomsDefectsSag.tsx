import React from 'react';
import {
  LayoutGrid,
  Ruler,
  Eye,
  Upload,
  AlertTriangle,
  CheckCircle2,
  RotateCcw,
} from 'lucide-react';
import { CondoZonesDefectsCrudEditor } from '../../core/CondoZonesDefectsCrudEditor';
import type {
  CondoAuditStepProps,
  CondoUnitFormState,
} from '../../types/condo-audit.types';

export const UnitStep3RoomsDefectsSag: React.FC<
  CondoAuditStepProps<CondoUnitFormState>
> = ({
  isEditMode,
  formState,
  handleFieldChange,
  handleNestedFieldChange,
  isFieldDirty,
  discardField,
  onOpenPhotoZoom,
  onOpenPhotoAction,
  onOpenPhotoHistory,
}) => {
  return (
    <div className="space-y-6">
      {/* 1. Sơ đồ Mặt bằng Căn hộ (Room Layout Sketch) */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-700/80 p-4 bg-slate-50/40 dark:bg-slate-800/30">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-2">
            <LayoutGrid className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
            <h4 className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-100">
              Sơ Đồ Mặt Bằng Phòng Căn Hộ & Đánh Dấu Vị Trí Hư Hại
            </h4>
            {isFieldDirty('roomLayoutUrl') && (
              <button
                type="button"
                onClick={() => discardField('roomLayoutUrl')}
                className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-600 hover:underline cursor-pointer"
              >
                <RotateCcw className="w-3 h-3" /> Hoàn tác
              </button>
            )}
          </div>
          {isEditMode && onOpenPhotoAction && (
            <button
              type="button"
              onClick={() =>
                onOpenPhotoAction({
                  initialMode: formState.roomLayoutUrl ? 'REPLACE' : 'ADD',
                  category: 'CAD_FLOOR',
                  targetPhotoType: 'UNIT_LAYOUT_SKETCH',
                  currentPhotoCode: 'UNIT-LAYOUT',
                  photoTitle: `Sơ đồ mặt bằng căn hộ ${formState.unitCode}`,
                  currentPhotoUrl: formState.roomLayoutUrl || undefined,
                })
              }
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-bold bg-indigo-600 text-white hover:bg-indigo-700 cursor-pointer"
            >
              <Upload className="w-3.5 h-3.5" />
              {formState.roomLayoutUrl ? 'Cập nhật sơ đồ' : 'Tải lên sơ đồ căn hộ'}
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="md:col-span-2">
            <div className="force-light rounded-xl border border-slate-200 bg-white h-52 flex items-center justify-center overflow-hidden relative group">
              {formState.roomLayoutUrl ? (
                <>
                  <img
                    src={formState.roomLayoutUrl}
                    alt="Sơ đồ mặt bằng căn hộ"
                    className="w-full h-full object-contain p-2"
                  />
                  <div className="absolute inset-0 bg-slate-900/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        onOpenPhotoZoom(
                          formState.roomLayoutUrl,
                          `Sơ đồ mặt bằng căn hộ ${formState.unitCode}`,
                          'UNIT-LAYOUT'
                        )
                      }
                      className="px-3 py-1.5 rounded-lg bg-white text-slate-900 text-xs font-bold flex items-center gap-1.5 shadow-md cursor-pointer"
                    >
                      <Eye className="w-3.5 h-3.5" /> Phóng to bản vẽ
                    </button>
                  </div>
                </>
              ) : (
                <div className="text-center p-4 text-slate-500">
                  <LayoutGrid className="w-8 h-8 text-slate-400 mx-auto mb-1.5" />
                  <p className="text-xs font-medium">
                    Chưa đính kèm sơ đồ mặt bằng bố trí phòng của căn hộ
                  </p>
                </div>
              )}
            </div>
          </div>

          <div className="flex flex-col justify-between space-y-3">
            <div>
              <label className="block text-xs font-bold text-slate-600 dark:text-slate-300 mb-1">
                Ghi chú cấu trúc các phòng trong căn hộ
              </label>
              <textarea
                rows={4}
                disabled={!isEditMode}
                value={formState.roomLayoutNotes}
                onChange={(e) =>
                  handleFieldChange(
                    'roomLayoutNotes',
                    'Ghi chú sơ đồ phòng căn hộ',
                    e.target.value
                  )
                }
                placeholder="VD: Căn góc 2 phòng ngủ, 2 WC, 1 phòng khách thông bếp, logia hướng Đông Nam..."
                className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs text-slate-800 dark:text-slate-100 disabled:opacity-70"
              />
            </div>

            {isEditMode && (
              <div>
                <label className="block text-[11px] font-semibold text-slate-500 mb-1">
                  Đường dẫn ảnh sơ đồ mặt bằng (URL)
                </label>
                <input
                  type="text"
                  value={formState.roomLayoutUrl}
                  onChange={(e) =>
                    handleFieldChange(
                      'roomLayoutUrl',
                      'URL sơ đồ mặt bằng căn hộ',
                      e.target.value
                    )
                  }
                  placeholder="https://..."
                  className="w-full px-2.5 py-1.5 rounded border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-mono"
                />
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 2. Danh sách Vùng hư hại Kiến trúc (Zones Z) & Chi tiết vết nứt (Defects D) */}
      <div>
        <CondoZonesDefectsCrudEditor
          isEditMode={isEditMode}
          zones={formState.damageZones}
          defaultFloorName={`Tầng ${formState.floorNumber}`}
          onChangeZones={(nextZones, actionLabel) =>
            handleFieldChange('damageZones', actionLabel, nextZones)
          }
          onOpenPhotoZoom={onOpenPhotoZoom}
          onOpenPhotoAction={onOpenPhotoAction}
          onOpenPhotoHistory={onOpenPhotoHistory}
        />
      </div>

      {/* 3. Kiểm tra Độ Võng Dầm / Sàn BTCT Nội Bộ Căn Hộ (Beam / Slab Sagging) */}
      <div className="rounded-xl border border-slate-200 dark:border-slate-700/80 p-4 bg-slate-50/50 dark:bg-slate-800/40 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <Ruler className="w-4 h-4 text-rose-600 dark:text-rose-400" />
            <h4 className="text-xs font-black uppercase tracking-wider text-slate-800 dark:text-slate-100">
              Kiểm Tra Độ Võng Dầm / Sàn BTCT Trong Căn Hộ (Beam / Slab Deflection)
            </h4>
          </div>
          <label className="inline-flex items-center gap-2 text-xs font-bold cursor-pointer">
            <input
              type="checkbox"
              disabled={!isEditMode}
              checked={Boolean(formState.beamSagging?.hasSagging)}
              onChange={(e) => {
                const checked = e.target.checked;
                handleNestedFieldChange(
                  'beamSagging',
                  'hasSagging',
                  'Hiện tượng võng dầm/sàn',
                  checked
                );
                if (!checked) {
                  handleNestedFieldChange(
                    'beamSagging',
                    'level',
                    'Cấp độ võng dầm/sàn',
                    0
                  );
                } else if (Number(formState.beamSagging?.level || 0) === 0) {
                  handleNestedFieldChange(
                    'beamSagging',
                    'level',
                    'Cấp độ võng dầm/sàn',
                    1
                  );
                }
              }}
              className="rounded border-slate-300 text-rose-600 focus:ring-rose-500 cursor-pointer"
            />
            <span className="text-slate-700 dark:text-slate-300">
              Ghi nhận võng dầm/sàn
            </span>
          </label>
        </div>

        {formState.beamSagging?.hasSagging ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-1">
            <div>
              <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                Cấp độ võng kết cấu
              </label>
              <select
                disabled={!isEditMode}
                value={Number(formState.beamSagging.level || 1)}
                onChange={(e) =>
                  handleNestedFieldChange(
                    'beamSagging',
                    'level',
                    'Cấp độ võng dầm/sàn',
                    Number(e.target.value)
                  )
                }
                className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-bold cursor-pointer"
              >
                <option value={1}>Mức 1 - Võng nhẹ cảm nhận bằng mắt (&lt; L/250)</option>
                <option value={2}>
                  Mức 2 - Võng rõ rệt kèm nứt bụng dầm (Cần KS Kết cấu)
                </option>
                <option value={3}>
                  Mức 3 - Võng nguy hiểm vượt giới hạn chịu lực (&gt; L/150)
                </option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                Độ võng đo đạc ước tính (mm)
              </label>
              <input
                type="number"
                step="0.5"
                disabled={!isEditMode}
                value={formState.beamSagging.sagMm}
                onChange={(e) =>
                  handleNestedFieldChange(
                    'beamSagging',
                    'sagMm',
                    'Độ võng dầm/sàn (mm)',
                    Number(e.target.value)
                  )
                }
                className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-mono font-bold"
              />
            </div>

            <div>
              <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                Vị trí nhịp dầm / ô sàn bị võng
              </label>
              <input
                type="text"
                disabled={!isEditMode}
                value={formState.beamSagging.position}
                onChange={(e) =>
                  handleNestedFieldChange(
                    'beamSagging',
                    'position',
                    'Vị trí dầm/sàn võng',
                    e.target.value
                  )
                }
                placeholder="VD: Dầm chính giữa phòng khách..."
                className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs"
              />
            </div>

            <div className="md:col-span-3">
              <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                Ghi chú kỹ thuật về độ võng dầm/sàn
              </label>
              <input
                type="text"
                disabled={!isEditMode}
                value={formState.beamSagging.notes}
                onChange={(e) =>
                  handleNestedFieldChange(
                    'beamSagging',
                    'notes',
                    'Ghi chú võng dầm/sàn',
                    e.target.value
                  )
                }
                placeholder="Mô tả thiết bị đo laser, nhịp dầm L và vết nứt đi kèm..."
                className="w-full px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs"
              />
            </div>

            {Number(formState.beamSagging.level) >= 2 && (
              <div className="md:col-span-3 flex items-center gap-2 px-3 py-2 rounded-lg bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800 text-xs text-rose-700 dark:text-rose-300 font-semibold">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>
                  Cảnh báo Kết cấu: Độ võng dầm/sàn từ Mức 2 trở lên tự động kích hoạt
                  yêu cầu Kỹ sư Kết cấu kiểm định chuyên sâu (Burland &ge; Grade 3).
                </span>
              </div>
            )}
          </div>
        ) : (
          <div className="flex items-center gap-2 text-xs text-emerald-700 dark:text-emerald-400">
            <CheckCircle2 className="w-4 h-4 shrink-0" />
            <span>
              Các nhịp dầm và ô sàn BTCT trong phạm vi căn hộ phẳng ổn định, không
              phát hiện độ võng bất thường.
            </span>
          </div>
        )}
      </div>
    </div>
  );
};
