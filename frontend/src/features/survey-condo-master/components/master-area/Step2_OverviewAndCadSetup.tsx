import React from 'react';
import {
  Crop,
  ArrowRight,
  ArrowLeft,
  Loader2,
  Trash2,
  ZoomIn,
  CheckCircle2,
  AlertCircle,
  Upload,
  Camera,
} from 'lucide-react';
import { PhotoCaptureInput } from '../../../../components/common/PhotoCaptureInput';
import type { EvidencePhotoItem } from '../../../survey-phase1/types/phase1.types';
import type { NormalizedBbox } from '../../types/masterAreaSurvey.types';
import type { MetroWatermarkOptions } from '../../../../utils/watermarkEngine';

interface Step2OverviewAndCadSetupProps {
  unitCode: string;
  floorName: string;
  overviewPhotos: EvidencePhotoItem[];
  onAddOverviewPhoto: (url: string, photoCode?: string) => void;
  onRemoveOverviewPhoto: (index: number) => void;
  cadSketchPhotoUrl: string;
  onCadSketchPhotoUrlChange: (url: string) => void;
  cadStructuralSketchPhotoUrl: string;
  onCadStructuralSketchPhotoUrlChange: (url: string) => void;
  useSeparateStructuralCad: boolean;
  onToggleSeparateStructuralCad: (enabled: boolean) => void;
  isCroppingCad: boolean;
  onOpenCadCropModal: () => void;
  activeBbox: NormalizedBbox | null;
  hasParentCad: boolean;
  watermarkOptions?: MetroWatermarkOptions;
  isReadOnly?: boolean;
  onBack: () => void;
  onNext: () => void;
  onPreviewImage: (url: string) => void;
}

