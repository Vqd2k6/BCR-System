import { useState, useRef, useEffect } from 'react';
import { api } from '../../../../services/api';
import { uploadQueue } from '../../../../core/services/uploadQueueService';
import {
  applyMetroWatermark,
  MetroWatermarkOptions,
} from '../../../../utils/watermarkEngine';
import { UploadStatus } from '../types';

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

  // Tự động reset trạng thái lỗi khi value thay đổi
  useEffect(() => {
    setHasLoadError(false);
  }, [value]);

  useEffect(() => {
    if (value && (value.startsWith('http') || value.startsWith('/uploads'))) {
      setUploadStatus('SUCCESS');
    } else if (value && value.startsWith('data:image')) {
      if (uploadStatus === 'IDLE') {
        setUploadStatus('UPLOADING');
      }
    } else {
      setUploadStatus('IDLE');
    }
  }, [value]);

  // Trích xuất thông tin định danh công trình và phân loại ảnh phục vụ cây thư mục R2 & Custom Metadata
  const extractPhotoDetails = (code?: string) => {
    let buildingCode = effectiveWatermarkOptions?.parcelCode || '';
    let pType = effectiveWatermarkOptions?.photoType || '';
    const fullCode = code || displayPhotoCode || '';

    if (!buildingCode && fullCode) {
      const cleanCode = fullCode.replace(/^HCM_M2[._]/i, '');
      const bracketMatch = cleanCode.match(/^\[([^\]]+)\]/);
      if (bracketMatch) {
        buildingCode = bracketMatch[1];
        const rest = cleanCode.substring(bracketMatch[0].length).replace(/^_+/, '');
        const parts = rest.split('_');
        if (!pType && parts.length > 1) {
          pType = parts[parts.length - 2] || parts[0];
        }
      } else {
        const parts = cleanCode.split(/[._]/);
        if (parts[0] && parts[0].length >= 3) {
          buildingCode = parts[0];
        }
        if (!pType && parts[1]) {
          pType = parts[1];
        }
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

  const startDirectUpload = (blob: Blob, code?: string) => {
    lastBlobRef.current = blob;
    setUploadStatus('UPLOADING');

    const { targetFolder, metadata } = extractPhotoDetails(code);
    const prefix = code ? code.replace(/[^a-zA-Z0-9_-]/g, '_') : 'photo';
    const filename = `${prefix}_${Date.now()}.jpg`;

    uploadQueue.enqueue(blob, filename, {
      folder: targetFolder,
      mimeType: 'image/jpeg',
      metadata,
      onSuccess: (publicUrl) => {
        setUploadStatus('SUCCESS');
        onChange(publicUrl, code);
      },
      onError: (err) => {
        console.warn('[PhotoCaptureInput] Direct upload failed, will retry or fallback:', err);
        setUploadStatus('ERROR');
      },
    });
  };

  const processAndWatermarkImage = async (file: File): Promise<{ dataUrl: string; blob: Blob; previewUrl: string; photoCode: string }> => {
    try {
      const result = await applyMetroWatermark(file, effectiveWatermarkOptions);
      return result;
    } catch (err) {
      console.warn('[WATERMARK] Fallback nén ảnh thông thường do lỗi dập watermark:', err);
      const previewUrl = URL.createObjectURL(file);
      return {
        dataUrl: '',
        blob: file,
        previewUrl,
        photoCode: displayPhotoCode,
      };
    }
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
      console.warn('[PhotoCaptureInput] Background upload to server failed, keeping local base64:', err);
      setUploadStatus('ERROR');
    }
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const result = await processAndWatermarkImage(file);
      if (result.blob) {
        setLocalPreview(result.previewUrl || result.dataUrl);
        onChange(result.dataUrl || result.previewUrl, result.photoCode);
        if (isNotApplicable && onToggleNotApplicable) {
          onToggleNotApplicable(false);
        }
        startDirectUpload(result.blob, result.photoCode);
      }
    } catch (_err) {
      console.warn('Image processing fallback');
    }
    e.target.value = '';
  };

  const handleClear = () => {
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
      if (!currentImgUrl.startsWith('data:')) {
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

      const rotatedDataUrl = canvas.toDataURL('image/jpeg', 1.0);
      setLocalPreview(rotatedDataUrl);
      onChange(rotatedDataUrl, displayPhotoCode);

      canvas.toBlob((b) => {
        if (b) {
          startDirectUpload(b, displayPhotoCode);
        } else {
          uploadToServer(rotatedDataUrl, displayPhotoCode);
        }
      }, 'image/jpeg', 1.0);
    } catch (err) {
      console.warn('[PhotoCaptureInput] Lỗi khi xoay ảnh 90°:', err);
    }
  };

  return {
    uploadStatus,
    localPreview,
    setLocalPreview,
    hasLoadError,
    setHasLoadError,
    startDirectUpload,
    uploadToServer,
    processAndWatermarkImage,
    handleFileChange,
    handleClear,
    handleRotate90,
  };
}
