import React, { useState, useRef } from 'react';
import { MapPin, Plus, Trash2, Crosshair, AlertCircle } from 'lucide-react';
import { PhotoCaptureInput } from '../common/PhotoCaptureInput';

export interface CadZonePin {
  id: string;
  zoneCode: string;
  pinX: number; // 0 to 100%
  pinY: number; // 0 to 100%
  label?: string;
}

interface Props {
  cadPhotoUrl: string;
  onCadPhotoChange: (url: string) => void;
  pins: CadZonePin[];
  onChangePins: (pins: CadZonePin[]) => void;
  availableZones: { id: string; zoneCode: string; roomName: string }[];
  floorName?: string;
  readOnly?: boolean;
}

export const FloorCadPinningCanvas: React.FC<Props> = ({
  cadPhotoUrl,
  onCadPhotoChange,
  pins,
  onChangePins,
  availableZones,
  floorName = 'Tầng',
  readOnly = false,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [selectedPinIndex, setSelectedPinIndex] = useState<number | null>(null);
  const [isAddingPin, setIsAddingPin] = useState<boolean>(false);
  const [activeZoneToPlace, setActiveZoneToPlace] = useState<string>(
    availableZones[0]?.zoneCode || 'Z-01'
  );

  const handleContainerClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (readOnly || !isAddingPin || !containerRef.current || !cadPhotoUrl) return;

    const rect = containerRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;

    const matchingZone = availableZones.find((z) => z.zoneCode === activeZoneToPlace);

    const newPin: CadZonePin = {
      id: `pin-${Date.now()}`,
      zoneCode: activeZoneToPlace,
      pinX: parseFloat(x.toFixed(2)),
      pinY: parseFloat(y.toFixed(2)),
      label: matchingZone?.roomName || `Vùng ${activeZoneToPlace}`,
    };

    const updated = [...pins, newPin];
    onChangePins(updated);
    setSelectedPinIndex(updated.length - 1);
    setIsAddingPin(false);
  };

  const removePin = (index: number) => {
    if (readOnly) return;
    const updated = pins.filter((_, i) => i !== index);
    onChangePins(updated);
    if (selectedPinIndex === index) {
      setSelectedPinIndex(null);
    } else if (selectedPinIndex !== null && selectedPinIndex > index) {
      setSelectedPinIndex(selectedPinIndex - 1);
    }
  };

  const updateSelectedPin = (field: keyof CadZonePin, value: any) => {
    if (selectedPinIndex === null || readOnly) return;
    const updated = [...pins];
    updated[selectedPinIndex] = {
      ...updated[selectedPinIndex],
      [field]: value,
    };
    onChangePins(updated);
  };

  const selectedPin = selectedPinIndex !== null ? pins[selectedPinIndex] : null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', width: '100%' }}>
      {/* Upload/Capture CAD Sketch */}
      <PhotoCaptureInput
        label={`Sơ đồ kỹ thuật / Bản vẽ phác thảo mặt bằng (${floorName}):`}
        value={cadPhotoUrl}
        onChange={onCadPhotoChange}
        watermarkText={`CAD-PLAN | ${floorName}`}
        height="220px"
      />

      {cadPhotoUrl && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem' }}>
          {/* Top Control Bar for Pinning */}
          {!readOnly && (
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '0.5rem',
                padding: '0.5rem 0.75rem',
                backgroundColor: '#f1f5f9',
                borderRadius: '0.65rem',
                border: '1px solid #cbd5e1',
                fontSize: '0.75rem',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
                <MapPin size={15} color="#0369a1" />
                <span style={{ fontWeight: 700, color: '#0369a1' }}>
                  Vị trí vùng Z trên mặt bằng ({pins.length} điểm):
                </span>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                {availableZones.length > 0 && (
                  <select
                    className="form-control"
                    style={{ fontSize: '0.75rem', padding: '0.25rem 0.5rem', width: 'auto' }}
                    value={activeZoneToPlace}
                    onChange={(e) => setActiveZoneToPlace(e.target.value)}
                  >
                    {availableZones.map((z) => (
                      <option key={z.id} value={z.zoneCode}>
                        {z.zoneCode} - {z.roomName}
                      </option>
                    ))}
                  </select>
                )}

                <button
                  type="button"
                  onClick={() => setIsAddingPin(!isAddingPin)}
                  style={{
                    backgroundColor: isAddingPin ? '#ef4444' : '#0284c7',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '0.4rem',
                    padding: '0.35rem 0.75rem',
                    fontWeight: 700,
                    fontSize: '0.75rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.3rem',
                    cursor: 'pointer',
                    boxShadow: isAddingPin ? '0 0 8px rgba(239, 68, 68, 0.5)' : 'none',
                  }}
                >
                  <Crosshair size={14} />
                  <span>{isAddingPin ? 'Hủy chấm' : 'Chấm vị trí vùng Z'}</span>
                </button>
              </div>
            </div>
          )}

          {/* Interactive CAD Canvas */}
          <div
            ref={containerRef}
            onClick={handleContainerClick}
            style={{
              position: 'relative',
              width: '100%',
              minHeight: '260px',
              maxHeight: '420px',
              borderRadius: '0.75rem',
              overflow: 'hidden',
              backgroundColor: '#0f172a',
              cursor: isAddingPin ? 'crosshair' : 'default',
              border: isAddingPin ? '2px solid #38bdf8' : '1px solid #cbd5e1',
              userSelect: 'none',
            }}
          >
            <img
              src={cadPhotoUrl}
              alt={`CAD Plan ${floorName}`}
              style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }}
            />

            {/* Pins representing Zone Locations with SQUARE styling */}
            {pins.map((pin, idx) => {
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
                    zIndex: isSelected ? 30 : 15,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                  }}
                >
                  {/* Pin Tag Box */}
                  <div
                    style={{
                      backgroundColor: isSelected ? '#0284c7' : '#059669',
                      color: '#ffffff',
                      fontSize: '0.675rem',
                      fontWeight: 800,
                      padding: '0.15rem 0.45rem',
                      borderRadius: '3px',
                      whiteSpace: 'nowrap',
                      boxShadow: '0 2px 6px rgba(0,0,0,0.4)',
                      border: isSelected ? '1.5px solid #ffffff' : 'none',
                    }}
                  >
                    {pin.zoneCode} {pin.label ? `• ${pin.label}` : ''}
                  </div>

                  {/* Pin Point - Square icon shape */}
                  <div
                    style={{
                      width: '14px',
                      height: '14px',
                      borderRadius: '2px',
                      backgroundColor: isSelected ? '#38bdf8' : '#10b981',
                      border: '2px solid #ffffff',
                      boxShadow: '0 0 6px rgba(0,0,0,0.6)',
                      marginTop: '1px',
                    }}
                  />
                </div>
              );
            })}
          </div>

          {/* Selected Pin Details Box */}
          {selectedPin !== null && selectedPinIndex !== null && (
            <div
              style={{
                backgroundColor: '#ffffff',
                border: '1px solid #7dd3fc',
                borderRadius: '0.65rem',
                padding: '0.75rem',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                gap: '0.65rem',
                flexWrap: 'wrap',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                <span style={{ fontSize: '0.8rem', fontWeight: 800, color: '#0369a1' }}>
                  Điểm vị trí: {selectedPin.zoneCode}
                </span>

                <select
                  className="form-control"
                  style={{ fontSize: '0.75rem', padding: '0.2rem 0.5rem', width: 'auto' }}
                  value={selectedPin.zoneCode}
                  onChange={(e) => {
                    const zCode = e.target.value;
                    const match = availableZones.find((z) => z.zoneCode === zCode);
                    updateSelectedPin('zoneCode', zCode);
                    if (match) updateSelectedPin('label', match.roomName);
                  }}
                  disabled={readOnly}
                >
                  {availableZones.map((z) => (
                    <option key={z.id} value={z.zoneCode}>
                      {z.zoneCode} - {z.roomName}
                    </option>
                  ))}
                </select>

                <input
                  type="text"
                  className="form-control"
                  placeholder="Ghi chú vị trí (VD: Phòng ngủ góc trái)..."
                  style={{ fontSize: '0.75rem', padding: '0.2rem 0.5rem', width: '220px' }}
                  value={selectedPin.label || ''}
                  onChange={(e) => updateSelectedPin('label', e.target.value)}
                  disabled={readOnly}
                />
              </div>

              {!readOnly && (
                <button
                  type="button"
                  onClick={() => removePin(selectedPinIndex)}
                  className="btn btn-sm"
                  style={{
                    backgroundColor: '#fee2e2',
                    color: '#b91c1c',
                    border: '1px solid #fca5a5',
                    padding: '0.25rem 0.5rem',
                    fontSize: '0.75rem',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '0.25rem',
                  }}
                >
                  <Trash2 size={12} />
                  <span>Xóa điểm</span>
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
