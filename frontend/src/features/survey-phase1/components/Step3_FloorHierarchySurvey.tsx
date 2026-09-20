import React, { useState } from 'react';
import { usePhase1SurveyStore } from '../store/usePhase1SurveyStore';
import { Card } from '../../../core/components/ui/Card';
import { Button } from '../../../core/components/ui/Button';
import { Badge } from '../../../core/components/ui/Badge';
import { Input, Select } from '../../../core/components/ui/FormControls';
import { PhotoCaptureInput } from '../../../components/common/PhotoCaptureInput';
import { DefectPinningCanvas, DefectItem } from '../../../components/canvas/DefectPinningCanvas';
import { FloorCadPinningCanvas, CadZonePin } from '../../../components/canvas/FloorCadPinningCanvas';
import { FloorSurveyData, DamageZoneData } from '../types/phase1.types';
import { Plus, Trash2, Camera, Layers, MapPin, Maximize2, AlertCircle } from 'lucide-react';

const COMMON_ROOM_NAMES = [
  'Phòng khách',
  'Phòng ngủ trước',
  'Phòng ngủ sau',
  'Phòng ngủ 1',
  'Phòng ngủ 2',
  'Phòng bếp / Ăn',
  'Ban công / Lô gia',
  'Nhà vệ sinh / WC',
  'Cầu thang / Hành lang',
  'Sân thượng / Sân phơi',
  'Phòng thờ',
  'Gara / Nhà xe',
  'Kho chứa đồ',
  'Khác',
];

const COMPONENT_TYPES = [
  'Tường gạch vữa xi măng',
  'Cột BTCT',
  'Dầm BTCT',
  'Sàn BTCT',
  'Cầu thang BTCT',
  'Mái / Sê nô',
  'Khung thép',
  'Khác',
];

const WALL_MATERIALS = [
  'Tường gạch trát vữa XM sơn nước',
  'Bê tông cốt thép (BTCT)',
  'Tường gạch ốp gạch men',
  'Tường gạch quét vôi',
  'Tường / Vách thạch cao',
  'Gỗ / Ván công nghiệp',
  'Vách kính khung nhôm',
  'Khác',
];

const BURLAND_GRADES = [
  { value: 0, label: 'Grade 0 - Không đáng kể (<=0.1mm)' },
  { value: 1, label: 'Grade 1 - Rất nhẹ (~0.1-1mm)' },
  { value: 2, label: 'Grade 2 - Nhẹ (~1-5mm)' },
  { value: 3, label: 'Grade 3 - Trung bình (~5-15mm)' },
  { value: 4, label: 'Grade 4 - Nặng (~15-25mm)' },
  { value: 5, label: 'Grade 5 - Rất nặng (>=25mm)' },
];

