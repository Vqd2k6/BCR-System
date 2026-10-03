import React, { useState, useRef, useEffect } from 'react';
import {
  generateMetroPhotoCode,
  MetroWatermarkOptions,
} from '../../../../utils/watermarkEngine';

interface UseLiveCameraProps {
  effectiveWatermarkOptions?: MetroWatermarkOptions;
  cameraInputId: string;
  onSuccessCapture: (result: { blob: Blob; photoCode: string }) => void;
}

export function useLiveCamera({
  effectiveWatermarkOptions,
  cameraInputId,
  onSuccessCapture,
}: UseLiveCameraProps) {
  const [isLiveCameraOpen, setIsLiveCameraOpen] = useState(false);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [cameraLoading, setCameraLoading] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [zoomLevel, setZoomLevel] = useState<number>(1.0);
  const [isPinching, setIsPinching] = useState(false);
  const [mediaStream, setMediaStream] = useState<MediaStream | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const initialPinchDistRef = useRef<number>(0);
  const initialZoomRef = useRef<number>(1.0);
  const zoomLevelRef = useRef<number>(1.0);
  zoomLevelRef.current = zoomLevel;

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

  const startLiveCamera = async () => {
    setCameraLoading(true);
    setCameraError(null);
    setZoomLevel(1.0);
    initialPinchDistRef.current = 0;
    initialZoomRef.current = 1.0;

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

      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: facingMode },
            width: { ideal: 2048 },
            height: { ideal: 1536 },
          },
          audio: false,
        });
      } catch (firstErr) {
        console.warn('[LiveCamera] Ràng buộc 2048x1536 không được hỗ trợ, chuyển sang chuẩn 1080p:', firstErr);
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

  const handleTriggerCapture = () => {
    if (typeof navigator !== 'undefined' && navigator.mediaDevices && typeof navigator.mediaDevices.getUserMedia === 'function') {
      setIsLiveCameraOpen(true);
    } else {
      document.getElementById(cameraInputId)?.click();
    }
  };

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
      const photoCode = generateMetroPhotoCode(effectiveWatermarkOptions || {});
      canvas.toBlob(
        (blob) => {
          try {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            canvas.width = 0;
            canvas.height = 0;
          } catch (_e) {}

          if (blob) {
            onSuccessCapture({ blob, photoCode });
          }
        },
        'image/jpeg',
        0.85
      );
    } catch (_err) {
      console.warn('[PhotoCaptureInput] Lỗi khi chụp khung hình camera trực tiếp:', _err);
    }
  };

  return {
    isLiveCameraOpen,
    setIsLiveCameraOpen,
    facingMode,
    setFacingMode,
    cameraLoading,
    setCameraLoading,
    cameraError,
    zoomLevel,
    setZoomLevel,
    isPinching,
    videoRef,
    applyHardwareZoom,
    handleTriggerNativeCamera,
    handleTriggerCapture,
    handleCameraTouchStart,
    handleCameraTouchMove,
    handleCameraTouchEnd,
    handleCameraWheel,
    handleCaptureLiveFrame,
  };
}
