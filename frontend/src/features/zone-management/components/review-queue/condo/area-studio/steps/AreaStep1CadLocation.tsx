import React from 'react';
import {
  Building2,
  ExternalLink,
  Maximize2,
  MapPin,
} from 'lucide-react';
import type {
  CondoAreaFormState,
  CondoAuditStepProps,
} from '../../types/condo-audit.types';

export const AreaStep1CadLocation: React.FC<
  CondoAuditStepProps<CondoAreaFormState>
> = ({
  isEditMode,
  formState,
  parentMasterSummary,
  handleFieldChange,
  onOpenPhotoZoom,
  onOpenMasterReportById,
}) => {
  return (
    <div className="space-y-5">
      {/* 1. Thông số kế thừa từ Tòa nhà mẹ */}
      {parentMasterSummary && (
        <div className="p-3.5 rounded-xl bg-indigo-50/60 dark:bg-slate-800/70 border border-indigo-200 dark:border-slate-750 flex items-center justify-between gap-3 flex-wrap text-xs">
          <div className="flex items-center gap-2.5 flex-wrap">
            <Building2 className="w-4 h-4 text-indigo-600 shrink-0" />
            <span>
              Thuộc khối tháp:{' '}
              <strong className="text-slate-900 dark:text-white">
                {parentMasterSummary.buildingName || parentMasterSummary.projectParcelCode}
              </strong>
            </span>
            <span>•</span>
            <span>
              Hạng móng: <strong>CAT {parentMasterSummary.foundationCatScore ?? '--'}</strong>
            </span>
            <span>•</span>
            <span>
              Trạng thái Master:{' '}
              <strong
                className={
                  parentMasterSummary.masterStatus === 'APPROVED'
                    ? 'text-emerald-600'
                    : 'text-amber-600'
                }
              >
                {parentMasterSummary.masterStatus}
              </strong>
            </span>
          </div>

          {parentMasterSummary.masterReportId && onOpenMasterReportById && (
            <button
              type="button"
              onClick={() => onOpenMasterReportById(parentMasterSummary.masterReportId!)}
              className="px-2.5 py-1 rounded-lg bg-white dark:bg-slate-900 border border-indigo-200 text-indigo-700 text-[11px] font-bold flex items-center gap-1 cursor-pointer"
            >
              <span>Xem Hồ sơ Tòa Mẹ</span>
              <ExternalLink className="w-3 h-3" />
            </button>
          )}
        </div>
      )}

      {/* 2. Định danh Phân vùng Dùng Chung */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div>
          <label className="block text-[11px] font-bold text-slate-500 mb-1">
            Mã phân vùng (Area Code)
          </label>
          <div className="p-2.5 rounded-xl bg-amber-100/70 dark:bg-amber-950/60 border border-amber-300 text-xs font-mono font-black text-amber-900 dark:text-amber-200">
            {formState.unitCode}
          </div>
        </div>

        <div>
          <label className="block text-[11px] font-bold text-slate-500 mb-1">
            Tầng / Cao trình (Floor Number)
          </label>
          {isEditMode ? (
            <input
              type="number"
              value={formState.floorNumber}
              onChange={(e) =>
                handleFieldChange(
                  'floorNumber',
                  'Số tầng phân vùng dùng chung',
                  Number(e.target.value)
                )
              }
              className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-mono font-bold"
            />
          ) : (
            <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 text-xs font-mono font-bold">
              {formState.floorNumber < 0
                ? `Hầm B${Math.abs(formState.floorNumber)}`
                : `Tầng ${formState.floorNumber}`}
            </div>
          )}
        </div>

        <div>
          <label className="block text-[11px] font-bold text-slate-500 mb-1">
            Tên phân vùng dùng chung
          </label>
          {isEditMode ? (
            <input
              type="text"
              value={formState.areaName}
              onChange={(e) =>
                handleFieldChange(
                  'areaName',
                  'Tên phân vùng dùng chung',
                  e.target.value
                )
              }
              className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-bold"
            />
          ) : (
            <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 text-xs font-black text-slate-900 dark:text-slate-100">
              {formState.areaName}
            </div>
          )}
        </div>

        <div>
          <label className="block text-[11px] font-bold text-slate-500 mb-1">
            Phân loại không gian chung
          </label>
          {isEditMode ? (
            <select
              value={formState.areaCategory}
              onChange={(e) =>
                handleFieldChange(
                  'areaCategory',
                  'Loại không gian dùng chung',
                  e.target.value
                )
              }
              className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-bold"
            >
              <option value="BASEMENT_PARKING">Tầng hầm để xe / Vách hầm</option>
              <option value="CORRIDOR_LOBBY">Sảnh chính / Hành lang tầng</option>
              <option value="ELEVATOR_STAIR_CORE">Lõi thang máy / Thang bộ thoát hiểm</option>
              <option value="TECHNICAL_MEP_ROOM">Phòng kỹ thuật MEP / Trạm bơm PCCC</option>
              <option value="ROOF_TERRACE">Tầng mái / Sân thượng kỹ thuật</option>
              <option value="EXTERIOR_PODIUM">Mặt ngoài khối đế / Khuôn viên</option>
            </select>
          ) : (
            <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 text-xs font-bold">
              {formState.areaCategory}
            </div>
          )}
        </div>

        <div className="md:col-span-3">
          <label className="block text-[11px] font-bold text-slate-500 mb-1">
            Mô tả trục định vị / Giới hạn phân vùng
          </label>
          {isEditMode ? (
            <input
              type="text"
              value={formState.locationDescription}
              onChange={(e) =>
                handleFieldChange(
                  'locationDescription',
                  'Mô tả vị trí phân vùng chung',
                  e.target.value
                )
              }
              placeholder="VD: Trục A-D / Trục 1-5 tầng hầm B1 tiếp giáp phía đường Cách Mạng Tháng 8..."
              className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs"
            />
          ) : (
            <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 text-xs">
              {formState.locationDescription || 'Chưa có mô tả chi tiết.'}
            </div>
          )}
        </div>

        <div>
          <label className="block text-[11px] font-bold text-slate-500 mb-1">
            Trạng thái tiếp cận phân vùng
          </label>
          {isEditMode ? (
            <select
              value={formState.accessStatus}
              onChange={(e) =>
                handleFieldChange(
                  'accessStatus',
                  'Trạng thái tiếp cận phân vùng',
                  e.target.value
                )
              }
              className="w-full px-3 py-2 rounded-xl border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-bold"
            >
              <option value="FULL">Tiếp cận đầy đủ 100%</option>
              <option value="PARTIAL">Tiếp cận một phần</option>
              <option value="LOCKED">Phòng kỹ thuật khóa cửa</option>
            </select>
          ) : (
            <div className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 text-xs font-bold">
              {formState.accessStatus}
            </div>
          )}
        </div>
      </div>

      {/* 3. Mặt bằng CAD Tầng & Khung Định vị BBox */}
      {formState.floorCadUrl && (
        <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/40 border border-slate-200 dark:border-slate-800 space-y-2.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-black text-slate-800 dark:text-slate-100 flex items-center gap-1.5">
              <MapPin className="w-4 h-4 text-indigo-600" />
              <span>Định vị Phân vùng {formState.unitCode} trên Mặt bằng CAD Tầng</span>
            </span>
            <button
              type="button"
              onClick={() =>
                onOpenPhotoZoom(
                  formState.floorCadUrl,
                  `Mặt bằng CAD Tầng ${formState.floorNumber} — ${formState.unitCode}`
                )
              }
              className="px-2.5 py-1 rounded-lg bg-white dark:bg-slate-900 border border-slate-300 text-[11px] font-bold flex items-center gap-1 cursor-pointer"
            >
              <Maximize2 className="w-3 h-3" />
              <span>Phóng to CAD Tầng</span>
            </button>
          </div>

          <div className="relative w-full max-h-72 overflow-hidden rounded-xl border border-slate-300 bg-white force-light flex items-center justify-center">
            <img
              src={formState.floorCadUrl}
              alt="Floor CAD"
              className="max-h-72 w-auto object-contain"
            />
          </div>
        </div>
      )}
    </div>
  );
};

