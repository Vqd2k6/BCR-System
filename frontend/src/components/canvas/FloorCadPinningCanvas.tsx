import React, { useState, useRef } from 'react';
import { MapPin, Plus, Trash2, Crosshair, AlertCircle, Layers, CheckCircle2, Sparkles, Eye, EyeOff, Camera, RefreshCw } from 'lucide-react';
import { PhotoCaptureInput } from '../common/PhotoCaptureInput';

export interface CadZonePin {
  id: string;
  zoneCode: string; // Z-01 hoặc E-01
  pinX: number; // 0 to 100%
  pinY: number; // 0 to 100%
  label?: string;
  type?: 'ZONE' | 'STRUCTURAL';
}

/**
 * Thuật toán tự bù số thứ tự nhỏ nhất còn trống cho mã ghim (Z-xx, E-xx, D-xx)
 */
export function getNextAvailablePinCode(pins: { zoneCode?: string }[], prefix: string): string {
  const usedNumbers = new Set<number>();
  const regex = new RegExp(`^${prefix}-(\\d+)`, 'i');
  for (const p of pins) {
    if (p.zoneCode) {
      const match = p.zoneCode.match(regex);
      if (match) {
        usedNumbers.add(parseInt(match[1], 10));
      }
    }
  }
  let num = 1;
  while (usedNumbers.has(num)) {
    num++;
  }
  return `${prefix}-${String(num).padStart(2, '0')}`;
}

interface Props {
  cadPhotoUrl: string;
  onCadPhotoChange: (url: string) => void;
  pins: CadZonePin[];
  onChangePins: (pins: CadZonePin[]) => void;
  onAutoCreatePin?: (pin: CadZonePin) => void;
  onDeletePin?: (pin: CadZonePin, index: number) => void;
  onRenamePin?: (oldCode: string, newCode: string, updatedPin: CadZonePin) => void;
  onSelectPin?: (pin: CadZonePin, index: number) => void;
  mode?: 'ZONE' | 'STRUCTURAL';
  floorName?: string;
  parcelCode?: string;
  cadTitle?: string;
  readOnly?: boolean;
}

