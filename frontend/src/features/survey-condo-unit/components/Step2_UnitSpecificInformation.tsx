import React, { useState, useEffect } from 'react';
import { usePhase1SurveyStore } from '../../survey-phase1/store/usePhase1SurveyStore';
import { Card } from '../../../core/components/ui/Card';
import { Button } from '../../../core/components/ui/Button';
import { Input, Select } from '../../../core/components/ui/FormControls';
import { PhotoCaptureInput } from '../../../components/common/PhotoCaptureInput';
import { LevelSelectorWithGuide } from '../../survey-phase1/components/LevelSelectorWithGuide';
import { SETTLEMENT_LEVEL_OPTIONS, SAG_LEVEL_OPTIONS } from '../../survey-phase1/constants/levelGuideConstants';
import {
  RENOVATION_OPTIONS,
  MAJOR_REPAIR_OPTIONS,
  PAST_SETTLEMENT_OPTIONS,
  NEIGHBOR_DAMAGE_OPTIONS,
  FIRE_FLOOD_OPTIONS,
} from '../../survey-phase1/constants/historyInterviewConstants';
import {
  Home,
  User,
  Camera,
  Activity,
  AlertTriangle,
  ArrowRight,
  ArrowLeft,
  Building2,
  CheckCircle2,
  Layers,
  Wrench,
  Droplets,
  History,
  Zap,
} from 'lucide-react';

