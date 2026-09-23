import React, { useState, useRef } from 'react';
import { Crosshair, Trash2, Camera, AlertCircle, CheckCircle2, Ruler, Sparkles, MapPin } from 'lucide-react';
import { PhotoCaptureInput } from '../common/PhotoCaptureInput';
import { InfoPopover } from '../../core/components/ui/InfoPopover';

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
  functionalImpactE6?: number;
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

const SCREENING_CATEGORIES = [
  'Nứt tường / Vữa trát',
  'Nứt cấu kiện kết cấu (Cột/Dầm/Sàn)',
  'Lún chênh / Võng cấu kiện',
  'Thấm dột / Ẩm mốc',
  'Bong tróc / Rỉ cốt thép',
  'Kẹt cửa / Biến dạng khung',
  'Khác',
];

export const DefectPinningCanvas: React.FC<Props> = ({
  ctxPhotoUrl,
  defects,
  onChange,
  readOnly = false,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const detailFormRef = useRef<HTMLDivElement>(null);
  const [selectedDefectIndex, setSelectedDefectIndex] = useState<number | null>(null);
  const [isAddingPin, setIsAddingPin] = useState<boolean>(true); // Default to pin mode for quick marking

  const nextDefectCode = `D-${String(defects.length + 1).padStart(2, '0')}`;

  const handleContainerClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (readOnly || !isAddingPin || !containerRef.current || !ctxPhotoUrl) return;

    const rect = containerRef.current.getBoundingClientRect();
    const x = parseFloat((((e.clientX - rect.left) / rect.width) * 100).toFixed(2));
    const y = parseFloat((((e.clientY - rect.top) / rect.height) * 100).toFixed(2));

    const newDefectCode = `D-${String(defects.length + 1).padStart(2, '0')}`;

    const newDefect: DefectItem = {
      defectCode: newDefectCode,
      pinX: x,
      pinY: y,
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

  // Kiểm tra xem 1 điểm D đã được điền thông tin chi tiết chưa
  const isDefectFilled = (d: DefectItem) => {
    return Boolean(d.cuPhotoUrl || (d.notes && d.notes.trim().length > 0) || (d.lengthMm && d.lengthMm > 0 && d.widthMaxMm > 0));
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
                Đã điền ({defects.filter(isDefectFilled).length})
              </span>
              <span className="flex items-center gap-1 text-amber-700 font-medium">
                <span className="w-2 h-2 rounded-xs bg-amber-500 inline-block" />
                Chưa điền ({defects.filter((d) => !isDefectFilled(d)).length})
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
        }`}
      >
        <img
          src={ctxPhotoUrl}
          alt="Context CTX view"
          className="w-full h-full object-contain block max-h-[480px] mx-auto"
        />

        {/* Render Pins with State-dependent Colors */}
        {defects.map((d, idx) => {
          const isSelected = selectedDefectIndex === idx;
          const isCritical = d.isStructuralCritical || d.structuralSignificanceE2 >= 3;
          const isFilled = isDefectFilled(d);

          // Màu sắc ghim: Đã điền (Emerald/Green), Chưa điền (Amber), Nguy cấp (Red), Đang chọn (Royal Blue)
          let tagBg = isFilled ? '#059669' : '#d97706';
          let squareBg = isFilled ? '#10b981' : '#f59e0b';

          if (isCritical) {
            tagBg = '#dc2626';
            squareBg = '#ef4444';
          }
          if (isSelected) {
            tagBg = '#0284c7';
            squareBg = '#38bdf8';
          }

          return (
            <div
              key={d.defectCode || idx}
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
                zIndex: isSelected ? 35 : 20,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
              }}
            >
              {/* Pin Tooltip Box */}
              <div
                style={{
                  backgroundColor: tagBg,
                  color: '#ffffff',
                  fontSize: '0.65rem',
                  fontWeight: 800,
                  padding: '0.15rem 0.4rem',
                  borderRadius: '3px',
                  whiteSpace: 'nowrap',
                  boxShadow: '0 2px 5px rgba(0,0,0,0.3)',
                  border: isSelected ? '1.5px solid #ffffff' : 'none',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.2rem',
                }}
              >
                <span>{d.defectCode}</span>
                <span>• {d.widthMaxMm}mm</span>
                {isFilled && <span style={{ fontSize: '0.6rem' }}>✓</span>}
              </div>

              {/* Pin Point - Square icon shape */}
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
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-1 bg-slate-900 text-white font-mono font-bold text-xs rounded-lg">
                {selectedDefect.defectCode}
              </span>
              <span className="font-bold text-sm text-slate-800">
                Thông số chi tiết vết nứt / khuyết tật ({selectedDefect.defectCode})
              </span>
              {isDefectFilled(selectedDefect) ? (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200 flex items-center gap-1">
                  <CheckCircle2 className="w-3 h-3" />
                  Đã điền đầy đủ
                </span>
              ) : (
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-200">
                  ● Đang cập nhật thông tin
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
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Nhóm chỉ báo:</label>
              <select
                className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-medium focus:ring-1 focus:ring-emerald-500"
                value={selectedDefect.screeningCategory}
                onChange={(e) => updateSelectedDefect('screeningCategory', e.target.value)}
                disabled={readOnly}
              >
                {SCREENING_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Dạng nứt / Cấu kiện:</label>
              <select
                className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-medium focus:ring-1 focus:ring-emerald-500"
                value={selectedDefect.defectType}
                onChange={(e) => updateSelectedDefect('defectType', e.target.value)}
                disabled={readOnly}
              >
                {COMMON_DEFECT_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Hướng nứt:</label>
              <input
                type="text"
                placeholder="VD: Xiên 45 độ, dọc theo cột..."
                className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs focus:ring-1 focus:ring-emerald-500"
                value={selectedDefect.crackDirection || ''}
                onChange={(e) => updateSelectedDefect('crackDirection', e.target.value)}
                disabled={readOnly}
              />
            </div>
          </div>

          {/* Dimensions & Scale */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">
                Bề rộng lớn nhất w_max (mm):
              </label>
              <input
                type="number"
                step="0.05"
                min="0"
                className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-mono font-bold focus:ring-1 focus:ring-emerald-500"
                value={selectedDefect.widthMaxMm}
                onChange={(e) => updateSelectedDefect('widthMaxMm', parseFloat(e.target.value) || 0)}
                disabled={readOnly}
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Chiều dài nứt L (mm):</label>
              <input
                type="number"
                step="10"
                min="0"
                className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-mono font-bold focus:ring-1 focus:ring-emerald-500"
                value={selectedDefect.lengthMm}
                onChange={(e) => updateSelectedDefect('lengthMm', parseFloat(e.target.value) || 0)}
                disabled={readOnly}
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Trạng thái hoạt động:</label>
              <select
                className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-medium focus:ring-1 focus:ring-emerald-500"
                value={selectedDefect.activityState}
                onChange={(e) => updateSelectedDefect('activityState', e.target.value)}
                disabled={readOnly}
              >
                <option value="U">U - Chưa rõ / Đang kiểm tra (Unknown)</option>
                <option value="S">S - Ổn định / Nứt cũ (Stable)</option>
                <option value="A">A - Đang phát triển / Hoạt động (Active)</option>
              </select>
            </div>
          </div>

          {/* Scoring Fields */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3 bg-white rounded-xl border border-slate-200">
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-bold text-slate-700">
                  Ý nghĩa kết cấu (Nguồn E2):
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
                className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs font-medium focus:ring-1 focus:ring-emerald-500"
                value={selectedDefect.structuralSignificanceE2}
                onChange={(e) => updateSelectedDefect('structuralSignificanceE2', parseInt(e.target.value, 10))}
                disabled={readOnly}
              >
                <option value={0}>0đ - None / Không ảnh hưởng</option>
                <option value={1}>1đ - Low / Thấp</option>
                <option value={2}>2đ - Moderate / Trung bình</option>
                <option value={3}>3đ - High / Cao</option>
                <option value={4}>4đ - Critical / Cảnh báo sập</option>
              </select>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-bold text-slate-700">
                  Suy giảm vật liệu (Nguồn E4):
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
                className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs font-medium focus:ring-1 focus:ring-emerald-500"
                value={selectedDefect.materialDegradationE4}
                onChange={(e) => updateSelectedDefect('materialDegradationE4', parseInt(e.target.value, 10))}
                disabled={readOnly}
              >
                <option value={0}>0đ - Không / Rất nhẹ</option>
                <option value={1}>1đ - Cục bộ (Bong tróc nhẹ)</option>
                <option value={2}>2đ - Đáng kể (Bong mảng rộng)</option>
                <option value={3}>3đ - Nặng (Bê tông bung, cốt thép rỉ)</option>
                <option value={4}>4đ - Mất tiết diện / Ảnh hưởng chịu lực</option>
              </select>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-bold text-slate-700">
                  Ảnh hưởng chức năng (Nguồn E6):
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
                className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs font-medium focus:ring-1 focus:ring-emerald-500"
                value={selectedDefect.functionalImpactE6 || 0}
                onChange={(e) => updateSelectedDefect('functionalImpactE6', parseInt(e.target.value, 10))}
                disabled={readOnly}
              >
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
              label={`Ảnh cận cảnh Photo CU kèm thước đo (${selectedDefect.defectCode}):`}
              value={selectedDefect.cuPhotoUrl}
              onChange={(url) => updateSelectedDefect('cuPhotoUrl', url)}
              watermarkText={`PHOTO-CU | ${selectedDefect.defectCode} | ${selectedDefect.widthMaxMm}mm`}
              height="140px"
            />

            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Ghi chú vết nứt:</label>
              <textarea
                rows={4}
                placeholder="Mô tả cụ thể vị trí, hình thái nứt..."
                className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs focus:ring-1 focus:ring-emerald-500"
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
