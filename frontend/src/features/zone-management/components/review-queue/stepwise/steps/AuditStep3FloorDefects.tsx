import type { FloorSurveyData, DamageZoneData, StructuralElementData } from '../../../../../survey-phase1/types/phase1.types';
import type { DefectItem } from '../../../../../../components/canvas/DefectPinningCanvas';
import { getNextAvailablePinCode, type CadZonePin } from '../../../../../../components/canvas/FloorCadPinningCanvas';
import type { PhotoReplaceParams } from '../../AuditPhotoReplaceModal';
import type { AuditPhotoActionParams, AuditPhotoHistoryParams, PhotoActionPayload } from '../types';
import React, { useState, useRef } from 'react';
import { Layers, Maximize2, AlertTriangle, CheckCircle2, MapPin, Eye, EyeOff, Camera, ShieldAlert, Compass, Activity, FileText, Ruler, Sparkles, RefreshCw, Plus, Trash2, History, Crosshair, Undo2 } from 'lucide-react';
import { Badge } from '../../../../../../core/components/ui/Badge';
import { AuditPhotoCard } from '../components/AuditPhotoCard';

const ROOM_PRESETS = [
  'Phòng khách',
  'Phòng ngủ 1',
  'Phòng ngủ 2',
  'Phòng ngủ 3',
  'Bếp & Phòng ăn',
  'Phòng vệ sinh (WC)',
  'Ban công / Lô gia',
  'Hành lang / Lối đi',
  'Cầu thang',
  'Mặt tiền ngoài nhà',
  'Sân trước / Sau',
  'Sân thượng / Mái',
  'Khu vực kỹ thuật',
];

const COMPONENT_TYPE_PRESETS = [
  'Tường ngăn',
  'Tường chịu lực',
  'Cột',
  'Dầm',
  'Nền / Sàn',
  'Trần thạch cao',
  'Lan can / Ban công',
  'Cầu thang',
  'Móng / Chân tường',
  'Khác',
];

const WALL_MATERIAL_PRESETS = [
  'Gạch ống (2 lỗ / 4 lỗ)',
  'Gạch thẻ (đặc)',
  'Bê tông cốt thép',
  'Vữa trát xi măng',
  'Gạch block xi măng',
  'Gạch men / Ốp đá',
  'Tấm thạch cao',
  'Gạch đất nung không trát',
  'Khác',
];

const ELEMENT_TYPE_PRESETS = [
  'Cột BTCT',
  'Dầm BTCT',
  'Sàn BTCT',
  'Tường chịu lực',
  'Cầu thang BTCT',
  'Khung cột thép',
  'Móng / Đà kiềng',
  'Khác',
];

const MATERIAL_TYPE_PRESETS = [
  'Bê tông cốt thép (BTCT)',
  'Thép hình / Kim loại',
  'Tường gạch chịu lực',
  'Gỗ',
  'Khác',
];

const STRUCTURAL_INTEGRITY_PRESETS = [
  'Nguyên vẹn',
  'Rạn nứt chân chim bề mặt',
  'Nứt thấu kết cấu',
  'Rỉ cốt thép / Bong vỡ bê tông',
  'Nghiêng lệch / Biến dạng',
];

const DEFECT_TYPE_PRESETS = [
  'Vết nứt thẳng đứng',
  'Vết nứt xiên 45 độ',
  'Vết nứt ngang',
  'Nứt chân chim',
  'Bong tróc vữa/sơn',
  'Bong vỡ bê tông',
  'Rỉ ố ẩm mốc / Thấm dột',
  'Lún sụt / Nứt sàn',
  'Nứt tiếp giáp cấu kiện',
  'Nghiêng lệch cấu kiện',
  'Vết nứt tường',
  'Vết nứt dầm/cột',
  'Khác',
];

interface Props {
  isEditMode: boolean;
  formState: Record<string, unknown>;
  handleFieldChange: (key: string, label: string, val: unknown) => void;
  onOpenPhotoZoom: (url: string, title?: string, photoCode?: string) => void;
  onOpenPhotoReplace: (params: PhotoReplaceParams) => void;
  onOpenPhotoAction?: (params: AuditPhotoActionParams) => void;
  onOpenPhotoHistory?: (params: AuditPhotoHistoryParams) => void;
  isFieldDirty?: (fieldKey: string, subKey?: string) => boolean;
  stagedPhotoActions?: PhotoActionPayload[];
  onUndoPhotoAction?: (action: PhotoActionPayload) => void;
}

