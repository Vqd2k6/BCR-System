import React, { useState } from 'react';
import { ImageOff } from 'lucide-react';
import type { NaturalSize } from '../types';
import { normalizeDeg, rotatedSize, type NormRect } from '../utils/photoQcGeometry';

/** Tiền tố thumbnail trên R2 (script generate_photo_qc_thumbs). Không cấu hình → dùng ảnh gốc. */
const THUMB_PREFIX = String(import.meta.env.VITE_PHOTO_QC_THUMB_PREFIX || '').trim();

export function thumbUrlOf(url: string): string {
  if (!THUMB_PREFIX) return url;
  try {
    const u = new URL(url);
    return `${u.origin}/${THUMB_PREFIX.replace(/^\/+|\/+$/g, '')}${u.pathname}`;
  } catch (err: unknown) {
    console.error('[PhotoQc:thumbUrlOf] URL ảnh không hợp lệ, dùng ảnh gốc', err);
    return url;
  }
}

interface RotatedPhotoProps {
  url: string;
  rotation: number;
  /** Bề ngang khung. Bỏ qua khi fitHeight = true (rộng theo tỉ lệ thật của ảnh). */
  boxWidth?: number;
  boxHeight: number;
  /** Khung cao cố định, rộng theo tỉ lệ ảnh in (không cắt, không viền). */
  fitHeight?: boolean;
  /** Xem trước đúng phần sẽ in (khung crop trên ảnh đã xoay). */
  crop?: NormRect | null;
  useThumb?: boolean;
  onSize?: (size: NaturalSize) => void;
  onClick?: () => void;
  title?: string;
  className?: string;
  children?: React.ReactNode;
}

/**
 * Hiển thị ảnh đã xoay `rotation` độ (chiều kim đồng hồ) giống bản in. Ảnh gốc giữ nguyên, chỉ xoay bằng CSS.
 * Kích thước tự nhiên (đã xoay EXIF) báo ra qua onSize.
 */
export const RotatedPhoto: React.FC<RotatedPhotoProps> = ({
  url,
  rotation,
  boxWidth,
  boxHeight,
  fitHeight = false,
  crop,
  useThumb = false,
  onSize,
  onClick,
  title,
  className = '',
  children,
}) => {
  const [size, setSize] = useState<NaturalSize | null>(null);
  const [src, setSrc] = useState<string>(useThumb ? thumbUrlOf(url) : url);
  const [failed, setFailed] = useState(false);
  const deg = normalizeDeg(rotation);

  const handleLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget;
    const s = { width: img.naturalWidth, height: img.naturalHeight };
    setSize(s);
    onSize?.(s);
  };

  const handleError = () => {
    if (src !== url) {
      setSrc(url);
      return;
    }
    console.error('[PhotoQc:RotatedPhoto] Không tải được ảnh', url);
    setFailed(true);
  };

  const rot = size ? rotatedSize(size, deg) : null;
  const region = crop && rot ? crop : { x: 0, y: 0, w: 1, h: 1 };
  const regionW = rot ? region.w * rot.width : 4;
  const regionH = rot ? region.h * rot.height : 3;
  const outerW = fitHeight ? Math.round((boxHeight * regionW) / regionH) : boxWidth ?? Math.round((boxHeight * 4) / 3);
  const scale = rot ? Math.min(outerW / regionW, boxHeight / regionH) : 0;
  const viewW = regionW * scale;
  const viewH = regionH * scale;
  const rotW = rot ? rot.width * scale : 0;
  const rotH = rot ? rot.height * scale : 0;
  const imgW = size ? size.width * scale : 0;
  const imgH = size ? size.height * scale : 0;

  if (failed) {
    return (
      <div className={`flex items-center justify-center bg-slate-100 text-slate-400 rounded-lg shrink-0 ${className}`} style={{ width: outerW, height: boxHeight }} title={title}>
        <ImageOff className="w-5 h-5" />
      </div>
    );
  }

  return (
    <div
      onClick={onClick}
      title={title}
      className={`relative flex items-center justify-center bg-slate-100 rounded-lg overflow-hidden shrink-0 ${onClick ? 'cursor-pointer hover:ring-2 hover:ring-teal-400' : 'cursor-default'} ${className}`}
      style={{ width: outerW, height: boxHeight }}
    >
      <div className="relative overflow-hidden" style={{ width: rot ? viewW : outerW, height: rot ? viewH : boxHeight }}>
        <div className="absolute" style={{ width: rotW, height: rotH, left: rot ? -region.x * rotW : 0, top: rot ? -region.y * rotH : 0 }}>
          <img
            src={src}
            alt=""
            loading="lazy"
            decoding="async"
            draggable={false}
            onLoad={handleLoad}
            onError={handleError}
            className="absolute max-w-none select-none"
            style={
              size
                ? { width: imgW, height: imgH, left: (rotW - imgW) / 2, top: (rotH - imgH) / 2, transform: `rotate(${deg}deg)` }
                : { width: 1, height: 1, opacity: 0 }
            }
          />
        </div>
      </div>
      {children}
    </div>
  );
};
