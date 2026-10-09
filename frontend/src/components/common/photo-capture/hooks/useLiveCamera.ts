import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  generateMetroPhotoCode,
  type MetroWatermarkOptions,
} from '../../../../utils/watermarkEngine';

interface ExtendedMediaTrackCapabilities extends MediaTrackCapabilities {
  torch?: boolean;
  zoom?: { min?: number; max?: number; step?: number };
}

interface ExtendedMediaTrackConstraintSet extends MediaTrackConstraintSet {
  torch?: boolean;
  zoom?: number;
}

interface ExtendedMediaTrackConstraints extends MediaTrackConstraints {
  advanced?: ExtendedMediaTrackConstraintSet[];
}

type ExtendedTrack = MediaStreamTrack & {
  applyConstraints: (c: ExtendedMediaTrackConstraints) => Promise<void>;
  getCapabilities?: () => ExtendedMediaTrackCapabilities;
};

interface UseLiveCameraProps {
  effectiveWatermarkOptions?: MetroWatermarkOptions;
  cameraInputId: string;
  onSuccessCapture: (result: { blob: Blob; photoCode: string }) => void;
}

export interface CameraLensOption {
  deviceId: string;
  label: string;
  mode: '0.5x' | '1.0x';
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

  // Cấu hình ống kính góc rộng 0.5x & Đèn Flash (Torch)
  const [activeLensMode, setActiveLensMode] = useState<'0.5x' | '1.0x'>('1.0x');
  const [hasUltraWide, setHasUltraWide] = useState(false);
  const [ultraWideDeviceId, setUltraWideDeviceId] = useState<string | null>(null);
  const [mainDeviceId, setMainDeviceId] = useState<string | null>(null);
  const [isTorchSupported, setIsTorchSupported] = useState(false);
  const [isTorchOn, setIsTorchOn] = useState(false);
  const [torchMessage, setTorchMessage] = useState<string | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const initialPinchDistRef = useRef<number>(0);
  const initialZoomRef = useRef<number>(1.0);
  const zoomLevelRef = useRef<number>(1.0);
  zoomLevelRef.current = zoomLevel;

  const activeLensModeRef = useRef<'0.5x' | '1.0x'>('1.0x');
  activeLensModeRef.current = activeLensMode;

  const isSwitchingLensRef = useRef<boolean>(false);
  const torchTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const torchThermalTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const isPausedByVisibilityRef = useRef<boolean>(false);

