import React from 'react';
import {
  MapPin,
  Compass,
  Layers,
  Maximize2,
} from 'lucide-react';
import type {
  CondoAuditStepProps,
  CondoMasterFormState,
} from '../../types/condo-audit.types';

export const MasterStep4ScopeGisMetro: React.FC<
  CondoAuditStepProps<CondoMasterFormState>
> = ({
  isEditMode,
  formState,
  floorPlans = [],
  handleFieldChange,
  handleNestedFieldChange,
  onOpenPhotoZoom,
}) => {
  return (
    <div className="space-y-6">
      {/* 1. Cự ly đến Tim tuyến / Mép công trình ngầm Metro Tuyến số 2 */}
      <div className="p-4 rounded-2xl bg-teal-50/40 dark:bg-slate-800/50 border border-teal-200 dark:border-slate-750 grid grid-cols-1 md:grid-cols-3 gap-4">
        <div>
          <label className="block text-[11px] font-bold text-slate-500 mb-1">
            Khoảng cách đến Tim tuyến Metro (m)
          </label>
          {isEditMode ? (
            <input
              type="number"
              step="0.1"
              value={formState.metroOffsetDistance}
              onChange={(e) =>
                handleFieldChange(
                  'metroOffsetDistance',
                  'Khoảng cách đến tim tuyến Metro (m)',
                  e.target.value
                )
              }
              className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-mono font-bold"
            />
          ) : (
            <div className="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-teal-200 dark:border-slate-800 text-xs font-mono font-black text-teal-800 dark:text-teal-300 flex items-center gap-1.5">
              <Compass className="w-4 h-4 text-teal-600" />
              <span>{formState.metroOffsetDistance || '--'} m</span>
            </div>
          )}
        </div>

        <div>
          <label className="block text-[11px] font-bold text-slate-500 mb-1">
            Khoảng cách tịnh không đến Mép hầm / Ga (m)
          </label>
          {isEditMode ? (
            <input
              type="number"
              step="0.1"
              value={formState.clearanceOffsetDistance}
              onChange={(e) =>
                handleFieldChange(
                  'clearanceOffsetDistance',
                  'Khoảng cách đến mép hầm/nhà ga Metro (m)',
                  e.target.value
                )
              }
              className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-mono font-bold"
            />
          ) : (
            <div className="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs font-mono font-bold">
              {formState.clearanceOffsetDistance || formState.metroOffsetDistance || '--'} m
            </div>
          )}
        </div>

        <div>
          <label className="block text-[11px] font-bold text-slate-500 mb-1">
            Xác nhận Ranh giới Địa chính GIS
          </label>
          {isEditMode ? (
            <select
              value={formState.gisMutationConfirmed?.type || 'NONE'}
              onChange={(e) =>
                handleNestedFieldChange(
                  'gisMutationConfirmed',
                  'type',
                  'Trạng thái biến động ranh GIS khối tháp',
                  e.target.value
                )
              }
              className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-bold"
            >
              <option value="NONE">Khớp ranh bản đồ địa chính gốc</option>
              <option value="BOUNDARY_ADJUST">Có điều chỉnh ranh khuôn viên thực tế</option>
              <option value="MERGE">Hợp thửa dự án chung cư</option>
            </select>
          ) : (
            <div className="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-xs font-bold flex items-center gap-1.5">
              <MapPin className="w-4 h-4 text-indigo-600" />
              <span>
                {formState.gisMutationConfirmed?.type === 'BOUNDARY_ADJUST'
                  ? 'Có điều chỉnh ranh thực tế'
                  : 'Khớp ranh địa chính GIS'}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* 2. Danh sách Mặt bằng CAD các tầng của Khối tháp (building_floor_plans) */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-200 flex items-center gap-1.5">
            <Layers className="w-4 h-4 text-indigo-600" />
            <span>
              Hồ Sơ Mặt Bằng Kiến Trúc / CAD Các Tầng Điển Hình ({floorPlans.length} tầng)
            </span>
          </h3>
        </div>

        {floorPlans.length === 0 ? (
          <div className="p-4 rounded-xl border border-dashed border-slate-300 dark:border-slate-700 text-xs text-slate-500 text-center">
            Chưa có bản vẽ mặt bằng CAD tầng nào được tải lên cho khối tháp này.
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {floorPlans.map((fp) => (
              <div
                key={fp.id}
                className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 space-y-2"
              >
                <div className="flex items-center justify-between text-xs font-black">
                  <span className="px-2 py-0.5 rounded bg-indigo-600 text-white font-mono text-[11px]">
                    {fp.floor_name || (fp.floor_number < 0 ? `B${Math.abs(fp.floor_number)}` : `Tầng ${fp.floor_number}`)}
                  </span>
                </div>
                {fp.cad_photo_url ? (
                  <button
                    type="button"
                    onClick={() =>
                      onOpenPhotoZoom(
                        fp.cad_photo_url!,
                        `Mặt bằng CAD ${fp.floor_name || `Tầng ${fp.floor_number}`}`
                      )
                    }
                    className="relative w-full h-24 rounded-lg overflow-hidden border border-slate-300 bg-white force-light group cursor-pointer block"
                  >
                    <img
                      src={fp.cad_photo_url}
                      alt={fp.floor_name || `Floor ${fp.floor_number}`}
                      className="w-full h-full object-contain"
                    />
                    <div className="absolute inset-0 bg-black/45 opacity-0 group-hover:opacity-100 flex items-center justify-center">
                      <Maximize2 className="w-4 h-4 text-white" />
                    </div>
                  </button>
                ) : (
                  <div className="h-24 rounded-lg border border-dashed border-slate-300 flex items-center justify-center text-[11px] text-slate-400">
                    Chưa có file CAD
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

