import React, { useRef, useState, useEffect, useId, useMemo } from 'react';
import { Camera, Trash2, MapPin, Edit3, AlertTriangle, Image as ImageIcon, RefreshCw, RotateCw, X, MoreVertical } from 'lucide-react';
import { ImageAnnotationModal } from './ImageAnnotationModal';
import { api } from '../../services/api';
import { uploadQueue } from '../../core/services/uploadQueueService';
import {
  applyMetroWatermark,
  MetroWatermarkOptions,
  generateMetroPhotoCode,
} from '../../utils/watermarkEngine';

interface Props {
  value: string; // Base64 or image URL
  onChange: (photoUrl: string, photoCode?: string) => void;
  label?: string;
  watermarkText?: string;
  watermarkOptions?: MetroWatermarkOptions;
  photoCode?: string; // Mã ID ảnh định danh duy nhất (photoCode)
  allowNotApplicable?: boolean;
  isNotApplicable?: boolean;
  onToggleNotApplicable?: (na: boolean) => void;
  naReason?: string;
  onNaReasonChange?: (reason: string) => void;
  required?: boolean;
  height?: number | string;
  recommendedOrientation?: 'landscape' | 'portrait' | 'square';
  orientationHint?: string;
  allowAnnotation?: boolean;
  annotationTitle?: string;
  initialAnnotationTool?: 'ARROW' | 'PEN' | 'CIRCLE' | 'RECT' | 'TEXT';
}

