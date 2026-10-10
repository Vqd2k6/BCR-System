import React, { useState, useEffect, useCallback } from 'react';
import { usePhase1SurveyStore } from '../../survey-phase1/store/usePhase1SurveyStore';
import type { DefectItem } from '../../../components/canvas/DefectPinningCanvas';
import type { CadZonePin } from '../../../components/canvas/FloorCadPinningCanvas';
import type { FloorSurveyData, DamageZoneData, StructuralElementData } from '../../survey-phase1/types/phase1.types';
import { api } from '../../../services/api';
import { CondoMasterAddAreaModal } from './CondoMasterAddAreaModal';

// Subcomponents from Step 3
import { Step3FloorOverviewSection } from '../../survey-phase1/components/step3/Step3FloorOverviewSection';
import { DamageZonesSection } from '../../survey-phase1/components/step3/DamageZonesSection';
import { StructuralElementsSection } from '../../survey-phase1/components/step3/StructuralElementsSection';
import { SaggingMonitoringSection } from '../../survey-phase1/components/step3/SaggingMonitoringSection';
import { DefectPinningModal } from '../../survey-phase1/components/step3/DefectPinningModal';

import {
  Building2,
  Plus,
  RotateCcw,
  CheckCircle2,
  AlertTriangle,
  Clock,
  ChevronRight,
  Layers,
  ArrowLeft,
  ArrowRight,
  Trash2,
  Save,
  Check,
  MapPin,
  Camera,
  FolderOpen,
} from 'lucide-react';

interface CadFloorPlan {
  id: string;
  floor_number: number;
  floor_name: string;
  cad_photo_url: string;
  scope?: string;
  area_type?: string;
}