export const Step3_FloorHierarchySurvey: React.FC = () => {
  const { formData, updateFormData, nextStep, prevStep } = usePhase1SurveyStore();
  const [activeFloorIndex, setActiveFloorIndex] = useState<number>(0);
  const [pinningZoneId, setPinningZoneId] = useState<string | null>(null);

  const currentFloor = formData.floors[activeFloorIndex] || formData.floors[0];

  // Thêm tầng mới
  const handleAddFloor = () => {
    const floorNumber = formData.floors.length;
    const newFloorName = floorNumber === 1 ? 'Tầng 1 (Lầu 1)' : `Tầng ${floorNumber}`;
    const newFloor: FloorSurveyData = {
      id: `floor_${Date.now()}`,
      floorName: newFloorName,
      overviewPhotos: [],
      cadSketchPhotoUrl: '',
      cadZonePins: [],
      zones: [],
    };
    updateFormData({ floors: [...formData.floors, newFloor] });
    setActiveFloorIndex(formData.floors.length);
  };

  // Thêm Vùng Z-xx mới vào tầng hiện tại
  const handleAddZone = () => {
    const totalZonesInHouse = formData.floors.reduce((acc, f) => acc + f.zones.length, 0);
    const nextZoneCode = `Z-${String(totalZonesInHouse + 1).padStart(2, '0')}`;

    const newZone: DamageZoneData = {
      id: `zone_${Date.now()}`,
      zoneCode: nextZoneCode,
      floorName: currentFloor.floorName,
      roomName: 'Phòng khách',
      componentType: 'Tường gạch vữa xi măng',
      wallMaterial: 'Tường gạch trát vữa XM sơn nước',
      functionalImpactRepairNeeded: false,
      burlandGrade: 0,
      ctxPhotoUrl: '',
      notes: '',
      defects: [],
    };

    const updatedFloors = [...formData.floors];
    updatedFloors[activeFloorIndex] = {
      ...currentFloor,
      zones: [...currentFloor.zones, newZone],
    };
    updateFormData({ floors: updatedFloors });
  };

  // Cập nhật Vùng Z-xx
  const handleUpdateZone = (zoneIndex: number, updater: Partial<DamageZoneData>) => {
    const updatedZones = [...currentFloor.zones];
    updatedZones[zoneIndex] = { ...updatedZones[zoneIndex], ...updater };
    const updatedFloors = [...formData.floors];
    updatedFloors[activeFloorIndex] = { ...currentFloor, zones: updatedZones };
    updateFormData({ floors: updatedFloors });
  };

  // Xóa Vùng Z-xx
  const handleDeleteZone = (zoneIndex: number) => {
    if (!confirm('Bạn có chắc muốn xóa Vùng khảo sát này?')) return;
    const updatedZones = currentFloor.zones.filter((_, idx) => idx !== zoneIndex);
    const updatedFloors = [...formData.floors];
    updatedFloors[activeFloorIndex] = { ...currentFloor, zones: updatedZones };
    updateFormData({ floors: updatedFloors });
  };

  // Zone đang được mở Canvas ghim nứt
  const activePinningZone = currentFloor?.zones.find((z) => z.id === pinningZoneId);

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-12">
      {/* Header & Tabs Tầng */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
        <div>
          <h2 className="text-base sm:text-lg font-bold text-slate-800 flex items-center gap-2">
            <Layers className="w-5 h-5 text-emerald-600" />
            <span>3. Khảo Sát Hiện Trạng Chi Tiết (Tầng ➔ Vùng Z ➔ Khuyết Tật D)</span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Đi từng tầng, chụp ảnh bao quát phòng và ghim vết nứt chính xác lên ảnh
          </p>
        </div>

        <Button size="sm" icon={<Plus className="w-4 h-4" />} onClick={handleAddFloor}>
          Thêm tầng lầu
        </Button>
      </div>

      {/* Tabs chọn Tầng */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 border-b border-slate-200 no-scrollbar">
        {formData.floors.map((fl, idx) => (
          <button
            key={fl.id}
            onClick={() => setActiveFloorIndex(idx)}
            className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all whitespace-nowrap flex items-center gap-2 border ${
              activeFloorIndex === idx
                ? 'bg-slate-900 text-white border-slate-900 shadow-sm'
                : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-50'
            }`}
          >
            <span>{fl.floorName}</span>
            <span
              className={`px-1.5 py-0.5 rounded-full text-[10px] ${
                activeFloorIndex === idx
                  ? 'bg-slate-800 text-emerald-400'
                  : 'bg-slate-100 text-slate-600'
              }`}
            >
              {fl.zones.length} Vùng
            </span>
          </button>
        ))}
      </div>

      {/* Danh sách các Vùng Z-xx của tầng hiện tại */}
      <div className="space-y-5">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
            Các Vùng Khảo Sát thuộc {currentFloor.floorName} ({currentFloor.zones.length} Vùng)
          </span>
          <Button size="sm" variant="outline" icon={<Plus className="w-3.5 h-3.5" />} onClick={handleAddZone}>
            + Thêm Vùng Z-xx
          </Button>
        </div>

        {currentFloor.zones.length === 0 ? (
          <div className="p-8 text-center bg-slate-50 rounded-2xl border border-dashed border-slate-300">
            <AlertCircle className="w-8 h-8 text-slate-400 mx-auto mb-2" />
            <p className="text-sm font-semibold text-slate-700">Chưa có Vùng khảo sát nào ở {currentFloor.floorName}</p>
            <p className="text-xs text-slate-500 mt-1 mb-4">Bấm nút bên dưới để thêm Vùng Z-01 (VD: Mảng tường phòng khách, phòng ngủ...)</p>
            <Button size="sm" onClick={handleAddZone}>+ Thêm Vùng Z-01</Button>
          </div>
        ) : (
          currentFloor.zones.map((zone, zIdx) => (
            <Card key={zone.id} className="relative overflow-hidden border-slate-200">
              {/* Header của Vùng */}
              <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-1 rounded-lg bg-slate-900 text-white text-xs font-mono font-bold">
                    {zone.zoneCode}
                  </span>
                  <span className="text-sm font-bold text-slate-800">{zone.roomName}</span>
                </div>
                <button
                  onClick={() => handleDeleteZone(zIdx)}
                  className="p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                  title="Xóa Vùng"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>

              {/* Chi tiết Vùng */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
                <Select
                  label="Tên Phòng / Không Gian"
                  value={zone.roomName}
                  onChange={(e) => handleUpdateZone(zIdx, { roomName: e.target.value })}
                  options={COMMON_ROOM_NAMES.map((r) => ({ value: r, label: r }))}
                />

                <Select
                  label="Cấu Kiện Mảng Vách"
                  value={zone.componentType}
                  onChange={(e) => handleUpdateZone(zIdx, { componentType: e.target.value })}
                  options={COMPONENT_TYPES.map((c) => ({ value: c, label: c }))}
                />

                <Select
                  label="Vật Liệu Bề Mặt"
                  value={zone.wallMaterial}
                  onChange={(e) => handleUpdateZone(zIdx, { wallMaterial: e.target.value })}
                  options={WALL_MATERIALS.map((w) => ({ value: w, label: w }))}
                />
              </div>

              {/* Burland sơ bộ & Cờ ảnh hưởng */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4 p-3 bg-slate-50/70 rounded-xl border border-slate-100">
                <Select
                  label="Burland Grade Sơ Bộ Vùng"
                  value={zone.burlandGrade}
                  onChange={(e) => handleUpdateZone(zIdx, { burlandGrade: Number(e.target.value) })}
                  options={BURLAND_GRADES.map((b) => ({ value: b.value, label: b.label }))}
                />

                <div className="flex items-center mt-6">
                  <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={zone.functionalImpactRepairNeeded}
                      onChange={(e) =>
                        handleUpdateZone(zIdx, { functionalImpactRepairNeeded: e.target.checked })
                      }
                      className="rounded text-amber-600 focus:ring-amber-500"
                    />
                    <span>⚠️ Ảnh hưởng chức năng / Cần sửa chữa (+2đ E6)</span>
                  </label>
                </div>
              </div>

              {/* Ảnh bối cảnh Photo CTX & Ghim Defect D-xx */}
              <div className="p-3 bg-slate-50/50 rounded-xl border border-slate-200">
                <PhotoCaptureInput
                  label={`Ảnh bối cảnh mảng tường Vùng ${zone.zoneCode} (Photo CTX)`}
                  value={zone.ctxPhotoUrl}
                  onChange={(url) => handleUpdateZone(zIdx, { ctxPhotoUrl: url })}
                />

                {zone.ctxPhotoUrl && (
                  <div className="mt-3 flex items-center justify-between">
                    <span className="text-xs text-slate-600 font-medium">
                      Đã ghim: <strong className="text-emerald-700">{zone.defects.length} Khuyết tật D</strong>
                    </span>
                    <Button
                      size="sm"
                      variant="outline"
                      icon={<MapPin className="w-3.5 h-3.5" />}
                      onClick={() => setPinningZoneId(zone.id)}
                    >
                      {zone.defects.length > 0 ? 'Xem & Chỉnh sửa ghim vết nứt' : '+ Thả ghim vết nứt D-xx lên ảnh'}
                    </Button>
                  </div>
                )}
              </div>
            </Card>
          ))
        )}
      </div>

      {/* Modal Ghim Vết Nứt (Defect Pinning Canvas) */}
      {activePinningZone && activePinningZone.ctxPhotoUrl && (
        <div className="fixed inset-0 z-50 bg-slate-900/90 flex flex-col p-4 animate-in fade-in">
          <div className="flex items-center justify-between text-white pb-3 border-b border-slate-800">
            <div>
              <h3 className="font-bold text-sm sm:text-base flex items-center gap-2">
                <span>Thả Ghim & Ghi Sổ Khuyết Tật D-xx</span>
                <span className="px-2 py-0.5 rounded bg-emerald-600 text-xs">{activePinningZone.zoneCode} - {activePinningZone.roomName}</span>
              </h3>
            </div>
            <Button variant="danger" size="sm" onClick={() => setPinningZoneId(null)}>
              Xong & Đóng lại
            </Button>
          </div>
          <div className="flex-1 overflow-hidden mt-3">
            <DefectPinningCanvas
              ctxPhotoUrl={activePinningZone.ctxPhotoUrl}
              defects={activePinningZone.defects}
              onChange={(defects: DefectItem[]) => {
                const zoneIndex = currentFloor.zones.findIndex((z) => z.id === activePinningZone.id);
                if (zoneIndex !== -1) {
                  handleUpdateZone(zoneIndex, { defects });
                }
              }}
            />
          </div>
        </div>
      )}

      {/* Navigation */}
      <div className="flex justify-between pt-4">
        <Button variant="outline" onClick={prevStep}>
          ⬅️ Quay lại Bước 2
        </Button>
        <Button onClick={nextStep}>
          Tiếp tục: Bước 4 (Chốt Burland & Cờ KC) ➔
        </Button>
      </div>
    </div>
  );
};
