import React, { useState, useRef } from 'react';
import { MapPin, Plus, Trash2, Crosshair, AlertCircle, Layers, CheckCircle2, Sparkles, Eye, EyeOff, Camera, RefreshCw, ZoomIn } from 'lucide-react';
import { PhotoCaptureInput } from '../common/PhotoCaptureInput';
import { ImageZoomModal } from '../common/ImageZoomModal';
import { resolveOfflinePhotoUrl, getSafeDisplayUrl } from '../../core/storage/offlinePhotoStorage';

import { useInteractiveCanvasZoom } from './useInteractiveCanvasZoom';
import { CanvasZoomToolbar } from './CanvasZoomToolbar';

export interface CadZonePin {
  id?: string;
  zoneCode: string; // Z-01 hoặc E-01
  zone_code?: string;
  pinCode?: string;
  pinNumber?: number;
  pinX: number; // 0 to 100%
  pin_x?: number;
  pinY: number; // 0 to 100%
  pin_y?: number;
  x?: number;
  y?: number;
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
  const [selectedPinIndex, setSelectedPinIndex] = useState<number | null>(null);
  const [isAddingPin, setIsAddingPin] = useState<boolean>(true); // Default to pin mode for quick marking
  const [showPins, setShowPins] = useState<boolean>(true); // Toggle eye visibility
  const [draggingPinIndex, setDraggingPinIndex] = useState<number | null>(null);
  const [safeCadUrl, setSafeCadUrl] = useState<string>(() => getSafeDisplayUrl(cadPhotoUrl));
  const [isZoomOpen, setIsZoomOpen] = useState(false);
  const [isImageLoaded, setIsImageLoaded] = useState(false);
  const dragMovedRef = useRef<boolean>(false);

  // Hook Zoom & Pan Tương tác Bất biến Tọa độ
  const {
    zoomScale,
    containerRef,
    tightBoxRef,
    handleZoomIn,
    handleZoomOut,
    handleResetZoom,
    handleSetZoomPreset,
    handleWheel,
    handleTouchStart,
    handleTouchMove,
    handleTouchEnd,
    startPan,
    updatePan,
    endPan,
    calculateNormalizedCoords,
    transformStyle,
    pinCounterScale,
  } = useInteractiveCanvasZoom();

  React.useEffect(() => {
    let isSubscribed = true;
    if (cadPhotoUrl) {
      const immediate = getSafeDisplayUrl(cadPhotoUrl);
      if (immediate && isSubscribed) setSafeCadUrl(immediate);
      resolveOfflinePhotoUrl(cadPhotoUrl).then((resolved) => {
        if (isSubscribed && resolved) setSafeCadUrl(resolved);
      });
    } else {
      setSafeCadUrl('');
    }
    return () => {
      isSubscribed = false;
    };
  }, [cadPhotoUrl]);

  const isStructural = mode === 'STRUCTURAL';
  const prefix = isStructural ? 'E' : 'Z';
  const modeLabel = isStructural ? 'Vùng Kết Cấu (E)' : 'Vùng Kiến Trúc (Z)';
  const defaultCadTitle = isStructural
    ? `Sơ đồ mặt bằng kết cấu CAD_02 (${floorName})`
    : `Sơ đồ mặt bằng kiến trúc CAD_01 (${floorName})`;

  // Tự động tìm số thứ tự nhỏ nhất còn trống
  const nextCode = getNextAvailablePinCode(pins, prefix);

  const handleTightBoxPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (draggingPinIndex !== null && !readOnly) {
      dragMovedRef.current = true;
      const coords = calculateNormalizedCoords(e.clientX, e.clientY);
      if (!coords) return;

      const updated = [...pins];
      if (updated[draggingPinIndex]) {
        updated[draggingPinIndex] = {
          ...updated[draggingPinIndex],
          pinX: coords.x,
          pinY: coords.y,
        };
        onChangePins(updated);
      }
      return;
    }

