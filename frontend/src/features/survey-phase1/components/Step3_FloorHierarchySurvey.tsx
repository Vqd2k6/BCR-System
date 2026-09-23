import React, { useState } from 'react';
import { usePhase1SurveyStore } from '../store/usePhase1SurveyStore';
import { Card } from '../../../core/components/ui/Card';
import { Button } from '../../../core/components/ui/Button';
import { Badge } from '../../../core/components/ui/Badge';
import { Input, Select } from '../../../core/components/ui/FormControls';
import { PhotoCaptureInput } from '../../../components/common/PhotoCaptureInput';
import { DefectPinningCanvas, DefectItem } from '../../../components/canvas/DefectPinningCanvas';
import { FloorCadPinningCanvas, CadZonePin } from '../../../components/canvas/FloorCadPinningCanvas';
import { FloorSurveyData, DamageZoneData, StructuralElementData } from '../types/phase1.types';
import { LevelSelectorWithGuide } from './LevelSelectorWithGuide';
import { SAG_LEVEL_OPTIONS } from '../constants/levelGuideConstants';
import {
  Plus,
  Trash2,
  Camera,
  Layers,
  MapPin,
  Maximize2,
  AlertCircle,
  CheckCircle2,
  ChevronRight,
  Sparkles,
  ArrowRight,
  ShieldAlert,
  Building,
  Hammer,
  Image as ImageIcon,
  Copy,
  X,
  Ruler,
} from 'lucide-react';

