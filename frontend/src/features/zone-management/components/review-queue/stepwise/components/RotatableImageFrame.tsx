import React, { useState } from 'react';
import { Sparkles, Check } from 'lucide-react';
import { useResolvedPhotoUrl } from '../../../../../../core/storage/useResolvedPhotoUrl';
import { useAuditStudioImgOptional } from '../context/AuditStudioImgContext';

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
  const studioCtx = useAuditStudioImgOptional();
  const rawSrc = src || url || '';
  const effectiveSrc = studioCtx && rawSrc ? studioCtx.resolveEffectiveStudioUrl(rawSrc) : rawSrc;
  const { displayUrl } = useResolvedPhotoUrl(effectiveSrc);
  const [naturalSize, setNaturalSize] = useState<{ w: number; h: number }>({ w: 4, h: 3 });

  const normRot = ((rotation % 360) + 360) % 360;
  const isQuarterTurn = normRot === 90 || normRot === 270;

  // Effective stage dimensions after applying rotation
  const stageW = isQuarterTurn ? naturalSize.h : naturalSize.w;
  const stageH = isQuarterTurn ? naturalSize.w : naturalSize.h;
  const effectiveAspect = stageW > 0 && stageH > 0 ? stageW / stageH : 4 / 3;

  // Ensure the stage box never exceeds maxHeightPx while preserving exact aspect ratio
  const computedMaxWidthPx = Math.max(120, Math.round(maxHeightPx * effectiveAspect));
  const handleStageClick = onStageClick || stageOnClick || onClick;

  const isSelectedInStudio = Boolean(
    studioCtx &&
      rawSrc &&
      (studioCtx.isPhotoSelected(rawSrc) || studioCtx.isPhotoSelected(effectiveSrc))
  );
  const studioEnhancedInfo =
    studioCtx && rawSrc
      ? studioCtx.getStudioEnhancedInfo(effectiveSrc) || studioCtx.getStudioEnhancedInfo(rawSrc)
      : null;
  const isHoldingS = Boolean(studioCtx?.isHoldingSKey && rawSrc);

  const handleInterceptedClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (studioCtx?.isHoldingSKey && effectiveSrc) {
      e.preventDefault();
      e.stopPropagation();
      studioCtx.toggleSelectPhoto({
        url: effectiveSrc,
        title: alt || 'Ảnh hiện trường',
        rotation: normRot,
      });
      return;
    }
    handleStageClick?.(e);
  };

  return (
    <div
      onClickCapture={(e) => {
        if (studioCtx?.isHoldingSKey && effectiveSrc) {
          e.preventDefault();
          e.stopPropagation();
          studioCtx.toggleSelectPhoto({
            url: effectiveSrc,
            title: alt || 'Ảnh hiện trường',
            rotation: normRot,
          });
        }
      }}
      className={`w-full flex items-center justify-center select-none ${
        isHoldingS ? 'cursor-copy' : ''
      } ${wrapperClassName} ${className}`}
    >
      <div
        onClick={handleInterceptedClick}
        style={{
          aspectRatio: `${stageW} / ${stageH}`,
          width: '100%',
          maxWidth: `${computedMaxWidthPx}px`,
        }}
        className={`relative overflow-hidden mx-auto leading-none ${
          isSelectedInStudio ? 'ring-3 ring-indigo-500 ring-inset rounded-md' : ''
        } ${stageClassName}`}
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

        {/* Nhãn "Đã qua Studio" khi ảnh đã được hiệu chỉnh & lưu từ Studio Img */}
        {studioEnhancedInfo && (
          <div
            className="absolute bottom-2 left-2 z-20 px-2 py-0.5 rounded-md bg-emerald-600/95 text-white font-bold text-[10px] shadow-md flex items-center gap-1 pointer-events-none border border-emerald-400/60"
            title={`Đã hiệu chỉnh qua Studio Img (${studioEnhancedInfo.presetUsed}) • Ảnh gốc KSV được bảo toàn riêng`}
          >
            <Sparkles className="w-3 h-3 shrink-0" />
            <span>Đã qua Studio</span>
          </div>
        )}

        {/* Nhãn khi ảnh đang được chọn vào danh sách Studio Img (S + Click) */}
        {isSelectedInStudio && (
          <div className="absolute bottom-2 right-2 z-20 px-2 py-0.5 rounded-md bg-indigo-600/95 text-white font-bold text-[10px] shadow-md flex items-center gap-1 pointer-events-none border border-indigo-400/60">
            <Check className="w-3 h-3 shrink-0" />
            <span>Studio Img</span>
          </div>
        )}

        {/* Chỉ báo trực quan khi đang nhấn giữ phím S */}
        {isHoldingS && (
          <div className="absolute inset-0 z-30 bg-indigo-950/20 hover:bg-indigo-900/35 transition-colors flex items-center justify-center pointer-events-none">
            <span className="px-2.5 py-1 rounded-full bg-indigo-600/95 text-white text-[10px] font-black shadow-lg border border-white/40 flex items-center gap-1">
              <Sparkles className="w-3 h-3" />
              <span>
                {isSelectedInStudio ? 'S + Click: Bỏ khỏi Studio Img' : 'S + Click: Chọn vào Studio Img'}
              </span>
            </span>
          </div>
        )}

        {children}
      </div>
    </div>
  );
};
