import { useState, useRef, useCallback } from 'react';

export interface UseInteractiveCanvasZoomOptions {
  minZoom?: number;
  maxZoom?: number;
  initialZoom?: number;
}

export function useInteractiveCanvasZoom(options: UseInteractiveCanvasZoomOptions = {}) {
  const { minZoom = 1.0, maxZoom = 4.0, initialZoom = 1.0 } = options;

  const [zoomScale, setZoomScale] = useState<number>(initialZoom);
  const [panOffset, setPanOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState<boolean>(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const tightBoxRef = useRef<HTMLDivElement>(null);

  // Lưu trữ trạng thái gesture
  const panStartRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const initialPanOffsetRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const initialPinchDistRef = useRef<number>(0);
  const initialScaleRef = useRef<number>(1.0);
  const hasMovedRef = useRef<boolean>(false);

  // Zoom In / Out / Reset
  const handleZoomIn = useCallback(() => {
    setZoomScale((prev) => {
      const next = Math.min(maxZoom, Math.round((prev + 0.5) * 10) / 10);
      return next;
    });
  }, [maxZoom]);

  const handleZoomOut = useCallback(() => {
    setZoomScale((prev) => {
      const next = Math.max(minZoom, Math.round((prev - 0.5) * 10) / 10);
      if (next <= 1.0) {
        setPanOffset({ x: 0, y: 0 });
      }
      return next;
    });
  }, [minZoom]);

  const handleResetZoom = useCallback(() => {
    setZoomScale(1.0);
    setPanOffset({ x: 0, y: 0 });
  }, []);

  const handleSetZoomPreset = useCallback((targetScale: number) => {
    const clamped = Math.max(minZoom, Math.min(maxZoom, targetScale));
    setZoomScale(clamped);
    if (clamped <= 1.0) {
      setPanOffset({ x: 0, y: 0 });
    }
  }, [minZoom, maxZoom]);

  // Wheel zoom (cho Desktop / Touchpad)
  const handleWheel = useCallback((e: React.WheelEvent<HTMLDivElement>) => {
    // Nếu giữ phím Ctrl/Cmd hoặc cuộn trực tiếp trên canvas
    if (e.ctrlKey || e.metaKey || e.altKey) {
      e.preventDefault();
      const delta = e.deltaY < 0 ? 0.25 : -0.25;
      setZoomScale((prev) => {
        const next = Math.max(minZoom, Math.min(maxZoom, Math.round((prev + delta) * 100) / 100));
        if (next <= 1.0) setPanOffset({ x: 0, y: 0 });
        return next;
      });
    }
  }, [minZoom, maxZoom]);

  // Touch handlers cho cử chỉ 2 ngón tay Pinch-to-zoom & Pan
  const handleTouchStart = useCallback((e: React.TouchEvent<HTMLDivElement>) => {
    if (e.touches.length === 2) {
      hasMovedRef.current = true;
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      initialPinchDistRef.current = dist;
      initialScaleRef.current = zoomScale;

      const midX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
      const midY = (e.touches[0].clientY + e.touches[1].clientY) / 2;
      panStartRef.current = { x: midX, y: midY };
      initialPanOffsetRef.current = { ...panOffset };
      setIsPanning(true);
    }
  }, [zoomScale, panOffset]);

  const handleTouchMove = useCallback((e: React.TouchEvent<HTMLDivElement>) => {
    if (e.touches.length === 2 && initialPinchDistRef.current > 0) {
      hasMovedRef.current = true;
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      const ratio = dist / initialPinchDistRef.current;
      const nextScale = Math.max(minZoom, Math.min(maxZoom, Math.round(initialScaleRef.current * ratio * 100) / 100));
      setZoomScale(nextScale);

      // Pan theo trọng tâm 2 ngón tay
      const midX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
      const midY = (e.touches[0].clientY + e.touches[1].clientY) / 2;
      const dx = midX - panStartRef.current.x;
      const dy = midY - panStartRef.current.y;

      setPanOffset({
        x: initialPanOffsetRef.current.x + dx,
        y: initialPanOffsetRef.current.y + dy,
      });
    }
  }, [minZoom, maxZoom]);

  const handleTouchEnd = useCallback((e: React.TouchEvent<HTMLDivElement>) => {
    if (e.touches.length < 2) {
      initialPinchDistRef.current = 0;
      setIsPanning(false);
    }
  }, []);

  // Bắt đầu pan với chuột / 1 ngón tay khi đang zoom và không kéo pin
  const startPan = useCallback((clientX: number, clientY: number) => {
    if (zoomScale <= 1.0) return;
    setIsPanning(true);
    hasMovedRef.current = false;
    panStartRef.current = { x: clientX, y: clientY };
    initialPanOffsetRef.current = { ...panOffset };
  }, [zoomScale, panOffset]);

  const updatePan = useCallback((clientX: number, clientY: number) => {
    if (!isPanning) return;
    const dx = clientX - panStartRef.current.x;
    const dy = clientY - panStartRef.current.y;
    if (Math.hypot(dx, dy) > 4) {
      hasMovedRef.current = true;
    }
    setPanOffset({
      x: initialPanOffsetRef.current.x + dx,
      y: initialPanOffsetRef.current.y + dy,
    });
  }, [isPanning]);

  const endPan = useCallback(() => {
    setIsPanning(false);
  }, []);

  /**
   * Tính toán toạ độ chuẩn hoá Scale & Pan Invariant từ sự kiện click/tap
   * Bất kể đang zoom bao nhiêu hay đang cuộn ở đâu, kết quả luôn là tỷ lệ % chuẩn trên ảnh gốc
   */
  const calculateNormalizedCoords = useCallback((clientX: number, clientY: number): { x: number; y: number } | null => {
    if (!tightBoxRef.current) return null;
    const rect = tightBoxRef.current.getBoundingClientRect();
    if (!rect.width || !rect.height) return null;

    // rect.left và rect.top đã chứa toàn bộ ảnh hưởng của translate và scale
    const x = Math.max(0.5, Math.min(99.5, parseFloat((((clientX - rect.left) / rect.width) * 100).toFixed(2))));
    const y = Math.max(0.5, Math.min(99.5, parseFloat((((clientY - rect.top) / rect.height) * 100).toFixed(2))));
    return { x, y };
  }, []);

  return {
    zoomScale,
    setZoomScale,
    panOffset,
    setPanOffset,
    isPanning,
    containerRef,
    tightBoxRef,
    hasMovedRef,
    handleZoomIn,
    handleZoomOut,
    handleResetZoom,
    handleSetZoomPreset,
    handleWheel,
    handleTouchStart,
    handleTouchMove,
    handleTouchEnd,
    startPan,
    updatePan,
    endPan,
    calculateNormalizedCoords,
    // CSS Transform styles
    transformStyle: {
      transform: `translate(${panOffset.x}px, ${panOffset.y}px) scale(${zoomScale})`,
      transformOrigin: 'center center',
      transition: isPanning ? 'none' : 'transform 0.12s ease-out',
      willChange: 'transform',
    } as React.CSSProperties,
    // Hệ số co ngược ghim pin để không bị che khuất ảnh khi zoom to
    pinCounterScale: zoomScale > 1.05 ? Math.max(0.45, 1 / zoomScale) : 1.0,
  };
}
