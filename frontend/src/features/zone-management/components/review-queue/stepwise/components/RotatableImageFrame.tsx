import React, { useState, useEffect } from 'react';
import { getSafeDisplayUrl, resolveOfflinePhotoUrl } from '../../../../../../core/storage/offlinePhotoStorage';

export interface RotatableImageFrameProps {
  src?: string;
  url?: string;
  alt: string;
  rotation?: number;
  /**
   * Maximum height in pixels for the rendered stage (after rotation).
   * The frame automatically computes maxWidth = maxHeightPx * effectiveAspectRatio
   * so that the stage box matches the rotated image's exact aspect ratio 1:1
   * without clipping any ends and without letterboxing inside the stage box.
   */
  maxHeightPx?: number;
  /**
   * Optional className for the outer centering wrapper
   */
  wrapperClassName?: string;
  className?: string;
  /**
   * Optional className for the exact-fit stage box (where pins live)
   */
  stageClassName?: string;
  /**
   * Optional click handler on the exact-fit stage box (for click-to-pin)
   */
  onStageClick?: (e: React.MouseEvent<HTMLDivElement>) => void;
  stageOnClick?: (e: React.MouseEvent<HTMLDivElement>) => void;
  onClick?: (e: React.MouseEvent<HTMLDivElement>) => void;
  /**
   * Optional children (e.g. pin markers) rendered inside the exact-fit stage box.
   * Coordinates (left: X%, top: Y%) inside children map 100% to the rotated visual image.
   */
  children?: React.ReactNode;
}

export const RotatableImageFrame: React.FC<RotatableImageFrameProps> = ({
  src,
  url,
  alt,
  rotation = 0,
  maxHeightPx = 520,
  wrapperClassName = '',
  className = '',
  stageClassName = '',
  onStageClick,
  stageOnClick,
  onClick,
  children,
}) => {
  const effectiveSrc = src || url || '';
  const [displayUrl, setDisplayUrl] = useState<string>(() => getSafeDisplayUrl(effectiveSrc));
  const [naturalSize, setNaturalSize] = useState<{ w: number; h: number }>({ w: 4, h: 3 });

  useEffect(() => {
    let isMounted = true;
    if (effectiveSrc) {
      const immediate = getSafeDisplayUrl(effectiveSrc);
      if (immediate && isMounted) {
        setDisplayUrl(immediate);
      }
      resolveOfflinePhotoUrl(effectiveSrc).then((resolved) => {
        if (isMounted && resolved) {
          setDisplayUrl(resolved);
        }
      });
    } else {
      setDisplayUrl('');
    }
    return () => {
      isMounted = false;
    };
  }, [effectiveSrc]);

  const normRot = ((rotation % 360) + 360) % 360;
  const isQuarterTurn = normRot === 90 || normRot === 270;

  // Effective stage dimensions after applying rotation
  const stageW = isQuarterTurn ? naturalSize.h : naturalSize.w;
  const stageH = isQuarterTurn ? naturalSize.w : naturalSize.h;
  const effectiveAspect = stageW > 0 && stageH > 0 ? stageW / stageH : 4 / 3;

  // Ensure the stage box never exceeds maxHeightPx while preserving exact aspect ratio
  const computedMaxWidthPx = Math.max(120, Math.round(maxHeightPx * effectiveAspect));
  const handleStageClick = onStageClick || stageOnClick || onClick;

  return (
    <div className={`w-full flex items-center justify-center select-none ${wrapperClassName} ${className}`}>
      <div
        onClick={handleStageClick}
        style={{
          aspectRatio: `${stageW} / ${stageH}`,
          width: '100%',
          maxWidth: `${computedMaxWidthPx}px`,
        }}
        className={`relative overflow-hidden mx-auto leading-none ${stageClassName}`}
      >
        {displayUrl && (
          <img
            src={displayUrl}
            alt={alt}
            draggable={false}
            onLoad={(e) => {
              const img = e.currentTarget;
              if (img.naturalWidth > 0 && img.naturalHeight > 0) {
                setNaturalSize({ w: img.naturalWidth, h: img.naturalHeight });
              }
            }}
            style={
              isQuarterTurn
                ? {
                    position: 'absolute',
                    top: '50%',
                    left: '50%',
                    width: `${(1 / effectiveAspect) * 100}%`,
                    height: `${effectiveAspect * 100}%`,
                    maxWidth: 'none',
                    maxHeight: 'none',
                    transform: `translate(-50%, -50%) rotate(${normRot}deg)`,
                  }
                : {
                    position: 'absolute',
                    inset: 0,
                    width: '100%',
                    height: '100%',
                    transform: normRot === 180 ? 'rotate(180deg)' : undefined,
                  }
            }
            className="block pointer-events-none select-none object-fill"
          />
        )}
        {children}
      </div>
    </div>
  );
};
