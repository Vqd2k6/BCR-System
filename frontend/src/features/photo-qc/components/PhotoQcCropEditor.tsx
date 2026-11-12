import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, Crop, RotateCcw } from 'lucide-react';
import type { NaturalSize, PhotoQcCropInput, PhotoQcCropRatio, PhotoQcRestampMode, PhotoQcSlotView } from '../types';
import {
  constrainCrop,
  defaultCrop,
  legacyWatermarkZones,
  normalizeDeg,
  ratioForSize,
  rotatedSize,
  suggestRestamp,
  type NormRect,
} from '../utils/photoQcGeometry';

const MAX_W = 720;
const MAX_H = 480;

type DragMode = 'move' | 'nw' | 'ne' | 'sw' | 'se';

interface DragState {
  mode: DragMode;
  startX: number;
  startY: number;
  start: NormRect;
}

interface PhotoQcCropEditorProps {
  slot: PhotoQcSlotView;
  saving: boolean;
  onCancel: () => void;
  onSave: (crop: PhotoQcCropInput, restampMode: PhotoQcRestampMode | undefined) => void;
  /** Khung tối đa (px) của ảnh trong trình chỉnh; mặc định 720×480. */
  maxWidth?: number;
  maxHeight?: number;
  /** Nhãn nút lưu (vd "Lưu khung & duyệt"). */
  saveLabel?: string;
  /** Ẩn phần chọn dập bù watermark (màn duyệt crop chỉ chỉnh khung). */
  hideRestamp?: boolean;
  /** Khoá nút lưu khi khung cắt qua ghim CAD (server cũng chặn). */
  blockCutPins?: boolean;
}

const RESTAMP_LABEL: Record<PhotoQcRestampMode, string> = {
  NONE: 'không dập thêm (khung giữ trọn dấu cũ)',
  LOGO: 'dập lại logo',
  TEXT: 'dập lại giờ + mã ảnh',
  BOTH: 'dập lại cả logo và giờ + mã ảnh',
};

/**
 * Khung crop khoá tỉ lệ 4:3 / 3:4 trên ảnh đã xoay như bản in. Chỉ lưu toạ độ, không tạo ảnh mới.
 * Ảnh có watermark cũ: hiện vùng dấu cũ và báo trước phần dấu máy chủ sẽ tự dập lại khi xuất
 * (máy chủ quyết theo vị trí logo thật trên pixel; gợi ý ở đây chỉ để admin biết trước).
 */
