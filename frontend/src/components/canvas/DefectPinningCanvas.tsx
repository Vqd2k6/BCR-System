import React, { useState, useRef } from 'react';
import { Crosshair, Trash2, Camera, AlertCircle, CheckCircle2, Ruler } from 'lucide-react';
import { PhotoCaptureInput } from '../common/PhotoCaptureInput';

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

const COMMON_DEFECT_TYPES = [
  'Nứt xiên 45° (Cắt gãy / Biến dạng lún)',
  'Nứt dọc / Nứt đứng chịu lực',
  'Nứt ngang cấu kiện',
  'Nứt chân chim / Mạng nhện vữa trát',
  'Nứt ziczac theo mạch vữa gạch',
  'Nứt góc cửa sổ / Cửa đi',
  'Nứt tiếp giáp Cột - Tường',
  'Nứt tiếp giáp Dầm - Tường',
  'Nứt tách mép tấm sàn BTCT',
  'Bong tróc vữa lộ cốt thép',
  'Thấm dột / Ẩm mốc loang lổ',
  'Khác',
];

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
    defectType: COMMON_DEFECT_TYPES[0],
    crackDirection: 'Xiên chéo 45 độ',
    widthMaxMm: 0.5,
    lengthMm: 300,
    activityState: 'U',
    materialDegradationE4: 1,
    structuralSignificanceE2: 1,
    hasScaleCard: true,
    isStructuralCritical: false,
    cuPhotoUrl: '',
  };

  const handleContainerClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (readOnly || !isAddingPin || !containerRef.current || !ctxPhotoUrl) return;

    const rect = containerRef.current.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 100;
    const y = ((e.clientY - rect.top) / rect.height) * 100;

    const newDefect: DefectItem = {
      defectCode: `D-${String(defects.length + 1).padStart(2, '0')}`,
      pinX: parseFloat(x.toFixed(2)),
      pinY: parseFloat(y.toFixed(2)),
      screeningCategory: draftDefect.screeningCategory || 'Nứt tường / Vữa trát',
      defectType: draftDefect.defectType || COMMON_DEFECT_TYPES[0],
      crackDirection: draftDefect.crackDirection || 'Xiên chéo',
      widthMaxMm: draftDefect.widthMaxMm ?? 0.5,
      lengthMm: draftDefect.lengthMm ?? 300,
      activityState: draftDefect.activityState || 'U',
      materialDegradationE4: draftDefect.materialDegradationE4 ?? 1,
      structuralSignificanceE2: draftDefect.structuralSignificanceE2 ?? 1,
      hasScaleCard: draftDefect.hasScaleCard ?? true,
      isStructuralCritical: draftDefect.isStructuralCritical ?? false,
      cuPhotoUrl: '',
      notes: '',
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

  if (!ctxPhotoUrl) {
    return (
      <div
        style={{
          padding: '1.5rem',
          backgroundColor: '#f8fafc',
          border: '1px dashed #cbd5e1',
          borderRadius: '0.75rem',
          textAlign: 'center',
          color: '#64748b',
          fontSize: '0.825rem',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '0.5rem',
        }}
      >
        <AlertCircle size={24} color="#94a3b8" />
        <span>Vui lòng chụp hoặc tải ảnh bối cảnh Photo CTX của mảng tường/cấu kiện ở trên trước khi thả ghim khuyết tật.</span>
      </div>
    );
  }

  const selectedDefect = selectedDefectIndex !== null ? defects[selectedDefectIndex] : null;
  const isCustomDefectType = selectedDefect ? !COMMON_DEFECT_TYPES.slice(0, -1).includes(selectedDefect.defectType) : false;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
      {/* Top Toolbar */}
      {!readOnly && (
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '0.5rem 0.75rem',
            backgroundColor: '#0f172a',
            borderRadius: '0.65rem',
            color: '#ffffff',
            fontSize: '0.75rem',
            flexWrap: 'wrap',
            gap: '0.4rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span style={{ fontWeight: 700, color: '#38bdf8' }}>
              Danh sách ghim ({defects.length} điểm khuyết tật)
            </span>
          </div>

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
              gap: '0.35rem',
              cursor: 'pointer',
              boxShadow: isAddingPin ? '0 0 8px rgba(239, 68, 68, 0.5)' : 'none',
            }}
          >
            <Crosshair size={14} />
            <span>{isAddingPin ? 'Hủy thả ghim' : 'Chạm để thả ghim'}</span>
          </button>
        </div>
      )}

      {/* Pinning Canvas */}
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
          src={ctxPhotoUrl}
          alt="Context CTX view"
          style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }}
        />

        {/* Render Pins with SQUARE styling */}
        {defects.map((d, idx) => {
          const isSelected = selectedDefectIndex === idx;
          const isCritical = d.isStructuralCritical || d.structuralSignificanceE2 >= 3;

          return (
            <div
              key={idx}
              onClick={(e) => {
                e.stopPropagation();
                setSelectedDefectIndex(idx);
              }}
              style={{
                position: 'absolute',
                top: `${d.pinY}%`,
                left: `${d.pinX}%`,
                transform: 'translate(-50%, -100%)',
                cursor: 'pointer',
                zIndex: isSelected ? 20 : 10,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
              }}
            >
              {/* Pin Tooltip Box */}
              <div
                style={{
                  backgroundColor: isSelected ? '#0284c7' : isCritical ? '#dc2626' : '#0f172a',
                  color: '#ffffff',
                  fontSize: '0.65rem',
                  fontWeight: 800,
                  padding: '0.15rem 0.35rem',
                  borderRadius: '3px',
                  whiteSpace: 'nowrap',
                  boxShadow: '0 2px 5px rgba(0,0,0,0.4)',
                  border: isSelected ? '1.5px solid #ffffff' : 'none',
                }}
              >
                {d.defectCode} • {d.widthMaxMm}mm
              </div>

              {/* Pin Point - Square icon shape */}
              <div
                style={{
                  width: '12px',
                  height: '12px',
                  borderRadius: '2px',
                  backgroundColor: isCritical ? '#ef4444' : '#f59e0b',
                  border: '2px solid #ffffff',
                  boxShadow: '0 0 6px rgba(0,0,0,0.6)',
                  marginTop: '1px',
                }}
              />
            </div>
          );
        })}
      </div>

      {/* Selected Defect Detail Card */}
      {selectedDefect !== null && selectedDefectIndex !== null && (
        <div
          className="card"
          style={{
            backgroundColor: '#ffffff',
            borderRadius: '0.75rem',
            border: '1px solid #7dd3fc',
            padding: '1rem',
            display: 'flex',
            flexDirection: 'column',
            gap: '0.75rem',
            boxShadow: '0 4px 12px rgba(2, 132, 199, 0.1)',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem' }}>
              <span style={{ fontSize: '1rem', fontWeight: 800, color: '#0284c7' }}>
                Chi tiết ghim {selectedDefect.defectCode}
              </span>
              <span className="badge badge-warning">
                Tọa độ: {selectedDefect.pinX}%, {selectedDefect.pinY}%
              </span>
            </div>

            {!readOnly && (
              <button
                type="button"
                onClick={() => removeDefect(selectedDefectIndex)}
                className="btn btn-sm"
                style={{
                  backgroundColor: '#fee2e2',
                  color: '#b91c1c',
                  border: '1px solid #fca5a5',
                  padding: '0.3rem 0.55rem',
                  fontSize: '0.75rem',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.25rem',
                }}
              >
                <Trash2 size={13} />
                <span>Xóa ghim</span>
              </button>
            )}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '0.65rem' }}>
            <div>
              <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#475569' }}>
                Chỉ số sàng lọc:
              </label>
              <select
                className="form-control"
                value={selectedDefect.screeningCategory}
                onChange={(e) => updateSelectedDefect('screeningCategory', e.target.value)}
                style={{ fontSize: '0.8rem' }}
                disabled={readOnly}
              >
                <option value="Nứt tường / Vữa trát">Nứt tường / Vữa trát</option>
                <option value="Nứt kết cấu Cột / Dầm / Sàn">Nứt kết cấu Cột / Dầm / Sàn</option>
                <option value="Lún võng cấu kiện">Lún võng cấu kiện</option>
                <option value="Thấm dột / Ẩm mốc">Thấm dột / Ẩm mốc</option>
                <option value="Bong tróc vữa lộ cốt thép">Bong tróc vữa lộ cốt thép</option>
                <option value="Mất tiết diện bê tông">Mất tiết diện bê tông</option>
                <option value="Kẹt cửa / Biến dạng khung">Kẹt cửa / Biến dạng khung</option>
                <option value="Tái nứt / Phát triển nứt cũ">Tái nứt / Phát triển nứt cũ</option>
              </select>
            </div>

            {/* Dạng nứt & Cấu kiện with List & Other Input */}
            <div>
              <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#475569' }}>
                Dạng nứt & Cấu kiện:
              </label>
              <select
                className="form-control"
                value={isCustomDefectType ? 'Khác' : selectedDefect.defectType}
                onChange={(e) => {
                  const val = e.target.value;
                  if (val === 'Khác') {
                    updateSelectedDefect('defectType', '');
                  } else {
                    updateSelectedDefect('defectType', val);
                  }
                }}
                style={{ fontSize: '0.8rem' }}
                disabled={readOnly}
              >
                {COMMON_DEFECT_TYPES.map((dt) => (
                  <option key={dt} value={dt}>
                    {dt}
                  </option>
                ))}
              </select>
              {(isCustomDefectType || selectedDefect.defectType === '' || !COMMON_DEFECT_TYPES.slice(0, -1).includes(selectedDefect.defectType)) && (
                <input
                  type="text"
                  className="form-control"
                  style={{ fontSize: '0.8rem', marginTop: '0.35rem' }}
                  placeholder="Nhập dạng nứt cụ thể..."
                  value={selectedDefect.defectType}
                  onChange={(e) => updateSelectedDefect('defectType', e.target.value)}
                  disabled={readOnly}
                  autoFocus
                />
              )}
            </div>

            <div>
              <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#475569' }}>
                Bề rộng lớn nhất (mm):
              </label>
              <input
                type="number"
                step="0.05"
                className="form-control"
                value={selectedDefect.widthMaxMm}
                onChange={(e) => updateSelectedDefect('widthMaxMm', parseFloat(e.target.value) || 0)}
                style={{ fontSize: '0.8rem' }}
                disabled={readOnly}
              />
            </div>

            <div>
              <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#475569' }}>
                Chiều dài (mm):
              </label>
              <input
                type="number"
                step="10"
                className="form-control"
                value={selectedDefect.lengthMm}
                onChange={(e) => updateSelectedDefect('lengthMm', parseFloat(e.target.value) || 0)}
                style={{ fontSize: '0.8rem' }}
                disabled={readOnly}
              />
            </div>

            <div>
              <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#475569' }}>
                Trạng thái hoạt động:
              </label>
              <select
                className="form-control"
                value={selectedDefect.activityState}
                onChange={(e) => updateSelectedDefect('activityState', e.target.value as any)}
                style={{ fontSize: '0.8rem' }}
                disabled={readOnly}
              >
                <option value="U">U - Chưa rõ / Đang kiểm tra</option>
                <option value="S">S - Ổn định</option>
                <option value="A">A - Đang phát triển</option>
              </select>
            </div>

            <div>
              <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#475569' }}>
                Ý nghĩa kết cấu:
              </label>
              <select
                className="form-control"
                value={selectedDefect.structuralSignificanceE2}
                onChange={(e) => updateSelectedDefect('structuralSignificanceE2', parseInt(e.target.value, 10))}
                style={{ fontSize: '0.8rem' }}
                disabled={readOnly}
              >
                <option value={0}>Không ảnh hưởng</option>
                <option value={1}>Thấp</option>
                <option value={2}>Trung bình</option>
                <option value={3}>Cao</option>
                <option value={4}>Rất nguy hiểm / Cảnh báo</option>
              </select>
            </div>

            <div>
              <label style={{ fontSize: '0.75rem', fontWeight: 600, color: '#475569' }}>
                Mức độ suy giảm vật liệu / Bong tróc / Rỉ thép:
              </label>
              <select
                className="form-control"
                value={selectedDefect.materialDegradationE4 ?? 0}
                onChange={(e) => updateSelectedDefect('materialDegradationE4', parseInt(e.target.value, 10))}
                style={{ fontSize: '0.8rem' }}
                disabled={readOnly}
              >
                <option value={0}>Không / Rất nhẹ</option>
                <option value={1}>Cục bộ (Bong tróc nhẹ)</option>
                <option value={2}>Đáng kể (Bong mảng rộng, rỉ rác)</option>
                <option value={3}>Nặng (Bong diện rộng, cốt thép rỉ)</option>
                <option value={4}>Ảnh hưởng chịu lực (Rỉ đứt thép, mất tiết diện)</option>
              </select>
            </div>
          </div>

          {/* Close-Up Photo with Scale Card */}
          <div style={{ marginTop: '0.25rem' }}>
            <PhotoCaptureInput
              label={`Ảnh cận cảnh có thước đo (${selectedDefect.defectCode}-CU):`}
              value={selectedDefect.cuPhotoUrl}
              onChange={(url) => updateSelectedDefect('cuPhotoUrl', url)}
              watermarkText={`${selectedDefect.defectCode}-CU | ${selectedDefect.widthMaxMm}mm x ${selectedDefect.lengthMm}mm`}
              height="160px"
              required={true}
            />
          </div>
        </div>
      )}
    </div>
  );
};