export const AuditStep3FloorDefects: React.FC<Props> = ({
  isEditMode,
  formState,
  handleFieldChange,
  onOpenPhotoZoom,
  onOpenPhotoReplace,
  onOpenPhotoAction,
  onOpenPhotoHistory,
  isFieldDirty,
  stagedPhotoActions = [],
  onUndoPhotoAction,
}) => {
  // Helper tra cứu trạng thái can thiệp ảnh staged trong phiên thẩm định
  const getStagedAction = (filter: {
    category?: string;
    targetPhotoId?: string;
    defectId?: string;
    photoIndex?: number;
    url?: string;
  }) => {
    if (!stagedPhotoActions || stagedPhotoActions.length === 0) return null;
    return stagedPhotoActions.find((a) => {
      if (filter.category && a.category !== filter.category) return false;
      if (filter.targetPhotoId && a.targetPhotoId && a.targetPhotoId !== filter.targetPhotoId) return false;
      if (filter.defectId && a.defectId && a.defectId !== filter.defectId) return false;
      if (filter.url && a.oldPhotoUrl && a.oldPhotoUrl === filter.url) return true;
      if (filter.photoIndex !== undefined && a.photoIndex !== undefined && a.photoIndex === filter.photoIndex) return true;
      return false;
    });
  };

  const rawFloors: FloorSurveyData[] = Array.isArray(formState.floors) ? (formState.floors as FloorSurveyData[]) : [];
  const rawDamageZones: DamageZoneData[] = Array.isArray(formState.damageZones) ? (formState.damageZones as DamageZoneData[]) : [];

  // Determine active floor
  const [activeFloorIndex, setActiveFloorIndex] = useState(0);
  const [cadViewMode, setCadViewMode] = useState<'ARCH' | 'STRUCT'>('ARCH');
  const [showCadPins, setShowCadPins] = useState(true);
  const [showCtxPins, setShowCtxPins] = useState(true);
  const [showDeletedItems, setShowDeletedItems] = useState(false);
  const [zoneToDelete, setZoneToDelete] = useState<DamageZoneData | null>(null);
  const [highlightedDefectId, setHighlightedDefectId] = useState<string | null>(null);

  // Pinning & Drag state for CAD (Z & E)
  const [cadPinningMode, setCadPinningMode] = useState<'Z' | 'E' | null>(null);
  const [draggingCadPin, setDraggingCadPin] = useState<{
    pinCode: string;
    isStruct: boolean;
    currentX: number;
    currentY: number;
  } | null>(null);
  const cadImageWrapperRef = useRef<HTMLDivElement | null>(null);

  // Pinning & Drag state for CTX (D)
  const [pinningCtxZone, setPinningCtxZone] = useState<string | null>(null);
  const [draggingDefectPin, setDraggingDefectPin] = useState<{
    zoneId: string;
    defectId: string;
    dCode: string;
    currentX: number;
    currentY: number;
  } | null>(null);
  const hasJustDraggedRef = useRef<boolean>(false);
  const pointerStartPosRef = useRef<{ x: number; y: number } | null>(null);

  // If floors array exists and is non-empty, use floor hierarchy; otherwise wrap damageZones as virtual floor
  const hasFloors = rawFloors.length > 0;
  const floorsList = hasFloors
    ? rawFloors
    : [
        {
          id: 'virtual-floor-1',
          floorName: 'Tầng Khảo Sát Tổng Thể',
          overviewPhotos: [],
          cadSketchPhotoUrl: '',
          cadZonePins: [],
          zones: rawDamageZones,
        },
      ];

  const currentFloor: FloorSurveyData = (floorsList[activeFloorIndex] || floorsList[0] || {}) as FloorSurveyData;
  const currentZones: DamageZoneData[] = Array.isArray(currentFloor.zones) ? currentFloor.zones : [];
  const currentElements: StructuralElementData[] = Array.isArray(currentFloor.structuralElements) ? currentFloor.structuralElements : [];

  const activeZones = currentZones.filter((z) => !z.is_deleted && !(z as any).isDeleted);
  const deletedZones = currentZones.filter((z) => z.is_deleted || (z as any).isDeleted);
  const displayedZones = showDeletedItems ? currentZones : activeZones;

  const activeElements = currentElements.filter((e) => !e.is_deleted && !(e as any).isDeleted);
  const deletedElements = currentElements.filter((e) => e.is_deleted || (e as any).isDeleted);
  const displayedElements = showDeletedItems ? currentElements : activeElements;

  const currentCadPins: CadZonePin[] = cadViewMode === 'ARCH'
    ? (Array.isArray(currentFloor.cadZonePins) ? currentFloor.cadZonePins : [])
    : (Array.isArray(currentFloor.cadElementPins) ? currentFloor.cadElementPins : []);

  const displayedCadPins = currentCadPins.filter((p) => {
    if (showDeletedItems) return true;
    const pinCode = p.zoneCode || p.zone_code || '';
    if (cadViewMode === 'ARCH') {
      return !deletedZones.some((dz) => (dz.zoneCode || dz.zone_code) === pinCode);
    } else {
      return !deletedElements.some((de) => (de.elementCode || de.element_code) === pinCode);
    }
  });

  const cadPhotoUrl = cadViewMode === 'ARCH'
    ? (currentFloor.cadSketchPhotoUrl || currentFloor.cad_drawing_url || '')
    : (currentFloor.cadStructuralSketchPhotoUrl || currentFloor.cad_structural_drawing_url || '');

  // Commit new coordinates for CAD pins (Z or E)
  const handleCommitCadPinCoord = (pinCode: string, isStruct: boolean, newX: number, newY: number) => {
    if (hasFloors) {
      const updatedFloors = rawFloors.map((fl: FloorSurveyData, fi: number) => {
        if (fi !== activeFloorIndex && fl.id !== currentFloor.id) return fl;
        if (isStruct) {
          const pins = (fl.cadElementPins || []).map((p: CadZonePin) => {
            if ((p.zoneCode || p.zone_code) === pinCode) {
              return { ...p, pinX: newX, pinY: newY, pin_x: newX, pin_y: newY };
            }
            return p;
          });
          return { ...fl, cadElementPins: pins };
        } else {
          const pins = (fl.cadZonePins || []).map((p: CadZonePin) => {
            if ((p.zoneCode || p.zone_code) === pinCode) {
              return { ...p, pinX: newX, pinY: newY, pin_x: newX, pin_y: newY };
            }
            return p;
          });
          return { ...fl, cadZonePins: pins };
        }
      });
      handleFieldChange('floors', `Điều chỉnh vị trí ghim ${pinCode} (${newX}%, ${newY}%)`, updatedFloors);
    }
  };

  // Click-to-pin on CAD
  const handleCadImageClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!cadPinningMode) return;
    const container = cadImageWrapperRef.current;
    if (!container) return;
    const rect = container.getBoundingClientRect();
    const rawX = ((e.clientX - rect.left) / rect.width) * 100;
    const rawY = ((e.clientY - rect.top) / rect.height) * 100;
    const pinX = Math.round(Math.max(2, Math.min(98, rawX)) * 10) / 10;
    const pinY = Math.round(Math.max(2, Math.min(98, rawY)) * 10) / 10;

    const isStruct = cadPinningMode === 'E';
    const prefix = isStruct ? 'E' : 'Z';
    const pinsToCheck = isStruct
      ? (Array.isArray(currentFloor.cadElementPins) ? currentFloor.cadElementPins : [])
      : (Array.isArray(currentFloor.cadZonePins) ? currentFloor.cadZonePins : []);
    const historicalCodes = isStruct
      ? (currentFloor.structuralElements || []).map((e) => e.elementCode || '')
      : (currentFloor.zones || []).map((z) => z.zoneCode || z.zone_code || '');
    const nextPinCode = getNextAvailablePinCode(pinsToCheck, prefix, historicalCodes);

    const newPin: CadZonePin = {
      id: `pin-${prefix.toLowerCase()}-${Date.now()}`,
      zoneCode: nextPinCode,
      pinX,
      pinY,
      pin_x: pinX,
      pin_y: pinY,
      label: nextPinCode,
      type: isStruct ? 'STRUCTURAL' : 'ZONE',
    };

    if (hasFloors) {
      const updatedFloors = rawFloors.map((fl: FloorSurveyData, fi: number) => {
        if (fi !== activeFloorIndex && fl.id !== currentFloor.id) return fl;
        if (isStruct) {
          const currentPins = Array.isArray(fl.cadElementPins) ? fl.cadElementPins : [];
          const currentElems = Array.isArray(fl.structuralElements) ? fl.structuralElements : [];
          const newElem: StructuralElementData = {
            id: `elem-${Date.now()}`,
            elementCode: nextPinCode,
            elementType: 'Cột/Dầm BTCT',
            materialType: 'BTCT',
            roomName: '',
            floorName: fl.floorName || 'Tầng',
            notes: '',
            defects: [],
            overviewPhotos: [],
          };
          return {
            ...fl,
            cadElementPins: [...currentPins, newPin],
            structuralElements: [...currentElems, newElem],
          };
        } else {
          const currentPins = Array.isArray(fl.cadZonePins) ? fl.cadZonePins : [];
          const currentZonesList = Array.isArray(fl.zones) ? fl.zones : [];
          const newZone: DamageZoneData = {
            id: `zone-${Date.now()}`,
            zoneCode: nextPinCode,
            floorName: fl.floorName || 'Tầng',
            roomName: 'Không gian mới',
            componentType: 'Tường gạch',
            wallMaterial: 'Vữa trát xi măng',
            notes: '',
            defects: [],
            overviewPhotos: [],
          };
          return {
            ...fl,
            cadZonePins: [...currentPins, newPin],
            zones: [...currentZonesList, newZone],
          };
        }
      });
      handleFieldChange('floors', `Thêm ghim ${nextPinCode} tại (${pinX}%, ${pinY}%)`, updatedFloors);
    }
    setCadPinningMode(null);
  };

  // Commit new coordinates for D pins on CTX
  const handleCommitDefectPinCoord = (zoneId: string, defectId: string, dCode: string, newX: number, newY: number) => {
    if (hasFloors) {
      const updatedFloors = rawFloors.map((fl: FloorSurveyData, fi: number) => {
        if (fi !== activeFloorIndex && fl.id !== currentFloor.id) return fl;
        const zones = (fl.zones || []).map((z: DamageZoneData) => {
          if (z.id !== zoneId) return z;
          const defects = (z.defects || []).map((d: DefectItem) => {
            if (d.id !== defectId && d.defectCode !== defectId) return d;
            return { ...d, pinX: newX, pinY: newY, pin_x: newX, pin_y: newY };
          });
          return { ...z, defects };
        });
        return { ...fl, zones };
      });
      handleFieldChange('floors', `Điều chỉnh vị trí ghim ${dCode} (${newX}%, ${newY}%)`, updatedFloors);
    } else {
      const updatedZones = rawDamageZones.map((z: DamageZoneData) => {
        if (z.id !== zoneId) return z;
        const defects = (z.defects || []).map((d: DefectItem) => {
          if (d.id !== defectId && d.defectCode !== defectId) return d;
          return { ...d, pinX: newX, pinY: newY, pin_x: newX, pin_y: newY };
        });
        return { ...z, defects };
      });
      handleFieldChange('damageZones', `Điều chỉnh vị trí ghim ${dCode} (${newX}%, ${newY}%)`, updatedZones);
    }
  };

  // Click-to-pin D on CTX photo
  const handleCtxImageClick = (e: React.MouseEvent<HTMLDivElement>, zone: DamageZoneData) => {
    const zCode = zone.zoneCode || zone.zone_code || 'Z-01';
    if (pinningCtxZone !== zCode) return;
    const container = e.currentTarget;
    const rect = container.getBoundingClientRect();
    const rawX = ((e.clientX - rect.left) / rect.width) * 100;
    const rawY = ((e.clientY - rect.top) / rect.height) * 100;
    const pinX = Math.round(Math.max(2, Math.min(98, rawX)) * 10) / 10;
    const pinY = Math.round(Math.max(2, Math.min(98, rawY)) * 10) / 10;

    const defectsList: DefectItem[] = Array.isArray(zone.defects) ? zone.defects : [];
    const historicalDCodes = defectsList.map((d) => d.defectCode || d.defect_code || '');
    const nextDCode = getNextAvailablePinCode(
      defectsList.map((d) => ({ zoneCode: d.defectCode || d.defect_code })),
      'D',
      historicalDCodes
    );

    const newDefectId = `D-${Date.now().toString().slice(-4)}`;
    const newDefect: DefectItem = {
      id: newDefectId,
      defectCode: nextDCode,
      defectType: 'Vết nứt tường',
      screeningCategory: 'Vết nứt tường',
      widthMaxMm: 0.2,
      lengthMm: 100,
      depthMm: 5,
      pinX,
      pinY,
      pin_x: pinX,
      pin_y: pinY,
      isStructuralCritical: false,
      crackDirection: 'Ngang',
      activityState: 'S',
      hasScaleCard: true,
      notes: '',
      materialDegradationE4: '',
      structuralSignificanceE2: '',
      cuPhotoUrl: '',
      cuPhotos: [],
    };

    if (hasFloors) {
      const updatedFloors = rawFloors.map((fl: FloorSurveyData, fi: number) => {
        if (fi !== activeFloorIndex && fl.id !== currentFloor.id) return fl;
        const zones = (fl.zones || []).map((z: DamageZoneData) => {
          if (z.id !== zone.id && (z.zoneCode || z.zone_code) !== zCode) return z;
          const currentDefects = Array.isArray(z.defects) ? z.defects : [];
          return { ...z, defects: [...currentDefects, newDefect] };
        });
        return { ...fl, zones };
      });
      handleFieldChange('floors', `Thêm khuyết tật ${nextDCode} tại (${pinX}%, ${pinY}%)`, updatedFloors);
    } else {
      const updatedZones = rawDamageZones.map((z: DamageZoneData) => {
        if (z.id !== zone.id && (z.zoneCode || z.zone_code) !== zCode) return z;
        const currentDefects = Array.isArray(z.defects) ? z.defects : [];
        return { ...z, defects: [...currentDefects, newDefect] };
      });
      handleFieldChange('damageZones', `Thêm khuyết tật ${nextDCode} tại (${pinX}%, ${pinY}%)`, updatedZones);
    }

    setPinningCtxZone(null);

    // Mở modal AuditPhotoActionModal ở chế độ ADD kèm tọa độ pinX, pinY
    if (onOpenPhotoAction) {
      onOpenPhotoAction({
        initialMode: 'ADD',
        category: 'DEFECT_CU',
        targetPhotoType: 'CU',
        targetPhotoId: nextDCode,
        defectId: newDefectId,
        defectCode: nextDCode,
        floorCode: currentFloor.floorName,
        zoneCode: zCode,
        initialPinX: pinX,
        initialPinY: pinY,
        photoTitle: `Khuyết tật ${nextDCode} (${zCode})`,
      });
    }
  };

  // Handle changing defect properties in floors or damageZones
  const handleDefectChange = (zoneId: string, defectId: string, field: string, val: unknown, fieldLabel: string) => {
    if (hasFloors) {
      const updatedFloors = rawFloors.map((fl: FloorSurveyData, fi: number) => {
        if (fi !== activeFloorIndex && fl.id !== currentFloor.id) return fl;
        const zones = (fl.zones || []).map((z: DamageZoneData) => {
          if (z.id !== zoneId) return z;
          const defects = (z.defects || []).map((d: DefectItem) => {
            if (d.id !== defectId && d.defectCode !== defectId) return d;
            return { ...d, [field]: val };
          });
          return { ...z, defects };
        });
        return { ...fl, zones };
      });
      handleFieldChange('floors', `Khuyết tật ${fieldLabel}`, updatedFloors);
    } else {
      const updatedZones = rawDamageZones.map((z: DamageZoneData) => {
        if (z.id !== zoneId) return z;
        const defects = (z.defects || []).map((d: DefectItem) => {
          if (d.id !== defectId && d.defectCode !== defectId) return d;
          return { ...d, [field]: val };
        });
        return { ...z, defects };
      });
      handleFieldChange('damageZones', `Khuyết tật ${fieldLabel}`, updatedZones);
    }
  };

  // Handle changing zone fields
  const handleZoneFieldChange = (zoneId: string, field: string, val: unknown, fieldLabel: string) => {
    if (hasFloors) {
      const updatedFloors = rawFloors.map((fl: FloorSurveyData, fi: number) => {
        if (fi !== activeFloorIndex && fl.id !== currentFloor.id) return fl;
        const zones = (fl.zones || []).map((z: DamageZoneData) => {
          if (z.id !== zoneId) return z;
          return { ...z, [field]: val };
        });
        return { ...fl, zones };
      });
      handleFieldChange('floors', `Vùng Z (${fieldLabel})`, updatedFloors);
    } else {
      const updatedZones = rawDamageZones.map((z: DamageZoneData) => {
        if (z.id !== zoneId) return z;
        return { ...z, [field]: val };
      });
      handleFieldChange('damageZones', `Vùng Z (${fieldLabel})`, updatedZones);
    }
  };

  // Add new defect to a zone
  const handleAddDefect = (zoneId: string) => {
    const newDefectId = `D-${Date.now().toString().slice(-4)}`;
    const newDefect = {
      id: newDefectId,
      defectCode: newDefectId,
      defectType: 'Vết nứt tường',
      screeningCategory: 'Vết nứt tường',
      widthMaxMm: 0.2,
      lengthMm: 100,
      depthMm: 5,
      isStructuralCritical: false,
      crackDirection: 'Ngang',
      activityState: 'S',
      hasScaleCard: true,
      notes: '',
      cuPhotos: [],
    };

    if (hasFloors) {
      const updatedFloors = rawFloors.map((fl: FloorSurveyData, fi: number) => {
        if (fi !== activeFloorIndex && fl.id !== currentFloor.id) return fl;
        const zones = (fl.zones || []).map((z: DamageZoneData) => {
          if (z.id !== zoneId) return z;
          const currentDefects = Array.isArray(z.defects) ? z.defects : [];
          return { ...z, defects: [...currentDefects, newDefect] };
        });
        return { ...fl, zones };
      });
      handleFieldChange('floors', `Thêm khuyết tật ${newDefectId}`, updatedFloors);
    } else {
      const updatedZones = rawDamageZones.map((z: DamageZoneData) => {
        if (z.id !== zoneId) return z;
        const currentDefects = Array.isArray(z.defects) ? z.defects : [];
        return { ...z, defects: [...currentDefects, newDefect] };
      });
      handleFieldChange('damageZones', `Thêm khuyết tật ${newDefectId}`, updatedZones);
    }
  };

  // Soft-remove defect from a zone (Preserve code, watermark and pin history)
  const handleRemoveDefect = (zoneId: string, defectId: string) => {
    if (hasFloors) {
      const updatedFloors = rawFloors.map((fl: FloorSurveyData, fi: number) => {
        if (fi !== activeFloorIndex && fl.id !== currentFloor.id) return fl;
        const zones = (fl.zones || []).map((z: DamageZoneData) => {
          if (z.id !== zoneId) return z;
          const defects = (z.defects || []).map((d: DefectItem) => {
            if (d.id !== defectId && d.defectCode !== defectId) return d;
            return { ...d, is_deleted: true };
          });
          return { ...z, defects };
        });
        return { ...fl, zones };
      });
      handleFieldChange('floors', `Xóa mềm khuyết tật ${defectId}`, updatedFloors);
    } else {
      const updatedZones = rawDamageZones.map((z: DamageZoneData) => {
        if (z.id !== zoneId) return z;
        const defects = (z.defects || []).map((d: DefectItem) => {
          if (d.id !== defectId && d.defectCode !== defectId) return d;
          return { ...d, is_deleted: true };
        });
        return { ...z, defects };
      });
      handleFieldChange('damageZones', `Xóa mềm khuyết tật ${defectId}`, updatedZones);
    }
  };

  // Restore defect
  const handleRestoreDefect = (zoneId: string, defectId: string) => {
    if (hasFloors) {
      const updatedFloors = rawFloors.map((fl: FloorSurveyData, fi: number) => {
        if (fi !== activeFloorIndex && fl.id !== currentFloor.id) return fl;
        const zones = (fl.zones || []).map((z: DamageZoneData) => {
          if (z.id !== zoneId) return z;
          const defects = (z.defects || []).map((d: DefectItem) => {
            if (d.id !== defectId && d.defectCode !== defectId) return d;
            return { ...d, is_deleted: false };
          });
          return { ...z, defects };
        });
        return { ...fl, zones };
      });
      handleFieldChange('floors', `Khôi phục khuyết tật ${defectId}`, updatedFloors);
    } else {
      const updatedZones = rawDamageZones.map((z: DamageZoneData) => {
        if (z.id !== zoneId) return z;
        const defects = (z.defects || []).map((d: DefectItem) => {
          if (d.id !== defectId && d.defectCode !== defectId) return d;
          return { ...d, is_deleted: false };
        });
        return { ...z, defects };
      });
      handleFieldChange('damageZones', `Khôi phục khuyết tật ${defectId}`, updatedZones);
    }
  };

  // Request zone deletion (prompt danger modal if defects exist)
  const handleRemoveZone = (zone: DamageZoneData) => {
    const activeChildDefects = (zone.defects || []).filter((d: DefectItem) => !d.is_deleted && !(d as any).isDeleted);
    if (activeChildDefects.length > 0) {
      setZoneToDelete(zone);
      return;
    }
    executeSoftDeleteZone(zone);
  };

  // Execute cascade soft-delete on zone and its defects
  const executeSoftDeleteZone = (zone: DamageZoneData) => {
    const zCode = zone.zoneCode || zone.zone_code || 'Z-??';
    if (hasFloors) {
      const updatedFloors = rawFloors.map((fl: FloorSurveyData, fi: number) => {
        if (fi !== activeFloorIndex && fl.id !== currentFloor.id) return fl;
        const zones = (fl.zones || []).map((z: DamageZoneData) => {
          if (z.id !== zone.id && z.zoneCode !== zCode) return z;
          const defects = (z.defects || []).map((d: DefectItem) => ({ ...d, is_deleted: true }));
          return { ...z, is_deleted: true, defects };
        });
        return { ...fl, zones };
      });
      handleFieldChange('floors', `Xóa mềm Vùng ${zCode} và các khuyết tật con`, updatedFloors);
    } else {
      const updatedZones = rawDamageZones.map((z: DamageZoneData) => {
        if (z.id !== zone.id && z.zoneCode !== zCode) return z;
        const defects = (z.defects || []).map((d: DefectItem) => ({ ...d, is_deleted: true }));
        return { ...z, is_deleted: true, defects };
      });
      handleFieldChange('damageZones', `Xóa mềm Vùng ${zCode} và các khuyết tật con`, updatedZones);
    }
    setZoneToDelete(null);
  };

  // Restore zone and its defects
  const handleRestoreZone = (zone: DamageZoneData) => {
    const zCode = zone.zoneCode || zone.zone_code || 'Z-??';
    if (hasFloors) {
      const updatedFloors = rawFloors.map((fl: FloorSurveyData, fi: number) => {
        if (fi !== activeFloorIndex && fl.id !== currentFloor.id) return fl;
        const zones = (fl.zones || []).map((z: DamageZoneData) => {
          if (z.id !== zone.id && z.zoneCode !== zCode) return z;
          const defects = (z.defects || []).map((d: DefectItem) => ({ ...d, is_deleted: false }));
          return { ...z, is_deleted: false, defects };
        });
        return { ...fl, zones };
      });
      handleFieldChange('floors', `Khôi phục Vùng ${zCode} và các khuyết tật con`, updatedFloors);
    } else {
      const updatedZones = rawDamageZones.map((z: DamageZoneData) => {
        if (z.id !== zone.id && z.zoneCode !== zCode) return z;
        const defects = (z.defects || []).map((d: DefectItem) => ({ ...d, is_deleted: false }));
        return { ...z, is_deleted: false, defects };
      });
      handleFieldChange('damageZones', `Khôi phục Vùng ${zCode} và các khuyết tật con`, updatedZones);
    }
  };

  // Soft-remove structural element
  const handleRemoveElement = (elemId: string) => {
    if (hasFloors) {
      const updatedFloors = rawFloors.map((fl: FloorSurveyData, fi: number) => {
        if (fi !== activeFloorIndex && fl.id !== currentFloor.id) return fl;
        const structuralElements = (fl.structuralElements || []).map((e: StructuralElementData) => {
          if (e.id !== elemId && e.elementCode !== elemId) return e;
          const defects = (e.defects || []).map((d: any) => ({ ...d, is_deleted: true }));
          return { ...e, is_deleted: true, defects };
        });
        return { ...fl, structuralElements };
      });
      handleFieldChange('floors', `Xóa mềm cấu kiện E ${elemId}`, updatedFloors);
    }
  };

  // Restore structural element
  const handleRestoreElement = (elemId: string) => {
    if (hasFloors) {
      const updatedFloors = rawFloors.map((fl: FloorSurveyData, fi: number) => {
        if (fi !== activeFloorIndex && fl.id !== currentFloor.id) return fl;
        const structuralElements = (fl.structuralElements || []).map((e: StructuralElementData) => {
          if (e.id !== elemId && e.elementCode !== elemId) return e;
          const defects = (e.defects || []).map((d: any) => ({ ...d, is_deleted: false }));
          return { ...e, is_deleted: false, defects };
        });
        return { ...fl, structuralElements };
      });
      handleFieldChange('floors', `Khôi phục cấu kiện E ${elemId}`, updatedFloors);
    }
  };

  // Handle changing element fields
  const handleElementFieldChange = (elemId: string, field: string, val: unknown, fieldLabel: string) => {
    if (hasFloors) {
      const updatedFloors = rawFloors.map((fl: FloorSurveyData, fi: number) => {
        if (fi !== activeFloorIndex && fl.id !== currentFloor.id) return fl;
        const structuralElements = (fl.structuralElements || []).map((e: StructuralElementData) => {
          if (e.id !== elemId && e.elementCode !== elemId) return e;
          return { ...e, [field]: val };
        });
        return { ...fl, structuralElements };
      });
      handleFieldChange('floors', `Cấu kiện E (${fieldLabel})`, updatedFloors);
    }
  };

  // Handle changing defect properties in structural elements
  const handleElementDefectChange = (elemId: string, defectId: string, field: string, val: unknown, fieldLabel: string) => {
    if (hasFloors) {
      const updatedFloors = rawFloors.map((fl: FloorSurveyData, fi: number) => {
        if (fi !== activeFloorIndex && fl.id !== currentFloor.id) return fl;
        const structuralElements = (fl.structuralElements || []).map((e: StructuralElementData) => {
          if (e.id !== elemId && e.elementCode !== elemId) return e;
          const defects = (e.defects || []).map((d: DefectItem) => {
            if (d.id !== defectId && d.defectCode !== defectId) return d;
            return { ...d, [field]: val };
          });
          return { ...e, defects };
        });
        return { ...fl, structuralElements };
      });
      handleFieldChange('floors', `Khuyết tật cấu kiện E (${fieldLabel})`, updatedFloors);
    }
  };

  // Total counts for header
  const totalZonesCount = hasFloors
    ? rawFloors.reduce((sum, f) => sum + (f.zones?.length || 0), 0)
    : rawDamageZones.length;

  const totalDefectsCount = hasFloors
    ? rawFloors.reduce(
        (sum, f) =>
          sum +
          (f.zones || []).reduce((zSum: number, z: DamageZoneData) => zSum + (z.defects?.length || 0), 0) +
          (f.structuralElements || []).reduce((eSum: number, e: StructuralElementData) => eSum + (e.defects?.length || 0), 0),
        0
      )
    : rawDamageZones.reduce((sum, z) => sum + (z.defects?.length || 0), 0);

  return (
    <section id="step-4" className="scroll-mt-6 bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
      {/* Header */}
      <div className="p-4 sm:p-5 bg-slate-50/80 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className="px-2 py-0.5 rounded-lg bg-sky-600 text-white font-mono font-black text-xs">
            Bước 04
          </span>
          <div>
            <h3 className="text-sm sm:text-base font-black text-slate-800">
              Hiện Trạng Tầng, Vùng Z & Cấu Kiện Kết Cấu E
            </h3>
            <p className="text-[11px] text-slate-500">
              Sơ đồ bố trí mặt bằng CAD, toạ độ điểm ghim, khuyết tật mảng tường Vùng Z và cấu kiện chịu lực Cột/Dầm/Sàn E
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="info" size="sm">
            {floorsList.length} Tầng &bull; {totalZonesCount} Vùng Z &bull; {totalDefectsCount} Khuyết tật D
          </Badge>
        </div>
      </div>

      <div className="p-5 space-y-6">
        {/* Thanh chuyển Tầng (Floor Tabs) */}
        {hasFloors && floorsList.length > 1 && (
          <div className="flex items-center gap-2 overflow-x-auto pb-2 border-b border-slate-100 scrollbar-thin">
            {floorsList.map((fl, idx) => {
              const isActive = idx === activeFloorIndex;
              const fZones = fl.zones?.length || 0;
              const fDefects = (fl.zones || []).reduce((sum: number, z: DamageZoneData) => sum + (z.defects?.length || 0), 0);
              return (
                <button
                  key={fl.id || idx}
                  type="button"
                  onClick={() => {
                    setActiveFloorIndex(idx);
                    setCadViewMode('ARCH');
                  }}
                  className={`px-3.5 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-2 whitespace-nowrap cursor-pointer ${
                    isActive
                      ? 'bg-slate-900 text-white shadow-sm ring-2 ring-slate-900/20'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900'
                  }`}
                >
                  <Layers className={`w-3.5 h-3.5 ${isActive ? 'text-sky-400' : 'text-slate-400'}`} />
                  <span>{fl.floorName || `Tầng ${idx + 1}`}</span>
                  <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-mono ${isActive ? 'bg-white/20 text-white' : 'bg-slate-200 text-slate-600'}`}>
                    {fZones}Z &bull; {fDefects}D
                  </span>
                </button>
              );
            })}
          </div>
        )}

        {/* Khối Sơ đồ Mặt bằng CAD của Tầng hiện tại */}
        <div className="border border-slate-200 rounded-2xl p-4 bg-slate-50/50 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-slate-200">
            <div className="flex items-center gap-2">
              <Compass className="w-4 h-4 text-sky-600" />
              <span className="text-xs font-black text-slate-800 uppercase tracking-wide">
                4.1. Sơ Đồ Bố Trí Mặt Bằng Tầng CAD ({currentFloor.floorName || 'Tầng hiện tại'})
              </span>
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-sky-100 text-sky-800 font-bold">
                {currentCadPins.length} Điểm Ghim {cadViewMode === 'ARCH' ? 'Vùng Z' : 'Cấu kiện E'}
              </span>
            </div>

            {/* Toggle chế độ CAD Kiến trúc / CAD Kết cấu & Toggle Ẩn/Hiện Ghim */}
            <div className="flex items-center gap-2">
              {currentFloor.cadStructuralSketchPhotoUrl && (
                <div className="flex items-center bg-slate-200 p-0.5 rounded-lg text-[10px] font-bold">
                  <button
                    type="button"
                    onClick={() => setCadViewMode('ARCH')}
                    className={`px-2 py-1 rounded-md transition-all ${
                      cadViewMode === 'ARCH' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    CAD_01 Kiến Trúc (Z)
                  </button>
                  <button
                    type="button"
                    onClick={() => setCadViewMode('STRUCT')}
                    className={`px-2 py-1 rounded-md transition-all ${
                      cadViewMode === 'STRUCT' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    CAD_02 Kết Cấu (E)
                  </button>
                </div>
              )}

              <button
                type="button"
                onClick={() => setShowCadPins(!showCadPins)}
                className="px-2.5 py-1 rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-100 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                title={showCadPins ? 'Ẩn ghim trên bản vẽ' : 'Hiện ghim trên bản vẽ'}
              >
                {showCadPins ? <Eye className="w-3.5 h-3.5 text-slate-500" /> : <EyeOff className="w-3.5 h-3.5 text-amber-600" />}
                <span>{showCadPins ? 'Ẩn Ghim' : 'Hiện Ghim'}</span>
              </button>

              {/* Nút + Ghim Z hoặc + Ghim E khi đang ở chế độ thẩm định */}
              {isEditMode && (
                <button
                  type="button"
                  onClick={() => {
                    const targetMode = cadViewMode === 'ARCH' ? 'Z' : 'E';
                    setCadPinningMode(cadPinningMode === targetMode ? null : targetMode);
                  }}
                  className={`px-2.5 py-1 rounded-lg border text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-xs ${
                    cadPinningMode !== null
                      ? 'bg-amber-600 text-white border-amber-700 animate-pulse'
                      : cadViewMode === 'ARCH'
                      ? 'bg-emerald-50 text-emerald-800 border-emerald-300 hover:bg-emerald-100'
                      : 'bg-amber-50 text-amber-800 border-amber-300 hover:bg-amber-100'
                  }`}
                  title={`Cắm điểm ghim ${cadViewMode === 'ARCH' ? 'Vùng Z' : 'Cấu kiện E'} mới trên bản vẽ CAD`}
                >
                  <Crosshair className="w-3.5 h-3.5" />
                  <span>{cadPinningMode !== null ? 'Đang ghim...' : `+ Ghim ${cadViewMode === 'ARCH' ? 'Z' : 'E'}`}</span>
                </button>
              )}

              {/* Trạng thái Optimistic CAD nếu có */}
              {(() => {
                const stagedCad = getStagedAction({
                  category: 'CAD_FLOOR',
                  targetPhotoId: currentFloor.id || String((currentFloor as any).floorNumber || (activeFloorIndex + 1)),
                });
                if (!stagedCad) return null;
                return (
                  <div className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-amber-100 text-amber-900 border border-amber-300 text-[10px] font-bold">
                    <span>{stagedCad.action === 'REPLACE' ? 'Đã đổi CAD • Chờ lưu' : 'Đã thêm CAD • Chờ lưu'}</span>
                    {onUndoPhotoAction && (
                      <button
                        type="button"
                        onClick={() => onUndoPhotoAction(stagedCad)}
                        className="ml-1 underline text-amber-700 hover:text-amber-900 cursor-pointer font-bold"
                      >
                        (Hoàn tác)
                      </button>
                    )}
                  </div>
                );
              })()}

              {(() => {
                const stagedCad = getStagedAction({
                  category: 'CAD_FLOOR',
                  targetPhotoId: currentFloor.id || String((currentFloor as any).floorNumber || (activeFloorIndex + 1)),
                });
                const effectiveCad = stagedCad?.newPhotoUrl || cadPhotoUrl;

                return (
                  <>
                    {effectiveCad && (
                      <button
                        type="button"
                        onClick={() =>
                          onOpenPhotoZoom(
                            effectiveCad,
                            `Sơ đồ CAD ${currentFloor.floorName || ''} - ${cadViewMode === 'ARCH' ? 'Kiến trúc Vùng Z' : 'Kết cấu Vùng E'}`,
                            `CAD_${cadViewMode}_${currentFloor.floorName || ''}`
                          )
                        }
                        className="px-2.5 py-1 rounded-lg bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold flex items-center gap-1 transition-colors shadow-xs cursor-pointer"
                      >
                        <Maximize2 className="w-3.5 h-3.5" />
                        <span>Phóng To CAD</span>
                      </button>
                    )}

                    {isEditMode && effectiveCad && (
                      <button
                        type="button"
                        onClick={() => {
                          if (onOpenPhotoAction) {
                            onOpenPhotoAction({
                              initialMode: 'REPLACE',
                              category: 'CAD_FLOOR',
                              targetPhotoType: 'CAD',
                              targetPhotoId: currentFloor.id || String((currentFloor as any).floorNumber || (activeFloorIndex + 1)),
                              photoIndex: (currentFloor as any).floorNumber || (activeFloorIndex + 1),
                              currentPhotoUrl: effectiveCad,
                              floorCode: currentFloor.floorName,
                              photoTitle: `Bản vẽ CAD ${currentFloor.floorName || ''}`,
                            });
                          } else if (onOpenPhotoReplace) {
                            onOpenPhotoReplace({
                              targetPhotoType: 'FLOOR_CAD',
                              targetPhotoId: currentFloor.id || String((currentFloor as any).floorNumber || (activeFloorIndex + 1)),
                              photoIndex: (currentFloor as any).floorNumber || (activeFloorIndex + 1),
                              currentPhotoUrl: effectiveCad,
                              photoTitle: `Bản vẽ CAD ${currentFloor.floorName || ''}`,
                            });
                          }
                        }}
                        className="px-2.5 py-1 rounded-lg bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold flex items-center gap-1 transition-colors shadow-xs cursor-pointer"
                        title="Thay thế file ảnh bản vẽ CAD của tầng này chuẩn M2"
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                        <span>Thay CAD</span>
                      </button>
                    )}

                    {onOpenPhotoHistory && (
                      <button
                        type="button"
                        onClick={() => {
                          onOpenPhotoHistory({
                            photoCode: `CAD_${cadViewMode}_${currentFloor.floorName || ''}`,
                            photoType: 'CAD',
                            photoTitle: `Bản vẽ CAD ${currentFloor.floorName || ''}`,
                            currentPhotoUrl: effectiveCad || '',
                          });
                        }}
                        className="px-2.5 py-1 rounded-lg bg-violet-600 hover:bg-violet-700 text-white text-xs font-bold flex items-center gap-1 transition-colors shadow-xs cursor-pointer"
                        title="Xem lịch sử các phiên bản bản vẽ CAD của tầng này"
                      >
                        <History className="w-3.5 h-3.5" />
                        <span>Lịch sử CAD</span>
                      </button>
                    )}
                  </>
                );
              })()}
            </div>
          </div>

          {/* Banner hướng dẫn Click-to-Pin trên CAD */}
          {cadPinningMode && (
            <div className="px-3.5 py-2 rounded-xl bg-amber-500/10 border border-amber-300 text-amber-900 text-xs font-bold flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Crosshair className="w-4 h-4 text-amber-600 animate-spin" />
                <span>🎯 Chế độ ghim CAD: Bấm vào vị trí trên bản vẽ CAD bên dưới để tạo ghim {cadPinningMode === 'Z' ? 'Vùng Z' : 'Cấu kiện E'} mới</span>
              </div>
              <button
                type="button"
                onClick={() => setCadPinningMode(null)}
                className="px-2 py-0.5 rounded bg-white border border-amber-400 text-amber-800 hover:bg-amber-50 text-[11px] font-bold cursor-pointer"
              >
                Hủy
              </button>
            </div>
          )}

          {/* Vùng hiển thị ảnh CAD kèm các điểm chấm Z / E - Ôm khít ảnh để toạ độ khớp 100% */}
          {(() => {
            const stagedCad = getStagedAction({
              category: 'CAD_FLOOR',
              targetPhotoId: currentFloor.id || String((currentFloor as any).floorNumber || (activeFloorIndex + 1)),
            });
            const effectiveCad = stagedCad?.newPhotoUrl || cadPhotoUrl;

            if (!effectiveCad) {
              return (
                <div className="py-12 border-2 border-dashed border-slate-300 rounded-xl flex flex-col items-center justify-center gap-2 text-slate-400 bg-slate-50/50">
                  <Layers className="w-8 h-8 text-slate-300" />
                  <span className="text-xs italic">Chưa có ảnh bản vẽ CAD cho tầng này</span>
                  <div className="flex items-center gap-2">
                    {isEditMode && onOpenPhotoAction && (
                      <button
                        type="button"
                        onClick={() =>
                          onOpenPhotoAction({
                            initialMode: 'ADD',
                            category: 'CAD_FLOOR',
                            targetPhotoType: 'CAD',
                            targetPhotoId: currentFloor.id || String((currentFloor as any).floorNumber || (activeFloorIndex + 1)),
                            photoIndex: (currentFloor as any).floorNumber || (activeFloorIndex + 1),
                            floorCode: currentFloor.floorName,
                            photoTitle: `Thêm bản vẽ CAD ${currentFloor.floorName || ''}`,
                          })
                        }
                        className="px-3 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-700 text-white font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>+ Thêm Bản Vẽ CAD Tầng</span>
                      </button>
                    )}
                    {onOpenPhotoHistory && (
                      <button
                        type="button"
                        onClick={() => {
                          onOpenPhotoHistory({
                            photoCode: `CAD_${cadViewMode}_${currentFloor.floorName || ''}`,
                            photoType: 'CAD',
                            photoTitle: `Bản vẽ CAD ${currentFloor.floorName || ''}`,
                            currentPhotoUrl: '',
                          });
                        }}
                        className="px-3 py-1.5 rounded-lg bg-violet-600 hover:bg-violet-700 text-white font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer shadow-xs"
                        title="Xem lịch sử các phiên bản bản vẽ CAD của tầng này"
                      >
                        <History className="w-3.5 h-3.5" />
                        <span>Lịch sử CAD</span>
                      </button>
                    )}
                  </div>
                </div>
              );
            }

            return (
              <div className="relative w-full max-h-[480px] min-h-[220px] bg-slate-900 rounded-xl overflow-hidden border border-slate-300 flex items-center justify-center p-2 select-none">
                <div
                  ref={cadImageWrapperRef}
                  onClick={handleCadImageClick}
                  className={`relative inline-block max-w-full leading-none mx-auto ${
                    cadPinningMode ? 'cursor-crosshair' : ''
                  }`}
                >
                  <img
                    src={effectiveCad}
                    alt="CAD Floor Plan"
                    className="max-w-full max-h-[460px] w-auto h-auto block mx-auto pointer-events-none select-none shadow-sm"
                  />

                {/* Lớp phủ các điểm ghim Z hoặc E - Cho phép kéo điều chỉnh vị trí */}
                {showCadPins &&
                  displayedCadPins.map((pin: CadZonePin, pIdx: number) => {
                    const pX = Number(pin.pinX ?? pin.pin_x ?? 50);
                    const pY = Number(pin.pinY ?? pin.pin_y ?? 50);
                    const pCode = pin.zoneCode || pin.zone_code || `${cadViewMode === 'ARCH' ? 'Z' : 'E'}-${pIdx + 1}`;
                    const isStruct = cadViewMode === 'STRUCT' || pin.type === 'STRUCTURAL';
                    const isBeingDragged = draggingCadPin?.pinCode === pCode;
                    const displayX = isBeingDragged ? draggingCadPin.currentX : pX;
                    const displayY = isBeingDragged ? draggingCadPin.currentY : pY;

                    return (
                      <div
                        key={pin.id || `${pCode}-${pIdx}`}
                        style={{
                          position: 'absolute',
                          top: `${displayY}%`,
                          left: `${displayX}%`,
                          transform: 'translate(-50%, -100%)',
                          zIndex: isBeingDragged ? 50 : 25,
                          touchAction: 'none',
                        }}
                        className={`flex flex-col items-center pointer-events-auto select-none group ${
                          isEditMode ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer'
                        }`}
                        onPointerDown={(e) => {
                          if (!isEditMode) return;
                          e.stopPropagation();
                          (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
                          setDraggingCadPin({
                            pinCode: pCode,
                            isStruct,
                            currentX: pX,
                            currentY: pY,
                          });
                        }}
                        onPointerMove={(e) => {
                          if (!draggingCadPin || draggingCadPin.pinCode !== pCode) return;
                          e.stopPropagation();
                          const container = cadImageWrapperRef.current;
                          if (!container) return;
                          const rect = container.getBoundingClientRect();
                          const rawX = ((e.clientX - rect.left) / rect.width) * 100;
                          const rawY = ((e.clientY - rect.top) / rect.height) * 100;
                          const clampedX = Math.round(Math.max(1, Math.min(99, rawX)) * 10) / 10;
                          const clampedY = Math.round(Math.max(1, Math.min(99, rawY)) * 10) / 10;
                          setDraggingCadPin((prev) => (prev ? { ...prev, currentX: clampedX, currentY: clampedY } : null));
                        }}
                        onPointerUp={(e) => {
                          if (!draggingCadPin || draggingCadPin.pinCode !== pCode) return;
                          e.stopPropagation();
                          try {
                            (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
                          } catch {}
                          const finalX = draggingCadPin.currentX;
                          const finalY = draggingCadPin.currentY;
                          setDraggingCadPin(null);
                          if (Math.abs(finalX - pX) > 0.3 || Math.abs(finalY - pY) > 0.3) {
                            handleCommitCadPinCoord(pCode, isStruct, finalX, finalY);
                          } else {
                            // Bấm không kéo -> Cuộn đến thẻ vùng / cấu kiện tương ứng
                            const targetElem = document.getElementById(isStruct ? `element-card-${pCode}` : `zone-card-${pCode}`);
                            if (targetElem) {
                              targetElem.scrollIntoView({ behavior: 'smooth', block: 'center' });
                              targetElem.classList.add('ring-4', 'ring-sky-400');
                              setTimeout(() => targetElem.classList.remove('ring-4', 'ring-sky-400'), 2000);
                            }
                          }
                        }}
                        onClick={(e) => {
                          if (isEditMode) return;
                          e.stopPropagation();
                          const targetElem = document.getElementById(isStruct ? `element-card-${pCode}` : `zone-card-${pCode}`);
                          if (targetElem) {
                            targetElem.scrollIntoView({ behavior: 'smooth', block: 'center' });
                            targetElem.classList.add('ring-4', 'ring-sky-400');
                            setTimeout(() => targetElem.classList.remove('ring-4', 'ring-sky-400'), 2000);
                          }
                        }}
                      >
                        <div
                          className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-black shadow-lg transition-transform ${
                            isBeingDragged
                              ? 'scale-125 ring-2 ring-amber-400 bg-amber-700 text-white'
                              : isStruct
                              ? 'bg-amber-600 text-white group-hover:scale-110'
                              : 'bg-emerald-600 text-white group-hover:scale-110'
                          }`}
                          title={isEditMode ? `Kéo để đổi vị trí ghim ${pCode}` : `Bấm xem ${pCode}`}
                        >
                          {pCode}
                          {isBeingDragged && (
                            <span className="ml-1 text-[8px] font-normal opacity-90">
                              ({displayX.toFixed(0)}%, {displayY.toFixed(0)}%)
                            </span>
                          )}
                        </div>
                        <div
                          className={`w-2.5 h-2.5 rounded-full border-2 border-white shadow-md -mt-0.5 ${
                            isBeingDragged
                              ? 'bg-amber-300 scale-125 ring-2 ring-amber-500'
                              : isStruct
                              ? 'bg-amber-400'
                              : 'bg-emerald-400'
                          }`}
                        />
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })()}
        </div>

        {/* Khối Danh sách các Vùng Kiến Trúc Z của Tầng */}
        <div className="space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100 flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-emerald-600" />
              <span className="text-xs font-black text-slate-800 uppercase tracking-wide">
                4.2. Chi Tiết Các Vùng Kiến Trúc Z ({activeZones.length} Vùng{deletedZones.length > 0 ? ` • ${deletedZones.length} đã xóa` : ''})
              </span>
            </div>
            <div className="flex items-center gap-2.5">
              {(deletedZones.length > 0 || deletedElements.length > 0) && (
                <button
                  type="button"
                  onClick={() => setShowDeletedItems(!showDeletedItems)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all shadow-xs cursor-pointer ${
                    showDeletedItems
                      ? 'bg-rose-100 text-rose-800 border border-rose-300'
                      : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-300'
                  }`}
                >
                  {showDeletedItems ? <EyeOff className="w-3.5 h-3.5 text-rose-700" /> : <Eye className="w-3.5 h-3.5 text-slate-500" />}
                  <span>{showDeletedItems ? 'Ẩn mục đã xóa' : `Hiện ${deletedZones.length + deletedElements.length} mục đã xóa`}</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => setShowCtxPins(!showCtxPins)}
                className="text-xs font-bold text-slate-600 hover:text-slate-900 flex items-center gap-1 cursor-pointer"
              >
                {showCtxPins ? <Eye className="w-3.5 h-3.5 text-slate-500" /> : <EyeOff className="w-3.5 h-3.5 text-amber-600" />}
                <span>{showCtxPins ? 'Ẩn ghim D trên ảnh CTX' : 'Hiện ghim D trên ảnh CTX'}</span>
              </button>
            </div>
          </div>

          {displayedZones.length === 0 ? (
            <div className="p-8 text-center bg-slate-50 rounded-2xl border border-slate-200 text-slate-400">
              <Layers className="w-8 h-8 mx-auto text-slate-300 mb-2" />
              <span className="font-semibold text-xs">Tầng này không có Vùng Kiến Trúc Z nào</span>
            </div>
          ) : (
            displayedZones.map((z: DamageZoneData) => {
              const zCode = z.zoneCode || z.zone_code || 'Z-??';
              const isZoneDeleted = Boolean(z.is_deleted || (z as any).isDeleted);
              const rawDefectsList: DefectItem[] = Array.isArray(z.defects)
                ? z.defects
                : typeof z.defects === 'string'
                ? JSON.parse(z.defects)
                : [];
              const activeDefectsList = rawDefectsList.filter((d) => !d.is_deleted && !(d as any).isDeleted);
              const defectsList = showDeletedItems ? rawDefectsList : activeDefectsList;

              const stagedCtx = getStagedAction({
                category: 'ZONE_CTX',
                targetPhotoId: zCode,
              });
              const isCtxDeleted = stagedCtx?.action === 'DELETE';
              const isCtxReplaced = stagedCtx?.action === 'REPLACE' || stagedCtx?.action === 'ADD';
              const ctxUrl = stagedCtx ? (isCtxDeleted ? '' : stagedCtx.newPhotoUrl || stagedCtx.oldPhotoUrl) : (z.ctxPhotoUrl || z.ctx_photo_url || '');
              const ctxCode = z.ctxPhotoCode || z.ctx_photo_code || `${zCode}_CTX`;

              return (
                <div
                  key={z.id || zCode}
                  id={`zone-card-${zCode}`}
                  className={`rounded-2xl p-4 space-y-4 transition-all ${
                    isZoneDeleted
                      ? 'border-2 border-dashed border-rose-300 bg-rose-50/30 opacity-80'
                      : 'border border-slate-200 bg-slate-50/40'
                  }`}
                >
                  {/* Header Vùng Z */}
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-200">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="px-2 py-0.5 rounded-md bg-slate-800 text-white font-mono font-black text-xs">
                          {zCode}
                        </span>
                        {isEditMode ? (
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <input
                              type="text"
                              value={z.floorName || currentFloor.floorName || ''}
                              onChange={(e) => handleZoneFieldChange(z.id, 'floorName', e.target.value, 'Tên tầng')}
                              placeholder="Tên tầng (VD: Tầng trệt)"
                              className="p-1 text-xs border border-amber-300 bg-amber-50/50 rounded font-bold w-28"
                            />
                            <span>&bull;</span>
                            <input
                              type="text"
                              list={`room-presets-${z.id}`}
                              value={z.roomName || ''}
                              onChange={(e) => handleZoneFieldChange(z.id, 'roomName', e.target.value, 'Tên phòng/không gian')}
                              placeholder="Phòng (VD: Phòng khách)"
                              className="p-1 text-xs border border-amber-300 bg-amber-50/50 rounded font-bold w-36"
                            />
                            <datalist id={`room-presets-${z.id}`}>
                              {ROOM_PRESETS.map((r) => (
                                <option key={r} value={r} />
                              ))}
                            </datalist>
                          </div>
                        ) : (
                          <span className="text-xs font-bold text-slate-800">
                            {z.floorName || z.floor_name || currentFloor.floorName || 'Tầng trệt'} &bull;{' '}
                            {z.roomName || z.room_name || 'Không gian chính'}
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-500 mt-1 flex items-center gap-2 flex-wrap">
                        {isEditMode ? (
                          <>
                            <label className="font-semibold text-slate-600">Cấu kiện:</label>
                            <select
                              value={z.componentType || 'Tường ngăn'}
                              onChange={(e) => handleZoneFieldChange(z.id, 'componentType', e.target.value, 'Loại cấu kiện')}
                              className="p-1 text-xs border border-slate-300 rounded bg-white font-bold"
                            >
                              {COMPONENT_TYPE_PRESETS.map((ct) => (
                                <option key={ct} value={ct}>{ct}</option>
                              ))}
                            </select>

                            <label className="font-semibold text-slate-600">Vật liệu:</label>
                            <select
                              value={z.wallMaterial || 'Gạch ống (2 lỗ / 4 lỗ)'}
                              onChange={(e) => handleZoneFieldChange(z.id, 'wallMaterial', e.target.value, 'Vật liệu tường')}
                              className="p-1 text-xs border border-slate-300 rounded bg-white font-bold"
                            >
                              {WALL_MATERIAL_PRESETS.map((wm) => (
                                <option key={wm} value={wm}>{wm}</option>
                              ))}
                            </select>
                          </>
                        ) : (
                          <>
                            Cấu kiện: <strong>{z.componentType || z.component_type || 'Tường ngăn'}</strong> &bull; Vật liệu:{' '}
                            {z.wallMaterial || z.wall_material || 'Gạch ống'}
                          </>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {isZoneDeleted ? (
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-0.5 rounded-lg bg-rose-600 text-white font-mono font-bold text-[10px] shadow-xs animate-pulse">
                            ĐÃ XÓA MỀM
                          </span>
                          <button
                            type="button"
                            onClick={() => handleRestoreZone(z)}
                            className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-1 shadow-xs cursor-pointer transition-colors"
                            title="Khôi phục vùng này và các khuyết tật con"
                          >
                            <Undo2 className="w-3.5 h-3.5" />
                            <span>Hoàn tác</span>
                          </button>
                        </div>
                      ) : (
                        <>
                          {isEditMode ? (
                            <label className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-amber-50 border border-amber-300 text-xs font-bold text-amber-900 cursor-pointer">
                              <input
                                type="checkbox"
                                checked={Boolean(z.functionalImpactRepairNeeded)}
                                onChange={(e) => handleZoneFieldChange(z.id, 'functionalImpactRepairNeeded', e.target.checked, 'Cần sửa chữa')}
                                className="rounded text-amber-600"
                              />
                              <span>Ảnh hưởng CN / Cần sửa chữa</span>
                            </label>
                          ) : (
                            z.functionalImpactRepairNeeded && (
                              <span className="px-2 py-0.5 rounded-lg bg-amber-100 text-amber-800 border border-amber-200 text-[10px] font-bold">
                                ⚠️ Cần sửa chữa / Ảnh hưởng CN
                              </span>
                            )
                          )}
                          <Badge variant={activeDefectsList.length > 0 ? 'warning' : 'success'} size="sm">
                            {activeDefectsList.length} khuyết tật nứt
                          </Badge>
                          {isEditMode && (
                            <button
                              type="button"
                              onClick={() => handleRemoveZone(z)}
                              className="px-2 py-1 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-300 text-xs font-bold flex items-center gap-1 cursor-pointer transition-colors"
                              title={`Xóa Vùng ${zCode}`}
                            >
                              <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                              <span>Xóa Vùng</span>
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  </div>

                  {/* Ghi chú chi tiết của KSV về Vùng Z */}
                  <div className="p-2.5 bg-white rounded-xl border border-slate-200 text-xs space-y-1">
                    <span className="text-[11px] font-bold text-slate-600 block">
                      Ghi chú hiện trường Vùng {zCode}:
                    </span>
                    {isEditMode ? (
                      <input
                        type="text"
                        value={z.notes || ''}
                        onChange={(e) => handleZoneFieldChange(z.id, 'notes', e.target.value, 'Ghi chú')}
                        className="w-full p-1.5 bg-amber-50/40 border border-amber-300 rounded-lg text-xs"
                        placeholder="Ghi chú chi tiết hiện trạng mảng tường, vị trí, mức ẩm..."
                      />
                    ) : (
                      <div className="text-slate-700 italic">
                        {z.notes ? z.notes : 'Không có ghi chú thêm từ khảo sát viên.'}
                      </div>
                    )}
                  </div>

                  {/* Ảnh Tổng Quan Vùng Z (nếu có nhiều hơn 1 ảnh ngoài CTX) */}
                  {Array.isArray(z.overviewPhotos) && z.overviewPhotos.length > 0 && (
                    <div className="p-2.5 bg-white rounded-xl border border-slate-200 space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold uppercase text-slate-500 block">
                          Ảnh Tổng Quan Vùng {zCode} ({z.overviewPhotos.length} ảnh):
                        </span>
                        {isEditMode && onOpenPhotoAction && (
                          <button
                            type="button"
                            onClick={() =>
                              onOpenPhotoAction({
                                initialMode: 'ADD',
                                category: 'ZONE_CTX',
                                targetPhotoType: 'CTX',
                                targetPhotoId: zCode,
                                zoneCode: zCode,
                                floorCode: currentFloor.floorName,
                                photoTitle: `Bổ sung ảnh tổng quan Vùng ${zCode}`,
                              })
                            }
                            className="px-2 py-0.5 rounded bg-sky-600 hover:bg-sky-700 text-white font-bold text-[9px] flex items-center gap-1 transition-colors cursor-pointer shadow-2xs"
                          >
                            <Plus className="w-2.5 h-2.5" />
                            <span>Thêm Ảnh</span>
                          </button>
                        )}
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        {z.overviewPhotos.map((ovUrl: string, ovIdx: number) => {
                          const stagedOv = getStagedAction({
                            category: 'ZONE_CTX',
                            targetPhotoId: zCode,
                            photoIndex: ovIdx,
                            url: ovUrl,
                          });
                          return (
                            <AuditPhotoCard
                              key={ovIdx}
                              url={stagedOv?.newPhotoUrl || ovUrl}
                              photoCode={`#${ovIdx + 1}`}
                              title={`Ảnh tổng quan ${zCode} #${ovIdx + 1}`}
                              category="ZONE_CTX"
                              targetPhotoType="CTX"
                              targetPhotoId={zCode}
                              zoneCode={zCode}
                              floorCode={currentFloor.floorName}
                              photoIndex={ovIdx}
                              isEditMode={isEditMode}
                              aspectRatio="aspect-4/3"
                              badgeColor="slate"
                              historyCount={(z as any)?.historyCount}
                              hasHistory={(z as any)?.hasHistory}
                              optimisticStatus={stagedOv ? (stagedOv.action === 'DELETE' ? 'DELETED' : 'REPLACED') : undefined}
                              onUndoDelete={stagedOv ? () => onUndoPhotoAction?.(stagedOv) : undefined}
                              onOpenPhotoZoom={onOpenPhotoZoom}
                              onOpenPhotoAction={onOpenPhotoAction}
                              onOpenPhotoHistory={onOpenPhotoHistory}
                            />
                          );
                        })}

                        {/* Các ảnh tổng quan mới thêm (Optimistic ADD) cho Vùng Z */}
                        {stagedPhotoActions
                          ?.filter((a) => a.action === 'ADD' && a.category === 'ZONE_CTX' && a.targetPhotoId === zCode)
                          .flatMap((a) => a.newPhotoUrls || (a.newPhotoUrl ? [a.newPhotoUrl] : []))
                          .map((addedUrl, addIdx) => (
                            <AuditPhotoCard
                              key={`added-zone-ov-${addIdx}`}
                              url={addedUrl}
                              photoCode={`Mới`}
                              title={`Ảnh tổng quan mới (${zCode})`}
                              category="ZONE_CTX"
                              targetPhotoType="CTX"
                              targetPhotoId={zCode}
                              zoneCode={zCode}
                              floorCode={currentFloor.floorName}
                              isEditMode={isEditMode}
                              aspectRatio="aspect-4/3"
                              badgeColor="emerald"
                              optimisticStatus="ADDED"
                              onOpenPhotoZoom={onOpenPhotoZoom}
                              onOpenPhotoAction={onOpenPhotoAction}
                              onOpenPhotoHistory={onOpenPhotoHistory}
                            />
                          ))}
                      </div>
                    </div>
                  )}

                  {/* Ảnh Ngữ Cảnh CTX (với Ghim Vết Nứt D) & Danh sách Khuyết Tật D */}
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    {/* Cột 1: Ảnh Ngữ Cảnh CTX kèm điểm chấm D-xx */}
                    <div className="border border-slate-200 rounded-xl p-3 bg-white flex flex-col">
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-[11px] font-bold text-slate-700">
                          Ảnh Bối Cảnh ({ctxCode})
                        </span>
                        <div className="flex items-center gap-1.5">
                          {isEditMode && ctxUrl && (
                            <button
                              type="button"
                              onClick={() => setPinningCtxZone(pinningCtxZone === zCode ? null : zCode)}
                              className={`px-2 py-0.5 rounded text-[10px] font-bold flex items-center gap-1 transition-all cursor-pointer ${
                                pinningCtxZone === zCode
                                  ? 'bg-rose-600 text-white animate-pulse'
                                  : 'bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200'
                              }`}
                              title="Bấm để bật chế độ ghim khuyết tật D lên ảnh CTX"
                            >
                              <Crosshair className="w-3 h-3" />
                              <span>{pinningCtxZone === zCode ? 'Đang ghim...' : '+ Ghim D'}</span>
                            </button>
                          )}
                          <span className="text-[10px] text-slate-400 font-mono">
                            {defectsList.length} điểm nứt D
                          </span>
                        </div>
                      </div>

                      <div
                        className={`flex-1 min-h-[180px] rounded-lg bg-black/5 relative overflow-hidden flex items-center justify-center group transition-all ${
                          pinningCtxZone === zCode ? 'cursor-crosshair ring-2 ring-rose-400' : 'cursor-pointer'
                        } ${
                          isCtxDeleted
                            ? 'border-2 border-rose-500 opacity-60'
                            : isCtxReplaced
                            ? 'border-2 border-amber-400 ring-2 ring-amber-400/40 shadow-md'
                            : 'border border-slate-200'
                        }`}
                        onClick={(e) => {
                          if (hasJustDraggedRef.current) {
                            hasJustDraggedRef.current = false;
                            return;
                          }
                          if (pinningCtxZone === zCode) {
                            handleCtxImageClick(e, z);
                          } else if (ctxUrl) {
                            const zoomTitle = isCtxReplaced
                              ? `${zCode} - Ảnh Bối Cảnh Mảng Tường (Chờ lưu Diff)`
                              : `${zCode} - Ảnh Bối Cảnh Mảng Tường`;
                            onOpenPhotoZoom(ctxUrl, zoomTitle, ctxCode);
                          }
                        }}
                      >
                        {/* Optimistic Pending Badge for CTX */}
                        {stagedCtx && isCtxReplaced && (
                          <div className="absolute top-2 left-2 z-30 flex items-center gap-1 px-2 py-0.5 rounded bg-amber-500 text-white font-bold text-[10px] shadow-sm animate-pulse">
                            <span>⚡ Chờ lưu Diff ({stagedCtx.action === 'REPLACE' ? 'Đã đổi ảnh' : 'Đã thêm ảnh'})</span>
                            {onUndoPhotoAction && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onUndoPhotoAction(stagedCtx);
                                }}
                                className="underline cursor-pointer hover:text-amber-100 flex items-center gap-0.5 ml-1"
                                title="Hoàn tác thay đổi"
                              >
                                <Undo2 className="w-2.5 h-2.5" /> Hoàn tác
                              </button>
                            )}
                          </div>
                        )}

                        {/* Optimistic Deleted Overlay for CTX */}
                        {stagedCtx && isCtxDeleted && (
                          <div
                            onClick={(e) => e.stopPropagation()}
                            className="absolute inset-0 bg-rose-950/75 backdrop-blur-[2px] flex flex-col items-center justify-center gap-1.5 p-2 z-30"
                          >
                            <span className="px-2 py-0.5 rounded bg-rose-600 text-white font-bold text-[10px] shadow-sm animate-pulse">
                              Đã đánh dấu Xóa ảnh CTX • Chờ lưu
                            </span>
                            {onUndoPhotoAction && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onUndoPhotoAction(stagedCtx);
                                }}
                                className="px-2.5 py-1 bg-white hover:bg-slate-100 text-rose-800 rounded-lg text-[10px] font-black shadow-md flex items-center gap-1 cursor-pointer"
                              >
                                <Undo2 className="w-3 h-3 text-rose-600" />
                                <span>Hoàn tác (Undo)</span>
                              </button>
                            )}
                          </div>
                        )}

                        {/* Banner hướng dẫn khi đang ở chế độ ghim D */}
                        {pinningCtxZone === zCode && (
                          <div className="absolute top-2 left-2 right-2 z-30 px-2 py-1 rounded-lg bg-rose-600/90 text-white text-[11px] font-bold flex items-center justify-between shadow-md animate-pulse">
                            <span>🎯 Bấm vào ảnh CTX để đặt ghim D</span>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setPinningCtxZone(null);
                              }}
                              className="px-1.5 py-0.2 bg-white text-rose-800 rounded text-[10px] font-bold cursor-pointer"
                            >
                              Hủy
                            </button>
                          </div>
                        )}

                        {ctxUrl ? (
                          <>
                            <img
                              src={ctxUrl}
                              alt="CTX"
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                            />
                            {/* Overlay điểm ghim khuyết tật D dạng mũi kim trắc địa trên ảnh CTX - Cho phép kéo đổi vị trí */}
                            {showCtxPins &&
                              defectsList.map((d: DefectItem, dIdx: number) => {
                                const pX = Number(d.pinX ?? d.pin_x ?? 50);
                                const pY = Number(d.pinY ?? d.pin_y ?? 50);
                                const dCode = d.defectCode || d.defect_code || `D-${dIdx + 1}`;
                                const defectKey = d.id || dCode;
                                const isHighlighted = highlightedDefectId === defectKey;
                                const isBeingDragged = draggingDefectPin?.defectId === defectKey;
                                const displayX = isBeingDragged ? draggingDefectPin.currentX : pX;
                                const displayY = isBeingDragged ? draggingDefectPin.currentY : pY;

                                return (
                                  <div
                                    key={defectKey}
                                    style={{
                                      position: 'absolute',
                                      top: `${displayY}%`,
                                      left: `${displayX}%`,
                                      transform: 'translate(-50%, -100%)',
                                      zIndex: isBeingDragged ? 50 : isHighlighted ? 40 : 25,
                                      touchAction: 'none',
                                    }}
                                    className={`flex flex-col items-center select-none group/pin ${
                                      isEditMode ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer'
                                    }`}
                                    onPointerDown={(e) => {
                                      if (!isEditMode) return;
                                      e.stopPropagation();
                                      hasJustDraggedRef.current = false;
                                      pointerStartPosRef.current = { x: e.clientX, y: e.clientY };
                                      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
                                      setDraggingDefectPin({
                                        zoneId: z.id,
                                        defectId: defectKey,
                                        dCode,
                                        currentX: pX,
                                        currentY: pY,
                                      });
                                    }}
                                    onPointerMove={(e) => {
                                      if (!draggingDefectPin || draggingDefectPin.defectId !== defectKey) return;
                                      e.stopPropagation();
                                      if (pointerStartPosRef.current) {
                                        const dist = Math.hypot(e.clientX - pointerStartPosRef.current.x, e.clientY - pointerStartPosRef.current.y);
                                        if (dist > 5) {
                                          hasJustDraggedRef.current = true;
                                        }
                                      }
                                      const container = e.currentTarget.parentElement;
                                      if (!container) return;
                                      const rect = container.getBoundingClientRect();
                                      const rawX = ((e.clientX - rect.left) / rect.width) * 100;
                                      const rawY = ((e.clientY - rect.top) / rect.height) * 100;
                                      const clampedX = Math.round(Math.max(1, Math.min(99, rawX)) * 10) / 10;
                                      const clampedY = Math.round(Math.max(1, Math.min(99, rawY)) * 10) / 10;
                                      setDraggingDefectPin((prev) => (prev ? { ...prev, currentX: clampedX, currentY: clampedY } : null));
                                    }}
                                    onPointerUp={(e) => {
                                      if (!draggingDefectPin || draggingDefectPin.defectId !== defectKey) return;
                                      e.stopPropagation();
                                      try {
                                        (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
                                      } catch {}
                                      const finalX = draggingDefectPin.currentX;
                                      const finalY = draggingDefectPin.currentY;
                                      setDraggingDefectPin(null);
                                      pointerStartPosRef.current = null;
                                      setTimeout(() => {
                                        hasJustDraggedRef.current = false;
                                      }, 300);
                                      if (Math.abs(finalX - pX) > 0.3 || Math.abs(finalY - pY) > 0.3) {
                                        handleCommitDefectPinCoord(z.id, defectKey, dCode, finalX, finalY);
                                      } else {
                                        // Bấm không kéo: Highlight và cuộn tới thẻ khuyết tật
                                        setHighlightedDefectId(defectKey);
                                        const container = document.getElementById('audit-studio-scroll-container');
                                        const targetEl = document.getElementById(`defect-card-${defectKey}`);
                                        if (container && targetEl) {
                                          const containerRect = container.getBoundingClientRect();
                                          const targetRect = targetEl.getBoundingClientRect();
                                          const offsetTop = targetRect.top - containerRect.top + container.scrollTop - 20;
                                          container.scrollTo({ top: offsetTop, behavior: 'smooth' });
                                        } else if (targetEl) {
                                          targetEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                        }
                                        setTimeout(() => {
                                          setHighlightedDefectId((curr) => (curr === defectKey ? null : curr));
                                        }, 3500);
                                      }
                                    }}
                                    onClick={(e) => {
                                      if (isEditMode) return;
                                      e.stopPropagation();
                                      setHighlightedDefectId(defectKey);
                                      const container = document.getElementById('audit-studio-scroll-container');
                                      const targetEl = document.getElementById(`defect-card-${defectKey}`);
                                      if (container && targetEl) {
                                        const containerRect = container.getBoundingClientRect();
                                        const targetRect = targetEl.getBoundingClientRect();
                                        const offsetTop = targetRect.top - containerRect.top + container.scrollTop - 20;
                                        container.scrollTo({ top: offsetTop, behavior: 'smooth' });
                                      } else if (targetEl) {
                                        targetEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                      }
                                      setTimeout(() => {
                                        setHighlightedDefectId((curr) => (curr === defectKey ? null : curr));
                                      }, 3500);
                                    }}
                                    title={isEditMode ? `Kéo để đổi vị trí ghim ${dCode}` : `Bấm để cuộn và xem chi tiết khuyết tật ${dCode}`}
                                  >
                                    {/* Thẻ nhãn mã đỏ viền trắng nổi cao phía trên */}
                                    <div
                                      className={`px-1.5 py-0.5 rounded font-mono font-black text-[9px] shadow-md border border-white flex items-center justify-center whitespace-nowrap transition-all ${
                                        isBeingDragged
                                          ? 'bg-amber-600 text-white ring-2 ring-amber-300 scale-125'
                                          : isHighlighted
                                          ? 'bg-rose-700 text-white ring-2 ring-amber-300 scale-115'
                                          : 'bg-rose-600 text-white group-hover/pin:scale-110 group-hover/pin:bg-rose-700'
                                      }`}
                                    >
                                      {dCode}
                                      {isBeingDragged && (
                                        <span className="ml-0.5 text-[7px] font-normal opacity-90">
                                          ({displayX.toFixed(0)}%, {displayY.toFixed(0)}%)
                                        </span>
                                      )}
                                    </div>

                                    {/* Mũi kim tam giác nhọn chĩa thẳng xuống tọa độ */}
                                    <div className={`w-0 h-0 border-l-[3.5px] border-l-transparent border-r-[3.5px] border-r-transparent border-t-[5px] -mt-[0.5px] ${
                                      isBeingDragged ? 'border-t-amber-600' : 'border-t-rose-600'
                                    }`} />

                                    {/* Chấm tâm ngắm đỏ rực tại đúng tọa độ (x, y) */}
                                    <div className={`w-1.5 h-1.5 rounded-full border border-white -mt-[1px] shadow-xs ${
                                      isBeingDragged ? 'bg-amber-400 ring-2 ring-amber-500' : 'bg-rose-600'
                                    }`} />
                                  </div>
                                );
                              })}
                          </>
                        ) : (
                          <div className="flex flex-col items-center justify-center p-4 border border-dashed border-slate-300 rounded-lg gap-2 text-center w-full">
                            <Camera className="w-7 h-7 text-slate-300" />
                            <span className="text-xs text-slate-400 italic">Chưa có ảnh ngữ cảnh CTX</span>
                            <div className="flex items-center gap-1.5 pt-1">
                              {isEditMode && onOpenPhotoAction && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    onOpenPhotoAction({
                                      initialMode: 'ADD',
                                      category: 'ZONE_CTX',
                                      targetPhotoType: 'CTX',
                                      targetPhotoId: zCode,
                                      zoneCode: zCode,
                                      floorCode: currentFloor.floorName,
                                      photoTitle: `Ảnh ngữ cảnh ${zCode}`,
                                    })
                                  }
                                  className="px-2.5 py-1 text-xs font-bold text-white bg-sky-600 hover:bg-sky-700 rounded-lg shadow-xs cursor-pointer flex items-center gap-1"
                                >
                                  <Plus className="w-3.5 h-3.5" />
                                  <span>Thêm ảnh CTX</span>
                                </button>
                              )}
                              {onOpenPhotoHistory && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    onOpenPhotoHistory({
                                      photoCode: ctxCode,
                                      photoType: 'CTX',
                                      photoTitle: `Ảnh ngữ cảnh ${zCode}`,
                                    })
                                  }
                                  className="p-1 rounded-lg bg-slate-100 hover:bg-violet-50 text-slate-600 hover:text-violet-700 border border-slate-200 cursor-pointer"
                                  title="Xem lịch sử ảnh CTX"
                                >
                                  <History className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          </div>
                        )}

                        {ctxUrl && (
                          <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white pointer-events-none">
                            <Maximize2 className="w-6 h-6 drop-shadow-md" />
                          </div>
                        )}
                      </div>

                      {ctxUrl && (
                        <div className="mt-2 flex items-center gap-1">
                          {isEditMode && (
                            <button
                              type="button"
                              onClick={() => {
                                if (onOpenPhotoAction) {
                                  onOpenPhotoAction({
                                    initialMode: 'REPLACE',
                                    category: 'ZONE_CTX',
                                    targetPhotoType: 'CTX',
                                    targetPhotoId: zCode,
                                    zoneCode: zCode,
                                    floorCode: currentFloor.floorName,
                                    currentPhotoUrl: ctxUrl,
                                    photoTitle: `Ảnh ngữ cảnh ${zCode}`,
                                  });
                                } else if (onOpenPhotoReplace) {
                                  onOpenPhotoReplace({
                                    targetPhotoType: 'ZONE_CTX',
                                    targetPhotoId: zCode,
                                    zoneId: z.id,
                                    currentPhotoUrl: ctxUrl,
                                    photoTitle: `Ảnh ngữ cảnh ${zCode}`,
                                  });
                                }
                              }}
                              className="flex-1 text-[10px] font-bold text-sky-600 hover:text-sky-800 bg-sky-50 py-1 rounded text-center transition-colors cursor-pointer"
                            >
                              Đổi ảnh CTX
                            </button>
                          )}
                          {onOpenPhotoHistory && (
                            <button
                              type="button"
                              onClick={() =>
                                onOpenPhotoHistory({
                                  photoCode: ctxCode,
                                  photoType: 'CTX',
                                  photoTitle: `Ảnh ngữ cảnh ${zCode}`,
                                  currentPhotoUrl: ctxUrl,
                                })
                              }
                              className="p-1 text-slate-600 hover:text-violet-700 hover:bg-violet-50 rounded text-center transition-colors cursor-pointer"
                              title="Lịch sử phiên bản ảnh CTX"
                            >
                              <History className="w-3.5 h-3.5" />
                            </button>
                          )}
                          {isEditMode && onOpenPhotoAction && (
                            <button
                              type="button"
                              onClick={() =>
                                onOpenPhotoAction({
                                  initialMode: 'DELETE',
                                  category: 'ZONE_CTX',
                                  targetPhotoType: 'CTX',
                                  targetPhotoId: zCode,
                                  zoneCode: zCode,
                                  floorCode: currentFloor.floorName,
                                  currentPhotoUrl: ctxUrl,
                                  photoTitle: `Ảnh ngữ cảnh ${zCode}`,
                                })
                              }
                              className="px-2 py-1 text-[10px] font-bold text-rose-600 hover:text-rose-800 bg-rose-50 rounded text-center transition-colors cursor-pointer"
                              title="Xóa ảnh CTX này"
                            >
                              Xóa
                            </button>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Cột 2 & 3: Danh sách các Khuyết Tật Nứt D chi tiết */}
                    <div className="md:col-span-2 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-bold text-slate-600 block">
                          Danh sách Khuyết Tật Nứt ({zCode}):
                        </span>
                        {isEditMode && (
                          <button
                            type="button"
                            onClick={() => handleAddDefect(z.id)}
                            className="px-2 py-0.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-xs font-bold transition-colors shadow-2xs cursor-pointer"
                          >
                            + Thêm Khuyết Tật D
                          </button>
                        )}
                      </div>

                      {defectsList.length === 0 ? (
                        <div className="p-4 bg-white rounded-xl border border-slate-200 text-center text-xs text-slate-400">
                          Không có khuyết tật nứt nào trong vùng kiến trúc này
                        </div>
                      ) : (
                        defectsList.map((d: DefectItem) => {
                          const dCode = d.defectCode || d.defect_code || 'D-??';
                          const isDefectDeleted = Boolean(d.is_deleted || (d as any).isDeleted);
                          const cuPhotos: string[] =
                            Array.isArray(d.cuPhotos) && d.cuPhotos.length > 0
                              ? d.cuPhotos
                              : d.cuPhotoUrl
                              ? [d.cuPhotoUrl]
                              : d.cu_photo_url
                              ? [d.cu_photo_url]
                              : [];

                          return (
                            <div
                              key={d.id || dCode}
                              id={`defect-card-${d.id || dCode}`}
                              className={`rounded-xl border p-3 shadow-2xs space-y-2.5 transition-all duration-300 ${
                                isDefectDeleted
                                  ? 'bg-rose-50/50 border-rose-300 border-dashed opacity-85'
                                  : highlightedDefectId === (d.id || dCode)
                                  ? 'bg-rose-50/70 border-rose-500 ring-4 ring-rose-300/60 shadow-md'
                                  : 'bg-white border-slate-200'
                              }`}
                            >
                              {/* Header Khuyết tật D */}
                              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-slate-100">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="px-2 py-0.5 rounded bg-red-100 text-red-800 font-mono font-black text-xs">
                                    {dCode}
                                  </span>
                                  {isDefectDeleted ? (
                                    <span className="text-xs font-bold text-slate-800">
                                      {d.screeningCategory || d.defectType || 'Vết nứt tường'}
                                    </span>
                                  ) : isEditMode ? (
                                    <div className="flex items-center gap-2">
                                      <select
                                        value={d.screeningCategory || d.defectType || 'Vết nứt tường'}
                                        onChange={(e) =>
                                          handleDefectChange(z.id, d.id || d.defectCode, 'screeningCategory', e.target.value, `${dCode} Phân loại`)
                                        }
                                        className="p-1 border border-slate-300 rounded text-xs font-bold bg-white"
                                      >
                                        {DEFECT_TYPE_PRESETS.map((dt) => (
                                          <option key={dt} value={dt}>{dt}</option>
                                        ))}
                                      </select>
                                      <label className="flex items-center gap-1 text-[11px] font-bold text-red-700 cursor-pointer">
                                        <input
                                          type="checkbox"
                                          checked={Boolean(d.isStructuralCritical)}
                                          onChange={(e) =>
                                            handleDefectChange(z.id, d.id || d.defectCode, 'isStructuralCritical', e.target.checked, `${dCode} Cờ kết cấu`)
                                          }
                                          className="rounded text-red-600"
                                        />
                                        <span>Cờ kết cấu</span>
                                      </label>
                                    </div>
                                  ) : (
                                    <>
                                      <span className="text-xs font-bold text-slate-800">
                                        {d.screeningCategory || d.defectType || 'Vết nứt tường'}
                                      </span>
                                      {d.isStructuralCritical && (
                                        <span className="px-1.5 py-0.2 rounded text-[10px] font-bold bg-red-600 text-white flex items-center gap-1">
                                          <ShieldAlert className="w-3 h-3" />
                                          Cờ kết cấu
                                        </span>
                                      )}
                                    </>
                                  )}
                                </div>

                                {/* Thông số Bề rộng & Chiều dài + Nút xóa / Hoàn tác */}
                                <div className="flex items-center gap-2">
                                  {isDefectDeleted ? (
                                    <div className="flex items-center gap-2">
                                      <span className="px-2 py-0.5 rounded bg-rose-600 text-white font-mono font-bold text-[10px] shadow-2xs animate-pulse">
                                        ĐÃ XÓA MỀM
                                      </span>
                                      <button
                                        type="button"
                                        onClick={() => handleRestoreDefect(z.id, d.id || d.defectCode)}
                                        className="px-2.5 py-1 rounded bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold flex items-center gap-1 shadow-2xs cursor-pointer transition-colors"
                                        title="Khôi phục khuyết tật này"
                                      >
                                        <Undo2 className="w-3 h-3" />
                                        <span>Hoàn tác</span>
                                      </button>
                                    </div>
                                  ) : isEditMode ? (
                                    <div className="flex items-center gap-2 text-xs">
                                      <label className="text-[11px] font-bold text-slate-500">Rộng (mm):</label>
                                      <input
                                        type="number"
                                        step="0.05"
                                        value={d.widthMaxMm ?? d.width_max_mm ?? 0}
                                        onChange={(e) =>
                                          handleDefectChange(z.id, d.id || d.defectCode, 'widthMaxMm', Number(e.target.value), `${dCode} Bề rộng`)
                                        }
                                        className="w-16 px-1.5 py-0.5 border border-amber-300 rounded bg-amber-50/50 font-black text-red-600 text-xs"
                                      />
                                      <label className="text-[11px] font-bold text-slate-500">Dài (mm):</label>
                                      <input
                                        type="number"
                                        value={d.lengthMm ?? 0}
                                        onChange={(e) =>
                                          handleDefectChange(z.id, d.id || d.defectCode, 'lengthMm', Number(e.target.value), `${dCode} Chiều dài`)
                                        }
                                        className="w-16 px-1.5 py-0.5 border border-amber-300 rounded bg-amber-50/50 text-xs font-bold"
                                      />
                                      <button
                                        type="button"
                                        onClick={() => handleRemoveDefect(z.id, d.id || d.defectCode)}
                                        className="px-2 py-0.5 bg-red-50 hover:bg-red-100 text-red-700 border border-red-200 rounded text-[11px] font-bold transition-colors cursor-pointer"
                                        title="Xóa khuyết tật này"
                                      >
                                        Xóa
                                      </button>
                                    </div>
                                  ) : (
                                    <span className="text-xs font-bold text-slate-800">
                                      Rộng: <strong className="text-red-600">{d.widthMaxMm ?? d.width_max_mm ?? 0} mm</strong>
                                      {d.lengthMm ? ` &bull; Dài ${d.lengthMm} mm` : ''}
                                      {d.depthMm ? ` &bull; Sâu ${d.depthMm} mm` : ''}
                                    </span>
                                  )}
                                </div>
                              </div>

                              {/* Thông số phụ: Hướng nứt, Trạng thái hoạt động, Độ sâu, Thước đo tỷ lệ */}
                              <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 text-[11px] bg-slate-50/80 p-2 rounded-lg border border-slate-100">
                                <div>
                                  <span className="text-slate-500 font-semibold block mb-0.5">Hướng nứt:</span>
                                  {isEditMode ? (
                                    <select
                                      value={d.crackDirection || 'Ngang'}
                                      onChange={(e) =>
                                        handleDefectChange(z.id, d.id || d.defectCode, 'crackDirection', e.target.value, `${dCode} Hướng nứt`)
                                      }
                                      className="w-full p-1 bg-white border border-slate-300 rounded text-[11px] font-bold"
                                    >
                                      <option value="Ngang">Ngang</option>
                                      <option value="Dọc">Dọc</option>
                                      <option value="Chéo 45 độ">Chéo 45 độ</option>
                                      <option value="Chân chim">Chân chim</option>
                                      <option value="Hỗn hợp">Hỗn hợp</option>
                                    </select>
                                  ) : (
                                    <span className="font-bold text-slate-800">
                                      {d.crackDirection || 'Không ghi nhận'}
                                    </span>
                                  )}
                                </div>

                                <div>
                                  <span className="text-slate-500 font-semibold block mb-0.5">Trạng thái:</span>
                                  {isEditMode ? (
                                    <select
                                      value={d.activityState || 'S'}
                                      onChange={(e) =>
                                        handleDefectChange(z.id, d.id || d.defectCode, 'activityState', e.target.value, `${dCode} Trạng thái`)
                                      }
                                      className="w-full p-1 bg-white border border-slate-300 rounded text-[11px] font-bold"
                                    >
                                      <option value="S">Ổn định (S)</option>
                                      <option value="A">Đang phát triển (A)</option>
                                      <option value="U">Chưa xác định (U)</option>
                                    </select>
                                  ) : (
                                    <span className="font-bold text-slate-800">
                                      {d.activityState === 'S'
                                        ? 'Ổn định (S)'
                                        : d.activityState === 'A'
                                        ? 'Đang phát triển (A)'
                                        : 'Chưa xác định (U)'}
                                    </span>
                                  )}
                                </div>

                                <div>
                                  <span className="text-slate-500 font-semibold block mb-0.5">Độ sâu nứt (mm):</span>
                                  {isEditMode ? (
                                    <input
                                      type="number"
                                      value={d.depthMm ?? ''}
                                      onChange={(e) =>
                                        handleDefectChange(z.id, d.id || d.defectCode, 'depthMm', e.target.value ? Number(e.target.value) : '', `${dCode} Độ sâu`)
                                      }
                                      placeholder="VD: 5"
                                      className="w-full p-1 bg-white border border-slate-300 rounded text-[11px] font-bold"
                                    />
                                  ) : (
                                    <span className="font-bold text-slate-800">
                                      {d.depthMm ? `${d.depthMm} mm` : 'Nông bề mặt'}
                                    </span>
                                  )}
                                </div>

                                <div>
                                  <span className="text-slate-500 font-semibold block mb-0.5">Thước đo mm:</span>
                                  {isEditMode ? (
                                    <label className="inline-flex items-center gap-1 font-bold text-slate-700 cursor-pointer pt-1">
                                      <input
                                        type="checkbox"
                                        checked={Boolean(d.hasScaleCard ?? d.has_scale_card)}
                                        onChange={(e) =>
                                          handleDefectChange(z.id, d.id || d.defectCode, 'hasScaleCard', e.target.checked, `${dCode} Thước đo`)
                                        }
                                      />
                                      <span>Có thẻ chuẩn</span>
                                    </label>
                                  ) : (
                                    <span
                                      className={`px-1.5 py-0.2 rounded font-bold text-[10px] ${
                                        d.hasScaleCard ?? d.has_scale_card
                                          ? 'bg-emerald-100 text-emerald-800'
                                          : 'bg-red-100 text-red-800'
                                      }`}
                                    >
                                      {d.hasScaleCard ?? d.has_scale_card ? '✓ Có thước đo' : '⚠️ Thiếu thước đo'}
                                    </span>
                                  )}
                                </div>
                              </div>

                              {/* Ghi chú chi tiết về vết nứt D */}
                              <div className="text-[11px] bg-slate-50 p-2 rounded-lg border border-slate-100">
                                <span className="text-slate-500 font-semibold block mb-0.5">Ghi chú vết nứt:</span>
                                {isEditMode ? (
                                  <input
                                    type="text"
                                    value={d.notes || ''}
                                    onChange={(e) =>
                                      handleDefectChange(z.id, d.id || d.defectCode, 'notes', e.target.value, `${dCode} Ghi chú`)
                                    }
                                    className="w-full p-1 bg-white border border-slate-300 rounded text-xs"
                                    placeholder="Ghi chú chi tiết vết nứt..."
                                  />
                                ) : (
                                  <span className="text-slate-700 italic">
                                    {d.notes || 'Không có ghi chú thêm.'}
                                  </span>
                                )}
                              </div>

                              {/* Dải ảnh cận cảnh CU đa góc chụp */}
                              <div className="space-y-1">
                                <div className="flex items-center justify-between">
                                  <span className="text-[10px] font-bold text-slate-500 block uppercase">
                                    Ảnh Cận Cảnh CU ({cuPhotos.length} ảnh):
                                  </span>
                                  {isEditMode && onOpenPhotoAction && (
                                    <button
                                      type="button"
                                      onClick={() =>
                                        onOpenPhotoAction({
                                          initialMode: 'ADD',
                                          category: 'DEFECT_CU',
                                          targetPhotoType: 'CU',
                                          targetPhotoId: dCode,
                                          defectId: d.id,
                                          defectCode: dCode,
                                          floorCode: currentFloor.floorName,
                                          zoneCode: zCode,
                                          photoTitle: `Bổ sung ảnh khuyết tật ${dCode}`,
                                        })
                                      }
                                      className="px-2 py-0.5 rounded bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[9px] flex items-center gap-1 transition-colors cursor-pointer shadow-2xs"
                                    >
                                      <Plus className="w-2.5 h-2.5" />
                                      <span>Thêm Ảnh CU</span>
                                    </button>
                                  )}
                                </div>
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                                  {cuPhotos.map((cuUrl: string, cuIdx: number) => {
                                    const stagedCu = getStagedAction({
                                      category: 'DEFECT_CU',
                                      defectId: d.id,
                                      photoIndex: cuIdx,
                                      url: cuUrl,
                                    });
                                    return (
                                      <AuditPhotoCard
                                        key={cuIdx}
                                        url={stagedCu?.newPhotoUrl || cuUrl}
                                        photoCode={`CU #${cuIdx + 1}`}
                                        title={`${dCode} - Ảnh Cận Cảnh #${cuIdx + 1}`}
                                        category="DEFECT_CU"
                                        targetPhotoType="CU"
                                        targetPhotoId={dCode}
                                        defectId={d.id}
                                        defectCode={dCode}
                                        photoIndex={cuIdx}
                                        hasMultiplePhotos={cuPhotos.length > 1}
                                        floorCode={currentFloor.floorName}
                                        zoneCode={zCode}
                                        isEditMode={isEditMode}
                                        aspectRatio="h-24"
                                        badgeColor="slate"
                                        historyCount={(d as any)?.historyCount}
                                        hasHistory={(d as any)?.hasHistory}
                                        optimisticStatus={stagedCu ? (stagedCu.action === 'DELETE' ? 'DELETED' : 'REPLACED') : undefined}
                                        onUndoDelete={stagedCu ? () => onUndoPhotoAction?.(stagedCu) : undefined}
                                        onOpenPhotoZoom={onOpenPhotoZoom}
                                        onOpenPhotoAction={onOpenPhotoAction}
                                        onOpenPhotoHistory={onOpenPhotoHistory}
                                      />
                                    );
                                  })}

                                  {/* Các ảnh CU mới thêm của khuyết tật này */}
                                  {stagedPhotoActions
                                    ?.filter((a) => a.action === 'ADD' && a.category === 'DEFECT_CU' && (a.defectId === d.id || a.targetPhotoId === dCode))
                                    .flatMap((a) => a.newPhotoUrls || (a.newPhotoUrl ? [a.newPhotoUrl] : []))
                                    .map((addedCuUrl, addCuIdx) => (
                                      <AuditPhotoCard
                                        key={`added-zone-cu-${addCuIdx}`}
                                        url={addedCuUrl}
                                        photoCode={`Mới`}
                                        title={`${dCode} - Cận Cảnh Mới`}
                                        category="DEFECT_CU"
                                        targetPhotoType="CU"
                                        targetPhotoId={dCode}
                                        defectId={d.id}
                                        defectCode={dCode}
                                        floorCode={currentFloor.floorName}
                                        zoneCode={zCode}
                                        isEditMode={isEditMode}
                                        aspectRatio="h-24"
                                        badgeColor="emerald"
                                        optimisticStatus="ADDED"
                                        onOpenPhotoZoom={onOpenPhotoZoom}
                                        onOpenPhotoAction={onOpenPhotoAction}
                                        onOpenPhotoHistory={onOpenPhotoHistory}
                                      />
                                    ))}
                                </div>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* 4.3. Cấu Kiện Kết Cấu Chịu Lực (Cột, Dầm, Sàn E) & Khuyết Tật D của E */}
        <div className="space-y-4 pt-4 border-t border-slate-200">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-amber-600" />
              <span className="text-xs font-black text-slate-800 uppercase tracking-wide">
                4.3. Cấu Kiện Kết Cấu Chịu Lực (Cột, Dầm, Sàn E) & Khuyết Tật D của E ({activeElements.length} Cấu Kiện
                {deletedElements.length > 0 && ` • ${deletedElements.length} đã xóa`})
              </span>
            </div>
            <span className="text-xs text-slate-500 font-semibold">
              {displayedElements.reduce((acc, el) => acc + (el.defects?.filter((d: any) => !d.is_deleted && !d.isDeleted)?.length || 0), 0)} khuyết tật kết cấu
            </span>
          </div>

          {displayedElements.length === 0 ? (
            <div className="p-4 bg-slate-50 rounded-xl border border-dashed border-slate-200 text-xs text-slate-500 flex items-center justify-between">
              <span>Tầng này không phát hiện cấu kiện chịu lực riêng lẻ bị nứt vỡ hoặc KSV gom khuyết tật theo mảng tường Vùng Z.</span>
              <span className="font-bold text-emerald-700">✓ Không có khuyết tật cấu kiện riêng lẻ</span>
            </div>
          ) : (
            <div className="space-y-4">
              {displayedElements.map((elem: StructuralElementData) => {
                const eCode = elem.elementCode || 'E-??';
                const isElemDeleted = Boolean(elem.is_deleted || (elem as any).isDeleted);
                const rawEDefects: DefectItem[] = Array.isArray(elem.defects) ? elem.defects : [];
                const eDefects = showDeletedItems ? rawEDefects : rawEDefects.filter((d: any) => !d.is_deleted && !d.isDeleted);
                const overviewPhotos = Array.isArray(elem.overviewPhotos) ? elem.overviewPhotos : [];

                return (
                  <div
                    id={`element-card-${eCode}`}
                    key={elem.id || eCode}
                    className={`p-4 rounded-xl space-y-3 transition-all ${
                      isElemDeleted
                        ? 'bg-rose-50/30 border-2 border-dashed border-rose-300 opacity-80'
                        : 'bg-amber-50/30 border border-amber-200'
                    }`}
                  >
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <div className="flex items-center gap-2 flex-wrap flex-1">
                        <span className="px-2.5 py-0.5 rounded-lg bg-amber-700 text-white font-mono font-black text-xs">
                          {eCode}
                        </span>
                        {isElemDeleted ? (
                          <span className="text-xs font-bold text-slate-800">
                            {elem.elementType || 'Cột BTCT'} &bull; {elem.materialType || 'BTCT'}
                            {elem.dimensions ? ` &bull; ${elem.dimensions}` : ''}
                          </span>
                        ) : isEditMode ? (
                          <div className="flex items-center gap-2 flex-wrap">
                            <select
                              value={elem.elementType || 'Cột BTCT'}
                              onChange={(e) => handleElementFieldChange(elem.id, 'elementType', e.target.value, 'Loại cấu kiện')}
                              className="p-1 text-xs border border-amber-300 rounded font-bold bg-white"
                            >
                              {ELEMENT_TYPE_PRESETS.map((t) => (
                                <option key={t} value={t}>{t}</option>
                              ))}
                            </select>
                            <span>&bull;</span>
                            <select
                              value={elem.materialType || 'Bê tông cốt thép (BTCT)'}
                              onChange={(e) => handleElementFieldChange(elem.id, 'materialType', e.target.value, 'Vật liệu')}
                              className="p-1 text-xs border border-amber-300 rounded font-bold bg-white"
                            >
                              {MATERIAL_TYPE_PRESETS.map((m) => (
                                <option key={m} value={m}>{m}</option>
                              ))}
                            </select>
                            <span>&bull;</span>
                            <input
                              type="text"
                              value={elem.dimensions || elem.sectionDimensions || ''}
                              onChange={(e) => handleElementFieldChange(elem.id, 'dimensions', e.target.value, 'Kích thước tiết diện')}
                              placeholder="Tiết diện b x h (vd 200x300mm)"
                              className="p-1 text-xs border border-amber-300 rounded bg-white w-44"
                            />
                            <span>&bull;</span>
                            <select
                              value={elem.structuralIntegrity || 'Nguyên vẹn'}
                              onChange={(e) => handleElementFieldChange(elem.id, 'structuralIntegrity', e.target.value, 'Độ toàn vẹn kết cấu')}
                              className="p-1 text-xs border border-amber-300 rounded bg-white"
                            >
                              {STRUCTURAL_INTEGRITY_PRESETS.map((si) => (
                                <option key={si} value={si}>{si}</option>
                              ))}
                            </select>
                            <span>&bull;</span>
                            <input
                              type="text"
                              value={elem.roomName || ''}
                              onChange={(e) => handleElementFieldChange(elem.id, 'roomName', e.target.value, 'Vị trí trục/phòng')}
                              placeholder="Trục toạ độ / Vị trí..."
                              className="p-1 text-xs border border-amber-300 rounded bg-white w-32"
                            />
                          </div>
                        ) : (
                          <span className="text-xs font-bold text-slate-800">
                            {elem.elementType || 'Cột BTCT'} &bull; {elem.materialType || 'BTCT'}
                            {elem.dimensions ? ` &bull; ${elem.dimensions}` : ''}
                            {elem.structuralIntegrity ? ` &bull; ${elem.structuralIntegrity}` : ''} &bull;{' '}
                            <span className="text-slate-500 font-normal">{elem.roomName || elem.customRoomName || 'Trục không xác định'}</span>
                          </span>
                        )}
                      </div>
                      {isElemDeleted ? (
                        <div className="flex items-center gap-2">
                          <span className="px-2 py-0.5 rounded-lg bg-rose-600 text-white font-mono font-bold text-[10px] shadow-xs animate-pulse">
                            ĐÃ XÓA MỀM
                          </span>
                          <button
                            type="button"
                            onClick={() => handleRestoreElement(elem.id)}
                            className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-1 shadow-xs cursor-pointer transition-colors"
                            title="Khôi phục cấu kiện này"
                          >
                            <Undo2 className="w-3.5 h-3.5" />
                            <span>Hoàn tác</span>
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <Badge variant={eDefects.length > 0 ? 'warning' : 'success'} size="sm">
                            {eDefects.length} khuyết tật kết cấu
                          </Badge>
                          {isEditMode && (
                            <button
                              type="button"
                              onClick={() => handleRemoveElement(elem.id)}
                              className="px-2 py-1 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-300 text-xs font-bold flex items-center gap-1 cursor-pointer transition-colors"
                              title={`Xóa cấu kiện ${eCode}`}
                            >
                              <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                              <span>Xóa Cấu Kiện</span>
                            </button>
                          )}
                        </div>
                      )}
                    </div>

                    {/* Ảnh bối cảnh hoặc tổng quan của cấu kiện E */}
                    <div className="space-y-2 pt-1 border-t border-amber-200/60">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold uppercase text-slate-600 block">
                          Ảnh Cấu Kiện Kết Cấu {eCode} ({(elem.ctxPhotoUrl ? 1 : 0) + overviewPhotos.length} ảnh):
                        </span>
                        {isEditMode && onOpenPhotoAction && (
                          <button
                            type="button"
                            onClick={() =>
                              onOpenPhotoAction({
                                initialMode: 'ADD',
                                category: 'ELEMENT_OVERVIEW',
                                targetPhotoType: 'OVERVIEW',
                                targetPhotoId: elem.id,
                                floorCode: currentFloor.floorName,
                                photoTitle: `Bổ sung ảnh cấu kiện ${eCode}`,
                              })
                            }
                            className="px-2 py-0.5 rounded bg-sky-600 hover:bg-sky-700 text-white font-bold text-[9px] flex items-center gap-1 transition-colors cursor-pointer shadow-2xs"
                          >
                            <Plus className="w-2.5 h-2.5" />
                            <span>Thêm Ảnh E</span>
                          </button>
                        )}
                      </div>

                      <div className="flex items-center gap-2.5 overflow-x-auto pb-1.5">
                        {/* Ảnh bối cảnh CTX của cấu kiện E */}
                        {elem.ctxPhotoUrl && (() => {
                          const stagedCtx = getStagedAction({
                            category: 'ELEMENT_CTX',
                            targetPhotoId: elem.id,
                            url: elem.ctxPhotoUrl,
                          });
                          return (
                            <div className="w-32 shrink-0">
                              <AuditPhotoCard
                                url={stagedCtx?.newPhotoUrl || elem.ctxPhotoUrl}
                                photoCode={`${eCode} - Bối Cảnh`}
                                title={`Ảnh bối cảnh cấu kiện ${eCode}`}
                                category="ELEMENT_CTX"
                                targetPhotoType="CTX"
                                targetPhotoId={elem.id}
                                floorCode={currentFloor.floorName}
                                isEditMode={isEditMode}
                                aspectRatio="h-24"
                                badgeColor="amber"
                                historyCount={(elem as any)?.historyCount}
                                hasHistory={(elem as any)?.hasHistory}
                                optimisticStatus={stagedCtx ? (stagedCtx.action === 'DELETE' ? 'DELETED' : 'REPLACED') : undefined}
                                onUndoDelete={stagedCtx ? () => onUndoPhotoAction?.(stagedCtx) : undefined}
                                onOpenPhotoZoom={onOpenPhotoZoom}
                                onOpenPhotoAction={onOpenPhotoAction}
                                onOpenPhotoHistory={onOpenPhotoHistory}
                              />
                            </div>
                          );
                        })()}

                        {/* Các ảnh tổng quan hiện có của cấu kiện E */}
                        {overviewPhotos.map((photoUrl, pIdx) => {
                          const stagedOv = getStagedAction({
                            category: 'ELEMENT_OVERVIEW',
                            targetPhotoId: elem.id,
                            photoIndex: pIdx,
                            url: photoUrl,
                          });
                          return (
                            <div key={pIdx} className="w-32 shrink-0">
                              <AuditPhotoCard
                                url={stagedOv?.newPhotoUrl || photoUrl}
                                photoCode={`#${pIdx + 1}`}
                                title={`Ảnh tổng quan ${eCode} (#${pIdx + 1})`}
                                category="ELEMENT_OVERVIEW"
                                targetPhotoType="OVERVIEW"
                                targetPhotoId={elem.id}
                                photoIndex={pIdx}
                                floorCode={currentFloor.floorName}
                                isEditMode={isEditMode}
                                aspectRatio="h-24"
                                badgeColor="slate"
                                historyCount={(elem as any)?.historyCount}
                                hasHistory={(elem as any)?.hasHistory}
                                optimisticStatus={stagedOv ? (stagedOv.action === 'DELETE' ? 'DELETED' : 'REPLACED') : undefined}
                                onUndoDelete={stagedOv ? () => onUndoPhotoAction?.(stagedOv) : undefined}
                                onOpenPhotoZoom={onOpenPhotoZoom}
                                onOpenPhotoAction={onOpenPhotoAction}
                                onOpenPhotoHistory={onOpenPhotoHistory}
                              />
                            </div>
                          );
                        })}

                        {/* Các ảnh mới thêm (Optimistic ADD) cho cấu kiện E */}
                        {stagedPhotoActions
                          ?.filter((a) => a.action === 'ADD' && a.category === 'ELEMENT_OVERVIEW' && a.targetPhotoId === elem.id)
                          .flatMap((a) => a.newPhotoUrls || (a.newPhotoUrl ? [a.newPhotoUrl] : []))
                          .map((addedUrl, addIdx) => (
                            <div key={`added-elem-photo-${addIdx}`} className="w-32 shrink-0">
                              <AuditPhotoCard
                                url={addedUrl}
                                photoCode={`Mới`}
                                title={`Ảnh mới thêm (${eCode})`}
                                category="ELEMENT_OVERVIEW"
                                targetPhotoType="OVERVIEW"
                                targetPhotoId={elem.id}
                                floorCode={currentFloor.floorName}
                                isEditMode={isEditMode}
                                aspectRatio="h-24"
                                badgeColor="emerald"
                                optimisticStatus="ADDED"
                                onOpenPhotoZoom={onOpenPhotoZoom}
                                onOpenPhotoAction={onOpenPhotoAction}
                                onOpenPhotoHistory={onOpenPhotoHistory}
                              />
                            </div>
                          ))}

                        {!elem.ctxPhotoUrl && overviewPhotos.length === 0 && (
                          <div className="text-xs text-slate-400 italic py-2">
                            Chưa có ảnh cấu kiện kết cấu. Bấm &quot;Thêm Ảnh E&quot; ở trên để bổ sung.
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Danh sách khuyết tật D của cấu kiện E */}
                    {eDefects.length > 0 && (
                      <div className="space-y-2 pt-1">
                        <span className="text-[11px] font-bold text-slate-700 block">
                          Khuyết tật chi tiết trên cấu kiện ({eDefects.length} mục):
                        </span>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                          {eDefects.map((def: DefectItem, dIdx: number) => {
                            const dCode = def.defectCode || `D-${dIdx + 1}`;
                            const cuPhotos: any[] = Array.isArray(def.cuPhotos) ? (def.cuPhotos as any[]) : [];
                            return (
                              <div key={def.id || dCode} className="p-3 bg-white rounded-xl border border-amber-200 space-y-1.5 shadow-2xs">
                                <div className="flex items-center justify-between">
                                  <span className="font-mono font-bold text-amber-900 bg-amber-100 px-1.5 py-0.5 rounded text-[11px]">
                                    {dCode}
                                  </span>
                                  <span className="font-bold text-slate-700">{def.defectType || 'Vết nứt BTCT'}</span>
                                  <span className="font-mono font-bold text-rose-600">
                                    {def.widthMaxMm ?? def.width_max_mm ?? 0} mm
                                  </span>
                                </div>
                                <div className="text-[11px] text-slate-500 flex items-center justify-between">
                                  <span>Dài: {def.lengthMm ?? def.length_mm ?? 0} mm &bull; Hướng: {def.crackDirection || 'Không xác định'}</span>
                                  <span className={def.hasScaleCard ? 'text-emerald-600 font-bold' : 'text-amber-600'}>
                                    {def.hasScaleCard ? '✓ Có thước đo' : '✕ Thiếu thước'}
                                  </span>
                                </div>
                                {def.notes && <div className="text-[11px] text-slate-600 italic">{def.notes}</div>}

                                {/* CU photos for this defect */}
                                <div className="space-y-1 pt-1 border-t border-slate-100">
                                  <div className="flex items-center justify-between">
                                    <span className="text-[10px] font-bold text-slate-500 uppercase">
                                      Ảnh Cận Cảnh CU ({cuPhotos.length} ảnh):
                                    </span>
                                    {isEditMode && onOpenPhotoAction && (
                                      <button
                                        type="button"
                                        onClick={() =>
                                          onOpenPhotoAction({
                                            initialMode: 'ADD',
                                            category: 'DEFECT_CU',
                                            targetPhotoType: 'CU',
                                            targetPhotoId: dCode,
                                            defectId: def.id,
                                            defectCode: dCode,
                                            floorCode: currentFloor.floorName,
                                            photoTitle: `Bổ sung ảnh khuyết tật ${dCode}`,
                                          })
                                        }
                                        className="px-1.5 py-0.5 rounded bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[9px] flex items-center gap-0.5 transition-colors cursor-pointer shadow-2xs"
                                      >
                                        <Plus className="w-2.5 h-2.5" />
                                        <span>+ Thêm CU</span>
                                      </button>
                                    )}
                                  </div>

                                  <div className="flex items-center gap-2 pt-1 overflow-x-auto">
                                    {cuPhotos.map((cuItem: any, cuIdx: number) => {
                                      const cuUrl = typeof cuItem === 'string' ? cuItem : cuItem?.url || cuItem?.photoUrl;
                                      if (!cuUrl) return null;
                                      const stagedCu = getStagedAction({
                                        category: 'DEFECT_CU',
                                        defectId: def.id,
                                        photoIndex: cuIdx,
                                        url: cuUrl,
                                      });
                                      return (
                                        <div key={cuIdx} className="w-24 shrink-0">
                                          <AuditPhotoCard
                                            url={stagedCu?.newPhotoUrl || cuUrl}
                                            photoCode={`CU #${cuIdx + 1}`}
                                            title={`Ảnh cận cảnh ${dCode} (#${cuIdx + 1})`}
                                            category="DEFECT_CU"
                                            targetPhotoType="CU"
                                            targetPhotoId={dCode}
                                            defectId={def.id}
                                            defectCode={dCode}
                                            photoIndex={cuIdx}
                                            hasMultiplePhotos={cuPhotos.length > 1}
                                            floorCode={currentFloor.floorName}
                                            isEditMode={isEditMode}
                                            aspectRatio="h-16"
                                            badgeColor="rose"
                                            historyCount={(def as any)?.historyCount}
                                            hasHistory={(def as any)?.hasHistory}
                                            optimisticStatus={stagedCu ? (stagedCu.action === 'DELETE' ? 'DELETED' : 'REPLACED') : undefined}
                                            onUndoDelete={stagedCu ? () => onUndoPhotoAction?.(stagedCu) : undefined}
                                            onOpenPhotoZoom={onOpenPhotoZoom}
                                            onOpenPhotoAction={onOpenPhotoAction}
                                            onOpenPhotoHistory={onOpenPhotoHistory}
                                          />
                                        </div>
                                      );
                                    })}

                                    {/* Các ảnh CU mới thêm của khuyết tật này */}
                                    {stagedPhotoActions
                                      ?.filter((a) => a.action === 'ADD' && a.category === 'DEFECT_CU' && (a.defectId === def.id || a.targetPhotoId === dCode))
                                      .flatMap((a) => a.newPhotoUrls || (a.newPhotoUrl ? [a.newPhotoUrl] : []))
                                      .map((addedCuUrl, addCuIdx) => (
                                        <div key={`added-cu-${addCuIdx}`} className="w-24 shrink-0">
                                          <AuditPhotoCard
                                            url={addedCuUrl}
                                            photoCode={`Mới`}
                                            title={`Ảnh cận cảnh mới (${dCode})`}
                                            category="DEFECT_CU"
                                            targetPhotoType="CU"
                                            targetPhotoId={dCode}
                                            defectId={def.id}
                                            defectCode={dCode}
                                            floorCode={currentFloor.floorName}
                                            isEditMode={isEditMode}
                                            aspectRatio="h-16"
                                            badgeColor="emerald"
                                            optimisticStatus="ADDED"
                                            onOpenPhotoZoom={onOpenPhotoZoom}
                                            onOpenPhotoAction={onOpenPhotoAction}
                                            onOpenPhotoHistory={onOpenPhotoHistory}
                                          />
                                        </div>
                                      ))}

                                    {cuPhotos.length === 0 && (
                                      <div className="text-[11px] text-slate-400 italic py-1">Chưa có ảnh cận cảnh</div>
                                    )}
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {isEditMode ? (
                      <input
                        type="text"
                        value={elem.notes || ''}
                        onChange={(e) => handleElementFieldChange(elem.id, 'notes', e.target.value, 'Ghi chú')}
                        placeholder="Ghi chú cấu kiện kết cấu chịu lực..."
                        className="w-full p-1.5 text-xs bg-white border border-amber-300 rounded"
                      />
                    ) : (
                      <div className="text-xs text-slate-700">
                        <span className="font-semibold text-slate-500">Ghi chú: </span>
                        {elem.notes || 'Không'}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Modal xác nhận xóa Vùng có khuyết tật (Cascade Soft-Delete Warning Modal) */}
      {zoneToDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl max-w-md w-full p-5 shadow-2xl border border-rose-200 space-y-4">
            <div className="flex items-center gap-3 text-rose-600">
              <div className="p-2.5 bg-rose-100 rounded-xl">
                <AlertTriangle className="w-6 h-6 text-rose-600" />
              </div>
              <div>
                <h3 className="font-black text-base text-slate-900">Xác nhận xóa Vùng Kiến Trúc</h3>
                <p className="text-xs text-rose-700 font-bold font-mono">
                  {zoneToDelete.zoneCode || zoneToDelete.zone_code || 'Z-??'} ({zoneToDelete.roomName || 'Không gian'})
                </p>
              </div>
            </div>

            <div className="bg-rose-50 border border-rose-200 rounded-xl p-3 text-xs space-y-1.5 text-slate-700">
              <p className="font-semibold text-rose-900">
                ⚠️ Vùng này đang chứa{' '}
                <strong className="text-rose-700 font-black">
                  {(zoneToDelete.defects || []).filter((d: any) => !d.is_deleted && !d.isDeleted).length}
                </strong>{' '}
                khuyết tật nứt (D) đang hoạt động!
              </p>
              <p className="text-[11px] text-slate-600 leading-relaxed">
                Hành động này sẽ thực hiện <strong>Xóa mềm phân tầng (Cascade Soft-Delete)</strong>: Vùng và toàn bộ các khuyết tật con sẽ được ẩn khỏi danh sách chính nhưng được bảo toàn mã hiệu, toạ độ CAD và lịch sử thẩm định.
              </p>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setZoneToDelete(null)}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs transition-colors cursor-pointer"
              >
                Hủy bỏ
              </button>
              <button
                type="button"
                onClick={() => executeSoftDeleteZone(zoneToDelete)}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-md shadow-rose-600/20 transition-all cursor-pointer"
              >
                <Trash2 className="w-4 h-4" />
                <span>Xác nhận xóa Vùng & Khuyết tật</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
};