export const Step2_UnitSpecificInformation: React.FC = () => {
  const { formData, updateFormData, setCurrentStep } = usePhase1SurveyStore();
  const hi = formData.historyInterview || {
    renovationLoad: 0,
    majorRepair: 0,
    pastSettlement: 0,
    neighborDamage: 0,
    fireFloodIncident: 0,
    usageStatus: 'Đầy đủ',
    sensitiveEquipment: { has: false, description: '' },
  };

  // E5 Resonance calculation preview
  const qScores = [
    { name: '1. Cơi nới - thay đổi tải trọng', score: hi.renovationLoad ?? 0 },
    { name: '2. Sửa chữa lớn - cải tạo', score: hi.majorRepair ?? 0 },
    { name: '3. Lún - nghiêng trước đây', score: hi.pastSettlement ?? 0 },
    { name: '4. Hư hỏng do lân cận', score: hi.neighborDamage ?? 0 },
    { name: '5. Sự cố nghiêm trọng', score: hi.fireFloodIncident ?? 0 },
  ];

  const maxQScore = Math.max(...qScores.map((q) => q.score));
  const countHigh = qScores.filter((q) => q.score > 2).length;
  const isResonance = countHigh >= 2;
  const calculatedE5 = isResonance ? 4 : maxQScore;

  // Loại hình căn hộ: 1 tầng (Tiêu chuẩn) hoặc 2 tầng (Duplex / Penthouse)
  const [isDuplex, setIsDuplex] = useState<boolean>(
    (formData.floors && formData.floors.length >= 2) || false
  );
  const [lowerFloor, setLowerFloor] = useState<number>(formData.unitFloorNumber || 1);
  const [upperFloor, setUpperFloor] = useState<number>(
    (formData.floors && formData.floors.length >= 2) ? (formData.unitFloorNumber ? formData.unitFloorNumber + 1 : 2) : (formData.unitFloorNumber ? formData.unitFloorNumber + 1 : 2)
  );

  // Đồng bộ danh mục tầng khi thay đổi loại hình căn hộ hoặc số tầng
  const handleFloorTypeChange = (duplex: boolean, lower: number, upper: number) => {
    setIsDuplex(duplex);
    const uCode = formData.unitCode || 'P.---';

    if (duplex) {
      // 2 Tầng: Duplex / Penthouse
      const existingFloors = formData.floors || [];
      const floor1 = existingFloors[0]
        ? { ...existingFloors[0], id: `floor_${lower}`, floorName: `Tầng ${lower} (Tầng Dưới) - Căn ${uCode}` }
        : {
            id: `floor_${lower}`,
            floorName: `Tầng ${lower} (Tầng Dưới) - Căn ${uCode}`,
            overviewPhotos: [],
            cadSketchPhotoUrl: '',
            cadZonePins: [],
            cadElementPins: [],
            zones: [],
            structuralElements: [],
          };
      const floor2 = existingFloors[1]
        ? { ...existingFloors[1], id: `floor_${upper}`, floorName: `Tầng ${upper} (Tầng Trên) - Căn ${uCode}` }
        : {
            id: `floor_${upper}`,
            floorName: `Tầng ${upper} (Tầng Trên) - Căn ${uCode}`,
            overviewPhotos: [],
            cadSketchPhotoUrl: '',
            cadZonePins: [],
            cadElementPins: [],
            zones: [],
            structuralElements: [],
          };

      updateFormData({
        unitFloorNumber: lower,
        aboveFloors: upper,
        floors: [floor1, floor2],
      });
    } else {
      // 1 Tầng: Tiêu chuẩn
      const existingFloor = formData.floors && formData.floors.length > 0 ? formData.floors[0] : null;
      const singleFloor = existingFloor
        ? { ...existingFloor, id: `floor_${lower}`, floorName: `Tầng ${lower} - Căn hộ ${uCode}` }
        : {
            id: `floor_${lower}`,
            floorName: `Tầng ${lower} - Căn hộ ${uCode}`,
            overviewPhotos: [],
            cadSketchPhotoUrl: '',
            cadZonePins: [],
            cadElementPins: [],
            zones: [],
            structuralElements: [],
          };

      updateFormData({
        unitFloorNumber: lower,
        aboveFloors: lower,
        floors: [singleFloor],
      });
    }
  };

  // Xác thực form: Bắt buộc Mã căn hộ, Tên chủ hộ, P01 và P04
  const isFormValid =
    Boolean(formData.unitCode?.trim()) &&
    Boolean(formData.ownerName?.trim()) &&
    Boolean(formData.photoP01?.url || formData.photoP01?.notApplicable) &&
    Boolean(formData.photoP04?.url || formData.photoP04?.notApplicable);

  const handleNext = () => {
    setCurrentStep(3);
  };

  const handlePrev = () => {
    setCurrentStep(1);
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-12 animate-in fade-in">
      {/* 2.1. Định danh căn hộ con & Cấu hình tầng lầu */}
      <Card className="border-slate-200 bg-white shadow-xs">
        <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <Home className="w-5 h-5 text-teal-600" />
            <h2 className="text-base font-bold text-slate-800">
              2.1. Định Danh Căn Hộ Con & Cấu Hình Tầng Khảo Sát
            </h2>
          </div>
          <span className="text-xs bg-teal-50 text-teal-700 font-bold px-2.5 py-0.5 rounded-full border border-teal-200">
            Kế thừa từ Hub
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
          <Input
            label="Mã Căn Hộ (Unit Code) *"
            placeholder="VD: P.1204, A-08"
            value={formData.unitCode || ''}
            onChange={(e) => {
              const val = e.target.value;
              updateFormData({ unitCode: val });
              // Đồng bộ tên tầng
              if (formData.floors && formData.floors.length > 0) {
                const updatedFloors = formData.floors.map((f, idx) => ({
                  ...f,
                  floorName: isDuplex
                    ? (idx === 0 ? `Tầng ${lowerFloor} (Dưới) - Căn ${val}` : `Tầng ${upperFloor} (Trên) - Căn ${val}`)
                    : `Tầng ${lowerFloor} - Căn hộ ${val}`,
                }));
                updateFormData({ floors: updatedFloors });
              }
            }}
          />

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">
              Loại hình căn hộ / Số tầng khảo sát:
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => handleFloorTypeChange(false, lowerFloor, upperFloor)}
                className={`py-2 px-3 rounded-lg border text-xs font-bold transition-all ${
                  !isDuplex
                    ? 'bg-teal-600 text-white border-teal-600 shadow-xs'
                    : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                }`}
              >
                1 Tầng (Tiêu chuẩn)
              </button>
              <button
                type="button"
                onClick={() => handleFloorTypeChange(true, lowerFloor, upperFloor)}
                className={`py-2 px-3 rounded-lg border text-xs font-bold transition-all ${
                  isDuplex
                    ? 'bg-teal-600 text-white border-teal-600 shadow-xs'
                    : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                }`}
              >
                2 Tầng (Duplex / Penthouse)
              </button>
            </div>
          </div>
        </div>

        {/* Thiết lập tầng khảo sát */}
        {!isDuplex ? (
          <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200">
            <Input
              label="Tầng / Lầu Căn Hộ Tọa Lạc *"
              type="number"
              min={1}
              max={80}
              value={formData.unitFloorNumber || 1}
              onChange={(e) => {
                const val = Number(e.target.value) || 1;
                setLowerFloor(val);
                handleFloorTypeChange(false, val, val);
              }}
            />
            <p className="text-[11px] text-slate-500 mt-1">
              Hệ thống sẽ tạo 01 mặt bằng khảo sát duy nhất tại Tầng {formData.unitFloorNumber || 1} để chấm điểm các phòng (Z) và cấu kiện (E).
            </p>
          </div>
        ) : (
          <div className="p-3.5 bg-teal-50/60 rounded-xl border border-teal-200 space-y-3">
            <div className="flex items-center gap-1.5 text-xs font-bold text-teal-900">
              <Layers className="w-4 h-4 text-teal-600" />
              <span>Cấu hình 2 tầng cho căn hộ thông tầng (Duplex / Penthouse)</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Input
                label="Tầng Dưới (Lower Floor) *"
                type="number"
                min={1}
                max={80}
                value={lowerFloor}
                onChange={(e) => {
                  const val = Number(e.target.value) || 1;
                  setLowerFloor(val);
                  handleFloorTypeChange(true, val, upperFloor);
                }}
              />
              <Input
                label="Tầng Trên (Upper Floor) *"
                type="number"
                min={1}
                max={80}
                value={upperFloor}
                onChange={(e) => {
                  const val = Number(e.target.value) || 1;
                  setUpperFloor(val);
                  handleFloorTypeChange(true, lowerFloor, val);
                }}
              />
            </div>
            <p className="text-[11px] text-teal-800">
              Hệ thống sẽ tạo 02 mặt bằng khảo sát riêng biệt (Tầng {lowerFloor} & Tầng {upperFloor}) trong Bước 3 để khảo sát độc lập từng sàn.
            </p>
          </div>
        )}
      </Card>

      {/* 2.2. Thông tin chủ sở hữu / Người sử dụng căn hộ (Đã bỏ Số ĐT liên hệ) */}
      <Card className="border-slate-200 bg-white shadow-xs">
        <div className="flex items-center gap-2 pb-3 mb-4 border-b border-slate-100">
          <User className="w-5 h-5 text-teal-600" />
          <h2 className="text-base font-bold text-slate-800">
            2.2. Chủ Sở Hữu / Người Sử Dụng Căn Hộ
          </h2>
        </div>

        <div>
          <Input
            label="Họ và Tên Chủ Hộ / Người Sử Dụng Căn Hộ *"
            placeholder="VD: Nguyễn Văn B"
            value={formData.ownerName || ''}
            onChange={(e) => updateFormData({ ownerName: e.target.value })}
          />
          <p className="text-[11px] text-slate-500 mt-1">
            Ghi nhận họ tên người đại diện có mặt tại căn hộ để ký biên bản khảo sát hiện trường.
          </p>
        </div>
      </Card>

      {/* 2.3. Ảnh nhận diện hiện trường căn hộ */}
      <Card className="border-slate-200 bg-white shadow-xs">
        <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <Camera className="w-5 h-5 text-teal-600" />
            <h2 className="text-base font-bold text-slate-800">
              2.3. Ảnh Nhận Diện Hiện Trường Căn Hộ
            </h2>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Ảnh P01: Cửa chính căn hộ từ hành lang */}
          <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <Camera className="w-4 h-4 text-teal-600" />
                Ảnh P01: Cửa chính & Biển số căn *
              </span>
              <label className="flex items-center gap-1 text-[11px] text-slate-500 cursor-pointer">
                <input
                  type="checkbox"
                  checked={Boolean(formData.photoP01?.notApplicable)}
                  onChange={(e) =>
                    updateFormData({
                      photoP01: { ...formData.photoP01, notApplicable: e.target.checked },
                    })
                  }
                  className="rounded text-teal-600 focus:ring-teal-500"
                />
                <span>N/A</span>
              </label>
            </div>
            <p className="text-[11px] text-slate-500">
              Chụp cửa chính căn hộ cùng biển số căn ({formData.unitCode || 'P.---'}) từ hành lang chung.
            </p>
            <PhotoCaptureInput
              label="Chụp / Tải ảnh P01"
              value={formData.photoP01?.url || ''}
              onChange={(url) => updateFormData({ photoP01: { ...formData.photoP01, url } })}
              watermarkText={`CONDO_P01 | ${formData.unitCode || 'UNIT'} | T${formData.unitFloorNumber || 1}`}
              height="150px"
            />
          </div>

          {/* Ảnh P04: Tổng quan căn hộ và hành lang */}
          <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <Camera className="w-4 h-4 text-teal-600" />
                Ảnh P04: Tổng quan căn hộ và hành lang *
              </span>
              <label className="flex items-center gap-1 text-[11px] text-slate-500 cursor-pointer">
                <input
                  type="checkbox"
                  checked={Boolean(formData.photoP04?.notApplicable)}
                  onChange={(e) =>
                    updateFormData({
                      photoP04: { ...formData.photoP04, notApplicable: e.target.checked },
                    })
                  }
                  className="rounded text-teal-600 focus:ring-teal-500"
                />
                <span>N/A</span>
              </label>
            </div>
            <p className="text-[11px] text-slate-500">
              Chụp góc rộng toàn cảnh không gian sinh hoạt chính / phòng khách và hành lang bên trong căn hộ.
            </p>
            <PhotoCaptureInput
              label="Chụp / Tải ảnh P04"
              value={formData.photoP04?.url || ''}
              onChange={(url) => updateFormData({ photoP04: { ...formData.photoP04, url } })}
              watermarkText={`CONDO_P04 | ${formData.unitCode || 'UNIT'} | T${formData.unitFloorNumber || 1}`}
              height="150px"
            />
          </div>
        </div>
      </Card>

      {/* 2.4. Lịch Sử Sửa Chữa & Yếu Tố Nhạy Cảm (Chỉ số E5) */}
      <Card className="border-slate-200 bg-white shadow-xs">
        <div className="flex items-center justify-between mb-4 pb-2 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <History className="w-5 h-5 text-purple-600" />
            <div>
              <h2 className="text-base sm:text-lg font-bold text-slate-800">
                2.4. Lịch Sử Sửa Chữa & Yếu Tố Nhạy Cảm
              </h2>
              <p className="text-xs text-slate-500">
                Các câu hỏi phỏng vấn quá khứ do chủ căn hộ cung cấp. Hư hỏng hiện trạng trong lịch sử
              </p>
            </div>
          </div>

          {/* Real-time E5 Badge */}
          <div className="flex items-center gap-2">
            <span
              className={`text-xs font-black px-3 py-1.5 rounded-xl border flex items-center gap-1.5 ${
                isResonance
                  ? 'bg-purple-100 border-purple-300 text-purple-900'
                  : 'bg-slate-100 border-slate-200 text-slate-800'
              }`}
            >
              {isResonance && <Zap className="w-3.5 h-3.5 text-purple-600 fill-purple-600 animate-pulse" />}
              <span>E5 = {calculatedE5}/4</span>
            </span>
          </div>
        </div>

        {/* Risk Resonance Alert Banner */}
        {isResonance && (
          <div className="mb-4 p-3 rounded-xl bg-purple-50 border border-purple-200 text-xs text-purple-900 flex items-start gap-2 animate-in fade-in">
            <Zap className="w-4 h-4 text-purple-600 flex-shrink-0 mt-0.5 fill-purple-600" />
            <div>
              <span className="font-bold">Cộng Hưởng Rủi Ro:</span> Có{' '}
              <strong>{countHigh} trường thông tin</strong> cùng đạt mức nghiêm trọng $\implies$ Chỉ số E5 tự động nâng lên mức <strong>4 (tối đa)</strong>.
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Select
            label="1. Cơi nới - Thay đổi tải trọng trong quá khứ"
            value={hi.renovationLoad}
            onChange={(e) =>
              updateFormData({
                historyInterview: { ...hi, renovationLoad: Number(e.target.value) },
              })
            }
            options={RENOVATION_OPTIONS.map((h) => ({ value: h.score, label: h.label }))}
          />

          <Select
            label="2. Sửa chữa lớn - Cải tạo kết cấu"
            value={hi.majorRepair}
            onChange={(e) =>
              updateFormData({
                historyInterview: { ...hi, majorRepair: Number(e.target.value) },
              })
            }
            options={MAJOR_REPAIR_OPTIONS.map((h) => ({ value: h.score, label: h.label }))}
          />

          <Select
            label="3. Lún - Nghiêng ghi nhận trước đây"
            value={hi.pastSettlement}
            onChange={(e) =>
              updateFormData({
                historyInterview: { ...hi, pastSettlement: Number(e.target.value) },
              })
            }
            options={PAST_SETTLEMENT_OPTIONS.map((h) => ({ value: h.score, label: h.label }))}
          />

          <Select
            label="4. Hư hỏng do công trình lân cận gây ra"
            value={hi.neighborDamage}
            onChange={(e) =>
              updateFormData({
                historyInterview: { ...hi, neighborDamage: Number(e.target.value) },
              })
            }
            options={NEIGHBOR_DAMAGE_OPTIONS.map((h) => ({ value: h.score, label: h.label }))}
          />

          <Select
            label="5. Sự cố nghiêm trọng (Hỏa hoạn - Ngập lụt - Nổ)"
            value={hi.fireFloodIncident}
            onChange={(e) =>
              updateFormData({
                historyInterview: { ...hi, fireFloodIncident: Number(e.target.value) },
              })
            }
            options={FIRE_FLOOD_OPTIONS.map((h) => ({ value: h.score, label: h.label }))}
          />

          <Select
            label="Tình trạng sử dụng hiện tại (Occupancy Status)"
            value={hi.usageStatus}
            onChange={(e) =>
              updateFormData({
                historyInterview: { ...hi, usageStatus: e.target.value },
              })
            }
            options={[
              { value: 'Đầy đủ', label: 'Đầy đủ' },
              { value: 'Đang sử dụng một phần', label: 'Đang sử dụng một phần' },
              { value: 'Bỏ trống - Không sử dụng', label: 'Bỏ trống - Không sử dụng' },
            ]}
          />
        </div>

        {/* Thiết bị nhạy cảm rung chấn */}
        <div className="mt-4 pt-4 border-t border-slate-100 space-y-3">
          <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={hi.sensitiveEquipment?.has}
              onChange={(e) =>
                updateFormData({
                  historyInterview: {
                    ...hi,
                    sensitiveEquipment: { ...hi.sensitiveEquipment, has: e.target.checked },
                  },
                })
              }
              className="rounded text-purple-600 focus:ring-purple-500"
            />
            <span>Có Thiết bị - Hoạt động nhạy cảm rung chấn (Y tế, Lab, Thiết bị chính xác...)</span>
          </label>

          {hi.sensitiveEquipment?.has && (
            <div className="p-3 bg-purple-50/50 rounded-xl border border-purple-200">
              <Input
                label="Mô tả thiết bị / hoạt động nhạy cảm:"
                placeholder="VD: Phòng lab xét nghiệm, máy siêu âm/X-quang, server dữ liệu, đồ cổ quý hiếm..."
                value={hi.sensitiveEquipment?.description || ''}
                onChange={(e) =>
                  updateFormData({
                    historyInterview: {
                      ...hi,
                      sensitiveEquipment: { ...hi.sensitiveEquipment, description: e.target.value },
                    },
                  })
                }
              />
            </div>
          )}
        </div>
      </Card>

      {/* 2.5. Kế thừa độ nghiêng toà mẹ & Kiểm tra lún lệch / võng dầm căn hộ */}
      <Card className="border-slate-200 bg-white shadow-xs">
        <div className="flex items-center justify-between gap-2 mb-4 pb-2 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-amber-600" />
            <h2 className="text-base font-bold text-slate-800">
              2.5. Đo Nghiêng Công Trình & Khảo Sát Biến Dạng Căn Hộ
            </h2>
          </div>
          <span className="text-xs text-slate-500 font-medium">
            Kế thừa toà mẹ & đo võng cục bộ
          </span>
        </div>

        {/* Thông báo kế thừa độ nghiêng công trình từ toà mẹ */}
        <div className="p-3.5 mb-4 bg-indigo-50/70 border border-indigo-200 rounded-xl flex items-start gap-3">
          <div className="p-2 bg-indigo-100 text-indigo-700 rounded-lg shrink-0 mt-0.5">
            <Building2 className="w-4 h-4" />
          </div>
          <div className="text-xs text-indigo-950 space-y-1">
            <div className="font-bold flex items-center gap-2">
              <span>Đo nghiêng công trình: Tự động kế thừa từ Tòa nhà mẹ</span>
              <span className="bg-indigo-600 text-white text-[10px] font-bold px-1.5 py-0.2 rounded">
                KẾ THỪA
              </span>
            </div>
            <p className="text-slate-600 leading-relaxed">
              Theo quy chuẩn trắc địa công trình cao tầng, độ nghiêng tổng thể được đo đạc tại khối tháp tòa nhà mẹ (khảo sát cấp Master). Căn hộ con không đo nghiêng độc lập mà kế thừa trực tiếp dữ liệu này.
            </p>
          </div>
        </div>

        {/* Khảo sát biến dạng lún chênh cục bộ tại căn hộ */}
        <div className="space-y-4">
          <LevelSelectorWithGuide
            title="1. Lún Chênh / Biến Dạng Mép Tường - Cửa Quan Sát Tại Căn Hộ"
            selectedLevel={formData.settlementTilt?.diffSettlement?.level ?? 0}
            onChangeLevel={(level) =>
              updateFormData({
                settlementTilt: {
                  ...formData.settlementTilt,
                  diffSettlement: {
                    ...formData.settlementTilt?.diffSettlement,
                    level,
                  },
                },
              })
            }
            options={SETTLEMENT_LEVEL_OPTIONS}
          >
            <Input
              label="Vị trí phát hiện lún chênh / kẹt cửa ban công / nứt mép cửa (nếu có)"
              placeholder="VD: Cửa lùa ban công bị kẹt nhẹ, khe co giãn tường ngăn..."
              value={formData.settlementTilt?.diffSettlement?.position || ''}
              onChange={(e) =>
                updateFormData({
                  settlementTilt: {
                    ...formData.settlementTilt,
                    diffSettlement: {
                      ...formData.settlementTilt?.diffSettlement,
                      position: e.target.value,
                    },
                  },
                })
              }
            />
          </LevelSelectorWithGuide>
        </div>
      </Card>

      {/* Action Footer */}
      <div className="flex items-center justify-between gap-4 pt-4 border-t border-slate-200">
        <Button variant="secondary" size="md" onClick={handlePrev} icon={<ArrowLeft className="w-4 h-4" />}>
          Bước 1 (Toà cha)
        </Button>
        <Button
          size="lg"
          className="bg-teal-600 hover:bg-teal-700 text-white"
          disabled={!isFormValid}
          onClick={handleNext}
          icon={<ArrowRight className="w-4 h-4" />}
        >
          Tiếp tục: Bước 3 (Khảo sát các tầng/phòng)
        </Button>
      </div>
    </div>
  );
};
