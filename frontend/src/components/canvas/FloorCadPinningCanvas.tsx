import React, { useState, useRef } from 'react';
import { MapPin, Plus, Trash2, Crosshair, AlertCircle, Layers, CheckCircle2, Sparkles, Eye, EyeOff } from 'lucide-react';
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

  const isStructural = mode === 'STRUCTURAL';
  const prefix = isStructural ? 'E' : 'Z';
  const modeLabel = isStructural ? 'Vùng Kết Cấu (E)' : 'Vùng Kiến Trúc (Z)';
  const defaultCadTitle = isStructural
    ? `Sơ đồ mặt bằng kết cấu CAD_02 (${floorName})`
    : `Sơ đồ mặt bằng kiến trúc CAD_01 (${floorName})`;

  // Tự động tìm số thứ tự nhỏ nhất còn trống
  const nextCode = getNextAvailablePinCode(pins, prefix);

  const handleContainerClick = (e: React.MouseEvent<HTMLDivElement>) => {
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
              <div className="flex items-center gap-2 ml-auto">
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
            className={`relative w-full min-h-[320px] max-h-[520px] rounded-xl overflow-hidden bg-slate-100 border border-slate-300 select-none shadow-inner ${
              isAddingPin ? 'cursor-crosshair ring-2 ring-emerald-500/30' : 'cursor-default'
            }`}
          >
            <img
              src={cadPhotoUrl}
              alt={`CAD Plan ${floorName}`}
              className="w-full h-full object-contain block max-h-[520px] mx-auto"
            />

            {/* Render Pins */}
            {showPins && pins.map((pin, idx) => {
              if (!pin) return null;
              const isSelected = selectedPinIndex === idx;

              return (
                <div
                  key={pin.id || idx}
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedPinIndex(idx);
                  }}
                  style={{
                    position: 'absolute',
                    top: `${pin.pinY}%`,
                    left: `${pin.pinX}%`,
                    transform: 'translate(-50%, -100%)',
                    cursor: 'pointer',
                    zIndex: isSelected ? 35 : 20,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                  }}
                >
                  {/* Pin Tag Box */}
                  <div
                    className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-extrabold whitespace-nowrap shadow-md transition-all ${
                      isSelected
                        ? isStructural
                          ? 'bg-amber-600 text-white ring-2 ring-amber-300 scale-110'
                          : 'bg-emerald-600 text-white ring-2 ring-emerald-300 scale-110'
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
                      isSelected
                        ? isStructural
                          ? 'bg-amber-400 scale-110'
                          : 'bg-emerald-400 scale-110'
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