    // Nếu không kéo pin và không ở chế độ thêm ghim -> hỗ trợ kéo rê (Pan) ảnh
    if (!isAddingPin) {
      updatePan(e.clientX, e.clientY);
    }
  };

  const handleTightBoxPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isAddingPin && draggingPinIndex === null) {
      startPan(e.clientX, e.clientY);
    }
  };

  const handleTightBoxPointerUp = () => {
    setDraggingPinIndex(null);
    endPan();
  };

  const handleTightBoxClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (dragMovedRef.current) {
      dragMovedRef.current = false;
      return;
    }
    if (readOnly || !isAddingPin || !cadPhotoUrl) return;

    const coords = calculateNormalizedCoords(e.clientX, e.clientY);
    if (!coords) return;

    const newPinCode = getNextAvailablePinCode(pins, prefix);
    const newPin: CadZonePin = {
      id: `pin-${prefix.toLowerCase()}-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
      zoneCode: newPinCode,
      pinX: coords.x,
      pinY: coords.y,
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

  const updateSelectedPin = <K extends keyof CadZonePin>(field: K, value: CadZonePin[K]) => {
    if (selectedPinIndex === null || readOnly) return;
    const prevPin = pins[selectedPinIndex];
    const updated = [...pins];
    const updatedPin = { ...prevPin, [field]: value };
    updated[selectedPinIndex] = updatedPin;
    onChangePins(updated);

    if (field === 'zoneCode' && onRenamePin && prevPin.zoneCode !== value && typeof value === 'string') {
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
          allowPdf={true}
          pdfFloorName={floorName}
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
            onWheel={handleWheel}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            className={`relative w-full min-h-[320px] max-h-[560px] rounded-xl overflow-hidden bg-slate-100 border border-slate-300 select-none shadow-inner flex items-center justify-center p-1 sm:p-2 ${
              isAddingPin ? 'ring-2 ring-emerald-500/30' : ''
            }`}
          >
            {/* Quick floating actions on top-right of canvas */}
            <div
              className="absolute top-2.5 right-2.5 flex items-center gap-1.5 z-40 bg-slate-900/80 backdrop-blur-xs p-1 rounded-lg border border-white/20 shadow-md"
              onClick={(e) => e.stopPropagation()}
            >
              <button
                type="button"
                onClick={() => setIsZoomOpen(true)}
                className="px-2 py-1 bg-white/10 hover:bg-white/20 text-white rounded text-[11px] font-medium flex items-center gap-1 transition-all"
                title="Phóng to sơ đồ CAD mặt bằng"
              >
                <ZoomIn className="w-3 h-3 text-emerald-300" />
                <span>Phóng to CAD</span>
              </button>
              {!readOnly && (
                <>
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
                </>
              )}
            </div>

            {(safeCadUrl || getSafeDisplayUrl(cadPhotoUrl)) ? (
              <div
                ref={tightBoxRef}
                onClick={handleTightBoxClick}
                onPointerDown={handleTightBoxPointerDown}
                onPointerMove={handleTightBoxPointerMove}
                onPointerUp={handleTightBoxPointerUp}
                style={transformStyle}
                className={`relative inline-block max-w-full leading-none mx-auto select-none touch-none ${
                  isAddingPin ? 'cursor-crosshair' : 'cursor-grab'
                }`}
              >
                <img
                  src={safeCadUrl || getSafeDisplayUrl(cadPhotoUrl)}
                  alt={`CAD Plan ${floorName}`}
                  onLoad={() => setIsImageLoaded(true)}
                  className="max-w-full max-h-[520px] w-auto h-auto block mx-auto pointer-events-none select-none shadow-sm"
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
                          ? `translate(-50%, -100%) scale(${(1.2 * pinCounterScale).toFixed(3)})`
                          : isSelected
                          ? `translate(-50%, -100%) scale(${(1.05 * pinCounterScale).toFixed(3)})`
                          : `translate(-50%, -100%) scale(${pinCounterScale.toFixed(3)})`,
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
            ) : (
              <div className="w-full min-h-[320px] flex items-center justify-center text-slate-400 text-xs">
                Đang nạp sơ đồ CAD...
              </div>
            )}

            {/* Bottom-left Interactive Zoom & Pan Toolbar */}
            {Boolean(safeCadUrl || cadPhotoUrl) && (
              <CanvasZoomToolbar
                zoomScale={zoomScale}
                onZoomIn={handleZoomIn}
                onZoomOut={handleZoomOut}
                onResetZoom={handleResetZoom}
                onSelectPreset={handleSetZoomPreset}
                isPinMode={isAddingPin}
                onTogglePinMode={() => setIsAddingPin(!isAddingPin)}
                pinModeLabel="Chấm ghim"
              />
            )}
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

      {isZoomOpen && (
        <ImageZoomModal
          isOpen={isZoomOpen}
          imageUrl={safeCadUrl || cadPhotoUrl}
          title={`Sơ đồ CAD mặt bằng ${floorName}`}
          onClose={() => setIsZoomOpen(false)}
        />
      )}
    </div>
  );
};
