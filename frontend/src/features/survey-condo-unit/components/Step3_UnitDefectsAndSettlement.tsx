import React, { useState, useEffect, useRef } from 'react';
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
  CheckCircle2,
  Layers,
  Maximize2,
  Droplets,
  DoorClosed,
  Download,
  Crosshair,
  Activity,
  MapPin,
  Info,
} from 'lucide-react';
import {
  isDoorJammingStatus,
  type UnitDefectItem,
  type CondoWaterLeakageItem,
  type CadBbox,
  type CadPolygon,
} from '../types/condo-unit.types';
import { api } from '../../../services/api';
import { formatShortUnitDisplay } from '../../../core/utils/codeFormattingUtils';

interface FloorPlanUnitItem {
  id: string;
  unit_code: string;
  unit_cad_url?: string;
  cad_bbox?: CadBbox | null;
  cad_polygon?: CadPolygon | null;
}

interface FloorPlanData {
  plan?: {
    cad_photo_url?: string;
  };
  units?: FloorPlanUnitItem[];
}

export const Step3_UnitDefectsAndSettlement: React.FC = () => {
  const { formData, updateFormData, addDefect, removeDefect, nextStep, prevStep } =
    useCondoUnitSurveyStore();

  const [isLoadingFloorPlan, setIsLoadingFloorPlan] = useState<boolean>(false);
  const [floorPlanData, setFloorPlanData] = useState<FloorPlanData | null>(null);
  const [showFloorPickerModal, setShowFloorPickerModal] = useState<boolean>(false);

  // New defect state
  const [newLocation, setNewLocation] = useState('');
  const [newType, setNewType] = useState<UnitDefectItem['type']>('CRACK');
  const [newWidth, setNewWidth] = useState<number | ''>('');
  const [newLength, setNewLength] = useState<number | ''>('');
  const [newDesc, setNewDesc] = useState('');
  const [newCtxPhoto, setNewCtxPhoto] = useState('');
  const [newCuPhoto, setNewCuPhoto] = useState('');
  const [newPinX, setNewPinX] = useState<number | null>(null);
  const [newPinY, setNewPinY] = useState<number | null>(null);

  // Multi-item water leakage state
  const [newLeakLocation, setNewLeakLocation] = useState('');
  const [newLeakDesc, setNewLeakDesc] = useState('');
  const [newLeakCtxPhoto, setNewLeakCtxPhoto] = useState('');
  const [newLeakCuPhoto, setNewLeakCuPhoto] = useState('');

  const cadContainerRef = useRef<HTMLDivElement>(null);

  const bCode = formData.parentInfo?.projectParcelCode || 'GENERAL';
  const fNum = Number(formData.floorNumber);
  const floorCode = isNaN(fNum)
    ? String(formData.floorNumber || 'F01')
    : fNum < 0
      ? `B${String(Math.abs(fNum)).padStart(2, '0')}`
      : fNum === 0
        ? 'G'
        : `F${String(fNum).padStart(2, '0')}`;

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
          const matched = units.find(
            (u: FloorPlanUnitItem) => u.unit_code === formData.unitCode || u.unit_code?.endsWith(formData.unitCode)
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

  const handleManualImportCad = (unitCadUrl: string, bbox?: CadBbox | null) => {
    updateFormData({
      unitCadUrl,
      cadBbox: bbox || null,
    });
    setShowFloorPickerModal(false);
  };

  // Tương tác chạm thả ghim trên CAD căn hộ
  const handleCadClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!cadContainerRef.current) return;
    const rect = cadContainerRef.current.getBoundingClientRect();
    const xPct = ((e.clientX - rect.left) / rect.width) * 100;
    const yPct = ((e.clientY - rect.top) / rect.height) * 100;
    const roundedX = Math.round(Math.max(0, Math.min(100, xPct)) * 10) / 10;
    const roundedY = Math.round(Math.max(0, Math.min(100, yPct)) * 10) / 10;
    setNewPinX(roundedX);
    setNewPinY(roundedY);
  };

  const handleAddDefect = () => {
    if (!newLocation.trim()) {
      alert('Vui lòng nhập vị trí khuyết tật (VD: Tường phòng khách, Dầm trần bếp...).');
      return;
    }

    const nextCode = `D-${String(formData.localDefects.length + 1).padStart(2, '0')}`;
    const primaryPhoto = newCuPhoto || newCtxPhoto || '';

    addDefect({
      defectCode: nextCode,
      pinX: newPinX,
      pinY: newPinY,
      location: newLocation.trim(),
      type: newType,
      crackWidthMm: Number(newWidth) || 0.2,
      crackLengthM: Number(newLength) || 1.0,
      description: newDesc.trim(),
      photoUrl: primaryPhoto,
      ctxPhotoUrl: newCtxPhoto || undefined,
      cuPhotoUrl: newCuPhoto || undefined,
      hasScaleCard: true,
    });

    setNewLocation('');
    setNewWidth('');
    setNewLength('');
    setNewDesc('');
    setNewCtxPhoto('');
    setNewCuPhoto('');
    setNewPinX(null);
    setNewPinY(null);
  };

  // Thêm điểm thấm dột trần lầu trên
  const handleAddLeakageItem = () => {
    if (!newLeakLocation.trim()) {
      alert('Vui lòng nhập vị trí trần bị thấm dột (VD: Trần thạch cao phòng tắm, Hộp gen bếp...).');
      return;
    }
    const currentLeaks = formData.upperFloorWaterLeakage?.leakageItems || [];
    const nextCode = `WL-${String(currentLeaks.length + 1).padStart(2, '0')}`;
    const primaryPhoto = newLeakCuPhoto || newLeakCtxPhoto || '';

    const newItem: CondoWaterLeakageItem = {
      id: `wl-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      leakageCode: nextCode,
      location: newLeakLocation.trim(),
      description: newLeakDesc.trim(),
      photoUrl: primaryPhoto,
      ctxPhotoUrl: newLeakCtxPhoto || undefined,
      cuPhotoUrl: newLeakCuPhoto || undefined,
    };

    const updatedList = [...currentLeaks, newItem];
    updateFormData({
      upperFloorWaterLeakage: {
        ...formData.upperFloorWaterLeakage,
        has: true,
        leakageItems: updatedList,
        location: updatedList.length === 1 ? newItem.location : `${updatedList.length} vị trí thấm dột`,
        description: updatedList.length === 1 ? newItem.description : 'Đa điểm thấm trần lầu trên',
        photoUrl: primaryPhoto,
      },
    });

    setNewLeakLocation('');
    setNewLeakDesc('');
    setNewLeakCtxPhoto('');
    setNewLeakCuPhoto('');
  };

  const handleRemoveLeakageItem = (id: string) => {
    const currentLeaks = formData.upperFloorWaterLeakage?.leakageItems || [];
    const updatedList = currentLeaks.filter((item) => item.id !== id);
    updateFormData({
      upperFloorWaterLeakage: {
        ...formData.upperFloorWaterLeakage,
        leakageItems: updatedList,
        has: updatedList.length > 0,
      },
    });
  };

  // Tính toán tỉ số võng dầm f/L
  const beamSagging = formData.beamSagging || {
    hasSagging: false,
    location: '',
    sagMm: 0,
    spanM: 0,
    ratioText: '',
    photoUrl: '',
  };

  const handleUpdateBeamSagging = (
    sagMmVal?: number,
    spanMVal?: number,
    locVal?: string,
    photoVal?: string
  ) => {
    const sMm = sagMmVal !== undefined ? sagMmVal : beamSagging.sagMm || 0;
    const spM = spanMVal !== undefined ? spanMVal : beamSagging.spanM || 0;
    const loc = locVal !== undefined ? locVal : beamSagging.location || '';
    const photo = photoVal !== undefined ? photoVal : beamSagging.photoUrl || '';

    let ratioText = '';
    if (sMm > 0 && spM > 0) {
      const spanMm = spM * 1000;
      const denominator = Math.round(spanMm / sMm);
      ratioText = `1/${denominator}`;
    }

    updateFormData({
      beamSagging: {
        ...beamSagging,
        sagMm: sMm,
        spanM: spM,
        location: loc,
        photoUrl: photo,
        ratioText,
      },
    });
  };

  const isBeamSagCritical = () => {
    if (!beamSagging.hasSagging || !beamSagging.sagMm || !beamSagging.spanM) return false;
    const spanMm = beamSagging.spanM * 1000;
    const ratio = beamSagging.sagMm / spanMm;
    return ratio > 1 / 500; // TCVN 5574:2018
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-12 animate-in fade-in">
      {/* 3.1. Bản Vẽ CAD Mặt Bằng Căn Hộ & Chấm Ghim (Dual Mode) */}
      <Card className="border-slate-200 bg-white shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-slate-100 gap-2">
          <div className="flex items-center gap-2">
            <Layers className="w-5 h-5 text-teal-600 shrink-0" />
            <div>
              <h2 className="text-base font-bold text-slate-800">
                3.1. Sơ Đồ CAD & Chấm Ghim Vết Nứt Căn {formData.unitCode} (Tầng {formData.floorNumber})
              </h2>
              <p className="text-xs text-slate-500">
                Chạm vào mặt bằng để định vị tọa độ khuyết tật hoặc nhập vị trí bằng lời
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
              className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-teal-50 hover:bg-teal-100 text-teal-700 border border-teal-200 text-xs font-bold transition-all shadow-2xs cursor-pointer min-h-[44px]"
            >
              <Download className="w-3.5 h-3.5" />
              Chọn lại từ Tầng {formData.floorNumber}
            </button>
          </div>
        </div>

        {/* Khung hiển thị ảnh CAD căn hộ có gắn ghim */}
        {formData.unitCadUrl ? (
          <div className="space-y-2">
            <div
              ref={cadContainerRef}
              onClick={handleCadClick}
              className="relative rounded-2xl border-2 border-teal-500/40 bg-slate-950 p-2 overflow-hidden flex flex-col items-center justify-center cursor-crosshair select-none group min-h-[260px]"
            >
              <img
                src={formData.unitCadUrl}
                alt={`CAD Căn hộ ${formData.unitCode}`}
                className="max-h-[360px] w-auto object-contain rounded-xl pointer-events-none"
              />

              {/* Huy hiệu trạng thái CAD */}
              <div className="absolute top-3 left-3 bg-slate-900/90 text-teal-300 border border-teal-500/50 px-2.5 py-1 rounded-lg text-xs font-mono font-bold flex items-center gap-1.5 shadow-md pointer-events-none">
                <CheckCircle2 className="w-3.5 h-3.5 text-teal-400" />
                CAD Căn {formData.unitCode} • Chạm để thả ghim
              </div>

              {/* Render các ghim khuyết tật đã lưu */}
              {formData.localDefects.map((d, idx) => {
                if (d.pinX == null || d.pinY == null) return null;
                return (
                  <div
                    key={d.id}
                    style={{ left: `${d.pinX}%`, top: `${d.pinY}%` }}
                    className="absolute -translate-x-1/2 -translate-y-1/2 z-20 pointer-events-none"
                  >
                    <span className="flex items-center justify-center px-1.5 py-0.5 rounded-full text-[10px] font-mono font-black bg-rose-600 text-white border-2 border-white shadow-lg animate-pulse">
                      {d.defectCode || `D-${String(idx + 1).padStart(2, '0')}`}
                    </span>
                  </div>
                );
              })}

              {/* Render ghim tạm thời khi đang thêm mới */}
              {newPinX != null && newPinY != null && (
                <div
                  style={{ left: `${newPinX}%`, top: `${newPinY}%` }}
                  className="absolute -translate-x-1/2 -translate-y-1/2 z-30 pointer-events-none"
                >
                  <span className="flex items-center justify-center px-2 py-0.5 rounded-full text-[11px] font-mono font-black bg-amber-500 text-slate-950 border-2 border-white shadow-xl ring-4 ring-amber-400/50">
                    <Crosshair className="w-3 h-3 mr-1" />
                    D-{String(formData.localDefects.length + 1).padStart(2, '0')} ({newPinX}%, {newPinY}%)
                  </span>
                </div>
              )}
            </div>

            <div className="flex items-center justify-between text-xs text-slate-500 px-1">
              <span className="flex items-center gap-1">
                <MapPin className="w-3.5 h-3.5 text-teal-600" />
                {newPinX != null && newPinY != null ? (
                  <strong className="text-amber-600 font-mono">
                    Đã chấm ghim tạm: X={newPinX}%, Y={newPinY}%
                  </strong>
                ) : (
                  <span>Chạm vào bất kỳ điểm nào trên bản vẽ CAD để gán tọa độ vết nứt mới</span>
                )}
              </span>
              {newPinX != null && (
                <button
                  type="button"
                  onClick={() => {
                    setNewPinX(null);
                    setNewPinY(null);
                  }}
                  className="text-slate-400 hover:text-rose-600 cursor-pointer underline text-[11px]"
                >
                  Xóa ghim tạm
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="p-6 bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200 flex flex-col items-center justify-center text-center space-y-3">
            <div className="p-3 bg-teal-50 text-teal-600 rounded-2xl border border-teal-200">
              <Layers className="w-6 h-6" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-slate-800">
                Chế độ nhập khuyết tật độc lập (Chưa có bản vẽ CAD riêng)
              </h4>
              <p className="text-xs text-slate-500 max-w-md mt-1">
                Tòa Master chưa tải sơ đồ hoặc căn {formData.unitCode} chưa có CAD riêng. Kỹ sư khảo sát vẫn có thể nhập vị trí khuyết tật bằng chữ (VD: Tường phòng khách, Dầm trần bếp) hoàn toàn bình thường mà không bị gián đoạn.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => {
                  setShowFloorPickerModal(true);
                  loadFloorPlanAuto();
                }}
                className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold shadow-xs cursor-pointer min-h-[44px]"
              >
                <Download className="w-4 h-4" />
                Mở Sơ Đồ Tầng {formData.floorNumber} Để Tìm Bản Vẽ
              </button>
            </div>
          </div>
        )}
      </Card>

      {/* 3.2. Hiện trạng đặc thù: Thấm dột trần từ lầu trên, Biến dạng kẹt cửa & Võng dầm sàn */}
      <Card className="border-slate-200 bg-white shadow-xs space-y-4">
        <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
          <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
          <div>
            <h2 className="text-base font-bold text-slate-800">
              3.2. Thấm Dột Trần Tầng Trên, Võng Dầm Sàn & Biến Dạng Cửa
            </h2>
            <p className="text-xs text-slate-500">
              Thu thập các chỉ tiêu đặc thù căn hộ cao tầng phục vụ đối chiếu đền bù Metro 2
            </p>
          </div>
        </div>

        {/* 3.2.A: Thấm dột trần lầu trên dội xuống (Multi-item Support) */}
        <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
              <Droplets className="w-4 h-4 text-sky-600" />
              Thấm dột trần từ căn hộ tầng trên dội xuống (Upper Floor Leakage)
            </span>
            <label className="flex items-center gap-2 text-xs font-bold text-slate-700 cursor-pointer p-1">
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
                className="rounded text-teal-600 focus:ring-teal-500 w-5 h-5 cursor-pointer"
              />
              <span className={formData.upperFloorWaterLeakage?.has ? 'text-sky-700 font-bold' : 'text-slate-500'}>
                {formData.upperFloorWaterLeakage?.has ? 'CÓ THẤM DỘT' : 'KHÔNG THẤM'}
              </span>
            </label>
          </div>

          {formData.upperFloorWaterLeakage?.has && (
            <div className="space-y-4 pt-2">
              {/* Danh sách các vị trí thấm trần đã ghi nhận */}
              {formData.upperFloorWaterLeakage.leakageItems?.length > 0 && (
                <div className="space-y-2">
                  <span className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                    Các vị trí thấm trần đã ghi nhận ({formData.upperFloorWaterLeakage.leakageItems.length}):
                  </span>
                  <div className="space-y-2">
                    {formData.upperFloorWaterLeakage.leakageItems.map((leak, idx) => (
                      <div
                        key={leak.id}
                        className="p-3 bg-white rounded-xl border border-sky-200 flex items-start justify-between gap-3 text-xs shadow-2xs"
                      >
                        <div className="flex items-start gap-2.5">
                          <span className="font-mono font-bold text-xs px-2 py-0.5 rounded bg-sky-100 text-sky-800 border border-sky-300">
                            {leak.leakageCode || `WL-${String(idx + 1).padStart(2, '0')}`}
                          </span>
                          <div>
                            <h4 className="font-bold text-slate-900">{leak.location}</h4>
                            {leak.description && <p className="text-slate-600 mt-0.5">{leak.description}</p>}
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          {leak.ctxPhotoUrl && (
                            <img
                              src={leak.ctxPhotoUrl}
                              alt="CTX"
                              title="Ảnh bối cảnh trần"
                              className="w-10 h-10 rounded-lg object-cover border border-slate-300"
                            />
                          )}
                          {(leak.cuPhotoUrl || leak.photoUrl) && (
                            <img
                              src={leak.cuPhotoUrl || leak.photoUrl}
                              alt="CU"
                              title="Ảnh cận cảnh vết loang ố"
                              className="w-10 h-10 rounded-lg object-cover border border-sky-400"
                            />
                          )}
                          <button
                            type="button"
                            onClick={() => handleRemoveLeakageItem(leak.id)}
                            className="p-2 rounded-lg text-rose-500 hover:bg-rose-50 cursor-pointer min-h-[44px] min-w-[44px] flex items-center justify-center"
                            title="Xóa vị trí thấm"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Form thêm vị trí thấm trần mới */}
              <div className="p-3.5 bg-sky-50/70 rounded-xl border border-sky-200 space-y-3">
                <h4 className="text-xs font-bold text-sky-950 flex items-center gap-1.5">
                  <Plus className="w-4 h-4 text-sky-600" />
                  Thêm Vị Trí Thấm Trần Mới (Cặp ảnh đối chiếu CTX + CU)
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Input
                    label="Vị trí trần thấm dột *"
                    placeholder="VD: Trần thạch cao phòng tắm Master, Hộp gen bếp..."
                    value={newLeakLocation}
                    onChange={(e) => setNewLeakLocation(e.target.value)}
                  />
                  <Input
                    label="Mô tả mức độ loang ố / rỉ giọt"
                    placeholder="VD: Ố vàng loang lổ diện tích 0.8m2, bong tróc sơn..."
                    value={newLeakDesc}
                    onChange={(e) => setNewLeakDesc(e.target.value)}
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <PhotoCaptureInput
                    label="Ảnh bối cảnh toàn trần phòng (CTX)"
                    value={newLeakCtxPhoto}
                    onChange={setNewLeakCtxPhoto}
                    watermarkOptions={{
                      parcelCode: bCode,
                      buildingCode: bCode,
                      floorCode,
                      floor: floorCode,
                      unitCode: formData.unitCode,
                      areaType: 'CONDO_UNIT',
                      category: 'water-leaks',
                      photoType: 'CTX',
                      photoIndex: (formData.upperFloorWaterLeakage.leakageItems?.length || 0) + 1,
                      zoneOrRoom: newLeakLocation || undefined,
                    }}
                    height="100px"
                  />
                  <PhotoCaptureInput
                    label="Ảnh cận cảnh vết loang ố ẩm mốc (CU)"
                    value={newLeakCuPhoto}
                    onChange={setNewLeakCuPhoto}
                    watermarkOptions={{
                      parcelCode: bCode,
                      buildingCode: bCode,
                      floorCode,
                      floor: floorCode,
                      unitCode: formData.unitCode,
                      areaType: 'CONDO_UNIT',
                      category: 'water-leaks',
                      photoType: 'CU',
                      photoIndex: (formData.upperFloorWaterLeakage.leakageItems?.length || 0) + 1,
                      zoneOrRoom: newLeakLocation || undefined,
                    }}
                    height="100px"
                  />
                </div>

                <div className="flex justify-end pt-1">
                  <button
                    type="button"
                    onClick={handleAddLeakageItem}
                    className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold shadow-xs cursor-pointer min-h-[44px]"
                  >
                    <Plus className="w-4 h-4" />
                    Lưu Vị Trí Thấm Này
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* 3.2.B: Đo độ võng dầm / sàn căn hộ (f/L Calculation) */}
        <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
              <Activity className="w-4 h-4 text-purple-600" />
              Đo độ võng kết cấu dầm / ô sàn (Beam / Slab Sagging $f/L$)
            </span>
            <label className="flex items-center gap-2 text-xs font-bold text-slate-700 cursor-pointer p-1">
              <input
                type="checkbox"
                checked={beamSagging.hasSagging}
                onChange={(e) =>
                  updateFormData({
                    beamSagging: {
                      ...beamSagging,
                      hasSagging: e.target.checked,
                    },
                  })
                }
                className="rounded text-purple-600 focus:ring-purple-500 w-5 h-5 cursor-pointer"
              />
              <span className={beamSagging.hasSagging ? 'text-purple-700 font-bold' : 'text-slate-500'}>
                {beamSagging.hasSagging ? 'CÓ VÕNG KẾT CẤU' : 'BÌNH THƯỜNG (KHÔNG VÕNG)'}
              </span>
            </label>
          </div>

          {beamSagging.hasSagging && (
            <div className="space-y-3 pt-2">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <Input
                  label="Vị trí dầm / sàn đo độ võng *"
                  placeholder="VD: Dầm D1 giữa phòng khách, Ô sàn phòng ngủ..."
                  value={beamSagging.location || ''}
                  onChange={(e) => handleUpdateBeamSagging(undefined, undefined, e.target.value)}
                />
                <Input
                  label="Độ võng đo được f (mm) *"
                  type="number"
                  step="0.5"
                  placeholder="VD: 6.5"
                  value={beamSagging.sagMm || ''}
                  onChange={(e) => handleUpdateBeamSagging(Number(e.target.value) || 0)}
                />
                <Input
                  label="Chiều dài nhịp dầm/sàn L (m) *"
                  type="number"
                  step="0.1"
                  placeholder="VD: 4.2"
                  value={beamSagging.spanM || ''}
                  onChange={(e) => handleUpdateBeamSagging(undefined, Number(e.target.value) || 0)}
                />
              </div>

              {beamSagging.ratioText && (
                <div
                  className={`p-3 rounded-xl border flex items-center justify-between text-xs ${
                    isBeamSagCritical()
                      ? 'bg-rose-50 border-rose-200 text-rose-900 font-bold'
                      : 'bg-emerald-50 border-emerald-200 text-emerald-900 font-bold'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Info className="w-4 h-4 shrink-0" />
                    <span>
                      Tỉ số độ võng: <strong>f/L = {beamSagging.ratioText}</strong> (Đo được {beamSagging.sagMm}mm trên nhịp {beamSagging.spanM}m)
                    </span>
                  </div>
                  <span>
                    {isBeamSagCritical()
                      ? '⚠️ Vượt ngưỡng an toàn 1/500 (TCVN 5574:2018)'
                      : '✓ Trong ngưỡng an toàn TCVN (<= 1/500)'}
                  </span>
                </div>
              )}

              <PhotoCaptureInput
                label="Ảnh chụp thước đo võng / tia laser cân bằng (SAG_PHOTO)"
                value={beamSagging.photoUrl || ''}
                onChange={(url) => handleUpdateBeamSagging(undefined, undefined, undefined, url)}
                watermarkOptions={{
                  parcelCode: bCode,
                  buildingCode: bCode,
                  floorCode,
                  floor: floorCode,
                  unitCode: formData.unitCode,
                  areaType: 'CONDO_UNIT',
                  category: 'deformation',
                  photoType: 'DEFORMATION',
                  zoneOrRoom: beamSagging.location || undefined,
                }}
                height="100px"
              />
            </div>
          )}
        </div>

        {/* 3.2.C: Biến dạng & Kẹt cửa */}
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
            onChange={(e) => {
              const val = e.target.value;
              if (isDoorJammingStatus(val)) {
                updateFormData({ doorJammingStatus: val });
              }
            }}
            options={[
              { value: 'NORMAL', label: 'Bình thường: Đóng mở nhẹ nhàng, không cạ nền' },
              { value: 'JAMMED', label: 'Bị kẹt cánh / khó đóng mở do khung bao biến dạng' },
              { value: 'RUBBING_FLOOR', label: 'Xệ cánh: Bản lề xệ cạ mặt gạch lát sàn' },
              { value: 'CRACKED_GLASS', label: 'Nứt rạn kính: Kính cửa sổ/ban công bị rạn nứt' },
            ]}
          />
        </div>
      </Card>

      {/* 3.3. Sổ Khuyết Tật & Vết Nứt Căn Hộ (Cặp ảnh CTX + CU) */}
      <Card className="border-slate-200 bg-white shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-slate-100 gap-1">
          <div className="flex items-center gap-2">
            <Maximize2 className="w-5 h-5 text-teal-600 shrink-0" />
            <h2 className="text-base font-bold text-slate-800">
              3.3. Danh Mục Vết Nứt & Khuyết Tật Căn Hộ ({formData.localDefects.length})
            </h2>
          </div>
          <span className="text-xs text-slate-500">
            Quy chuẩn CRLG: Cặp ảnh Bối cảnh (CTX) + Cận cảnh thước đo Crack Card (CU $\ge 0.1$mm)
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
                <span className="font-mono font-bold text-xs px-2 py-1 rounded bg-teal-100 text-teal-800 border border-teal-200 shrink-0">
                  {d.defectCode || `D-${String(idx + 1).padStart(2, '0')}`}
                </span>
                <div>
                  <h4 className="font-bold text-slate-900">{d.location}</h4>
                  <p className="text-slate-600 mt-0.5">
                    Bề rộng: <strong>{d.crackWidthMm}mm</strong> • Chiều dài: <strong>{d.crackLengthM}m</strong>
                    {d.pinX != null && (
                      <span className="ml-2 font-mono text-[10px] text-teal-700 bg-teal-50 px-1.5 py-0.5 rounded border border-teal-200">
                        CAD: ({d.pinX}%, {d.pinY}%)
                      </span>
                    )}
                  </p>
                  {d.description && <p className="text-slate-500 italic mt-0.5">{d.description}</p>}
                </div>
              </div>

              <div className="flex items-center gap-2">
                {d.ctxPhotoUrl && (
                  <img
                    src={d.ctxPhotoUrl}
                    alt="CTX"
                    title="Ảnh bối cảnh vị trí nứt (CTX)"
                    className="w-11 h-11 rounded-lg object-cover border border-slate-300"
                  />
                )}
                {(d.cuPhotoUrl || d.photoUrl) && (
                  <img
                    src={d.cuPhotoUrl || d.photoUrl}
                    alt="CU"
                    title="Ảnh cận cảnh có thước đo (CU)"
                    className="w-11 h-11 rounded-lg object-cover border border-rose-300"
                  />
                )}
                <button
                  type="button"
                  onClick={() => removeDefect(d.id)}
                  className="p-2 rounded-lg text-rose-500 hover:bg-rose-50 cursor-pointer min-h-[44px] min-w-[44px] flex items-center justify-center"
                  title="Xóa khuyết tật"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}

          {formData.localDefects.length === 0 && (
            <div className="p-4 text-center text-xs text-slate-500 bg-slate-50 rounded-2xl border border-slate-200">
              Chưa ghi nhận khuyết tật nứt nào trong căn hộ. Chạm vào CAD ở mục 3.1 hoặc điền biểu mẫu bên dưới để thêm vết nứt nếu có.
            </div>
          )}
        </div>

        {/* Form thêm khuyết tật mới */}
        <div className="p-4 bg-teal-50/50 rounded-2xl border border-teal-200/80 space-y-3">
          <div className="flex items-center justify-between">
            <h4 className="text-xs font-bold text-teal-950 flex items-center gap-1.5">
              <Plus className="w-4 h-4 text-teal-600" />
              Thêm Vết Nứt Mới Tại Căn Hộ
            </h4>
            {newPinX != null && (
              <span className="text-[11px] font-mono text-teal-700 bg-teal-100/80 px-2 py-0.5 rounded-lg border border-teal-300">
                Tọa độ CAD: X={newPinX}%, Y={newPinY}%
              </span>
            )}
          </div>

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

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-1">
              <Select
                label="Phân loại hư hỏng"
                value={newType}
                onChange={(e) => setNewType(e.target.value as UnitDefectItem['type'])}
                options={[
                  { value: 'CRACK', label: 'Vết nứt (Tường / Dầm / Sàn)' },
                  { value: 'WATER_LEAKAGE', label: 'Thấm dột / Ẩm mốc tường' },
                  { value: 'PEELING', label: 'Bong tróc vữa trát / Sơn' },
                  { value: 'OTHER', label: 'Khuyết tật khác' },
                ]}
              />
            </div>
            <div className="sm:col-span-2">
              <Input
                label="Mô tả đặc điểm vết nứt"
                placeholder="VD: Nứt chéo mép cửa sổ, nứt chân chim mảng vữa trát..."
                value={newDesc}
                onChange={(e) => setNewDesc(e.target.value)}
              />
            </div>
          </div>

          {/* Cặp ảnh đối chiếu CTX + CU */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <PhotoCaptureInput
              label="1. Ảnh bối cảnh toàn mảng tường/phòng (CTX)"
              value={newCtxPhoto}
              onChange={setNewCtxPhoto}
              watermarkOptions={{
                parcelCode: bCode,
                buildingCode: bCode,
                floorCode,
                floor: floorCode,
                unitCode: formData.unitCode,
                areaType: 'CONDO_UNIT',
                category: 'defects',
                photoType: 'CTX',
                defectCode: `D-${String(formData.localDefects.length + 1).padStart(2, '0')}`,
                zoneOrRoom: newLocation || undefined,
              }}
              height="100px"
            />
            <PhotoCaptureInput
              label="2. Ảnh cận cảnh có thước đo Crack Card (CU >= 0.1mm) *"
              value={newCuPhoto}
              onChange={setNewCuPhoto}
              watermarkOptions={{
                parcelCode: bCode,
                buildingCode: bCode,
                floorCode,
                floor: floorCode,
                unitCode: formData.unitCode,
                areaType: 'CONDO_UNIT',
                category: 'defects',
                photoType: 'CU',
                defectCode: `D-${String(formData.localDefects.length + 1).padStart(2, '0')}`,
                zoneOrRoom: newLocation || undefined,
              }}
              height="100px"
            />
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="button"
              onClick={handleAddDefect}
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold shadow-xs cursor-pointer min-h-[44px]"
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
          className="bg-teal-600 hover:bg-teal-700 text-white min-h-[44px]"
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
                className="p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white min-h-[44px] min-w-[44px] flex items-center justify-center"
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
                    {floorPlanData.units?.map((u: FloorPlanUnitItem) => {
                      if (!u.cad_bbox) return null;
                      const isTarget = u.unit_code === formData.unitCode;
                      const style = Array.isArray(u.cad_bbox)
                        ? {
                            left: `${u.cad_bbox[0]}%`,
                            top: `${u.cad_bbox[1]}%`,
                            width: `${u.cad_bbox[2] - u.cad_bbox[0]}%`,
                            height: `${u.cad_bbox[3] - u.cad_bbox[1]}%`,
                          }
                        : {
                            left: `${u.cad_bbox.x}%`,
                            top: `${u.cad_bbox.y}%`,
                            width: `${u.cad_bbox.width}%`,
                            height: `${u.cad_bbox.height}%`,
                          };
                      return (
                        <div
                          key={u.id}
                          onClick={() => handleManualImportCad(u.unit_cad_url || floorPlanData.plan?.cad_photo_url || '', u.cad_bbox)}
                          style={style}
                          className={`absolute rounded cursor-pointer border-2 transition-all flex items-center justify-center overflow-hidden ${
                            isTarget
                              ? 'border-teal-400 bg-teal-500/40 ring-2 ring-teal-400 z-20'
                              : 'border-slate-500 bg-slate-800/40 hover:bg-slate-700/60 z-10'
                          }`}
                        >
                          <span
                            title={`Mã căn ngầm: ${u.unit_code}`}
                            className="px-1 py-0.5 rounded text-[9px] sm:text-[10px] font-mono font-bold bg-slate-900 text-white max-w-[92%] truncate text-center"
                          >
                            {formatShortUnitDisplay(u.unit_code)}
                          </span>
                        </div>
                      );
                    })}
                  </div>

                  {/* Danh sách các ô căn có CAD để click */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {floorPlanData.units?.map((u: FloorPlanUnitItem) => (
                      <button
                        key={u.id}
                        type="button"
                        onClick={() => handleManualImportCad(u.unit_cad_url || floorPlanData.plan?.cad_photo_url || '', u.cad_bbox)}
                        className={`p-3 rounded-xl border text-left text-xs font-bold flex items-center justify-between transition-all min-h-[44px] ${
                          u.unit_code === formData.unitCode
                            ? 'bg-teal-600 text-white border-teal-500 shadow-md'
                            : 'bg-slate-800 hover:bg-slate-750 text-slate-300 border-slate-700'
                        }`}
                      >
                        <span title={`Mã căn ngầm: ${u.unit_code}`}>Căn {formatShortUnitDisplay(u.unit_code)}</span>
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