export const PhotoQcCropEditor: React.FC<PhotoQcCropEditorProps> = ({
  slot,
  saving,
  onCancel,
  onSave,
  maxWidth = MAX_W,
  maxHeight = MAX_H,
  saveLabel = 'Lưu khung crop',
  hideRestamp = false,
  blockCutPins = false,
}) => {
  const deg = normalizeDeg(slot.rotation);
  const [natural, setNatural] = useState<NaturalSize | null>(null);
  const rot = natural ? rotatedSize(natural, deg) : null;
  const savedCrop = slot.qc?.crop && !slot.qcStale ? slot.qc.crop : null;
  const [ratio, setRatio] = useState<PhotoQcCropRatio>(savedCrop?.ratio ?? '4:3');
  const [rect, setRect] = useState<NormRect | null>(savedCrop ? { x: savedCrop.x, y: savedCrop.y, w: savedCrop.w, h: savedCrop.h } : null);
  const dragRef = useRef<DragState | null>(null);

  const scale = rot ? Math.min(maxWidth / rot.width, maxHeight / rot.height) : 0;
  const boxW = rot ? rot.width * scale : maxWidth;
  const boxH = rot ? rot.height * scale : maxHeight;

  const handleLoad = (e: React.SyntheticEvent<HTMLImageElement>) => {
    const s = { width: e.currentTarget.naturalWidth, height: e.currentTarget.naturalHeight };
    setNatural(s);
    if (!savedCrop) {
      const r = ratioForSize(rotatedSize(s, deg));
      setRatio(r);
      setRect(defaultCrop(rotatedSize(s, deg), r));
    }
  };

  const zones = useMemo(() => (natural && slot.legacyWatermarked ? legacyWatermarkZones(natural, deg) : null), [natural, slot.legacyWatermarked, deg]);
  const suggested: PhotoQcRestampMode = zones && rect ? suggestRestamp(zones, rect) : 'NONE';

  const cutPins = useMemo(() => {
    if (slot.section !== 'CAD' || !slot.pins || !rect) return [];
    return slot.pins.filter((p) => {
      const nx = p.pinX / 100;
      const ny = p.pinY / 100;
      return nx < rect.x - 0.01 || nx > rect.x + rect.w + 0.01 || ny < rect.y - 0.01 || ny > rect.y + rect.h + 0.01;
    });
  }, [slot.section, slot.pins, rect]);

  const changeRatio = (next: PhotoQcCropRatio) => {
    setRatio(next);
    if (rot) setRect(defaultCrop(rot, next));
  };

  const onPointerMove = useCallback(
    (e: PointerEvent) => {
      const drag = dragRef.current;
      if (!drag || !rot) return;
      const dx = (e.clientX - drag.startX) / boxW;
      const dy = (e.clientY - drag.startY) / boxH;
      const s = drag.start;
      let next: NormRect;
      if (drag.mode === 'move') {
        next = { ...s, x: s.x + dx, y: s.y + dy };
      } else {
        // Kéo góc: góc đối diện đứng yên, bề rộng quyết định (chiều cao theo tỉ lệ).
        const growRight = drag.mode === 'ne' || drag.mode === 'se';
        const growDown = drag.mode === 'sw' || drag.mode === 'se';
        const w = Math.max(0.05, s.w + (growRight ? dx : -dx));
        const sized = constrainCrop({ x: 0, y: 0, w, h: s.h }, rot, ratio);
        const x = growRight ? s.x : s.x + s.w - sized.w;
        const y = growDown ? s.y : s.y + s.h - sized.h;
        if (x < -1e-6 || y < -1e-6 || x + sized.w > 1 + 1e-6 || y + sized.h > 1 + 1e-6) return;
        next = { x, y, w: sized.w, h: sized.h };
      }
      setRect(constrainCrop(next, rot, ratio));
    },
    [rot, boxW, boxH, ratio]
  );

  const endDrag = useCallback(() => {
    dragRef.current = null;
  }, []);

  useEffect(() => {
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', endDrag);
    return () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', endDrag);
    };
  }, [onPointerMove, endDrag]);

  const startDrag = (mode: DragMode) => (e: React.PointerEvent) => {
    if (!rect) return;
    e.preventDefault();
    e.stopPropagation();
    dragRef.current = { mode, startX: e.clientX, startY: e.clientY, start: rect };
  };

  const handleSave = () => {
    if (!rect || !rot) return;
    onSave(
      { ...rect, ratio, rotationAtCrop: deg, imageWidth: rot.width, imageHeight: rot.height },
      slot.legacyWatermarked ? suggested : undefined
    );
  };

  const imgW = natural ? natural.width * scale : 0;
  const imgH = natural ? natural.height * scale : 0;
  const handleCls = 'absolute w-3.5 h-3.5 bg-white border-2 border-teal-500 rounded-sm';

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        {(['4:3', '3:4'] as const).map((r) => (
          <button
            key={r}
            type="button"
            onClick={() => changeRatio(r)}
            className={`px-3 py-1.5 rounded-lg text-xs font-bold border cursor-pointer ${ratio === r ? 'bg-teal-600 text-white border-teal-600' : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'}`}
          >
            {r === '4:3' ? 'Ngang 4:3' : 'Dọc 3:4'}
          </button>
        ))}
        <button
          type="button"
          onClick={() => rot && setRect(defaultCrop(rot, ratio))}
          className="px-3 py-1.5 rounded-lg text-xs font-bold border bg-white text-slate-600 border-slate-200 hover:bg-slate-50 flex items-center gap-1 cursor-pointer"
        >
          <RotateCcw className="w-3.5 h-3.5" /> Khung lớn nhất
        </button>
        <span className="text-[11px] text-slate-500">Ảnh in xoay {deg}° • kéo khung để di chuyển, kéo góc để đổi cỡ</span>
      </div>

      <div className="force-light flex justify-center">
        <div className="relative bg-slate-900 select-none touch-none overflow-hidden" style={{ width: boxW, height: boxH }}>
          <img
            src={slot.url}
            alt=""
            draggable={false}
            onLoad={handleLoad}
            onError={() => console.error('[PhotoQc:CropEditor] Không tải được ảnh', slot.url)}
            className="absolute max-w-none"
            style={natural ? { width: imgW, height: imgH, left: (boxW - imgW) / 2, top: (boxH - imgH) / 2, transform: `rotate(${deg}deg)` } : { opacity: 0, width: 1, height: 1 }}
          />
          {zones && (
            <>
              <div className="absolute border-2 border-dashed border-amber-400 bg-amber-300/20 pointer-events-none" style={{ left: zones.logo.x * boxW, top: zones.logo.y * boxH, width: zones.logo.w * boxW, height: zones.logo.h * boxH }} />
              <div className="absolute border-2 border-dashed border-amber-400 bg-amber-300/20 pointer-events-none" style={{ left: zones.text.x * boxW, top: zones.text.y * boxH, width: zones.text.w * boxW, height: zones.text.h * boxH }} />
            </>
          )}
          {rect && natural && (
            <div
              onPointerDown={startDrag('move')}
              className="absolute border-2 border-teal-400 cursor-move"
              style={{ left: rect.x * boxW, top: rect.y * boxH, width: rect.w * boxW, height: rect.h * boxH, boxShadow: '0 0 0 9999px rgba(2, 6, 23, 0.55)' }}
            >
              <span onPointerDown={startDrag('nw')} className={`${handleCls} -left-2 -top-2 cursor-nwse-resize`} />
              <span onPointerDown={startDrag('ne')} className={`${handleCls} -right-2 -top-2 cursor-nesw-resize`} />
              <span onPointerDown={startDrag('sw')} className={`${handleCls} -left-2 -bottom-2 cursor-nesw-resize`} />
              <span onPointerDown={startDrag('se')} className={`${handleCls} -right-2 -bottom-2 cursor-nwse-resize`} />
            </div>
          )}
          {slot.section === 'CAD' && slot.pins && slot.pins.map((pin) => {
            const pinNormX = pin.pinX / 100;
            const pinNormY = pin.pinY / 100;
            const isCut = cutPins.some((cp) => cp.code === pin.code && cp.pinX === pin.pinX && cp.pinY === pin.pinY);
            return (
              <div
                key={`${pin.code}-${pin.pinX}-${pin.pinY}`}
                className="absolute pointer-events-none transform -translate-x-1/2 -translate-y-full z-10 flex flex-col items-center"
                style={{ left: pinNormX * boxW, top: pinNormY * boxH }}
                title={`${pin.code} (${pin.pinX}%, ${pin.pinY}%)`}
              >
                <span className={`px-1 py-0.5 rounded text-[9px] font-bold font-mono shadow-sm ${
                  isCut ? 'bg-rose-600 text-white border border-rose-300 animate-pulse' : 'bg-indigo-700 text-white border border-indigo-400'
                }`}>
                  {pin.code}
                </span>
                <div className={`w-0 h-0 border-l-[3px] border-l-transparent border-r-[3px] border-r-transparent border-t-[4px] ${
                  isCut ? 'border-t-rose-600' : 'border-t-indigo-700'
                }`} />
              </div>
            );
          })}
        </div>
      </div>

      {cutPins.length > 0 && (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-2.5 text-xs text-rose-800 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0 text-rose-600" />
          <span>
            Khung crop đang cắt qua <strong>{cutPins.length}</strong> điểm ghim ({cutPins.map((p) => p.code).join(', ')}). Vui lòng kéo rộng khung để bao trọn toàn bộ điểm ghim trên mặt bằng.
          </span>
        </div>
      )}

      {slot.legacyWatermarked && !hideRestamp && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-3">
          <p className="text-xs text-amber-900">
            Ảnh này đã có watermark cháy sẵn (vùng viền vàng là ước lượng). Khi xuất report, máy chủ tự dập lại phần dấu bị khung cắt bỏ. Theo khung hiện tại: <strong>{RESTAMP_LABEL[suggested]}</strong>.
          </p>
        </div>
      )}

      <div className="flex justify-end gap-2">
        <button type="button" onClick={onCancel} className="px-4 py-2 rounded-xl text-xs font-bold border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 cursor-pointer">
          Huỷ
        </button>
        <button
          type="button"
          onClick={handleSave}
          disabled={!rect || !rot || saving || (blockCutPins && cutPins.length > 0)}
          className="px-4 py-2 rounded-xl text-xs font-bold bg-teal-600 text-white hover:bg-teal-700 flex items-center gap-1.5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Crop className="w-4 h-4" /> {saving ? 'Đang lưu…' : saveLabel}
        </button>
      </div>
    </div>
  );
};