  const stopLiveCamera = () => {
    // Xóa bộ đếm an toàn nhiệt cho Flash
    if (torchThermalTimerRef.current) {
      clearTimeout(torchThermalTimerRef.current);
      torchThermalTimerRef.current = null;
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => {
        try {
          // Tắt torch nếu đang bật trước khi dừng track
          if (isTorchOn) {
            try {
              (track as ExtendedTrack).applyConstraints({ advanced: [{ torch: false }] });
            } catch (_) {}
          }
          track.stop();
        } catch (_e) {}
      });
      streamRef.current = null;
    }
    setMediaStream(null);
    setIsTorchOn(false);
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setCameraLoading(false);
  };

  const applyHardwareZoom = (zoom: number) => {
    try {
      const track = streamRef.current?.getVideoTracks()[0] as ExtendedTrack | undefined;
      if (track) {
        const caps: ExtendedMediaTrackCapabilities = track.getCapabilities ? track.getCapabilities() : {};
        if (caps.zoom) {
          const min = caps.zoom.min || 1;
          const max = caps.zoom.max || 5;
          const target = Math.min(max, Math.max(min, zoom));
          track.applyConstraints({ advanced: [{ zoom: target }] }).catch(() => {});
        }
      }
    } catch (_e) {}
  };

  // Quét danh sách thiết bị để tìm camera góc rộng 0.5x và camera chính
  const detectAvailableLenses = async (currentTrack?: MediaStreamTrack) => {
    try {
      if (!navigator.mediaDevices?.enumerateDevices) return;
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoInputs = devices.filter((d) => d.kind === 'videoinput');

      // Kiểm tra zoom phần cứng của track hiện tại (một số máy Android cho zoom.min <= 0.6)
      if (currentTrack) {
        const extTrack = currentTrack as ExtendedTrack;
        const caps: ExtendedMediaTrackCapabilities = extTrack.getCapabilities ? extTrack.getCapabilities() : {};
        if (caps.zoom && typeof caps.zoom.min === 'number' && caps.zoom.min <= 0.65) {
          setHasUltraWide(true);
        }
        if (caps.torch) {
          setIsTorchSupported(true);
        }
      }

      if (facingMode !== 'environment') {
        setHasUltraWide(false);
        return;
      }

      // Lọc các camera sau
      const backCameras = videoInputs.filter((d) => {
        const label = (d.label || '').toLowerCase();
        return (
          label.includes('back') ||
          label.includes('sau') ||
          label.includes('environment') ||
          label.includes('0') ||
          label.includes('1') ||
          label.includes('2') ||
          label.includes('rear')
        );
      });

      let foundUltra: string | null = null;
      let foundMain: string | null = null;

      for (const cam of videoInputs) {
        const lbl = (cam.label || '').toLowerCase();
        if (
          lbl.includes('ultra') ||
          lbl.includes('0.5') ||
          lbl.includes('wide-angle') ||
          lbl.includes('super wide') ||
          lbl.includes('camera2 2') ||
          lbl.includes('camera 2')
        ) {
          foundUltra = cam.deviceId;
        } else if (
          (lbl.includes('back') || lbl.includes('rear') || lbl.includes('camera2 0')) &&
          !lbl.includes('front')
        ) {
          if (!foundMain) foundMain = cam.deviceId;
        }
      }

      // Nếu có từ 2 camera sau trở lên mà chưa gắn nhãn rõ ràng
      if (!foundUltra && backCameras.length >= 2) {
        // Camera thứ 2 thường là camera góc siêu rộng trên Samsung/Xiaomi/iPhone
        foundUltra = backCameras[1].deviceId;
        foundMain = backCameras[0].deviceId;
      }

      if (foundUltra) {
        setUltraWideDeviceId(foundUltra);
        setHasUltraWide(true);
      }
      if (foundMain) {
        setMainDeviceId(foundMain);
      }
    } catch (err) {
      console.warn('[LiveCamera] Lỗi quét danh sách ống kính:', err);
    }
  };

  const startLiveCamera = async (targetDeviceId?: string, targetLensMode?: '0.5x' | '1.0x') => {
    setCameraLoading(true);
    setCameraError(null);

    const nextMode = targetLensMode || activeLensModeRef.current;
    if (nextMode === '0.5x') {
      setZoomLevel(0.5);
    } else if (zoomLevelRef.current < 1.0) {
      setZoomLevel(1.0);
    }

    initialPinchDistRef.current = 0;

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

      // 1. Nếu có targetDeviceId cụ thể (ví dụ camera 0.5x Ultra-Wide)
      if (targetDeviceId) {
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            video: {
              deviceId: { exact: targetDeviceId },
              width: { ideal: 2048, max: 2560 },
              height: { ideal: 1536, max: 1920 },
              frameRate: { ideal: 24, max: 30 }, // Giới hạn 24-30 FPS để bảo vệ GPU và chống nóng máy
            },
            audio: false,
          });
        } catch (specErr) {
          console.warn('[LiveCamera] Không thể mở theo deviceId chỉ định, thử fallback:', specErr);
        }
      }

      // 2. Mặc định mở camera chất lượng cao 2048x1536
      if (!stream) {
        try {
          stream = await navigator.mediaDevices.getUserMedia({
            video: {
              facingMode: { ideal: facingMode },
              width: { ideal: 2048, max: 2560 },
              height: { ideal: 1536, max: 1920 },
              frameRate: { ideal: 24, max: 30 }, // Giới hạn 24-30 FPS để hạ nhiệt phần cứng
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
                frameRate: { ideal: 24, max: 30 },
              },
              audio: false,
            });
          } catch (secondErr) {
            console.warn('[LiveCamera] Ràng buộc 1080p không được hỗ trợ, dùng fallback cơ bản:', secondErr);
            stream = await navigator.mediaDevices.getUserMedia({
              video: {
                frameRate: { ideal: 24, max: 30 },
              },
              audio: false,
            });
          }
        }
      }

      if (!stream) {
        throw new Error('Không thể khởi tạo luồng camera.');
      }

      streamRef.current = stream;
      setMediaStream(stream);

      const activeTrack = stream.getVideoTracks()[0];
      if (activeTrack) {
        // Quét capabilities và danh sách camera
        await detectAvailableLenses(activeTrack);

        // Áp dụng zoom nếu ống kính hỗ trợ zoom số/phần cứng
        if (nextMode === '0.5x') {
          applyHardwareZoom(0.5);
        } else {
          applyHardwareZoom(zoomLevelRef.current);
        }
      }

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        try {
          await videoRef.current.play();
          setCameraLoading(false);
        } catch (playErr) {
          console.warn('[LiveCamera] Chờ onLoadedMetadata để tự động play:', playErr);
        }
      }

      setCameraLoading(false);
      setTimeout(() => {
        setCameraLoading(false);
      }, 400);
    } catch (err: unknown) {
      console.warn('[LiveCamera] Không thể mở camera trực tiếp:', err);
      setCameraError('Không thể mở camera trực tiếp trên trình duyệt. Bạn có thể bấm nút bên dưới để mở Máy ảnh hệ thống.');
      setCameraLoading(false);
    } finally {
      isSwitchingLensRef.current = false;
    }
  };

  // Chuyển đổi giữa 0.5x Ultra-Wide và 1.0x Main Camera
  const switchLensMode = useCallback(async (targetMode: '0.5x' | '1.0x') => {
    if (isSwitchingLensRef.current) return;
    isSwitchingLensRef.current = true;
    setActiveLensMode(targetMode);

    // Haptic feedback nhẹ khi switch lens
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      try {
        navigator.vibrate(20);
      } catch (_) {}
    }

    if (targetMode === '0.5x') {
      setZoomLevel(0.5);
      if (ultraWideDeviceId) {
        await startLiveCamera(ultraWideDeviceId, '0.5x');
      } else {
        // Thử áp dụng hardware zoom xuống 0.5 nếu cảm biến đơn hỗ trợ
        applyHardwareZoom(0.5);
        isSwitchingLensRef.current = false;
      }
    } else {
      setZoomLevel(1.0);
      if (mainDeviceId) {
        await startLiveCamera(mainDeviceId, '1.0x');
      } else {
        await startLiveCamera(undefined, '1.0x');
      }
    }
  }, [ultraWideDeviceId, mainDeviceId]);

  const toggleTorch = async () => {
    const track = streamRef.current?.getVideoTracks()[0] as ExtendedTrack | undefined;
    if (!track) return;

    const caps: ExtendedMediaTrackCapabilities = track.getCapabilities ? track.getCapabilities() : {};
    if (!caps.torch) {
      // Thiết bị không hỗ trợ Torch (ví dụ iOS Safari)
      setTorchMessage('Trình duyệt iOS/thiết bị này không cho phép bật Flash qua web. Vui lòng bấm icon Máy ảnh ở góc dưới để mở Máy ảnh hệ thống dùng Flash.');
      if (torchTimeoutRef.current) clearTimeout(torchTimeoutRef.current);
      torchTimeoutRef.current = setTimeout(() => {
        setTorchMessage(null);
      }, 5000);
      return;
    }

    try {
      const nextState = !isTorchOn;
      await track.applyConstraints({
        advanced: [{ torch: nextState }],
      });
      setIsTorchOn(nextState);

      // Quản lý bộ đếm bảo vệ nhiệt độ cho đèn Flash LED
      if (torchThermalTimerRef.current) {
        clearTimeout(torchThermalTimerRef.current);
        torchThermalTimerRef.current = null;
      }

      if (nextState) {
        // Tự động ngắt sau 45 giây liên tục để tránh quá nhiệt LED & pin
        torchThermalTimerRef.current = setTimeout(async () => {
          try {
            const currentTrack = streamRef.current?.getVideoTracks()[0] as ExtendedTrack | undefined;
            if (currentTrack) {
              await currentTrack.applyConstraints({
                advanced: [{ torch: false }],
              });
            }
          } catch (_) {}
          setIsTorchOn(false);
          setTorchMessage('Đèn Flash đã tự tắt sau 45s để hạ nhiệt thiết bị. Bấm lại nếu cần tiếp tục soi sáng.');
          if (torchTimeoutRef.current) clearTimeout(torchTimeoutRef.current);
          torchTimeoutRef.current = setTimeout(() => setTorchMessage(null), 5000);
        }, 45000);
      }
    } catch (err) {
      console.warn('[LiveCamera] Lỗi điều khiển đèn flash:', err);
      setTorchMessage('Không thể bật đèn flash trên thiết bị này.');
      setTimeout(() => setTorchMessage(null), 3000);
    }
  };

  const dismissTorchMessage = () => {
    setTorchMessage(null);
  };

  useEffect(() => {
    if (isLiveCameraOpen && videoRef.current && mediaStream) {
      if (videoRef.current.srcObject !== mediaStream) {
        videoRef.current.srcObject = mediaStream;
      }
      videoRef.current
        .play()
        .then(() => {
          setCameraLoading(false);
        })
        .catch((err) => {
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

  // Ngắt camera khi tắt màn hình (khóa máy) hoặc chuyển ứng dụng để chống Zombie Stream gây nóng máy trong túi quần
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.hidden) {
        if (streamRef.current && isLiveCameraOpen) {
          isPausedByVisibilityRef.current = true;
          if (streamRef.current) {
            streamRef.current.getTracks().forEach((track) => {
              try {
                track.stop();
              } catch (_) {}
            });
            streamRef.current = null;
          }
          setMediaStream(null);
          setIsTorchOn(false);
          if (videoRef.current) {
            videoRef.current.srcObject = null;
          }
        }
      } else {
        if (isPausedByVisibilityRef.current && isLiveCameraOpen) {
          isPausedByVisibilityRef.current = false;
          startLiveCamera();
        }
      }
    };

    const handlePageHide = () => {
      if (streamRef.current) {
        stopLiveCamera();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('pagehide', handlePageHide);
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('pagehide', handlePageHide);
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

  // Cử chỉ cảm ứng 2 ngón tay Pinch-to-zoom & Tự động kích hoạt 0.5x
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
      const ratio = dist / initialPinchDistRef.current;

      // 1. Đang ở 1.0x, chụm 2 ngón tay thu nhỏ lại (ratio < 0.78) -> Kích hoạt 0.5x Ultra-Wide
      if (activeLensModeRef.current === '1.0x' && ratio < 0.78 && !isSwitchingLensRef.current) {
        if (hasUltraWide || ultraWideDeviceId) {
          switchLensMode('0.5x');
          initialPinchDistRef.current = dist;
          return;
        }
      }

      // 2. Đang ở 0.5x, bung 2 ngón tay phóng to ra (ratio > 1.25) -> Quay trở lại 1.0x Main Lens
      if (activeLensModeRef.current === '0.5x' && ratio > 1.25 && !isSwitchingLensRef.current) {
        switchLensMode('1.0x');
        initialPinchDistRef.current = dist;
        return;
      }

      // 3. Phóng to kỹ thuật số (từ 1.0x lên tối đa 5.0x hoặc từ 0.5x)
      const minLimit = activeLensModeRef.current === '0.5x' ? 0.5 : 1.0;
      let nextZoom = Math.min(5.0, Math.max(minLimit, initialZoomRef.current * ratio));
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
      const minLimit = activeLensModeRef.current === '0.5x' ? 0.5 : 1.0;
      const next = Math.min(5.0, Math.max(minLimit, Math.round((prev + delta) * 10) / 10));
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

    const track = streamRef.current?.getVideoTracks()[0] as ExtendedTrack | undefined;
    const caps: ExtendedMediaTrackCapabilities = track?.getCapabilities ? track.getCapabilities() : {};
    const hasHardwareZoom = !!caps.zoom;

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Khi ở 0.5x hoặc 1.0x hoặc có zoom phần cứng, chụp trọn khung hình video
    if (hasHardwareZoom || zoomLevel <= 1.0) {
      canvas.width = vw;
      canvas.height = vh;
      ctx.drawImage(video, 0, 0, vw, vh);
    } else {
      // Khi zoom số > 1.0x: crop tâm ảnh theo tỷ lệ zoom
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
        0.95 // Chất lượng 95% cực cao (Near-Lossless), bảo toàn 100% độ sắc nét chi tiết khảo sát
      );
    } catch (_err) {
      console.warn('[PhotoCaptureInput] Lỗi khi chụp khung hình camera trực tiếp:', _err);
    }
  };

  const handleVideoReady = () => {
    setCameraLoading(false);
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
    // Ống kính & Flash mới
    activeLensMode,
    hasUltraWide,
    isTorchSupported,
    isTorchOn,
    torchMessage,
    switchLensMode,
    toggleTorch,
    dismissTorchMessage,
    applyHardwareZoom,
    handleTriggerNativeCamera,
    handleTriggerCapture,
    handleVideoReady,
    handleCameraTouchStart,
    handleCameraTouchMove,
    handleCameraTouchEnd,
    handleCameraWheel,
    handleCaptureLiveFrame,
  };
}
