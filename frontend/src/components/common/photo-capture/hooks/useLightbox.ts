import React, { useState, useRef } from 'react';

export function useLightbox() {
  const [isLightboxOpen, setIsLightboxOpen] = useState(false);
  const [lightboxZoom, setLightboxZoom] = useState<number>(1.0);
  const [lightboxPan, setLightboxPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isLightboxPinching, setIsLightboxPinching] = useState(false);

  const lightboxPinchDistRef = useRef<number>(0);
  const lightboxInitialZoomRef = useRef<number>(1.0);
  const lightboxDragStartRef = useRef<{ x: number; y: number } | null>(null);
  const lightboxInitialPanRef = useRef<{ x: number; y: number }>({ x: 0, y: 0 });

  const resetLightbox = () => {
    setLightboxZoom(1.0);
    setLightboxPan({ x: 0, y: 0 });
  };

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

  return {
    isLightboxOpen,
    setIsLightboxOpen,
    lightboxZoom,
    setLightboxZoom,
    lightboxPan,
    setLightboxPan,
    isLightboxPinching,
    resetLightbox,
    handleLightboxTouchStart,
    handleLightboxTouchMove,
    handleLightboxTouchEnd,
    handleLightboxWheel,
  };
}
