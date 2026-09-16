import React, { useState, useRef } from 'react';
import { Crosshair, Trash2 } from 'lucide-react';

export interface DefectItem {
  id?: string;
  defectCode: string;
  pinX: number; // 0 to 100%
  pinY: number; // 0 to 100%
  screeningCategory: string;
  defectType: string;
  crackDirection?: string;
  widthMaxMm: number;
  lengthMm: number;
  activityState: 'U' | 'S' | 'A';
  materialDegradationE4: number;
  structuralSignificanceE2: number;
  hasScaleCard: boolean;
  isStructuralCritical: boolean;
  cuPhotoUrl: string;
  notes?: string;
}

interface Props {
  ctxPhotoUrl: string;
  defects: DefectItem[];
  onChange: (defects: DefectItem[]) => void;
  readOnly?: boolean;
}

export const DefectPinningCanvas: React.FC<Props> = ({
  ctxPhotoUrl,
  defects,
  onChange,
  readOnly = false,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [selectedDefectIndex, setSelectedDefectIndex] = useState<number | null>(null);
  const [isAddingPin, setIsAddingPin] = useState<boolean>(false);

  const draftDefect: Partial<DefectItem> = {
    screeningCategory: 'Nứt tường / Vữa trát',
    defectType: 'Nứt chân chim (Hairline crack)',
    crackDirection: 'Xiên chéo 45 độ',
    widthMaxMm: 0.5,
    lengthMm: 450,
    activityState: 'U',
    materialDegradationE4: 1,
    structuralSignificanceE2: 1,
    hasScaleCard: true,
    isStructuralCritical: false,
    cuPhotoUrl: 'https://images.unsplash.com/photo-1590381105924-c72589b9ef3f?w=600&auto=format&fit=crop&q=80',
  };

  const handleContainerClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (readOnly || !isAddingPin || !containerRef.current) return;

    const rect = containerRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;

    const newDefect: DefectItem = {
      defectCode: `D-${String(defects.length + 1).padStart(2, '0')}`,
      pinX: parseFloat(x.toFixed(2)),
      pinY: parseFloat(y.toFixed(2)),
      screeningCategory: draftDefect.screeningCategory || 'Nứt tường / Vữa trát',
      defectType: draftDefect.defectType || 'Nứt chân chim',
      crackDirection: draftDefect.crackDirection || 'Xiên chéo',
      widthMaxMm: draftDefect.widthMaxMm ?? 0.5,
      lengthMm: draftDefect.lengthMm ?? 300,
      activityState: draftDefect.activityState || 'U',
      materialDegradationE4: draftDefect.materialDegradationE4 ?? 1,
      structuralSignificanceE2: draftDefect.structuralSignificanceE2 ?? 1,
      hasScaleCard: draftDefect.hasScaleCard ?? true,
      isStructuralCritical: draftDefect.isStructuralCritical ?? false,
      cuPhotoUrl: draftDefect.cuPhotoUrl || 'https://images.unsplash.com/photo-1590381105924-c72589b9ef3f?w=600&auto=format&fit=crop&q=80',
      notes: draftDefect.notes || '',
    };

    const updated = [...defects, newDefect];
    onChange(updated);
    setSelectedDefectIndex(updated.length - 1);
    setIsAddingPin(false);
  };

  const removeDefect = (index: number) => {
    if (readOnly) return;
    const updated = defects.filter((_, i) => i !== index);
    onChange(updated);
    if (selectedDefectIndex === index) {
      setSelectedDefectIndex(null);
    } else if (selectedDefectIndex !== null && selectedDefectIndex > index) {
      setSelectedDefectIndex(selectedDefectIndex - 1);
    }
  };

  const updateSelectedDefect = (field: keyof DefectItem, value: any) => {
    if (selectedDefectIndex === null || readOnly) return;
    const updated = [...defects];
    updated[selectedDefectIndex] = {
      ...updated[selectedDefectIndex],
      [field]: value,
    };
    onChange(updated);
  };

  const selectedDefect = selectedDefectIndex !== null ? defects[selectedDefectIndex] : null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
      {/* Header Toolbar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '0.5rem' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span style={{ fontWeight: 700, fontSize: '0.9rem', color: '#0f172a' }}>
            Ảnh bối cảnh & Ghim vết nứt D-xx ({defects.length})
          </span>
          <span className="badge badge-primary">{defects.length} khuyết tật</span>
        </div>

        <div style={{ display: 'flex', gap: '0.5rem' }}>
          {!readOnly && (
            <button
              type="button"
              onClick={() => setIsAddingPin(!isAddingPin)}
              className={`btn btn-sm ${isAddingPin ? 'btn-danger' : 'btn-primary'}`}
              style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}
            >
              <Crosshair size={14} />
              {isAddingPin ? 'Hủy ghim' : 'Chạm để ghim D-xx'}
            </button>
          )}
        </div>
      </div>

      {isAddingPin && (
        <div
          style={{
            backgroundColor: '#e0f2fe',
            border: '1px dashed #0284c7',
            padding: '0.5rem 0.75rem',
            borderRadius: '0.5rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            color: '#0369a1',
            fontSize: '0.8rem',
            fontWeight: 600,
          }}
        >
          <Crosshair size={16} />
          <span>Chế độ ghim đang bật: Nhấn vào vị trí nứt trên ảnh bên dưới để đặt mã D-xx.</span>
        </div>
      )}

      {/* Canvas View Container */}
      <div
        ref={containerRef}
        onClick={handleContainerClick}
        style={{
          position: 'relative',
          width: '100%',
          minHeight: '280px',
          maxHeight: '460px',
          backgroundColor: '#f1f5f9',
          borderRadius: '0.75rem',
          overflow: 'hidden',
          border: isAddingPin ? '2px solid #0284c7' : '1px solid #cbd5e1',
          cursor: isAddingPin ? 'crosshair' : 'default',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
        }}
      >
        <img
          src={ctxPhotoUrl || 'https://images.unsplash.com/photo-1513694203232-719a280e022f?w=1000&auto=format&fit=crop&q=80'}
          alt="Context Photo"
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'contain',
            userSelect: 'none',
            pointerEvents: 'none',
          }}
        />

        {/* Pin Markers */}
        {defects.map((d, index) => {
          const isSelected = selectedDefectIndex === index;
          const isCritical = d.isStructuralCritical || d.widthMaxMm >= 2.0;

          return (
            <div
              key={index}
              onClick={(e) => {
                e.stopPropagation();
                setSelectedDefectIndex(index);
              }}
              style={{
                position: 'absolute',
                left: `${d.pinX}%`,
                top: `${d.pinY}%`,
                transform: 'translate(-50%, -100%)',
                cursor: 'pointer',
                zIndex: isSelected ? 30 : 20,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                transition: 'all 0.15s ease',
              }}
            >
              {/* Badge Label */}
              <div
                style={{
                  backgroundColor: isCritical ? '#ef4444' : isSelected ? '#0284c7' : '#10b981',
                  color: '#ffffff',
                  fontSize: '0.75rem',
                  fontWeight: 800,
                  padding: '2px 6px',
                  borderRadius: '12px',
                  boxShadow: isSelected ? '0 0 10px rgba(2, 132, 199, 0.8)' : '0 2px 4px rgba(0,0,0,0.3)',
                  border: isSelected ? '2px solid #ffffff' : '1px solid rgba(255,255,255,0.4)',
                  whiteSpace: 'nowrap',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '2px',
                }}
              >
                <span>{d.defectCode}</span>
                <span style={{ fontSize: '0.65rem', opacity: 0.9 }}>({d.widthMaxMm}mm)</span>
              </div>

              {/* Pin Arrow Pointer */}
              <div
                style={{
                  width: 0,
                  height: 0,
                  borderLeft: '5px solid transparent',
                  borderRight: '5px solid transparent',
                  borderTop: `6px solid ${isCritical ? '#ef4444' : isSelected ? '#0284c7' : '#10b981'}`,
                }}
              />

              {/* Pin Target Dot */}
              <div
                style={{
                  width: '8px',
                  height: '8px',
                  borderRadius: '50%',
                  backgroundColor: '#ffffff',
                  border: `2px solid ${isCritical ? '#ef4444' : '#10b981'}`,
                }}
              />
            </div>
          );
        })}
      </div>

      {/* Selected Defect Edit Drawer */}
      {selectedDefect && (
        <div
          className="card"
          style={{
            backgroundColor: '#ffffff',
            border: '1px solid #cbd5e1',
            padding: '1rem',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span
                style={{
                  backgroundColor: selectedDefect.isStructuralCritical ? '#ef4444' : '#0284c7',
                  color: '#ffffff',
                  fontWeight: 800,
                  padding: '3px 8px',
                  borderRadius: '6px',
                  fontSize: '0.85rem',
                }}
              >
                {selectedDefect.defectCode}
              </span>
              <span style={{ fontWeight: 700, color: '#0f172a', fontSize: '0.9rem' }}>
                Chi tiết vết nứt ({selectedDefect.pinX}%, {selectedDefect.pinY}%)
              </span>
            </div>

            {!readOnly && (
              <button
                type="button"
                onClick={() => removeDefect(selectedDefectIndex!)}
                className="btn btn-sm btn-danger"
                style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}
              >
                <Trash2 size={13} />
                Xóa điểm
              </button>
            )}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.75rem' }}>
            <div>
              <label className="form-label">Phân loại cấu kiện nứt</label>
              <select
                className="form-control"
                value={selectedDefect.screeningCategory}
                disabled={readOnly}
                onChange={(e) => updateSelectedDefect('screeningCategory', e.target.value)}
              >
                <option value="Nứt tường / Vữa trát">Nứt tường / Vữa trát</option>
                <option value="Nứt dầm bê tông (Beam)">Nứt dầm bê tông (Beam)</option>
                <option value="Nứt cột chịu lực (Column)">Nứt cột chịu lực (Column)</option>
                <option value="Nứt sàn (Slab)">Nứt sàn (Slab)</option>
                <option value="Nứt mối nối / Tiếp giáp">Nứt mối nối / Tiếp giáp nhà liền kề</option>
              </select>
            </div>

            <div>
              <label className="form-label">Dạng vết nứt</label>
              <select
                className="form-control"
                value={selectedDefect.defectType}
                disabled={readOnly}
                onChange={(e) => updateSelectedDefect('defectType', e.target.value)}
              >
                <option value="Nứt chân chim (Hairline crack)">Nứt chân chim (Hairline crack)</option>
                <option value="Nứt xiên góc 45 độ (Shear crack)">Nứt xiên góc 45 độ (Shear crack)</option>
                <option value="Nứt ngang theo mạch vữa">Nứt ngang theo mạch vữa</option>
                <option value="Nứt dọc thẳng đứng">Nứt dọc thẳng đứng</option>
                <option value="Nứt tách khe hở lớn">Nứt tách khe hở lớn</option>
              </select>
            </div>

            <div>
              <label className="form-label">Độ rộng lớn nhất (w mm)</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <input
                  type="number"
                  step="0.05"
                  min="0.05"
                  max="50"
                  className="form-control"
                  value={selectedDefect.widthMaxMm}
                  disabled={readOnly}
                  onChange={(e) => updateSelectedDefect('widthMaxMm', parseFloat(e.target.value) || 0)}
                />
                <span style={{ fontSize: '0.8rem', color: '#64748b' }}>mm</span>
              </div>
            </div>

            <div>
              <label className="form-label">Chiều dài vết nứt (L mm)</label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                <input
                  type="number"
                  step="10"
                  min="10"
                  max="10000"
                  className="form-control"
                  value={selectedDefect.lengthMm}
                  disabled={readOnly}
                  onChange={(e) => updateSelectedDefect('lengthMm', parseFloat(e.target.value) || 0)}
                />
                <span style={{ fontSize: '0.8rem', color: '#64748b' }}>mm</span>
              </div>
            </div>

            <div>
              <label className="form-label">Trạng thái hoạt động</label>
              <select
                className="form-control"
                value={selectedDefect.activityState}
                disabled={readOnly}
                onChange={(e) => updateSelectedDefect('activityState', e.target.value as 'U' | 'S' | 'A')}
              >
                <option value="U">U - Không xác định (Uncertain)</option>
                <option value="S">S - Đã ổn định (Stable)</option>
                <option value="A">A - Đang tiến triển (Active)</option>
              </select>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', justifyContent: 'center' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.825rem' }}>
                <input
                  type="checkbox"
                  checked={selectedDefect.hasScaleCard}
                  disabled={readOnly}
                  onChange={(e) => updateSelectedDefect('hasScaleCard', e.target.checked)}
                />
                <span style={{ color: selectedDefect.hasScaleCard ? '#15803d' : '#b45309', fontWeight: 600 }}>
                  Có thước đo chuẩn (Scale Card)
                </span>
              </label>

              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', fontSize: '0.825rem' }}>
                <input
                  type="checkbox"
                  checked={selectedDefect.isStructuralCritical}
                  disabled={readOnly}
                  onChange={(e) => updateSelectedDefect('isStructuralCritical', e.target.checked)}
                />
                <span style={{ color: selectedDefect.isStructuralCritical ? '#ef4444' : '#64748b', fontWeight: selectedDefect.isStructuralCritical ? 700 : 500 }}>
                  Vết nứt nguy hiểm kết cấu
                </span>
              </label>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
