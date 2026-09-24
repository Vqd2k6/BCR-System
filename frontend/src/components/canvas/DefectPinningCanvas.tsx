import React, { useState, useRef } from 'react';
import { Crosshair, Trash2, Camera, AlertCircle, CheckCircle2, Ruler, Sparkles, MapPin, AlertTriangle } from 'lucide-react';
import { PhotoCaptureInput } from '../common/PhotoCaptureInput';
import { InfoPopover } from '../../core/components/ui/InfoPopover';

export interface DefectItem {
  id?: string;
  defectCode: string;
  pinX: number; // 0 to 100%
  pinY: number; // 0 to 100%
  screeningCategory: string;
  customScreeningCategory?: string;
  defectType: string;
  crackDirection?: string;
  widthMaxMm: number | '';
  lengthMm: number | '';
  activityState: 'U' | 'S' | 'A' | '';
  materialDegradationE4: number | '';
  structuralSignificanceE2: number | '';
  functionalImpactE6?: number | '';
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
  mode?: 'ARCHITECTURAL' | 'STRUCTURAL'; // Z vs E
}

const ARCH_SCREENING_CATEGORIES = [
  'Nứt tường gạch / Vữa trát hoàn thiện',
  'Nứt tiếp giáp khuôn cửa / Trần',
  'Bong rộp / Nứt gạch ốp lát',
  'Thấm dột / Ẩm mốc bề mặt',
  'Kẹt cửa / Cong vênh phụ kiện',
  'Khác',
];

const ARCH_DEFECT_TYPES = [
  'Nứt chân chim / Mạng nhện vữa trát (<0.5mm)',
  'Nứt ziczac theo mạch vữa gạch',
  'Nứt góc cửa sổ / Cửa đi',
  'Nứt tiếp giáp Cột - Tường gạch',
  'Nứt tiếp giáp Dầm - Tường gạch',
  'Bong rộp sơn vôi / Ẩm mốc loang lổ',
  'Bong tách gạch ốp tường / Gạch lát nền',
  'Nứt trần thạch cao / Khe tiếp giáp la phông',
  'Khác',
];

const STRUCT_SCREENING_CATEGORIES = [
  'Nứt cấu kiện kết cấu chịu lực (Cột/Dầm/Sàn)',
  'Vỡ bê tông / Trơ rỉ cốt thép chịu lực',
  'Nứt nút khung / Mối nối liên kết chịu lực',
  'Võng uốn dầm sàn / Biến dạng cấu kiện',
  'Nứt gãy cổ cột / Móng tiếp giáp nền',
  'Khác',
];

const STRUCT_DEFECT_TYPES = [
  'Nứt xiên 45° chịu cắt gần đầu cột / gối dầm (Nguy hiểm)',
  'Nứt dọc thân cột bê tông (Quá tải nén dọc)',
  'Nứt uốn giữa nhịp dầm / Đáy bản sàn chịu lực',
  'Nứt toác / Bong bê tông lộ cốt thép gỉ sét',
  'Nứt tách mép tấm sàn BTCT chịu lực',
  'Nứt tách rời nút khung Cột - Dầm',
  'Nứt gãy chân cột / Cổ móng',
  'Lỏng rơ bu lông / Rách mối hàn liên kết thép',
  'Khác',
];

export const isCrackRelated = (cat = '', type = '') => {
  const t = `${cat} ${type}`.toLowerCase();
  return t.includes('nứt') || t.includes('crack');
};

