import React from 'react';
import { Card } from '../../../../core/components/ui/Card';
import { PhotoCaptureInput } from '../../../../components/common/PhotoCaptureInput';
import { Camera, Trash2, AlertCircle, CheckCircle2, FileText } from 'lucide-react';
import { FloorSurveyData } from '../../types/phase1.types';

interface Step3FloorOverviewSectionProps {
  currentFloor: FloorSurveyData;
  activeFloorIndex: number;
  onUpdateOverviewPhotos: (photos: { id: string; url: string; caption?: string }[]) => void;
}

export const Step3FloorOverviewSection: React.FC<Step3FloorOverviewSectionProps> = ({
  currentFloor,
  activeFloorIndex,
  onUpdateOverviewPhotos,
}) => {
  const rawPhotos = currentFloor.overviewPhotos || [];
  const photos = rawPhotos.map((p: any, idx: number) => {
    if (typeof p === 'string') {
      return { id: `fl_ov_${idx}`, url: p, caption: '' };
    }
    return { id: p?.id || `fl_ov_${idx}`, url: p?.url || '', caption: p?.caption || '' };
  });

  const handleAddPhoto = (url: string) => {
    if (!url) return;
    const newPhoto = {
      id: `fl_ov_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
      url,
      caption: '',
    };
    onUpdateOverviewPhotos([...photos, newPhoto]);
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
            <div className="relative aspect-video rounded-lg overflow-hidden border border-slate-200 bg-slate-900">
              <img
                src={photo.url}
                alt={`Tổng quan ${currentFloor.floorName} - ${pIdx + 1}`}
                className="w-full h-full object-cover"
              />
              <span className="absolute top-1.5 left-1.5 px-2 py-0.5 rounded bg-black/60 backdrop-blur-xs text-white text-[10px] font-mono">
                #{pIdx + 1}
              </span>
              <button
                type="button"
                onClick={() => handleRemovePhoto(photo.id)}
                className="absolute top-1.5 right-1.5 p-1 bg-red-600/90 hover:bg-red-700 text-white rounded-md text-xs transition-opacity cursor-pointer shadow-sm"
                title="Xóa ảnh"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>

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
        <div className="rounded-xl border-2 border-dashed border-emerald-300 bg-emerald-50/20 p-2 flex flex-col justify-center min-h-[170px]">
          <PhotoCaptureInput
            label={photos.length === 0 ? 'Chụp ảnh tổng quan tầng *' : 'Chụp thêm ảnh tổng quan'}
            value=""
            onChange={handleAddPhoto}
            watermarkText={`TONG-QUAN | ${currentFloor.floorName}`}
            height="145px"
            recommendedOrientation="landscape"
            orientationHint="Khuyến nghị xoay ngang điện thoại để chụp rộng toàn cảnh tầng"
          />
        </div>
      </div>
    </Card>
  );
};
