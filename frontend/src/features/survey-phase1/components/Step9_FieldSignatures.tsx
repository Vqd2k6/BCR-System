import React, { useRef, useState } from 'react';
import { usePhase1SurveyStore } from '../store/usePhase1SurveyStore';
import { Card } from '../../../core/components/ui/Card';
import { Button } from '../../../core/components/ui/Button';
import { Textarea } from '../../../core/components/ui/FormControls';
import {
  FileCheck2,
  Send,
  Trash2,
  Plus,
  Upload,
  Camera,
  Image as ImageIcon,
  RefreshCw,
  AlertCircle,
  Eye,
  Edit3,
  FileText,
} from 'lucide-react';
import { ImageAnnotationModal } from '../../../components/common/ImageAnnotationModal';
import { PhotoLightboxModal } from '../../../components/common/photo-capture/components/PhotoLightboxModal';
import { useLightbox } from '../../../components/common/photo-capture/hooks/useLightbox';
import { applyMetroWatermark } from '../../../utils/watermarkEngine';
import { uploadQueue } from '../../../core/services/uploadQueueService';

interface Step9Props {
  onSubmitFinal: () => void;
  isSubmitting?: boolean;
  readOnly?: boolean;
}

export const Step9_FieldSignatures: React.FC<Step9Props> = ({ onSubmitFinal, isSubmitting = false, readOnly = false }) => {
  const { formData, updateFormData, prevStep } = usePhase1SurveyStore();
  const sigs = formData.signatures;

  const cameraInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isProcessingBatch, setIsProcessingBatch] = useState(false);

  // Lưu trữ Blob cho các ảnh chưa hoàn tất tải để retry nếu lỗi
  const blobsRef = useRef<Map<string, { blob: Blob; filename: string; folder: string; metadata: Record<string, string> }>>(new Map());

  // Trạng thái upload R2 cho từng URL: UPLOADING | SUCCESS | ERROR
  const [uploadStatusMap, setUploadStatusMap] = useState<Record<string, 'UPLOADING' | 'SUCCESS' | 'ERROR'>>({});

  // Lightbox phóng to ảnh biên bản (pinch-to-zoom + pan)
  const [lightboxUrl, setLightboxUrl] = useState<string | null>(null);
  const {
    lightboxZoom,
    lightboxPan,
    isLightboxPinching,
    resetLightbox,
    handleLightboxTouchStart,
    handleLightboxTouchMove,
    handleLightboxTouchEnd,
    handleLightboxWheel,
  } = useLightbox();
  const [annotatingIndex, setAnnotatingIndex] = useState<number | null>(null);

  // Thống kê nhanh toàn bộ hồ sơ
  const totalFloors = formData.floors.length;
  const totalZoneZ = formData.floors.reduce((acc, f) => acc + (f.zones?.length || 0), 0);
  const totalZoneE = formData.floors.reduce((acc, f) => acc + (f.structuralElements?.length || 0), 0);
  const totalDefects = formData.floors.reduce(
    (acc, f) =>
      acc +
      (f.zones?.reduce((zacc, z) => zacc + (z.defects?.length || 0), 0) || 0) +
      (f.structuralElements?.reduce((eacc, e) => eacc + (e.defects?.length || 0), 0) || 0),
    0
  );

  const handleCompleteSurvey = () => {
    onSubmitFinal();
  };

  const minutesPhotos = (sigs.workingMinutesPhotos || []).filter(Boolean);

  // Hàm xử lý ảnh: Đọc -> Dập Watermark Canvas -> Preview tức thì -> Tải lên Cloudflare R2
  const processAndUploadFiles = async (files: FileList | File[]) => {
    if (!files || files.length === 0) return;
    setIsProcessingBatch(true);

    const parcelCode = formData.projectParcelCode || formData.officialCadastralCode || 'PARCEL';
    const cleanParcel = parcelCode.replace(/&/g, '_').replace(/[^a-zA-Z0-9_-]/g, '').toUpperCase();
    const folder = `surveys/${cleanParcel}/DOC`;

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      try {
        // 1. Đọc file sang Base64
        const rawDataUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });

        // 2. Tính số thứ tự và dập Watermark Metro 2
        const currentList = (usePhase1SurveyStore.getState().formData.signatures.workingMinutesPhotos || []).filter(Boolean);
        const photoIndex = currentList.length + 1;

        const watermarked = await applyMetroWatermark(rawDataUrl, {
          parcelCode,
          floor: 'DOC',
          zoneOrRoom: 'MINUTES',
          photoType: 'MINUTES',
          photoIndex,
        });

        const localDataUrl = watermarked.dataUrl;
        const photoCode = watermarked.photoCode || `HCM_M2.[${cleanParcel}]_DOC_MINUTES_${String(photoIndex).padStart(2, '0')}`;

        // 3. Cập nhật ngay preview Base64 có Watermark vào Store để KSV nhìn thấy tức thì
        const updatedList = [...currentList, localDataUrl];
        updateFormData({
          signatures: {
            ...sigs,
            workingMinutesPhotos: updatedList,
          },
        });

        // Đánh dấu trạng thái đang tải lên Cloudflare R2
        setUploadStatusMap((prev) => ({ ...prev, [localDataUrl]: 'UPLOADING' }));

        // 4. Chuẩn bị Metadata R2
        const filename = `${photoCode.replace(/[^a-zA-Z0-9_-]/g, '_')}_${Date.now()}.jpg`;
        const metadata: Record<string, string> = {
          'photo-code': photoCode,
          'building-code': cleanParcel,
          'photo-type': 'MINUTES',
          'floor': 'DOC',
          'survey-phase': 'PHASE_1',
          'project': 'METRO2_HCM',
          'captured-at': new Date().toISOString(),
        };

        // 5. Chuẩn bị Blob và lưu vào bộ nhớ tạm để phục vụ Retry nếu cần
        let uploadBlob = watermarked.blob;
        if (!uploadBlob) {
          const byteString = atob(localDataUrl.split(',')[1]);
          const ab = new ArrayBuffer(byteString.length);
          const ia = new Uint8Array(ab);
          for (let j = 0; j < byteString.length; j++) {
            ia[j] = byteString.charCodeAt(j);
          }
          uploadBlob = new Blob([ab], { type: 'image/jpeg' });
        }

        blobsRef.current.set(localDataUrl, {
          blob: uploadBlob,
          filename,
          folder,
          metadata,
        });

        // 6. Đưa vào hàng đợi Upload trực tiếp lên Cloudflare R2
        uploadQueue.enqueue(uploadBlob, filename, {
          folder,
          mimeType: 'image/jpeg',
          metadata,
          onSuccess: (publicUrl) => {
            // Thay thế localDataUrl bằng publicUrl của R2 trong Store
            const latestList = (usePhase1SurveyStore.getState().formData.signatures.workingMinutesPhotos || []).filter(Boolean);
            const replacedList = latestList.map((url) => (url === localDataUrl ? publicUrl : url));
            updateFormData({
              signatures: {
                ...usePhase1SurveyStore.getState().formData.signatures,
                workingMinutesPhotos: replacedList,
              },
            });

            blobsRef.current.delete(localDataUrl);
            setUploadStatusMap((prev) => {
              const next = { ...prev };
              delete next[localDataUrl];
              next[publicUrl] = 'SUCCESS';
              return next;
            });
          },
          onError: (err) => {
            console.warn('[Step9] Lỗi upload R2 cho biên bản hiện trường:', err);
            setUploadStatusMap((prev) => ({ ...prev, [localDataUrl]: 'ERROR' }));
          },
        });
      } catch (err) {
        console.error('[Step9] Lỗi xử lý watermark hoặc upload ảnh biên bản:', err);
        alert(`Có lỗi xảy ra khi xử lý ảnh ${file.name}`);
      }
    }
    setIsProcessingBatch(false);
  };

  // Thử lại upload khi gặp sự cố mạng
  const handleRetryUpload = (url: string) => {
    const item = blobsRef.current.get(url);
    if (!item) {
      alert('Không tìm thấy tệp ảnh gốc trong bộ nhớ tạm để tải lại. Vui lòng chọn lại ảnh.');
      return;
    }

    setUploadStatusMap((prev) => ({ ...prev, [url]: 'UPLOADING' }));

    uploadQueue.enqueue(item.blob, item.filename, {
      folder: item.folder,
      mimeType: 'image/jpeg',
      metadata: item.metadata,
      onSuccess: (publicUrl) => {
        const latestList = (usePhase1SurveyStore.getState().formData.signatures.workingMinutesPhotos || []).filter(Boolean);
        const replacedList = latestList.map((i) => (i === url ? publicUrl : i));
        updateFormData({
          signatures: {
            ...usePhase1SurveyStore.getState().formData.signatures,
            workingMinutesPhotos: replacedList,
          },
        });
        blobsRef.current.delete(url);
        setUploadStatusMap((prev) => {
          const next = { ...prev };
          delete next[url];
          next[publicUrl] = 'SUCCESS';
          return next;
        });
      },
      onError: (err) => {
        console.warn('[Step9] Thử lại tải lên R2 thất bại:', err);
        setUploadStatusMap((prev) => ({ ...prev, [url]: 'ERROR' }));
      },
    });
  };

  // Xóa trang biên bản
  const handleRemoveMinutesPhoto = (index: number) => {
    const list = [...(sigs.workingMinutesPhotos || [])];
    const removedUrl = list[index];
    list.splice(index, 1);
    if (removedUrl) {
      blobsRef.current.delete(removedUrl);
    }
    updateFormData({
      signatures: {
        ...sigs,
        workingMinutesPhotos: list.filter(Boolean),
      },
    });
  };

  // Lưu ảnh sau khi vẽ / chú thích
  const handleSaveAnnotation = async (annotatedBase64: string) => {
    if (annotatingIndex === null) return;
    const targetIdx = annotatingIndex;
    setAnnotatingIndex(null);

    const currentPhotos = [...(sigs.workingMinutesPhotos || [])];
    currentPhotos[targetIdx] = annotatedBase64;
    updateFormData({
      signatures: {
        ...sigs,
        workingMinutesPhotos: currentPhotos,
      },
    });

    const parcelCode = formData.projectParcelCode || 'CHUA_CO_MA';
    const cleanParcel = parcelCode.replace(/&/g, '_').replace(/[^a-zA-Z0-9_-]/g, '').toUpperCase();
    const photoCode = `HCM_M2.[${cleanParcel}]_DOC_MINUTES_${String(targetIdx + 1).padStart(2, '0')}`;
    const folder = `surveys/${cleanParcel}/DOC`;
    const filename = `${photoCode.replace(/[^a-zA-Z0-9_-]/g, '_')}_annotated_${Date.now()}.jpg`;

    const byteString = atob(annotatedBase64.split(',')[1]);
    const ab = new ArrayBuffer(byteString.length);
    const ia = new Uint8Array(ab);
    for (let j = 0; j < byteString.length; j++) ia[j] = byteString.charCodeAt(j);
    const uploadBlob = new Blob([ab], { type: 'image/jpeg' });

    setUploadStatusMap((prev) => ({ ...prev, [annotatedBase64]: 'UPLOADING' }));

    uploadQueue.enqueue(uploadBlob, filename, {
      folder,
      mimeType: 'image/jpeg',
      metadata: {
        'photo-code': photoCode,
        'building-code': cleanParcel,
        'photo-type': 'MINUTES',
        'floor': 'DOC',
        'survey-phase': 'PHASE_1',
        'project': 'METRO2_HCM',
        'captured-at': new Date().toISOString(),
      },
      onSuccess: (publicUrl) => {
        const latestList = (usePhase1SurveyStore.getState().formData.signatures.workingMinutesPhotos || []).filter(Boolean);
        const replacedList = latestList.map((i) => (i === annotatedBase64 ? publicUrl : i));
        updateFormData({
          signatures: {
            ...usePhase1SurveyStore.getState().formData.signatures,
            workingMinutesPhotos: replacedList,
          },
        });
        setUploadStatusMap((prev) => {
          const next = { ...prev };
          delete next[annotatedBase64];
          next[publicUrl] = 'SUCCESS';
          return next;
        });
      },
      onError: () => {
        setUploadStatusMap((prev) => ({ ...prev, [annotatedBase64]: 'ERROR' }));
      },
    });
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-12">
      {/* 8.1. Thống kê chốt số liệu */}
      <Card className="border-emerald-200 bg-emerald-50/40">
        <div className="flex items-center gap-2 mb-3 pb-2 border-b border-emerald-200">
          <FileCheck2 className="w-5 h-5 text-emerald-700" />
          <div>
            <h2 className="text-base sm:text-lg font-bold text-slate-800">
              8.1. Tổng Kết Khảo Sát Hiện Trường Trước Khi Ký Xác Nhận
            </h2>
            <p className="text-xs text-slate-500">
              Hệ thống tự động thống kê toàn bộ dữ liệu đã ghi nhận tại thực địa
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center mb-4">
          <div className="p-3 bg-white rounded-xl border border-emerald-200">
            <span className="text-[11px] text-slate-500 block">Số tầng khảo sát</span>
            <span className="text-xl font-black text-slate-800">{totalFloors} Tầng</span>
          </div>
          <div className="p-3 bg-white rounded-xl border border-emerald-200">
            <span className="text-[11px] text-slate-500 block">Số Vùng Z - E</span>
            <span className="text-xl font-black text-slate-800">{totalZoneZ} - {totalZoneE}</span>
          </div>
          <div className="p-3 bg-white rounded-xl border border-emerald-200">
            <span className="text-[11px] text-slate-500 block">Số Vết nứt D</span>
            <span className="text-xl font-black text-emerald-700">{totalDefects} Nứt</span>
          </div>
          <div className="p-3 bg-white rounded-xl border border-emerald-200">
            <span className="text-[11px] text-slate-500 block">Biên ranh GIS</span>
            <span className="text-sm font-bold text-sky-700 block mt-1">
              {formData.gisMutationConfirmed?.type === 'MATCH'
                ? 'Khớp ranh 100%'
                : formData.gisMutationConfirmed?.type === 'SPLIT'
                ? 'Tách thửa'
                : 'Gộp thửa'}
            </span>
          </div>
        </div>

        <Textarea
          id="input-ownerFeedback"
          label="Ý Kiến / Phản Hồi Của Chủ Sở Hữu (Ghi nhận nguyên văn ý kiến hiện trường) *"
          placeholder="Ví dụ: Chủ nhà nhất trí với biên bản khảo sát hiện trạng; xác nhận các vết nứt đã có từ trước khi làm đường..."
          rows={2}
          required
          value={sigs.ownerFeedback || formData.ownerRemarks || ''}
          onChange={(e) => {
            const val = e.target.value;
            updateFormData({
              signatures: { ...sigs, ownerFeedback: val },
              ownerRemarks: val,
            });
          }}
        />
      </Card>


      {/* 8.2. Ảnh Chụp Biên Bản Làm Việc Hiện Trường (Bắt buộc) */}
      <Card id="working-minutes-section">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-blue-50 text-blue-600 rounded-lg">
              <ImageIcon className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-bold text-slate-800">
                  8.2. Ảnh Chụp Biên Bản Làm Việc Hiện Trường *
                </h2>
                {minutesPhotos.length > 0 && (
                  <span className="text-xs font-bold text-blue-700 bg-blue-50 border border-blue-200 px-2.5 py-0.5 rounded-full">
                    {minutesPhotos.length} trang
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Bắt buộc đính kèm ảnh chụp các trang biên bản khảo sát giấy hoặc biên bản làm việc có chữ ký tươi. Tự động dập watermark <code className="text-blue-700 font-bold">HCM_M2.[MÃ THỬA]_DOC_MINUTES_xx</code> và lưu trữ Cloudflare R2.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 self-start sm:self-center">
            <input
              type="file"
              ref={cameraInputRef}
              accept="image/*"
              capture="environment"
              className="sr-only"
              onChange={(e) => {
                if (e.target.files) {
                  processAndUploadFiles(e.target.files);
                  e.target.value = '';
                }
              }}
            />
            <input
              type="file"
              ref={fileInputRef}
              accept="image/*"
              multiple
              className="sr-only"
              onChange={(e) => {
                if (e.target.files) {
                  processAndUploadFiles(e.target.files);
                  e.target.value = '';
                }
              }}
            />

            {!readOnly && (
              <>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  loading={isProcessingBatch}
                  onClick={() => cameraInputRef.current?.click()}
                  icon={<Camera className="w-4 h-4 text-emerald-600" />}
                  className="border-emerald-200 hover:bg-emerald-50 text-emerald-800 font-bold"
                >
                  Chụp camera
                </Button>

                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  loading={isProcessingBatch}
                  onClick={() => fileInputRef.current?.click()}
                  icon={<Upload className="w-4 h-4 text-slate-600" />}
                  className="font-bold"
                >
                  Tải file ảnh
                </Button>
              </>
            )}
          </div>
        </div>

        {/* Danh sách ảnh biên bản */}
        {minutesPhotos.length === 0 ? (
          <div className="border-2 border-dashed border-slate-200 rounded-2xl p-8 bg-slate-50/60 text-center flex flex-col items-center justify-center gap-3">
            <div className="w-12 h-12 rounded-full bg-blue-100/70 text-blue-600 flex items-center justify-center">
              <FileText className="w-6 h-6" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-slate-700">Chưa có ảnh biên bản làm việc hiện trường</h4>
              <p className="text-xs text-slate-500 mt-1 max-w-md">
                Bắt buộc chụp hoặc tải ít nhất 1 ảnh biên bản khảo sát giấy có chữ ký xác nhận của các bên. Ảnh sẽ được tự động dập watermark pháp lý và lưu an toàn trên Cloudflare R2.
              </p>
            </div>
            {!readOnly && (
              <div className="flex items-center gap-2.5 mt-2">
                <Button
                  type="button"
                  variant="primary"
                  size="sm"
                  onClick={() => cameraInputRef.current?.click()}
                  icon={<Camera className="w-4 h-4" />}
                >
                  Chụp camera ngay
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                  icon={<Upload className="w-4 h-4" />}
                >
                  Tải ảnh từ máy (chọn nhiều file)
                </Button>
              </div>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {minutesPhotos.map((photoUrl, idx) => {
              const isUploading = uploadStatusMap[photoUrl] === 'UPLOADING';
              const isSuccess =
                uploadStatusMap[photoUrl] === 'SUCCESS' ||
                photoUrl.startsWith('http') ||
                photoUrl.startsWith('/uploads');
              const isError = uploadStatusMap[photoUrl] === 'ERROR';
              const pageCode = `HCM_M2.[${(formData.projectParcelCode || formData.officialCadastralCode || 'PARCEL')
                .replace(/&/g, '_')
                .replace(/[^a-zA-Z0-9_-]/g, '')
                .toUpperCase()}]_DOC_MINUTES_${String(idx + 1).padStart(2, '0')}`;

              return (
                <div
                  key={idx}
                  className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-xs hover:shadow-md transition-shadow flex flex-col"
                >
                  {/* Header card */}
                  <div className="flex items-center justify-between px-3 py-2 bg-slate-50 border-b border-slate-100 text-xs">
                    <div className="flex items-center gap-1.5 font-bold text-slate-700">
                      <span className="bg-blue-100 text-blue-800 px-2 py-0.5 rounded text-[11px]">
                        Trang {idx + 1}
                      </span>
                      <span className="text-[10px] font-mono text-slate-500 truncate max-w-[150px]" title={pageCode}>
                        {pageCode}
                      </span>
                    </div>
                    {!readOnly && (
                      <button
                        type="button"
                        onClick={() => handleRemoveMinutesPhoto(idx)}
                        className="text-slate-400 hover:text-red-600 p-1 rounded hover:bg-red-50 transition-colors"
                        title="Xóa trang này"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>

                  {/* Preview Image Box */}
                  <div className="relative aspect-[3/4] bg-slate-950 flex items-center justify-center overflow-hidden group">
                    <img
                      src={photoUrl}
                      alt={`Biên bản trang ${idx + 1}`}
                      className="w-full h-full object-contain"
                    />

                    {/* R2 Cloud Status Badge */}
                    <div className="absolute bottom-2 right-2 z-10 pointer-events-auto">
                      {isUploading && (
                        <span className="bg-amber-500/95 text-white text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 shadow-md animate-pulse">
                          <RefreshCw className="w-2.5 h-2.5 animate-spin" />
                          Lưu R2...
                        </span>
                      )}
                      {isSuccess && (
                        <span className="bg-emerald-600/95 text-white text-[10px] font-black px-2 py-0.5 rounded-full flex items-center gap-1 shadow-md border border-white/40">
                          <span className="font-mono font-bold text-[10px]">✓</span>
                          <span>R2</span>
                        </span>
                      )}
                      {isError && (
                        <button
                          type="button"
                          onClick={() => handleRetryUpload(photoUrl)}
                          className="bg-red-600 hover:bg-red-700 text-white text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1 shadow-md transition-colors"
                          title="Bấm để thử lại tải lên Cloudflare R2"
                        >
                          <AlertCircle className="w-2.5 h-2.5" />
                          Thử lại R2
                        </button>
                      )}
                    </div>

                    {/* Hover Action Overlay */}
                    <div className="absolute inset-0 bg-slate-900/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2 p-2">
                      <button
                        type="button"
                        onClick={() => {
                          resetLightbox();
                          setLightboxUrl(photoUrl);
                        }}
                        className="bg-white/90 hover:bg-white text-slate-800 text-xs font-bold px-2.5 py-1.5 rounded-lg flex items-center gap-1 shadow-sm transition-transform active:scale-95"
                      >
                        <Eye className="w-3.5 h-3.5 text-blue-600" />
                        Xem lớn
                      </button>
                      {!readOnly && (
                        <button
                          type="button"
                          onClick={() => setAnnotatingIndex(idx)}
                          className="bg-emerald-600/90 hover:bg-emerald-600 text-white text-xs font-bold px-2.5 py-1.5 rounded-lg flex items-center gap-1 shadow-sm transition-transform active:scale-95"
                        >
                          <Edit3 className="w-3.5 h-3.5" />
                          Chú thích
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {/* Lightbox xem lớn ảnh biên bản — pinch-to-zoom 2 ngón tay */}
      <PhotoLightboxModal
        isOpen={lightboxUrl !== null}
        onClose={() => {
          setLightboxUrl(null);
          resetLightbox();
        }}
        imageUrl={lightboxUrl || ''}
        lightboxZoom={lightboxZoom}
        lightboxPan={lightboxPan}
        isLightboxPinching={isLightboxPinching}
        onResetZoom={resetLightbox}
        onTouchStart={handleLightboxTouchStart}
        onTouchMove={handleLightboxTouchMove}
        onTouchEnd={handleLightboxTouchEnd}
        onWheel={handleLightboxWheel}
      />

      {/* Modal chú thích / vẽ trên ảnh */}
      {annotatingIndex !== null && minutesPhotos[annotatingIndex] && (
        <ImageAnnotationModal
          isOpen={annotatingIndex !== null}
          imageUrl={minutesPhotos[annotatingIndex]}
          title={`Ghi chú & Đánh dấu trang ${annotatingIndex + 1}`}
          onSave={handleSaveAnnotation}
          onClose={() => setAnnotatingIndex(null)}
        />
      )}

      {/* Final Submit Buttons */}
      <div className="flex justify-between items-center pt-4">
        <Button variant="outline" onClick={prevStep}>
          {formData.unitId ? '⬅️ Quay lại Bước 6 (Dashboard)' : '⬅️ Quay lại Bước 7'}
        </Button>
        {readOnly ? (
          <div className="flex items-center gap-2">
            <span className="text-xs text-amber-800 bg-amber-100 px-3.5 py-2 rounded-lg font-bold border border-amber-300">
              👁️ Chế độ xem lại (Read-Only) - Không thể nộp lại hồ sơ
            </span>
          </div>
        ) : (
          <Button
            size="lg"
            variant="success"
            icon={<Send className="w-4 h-4" />}
            loading={isSubmitting}
            onClick={handleCompleteSurvey}
          >
            Hoàn Tất & Nộp Hồ Sơ Khảo Sát Hiện Trường
          </Button>
        )}
      </div>
    </div>
  );
};
