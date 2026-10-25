import React from 'react';
import {
  Camera,
  Maximize2,
  Plus,
  FileImage,
} from 'lucide-react';
import type {
  CondoAreaFormState,
  CondoAuditStepProps,
} from '../../types/condo-audit.types';

export const AreaStep2OverviewCropped: React.FC<
  CondoAuditStepProps<CondoAreaFormState>
> = ({
  formState,
  onOpenPhotoZoom,
  onOpenPhotoAction,
}) => {
  const overviewList = formState.overviewPhotos || [];

  return (
    <div className="space-y-6">
      {/* 1. Bản vẽ CAD cắt vùng (Cropped Area CAD) */}
      <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-800 space-y-3">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2 text-xs font-black text-slate-800 dark:text-slate-100">
            <FileImage className="w-4 h-4 text-indigo-600" />
            <span>Sơ Đồ Mặt Bằng Cắt Riêng Phân Vùng ({formState.unitCode})</span>
          </div>

          {onOpenPhotoAction && (
            <button
              type="button"
              onClick={() =>
                onOpenPhotoAction({
                  initialMode: formState.croppedCadUrl ? 'REPLACE' : 'ADD',
                  category: 'CAD_FLOOR',
                  targetPhotoType: 'CROPPED_CAD_PHOTO',
                  currentPhotoUrl: formState.croppedCadUrl || undefined,
                  currentPhotoCode: `${formState.unitCode}-CAD`,
                  photoTitle: `Sơ đồ mặt bằng phân vùng ${formState.unitCode}`,
                })
              }
              className="px-3 py-1.5 rounded-xl bg-white dark:bg-slate-900 hover:bg-slate-100 text-slate-700 dark:text-slate-200 border border-slate-300 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
            >
              <Camera className="w-3.5 h-3.5 text-indigo-600" />
              <span>
                {formState.croppedCadUrl ? 'Thay Sơ Đồ Cắt Vùng' : 'Tải Lên Sơ Đồ Cắt Vùng'}
              </span>
            </button>
          )}
        </div>

        {formState.croppedCadUrl ? (
          <button
            type="button"
            onClick={() =>
              onOpenPhotoZoom(
                formState.croppedCadUrl,
                `Sơ đồ mặt bằng cắt vùng ${formState.unitCode}`
              )
            }
            className="relative w-full max-h-64 rounded-xl overflow-hidden border border-slate-300 bg-white force-light group cursor-pointer flex items-center justify-center"
          >
            <img
              src={formState.croppedCadUrl}
              alt="Cropped CAD"
              className="max-h-64 object-contain"
            />
            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center">
              <Maximize2 className="w-5 h-5 text-white" />
            </div>
          </button>
        ) : (
          <div className="p-6 rounded-xl border border-dashed border-slate-300 text-center text-xs text-slate-400">
            Sử dụng trực tiếp mặt bằng CAD tầng tổng thể (chưa cắt riêng khung vùng).
          </div>
        )}
      </div>

      {/* 2. Bộ Ảnh Tổng Quan Hiện Trạng Khu Vực Dùng Chung */}
      <div className="space-y-3">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <h3 className="text-xs font-black uppercase tracking-wider text-slate-700 dark:text-slate-200">
            Bộ Ảnh Tổng Quan Hiện Trạng Phân Vùng ({overviewList.length} ảnh)
          </h3>

          {onOpenPhotoAction && (
            <button
              type="button"
              onClick={() =>
                onOpenPhotoAction({
                  initialMode: 'ADD',
                  category: 'FLOOR_OVERVIEW',
                  targetPhotoType: 'AREA_OVERVIEW_PHOTO',
                  photoTitle: `Bổ sung ảnh tổng quan phân vùng ${formState.unitCode}`,
                })
              }
              className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Thêm Ảnh Tổng Quan Phân Vùng</span>
            </button>
          )}
        </div>

        {overviewList.length === 0 ? (
          <div className="p-6 rounded-2xl border border-dashed border-amber-300 bg-amber-50/40 text-center text-xs text-amber-800 font-semibold">
            Chưa có ảnh tổng quan phân vùng dùng chung.
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {overviewList.map((url, idx) => (
              <div
                key={`${url}_${idx}`}
                className="p-2 rounded-xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-800 space-y-1.5"
              >
                <div className="flex items-center justify-between text-[10px] font-mono font-bold text-slate-600">
                  <span>{formState.unitCode}-OV-0{idx + 1}</span>
                  {onOpenPhotoAction && (
                    <button
                      type="button"
                      onClick={() =>
                        onOpenPhotoAction({
                          initialMode: 'REPLACE',
                          category: 'FLOOR_OVERVIEW',
                          targetPhotoType: 'AREA_OVERVIEW_PHOTO',
                          photoIndex: idx,
                          currentPhotoUrl: url,
                          currentPhotoCode: `${formState.unitCode}-OV-0${idx + 1}`,
                          photoTitle: `Ảnh tổng quan #${idx + 1} (${formState.unitCode})`,
                        })
                      }
                      className="text-indigo-600 hover:underline cursor-pointer"
                    >
                      Thay ảnh
                    </button>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() =>
                    onOpenPhotoZoom(
                      url,
                      `Ảnh tổng quan phân vùng ${formState.unitCode} #${idx + 1}`
                    )
                  }
                  className="relative w-full h-32 rounded-lg overflow-hidden border border-slate-300 group cursor-pointer block"
                >
                  <img
                    src={url}
                    alt={`Overview ${idx + 1}`}
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

