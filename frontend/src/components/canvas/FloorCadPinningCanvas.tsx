import React, { useState, useRef } from 'react';
import { MapPin, Plus, Trash2, Crosshair, AlertCircle, Layers, CheckCircle2, Sparkles } from 'lucide-react';
import { PhotoCaptureInput } from '../common/PhotoCaptureInput';

export interface CadZonePin {
  id: string;
  zoneCode: string; // Z-01 hoặc E-01
  pinX: number; // 0 to 100%
  pinY: number; // 0 to 100%
  label?: string;
  type?: 'ZONE' | 'STRUCTURAL';
}

interface Props {
  cadPhotoUrl: string;
  onCadPhotoChange: (url: string) => void;
  pins: CadZonePin[];
  onChangePins: (pins: CadZonePin[]) => void;
  onAutoCreatePin?: (pin: CadZonePin) => void;
  onDeletePin?: (pinId: string, index: number) => void;
  onSelectPin?: (pin: CadZonePin, index: number) => void;
  mode?: 'ZONE' | 'STRUCTURAL';
  floorName?: string;
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
  onSelectPin,
  mode = 'ZONE',
  floorName = 'Tầng',
  cadTitle,
  readOnly = false,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [selectedPinIndex, setSelectedPinIndex] = useState<number | null>(null);
  const [isAddingPin, setIsAddingPin] = useState<boolean>(true); // Default to pin mode for quick marking

  const isStructural = mode === 'STRUCTURAL';
  const prefix = isStructural ? 'E' : 'Z';
  const modeLabel = isStructural ? 'Vùng Kết Cấu (E)' : 'Vùng Kiến Trúc (Z)';
  const defaultCadTitle = isStructural
    ? `Sơ đồ mặt bằng kết cấu CAD_02 (${floorName})`
    : `Sơ đồ mặt bằng kiến trúc CAD_01 (${floorName})`;

  const nextIndex = pins.length + 1;
  const nextCode = `${prefix}-${String(nextIndex).padStart(2, '0')}`;

  const handleContainerClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (readOnly || !isAddingPin || !containerRef.current || !cadPhotoUrl) return;

    const rect = containerRef.current.getBoundingClientRect();
    const x = parseFloat((((e.clientX - rect.left) / rect.width) * 100).toFixed(2));
    const y = parseFloat((((e.clientY - rect.top) / rect.height) * 100).toFixed(2));

    const newPinCode = `${prefix}-${String(pins.length + 1).padStart(2, '0')}`;
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
      onDeletePin(pinToRemove.id, index);
    }
    setSelectedPinIndex(null);
  };

  const updateSelectedPin = (field: keyof CadZonePin, value: any) => {
    if (selectedPinIndex === null || readOnly) return;
    const updated = [...pins];
    updated[selectedPinIndex] = { ...updated[selectedPinIndex], [field]: value };
    onChangePins(updated);
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
          watermarkText={`CAD-${prefix} | ${floorName}`}
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
            {pins.map((pin, idx) => {
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
                <span className={`px-2 py-0.5 rounded font-mono font-bold ${
                  isStructural ? 'bg-amber-100 text-amber-900 border border-amber-200' : 'bg-emerald-100 text-emerald-900 border border-emerald-200'
                }`}>
                  Ghim: {selectedPin.zoneCode || `${prefix}-${selectedPinIndex + 1}`}
                </span>

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
