import type { FloorSurveyData, DamageZoneData, StructuralElementData } from '../../../../../survey-phase1/types/phase1.types';
import type { DefectItem } from '../../../../../../components/canvas/DefectPinningCanvas';
import { getNextAvailablePinCode, type CadZonePin } from '../../../../../../components/canvas/FloorCadPinningCanvas';
import type { PhotoReplaceParams } from '../../AuditPhotoReplaceModal';
import type { AuditPhotoActionParams, AuditPhotoHistoryParams, PhotoActionPayload } from '../types';
import type { PhotoOrientationViolation } from '../hooks/usePhotoOrientationAudit';
import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Layers,
  Maximize2,
  AlertTriangle,
  Eye,
  EyeOff,
  Camera,
  ShieldAlert,
  Compass,
  Plus,
  Trash2,
  History,
  Crosshair,
  Undo2,
  RotateCw,
  RotateCcw,
  RefreshCw,
  Lightbulb,
  Edit3,
} from 'lucide-react';
import { Badge } from '../../../../../../core/components/ui/Badge';
import { isCrackRelated } from '../../../../../../components/canvas/defectHelpers';
import { AuditPhotoCard } from '../components/AuditPhotoCard';
import { RotatableImageFrame } from '../components/RotatableImageFrame';
import { resolveOptimisticPhoto, getOptimisticAddedPhotos } from '../utils/optimisticPhotoResolver';

const getBurlandGradeFromWidth = (w: number): number => {
  if (w <= 0.1) return 0;
  if (w <= 1) return 1;
  if (w <= 5) return 2;
  if (w <= 15) return 3;
  if (w <= 25) return 4;
  return 5;
};

const syncZoneBurlandGrade = (z: DamageZoneData, rawDefects: DefectItem[]): DamageZoneData => {
  const normalizedDefects = rawDefects.map((d) => {
    const isCrack = isCrackRelated(d.screeningCategory, d.defectType);
    const hasWidth = d.widthMaxMm !== undefined || d.width_max_mm !== undefined;
    const w = Number(d.widthMaxMm ?? d.width_max_mm ?? 0);
    const computedGrade = getBurlandGradeFromWidth(w);
    const resolvedGrade =
      isCrack && hasWidth
        ? computedGrade
        : d.burlandGrade !== undefined && d.burlandGrade !== null
          ? Number(d.burlandGrade)
          : isCrack
            ? computedGrade
            : 0;
    return {
      ...d,
      burlandGrade: resolvedGrade,
    };
  });
  const activeDefects = normalizedDefects.filter((d) => !isItemSoftDeleted(d));
  const nextZoneGrade = Math.max(
    0,
    ...activeDefects.map((d) => {
      if (isCrackRelated(d.screeningCategory, d.defectType)) {
        const w = Number(d.widthMaxMm ?? d.width_max_mm ?? 0);
        if (w > 0) return getBurlandGradeFromWidth(w);
      }
      if (d.burlandGrade !== undefined && d.burlandGrade !== null) {
        return Number(d.burlandGrade) || 0;
      }
      return 0;
    })
  );
  return {
    ...z,
    defects: normalizedDefects,
    burlandGrade: nextZoneGrade,
  };
};

interface PinUndoActionMove {
  type: 'PIN_MOVE';
  floorIndex: number;
  pinCode: string;
  isStruct: boolean;
  prevX: number;
  prevY: number;
}

interface PinUndoActionRotate {
  type: 'CAD_ROTATE';
  floorId?: string;
  floorIndex: number;
  cadKey: string;
  prevRotation: number;
  prevZonePins: CadZonePin[];
  prevElementPins: CadZonePin[];
}

type PinUndoAction = PinUndoActionMove | PinUndoActionRotate;

interface AuditExtendedMeta {
  isDeleted?: boolean;
  is_deleted?: boolean;
  historyCount?: number;
  hasHistory?: boolean;
  floorNumber?: number;
  cadSketchRotation?: number;
  originPinX?: number;
  originPinY?: number;
}

const isItemSoftDeleted = (item: unknown): boolean => {
  if (!item || typeof item !== 'object') return false;
  const meta = item as AuditExtendedMeta;
  return Boolean(meta.is_deleted || meta.isDeleted);
};

const getItemHistoryMeta = (item: unknown): { historyCount?: number; hasHistory?: boolean } => {
  if (!item || typeof item !== 'object') return {};
  return item as AuditExtendedMeta;
};

const getFloorNumberVal = (fl: FloorSurveyData, activeFloorIdx: number): number => {
  const num = (fl as FloorSurveyData & AuditExtendedMeta).floorNumber;
  return typeof num === 'number' && num > 0 ? num : activeFloorIdx + 1;
};

const getPinOriginCoords = (pin: CadZonePin): { x: number; y: number } => {
  const ext = pin as CadZonePin & AuditExtendedMeta;
  return {
    x: Number(ext.originPinX ?? pin.pinX ?? pin.pin_x ?? 50),
    y: Number(ext.originPinY ?? pin.pinY ?? pin.pin_y ?? 50),
  };
};

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

const ARCH_SCREENING_CATEGORIES = [
  'A. Hư hỏng bề mặt & Hoàn thiện',
  'B. Thấm, Ẩm & Nước xâm nhập',
  'C. Biến dạng & Lệch hình học',
  'D. Hư hỏng bộ phận phi kết cấu',
];

const ARCH_DEFECT_TYPES = [
  'Nứt tường gạch / Vữa trát hoàn thiện',
  'Bong tróc / Phồng rộp lớp sơn - vữa',
  'Rêu mốc / ố vàng / Thấm nước bề mặt',
  'Vỡ / Bong bật gạch lát nền - ốp tường',
  'Võng / Nứt tấm trần thạch cao - trần giả',
  'Kẹt / Xệ cánh cửa đi - cửa sổ',
  'Nứt gãy lan can / Tay vịn cầu thang',
  'Khác (Ghi rõ tại ghi chú)',
];

const STRUCT_SCREENING_CATEGORIES = [
  'A. Nứt kết cấu (Structural Cracking)',
  'B. Biến dạng & Chuyển vị kết cấu',
  'C. Suy thoái vật liệu kết cấu',
  'D. Thấm - Ẩm ảnh hưởng kết cấu',
  'E. Mất liên kết & Hư hỏng nút khung',
];

const STRUCT_DEFECT_TYPES = [
  'Nứt cắt xiên (45°) đầu dầm / chân cột',
  'Nứt uốn giữa nhịp dầm / Đáy bản sàn chịu lực',
  'Nứt dọc theo cốt thép chủ (Do ăn mòn cốt thép)',
  'Bong bật lớp bê tông bảo vệ / Lộ cốt thép gỉ',
  'Rỗ tổ ong / Phân tầng bê tông cấu kiện chính',
  'Thấm nước xuyên sàn BTCT / Khe lún - Cổ ống',
  'Võng bản sàn / Võng dầm vượt giới hạn mắt thường',
  'Biến dạng / Nứt tách tại nút giao Cột - Dầm',
  'Khác (Ghi rõ tại ghi chú)',
];

const CRACK_DIRECTION_OPTIONS = ['Ngang', 'Dọc', 'Xiên 45°', 'Chân chim / Đa hướng'];

const ACTIVITY_STATE_OPTIONS: Array<{ value: 'U' | 'S' | 'A'; label: string }> = [
  { value: 'S', label: 'S - Ổn định' },
  { value: 'A', label: 'A - Đang phát triển' },
  { value: 'U', label: 'U - Chưa rõ' },
];

