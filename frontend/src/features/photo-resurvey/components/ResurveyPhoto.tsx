import React, { useState } from 'react';
import { ImageOff, X } from 'lucide-react';
import { getSafeDisplayUrl } from '../../../core/storage/offlinePhotoStorage';

interface ResurveyPhotoProps {
  url: string;
  rotation: number;
  alt: string;
  height?: number;
  /** Viền nhấn (ảnh cần chụp lại / ảnh mới). */
  tone?: 'neutral' | 'flag' | 'new';
}

const TONE_CLASS: Record<NonNullable<ResurveyPhotoProps['tone']>, string> = {
  neutral: 'border-slate-200',
  flag: 'border-rose-400',
  new: 'border-emerald-400',
};

function normalizeDeg(deg: number): number {
  return ((Math.round(deg) % 360) + 360) % 360;
}

/** Ảnh xoay đúng góc in, bấm để xem lớn. Ảnh xoay 90°/270° thu nhỏ để không tràn khung. */
export const ResurveyPhoto: React.FC<ResurveyPhotoProps> = ({ url, rotation, alt, height = 150, tone = 'neutral' }) => {
  const [open, setOpen] = useState(false);
  const [broken, setBroken] = useState(false);
  const deg = normalizeDeg(rotation);
  const sideways = deg === 90 || deg === 270;
  const src = getSafeDisplayUrl(url);
  const transform = `rotate(${deg}deg)${sideways ? ' scale(0.75)' : ''}`;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`relative w-full overflow-hidden rounded-lg border-2 bg-slate-100 cursor-pointer ${TONE_CLASS[tone]}`}
        style={{ height }}
        title="Bấm để xem ảnh lớn"
      >
        {broken || !src ? (
          <span className="absolute inset-0 flex flex-col items-center justify-center gap-1 text-[11px] text-slate-500">
            <ImageOff className="w-5 h-5" /> Không tải được ảnh
          </span>
        ) : (
          <img
            src={src}
            alt={alt}
            loading="lazy"
            onError={() => {
              console.error('[PhotoResurvey:photo] Không tải được ảnh', url);
              setBroken(true);
            }}
            className="absolute inset-0 w-full h-full object-contain"
            style={{ transform }}
          />
        )}
      </button>

      {open && (
        <div className="fixed inset-0 z-[3000] bg-black/90 flex items-center justify-center p-3 cursor-pointer" onClick={() => setOpen(false)}>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="absolute top-3 right-3 p-2 rounded-full bg-white/10 text-white hover:bg-white/20 cursor-pointer"
            aria-label="Đóng"
          >
            <X className="w-5 h-5" />
          </button>
          <img src={src} alt={alt} className="max-w-full max-h-full object-contain" style={{ transform }} />
        </div>
      )}
    </>
  );
};
