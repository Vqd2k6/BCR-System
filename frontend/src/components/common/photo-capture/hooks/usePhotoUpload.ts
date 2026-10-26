import { useState, useRef, useEffect } from 'react';
import { api } from '../../../../services/api';
import { uploadQueue } from '../../../../core/services/uploadQueueService';
import {
  generateMetroPhotoCode,
  type MetroWatermarkOptions,
} from '../../../../utils/watermarkEngine';
import {
  compressCleanImage,
} from '../../../../utils/cleanImageCompressor';
import {
  saveOfflinePhoto,
  markOfflinePhotoUploaded,
  deleteOfflinePhoto,
  getOfflinePhoto,
  createManagedBlobUrl,
  revokeManagedBlobUrl,
  isLocalBlobUri,
  extractLocalIdFromUri,
  resolveOfflinePhotoUrl,
} from '../../../../core/storage/offlinePhotoStorage';
import type { UploadStatus, PhotoChangeMeta } from '../types';
import {
  resolvePhotoStorageTarget,
  resolveSurveyScopeFromAreaType,
} from '../domain/photoIdentityPolicy';
import { usePhase1SurveyStore } from '../../../../features/survey-phase1/store/usePhase1SurveyStore';
import { useCondoUnitSurveyStore } from '../../../../features/survey-condo-unit/store/useCondoUnitSurveyStore';
import { useCondoMasterSurveyStore } from '../../../../features/survey-condo-master/store/useCondoMasterSurveyStore';

interface UsePhotoUploadProps {
  value: string;
  onChange: (photoUrl: string, photoCode?: string, meta?: PhotoChangeMeta) => void;
  effectiveWatermarkOptions?: MetroWatermarkOptions;
  displayPhotoCode: string;
  label?: string;
  isNotApplicable?: boolean;
  onToggleNotApplicable?: (na: boolean) => void;
  onClearAspectRatio?: () => void;
  readOnly?: boolean;
}

