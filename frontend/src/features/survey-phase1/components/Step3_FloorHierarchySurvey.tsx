import React, { useState, useEffect } from 'react';
import { usePhase1SurveyStore } from '../store/usePhase1SurveyStore';
import { DefectItem } from '../../../components/canvas/DefectPinningCanvas';
import { CadZonePin } from '../../../components/canvas/FloorCadPinningCanvas';
import { FloorSurveyData, DamageZoneData, StructuralElementData } from '../types/phase1.types';

import { FloorTabsNavigation } from './step3/FloorTabsNavigation';
import { DamageZonesSection } from './step3/DamageZonesSection';
import { StructuralElementsSection } from './step3/StructuralElementsSection';
import { SaggingMonitoringSection } from './step3/SaggingMonitoringSection';
import { DefectPinningModal } from './step3/DefectPinningModal';
import { Step3FloorFooterNav } from './step3/Step3FloorFooterNav';
import { Step3BottomNav } from './step3/Step3BottomNav';

export const Step3_FloorHierarchySurvey: React.FC = () => {
  const { formData, updateFormData, nextStep, prevStep } = usePhase1SurveyStore();
  const [activeFloorIndex, setActiveFloorIndex] = useState<number>(0);
  const [activeZoneIndex, setActiveZoneIndex] = useState<number>(0);
  const [activeElementIndex, setActiveElementIndex] = useState<number>(0);

  // Modals for Defect Pinning
  const [pinningZoneId, setPinningZoneId] = useState<string | null>(null);
  const [pinningElementId, setPinningElementId] = useState<string | null>(null);

  const currentFloor: FloorSurveyData = formData.floors[activeFloorIndex] || formData.floors[0] || {
    id: 'floor_default',
    floorName: 'Tầng 1 (Trệt)',
    overviewPhotos: [],
    cadSketchPhotoUrl: '',
    cadStructuralSketchPhotoUrl: '',
    cadZonePins: [],
    cadElementPins: [],
    zones: [],
    structuralElements: [],
  };

  const zones: DamageZoneData[] = currentFloor.zones || [];
  const structuralElements: StructuralElementData[] = currentFloor.structuralElements || [];

  // Lắng nghe sự kiện chuyển tầng từ modal cảnh báo thiếu thông tin
  useEffect(() => {
    const handleFocusFloor = (e: any) => {
      const fIdx = e.detail?.floorIndex;
      if (typeof fIdx === 'number' && fIdx >= 0 && fIdx < formData.floors.length) {
        setActiveFloorIndex(fIdx);
      }
    };
    window.addEventListener('ksqh-focus-floor', handleFocusFloor);
    return () => window.removeEventListener('ksqh-focus-floor', handleFocusFloor);
  }, [formData.floors.length]);

  // Thêm Tầng Mới
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
    updateFormData({
      floors: [...formData.floors, newFloor],
      settlementTilt: {
        ...formData.settlementTilt,
        needAdditionalMonitoring: { required: false, notes: '' },
      },
    });
    setActiveFloorIndex(formData.floors.length);
    setActiveZoneIndex(0);
    setActiveElementIndex(0);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const scrollToTarget = (elementId: string) => {
    const el = document.getElementById(elementId);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  // Kiểm tra điều kiện bắt buộc của Vùng Z trước khi chuyển tiếp
  const validateZoneCanAdvance = (zone: DamageZoneData | undefined): { ok: boolean; message?: string } => {
    if (!zone) return { ok: true };
    if (zone.hasDamage) {
      if (!zone.ctxPhotoUrl) {
        return {
          ok: false,
          message: `Vùng ${zone.zoneCode} đã chọn "Có vết nứt / hư hỏng" nhưng chưa chụp hoặc tải ảnh bối cảnh (Context Photo). Vui lòng bổ sung ảnh trước khi chuyển sang Vùng Z khác!`,
        };
      }
      if (!zone.defects || zone.defects.length === 0) {
        return {
          ok: false,
          message: `Vùng ${zone.zoneCode} đã chọn "Có vết nứt / hư hỏng" nhưng chưa chấm ghim và chấm điểm khuyết tật (D). Vui lòng ghim ít nhất 1 khuyết tật trước khi chuyển tiếp!`,
        };
      }
    }
    return { ok: true };
  };

  // Kiểm tra điều kiện bắt buộc của Cấu kiện E trước khi chuyển tiếp
  const validateElementCanAdvance = (element: StructuralElementData | undefined): { ok: boolean; message?: string } => {
    if (!element) return { ok: true };
    if (element.hasDamage) {
      if (!element.ctxPhotoUrl) {
        return {
          ok: false,
          message: `Cấu kiện ${element.elementCode} đã chọn "Có khuyết tật / biến dạng" nhưng chưa có ảnh bối cảnh. Vui lòng bổ sung ảnh trước khi chuyển tiếp!`,
        };
      }
      if (!element.defects || element.defects.length === 0) {
        return {
          ok: false,
          message: `Cấu kiện ${element.elementCode} đã chọn "Có khuyết tật" nhưng chưa chấm ghim và chấm điểm khuyết tật. Vui lòng ghim ít nhất 1 khuyết tật trước khi chuyển tiếp!`,
        };
      }
    }
    return { ok: true };
  };

  // Điều hướng chuyển Vùng Z
  const navigateToZone = (idx: number, markCurrentCompleted = false) => {
    if (idx < 0 || idx >= zones.length) return;
    if (idx !== activeZoneIndex) {
      const currentZone = zones[activeZoneIndex];
      const check = validateZoneCanAdvance(currentZone);
      if (!check.ok) {
        alert(check.message);
        return;
      }
    }
    if (markCurrentCompleted && activeZoneIndex >= 0 && activeZoneIndex < zones.length) {
      handleUpdateZone(activeZoneIndex, { isCompleted: true });
    }
    setActiveZoneIndex(idx);
    setTimeout(() => {
      scrollToTarget('step3-active-zone-card');
    }, 60);
  };

  const handleNextZone = () => navigateToZone(activeZoneIndex + 1, true);
  const handlePrevZone = () => navigateToZone(activeZoneIndex - 1, false);

  const handleRequestAddNextZone = () => {
    const currentZone = zones[activeZoneIndex];
    const check = validateZoneCanAdvance(currentZone);
    if (!check.ok) {
      alert(check.message);
      return;
    }
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

  // Điều hướng chuyển Cấu kiện E
  const navigateToElement = (idx: number, markCurrentCompleted = false) => {
    if (idx < 0 || idx >= structuralElements.length) return;
    if (idx !== activeElementIndex) {
      const currentEl = structuralElements[activeElementIndex];
      const check = validateElementCanAdvance(currentEl);
      if (!check.ok) {
        alert(check.message);
        return;
      }
    }
    if (markCurrentCompleted && activeElementIndex >= 0 && activeElementIndex < structuralElements.length) {
      handleUpdateElement(activeElementIndex, { isCompleted: true });
    }
    setActiveElementIndex(idx);
    setTimeout(() => {
      scrollToTarget('step3-active-element-card');
    }, 60);
  };

  const handleNextElement = () => navigateToElement(activeElementIndex + 1, true);
  const handlePrevElement = () => navigateToElement(activeElementIndex - 1, false);

  const handleRequestAddNextElement = () => {
    const currentEl = structuralElements[activeElementIndex];
    const check = validateElementCanAdvance(currentEl);
    if (!check.ok) {
      alert(check.message);
      return;
    }
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

  // Tự động sinh Vùng Z khi chấm ghim trên CAD_01
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
        roomName: prevZone?.roomName || '',
        customRoomName: prevZone?.customRoomName || '',
        componentType: prevZone?.componentType || '',
        customComponentType: prevZone?.customComponentType || '',
        wallMaterial: prevZone?.wallMaterial || '',
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
    if (zones.length === 0) {
      setActiveZoneIndex(0);
    }
  };

  // Tự động sinh Vùng E khi chấm ghim trên CAD_02
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
    if (structuralElements.length === 0) {
      setActiveElementIndex(0);
    }
  };

  // Cập nhật Vùng Z kèm tính toán Burland Grade
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

  // Xóa Vùng Z
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

  // Cập nhật Vùng E
  const handleUpdateElement = (eIdx: number, updater: Partial<StructuralElementData>) => {
    const updatedElements = [...structuralElements];
    if (!updatedElements[eIdx]) return;
    updatedElements[eIdx] = { ...updatedElements[eIdx], ...updater };
    const updatedFloors = [...formData.floors];
    updatedFloors[activeFloorIndex] = { ...currentFloor, structuralElements: updatedElements };
    updateFormData({ floors: updatedFloors });
  };

  // Xóa Vùng E
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

  // Modal active objects
  const pinningZoneObj = zones.find((z) => z.id === pinningZoneId);
  const pinningElementObj = structuralElements.find((e) => e.id === pinningElementId);

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-12">
      {/* Header & Tabs Tầng */}
      <FloorTabsNavigation
        floors={formData.floors}
        activeFloorIndex={activeFloorIndex}
        onSelectFloor={(idx) => {
          setActiveFloorIndex(idx);
          setActiveZoneIndex(0);
          setActiveElementIndex(0);
        }}
        onAddFloor={handleAddFloor}
      />

      {/* 3.1. Sơ đồ CAD_01 & Vùng Kiến Trúc Z */}
      <DamageZonesSection
        currentFloor={currentFloor}
        activeZoneIndex={activeZoneIndex}
        onCadPhotoChange={(url) => {
          updateFormData((prev) => {
            const updatedFloors = [...prev.floors];
            const cur = updatedFloors[activeFloorIndex] || updatedFloors[0];
            if (!cur) return prev;
            updatedFloors[activeFloorIndex] = { ...cur, cadSketchPhotoUrl: url };
            return { ...prev, floors: updatedFloors };
          });
        }}
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
        onSelectZone={(idx) => navigateToZone(idx, false)}
        onUpdateZone={handleUpdateZone}
        onDeleteZone={handleDeleteZone}
        onNextZone={handleNextZone}
        onPrevZone={handlePrevZone}
        onRequestAddNextZone={handleRequestAddNextZone}
        onOpenPinningModal={(zoneId) => setPinningZoneId(zoneId)}
      />

      {/* 3.2. Sơ đồ CAD_02 & Vùng Kết Cấu E */}
      <StructuralElementsSection
        currentFloor={currentFloor}
        activeElementIndex={activeElementIndex}
        onCadPhotoChange={(url) => {
          updateFormData((prev) => {
            const updatedFloors = [...prev.floors];
            const cur = updatedFloors[activeFloorIndex] || updatedFloors[0];
            if (!cur) return prev;
            updatedFloors[activeFloorIndex] = { ...cur, cadStructuralSketchPhotoUrl: url };
            return { ...prev, floors: updatedFloors };
          });
        }}
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
        onSelectElement={(idx) => navigateToElement(idx, false)}
        onUpdateElement={handleUpdateElement}
        onDeleteElement={handleDeleteElement}
        onNextElement={handleNextElement}
        onPrevElement={handlePrevElement}
        onRequestAddNextElement={handleRequestAddNextElement}
        onOpenPinningModal={(elementId) => setPinningElementId(elementId)}
      />

      {/* 3.3. Võng dầm sàn & Đề xuất quan trắc */}
      <SaggingMonitoringSection
        settlementTilt={formData.settlementTilt}
        projectParcelCode={formData.projectParcelCode}
        onUpdateSettlementTilt={(updater) =>
          updateFormData({
            settlementTilt: {
              ...formData.settlementTilt,
              ...updater,
            },
          })
        }
      />

      {/* Floor Footer Navigation */}
      <Step3FloorFooterNav
        activeFloorIndex={activeFloorIndex}
        totalFloors={formData.floors.length}
        floorName={currentFloor.floorName}
        onPrevFloor={() => {
          setActiveFloorIndex((prev) => Math.max(0, prev - 1));
          setActiveZoneIndex(0);
          setActiveElementIndex(0);
        }}
        onNextFloor={() => {
          setActiveFloorIndex((prev) => prev + 1);
          setActiveZoneIndex(0);
          setActiveElementIndex(0);
        }}
        onAddFloor={handleAddFloor}
      />

      {/* Defect Pinning Modal - Vùng Z */}
      {pinningZoneObj && (
        <DefectPinningModal
          isOpen={Boolean(pinningZoneId)}
          mode="ARCHITECTURAL"
          code={pinningZoneObj.zoneCode}
          name={pinningZoneObj.roomName}
          ctxPhotoUrl={pinningZoneObj.ctxPhotoUrl}
          defects={pinningZoneObj.defects || []}
          onChange={(defects: DefectItem[]) => {
            const zoneIndex = zones.findIndex((z) => z.id === pinningZoneObj.id);
            if (zoneIndex !== -1) {
              handleUpdateZone(zoneIndex, { defects });
            }
          }}
          onClose={() => setPinningZoneId(null)}
        />
      )}

      {/* Defect Pinning Modal - Cấu kiện E */}
      {pinningElementObj && (
        <DefectPinningModal
          isOpen={Boolean(pinningElementId)}
          mode="STRUCTURAL"
          code={pinningElementObj.elementCode}
          name={pinningElementObj.elementType}
          ctxPhotoUrl={pinningElementObj.ctxPhotoUrl}
          defects={pinningElementObj.defects || []}
          onChange={(defects: DefectItem[]) => {
            const elIndex = structuralElements.findIndex((e) => e.id === pinningElementObj.id);
            if (elIndex !== -1) {
              handleUpdateElement(elIndex, { defects });
            }
          }}
          onClose={() => setPinningElementId(null)}
        />
      )}

      {/* Navigation */}
      <Step3BottomNav onPrev={prevStep} onNext={nextStep} />
    </div>
  );
};
