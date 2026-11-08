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
  boxWidth: number;
  boxHeight: number;
  /** Xem trước đúng phần sẽ in (khung crop trên ảnh đã xoay). */
  crop?: NormRect | null;
  useThumb?: boolean;
  onSize?: (size: NaturalSize) => void;
  className?: string;
}

/**
 * Hiển thị ảnh đã xoay `rotation` độ (chiều kim đồng hồ) vừa khung, giống bản in.
 * Ảnh gốc giữ nguyên, chỉ xoay bằng CSS. Kích thước tự nhiên báo ra qua onSize (đã xoay EXIF).
 */
export const RotatedPhoto: React.FC<RotatedPhotoProps> = ({ url, rotation, boxWidth, boxHeight, crop, useThumb = false, onSize, className = '' }) => {
  const [size, setSize] = useState<NaturalSize | null>(null);
  const [src, setSrc] = useState<string>(useThumb ? thumbUrlOf(url) : url);
  const [failed, setFailed] = useState(false);
  const deg = normalizeDeg(rotation);

  const handleLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const img = e.currentTarget;
    const s = { width: img.naturalWidth, height: img.naturalHeight };
    setSize(s);
    // Thumbnail nhỏ hơn ảnh gốc: chỉ báo kích thước khi đang hiển thị ảnh gốc (tỉ lệ thì như nhau).
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

  if (failed) {
    return (
      <div className={`flex items-center justify-center bg-slate-100 text-slate-400 rounded-lg ${className}`} style={{ width: boxWidth, height: boxHeight }}>
        <ImageOff className="w-5 h-5" />
      </div>
    );
  }

  const rot = size ? rotatedSize(size, deg) : null;
  const region = crop && rot ? crop : { x: 0, y: 0, w: 1, h: 1 };
  const regionW = rot ? region.w * rot.width : 1;
  const regionH = rot ? region.h * rot.height : 1;
  const scale = rot ? Math.min(boxWidth / regionW, boxHeight / regionH) : 0;
  const viewW = regionW * scale;
  const viewH = regionH * scale;
  const rotW = rot ? rot.width * scale : 0;
  const rotH = rot ? rot.height * scale : 0;
  const imgW = size ? size.width * scale : 0;
  const imgH = size ? size.height * scale : 0;

  return (
    <div className={`relative flex items-center justify-center bg-slate-100 rounded-lg overflow-hidden ${className}`} style={{ width: boxWidth, height: boxHeight }}>
      <div className="relative overflow-hidden" style={{ width: rot ? viewW : boxWidth, height: rot ? viewH : boxHeight }}>
        <div
          className="absolute"
          style={{
            width: rotW,
            height: rotH,
            left: rot ? -region.x * rotW : 0,
            top: rot ? -region.y * rotH : 0,
          }}
        >
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
                ? {
                    width: imgW,
                    height: imgH,
                    left: (rotW - imgW) / 2,
                    top: (rotH - imgH) / 2,
                    transform: `rotate(${deg}deg)`,
                  }
                : { width: 1, height: 1, opacity: 0 }
            }
          />
        </div>
      </div>
    </div>
  );
};