const COMMON_ROOM_NAMES = [
  'Phòng khách',
  'Phòng ngủ trước',
  'Phòng ngủ sau',
  'Phòng ngủ 1',
  'Phòng ngủ 2',
  'Phòng ngủ 3',
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

const ARCH_COMPONENT_TYPES = [
  'Tường gạch vữa xi măng',
  'Vách thạch cao / Vách ngăn nhẹ',
  'Sàn / Nền lát gạch men',
  'Nền bê tông hoàn thiện',
  'Trần thạch cao / Trần la phông',
  'Cầu thang xây gạch / Ốp đá',
  'Mảng tường giáp ranh',
  'Khác',
];

const WALL_MATERIALS = [
  'Tường gạch trát vữa XM sơn nước',
  'Tường gạch ốp gạch men',
  'Tường gạch quét vôi',
  'Vách thạch cao sơn nước',
  'Gỗ / Ván công nghiệp',
  'Vách kính khung nhôm',
  'Khác',
];

const STRUCTURAL_ELEMENT_TYPES = [
  'Cột BTCT',
  'Dầm BTCT (Dầm chính / Dầm phụ)',
  'Bản sàn BTCT chịu lực',
  'Cột thép / Dầm thép',
  'Khung thép định hình',
  'Tường BTCT / Vách thang máy',
  'Cầu thang BTCT chịu lực',
  'Gối tựa / Mối nối liên kết chịu lực',
  'Khác',
];

const STRUCTURAL_MATERIALS = [
  'Bê tông cốt thép (BTCT) đổ toàn khối',
  'Bê tông cốt thép lắp ghép / đúc sẵn',
  'Thép hình / Thép cán nóng',
  'Kết cấu liên hợp Thép - Bê tông',
  'Khác',
];

export const Step3_FloorHierarchySurvey: React.FC = () => {
  const { formData, updateFormData, nextStep, prevStep } = usePhase1SurveyStore();
  const [activeFloorIndex, setActiveFloorIndex] = useState<number>(0);
  const [activeZoneIndex, setActiveZoneIndex] = useState<number>(0);
  const [activeElementIndex, setActiveElementIndex] = useState<number>(0);

  // Modals
  const [pinningZoneId, setPinningZoneId] = useState<string | null>(null);
  const [pinningElementId, setPinningElementId] = useState<string | null>(null);

  const currentFloor: FloorSurveyData = formData.floors[activeFloorIndex] || formData.floors[0];
  const zones: DamageZoneData[] = currentFloor.zones || [];
  const structuralElements: StructuralElementData[] = currentFloor.structuralElements || [];

  // 1. Thêm Tầng Mới
  const handleAddFloor = () => {
    const floorNumber = formData.floors.length;
    const newFloorName = floorNumber === 1 ? 'Tầng 1 (Lầu 1)' : `Tầng ${floorNumber}`;
    const newFloor: FloorSurveyData = {
      id: `floor_${Date.now()}`,
      floorName: newFloorName,
      overviewPhotos: [],
      cadSketchPhotoUrl: '',
      cadStructuralSketchPhotoUrl: '',
      cadZonePins: [],
      cadElementPins: [],
      zones: [],
      structuralElements: [],
    };
    updateFormData({ floors: [...formData.floors, newFloor] });
    setActiveFloorIndex(formData.floors.length);
    setActiveZoneIndex(0);
    setActiveElementIndex(0);
  };

  // Helper cuộn mượt đến phần tử theo ID
  const scrollToTarget = (elementId: string) => {
    const el = document.getElementById(elementId);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  // Điều hướng chuyển Vùng Z và cuộn lên đầu card chi tiết
  const navigateToZone = (idx: number, markCurrentCompleted = false) => {
    if (idx < 0 || idx >= zones.length) return;
    if (markCurrentCompleted && activeZoneIndex >= 0 && activeZoneIndex < zones.length) {
      handleUpdateZone(activeZoneIndex, { isCompleted: true });
    }
    setActiveZoneIndex(idx);
    setTimeout(() => {
      scrollToTarget('step3-active-zone-card');
    }, 60);
  };

  const handleNextZone = () => {
    navigateToZone(activeZoneIndex + 1, true);
  };

  const handlePrevZone = () => {
    navigateToZone(activeZoneIndex - 1, false);
  };

  // Khi bấm "Thêm Vùng Z tiếp theo" ở cuối: cuộn lên vị trí Sơ đồ CAD_01 để người dùng chấm điểm Z mới
  const handleRequestAddNextZone = () => {
    if (activeZoneIndex >= 0 && activeZoneIndex < zones.length) {
      handleUpdateZone(activeZoneIndex, { isCompleted: true });
    }
    const cadEl = document.getElementById('step3-floor-cad-section');
    if (cadEl) {
      cadEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
      cadEl.classList.add('ring-4', 'ring-emerald-400');
      setTimeout(() => cadEl.classList.remove('ring-4', 'ring-emerald-400'), 2500);
    }
  };

  // Điều hướng chuyển Cấu kiện E và cuộn lên đầu card chi tiết
  const navigateToElement = (idx: number, markCurrentCompleted = false) => {
    if (idx < 0 || idx >= structuralElements.length) return;
    if (markCurrentCompleted && activeElementIndex >= 0 && activeElementIndex < structuralElements.length) {
      handleUpdateElement(activeElementIndex, { isCompleted: true });
    }
    setActiveElementIndex(idx);
    setTimeout(() => {
      scrollToTarget('step3-active-element-card');
    }, 60);
  };

  const handleNextElement = () => {
    navigateToElement(activeElementIndex + 1, true);
  };

  const handlePrevElement = () => {
    navigateToElement(activeElementIndex - 1, false);
  };

  // Khi bấm "Thêm Kết Cấu E tiếp theo" ở cuối: cuộn lên vị trí Sơ đồ CAD_02 để người dùng chấm điểm E mới
  const handleRequestAddNextElement = () => {
    if (activeElementIndex >= 0 && activeElementIndex < structuralElements.length) {
      handleUpdateElement(activeElementIndex, { isCompleted: true });
    }
    const cadEl = document.getElementById('step3-structure-cad-section');
    if (cadEl) {
      cadEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
      cadEl.classList.add('ring-4', 'ring-amber-400');
      setTimeout(() => cadEl.classList.remove('ring-4', 'ring-amber-400'), 2500);
    }
  };

  // 2. Tự động sinh Vùng Z khi chấm ghim trên CAD_01
  const handleAutoCreateZonePin = (pin: CadZonePin) => {
    updateFormData((prev) => {
      const current = prev.floors[activeFloorIndex] || prev.floors[0];
      if (!current) return prev;
      const prevZones = current.zones || [];
      const prevZone = prevZones[prevZones.length - 1];
      const newZone: DamageZoneData = {
        id: `zone_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
        zoneCode: pin.zoneCode,
        floorName: current.floorName,
        roomName: prevZone ? prevZone.roomName : 'Phòng khách',
        customRoomName: prevZone?.customRoomName || '',
        componentType: prevZone ? prevZone.componentType : 'Tường gạch vữa xi măng',
        customComponentType: prevZone?.customComponentType || '',
        wallMaterial: prevZone ? prevZone.wallMaterial : 'Tường gạch trát vữa XM sơn nước',
        customWallMaterial: prevZone?.customWallMaterial || '',
        overviewPhotos: [],
        ctxPhotoUrl: '',
        hasDamage: false,
        notes: '',
        defects: [],
        isCompleted: false,
      };

      const updatedFloors = [...prev.floors];
      const currentPins = current.cadZonePins || [];
      const hasPin = currentPins.some((p) => p.id === pin.id || p.zoneCode === pin.zoneCode);
      const updatedPins = hasPin ? currentPins : [...currentPins, pin];

      updatedFloors[activeFloorIndex] = {
        ...current,
        cadZonePins: updatedPins,
        zones: [...prevZones, newZone],
      };
      return { ...prev, floors: updatedFloors };
    });
    // Luôn giữ ở Z-01 đầu tiên cho người dùng, không tự động nhảy sang ô mới tạo
    if (zones.length === 0) {
      setActiveZoneIndex(0);
    }
  };

  // 3. Xử lý khi bấm nút "Thêm Vùng Z" (nếu cần fallback)
  const handleRequestAddZone = () => {
    handleRequestAddNextZone();
  };

  // 4. Tự động sinh Vùng E khi chấm ghim trên CAD_02
  const handleAutoCreateElementPin = (pin: CadZonePin) => {
    updateFormData((prev) => {
      const current = prev.floors[activeFloorIndex] || prev.floors[0];
      if (!current) return prev;
      const prevEls = current.structuralElements || [];
      const prevEl = prevEls[prevEls.length - 1];
      const newElement: StructuralElementData = {
        id: `el_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
        elementCode: pin.zoneCode,
        floorName: current.floorName,
        roomName: prevEl ? prevEl.roomName : 'Phòng khách',
        customRoomName: prevEl?.customRoomName || '',
        elementType: prevEl ? prevEl.elementType : 'Cột BTCT',
        customElementType: prevEl?.customElementType || '',
        materialType: prevEl ? prevEl.materialType : 'Bê tông cốt thép (BTCT) đổ toàn khối',
        customMaterialType: prevEl?.customMaterialType || '',
        overviewPhotos: [],
        ctxPhotoUrl: '',
        hasDamage: false,
        notes: '',
        defects: [],
        isCompleted: false,
      };

      const updatedFloors = [...prev.floors];
      const currentPins = current.cadElementPins || [];
      const hasPin = currentPins.some((p) => p.id === pin.id || p.zoneCode === pin.zoneCode);
      const updatedPins = hasPin ? currentPins : [...currentPins, pin];

      updatedFloors[activeFloorIndex] = {
        ...current,
        cadElementPins: updatedPins,
        structuralElements: [...prevEls, newElement],
      };
      return { ...prev, floors: updatedFloors };
    });
    // Luôn giữ ở E-01 đầu tiên cho người dùng, không tự động nhảy sang ô mới tạo
    if (structuralElements.length === 0) {
      setActiveElementIndex(0);
    }
  };

  // 5. Xử lý khi bấm nút "Thêm Vùng E" (fallback)
  const handleRequestAddElement = () => {
    handleRequestAddNextElement();
  };

  // 6. Cập nhật Vùng Z
  const handleUpdateZone = (zIdx: number, updater: Partial<DamageZoneData>) => {
    const updatedZones = [...zones];
    const currentZ = updatedZones[zIdx];
    if (!currentZ) return;

    const merged = { ...currentZ, ...updater };
    if (merged.defects && merged.defects.length > 0) {
      let maxBurland = 0;
      let repairNeeded = false;
      merged.defects.forEach((d) => {
        const w = d.widthMaxMm || 0;
        let bGrade = 0;
        if (w <= 0.1) bGrade = 0;
        else if (w <= 1) bGrade = 1;
        else if (w <= 5) bGrade = 2;
        else if (w <= 15) bGrade = 3;
        else if (w <= 25) bGrade = 4;
        else bGrade = 5;

        if (bGrade > maxBurland) maxBurland = bGrade;
        if (bGrade >= 2 || (d.functionalImpactE6 && d.functionalImpactE6 >= 1)) {
          repairNeeded = true;
        }
      });
      merged.burlandGrade = maxBurland;
      merged.functionalImpactRepairNeeded = repairNeeded;
    } else {
      merged.burlandGrade = 0;
      merged.functionalImpactRepairNeeded = false;
    }

    updatedZones[zIdx] = merged;
    const updatedFloors = [...formData.floors];
    updatedFloors[activeFloorIndex] = { ...currentFloor, zones: updatedZones };
    updateFormData({ floors: updatedFloors });
  };

  // 7. Xóa Vùng Z
  const handleDeleteZone = (zIdx: number) => {
    if (!confirm('Bạn có chắc muốn xóa Vùng khảo sát kiến trúc này?')) return;
    const zoneToDelete = zones[zIdx];
    const updatedZones = zones.filter((_, idx) => idx !== zIdx);
    const updatedPins = (currentFloor.cadZonePins || []).filter((p) => p.zoneCode !== zoneToDelete?.zoneCode);

    const updatedFloors = [...formData.floors];
    updatedFloors[activeFloorIndex] = { ...currentFloor, zones: updatedZones, cadZonePins: updatedPins };
    updateFormData({ floors: updatedFloors });
    if (activeZoneIndex >= updatedZones.length) {
      setActiveZoneIndex(Math.max(0, updatedZones.length - 1));
    }
  };

  // 8. Cập nhật Vùng E
  const handleUpdateElement = (eIdx: number, updater: Partial<StructuralElementData>) => {
    const updatedElements = [...structuralElements];
    if (!updatedElements[eIdx]) return;
    updatedElements[eIdx] = { ...updatedElements[eIdx], ...updater };
    const updatedFloors = [...formData.floors];
    updatedFloors[activeFloorIndex] = { ...currentFloor, structuralElements: updatedElements };
    updateFormData({ floors: updatedFloors });
  };

  // 9. Xóa Vùng E
  const handleDeleteElement = (eIdx: number) => {
    if (!confirm('Bạn có chắc muốn xóa Vùng kết cấu chịu lực này?')) return;
    const elToDelete = structuralElements[eIdx];
    const updatedElements = structuralElements.filter((_, idx) => idx !== eIdx);
    const updatedPins = (currentFloor.cadElementPins || []).filter((p) => p.zoneCode !== elToDelete?.elementCode);

    const updatedFloors = [...formData.floors];
    updatedFloors[activeFloorIndex] = { ...currentFloor, structuralElements: updatedElements, cadElementPins: updatedPins };
    updateFormData({ floors: updatedFloors });
    if (activeElementIndex >= updatedElements.length) {
      setActiveElementIndex(Math.max(0, updatedElements.length - 1));
    }
  };

  // Active items
  const activeZone = zones[activeZoneIndex];
  const activeElement = structuralElements[activeElementIndex];

  // Pinning modal objects
  const pinningZoneObj = zones.find((z) => z.id === pinningZoneId);
  const pinningElementObj = structuralElements.find((e) => e.id === pinningElementId);

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-12">
      {/* Header & Tabs Tầng */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <h2 className="text-base sm:text-lg font-bold text-slate-800 flex items-center gap-2">
            <Layers className="w-5 h-5 text-emerald-600" />
            <span>3. Khảo Sát Hiện Trạng Chi Tiết</span>
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Đánh dấu tự sinh các Vùng trên sơ đồ CAD, khảo sát tuần tự và tự động kế thừa thông tin
          </p>
        </div>

        <Button size="sm" icon={<Plus className="w-4 h-4" />} onClick={handleAddFloor}>
          Thêm Tầng Mới
        </Button>
      </div>

      {/* 3.1. Tabs chọn Tầng */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 border-b border-slate-200 no-scrollbar">
        {formData.floors.map((fl, idx) => (
          <button
            key={fl.id || idx}
            onClick={() => {
              setActiveFloorIndex(idx);
              setActiveZoneIndex(0);
              setActiveElementIndex(0);
            }}
            className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition-all whitespace-nowrap flex items-center gap-2 border ${
              activeFloorIndex === idx
                ? 'bg-emerald-700 text-white border-emerald-700 shadow-xs'
                : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
            }`}
          >
            <span>{fl.floorName}</span>
            <span
              className={`px-1.5 py-0.5 rounded-full text-[10px] font-mono ${
                activeFloorIndex === idx ? 'bg-emerald-800 text-emerald-100' : 'bg-slate-100 text-slate-600'
              }`}
            >
              {fl.zones?.length || 0} Z • {fl.structuralElements?.length || 0} E
            </span>
          </button>
        ))}
      </div>

      {/* ========================================================================= */}
      {/* PHẦN 1: SƠ ĐỒ CAD_01 & KHẢO SÁT VÙNG KIẾN TRÚC / MẢNG TƯỜNG (VÙNG Z)     */}
      {/* ========================================================================= */}
      <Card id="step3-floor-cad-section" className="border-slate-200 bg-white space-y-4 shadow-xs">
        {/* Header CAD_01 */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <Building className="w-5 h-5 text-emerald-600" />
            <div>
              <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                <span>3.1. Sơ Đồ CAD_01 & Khảo Sát Mảng Tường Kiến Trúc (Vùng Z)</span>
                <span className="px-2 py-0.5 rounded-full text-[11px] font-mono bg-emerald-50 text-emerald-700 border border-emerald-200">
                  {zones.length} Vùng Z đã tạo
                </span>
              </h3>
              <p className="text-xs text-slate-500">
                Đánh dấu vị trí các Vùng Z trực tiếp trên sơ đồ mặt bằng kiến trúc và ghi sổ chi tiết
              </p>
            </div>
          </div>
        </div>

        {/* CAD_01 Inline Interactive Canvas */}
        <FloorCadPinningCanvas
          cadPhotoUrl={currentFloor.cadSketchPhotoUrl}
          onCadPhotoChange={(url) => {
            updateFormData((prev) => {
              const updatedFloors = [...prev.floors];
              const cur = updatedFloors[activeFloorIndex] || updatedFloors[0];
              if (!cur) return prev;
              updatedFloors[activeFloorIndex] = { ...cur, cadSketchPhotoUrl: url };
              return { ...prev, floors: updatedFloors };
            });
          }}
          pins={currentFloor.cadZonePins || []}
          onChangePins={(pins) => {
            updateFormData((prev) => {
              const updatedFloors = [...prev.floors];
              const cur = updatedFloors[activeFloorIndex] || updatedFloors[0];
              if (!cur) return prev;
              updatedFloors[activeFloorIndex] = { ...cur, cadZonePins: pins };
              return { ...prev, floors: updatedFloors };
            });
          }}
          onAutoCreatePin={handleAutoCreateZonePin}
          onSelectPin={(pin) => {
            const idx = zones.findIndex((z) => z.zoneCode === pin.zoneCode);
            if (idx !== -1) navigateToZone(idx, false);
          }}
          mode="ZONE"
          floorName={currentFloor.floorName}
          cadTitle={`Tải lên hoặc chụp sơ đồ mặt bằng kiến trúc CAD_01 (${currentFloor.floorName}):`}
        />

        {/* Stepper danh sách các Vùng Z */}
        <div className="space-y-3 pt-2">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">
              Danh sách các Vùng Z ({zones.length} Vùng)
            </span>
          </div>

          {zones.length > 0 && (
            <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
              {zones.map((z, idx) => {
                const isSelected = activeZoneIndex === idx;
                const hasDefects = z.defects && z.defects.length > 0;

                return (
                  <button
                    key={z.id || idx}
                    type="button"
                    onClick={() => navigateToZone(idx, false)}
                    className={`px-3 py-2 rounded-xl text-xs font-bold transition-all border flex items-center gap-1.5 whitespace-nowrap ${
                      isSelected
                        ? 'bg-emerald-700 text-white border-emerald-700 shadow-xs ring-2 ring-emerald-500/20'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    <span className="font-mono">{z.zoneCode}</span>
                    <span className="text-[11px] opacity-90">• {z.roomName}</span>
                    {hasDefects ? (
                      <span className="px-1.5 py-0.2 rounded bg-red-500 text-white text-[9px] font-mono font-bold">
                        {z.defects.length} D
                      </span>
                    ) : z.isCompleted ? (
                      <span className="text-emerald-400 text-[10px] font-bold">✓</span>
                    ) : null}
                  </button>
                );
              })}
            </div>
          )}

          {/* Form chi tiết Vùng Z đang chọn */}
          {zones.length === 0 ? (
            <div className="p-6 text-center bg-slate-50 rounded-xl border border-dashed border-slate-300 space-y-2">
              <AlertCircle className="w-7 h-7 text-slate-400 mx-auto" />
              <p className="text-xs sm:text-sm font-semibold text-slate-700">
                Chưa có Vùng kiến trúc (Z) nào ở {currentFloor.floorName}
              </p>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                Bấm mở Sơ đồ CAD_01 để chạm chấm các Vùng Z trên sơ đồ kiến trúc.
              </p>
              <Button size="sm" onClick={handleRequestAddNextZone}>
                Chấm Vùng Z trên sơ đồ CAD
              </Button>
            </div>
          ) : activeZone ? (
            <div id="step3-active-zone-card" className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-4">
              {/* Header card Z */}
              <div className="flex items-center justify-between pb-2 border-b border-slate-200">
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-1 rounded-lg bg-emerald-700 text-white font-mono text-xs font-extrabold">
                    {activeZone.zoneCode}
                  </span>
                  <span className="text-sm font-bold text-slate-800">
                    Khảo Sát Mảng Tường ({activeZone.roomName})
                  </span>
                  {activeZone.defects && activeZone.defects.length > 0 ? (
                    <Badge variant="danger">
                      {activeZone.defects.length} khuyết tật D • Burland Grade {activeZone.burlandGrade}
                    </Badge>
                  ) : (
                    <Badge variant="success">Nguyên vẹn • Không nứt</Badge>
                  )}
                </div>

                <button
                  onClick={() => handleDeleteZone(activeZoneIndex)}
                  className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                  title="Xóa Vùng Z"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>

              {/* Thông tin thuộc tính Vùng Z */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <Select
                    id="select-zone-roomName"
                    label="Tên Phòng / Không Gian"
                    value={activeZone.roomName}
                    onChange={(e) => handleUpdateZone(activeZoneIndex, { roomName: e.target.value })}
                    options={COMMON_ROOM_NAMES.map((r) => ({ value: r, label: r }))}
                  />
                  {activeZone.roomName === 'Khác' && (
                    <Input
                      id="input-zone-customRoomName"
                      placeholder="Nhập tên phòng..."
                      value={activeZone.customRoomName || ''}
                      onChange={(e) =>
                        handleUpdateZone(activeZoneIndex, { customRoomName: e.target.value })
                      }
                      className="mt-1.5"
                    />
                  )}
                </div>

                <div>
                  <Select
                    id="select-zone-componentType"
                    label="Cấu Kiện Mảng Vách Kiến Trúc"
                    value={activeZone.componentType}
                    onChange={(e) =>
                      handleUpdateZone(activeZoneIndex, { componentType: e.target.value })
                    }
                    options={ARCH_COMPONENT_TYPES.map((c) => ({ value: c, label: c }))}
                  />
                  {activeZone.componentType === 'Khác' && (
                    <Input
                      id="input-zone-customComponentType"
                      placeholder="Nhập loại cấu kiện..."
                      value={activeZone.customComponentType || ''}
                      onChange={(e) =>
                        handleUpdateZone(activeZoneIndex, { customComponentType: e.target.value })
                      }
                      className="mt-1.5"
                    />
                  )}
                </div>

                <div>
                  <Select
                    id="select-zone-wallMaterial"
                    label="Vật Liệu Bề Mặt Hoàn Thiện"
                    value={activeZone.wallMaterial}
                    onChange={(e) =>
                      handleUpdateZone(activeZoneIndex, { wallMaterial: e.target.value })
                    }
                    options={WALL_MATERIALS.map((w) => ({ value: w, label: w }))}
                  />
                  {activeZone.wallMaterial === 'Khác' && (
                    <Input
                      id="input-zone-customWallMaterial"
                      placeholder="Nhập vật liệu..."
                      value={activeZone.customWallMaterial || ''}
                      onChange={(e) =>
                        handleUpdateZone(activeZoneIndex, { customWallMaterial: e.target.value })
                      }
                      className="mt-1.5"
                    />
                  )}
                </div>
              </div>

              {/* Chụp nhiều ảnh tổng quan Vùng Z */}
              <div className="p-3 bg-white rounded-xl border border-slate-200 space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Camera className="w-4 h-4 text-emerald-600" />
                    <span className="text-xs font-bold text-slate-800">
                      Ảnh Tổng Quan Mảng Tường ({activeZone.zoneCode})
                    </span>
                  </div>
                  <span className="text-[11px] text-slate-500">
                    Đã chụp: {activeZone.overviewPhotos?.length || 0} ảnh
                  </span>
                </div>

                {/* Grid ảnh tổng quan */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {activeZone.overviewPhotos?.map((photoUrl, pIdx) => (
                    <div
                      key={pIdx}
                      className="relative rounded-lg overflow-hidden border border-slate-300 aspect-video group"
                    >
                      <img src={photoUrl} alt={`Overview ${pIdx}`} className="w-full h-full object-cover" />
                      <button
                        type="button"
                        onClick={() => {
                          const updated = activeZone.overviewPhotos.filter((_, i) => i !== pIdx);
                          handleUpdateZone(activeZoneIndex, { overviewPhotos: updated });
                        }}
                        className="absolute top-1 right-1 p-1 bg-red-600 text-white rounded-md text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                        title="Xóa ảnh"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  ))}

                  <PhotoCaptureInput
                    label="Thêm ảnh tổng quan"
                    value=""
                    onChange={(url) => {
                      if (url) {
                        const updated = [...(activeZone.overviewPhotos || []), url];
                        handleUpdateZone(activeZoneIndex, {
                          overviewPhotos: updated,
                          ctxPhotoUrl: activeZone.ctxPhotoUrl || url,
                        });
                      }
                    }}
                    watermarkText={`${activeZone.zoneCode} | ${activeZone.roomName}`}
                    height="85px"
                  />
                </div>
              </div>

              {/* Tùy chọn Có Hư Hỏng / Vết Nứt */}
              <div className="p-3 bg-white rounded-xl border border-slate-200 space-y-3">
                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={activeZone.hasDamage || (activeZone.defects && activeZone.defects.length > 0)}
                      onChange={(e) => {
                        const checked = e.target.checked;
                        handleUpdateZone(activeZoneIndex, {
                          hasDamage: checked,
                          ctxPhotoUrl:
                            activeZone.ctxPhotoUrl || activeZone.overviewPhotos?.[0] || '',
                        });
                      }}
                      className="rounded text-red-600 focus:ring-red-500"
                    />
                    <span className="text-xs font-bold text-red-700">
                      Vùng {activeZone.zoneCode} CÓ vết nứt / hư hỏng cần ghi sổ D-xx
                    </span>
                  </label>
                </div>

                {/* Nếu CÓ hư hỏng: Hiển thị Canvas ghim vết nứt D-xx */}
                {(activeZone.hasDamage || (activeZone.defects && activeZone.defects.length > 0)) && (
                  <div className="p-3 bg-red-50/50 rounded-xl border border-red-200 space-y-2.5">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div>
                        <span className="text-xs font-bold text-slate-800 block">
                          Ảnh Bối Cảnh Chính (Photo CTX) & Thả Ghim Khuyết Tật D-xx
                        </span>
                        <span className="text-[11px] text-slate-600">
                          Đã ghim: <strong className="text-red-700 font-bold">{activeZone.defects?.length || 0} điểm khuyết tật</strong> (Tự động tính Burland Grade {activeZone.burlandGrade || 0})
                        </span>
                      </div>

                      <Button
                        size="sm"
                        variant="danger"
                        icon={<MapPin className="w-3.5 h-3.5" />}
                        onClick={() => setPinningZoneId(activeZone.id)}
                      >
                        {activeZone.defects?.length > 0
                          ? `Xem & Chỉnh sửa ${activeZone.defects.length} ghim D-xx ➔`
                          : 'Chấm điểm & Ghi sổ khuyết tật D-xx'}
                      </Button>
                    </div>

                    {!activeZone.ctxPhotoUrl && (
                      <PhotoCaptureInput
                        label={`Chọn hoặc chụp Ảnh bối cảnh chính để thả ghim nứt cho ${activeZone.zoneCode}:`}
                        value={activeZone.ctxPhotoUrl || ''}
                        onChange={(url) => handleUpdateZone(activeZoneIndex, { ctxPhotoUrl: url })}
                        watermarkText={`CTX | ${activeZone.zoneCode}`}
                        height="120px"
                      />
                    )}
                  </div>
                )}
              </div>

              {/* Navigation giữa các Z */}
              <div className="flex items-center justify-between pt-2 border-t border-slate-200">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={activeZoneIndex === 0}
                  onClick={handlePrevZone}
                >
                  ⬅️ Vùng {zones[activeZoneIndex - 1]?.zoneCode || 'trước'}
                </Button>

                <div className="flex items-center gap-2">
                  {activeZoneIndex < zones.length - 1 ? (
                    <Button
                      size="sm"
                      onClick={handleNextZone}
                    >
                      Tiếp theo: {zones[activeZoneIndex + 1]?.zoneCode} ➔
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      icon={<Plus className="w-3.5 h-3.5" />}
                      onClick={handleRequestAddNextZone}
                    >
                      Thêm Vùng Z tiếp theo
                    </Button>
                  )}
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </Card>

      {/* ========================================================================= */}
      {/* PHẦN 2: SƠ ĐỒ CAD_02 & KHẢO SÁT CẤU KIỆN KẾT CẤU CHỊU LỰC (VÙNG E)       */}
      {/* ========================================================================= */}
      <Card id="step3-structure-cad-section" className="border-amber-200 bg-white space-y-4 shadow-xs">
        {/* Header CAD_02 */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-amber-100">
          <div className="flex items-center gap-2">
            <Hammer className="w-5 h-5 text-amber-700" />
            <div>
              <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
                <span>3.2. Sơ Đồ CAD_02 & Khảo Sát Kết Cấu Chịu Lực (Vùng E)</span>
                <span className="px-2 py-0.5 rounded-full text-[11px] font-mono bg-amber-50 text-amber-800 border border-amber-200">
                  {structuralElements.length} Vùng E đã tạo
                </span>
              </h3>
              <p className="text-xs text-slate-500">
                Đánh dấu vị trí Cột, Dầm, Bản sàn chịu lực trực tiếp trên sơ đồ CAD_02 và ghi sổ khuyết tật kết cấu
              </p>
            </div>
          </div>
        </div>

        {/* CAD_02 Inline Interactive Canvas */}
        <FloorCadPinningCanvas
          cadPhotoUrl={currentFloor.cadStructuralSketchPhotoUrl || ''}
          onCadPhotoChange={(url) => {
            updateFormData((prev) => {
              const updatedFloors = [...prev.floors];
              const cur = updatedFloors[activeFloorIndex] || updatedFloors[0];
              if (!cur) return prev;
              updatedFloors[activeFloorIndex] = { ...cur, cadStructuralSketchPhotoUrl: url };
              return { ...prev, floors: updatedFloors };
            });
          }}
          pins={currentFloor.cadElementPins || []}
          onChangePins={(pins) => {
            updateFormData((prev) => {
              const updatedFloors = [...prev.floors];
              const cur = updatedFloors[activeFloorIndex] || updatedFloors[0];
              if (!cur) return prev;
              updatedFloors[activeFloorIndex] = { ...cur, cadElementPins: pins };
              return { ...prev, floors: updatedFloors };
            });
          }}
          onAutoCreatePin={handleAutoCreateElementPin}
          onSelectPin={(pin) => {
            const idx = structuralElements.findIndex((e) => e.elementCode === pin.zoneCode);
            if (idx !== -1) navigateToElement(idx, false);
          }}
          mode="STRUCTURAL"
          floorName={currentFloor.floorName}
          cadTitle={`Tải lên hoặc chụp sơ đồ mặt bằng kết cấu CAD_02 (${currentFloor.floorName}):`}
        />

        {/* Stepper danh sách các Vùng Kết Cấu E */}
        <div className="space-y-3 pt-2">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <span className="text-xs font-bold text-amber-900 uppercase tracking-wider">
              Danh sách Cấu kiện Kết cấu ({structuralElements.length} Vùng E)
            </span>
          </div>

          {structuralElements.length > 0 && (
            <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
              {structuralElements.map((el, idx) => {
                const isSelected = activeElementIndex === idx;
                const hasDefects = el.defects && el.defects.length > 0;

                return (
                  <button
                    key={el.id || idx}
                    type="button"
                    onClick={() => navigateToElement(idx, false)}
                    className={`px-3 py-2 rounded-xl text-xs font-bold transition-all border flex items-center gap-1.5 whitespace-nowrap ${
                      isSelected
                        ? 'bg-amber-700 text-white border-amber-700 shadow-xs ring-2 ring-amber-500/20'
                        : 'bg-amber-50/60 text-slate-700 border-amber-200 hover:bg-amber-100/60'
                    }`}
                  >
                    <span className="font-mono">{el.elementCode}</span>
                    <span className="text-[11px] opacity-90">• {el.elementType}</span>
                    {hasDefects ? (
                      <span className="px-1.5 py-0.2 rounded bg-red-500 text-white text-[9px] font-mono font-bold">
                        {el.defects.length} D
                      </span>
                    ) : el.isCompleted ? (
                      <span className="text-emerald-500 text-[10px] font-bold">✓</span>
                    ) : null}
                  </button>
                );
              })}
            </div>
          )}

          {/* Form chi tiết Vùng Kết Cấu E đang chọn */}
          {structuralElements.length === 0 ? (
            <div className="p-6 text-center bg-amber-50/30 rounded-xl border border-dashed border-amber-300 space-y-2">
              <Hammer className="w-7 h-7 text-amber-500 mx-auto" />
              <p className="text-xs sm:text-sm font-semibold text-slate-800">
                Chưa có Cấu kiện kết cấu chịu lực (E) nào ở {currentFloor.floorName}
              </p>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                Bấm mở Sơ đồ CAD_02 để chạm chấm các Vùng E (Cột BTCT, Dầm, Bản sàn...) trên sơ đồ kết cấu.
              </p>
              <Button
                size="sm"
                className="bg-amber-600 hover:bg-amber-700 text-white"
                onClick={handleRequestAddNextElement}
              >
                Chấm Cấu kiện E trên sơ đồ CAD
              </Button>
            </div>
          ) : activeElement ? (
            <div id="step3-active-element-card" className="p-4 bg-amber-50/30 rounded-xl border border-amber-200 space-y-4">
              {/* Header card E */}
              <div className="flex items-center justify-between pb-2 border-b border-amber-200">
                <div className="flex items-center gap-2">
                  <span className="px-2.5 py-1 rounded-lg bg-amber-700 text-white font-mono text-xs font-extrabold">
                    {activeElement.elementCode}
                  </span>
                  <span className="text-sm font-bold text-slate-800">
                    Khảo Sát Kết Cấu: {activeElement.elementType} ({activeElement.roomName})
                  </span>
                  {activeElement.defects && activeElement.defects.length > 0 ? (
                    <Badge variant="danger">
                      {activeElement.defects.length} khuyết tật kết cấu D
                    </Badge>
                  ) : (
                    <Badge variant="success">Kết cấu ổn định • Nguyên vẹn</Badge>
                  )}
                </div>

                <button
                  onClick={() => handleDeleteElement(activeElementIndex)}
                  className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                  title="Xóa Vùng E"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>

              {/* Thuộc tính cấu kiện chịu lực */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <Select
                    id="select-el-roomName"
                    label="Vị Trí / Thuộc Không Gian"
                    value={activeElement.roomName}
                    onChange={(e) =>
                      handleUpdateElement(activeElementIndex, { roomName: e.target.value })
                    }
                    options={COMMON_ROOM_NAMES.map((r) => ({ value: r, label: r }))}
                  />
                  {activeElement.roomName === 'Khác' && (
                    <Input
                      id="input-el-customRoomName"
                      placeholder="Nhập vị trí..."
                      value={activeElement.customRoomName || ''}
                      onChange={(e) =>
                        handleUpdateElement(activeElementIndex, { customRoomName: e.target.value })
                      }
                      className="mt-1.5"
                    />
                  )}
                </div>

                <div>
                  <Select
                    id="select-el-elementType"
                    label="Loại Cấu Kiện Chịu Lực"
                    value={activeElement.elementType}
                    onChange={(e) =>
                      handleUpdateElement(activeElementIndex, { elementType: e.target.value })
                    }
                    options={STRUCTURAL_ELEMENT_TYPES.map((t) => ({ value: t, label: t }))}
                  />
                  {activeElement.elementType === 'Khác' && (
                    <Input
                      id="input-el-customElementType"
                      placeholder="Nhập loại cấu kiện..."
                      value={activeElement.customElementType || ''}
                      onChange={(e) =>
                        handleUpdateElement(activeElementIndex, {
                          customElementType: e.target.value,
                        })
                      }
                      className="mt-1.5"
                    />
                  )}
                </div>

                <div>
                  <Select
                    id="select-el-materialType"
                    label="Loại Vật Liệu Kết Cấu"
                    value={activeElement.materialType}
                    onChange={(e) =>
                      handleUpdateElement(activeElementIndex, { materialType: e.target.value })
                    }
                    options={STRUCTURAL_MATERIALS.map((m) => ({ value: m, label: m }))}
                  />
                  {activeElement.materialType === 'Khác' && (
                    <Input
                      id="input-el-customMaterialType"
                      placeholder="Nhập vật liệu kết cấu..."
                      value={activeElement.customMaterialType || ''}
                      onChange={(e) =>
                        handleUpdateElement(activeElementIndex, {
                          customMaterialType: e.target.value,
                        })
                      }
                      className="mt-1.5"
                    />
                  )}
                </div>
              </div>

              {/* Chụp nhiều ảnh tổng quan cấu kiện E */}
              <div className="p-3 bg-white rounded-xl border border-slate-200 space-y-2.5">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Camera className="w-4 h-4 text-amber-700" />
                    <span className="text-xs font-bold text-slate-800">
                      Ảnh Tổng Quan Cấu Kiện ({activeElement.elementCode} - {activeElement.elementType})
                    </span>
                  </div>
                  <span className="text-[11px] text-slate-500">
                    Đã chụp: {activeElement.overviewPhotos?.length || 0} ảnh
                  </span>
                </div>

                {/* Grid ảnh */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {activeElement.overviewPhotos?.map((photoUrl, pIdx) => (
                    <div
                      key={pIdx}
                      className="relative rounded-lg overflow-hidden border border-slate-300 aspect-video group"
                    >
                      <img src={photoUrl} alt={`El Overview ${pIdx}`} className="w-full h-full object-cover" />
                      <button
                        type="button"
                        onClick={() => {
                          const updated = activeElement.overviewPhotos.filter((_, i) => i !== pIdx);
                          handleUpdateElement(activeElementIndex, { overviewPhotos: updated });
                        }}
                        className="absolute top-1 right-1 p-1 bg-red-600 text-white rounded-md text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                        title="Xóa ảnh"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  ))}

                  <PhotoCaptureInput
                    label="Thêm ảnh cấu kiện"
                    value=""
                    onChange={(url) => {
                      if (url) {
                        const updated = [...(activeElement.overviewPhotos || []), url];
                        handleUpdateElement(activeElementIndex, {
                          overviewPhotos: updated,
                          ctxPhotoUrl: activeElement.ctxPhotoUrl || url,
                        });
                      }
                    }}
                    watermarkText={`${activeElement.elementCode} | ${activeElement.elementType}`}
                    height="85px"
                  />
                </div>
              </div>

              {/* Tùy chọn Có hư hỏng khuyết tật kết cấu */}
              <div className="p-3 bg-white rounded-xl border border-slate-200 space-y-3">
                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-2 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={
                        activeElement.hasDamage ||
                        (activeElement.defects && activeElement.defects.length > 0)
                      }
                      onChange={(e) => {
                        const checked = e.target.checked;
                        handleUpdateElement(activeElementIndex, {
                          hasDamage: checked,
                          ctxPhotoUrl:
                            activeElement.ctxPhotoUrl || activeElement.overviewPhotos?.[0] || '',
                        });
                      }}
                      className="rounded text-red-600 focus:ring-red-500"
                    />
                    <span className="text-xs font-bold text-red-700">
                      Cấu kiện {activeElement.elementCode} CÓ nứt kết cấu / trơ thép / võng cần ghi sổ D-xx
                    </span>
                  </label>
                </div>

                {/* Nếu CÓ hư hỏng kết cấu: Hiển thị Canvas ghim */}
                {(activeElement.hasDamage ||
                  (activeElement.defects && activeElement.defects.length > 0)) && (
                  <div className="p-3 bg-red-50/50 rounded-xl border border-red-200 space-y-2.5">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div>
                        <span className="text-xs font-bold text-slate-800 block">
                          Ảnh Bối Cảnh Cấu Kiện & Thả Ghim Khuyết Tật Kết Cấu
                        </span>
                        <span className="text-[11px] text-slate-600">
                          Đã ghim: <strong className="text-red-700 font-bold">{activeElement.defects?.length || 0} khuyết tật kết cấu D</strong>
                        </span>
                      </div>

                      <Button
                        size="sm"
                        variant="danger"
                        icon={<MapPin className="w-3.5 h-3.5" />}
                        onClick={() => setPinningElementId(activeElement.id)}
                      >
                        {activeElement.defects?.length > 0
                          ? `Xem & Chỉnh sửa ${activeElement.defects.length} ghim kết cấu ➔`
                          : 'Chấm điểm khuyết tật kết cấu D-xx'}
                      </Button>
                    </div>

                    {!activeElement.ctxPhotoUrl && (
                      <PhotoCaptureInput
                        label={`Chọn hoặc chụp Ảnh bối cảnh cấu kiện để thả ghim cho ${activeElement.elementCode}:`}
                        value={activeElement.ctxPhotoUrl || ''}
                        onChange={(url) =>
                          handleUpdateElement(activeElementIndex, { ctxPhotoUrl: url })
                        }
                        watermarkText={`STRUCTURAL | ${activeElement.elementCode}`}
                        height="120px"
                      />
                    )}
                  </div>
                )}
              </div>

              {/* Navigation giữa các E */}
              <div className="flex items-center justify-between pt-2 border-t border-amber-200">
                <Button
                  size="sm"
                  variant="outline"
                  disabled={activeElementIndex === 0}
                  onClick={handlePrevElement}
                >
                  ⬅️ Kết cấu {structuralElements[activeElementIndex - 1]?.elementCode || 'trước'}
                </Button>

                <div className="flex items-center gap-2">
                  {activeElementIndex < structuralElements.length - 1 ? (
                    <Button
                      size="sm"
                      className="bg-amber-600 hover:bg-amber-700 text-white"
                      onClick={handleNextElement}
                    >
                      Tiếp theo: {structuralElements[activeElementIndex + 1]?.elementCode} ➔
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      icon={<Plus className="w-3.5 h-3.5" />}
                      onClick={handleRequestAddNextElement}
                    >
                      Thêm Kết Cấu E tiếp theo
                    </Button>
                  )}
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </Card>

      {/* ========================================================================= */}
      {/* 3.3. VÕNG DẦM SÀN & ĐỀ XUẤT QUAN TRẬC (Tích hợp từ Bước 5)            */}
      {/* ========================================================================= */}
      <Card className="border-violet-200 bg-white space-y-4 shadow-xs">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-violet-100">
          <div className="flex items-center gap-2">
            <Ruler className="w-5 h-5 text-violet-600" />
            <div>
              <h3 className="text-sm font-bold text-slate-800">
                3.3. Võng Dầm Sàn & ĐỀ Xuất Quan Trắc Chuyên Sâu
              </h3>
              <p className="text-xs text-slate-500">
                Khảo sát độ võng dầm/sàn bên trong nhà và chốt yêu cầu lắp mốc quan trắc lún nhiêng
              </p>
            </div>
          </div>
          <span className="text-xs font-black px-3 py-1.5 rounded-xl border bg-violet-50 border-violet-200 text-violet-900 flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-violet-600" />
            <span>Chỉ số E3 = {Math.min(4, Math.max(
              formData.settlementTilt?.diffSettlement?.level ?? 0,
              formData.settlementTilt?.buildingTilt?.level ?? 0,
              formData.settlementTilt?.beamSagging?.level ?? 0
            ))}/4</span>
          </span>
        </div>

        <div className="space-y-5">
          <LevelSelectorWithGuide
            title="Võng Dầm / Bản Sàn Kết Cấu Bên Trong"
            subtitle="Hiện tượng uốn võng phần tử chịu uốn ngang (dầm chính, dầm phụ, bản sàn, ô văng)"
            selectedLevel={formData.settlementTilt?.beamSagging?.level ?? 0}
            onChangeLevel={(level) =>
              updateFormData({
                settlementTilt: {
                  ...formData.settlementTilt,
                  beamSagging: { ...formData.settlementTilt?.beamSagging, level },
                },
              })
            }
            options={SAG_LEVEL_OPTIONS}
          >
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <Input
                label="Vị trí cấu kiện bị võng"
                placeholder="VD: Dầm D2 trục 2-3 Tầng 2, Bản sàn ban công..."
                value={formData.settlementTilt?.beamSagging?.position || ''}
                onChange={(e) =>
                  updateFormData({
                    settlementTilt: {
                      ...formData.settlementTilt,
                      beamSagging: { ...formData.settlementTilt?.beamSagging, position: e.target.value },
                    },
                  })
                }
              />
              <Input
                label="Độ võng ước tính (mm)"
                type="number"
                step="0.5"
                placeholder="VD: 15"
                value={formData.settlementTilt?.beamSagging?.sagMm ?? ''}
                onChange={(e) =>
                  updateFormData({
                    settlementTilt: {
                      ...formData.settlementTilt,
                      beamSagging: {
                        ...formData.settlementTilt?.beamSagging,
                        sagMm: e.target.value ? Number(e.target.value) : '',
                      },
                    },
                  })
                }
                hint="Đo từ đáy dầm tới dây căng"
              />
              <Input
                label="Mô tả hiện tượng võng"
                placeholder="VD: Nứt chữ V giữa nhịp, rung nhẹ khi di chuyển..."
                value={formData.settlementTilt?.beamSagging?.description || ''}
                onChange={(e) =>
                  updateFormData({
                    settlementTilt: {
                      ...formData.settlementTilt,
                      beamSagging: { ...formData.settlementTilt?.beamSagging, description: e.target.value },
                    },
                  })
                }
              />
            </div>
          </LevelSelectorWithGuide>
        </div>

        <div className="mt-4 pt-4 border-t border-slate-100 space-y-3">
          <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/50 space-y-3">
            <Select
              label="Cần Đo / Quan Trắc Bổ Sung Chuyên Sâu:"
              value={formData.settlementTilt?.needAdditionalMonitoring?.required ? 'YES' : 'NO'}
              onChange={(e) =>
                updateFormData({
                  settlementTilt: {
                    ...formData.settlementTilt,
                    needAdditionalMonitoring: {
                      ...formData.settlementTilt?.needAdditionalMonitoring,
                      required: e.target.value === 'YES',
                    },
                  },
                })
              }
              options={[
                { value: 'NO', label: 'Không - Hiện trạng bình thường' },
                { value: 'YES', label: 'Có - Cần lắp mốc theo dõi / đo đạc chuyên sâu' },
              ]}
            />
            {formData.settlementTilt?.needAdditionalMonitoring?.required && (
              <div className="pt-2 animate-in fade-in">
                <Input
                  label="Nhận xét / Đề xuất giải pháp quan trắc cụ thể:"
                  placeholder="VD: Cần lắp mốc quan trắc lún nghiêng tự động chu kỳ 2 tuần/lần..."
                  value={formData.settlementTilt?.needAdditionalMonitoring?.notes || ''}
                  onChange={(e) =>
                    updateFormData({
                      settlementTilt: {
                        ...formData.settlementTilt,
                        needAdditionalMonitoring: {
                          ...formData.settlementTilt?.needAdditionalMonitoring,
                          notes: e.target.value,
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

      {/* Floor Footer Navigation */}
      <div className="p-3.5 rounded-xl border border-slate-200 bg-white shadow-xs flex items-center justify-between text-xs">
        <Button
          size="sm"
          variant="outline"
          disabled={activeFloorIndex === 0}
          onClick={() => {
            setActiveFloorIndex((prev) => Math.max(0, prev - 1));
            setActiveZoneIndex(0);
            setActiveElementIndex(0);
          }}
        >
          ⬅️ Tầng trước
        </Button>

        <span className="font-bold text-slate-700">
          Đang khảo sát: {currentFloor.floorName} ({activeFloorIndex + 1}/{formData.floors.length})
        </span>

        <div className="flex items-center gap-2">
          {activeFloorIndex < formData.floors.length - 1 ? (
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setActiveFloorIndex((prev) => prev + 1);
                setActiveZoneIndex(0);
                setActiveElementIndex(0);
              }}
            >
              Tầng tiếp theo ➔
            </Button>
          ) : (
            <Button size="sm" icon={<Plus className="w-3.5 h-3.5" />} onClick={handleAddFloor}>
              Thêm Tầng Mới
            </Button>
          )}
        </div>
      </div>



      {/* ========================================================================= */}
      {/* MODAL GHIM VẾT NỨT VÙNG Z (LIGHT THEME)                                   */}
      {/* ========================================================================= */}
      {pinningZoneObj && pinningZoneObj.ctxPhotoUrl && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 animate-in fade-in">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-slate-200 bg-slate-50">
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded bg-emerald-700 text-white text-xs font-mono font-bold">
                  {pinningZoneObj.zoneCode}
                </span>
                <h3 className="font-bold text-sm sm:text-base text-slate-800">
                  Ghi Sổ Khuyết Tật Kiến Trúc D-xx ({pinningZoneObj.roomName})
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setPinningZoneId(null)}
                className="p-1 rounded-lg hover:bg-slate-200 text-slate-500 hover:text-slate-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4">
              <DefectPinningCanvas
                ctxPhotoUrl={pinningZoneObj.ctxPhotoUrl}
                defects={pinningZoneObj.defects || []}
                onChange={(defects: DefectItem[]) => {
                  const zoneIndex = zones.findIndex((z) => z.id === pinningZoneObj.id);
                  if (zoneIndex !== -1) {
                    handleUpdateZone(zoneIndex, { defects });
                  }
                }}
              />
            </div>

            <div className="flex items-center justify-between px-4 py-3 border-t border-slate-200 bg-slate-50">
              <span className="text-xs text-slate-500">
                Ghim màu xanh: Đã điền xong • Ghim màu cam: Đang chờ cập nhật
              </span>
              <Button size="sm" onClick={() => setPinningZoneId(null)}>
                Xong & Đóng lại
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* MODAL GHIM KHUYẾT TẬT KẾT CẤU VÙNG E (LIGHT THEME)                        */}
      {/* ========================================================================= */}
      {pinningElementObj && pinningElementObj.ctxPhotoUrl && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 animate-in fade-in">
          <div className="bg-white rounded-2xl shadow-2xl border border-amber-200 w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b border-amber-200 bg-amber-50/50">
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded bg-amber-700 text-white text-xs font-mono font-bold">
                  {pinningElementObj.elementCode}
                </span>
                <h3 className="font-bold text-sm sm:text-base text-slate-800">
                  Ghi Sổ Khuyết Tật Kết Cấu Chịu Lực D-xx ({pinningElementObj.elementType})
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setPinningElementId(null)}
                className="p-1 rounded-lg hover:bg-amber-100 text-slate-500 hover:text-slate-800 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4">
              <DefectPinningCanvas
                ctxPhotoUrl={pinningElementObj.ctxPhotoUrl}
                defects={pinningElementObj.defects || []}
                onChange={(defects: DefectItem[]) => {
                  const elIndex = structuralElements.findIndex((e) => e.id === pinningElementObj.id);
                  if (elIndex !== -1) {
                    handleUpdateElement(elIndex, { defects });
                  }
                }}
              />
            </div>

            <div className="flex items-center justify-between px-4 py-3 border-t border-amber-200 bg-amber-50/50">
              <span className="text-xs text-slate-500">
                Ghim màu xanh: Đã điền xong • Ghim màu cam: Đang chờ cập nhật
              </span>
              <Button
                size="sm"
                className="bg-amber-600 hover:bg-amber-700 text-white"
                onClick={() => setPinningElementId(null)}
              >
                Xong & Đóng lại
              </Button>
            </div>
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
