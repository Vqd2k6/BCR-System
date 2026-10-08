import React, { useState, useEffect } from 'react';
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
  Layers,
  Square,
  Maximize2,
  Droplets,
  DoorClosed,
  Download,
  Upload,
} from 'lucide-react';
import { UnitDefectItem } from '../types/condo-unit.types';
import { api } from '../../../services/api';

export const Step3_UnitDefectsAndSettlement: React.FC = () => {
  const { formData, updateFormData, addDefect, removeDefect, nextStep, prevStep } =
    useCondoUnitSurveyStore();

  const [isLoadingFloorPlan, setIsLoadingFloorPlan] = useState<boolean>(false);
  const [floorPlanData, setFloorPlanData] = useState<any>(null);
  const [showFloorPickerModal, setShowFloorPickerModal] = useState<boolean>(false);

  // New defect state
  const [newLocation, setNewLocation] = useState('');
  const [newType, setNewType] = useState<UnitDefectItem['type']>('CRACK');
  const [newWidth, setNewWidth] = useState<number | ''>('');
  const [newLength, setNewLength] = useState<number | ''>('');
  const [newDesc, setNewDesc] = useState('');
  const [newPhoto, setNewPhoto] = useState('');

  // Tự động kiểm tra và import CAD từ Tầng nếu căn con chưa có CAD URL
  useEffect(() => {
    if (!formData.unitCadUrl && formData.parcelId && formData.floorNumber) {
      loadFloorPlanAuto();
    }
  }, [formData.parcelId, formData.floorNumber]);

  const loadFloorPlanAuto = async () => {
    try {
      setIsLoadingFloorPlan(true);
      const res = await api.get(`/parcels/${formData.parcelId}/floor-plans/${formData.floorNumber}`);
      if (res.data?.success && res.data.data) {
        setFloorPlanData(res.data.data);
        const { units } = res.data.data;
        if (units && units.length > 0) {
          // Tìm căn hộ trùng khớp mã căn unitCode
          const matched = units.find(
            (u: any) => u.unit_code === formData.unitCode || u.unit_code.endsWith(formData.unitCode)
          );
          if (matched && matched.unit_cad_url) {
            updateFormData({
              unitCadUrl: matched.unit_cad_url,
              cadBbox: matched.cad_bbox,
              cadPolygon: matched.cad_polygon,
            });
          }
        }
      }
    } catch (_err) {
      console.warn('Chưa có floor plan hoặc lỗi nạp mặt bằng tầng');
    } finally {
      setIsLoadingFloorPlan(false);
    }
  };

  const handleManualImportCad = (unitCadUrl: string, bbox?: any) => {
    updateFormData({
      unitCadUrl,
      cadBbox: bbox || null,
    });
    setShowFloorPickerModal(false);
  };

  const handleAddDefect = () => {
    if (!newLocation.trim()) {
      alert('Vui lòng nhập vị trí khuyết tật (VD: Tường phòng khách, Dầm trần bếp...).');
      return;
    }

    const nextCode = `D-${String(formData.localDefects.length + 1).padStart(2, '0')}`;

    addDefect({
      defectCode: nextCode,
      location: newLocation,
      type: newType,
      crackWidthMm: Number(newWidth) || 0.2,
      crackLengthM: Number(newLength) || 1.0,
      description: newDesc,
      photoUrl: newPhoto,
      hasScaleCard: true,
    });

    setNewLocation('');
    setNewWidth('');
    setNewLength('');
    setNewDesc('');
    setNewPhoto('');
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-12 animate-in fade-in">
      {/* 3.1. Bản Vẽ CAD Mặt Bằng Căn Hộ (1-Click Import & Pinning) */}
      <Card className="border-slate-200 bg-white shadow-xs space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <Layers className="w-5 h-5 text-teal-600" />
            <div>
              <h2 className="text-base font-bold text-slate-800">
                3.1. Mặt Bằng CAD Căn Hộ {formData.unitCode} (Tầng {formData.floorNumber})
              </h2>
              <p className="text-xs text-slate-500">
                Tự động kế thừa từ mặt bằng Tòa Master đã chia cắt (Không cần vẽ lại)
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                setShowFloorPickerModal(true);
                loadFloorPlanAuto();
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-teal-50 hover:bg-teal-100 text-teal-700 border border-teal-200 text-xs font-bold transition-all shadow-2xs cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              Chọn lại từ Sơ đồ Tầng {formData.floorNumber}
            </button>
          </div>
        </div>

        {/* Khung hiển thị ảnh CAD căn hộ */}
        {formData.unitCadUrl ? (
          <div className="relative rounded-2xl border-2 border-teal-500/40 bg-slate-900 p-2 overflow-hidden flex flex-col items-center justify-center">
            <img
              src={formData.unitCadUrl}
              alt={`CAD Căn hộ ${formData.unitCode}`}
              className="max-h-[350px] w-auto object-contain rounded-xl select-none"
            />
            <div className="absolute top-4 left-4 bg-slate-900/90 text-teal-300 border border-teal-500/50 px-2.5 py-1 rounded-lg text-xs font-mono font-bold flex items-center gap-1.5 shadow-md">
              <CheckCircle2 className="w-3.5 h-3.5 text-teal-400" />
              CAD Căn {formData.unitCode} (Đã Import)
            </div>
          </div>
        ) : (
          <div className="p-6 bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200 flex flex-col items-center justify-center text-center space-y-3">
            <div className="p-3 bg-teal-50 text-teal-600 rounded-2xl border border-teal-200">
              <Layers className="w-6 h-6" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-slate-800">
                Chưa có mặt bằng CAD riêng cho căn {formData.unitCode}
              </h4>
              <p className="text-xs text-slate-500 max-w-md mt-1">
                Tòa Master chưa chia cắt ô cho căn {formData.unitCode} hoặc chưa nạp bản vẽ. Bạn có thể mở sơ đồ Tầng {formData.floorNumber} để chọn hoặc tải lên ảnh phác thảo sơ đồ căn hộ.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => {
                  setShowFloorPickerModal(true);
                  loadFloorPlanAuto();
                }}
                className="flex items-center gap-2 px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold shadow-xs cursor-pointer"
              >
                <Download className="w-4 h-4" />
                Mở Sơ Đồ Tầng {formData.floorNumber}
              </button>
            </div>
          </div>
        )}
      </Card>

      {/* 3.2. Hiện trạng đặc thù: Thấm dột trần từ lầu trên & Kẹt cửa biến dạng */}
      <Card className="border-slate-200 bg-white shadow-xs space-y-4">
        <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
          <AlertTriangle className="w-5 h-5 text-amber-600" />
          <div>
            <h2 className="text-base font-bold text-slate-800">
              3.2. Hiện Trạng Thấm Dột Trần & Biến Dạng Cửa
            </h2>
            <p className="text-xs text-slate-500">
              Thu thập các chỉ tiêu đặc thù căn hộ chung cư phục vụ đối chiếu bồi thường
            </p>
          </div>
        </div>

        {/* Thấm dột trần lầu trên */}
        <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
              <Droplets className="w-4 h-4 text-sky-600" />
              Thấm dột từ căn hộ tầng trên dội xuống (Upper Floor Leakage)
            </span>
            <label className="flex items-center gap-2 text-xs font-bold text-slate-700 cursor-pointer">
              <input
                type="checkbox"
                checked={formData.upperFloorWaterLeakage?.has}
                onChange={(e) =>
                  updateFormData({
                    upperFloorWaterLeakage: {
                      ...formData.upperFloorWaterLeakage,
                      has: e.target.checked,
                    },
                  })
                }
                className="rounded text-teal-600 focus:ring-teal-500 w-4 h-4"
              />
              <span>{formData.upperFloorWaterLeakage?.has ? 'CÓ THẤM DỘT' : 'KHÔNG'}</span>
            </label>
          </div>

          {formData.upperFloorWaterLeakage?.has && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
              <Input
                label="Vị trí trần bị thấm dột"
                placeholder="VD: Trần thạch cao phòng khách, Cạnh hộp gen toilet..."
                value={formData.upperFloorWaterLeakage?.location || ''}
                onChange={(e) =>
                  updateFormData({
                    upperFloorWaterLeakage: {
                      ...formData.upperFloorWaterLeakage,
                      location: e.target.value,
                    },
                  })
                }
              />
              <Input
                label="Mô tả mức độ ố vàng / bong tróc"
                placeholder="VD: Ố vàng loang lổ diện tích 0.5m2, bong tróc sơn..."
                value={formData.upperFloorWaterLeakage?.description || ''}
                onChange={(e) =>
                  updateFormData({
                    upperFloorWaterLeakage: {
                      ...formData.upperFloorWaterLeakage,
                      description: e.target.value,
                    },
                  })
                }
              />
            </div>
          )}
        </div>

        {/* Biến dạng & Kẹt cửa */}
        <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
          <div className="flex items-center gap-2">
            <DoorClosed className="w-4 h-4 text-teal-600" />
            <span className="text-xs font-bold text-slate-800">
              Kiểm tra biến dạng cửa chính, cửa thông phòng và cửa ban công
            </span>
          </div>

          <Select
            label="Trạng thái đóng mở cửa *"
            value={formData.doorJammingStatus || 'NORMAL'}
            onChange={(e) => updateFormData({ doorJammingStatus: e.target.value as any })}
            options={[
              { value: 'NORMAL', label: 'Bình thường: Đóng mở nhẹ nhàng, không cạ nền' },
              { value: 'JAMMED', label: 'Bị kẹt cánh / khó đóng mở do khung bao biến dạng' },
              { value: 'RUBBING_FLOOR', label: 'Xệ cánh: Bản lề xệ cạ mặt gạch lát sàn' },
              { value: 'CRACKED_GLASS', label: 'Nứt rạn kính: Kính cửa sổ/ban công bị rạn nứt' },
            ]}
          />
        </div>
      </Card>

      {/* 3.3. Sổ Khuyết Tật & Vết Nứt Căn Hộ */}
      <Card className="border-slate-200 bg-white shadow-xs space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <Maximize2 className="w-5 h-5 text-teal-600" />
            <h2 className="text-base font-bold text-slate-800">
              3.3. Danh Mục Vết Nứt & Khuyết Tật Căn Hộ ({formData.localDefects.length})
            </h2>
          </div>
          <span className="text-xs text-slate-500">
            Chụp ảnh cận cảnh thước đo Crack Scale Card $\ge 0.1$mm
          </span>
        </div>

        {/* Danh sách khuyết tật đã thêm */}
        <div className="space-y-3">
          {formData.localDefects.map((d, idx) => (
            <div
              key={d.id}
              className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200 flex items-start justify-between gap-3 text-xs"
            >
              <div className="flex items-start gap-3">
                <span className="font-mono font-bold text-xs px-2 py-1 rounded bg-teal-100 text-teal-800 border border-teal-200">
                  {d.defectCode || `D-${String(idx + 1).padStart(2, '0')}`}
                </span>
                <div>
                  <h4 className="font-bold text-slate-900">{d.location}</h4>
                  <p className="text-slate-600 mt-0.5">
                    Bề rộng: <strong>{d.crackWidthMm}mm</strong> • Chiều dài: <strong>{d.crackLengthM}m</strong>
                  </p>
                  {d.description && <p className="text-slate-500 italic mt-0.5">{d.description}</p>}
                </div>
              </div>

              <div className="flex items-center gap-2">
                {d.photoUrl && (
                  <img
                    src={d.photoUrl}
                    alt="CU"
                    className="w-12 h-12 rounded-lg object-cover border border-slate-300"
                  />
                )}
                <button
                  type="button"
                  onClick={() => removeDefect(d.id)}
                  className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-50 cursor-pointer"
                  title="Xóa khuyết tật"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}

          {formData.localDefects.length === 0 && (
            <div className="p-4 text-center text-xs text-slate-500 bg-slate-50 rounded-2xl border border-slate-200">
              Chưa ghi nhận khuyết tật nứt nào trong căn hộ. Điền biểu mẫu bên dưới để thêm vết nứt nếu có.
            </div>
          )}
        </div>

        {/* Form thêm khuyết tật mới */}
        <div className="p-4 bg-teal-50/50 rounded-2xl border border-teal-200/80 space-y-3">
          <h4 className="text-xs font-bold text-teal-950 flex items-center gap-1.5">
            <Plus className="w-4 h-4 text-teal-600" />
            Thêm Vết Nứt Mới Tại Căn Hộ
          </h4>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Input
              label="Vị trí vết nứt *"
              placeholder="VD: Mép tường phòng khách, Dầm trần bếp..."
              value={newLocation}
              onChange={(e) => setNewLocation(e.target.value)}
            />
            <Input
              label="Bề rộng vết nứt (mm) *"
              type="number"
              step="0.05"
              placeholder="VD: 0.2"
              value={newWidth === '' ? '' : newWidth}
              onChange={(e) => setNewWidth(e.target.value === '' ? '' : Number(e.target.value))}
            />
            <Input
              label="Chiều dài ước tính (m)"
              type="number"
              step="0.1"
              placeholder="VD: 1.2"
              value={newLength === '' ? '' : newLength}
              onChange={(e) => setNewLength(e.target.value === '' ? '' : Number(e.target.value))}
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input
              label="Mô tả đặc điểm vết nứt"
              placeholder="VD: Nứt chéo mép cửa sổ, nứt chân chim mảng vữa trát..."
              value={newDesc}
              onChange={(e) => setNewDesc(e.target.value)}
            />
            <div>
              <PhotoCaptureInput
                label="Ảnh cận cảnh vết nứt có thước đo (CU >= 0.1mm)"
                value={newPhoto}
                onChange={setNewPhoto}
                watermarkText={`CU | Căn ${formData.unitCode} | ${newLocation || 'CRACK'}`}
                height="100px"
              />
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="button"
              onClick={handleAddDefect}
              className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold shadow-xs cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              Lưu Vết Nứt Vào Sổ
            </button>
          </div>
        </div>
      </Card>

      {/* Action Footer */}
      <div className="flex items-center justify-between gap-4 pt-4 border-t border-slate-200">
        <Button variant="secondary" size="md" onClick={prevStep} icon={<ArrowLeft className="w-4 h-4" />}>
          Bước 2 (Thông tin căn)
        </Button>
        <Button
          size="lg"
          className="bg-teal-600 hover:bg-teal-700 text-white"
          onClick={nextStep}
          icon={<ArrowRight className="w-4 h-4" />}
        >
          Tiếp tục: Bước 4 (Ký biên bản & Nộp) ➔
        </Button>
      </div>

      {/* Modal Chọn Ô Căn Hộ Từ Bản Đồ Tầng */}
      {showFloorPickerModal && (
        <div className="fixed inset-0 z-[100002] bg-slate-900/80 backdrop-blur-xs flex items-center justify-center p-3 animate-in fade-in">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden text-white">
            <div className="flex items-center justify-between px-5 py-3.5 bg-slate-850 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Layers className="w-5 h-5 text-teal-400" />
                <h3 className="text-sm font-bold text-white">
                  Sơ Đồ Mặt Bằng Tầng {formData.floorNumber} • Chọn Căn {formData.unitCode} Để Import CAD
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowFloorPickerModal(false)}
                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-4">
              {floorPlanData?.plan?.cad_photo_url ? (
                <div className="space-y-4">
                  <div className="relative rounded-2xl overflow-hidden border border-slate-700 bg-slate-950 flex items-center justify-center p-2">
                    <img
                      src={floorPlanData.plan.cad_photo_url}
                      alt="Floor plan"
                      className="max-h-[50vh] object-contain select-none"
                    />

                    {/* Highlight partitions */}
                    {floorPlanData.units?.map((u: any) => {
                      if (!u.cad_bbox) return null;
                      const isTarget = u.unit_code === formData.unitCode;
                      return (
                        <div
                          key={u.id}
                          onClick={() => handleManualImportCad(u.unit_cad_url || floorPlanData.plan.cad_photo_url, u.cad_bbox)}
                          style={{
                            left: `${u.cad_bbox.x}%`,
                            top: `${u.cad_bbox.y}%`,
                            width: `${u.cad_bbox.width}%`,
                            height: `${u.cad_bbox.height}%`,
                          }}
                          className={`absolute rounded cursor-pointer border-2 transition-all flex items-center justify-center ${
                            isTarget
                              ? 'border-teal-400 bg-teal-500/40 ring-2 ring-teal-400 z-20'
                              : 'border-slate-500 bg-slate-800/40 hover:bg-slate-700/60 z-10'
                          }`}
                        >
                          <span className="px-1.5 py-0.5 rounded text-[10px] font-mono font-bold bg-slate-900 text-white">
                            {u.unit_code}
                          </span>
                        </div>
                      );
                    })}
                  </div>

                  {/* Danh sách các ô căn có CAD để click */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {floorPlanData.units?.map((u: any) => (
                      <button
                        key={u.id}
                        type="button"
                        onClick={() => handleManualImportCad(u.unit_cad_url || floorPlanData.plan.cad_photo_url, u.cad_bbox)}
                        className={`p-2.5 rounded-xl border text-left text-xs font-bold flex items-center justify-between transition-all ${
                          u.unit_code === formData.unitCode
                            ? 'bg-teal-600 text-white border-teal-500 shadow-md'
                            : 'bg-slate-800 hover:bg-slate-750 text-slate-300 border-slate-700'
                        }`}
                      >
                        <span>Căn {u.unit_code}</span>
                        {u.unit_cad_url && <span className="text-[10px] text-teal-300">CAD ✓</span>}
                      </button>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="p-8 text-center text-slate-400 text-xs">
                  {isLoadingFloorPlan
                    ? 'Đang tải dữ liệu mặt bằng...'
                    : `Chưa có bản vẽ CAD mặt bằng cho Tầng ${formData.floorNumber}. Vui lòng mở "Bản Vẽ CAD Tầng" trên Building Hub để tải lên bản vẽ trước.`}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