export const Step3_CondoMasterCommonAreasSurvey: React.FC = () => {
  const { formData, updateFormData, nextStep, prevStep, syncDraftToServer } = usePhase1SurveyStore();
  const [activeFloorIndex, setActiveFloorIndex] = useState<number>(0);
  const [activeZoneIndex, setActiveZoneIndex] = useState<number>(0);
  const [activeElementIndex, setActiveElementIndex] = useState<number>(0);

  // View mode: 'HUB' (danh sách các phân khu) hoặc 'FOCUSED' (khảo sát chi tiết phân khu được chọn)
  const [viewMode, setViewMode] = useState<'HUB' | 'FOCUSED'>('HUB');

  // Modal thêm khu vực phát sinh
  const [isAddAreaModalOpen, setIsAddAreaModalOpen] = useState(false);

  // Modals for Defect Pinning
  const [pinningZoneId, setPinningZoneId] = useState<string | null>(null);
  const [pinningElementId, setPinningElementId] = useState<string | null>(null);

  // Trạng thái đồng bộ CAD
  const [isSyncingCad, setIsSyncingCad] = useState(false);
  const [syncToastMsg, setSyncToastMsg] = useState('');
  const [isSavingDraft, setIsSavingDraft] = useState(false);

  const parcelId = formData.parcelId;

  // 1. Tự động đồng bộ các tầng MASTER từ Quản Lý CAD vào formData.floors
  const syncMasterFloorsFromCad = useCallback(
    async (forceReplace = false) => {
      if (!parcelId) return;
      try {
        setIsSyncingCad(true);
        const res = await api.get(`/parcels/${parcelId}/floor-plans`);
        const plans: CadFloorPlan[] = res.data?.data?.plans || [];

        // Lọc các tầng phục vụ toà mẹ (scope === 'MASTER' hoặc 'BOTH' hoặc suy luận ngầm)
        const masterPlans = plans.filter((p) => {
          if (p.scope === 'MASTER' || p.scope === 'BOTH') return true;
          const lower = (p.floor_name || '').toLowerCase();
          if (p.floor_number < 0 || lower.includes('hầm') || lower.includes('mái') || lower.includes('thượng') || lower.includes('kỹ thuật') || lower.includes('sảnh')) {
            return true;
          }
          return false;
        });

        if (masterPlans.length === 0) {
          console.log('[CondoMaster:Step3] Không tìm thấy floor plan MASTER riêng từ CAD. Giữ nguyên danh sách hiện tại.');
          return;
        }

        updateFormData((prev) => {
          const currentFloors = prev.floors || [];
          // Kiểm tra nếu danh sách hiện tại chỉ có 1 tầng default trống (chưa có ảnh, chưa có vùng/cấu kiện)
          const isOnlyEmptyDefault =
            currentFloors.length <= 1 &&
            (currentFloors[0]?.overviewPhotos?.length || 0) === 0 &&
            (currentFloors[0]?.zones?.length || 0) === 0 &&
            (currentFloors[0]?.structuralElements?.length || 0) === 0;

          if (isOnlyEmptyDefault || forceReplace) {
            // Thay thế hoàn toàn bằng các tầng Master từ CAD
            const newFloors: FloorSurveyData[] = masterPlans.map((p) => ({
              id: `master_cad_floor_${p.id || p.floor_number}`,
              floorName: p.floor_name || (p.floor_number < 0 ? `Hầm B${Math.abs(p.floor_number)}` : `Tầng ${p.floor_number}`),
              overviewPhotos: [],
              cadSketchPhotoUrl: p.cad_photo_url || '',
              cadStructuralSketchPhotoUrl: p.cad_photo_url || '',
              cadZonePins: [],
              cadElementPins: [],
              zones: [],
              structuralElements: [],
              hasStructuralElements: true,
            }));
            return { ...prev, floors: newFloors };
          } else {
            // Hợp nhất: cập nhật CAD sketch cho các tầng đã có hoặc thêm tầng mới từ CAD nếu chưa có
            const updated = [...currentFloors];
            masterPlans.forEach((p) => {
              const existingIdx = updated.findIndex(
                (f) =>
                  f.floorName.toLowerCase() === (p.floor_name || '').toLowerCase() ||
                  f.id === `master_cad_floor_${p.id || p.floor_number}`
              );
              if (existingIdx >= 0) {
                // Đảm bảo có URL CAD mới nhất
                const cur = updated[existingIdx];
                updated[existingIdx] = {
                  ...cur,
                  cadSketchPhotoUrl: cur.cadSketchPhotoUrl || p.cad_photo_url || '',
                  cadStructuralSketchPhotoUrl: cur.cadStructuralSketchPhotoUrl || p.cad_photo_url || '',
                };
              } else {
                // Thêm tầng mới từ CAD
                updated.push({
                  id: `master_cad_floor_${p.id || p.floor_number}`,
                  floorName: p.floor_name || (p.floor_number < 0 ? `Hầm B${Math.abs(p.floor_number)}` : `Tầng ${p.floor_number}`),
                  overviewPhotos: [],
                  cadSketchPhotoUrl: p.cad_photo_url || '',
                  cadStructuralSketchPhotoUrl: p.cad_photo_url || '',
                  cadZonePins: [],
                  cadElementPins: [],
                  zones: [],
                  structuralElements: [],
                  hasStructuralElements: true,
                });
              }
            });
            return { ...prev, floors: updated };
          }
        });

        setSyncToastMsg(`Đã đồng bộ ${masterPlans.length} mặt bằng khu vực dùng chung từ Quản Lý CAD!`);
        setTimeout(() => setSyncToastMsg(''), 4000);
      } catch (err) {
        console.warn('[CondoMaster:Step3] Lỗi nạp CAD plans:', err);
      } finally {
        setIsSyncingCad(false);
      }
    },
    [parcelId, updateFormData]
  );

  // Kích hoạt đồng bộ CAD khi mount nếu chưa từng đồng bộ
  useEffect(() => {
    if (parcelId) {
      syncMasterFloorsFromCad(false);
    }
  }, [parcelId]);

  const currentFloor: FloorSurveyData = formData.floors[activeFloorIndex] || formData.floors[0] || {
    id: 'floor_default',
    floorName: 'Tầng Hầm B1',
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

  // Thêm khu vực phát sinh
  const handleAddArea = (newFloor: FloorSurveyData) => {
    updateFormData({
      floors: [...formData.floors, newFloor],
    });
    // Chuyển ngay đến khu vực mới thêm để kỹ sư khảo sát
    setActiveFloorIndex(formData.floors.length);
    setActiveZoneIndex(0);
    setActiveElementIndex(0);
    setViewMode('FOCUSED');
    setSyncToastMsg(`Đã thêm khu vực "${newFloor.floorName}" vào danh sách khảo sát!`);
    setTimeout(() => setSyncToastMsg(''), 4000);
  };

  // Xóa khu vực (nếu là khu vực phát sinh hoặc thừa)
  const handleDeleteArea = (floorIndex: number, areaName: string) => {
    if (formData.floors.length <= 1) {
      alert('Tòa nhà phải có ít nhất 1 khu vực dùng chung để khảo sát.');
      return;
    }
    if (!confirm(`Bạn có chắc muốn xóa khu vực "${areaName}" khỏi danh sách khảo sát toà mẹ?`)) {
      return;
    }
    updateFormData((prev) => {
      const updated = prev.floors.filter((_, idx) => idx !== floorIndex);
      return { ...prev, floors: updated };
    });
    if (activeFloorIndex >= floorIndex) {
      setActiveFloorIndex((prev) => Math.max(0, prev - 1));
    }
  };

  // Lưu nháp phân khu hiện tại lên máy chủ
  const handleSaveSectionDraft = async () => {
    try {
      setIsSavingDraft(true);
      await syncDraftToServer();
      setSyncToastMsg(`Đã lưu nháp an toàn tiến độ "${currentFloor.floorName}" lên hệ thống!`);
      setTimeout(() => setSyncToastMsg(''), 4000);
    } catch (e) {
      console.warn('[CondoMaster:Step3] Lỗi lưu nháp phân khu:', e);
      alert('Không thể kết nối đến máy chủ để lưu nháp. Dữ liệu vẫn được lưu an toàn trên máy của bạn.');
    } finally {
      setIsSavingDraft(false);
    }
  };

  // Handlers for Zone & Element Navigation & Pinning
  const validateZoneCanAdvance = (zone: DamageZoneData | undefined): { ok: boolean; message?: string } => {
    if (!zone) return { ok: true };
    if (zone.hasDamage) {
      if (!zone.ctxPhotoUrl) {
        return {
          ok: false,
          message: `Vùng ${zone.zoneCode} đã chọn "Có vết nứt / hư hỏng" nhưng chưa chụp hoặc tải ảnh bối cảnh. Vui lòng bổ sung ảnh trước khi chuyển tiếp!`,
        };
      }
      if (!zone.defects || zone.defects.length === 0) {
        return {
          ok: false,
          message: `Vùng ${zone.zoneCode} đã chọn "Có vết nứt" nhưng chưa chấm ghim và chấm điểm khuyết tật (D). Vui lòng ghim ít nhất 1 khuyết tật trước khi chuyển tiếp!`,
        };
      }
    }
    return { ok: true };
  };

  const validateElementCanAdvance = (element: StructuralElementData | undefined): { ok: boolean; message?: string } => {
    if (!element) return { ok: true };
    if (element.hasDamage) {
      if (!element.ctxPhotoUrl) {
        return {
          ok: false,
          message: `Cấu kiện ${element.elementCode} đã chọn "Có khuyết tật" nhưng chưa có ảnh bối cảnh. Vui lòng bổ sung ảnh trước khi chuyển tiếp!`,
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
  };

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
  };

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
        roomName: prevZone?.roomName || 'Khu vực chung',
        customRoomName: prevZone?.customRoomName || '',
        componentType: prevZone?.componentType || 'Tường bao / Vách ngăn',
        customComponentType: prevZone?.customComponentType || '',
        wallMaterial: prevZone?.wallMaterial || 'Bê tông cốt thép / Vữa trát',
        customWallMaterial: prevZone?.customWallMaterial || '',
        overviewPhotos: [],
        ctxPhotoUrl: '',
        hasDamage: false,
        notes: '',
        defects: [],
        isCompleted: false,
        customizedFields: [],
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
        roomName: prevEl?.roomName || 'Khu vực chịu lực chung',
        customRoomName: prevEl?.customRoomName || '',
        elementType: prevEl?.elementType || 'Cột BTCT',
        customElementType: prevEl?.customElementType || '',
        materialType: prevEl?.materialType || 'Bê tông cốt thép (BTCT) đổ toàn khối',
        customMaterialType: prevEl?.customMaterialType || '',
        overviewPhotos: [],
        ctxPhotoUrl: '',
        hasDamage: false,
        notes: '',
        defects: [],
        isCompleted: false,
        customizedFields: [],
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

  const handleDeleteZone = (zIdx: number) => {
    if (!confirm('Bạn có chắc muốn xóa Vùng khảo sát này?')) return;
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

  const handleUpdateElement = (eIdx: number, updater: Partial<StructuralElementData>) => {
    const updatedElements = [...structuralElements];
    if (!updatedElements[eIdx]) return;
    updatedElements[eIdx] = { ...updatedElements[eIdx], ...updater };

    const updatedFloors = [...formData.floors];
    updatedFloors[activeFloorIndex] = { ...currentFloor, structuralElements: updatedElements };
    updateFormData({ floors: updatedFloors });
  };

  const handleDeleteElement = (eIdx: number) => {
    if (!confirm('Bạn có chắc muốn xóa Cấu kiện này?')) return;
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

  const handleDeleteZonePin = (pin: CadZonePin) => {
    updateFormData((prev) => {
      const current = prev.floors[activeFloorIndex] || prev.floors[0];
      if (!current) return prev;
      const updatedZones = (current.zones || []).filter((z) => z.zoneCode !== pin.zoneCode);
      const updatedPins = (current.cadZonePins || []).filter((p) => p.id !== pin.id && p.zoneCode !== pin.zoneCode);
      const updatedFloors = [...prev.floors];
      updatedFloors[activeFloorIndex] = { ...current, zones: updatedZones, cadZonePins: updatedPins };
      return { ...prev, floors: updatedFloors };
    });
    setActiveZoneIndex((prev) => Math.max(0, prev - 1));
  };

  const handleRenameZonePin = (oldCode: string, newCode: string, updatedPin: CadZonePin) => {
    updateFormData((prev) => {
      const current = prev.floors[activeFloorIndex] || prev.floors[0];
      if (!current) return prev;
      const updatedZones = (current.zones || []).map((z) =>
        z.zoneCode === oldCode ? { ...z, zoneCode: newCode } : z
      );
      const updatedPins = (current.cadZonePins || []).map((p) =>
        p.id === updatedPin.id || p.zoneCode === oldCode ? { ...p, zoneCode: newCode, label: updatedPin.label || newCode } : p
      );
      const updatedFloors = [...prev.floors];
      updatedFloors[activeFloorIndex] = { ...current, zones: updatedZones, cadZonePins: updatedPins };
      return { ...prev, floors: updatedFloors };
    });
  };

  const handleDeleteElementPin = (pin: CadZonePin) => {
    updateFormData((prev) => {
      const current = prev.floors[activeFloorIndex] || prev.floors[0];
      if (!current) return prev;
      const updatedElements = (current.structuralElements || []).filter((e) => e.elementCode !== pin.zoneCode);
      const updatedPins = (current.cadElementPins || []).filter((p) => p.id !== pin.id && p.zoneCode !== pin.zoneCode);
      const updatedFloors = [...prev.floors];
      updatedFloors[activeFloorIndex] = { ...current, structuralElements: updatedElements, cadElementPins: updatedPins };
      return { ...prev, floors: updatedFloors };
    });
    setActiveElementIndex((prev) => Math.max(0, prev - 1));
  };

  const handleRenameElementPin = (oldCode: string, newCode: string, updatedPin: CadZonePin) => {
    updateFormData((prev) => {
      const current = prev.floors[activeFloorIndex] || prev.floors[0];
      if (!current) return prev;
      const updatedElements = (current.structuralElements || []).map((e) =>
        e.elementCode === oldCode ? { ...e, elementCode: newCode } : e
      );
      const updatedPins = (current.cadElementPins || []).map((p) =>
        p.id === updatedPin.id || p.zoneCode === oldCode ? { ...p, zoneCode: newCode, label: updatedPin.label || newCode } : p
      );
      const updatedFloors = [...prev.floors];
      updatedFloors[activeFloorIndex] = { ...current, structuralElements: updatedElements, cadElementPins: updatedPins };
      return { ...prev, floors: updatedFloors };
    });
  };

  const handleToggleHasStructuralElements = (hasElements: boolean, reason?: string) => {
    updateFormData((prev) => {
      const updatedFloors = [...prev.floors];
      const cur = updatedFloors[activeFloorIndex] || updatedFloors[0];
      if (!cur) return prev;
      updatedFloors[activeFloorIndex] = {
        ...cur,
        hasStructuralElements: hasElements,
        noStructuralElementsReason: hasElements
          ? undefined
          : (reason || cur.noStructuralElementsReason || 'Khu vực này không có cấu kiện chịu lực riêng'),
      };
      return { ...prev, floors: updatedFloors };
    });
  };

  // Tính toán số liệu thống kê tiến độ
  const totalAreas = formData.floors.length;
  const completedAreas = formData.floors.filter((f) => {
    const hasPhoto = (f.overviewPhotos?.length || 0) > 0;
    const hasZonesOrElements = (f.zones?.length || 0) > 0 || (f.structuralElements?.length || 0) > 0;
    return hasPhoto && hasZonesOrElements;
  }).length;

  const totalPhotosCount = formData.floors.reduce((acc, f) => acc + (f.overviewPhotos?.length || 0), 0);
  const totalZonesCount = formData.floors.reduce((acc, f) => acc + (f.zones?.length || 0), 0);
  const totalElementsCount = formData.floors.reduce((acc, f) => acc + (f.structuralElements?.length || 0), 0);
  const totalDefectsCount = formData.floors.reduce((acc, f) => {
    const zDefects = (f.zones || []).reduce((sum, z) => sum + (z.defects?.length || 0), 0);
    const eDefects = (f.structuralElements || []).reduce((sum, e) => sum + (e.defects?.length || 0), 0);
    return acc + zDefects + eDefects;
  }, 0);

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-16">
      {/* Toast thông báo lưu nháp / sync */}
      {syncToastMsg && (
        <div className="fixed top-4 right-4 z-[100006] px-4 py-3 bg-emerald-600 text-white rounded-2xl shadow-xl flex items-center gap-2.5 text-xs font-bold animate-in slide-in-from-top-4 duration-200">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{syncToastMsg}</span>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODE A: HUB VIEW - TỔNG QUAN DANH SÁCH CÁC PHÂN KHU DÙNG CHUNG */}
      {/* ========================================================= */}
      {viewMode === 'HUB' && (
        <div className="space-y-6 animate-in fade-in duration-150">
          {/* Executive Header Banner */}
          <div className="p-5 sm:p-6 bg-white border border-slate-200 rounded-3xl shadow-xs">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">
                    PHÂN HỆ KHẢO SÁT 3
                  </span>
                  <span className="text-xs font-mono font-bold text-slate-500">
                    Mã toà: {formData.projectParcelCode || formData.officialCadastralCode}
                  </span>
                </div>
                <h2 className="text-lg sm:text-xl font-bold text-slate-900 flex items-center gap-2">
                  Khảo Sát Hiện Trạng Chi Tiết Không Gian Dùng Chung Tòa Mẹ
                </h2>
                <p className="text-xs text-slate-500 mt-1 max-w-2xl leading-relaxed">
                  Hệ thống tự động phân bổ danh sách phân khu từ <strong>Quản Lý CAD</strong> (Hầm, Sân thượng, Sảnh...) và cho phép kỹ sư linh hoạt bổ sung các khu vực phát sinh tại hiện trường.
                </p>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2.5 flex-wrap shrink-0">
                <button
                  type="button"
                  onClick={() => syncMasterFloorsFromCad(false)}
                  disabled={isSyncingCad}
                  className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-colors border border-slate-200 flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                  title="Tải lại các mặt bằng tầng dùng chung mới nhất từ Quản lý CAD"
                >
                  <RotateCcw className={`w-3.5 h-3.5 ${isSyncingCad ? 'animate-spin' : ''}`} />
                  <span>Đồng bộ từ CAD</span>
                </button>

                <button
                  type="button"
                  onClick={() => setIsAddAreaModalOpen(true)}
                  className="px-4 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold transition-colors shadow-sm flex items-center gap-1.5 cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>+ Thêm Khu Vực Phát Sinh</span>
                </button>
              </div>
            </div>

            {/* Quick Metrics Bar */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-5 pt-4 border-t border-slate-100">
              <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200/80">
                <span className="text-[11px] font-semibold text-slate-500 block">Tiến độ phân khu</span>
                <span className="text-base font-bold text-slate-800">
                  <strong className="text-teal-700">{completedAreas}</strong> / {totalAreas} khu vực
                </span>
              </div>
              <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200/80">
                <span className="text-[11px] font-semibold text-slate-500 block">Ảnh tổng quan đã chụp</span>
                <span className="text-base font-bold text-slate-800">{totalPhotosCount} bức ảnh</span>
              </div>
              <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200/80">
                <span className="text-[11px] font-semibold text-slate-500 block">Vùng Z & Cấu kiện E</span>
                <span className="text-base font-bold text-slate-800">{totalZonesCount} Z • {totalElementsCount} E</span>
              </div>
              <div className="p-3 bg-slate-50 rounded-2xl border border-slate-200/80">
                <span className="text-[11px] font-semibold text-slate-500 block">Khuyết tật ghi nhận (D)</span>
                <span className="text-base font-bold text-amber-700">{totalDefectsCount} điểm lỗi</span>
              </div>
            </div>
          </div>

          {/* Danh sách các Thẻ Phân Khu Dùng Chung (Common Area Cards Grid) */}
          <div className="space-y-3">
            <div className="flex items-center justify-between px-1">
              <h3 className="text-xs font-bold uppercase tracking-wider text-slate-600 flex items-center gap-1.5">
                <Layers className="w-4 h-4 text-teal-600" />
                Danh Sách Phân Khu Khảo Sát ({formData.floors.length} khu vực)
              </h3>
              <span className="text-[11px] text-slate-400">
                Nhấn vào từng khu vực để bắt đầu khảo sát chi tiết
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {formData.floors.map((floor, fIdx) => {
                const photosCount = floor.overviewPhotos?.length || 0;
                const zonesCount = floor.zones?.length || 0;
                const elementsCount = floor.structuralElements?.length || 0;
                const defectsCount =
                  (floor.zones || []).reduce((sum, z) => sum + (z.defects?.length || 0), 0) +
                  (floor.structuralElements || []).reduce((sum, e) => sum + (e.defects?.length || 0), 0);

                const isCompleted = photosCount > 0 && (zonesCount > 0 || elementsCount > 0);
                const isInProgress = !isCompleted && (photosCount > 0 || zonesCount > 0 || elementsCount > 0);
                const isCustomArea = floor.id.includes('custom') || floor.id.startsWith('area_custom');

                return (
                  <div
                    key={floor.id || fIdx}
                    className="bg-white border border-slate-200 rounded-3xl p-5 hover:border-teal-400 hover:shadow-md transition-all flex flex-col justify-between group"
                  >
                    <div>
                      {/* Top Header of Card */}
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex items-center gap-3">
                          <div className={`p-2.5 rounded-2xl border ${
                            isCompleted
                              ? 'bg-emerald-50 text-emerald-600 border-emerald-200'
                              : isInProgress
                              ? 'bg-amber-50 text-amber-600 border-amber-200'
                              : 'bg-slate-100 text-slate-500 border-slate-200'
                          }`}>
                            <Building2 className="w-5 h-5" />
                          </div>
                          <div>
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <h4 className="text-sm font-bold text-slate-900 group-hover:text-teal-700 transition-colors">
                                {floor.floorName}
                              </h4>
                              {isCustomArea ? (
                                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-amber-50 text-amber-800 border border-amber-200">
                                  Khu vực phát sinh
                                </span>
                              ) : (
                                <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">
                                  Từ Quản lý CAD
                                </span>
                              )}
                            </div>
                            <span className="text-xs text-slate-400 block mt-0.5">
                              {floor.cadSketchPhotoUrl ? '✓ Có sơ đồ / CAD mặt bằng' : 'Chưa có bản vẽ CAD'}
                            </span>
                          </div>
                        </div>

                        {/* Status Badge */}
                        <div>
                          {isCompleted ? (
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
                              <CheckCircle2 className="w-3.5 h-3.5" /> Hoàn thành
                            </span>
                          ) : isInProgress ? (
                            <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
                              <Clock className="w-3.5 h-3.5" /> Đang khảo sát
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[11px] font-medium px-2.5 py-1 rounded-full bg-slate-100 text-slate-500 border border-slate-200">
                              Chưa khảo sát
                            </span>
                          )}
                        </div>
                      </div>

                      {/* CAD Blueprint Preview (if exists) */}
                      {floor.cadSketchPhotoUrl && (
                        <div className="mt-4 h-24 bg-slate-50 rounded-2xl border border-slate-200 overflow-hidden relative group/cad">
                          <img
                            src={floor.cadSketchPhotoUrl}
                            alt="CAD Blueprint"
                            className="w-full h-full object-contain p-2 opacity-80 group-hover/cad:opacity-100 transition-opacity"
                          />
                          <div className="absolute bottom-1.5 right-2 px-2 py-0.5 rounded bg-black/60 text-white text-[10px] font-mono">
                            Mặt bằng CAD
                          </div>
                        </div>
                      )}

                      {/* Metrics Badges */}
                      <div className="grid grid-cols-4 gap-1.5 mt-4 text-center">
                        <div className="p-2 bg-slate-50 rounded-xl border border-slate-100">
                          <span className="text-[10px] text-slate-400 block">Ảnh</span>
                          <span className="text-xs font-bold text-slate-800">{photosCount}</span>
                        </div>
                        <div className="p-2 bg-slate-50 rounded-xl border border-slate-100">
                          <span className="text-[10px] text-slate-400 block">Vùng Z</span>
                          <span className="text-xs font-bold text-slate-800">{zonesCount}</span>
                        </div>
                        <div className="p-2 bg-slate-50 rounded-xl border border-slate-100">
                          <span className="text-[10px] text-slate-400 block">Cấu kiện E</span>
                          <span className="text-xs font-bold text-slate-800">{elementsCount}</span>
                        </div>
                        <div className="p-2 bg-slate-50 rounded-xl border border-slate-100">
                          <span className="text-[10px] text-slate-400 block">Khuyết tật D</span>
                          <span className="text-xs font-bold text-amber-700">{defectsCount}</span>
                        </div>
                      </div>
                    </div>

                    {/* Bottom Action of Card */}
                    <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                      {isCustomArea ? (
                        <button
                          type="button"
                          onClick={() => handleDeleteArea(fIdx, floor.floorName)}
                          className="p-2 rounded-xl text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                          title="Xóa khu vực phát sinh này"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      ) : (
                        <div />
                      )}

                      <button
                        type="button"
                        onClick={() => {
                          setActiveFloorIndex(fIdx);
                          setActiveZoneIndex(0);
                          setActiveElementIndex(0);
                          setViewMode('FOCUSED');
                          window.scrollTo({ top: 0, behavior: 'smooth' });
                        }}
                        className="px-4 py-2 rounded-xl bg-teal-50 hover:bg-teal-100 text-teal-800 border border-teal-200 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-2xs group-hover:bg-teal-600 group-hover:text-white group-hover:border-teal-600"
                      >
                        <span>{isCompleted ? 'Xem lại & Hiệu chỉnh' : 'Bắt đầu khảo sát'}</span>
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Bottom Navigation: Next/Prev Wizard Step */}
          <div className="pt-6 border-t border-slate-200 flex items-center justify-between">
            <button
              type="button"
              onClick={prevStep}
              className="px-5 py-2.5 rounded-2xl bg-white border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-bold transition-colors flex items-center gap-2 cursor-pointer shadow-xs"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Quay lại: 2. Quy mô & Móng</span>
            </button>

            <button
              type="button"
              onClick={nextStep}
              className="px-6 py-2.5 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition-colors flex items-center gap-2 cursor-pointer shadow-md"
            >
              <span>Tiếp tục: 4. Burland toà</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODE B: FOCUSED VIEW - KHẢO SÁT TẬP TRUNG MỘT PHÂN KHU CỤ THỂ */}
      {/* ========================================================= */}
      {viewMode === 'FOCUSED' && (
        <div className="space-y-6 animate-in fade-in duration-150">
          {/* Focused Top Command Bar */}
          <div className="p-4 bg-white border border-slate-200 rounded-3xl shadow-sm flex items-center justify-between gap-3 flex-wrap sticky top-2 z-40 backdrop-blur-md bg-white/95">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => {
                  setViewMode('HUB');
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
                className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Danh sách phân khu</span>
              </button>

              <div className="h-5 w-px bg-slate-200 hidden sm:block" />

              {/* Selector chuyển nhanh giữa các khu vực */}
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-500 hidden sm:inline">Khu vực:</span>
                <select
                  value={activeFloorIndex}
                  onChange={(e) => {
                    const nextIdx = Number(e.target.value);
                    setActiveFloorIndex(nextIdx);
                    setActiveZoneIndex(0);
                    setActiveElementIndex(0);
                  }}
                  className="px-3 py-1.5 bg-teal-50 border border-teal-300 text-teal-950 font-bold text-xs rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500 cursor-pointer"
                >
                  {formData.floors.map((fl, idx) => (
                    <option key={fl.id || idx} value={idx}>
                      {idx + 1}. {fl.floorName}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleSaveSectionDraft}
                disabled={isSavingDraft}
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-colors shadow-sm flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <Save className="w-3.5 h-3.5" />
                <span>{isSavingDraft ? 'Đang lưu...' : 'Lưu Nháp Phân Khu'}</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setViewMode('HUB');
                  window.scrollTo({ top: 0, behavior: 'smooth' });
                }}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer"
              >
                <Check className="w-3.5 h-3.5" />
                <span>Hoàn tất & Quay lại</span>
              </button>
            </div>
          </div>

          {/* Thông tin CAD và phân khu đang chọn */}
          <div className="p-4 bg-indigo-50/70 border border-indigo-200 rounded-2xl flex items-center justify-between text-xs text-indigo-900">
            <div className="flex items-center gap-2">
              <span className="font-bold">Đang khảo sát:</span>
              <strong className="text-indigo-950 text-sm">{currentFloor.floorName}</strong>
              {currentFloor.cadSketchPhotoUrl && (
                <span className="text-[11px] bg-white border border-indigo-300 text-indigo-700 px-2 py-0.5 rounded-full font-semibold">
                  ✓ Mặt bằng CAD đã sẵn sàng
                </span>
              )}
            </div>
            <span className="text-[11px] text-indigo-700">
              Phân khu {activeFloorIndex + 1} / {formData.floors.length}
            </span>
          </div>

          {/* Section 1: Ảnh chụp tổng quan phân khu */}
          <Step3FloorOverviewSection
            currentFloor={currentFloor}
            activeFloorIndex={activeFloorIndex}
            projectParcelCode={formData.projectParcelCode}
            onUpdateOverviewPhotos={(photos) => {
              updateFormData((prev) => {
                const updated = [...prev.floors];
                const cur = updated[activeFloorIndex] || updated[0];
                if (!cur) return prev;
                updated[activeFloorIndex] = { ...cur, overviewPhotos: photos };
                return { ...prev, floors: updated };
              });
            }}
          />

          {/* Section 2: Mặt bằng CAD_01 & Vùng Kiến Trúc Z */}
          <DamageZonesSection
            currentFloor={currentFloor}
            activeZoneIndex={activeZoneIndex}
            projectParcelCode={formData.projectParcelCode}
            onCadPhotoChange={(url) => {
              updateFormData((prev) => {
                const updated = [...prev.floors];
                const cur = updated[activeFloorIndex] || updated[0];
                if (!cur) return prev;
                updated[activeFloorIndex] = { ...cur, cadSketchPhotoUrl: url };
                return { ...prev, floors: updated };
              });
            }}
            onChangePins={(pins) => {
              updateFormData((prev) => {
                const updated = [...prev.floors];
                const cur = updated[activeFloorIndex] || updated[0];
                if (!cur) return prev;
                updated[activeFloorIndex] = { ...cur, cadZonePins: pins };
                return { ...prev, floors: updated };
              });
            }}
            onAutoCreatePin={handleAutoCreateZonePin}
            onDeletePin={handleDeleteZonePin}
            onRenamePin={handleRenameZonePin}
            onSelectZone={(idx) => navigateToZone(idx, false)}
            onUpdateZone={handleUpdateZone}
            onDeleteZone={handleDeleteZone}
            onNextZone={() => navigateToZone(activeZoneIndex + 1, true)}
            onPrevZone={() => navigateToZone(activeZoneIndex - 1, false)}
            onRequestAddNextZone={() => {
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
              }
            }}
            onOpenPinningModal={(zoneId) => setPinningZoneId(zoneId)}
          />

          {/* Section 3: Mặt bằng CAD_02 & Cấu Kiện Kết Cấu E */}
          <StructuralElementsSection
            currentFloor={currentFloor}
            activeElementIndex={activeElementIndex}
            projectParcelCode={formData.projectParcelCode}
            onCadPhotoChange={(url) => {
              updateFormData((prev) => {
                const updated = [...prev.floors];
                const cur = updated[activeFloorIndex] || updated[0];
                if (!cur) return prev;
                updated[activeFloorIndex] = { ...cur, cadStructuralSketchPhotoUrl: url };
                return { ...prev, floors: updated };
              });
            }}
            onChangePins={(pins) => {
              updateFormData((prev) => {
                const updated = [...prev.floors];
                const cur = updated[activeFloorIndex] || updated[0];
                if (!cur) return prev;
                updated[activeFloorIndex] = { ...cur, cadElementPins: pins };
                return { ...prev, floors: updated };
              });
            }}
            onAutoCreatePin={handleAutoCreateElementPin}
            onDeletePin={handleDeleteElementPin}
            onRenamePin={handleRenameElementPin}
            onSelectElement={(idx) => navigateToElement(idx, false)}
            onUpdateElement={handleUpdateElement}
            onDeleteElement={handleDeleteElement}
            onNextElement={() => navigateToElement(activeElementIndex + 1, true)}
            onPrevElement={() => navigateToElement(activeElementIndex - 1, false)}
            onRequestAddNextElement={() => {
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
              }
            }}
            onOpenPinningModal={(elementId) => setPinningElementId(elementId)}
            onToggleHasStructuralElements={handleToggleHasStructuralElements}
          />

          {/* Section 4: Quan trắc độ võng sàn / Lún (nếu có) */}
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

          {/* Footer Navigation within Focused View */}
          <div className="p-4 bg-white border border-slate-200 rounded-3xl flex items-center justify-between gap-3 flex-wrap">
            <button
              type="button"
              onClick={() => {
                setViewMode('HUB');
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              className="px-5 py-2.5 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold transition-colors flex items-center gap-2 cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Quay lại danh sách phân khu</span>
            </button>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleSaveSectionDraft}
                disabled={isSavingDraft}
                className="px-4 py-2.5 rounded-2xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs disabled:opacity-50"
              >
                <Save className="w-4 h-4" />
                <span>{isSavingDraft ? 'Đang lưu...' : 'Lưu Nháp'}</span>
              </button>

              {activeFloorIndex < formData.floors.length - 1 ? (
                <button
                  type="button"
                  onClick={() => {
                    setActiveFloorIndex((prev) => prev + 1);
                    setActiveZoneIndex(0);
                    setActiveElementIndex(0);
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }}
                  className="px-5 py-2.5 rounded-2xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-bold transition-colors flex items-center gap-2 cursor-pointer shadow-sm"
                >
                  <span>Sang khu vực tiếp theo</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    setViewMode('HUB');
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                  }}
                  className="px-5 py-2.5 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition-colors flex items-center gap-2 cursor-pointer shadow-sm"
                >
                  <Check className="w-4 h-4" />
                  <span>Hoàn tất & Về Hub</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Modal Thêm Khu Vực Phát Sinh */}
      <CondoMasterAddAreaModal
        isOpen={isAddAreaModalOpen}
        onClose={() => setIsAddAreaModalOpen(false)}
        onAddArea={handleAddArea}
        existingFloorsCount={formData.floors.length}
      />

      {/* Modal Defect Pinning */}
      {pinningZoneId && (() => {
        const pinningZoneObj = zones.find((z) => z.id === pinningZoneId);
        if (!pinningZoneObj) return null;
        return (
          <DefectPinningModal
            isOpen={Boolean(pinningZoneId)}
            mode="ARCHITECTURAL"
            code={pinningZoneObj.zoneCode}
            name={pinningZoneObj.roomName}
            floorName={currentFloor.floorName}
            projectParcelCode={formData.projectParcelCode}
            ctxPhotoUrl={pinningZoneObj.ctxPhotoUrl}
            defects={pinningZoneObj.defects || []}
            onChange={(defects: DefectItem[]) => {
              const zIdx = zones.findIndex((z) => z.id === pinningZoneObj.id);
              if (zIdx !== -1) {
                handleUpdateZone(zIdx, { defects });
              }
            }}
            onClose={() => setPinningZoneId(null)}
          />
        );
      })()}

      {pinningElementId && (() => {
        const pinningElementObj = structuralElements.find((e) => e.id === pinningElementId);
        if (!pinningElementObj) return null;
        return (
          <DefectPinningModal
            isOpen={Boolean(pinningElementId)}
            mode="STRUCTURAL"
            code={pinningElementObj.elementCode}
            name={pinningElementObj.roomName || 'Cấu kiện'}
            floorName={currentFloor.floorName}
            projectParcelCode={formData.projectParcelCode}
            ctxPhotoUrl={pinningElementObj.ctxPhotoUrl}
            defects={pinningElementObj.defects || []}
            onChange={(defects: DefectItem[]) => {
              const eIdx = structuralElements.findIndex((e) => e.id === pinningElementObj.id);
              if (eIdx !== -1) {
                handleUpdateElement(eIdx, { defects });
              }
            }}
            onClose={() => setPinningElementId(null)}
          />
        );
      })()}
    </div>
  );
};