export const DefectPinningCanvas: React.FC<Props> = ({
  ctxPhotoUrl,
  defects,
  onChange,
  readOnly = false,
  mode = 'ARCHITECTURAL',
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const detailFormRef = useRef<HTMLDivElement>(null);
  const [selectedDefectIndex, setSelectedDefectIndex] = useState<number | null>(null);
  const [isAddingPin, setIsAddingPin] = useState<boolean>(true);

  const screeningCategories = mode === 'STRUCTURAL' ? STRUCT_SCREENING_CATEGORIES : ARCH_SCREENING_CATEGORIES;
  const commonDefectTypes = mode === 'STRUCTURAL' ? STRUCT_DEFECT_TYPES : ARCH_DEFECT_TYPES;

  const nextDefectCode = `D-${String(defects.length + 1).padStart(2, '0')}`;

  const handleContainerClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (readOnly || !isAddingPin || !containerRef.current || !ctxPhotoUrl) return;

    const rect = containerRef.current.getBoundingClientRect();
    const x = parseFloat((((e.clientX - rect.left) / rect.width) * 100).toFixed(2));
    const y = parseFloat((((e.clientY - rect.top) / rect.height) * 100).toFixed(2));

    const newDefectCode = `D-${String(defects.length + 1).padStart(2, '0')}`;

    // Khởi tạo khuyết tật mới trống hoàn toàn để surveyor bắt buộc điền thủ công
    const newDefect: DefectItem = {
      defectCode: newDefectCode,
      pinX: x,
      pinY: y,
      screeningCategory: '',
      customScreeningCategory: '',
      defectType: '',
      crackDirection: '',
      widthMaxMm: '' as any,
      lengthMm: '' as any,
      activityState: '',
      materialDegradationE4: '' as any,
      structuralSignificanceE2: '' as any,
      functionalImpactE6: '' as any,
      hasScaleCard: true,
      isStructuralCritical: false,
      cuPhotoUrl: '',
      notes: '',
    };

    const updated = [...defects, newDefect];
    onChange(updated);
    setSelectedDefectIndex(updated.length - 1);
    setIsAddingPin(false);
    setTimeout(() => {
      detailFormRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }, 60);
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

  // Kiểm tra xem 1 điểm D đã điền đầy đủ mọi trường bắt buộc chưa
  const isDefectFilled = (d: DefectItem) => {
    const isCrack = isCrackRelated(d.screeningCategory, d.defectType);
    const baseOk = Boolean(
      d.cuPhotoUrl &&
      d.notes &&
      d.notes.trim().length > 0 &&
      d.screeningCategory &&
      (d.screeningCategory !== 'Khác' || (d.customScreeningCategory && d.customScreeningCategory.trim().length > 0)) &&
      d.defectType &&
      d.functionalImpactE6 !== '' &&
      d.functionalImpactE6 !== undefined
    );
    if (!baseOk) return false;

    if (mode === 'STRUCTURAL') {
      if (d.structuralSignificanceE2 === '' || d.structuralSignificanceE2 === undefined) return false;
      if (d.materialDegradationE4 === '' || d.materialDegradationE4 === undefined) return false;
    }

    if (isCrack) {
      if (!d.crackDirection || d.crackDirection.trim().length === 0) return false;
      if (d.widthMaxMm === '' || Number(d.widthMaxMm) <= 0) return false;
      if (d.lengthMm === '' || Number(d.lengthMm) <= 0) return false;
      if (!d.activityState) return false;
    }

    return true;
  };

  return (
    <div className="flex flex-col gap-3 w-full bg-white">
      {/* Top Control Bar with Quick Info */}
      {!readOnly && (
        <div className="flex flex-wrap items-center justify-between gap-2 p-2.5 bg-slate-50 rounded-xl border border-slate-200 text-xs">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <MapPin className="w-4 h-4 text-emerald-600" />
              <span className="font-bold text-slate-800">
                Ghi sổ khuyết tật ({defects.length} điểm D):
              </span>
            </div>

            <div className="flex items-center gap-2 text-[11px]">
              <span className="flex items-center gap-1 text-emerald-700 font-medium">
                <span className="w-2 h-2 rounded-xs bg-emerald-500 inline-block" />
                Đã điền đủ ({defects.filter(isDefectFilled).length})
              </span>
              <span className="flex items-center gap-1 text-amber-700 font-medium">
                <span className="w-2 h-2 rounded-xs bg-amber-500 inline-block" />
                Chưa đủ thông số ({defects.filter((d) => !isDefectFilled(d)).length})
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setIsAddingPin(!isAddingPin)}
            className={`px-3 py-1.5 rounded-lg font-bold text-xs flex items-center gap-1.5 transition-all shadow-xs ${
              isAddingPin
                ? 'bg-red-600 text-white ring-2 ring-red-400'
                : 'bg-emerald-600 text-white hover:bg-emerald-700'
            }`}
          >
            <Crosshair className="w-3.5 h-3.5" />
            <span>{isAddingPin ? `Đang bật chạm chấm ${nextDefectCode}` : `Bật chạm chấm ${nextDefectCode}`}</span>
          </button>
        </div>
      )}

      {/* Pinning Canvas - Clean Light Theme */}
      <div
        ref={containerRef}
        onClick={handleContainerClick}
        className={`relative w-full min-h-[300px] max-h-[480px] rounded-xl overflow-hidden bg-slate-100 border border-slate-300 select-none shadow-inner ${
          isAddingPin ? 'cursor-crosshair ring-2 ring-emerald-500/30' : 'cursor-default'
        } flex items-center justify-center`}
      >
        <img
          src={ctxPhotoUrl}
          alt="Context Photo for Defects"
          className="max-h-[480px] w-full object-contain pointer-events-none"
        />

        {/* Existing Pins */}
        {defects.map((d, idx) => {
          const isSelected = selectedDefectIndex === idx;
          const isFilled = isDefectFilled(d);
          const squareBg = isFilled ? '#10b981' : '#f59e0b';

          return (
            <div
              key={idx}
              onClick={(e) => {
                e.stopPropagation();
                setSelectedDefectIndex(idx);
                setIsAddingPin(false);
                setTimeout(() => {
                  detailFormRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
                }, 60);
              }}
              style={{
                position: 'absolute',
                left: `${d.pinX}%`,
                top: `${d.pinY}%`,
                transform: 'translate(-50%, -50%)',
                cursor: 'pointer',
                zIndex: isSelected ? 30 : 20,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
              }}
              title={`${d.defectCode}: ${d.defectType || 'Chưa chọn'} (${isFilled ? 'Đã điền đủ' : 'Chưa điền đủ'})`}
            >
              <div
                style={{
                  fontSize: '0.65rem',
                  fontWeight: 800,
                  fontFamily: 'monospace',
                  padding: '1px 5px',
                  borderRadius: '3px',
                  backgroundColor: isSelected ? '#0284c7' : 'rgba(15, 23, 42, 0.9)',
                  color: '#ffffff',
                  border: isSelected ? '1.5px solid #ffffff' : '1px solid rgba(255,255,255,0.4)',
                  whiteSpace: 'nowrap',
                  boxShadow: '0 2px 4px rgba(0,0,0,0.3)',
                }}
              >
                {d.defectCode}
              </div>

              <div
                style={{
                  width: isSelected ? '14px' : '12px',
                  height: isSelected ? '14px' : '12px',
                  borderRadius: '2px',
                  backgroundColor: squareBg,
                  border: '2px solid #ffffff',
                  boxShadow: '0 0 6px rgba(0,0,0,0.4)',
                  marginTop: '1px',
                  transition: 'transform 0.15s ease',
                }}
              />
            </div>
          );
        })}
      </div>

      {/* Selected Defect Detail Card */}
      {selectedDefect !== null && selectedDefectIndex !== null && (
        <div ref={detailFormRef} className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-slate-200">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="px-2.5 py-1 bg-slate-900 text-white font-mono font-bold text-xs rounded-lg">
                {selectedDefect.defectCode}
              </span>
              <span className="font-bold text-sm text-slate-800">
                Thông số chi tiết vết nứt / khuyết tật ({selectedDefect.defectCode})
              </span>
              {isDefectFilled(selectedDefect) ? (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200 flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" />
                  Đã điền đầy đủ tất cả các trường
                </span>
              ) : (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200 flex items-center gap-1">
                  <AlertTriangle className="w-3 h-3 text-amber-600" />
                  Bắt buộc điền đầy đủ các trường bên dưới
                </span>
              )}
            </div>

            {!readOnly && (
              <button
                type="button"
                onClick={() => removeDefect(selectedDefectIndex)}
                className="px-2 py-1 bg-red-50 text-red-700 border border-red-200 hover:bg-red-100 rounded-lg text-xs font-semibold flex items-center gap-1"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Xóa điểm D này</span>
              </button>
            )}
          </div>

          {/* Form fields for Defect Details */}
          <div className={`grid grid-cols-1 ${isCrackRelated(selectedDefect.screeningCategory, selectedDefect.defectType) ? 'sm:grid-cols-3' : 'sm:grid-cols-2'} gap-3`}>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Nhóm chỉ báo *
              </label>
              <select
                className={`w-full px-2.5 py-1.5 bg-white border rounded-lg text-xs font-medium focus:ring-1 focus:ring-emerald-500 ${
                  !selectedDefect.screeningCategory ? 'border-amber-400 bg-amber-50/30' : 'border-slate-300'
                }`}
                value={selectedDefect.screeningCategory}
                onChange={(e) => updateSelectedDefect('screeningCategory', e.target.value)}
                disabled={readOnly}
              >
                <option value="">--- Chọn nhóm chỉ báo ---</option>
                {screeningCategories.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
              {selectedDefect.screeningCategory === 'Khác' && (
                <div className="mt-2">
                  <label className="block text-[11px] font-bold text-slate-700 mb-1">
                    Tên nhóm chỉ báo tùy chỉnh *
                  </label>
                  <input
                    type="text"
                    placeholder="Nhập nhóm chỉ báo tùy chỉnh..."
                    className={`w-full px-2.5 py-1.5 bg-white border rounded-lg text-xs font-medium focus:ring-1 focus:ring-emerald-500 ${
                      !selectedDefect.customScreeningCategory?.trim() ? 'border-amber-400 bg-amber-50/30' : 'border-slate-300'
                    }`}
                    value={selectedDefect.customScreeningCategory || ''}
                    onChange={(e) => updateSelectedDefect('customScreeningCategory', e.target.value)}
                    disabled={readOnly}
                  />
                </div>
              )}
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Dạng nứt / Cấu kiện *
              </label>
              <select
                className={`w-full px-2.5 py-1.5 bg-white border rounded-lg text-xs font-medium focus:ring-1 focus:ring-emerald-500 ${
                  !selectedDefect.defectType ? 'border-amber-400 bg-amber-50/30' : 'border-slate-300'
                }`}
                value={selectedDefect.defectType}
                onChange={(e) => updateSelectedDefect('defectType', e.target.value)}
                disabled={readOnly}
              >
                <option value="">--- Chọn dạng nứt / khuyết tật ---</option>
                {commonDefectTypes.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>

            {isCrackRelated(selectedDefect.screeningCategory, selectedDefect.defectType) && (
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Hướng nứt *
                </label>
                <input
                  type="text"
                  placeholder="VD: Xiên 45° từ góc cửa sổ lên dầm..."
                  className={`w-full px-2.5 py-1.5 bg-white border rounded-lg text-xs focus:ring-1 focus:ring-emerald-500 ${
                    !selectedDefect.crackDirection ? 'border-amber-400 bg-amber-50/30' : 'border-slate-300'
                  }`}
                  value={selectedDefect.crackDirection || ''}
                  onChange={(e) => updateSelectedDefect('crackDirection', e.target.value)}
                  disabled={readOnly}
                />
              </div>
            )}
          </div>

          {/* Dimensions & Scale */}
          {isCrackRelated(selectedDefect.screeningCategory, selectedDefect.defectType) && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Bề rộng lớn nhất w_max (mm) *
                </label>
                <input
                  type="number"
                  step="0.05"
                  min="0"
                  placeholder="VD: 0.8"
                  className={`w-full px-2.5 py-1.5 bg-white border rounded-lg text-xs font-mono font-bold focus:ring-1 focus:ring-emerald-500 ${
                    !selectedDefect.widthMaxMm ? 'border-amber-400 bg-amber-50/30' : 'border-slate-300'
                  }`}
                  value={selectedDefect.widthMaxMm === '' ? '' : selectedDefect.widthMaxMm}
                  onChange={(e) =>
                    updateSelectedDefect(
                      'widthMaxMm',
                      e.target.value === '' ? ('' as any) : parseFloat(e.target.value) || 0
                    )
                  }
                  disabled={readOnly}
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Chiều dài nứt L (mm) *
                </label>
                <input
                  type="number"
                  step="10"
                  min="0"
                  placeholder="VD: 450"
                  className={`w-full px-2.5 py-1.5 bg-white border rounded-lg text-xs font-mono font-bold focus:ring-1 focus:ring-emerald-500 ${
                    !selectedDefect.lengthMm ? 'border-amber-400 bg-amber-50/30' : 'border-slate-300'
                  }`}
                  value={selectedDefect.lengthMm === '' ? '' : selectedDefect.lengthMm}
                  onChange={(e) =>
                    updateSelectedDefect(
                      'lengthMm',
                      e.target.value === '' ? ('' as any) : parseFloat(e.target.value) || 0
                    )
                  }
                  disabled={readOnly}
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">
                  Trạng thái hoạt động *
                </label>
                <select
                  className={`w-full px-2.5 py-1.5 bg-white border rounded-lg text-xs font-medium focus:ring-1 focus:ring-emerald-500 ${
                    !selectedDefect.activityState ? 'border-amber-400 bg-amber-50/30' : 'border-slate-300'
                  }`}
                  value={selectedDefect.activityState}
                  onChange={(e) => updateSelectedDefect('activityState', e.target.value)}
                  disabled={readOnly}
                >
                  <option value="">--- Chọn trạng thái hoạt động ---</option>
                  <option value="U">U - Chưa rõ / Đang kiểm tra (Unknown)</option>
                  <option value="S">S - Ổn định / Nứt cũ (Stable)</option>
                  <option value="A">A - Đang phát triển / Hoạt động (Active)</option>
                </select>
              </div>
            </div>
          )}

          {/* Scoring Fields */}
          <div className={`grid grid-cols-1 ${mode === 'STRUCTURAL' ? 'sm:grid-cols-3' : 'sm:grid-cols-1'} gap-3 p-3 bg-white rounded-xl border border-slate-200`}>
            {mode === 'STRUCTURAL' && (
              <>
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-bold text-slate-700">
                      Ý nghĩa kết cấu (Nguồn E2) *
                    </label>
                    <InfoPopover title="Ý nghĩa kết cấu khuyết tật (Nguồn tính E2)" size="md">
                      <p><strong>Bản chất:</strong> Đánh giá mức độ ảnh hưởng của vết nứt/khuyết tật này tới khả năng chịu lực của kết cấu (cột, dầm, sàn, tường chịu lực).</p>
                      <p className="mt-1"><strong>Cách tính vào ECS:</strong> Điểm E2 toàn công trình sẽ lấy giá trị <em>LỚN NHẤT (Max)</em> từ tất cả các khuyết tật D được khảo sát.</p>
                      <ul className="list-disc pl-3.5 space-y-0.5 text-[11px] text-slate-600 mt-1.5 pt-1.5 border-t border-slate-100">
                        <li><strong>0đ (None):</strong> Vết nứt nông trang trí/vữa trát, không ảnh hưởng kết cấu.</li>
                        <li><strong>1đ (Low):</strong> Nứt vi mô bề mặt bê tông do co ngót, ngoài vùng chịu lực chính.</li>
                        <li><strong>2đ (Moderate):</strong> Nứt rõ ở cấu kiện chịu lực nhưng bề rộng ổn định, chưa suy giảm sức kháng cắt/uốn.</li>
                        <li><strong>3đ (High):</strong> Nứt chéo xiên 45° gần gối dầm/cột, hoặc nứt vùng nén (Tự động kích hoạt Review kết cấu).</li>
                        <li><strong>4đ (Critical):</strong> Bê tông bị vỡ vụn, nứt toác, cốt thép biến dạng cong vênh (Báo động nguy cấp).</li>
                      </ul>
                    </InfoPopover>
                  </div>
                  <select
                    className={`w-full px-2.5 py-1.5 bg-slate-50 border rounded-lg text-xs font-medium focus:ring-1 focus:ring-emerald-500 ${
                      selectedDefect.structuralSignificanceE2 === '' || selectedDefect.structuralSignificanceE2 === undefined
                        ? 'border-amber-400'
                        : 'border-slate-300'
                    }`}
                    value={selectedDefect.structuralSignificanceE2 ?? ''}
                    onChange={(e) =>
                      updateSelectedDefect(
                        'structuralSignificanceE2',
                        e.target.value === '' ? '' : parseInt(e.target.value, 10)
                      )
                    }
                    disabled={readOnly}
                  >
                    <option value="">--- Chọn mức ý nghĩa kết cấu (E2) ---</option>
                    <option value={0}>0đ - None / Không ảnh hưởng kết cấu</option>
                    <option value={1}>1đ - Low / Thấp (Nứt co ngót nhẹ)</option>
                    <option value={2}>2đ - Moderate / Trung bình (Nứt rõ, ổn định)</option>
                    <option value={3}>3đ - High / Cao (Nứt xiên gần gối / vùng nén)</option>
                    <option value={4}>4đ - Critical / Nguy cấp (Vỡ vụn bê tông / trơ thép)</option>
                  </select>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-xs font-bold text-slate-700">
                      Suy giảm vật liệu (Nguồn E4) *
                    </label>
                    <InfoPopover title="Suy giảm độ bền vật liệu (Nguồn tính E4)" size="md">
                      <p><strong>Bản chất:</strong> Mức độ thoái hóa, phong hóa, bong tróc của bê tông, cốt thép và gạch xây tại vị trí khuyết tật.</p>
                      <p className="mt-1"><strong>Cách tính vào ECS:</strong> Điểm E4 toàn công trình sẽ lấy giá trị <em>LỚN NHẤT (Max)</em> từ các khuyết tật D.</p>
                      <ul className="list-disc pl-3.5 space-y-0.5 text-[11px] text-slate-600 mt-1.5 pt-1.5 border-t border-slate-100">
                        <li><strong>0đ (Không/rất nhẹ):</strong> Bê tông chắc đặc, vạch không xước, không ẩm mốc.</li>
                        <li><strong>1đ (Cục bộ):</strong> Bong tróc nhẹ lớp sơn vôi hoặc vữa trát một vài điểm.</li>
                        <li><strong>2đ (Đáng kể):</strong> Rỗ tổ ong bê tông, phong hóa mục vữa diện rộng, chưa lộ cốt thép.</li>
                        <li><strong>3đ (Nặng/lộ thép):</strong> Bê tông nứt bong mảng làm lộ thanh thép gỉ sét, giảm tiết diện.</li>
                        <li><strong>4đ (Mất tiết diện):</strong> Cốt thép đứt rỉ nghiêm trọng, bê tông mục nát mất liên kết chịu lực.</li>
                      </ul>
                    </InfoPopover>
                  </div>
                  <select
                    className={`w-full px-2.5 py-1.5 bg-slate-50 border rounded-lg text-xs font-medium focus:ring-1 focus:ring-emerald-500 ${
                      selectedDefect.materialDegradationE4 === '' || selectedDefect.materialDegradationE4 === undefined
                        ? 'border-amber-400'
                        : 'border-slate-300'
                    }`}
                    value={selectedDefect.materialDegradationE4 ?? ''}
                    onChange={(e) =>
                      updateSelectedDefect(
                        'materialDegradationE4',
                        e.target.value === '' ? '' : parseInt(e.target.value, 10)
                      )
                    }
                    disabled={readOnly}
                  >
                    <option value="">--- Chọn mức suy giảm vật liệu (E4) ---</option>
                    <option value={0}>0đ - Không / Rất nhẹ</option>
                    <option value={1}>1đ - Cục bộ (Bong tróc nhẹ sơn vữa)</option>
                    <option value={2}>2đ - Đáng kể (Rỗ tổ ong, mục vữa diện rộng)</option>
                    <option value={3}>3đ - Nặng (Bê tông bung, cốt thép rỉ sét)</option>
                    <option value={4}>4đ - Mất tiết diện / Cốt thép đứt rỉ</option>
                  </select>
                </div>
              </>
            )}

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-bold text-slate-700">
                  Ảnh hưởng chức năng (Nguồn E6) *
                </label>
                <InfoPopover title="Ảnh hưởng chức năng sử dụng (Nguồn tính E6)" size="md">
                  <p><strong>Bản chất:</strong> Hậu quả của khuyết tật đến công năng sinh hoạt thực tế (thấm dột, kẹt cửa, thoát nạn, đường ống).</p>
                  <p className="mt-1"><strong>Cách tính vào ECS:</strong> Góp phần vào chỉ số tổng thể E6 cùng với tình trạng thấm dột, kẹt cửa toàn nhà.</p>
                  <ul className="list-disc pl-3.5 space-y-0.5 text-[11px] text-slate-600 mt-1.5 pt-1.5 border-t border-slate-100">
                    <li><strong>0đ (Không ảnh hưởng):</strong> Sinh hoạt, vận hành bình thường.</li>
                    <li><strong>1đ (Nhẹ):</strong> Ẩm mốc nhẹ hoặc kẹt 1–2 bộ cửa trong nhà ở mức nhẹ.</li>
                    <li><strong>2đ (Trung bình):</strong> Thấm nước tường/sàn hoặc kẹt 2–5 bộ cửa phải dùng lực mạnh.</li>
                    <li><strong>3đ (Nặng):</strong> Nước dột chảy thành dòng, kẹt trên 5 bộ cửa không đóng mở được.</li>
                    <li><strong>4đ (Nguy cấp):</strong> Nước rò rỉ gây nguy cơ chập cháy điện, hoặc cửa kẹt cứng chắn lối thoát hiểm khẩn cấp.</li>
                  </ul>
                </InfoPopover>
              </div>
              <select
                className={`w-full px-2.5 py-1.5 bg-slate-50 border rounded-lg text-xs font-medium focus:ring-1 focus:ring-emerald-500 ${
                  selectedDefect.functionalImpactE6 === '' || selectedDefect.functionalImpactE6 === undefined
                    ? 'border-amber-400 bg-amber-50/30'
                    : 'border-slate-300'
                }`}
                value={selectedDefect.functionalImpactE6 === '' || selectedDefect.functionalImpactE6 === undefined ? '' : selectedDefect.functionalImpactE6}
                onChange={(e) =>
                  updateSelectedDefect(
                    'functionalImpactE6',
                    e.target.value === '' ? '' : parseInt(e.target.value, 10)
                  )
                }
                disabled={readOnly}
              >
                <option value="">--- Chọn mức ảnh hưởng chức năng (E6) ---</option>
                <option value={0}>0đ - Không ảnh hưởng chức năng</option>
                <option value={1}>1đ - Ẩm mốc / Kẹt 1-2 cửa nhẹ</option>
                <option value={2}>2đ - Thấm nước / Kẹt 2-5 cửa</option>
                <option value={3}>3đ - Dột nước / Kẹt &gt;5 cửa</option>
                <option value={4}>4đ - Rò nước tràn / Cửa kẹt cứng hoàn toàn</option>
              </select>
            </div>
          </div>

          {/* Photo CU & Notes */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <PhotoCaptureInput
              label={`Ảnh cận cảnh Photo CU kèm thước đo (${selectedDefect.defectCode}) *:`}
              value={selectedDefect.cuPhotoUrl}
              onChange={(url) => updateSelectedDefect('cuPhotoUrl', url)}
              recommendedOrientation="landscape"
              orientationHint="Khuyến nghị: Chụp ảnh NGANG (4:3) cận cảnh kèm thẻ thước đo tỷ lệ"
              watermarkText={`PHOTO-CU | ${selectedDefect.defectCode} | ${selectedDefect.widthMaxMm || 0}mm`}
              annotationTitle={`Vẽ & Ghi chú trên ảnh Photo CU (${selectedDefect.defectCode})`}
              height="140px"
              required
            />

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Ghi chú chi tiết vết nứt *:
              </label>
              <textarea
                rows={4}
                placeholder="Mô tả cụ thể vị trí, hình thái nứt, mép nứt sắc cạnh hay đã trám trét..."
                className={`w-full px-2.5 py-1.5 bg-white border rounded-lg text-xs focus:ring-1 focus:ring-emerald-500 ${
                  !selectedDefect.notes ? 'border-amber-400 bg-amber-50/30' : 'border-slate-300'
                }`}
                value={selectedDefect.notes || ''}
                onChange={(e) => updateSelectedDefect('notes', e.target.value)}
                disabled={readOnly}
              />
            </div>
          </div>

          {/* Action footer: Chấm điểm mới quay trở lại canvas phía trên */}
          {!readOnly && (
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 border-t border-slate-200">
              <span className="text-xs text-slate-500">
                Đang sửa thông tin <strong>{selectedDefect.defectCode}</strong>. Bấm nút bên cạnh để chấm điểm khuyết tật mới.
              </span>
              <button
                type="button"
                onClick={() => {
                  setIsAddingPin(true);
                  containerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }}
                className="w-full sm:w-auto px-4 py-2 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-white rounded-xl text-xs font-bold shadow-sm transition-all flex items-center justify-center gap-2"
              >
                <Crosshair className="w-4 h-4" />
                <span>+ Chấm điểm khuyết tật mới ({nextDefectCode})</span>
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