export const Step2_OverviewAndCadSetup: React.FC<Step2OverviewAndCadSetupProps> = ({
  unitCode,
  floorName,
  overviewPhotos,
  onAddOverviewPhoto,
  onRemoveOverviewPhoto,
  cadSketchPhotoUrl,
  onCadSketchPhotoUrlChange,
  cadStructuralSketchPhotoUrl: _cadStructuralSketchPhotoUrl,
  onCadStructuralSketchPhotoUrlChange: _onCadStructuralSketchPhotoUrlChange,
  useSeparateStructuralCad: _useSeparateStructuralCad,
  onToggleSeparateStructuralCad: _onToggleSeparateStructuralCad,
  isCroppingCad,
  onOpenCadCropModal,
  activeBbox: _activeBbox,
  hasParentCad,
  watermarkOptions,
  isReadOnly,
  onBack,
  onNext,
  onPreviewImage,
}) => {
  return (
    <div className="flex flex-col gap-4 animate-in fade-in duration-200">
      {/* =============================================================== */}
      {/* 2.1: CHỤP ẢNH HIỆN TRẠNG TỔNG QUAN KHU VỰC */}
      {/* =============================================================== */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col gap-3.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded-md bg-indigo-600 text-white font-bold text-xs">
              2.1
            </span>
            <h3 className="text-sm sm:text-base font-bold text-slate-800">
              Ảnh toàn cảnh khu vực ({overviewPhotos.length} ảnh)
            </h3>
          </div>
          <span className="text-xs text-slate-500 hidden sm:inline">
            Chụp bao quát không gian lối đi, sảnh chung
          </span>
        </div>

        {/* Lưới danh sách ảnh đã chụp */}
        {overviewPhotos.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {overviewPhotos.map((photo, pIdx) => (
              <div
                key={photo.photoCode || pIdx}
                className="relative aspect-4/3 rounded-xl overflow-hidden border border-slate-200 bg-slate-100 group shadow-xs hover:border-slate-300 transition-all"
              >
                <img
                  src={photo.url}
                  alt={photo.notes || `Ảnh ${pIdx + 1}`}
                  className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                  <button
                    type="button"
                    onClick={() => onPreviewImage(photo.url)}
                    className="p-1.5 bg-white/95 text-slate-800 rounded-lg hover:bg-white shadow-xs cursor-pointer"
                    title="Xem phóng to"
                  >
                    <ZoomIn size={14} />
                  </button>
                  {!isReadOnly && (
                    <button
                      type="button"
                      onClick={() => onRemoveOverviewPhoto(pIdx)}
                      className="p-1.5 bg-red-600 text-white rounded-lg hover:bg-red-700 shadow-xs cursor-pointer"
                      title="Xóa ảnh này"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
                <div className="absolute bottom-1.5 left-1.5 right-1.5 flex items-center justify-between">
                  <span className="px-1.5 py-0.5 rounded bg-black/70 text-[10px] font-mono text-white">
                    #{pIdx + 1}
                  </span>
                  {photo.url.startsWith('http') || photo.url.startsWith('/uploads') ? (
                    <span className="px-1.5 py-0.5 rounded bg-emerald-600/90 text-[9px] font-bold text-white">
                      Cloud R2
                    </span>
                  ) : (
                    <span className="px-1.5 py-0.5 rounded bg-amber-600/90 text-[9px] font-bold text-white">
                      Lưu máy
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Khung chụp / tải thêm ảnh chuẩn responsive, không bị bóp nghẹt */}
        {!isReadOnly && (
          <div className="rounded-xl border border-dashed border-indigo-200 bg-indigo-50/30 p-3 sm:p-4">
            <PhotoCaptureInput
              label="Chụp / Tải thêm ảnh toàn cảnh khu vực"
              value=""
              onChange={(newUrl, photoCode) => onAddOverviewPhoto(newUrl, photoCode)}
              watermarkOptions={watermarkOptions}
              photoCode={`P01_${unitCode}_${overviewPhotos.length + 1}`}
              height="150px"
            />
          </div>
        )}
      </div>

      {/* =============================================================== */}
      {/* 2.2: THIẾT LẬP BẢN VẼ SƠ ĐỒ KHU VỰC (2 BUTTONS + CAD BÊN DƯỚI) */}
      {/* =============================================================== */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col gap-3.5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="px-2 py-0.5 rounded-md bg-indigo-600 text-white font-bold text-xs">
              2.2
            </span>
            <h3 className="text-sm sm:text-base font-bold text-slate-800">
              Bản vẽ sơ đồ khu vực {unitCode}
            </h3>
          </div>
          {cadSketchPhotoUrl ? (
            <span className="text-emerald-700 bg-emerald-50 border border-emerald-200 text-xs font-bold px-2.5 py-0.5 rounded-full flex items-center gap-1">
              <CheckCircle2 size={13} /> Đã có CAD
            </span>
          ) : (
            <span className="text-amber-700 bg-amber-50 border border-amber-200 text-xs font-bold px-2.5 py-0.5 rounded-full flex items-center gap-1">
              <AlertCircle size={13} /> Chưa có CAD
            </span>
          )}
        </div>

        {/* 2 Nút chức năng: [ Trích xuất từ CAD tầng ] & [ Tải ảnh / CAD riêng ] */}
        {!isReadOnly && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <button
              type="button"
              onClick={onOpenCadCropModal}
              disabled={isCroppingCad || !hasParentCad}
              className="w-full py-2.5 px-3 rounded-xl border border-indigo-200 bg-indigo-50/70 hover:bg-indigo-100 text-indigo-700 text-xs sm:text-sm font-bold flex items-center justify-center gap-2 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed shadow-2xs"
            >
              {isCroppingCad ? (
                <>
                  <Loader2 size={15} className="animate-spin" />
                  <span>Đang xử lý cắt CAD...</span>
                </>
              ) : (
                <>
                  <Crop size={15} />
                  <span>Trích xuất từ CAD tầng (Kéo thả ô cắt)</span>
                </>
              )}
            </button>

            <div className="w-full">
              <PhotoCaptureInput
                label="Tải ảnh / CAD riêng"
                value={cadSketchPhotoUrl}
                onChange={(url) => onCadSketchPhotoUrlChange(url)}
                watermarkOptions={watermarkOptions}
                photoCode={`CAD_${unitCode}`}
                allowPdf={true}
                pdfFloorName={floorName}
                height="70px"
              />
            </div>
          </div>
        )}

        {/* Khung hiển thị Bản vẽ CAD Khu vực */}
        {cadSketchPhotoUrl ? (
          <div className="relative rounded-xl border border-slate-200 bg-slate-50 p-2 overflow-hidden flex flex-col items-center">
            <img
              src={cadSketchPhotoUrl}
              alt="Bản vẽ sơ đồ khu vực"
              className="max-h-[50vh] w-auto object-contain rounded-lg shadow-xs cursor-pointer hover:opacity-95 transition-opacity"
              onClick={() => onPreviewImage(cadSketchPhotoUrl)}
            />
            <div className="w-full flex items-center justify-between pt-2 px-1 text-xs text-slate-500">
              <span className="font-mono">Sơ đồ đã sẵn sàng cho Bước 3 & Bước 4</span>
              <button
                type="button"
                onClick={() => onPreviewImage(cadSketchPhotoUrl)}
                className="text-indigo-600 hover:text-indigo-800 font-bold flex items-center gap-1 cursor-pointer"
              >
                <ZoomIn size={13} />
                <span>Xem phóng to</span>
              </button>
            </div>
          </div>
        ) : (
          <div className="p-8 rounded-xl border border-dashed border-slate-300 bg-slate-50 text-center flex flex-col items-center justify-center gap-2">
            <Crop className="w-8 h-8 text-slate-400" />
            <p className="text-xs text-slate-500">
              Bấm nút <span className="font-bold text-indigo-600">"Trích xuất từ CAD tầng"</span> để kéo thả ô chữ nhật cắt bản vẽ, hoặc tải lên ảnh CAD riêng của khu vực.
            </p>
          </div>
        )}
      </div>

      {/* Điều hướng Bước 2 */}
      <div className="flex items-center justify-between pt-2">
        <button
          type="button"
          onClick={onBack}
          className="px-4 py-2.5 rounded-xl border border-slate-300 text-xs font-bold text-slate-700 hover:bg-slate-100 flex items-center gap-1.5 cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Quay lại Bước 1</span>
        </button>

        <button
          type="button"
          onClick={onNext}
          className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs sm:text-sm flex items-center gap-2 shadow-md cursor-pointer transition-all"
        >
          <span>Sang Bước 3: Vùng Z & Khuyết Tật</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
