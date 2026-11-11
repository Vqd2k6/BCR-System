import React, { useContext, useEffect, useRef, useState } from 'react';
import { AlertTriangle, Crop } from 'lucide-react';
import { RotatedPhoto } from '../../../../../photo-qc/components/RotatedPhoto';
import { normalizeDeg, rotatedSize } from '../../../../../photo-qc/utils/photoQcGeometry';
import type { NaturalSize } from '../../../../../photo-qc/types';
import { ApprovedCropContext, type ApprovedCropMap, type ApprovedCropRect } from '../context/ApprovedCropContext';

/** Crop đã duyệt còn áp được cho ảnh này ở góc xoay hiện tại (lệch góc thì report cũng không in crop). */
export function applicableCrop(map: ApprovedCropMap, url: string | null | undefined, rotation: number): ApprovedCropRect | null {
  if (!url) return null;
  const crop = map.get(url);
  return crop && normalizeDeg(crop.rotationAtCrop) === normalizeDeg(rotation) ? crop : null;
}

export function useApplicableCrop(url: string | null | undefined, rotation: number): ApprovedCropRect | null {
  return applicableCrop(useContext(ApprovedCropContext), url, rotation);
}

export interface CroppedPin {
  code: string;
  /** % trên ảnh NGUYÊN đã xoay (như dữ liệu ghim đang lưu). */
  x: number;
  y: number;
}

/** Đổi toạ độ ghim từ ảnh nguyên sang khung crop; null = ghim nằm ngoài phần được in. */
export function mapPinToCrop(pin: CroppedPin, crop: ApprovedCropRect): { x: number; y: number } | null {
  const x = ((pin.x / 100 - crop.x) / crop.w) * 100;
  const y = ((pin.y / 100 - crop.y) / crop.h) * 100;
  return x < -0.5 || x > 100.5 || y < -0.5 || y > 100.5 ? null : { x, y };
}

/** Khung crop vẽ đè lên ảnh nguyên ở chế độ sửa: vùng ngoài khung làm tối (report không in phần đó). */
export const CropFrameOverlay: React.FC<{ crop: ApprovedCropRect }> = ({ crop }) => (
  <div
    className="absolute border-2 border-dashed border-teal-400 pointer-events-none z-20"
    style={{
      left: `${crop.x * 100}%`,
      top: `${crop.y * 100}%`,
      width: `${crop.w * 100}%`,
      height: `${crop.h * 100}%`,
      boxShadow: '0 0 0 9999px rgba(2, 6, 23, 0.45)',
    }}
  >
    <span className="absolute -top-5 left-0 px-1.5 py-0.5 rounded text-[10px] font-bold bg-teal-600 text-white whitespace-nowrap">
      Khung crop đã duyệt – report in phần này
    </span>
  </div>
);

interface CroppedCadViewProps {
  url: string;
  rotation: number;
  crop: ApprovedCropRect;
  pins: CroppedPin[];
  showPins?: boolean;
  /** Class nhãn + chấm ghim theo loại (Z / E / D). */
  labelClass: string;
  dotClass: string;
  maxHeightPx?: number;
  selectedCode?: string | null;
  onSelectPin?: (code: string) => void;
}

/**
 * CAD hiển thị đúng phần report in (crop đã duyệt), ghim đổi toạ độ theo khung crop.
 * Chỉ để xem: kéo / thêm ghim làm ở chế độ sửa trên ảnh nguyên (toạ độ lưu không đổi).
 */
export const CroppedCadView: React.FC<CroppedCadViewProps> = ({
  url,
  rotation,
  crop,
  pins,
  showPins = true,
  labelClass,
  dotClass,
  maxHeightPx = 680,
  selectedCode,
  onSelectPin,
}) => {
  const wrapRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);
  const [size, setSize] = useState<NaturalSize | null>(null);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const update = () => setWidth(el.clientWidth);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Khung cao theo tỉ lệ phần crop, không vượt bề ngang khung chứa.
  const rot = size ? rotatedSize(size, normalizeDeg(rotation)) : null;
  const ratio = rot ? (crop.w * rot.width) / (crop.h * rot.height) : 4 / 3;
  const boxHeight = Math.max(160, Math.min(maxHeightPx, width > 0 ? (width - 8) / ratio : maxHeightPx));
  const mapped = pins.map((p) => ({ pin: p, at: mapPinToCrop(p, crop) }));
  const outside = mapped.filter((m) => !m.at).map((m) => m.pin.code);

  return (
    <div ref={wrapRef} className="force-light relative w-full rounded-xl overflow-hidden bg-slate-950/95 flex flex-col items-center p-1 gap-1">
      <RotatedPhoto url={url} rotation={rotation} boxHeight={boxHeight} fitHeight crop={crop} onSize={setSize}>
        {showPins &&
          mapped.map(({ pin, at }) =>
            at ? (
              <button
                type="button"
                key={pin.code}
                title={pin.code}
                onClick={(e) => {
                  e.stopPropagation();
                  onSelectPin?.(pin.code);
                }}
                style={{ position: 'absolute', left: `${at.x}%`, top: `${at.y}%`, transform: 'translate(-50%, -100%)' }}
                className="z-30 flex flex-col items-center cursor-pointer group"
              >
                <span
                  className={`px-1.5 py-0.5 rounded font-mono font-black text-[10px] shadow-md border border-white group-hover:scale-110 transition-transform ${
                    selectedCode === pin.code ? 'bg-amber-500 text-slate-950 ring-2 ring-white' : labelClass
                  }`}
                >
                  {pin.code}
                </span>
                <span className={`w-2.5 h-2.5 rounded-full border-2 border-white shadow-md -mt-0.5 ${dotClass}`} />
              </button>
            ) : null
          )}
        <span className="absolute top-1.5 left-1.5 z-30 px-1.5 py-0.5 rounded text-[10px] font-bold border bg-emerald-950 text-emerald-300 border-emerald-700 flex items-center gap-1 pointer-events-none">
          <Crop className="w-3 h-3" /> Đã crop – như report in
        </span>
      </RotatedPhoto>
      {showPins && outside.length > 0 && (
        <div className="w-full px-2 py-1 rounded-lg bg-rose-50 border border-rose-200 text-[11px] text-rose-700 flex items-center gap-1.5">
          <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
          <span>
            Ghim nằm ngoài khung crop, report sẽ không thấy: <strong>{outside.join(', ')}</strong>. Vào Duyệt Crop để chỉnh khung.
          </span>
        </div>
      )}
    </div>
  );
};