interface Props {
  isEditMode: boolean;
  formState: Record<string, unknown>;
  handleFieldChange: (key: string, label: string, val: unknown) => void;
  onOpenPhotoZoom: (url: string, title?: string, photoCode?: string, rotation?: number) => void;
  onOpenPhotoReplace: (params: PhotoReplaceParams) => void;
  onOpenPhotoAction?: (params: AuditPhotoActionParams) => void;
  onOpenPhotoHistory?: (params: AuditPhotoHistoryParams) => void;
  isFieldDirty?: (fieldKey: string, subKey?: string) => boolean;
  stagedPhotoActions?: PhotoActionPayload[];
  onUndoPhotoAction?: (action: PhotoActionPayload) => void;
  stagedPhotoRotations?: Record<string, number>;
  onRotatePhoto?: (photoKey: string, newRotation: number, photoUrl?: string) => void;
  violationsMap?: Map<string, PhotoOrientationViolation>;
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
  stagedPhotoRotations = {},
  onRotatePhoto,
  violationsMap,
}) => {
  // Helper tra cứu trạng thái can thiệp ảnh staged trong phiên thẩm định
  const getStagedAction = useCallback(
    (filter: {
      category?: string;
      targetPhotoId?: string;
      targetPhotoType?: string;
      defectId?: string;
      photoIndex?: number;
      url?: string;
      includeAdd?: boolean;
    }) => {
      if (!stagedPhotoActions || stagedPhotoActions.length === 0) return null;
      return stagedPhotoActions.find((a) => {
        if (filter.category && a.category !== filter.category) return false;
        if (filter.targetPhotoType && a.targetPhotoType && a.targetPhotoType !== filter.targetPhotoType) return false;
        if (filter.targetPhotoId && a.targetPhotoId && a.targetPhotoId !== filter.targetPhotoId) return false;
        if (filter.defectId && a.defectId && a.defectId !== filter.defectId) return false;
        if (!filter.includeAdd && a.action === 'ADD' && (filter.photoIndex !== undefined || filter.url !== undefined)) {
          return false;
        }
        if (filter.photoIndex !== undefined) {
          if (a.photoIndex !== undefined && a.photoIndex !== filter.photoIndex) return false;
          if (a.photoIndex === undefined && (a.category === 'ZONE_CTX' || a.category === 'ELEMENT_CTX')) return false;
        } else if (a.photoIndex !== undefined && (a.category === 'ZONE_CTX' || a.category === 'ELEMENT_CTX')) {
          return false;
        }
        if (filter.url !== undefined || filter.photoIndex !== undefined) {
          if (filter.photoIndex !== undefined && a.photoIndex !== undefined) {
            return a.photoIndex === filter.photoIndex;
          }
          if (filter.url && a.oldPhotoUrl && a.oldPhotoUrl === filter.url) return true;
          if (
            filter.photoIndex === undefined &&
            a.photoIndex === undefined &&
            (a.category === 'CAD_FLOOR' || a.category === 'ZONE_CTX' || a.category === 'ELEMENT_CTX')
          ) {
            return true;
          }
          return false;
        }
        if (
          !filter.includeAdd &&
          a.action === 'ADD' &&
          a.category !== 'CAD_FLOOR' &&
          a.category !== 'ZONE_CTX' &&
          a.category !== 'ELEMENT_CTX'
        ) {
          return false;
        }
        if (a.category === 'ZONE_CTX' && a.photoIndex !== undefined) return false;
        return true;
      });
    },
    [stagedPhotoActions]
  );

  // Kiểm tra khuyết tật D có bị đánh dấu xóa cả mục (deleteDefectItem: true) trong stagedPhotoActions không
  const getStagedDefectItemDeletion = useCallback(
    (d: DefectItem): PhotoActionPayload | undefined => {
      const dCode = d.defectCode || d.defect_code || '';
      return stagedPhotoActions?.find(
        (a) =>
          a.action === 'DELETE' &&
          Boolean(a.deleteDefectItem) &&
          ((d.id && a.defectId === d.id) || (dCode && (a.targetPhotoId === dCode || a.defectCode === dCode)))
      );
    },
    [stagedPhotoActions]
  );

  const isDefectActive = useCallback(
    (d: DefectItem): boolean => !isItemSoftDeleted(d) && !getStagedDefectItemDeletion(d),
    [getStagedDefectItemDeletion]
  );

  const rawFloors: FloorSurveyData[] = Array.isArray(formState.floors) ? (formState.floors as FloorSurveyData[]) : [];
  const rawDamageZones: DamageZoneData[] = Array.isArray(formState.damageZones) ? (formState.damageZones as DamageZoneData[]) : [];
  const hasFloors = rawFloors.length > 0;

  const floorsList: FloorSurveyData[] = hasFloors
    ? rawFloors
    : [
        {
          id: 'virtual-floor-1',
          floorName: 'Tầng Khảo Sát Tổng Thể',
          overviewPhotos: [],
          cadSketchPhotoUrl: '',
          cadZonePins: [],
          zones: rawDamageZones,
        } as FloorSurveyData,
      ];

  const [showCadPins, setShowCadPins] = useState(true);
  const [showCtxPins, setShowCtxPins] = useState(true);
  const [showDeletedItems, setShowDeletedItems] = useState(false);
  const [zoneToDelete, setZoneToDelete] = useState<{ floorIdx: number; zone: DamageZoneData } | null>(null);
  const [highlightedDefectId, setHighlightedDefectId] = useState<string | null>(null);

  // Pinning & Drag state for CAD (Z & E)
  const [cadPinningMode, setCadPinningMode] = useState<{ floorIdx: number; mode: 'Z' | 'E' } | null>(null);
  const [draggingCadPin, setDraggingCadPin] = useState<{
    floorIdx: number;
    pinCode: string;
    isStruct: boolean;
    currentX: number;
    currentY: number;
  } | null>(null);
  const [undoPinStack, setUndoPinStack] = useState<PinUndoAction[]>([]);
  const [selectedPinCode, setSelectedPinCode] = useState<string | null>(null);
  const initialPinCoordsRef = useRef<Record<string, { x: number; y: number }>>({});

  // Pinning & Drag state for CTX (D)
  const [pinningCtxZone, setPinningCtxZone] = useState<{ floorIdx: number; zoneOrElemCode: string } | null>(null);
  const [draggingDefectPin, setDraggingDefectPin] = useState<{
    floorIdx: number;
    zoneId: string;
    defectId: string;
    dCode: string;
    currentX: number;
    currentY: number;
  } | null>(null);
  const hasJustDraggedRef = useRef<boolean>(false);
  const pointerStartPosRef = useRef<{ x: number; y: number } | null>(null);

  // Initialize KSV origin pin coords
  useEffect(() => {
    floorsList.forEach((fl) => {
      const allPins = [...(fl.cadZonePins || []), ...(fl.cadElementPins || [])];
      allPins.forEach((p) => {
        const code = p.zoneCode || p.zone_code;
        if (code && !initialPinCoordsRef.current[code]) {
          initialPinCoordsRef.current[code] = getPinOriginCoords(p);
        }
      });
    });
  }, [floorsList]);

  // Hoàn tác thao tác ghim (Ctrl+Z / Cmd+Z hoặc bấm nút Hoàn Tác)
  const handleUndoPin = useCallback(() => {
    if (undoPinStack.length === 0) return;
    const lastAction = undoPinStack[undoPinStack.length - 1];
    setUndoPinStack((prev) => prev.slice(0, -1));

    if (lastAction.type === 'PIN_MOVE') {
      handleCommitCadPinCoord(lastAction.floorIndex, lastAction.pinCode, lastAction.isStruct, lastAction.prevX, lastAction.prevY);
    } else if (lastAction.type === 'CAD_ROTATE') {
      onRotatePhoto?.(lastAction.cadKey, lastAction.prevRotation);
      if (hasFloors) {
        const updatedFloors = rawFloors.map((fl: FloorSurveyData, fi: number) => {
          if (fi !== lastAction.floorIndex && fl.id !== lastAction.floorId) return fl;
          return {
            ...fl,
            cadZonePins: lastAction.prevZonePins,
            cadElementPins: lastAction.prevElementPins,
            cadSketchRotation: lastAction.prevRotation,
          };
        });
        handleFieldChange('floors', `Hoàn tác xoay CAD tầng ${lastAction.floorIndex + 1}`, updatedFloors);
      }
    }
  }, [undoPinStack, hasFloors, rawFloors, onRotatePhoto, handleFieldChange]);

  // Lắng nghe phím tắt Ctrl+Z / Cmd+Z để hoàn tác ghim
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z' && !e.shiftKey) {
        if (undoPinStack.length > 0) {
          e.preventDefault();
          handleUndoPin();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [undoPinStack, handleUndoPin]);

  // Commit new coordinates for CAD pins (Z or E)
  const handleCommitCadPinCoord = (floorIdx: number, pinCode: string, isStruct: boolean, newX: number, newY: number) => {
    if (hasFloors) {
      const updatedFloors = rawFloors.map((fl: FloorSurveyData, fi: number) => {
        if (fi !== floorIdx) return fl;
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

  // Rotate CAD 90 deg clockwise with automatic pin coordinate transformation: (x, y) -> (100 - y, x)
  const handleRotateCad = (floorIdx: number, isStruct: boolean) => {
    const floor = floorsList[floorIdx];
    if (!floor) return;
    const fId = floor.id ? String(floor.id) : String(floorIdx);
    const baseCadKey = fId.startsWith('floor_') ? `${fId}_cad` : `floor_${fId}_cad`;
    const structCadKey = fId.startsWith('floor_') ? `${fId}_structural_cad` : `floor_${fId}_structural_cad`;
    const hasSeparateStructCad = Boolean(floor.cadStructuralSketchPhotoUrl || floor.cad_structural_drawing_url);
    const cadKey = isStruct && hasSeparateStructCad ? structCadKey : baseCadKey;
    const curRot =
      stagedPhotoRotations[cadKey] ??
      stagedPhotoRotations[`floor_${floor.id || floorIdx}_cad`] ??
      ((floor as FloorSurveyData & AuditExtendedMeta).cadSketchRotation ?? 0);
    const nextRotation = (curRot + 90) % 360;
    onRotatePhoto?.(cadKey, nextRotation);

    const transformCoords = (x: number, y: number) => {
      const newX = Math.round(Math.max(1, Math.min(99, 100 - y)) * 10) / 10;
      const newY = Math.round(Math.max(1, Math.min(99, x)) * 10) / 10;
      return { x: newX, y: newY };
    };

    const oldZonePins = floor.cadZonePins || [];
    const oldElementPins = floor.cadElementPins || [];

    const shouldRotateZonePins = !isStruct || !hasSeparateStructCad;
    const shouldRotateElementPins = isStruct || !hasSeparateStructCad;

    const updatedZonePins = shouldRotateZonePins
      ? oldZonePins.map((p) => {
          const pX = Number(p.pinX ?? p.pin_x ?? 50);
          const pY = Number(p.pinY ?? p.pin_y ?? 50);
          const { x: newX, y: newY } = transformCoords(pX, pY);
          return { ...p, pinX: newX, pinY: newY, pin_x: newX, pin_y: newY };
        })
      : oldZonePins;

    const updatedElementPins = shouldRotateElementPins
      ? oldElementPins.map((p) => {
          const pX = Number(p.pinX ?? p.pin_x ?? 50);
          const pY = Number(p.pinY ?? p.pin_y ?? 50);
          const { x: newX, y: newY } = transformCoords(pX, pY);
          return { ...p, pinX: newX, pinY: newY, pin_x: newX, pin_y: newY };
        })
      : oldElementPins;

    setUndoPinStack((prev) => [
      ...prev.slice(-19),
      {
        type: 'CAD_ROTATE',
        floorId: floor.id,
        floorIndex: floorIdx,
        cadKey,
        prevRotation: curRot,
        prevZonePins: oldZonePins,
        prevElementPins: oldElementPins,
      },
    ]);

    if (hasFloors) {
      const updatedFloors = rawFloors.map((fl: FloorSurveyData, fi: number) => {
        if (fi !== floorIdx) return fl;
        return {
          ...fl,
          cadZonePins: updatedZonePins,
          cadElementPins: updatedElementPins,
          ...(shouldRotateZonePins ? { cadSketchRotation: nextRotation } : {}),
        };
      });
      handleFieldChange('floors', `Xoay CAD ${isStruct ? 'Kết cấu' : 'Kiến trúc'} tầng ${floor.floorName || floorIdx + 1} 90°`, updatedFloors);
    }
  };

  // Rotate Zone CTX photo with defect pins transformation
  const handleRotateZoneCtx = (floorIdx: number, zone: DamageZoneData, currentRot: number, rotKey: string) => {
    const nextRotation = (currentRot + 90) % 360;
    onRotatePhoto?.(rotKey, nextRotation);
    const zCode = zone.zoneCode || zone.zone_code || 'Z-01';

    const transformDefectCoords = (x: number, y: number) => {
      const newX = Math.round(Math.max(1, Math.min(99, 100 - y)) * 10) / 10;
      const newY = Math.round(Math.max(1, Math.min(99, x)) * 10) / 10;
      return { x: newX, y: newY };
    };

    if (hasFloors) {
      const updatedFloors = rawFloors.map((fl: FloorSurveyData, fi: number) => {
        if (fi !== floorIdx) return fl;
        const zones = (fl.zones || []).map((z: DamageZoneData) => {
          if (z.id !== zone.id && (z.zoneCode || z.zone_code) !== zCode) return z;
          const defects = (z.defects || []).map((d: DefectItem) => {
            const pX = Number(d.pinX ?? d.pin_x ?? 50);
            const pY = Number(d.pinY ?? d.pin_y ?? 50);
            const { x: newX, y: newY } = transformDefectCoords(pX, pY);
            return { ...d, pinX: newX, pinY: newY, pin_x: newX, pin_y: newY };
          });
          return { ...z, defects };
        });
        return { ...fl, zones };
      });
      handleFieldChange('floors', `Xoay ảnh CTX ${zCode} 90° & chuyển vị ghim D`, updatedFloors);
    } else {
      const updatedZones = rawDamageZones.map((z: DamageZoneData) => {
        if (z.id !== zone.id && (z.zoneCode || z.zone_code) !== zCode) return z;
        const defects = (z.defects || []).map((d: DefectItem) => {
          const pX = Number(d.pinX ?? d.pin_x ?? 50);
          const pY = Number(d.pinY ?? d.pin_y ?? 50);
          const { x: newX, y: newY } = transformDefectCoords(pX, pY);
          return { ...d, pinX: newX, pinY: newY, pin_x: newX, pin_y: newY };
        });
        return { ...z, defects };
      });
      handleFieldChange('damageZones', `Xoay ảnh CTX ${zCode} 90° & chuyển vị ghim D`, updatedZones);
    }
  };

  // Rotate Element CTX photo
  const handleRotateElementCtx = (
    floorIdx: number,
    elem: StructuralElementData,
    currentRot: number,
    rotKey: string,
    deltaDeg: number = 90
  ) => {
    const nextRotation = ((currentRot + deltaDeg) % 360 + 360) % 360;
    const delta = ((deltaDeg % 360) + 360) % 360;
    onRotatePhoto?.(rotKey, nextRotation);
    const eCode = elem.elementCode || elem.element_code || 'E-01';

    const transformDefectCoords = (x: number, y: number) => {
      if (delta === 270) {
        const newX = Math.round(Math.max(1, Math.min(99, y)) * 10) / 10;
        const newY = Math.round(Math.max(1, Math.min(99, 100 - x)) * 10) / 10;
        return { x: newX, y: newY };
      }
      if (delta === 180) {
        const newX = Math.round(Math.max(1, Math.min(99, 100 - x)) * 10) / 10;
        const newY = Math.round(Math.max(1, Math.min(99, 100 - y)) * 10) / 10;
        return { x: newX, y: newY };
      }
      const newX = Math.round(Math.max(1, Math.min(99, 100 - y)) * 10) / 10;
      const newY = Math.round(Math.max(1, Math.min(99, x)) * 10) / 10;
      return { x: newX, y: newY };
    };

    if (hasFloors) {
      const updatedFloors = rawFloors.map((fl: FloorSurveyData, fi: number) => {
        if (fi !== floorIdx) return fl;
        const structuralElements = (fl.structuralElements || []).map((e: StructuralElementData) => {
          if (e.id !== elem.id && (e.elementCode || e.element_code) !== eCode) return e;
          const defects = (e.defects || []).map((d: DefectItem) => {
            const pX = Number(d.pinX ?? d.pin_x ?? 50);
            const pY = Number(d.pinY ?? d.pin_y ?? 50);
            const { x: newX, y: newY } = transformDefectCoords(pX, pY);
            return { ...d, pinX: newX, pinY: newY, pin_x: newX, pin_y: newY };
          });
          return { ...e, defects };
        });
        return { ...fl, structuralElements };
      });
      handleFieldChange('floors', `Xoay ảnh CTX ${eCode} 90° & chuyển vị ghim D`, updatedFloors);
    }
  };

  // Click-to-pin CAD (Z or E)
  const handleCadImageClick = (e: React.MouseEvent<HTMLDivElement>, floorIdx: number, mode: 'Z' | 'E') => {
    if (!cadPinningMode || cadPinningMode.floorIdx !== floorIdx || cadPinningMode.mode !== mode) return;
    const container = e.currentTarget;
    const rect = container.getBoundingClientRect();
    const rawX = ((e.clientX - rect.left) / rect.width) * 100;
    const rawY = ((e.clientY - rect.top) / rect.height) * 100;
    const pinX = Math.round(Math.max(2, Math.min(98, rawX)) * 10) / 10;
    const pinY = Math.round(Math.max(2, Math.min(98, rawY)) * 10) / 10;

    const floor = floorsList[floorIdx];
    const isStruct = mode === 'E';
    const prefix = isStruct ? 'E' : 'Z';
    const pinsToCheck = isStruct
      ? (Array.isArray(floor.cadElementPins) ? floor.cadElementPins : [])
      : (Array.isArray(floor.cadZonePins) ? floor.cadZonePins : []);
    const historicalCodes = isStruct
      ? (floor.structuralElements || []).map((el) => el.elementCode || '')
      : (floor.zones || []).map((z) => z.zoneCode || z.zone_code || '');
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
        if (fi !== floorIdx) return fl;
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
  const handleCommitDefectPinCoord = (floorIdx: number, zoneId: string, defectId: string, dCode: string, newX: number, newY: number) => {
    if (hasFloors) {
      const updatedFloors = rawFloors.map((fl: FloorSurveyData, fi: number) => {
        if (fi !== floorIdx) return fl;
        const zones = (fl.zones || []).map((z: DamageZoneData) => {
          if (z.id !== zoneId && (z.zoneCode || z.zone_code) !== zoneId) return z;
          const defects = (z.defects || []).map((d: DefectItem) => {
            if (d.id !== defectId && d.defectCode !== defectId) return d;
            return { ...d, pinX: newX, pinY: newY, pin_x: newX, pin_y: newY };
          });
          return { ...z, defects };
        });
        const structuralElements = (fl.structuralElements || []).map((e: StructuralElementData) => {
          if (e.id !== zoneId && (e.elementCode || e.element_code) !== zoneId) return e;
          const defects = (e.defects || []).map((d: DefectItem) => {
            if (d.id !== defectId && d.defectCode !== defectId) return d;
            return { ...d, pinX: newX, pinY: newY, pin_x: newX, pin_y: newY };
          });
          return { ...e, defects };
        });
        return { ...fl, zones, structuralElements };
      });
      handleFieldChange('floors', `Điều chỉnh vị trí ghim ${dCode} (${newX}%, ${newY}%)`, updatedFloors);
    }
  };

  // Click-to-pin D on CTX photo
  const handleCtxImageClick = (e: React.MouseEvent<HTMLDivElement>, floorIdx: number, zone: DamageZoneData) => {
    const zCode = zone.zoneCode || zone.zone_code || 'Z-01';
    if (!pinningCtxZone || pinningCtxZone.floorIdx !== floorIdx || pinningCtxZone.zoneOrElemCode !== zCode) return;
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
      defectType: ARCH_DEFECT_TYPES[0],
      screeningCategory: ARCH_SCREENING_CATEGORIES[0],
      widthMaxMm: 0.2,
      burlandGrade: getBurlandGradeFromWidth(0.2),
      lengthMm: 100,
      depthMm: 5,
      pinX,
      pinY,
      pin_x: pinX,
      pin_y: pinY,
      materialDegradationE4: 0,
      structuralSignificanceE2: 1,
      functionalImpactE6: 1,
      isStructuralCritical: false,
      crackDirection: 'Ngang',
      activityState: 'S',
      hasScaleCard: true,
      notes: '',
      cuPhotoUrl: '',
      cuPhotos: [],
    };

    if (hasFloors) {
      const updatedFloors = rawFloors.map((fl: FloorSurveyData, fi: number) => {
        if (fi !== floorIdx) return fl;
        const zones = (fl.zones || []).map((z: DamageZoneData) => {
          if (z.id !== zone.id && (z.zoneCode || z.zone_code) !== zCode) return z;
          const currentDefects = Array.isArray(z.defects) ? z.defects : [];
          return syncZoneBurlandGrade(z, [...currentDefects, newDefect]);
        });
        return { ...fl, zones };
      });
      handleFieldChange('floors', `Thêm khuyết tật ${nextDCode} tại (${pinX}%, ${pinY}%)`, updatedFloors);
    }
    setPinningCtxZone(null);

    if (onOpenPhotoAction) {
      onOpenPhotoAction({
        initialMode: 'ADD',
        category: 'DEFECT_CU',
        targetPhotoType: 'CU',
        targetPhotoId: nextDCode,
        defectId: newDefectId,
        defectCode: nextDCode,
        floorCode: floorsList[floorIdx]?.floorName,
        zoneCode: zCode,
        initialPinX: pinX,
        initialPinY: pinY,
        photoTitle: `Khuyết tật ${nextDCode} (${zCode})`,
      });
    }
  };

  // Click-to-pin D on Structural Element E CTX photo
  const handleElemCtxImageClick = (e: React.MouseEvent<HTMLDivElement>, floorIdx: number, elem: StructuralElementData) => {
    const eCode = elem.elementCode || elem.element_code || 'E-01';
    if (!pinningCtxZone || pinningCtxZone.floorIdx !== floorIdx || pinningCtxZone.zoneOrElemCode !== eCode) return;
    const container = e.currentTarget;
    const rect = container.getBoundingClientRect();
    const rawX = ((e.clientX - rect.left) / rect.width) * 100;
    const rawY = ((e.clientY - rect.top) / rect.height) * 100;
    const pinX = Math.round(Math.max(2, Math.min(98, rawX)) * 10) / 10;
    const pinY = Math.round(Math.max(2, Math.min(98, rawY)) * 10) / 10;

    const defectsList: DefectItem[] = Array.isArray(elem.defects) ? elem.defects : [];
    const historicalDCodes = defectsList.map((d) => d.defectCode || d.defect_code || '');
    const nextDCode = getNextAvailablePinCode(
      defectsList.map((d) => ({ zoneCode: d.defectCode || d.defect_code })),
      'D',
      historicalDCodes
    );

    const newDefectId = `elem-defect-${Date.now()}`;
    const newDefect: DefectItem = {
      id: newDefectId,
      defectCode: nextDCode,
      defectType: STRUCT_DEFECT_TYPES[0],
      screeningCategory: STRUCT_SCREENING_CATEGORIES[0],
      widthMaxMm: 0.3,
      lengthMm: 150,
      depthMm: 5,
      pinX,
      pinY,
      pin_x: pinX,
      pin_y: pinY,
      materialDegradationE4: 1,
      structuralSignificanceE2: 1,
      functionalImpactE6: 1,
      isStructuralCritical: true,
      crackDirection: 'Ngang',
      activityState: 'S',
      hasScaleCard: true,
      notes: '',
      cuPhotoUrl: '',
      cuPhotos: [],
    };

    if (hasFloors) {
      const updatedFloors = rawFloors.map((fl: FloorSurveyData, fi: number) => {
        if (fi !== floorIdx) return fl;
        const structuralElements = (fl.structuralElements || []).map((el: StructuralElementData) => {
          if (el.id !== elem.id && (el.elementCode || el.element_code) !== eCode) return el;
          const currentDefects = Array.isArray(el.defects) ? el.defects : [];
          return { ...el, defects: [...currentDefects, newDefect] };
        });
        return { ...fl, structuralElements };
      });
      handleFieldChange('floors', `Thêm khuyết tật ${nextDCode} vào cấu kiện ${eCode} tại (${pinX}%, ${pinY}%)`, updatedFloors);
    }
    setPinningCtxZone(null);

    if (onOpenPhotoAction) {
      onOpenPhotoAction({
        initialMode: 'ADD',
        category: 'DEFECT_CU',
        targetPhotoType: 'CU',
        targetPhotoId: nextDCode,
        defectId: newDefectId,
        defectCode: nextDCode,
        floorCode: floorsList[floorIdx]?.floorName,
        zoneCode: eCode,
        initialPinX: pinX,
        initialPinY: pinY,
        photoTitle: `Khuyết tật ${nextDCode} (${eCode})`,
      });
    }
  };

  // Handle changing defect properties in floors or damageZones
  const handleDefectChange = (floorIdx: number, zoneId: string, defectId: string, field: string, val: unknown, fieldLabel: string) => {
    const updateSingleDefect = (d: DefectItem): DefectItem => {
      const dCode = d.defectCode || d.defect_code || '';
      if (d.id !== defectId && dCode !== defectId) return d;
      const nextD: DefectItem = { ...d, [field]: val };
      if (field === 'widthMaxMm') {
        nextD.burlandGrade = getBurlandGradeFromWidth(Number(val) || 0);
      }
      if (field === 'screeningCategory' || field === 'defectType') {
        const nextCat = field === 'screeningCategory' ? String(val || '') : d.screeningCategory;
        const nextType = field === 'defectType' ? String(val || '') : d.defectType;
        if (!isCrackRelated(nextCat, nextType)) {
          nextD.widthMaxMm = 0;
          nextD.lengthMm = 0;
          nextD.burlandGrade = 0;
        }
      }
      return nextD;
    };

    if (hasFloors) {
      const updatedFloors = rawFloors.map((fl: FloorSurveyData, fi: number) => {
        if (fi !== floorIdx) return fl;
        const zones = (fl.zones || []).map((z: DamageZoneData) => {
          if (z.id !== zoneId && (z.zoneCode || z.zone_code) !== zoneId) return z;
          const defects = (z.defects || []).map(updateSingleDefect);
          return syncZoneBurlandGrade(z, defects);
        });
        return { ...fl, zones };
      });
      handleFieldChange('floors', `Khuyết tật ${fieldLabel}`, updatedFloors);
    }
  };

  // Handle changing zone fields
  const handleZoneFieldChange = (floorIdx: number, zoneId: string, field: string, val: unknown, fieldLabel: string) => {
    if (hasFloors) {
      const updatedFloors = rawFloors.map((fl: FloorSurveyData, fi: number) => {
        if (fi !== floorIdx) return fl;
        const zones = (fl.zones || []).map((z: DamageZoneData) => {
          if (z.id !== zoneId && (z.zoneCode || z.zone_code) !== zoneId) return z;
          return { ...z, [field]: val };
        });
        return { ...fl, zones };
      });
      handleFieldChange('floors', `Vùng Z (${fieldLabel})`, updatedFloors);
    }
  };

  // Add new defect to a zone
  const handleAddDefect = (floorIdx: number, zoneId: string) => {
    const newDefectId = `defect-${Date.now()}`;
    let createdDCode = 'D-01';

    if (hasFloors) {
      const updatedFloors = rawFloors.map((fl: FloorSurveyData, fi: number) => {
        if (fi !== floorIdx) return fl;
        const zones = (fl.zones || []).map((z: DamageZoneData) => {
          if (z.id !== zoneId && (z.zoneCode || z.zone_code) !== zoneId) return z;
          const currentDefects = Array.isArray(z.defects) ? z.defects : [];
          const historicalDCodes = currentDefects.map((d: DefectItem) => d.defectCode || d.defect_code || '');
          const nextDCode = getNextAvailablePinCode(
            currentDefects.map((d: DefectItem) => ({ zoneCode: d.defectCode || d.defect_code })),
            'D',
            historicalDCodes
          );
          createdDCode = nextDCode;
          const newDefect: DefectItem = {
            id: newDefectId,
            defectCode: nextDCode,
            defectType: ARCH_DEFECT_TYPES[0],
            screeningCategory: ARCH_SCREENING_CATEGORIES[0],
            widthMaxMm: 0.2,
            burlandGrade: getBurlandGradeFromWidth(0.2),
            lengthMm: 100,
            depthMm: 5,
            pinX: 50,
            pinY: 50,
            pin_x: 50,
            pin_y: 50,
            materialDegradationE4: 0,
            structuralSignificanceE2: 1,
            functionalImpactE6: 1,
            isStructuralCritical: false,
            crackDirection: 'Ngang',
            activityState: 'S',
            hasScaleCard: true,
            notes: '',
            cuPhotoUrl: '',
            cuPhotos: [],
          };
          return syncZoneBurlandGrade(z, [...currentDefects, newDefect]);
        });
        return { ...fl, zones };
      });
      handleFieldChange('floors', `Thêm khuyết tật ${createdDCode}`, updatedFloors);
    }
  };

  // Soft-remove defect from a zone
  const handleRemoveDefect = (floorIdx: number, zoneId: string, defectId: string) => {
    if (hasFloors) {
      const updatedFloors = rawFloors.map((fl: FloorSurveyData, fi: number) => {
        if (fi !== floorIdx) return fl;
        const zones = (fl.zones || []).map((z: DamageZoneData) => {
          if (z.id !== zoneId && (z.zoneCode || z.zone_code) !== zoneId) return z;
          const defects = (z.defects || []).map((d: DefectItem) => {
            const dCode = d.defectCode || d.defect_code || '';
            if (d.id !== defectId && dCode !== defectId) return d;
            return { ...d, is_deleted: true, isDeleted: true };
          });
          return syncZoneBurlandGrade(z, defects);
        });
        return { ...fl, zones };
      });
      handleFieldChange('floors', `Xóa mềm khuyết tật ${defectId}`, updatedFloors);
    }
  };

  // Restore defect
  const handleRestoreDefect = (floorIdx: number, zoneId: string, defectId: string) => {
    if (hasFloors) {
      const updatedFloors = rawFloors.map((fl: FloorSurveyData, fi: number) => {
        if (fi !== floorIdx) return fl;
        const zones = (fl.zones || []).map((z: DamageZoneData) => {
          if (z.id !== zoneId && (z.zoneCode || z.zone_code) !== zoneId) return z;
          const defects = (z.defects || []).map((d: DefectItem) => {
            const dCode = d.defectCode || d.defect_code || '';
            if (d.id !== defectId && dCode !== defectId) return d;
            return { ...d, is_deleted: false, isDeleted: false };
          });
          return syncZoneBurlandGrade(z, defects);
        });
        return { ...fl, zones };
      });
      handleFieldChange('floors', `Khôi phục khuyết tật ${defectId}`, updatedFloors);
    }
  };

  // Request zone deletion
  const handleRemoveZone = (floorIdx: number, zone: DamageZoneData) => {
    const activeChildDefects = (zone.defects || []).filter((d: DefectItem) => !isItemSoftDeleted(d));
    if (activeChildDefects.length > 0) {
      setZoneToDelete({ floorIdx, zone });
      return;
    }
    executeSoftDeleteZone(floorIdx, zone);
  };

  // Execute cascade soft-delete on zone and its defects (syncing cadZonePins)
  const executeSoftDeleteZone = (floorIdx: number, zone: DamageZoneData) => {
    const zCode = zone.zoneCode || zone.zone_code || 'Z-??';
    if (hasFloors) {
      const updatedFloors = rawFloors.map((fl: FloorSurveyData, fi: number) => {
        if (fi !== floorIdx) return fl;
        const zones = (fl.zones || []).map((z: DamageZoneData) => {
          if (z.id !== zone.id && (z.zoneCode || z.zone_code) !== zCode) return z;
          const defects = (z.defects || []).map((d: DefectItem) => ({ ...d, is_deleted: true, isDeleted: true }));
          return syncZoneBurlandGrade({ ...z, is_deleted: true, isDeleted: true }, defects);
        });
        const cadZonePins = (fl.cadZonePins || []).map((p: CadZonePin) => {
          if ((p.zoneCode || p.zone_code) === zCode) {
            return { ...p, is_deleted: true, isDeleted: true } as CadZonePin;
          }
          return p;
        });
        return { ...fl, zones, cadZonePins };
      });
      handleFieldChange('floors', `Xóa mềm Vùng ${zCode} và các khuyết tật con`, updatedFloors);
    }
    setZoneToDelete(null);
  };

  // Restore zone and its defects (syncing cadZonePins)
  const handleRestoreZone = (floorIdx: number, zone: DamageZoneData) => {
    const zCode = zone.zoneCode || zone.zone_code || 'Z-??';
    if (hasFloors) {
      const updatedFloors = rawFloors.map((fl: FloorSurveyData, fi: number) => {
        if (fi !== floorIdx) return fl;
        const zones = (fl.zones || []).map((z: DamageZoneData) => {
          if (z.id !== zone.id && (z.zoneCode || z.zone_code) !== zCode) return z;
          const defects = (z.defects || []).map((d: DefectItem) => ({ ...d, is_deleted: false, isDeleted: false }));
          return syncZoneBurlandGrade({ ...z, is_deleted: false, isDeleted: false }, defects);
        });
        const cadZonePins = (fl.cadZonePins || []).map((p: CadZonePin) => {
          if ((p.zoneCode || p.zone_code) === zCode) {
            return { ...p, is_deleted: false, isDeleted: false } as CadZonePin;
          }
          return p;
        });
        return { ...fl, zones, cadZonePins };
      });
      handleFieldChange('floors', `Khôi phục Vùng ${zCode} và các khuyết tật con`, updatedFloors);
    }
  };

  // Direct add zone button on header
  const handleAddZoneDirect = (floorIdx: number) => {
    const floor = floorsList[floorIdx];
    if (!floor) return;
    const currentZones = floor.zones || [];
    const historicalCodes = currentZones.map((z) => z.zoneCode || z.zone_code || '');
    const nextZCode = getNextAvailablePinCode(
      currentZones.map((z) => ({ zoneCode: z.zoneCode || z.zone_code })),
      'Z',
      historicalCodes
    );
    const newZone: DamageZoneData = {
      id: `zone-${Date.now()}`,
      zoneCode: nextZCode,
      floorName: floor.floorName || 'Tầng',
      roomName: 'Không gian mới',
      componentType: 'Tường ngăn',
      wallMaterial: 'Gạch ống (2 lỗ / 4 lỗ)',
      notes: '',
      defects: [],
      overviewPhotos: [],
    };
    if (hasFloors) {
      const updatedFloors = rawFloors.map((fl: FloorSurveyData, fi: number) => {
        if (fi !== floorIdx) return fl;
        return { ...fl, zones: [...(fl.zones || []), newZone] };
      });
      handleFieldChange('floors', `Thêm vùng ${nextZCode}`, updatedFloors);
    }
  };

  // Handle changing element fields
  const handleElementFieldChange = (floorIdx: number, elemId: string, field: string, val: unknown, fieldLabel: string) => {
    if (hasFloors) {
      const updatedFloors = rawFloors.map((fl: FloorSurveyData, fi: number) => {
        if (fi !== floorIdx) return fl;
        const structuralElements = (fl.structuralElements || []).map((e: StructuralElementData) => {
          if (e.id !== elemId && (e.elementCode || e.element_code) !== elemId) return e;
          return { ...e, [field]: val };
        });
        return { ...fl, structuralElements };
      });
      handleFieldChange('floors', `Cấu kiện E (${fieldLabel})`, updatedFloors);
    }
  };

  // Handle changing defect properties in structural elements
  const handleElementDefectChange = (floorIdx: number, elemId: string, defectId: string, field: string, val: unknown, fieldLabel: string) => {
    if (hasFloors) {
      const updatedFloors = rawFloors.map((fl: FloorSurveyData, fi: number) => {
        if (fi !== floorIdx) return fl;
        const structuralElements = (fl.structuralElements || []).map((e: StructuralElementData) => {
          if (e.id !== elemId && (e.elementCode || e.element_code) !== elemId) return e;
          const defects = (e.defects || []).map((d: DefectItem) => {
            const dCode = d.defectCode || d.defect_code || '';
            if (d.id !== defectId && dCode !== defectId) return d;
            const nextD: DefectItem = { ...d, [field]: val };
            if (field === 'widthMaxMm') {
              nextD.burlandGrade = getBurlandGradeFromWidth(Number(val) || 0);
            }
            if (field === 'screeningCategory' || field === 'defectType') {
              const nextCat = field === 'screeningCategory' ? String(val || '') : d.screeningCategory;
              const nextType = field === 'defectType' ? String(val || '') : d.defectType;
              if (!isCrackRelated(nextCat, nextType)) {
                nextD.widthMaxMm = 0;
                nextD.lengthMm = 0;
              }
            }
            return nextD;
          });
          return { ...e, defects };
        });
        return { ...fl, structuralElements };
      });
      handleFieldChange('floors', `Khuyết tật cấu kiện E (${fieldLabel})`, updatedFloors);
    }
  };

  // Add new defect to a structural element E
  const handleAddElementDefect = (floorIdx: number, elemId: string) => {
    if (!hasFloors) return;
    const newDefectId = `elem-defect-${Date.now()}`;
    let createdDCode = 'D-01';
    const updatedFloors = rawFloors.map((fl: FloorSurveyData, fi: number) => {
      if (fi !== floorIdx) return fl;
      const structuralElements = (fl.structuralElements || []).map((e: StructuralElementData) => {
        if (e.id !== elemId && (e.elementCode || e.element_code) !== elemId) return e;
        const currentDefects = Array.isArray(e.defects) ? e.defects : [];
        const historicalDCodes = currentDefects.map((d: DefectItem) => d.defectCode || d.defect_code || '');
        const nextDCode = getNextAvailablePinCode(
          currentDefects.map((d: DefectItem) => ({ zoneCode: d.defectCode || d.defect_code })),
          'D',
          historicalDCodes
        );
        createdDCode = nextDCode;
        const newDefect: DefectItem = {
          id: newDefectId,
          defectCode: nextDCode,
          defectType: STRUCT_DEFECT_TYPES[0],
          screeningCategory: STRUCT_SCREENING_CATEGORIES[0],
          widthMaxMm: 0.3,
          lengthMm: 150,
          depthMm: 5,
          pinX: 50,
          pinY: 50,
          pin_x: 50,
          pin_y: 50,
          materialDegradationE4: 1,
          structuralSignificanceE2: 1,
          functionalImpactE6: 1,
          isStructuralCritical: true,
          crackDirection: 'Ngang',
          activityState: 'S',
          hasScaleCard: true,
          notes: '',
          cuPhotoUrl: '',
          cuPhotos: [],
        };
        return { ...e, defects: [...currentDefects, newDefect] };
      });
      return { ...fl, structuralElements };
    });
    handleFieldChange('floors', `Thêm khuyết tật ${createdDCode} vào cấu kiện ${elemId}`, updatedFloors);
  };

  // Soft-remove defect from structural element E
  const handleRemoveElementDefect = (floorIdx: number, elemId: string, defectId: string) => {
    if (!hasFloors) return;
    const updatedFloors = rawFloors.map((fl: FloorSurveyData, fi: number) => {
      if (fi !== floorIdx) return fl;
      const structuralElements = (fl.structuralElements || []).map((e: StructuralElementData) => {
        if (e.id !== elemId && (e.elementCode || e.element_code) !== elemId) return e;
        const defects = (e.defects || []).map((d: DefectItem) => {
          const dCode = d.defectCode || d.defect_code || '';
          if (d.id !== defectId && dCode !== defectId) return d;
          return { ...d, is_deleted: true, isDeleted: true };
        });
        return { ...e, defects };
      });
      return { ...fl, structuralElements };
    });
    handleFieldChange('floors', `Xóa mềm khuyết tật ${defectId} của cấu kiện ${elemId}`, updatedFloors);
  };

  // Restore defect on structural element E
  const handleRestoreElementDefect = (floorIdx: number, elemId: string, defectId: string) => {
    if (!hasFloors) return;
    const updatedFloors = rawFloors.map((fl: FloorSurveyData, fi: number) => {
      if (fi !== floorIdx) return fl;
      const structuralElements = (fl.structuralElements || []).map((e: StructuralElementData) => {
        if (e.id !== elemId && (e.elementCode || e.element_code) !== elemId) return e;
        const defects = (e.defects || []).map((d: DefectItem) => {
          const dCode = d.defectCode || d.defect_code || '';
          if (d.id !== defectId && dCode !== defectId) return d;
          return { ...d, is_deleted: false, isDeleted: false };
        });
        return { ...e, defects };
      });
      return { ...fl, structuralElements };
    });
    handleFieldChange('floors', `Khôi phục khuyết tật ${defectId} của cấu kiện ${elemId}`, updatedFloors);
  };

  // Soft-remove structural element (syncing cadElementPins)
  const handleRemoveElement = (floorIdx: number, elemId: string) => {
    if (hasFloors) {
      const updatedFloors = rawFloors.map((fl: FloorSurveyData, fi: number) => {
        if (fi !== floorIdx) return fl;
        let deletedECode = elemId;
        const structuralElements = (fl.structuralElements || []).map((e: StructuralElementData) => {
          const eCode = e.elementCode || e.element_code || '';
          if (e.id !== elemId && eCode !== elemId) return e;
          if (eCode) deletedECode = eCode;
          const defects = (e.defects || []).map((d: DefectItem) => ({ ...d, is_deleted: true, isDeleted: true }));
          return { ...e, is_deleted: true, isDeleted: true, defects };
        });
        const cadElementPins = (fl.cadElementPins || []).map((p: CadZonePin) => {
          if ((p.zoneCode || p.zone_code) === deletedECode) {
            return { ...p, is_deleted: true, isDeleted: true } as CadZonePin;
          }
          return p;
        });
        return { ...fl, structuralElements, cadElementPins };
      });
      handleFieldChange('floors', `Xóa mềm cấu kiện E ${elemId}`, updatedFloors);
    }
  };

  // Restore structural element (syncing cadElementPins)
  const handleRestoreElement = (floorIdx: number, elemId: string) => {
    if (hasFloors) {
      const updatedFloors = rawFloors.map((fl: FloorSurveyData, fi: number) => {
        if (fi !== floorIdx) return fl;
        let restoredECode = elemId;
        const structuralElements = (fl.structuralElements || []).map((e: StructuralElementData) => {
          const eCode = e.elementCode || e.element_code || '';
          if (e.id !== elemId && eCode !== elemId) return e;
          if (eCode) restoredECode = eCode;
          const defects = (e.defects || []).map((d: DefectItem) => ({ ...d, is_deleted: false, isDeleted: false }));
          return { ...e, is_deleted: false, isDeleted: false, defects };
        });
        const cadElementPins = (fl.cadElementPins || []).map((p: CadZonePin) => {
          if ((p.zoneCode || p.zone_code) === restoredECode) {
            return { ...p, is_deleted: false, isDeleted: false } as CadZonePin;
          }
          return p;
        });
        return { ...fl, structuralElements, cadElementPins };
      });
      handleFieldChange('floors', `Khôi phục cấu kiện E ${elemId}`, updatedFloors);
    }
  };

  // Direct add element button
  const handleAddElementDirect = (floorIdx: number) => {
    const floor = floorsList[floorIdx];
    if (!floor) return;
    const currentElems = floor.structuralElements || [];
    const historicalCodes = currentElems.map((e) => e.elementCode || e.element_code || '');
    const nextECode = getNextAvailablePinCode(
      currentElems.map((e) => ({ zoneCode: e.elementCode || e.element_code })),
      'E',
      historicalCodes
    );
    const newElem: StructuralElementData = {
      id: `elem-${Date.now()}`,
      elementCode: nextECode,
      elementType: 'Cột BTCT',
      materialType: 'Bê tông cốt thép (BTCT)',
      roomName: '',
      floorName: floor.floorName || 'Tầng',
      notes: '',
      defects: [],
      overviewPhotos: [],
    };
    if (hasFloors) {
      const updatedFloors = rawFloors.map((fl: FloorSurveyData, fi: number) => {
        if (fi !== floorIdx) return fl;
        return { ...fl, structuralElements: [...(fl.structuralElements || []), newElem] };
      });
      handleFieldChange('floors', `Thêm cấu kiện ${nextECode}`, updatedFloors);
    }
  };

  // Counts for summary badge
  const totalZonesCount = floorsList.reduce(
    (sum, f) => sum + (f.zones || []).filter((z: DamageZoneData) => !isItemSoftDeleted(z)).length,
    0
  );
  const totalDefectsCount = floorsList.reduce(
    (sum, f) =>
      sum +
      (f.zones || [])
        .filter((z: DamageZoneData) => !isItemSoftDeleted(z))
        .reduce((zSum: number, z: DamageZoneData) => zSum + (z.defects || []).filter((d: DefectItem) => isDefectActive(d)).length, 0) +
      (f.structuralElements || [])
        .filter((e: StructuralElementData) => !isItemSoftDeleted(e))
        .reduce((eSum: number, e: StructuralElementData) => eSum + (e.defects || []).filter((d: DefectItem) => isDefectActive(d)).length, 0),
    0
  );

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
              Trải phẳng tuần tự các tầng (CAD_Z &rarr; Vùng Z &rarr; CAD_E &rarr; Cấu kiện E), ghim toạ độ và dải ảnh cận cảnh chi tiết
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="info" size="sm">
            {floorsList.length} Tầng &bull; {totalZonesCount} Vùng Z &bull; {totalDefectsCount} Khuyết tật D
          </Badge>
        </div>
      </div>

      <div className="p-5 space-y-8">
        {/* Quick jump pills at top of Step 4 */}
        {floorsList.length > 1 && (
          <div className="sticky top-0 z-20 -mx-5 px-5 py-2.5 bg-white/95 backdrop-blur-xs border-b border-slate-200/80 flex items-center gap-2 overflow-x-auto scrollbar-thin shadow-2xs">
            <span className="text-[11px] font-bold text-slate-500 whitespace-nowrap">Cuộn nhanh tới tầng:</span>
            {floorsList.map((fl, idx) => (
              <button
                key={fl.id || idx}
                type="button"
                onClick={() => {
                  const target = document.getElementById(`step-4-floor-${idx}`);
                  if (target) {
                    target.scrollIntoView({ behavior: 'smooth', block: 'start' });
                  }
                }}
                className="px-3 py-1 rounded-xl text-xs font-bold bg-slate-100 hover:bg-sky-50 hover:text-sky-700 text-slate-700 border border-slate-200 transition-colors flex items-center gap-1.5 whitespace-nowrap cursor-pointer"
              >
                <Layers className="w-3.5 h-3.5 text-slate-500" />
                <span>{fl.floorName || `Tầng ${idx + 1}`}</span>
              </button>
            ))}
          </div>
        )}

        {/* Trải phẳng tuần tự TẤT CẢ các tầng: Floor n (CAD_Z -> Z -> CAD_E -> E) */}
        {floorsList.map((fl, flIdx) => {
          const floorNumber = getFloorNumberVal(fl, flIdx);
          const floorName = fl.floorName || `Tầng ${flIdx + 1}`;

          const zones = Array.isArray(fl.zones) ? fl.zones : [];
          const elements = Array.isArray(fl.structuralElements) ? fl.structuralElements : [];
          const activeZones = zones.filter((z) => !isItemSoftDeleted(z));
          const deletedZones = zones.filter((z) => isItemSoftDeleted(z));
          const displayedZones = showDeletedItems ? zones : activeZones;

          const activeElements = elements.filter((e) => !isItemSoftDeleted(e));
          const deletedElements = elements.filter((e) => isItemSoftDeleted(e));
          const displayedElements = showDeletedItems ? elements : activeElements;

          // CAD_Z (Kiến trúc) - Đồng bộ 100% photoKey với usePhotoOrientationAudit
          const fId = fl.id ? String(fl.id) : String(flIdx);
          const baseCadKey = fId.startsWith('floor_') ? `${fId}_cad` : `floor_${fId}_cad`;
          const legacyCadKey = `floor_${fl.id || flIdx}_cad`;
          const cadPhotoUrl = fl.cadSketchPhotoUrl || fl.cad_drawing_url || '';
          const stagedCad = getStagedAction({
            category: 'CAD_FLOOR',
            targetPhotoId: fl.id || String(floorNumber),
            url: cadPhotoUrl || undefined,
            includeAdd: !cadPhotoUrl,
          });
          const effectiveCad = stagedCad?.action === 'DELETE' ? '' : (stagedCad?.newPhotoUrl || cadPhotoUrl);
          const cadRotation =
            stagedPhotoRotations[baseCadKey] ??
            stagedPhotoRotations[legacyCadKey] ??
            ((fl as FloorSurveyData & AuditExtendedMeta).cadSketchRotation ?? 0);
          const cadViolation =
            violationsMap?.get(baseCadKey) ||
            violationsMap?.get(legacyCadKey) ||
            (effectiveCad ? violationsMap?.get(effectiveCad) : undefined);
          const cadZonePins = Array.isArray(fl.cadZonePins) ? fl.cadZonePins : [];
          const displayedCadZonePins = cadZonePins.filter((p) => {
            if (showDeletedItems) return true;
            const pinCode = p.zoneCode || p.zone_code || '';
            return !deletedZones.some((dz) => (dz.zoneCode || dz.zone_code) === pinCode);
          });

          // CAD_E (Kết cấu) - Đồng bộ 100% photoKey với usePhotoOrientationAudit
          const baseStructCadKey = fId.startsWith('floor_')
            ? `${fId}_structural_cad`
            : `floor_${fId}_structural_cad`;
          const legacyStructCadKey = `${legacyCadKey}_struct`;
          const structCadPhotoUrl = fl.cadStructuralSketchPhotoUrl || fl.cad_structural_drawing_url || '';
          const stagedStructCad = getStagedAction({
            category: 'CAD_FLOOR',
            targetPhotoId: fl.id || String(floorNumber),
            url: structCadPhotoUrl || undefined,
            includeAdd: !structCadPhotoUrl,
          });
          const effectiveStructCad = stagedStructCad?.action === 'DELETE' ? '' : (stagedStructCad?.newPhotoUrl || structCadPhotoUrl);
          const structCadRotation =
            stagedPhotoRotations[baseStructCadKey] ??
            stagedPhotoRotations[legacyStructCadKey] ??
            stagedPhotoRotations[baseCadKey] ??
            cadRotation;
          const structCadViolation =
            violationsMap?.get(baseStructCadKey) ||
            violationsMap?.get(legacyStructCadKey) ||
            (effectiveStructCad ? violationsMap?.get(effectiveStructCad) : cadViolation);
          const cadElementPins = Array.isArray(fl.cadElementPins) ? fl.cadElementPins : [];
          const displayedCadElementPins = cadElementPins.filter((p) => {
            if (showDeletedItems) return true;
            const pinCode = p.zoneCode || p.zone_code || '';
            return !deletedElements.some((de) => (de.elementCode || de.element_code) === pinCode);
          });

          return (
            <div
              key={fl.id || flIdx}
              id={`step-4-floor-${flIdx}`}
              className="scroll-mt-14 border border-slate-200 rounded-2xl p-4 sm:p-6 bg-slate-50/40 space-y-6"
            >
              {/* Floor Header Banner */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 border-b border-slate-200 gap-2">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-xl bg-sky-600 text-white font-black flex items-center justify-center font-mono text-sm shadow-xs">
                    {floorNumber}
                  </div>
                  <div>
                    <h4 className="text-base font-black text-slate-800 flex items-center gap-2">
                      <span>{floorName}</span>
                    </h4>
                    <p className="text-[11px] text-slate-500 font-medium">
                      Bản vẽ mặt bằng CAD_Z &bull; {activeZones.length} Vùng Z &bull; Bản vẽ CAD_E &bull; {activeElements.length} Cấu kiện E
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  {(deletedZones.length > 0 || deletedElements.length > 0) && (
                    <button
                      type="button"
                      onClick={() => setShowDeletedItems(!showDeletedItems)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all shadow-xs cursor-pointer ${
                        showDeletedItems
                          ? 'bg-rose-100 text-rose-800 border border-rose-300'
                          : 'bg-white hover:bg-slate-100 text-slate-700 border border-slate-300'
                      }`}
                    >
                      {showDeletedItems ? <EyeOff className="w-3.5 h-3.5 text-rose-700" /> : <Eye className="w-3.5 h-3.5 text-slate-500" />}
                      <span>{showDeletedItems ? 'Ẩn đã xóa' : `Hiện ${deletedZones.length + deletedElements.length} mục đã xóa`}</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setShowCadPins(!showCadPins)}
                    className="px-2.5 py-1 rounded-lg border border-slate-300 bg-white text-slate-700 hover:bg-slate-100 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    {showCadPins ? <Eye className="w-3.5 h-3.5 text-slate-500" /> : <EyeOff className="w-3.5 h-3.5 text-amber-600" />}
                    <span>{showCadPins ? 'Ẩn Ghim CAD' : 'Hiện Ghim CAD'}</span>
                  </button>
                </div>
              </div>

              {/* ========================================================
                  MỤC 1: CAD_Z - SƠ ĐỒ MẶT BẰNG KIẾN TRÚC & GHIM VÙNG Z
                  ======================================================== */}
              <div
                id={`step-4-floor-${flIdx}-cad-z`}
                className="scroll-mt-14 border border-slate-200 rounded-2xl p-4 bg-white space-y-3 shadow-2xs"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-slate-200">
                  <div className="flex items-center gap-2">
                    <Compass className="w-4 h-4 text-sky-600" />
                    <span className="text-xs font-black text-slate-800 uppercase tracking-wide">
                      CAD_Z: Sơ Đồ Mặt Bằng Kiến Trúc ({floorName}) &bull; Điểm Ghim Vùng Z
                    </span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-sky-100 text-sky-800 font-bold">
                      {displayedCadZonePins.length} Ghim Z
                    </span>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    {effectiveCad && (
                      <button
                        type="button"
                        onClick={() =>
                          onOpenPhotoZoom(
                            effectiveCad,
                            `Sơ đồ CAD Kiến trúc (Z) - ${floorName}`,
                            `CAD_Z_${floorName}`,
                            cadRotation
                          )
                        }
                        className="px-2.5 py-1 rounded-lg bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold flex items-center gap-1 transition-colors shadow-xs cursor-pointer"
                      >
                        <Maximize2 className="w-3.5 h-3.5" />
                        <span>Phóng to</span>
                      </button>
                    )}

                    {effectiveCad && (isEditMode || onRotatePhoto) && (
                      <button
                        type="button"
                        onClick={() => handleRotateCad(flIdx, false)}
                        className="px-2.5 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold flex items-center gap-1 transition-colors shadow-xs cursor-pointer"
                        title="Xoay bản vẽ CAD Kiến trúc 90°"
                      >
                        <RotateCw className="w-3.5 h-3.5" />
                        <span>Xoay CAD 90°</span>
                        {cadRotation > 0 && <span className="text-[10px] font-mono">({cadRotation}°)</span>}
                      </button>
                    )}

                    {isEditMode && (
                      <button
                        type="button"
                        onClick={() => {
                          const isCurrentMode = cadPinningMode?.floorIdx === flIdx && cadPinningMode?.mode === 'Z';
                          setCadPinningMode(isCurrentMode ? null : { floorIdx: flIdx, mode: 'Z' });
                        }}
                        className={`px-2.5 py-1 rounded-lg border text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-xs ${
                          cadPinningMode?.floorIdx === flIdx && cadPinningMode?.mode === 'Z'
                            ? 'bg-amber-600 text-white border-amber-700 animate-pulse'
                            : 'bg-emerald-50 text-emerald-800 border-emerald-300 hover:bg-emerald-100'
                        }`}
                      >
                        <Crosshair className="w-3.5 h-3.5" />
                        <span>{cadPinningMode?.floorIdx === flIdx && cadPinningMode?.mode === 'Z' ? 'Đang ghim Z...' : '+ Ghim Z'}</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Banner khi đang ở chế độ Ghim Z */}
                {cadPinningMode?.floorIdx === flIdx && cadPinningMode?.mode === 'Z' && (
                  <div className="px-3.5 py-2 rounded-xl bg-amber-500/10 border border-amber-300 text-amber-900 text-xs font-bold flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Crosshair className="w-4 h-4 text-amber-600 animate-spin" />
                      <span>Bấm vào vị trí trên bản vẽ CAD bên dưới để tạo điểm ghim Vùng Z mới</span>
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

                {/* Khung hiển thị ảnh CAD Kiến Trúc (Auto-Fit khổ Dọc/Ngang + Ghim Z chuẩn 1:1) */}
                {effectiveCad ? (
                  <div
                    id={`audit-photo-card-f${flIdx}-cad`}
                    className={`relative w-full min-h-[240px] bg-slate-900 rounded-xl overflow-hidden flex items-center justify-center p-3 select-none transition-all ${
                      cadViolation ? 'border-2 border-red-500 ring-2 ring-red-400/50' : 'border border-slate-300'
                    }`}
                  >
                    {cadViolation && (
                      <div className="absolute top-2.5 left-2.5 z-30 flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-red-600/95 text-white font-bold text-[10px] shadow-md">
                        <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                        <span>Bắt buộc xoay Dọc (Portrait) — Bấm &quot;Xoay CAD 90°&quot; để chuẩn hóa</span>
                      </div>
                    )}
                    <RotatableImageFrame
                      url={effectiveCad}
                      alt={`CAD Kiến trúc ${floorName}`}
                      rotation={cadRotation}
                      maxHeightPx={680}
                      onClick={(e) => handleCadImageClick(e, flIdx, 'Z')}
                      className="w-full"
                      stageClassName={
                        cadPinningMode?.floorIdx === flIdx && cadPinningMode?.mode === 'Z' ? 'cursor-crosshair' : ''
                      }
                    >
                      {/* Ghim Vùng Z trên CAD */}
                      {showCadPins &&
                        displayedCadZonePins.map((pin: CadZonePin, pIdx: number) => {
                          const pX = Number(pin.pinX ?? pin.pin_x ?? 50);
                          const pY = Number(pin.pinY ?? pin.pin_y ?? 50);
                          const pCode = pin.zoneCode || pin.zone_code || `Z-${pIdx + 1}`;
                          const isBeingDragged = draggingCadPin?.floorIdx === flIdx && draggingCadPin?.pinCode === pCode && !draggingCadPin?.isStruct;
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
                                hasJustDraggedRef.current = false;
                                pointerStartPosRef.current = { x: e.clientX, y: e.clientY };
                                (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
                                setDraggingCadPin({
                                  floorIdx: flIdx,
                                  pinCode: pCode,
                                  isStruct: false,
                                  currentX: pX,
                                  currentY: pY,
                                });
                              }}
                              onPointerMove={(e) => {
                                if (!draggingCadPin || draggingCadPin.floorIdx !== flIdx || draggingCadPin.pinCode !== pCode || draggingCadPin.isStruct) return;
                                e.stopPropagation();
                                if (
                                  pointerStartPosRef.current &&
                                  Math.hypot(e.clientX - pointerStartPosRef.current.x, e.clientY - pointerStartPosRef.current.y) > 3
                                ) {
                                  hasJustDraggedRef.current = true;
                                }
                                const container = e.currentTarget.parentElement;
                                if (!container) return;
                                const rect = container.getBoundingClientRect();
                                const rawX = ((e.clientX - rect.left) / rect.width) * 100;
                                const rawY = ((e.clientY - rect.top) / rect.height) * 100;
                                const clampedX = Math.round(Math.max(1, Math.min(99, rawX)) * 10) / 10;
                                const clampedY = Math.round(Math.max(1, Math.min(99, rawY)) * 10) / 10;
                                setDraggingCadPin((prev) => (prev ? { ...prev, currentX: clampedX, currentY: clampedY } : null));
                              }}
                              onPointerUp={(e) => {
                                if (!draggingCadPin || draggingCadPin.floorIdx !== flIdx || draggingCadPin.pinCode !== pCode || draggingCadPin.isStruct) return;
                                e.stopPropagation();
                                try {
                                  (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
                                } catch (err) {
                                  console.warn('[AuditStep3FloorDefects] releasePointerCapture failed:', err);
                                }
                                const finalX = draggingCadPin.currentX;
                                const finalY = draggingCadPin.currentY;
                                setDraggingCadPin(null);
                                pointerStartPosRef.current = null;
                                if (Math.abs(finalX - pX) > 0.2 || Math.abs(finalY - pY) > 0.2) {
                                  hasJustDraggedRef.current = true;
                                  handleCommitCadPinCoord(flIdx, pCode, false, finalX, finalY);
                                }
                              }}
                              onClick={(e) => {
                                e.stopPropagation();
                                if (hasJustDraggedRef.current) {
                                  hasJustDraggedRef.current = false;
                                  return;
                                }
                                setSelectedPinCode(pCode);
                                if (!isEditMode) {
                                  const target = document.getElementById(`zone-card-f${flIdx}-${pCode}`);
                                  if (target) {
                                    target.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                    target.classList.add('ring-4', 'ring-emerald-400');
                                    setTimeout(() => target.classList.remove('ring-4', 'ring-emerald-400'), 2500);
                                  }
                                }
                              }}
                            >
                              <div className="px-1.5 py-0.5 rounded text-[10px] font-mono font-black shadow-lg bg-emerald-600 text-white group-hover:scale-110 transition-transform">
                                {pCode}
                              </div>
                              <div className="w-2.5 h-2.5 rounded-full border-2 border-white shadow-md -mt-0.5 bg-emerald-400" />
                            </div>
                          );
                        })}
                    </RotatableImageFrame>
                  </div>
                ) : (
                  <div className="py-8 border-2 border-dashed border-slate-300 rounded-xl flex flex-col items-center justify-center gap-2 text-slate-400 bg-slate-50/50">
                    <Layers className="w-7 h-7 text-slate-300" />
                    <span className="text-xs italic">Chưa có bản vẽ CAD Kiến trúc (Z) cho {floorName}</span>
                  </div>
                )}
              </div>

              {/* ========================================================
                  MỤC 2: Z - CHI TIẾT CÁC VÙNG KIẾN TRÚC Z & KHUYẾT TẬT D
                  ======================================================== */}
              <div
                id={`step-4-floor-${flIdx}-zones`}
                className="scroll-mt-14 space-y-4"
              >
                <div className="flex items-center justify-between pb-2 border-b border-slate-200 flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <Layers className="w-4 h-4 text-emerald-600" />
                    <span className="text-xs font-black text-slate-800 uppercase tracking-wide">
                      Z: Danh Sách Vùng Kiến Trúc ({activeZones.length} Vùng) &bull; {floorName}
                    </span>
                  </div>
                  {isEditMode && (
                    <button
                      type="button"
                      onClick={() => handleAddZoneDirect(flIdx)}
                      className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition-colors shadow-2xs flex items-center gap-1 cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>+ Thêm Vùng Z</span>
                    </button>
                  )}
                </div>

                {displayedZones.length === 0 ? (
                  <div className="p-6 text-center bg-white rounded-xl border border-slate-200 text-slate-400 text-xs">
                    Tầng này chưa có Vùng Kiến Trúc Z nào
                  </div>
                ) : (
                  displayedZones.map((z: DamageZoneData) => {
                    const zCode = z.zoneCode || z.zone_code || 'Z-??';
                    const isZoneDeleted = isItemSoftDeleted(z);
                    const rawDefectsList: DefectItem[] = Array.isArray(z.defects) ? z.defects : [];
                    const defectsList = showDeletedItems ? rawDefectsList : rawDefectsList.filter((d) => !isItemSoftDeleted(d));

                    const rawZoneCtxUrl = z.ctxPhotoUrl || z.ctx_photo_url || '';
                    const stagedCtx = getStagedAction({
                      category: 'ZONE_CTX',
                      targetPhotoId: zCode,
                      url: rawZoneCtxUrl || undefined,
                      includeAdd: !rawZoneCtxUrl,
                    });
                    const ctxUrl = stagedCtx?.action === 'DELETE' ? '' : (stagedCtx?.newPhotoUrl || stagedCtx?.oldPhotoUrl || rawZoneCtxUrl);
                    const zIdStr = z.id ? String(z.id) : '';
                    const isZUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-/i.test(zIdStr);
                    const baseZoneKey = isZUuid ? `zone_${zIdStr}` : `zone_f${flIdx}_z${zCode}`;
                    const legacyZoneKey = z.id ? `zone_${z.id}` : baseZoneKey;
                    const ctxRotKey = `${baseZoneKey}_ctx`;
                    const legacyCtxRotKey = `${legacyZoneKey}_ctx`;
                    const ctxRot =
                      stagedPhotoRotations[ctxRotKey] ??
                      stagedPhotoRotations[legacyCtxRotKey] ??
                      stagedPhotoRotations[ctxUrl] ??
                      0;
                    const ctxViolation =
                      violationsMap?.get(ctxRotKey) ||
                      violationsMap?.get(legacyCtxRotKey) ||
                      (ctxUrl ? violationsMap?.get(ctxUrl) : undefined);
                    const hasZonePinsOrPinning =
                      defectsList.length > 0 ||
                      (pinningCtxZone?.floorIdx === flIdx && pinningCtxZone?.zoneOrElemCode === zCode);

                    return (
                      <div
                        key={z.id || zCode}
                        id={`zone-card-f${flIdx}-${zCode}`}
                        className={`rounded-2xl p-4 sm:p-5 space-y-4 transition-all bg-white border border-slate-200 shadow-2xs ${
                          isZoneDeleted ? 'opacity-70 border-dashed border-rose-300 bg-rose-50/20' : ''
                        }`}
                      >
                        {/* Zone Header */}
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="px-2.5 py-0.5 rounded-lg bg-emerald-700 text-white font-mono font-black text-xs">
                              {zCode}
                            </span>
                            {isEditMode ? (
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <input
                                  type="text"
                                  value={z.roomName || ''}
                                  onChange={(e) => handleZoneFieldChange(flIdx, z.id, 'roomName', e.target.value, 'Tên phòng')}
                                  placeholder="Tên phòng (VD: Phòng khách)"
                                  className="p-1 text-xs border border-amber-300 rounded font-bold w-36 bg-amber-50/40"
                                />
                                <span>&bull;</span>
                                <select
                                  value={z.componentType || 'Tường ngăn'}
                                  onChange={(e) => handleZoneFieldChange(flIdx, z.id, 'componentType', e.target.value, 'Cấu kiện')}
                                  className="p-1 text-xs border border-slate-300 rounded bg-white font-bold"
                                >
                                  {COMPONENT_TYPE_PRESETS.map((ct) => (
                                    <option key={ct} value={ct}>{ct}</option>
                                  ))}
                                </select>
                                <span>&bull;</span>
                                <select
                                  value={z.wallMaterial || 'Gạch ống (2 lỗ / 4 lỗ)'}
                                  onChange={(e) => handleZoneFieldChange(flIdx, z.id, 'wallMaterial', e.target.value, 'Vật liệu')}
                                  className="p-1 text-xs border border-slate-300 rounded bg-white font-bold"
                                >
                                  {WALL_MATERIAL_PRESETS.map((wm) => (
                                    <option key={wm} value={wm}>{wm}</option>
                                  ))}
                                </select>
                              </div>
                            ) : (
                              <span className="text-xs font-bold text-slate-800">
                                {z.roomName || 'Không gian chính'} &bull; {z.componentType || 'Tường gạch'} &bull; {z.wallMaterial || 'Gạch ống'}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant={defectsList.length > 0 ? 'warning' : 'success'} size="sm">
                              {defectsList.length} khuyết tật D
                            </Badge>
                            {isEditMode && (
                              isZoneDeleted ? (
                                <button
                                  type="button"
                                  onClick={() => handleRestoreZone(flIdx, z)}
                                  className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-1 cursor-pointer transition-colors shadow-2xs"
                                >
                                  <Undo2 className="w-3.5 h-3.5" />
                                  <span>Khôi phục Vùng</span>
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => handleRemoveZone(flIdx, z)}
                                  className="px-2 py-1 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-300 text-xs font-bold flex items-center gap-1 cursor-pointer transition-colors"
                                >
                                  <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                                  <span>Xóa Vùng</span>
                                </button>
                              )
                            )}
                          </div>
                        </div>

                        {/* Dải ảnh tổng quan Vùng Z (kèm Optimistic ADD/REPLACE/DELETE) - Quy tắc 2.5 ảnh cùng cấp phủ kín chiều ngang */}
                        {(() => {
                          const rawZOverviews: string[] = Array.isArray(z.overviewPhotos) ? z.overviewPhotos : [];
                          const addedZOverviews = getOptimisticAddedPhotos(stagedPhotoActions, {
                            category: 'ZONE_OVERVIEW',
                            targetPhotoType: 'OVERVIEW',
                            targetPhotoId: z.id || zCode,
                            zoneCode: zCode,
                          });
                          const hasAnyZOverviews = rawZOverviews.length > 0 || addedZOverviews.length > 0;

                          if (!hasAnyZOverviews && !isEditMode) return null;

                          return (
                            <div className="space-y-1.5">
                              <div className="flex items-center justify-between gap-2">
                                <span className="text-[10px] font-bold uppercase text-slate-500 block">
                                  Ảnh Tổng Quan Vùng {zCode} ({rawZOverviews.length + addedZOverviews.length} ảnh):
                                </span>
                                {isEditMode && onOpenPhotoAction && (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      onOpenPhotoAction({
                                        initialMode: 'ADD',
                                        category: 'ZONE_OVERVIEW',
                                        targetPhotoType: 'OVERVIEW',
                                        targetPhotoId: z.id || zCode,
                                        zoneCode: zCode,
                                        floorCode: floorName,
                                        photoTitle: `Thêm ảnh tổng quan ${zCode}`,
                                      })
                                    }
                                    className="px-2 py-0.5 rounded bg-sky-600 hover:bg-sky-700 text-white font-bold text-[10px] flex items-center gap-1 cursor-pointer shadow-2xs"
                                  >
                                    <Plus className="w-3 h-3" />
                                    <span>Thêm Ảnh Tổng Quan</span>
                                  </button>
                                )}
                              </div>

                              {hasAnyZOverviews && (
                                <div className="flex flex-nowrap gap-4 overflow-x-auto pb-2.5 scrollbar-thin">
                                  {rawZOverviews.map((ovUrl: string, ovIdx: number) => {
                                    const ovOpt = resolveOptimisticPhoto(ovUrl, stagedPhotoActions, {
                                      category: 'ZONE_OVERVIEW',
                                      targetPhotoType: 'OVERVIEW',
                                      targetPhotoId: z.id || zCode,
                                      zoneCode: zCode,
                                      floorCode: floorName,
                                      photoIndex: ovIdx,
                                      url: ovUrl,
                                    });
                                    const effectiveOvUrl = ovOpt.displayUrl || ovUrl;
                                    const ovRotKey = `zone_f${flIdx}_z${zCode}_ov_${ovIdx}`;
                                    const legacyOvKey = `${baseZoneKey}_ov_${ovIdx}`;
                                    const rot =
                                      stagedPhotoRotations[ovRotKey] ??
                                      stagedPhotoRotations[legacyOvKey] ??
                                      0;
                                    const orientStatus =
                                      violationsMap?.get(ovRotKey) ||
                                      violationsMap?.get(legacyOvKey);
                                    const domId = `audit-photo-card-f${flIdx}-zone-${zCode}-ov-${ovIdx}`;

                                    return (
                                      <div key={ovIdx} className="w-[calc((100%-2rem)/2.5)] min-w-[240px] shrink-0">
                                        <AuditPhotoCard
                                          url={effectiveOvUrl}
                                          photoCode={`${zCode}-OV-${ovIdx + 1}`}
                                          photoKey={ovRotKey}
                                          title={`Tổng quan ${zCode} #${ovIdx + 1}`}
                                          category="ZONE_OVERVIEW"
                                          targetPhotoType="OVERVIEW"
                                          targetPhotoId={z.id || zCode}
                                          zoneCode={zCode}
                                          floorCode={floorName}
                                          photoIndex={ovIdx}
                                          isEditMode={isEditMode}
                                          aspectRatio="aspect-4/3"
                                          badgeColor="slate"
                                          rotation={rot}
                                          isOrientationMismatch={Boolean(orientStatus)}
                                          isStrictOrientation={orientStatus?.isStrict ?? false}
                                          orientationRecommendation={orientStatus?.message}
                                          expectedOrientation={orientStatus?.expectedOrientation || 'LANDSCAPE'}
                                          onRotate={(newRot) => onRotatePhoto?.(ovRotKey, newRot, effectiveOvUrl)}
                                          optimisticStatus={
                                            ovOpt.status === 'DELETED'
                                              ? 'DELETED'
                                              : ovOpt.status === 'REPLACED'
                                              ? 'REPLACED'
                                              : undefined
                                          }
                                          onUndoDelete={
                                            ovOpt.stagedAction ? () => onUndoPhotoAction?.(ovOpt.stagedAction!) : undefined
                                          }
                                          domId={domId}
                                          onOpenPhotoZoom={onOpenPhotoZoom}
                                          onOpenPhotoAction={onOpenPhotoAction}
                                          onOpenPhotoHistory={onOpenPhotoHistory}
                                        />
                                      </div>
                                    );
                                  })}

                                  {addedZOverviews.map((addedItem, addIdx) => {
                                    const ovIdx = rawZOverviews.length + addIdx;
                                    const ovRotKey = `zone_f${flIdx}_z${zCode}_ov_added_${addIdx}`;
                                    const rot = stagedPhotoRotations[ovRotKey] ?? 0;
                                    return (
                                      <div key={`added-z-ov-${addIdx}`} className="w-[calc((100%-2rem)/2.5)] min-w-[240px] shrink-0">
                                        <AuditPhotoCard
                                          url={addedItem.displayUrl}
                                          photoCode={`${zCode}-OV-${ovIdx + 1} (Mới)`}
                                          photoKey={ovRotKey}
                                          title={`Tổng quan ${zCode} #${ovIdx + 1} (Chờ lưu Diff)`}
                                          category="ZONE_OVERVIEW"
                                          targetPhotoType="OVERVIEW"
                                          targetPhotoId={z.id || zCode}
                                          zoneCode={zCode}
                                          floorCode={floorName}
                                          photoIndex={ovIdx}
                                          isEditMode={isEditMode}
                                          aspectRatio="aspect-4/3"
                                          badgeColor="emerald"
                                          rotation={rot}
                                          onRotate={(newRot) => onRotatePhoto?.(ovRotKey, newRot, addedItem.displayUrl)}
                                          optimisticStatus="ADDED"
                                          onUndoDelete={() => onUndoPhotoAction?.(addedItem.action)}
                                          onOpenPhotoZoom={onOpenPhotoZoom}
                                          onOpenPhotoAction={onOpenPhotoAction}
                                          onOpenPhotoHistory={onOpenPhotoHistory}
                                        />
                                      </div>
                                    );
                                  })}
                                </div>
                              )}
                            </div>
                          );
                        })()}

                        {/* Dải Cuộn Ngang Liên Hoàn: [Ảnh Bối Cảnh CTX 65% có ghim D] + [Các Thẻ Khuyết Tật D & Ảnh Cận Cảnh CU (150%)]
                            Khi cuộn ngang sang phải để xem các cận cảnh CU, khung ảnh bối cảnh 65% sẽ trượt theo để nhường toàn bộ diện tích quan sát! */}
                        <div className="space-y-2.5 pt-2 border-t border-slate-100">
                          <div className="flex items-center justify-between gap-2 flex-wrap">
                            <span className="text-[11px] font-bold text-slate-700">
                              Bối Cảnh ({zCode}_CTX) &amp; Dải Khuyết Tật D ({defectsList.length} mục &bull; Cuộn ngang liên hoàn):
                            </span>
                            <div className="flex items-center gap-2">
                              {isEditMode && (
                                <button
                                  type="button"
                                  onClick={() => handleAddDefect(flIdx, z.id || zCode)}
                                  className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition-colors shadow-2xs flex items-center gap-1 cursor-pointer"
                                >
                                  <Plus className="w-3.5 h-3.5" />
                                  <span>Thêm Khuyết Tật D</span>
                                </button>
                              )}
                            </div>
                          </div>

                          <div className="flex flex-nowrap gap-5 overflow-x-auto pb-4 items-start scrollbar-thin">
                            {/* KHỐI 1 TRONG DẢI CUỘN NGANG: Ảnh Bối Cảnh Z_CTX (65% khi có ghim D) */}
                            <div
                              id={`audit-photo-card-f${flIdx}-zone-${zCode}`}
                              className={`rounded-xl p-3 bg-slate-50 border flex flex-col space-y-2.5 shrink-0 ${
                                hasZonePinsOrPinning
                                  ? 'w-full lg:w-[65%]'
                                  : 'w-full sm:w-[calc((100%-2rem)/2.5)] min-w-[260px]'
                              } ${
                                ctxViolation
                                  ? ctxViolation.isStrict
                                    ? 'border-2 border-amber-500 ring-2 ring-amber-400/30'
                                    : 'border-2 border-amber-400'
                                  : 'border-slate-200'
                              }`}
                            >
                              <div className="flex items-center justify-between flex-wrap gap-1.5">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="text-[11px] font-black text-slate-800">
                                    Ảnh Bối Cảnh ({zCode}_CTX)
                                  </span>
                                  {ctxViolation && (
                                    <span
                                      className={`px-1.5 py-0.5 rounded text-[9px] font-bold flex items-center gap-1 border ${
                                        ctxViolation.isStrict
                                          ? 'bg-amber-500 text-slate-950 border-amber-600'
                                          : 'bg-amber-100 text-amber-900 border-amber-300'
                                      }`}
                                    >
                                      {ctxViolation.isStrict ? (
                                        <AlertTriangle className="w-2.5 h-2.5 shrink-0" />
                                      ) : (
                                        <Lightbulb className="w-2.5 h-2.5 shrink-0" />
                                      )}
                                      <span>
                                        {ctxViolation.isStrict
                                          ? `Cần xoay ${ctxViolation.expectedOrientation === 'PORTRAIT' ? 'Dọc' : 'Ngang'}`
                                          : `Khuyến nghị ${ctxViolation.expectedOrientation === 'PORTRAIT' ? 'Dọc' : 'Ngang'}`}
                                      </span>
                                    </span>
                                  )}
                                  {stagedCtx && onUndoPhotoAction && (
                                    <button
                                      type="button"
                                      onClick={() => onUndoPhotoAction(stagedCtx)}
                                      className="px-1.5 py-0.5 rounded bg-amber-100 hover:bg-amber-200 text-amber-900 border border-amber-300 text-[9px] font-bold flex items-center gap-1 cursor-pointer"
                                    >
                                      <Undo2 className="w-2.5 h-2.5" />
                                      <span>Hoàn tác ảnh CTX</span>
                                    </button>
                                  )}
                                </div>
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  {ctxUrl && (
                                    <button
                                      type="button"
                                      onClick={() =>
                                        onOpenPhotoZoom(ctxUrl, `Ảnh bối cảnh ${zCode} (${floorName})`, ctxRotKey, ctxRot)
                                      }
                                      className="px-2 py-0.5 rounded bg-slate-200/80 text-slate-700 hover:bg-slate-300 text-[10px] font-bold flex items-center gap-1 cursor-pointer"
                                    >
                                      <Maximize2 className="w-3 h-3" />
                                      <span>Phóng to</span>
                                    </button>
                                  )}
                                  {ctxUrl && onRotatePhoto && (
                                    <button
                                      type="button"
                                      onClick={() => handleRotateZoneCtx(flIdx, z, ctxRot, ctxRotKey)}
                                      className="px-2 py-0.5 rounded bg-indigo-50 text-indigo-700 hover:bg-indigo-100 border border-indigo-200 text-[10px] font-bold flex items-center gap-1 cursor-pointer"
                                    >
                                      <RotateCw className="w-3 h-3" />
                                      <span>Xoay 90° {ctxRot ? `(${ctxRot}°)` : ''}</span>
                                    </button>
                                  )}
                                  {isEditMode && ctxUrl && (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        const isCur = pinningCtxZone?.floorIdx === flIdx && pinningCtxZone?.zoneOrElemCode === zCode;
                                        setPinningCtxZone(isCur ? null : { floorIdx: flIdx, zoneOrElemCode: zCode });
                                      }}
                                      className={`px-2 py-0.5 rounded text-[10px] font-bold flex items-center gap-1 cursor-pointer ${
                                        pinningCtxZone?.floorIdx === flIdx && pinningCtxZone?.zoneOrElemCode === zCode
                                          ? 'bg-rose-600 text-white animate-pulse'
                                          : 'bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200'
                                      }`}
                                    >
                                      <Crosshair className="w-3 h-3" />
                                      <span>{pinningCtxZone?.floorIdx === flIdx && pinningCtxZone?.zoneOrElemCode === zCode ? 'Đang ghim...' : '+ Ghim D'}</span>
                                    </button>
                                  )}
                                  {isEditMode && onOpenPhotoAction && (
                                    <button
                                      type="button"
                                      onClick={() =>
                                        onOpenPhotoAction({
                                          category: 'ZONE_CTX',
                                          initialMode: ctxUrl ? 'REPLACE' : 'ADD',
                                          targetPhotoType: 'CTX',
                                          targetPhotoId: zCode,
                                          zoneCode: zCode,
                                          floorCode: floorName,
                                          currentPhotoUrl: ctxUrl || undefined,
                                          photoTitle: `Ảnh bối cảnh ${zCode}`,
                                        })
                                      }
                                      className="px-2 py-0.5 rounded bg-slate-200/70 hover:bg-slate-200 text-slate-700 text-[10px] font-bold flex items-center gap-1 cursor-pointer"
                                    >
                                      <Edit3 className="w-3 h-3" />
                                      <span>{ctxUrl ? 'Đổi CTX' : '+ Thêm CTX'}</span>
                                    </button>
                                  )}
                                </div>
                              </div>

                              {/* CTX Image with D pins (Auto-Fit khổ Dọc/Ngang + Ghim D chuẩn 1:1) */}
                              {ctxUrl ? (
                                <div
                                  className={`relative w-full rounded-xl overflow-hidden bg-slate-950/95 flex items-center justify-center p-2 ${
                                    hasZonePinsOrPinning ? 'min-h-[320px]' : 'h-60'
                                  } ${
                                    pinningCtxZone?.floorIdx === flIdx && pinningCtxZone?.zoneOrElemCode === zCode ? 'ring-2 ring-rose-500' : ''
                                  }`}
                                >
                                  <RotatableImageFrame
                                    url={ctxUrl}
                                    alt={`Ảnh bối cảnh ${zCode}`}
                                    rotation={ctxRot}
                                    maxHeightPx={hasZonePinsOrPinning ? 520 : 225}
                                    onClick={(e) => handleCtxImageClick(e, flIdx, z)}
                                    className="w-full h-full"
                                    stageClassName={
                                      pinningCtxZone?.floorIdx === flIdx && pinningCtxZone?.zoneOrElemCode === zCode
                                        ? 'cursor-crosshair'
                                        : ''
                                    }
                                  >
                                    {/* Ghim D trên CTX */}
                                    {showCtxPins &&
                                      defectsList.map((d: DefectItem, dIdx: number) => {
                                        const pX = Number(d.pinX ?? d.pin_x ?? 50);
                                        const pY = Number(d.pinY ?? d.pin_y ?? 50);
                                        const dCode = d.defectCode || d.defect_code || `D-${String(dIdx + 1).padStart(2, '0')}`;
                                        const defectKey = d.id || dCode;
                                        const isBeingDragged = draggingDefectPin?.defectId === defectKey;
                                        const isSelectedPin = highlightedDefectId === defectKey;
                                        const displayX = isBeingDragged ? draggingDefectPin.currentX : pX;
                                        const displayY = isBeingDragged ? draggingDefectPin.currentY : pY;

                                        return (
                                          <div
                                            key={`pin_${zCode}_${defectKey}_${dIdx}`}
                                            style={{
                                              position: 'absolute',
                                              top: `${displayY}%`,
                                              left: `${displayX}%`,
                                              transform: 'translate(-50%, -100%)',
                                              zIndex: isBeingDragged ? 50 : isSelectedPin ? 40 : 30,
                                              touchAction: 'none',
                                            }}
                                            className={`flex flex-col items-center select-none group ${
                                              isEditMode ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer'
                                            }`}
                                            onPointerDown={(e) => {
                                              if (!isEditMode) return;
                                              e.stopPropagation();
                                              hasJustDraggedRef.current = false;
                                              pointerStartPosRef.current = { x: e.clientX, y: e.clientY };
                                              (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
                                              setDraggingDefectPin({
                                                floorIdx: flIdx,
                                                zoneId: z.id || zCode,
                                                defectId: defectKey,
                                                dCode,
                                                currentX: pX,
                                                currentY: pY,
                                              });
                                            }}
                                            onPointerMove={(e) => {
                                              if (!draggingDefectPin || draggingDefectPin.defectId !== defectKey) return;
                                              e.stopPropagation();
                                              if (
                                                pointerStartPosRef.current &&
                                                Math.hypot(e.clientX - pointerStartPosRef.current.x, e.clientY - pointerStartPosRef.current.y) > 3
                                              ) {
                                                hasJustDraggedRef.current = true;
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
                                              } catch (err) {
                                                console.warn('[AuditStep3FloorDefects] releasePointerCapture failed:', err);
                                              }
                                              const finalX = draggingDefectPin.currentX;
                                              const finalY = draggingDefectPin.currentY;
                                              setDraggingDefectPin(null);
                                              pointerStartPosRef.current = null;
                                              if (Math.abs(finalX - pX) > 0.2 || Math.abs(finalY - pY) > 0.2) {
                                                hasJustDraggedRef.current = true;
                                                handleCommitDefectPinCoord(flIdx, z.id || zCode, defectKey, dCode, finalX, finalY);
                                              }
                                            }}
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              if (hasJustDraggedRef.current) {
                                                hasJustDraggedRef.current = false;
                                                return;
                                              }
                                              setHighlightedDefectId(defectKey);
                                              if (!isEditMode) {
                                                const targetEl = document.getElementById(`defect-card-f${flIdx}-${zCode}-${dCode}`);
                                                if (targetEl) {
                                                  targetEl.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
                                                  targetEl.classList.add('ring-4', 'ring-rose-400');
                                                  setTimeout(() => targetEl.classList.remove('ring-4', 'ring-rose-400'), 2500);
                                                }
                                              }
                                            }}
                                          >
                                            <div
                                              className={`px-2 py-0.5 rounded font-mono font-black text-[10px] shadow-md border border-white flex items-center gap-1 ${
                                                isSelectedPin ? 'bg-amber-500 text-slate-950 ring-2 ring-white' : 'bg-rose-600 text-white'
                                              }`}
                                            >
                                              <span>{dCode}</span>
                                              {isEditMode && !isItemSoftDeleted(d) && (
                                                <button
                                                  type="button"
                                                  title={`Xóa ghim ${dCode}`}
                                                  onPointerDown={(ev) => ev.stopPropagation()}
                                                  onClick={(ev) => {
                                                    ev.stopPropagation();
                                                    handleRemoveDefect(flIdx, z.id || zCode, d.id || dCode);
                                                  }}
                                                  className="ml-0.5 p-0.5 rounded hover:bg-black/25 text-white/90 hover:text-white cursor-pointer"
                                                >
                                                  <Trash2 className="w-2.5 h-2.5" />
                                                </button>
                                              )}
                                            </div>
                                            <div className="w-2 h-2 rounded-full border border-white bg-rose-600 -mt-0.5" />
                                          </div>
                                        );
                                      })}
                                  </RotatableImageFrame>
                                </div>
                              ) : (
                                <div className="h-52 border border-dashed border-slate-300 rounded-lg flex flex-col items-center justify-center p-3 text-center text-slate-400 gap-2">
                                  <Camera className="w-6 h-6 text-slate-300" />
                                  <span className="text-xs">Chưa có ảnh bối cảnh CTX cho {zCode}</span>
                                  {isEditMode && onOpenPhotoAction && (
                                    <button
                                      type="button"
                                      onClick={() =>
                                        onOpenPhotoAction({
                                          category: 'ZONE_CTX',
                                          initialMode: 'ADD',
                                          targetPhotoType: 'CTX',
                                          targetPhotoId: zCode,
                                          zoneCode: zCode,
                                          floorCode: floorName,
                                          photoTitle: `Ảnh bối cảnh ${zCode}`,
                                        })
                                      }
                                      className="px-2.5 py-1 rounded-lg bg-sky-600 hover:bg-sky-700 text-white text-[10px] font-bold flex items-center gap-1 cursor-pointer"
                                    >
                                      <Plus className="w-3 h-3" />
                                      <span>Tải Ảnh Bối Cảnh CTX</span>
                                    </button>
                                  )}
                                </div>
                              )}
                            </div>

                            {/* CÁC KHỐI TIẾP THEO TRONG CÙNG DẢI CUỘN NGANG: Danh sách Thẻ Khuyết Tật D & Ảnh Cận Cảnh CU (150%) */}
                            {defectsList.length === 0 ? (
                              <div className="w-[340px] shrink-0 p-5 bg-slate-50 rounded-xl border border-dashed border-slate-200 text-center text-xs text-slate-400 flex flex-col items-center justify-center gap-2 min-h-[200px]">
                                <span>Không có khuyết tật D nào trong vùng {zCode}</span>
                                {isEditMode && (
                                  <button
                                    type="button"
                                    onClick={() => handleAddDefect(flIdx, z.id || zCode)}
                                    className="px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition-colors shadow-2xs cursor-pointer"
                                  >
                                    + Thêm Khuyết Tật D
                                  </button>
                                )}
                              </div>
                            ) : (
                              defectsList.map((d: DefectItem, dIdx: number) => {
                                const dCode = d.defectCode || d.defect_code || `D-${String(dIdx + 1).padStart(2, '0')}`;
                                const defectKey = d.id || dCode;
                                const isDefDeleted = isItemSoftDeleted(d);
                                const isCrack = isCrackRelated(d.screeningCategory, d.defectType);
                                const rawCuPhotos: string[] =
                                  Array.isArray(d.cuPhotos) && d.cuPhotos.length > 0
                                    ? d.cuPhotos
                                    : d.cuPhotoUrl
                                    ? [d.cuPhotoUrl]
                                    : d.cu_photo_url
                                    ? [d.cu_photo_url]
                                    : [];
                                const addedCuPhotos = getOptimisticAddedPhotos(stagedPhotoActions, {
                                  category: 'DEFECT_CU',
                                  targetPhotoType: 'CU',
                                  targetPhotoId: dCode,
                                  defectId: d.id,
                                  defectCode: dCode,
                                  zoneCode: zCode,
                                  floorCode: floorName,
                                });
                                const totalCuCount = rawCuPhotos.length + addedCuPhotos.length;

                                const currentCategory = d.screeningCategory || ARCH_SCREENING_CATEGORIES[0];
                                const categoryOptions = ARCH_SCREENING_CATEGORIES.includes(currentCategory)
                                  ? ARCH_SCREENING_CATEGORIES
                                  : [currentCategory, ...ARCH_SCREENING_CATEGORIES];

                                const currentDefectType = d.defectType || ARCH_DEFECT_TYPES[0];
                                const defectTypeOptions = ARCH_DEFECT_TYPES.includes(currentDefectType)
                                  ? ARCH_DEFECT_TYPES
                                  : [currentDefectType, ...ARCH_DEFECT_TYPES, ...DEFECT_TYPE_PRESETS.filter((p) => !ARCH_DEFECT_TYPES.includes(p))];

                                return (
                                  <div
                                    key={defectKey}
                                    id={`defect-card-f${flIdx}-${zCode}-${dCode}`}
                                    className={`shrink-0 min-w-[390px] sm:min-w-[440px] max-w-fit rounded-xl border p-3.5 bg-white space-y-3 shadow-2xs transition-all ${
                                      isDefDeleted
                                        ? 'opacity-70 border-dashed border-rose-300 bg-rose-50/20'
                                        : highlightedDefectId === defectKey
                                        ? 'border-2 border-rose-500 ring-2 ring-rose-300/40'
                                        : 'border-slate-200'
                                    }`}
                                  >
                                    {/* Defect Header */}
                                    <div className="flex items-center justify-between gap-2 pb-2 border-b border-slate-100 flex-wrap">
                                      <div className="flex items-center gap-2 flex-wrap">
                                        <span className="px-2 py-0.5 rounded bg-rose-600 text-white font-mono font-black text-xs">
                                          {dCode}
                                        </span>
                                        <span className="text-xs font-bold text-slate-800">
                                          {d.defectType || d.screeningCategory || 'Khuyết tật kiến trúc'}
                                        </span>
                                        {isCrack && (
                                          <Badge variant="warning" size="sm">
                                            Burland Cấp {d.burlandGrade ?? getBurlandGradeFromWidth(Number(d.widthMaxMm ?? d.width_max_mm ?? 0))}
                                          </Badge>
                                        )}
                                      </div>

                                      <div className="flex items-center gap-2">
                                        {!isEditMode && isCrack && (
                                          <span className="font-mono text-rose-600 font-bold text-xs">
                                            Rộng: {d.widthMaxMm ?? d.width_max_mm ?? 0} mm
                                            {d.lengthMm ? ` • Dài: ${d.lengthMm} mm` : ''}
                                          </span>
                                        )}
                                        {isEditMode && (
                                          isDefDeleted ? (
                                            <button
                                              type="button"
                                              onClick={() => handleRestoreDefect(flIdx, z.id || zCode, defectKey)}
                                              className="px-2 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-bold flex items-center gap-1 cursor-pointer shadow-2xs"
                                            >
                                              <Undo2 className="w-3 h-3" />
                                              <span>Khôi phục {dCode}</span>
                                            </button>
                                          ) : (
                                            <button
                                              type="button"
                                              onClick={() => handleRemoveDefect(flIdx, z.id || zCode, defectKey)}
                                              className="px-2 py-1 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-300 text-[11px] font-bold flex items-center gap-1 cursor-pointer transition-colors"
                                              title={`Xóa mềm ghim khuyết tật ${dCode}`}
                                            >
                                              <Trash2 className="w-3 h-3 text-rose-600" />
                                              <span>Xóa ghim {dCode}</span>
                                            </button>
                                          )
                                        )}
                                      </div>
                                    </div>

                                    {/* Form chỉnh sửa thông tin khuyết tật D chuẩn Phase 1 (Khi ở Chế độ Sửa) */}
                                    {isEditMode ? (
                                      <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/80 space-y-2.5 text-xs">
                                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                          <div>
                                            <label className="text-[10px] font-bold text-slate-600 block mb-0.5">
                                              Nhóm chỉ báo (Phase 1):
                                            </label>
                                            <select
                                              value={currentCategory}
                                              onChange={(e) =>
                                                handleDefectChange(flIdx, z.id || zCode, defectKey, 'screeningCategory', e.target.value, `${dCode} Nhóm chỉ báo`)
                                              }
                                              className="w-full p-1.5 rounded-lg border border-slate-300 bg-white text-xs font-semibold text-slate-800"
                                            >
                                              {categoryOptions.map((cat) => (
                                                <option key={cat} value={cat}>{cat}</option>
                                              ))}
                                            </select>
                                          </div>
                                          <div>
                                            <label className="text-[10px] font-bold text-slate-600 block mb-0.5">
                                              Dạng khuyết tật cụ thể:
                                            </label>
                                            <select
                                              value={currentDefectType}
                                              onChange={(e) =>
                                                handleDefectChange(flIdx, z.id || zCode, defectKey, 'defectType', e.target.value, `${dCode} Dạng khuyết tật`)
                                              }
                                              className="w-full p-1.5 rounded-lg border border-slate-300 bg-white text-xs font-semibold text-slate-800"
                                            >
                                              {defectTypeOptions.map((dt) => (
                                                <option key={dt} value={dt}>{dt}</option>
                                              ))}
                                            </select>
                                          </div>
                                        </div>

                                        {/* Chỉ hiển thị thông số vết nứt khi thuộc nhóm/dạng Nứt (isCrackRelated === true) */}
                                        {isCrack && (
                                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 border-t border-slate-200/60">
                                            <div>
                                              <label className="text-[10px] font-bold text-rose-700 block mb-0.5">
                                                Rộng W (mm):
                                              </label>
                                              <input
                                                type="number"
                                                step="0.05"
                                                min="0"
                                                value={d.widthMaxMm ?? d.width_max_mm ?? 0}
                                                onChange={(e) =>
                                                  handleDefectChange(flIdx, z.id || zCode, defectKey, 'widthMaxMm', parseFloat(e.target.value) || 0, `${dCode} Chiều rộng nứt`)
                                                }
                                                className="w-full p-1.5 rounded-lg border border-rose-300 bg-white font-mono font-bold text-xs text-rose-700"
                                              />
                                            </div>
                                            <div>
                                              <label className="text-[10px] font-bold text-slate-600 block mb-0.5">
                                                Dài L (mm):
                                              </label>
                                              <input
                                                type="number"
                                                step="10"
                                                min="0"
                                                value={d.lengthMm ?? d.length_mm ?? 0}
                                                onChange={(e) =>
                                                  handleDefectChange(flIdx, z.id || zCode, defectKey, 'lengthMm', parseFloat(e.target.value) || 0, `${dCode} Chiều dài nứt`)
                                                }
                                                className="w-full p-1.5 rounded-lg border border-slate-300 bg-white font-mono text-xs text-slate-800"
                                              />
                                            </div>
                                            <div>
                                              <label className="text-[10px] font-bold text-slate-600 block mb-0.5">
                                                Hướng nứt:
                                              </label>
                                              <select
                                                value={d.crackDirection || 'Ngang'}
                                                onChange={(e) =>
                                                  handleDefectChange(flIdx, z.id || zCode, defectKey, 'crackDirection', e.target.value, `${dCode} Hướng nứt`)
                                                }
                                                className="w-full p-1.5 rounded-lg border border-slate-300 bg-white text-xs text-slate-800"
                                              >
                                                {CRACK_DIRECTION_OPTIONS.map((dir) => (
                                                  <option key={dir} value={dir}>{dir}</option>
                                                ))}
                                              </select>
                                            </div>
                                            <div>
                                              <label className="text-[10px] font-bold text-slate-600 block mb-0.5">
                                                Trạng thái:
                                              </label>
                                              <select
                                                value={d.activityState || 'S'}
                                                onChange={(e) =>
                                                  handleDefectChange(flIdx, z.id || zCode, defectKey, 'activityState', e.target.value, `${dCode} Trạng thái nứt`)
                                                }
                                                className="w-full p-1.5 rounded-lg border border-slate-300 bg-white text-xs text-slate-800"
                                              >
                                                {ACTIVITY_STATE_OPTIONS.map((st) => (
                                                  <option key={st.value} value={st.value}>{st.label}</option>
                                                ))}
                                              </select>
                                            </div>
                                          </div>
                                        )}

                                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1 border-t border-slate-200/60">
                                          <div>
                                            <label className="text-[10px] font-bold text-slate-600 block mb-0.5">
                                              Ảnh hưởng công năng (E6: 0-5):
                                            </label>
                                            <input
                                              type="number"
                                              min="0"
                                              max="5"
                                              value={d.functionalImpactE6 ?? 0}
                                              onChange={(e) =>
                                                handleDefectChange(flIdx, z.id || zCode, defectKey, 'functionalImpactE6', Math.min(5, Math.max(0, parseInt(e.target.value, 10) || 0)), `${dCode} Chỉ số E6`)
                                              }
                                              className="w-full p-1.5 rounded-lg border border-slate-300 bg-white font-mono text-xs text-slate-800"
                                            />
                                          </div>
                                          <div className="sm:col-span-2">
                                            <label className="text-[10px] font-bold text-slate-600 block mb-0.5">
                                              Ghi chú hiện trạng {dCode}:
                                            </label>
                                            <input
                                              type="text"
                                              value={d.notes || ''}
                                              onChange={(e) =>
                                                handleDefectChange(flIdx, z.id || zCode, defectKey, 'notes', e.target.value, `${dCode} Ghi chú`)
                                              }
                                              placeholder="Mô tả chi tiết vị trí, tình trạng..."
                                              className="w-full p-1.5 rounded-lg border border-slate-300 bg-white text-xs text-slate-800"
                                            />
                                          </div>
                                        </div>
                                      </div>
                                    ) : (
                                      (d.notes || d.crackDirection) && (
                                        <div className="text-[11px] text-slate-600 flex items-center gap-2 flex-wrap">
                                          {isCrack && d.crackDirection && <span>Hướng: <strong>{d.crackDirection}</strong></span>}
                                          {d.notes && <span className="italic text-slate-500">&ldquo;{d.notes}&rdquo;</span>}
                                        </div>
                                      )
                                    )}

                                    {/* CU Photos Strip - Kích thước 150% (rộng 345-375px, cao 320-360px) + Optimistic ADD/REPLACE/DELETE */}
                                    <div className="space-y-2">
                                      <div className="flex items-center justify-between gap-2">
                                        <span className="text-[10px] font-bold text-slate-500 block uppercase">
                                          Ảnh Cận Cảnh CU ({totalCuCount} ảnh &bull; Kích thước 150%):
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
                                                floorCode: floorName,
                                                zoneCode: zCode,
                                                photoTitle: `Thêm ảnh CU ${dCode} (${zCode})`,
                                              })
                                            }
                                            className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-[10px] flex items-center gap-1 cursor-pointer shadow-2xs"
                                          >
                                            <Plus className="w-3 h-3" />
                                            <span>Thêm Ảnh CU</span>
                                          </button>
                                        )}
                                      </div>

                                      {totalCuCount === 0 ? (
                                        <div className="text-[11px] text-slate-400 italic py-2 px-3 rounded-lg bg-slate-50 border border-dashed border-slate-200">
                                          Chưa có ảnh cận cảnh CU cho {dCode}
                                        </div>
                                      ) : (
                                        <div className="flex flex-nowrap gap-3.5 pb-1">
                                          {rawCuPhotos.map((cuUrl: string, cuIdx: number) => {
                                            const cuOpt = resolveOptimisticPhoto(cuUrl, stagedPhotoActions, {
                                              category: 'DEFECT_CU',
                                              targetPhotoType: 'CU',
                                              targetPhotoId: dCode,
                                              defectId: d.id,
                                              defectCode: dCode,
                                              zoneCode: zCode,
                                              floorCode: floorName,
                                              photoIndex: cuIdx,
                                              url: cuUrl,
                                            });
                                            const effectiveCuUrl = cuOpt.displayUrl || cuUrl;
                                            const dId = d.id ? String(d.id) : '';
                                            const isDUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-/i.test(dId);
                                            const indexedRotKey = `defect_f${flIdx}_z${zCode}_${dCode}_cu_${cuIdx}`;
                                            const uuidRotKey = isDUuid ? `defect_${dId}_cu_${cuIdx}` : '';
                                            const legacyRotKey = `defect_f${flIdx}_z${zCode}_${dId || dCode}_cu_${cuIdx}`;
                                            const rot =
                                              stagedPhotoRotations[indexedRotKey] ??
                                              (uuidRotKey ? stagedPhotoRotations[uuidRotKey] : undefined) ??
                                              stagedPhotoRotations[legacyRotKey] ??
                                              0;
                                            const orientStatus =
                                              violationsMap?.get(indexedRotKey) ||
                                              (uuidRotKey ? violationsMap?.get(uuidRotKey) : undefined) ||
                                              violationsMap?.get(legacyRotKey);
                                            const domId = `audit-photo-card-f${flIdx}-z${zCode}-defect-${dCode}-${cuIdx}`;

                                            return (
                                              <div key={cuIdx} className="w-[345px] sm:w-[375px] shrink-0">
                                                <AuditPhotoCard
                                                  url={effectiveCuUrl}
                                                  photoCode={`CU #${cuIdx + 1}`}
                                                  photoKey={indexedRotKey}
                                                  title={`${dCode} - Cận Cảnh #${cuIdx + 1} (${zCode})`}
                                                  category="DEFECT_CU"
                                                  targetPhotoType="CU"
                                                  targetPhotoId={dCode}
                                                  defectId={d.id}
                                                  defectCode={dCode}
                                                  photoIndex={cuIdx}
                                                  floorCode={floorName}
                                                  zoneCode={zCode}
                                                  isEditMode={isEditMode}
                                                  aspectRatio="h-80"
                                                  maxHeightPx={340}
                                                  badgeColor="slate"
                                                  rotation={rot}
                                                  isOrientationMismatch={Boolean(orientStatus)}
                                                  isStrictOrientation={orientStatus?.isStrict ?? false}
                                                  orientationRecommendation={orientStatus?.message}
                                                  expectedOrientation={orientStatus?.expectedOrientation || 'LANDSCAPE'}
                                                  onRotate={(newRot) => {
                                                    onRotatePhoto?.(indexedRotKey, newRot, effectiveCuUrl);
                                                    if (uuidRotKey && uuidRotKey !== indexedRotKey) {
                                                      onRotatePhoto?.(uuidRotKey, newRot, effectiveCuUrl);
                                                    }
                                                    if (legacyRotKey && legacyRotKey !== indexedRotKey) {
                                                      onRotatePhoto?.(legacyRotKey, newRot, effectiveCuUrl);
                                                    }
                                                  }}
                                                  optimisticStatus={
                                                    cuOpt.status === 'DELETED'
                                                      ? 'DELETED'
                                                      : cuOpt.status === 'REPLACED'
                                                      ? 'REPLACED'
                                                      : undefined
                                                  }
                                                  onUndoDelete={
                                                    cuOpt.stagedAction ? () => onUndoPhotoAction?.(cuOpt.stagedAction!) : undefined
                                                  }
                                                  domId={domId}
                                                  onOpenPhotoZoom={onOpenPhotoZoom}
                                                  onOpenPhotoAction={onOpenPhotoAction}
                                                  onOpenPhotoHistory={onOpenPhotoHistory}
                                                />
                                              </div>
                                            );
                                          })}

                                          {/* Ảnh CU mới thêm (Optimistic ADD) xuất hiện ngay lập tức trước khi Lưu Diff */}
                                          {addedCuPhotos.map((addedItem, addIdx) => {
                                            const cuIdx = rawCuPhotos.length + addIdx;
                                            const addRotKey = `defect_f${flIdx}_z${zCode}_${dCode}_cu_added_${addIdx}`;
                                            const addRot = stagedPhotoRotations[addRotKey] ?? 0;
                                            return (
                                              <div key={`added-cu-${addIdx}`} className="w-[345px] sm:w-[375px] shrink-0">
                                                <AuditPhotoCard
                                                  url={addedItem.displayUrl}
                                                  photoCode={`CU #${cuIdx + 1} (Mới)`}
                                                  photoKey={addRotKey}
                                                  title={`${dCode} - Cận Cảnh #${cuIdx + 1} (Mới thêm • Chờ lưu)`}
                                                  category="DEFECT_CU"
                                                  targetPhotoType="CU"
                                                  targetPhotoId={dCode}
                                                  defectId={d.id}
                                                  defectCode={dCode}
                                                  photoIndex={cuIdx}
                                                  floorCode={floorName}
                                                  zoneCode={zCode}
                                                  isEditMode={isEditMode}
                                                  aspectRatio="h-80"
                                                  maxHeightPx={340}
                                                  badgeColor="emerald"
                                                  rotation={addRot}
                                                  onRotate={(newRot) => onRotatePhoto?.(addRotKey, newRot, addedItem.displayUrl)}
                                                  optimisticStatus="ADDED"
                                                  onUndoDelete={() => onUndoPhotoAction?.(addedItem.action)}
                                                  onOpenPhotoZoom={onOpenPhotoZoom}
                                                  onOpenPhotoAction={onOpenPhotoAction}
                                                  onOpenPhotoHistory={onOpenPhotoHistory}
                                                />
                                              </div>
                                            );
                                          })}
                                        </div>
                                      )}
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

              {/* ========================================================
                  MỤC 3: CAD_E - SƠ ĐỒ MẶT BẰNG KẾT CẤU & GHIM CẤU KIỆN E
                  ======================================================== */}
              <div
                id={`step-4-floor-${flIdx}-cad-e`}
                className="scroll-mt-14 border border-slate-200 rounded-2xl p-4 bg-white space-y-3 shadow-2xs"
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-slate-200">
                  <div className="flex items-center gap-2">
                    <Compass className="w-4 h-4 text-amber-600" />
                    <span className="text-xs font-black text-slate-800 uppercase tracking-wide">
                      CAD_E: Sơ Đồ Mặt Bằng Kết Cấu ({floorName}) &bull; Điểm Ghim Cấu Kiện E
                    </span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-amber-100 text-amber-800 font-bold">
                      {displayedCadElementPins.length} Ghim E
                    </span>
                  </div>

                  <div className="flex items-center gap-2 flex-wrap">
                    {effectiveStructCad && (
                      <button
                        type="button"
                        onClick={() =>
                          onOpenPhotoZoom(
                            effectiveStructCad,
                            `Sơ đồ CAD Kết cấu (E) - ${floorName}`,
                            `CAD_E_${floorName}`,
                            structCadRotation
                          )
                        }
                        className="px-2.5 py-1 rounded-lg bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold flex items-center gap-1 transition-colors shadow-xs cursor-pointer"
                      >
                        <Maximize2 className="w-3.5 h-3.5" />
                        <span>Phóng to</span>
                      </button>
                    )}

                    {effectiveStructCad && (isEditMode || onRotatePhoto) && (
                      <button
                        type="button"
                        onClick={() => handleRotateCad(flIdx, true)}
                        className="px-2.5 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold flex items-center gap-1 transition-colors shadow-xs cursor-pointer"
                        title="Xoay bản vẽ CAD Kết cấu 90°"
                      >
                        <RotateCw className="w-3.5 h-3.5" />
                        <span>Xoay CAD 90°</span>
                        {structCadRotation > 0 && <span className="text-[10px] font-mono">({structCadRotation}°)</span>}
                      </button>
                    )}

                    {isEditMode && (
                      <button
                        type="button"
                        onClick={() => {
                          const isCurrentMode = cadPinningMode?.floorIdx === flIdx && cadPinningMode?.mode === 'E';
                          setCadPinningMode(isCurrentMode ? null : { floorIdx: flIdx, mode: 'E' });
                        }}
                        className={`px-2.5 py-1 rounded-lg border text-xs font-bold flex items-center gap-1.5 transition-all cursor-pointer shadow-xs ${
                          cadPinningMode?.floorIdx === flIdx && cadPinningMode?.mode === 'E'
                            ? 'bg-amber-600 text-white border-amber-700 animate-pulse'
                            : 'bg-amber-50 text-amber-800 border-amber-300 hover:bg-amber-100'
                        }`}
                      >
                        <Crosshair className="w-3.5 h-3.5" />
                        <span>{cadPinningMode?.floorIdx === flIdx && cadPinningMode?.mode === 'E' ? 'Đang ghim E...' : '+ Ghim E'}</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Banner khi đang ở chế độ Ghim E */}
                {cadPinningMode?.floorIdx === flIdx && cadPinningMode?.mode === 'E' && (
                  <div className="px-3.5 py-2 rounded-xl bg-amber-500/10 border border-amber-300 text-amber-900 text-xs font-bold flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Crosshair className="w-4 h-4 text-amber-600 animate-spin" />
                      <span>Bấm vào vị trí trên bản vẽ CAD bên dưới để tạo điểm ghim Cấu Kiện E mới</span>
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

                {/* Khung hiển thị CAD Kết cấu */}
                {effectiveStructCad || effectiveCad ? (
                  <div
                    id={`audit-photo-card-f${flIdx}-cad-struct`}
                    className={`relative w-full min-h-[260px] bg-slate-900 rounded-xl overflow-hidden flex items-center justify-center p-3 select-none transition-all ${
                      structCadViolation ? 'border-2 border-red-500 ring-2 ring-red-400/50' : 'border border-slate-300'
                    }`}
                  >
                    {structCadViolation && (
                      <div className="absolute top-3 left-3 z-30 px-2.5 py-1 rounded-lg bg-red-600 text-white text-[10px] font-black shadow-lg flex items-center gap-1.5">
                        <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                        <span>Bắt buộc xoay Dọc (Portrait) &mdash; Bấm "Xoay CAD 90&deg;" để chuẩn hóa</span>
                      </div>
                    )}
                    <RotatableImageFrame
                      src={effectiveStructCad || effectiveCad}
                      alt={`CAD Kết cấu ${floorName}`}
                      rotation={structCadRotation}
                      maxHeightPx={680}
                      stageOnClick={(e) => handleCadImageClick(e, flIdx, 'E')}
                      stageClassName={`mx-auto ${
                        cadPinningMode?.floorIdx === flIdx && cadPinningMode?.mode === 'E' ? 'cursor-crosshair' : ''
                      }`}
                    >
                      {/* Ghim Cấu kiện E trên CAD */}
                      {showCadPins &&
                        displayedCadElementPins.map((pin: CadZonePin, pIdx: number) => {
                          const pX = Number(pin.pinX ?? pin.pin_x ?? 50);
                          const pY = Number(pin.pinY ?? pin.pin_y ?? 50);
                          const pCode = pin.zoneCode || pin.zone_code || `E-${pIdx + 1}`;
                          const isBeingDragged = draggingCadPin?.floorIdx === flIdx && draggingCadPin?.pinCode === pCode;
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
                                pointerStartPosRef.current = { x: e.clientX, y: e.clientY };
                                hasJustDraggedRef.current = false;
                                (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
                                setDraggingCadPin({
                                  floorIdx: flIdx,
                                  pinCode: pCode,
                                  isStruct: true,
                                  currentX: pX,
                                  currentY: pY,
                                });
                              }}
                              onPointerMove={(e) => {
                                if (!draggingCadPin || draggingCadPin.floorIdx !== flIdx || draggingCadPin.pinCode !== pCode) return;
                                e.stopPropagation();
                                if (pointerStartPosRef.current) {
                                  const dist = Math.hypot(e.clientX - pointerStartPosRef.current.x, e.clientY - pointerStartPosRef.current.y);
                                  if (dist > 3) {
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
                                setDraggingCadPin((prev) => (prev ? { ...prev, currentX: clampedX, currentY: clampedY } : null));
                              }}
                              onPointerUp={(e) => {
                                if (!draggingCadPin || draggingCadPin.floorIdx !== flIdx || draggingCadPin.pinCode !== pCode) return;
                                e.stopPropagation();
                                try {
                                  (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
                                } catch (err) {
                                  console.warn('[AuditStep3FloorDefects] releasePointerCapture failed:', err);
                                }
                                const finalX = draggingCadPin.currentX;
                                const finalY = draggingCadPin.currentY;
                                setDraggingCadPin(null);
                                pointerStartPosRef.current = null;
                                if (Math.abs(finalX - pX) > 0.3 || Math.abs(finalY - pY) > 0.3) {
                                  hasJustDraggedRef.current = true;
                                  handleCommitCadPinCoord(flIdx, pCode, true, finalX, finalY);
                                  setTimeout(() => {
                                    hasJustDraggedRef.current = false;
                                  }, 250);
                                }
                              }}
                              onClick={(e) => {
                                e.stopPropagation();
                                if (hasJustDraggedRef.current || isEditMode) {
                                  return;
                                }
                                const target = document.getElementById(`element-card-f${flIdx}-${pCode}`);
                                if (target) {
                                  target.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                  target.classList.add('ring-4', 'ring-amber-400');
                                  setTimeout(() => target.classList.remove('ring-4', 'ring-amber-400'), 2500);
                                }
                              }}
                            >
                              <div className="px-1.5 py-0.5 rounded text-[10px] font-mono font-black shadow-lg bg-amber-600 text-white group-hover:scale-110 transition-transform">
                                {pCode}
                              </div>
                              <div className="w-2.5 h-2.5 rounded-full border-2 border-white shadow-md -mt-0.5 bg-amber-400" />
                            </div>
                          );
                        })}
                    </RotatableImageFrame>
                  </div>
                ) : (
                  <div className="py-8 border-2 border-dashed border-slate-300 rounded-xl flex flex-col items-center justify-center gap-2 text-slate-400 bg-slate-50/50">
                    <Layers className="w-7 h-7 text-slate-300" />
                    <span className="text-xs italic">Chưa có bản vẽ CAD Kết cấu cho {floorName}</span>
                  </div>
                )}
              </div>

              {/* ========================================================
                  MỤC 4: E - CHI TIẾT CÁC CẤU KIỆN KẾT CẤU E & KHUYẾT TẬT
                  ======================================================== */}
              <div
                id={`step-4-floor-${flIdx}-elements`}
                className="scroll-mt-14 space-y-4"
              >
                <div className="flex items-center justify-between pb-2 border-b border-slate-200 flex-wrap gap-2">
                  <div className="flex items-center gap-2">
                    <ShieldAlert className="w-4 h-4 text-amber-600" />
                    <span className="text-xs font-black text-slate-800 uppercase tracking-wide">
                      E: Danh Sách Cấu Kiện Kết Cấu ({activeElements.length} Cấu Kiện) &bull; {floorName}
                    </span>
                  </div>
                  {isEditMode && (
                    <button
                      type="button"
                      onClick={() => handleAddElementDirect(flIdx)}
                      className="px-2.5 py-1 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-bold transition-colors shadow-2xs flex items-center gap-1 cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>+ Thêm Cấu Kiện E</span>
                    </button>
                  )}
                </div>

                {displayedElements.length === 0 ? (
                  <div className="p-6 text-center bg-white rounded-xl border border-slate-200 text-slate-400 text-xs">
                    Tầng này chưa có Cấu Kiện Kết Cấu E nào
                  </div>
                ) : (
                  displayedElements.map((elem: StructuralElementData) => {
                    const eCode = elem.elementCode || elem.element_code || 'E-??';
                    const isElemDeleted = isItemSoftDeleted(elem);
                    const rawDefectsList: DefectItem[] = Array.isArray(elem.defects) ? elem.defects : [];
                    const defectsList = showDeletedItems ? rawDefectsList : rawDefectsList.filter((d) => !isItemSoftDeleted(d));

                    const rawElemCtxUrl = elem.ctxPhotoUrl || (elem as StructuralElementData & { ctx_photo_url?: string }).ctx_photo_url || '';
                    const stagedElemCtx = getStagedAction({
                      category: 'ELEMENT_CTX',
                      targetPhotoId: elem.id,
                      url: rawElemCtxUrl || undefined,
                      includeAdd: !rawElemCtxUrl,
                    });
                    const effectiveElemCtxUrl = stagedElemCtx?.action === 'DELETE' ? '' : (stagedElemCtx?.newPhotoUrl || rawElemCtxUrl);
                    const eIdStr = elem.id ? String(elem.id) : '';
                    const isEUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-/i.test(eIdStr);
                    const elemCtxKey = `element_f${flIdx}_e${eCode}_ctx`;
                    const legacyElemCtxKey = isEUuid ? `elem_${eIdStr}_ctx` : `elem_f${flIdx}_e${eCode}_ctx`;
                    const elemCtxRot =
                      stagedPhotoRotations[elemCtxKey] ??
                      stagedPhotoRotations[legacyElemCtxKey] ??
                      stagedPhotoRotations[effectiveElemCtxUrl] ??
                      0;
                    const elemCtxViolation =
                      violationsMap?.get(elemCtxKey) ||
                      violationsMap?.get(legacyElemCtxKey) ||
                      (effectiveElemCtxUrl ? violationsMap?.get(effectiveElemCtxUrl) : undefined);
                    const hasElemPinsOrPinning =
                      defectsList.length > 0 || (pinningCtxZone?.floorIdx === flIdx && pinningCtxZone?.zoneOrElemCode === eCode);

                    const rawElemOverviewList = Array.isArray(elem.overviewPhotos) ? elem.overviewPhotos : [];
                    const addedElemOverviewPhotos = getOptimisticAddedPhotos(stagedPhotoActions, {
                      category: 'ELEMENT_OVERVIEW',
                      targetPhotoType: 'OVERVIEW',
                      targetPhotoId: elem.id || eCode,
                      floorCode: floorName,
                      zoneCode: eCode,
                    });

                    return (
                      <div
                        key={elem.id || eCode}
                        id={`element-card-f${flIdx}-${eCode}`}
                        className={`rounded-2xl p-4 sm:p-5 space-y-4 transition-all bg-white border border-slate-200 shadow-2xs ${
                          isElemDeleted ? 'opacity-70 border-dashed border-rose-300 bg-rose-50/20' : ''
                        }`}
                      >
                        {/* Element Header */}
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="px-2.5 py-0.5 rounded-lg bg-amber-700 text-white font-mono font-black text-xs">
                              {eCode}
                            </span>
                            {isElemDeleted && (
                              <span className="px-2 py-0.5 rounded bg-rose-100 text-rose-700 border border-rose-300 text-[10px] font-bold">
                                Đã xóa mềm
                              </span>
                            )}
                            {isEditMode ? (
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <select
                                  value={elem.elementType || 'Cột BTCT'}
                                  onChange={(e) => handleElementFieldChange(flIdx, elem.id, 'elementType', e.target.value, 'Loại cấu kiện')}
                                  className="p-1 text-xs border border-amber-300 rounded font-bold bg-white"
                                >
                                  {ELEMENT_TYPE_PRESETS.map((t) => (
                                    <option key={t} value={t}>{t}</option>
                                  ))}
                                </select>
                                <span>&bull;</span>
                                <select
                                  value={elem.materialType || 'Bê tông cốt thép (BTCT)'}
                                  onChange={(e) => handleElementFieldChange(flIdx, elem.id, 'materialType', e.target.value, 'Vật liệu')}
                                  className="p-1 text-xs border border-amber-300 rounded font-bold bg-white"
                                >
                                  {MATERIAL_TYPE_PRESETS.map((m) => (
                                    <option key={m} value={m}>{m}</option>
                                  ))}
                                </select>
                                <span>&bull;</span>
                                <input
                                  type="text"
                                  value={elem.roomName || ''}
                                  onChange={(e) => handleElementFieldChange(flIdx, elem.id, 'roomName', e.target.value, 'Vị trí trục')}
                                  placeholder="Trục / Vị trí..."
                                  className="p-1 text-xs border border-amber-300 rounded bg-amber-50/40 w-32"
                                />
                              </div>
                            ) : (
                              <span className="text-xs font-bold text-slate-800">
                                {elem.elementType || 'Cột BTCT'} &bull; {elem.materialType || 'BTCT'} &bull; {elem.roomName || 'Trục không xác định'}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant={defectsList.length > 0 ? 'warning' : 'success'} size="sm">
                              {defectsList.length} khuyết tật kết cấu
                            </Badge>
                            {isEditMode && (
                              isElemDeleted ? (
                                <button
                                  type="button"
                                  onClick={() => handleRestoreElement(flIdx, elem.id)}
                                  className="px-2 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-300 text-xs font-bold flex items-center gap-1 cursor-pointer transition-colors"
                                >
                                  <RotateCcw className="w-3.5 h-3.5 text-emerald-600" />
                                  <span>Khôi phục Cấu Kiện</span>
                                </button>
                              ) : (
                                <button
                                  type="button"
                                  onClick={() => handleRemoveElement(flIdx, elem.id)}
                                  className="px-2 py-1 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-300 text-xs font-bold flex items-center gap-1 cursor-pointer transition-colors"
                                >
                                  <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                                  <span>Xóa Cấu Kiện</span>
                                </button>
                              )
                            )}
                          </div>
                        </div>

                        {/* Dải ảnh tổng quan Cấu kiện E (nếu có hoặc ở chế độ sửa) - 2.5 ảnh lấp đầy 100% khung ngang */}
                        {(rawElemOverviewList.length > 0 || addedElemOverviewPhotos.length > 0 || isEditMode) && (
                          <div className="space-y-1.5">
                            <div className="flex items-center justify-between gap-2 flex-wrap">
                              <span className="text-[10px] font-bold uppercase text-slate-500 block">
                                Ảnh Tổng Quan Cấu Kiện ({rawElemOverviewList.length + addedElemOverviewPhotos.length} ảnh):
                              </span>
                              {isEditMode && onOpenPhotoAction && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    onOpenPhotoAction({
                                      category: 'ELEMENT_OVERVIEW',
                                      initialMode: 'ADD',
                                      targetPhotoType: 'OVERVIEW',
                                      targetPhotoId: elem.id || eCode,
                                      floorCode: floorName,
                                      zoneCode: eCode,
                                      photoIndex: rawElemOverviewList.length + addedElemOverviewPhotos.length,
                                      photoTitle: `Ảnh tổng quan cấu kiện ${eCode} #${rawElemOverviewList.length + addedElemOverviewPhotos.length + 1}`,
                                    })
                                  }
                                  className="px-2 py-0.5 rounded bg-sky-50 hover:bg-sky-100 text-sky-700 border border-sky-200 text-[10px] font-bold flex items-center gap-1 cursor-pointer transition-colors"
                                >
                                  <Plus className="w-3 h-3" />
                                  <span>+ Thêm Ảnh Tổng Quan</span>
                                </button>
                              )}
                            </div>
                            {rawElemOverviewList.length === 0 && addedElemOverviewPhotos.length === 0 ? (
                              <div className="text-[11px] text-slate-400 italic py-1.5 px-3 bg-slate-50 rounded-lg border border-dashed border-slate-200">
                                Chưa có ảnh tổng quan cho cấu kiện {eCode}.
                              </div>
                            ) : (
                              <div className="flex flex-nowrap gap-4 overflow-x-auto pb-2.5 scrollbar-thin">
                                {rawElemOverviewList.map((rawPhotoUrl, pIdx) => {
                                  const resolvedOv = resolveOptimisticPhoto(rawPhotoUrl, stagedPhotoActions, {
                                    category: 'ELEMENT_OVERVIEW',
                                    targetPhotoType: 'OVERVIEW',
                                    targetPhotoId: elem.id || eCode,
                                    photoIndex: pIdx,
                                    floorCode: floorName,
                                    zoneCode: eCode,
                                  });
                                  const photoUrl = resolvedOv.displayUrl;
                                  const elemOvKey = `element_f${flIdx}_e${eCode}_ov_${pIdx}`;
                                  const legacyElemOvKey = isEUuid ? `elem_${eIdStr}_ov_${pIdx}` : `elem_f${flIdx}_e${eCode}_ov_${pIdx}`;
                                  const elemOvRot =
                                    stagedPhotoRotations[elemOvKey] ??
                                    stagedPhotoRotations[legacyElemOvKey] ??
                                    stagedPhotoRotations[photoUrl] ??
                                    0;
                                  const elemOvViolation =
                                    violationsMap?.get(elemOvKey) ||
                                    violationsMap?.get(legacyElemOvKey) ||
                                    violationsMap?.get(photoUrl);
                                  const elemOvDomId = `audit-photo-card-f${flIdx}-elem-${eCode}-ov-${pIdx}`;

                                  return (
                                    <div
                                      key={pIdx}
                                      className="w-[calc((100%-2rem)/2.5)] min-w-[240px] shrink-0"
                                    >
                                      <AuditPhotoCard
                                        url={photoUrl}
                                        photoCode={`#${pIdx + 1}`}
                                        photoKey={elemOvKey}
                                        title={`Ảnh cấu kiện ${eCode} #${pIdx + 1}`}
                                        category="ELEMENT_OVERVIEW"
                                        targetPhotoType="OVERVIEW"
                                        targetPhotoId={elem.id || eCode}
                                        photoIndex={pIdx}
                                        floorCode={floorName}
                                        zoneCode={eCode}
                                        isEditMode={isEditMode}
                                        aspectRatio="aspect-4/3"
                                        badgeColor="slate"
                                        rotation={elemOvRot}
                                        isOrientationMismatch={Boolean(elemOvViolation)}
                                        isStrictOrientation={elemOvViolation?.isStrict ?? false}
                                        orientationRecommendation={elemOvViolation?.message}
                                        expectedOrientation={elemOvViolation?.expectedOrientation || 'LANDSCAPE'}
                                        onRotate={(newRot) => onRotatePhoto?.(elemOvKey, newRot, photoUrl)}
                                        optimisticStatus={
                                          resolvedOv.status === 'DELETED'
                                            ? 'DELETED'
                                            : resolvedOv.status === 'REPLACED'
                                            ? 'REPLACED'
                                            : undefined
                                        }
                                        onUndoDelete={
                                          resolvedOv.matchedAction
                                            ? () => onUndoPhotoAction?.(resolvedOv.matchedAction!)
                                            : undefined
                                        }
                                        domId={elemOvDomId}
                                        onOpenPhotoZoom={onOpenPhotoZoom}
                                        onOpenPhotoAction={onOpenPhotoAction}
                                        onOpenPhotoHistory={onOpenPhotoHistory}
                                      />
                                    </div>
                                  );
                                })}

                                {/* Optimistic newly added ELEMENT_OVERVIEW photos */}
                                {addedElemOverviewPhotos.map((addedItem, addIdx) => {
                                  const pIdx = rawElemOverviewList.length + addIdx;
                                  const elemOvKey = `element_f${flIdx}_e${eCode}_ov_added_${addIdx}`;
                                  const elemOvRot =
                                    stagedPhotoRotations[elemOvKey] ??
                                    stagedPhotoRotations[addedItem.displayUrl] ??
                                    0;
                                  return (
                                    <div
                                      key={`added-elem-ov-${addIdx}`}
                                      className="w-[calc((100%-2rem)/2.5)] min-w-[240px] shrink-0"
                                    >
                                      <AuditPhotoCard
                                        url={addedItem.displayUrl}
                                        photoCode={`#${pIdx + 1} (Mới)`}
                                        photoKey={elemOvKey}
                                        title={`Ảnh cấu kiện ${eCode} #${pIdx + 1} (Mới thêm • Chờ lưu)`}
                                        category="ELEMENT_OVERVIEW"
                                        targetPhotoType="OVERVIEW"
                                        targetPhotoId={elem.id || eCode}
                                        photoIndex={pIdx}
                                        floorCode={floorName}
                                        zoneCode={eCode}
                                        isEditMode={isEditMode}
                                        aspectRatio="aspect-4/3"
                                        badgeColor="emerald"
                                        rotation={elemOvRot}
                                        onRotate={(newRot) => onRotatePhoto?.(elemOvKey, newRot, addedItem.displayUrl)}
                                        optimisticStatus="ADDED"
                                        onUndoDelete={() => onUndoPhotoAction?.(addedItem.action)}
                                        onOpenPhotoZoom={onOpenPhotoZoom}
                                        onOpenPhotoAction={onOpenPhotoAction}
                                        onOpenPhotoHistory={onOpenPhotoHistory}
                                      />
                                    </div>
                                  );
                                })}
                              </div>
                            )}
                          </div>
                        )}

                        {/* Bố cục Cuộn Ngang Đồng Nhất (Unified Horizontal Scroll): Ảnh Bối Cảnh E_CTX 65% chạy cùng các thẻ Khuyết tật D & Cận cảnh CU */}
                        <div className="space-y-2.5 pt-2 border-t border-slate-100">
                          <div className="flex items-center justify-between gap-2 flex-wrap">
                            <span className="text-[11px] font-bold text-slate-700">
                              Bối Cảnh Ghim ({eCode} - CTX) &amp; Danh Sách Khuyết Tật Kết Cấu D ({defectsList.length} mục):
                            </span>
                            <div className="flex items-center gap-2">
                              {hasElemPinsOrPinning && (
                                <span className="text-[10px] text-slate-500 italic hidden sm:inline">
                                  Cuộn ngang để xem toàn bộ các thẻ D và ảnh cận cảnh CU &rarr;
                                </span>
                              )}
                              {isEditMode && (
                                <button
                                  type="button"
                                  onClick={() => handleAddElementDefect(flIdx, elem.id)}
                                  className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs cursor-pointer shadow-2xs flex items-center gap-1"
                                >
                                  <Plus className="w-3.5 h-3.5" />
                                  <span>+ Thêm Khuyết Tật Kết Cấu D</span>
                                </button>
                              )}
                            </div>
                          </div>

                          <div
                            className={
                              hasElemPinsOrPinning
                                ? 'flex flex-nowrap gap-5 overflow-x-auto pb-4 items-start scrollbar-thin'
                                : 'flex flex-col lg:flex-row gap-5 items-start'
                            }
                          >
                            {/* KHỐI 1 (65% khi có ghim D): Ảnh Bối Cảnh Cấu Kiện E_CTX & Ghim D (cuộn ngang cùng các thẻ D) */}
                            <div
                              className={`shrink-0 space-y-2 ${
                                hasElemPinsOrPinning
                                  ? 'w-[85%] sm:w-[68%] lg:w-[62%] min-w-[360px] max-w-[760px]'
                                  : 'w-full sm:w-[calc((100%-2rem)/2.5)] min-w-[260px]'
                              }`}
                            >
                              <div className="flex items-center justify-between gap-2 flex-wrap">
                                <span className="text-[10px] font-bold uppercase text-slate-600 block">
                                  Ảnh Bối Cảnh &amp; Ghim Khuyết Tật ({eCode} - CTX):
                                </span>
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  {effectiveElemCtxUrl && (
                                    <button
                                      type="button"
                                      onClick={() =>
                                        onOpenPhotoZoom(
                                          effectiveElemCtxUrl,
                                          `Ảnh bối cảnh cấu kiện ${eCode}`,
                                          `${eCode}-CTX`,
                                          elemCtxRot
                                        )
                                      }
                                      className="px-2 py-0.5 rounded bg-sky-50 hover:bg-sky-100 text-sky-700 border border-sky-200 text-[10px] font-bold flex items-center gap-1 cursor-pointer"
                                    >
                                      <Maximize2 className="w-3 h-3" />
                                      <span>Phóng to</span>
                                    </button>
                                  )}
                                  {effectiveElemCtxUrl && (isEditMode || onRotatePhoto) && (
                                    <button
                                      type="button"
                                      onClick={() => handleRotateElementCtx(flIdx, elem, elemCtxRot, elemCtxKey, 90)}
                                      className="px-2 py-0.5 rounded bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 text-[10px] font-bold flex items-center gap-1 cursor-pointer"
                                      title="Xoay ảnh CTX 90° & chuyển vị ghim D"
                                    >
                                      <RotateCw className="w-3 h-3" />
                                      <span>Xoay 90&deg;</span>
                                    </button>
                                  )}
                                  {isEditMode && effectiveElemCtxUrl && (
                                    <button
                                      type="button"
                                      onClick={() => {
                                        const isCur = pinningCtxZone?.floorIdx === flIdx && pinningCtxZone?.zoneOrElemCode === eCode;
                                        setPinningCtxZone(isCur ? null : { floorIdx: flIdx, zoneOrElemCode: eCode });
                                      }}
                                      className={`px-2 py-0.5 rounded text-[10px] font-bold flex items-center gap-1 cursor-pointer ${
                                        pinningCtxZone?.floorIdx === flIdx && pinningCtxZone?.zoneOrElemCode === eCode
                                          ? 'bg-rose-600 text-white animate-pulse'
                                          : 'bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200'
                                      }`}
                                    >
                                      <Crosshair className="w-3 h-3" />
                                      <span>{pinningCtxZone?.floorIdx === flIdx && pinningCtxZone?.zoneOrElemCode === eCode ? 'Đang ghim D...' : '+ Ghim D'}</span>
                                    </button>
                                  )}
                                  {isEditMode && onOpenPhotoAction && (
                                    <button
                                      type="button"
                                      onClick={() =>
                                        onOpenPhotoAction({
                                          category: 'ELEMENT_CTX',
                                          initialMode: effectiveElemCtxUrl ? 'REPLACE' : 'ADD',
                                          targetPhotoType: 'CTX',
                                          targetPhotoId: elem.id || eCode,
                                          floorCode: floorName,
                                          zoneCode: eCode,
                                          currentPhotoUrl: effectiveElemCtxUrl || undefined,
                                          photoTitle: `Ảnh bối cảnh ${eCode}`,
                                        })
                                      }
                                      className="px-2 py-0.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 text-[10px] font-bold flex items-center gap-1 cursor-pointer"
                                    >
                                      <Edit3 className="w-3 h-3" />
                                      <span>{effectiveElemCtxUrl ? 'Đổi ảnh' : '+ Thêm CTX'}</span>
                                    </button>
                                  )}
                                </div>
                              </div>

                              {effectiveElemCtxUrl ? (
                                <div
                                  id={`audit-photo-card-f${flIdx}-elem-${eCode}-ctx`}
                                  className={`relative w-full bg-slate-900 rounded-xl overflow-hidden flex items-center justify-center p-2.5 select-none ${
                                    hasElemPinsOrPinning ? 'min-h-[280px]' : 'h-60'
                                  } ${
                                    pinningCtxZone?.floorIdx === flIdx && pinningCtxZone?.zoneOrElemCode === eCode
                                      ? 'ring-2 ring-rose-500'
                                      : elemCtxViolation
                                      ? elemCtxViolation.isStrict
                                        ? 'border-2 border-amber-500 ring-2 ring-amber-400/50'
                                        : 'border-2 border-yellow-400 ring-1 ring-yellow-300/60'
                                      : 'border border-slate-300'
                                  }`}
                                >
                                  {elemCtxViolation && (
                                    <div
                                      className={`absolute top-2.5 left-2.5 z-30 px-2 py-0.5 rounded-md text-[10px] font-black shadow-md flex items-center gap-1 ${
                                        elemCtxViolation.isStrict
                                          ? 'bg-amber-500 text-slate-950'
                                          : 'bg-yellow-400/95 text-slate-950'
                                      }`}
                                    >
                                      {elemCtxViolation.isStrict ? (
                                        <>
                                          <AlertTriangle className="w-3 h-3 shrink-0" />
                                          <span>Cần xoay A4</span>
                                        </>
                                      ) : (
                                        <>
                                          <Lightbulb className="w-3 h-3 shrink-0" />
                                          <span>Khuyến nghị xoay</span>
                                        </>
                                      )}
                                    </div>
                                  )}

                                  <RotatableImageFrame
                                    src={effectiveElemCtxUrl}
                                    alt={`Bối cảnh ${eCode}`}
                                    rotation={elemCtxRot}
                                    maxHeightPx={hasElemPinsOrPinning ? 520 : 225}
                                    stageOnClick={(e) => {
                                      if (pinningCtxZone?.floorIdx === flIdx && pinningCtxZone?.zoneOrElemCode === eCode) {
                                        handleElemCtxImageClick(e, flIdx, elem);
                                      } else {
                                        onOpenPhotoZoom(
                                          effectiveElemCtxUrl,
                                          `Ảnh bối cảnh cấu kiện ${eCode}`,
                                          `${eCode}-CTX`,
                                          elemCtxRot
                                        );
                                      }
                                    }}
                                    stageClassName={`mx-auto ${
                                      pinningCtxZone?.floorIdx === flIdx && pinningCtxZone?.zoneOrElemCode === eCode
                                        ? 'cursor-crosshair'
                                        : 'cursor-zoom-in'
                                    }`}
                                  >
                                    {/* Điểm ghim khuyết tật D trên ảnh bối cảnh E_CTX */}
                                    {defectsList.map((def: DefectItem, dIdx: number) => {
                                      const dCode = def.defectCode || `D-${String(dIdx + 1).padStart(2, '0')}`;
                                      const defIdOrCode = def.id || dCode;
                                      const elemIdOrCode = elem.id || eCode;
                                      const pX = Number(def.pinX ?? def.pin_x ?? 50);
                                      const pY = Number(def.pinY ?? def.pin_y ?? 50);
                                      const isDraggingThisD =
                                        draggingDefectPin?.floorIdx === flIdx &&
                                        draggingDefectPin?.zoneId === elemIdOrCode &&
                                        draggingDefectPin?.defectId === defIdOrCode;
                                      const displayX = isDraggingThisD ? draggingDefectPin.currentX : pX;
                                      const displayY = isDraggingThisD ? draggingDefectPin.currentY : pY;
                                      const isDefDeleted = isItemSoftDeleted(def);

                                      return (
                                        <div
                                          key={defIdOrCode}
                                          style={{
                                            position: 'absolute',
                                            top: `${displayY}%`,
                                            left: `${displayX}%`,
                                            transform: 'translate(-50%, -100%)',
                                            zIndex: isDraggingThisD ? 50 : 25,
                                            touchAction: 'none',
                                          }}
                                          className={`flex flex-col items-center pointer-events-auto select-none group ${
                                            isEditMode ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer'
                                          }`}
                                          onPointerDown={(e) => {
                                            if (!isEditMode) return;
                                            e.stopPropagation();
                                            pointerStartPosRef.current = { x: e.clientX, y: e.clientY };
                                            hasJustDraggedRef.current = false;
                                            (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
                                            setDraggingDefectPin({
                                              floorIdx: flIdx,
                                              zoneId: elemIdOrCode,
                                              defectId: defIdOrCode,
                                              dCode,
                                              currentX: pX,
                                              currentY: pY,
                                            });
                                          }}
                                          onPointerMove={(e) => {
                                            if (
                                              !draggingDefectPin ||
                                              draggingDefectPin.floorIdx !== flIdx ||
                                              draggingDefectPin.zoneId !== elemIdOrCode ||
                                              draggingDefectPin.defectId !== defIdOrCode
                                            ) {
                                              return;
                                            }
                                            e.stopPropagation();
                                            if (pointerStartPosRef.current) {
                                              const dist = Math.hypot(
                                                e.clientX - pointerStartPosRef.current.x,
                                                e.clientY - pointerStartPosRef.current.y
                                              );
                                              if (dist > 3) {
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
                                            setDraggingDefectPin((prev) =>
                                              prev ? { ...prev, currentX: clampedX, currentY: clampedY } : null
                                            );
                                          }}
                                          onPointerUp={(e) => {
                                            if (
                                              !draggingDefectPin ||
                                              draggingDefectPin.floorIdx !== flIdx ||
                                              draggingDefectPin.zoneId !== elemIdOrCode ||
                                              draggingDefectPin.defectId !== defIdOrCode
                                            ) {
                                              return;
                                            }
                                            e.stopPropagation();
                                            try {
                                              (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
                                            } catch (err) {
                                              console.warn('[AuditStep3FloorDefects] releasePointerCapture failed:', err);
                                            }
                                            const finalX = draggingDefectPin.currentX;
                                            const finalY = draggingDefectPin.currentY;
                                            setDraggingDefectPin(null);
                                            pointerStartPosRef.current = null;
                                            if (Math.abs(finalX - pX) > 0.3 || Math.abs(finalY - pY) > 0.3) {
                                              hasJustDraggedRef.current = true;
                                              handleCommitDefectPinCoord(flIdx, elemIdOrCode, defIdOrCode, dCode, finalX, finalY);
                                              setTimeout(() => {
                                                hasJustDraggedRef.current = false;
                                              }, 250);
                                            }
                                          }}
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            if (hasJustDraggedRef.current || isEditMode) {
                                              return;
                                            }
                                            const el = document.getElementById(`defect-card-f${flIdx}-${eCode}-${dCode}`);
                                            if (el) {
                                              el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                                              el.classList.add('ring-4', 'ring-amber-400');
                                              setTimeout(() => el.classList.remove('ring-4', 'ring-amber-400'), 2000);
                                            }
                                          }}
                                        >
                                          <div className="relative flex items-center">
                                            <div
                                              className={`px-1.5 py-0.5 rounded text-white text-[10px] font-mono font-black shadow-lg border border-white group-hover:scale-110 transition-transform ${
                                                isDefDeleted ? 'bg-slate-500 line-through opacity-75' : 'bg-rose-600'
                                              }`}
                                            >
                                              {dCode}
                                            </div>
                                            {isEditMode && !isDefDeleted && (
                                              <button
                                                type="button"
                                                title={`Xóa ghim ${dCode}`}
                                                onPointerDown={(ev) => ev.stopPropagation()}
                                                onClick={(ev) => {
                                                  ev.stopPropagation();
                                                  handleRemoveElementDefect(flIdx, elemIdOrCode, defIdOrCode);
                                                }}
                                                className="ml-0.5 w-4 h-4 rounded-full bg-slate-900/90 hover:bg-rose-600 text-white flex items-center justify-center text-[9px] font-black border border-white shadow-md cursor-pointer"
                                              >
                                                &times;
                                              </button>
                                            )}
                                          </div>
                                          <div className="w-2.5 h-2.5 rounded-full bg-rose-500 border-2 border-white shadow-md -mt-0.5" />
                                        </div>
                                      );
                                    })}
                                  </RotatableImageFrame>
                                </div>
                              ) : (
                                <div className="p-4 border border-dashed border-slate-300 rounded-xl text-center text-xs text-slate-400 bg-slate-50/50">
                                  Chưa có ảnh bối cảnh (CTX) cho cấu kiện {eCode}
                                </div>
                              )}
                            </div>

                            {/* CÁC KHỐI TIẾP THEO TRONG DẢI CUỘN NGANG: Danh sách Thẻ Khuyết Tật Kết Cấu D & Ảnh Cận Cảnh CU (150% kích thước) */}
                            {defectsList.length === 0 ? (
                              <div className="text-xs text-slate-400 italic py-4 px-4 bg-slate-50 rounded-xl border border-slate-100 shrink-0 min-w-[280px]">
                                Không có khuyết tật kết cấu (D) trên cấu kiện {eCode}
                              </div>
                            ) : (
                              defectsList.map((def: DefectItem, dIdx: number) => {
                                const dCode = def.defectCode || `D-${String(dIdx + 1).padStart(2, '0')}`;
                                const defIdOrCode = def.id || dCode;
                                const elemIdOrCode = elem.id || eCode;
                                const isDefDeleted = isItemSoftDeleted(def);
                                const rawCuPhotos = Array.isArray(def.cuPhotos) ? def.cuPhotos : [];
                                const addedCuPhotos = getOptimisticAddedPhotos(stagedPhotoActions, {
                                  category: 'DEFECT_CU',
                                  targetPhotoType: 'CU',
                                  targetPhotoId: dCode,
                                  defectId: def.id,
                                  defectCode: dCode,
                                  floorCode: floorName,
                                  zoneCode: eCode,
                                });
                                const currentCategory = def.screeningCategory || 'Nứt kết cấu BTCT (Structural Cracks)';
                                const categoryTypes: string[] = STRUCT_DEFECT_TYPES;
                                const showCrackMetrics = isCrackRelated(def.screeningCategory, def.defectType);

                                return (
                                  <div
                                    key={defIdOrCode}
                                    id={`defect-card-f${flIdx}-${eCode}-${dCode}`}
                                    className={`p-3.5 rounded-xl border space-y-3 shadow-2xs shrink-0 w-fit min-w-[400px] max-w-none transition-all ${
                                      isDefDeleted
                                        ? 'border-dashed border-rose-300 bg-rose-50/30 opacity-75'
                                        : 'border-amber-200 bg-white'
                                    }`}
                                  >
                                    {/* Dòng tiêu đề & nút Xóa / Khôi phục ghim D trên cấu kiện E */}
                                    <div className="flex items-center justify-between gap-3 flex-wrap pb-2 border-b border-slate-100">
                                      <div className="flex items-center gap-2 flex-wrap">
                                        <span className="font-mono font-black text-amber-900 bg-amber-100 px-2 py-0.5 rounded text-xs">
                                          {dCode}
                                        </span>
                                        {isDefDeleted && (
                                          <span className="px-1.5 py-0.5 rounded bg-rose-100 text-rose-700 text-[10px] font-bold">
                                            Đã xóa mềm
                                          </span>
                                        )}
                                        {!isEditMode && (
                                          <>
                                            <span className="text-xs font-bold text-slate-800">
                                              {def.defectType || def.screeningCategory || 'Khuyết tật kết cấu'}
                                            </span>
                                            {showCrackMetrics && (
                                              <span className="font-mono font-bold text-rose-600 text-xs">
                                                Rộng: {def.widthMaxMm ?? def.width_max_mm ?? 0} mm &bull; Dài: {def.lengthMm ?? def.length_mm ?? 0} mm
                                              </span>
                                            )}
                                            <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200">
                                              E2={def.structuralSignificanceE2 ?? 0} &bull; E4={def.materialDegradationE4 ?? 0}
                                            </span>
                                          </>
                                        )}
                                      </div>

                                      <div className="flex items-center gap-1.5">
                                        {isEditMode && (
                                          isDefDeleted ? (
                                            <button
                                              type="button"
                                              onClick={() => handleRestoreElementDefect(flIdx, elemIdOrCode, defIdOrCode)}
                                              className="text-[11px] font-bold text-emerald-700 hover:text-emerald-800 px-2.5 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 flex items-center gap-1 cursor-pointer"
                                            >
                                              <RotateCcw className="w-3 h-3" />
                                              <span>Khôi phục {dCode}</span>
                                            </button>
                                          ) : (
                                            <button
                                              type="button"
                                              onClick={() => handleRemoveElementDefect(flIdx, elemIdOrCode, defIdOrCode)}
                                              className="text-[11px] font-bold text-rose-600 hover:text-rose-700 px-2.5 py-1 rounded-lg bg-rose-50 hover:bg-rose-100 border border-rose-200 flex items-center gap-1 cursor-pointer"
                                            >
                                              <Trash2 className="w-3 h-3" />
                                              <span>Xóa ghim {dCode}</span>
                                            </button>
                                          )
                                        )}
                                      </div>
                                    </div>

                                    {/* Bộ điều khiển Sửa đầy đủ thông tin D trên E theo chuẩn Phase 1 */}
                                    {isEditMode && !isDefDeleted && (
                                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 bg-amber-50/40 p-2.5 rounded-xl border border-amber-200/80 text-xs">
                                        <div className="space-y-1">
                                          <label className="text-[10px] font-bold text-slate-600 uppercase block">
                                            Nhóm hiện tượng kết cấu (Phase 1):
                                          </label>
                                          <select
                                            value={currentCategory}
                                            onChange={(e) => {
                                              const nextCat = e.target.value;
                                              const defaultType = STRUCT_DEFECT_TYPES[0] || nextCat;
                                              handleElementDefectChange(flIdx, elemIdOrCode, defIdOrCode, 'screeningCategory', nextCat, 'Nhóm khuyết tật E');
                                              handleElementDefectChange(flIdx, elemIdOrCode, defIdOrCode, 'defectType', defaultType, 'Loại khuyết tật E');
                                            }}
                                            className="w-full p-1.5 text-xs border border-amber-300 rounded-lg bg-white font-semibold text-slate-800"
                                          >
                                            {STRUCT_SCREENING_CATEGORIES.map((cat) => (
                                              <option key={cat} value={cat}>{cat}</option>
                                            ))}
                                          </select>
                                        </div>

                                        <div className="space-y-1">
                                          <label className="text-[10px] font-bold text-slate-600 uppercase block">
                                            Chi tiết khuyết tật kết cấu:
                                          </label>
                                          <select
                                            value={def.defectType || categoryTypes[0] || ''}
                                            onChange={(e) =>
                                              handleElementDefectChange(flIdx, elemIdOrCode, defIdOrCode, 'defectType', e.target.value, 'Loại khuyết tật E')
                                            }
                                            className="w-full p-1.5 text-xs border border-amber-300 rounded-lg bg-white font-semibold text-slate-800"
                                          >
                                            {categoryTypes.map((dt) => (
                                              <option key={dt} value={dt}>{dt}</option>
                                            ))}
                                            {def.defectType && !categoryTypes.includes(def.defectType) && (
                                              <option value={def.defectType}>{def.defectType}</option>
                                            )}
                                          </select>
                                        </div>

                                        {showCrackMetrics && (
                                          <div className="sm:col-span-2 grid grid-cols-2 sm:grid-cols-4 gap-2 pt-1 border-t border-amber-200/60">
                                            <div>
                                              <label className="text-[10px] font-bold text-slate-600 block">Bề rộng W (mm):</label>
                                              <input
                                                type="number"
                                                step="0.05"
                                                value={def.widthMaxMm ?? def.width_max_mm ?? 0}
                                                onChange={(e) =>
                                                  handleElementDefectChange(
                                                    flIdx,
                                                    elemIdOrCode,
                                                    defIdOrCode,
                                                    'widthMaxMm',
                                                    parseFloat(e.target.value) || 0,
                                                    'Bề rộng vết nứt E (mm)'
                                                  )
                                                }
                                                className="w-full p-1 text-xs border border-amber-300 rounded font-mono font-bold text-rose-700 bg-white"
                                              />
                                            </div>
                                            <div>
                                              <label className="text-[10px] font-bold text-slate-600 block">Chiều dài L (mm):</label>
                                              <input
                                                type="number"
                                                step="10"
                                                value={def.lengthMm ?? def.length_mm ?? 0}
                                                onChange={(e) =>
                                                  handleElementDefectChange(
                                                    flIdx,
                                                    elemIdOrCode,
                                                    defIdOrCode,
                                                    'lengthMm',
                                                    parseFloat(e.target.value) || 0,
                                                    'Chiều dài vết nứt E (mm)'
                                                  )
                                                }
                                                className="w-full p-1 text-xs border border-amber-300 rounded font-mono bg-white"
                                              />
                                            </div>
                                            <div>
                                              <label className="text-[10px] font-bold text-slate-600 block">Phương phát triển:</label>
                                              <select
                                                value={def.crackDirection || ''}
                                                onChange={(e) =>
                                                  handleElementDefectChange(
                                                    flIdx,
                                                    elemIdOrCode,
                                                    defIdOrCode,
                                                    'crackDirection',
                                                    e.target.value,
                                                    'Phương vết nứt E'
                                                  )
                                                }
                                                className="w-full p-1 text-xs border border-amber-300 rounded bg-white"
                                              >
                                                <option value="">-- Chọn --</option>
                                                {CRACK_DIRECTION_OPTIONS.map((opt) => (
                                                  <option key={opt} value={opt}>{opt}</option>
                                                ))}
                                              </select>
                                            </div>
                                            <div>
                                              <label className="text-[10px] font-bold text-slate-600 block">Trạng thái hoạt động:</label>
                                              <select
                                                value={def.activityState || ''}
                                                onChange={(e) =>
                                                  handleElementDefectChange(
                                                    flIdx,
                                                    elemIdOrCode,
                                                    defIdOrCode,
                                                    'activityState',
                                                    e.target.value,
                                                    'Trạng thái vết nứt E'
                                                  )
                                                }
                                                className="w-full p-1 text-xs border border-amber-300 rounded bg-white"
                                              >
                                                <option value="">-- Chọn --</option>
                                                {ACTIVITY_STATE_OPTIONS.map((opt) => (
                                                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                                                ))}
                                              </select>
                                            </div>
                                          </div>
                                        )}

                                        <div className="sm:col-span-2 grid grid-cols-1 sm:grid-cols-3 gap-2 pt-1 border-t border-amber-200/60">
                                          <div>
                                            <label className="text-[10px] font-bold text-slate-600 block">Cấp điểm E2 (0-4):</label>
                                            <select
                                              value={def.structuralSignificanceE2 ?? 0}
                                              onChange={(e) =>
                                                handleElementDefectChange(
                                                  flIdx,
                                                  elemIdOrCode,
                                                  defIdOrCode,
                                                  'structuralSignificanceE2',
                                                  parseInt(e.target.value, 10) || 0,
                                                  'Điểm E2'
                                                )
                                              }
                                              className="w-full p-1 text-xs border border-amber-300 rounded bg-white font-bold"
                                            >
                                              {[0, 1, 2, 3, 4].map((g) => (
                                                <option key={g} value={g}>Cấp {g}/4</option>
                                              ))}
                                            </select>
                                          </div>
                                          <div>
                                            <label className="text-[10px] font-bold text-slate-600 block">Cấp điểm E4 (0-4):</label>
                                            <select
                                              value={def.materialDegradationE4 ?? 0}
                                              onChange={(e) =>
                                                handleElementDefectChange(
                                                  flIdx,
                                                  elemIdOrCode,
                                                  defIdOrCode,
                                                  'materialDegradationE4',
                                                  parseInt(e.target.value, 10) || 0,
                                                  'Điểm E4'
                                                )
                                              }
                                              className="w-full p-1 text-xs border border-amber-300 rounded bg-white font-bold"
                                            >
                                              {[0, 1, 2, 3, 4].map((g) => (
                                                <option key={g} value={g}>Cấp {g}/4</option>
                                              ))}
                                            </select>
                                          </div>
                                          <div>
                                            <label className="text-[10px] font-bold text-slate-600 block">Ghi chú kỹ thuật:</label>
                                            <input
                                              type="text"
                                              value={def.notes || ''}
                                              onChange={(e) =>
                                                handleElementDefectChange(
                                                  flIdx,
                                                  elemIdOrCode,
                                                  defIdOrCode,
                                                  'notes',
                                                  e.target.value,
                                                  'Ghi chú khuyết tật E'
                                                )
                                              }
                                              placeholder="Mô tả chi tiết vị trí/biểu hiện..."
                                              className="w-full p-1 text-xs border border-amber-300 rounded bg-white"
                                            />
                                          </div>
                                        </div>
                                      </div>
                                    )}

                                    {!isEditMode && def.notes && (
                                      <div className="text-[11px] text-slate-600 italic bg-slate-50 px-2.5 py-1.5 rounded-lg">
                                        Ghi chú: {def.notes}
                                      </div>
                                    )}

                                    {/* CU Photos of Defect on Element E - Kích thước 150% (w-[345px] sm:w-[375px] h-80) */}
                                    <div className="space-y-2 pt-1.5 border-t border-slate-100">
                                      <div className="flex items-center justify-between gap-2">
                                        <span className="text-[10px] font-bold text-slate-500 uppercase">
                                          Ảnh Cận Cảnh CU ({rawCuPhotos.length + addedCuPhotos.length} ảnh &bull; Kích thước 150%):
                                        </span>
                                        {isEditMode && onOpenPhotoAction && (
                                          <button
                                            type="button"
                                            onClick={() =>
                                              onOpenPhotoAction({
                                                category: 'DEFECT_CU',
                                                initialMode: 'ADD',
                                                targetPhotoType: 'CU',
                                                targetPhotoId: dCode,
                                                defectId: def.id,
                                                defectCode: dCode,
                                                photoIndex: rawCuPhotos.length + addedCuPhotos.length,
                                                floorCode: floorName,
                                                zoneCode: eCode,
                                                photoTitle: `${dCode} - Cận Cảnh #${rawCuPhotos.length + addedCuPhotos.length + 1}`,
                                              })
                                            }
                                            className="px-2 py-0.5 rounded bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-bold cursor-pointer flex items-center gap-1"
                                          >
                                            <Plus className="w-3 h-3" />
                                            <span>+ Thêm Ảnh CU</span>
                                          </button>
                                        )}
                                      </div>

                                      {rawCuPhotos.length === 0 && addedCuPhotos.length === 0 ? (
                                        <div className="text-[11px] text-slate-400 italic py-2 px-3 bg-slate-50 rounded-lg border border-dashed border-slate-200">
                                          Chưa có ảnh cận cảnh CU cho {dCode}
                                        </div>
                                      ) : (
                                        <div className="flex flex-nowrap gap-4 overflow-x-auto pb-2 scrollbar-thin">
                                          {rawCuPhotos.map((cuItem: string | { url?: string; photoUrl?: string }, cuIdx: number) => {
                                            const rawCuUrl = typeof cuItem === 'string' ? cuItem : cuItem?.url || cuItem?.photoUrl;
                                            if (!rawCuUrl) return null;

                                            const resolvedCu = resolveOptimisticPhoto(rawCuUrl, stagedPhotoActions, {
                                              category: 'DEFECT_CU',
                                              targetPhotoType: 'CU',
                                              targetPhotoId: dCode,
                                              defectId: def.id,
                                              defectCode: dCode,
                                              photoIndex: cuIdx,
                                              floorCode: floorName,
                                              zoneCode: eCode,
                                            });
                                            const cuUrl = resolvedCu.displayUrl;

                                            const defIdStr = def.id ? String(def.id) : '';
                                            const primaryCuRotKey = `defect_f${flIdx}_e${eCode}_${dCode}_cu_${cuIdx}`;
                                            const uuidCuRotKey = defIdStr ? `defect_${defIdStr}_cu_${cuIdx}` : primaryCuRotKey;
                                            const altCuRotKey = `defect_f${flIdx}_e${eCode}_${defIdStr || dCode}_cu_${cuIdx}`;
                                            const cuRot =
                                              stagedPhotoRotations[primaryCuRotKey] ??
                                              stagedPhotoRotations[uuidCuRotKey] ??
                                              stagedPhotoRotations[altCuRotKey] ??
                                              stagedPhotoRotations[cuUrl] ??
                                              stagedPhotoRotations[rawCuUrl] ??
                                              0;
                                            const cuViolation =
                                              violationsMap?.get(primaryCuRotKey) ||
                                              violationsMap?.get(uuidCuRotKey) ||
                                              violationsMap?.get(altCuRotKey);
                                            const cuDomId = `audit-photo-card-f${flIdx}-e${eCode}-defect-${dCode}-${cuIdx}`;

                                            return (
                                              <div key={cuIdx} className="w-[345px] sm:w-[375px] shrink-0">
                                                <AuditPhotoCard
                                                  url={cuUrl}
                                                  photoCode={`CU #${cuIdx + 1}`}
                                                  photoKey={primaryCuRotKey}
                                                  title={`Cận cảnh ${dCode} (#${cuIdx + 1})`}
                                                  category="DEFECT_CU"
                                                  targetPhotoType="CU"
                                                  targetPhotoId={dCode}
                                                  defectId={def.id}
                                                  defectCode={dCode}
                                                  photoIndex={cuIdx}
                                                  floorCode={floorName}
                                                  zoneCode={eCode}
                                                  isEditMode={isEditMode}
                                                  aspectRatio="h-80"
                                                  maxHeightPx={340}
                                                  badgeColor="rose"
                                                  rotation={cuRot}
                                                  isOrientationMismatch={Boolean(cuViolation)}
                                                  isStrictOrientation={cuViolation?.isStrict ?? false}
                                                  orientationRecommendation={cuViolation?.message}
                                                  expectedOrientation={cuViolation?.expectedOrientation || 'LANDSCAPE'}
                                                  onRotate={(newRot) => onRotatePhoto?.(primaryCuRotKey, newRot, cuUrl)}
                                                  optimisticStatus={
                                                    resolvedCu.status === 'DELETED'
                                                      ? 'DELETED'
                                                      : resolvedCu.status === 'REPLACED'
                                                      ? 'REPLACED'
                                                      : undefined
                                                  }
                                                  onUndoDelete={
                                                    resolvedCu.matchedAction
                                                      ? () => onUndoPhotoAction?.(resolvedCu.matchedAction!)
                                                      : undefined
                                                  }
                                                  domId={cuDomId}
                                                  onOpenPhotoZoom={onOpenPhotoZoom}
                                                  onOpenPhotoAction={onOpenPhotoAction}
                                                  onOpenPhotoHistory={onOpenPhotoHistory}
                                                />
                                              </div>
                                            );
                                          })}

                                          {/* Optimistic newly added DEFECT_CU photos on Element E */}
                                          {addedCuPhotos.map((addedItem, addIdx) => {
                                            const cuIdx = rawCuPhotos.length + addIdx;
                                            const addRotKey = `defect_f${flIdx}_e${eCode}_${dCode}_cu_added_${addIdx}`;
                                            const addRot =
                                              stagedPhotoRotations[addRotKey] ??
                                              stagedPhotoRotations[addedItem.displayUrl] ??
                                              0;
                                            return (
                                              <div key={`added-elem-cu-${addIdx}`} className="w-[345px] sm:w-[375px] shrink-0">
                                                <AuditPhotoCard
                                                  url={addedItem.displayUrl}
                                                  photoCode={`CU #${cuIdx + 1} (Mới)`}
                                                  photoKey={addRotKey}
                                                  title={`Cận cảnh ${dCode} (#${cuIdx + 1}) (Mới thêm • Chờ lưu)`}
                                                  category="DEFECT_CU"
                                                  targetPhotoType="CU"
                                                  targetPhotoId={dCode}
                                                  defectId={def.id}
                                                  defectCode={dCode}
                                                  photoIndex={cuIdx}
                                                  floorCode={floorName}
                                                  zoneCode={eCode}
                                                  isEditMode={isEditMode}
                                                  aspectRatio="h-80"
                                                  maxHeightPx={340}
                                                  badgeColor="emerald"
                                                  rotation={addRot}
                                                  onRotate={(newRot) => onRotatePhoto?.(addRotKey, newRot, addedItem.displayUrl)}
                                                  optimisticStatus="ADDED"
                                                  onUndoDelete={() => onUndoPhotoAction?.(addedItem.action)}
                                                  onOpenPhotoZoom={onOpenPhotoZoom}
                                                  onOpenPhotoAction={onOpenPhotoAction}
                                                  onOpenPhotoHistory={onOpenPhotoHistory}
                                                />
                                              </div>
                                            );
                                          })}
                                        </div>
                                      )}
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
            </div>
          );
        })}
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
                  {zoneToDelete.zone.zoneCode || zoneToDelete.zone.zone_code || 'Z-??'} ({zoneToDelete.zone.roomName || 'Không gian'})
                </p>
              </div>
            </div>

            <div className="bg-rose-50 border border-rose-200 rounded-xl p-3 text-xs space-y-1.5 text-slate-700">
              <p className="font-semibold text-rose-900 flex items-center gap-1.5 flex-wrap">
                <AlertTriangle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                <span>
                  Vùng này đang chứa{' '}
                  <strong className="text-rose-700 font-black">
                    {(zoneToDelete.zone.defects || []).filter((d: DefectItem) => !isItemSoftDeleted(d)).length}
                  </strong>{' '}
                  khuyết tật nứt (D) đang hoạt động!
                </span>
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
                onClick={() => executeSoftDeleteZone(zoneToDelete.floorIdx, zoneToDelete.zone)}
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
