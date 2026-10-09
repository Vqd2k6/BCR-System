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
  deleteOfflinePhoto,
  getOfflinePhoto,
  createManagedBlobUrl,
  revokeManagedBlobUrl,
  isLocalBlobUri,
  extractLocalIdFromUri,
  resolveOfflinePhotoUrl,
} from '../../../../core/storage/offlinePhotoStorage';
import type { UploadStatus } from '../types';
import { usePhase1SurveyStore } from '../../../../features/survey-phase1/store/usePhase1SurveyStore';

interface UsePhotoUploadProps {
  value: string;
  onChange: (photoUrl: string, photoCode?: string) => void;
  effectiveWatermarkOptions?: MetroWatermarkOptions;
  displayPhotoCode: string;
  label?: string;
  isNotApplicable?: boolean;
  onToggleNotApplicable?: (na: boolean) => void;
  onClearAspectRatio?: () => void;
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
}: UsePhotoUploadProps) {
  const [uploadStatus, setUploadStatus] = useState<UploadStatus>('IDLE');
  const [localPreview, setLocalPreview] = useState<string | null>(null);
  const [hasLoadError, setHasLoadError] = useState(false);
  const lastBlobRef = useRef<Blob | null>(null);
  const currentLocalIdRef = useRef<string | null>(null);

  // Tự động reset trạng thái lỗi khi value thay đổi
  useEffect(() => {
    setHasLoadError(false);
  }, [value]);

  // Lắng nghe sự kiện ảnh được đồng bộ ngầm lên Cloud
  useEffect(() => {
    const handlePhotoPromoted = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail && detail.localId === currentLocalIdRef.current) {
        setUploadStatus('SUCCESS');
        if (detail.publicUrl) {
          onChange(detail.publicUrl, displayPhotoCode);
        }
      }
    };

    window.addEventListener('metro2:photo-promoted', handlePhotoPromoted);
    return () => window.removeEventListener('metro2:photo-promoted', handlePhotoPromoted);
  }, [displayPhotoCode, onChange]);

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
  const extractPhotoDetails = (code?: string) => {
    let buildingCode = effectiveWatermarkOptions?.parcelCode || '';
    let pType = effectiveWatermarkOptions?.photoType || '';
    const fullCode = code || displayPhotoCode || '';

    // Hàm kiểm tra mã công trình hợp lệ: Tuyệt đối không nhận các tiền tố kỹ thuật cấu kiện / CAD làm mã công trình
    const isInvalidBuildingCode = (c?: string): boolean => {
      if (!c) return true;
      const clean = c.replace(/^\[|\]$/g, '').trim().toUpperCase();
      return (
        clean.length < 3 ||
        clean.startsWith('STRUCTURAL') ||
        clean.startsWith('CAD') ||
        clean.startsWith('ZONE') ||
        clean.startsWith('DEFECT') ||
        clean.startsWith('OVERVIEW') ||
        clean.startsWith('PHOTO') ||
        clean.startsWith('CONDO') ||
        clean.startsWith('PHASE') ||
        clean.startsWith('KYXACNHAN') ||
        clean.startsWith('SIGN')
      );
    };

    if (isInvalidBuildingCode(buildingCode)) {
      buildingCode = '';
    }

    // 1. Trích xuất mã từ fullCode (chuẩn Metro 2 dạng HCM_M2.[PARCEL_CODE]_...)
    if (!buildingCode && fullCode) {
      const cleanCode = fullCode.replace(/^HCM_M2[._]/i, '');
      const bracketMatch = cleanCode.match(/^\[([^\]]+)\]/);
      if (bracketMatch && !isInvalidBuildingCode(bracketMatch[1])) {
        buildingCode = bracketMatch[1];
        const rest = cleanCode.substring(bracketMatch[0].length).replace(/^_+/, '');
        const parts = rest.split('_');
        if (!pType && parts.length > 1) {
          pType = parts[parts.length - 2] || parts[0];
        }
      } else {
        // Hỗ trợ dạng ngăn cách bằng ký tự '|' (VD: "STRUCTURAL | C&C-05-B-0113")
        if (cleanCode.includes('|')) {
          const pipeParts = cleanCode.split('|').map((s) => s.trim());
          const found = pipeParts.find((s) => !isInvalidBuildingCode(s));
          if (found) {
            buildingCode = found;
          }
        }
        // Fallback theo dấu chấm / gạch dưới
        if (!buildingCode) {
          const parts = cleanCode.split(/[._]/);
          if (parts[0] && !isInvalidBuildingCode(parts[0])) {
            buildingCode = parts[0];
          }
        }
      }
    }

    // 2. Nếu vẫn thiếu buildingCode, tự động lấy từ Zustand Store của cuộc khảo sát hiện tại
    if (!buildingCode) {
      try {
        const storeParcel = usePhase1SurveyStore.getState()?.formData?.projectParcelCode;
        if (storeParcel && !isInvalidBuildingCode(storeParcel)) {
          buildingCode = storeParcel;
        }
      } catch (_e) {}
    }

    // 3. Nếu hoàn toàn không xác định được mã công trình, gom vào 'general' thay vì tạo folder rác
    if (!buildingCode || isInvalidBuildingCode(buildingCode)) {
      buildingCode = 'general';
    }

    // Tự động nhận diện loại ảnh pType nếu chưa được khai báo
    if (!pType && fullCode) {
      const upper = fullCode.toUpperCase();
      if (upper.includes('STRUCTURAL') || upper.includes('CAD_STRUCT') || upper.includes('CAD-E')) {
        pType = 'CAD_STRUCT';
      } else if (upper.includes('CAD_ARCH') || upper.includes('CAD-Z')) {
        pType = 'CAD_ARCH';
      } else if (upper.includes('CTX')) {
        pType = 'CTX';
      } else if (upper.includes('CU')) {
        pType = 'CU';
      } else if (upper.includes('OVERVIEW')) {
        pType = 'OVERVIEW';
      } else if (upper.includes('MINUTES') || upper.includes('DOC') || upper.includes('KÝ XÁC NHẬN')) {
        pType = 'DOC';
      }
    }

    buildingCode = buildingCode.replace(/&/g, '_').replace(/[^a-zA-Z0-9_-]/g, '').toUpperCase();
    pType = String(pType).replace(/[^a-zA-Z0-9_-]/g, '').toUpperCase();

    let targetFolder = 'surveys';
    if (buildingCode) {
      targetFolder = pType ? `surveys/${buildingCode}/${pType}` : `surveys/${buildingCode}`;
    }

    const metadata: Record<string, string> = {
      'photo-code': fullCode,
      'building-code': buildingCode,
      'photo-type': pType,
      'survey-phase': 'PHASE_1',
      'project': 'METRO2_HCM',
      'captured-at': new Date().toISOString(),
    };

    if (effectiveWatermarkOptions?.floor) {
      metadata['floor'] = String(effectiveWatermarkOptions.floor);
    }
    if (effectiveWatermarkOptions?.stationCode) {
      metadata['station-code'] = effectiveWatermarkOptions.stationCode;
    }
    if (label) {
      metadata['label'] = label;
    }

    return { buildingCode, photoType: pType, targetFolder, metadata };
  };

  /**
   * Bắt đầu tải ảnh sạch trực tiếp lên Cloudflare R2
   */
  const startDirectUpload = (blob: Blob, code?: string, localId?: string) => {
    lastBlobRef.current = blob;
    setUploadStatus('UPLOADING');

    const { targetFolder, metadata } = extractPhotoDetails(code);
    const prefix = code ? code.replace(/[^a-zA-Z0-9_-]/g, '_') : 'photo';
    const filename = `${prefix}_${Date.now()}.jpg`;

    uploadQueue.enqueue(blob, filename, {
      folder: targetFolder,
      mimeType: 'image/jpeg',
      metadata,
      onSuccess: async (publicUrl) => {
        setUploadStatus('SUCCESS');
        onChange(publicUrl, code);
        // Khi tải lên Cloudflare R2 thành công, dọn dẹp IndexedDB và revoke blob URL
        if (localId) {
          await deleteOfflinePhoto(localId);
          revokeManagedBlobUrl(localId);
        }
      },
      onError: (err) => {
        console.warn('[PhotoCaptureInput] Direct upload failed, keeping in offline storage:', err);
        setUploadStatus('ERROR');
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
  ): Promise<{ blobUrl: string; localId: string; blob: Blob; photoCode: string }> => {
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
    };
  };

  /**
   * Lưu ảnh trực tiếp đã được nén chuẩn từ LiveCamera (Tránh Double-Compression gây nóng máy)
   */
  const storePrecompressedPhoto = async (
    blob: Blob,
    overrideCode?: string
  ): Promise<{ blobUrl: string; localId: string; blob: Blob; photoCode: string }> => {
    const photoCode = overrideCode || displayPhotoCode || generateMetroPhotoCode(effectiveWatermarkOptions || {});
    const localId = `photo_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    currentLocalIdRef.current = localId;

    const { metadata } = extractPhotoDetails(photoCode);
    await saveOfflinePhoto(localId, blob, photoCode, metadata);
    const blobUrl = createManagedBlobUrl(localId, blob);

    return {
      blobUrl,
      localId,
      blob,
      photoCode,
    };
  };

  const uploadToServer = async (base64Str: string, code?: string) => {
    if (!base64Str || !base64Str.startsWith('data:image/')) return;
    try {
      const { targetFolder, metadata } = extractPhotoDetails(code);
      const res = await api.post('/storage/upload-base64', {
        base64: base64Str,
        filenamePrefix: code ? code.replace(/[^a-zA-Z0-9_-]/g, '_') : 'photo',
        folder: targetFolder,
        metadata,
      });
      const uploadedUrl = res.data?.data?.url;
      if (uploadedUrl) {
        setUploadStatus('SUCCESS');
        onChange(uploadedUrl, code);
      }
    } catch (err) {
      console.warn('[PhotoCaptureInput] Background upload to server failed:', err);
      setUploadStatus('ERROR');
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const { blobUrl, localId, blob, photoCode } = await processAndStoreCleanPhoto(file);
      setLocalPreview(blobUrl);
      const localUri = `blob:local://${localId}`;
      onChange(localUri, photoCode);

      if (isNotApplicable && onToggleNotApplicable) {
        onToggleNotApplicable(false);
      }

      startDirectUpload(blob, photoCode, localId);
    } catch (err) {
      console.warn('[PhotoCaptureInput] Lỗi xử lý nén ảnh sạch:', err);
      setUploadStatus('ERROR');
    }
    e.target.value = '';
  };

  const handleClear = () => {
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
      } catch (_e) {}

      // Xóa bản ghi và Object URL cũ trước khi gán ảnh xoay mới
      if (currentLocalIdRef.current) {
        deleteOfflinePhoto(currentLocalIdRef.current).catch(() => {});
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
      } catch (_e) {}
    }
    if (localPreview && localPreview.startsWith('blob:')) {
      try {
        const res = await fetch(localPreview);
        const b = await res.blob();
        startDirectUpload(b, displayPhotoCode, currentLocalIdRef.current || undefined);
        return;
      } catch (_e) {}
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
