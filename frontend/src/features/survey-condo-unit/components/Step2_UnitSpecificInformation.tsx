import React, { useState, useEffect } from 'react';
import { usePhase1SurveyStore } from '../../survey-phase1/store/usePhase1SurveyStore';
import { Card } from '../../../core/components/ui/Card';
import { Button } from '../../../core/components/ui/Button';
import { Input } from '../../../core/components/ui/FormControls';
import { PhotoCaptureInput } from '../../../components/common/PhotoCaptureInput';
import { LevelSelectorWithGuide } from '../../survey-phase1/components/LevelSelectorWithGuide';
import { SETTLEMENT_LEVEL_OPTIONS, SAG_LEVEL_OPTIONS } from '../../survey-phase1/constants/levelGuideConstants';
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
} from 'lucide-react';

export const Step2_UnitSpecificInformation: React.FC = () => {
  const { formData, updateFormData, setCurrentStep } = usePhase1SurveyStore();

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

  // Xác thực form: Bắt buộc Mã căn hộ, Tên chủ hộ, P01 và P04 (P02 và P03 mặc định N/A theo Phương án B)
  const isFormValid =
    Boolean(formData.unitCode?.trim()) &&
    Boolean(formData.ownerName?.trim()) &&
    Boolean(formData.photoP01?.url || formData.photoP01?.notApplicable) &&
    Boolean(formData.photoP02?.url || formData.photoP02?.notApplicable) &&
    Boolean(formData.photoP03?.url || formData.photoP03?.notApplicable) &&
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

      {/* 2.3. Bộ 4 ảnh định danh căn hộ (Phương án B: P02 và P03 mặc định N/A) */}
      <Card className="border-slate-200 bg-white shadow-xs">
        <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <Camera className="w-5 h-5 text-teal-600" />
            <h2 className="text-base font-bold text-slate-800">
              2.3. Bộ 4 Ảnh Nhận Diện Hiện Trường Căn Hộ
            </h2>
          </div>
          <span className="text-xs bg-slate-100 text-slate-600 font-bold px-2 py-0.5 rounded border border-slate-200">
            P02 & P03 mặc định N/A
          </span>
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

          {/* Ảnh P02: Mặt đứng / Toàn cảnh (Mặc định N/A) */}
          <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <Camera className="w-4 h-4 text-slate-500" />
                Ảnh P02: Toàn cảnh mặt đứng (Toà mẹ)
              </span>
              <label className="flex items-center gap-1 text-[11px] text-teal-700 font-bold bg-teal-50 px-1.5 py-0.5 rounded border border-teal-200 cursor-pointer">
                <input
                  type="checkbox"
                  checked={Boolean(formData.photoP02?.notApplicable)}
                  onChange={(e) =>
                    updateFormData({
                      photoP02: { ...formData.photoP02, notApplicable: e.target.checked },
                    })
                  }
                  className="rounded text-teal-600 focus:ring-teal-500"
                />
                <span>N/A (Tòa mẹ)</span>
              </label>
            </div>
            <p className="text-[11px] text-slate-500">
              Mặc định bỏ qua vì đã chụp ở Tòa mẹ. Bỏ tick N/A nếu muốn chụp bổ sung góc nhìn ngoài của căn hộ.
            </p>
            <PhotoCaptureInput
              label="Chụp / Tải ảnh P02 (Tùy chọn)"
              value={formData.photoP02?.url || ''}
              onChange={(url) => updateFormData({ photoP02: { ...formData.photoP02, url } })}
              watermarkText={`CONDO_P02 | ${formData.unitCode || 'UNIT'} | T${formData.unitFloorNumber || 1}`}
              height="150px"
            />
          </div>

          {/* Ảnh P03: Ban công / Logia / Góc phụ (Mặc định N/A) */}
          <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <Camera className="w-4 h-4 text-slate-500" />
                Ảnh P03: Ban công / Logia căn hộ
              </span>
              <label className="flex items-center gap-1 text-[11px] text-teal-700 font-bold bg-teal-50 px-1.5 py-0.5 rounded border border-teal-200 cursor-pointer">
                <input
                  type="checkbox"
                  checked={Boolean(formData.photoP03?.notApplicable)}
                  onChange={(e) =>
                    updateFormData({
                      photoP03: { ...formData.photoP03, notApplicable: e.target.checked },
                    })
                  }
                  className="rounded text-teal-600 focus:ring-teal-500"
                />
                <span>N/A (Tùy chọn)</span>
              </label>
            </div>
            <p className="text-[11px] text-slate-500">
              Mặc định bỏ qua nếu căn hộ không có ban công/logia mở hoặc góc nhìn phụ ra ngoài.
            </p>
            <PhotoCaptureInput
              label="Chụp / Tải ảnh P03 (Tùy chọn)"
              value={formData.photoP03?.url || ''}
              onChange={(url) => updateFormData({ photoP03: { ...formData.photoP03, url } })}
              watermarkText={`CONDO_P03 | ${formData.unitCode || 'UNIT'} | T${formData.unitFloorNumber || 1}`}
              height="150px"
            />
          </div>

          {/* Ảnh P04: Toàn cảnh nội thất phòng khách */}
          <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <Camera className="w-4 h-4 text-teal-600" />
                Ảnh P04: Toàn cảnh phòng khách *
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
              Chụp góc rộng toàn cảnh không gian sinh hoạt chính / phòng khách bên trong căn hộ.
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

      {/* 2.4. Lịch sử cải tạo nội thất & Hiện tượng thấm dột quá khứ (Phương án A: Bỏ móng/cọc/tầng hầm) */}
      <Card className="border-slate-200 bg-white shadow-xs">
        <div className="flex items-center justify-between gap-2 pb-3 mb-4 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <Wrench className="w-5 h-5 text-teal-600" />
            <h2 className="text-base font-bold text-slate-800">
              2.4. Lịch Sử Sửa Chữa & Hiện Trạng Thấm Dột Căn Hộ
            </h2>
          </div>
          <span className="text-xs bg-slate-100 text-slate-600 font-semibold px-2 py-0.5 rounded">
            Đặc thù chung cư
          </span>
        </div>

        <div className="space-y-4">
          {/* Lịch sử đập phá tường / cải tạo nội thất */}
          <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
            <label className="flex items-start gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={Boolean((formData.historyInterview?.renovationLoad ?? 0) > 0)}
                onChange={(e) =>
                  updateFormData({
                    historyInterview: {
                      ...formData.historyInterview,
                      renovationLoad: e.target.checked ? 1 : 0,
                    },
                  })
                }
                className="mt-0.5 rounded text-teal-600 focus:ring-teal-500 w-4 h-4"
              />
              <div className="text-xs text-slate-700 leading-relaxed">
                <strong className="block text-slate-900 font-semibold mb-0.5">
                  Căn hộ đã từng đập thông tường phòng, cải tạo nội thất hoặc sửa chữa lớn
                </strong>
                Ghi nhận các can thiệp vào tường ngăn, trần thạch cao, thay đổi gạch sàn, sửa chữa đường ống toilet...
              </div>
            </label>
          </div>

          {/* Thấm dột từ căn hộ tầng trên */}
          <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
            <label className="flex items-start gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={Boolean((formData.historyInterview?.fireFloodIncident ?? 0) > 0)}
                onChange={(e) =>
                  updateFormData({
                    historyInterview: {
                      ...formData.historyInterview,
                      fireFloodIncident: e.target.checked ? 1 : 0,
                    },
                  })
                }
                className="mt-0.5 rounded text-teal-600 focus:ring-teal-500 w-4 h-4"
              />
              <div className="text-xs text-slate-700 leading-relaxed">
                <strong className="block text-slate-900 font-semibold mb-0.5 flex items-center gap-1.5">
                  <Droplets className="w-3.5 h-3.5 text-blue-600" />
                  Hiện tượng thấm dột nước từ căn hộ tầng trên xuống (Toilet / Trần nhà)
                </strong>
                Thực tế khảo sát chung cư cho thấy thấm sàn vệ sinh tầng trên là nguồn gây bong tróc trần và nứt rộp vữa phổ biến nhất.
              </div>
            </label>
          </div>

          {/* Thiết bị nhạy cảm rung chấn */}
          <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
            <label className="flex items-start gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={Boolean(formData.historyInterview?.sensitiveEquipment?.has)}
                onChange={(e) =>
                  updateFormData({
                    historyInterview: {
                      ...formData.historyInterview,
                      sensitiveEquipment: {
                        ...formData.historyInterview?.sensitiveEquipment,
                        has: e.target.checked,
                      },
                    },
                  })
                }
                className="mt-0.5 rounded text-amber-600 focus:ring-amber-500 w-4 h-4"
              />
              <div className="text-xs text-slate-700 leading-relaxed">
                <strong className="block text-slate-900 font-semibold mb-0.5">
                  Căn hộ có thiết bị đặc biệt hoặc hoạt động nhạy cảm với rung chấn
                </strong>
                Bể cá thủy sinh lớn, đàn đại dương cầm, phòng cách âm, máy chủ server...
              </div>
            </label>

            {formData.historyInterview?.sensitiveEquipment?.has && (
              <div className="pt-2 animate-in fade-in">
                <Input
                  label="Mô tả cụ thể loại thiết bị nhạy cảm *"
                  placeholder="VD: Bể cá cảnh 600L tại phòng khách, đàn Piano cơ..."
                  value={formData.historyInterview?.sensitiveEquipment?.description || ''}
                  onChange={(e) =>
                    updateFormData({
                      historyInterview: {
                        ...formData.historyInterview,
                        sensitiveEquipment: {
                          ...formData.historyInterview?.sensitiveEquipment,
                          description: e.target.value,
                        },
                      },
                    })
                  }
                />
              </div>
            )}
          </div>
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
