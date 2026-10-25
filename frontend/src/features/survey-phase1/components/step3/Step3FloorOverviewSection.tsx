import React from 'react';
import { Card } from '../../../../core/components/ui/Card';
import { PhotoCaptureInput } from '../../../../components/common/PhotoCaptureInput';
import { TapToZoomThumbnail } from '../../../../components/common/TapToZoomThumbnail';
import { Camera, Trash2, AlertCircle, CheckCircle2, FileText } from 'lucide-react';
import type { FloorSurveyData } from '../../types/phase1.types';
import type { PhotoChangeMeta } from '../../../../components/common/photo-capture/types';
import { upsertPhotoObjectList } from '../../../../components/common/photo-capture/domain/photoCollectionMutator';

interface Step3FloorOverviewSectionProps {
  currentFloor: FloorSurveyData;
  activeFloorIndex: number;
  projectParcelCode?: string;
  onUpdateOverviewPhotos: (photos: { id: string; url: string; caption?: string; photoCode?: string }[]) => void;
}

export const Step3FloorOverviewSection: React.FC<Step3FloorOverviewSectionProps> = ({
  currentFloor,
  activeFloorIndex,
  projectParcelCode,
  onUpdateOverviewPhotos,
}) => {
  const rawPhotos = currentFloor.overviewPhotos || [];
  const normalizedPhotos = rawPhotos.map((p: string | { id?: string; url?: string; caption?: string; photoCode?: string }, idx: number) => {
    if (typeof p === 'string') {
      return { id: `fl_ov_${idx}`, url: p, caption: '', photoCode: '' };
    }
    return {
      id: p?.id || `fl_ov_${idx}`,
      url: p?.url || '',
      caption: p?.caption || '',
      photoCode: p?.photoCode || '',
    };
  });

  // Tự động lọc trùng (self-heal) theo URL hoặc photoCode để xử lý triệt để bản nháp cũ
  const seenUrls = new Set<string>();
  const seenCodes = new Set<string>();
  const photos = normalizedPhotos.filter((p) => {
    if (p.url && seenUrls.has(p.url)) return false;
    if (p.url) seenUrls.add(p.url);
    if (p.photoCode && seenCodes.has(p.photoCode)) return false;
    if (p.photoCode) seenCodes.add(p.photoCode);
    return true;
  });

  const handleAddPhoto = (url: string, code?: string, meta?: PhotoChangeMeta) => {
    if (!url) return;

    // [ND-04] Sử dụng Trụ cột 1 (PhotoCollectionMutator) thay thế nguyên tử qua meta.replacesUri,
    // loại bỏ hoàn toàn biến lastTempPhotoIdRef gây lỗi ghi đè mất ảnh trước khi chụp liên tiếp.
    if (!meta?.replacesUri && code) {
      const codeIdx = photos.findIndex((p) => p.photoCode && p.photoCode === code);
      if (codeIdx >= 0) {
        const updatedByCode = [...photos];
        updatedByCode[codeIdx] = { ...updatedByCode[codeIdx], url };
        onUpdateOverviewPhotos(updatedByCode);
        return;
      }
    }

    const newId = `fl_ov_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const updated = upsertPhotoObjectList(
      photos,
      {
        id: newId,
        url,
        caption: '',
        photoCode: code || '',
      },
      meta
    );
    onUpdateOverviewPhotos(updated);
  };

  const handleRemovePhoto = (photoId: string) => {
    onUpdateOverviewPhotos(photos.filter((p) => p.id !== photoId));
  };

  const handleUpdateCaption = (photoId: string, caption: string) => {
    onUpdateOverviewPhotos(
      photos.map((p) => (p.id === photoId ? { ...p, caption } : p))
    );
  };

  return (
    <Card
      id={`step3-floor-overview-section-${activeFloorIndex}`}
      className="border-slate-200 bg-white space-y-4 shadow-xs"
    >
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <Camera className="w-5 h-5 text-emerald-600" />
          <div>
            <h2 className="text-base sm:text-lg font-bold text-slate-800 flex items-center gap-2">
              <span>Ảnh Chụp Tổng Quan Tầng: {currentFloor.floorName}</span>
              <span className="text-red-500 font-bold">*</span>
            </h2>
            <p className="text-xs text-slate-500">
              Chụp ảnh tổng thể không gian tầng để định vị hiện trạng trước khi khảo sát chi tiết từng Vùng Z và Cấu kiện E
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {photos.length > 0 ? (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
              <CheckCircle2 size={13} className="text-emerald-600" />
              Đã chụp {photos.length} ảnh
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-50 text-amber-700 border border-amber-200">
              <AlertCircle size={13} className="text-amber-600" />
              Bắt buộc tối thiểu 1 ảnh
            </span>
          )}
        </div>
      </div>

      {/* Grid danh sách ảnh đã chụp kèm ô ghi chú cho từng ảnh */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
        {photos.map((photo, pIdx) => (
          <div
            key={photo.id || pIdx}
            className="rounded-xl border border-slate-200 bg-slate-50 p-2.5 space-y-2 group shadow-2xs"
          >
            <TapToZoomThumbnail
              src={photo.url}
              label={`#${pIdx + 1}`}
              photoCode={photo.photoCode}
              alt={photo.photoCode || `Tổng quan ${currentFloor.floorName} - ${pIdx + 1}`}
              actions={
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    handleRemovePhoto(photo.id);
                  }}
                  className="absolute top-1.5 right-1.5 p-1 bg-red-600/90 hover:bg-red-700 text-white rounded-md text-xs opacity-90 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity cursor-pointer shadow-sm pointer-events-auto z-30 flex items-center justify-center active:scale-95"
                  title="Xóa ảnh"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              }
            />

            <div className="space-y-1">
              <div className="flex items-center gap-1 text-[11px] font-semibold text-slate-700">
                <FileText size={12} className="text-slate-400" />
                <span>Ghi chú ảnh #{pIdx + 1}:</span>
              </div>
              <input
                type="text"
                placeholder="VD: Toàn cảnh sảnh chính nhìn từ cửa ra vào..."
                value={photo.caption || ''}
                onChange={(e) => handleUpdateCaption(photo.id, e.target.value)}
                className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs text-slate-800 placeholder:text-slate-400 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
            </div>
          </div>
        ))}

        {/* Nút chụp thêm ảnh tổng quan */}
        <div className="flex flex-col justify-center">
          <PhotoCaptureInput
            label={photos.length === 0 ? 'Chụp ảnh tổng quan tầng *' : 'Chụp thêm ảnh tổng quan'}
            value=""
            onChange={(newUrl, pCode, meta) => handleAddPhoto(newUrl, pCode, meta)}
            watermarkOptions={{
              parcelCode: projectParcelCode,
              floor: currentFloor.floorName,
              photoType: 'OVERVIEW',
              photoIndex: photos.length + 1,
            }}
            height="150px"
            recommendedOrientation="landscape"
            orientationHint="Khuyến nghị xoay ngang điện thoại để chụp rộng toàn cảnh tầng"
          />
        </div>
      </div>
    </Card>
  );
};