export const FloorCadPinningCanvas: React.FC<Props> = ({
  cadPhotoUrl,
  onCadPhotoChange,
  pins = [],
  onChangePins,
  onAutoCreatePin,
  onDeletePin,
  onRenamePin,
  onSelectPin,
  mode = 'ZONE',
  floorName = 'Tầng',
  parcelCode,
  cadTitle,
  readOnly = false,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [selectedPinIndex, setSelectedPinIndex] = useState<number | null>(null);
  const [isAddingPin, setIsAddingPin] = useState<boolean>(true); // Default to pin mode for quick marking
  const [showPins, setShowPins] = useState<boolean>(true); // Toggle eye visibility
  const [draggingPinIndex, setDraggingPinIndex] = useState<number | null>(null);
  const dragMovedRef = useRef<boolean>(false);

  const isStructural = mode === 'STRUCTURAL';
  const prefix = isStructural ? 'E' : 'Z';
  const modeLabel = isStructural ? 'Vùng Kết Cấu (E)' : 'Vùng Kiến Trúc (Z)';
  const defaultCadTitle = isStructural
    ? `Sơ đồ mặt bằng kết cấu CAD_02 (${floorName})`
    : `Sơ đồ mặt bằng kiến trúc CAD_01 (${floorName})`;

  // Tự động tìm số thứ tự nhỏ nhất còn trống
  const nextCode = getNextAvailablePinCode(pins, prefix);

  const handleContainerPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (draggingPinIndex === null || readOnly || !containerRef.current) return;
    dragMovedRef.current = true;
    const rect = containerRef.current.getBoundingClientRect();
    const x = Math.max(1, Math.min(99, parseFloat((((e.clientX - rect.left) / rect.width) * 100).toFixed(2))));
    const y = Math.max(1, Math.min(99, parseFloat((((e.clientY - rect.top) / rect.height) * 100).toFixed(2))));

    const updated = [...pins];
    if (updated[draggingPinIndex]) {
      updated[draggingPinIndex] = {
        ...updated[draggingPinIndex],
        pinX: x,
        pinY: y,
      };
      onChangePins(updated);
    }
  };

  const handleContainerClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (dragMovedRef.current) {
      dragMovedRef.current = false;
      return;
    }
    if (readOnly || !isAddingPin || !containerRef.current || !cadPhotoUrl) return;

    const rect = containerRef.current.getBoundingClientRect();
    const x = parseFloat((((e.clientX - rect.left) / rect.width) * 100).toFixed(2));
    const y = parseFloat((((e.clientY - rect.top) / rect.height) * 100).toFixed(2));

    const newPinCode = getNextAvailablePinCode(pins, prefix);
    const newPin: CadZonePin = {
      id: `pin-${prefix.toLowerCase()}-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      zoneCode: newPinCode,
      pinX: x,
      pinY: y,
      label: newPinCode,
      type: mode,
    };

    const updated = [...pins, newPin];
    onChangePins(updated);
    setSelectedPinIndex(updated.length - 1);

    if (onAutoCreatePin) {
      onAutoCreatePin(newPin);
    }
    if (onSelectPin) {
      onSelectPin(newPin, updated.length - 1);
    }
  };

  const removePin = (index: number) => {
    if (readOnly) return;
    const pinToRemove = pins[index];
    const updated = pins.filter((_, i) => i !== index);
    onChangePins(updated);

    if (onDeletePin && pinToRemove) {
      onDeletePin(pinToRemove, index);
    }
    setSelectedPinIndex(null);
  };

  const updateSelectedPin = (field: keyof CadZonePin, value: any) => {
    if (selectedPinIndex === null || readOnly) return;
    const prevPin = pins[selectedPinIndex];
    const updated = [...pins];
    const updatedPin = { ...prevPin, [field]: value };
    updated[selectedPinIndex] = updatedPin;
    onChangePins(updated);

    if (field === 'zoneCode' && onRenamePin && prevPin.zoneCode !== value) {
      onRenamePin(prevPin.zoneCode, value, updatedPin);
    }
  };

  const selectedPin =
    selectedPinIndex !== null && selectedPinIndex >= 0 && selectedPinIndex < pins.length
      ? pins[selectedPinIndex]
      : null;

  const handleDeleteOrRetakeCadPhoto = (isRetake: boolean = false) => {
    if (readOnly) return;
    const pinCount = pins.length;
    const actionText = isRetake ? 'chụp lại hoặc đổi sơ đồ CAD' : 'xóa ảnh sơ đồ CAD';
    const confirmMsg = pinCount > 0
      ? `Bạn có chắc muốn ${actionText} cho ${floorName} không?\n\n• Lưu ý: ${pinCount} điểm ghim (${prefix}) đã đánh dấu vẫn được bảo lưu tọa độ để khớp với sơ đồ mới.\n• Bấm OK để tiếp tục.`
      : `Bạn có chắc muốn ${actionText} cho ${floorName} không?`;

    if (window.confirm(confirmMsg)) {
      onCadPhotoChange('');
    }
  };

  return (
    <div className="flex flex-col gap-3 w-full bg-white">
      {/* Upload/Capture CAD Sketch */}
      {!cadPhotoUrl ? (
        <PhotoCaptureInput
          label={cadTitle || defaultCadTitle}
          value={cadPhotoUrl}
          onChange={onCadPhotoChange}
          watermarkOptions={{
            parcelCode,
            floor: floorName,
            photoType: isStructural ? 'CAD_STRUCT' : 'CAD_ARCH',
            photoIndex: 1,
          }}
          height="160px"
        />
      ) : (
        <div className="flex flex-col gap-2.5">
          {/* Top Control Bar with Quick Pinning Guides */}
          <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 bg-slate-50 rounded-xl border border-slate-200 text-xs">
            <div className="flex items-center gap-2">
              <span className={`px-2.5 py-1 rounded-lg font-mono font-extrabold text-xs ${
                isStructural ? 'bg-amber-100 text-amber-900 border border-amber-300' : 'bg-emerald-100 text-emerald-900 border border-emerald-300'
              }`}>
                {modeLabel}
              </span>
              <span className="text-slate-600 font-medium">
                Đã đánh dấu: <strong className="text-slate-900 font-bold">{pins.length} vị trí</strong>
              </span>
            </div>

            {!readOnly && (
              <div className="flex items-center gap-1.5 ml-auto flex-wrap">
                {/* Delete button appears next to add pin button when a pin is selected */}
                {selectedPin !== null && selectedPinIndex !== null && (
                  <button
                    type="button"
                    onClick={() => removePin(selectedPinIndex)}
                    className="px-2.5 py-1.5 bg-red-50 text-red-700 border border-red-200 hover:bg-red-100 rounded-lg font-bold flex items-center gap-1 transition-all"
                    title={`Xóa điểm ${selectedPin.zoneCode}`}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    <span>Xóa {selectedPin.zoneCode}</span>
                  </button>
                )}

                {/* Eye toggle button */}
                <button
                  type="button"
                  onClick={() => setShowPins(!showPins)}
                  className={`px-2.5 py-1.5 rounded-lg font-bold text-xs flex items-center gap-1.5 transition-all border ${
                    showPins
                      ? 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                      : 'bg-amber-100 text-amber-800 border-amber-300 ring-2 ring-amber-400'
                  }`}
                  title={showPins ? "Bấm để ẩn ghim xem bản vẽ CAD rõ hơn" : "Bấm để hiển thị lại các ghim"}
                >
                  {showPins ? <Eye className="w-3.5 h-3.5 text-slate-500" /> : <EyeOff className="w-3.5 h-3.5 text-amber-700" />}
                  <span>{showPins ? 'Ẩn ghim' : 'Hiện ghim'}</span>
                </button>

                {/* Retake/Change CAD sketch button */}
                <button
                  type="button"
                  onClick={() => handleDeleteOrRetakeCadPhoto(true)}
                  className="px-2.5 py-1.5 rounded-lg font-bold text-xs flex items-center gap-1.5 transition-all border bg-white text-slate-700 border-slate-300 hover:bg-blue-50 hover:text-blue-700 hover:border-blue-300"
                  title="Chụp lại hoặc chọn ảnh sơ đồ CAD khác (giữ nguyên tọa độ các điểm ghim)"
                >
                  <Camera className="w-3.5 h-3.5 text-blue-600" />
                  <span className="hidden sm:inline">Đổi sơ đồ</span>
                </button>

                {/* Delete CAD sketch button */}
                <button
                  type="button"
                  onClick={() => handleDeleteOrRetakeCadPhoto(false)}
                  className="px-2.5 py-1.5 rounded-lg font-bold text-xs flex items-center gap-1.5 transition-all border bg-white text-red-600 border-red-200 hover:bg-red-50 hover:border-red-300"
                  title="Xóa ảnh sơ đồ CAD này để tải lại"
                >
                  <Trash2 className="w-3.5 h-3.5 text-red-500" />
                  <span className="hidden sm:inline">Xóa sơ đồ</span>
                </button>

                <button
                  type="button"
                  onClick={() => setIsAddingPin(!isAddingPin)}
                  className={`px-3 py-1.5 rounded-lg font-bold text-xs flex items-center gap-1.5 transition-all shadow-xs ${
                    isAddingPin
                      ? isStructural
                        ? 'bg-amber-600 text-white ring-2 ring-amber-400'
                        : 'bg-emerald-600 text-white ring-2 ring-emerald-400'
                      : 'bg-white text-slate-700 border border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  <Crosshair className="w-3.5 h-3.5" />
                  <span>
                    {isAddingPin ? `Đang bật chạm chấm ${nextCode}` : `Bật chạm chấm ${nextCode}`}
                  </span>
                </button>
              </div>
            )}
          </div>

          {/* Quick instructions alert */}
          {!readOnly && isAddingPin && (
            <div className="p-2 bg-emerald-50/80 border border-emerald-200 rounded-lg text-xs text-emerald-900 flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>
                <strong>Chạm trực tiếp lên sơ đồ CAD:</strong> Mỗi lần chạm sẽ tự động tăng mã (<strong>{nextCode}</strong>) và tự sinh Vùng khảo sát mới ngoài danh sách.
              </span>
            </div>
          )}

          {/* Interactive CAD Canvas - Clean Light Theme */}
          <div
            ref={containerRef}
            onClick={handleContainerClick}
            onPointerMove={handleContainerPointerMove}
            onPointerUp={() => setDraggingPinIndex(null)}
            className={`relative w-full min-h-[320px] max-h-[520px] rounded-xl overflow-hidden bg-slate-100 border border-slate-300 select-none shadow-inner touch-none ${
              isAddingPin ? 'cursor-crosshair ring-2 ring-emerald-500/30' : 'cursor-default'
            }`}
          >
            {/* Quick floating actions on top-right of canvas */}
            {!readOnly && (
              <div
                className="absolute top-2.5 right-2.5 flex items-center gap-1.5 z-40 bg-slate-900/80 backdrop-blur-xs p-1 rounded-lg border border-white/20 shadow-md"
                onClick={(e) => e.stopPropagation()}
              >
                <button
                  type="button"
                  onClick={() => handleDeleteOrRetakeCadPhoto(true)}
                  className="px-2 py-1 bg-white/10 hover:bg-white/20 text-white rounded text-[11px] font-medium flex items-center gap-1 transition-all"
                  title="Đổi hoặc chụp lại sơ đồ CAD"
                >
                  <Camera className="w-3 h-3 text-blue-300" />
                  <span>Đổi ảnh</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleDeleteOrRetakeCadPhoto(false)}
                  className="px-2 py-1 bg-red-600/70 hover:bg-red-600 text-white rounded text-[11px] font-medium flex items-center gap-1 transition-all"
                  title="Xóa ảnh sơ đồ CAD này"
                >
                  <Trash2 className="w-3 h-3 text-red-200" />
                  <span>Xóa ảnh</span>
                </button>
              </div>
            )}

            <img
              src={cadPhotoUrl}
              alt={`CAD Plan ${floorName}`}
              className="w-full h-full object-contain block max-h-[520px] mx-auto pointer-events-none select-none"
            />

            {/* Render Pins with Drag & Drop support */}
            {showPins && pins.map((pin, idx) => {
              if (!pin) return null;
              const isSelected = selectedPinIndex === idx;
              const isDragging = draggingPinIndex === idx;

              return (
                <div
                  key={pin.id || idx}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (!dragMovedRef.current) {
                      setSelectedPinIndex(idx);
                    }
                  }}
                  onPointerDown={(e) => {
                    if (readOnly) return;
                    e.stopPropagation();
                    dragMovedRef.current = false;
                    setDraggingPinIndex(idx);
                    setSelectedPinIndex(idx);
                    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
                  }}
                  onPointerUp={(e) => {
                    if (readOnly) return;
                    e.stopPropagation();
                    try {
                      (e.currentTarget as HTMLElement).releasePointerCapture?.(e.pointerId);
                    } catch (_) {}
                    setDraggingPinIndex(null);
                  }}
                  style={{
                    position: 'absolute',
                    top: `${pin.pinY}%`,
                    left: `${pin.pinX}%`,
                    transform: isDragging
                      ? 'translate(-50%, -100%) scale(1.2)'
                      : isSelected
                      ? 'translate(-50%, -100%) scale(1.05)'
                      : 'translate(-50%, -100%)',
                    cursor: readOnly ? 'default' : isDragging ? 'grabbing' : 'grab',
                    zIndex: isDragging ? 50 : isSelected ? 35 : 20,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    touchAction: 'none',
                    userSelect: 'none',
                    transition: isDragging ? 'none' : 'transform 0.15s ease',
                  }}
                  title={readOnly ? undefined : "Chạm chọn hoặc Giữ & Kéo để di chuyển ghim"}
                >
                  {/* Pin Tag Box */}
                  <div
                    className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-extrabold whitespace-nowrap shadow-md transition-all ${
                      isDragging
                        ? 'bg-sky-600 text-white ring-3 ring-sky-300 shadow-xl'
                        : isSelected
                        ? isStructural
                          ? 'bg-amber-600 text-white ring-2 ring-amber-300'
                          : 'bg-emerald-600 text-white ring-2 ring-emerald-300'
                        : isStructural
                        ? 'bg-amber-700 text-white'
                        : 'bg-slate-800 text-white'
                    }`}
                  >
                    {pin.zoneCode || `${prefix}-${idx + 1}`}
                  </div>

                  {/* Pin Point Square Badge */}
                  <div
                    className={`w-3.5 h-3.5 rounded-xs mt-0.5 border-2 border-white shadow-md ${
                      isDragging
                        ? 'bg-sky-400 scale-125'
                        : isSelected
                        ? isStructural
                          ? 'bg-amber-400'
                          : 'bg-emerald-400'
                        : isStructural
                        ? 'bg-amber-600'
                        : 'bg-emerald-600'
                    }`}
                  />
                </div>
              );
            })}
          </div>

          {/* Selected Pin Details Box */}
          {selectedPin && selectedPinIndex !== null && (
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex flex-wrap items-center justify-between gap-2 text-xs">
              <div className="flex items-center gap-2 flex-wrap">
                <div className="flex items-center gap-1.5">
                  <span className="text-[11px] font-bold text-slate-500">Mã:</span>
                  <input
                    type="text"
                    className={`px-2 py-0.5 font-mono font-bold text-xs rounded border w-24 uppercase focus:ring-1 focus:ring-emerald-500 ${
                      isStructural ? 'bg-amber-50 text-amber-900 border-amber-300' : 'bg-emerald-50 text-emerald-900 border-emerald-300'
                    }`}
                    value={selectedPin.zoneCode || ''}
                    onChange={(e) => updateSelectedPin('zoneCode', e.target.value.toUpperCase())}
                    disabled={readOnly}
                    title="Đổi mã ghim (tự động đồng bộ với danh sách vùng)"
                  />
                </div>

                <input
                  type="text"
                  placeholder="Ghi chú vị trí (VD: Mảng tường trái, Cột C1)..."
                  className="px-2.5 py-1 bg-white border border-slate-300 rounded-lg text-xs w-64 focus:ring-1 focus:ring-emerald-500"
                  value={selectedPin.label || ''}
                  onChange={(e) => updateSelectedPin('label', e.target.value)}
                  disabled={readOnly}
                />
              </div>

              {!readOnly && (
                <button
                  type="button"
                  onClick={() => removePin(selectedPinIndex)}
                  className="px-2.5 py-1 bg-red-50 text-red-700 border border-red-200 hover:bg-red-100 rounded-lg font-medium flex items-center gap-1"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Xóa ghim này</span>
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