export function usePhotoUpload({
  value,
  onChange,
  effectiveWatermarkOptions,
  displayPhotoCode,
  label,
  isNotApplicable,
  onToggleNotApplicable,
  onClearAspectRatio,
  readOnly = false,
}: UsePhotoUploadProps) {
  const [uploadStatus, setUploadStatus] = useState<UploadStatus>('IDLE');
  const [localPreview, setLocalPreview] = useState<string | null>(null);
  const [hasLoadError, setHasLoadError] = useState(false);
  const lastBlobRef = useRef<Blob | null>(null);
  const currentLocalIdRef = useRef<string | null>(null);
  // Ánh xạ bất biến localId -> photoCode tại đúng thời điểm chụp để tránh bị ghi đè bởi displayPhotoCode của tấm tiếp theo
  const localIdToCodeMapRef = useRef<Map<string, string>>(new Map());
  // Tập hợp các localId đã phát onChange thăng cấp lên R2 (chống gọi đúp giữa onSuccess và sự kiện metro2:photo-promoted)
  const promotedLocalIdsRef = useRef<Set<string>>(new Set());
  // Luôn gọi onChange của lần render MỚI NHẤT (tránh ghi đè bằng state cũ khi upload xong muộn)
  const onChangeRef = useRef(onChange);
  const mountedRef = useRef(true);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // Tự động reset trạng thái lỗi khi value thay đổi
  useEffect(() => {
    setHasLoadError(false);
  }, [value]);

  // Lắng nghe sự kiện ảnh được đồng bộ ngầm lên Cloud
  useEffect(() => {
    const handlePhotoPromoted = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (!detail?.localId || !detail?.publicUrl) return;

      const isTrackedLocalId =
        detail.localId === currentLocalIdRef.current ||
        localIdToCodeMapRef.current.has(detail.localId);
      if (!isTrackedLocalId) return;

      setUploadStatus('SUCCESS');
      // Nếu onSuccess của startDirectUpload đã xử lý phát onChange cho localId này rồi thì không phát trùng lần 2
      if (promotedLocalIdsRef.current.has(detail.localId)) {
        return;
      }
      promotedLocalIdsRef.current.add(detail.localId);
      const originalCode = localIdToCodeMapRef.current.get(detail.localId) || displayPhotoCode;
      onChangeRef.current(detail.publicUrl, originalCode, {
        replacesUri: `blob:local://${detail.localId}`,
      });
    };

    window.addEventListener('metro2:photo-promoted', handlePhotoPromoted);
    return () => window.removeEventListener('metro2:photo-promoted', handlePhotoPromoted);
  }, [displayPhotoCode]);

  // Kiểm tra trạng thái value và khôi phục preview từ IndexedDB nếu cần
  useEffect(() => {
    if (value && (value.startsWith('http') || value.startsWith('/uploads'))) {
      setUploadStatus('SUCCESS');
      setLocalPreview(null); // Có URL Cloud xịn thì giải phóng preview tạm thời
    } else if (value && isLocalBlobUri(value)) {
      const localId = extractLocalIdFromUri(value);
      currentLocalIdRef.current = localId;
      resolveOfflinePhotoUrl(value)
        .then((resolvedUrl) => {
          if (resolvedUrl) {
            setLocalPreview(resolvedUrl);
            setUploadStatus('UPLOADING');
          } else {
            // Không tìm thấy ảnh trong IndexedDB trên thiết bị này (Guest hoặc thiết bị khác)
            setUploadStatus('IDLE');
          }
        })
        .catch((_e) => {
          setUploadStatus('IDLE');
        });
    } else if (value && value.startsWith('data:image')) {
      setLocalPreview(value);
      setUploadStatus('IDLE');
    } else {
      setUploadStatus('IDLE');
      setLocalPreview(null);
    }
  }, [value]);

  // Trích xuất thông tin định danh công trình và phân loại ảnh phục vụ cây thư mục R2 & Custom Metadata
  // Ủy quyền hoàn toàn cho Trụ cột 2: PhotoIdentityPolicy & ScopedStorageRouter
  const extractPhotoDetails = (code?: string, customCapturedAt?: string) => {
    const scope = resolveSurveyScopeFromAreaType(effectiveWatermarkOptions?.areaType);
    let fallbackBuildingCode = '';
    let activeParcelId: string | null = null;
    let activeUnitId: string | null = null;

    try {
      if (scope === 'CONDO_UNIT') {
        const unitState = useCondoUnitSurveyStore.getState()?.formData;
        fallbackBuildingCode = unitState?.parentInfo?.projectParcelCode || '';
        activeParcelId = unitState?.parcelId || null;
        activeUnitId = unitState?.unitId || null;
      } else if (scope === 'CONDO_MASTER') {
        const masterState = useCondoMasterSurveyStore.getState()?.formData;
        fallbackBuildingCode = masterState?.projectParcelCode || '';
        activeParcelId = masterState?.parcelId || null;
        activeUnitId = null;
      } else {
        const p1State = usePhase1SurveyStore.getState();
        fallbackBuildingCode = p1State?.formData?.projectParcelCode || '';
        activeParcelId = p1State?.formData?.parcelId || null;
        activeUnitId = p1State?.currentUnitId || null;
      }
    } catch (err) {
      console.warn('[usePhotoUpload] Không thể truy xuất fallback store theo scope:', err);
    }

    return resolvePhotoStorageTarget({
      watermarkOptions: effectiveWatermarkOptions,
      code,
      displayPhotoCode,
      label,
      customCapturedAt,
      fallbackBuildingCode,
      activeParcelId,
      activeUnitId,
    });
  };

  /**
   * Bắt đầu tải ảnh sạch trực tiếp lên Cloudflare R2
   */
  const startDirectUpload = (blob: Blob, code?: string, localId?: string, customCapturedAt?: string) => {
    if (readOnly) {
      console.warn('[usePhotoUpload] Biểu mẫu đang ở chế độ Chỉ Xem (Read-Only), từ chối tải ảnh lên R2.');
      return;
    }
    lastBlobRef.current = blob;
    setUploadStatus('UPLOADING');

    const { targetFolder, selfDescribingFilename, metadata } = extractPhotoDetails(code, customCapturedAt);
    const filename = selfDescribingFilename || `${(code ? code.replace(/[^a-zA-Z0-9_-]/g, '_') : 'photo')}_${Date.now()}.jpg`;
    if (localId && code) {
      localIdToCodeMapRef.current.set(localId, code);
    }

    uploadQueue.enqueue(blob, filename, {
      // Truyền đúng localId để hàng đợi ghi mapping bền + thăng cấp URL trong các store đang mở
      id: localId,
      folder: targetFolder,
      mimeType: 'image/jpeg',
      metadata,
      onSuccess: async (publicUrl) => {
        if (mountedRef.current) {
          setUploadStatus('SUCCESS');
          if (!localId || !promotedLocalIdsRef.current.has(localId)) {
            if (localId) {
              promotedLocalIdsRef.current.add(localId);
            }
            const resolvedCode = (localId && localIdToCodeMapRef.current.get(localId)) || code;
            onChangeRef.current(
              publicUrl,
              resolvedCode,
              {
                ...(localId ? { replacesUri: `blob:local://${localId}` } : {}),
                capturedAt: metadata['captured-at'],
              }
            );
          }
        }
        // Khi tải lên Cloudflare R2 thành công, đánh dấu UPLOADED trong IndexedDB (Safe Retention Policy)
        // và giải phóng ObjectURL trong RAM. File nhị phân vẫn được lưu an toàn trong IndexedDB.
        if (localId) {
          await markOfflinePhotoUploaded(localId, publicUrl);
          revokeManagedBlobUrl(localId);
        }
      },
      onError: (err) => {
        console.warn('[PhotoCaptureInput] Direct upload failed, keeping in offline storage:', err);
        if (mountedRef.current) {
          setUploadStatus('ERROR');
        }
      },
    });
  };

  /**
   * Xử lý nén ảnh sạch chuẩn 2048px @ 0.80 (Không dập text vào pixel)
   * Cân bằng tối ưu: giảm 75% - 80% dung lượng, upload 4G siêu tốc, nhẹ máy cho KSV
   * và lưu trữ nhị phân an toàn vào IndexedDB
   */
  const processAndStoreCleanPhoto = async (
    fileOrBlob: File | Blob
  ): Promise<{ blobUrl: string; localId: string; blob: Blob; photoCode: string; metadata: Record<string, string> }> => {
    if (readOnly) {
      throw new Error('Biểu mẫu đang ở chế độ Chỉ Xem (Read-Only), không thể chụp hoặc lưu ảnh mới.');
    }
    const photoCode = displayPhotoCode || generateMetroPhotoCode(effectiveWatermarkOptions || {});
    
    // 1. Nén ảnh sạch 2048px @ 0.95 (Chất lượng cực cao Near-Lossless, bảo toàn 100% độ nét vết nứt & vạch thước đo)
    const targetMaxDim = effectiveWatermarkOptions?.maxDimension || 2048;
    const targetQuality = effectiveWatermarkOptions?.quality !== undefined ? effectiveWatermarkOptions.quality : 0.95;

    const cleanResult = await compressCleanImage(fileOrBlob, {
      maxDimension: targetMaxDim,
      quality: targetQuality,
      mimeType: 'image/jpeg',
    });

    // 2. Tạo ID offline duy nhất
    const localId = `photo_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    currentLocalIdRef.current = localId;
    localIdToCodeMapRef.current.set(localId, photoCode);

    // 3. Trích xuất metadata pháp lý
    const { metadata } = extractPhotoDetails(photoCode);

    // 4. Cất Binary Blob vào IndexedDB (0% RAM Heap)
    await saveOfflinePhoto(localId, cleanResult.blob, photoCode, metadata);

    // 5. Tạo ObjectURL tạm thời để hiển thị preview mượt mà
    const blobUrl = createManagedBlobUrl(localId, cleanResult.blob);

    return {
      blobUrl,
      localId,
      blob: cleanResult.blob,
      photoCode,
      metadata,
    };
  };

  /**
   * Lưu ảnh trực tiếp đã được nén chuẩn từ LiveCamera (Tránh Double-Compression gây nóng máy)
   */
  const storePrecompressedPhoto = async (
    blob: Blob,
    overrideCode?: string
  ): Promise<{ blobUrl: string; localId: string; blob: Blob; photoCode: string; metadata: Record<string, string> }> => {
    if (readOnly) {
      throw new Error('Biểu mẫu đang ở chế độ Chỉ Xem (Read-Only), không thể chụp hoặc lưu ảnh mới.');
    }
    const photoCode = overrideCode || displayPhotoCode || generateMetroPhotoCode(effectiveWatermarkOptions || {});
    const localId = `photo_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    currentLocalIdRef.current = localId;
    localIdToCodeMapRef.current.set(localId, photoCode);

    const { metadata } = extractPhotoDetails(photoCode);
    await saveOfflinePhoto(localId, blob, photoCode, metadata);
    const blobUrl = createManagedBlobUrl(localId, blob);

    return {
      blobUrl,
      localId,
      blob,
      photoCode,
      metadata,
    };
  };

  const uploadToServer = async (base64Str: string, code?: string, customCapturedAt?: string) => {
    if (readOnly) {
      console.warn('[usePhotoUpload] Biểu mẫu đang ở chế độ Chỉ Xem (Read-Only), từ chối tải ảnh lên server.');
      return;
    }
    if (!base64Str || !base64Str.startsWith('data:image/')) return;
    try {
      const { targetFolder, metadata } = extractPhotoDetails(code, customCapturedAt);
      const res = await api.post('/storage/upload-base64', {
        base64: base64Str,
        filenamePrefix: code ? code.replace(/[^a-zA-Z0-9_-]/g, '_') : 'photo',
        folder: targetFolder,
        metadata,
      });
      const uploadedUrl = res.data?.data?.url;
      if (uploadedUrl) {
        setUploadStatus('SUCCESS');
        onChangeRef.current(uploadedUrl, code, { capturedAt: metadata['captured-at'] });
      }
    } catch (err) {
      console.warn('[PhotoCaptureInput] Background upload to server failed:', err);
      setUploadStatus('ERROR');
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (readOnly) {
      console.warn('[usePhotoUpload] Biểu mẫu đang ở chế độ Chỉ Xem (Read-Only), không thể chọn tệp.');
      return;
    }
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const { blobUrl, localId, blob, photoCode, metadata } = await processAndStoreCleanPhoto(file);
      setLocalPreview(blobUrl);
      const localUri = `blob:local://${localId}`;
      onChange(localUri, photoCode, { capturedAt: metadata['captured-at'] });

      if (isNotApplicable && onToggleNotApplicable) {
        onToggleNotApplicable(false);
      }

      startDirectUpload(blob, photoCode, localId, metadata['captured-at']);
    } catch (err) {
      console.warn('[PhotoCaptureInput] Lỗi xử lý nén ảnh sạch:', err);
      setUploadStatus('ERROR');
    }
    e.target.value = '';
  };

  const handleClear = () => {
    if (readOnly) {
      console.warn('[usePhotoUpload] Biểu mẫu đang ở chế độ Chỉ Xem (Read-Only), không thể xóa ảnh.');
      return;
    }
    if (currentLocalIdRef.current) {
      deleteOfflinePhoto(currentLocalIdRef.current);
      revokeManagedBlobUrl(currentLocalIdRef.current);
      currentLocalIdRef.current = null;
    }
    setLocalPreview(null);
    setHasLoadError(false);
    onChange('', '');
    if (onClearAspectRatio) {
      onClearAspectRatio();
    }
  };

  const handleRotate90 = async () => {
    if (readOnly) {
      console.warn('[usePhotoUpload] Biểu mẫu đang ở chế độ Chỉ Xem (Read-Only), không thể xoay ảnh.');
      return;
    }
    const currentImgUrl = localPreview || value;
    if (!currentImgUrl) return;
    try {
      const img = new Image();
      if (!currentImgUrl.startsWith('data:') && !currentImgUrl.startsWith('blob:')) {
        img.crossOrigin = 'anonymous';
      }
      await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
        img.src = currentImgUrl;
      });

      const canvas = document.createElement('canvas');
      canvas.width = img.naturalHeight;
      canvas.height = img.naturalWidth;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      ctx.translate(canvas.width / 2, canvas.height / 2);
      ctx.rotate((90 * Math.PI) / 180);
      ctx.drawImage(img, -img.naturalWidth / 2, -img.naturalHeight / 2);

      const rotatedBlob: Blob = await new Promise((resolve, reject) => {
        canvas.toBlob(
          (b) => {
            if (b) resolve(b);
            else reject(new Error('Xuất blob xoay thất bại'));
          },
          'image/jpeg',
          0.90
        );
      });

      try {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        canvas.width = 0;
        canvas.height = 0;
      } catch (clearErr) {
        console.warn('[PhotoCaptureInput] Lỗi dọn dẹp canvas:', clearErr);
      }

      // Xóa bản ghi và Object URL cũ trước khi gán ảnh xoay mới
      if (currentLocalIdRef.current) {
        deleteOfflinePhoto(currentLocalIdRef.current).catch((delErr) => {
          console.warn('[PhotoCaptureInput] Lỗi xóa ảnh offline cũ khi xoay:', delErr);
        });
        revokeManagedBlobUrl(currentLocalIdRef.current);
      }

      const localId = `photo_rot_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      currentLocalIdRef.current = localId;
      const { metadata } = extractPhotoDetails(displayPhotoCode);
      await saveOfflinePhoto(localId, rotatedBlob, displayPhotoCode, metadata);

      const blobUrl = createManagedBlobUrl(localId, rotatedBlob);
      setLocalPreview(blobUrl);
      const localUri = `blob:local://${localId}`;
      onChange(localUri, displayPhotoCode);
      startDirectUpload(rotatedBlob, displayPhotoCode, localId);
    } catch (err) {
      console.warn('[PhotoCaptureInput] Lỗi khi xoay ảnh 90°:', err);
    }
  };

  const handleRetryUpload = async () => {
    if (readOnly) {
      console.warn('[usePhotoUpload] Biểu mẫu đang ở chế độ Chỉ Xem (Read-Only), không thể tải lại ảnh.');
      return;
    }
    setUploadStatus('UPLOADING');
    if (lastBlobRef.current) {
      startDirectUpload(lastBlobRef.current, displayPhotoCode, currentLocalIdRef.current || undefined);
      return;
    }
    if (value && isLocalBlobUri(value)) {
      const localId = extractLocalIdFromUri(value);
      try {
        const item = await getOfflinePhoto(localId);
        if (item && item.blob) {
          startDirectUpload(item.blob, item.photoCode || displayPhotoCode, localId);
          return;
        }
      } catch (readErr) {
        console.warn('[PhotoCaptureInput] Lỗi đọc ảnh offline để tải lại:', readErr);
      }
    }
    if (localPreview && localPreview.startsWith('blob:')) {
      try {
        const res = await fetch(localPreview);
        const b = await res.blob();
        startDirectUpload(b, displayPhotoCode, currentLocalIdRef.current || undefined);
        return;
      } catch (fetchErr) {
        console.warn('[PhotoCaptureInput] Lỗi nạp blob preview để tải lại:', fetchErr);
      }
    }
    uploadQueue.resumePendingOfflineUploads();
  };

  return {
    uploadStatus,
    localPreview,
    setLocalPreview,
    hasLoadError,
    setHasLoadError,
    startDirectUpload,
    uploadToServer,
    processAndStoreCleanPhoto,
    storePrecompressedPhoto,
    handleFileChange,
    handleClear,
    handleRotate90,
    handleRetryUpload,
  };
}
