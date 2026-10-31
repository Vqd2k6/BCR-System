import React from 'react';
import {
  FileText,
  Plus,
  Trash2,
  Maximize2,
  AlertTriangle,
  CheckCircle2,
} from 'lucide-react';
import type {
  CondoAuditStepProps,
  CondoMasterFormState,
} from '../../types/condo-audit.types';

export const MasterStep2ScaleFoundation: React.FC<
  CondoAuditStepProps<CondoMasterFormState>
> = ({
  isEditMode,
  formState,
  handleFieldChange,
  onOpenPhotoZoom,
  onOpenPhotoAction,
}) => {
  const isCat1Or2 =
    Number(formState.foundationCatScore) === 1 ||
    Number(formState.foundationCatScore) === 2;
  const asBuiltCount = (formState.asBuiltDrawingPhotos || []).length;

  const handleRemoveAsBuiltPhoto = (idx: number) => {
    const next = formState.asBuiltDrawingPhotos.filter((_, i) => i !== idx);
    handleFieldChange('asBuiltDrawingPhotos', 'Bản vẽ hoàn công móng', next);
  };

  return (
    <div className="space-y-6">
      {/* 1. Quy mô Khối tháp & Phân cấp Công trình */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div>
          <label className="block text-[11px] font-bold text-slate-500 mb-1">
            Số tầng nổi (Above Floors)
          </label>
          {isEditMode ? (
            <input
              type="number"
              min="1"
              max="100"
              value={formState.aboveFloors}
              onChange={(e) =>
                handleFieldChange(
                  'aboveFloors',
                  'Số tầng nổi khối tháp',
                  Number(e.target.value)
                )
              }
              className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-mono font-bold"
            />
          ) : (
            <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 text-xs font-mono font-black text-indigo-700 dark:text-indigo-300">
              {formState.aboveFloors} tầng nổi
            </div>
          )}
        </div>

        <div>
          <label className="block text-[11px] font-bold text-slate-500 mb-1">
            Số tầng hầm (Basements)
          </label>
          {isEditMode ? (
            <input
              type="number"
              min="0"
              max="10"
              value={formState.undergroundFloors}
              onChange={(e) =>
                handleFieldChange(
                  'undergroundFloors',
                  'Số tầng hầm khối tháp',
                  Number(e.target.value)
                )
              }
              className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-mono font-bold"
            />
          ) : (
            <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 text-xs font-mono font-black">
              {formState.undergroundFloors} tầng hầm
            </div>
          )}
        </div>

        <div>
          <label className="block text-[11px] font-bold text-slate-500 mb-1">
            Năm xây dựng / Bàn giao
          </label>
          {isEditMode ? (
            <input
              type="text"
              value={formState.constructionYear}
              onChange={(e) =>
                handleFieldChange(
                  'constructionYear',
                  'Năm xây dựng tòa nhà',
                  e.target.value
                )
              }
              placeholder="VD: 2014"
              className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-mono"
            />
          ) : (
            <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 text-xs font-mono font-bold">
              {formState.constructionYear || 'Chưa rõ'}
              {formState.isEstimatedYear ? ' (Ước tính)' : ''}
            </div>
          )}
        </div>

        <div>
          <label className="block text-[11px] font-bold text-slate-500 mb-1">
            Chiều cao công trình (m) / Diện tích sàn (m²)
          </label>
          {isEditMode ? (
            <div className="flex items-center gap-2">
              <input
                type="number"
                placeholder="Cao (m)"
                value={formState.buildingHeightM}
                onChange={(e) =>
                  handleFieldChange(
                    'buildingHeightM',
                    'Chiều cao khối tháp (m)',
                    e.target.value
                  )
                }
                className="w-1/2 px-2.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-mono"
              />
              <input
                type="number"
                placeholder="DT (m²)"
                value={formState.constructionAreaM2}
                onChange={(e) =>
                  handleFieldChange(
                    'constructionAreaM2',
                    'Diện tích xây dựng (m²)',
                    e.target.value
                  )
                }
                className="w-1/2 px-2.5 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-mono"
              />
            </div>
          ) : (
            <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 text-xs font-mono font-bold">
              Cao: {formState.buildingHeightM || '--'}m • DT: {formState.constructionAreaM2 || '--'}m²
            </div>
          )}
        </div>
      </div>

      {/* 2. Hệ Kết Cấu Chịu Lực & Phân Hạng Móng CAT 1..5 */}
      <div className="p-4 rounded-2xl bg-slate-50/80 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-750 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-[11px] font-bold text-slate-500 mb-1">
              Hệ kết cấu chịu lực chính
            </label>
            {isEditMode ? (
              <select
                value={formState.structureSystem}
                onChange={(e) =>
                  handleFieldChange(
                    'structureSystem',
                    'Hệ kết cấu chịu lực chính',
                    e.target.value
                  )
                }
                className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-bold"
              >
                <option value="RC_FRAME_SHEAR_WALL">Khung - Vách cứng BTCT + Lõi thang</option>
                <option value="RC_FRAME">Khung chịu lực BTCT toàn khối</option>
                <option value="PRECAST_PANEL">Lắp ghép tấm lớn (Chung cư cũ)</option>
                <option value="STEEL_COMPOSITE">Kết cấu liên hợp Thép - BTCT</option>
              </select>
            ) : (
              <div className="text-xs font-black text-slate-900 dark:text-slate-100">
                {formState.structureSystem}
              </div>
            )}
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-500 mb-1">
              Phân hạng Móng theo chuẩn Metro (CAT 1 → CAT 5)
            </label>
            {isEditMode ? (
              <select
                value={formState.foundationCatScore}
                onChange={(e) =>
                  handleFieldChange(
                    'foundationCatScore',
                    'Phân hạng móng CAT (1-5)',
                    Number(e.target.value)
                  )
                }
                className="w-full px-3 py-2 rounded-xl border border-indigo-300 dark:border-indigo-700 bg-white dark:bg-slate-900 text-xs font-bold text-indigo-800 dark:text-indigo-200"
              >
                <option value={1}>CAT 1 — Móng cọc sâu có hồ sơ hoàn công đầy đủ (1 điểm)</option>
                <option value={2}>CAT 2 — Móng cọc / Bè BTCT có bản vẽ hoàn công (2 điểm)</option>
                <option value={3}>CAT 3 — Móng băng / Cọc BTCT không đầy đủ bản vẽ (3 điểm)</option>
                <option value={4}>CAT 4 — Móng cọc ngắn / Móng đơn BTCT (4 điểm)</option>
                <option value={5}>CAT 5 — Không xác định được hồ sơ móng (5 điểm)</option>
              </select>
            ) : (
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-indigo-100 dark:bg-indigo-950 text-indigo-800 dark:text-indigo-300 border border-indigo-300 font-black text-xs">
                <span>Hạng Móng: CAT {formState.foundationCatScore}</span>
              </div>
            )}
          </div>

          <div>
            <label className="block text-[11px] font-bold text-slate-500 mb-1">
              Chiều sâu đáy móng / Mũi cọc dự kiến (m)
            </label>
            {isEditMode ? (
              <input
                type="text"
                value={formState.foundationDepthM}
                onChange={(e) =>
                  handleFieldChange(
                    'foundationDepthM',
                    'Chiều sâu đáy móng/mũi cọc (m)',
                    e.target.value
                  )
                }
                placeholder="VD: 35m (Cọc khoan nhồi D1000)"
                className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-mono"
              />
            ) : (
              <div className="text-xs font-mono font-bold text-slate-800 dark:text-slate-200">
                {formState.foundationDepthM
                  ? `${formState.foundationDepthM} m`
                  : 'Chưa xác định chiều sâu mũi cọc'}
              </div>
            )}
          </div>
        </div>

        {/* Gatekeeper Warning for CAT 1 / CAT 2 */}
        <div
          className={`p-3 rounded-xl border text-xs flex items-center justify-between gap-3 flex-wrap ${
            isCat1Or2 && asBuiltCount === 0
              ? 'bg-rose-50 dark:bg-rose-950/40 border-rose-300 text-rose-800 dark:text-rose-200'
              : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-700 dark:text-slate-300'
          }`}
        >
          <div className="flex items-center gap-2">
            {isCat1Or2 && asBuiltCount === 0 ? (
              <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
            ) : (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            )}
            <span>
              <strong>Hồ sơ Bản vẽ Hoàn công Kết cấu Móng ({asBuiltCount} tệp):</strong>{' '}
              {isCat1Or2
                ? 'Phân loại CAT 1 / CAT 2 bắt buộc phải đính kèm ít nhất 01 ảnh chụp bản vẽ hoàn công móng!'
                : 'Đính kèm ảnh chụp bản vẽ hoàn công móng từ Ban Quản Lý (nếu có).'}
            </span>
          </div>

          {onOpenPhotoAction && (
            <button
              type="button"
              onClick={() =>
                onOpenPhotoAction({
                  initialMode: 'ADD',
                  category: 'AS_BUILT',
                  targetPhotoType: 'AS_BUILT_DRAWING',
                  photoTitle: 'Bổ sung Bản vẽ Hoàn công Kết cấu Móng Khối tháp',
                })
              }
              className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Thêm Bản Vẽ Hoàn Công</span>
            </button>
          )}
        </div>

        {/* As-Built Drawings Gallery */}
        {asBuiltCount > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
            {formState.asBuiltDrawingPhotos.map((item, idx) => (
              <div
                key={`${item.url}_${idx}`}
                className="p-2 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-1.5"
              >
                <div className="flex items-center justify-between text-[10px] font-mono font-bold text-slate-600">
                  <span className="flex items-center gap-1">
                    <FileText className="w-3 h-3 text-indigo-600" />
                    {item.photoCode || `AS-BUILT-0${idx + 1}`}
                  </span>
                  {isEditMode && (
                    <button
                      type="button"
                      onClick={() => handleRemoveAsBuiltPhoto(idx)}
                      className="text-rose-600 hover:text-rose-700 cursor-pointer"
                      title="Gỡ bản vẽ"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() =>
                    onOpenPhotoZoom(
                      item.url,
                      `Bản vẽ hoàn công móng #${idx + 1}`,
                      item.photoCode
                    )
                  }
                  className="relative w-full h-24 rounded-lg overflow-hidden border border-slate-200 group cursor-pointer block"
                >
                  <img
                    src={item.url}
                    alt={item.photoCode || 'As-Built'}
                    className="w-full h-full object-cover"
                  />
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center">
                    <Maximize2 className="w-4 h-4 text-white" />
                  </div>
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