export const PhotoCaptureInput: React.FC<Props> = ({
  value,
  onChange,
  label,
  watermarkText,
  watermarkOptions,
  photoCode,
  allowNotApplicable = false,
  isNotApplicable = false,
  onToggleNotApplicable,
  naReason = '',
  onNaReasonChange,
  required = false,
  height = '180px',
  recommendedOrientation,
  orientationHint,
  allowAnnotation = true,
  annotationTitle,
  initialAnnotationTool,
}) => {
  const uniqueId = useId().replace(/:/g, '_');
  const cameraInputId = `cam_${uniqueId}`;
  const galleryInputId = `gal_${uniqueId}`;

  const [isAnnotating, setIsAnnotating] = useState(false);
  const [detectedAspectRatio, setDetectedAspectRatio] = useState<'landscape' | 'portrait' | 'square' | null>(null);
  const [localPreview, setLocalPreview] = useState<string | null>(null);
  const [hasLoadError, setHasLoadError] = useState(false);

  // Trạng thái mở menu thao tác phụ gọn gàng
  const [isMoreMenuOpen, setIsMoreMenuOpen] = useState(false);
  const moreMenuRef = useRef<HTMLDivElement>(null);

  // Đóng menu khi click ra ngoài
  useEffect(() => {
    if (!isMoreMenuOpen) return;
    const handleClickOutside = (e: MouseEvent) => {
      if (moreMenuRef.current && !moreMenuRef.current.contains(e.target as Node)) {
        setIsMoreMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isMoreMenuOpen]);

  // Trạng thái Camera Khảo Sát trực tiếp (Live Camera) với Zoom 2 ngón tay
  const [isLiveCameraOpen, setIsLiveCameraOpen] = useState(false);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [cameraLoading, setCameraLoading] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [zoomLevel, setZoomLevel] = useState<number>(1.0);
  const [isPinching, setIsPinching] = useState(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const initialPinchDistRef = useRef<number>(0);
  const initialZoomRef = useRef<number>(1.0);
  const zoomLevelRef = useRef<number>(1.0);
  zoomLevelRef.current = zoomLevel;

  // Trạng thái Lightbox soi ảnh chi tiết bằng 2 ngón tay
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);
  const [lightboxZoom, setLightboxZoom] = useState<number>(1.0);
  const [lightboxPan, setLightboxPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isLightboxPinching, setIsLightboxPinching] = useState(false);
  const lightboxPinchDistRef = useRef<number>(0);
  const lightboxInitialZoomRef = useRef<number>(1.0);
  const lightboxDragStartRef = useRef<{ x: number; y: number } | null>(null);
  const lightboxInitialPanRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  // Tự động reset trạng thái lỗi khi value thay đổi
  useEffect(() => {
    setHasLoadError(false);
  }, [value]);

  // Tính toán options watermark hợp nhất (ưu tiên watermarkOptions, fallback watermarkText)
  const effectiveWatermarkOptions = useMemo<MetroWatermarkOptions | undefined>(() => {
    if (watermarkOptions) return watermarkOptions;
    if (watermarkText) return { customCode: watermarkText };
    return undefined;
  }, [watermarkOptions, watermarkText]);

  // Mã định danh hiển thị
  const displayPhotoCode = useMemo(() => {
    if (photoCode) return photoCode;
    if (effectiveWatermarkOptions) return generateMetroPhotoCode(effectiveWatermarkOptions);
    return watermarkText || '';
  }, [photoCode, effectiveWatermarkOptions, watermarkText]);

  // Detect image aspect ratio when value changes
  useEffect(() => {
    if (!value) {
      setDetectedAspectRatio(null);
      return;
    }
    const img = new Image();
    img.onload = () => {
      if (img.naturalWidth > img.naturalHeight * 1.08) {
        setDetectedAspectRatio('landscape');
      } else if (img.naturalHeight > img.naturalWidth * 1.08) {
        setDetectedAspectRatio('portrait');
      } else {
        setDetectedAspectRatio('square');
      }
    };
    img.src = value;
  }, [value]);

  // Trạng thái đồng bộ ảnh lên Cloudflare R2
  const [uploadStatus, setUploadStatus] = useState<'IDLE' | 'UPLOADING' | 'SUCCESS' | 'ERROR'>('IDLE');
  const lastBlobRef = useRef<Blob | null>(null);

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
      // Phân tích mã như HCM_M2.[C&C-01-B-0001]_... hoặc HCM_M2_B00008CC_...
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

    // Làm sạch ký tự cho thư mục lưu trữ R2 (chuyển & thành _)
    buildingCode = buildingCode.replace(/&/g, '_').replace(/[^a-zA-Z0-9_-]/g, '').toUpperCase();
    pType = String(pType).replace(/[^a-zA-Z0-9_-]/g, '').toUpperCase();

    // Xác định thư mục phân cấp rõ ràng trong Cloudflare R2: surveys/{buildingCode}/{photoType}
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
      // Tự động dập Logo THACO-CREC + Ngày giờ + Photo ID vào Canvas trực tiếp từ File (Blob)
      // Không dùng FileReader readAsDataURL để tiết kiệm 11.7MB RAM Heap
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
        // Dùng previewUrl (0MB Heap) hoặc dataUrl nén nhẹ cho UI
        setLocalPreview(result.previewUrl || result.dataUrl);
        // Lưu dataUrl đã nén nhẹ (400KB thay vì 11.7MB) vào formData để tương thích module audit và preview
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
    setDetectedAspectRatio(null);
  };

  // Xoay ảnh 90 độ theo chiều kim đồng hồ khi người dùng chụp ngược hướng
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

      // Xoay 90 độ chiều kim đồng hồ
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

  // Trạng thái luồng MediaStream trực tiếp
  const [mediaStream, setMediaStream] = useState<MediaStream | null>(null);

  // Dọn dẹp tài nguyên Live Camera
  const stopLiveCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => {
        try {
          track.stop();
        } catch (_e) {}
      });
      streamRef.current = null;
    }
    setMediaStream(null);
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
  };

  // Điều khiển Hardware Sensor Zoom (nếu thiết bị Android/Chrome hỗ trợ)
  const applyHardwareZoom = (zoom: number) => {
    try {
      const track = streamRef.current?.getVideoTracks()[0];
      if (track) {
        const caps = (track.getCapabilities ? track.getCapabilities() : {}) as any;
        if (caps.zoom) {
          const min = caps.zoom.min || 1;
          const max = caps.zoom.max || 5;
          const target = Math.min(max, Math.max(min, zoom));
          track.applyConstraints({ advanced: [{ zoom: target } as any] }).catch(() => {});
        }
      }
    } catch (_e) {}
  };

  // Khởi động Camera trực tiếp (có cơ chế đa tầng fallback để tránh OverconstrainedError)
  const startLiveCamera = async () => {
    setCameraLoading(true);
    setCameraError(null);
    setZoomLevel(1.0);
    initialPinchDistRef.current = 0;
    initialZoomRef.current = 1.0;

    // Dừng luồng cũ nếu có
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => {
        try {
          track.stop();
        } catch (_e) {}
      });
      streamRef.current = null;
    }

    try {
      let stream: MediaStream | null = null;

      // 1. Thử khởi tạo độ nét cao 4:3 (chuẩn ảnh báo cáo Metro 2)
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: facingMode },
            width: { ideal: 2560 },
            height: { ideal: 1920 },
          },
          audio: false,
        });
      } catch (firstErr) {
        console.warn('[LiveCamera] Ràng buộc 2560x1920 không được hỗ trợ, chuyển sang chuẩn 1080p:', firstErr);
        // 2. Thử mức chuẩn 1080p
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            video: {
              facingMode: facingMode === 'environment' ? { ideal: 'environment' } : 'user',
              width: { ideal: 1920 },
              height: { ideal: 1080 },
            },
            audio: false,
          });
        } catch (secondErr) {
          console.warn('[LiveCamera] Ràng buộc 1080p không được hỗ trợ, dùng fallback cơ bản:', secondErr);
          // 3. Fallback video generic không ràng buộc
          stream = await navigator.mediaDevices.getUserMedia({
            video: true,
            audio: false,
          });
        }
      }

      if (!stream) {
        throw new Error('Không thể khởi tạo luồng camera.');
      }

      streamRef.current = stream;
      setMediaStream(stream);

      // Gán trực tiếp vào video element nếu đã sẵn sàng
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        try {
          await videoRef.current.play();
        } catch (playErr) {
          console.warn('[LiveCamera] Chờ onLoadedMetadata để tự động play:', playErr);
        }
      }
    } catch (err: any) {
      console.warn('[LiveCamera] Không thể mở camera trực tiếp:', err);
      setCameraError('Không thể mở camera trực tiếp trên trình duyệt. Bạn có thể bấm nút bên dưới để mở Máy ảnh hệ thống.');
      setCameraLoading(false);
    }
  };

  // Đồng bộ luồng MediaStream vào thẻ video đảm bảo không bao giờ bị đen màn hình
  useEffect(() => {
    if (isLiveCameraOpen && videoRef.current && mediaStream) {
      if (videoRef.current.srcObject !== mediaStream) {
        videoRef.current.srcObject = mediaStream;
      }
      videoRef.current.play().catch((err) => {
        console.warn('[LiveCamera] Autoplay bị chặn hoặc đang tải:', err);
      });
    }
  }, [isLiveCameraOpen, mediaStream]);

  // Chuyển mượt mà sang Máy ảnh hệ điều hành (Native Camera) không bị race condition
  const handleTriggerNativeCamera = () => {
    stopLiveCamera();
    setIsLiveCameraOpen(false);
    setTimeout(() => {
      const inputEl = document.getElementById(cameraInputId) as HTMLInputElement | null;
      if (inputEl) {
        inputEl.click();
      }
    }, 80);
  };

  useEffect(() => {
    if (isLiveCameraOpen) {
      startLiveCamera();
    } else {
      stopLiveCamera();
    }
    return () => {
      stopLiveCamera();
    };
  }, [isLiveCameraOpen, facingMode]);

  // Xử lý zoom 2 ngón tay (Pinch to zoom) trên khung ngắm Camera
  const handleCameraTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    if (e.touches.length === 2) {
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      initialPinchDistRef.current = dist;
      initialZoomRef.current = zoomLevelRef.current;
      setIsPinching(true);
    }
  };

  const handleCameraTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    if (e.touches.length === 2 && initialPinchDistRef.current > 0) {
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      const scale = dist / initialPinchDistRef.current;
      let nextZoom = Math.min(5.0, Math.max(1.0, initialZoomRef.current * scale));
      nextZoom = Math.round(nextZoom * 10) / 10;
      setZoomLevel(nextZoom);
      applyHardwareZoom(nextZoom);
    }
  };

  const handleCameraTouchEnd = () => {
    initialPinchDistRef.current = 0;
    setTimeout(() => setIsPinching(false), 1200);
  };

  // Hỗ trợ chuột lăn (wheel) khi test trên laptop / desktop
  const handleCameraWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    e.preventDefault();
    const delta = e.deltaY < 0 ? 0.2 : -0.2;
    setZoomLevel((prev) => {
      const next = Math.min(5.0, Math.max(1.0, Math.round((prev + delta) * 10) / 10));
      applyHardwareZoom(next);
      return next;
    });
    setIsPinching(true);
    setTimeout(() => setIsPinching(false), 1200);
  };

  // Chụp ảnh từ khung ngắm Camera (kèm crop zoom sắc nét 4:3)
  const handleCaptureLiveFrame = async () => {
    if (!videoRef.current) return;
    const video = videoRef.current;
    const vw = video.videoWidth;
    const vh = video.videoHeight;

    if (!vw || !vh) {
      alert('Camera đang khởi động luồng ảnh. Vui lòng đợi 1 giây rồi bấm chụp lại.');
      return;
    }

    const track = streamRef.current?.getVideoTracks()[0];
    const caps = (track?.getCapabilities ? track.getCapabilities() : {}) as any;
    const hasHardwareZoom = !!caps.zoom;

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    if (hasHardwareZoom || zoomLevel <= 1.0) {
      canvas.width = vw;
      canvas.height = vh;
      ctx.drawImage(video, 0, 0, vw, vh);
    } else {
      // High-res Digital Crop Zoom trên Canvas (chuẩn 4:3, giữ tâm khung hình)
      const cropW = vw / zoomLevel;
      const cropH = vh / zoomLevel;
      const cropX = (vw - cropW) / 2;
      const cropY = (vh - cropH) / 2;
      canvas.width = vw;
      canvas.height = vh;
      ctx.drawImage(video, cropX, cropY, cropW, cropH, 0, 0, vw, vh);
    }

    stopLiveCamera();
    setIsLiveCameraOpen(false);

    try {
      // Truyền trực tiếp HTMLCanvasElement vào applyMetroWatermark (không tạo Base64 trung gian)
      const result = await applyMetroWatermark(canvas, effectiveWatermarkOptions);

      // Giải phóng Canvas chụp hình trực tiếp ngay
      try {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        canvas.width = 0;
        canvas.height = 0;
      } catch (_e) {}

      if (result.blob) {
        setLocalPreview(result.previewUrl || result.dataUrl);
        onChange(result.dataUrl || result.previewUrl, result.photoCode);
        if (isNotApplicable && onToggleNotApplicable) {
          onToggleNotApplicable(false);
        }
        startDirectUpload(result.blob, result.photoCode);
      }
    } catch (_err) {
      console.warn('[PhotoCaptureInput] Lỗi khi dập watermark khung hình camera trực tiếp:', _err);
    }
  };

  // Mở Camera Khảo Sát (hoặc fallback camera hệ thống nếu không có getUserMedia)
  const handleTriggerCapture = () => {
    if (typeof navigator !== 'undefined' && navigator.mediaDevices && typeof navigator.mediaDevices.getUserMedia === 'function') {
      setIsLiveCameraOpen(true);
    } else {
      document.getElementById(cameraInputId)?.click();
    }
  };

  // Xử lý zoom và pan 2 ngón tay trên Lightbox soi ảnh chi tiết
  const handleLightboxTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    if (e.touches.length === 2) {
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      lightboxPinchDistRef.current = dist;
      lightboxInitialZoomRef.current = lightboxZoom;
      setIsLightboxPinching(true);
    } else if (e.touches.length === 1 && lightboxZoom > 1.0) {
      lightboxDragStartRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
      lightboxInitialPanRef.current = { ...lightboxPan };
    }
  };

  const handleLightboxTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    if (e.touches.length === 2 && lightboxPinchDistRef.current > 0) {
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      const scale = dist / lightboxPinchDistRef.current;
      const nextZoom = Math.min(4.0, Math.max(1.0, Math.round(lightboxInitialZoomRef.current * scale * 10) / 10));
      setLightboxZoom(nextZoom);
      if (nextZoom === 1.0) {
        setLightboxPan({ x: 0, y: 0 });
      }
    } else if (e.touches.length === 1 && lightboxDragStartRef.current && lightboxZoom > 1.0) {
      const dx = e.touches[0].clientX - lightboxDragStartRef.current.x;
      const dy = e.touches[0].clientY - lightboxDragStartRef.current.y;
      setLightboxPan({
        x: lightboxInitialPanRef.current.x + dx,
        y: lightboxInitialPanRef.current.y + dy,
      });
    }
  };

  const handleLightboxTouchEnd = () => {
    lightboxPinchDistRef.current = 0;
    lightboxDragStartRef.current = null;
    setIsLightboxPinching(false);
  };

  const handleLightboxWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    e.preventDefault();
    const delta = e.deltaY < 0 ? 0.2 : -0.2;
    setLightboxZoom((prev) => {
      const next = Math.min(4.0, Math.max(1.0, Math.round((prev + delta) * 10) / 10));
      if (next === 1.0) setLightboxPan({ x: 0, y: 0 });
      return next;
    });
  };

  const isOrientationMismatch =
    value &&
    recommendedOrientation &&
    detectedAspectRatio &&
    (recommendedOrientation === 'square'
      ? detectedAspectRatio !== 'square'
      : detectedAspectRatio !== 'square' && detectedAspectRatio !== recommendedOrientation);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', width: '100%' }}>
      {/* 1. Hardware Camera Input (capture="environment") kích hoạt trực tiếp từ <label htmlFor={cameraInputId}> */}
      <input
        id={cameraInputId}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={handleFileChange}
        style={{
          position: 'absolute',
          width: '1px',
          height: '1px',
          padding: 0,
          margin: '-1px',
          overflow: 'hidden',
          clip: 'rect(0, 0, 0, 0)',
          whiteSpace: 'nowrap',
          border: 0,
          opacity: 0,
          pointerEvents: 'none',
        }}
      />

      {/* 2. Gallery Input (tải ảnh từ thư viện thiết bị) */}
      <input
        id={galleryInputId}
        type="file"
        accept="image/*"
        onChange={handleFileChange}
        style={{
          position: 'absolute',
          width: '1px',
          height: '1px',
          padding: 0,
          margin: '-1px',
          overflow: 'hidden',
          clip: 'rect(0, 0, 0, 0)',
          whiteSpace: 'nowrap',
          border: 0,
          opacity: 0,
          pointerEvents: 'none',
        }}
      />

      {/* Label & N/A checkbox row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.35rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', flexWrap: 'wrap' }}>
          {label && (
            <label style={{ fontSize: '0.8rem', fontWeight: 700, color: '#1e293b' }}>
              {label} {required && <span style={{ color: '#ef4444' }}>*</span>}
            </label>
          )}

          {/* Orientation Recommendation Badge */}
          {recommendedOrientation === 'landscape' && (
            <span
              style={{
                fontSize: '0.675rem',
                fontWeight: 700,
                padding: '0.15rem 0.5rem',
                borderRadius: '9999px',
                backgroundColor: '#f0f9ff',
                color: '#0369a1',
                border: '1px solid #bae6fd',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.25rem',
              }}
              title="Khảo sát viên vui lòng xoay ngang điện thoại khi chụp để ảnh đạt chuẩn ngang 4:3 của báo cáo"
            >
              🔄 Xoay ngang máy khi chụp (4:3)
            </span>
          )}

          {recommendedOrientation === 'portrait' && (
            <span
              style={{
                fontSize: '0.675rem',
                fontWeight: 700,
                padding: '0.15rem 0.5rem',
                borderRadius: '9999px',
                backgroundColor: '#faf5ff',
                color: '#7e22ce',
                border: '1px solid #e9d5ff',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.25rem',
              }}
              title="Khảo sát viên cầm dọc điện thoại để chụp trọn vẹn chiều cao công trình"
            >
              📱 Cầm dọc máy khi chụp (3:4)
            </span>
          )}
        </div>

        {allowNotApplicable && onToggleNotApplicable && (
          <label
            style={{
              fontSize: '0.75rem',
              color: '#64748b',
              display: 'flex',
              alignItems: 'center',
              gap: '0.35rem',
              cursor: 'pointer',
            }}
          >
            <input
              type="checkbox"
              checked={isNotApplicable}
              onChange={(e) => {
                onToggleNotApplicable(e.target.checked);
                if (e.target.checked) onChange('');
              }}
              style={{ accentColor: '#0284c7' }}
            />
            <span>Không tồn tại / N/A</span>
          </label>
        )}
      </div>

      {/* Orientation mismatch gentle warning banner */}
      {isOrientationMismatch && (
        <div
          style={{
            fontSize: '0.72rem',
            padding: '0.35rem 0.65rem',
            backgroundColor: '#fffbeb',
            border: '1px solid #fde68a',
            color: '#b45309',
            borderRadius: '0.5rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.35rem',
          }}
        >
          <AlertTriangle size={13} style={{ flexShrink: 0 }} />
          <span>
            {recommendedOrientation === 'landscape'
              ? 'Ảnh đang là ảnh dọc. Báo cáo khuyến nghị xoay ngang điện thoại (4:3) để vừa khung in báo cáo.'
              : 'Ảnh đang là ảnh ngang. Báo cáo khuyến nghị cầm dọc điện thoại (3:4) để lấy trọn chiều cao công trình.'}
          </span>
        </div>
      )}

      {/* N/A Reason box if N/A is checked */}
      {isNotApplicable ? (
        <div
          style={{
            padding: '0.75rem',
            backgroundColor: '#f8fafc',
            border: '1px dashed #cbd5e1',
            borderRadius: '0.65rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.35rem',
          }}
        >
          <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 600 }}>
            Lý do không có ảnh / N/A:
          </span>
          <input
            type="text"
            className="form-control"
            placeholder="Ví dụ: Nhà không gắn biển số / Bị nhà đối diện che khuất hoàn toàn..."
            value={naReason}
            onChange={(e) => onNaReasonChange && onNaReasonChange(e.target.value)}
            style={{ fontSize: '0.775rem' }}
          />
        </div>
      ) : value ? (
        /* Image Preview Box */
        <div
          style={{
            position: 'relative',
            width: '100%',
            height,
            borderRadius: '0.65rem',
            overflow: 'hidden',
            border: '1px solid #cbd5e1',
            backgroundColor: '#0f172a',
          }}
        >
          <img
            id={photoCode || displayPhotoCode || undefined}
            data-photo-code={photoCode || displayPhotoCode || undefined}
            src={hasLoadError && localPreview ? localPreview : value}
            alt={displayPhotoCode || label || 'Photo preview'}
            onError={() => {
              if (localPreview && !hasLoadError) {
                setHasLoadError(true);
              }
            }}
            onClick={() => setIsLightboxOpen(true)}
            title="Chạm vào ảnh để phóng to soi vạch thước đo nứt (2 ngón tay)"
            style={{ width: '100%', height: '100%', objectFit: 'contain', cursor: 'pointer' }}
          />

          {/* Top-Left: Minimalist Photo ID chip + Cloud Status */}
          {displayPhotoCode && (
            <div
              style={{
                position: 'absolute',
                top: '6px',
                left: '6px',
                backgroundColor: 'rgba(15, 23, 42, 0.85)',
                color: '#34d399',
                fontSize: '0.65rem',
                fontWeight: 700,
                padding: '0.2rem 0.5rem',
                borderRadius: '9999px',
                fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
                backdropFilter: 'blur(4px)',
                border: '1px solid rgba(52, 211, 153, 0.35)',
                maxWidth: '48%',
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                boxShadow: '0 2px 5px rgba(0, 0, 0, 0.35)',
                zIndex: 10,
                display: 'flex',
                alignItems: 'center',
                gap: '0.25rem',
              }}
              title={`Photo ID: ${displayPhotoCode}`}
            >
              <MapPin size={10} style={{ color: '#10b981', flexShrink: 0 }} />
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{displayPhotoCode}</span>
              {uploadStatus === 'UPLOADING' && <RefreshCw size={9} className="animate-spin text-amber-400 shrink-0" />}
              {uploadStatus === 'SUCCESS' && (
                <span
                  style={{
                    width: '6px',
                    height: '6px',
                    borderRadius: '50%',
                    backgroundColor: '#10b981',
                    flexShrink: 0,
                  }}
                  title="Đã lưu Cloudflare R2 an toàn"
                />
              )}
              {uploadStatus === 'ERROR' && (
                <span
                  style={{
                    width: '6px',
                    height: '6px',
                    borderRadius: '50%',
                    backgroundColor: '#ef4444',
                    flexShrink: 0,
                  }}
                  title="Lỗi tải R2"
                />
              )}
            </div>
          )}

          {/* Top-Right: Minimalist Action Cluster (Chụp Lại + Menu ⋯) */}
          <div
            ref={moreMenuRef}
            style={{
              position: 'absolute',
              top: '6px',
              right: '6px',
              display: 'flex',
              alignItems: 'center',
              gap: '0.35rem',
              zIndex: 20,
            }}
          >
            {/* Nút chính Chụp Lại - Nhanh, Tiện, 1 chạm */}
            <button
              type="button"
              onClick={handleTriggerCapture}
              title="Mở camera chụp lại ảnh này (có zoom 2 ngón tay)"
              style={{
                backgroundColor: 'rgba(5, 150, 105, 0.92)',
                color: '#ffffff',
                border: '1px solid rgba(255, 255, 255, 0.25)',
                borderRadius: '9999px',
                padding: '0.25rem 0.65rem',
                fontSize: '0.72rem',
                fontWeight: 700,
                display: 'flex',
                alignItems: 'center',
                gap: '0.25rem',
                cursor: 'pointer',
                backdropFilter: 'blur(4px)',
                boxShadow: '0 2px 6px rgba(0, 0, 0, 0.3)',
                userSelect: 'none',
              }}
            >
              <Camera size={12} />
              <span>Chụp lại</span>
            </button>

            {/* Nút ⋯ Thao tác mở rộng */}
            <div style={{ position: 'relative' }}>
              <button
                type="button"
                onClick={() => setIsMoreMenuOpen(!isMoreMenuOpen)}
                title="Tùy chọn thao tác khác (Soi, Xoay, Vẽ, Đổi ảnh, Xóa)"
                style={{
                  backgroundColor: 'rgba(15, 23, 42, 0.85)',
                  color: '#ffffff',
                  border: '1px solid rgba(255, 255, 255, 0.2)',
                  borderRadius: '50%',
                  width: '28px',
                  height: '28px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  backdropFilter: 'blur(4px)',
                  boxShadow: '0 2px 6px rgba(0, 0, 0, 0.3)',
                }}
              >
                <MoreVertical size={14} />
              </button>

              {/* Dropdown Menu Tinh Tế */}
              {isMoreMenuOpen && (
                <div
                  style={{
                    position: 'absolute',
                    top: '32px',
                    right: 0,
                    backgroundColor: 'rgba(15, 23, 42, 0.96)',
                    color: '#f8fafc',
                    borderRadius: '0.65rem',
                    padding: '0.3rem',
                    boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.5), 0 8px 10px -6px rgba(0, 0, 0, 0.5)',
                    border: '1px solid rgba(51, 65, 85, 0.8)',
                    minWidth: '165px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.15rem',
                    fontSize: '0.75rem',
                    backdropFilter: 'blur(8px)',
                    zIndex: 30,
                  }}
                >

                  {/* Xoay 90 độ */}
                  <button
                    type="button"
                    onClick={() => {
                      setIsMoreMenuOpen(false);
                      handleRotate90();
                    }}
                    style={{
                      width: '100%',
                      padding: '0.4rem 0.6rem',
                      borderRadius: '0.4rem',
                      border: 'none',
                      backgroundColor: 'transparent',
                      color: '#f8fafc',
                      textAlign: 'left',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.45rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'rgba(51, 65, 85, 0.6)')}
                    onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                  >
                    <RotateCw size={13} style={{ color: '#fbbf24' }} />
                    <span>Xoay ảnh 90°</span>
                  </button>

                  {/* Vẽ / Chú thích */}
                  {allowAnnotation && (
                    <button
                      type="button"
                      onClick={() => {
                        setIsMoreMenuOpen(false);
                        setIsAnnotating(true);
                      }}
                      style={{
                        width: '100%',
                        padding: '0.4rem 0.6rem',
                        borderRadius: '0.4rem',
                        border: 'none',
                        backgroundColor: 'transparent',
                        color: '#f8fafc',
                        textAlign: 'left',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.45rem',
                        fontWeight: 600,
                        cursor: 'pointer',
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'rgba(51, 65, 85, 0.6)')}
                      onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                    >
                      <Edit3 size={13} style={{ color: '#34d399' }} />
                      <span>Vẽ / Ghi chú nứt</span>
                    </button>
                  )}

                  {/* Chụp bằng máy ảnh máy (Native 12MP/48MP/Flash/Macro) */}
                  <label
                    htmlFor={cameraInputId}
                    onClick={() => setIsMoreMenuOpen(false)}
                    style={{
                      width: '100%',
                      padding: '0.4rem 0.6rem',
                      borderRadius: '0.4rem',
                      backgroundColor: 'transparent',
                      color: '#f8fafc',
                      textAlign: 'left',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.45rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                      boxSizing: 'border-box',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'rgba(51, 65, 85, 0.6)')}
                    onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                  >
                    <Camera size={13} style={{ color: '#38bdf8' }} />
                    <span>Dùng máy ảnh máy (Native)</span>
                  </label>

                  {/* Chọn ảnh từ máy */}
                  <label
                    htmlFor={galleryInputId}
                    onClick={() => setIsMoreMenuOpen(false)}
                    style={{
                      width: '100%',
                      padding: '0.4rem 0.6rem',
                      borderRadius: '0.4rem',
                      backgroundColor: 'transparent',
                      color: '#f8fafc',
                      textAlign: 'left',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.45rem',
                      fontWeight: 600,
                      cursor: 'pointer',
                      boxSizing: 'border-box',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'rgba(51, 65, 85, 0.6)')}
                    onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                  >
                    <ImageIcon size={13} style={{ color: '#60a5fa' }} />
                    <span>Chọn từ thư viện máy</span>
                  </label>

                  <div style={{ borderTop: '1px solid rgba(51, 65, 85, 0.8)', margin: '0.2rem 0' }} />

                  {/* Xóa ảnh */}
                  <button
                    type="button"
                    onClick={() => {
                      setIsMoreMenuOpen(false);
                      handleClear();
                    }}
                    style={{
                      width: '100%',
                      padding: '0.4rem 0.6rem',
                      borderRadius: '0.4rem',
                      border: 'none',
                      backgroundColor: 'transparent',
                      color: '#f87171',
                      textAlign: 'left',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.45rem',
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                    onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = 'rgba(239, 68, 68, 0.2)')}
                    onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                  >
                    <Trash2 size={13} />
                    <span>Xóa ảnh này</span>
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Bottom Center: Subtle Hint */}
          <div
            style={{
              position: 'absolute',
              bottom: '6px',
              left: '50%',
              transform: 'translateX(-50%)',
              pointerEvents: 'none',
              zIndex: 10,
            }}
          >
            <span
              style={{
                fontSize: '0.62rem',
                color: 'rgba(255, 255, 255, 0.75)',
                backgroundColor: 'rgba(0, 0, 0, 0.45)',
                padding: '0.15rem 0.5rem',
                borderRadius: '9999px',
                backdropFilter: 'blur(2px)',
                fontWeight: 500,
                whiteSpace: 'nowrap',
              }}
            >
              Chạm ảnh để phóng to
            </span>
          </div>
        </div>
      ) : (
        /* Empty State with 3 clear ergonomic options */
        (() => {
          const isCompact = typeof height === 'number' ? height <= 125 : parseInt(String(height), 10) <= 125;
          return (
            <div
              style={{
                width: '100%',
                minHeight: height,
                height: 'auto',
                border: '1.5px dashed #cbd5e1',
                borderRadius: '0.65rem',
                backgroundColor: '#f8fafc',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: isCompact ? '0.35rem' : '0.65rem',
                padding: isCompact ? '0.45rem' : '0.85rem 1rem',
                boxSizing: 'border-box',
                overflow: 'hidden',
              }}
            >
              {label && (
                <div
                  style={{
                    fontSize: isCompact ? '0.7rem' : '0.75rem',
                    color: '#64748b',
                    fontWeight: 600,
                    textAlign: 'center',
                    lineHeight: 1.2,
                  }}
                >
                  {label}
                </div>
              )}

              {orientationHint && !isCompact && (
                <div style={{ fontSize: '0.7rem', color: '#0369a1', fontStyle: 'italic', textAlign: 'center' }}>
                  {orientationHint}
                </div>
              )}

              <div style={{ display: 'flex', gap: isCompact ? '0.3rem' : '0.5rem', flexWrap: 'wrap', justifyContent: 'center' }}>
                {/* 1. NÚT CHÍNH: Live Camera (Khung ngắm 4:3, zoom 2 ngón tay) */}
                <button
                  type="button"
                  onClick={handleTriggerCapture}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: isCompact ? '0.2rem' : '0.4rem',
                    padding: isCompact ? '0.35rem 0.55rem' : '0.45rem 0.85rem',
                    fontWeight: 700,
                    backgroundColor: '#059669',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '0.45rem',
                    cursor: 'pointer',
                    fontSize: isCompact ? '0.7rem' : '0.775rem',
                    boxShadow: '0 2px 4px rgba(5, 150, 105, 0.25)',
                    userSelect: 'none',
                    whiteSpace: 'nowrap',
                    transition: 'all 0.15s ease',
                  }}
                  title="Mở camera trực tiếp (hỗ trợ khung ngắm 4:3 và zoom 2 ngón tay)"
                >
                  <Camera size={isCompact ? 13 : 15} />
                  <span>{isCompact ? 'Live' : 'Camera Live'}</span>
                </button>

                {/* 2. NÚT CHÍNH 2: Máy ảnh máy (Native Camera: 12MP/48MP, Flash, Macro thước đo) */}
                <label
                  htmlFor={cameraInputId}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: isCompact ? '0.2rem' : '0.4rem',
                    padding: isCompact ? '0.35rem 0.55rem' : '0.45rem 0.85rem',
                    fontWeight: 700,
                    backgroundColor: '#0284c7',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '0.45rem',
                    cursor: 'pointer',
                    fontSize: isCompact ? '0.7rem' : '0.775rem',
                    boxShadow: '0 2px 4px rgba(2, 132, 199, 0.25)',
                    userSelect: 'none',
                    whiteSpace: 'nowrap',
                    transition: 'all 0.15s ease',
                  }}
                  title="Mở ứng dụng máy ảnh mặc định của điện thoại (chụp sắc nét 12MP/48MP, có đèn Flash & Macro soi thước đo)"
                >
                  <Camera size={isCompact ? 13 : 15} />
                  <span>{isCompact ? 'Máy ảnh' : 'Máy ảnh máy'}</span>
                </label>

                {/* 3. NÚT PHỤ: Chọn ảnh từ thư viện máy */}
                <label
                  htmlFor={galleryInputId}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: isCompact ? '0.2rem' : '0.4rem',
                    padding: isCompact ? '0.35rem 0.55rem' : '0.45rem 0.75rem',
                    fontWeight: 600,
                    backgroundColor: '#ffffff',
                    color: '#334155',
                    border: '1px solid #cbd5e1',
                    borderRadius: '0.45rem',
                    cursor: 'pointer',
                    fontSize: isCompact ? '0.7rem' : '0.75rem',
                    boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
                    userSelect: 'none',
                    whiteSpace: 'nowrap',
                    transition: 'all 0.15s ease',
                  }}
                  title="Chọn ảnh đã chụp sẵn từ thư viện thiết bị"
                >
                  <ImageIcon size={isCompact ? 13 : 14} color="#64748b" />
                  <span>{isCompact ? 'Album' : 'Chọn từ máy'}</span>
                </label>
              </div>
            </div>
          );
        })()
      )}

      {/* Modal for image annotations */}
      {isAnnotating && value && (
        <ImageAnnotationModal
          isOpen={isAnnotating}
          imageUrl={value}
          title={annotationTitle || `Ghi chú & Vẽ trên ${label || 'ảnh'}`}
          initialTool={initialAnnotationTool || (label?.includes('P-04') ? 'ARROW' : 'PEN')}
          onSave={(annotated) => {
            setLocalPreview(annotated);
            onChange(annotated);
            uploadToServer(annotated, displayPhotoCode);
            setIsAnnotating(false);
          }}
          onClose={() => setIsAnnotating(false)}
        />
      )}

      {/* 3. Camera Khảo Sát Viewfinder Modal (Hỗ trợ Zoom 2 ngón tay - Pinch to Zoom siêu tối giản) */}
      {isLiveCameraOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9999,
            backgroundColor: '#000000',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'space-between',
            userSelect: 'none',
            touchAction: 'none',
          }}
        >
          {/* Top Bar: Đóng, Chỉ số Zoom (chạm để về 1.0x), Đổi camera */}
          <div
            style={{
              padding: '0.75rem 1rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              backgroundColor: 'rgba(0, 0, 0, 0.65)',
              zIndex: 20,
            }}
          >
            <button
              type="button"
              onClick={() => setIsLiveCameraOpen(false)}
              style={{
                background: 'rgba(255, 255, 255, 0.2)',
                border: 'none',
                borderRadius: '50%',
                width: '40px',
                height: '40px',
                color: '#ffffff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
              }}
              title="Đóng camera"
            >
              <X size={20} />
            </button>

            {/* Floating Zoom Indicator - Chạm vào để về ngay 1.0x */}
            <button
              type="button"
              onClick={() => {
                setZoomLevel(1.0);
                applyHardwareZoom(1.0);
              }}
              style={{
                backgroundColor: zoomLevel > 1.0 ? 'rgba(16, 185, 129, 0.9)' : 'rgba(255, 255, 255, 0.15)',
                color: '#ffffff',
                border: 'none',
                borderRadius: '9999px',
                padding: '0.3rem 0.85rem',
                fontSize: '0.85rem',
                fontWeight: 800,
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '0.25rem',
                boxShadow: '0 2px 4px rgba(0,0,0,0.3)',
              }}
              title="Chạm để đưa về 1.0x"
            >
              <span>{zoomLevel.toFixed(1)}x</span>
            </button>

            {/* Switch Camera trước/sau */}
            <button
              type="button"
              onClick={() => setFacingMode((prev) => (prev === 'environment' ? 'user' : 'environment'))}
              style={{
                background: 'rgba(255, 255, 255, 0.2)',
                border: 'none',
                borderRadius: '50%',
                width: '40px',
                height: '40px',
                color: '#ffffff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
              }}
              title="Đổi camera trước / sau"
            >
              <RefreshCw size={18} />
            </button>
          </div>

          {/* Viewfinder cảm ứng 2 ngón tay Pinch-to-zoom */}
          <div
            onTouchStart={handleCameraTouchStart}
            onTouchMove={handleCameraTouchMove}
            onTouchEnd={handleCameraTouchEnd}
            onWheel={handleCameraWheel}
            style={{
              position: 'relative',
              flex: 1,
              overflow: 'hidden',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: '#000000',
            }}
          >
            {/* Thẻ <video> LUÔN LUÔN được mount trong DOM để videoRef.current không bao giờ bị null */}
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              onLoadedMetadata={() => {
                setCameraLoading(false);
                if (videoRef.current) {
                  videoRef.current.play().catch(console.warn);
                }
              }}
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                transform: `scale(${zoomLevel})`,
                transformOrigin: 'center center',
                transition: isPinching ? 'none' : 'transform 0.1s ease-out',
                display: cameraError ? 'none' : 'block',
              }}
            />

            {/* Loading Overlay hiển thị mờ đè lên trên khi đang kết nối luồng camera */}
            {cameraLoading && !cameraError && (
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  backgroundColor: 'rgba(0, 0, 0, 0.75)',
                  backdropFilter: 'blur(6px)',
                  color: '#ffffff',
                  fontSize: '0.85rem',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.65rem',
                  zIndex: 15,
                }}
              >
                <RefreshCw size={28} className="animate-spin text-emerald-400" />
                <span style={{ fontWeight: 600 }}>Đang khởi động camera...</span>
                <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>
                  Vui lòng cho phép quyền truy cập camera nếu trình duyệt yêu cầu
                </span>
              </div>
            )}

            {/* Error State */}
            {cameraError && (
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  backgroundColor: '#0f172a',
                  color: '#f87171',
                  padding: '1.5rem',
                  textAlign: 'center',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '0.85rem',
                  zIndex: 20,
                }}
              >
                <AlertTriangle size={36} />
                <div style={{ fontSize: '0.85rem', maxWidth: '300px', lineHeight: 1.4 }}>{cameraError}</div>
                <button
                  type="button"
                  onClick={handleTriggerNativeCamera}
                  style={{
                    backgroundColor: '#0284c7',
                    color: '#ffffff',
                    padding: '0.55rem 1.25rem',
                    borderRadius: '0.5rem',
                    fontSize: '0.8rem',
                    fontWeight: 700,
                    cursor: 'pointer',
                    border: 'none',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '0.4rem',
                    boxShadow: '0 2px 8px rgba(2, 132, 199, 0.4)',
                  }}
                >
                  <Camera size={16} />
                  <span>Mở Máy ảnh hệ thống</span>
                </button>
              </div>
            )}

            {/* Khung hướng dẫn 4:3 và Gợi ý cử chỉ zoom 2 ngón tay */}
            {!cameraLoading && !cameraError && (
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  pointerEvents: 'none',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '1rem',
                }}
              >
                {/* Viền hướng dẫn khung hình */}
                <div
                  style={{
                    position: 'absolute',
                    inset: '12px',
                    border: '1.5px dashed rgba(255, 255, 255, 0.35)',
                    borderRadius: '0.75rem',
                    pointerEvents: 'none',
                  }}
                />

                {/* Gợi ý chụm 2 ngón tay */}
                <div
                  style={{
                    marginTop: 'auto',
                    marginBottom: '0.5rem',
                    backgroundColor: 'rgba(0, 0, 0, 0.6)',
                    color: '#f8fafc',
                    fontSize: '0.72rem',
                    fontWeight: 600,
                    padding: '0.25rem 0.75rem',
                    borderRadius: '9999px',
                    backdropFilter: 'blur(3px)',
                    border: '1px solid rgba(255, 255, 255, 0.2)',
                    zIndex: 10,
                  }}
                >
                  Chụm / mở 2 ngón tay để zoom
                </div>
              </div>
            )}
          </div>

          {/* Bottom Bar: Nút chuyển Camera hệ thống & Nút Chụp chính */}
          <div
            style={{
              padding: '1.25rem 1.5rem',
              backgroundColor: 'rgba(0,0,0,0.85)',
              display: 'flex',
              justifyContent: 'space-around',
              alignItems: 'center',
              zIndex: 20,
            }}
          >
            {/* Nút dùng máy ảnh hệ thống */}
            <button
              type="button"
              onClick={handleTriggerNativeCamera}
              title="Chuyển sang Máy ảnh hệ điều hành (12MP/48MP, có Flash & Macro)"
              style={{
                background: 'rgba(255,255,255,0.18)',
                border: '1px solid rgba(255,255,255,0.25)',
                borderRadius: '50%',
                width: '44px',
                height: '44px',
                color: '#ffffff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                backdropFilter: 'blur(4px)',
              }}
            >
              <Camera size={20} />
            </button>

            {/* Shutter Button */}
            <button
              type="button"
              onClick={handleCaptureLiveFrame}
              disabled={cameraLoading || !!cameraError}
              style={{
                width: '72px',
                height: '72px',
                borderRadius: '50%',
                backgroundColor: '#ffffff',
                border: '4px solid #10b981',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 0 18px rgba(16, 185, 129, 0.55)',
                transition: 'transform 0.1s ease',
              }}
              onPointerDown={(e) => (e.currentTarget.style.transform = 'scale(0.94)')}
              onPointerUp={(e) => (e.currentTarget.style.transform = 'scale(1)')}
            >
              <div
                style={{
                  width: '56px',
                  height: '56px',
                  borderRadius: '50%',
                  backgroundColor: '#10b981',
                }}
              />
            </button>

            {/* Khoảng trống cân bằng bố cục */}
            <div style={{ width: '44px', height: '44px' }} />
          </div>
        </div>
      )}

      {/* 4. Lightbox Soi Ảnh Chi Tiết Bằng 2 Ngón Tay (Zoom 1.0x - 4.0x + Pan) */}
      {isLightboxOpen && value && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9999,
            backgroundColor: 'rgba(0, 0, 0, 0.94)',
            display: 'flex',
            flexDirection: 'column',
            userSelect: 'none',
            touchAction: 'none',
          }}
        >
          {/* Top Bar Lightbox */}
          <div
            style={{
              padding: '0.75rem 1rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              backgroundColor: 'rgba(0,0,0,0.5)',
              zIndex: 30,
            }}
          >
            <button
              type="button"
              onClick={() => {
                setLightboxZoom(1.0);
                setLightboxPan({ x: 0, y: 0 });
              }}
              style={{
                backgroundColor: lightboxZoom > 1.0 ? 'rgba(16, 185, 129, 0.9)' : 'rgba(255, 255, 255, 0.15)',
                color: '#ffffff',
                border: 'none',
                borderRadius: '9999px',
                padding: '0.3rem 0.85rem',
                fontSize: '0.85rem',
                fontWeight: 800,
                cursor: 'pointer',
              }}
              title="Chạm để đặt lại 1.0x"
            >
              <span>{lightboxZoom.toFixed(1)}x (Chạm để về 1.0x)</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setIsLightboxOpen(false);
                setLightboxZoom(1.0);
                setLightboxPan({ x: 0, y: 0 });
              }}
              style={{
                background: 'rgba(255, 255, 255, 0.2)',
                border: 'none',
                borderRadius: '50%',
                width: '40px',
                height: '40px',
                color: '#ffffff',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
              }}
              title="Đóng soi ảnh"
            >
              <X size={20} />
            </button>
          </div>

          {/* Vùng cảm ứng zoom 2 ngón tay và kéo rê */}
          <div
            onTouchStart={handleLightboxTouchStart}
            onTouchMove={handleLightboxTouchMove}
            onTouchEnd={handleLightboxTouchEnd}
            onWheel={handleLightboxWheel}
            style={{
              position: 'relative',
              flex: 1,
              overflow: 'hidden',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <img
              src={hasLoadError && localPreview ? localPreview : value}
              alt="Soi ảnh chi tiết"
              style={{
                maxWidth: '100%',
                maxHeight: '100%',
                objectFit: 'contain',
                transform: `scale(${lightboxZoom}) translate(${lightboxPan.x / lightboxZoom}px, ${lightboxPan.y / lightboxZoom}px)`,
                transformOrigin: 'center center',
                transition: isLightboxPinching ? 'none' : 'transform 0.1s ease-out',
                cursor: lightboxZoom > 1 ? 'grab' : 'zoom-in',
              }}
            />

            {/* Gợi ý thao tác dưới chân Lightbox */}
            <div
              style={{
                position: 'absolute',
                bottom: '1rem',
                backgroundColor: 'rgba(0, 0, 0, 0.65)',
                color: '#f8fafc',
                fontSize: '0.72rem',
                fontWeight: 600,
                padding: '0.25rem 0.75rem',
                borderRadius: '9999px',
                backdropFilter: 'blur(3px)',
                border: '1px solid rgba(255, 255, 255, 0.2)',
                pointerEvents: 'none',
                zIndex: 10,
              }}
            >
              Chụm 2 ngón tay để phóng to soi vạch thước đo • Kéo để di chuyển
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
