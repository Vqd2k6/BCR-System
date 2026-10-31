import React, { useState } from 'react';
import { Crosshair, Eye, EyeOff, Maximize2, RotateCw, Undo2 } from 'lucide-react';
import { AuditPinBoard, type AuditBoardPin } from '../../stepwise/ui/AuditPinBoard';
import type { CondoCadBoard } from './useCondoCadPins';
import { getCadPinPosition } from './useCondoCadPins';

interface CondoCadPinSectionProps {
  board: CondoCadBoard;
  tone: 'zone' | 'element';
  title: string;
  /** Mã Z/E còn hiệu lực: ghim của mục đã xóa mềm được ẩn, khôi phục mục thì ghim hiện lại. */
  activeCodes: string[];
  isEditMode: boolean;
  canUndo: boolean;
  onUndo: () => void;
  onAddAt: (x: number, y: number) => void;
  onSelectPin: (code: string) => void;
  onOpenPhotoZoom: (url: string, title?: string, photoCode?: string, rotation?: number) => void;
}

const TOOL_BUTTON_CLASS =
  'px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 text-xs font-bold flex items-center gap-1 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed';

/** Bản vẽ CAD của mục Z hoặc E: thanh công cụ như Nhà dân và lớp ghim. */
export const CondoCadPinSection: React.FC<CondoCadPinSectionProps> = ({
  board,
  tone,
  title,
  activeCodes,
  isEditMode,
  canUndo,
  onUndo,
  onAddAt,
  onSelectPin,
  onOpenPhotoZoom,
}) => {
  const [showPins, setShowPins] = useState(true);
  const [isPinning, setIsPinning] = useState(false);
  const [selectedCode, setSelectedCode] = useState<string | null>(null);

  const pins: AuditBoardPin[] = board.pins.flatMap((pin) => {
    const code = String(pin.zoneCode || pin.zone_code || '');
    const position = getCadPinPosition(pin);
    return position && activeCodes.includes(code) ? [{ code, ...position }] : [];
  });

  if (!board.url) {
    return (
      <div className="p-4 rounded-xl border border-dashed border-slate-300 text-xs text-slate-500 text-center">
        Chưa có bản vẽ CAD để hiển thị điểm ghim.
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3 space-y-2.5">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <span className="text-[11px] font-bold text-slate-700">
          {title}: {pins.length}/{activeCodes.length} đã ghim
        </span>
        <div className="flex items-center gap-2 flex-wrap">
          <button type="button" onClick={() => setShowPins(!showPins)} className={TOOL_BUTTON_CLASS}>
            {showPins ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5 text-amber-600" />}
            <span>{showPins ? 'Ẩn Ghim CAD' : 'Hiện Ghim CAD'}</span>
          </button>
          <button
            type="button"
            onClick={() => onOpenPhotoZoom(board.url, title, `CAD_${tone === 'zone' ? 'Z' : 'E'}`, board.rotation)}
            className={TOOL_BUTTON_CLASS}
          >
            <Maximize2 className="w-3.5 h-3.5" />
            <span>Phóng to</span>
          </button>
          {isEditMode && (
            <>
              <button type="button" onClick={board.rotateCad} className={TOOL_BUTTON_CLASS}>
                <RotateCw className="w-3.5 h-3.5" />
                <span>Xoay 90°</span>
              </button>
              <button type="button" disabled={!canUndo} onClick={onUndo} className={TOOL_BUTTON_CLASS}>
                <Undo2 className="w-3.5 h-3.5" />
                <span>Hoàn tác</span>
              </button>
              <button
                type="button"
                onClick={() => setIsPinning(!isPinning)}
                className={`px-2.5 py-1 rounded-lg text-xs font-bold flex items-center gap-1 cursor-pointer ${
                  isPinning ? 'bg-rose-600 text-white animate-pulse' : 'bg-sky-600 hover:bg-sky-700 text-white'
                }`}
              >
                <Crosshair className="w-3.5 h-3.5" />
                <span>{isPinning ? 'Đang ghim... Bấm lên CAD' : `Ghim ${tone === 'zone' ? 'Z' : 'E'} mới`}</span>
              </button>
            </>
          )}
        </div>
      </div>

      <AuditPinBoard
        url={board.url}
        alt={title}
        rotation={board.rotation}
        pins={pins}
        tone={tone}
        isEditMode={isEditMode}
        showPins={showPins}
        isPinning={isPinning}
        selectedCode={selectedCode}
        onAddAt={(x, y) => {
          setIsPinning(false);
          onAddAt(x, y);
        }}
        onMove={board.moveCadPin}
        onSelectPin={(code) => {
          setSelectedCode(code);
          onSelectPin(code);
        }}
      />
    </div>
  );
};
