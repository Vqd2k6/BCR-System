import React, { useState } from 'react';
import { useCondoUnitSurveyStore } from '../store/useCondoUnitSurveyStore';
import { Card } from '../../../core/components/ui/Card';
import { Button } from '../../../core/components/ui/Button';
import { Input, Select } from '../../../core/components/ui/FormControls';
import { PhotoCaptureInput } from '../../../components/common/PhotoCaptureInput';
import {
  AlertTriangle,
  Plus,
  Trash2,
  ArrowRight,
  ArrowLeft,
  Camera,
  CheckCircle2,
  Maximize2,
} from 'lucide-react';
import { UnitDefectItem } from '../types/condo-unit.types';

export const Step3_UnitDefectsAndSettlement: React.FC = () => {
  const { formData, updateFormData, addDefect, removeDefect, nextStep, prevStep } = useCondoUnitSurveyStore();

  const [newLocation, setNewLocation] = useState('');
  const [newType, setNewType] = useState<UnitDefectItem['type']>('CRACK');
  const [newWidth, setNewWidth] = useState<number | ''>('');
  const [newLength, setNewLength] = useState<number | ''>('');
  const [newDesc, setNewDesc] = useState('');
  const [newPhoto, setNewPhoto] = useState('');

  const handleAddDefect = () => {
    if (!newLocation.trim()) {
      alert('Vui lòng nhập vị trí khuyết tật (VD: Tường phòng khách, Góc cửa...).');
      return;
    }

    addDefect({
      location: newLocation,
      type: newType,
      crackWidthMm: Number(newWidth) || 0.2,
      crackLengthM: Number(newLength) || 1.0,
      description: newDesc,
      photoUrl: newPhoto,
    });

    // Reset form
    setNewLocation('');
    setNewWidth('');
    setNewLength('');
    setNewDesc('');
    setNewPhoto('');
  };

  return (
    <div className="space-y-6 max-w-3xl mx-auto pb-12 animate-in fade-in">
      {/* 3.1. Hiện trạng lún lệch / biến dạng tại căn hộ */}
      <Card className="border-slate-200 bg-white shadow-xs">
        <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-amber-600" />
            <h2 className="text-base font-bold text-slate-800">
              3.1. Hiện Trạng Biến Dạng & Lún Lệch Cục Bộ Tại Căn Hộ
            </h2>
          </div>
          <span className="text-xs text-slate-500">
            Đánh giá riêng theo vị trí căn hộ
          </span>
        </div>

        <div className="space-y-4">
          <Select
            label="Mức độ biểu hiện biến dạng / kẹt cửa tại căn hộ *"
            value={formData.settlementObserved}
            onChange={(e) => updateFormData({ settlementObserved: e.target.value as any })}
            options={[
              { value: 'NONE', label: 'Cấp 0: Bình thường (Không có dấu hiệu nứt xé hay kẹt cửa)' },
              { value: 'SLIGHT', label: 'Cấp 1: Nhẹ (Có vết nứt chân chim < 0.5mm, cửa đóng mở bình thường)' },
              { value: 'NOTICEABLE', label: 'Cấp 2: Rõ rệt (Kẹt nhẹ cửa ban công / cửa sổ, nứt tường 0.5 - 2.0mm)' },
              { value: 'SEVERE', label: 'Cấp 3: Nghiêm trọng (Nứt vỡ dầm/sàn > 2.0mm, gạch nền bong rộp)' },
            ]}
          />

          <Input
            label="Ghi chú chi tiết biểu hiện hiện trạng tại căn hộ"
            placeholder="VD: Cửa lùa ban công bị cạ nhẹ ray; Gạch ốp tường nhà vệ sinh nứt nhẹ góc trên..."
            value={formData.settlementNotes}
            onChange={(e) => updateFormData({ settlementNotes: e.target.value })}
          />
        </div>
      </Card>

      {/* 3.2. Danh sách vết nứt & khuyết tật riêng của căn hộ */}
      <Card className="border-slate-200 bg-white shadow-xs space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <Maximize2 className="w-5 h-5 text-teal-600" />
            <h2 className="text-base font-bold text-slate-800">
              3.2. Danh Mục Khuyết Tật & Vết Nứt Riêng Của Căn Hộ
            </h2>
          </div>
          <span className="text-xs bg-slate-100 text-slate-700 font-bold px-2 py-0.5 rounded">
            Đã ghi nhận: {formData.localDefects.length} điểm
          </span>
        </div>

        {/* Danh sách các khuyết tật đã thêm */}
        {formData.localDefects.length === 0 ? (
          <div className="p-4 rounded-xl border border-dashed border-slate-300 text-center text-xs text-slate-500">
            Chưa có khuyết tật nào được ghi nhận. Nếu căn hộ có vết nứt, thấm dột hoặc bong rộp, hãy nhập bên dưới.
          </div>
        ) : (
          <div className="space-y-2.5">
            {formData.localDefects.map((d, idx) => (
              <div
                key={d.id}
                className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between gap-3 text-xs"
              >
                <div className="flex items-center gap-3 min-w-0">
                  {d.photoUrl ? (
                    <img src={d.photoUrl} alt={d.location} className="w-12 h-12 object-cover rounded-lg shrink-0 border" />
                  ) : (
                    <div className="w-12 h-12 rounded-lg bg-slate-200 flex items-center justify-center text-slate-400 shrink-0">
                      <Camera className="w-5 h-5" />
                    </div>
                  )}
                  <div className="min-w-0">
                    <span className="font-bold text-slate-800 block truncate">
                      #{idx + 1}. {d.location} ({d.type === 'CRACK' ? 'Vết nứt' : d.type === 'WATER_LEAKAGE' ? 'Thấm dột' : 'Bong rộp'})
                    </span>
                    <span className="text-slate-500 block truncate">
                      Bề rộng: <strong>{d.crackWidthMm}mm</strong> • Dài: <strong>{d.crackLengthM}m</strong>
                    </span>
                    {d.description && <span className="text-slate-600 italic block truncate">{d.description}</span>}
                  </div>
                </div>

                <Button
                  variant="danger"
                  size="sm"
                  onClick={() => removeDefect(d.id)}
                  className="p-1.5 shrink-0"
                  icon={<Trash2 className="w-3.5 h-3.5" />}
                />
              </div>
            ))}
          </div>
        )}

        {/* Form thêm khuyết tật mới */}
        <div className="p-4 bg-teal-50/40 rounded-xl border border-teal-200/70 space-y-3 pt-3">
          <span className="text-xs font-bold text-teal-900 block">
            + Thêm khuyết tật / Vết nứt mới tại căn hộ:
          </span>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              label="Vị trí khuyết tật *"
              placeholder="VD: Tường phòng khách cạnh cửa sổ"
              value={newLocation}
              onChange={(e) => setNewLocation(e.target.value)}
            />

            <Select
              label="Loại khuyết tật"
              value={newType}
              onChange={(e) => setNewType(e.target.value as any)}
              options={[
                { value: 'CRACK', label: 'Vết nứt tường / trần' },
                { value: 'WATER_LEAKAGE', label: 'Thấm dột / Ẩm mốc' },
                { value: 'PEELING', label: 'Bong tróc vữa / Gạch phồng' },
                { value: 'OTHER', label: 'Khuyết tật khác' },
              ]}
            />

            <Input
              label="Bề rộng vết nứt (mm)"
              type="number"
              step="0.1"
              placeholder="VD: 0.3"
              value={newWidth}
              onChange={(e) => setNewWidth(Number(e.target.value) || '')}
            />

            <Input
              label="Chiều dài vết nứt (m)"
              type="number"
              step="0.1"
              placeholder="VD: 1.2"
              value={newLength}
              onChange={(e) => setNewLength(Number(e.target.value) || '')}
            />

            <div className="sm:col-span-2">
              <Input
                label="Mô tả chi tiết đặc điểm khuyết tật"
                placeholder="VD: Nứt chéo 45 độ từ góc lanh-tô cửa sổ ra hướng ban công..."
                value={newDesc}
                onChange={(e) => setNewDesc(e.target.value)}
              />
            </div>

            <div className="sm:col-span-2">
              <PhotoCaptureInput
                label="Ảnh chụp cận cảnh khuyết tật"
                value={newPhoto}
                onChange={(url) => setNewPhoto(url)}
                watermarkText={`DEFECT | ${formData.unitCode || 'UNIT'} | ${newLocation || 'LOC'}`}
                height="110px"
              />
            </div>
          </div>

          <div className="flex justify-end pt-1">
            <Button
              size="md"
              className="bg-teal-700 hover:bg-teal-800 text-white"
              onClick={handleAddDefect}
              icon={<Plus className="w-4 h-4" />}
            >
              Ghi nhận khuyết tật này
            </Button>
          </div>
        </div>
      </Card>

      {/* Action Footer */}
      <div className="flex items-center justify-between gap-4 pt-4 border-t border-slate-200">
        <Button variant="secondary" size="md" onClick={prevStep}>
          ◀ Bước 2 (Thông tin căn hộ)
        </Button>
        <Button size="lg" className="bg-teal-600 hover:bg-teal-700 text-white" onClick={nextStep}>
          Tiếp tục: Bước 4 (Ký biên bản hiện trạng) ➔
        </Button>
      </div>
    </div>
  );
};
