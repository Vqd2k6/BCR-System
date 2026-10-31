import React, { useRef, useState } from 'react';
import { getNextAvailablePinCode } from '../../../../../../components/canvas/FloorCadPinningCanvas';
import { Plus, Trash2, RotateCcw, CheckCircle2, MapPin, EyeOff } from 'lucide-react';
import {
  ARCH_DEFECT_TYPES,
  ARCH_SCREENING_CATEGORIES,
} from '../../stepwise/constants/defect-taxonomy';
import { rotatePinCoords } from '../../stepwise/utils/pinCoordinates';
import { AuditField, withCurrentOption } from '../../stepwise/ui/AuditField';
import type {
  CondoDamageZoneItemData,
  CondoDefectItemData,
} from '../types/condo-audit.types';
import { calcBurlandGradeFromWidthFrontend } from './condo-zone.mappers';
import { CondoCadPinSection } from './CondoCadPinSection';
import { CondoDefectStripSection } from './CondoDefectStripSection';
import type { CondoCadPinControls } from './useCondoCadPins';
import type { CondoPhotoHandlers } from './CondoPhotoCard';

const COMPONENT_TYPE_OPTIONS = [
  { value: 'Tường', label: 'Tường ngăn / Tường bao' },
  { value: 'Trần', label: 'Trần căn hộ / hành lang' },
  { value: 'Sàn', label: 'Sàn gạch / Sàn gỗ' },
  { value: 'Cột', label: 'Cột kiến trúc' },
  { value: 'Dầm', label: 'Dầm trần' },
  { value: 'Khung cửa', label: 'Khung cửa sổ / Cửa đi' },
];

const WALL_MATERIAL_OPTIONS = [
  { value: 'Vữa trát', label: 'Vữa trát sơn nước' },
  { value: 'Gạch xây', label: 'Tường gạch xây' },
  { value: 'BTCT', label: 'Bê tông cốt thép (BTCT)' },
  { value: 'Thạch cao', label: 'Trần thạch cao' },
  { value: 'Gạch ốp lát', label: 'Gạch Ceramic / Đá ốp' },
];

interface CondoZonesDefectsCrudEditorProps extends CondoPhotoHandlers {
  zones: CondoDamageZoneItemData[];
  defaultFloorName?: string;
  pinControls: CondoCadPinControls;
  onChangeZones: (nextZones: CondoDamageZoneItemData[], actionLabel: string) => void;
}

export const CondoZonesDefectsCrudEditor: React.FC<CondoZonesDefectsCrudEditorProps> = ({
  zones,
  defaultFloorName = '',
  pinControls,
  onChangeZones,
  ...photoHandlers
}) => {
  const { isEditMode, onOpenPhotoAction } = photoHandlers;
  const { zoneBoard, undoState } = pinControls;
  const [showDeleted, setShowDeleted] = useState(false);
  const [highlightedZoneCode, setHighlightedZoneCode] = useState<string | null>(null);
  const zonesRef = useRef(zones);
  zonesRef.current = zones;

  const visibleZones = zones.filter((z) => showDeleted || !z.isDeleted);
  const deletedZonesCount = zones.filter((z) => z.isDeleted).length;

  const recomputeZoneBurland = (zone: CondoDamageZoneItemData): CondoDamageZoneItemData => {
    const activeDefs = (zone.defects || []).filter((d) => !d.isDeleted);
    let maxG = 0;
    for (const d of activeDefs) {
      const g = calcBurlandGradeFromWidthFrontend(
        Number(d.widthMaxMm || 0),
        Boolean(d.isStructuralCritical)
      );
      if (g > maxG) maxG = g;
    }
    return {
      ...zone,
      burlandGrade: maxG,
      functionalImpactRepairNeeded:
        zone.functionalImpactRepairNeeded || maxG >= 3,
    };
  };

  const handleAddZone = (cadPosition?: { x: number; y: number }) => {
    const zCode = getNextAvailablePinCode(
      zoneBoard.pins,
      'Z',
      zones.map((z) => z.zoneCode)
    );
    const newZone: CondoDamageZoneItemData = {
      id: `zone_${Date.now()}_${zCode}`,
      zoneCode: zCode,
      floorName: defaultFloorName,
      roomName: '',
      componentType: '',
      wallMaterial: '',
      ctxPhotoUrl: null,
      ctxPhotoCode: `${zCode}-CTX`,
      burlandGrade: 0,
      functionalImpactRepairNeeded: false,
      overviewPhotos: [],
      notes: '',
      defects: [],
    };
    onChangeZones([...zones, newZone], `Thêm mới vùng hư hại ${zCode}`);
    if (cadPosition) zoneBoard.addCadPin(zCode, cadPosition.x, cadPosition.y);
  };

  const selectZonePin = (code: string) => {
    setHighlightedZoneCode(code);
    document.getElementById(`condo-zone-${code}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  const handleUpdateZoneField = (
    zoneId: string,
    field: keyof CondoDamageZoneItemData,
    value: unknown,
    label: string
  ) => {
    const nextZones = zones.map((z) => {
      if (z.id !== zoneId) return z;
      return recomputeZoneBurland({ ...z, [field]: value });
    });
    onChangeZones(nextZones, label);
  };

  const handleToggleDeleteZone = (zone: CondoDamageZoneItemData) => {
    const nextDeleted = !zone.isDeleted;
    const nextZones = zones.map((z) =>
      z.id === zone.id ? { ...z, isDeleted: nextDeleted } : z
    );
    onChangeZones(
      nextZones,
      nextDeleted
        ? `Xóa mềm vùng hư hại ${zone.zoneCode}`
        : `Khôi phục vùng hư hại ${zone.zoneCode}`
    );
  };

  const handleAddDefect = (zone: CondoDamageZoneItemData, ctxPosition?: { x: number; y: number }) => {
    const defectCodes = (zone.defects || []).map((d) => d.defectCode);
    const dCode = getNextAvailablePinCode(
      defectCodes.map((code) => ({ defectCode: code })),
      'D',
      defectCodes
    );
    const defectId = `def_${Date.now()}_${dCode}`;
    const newDefect: CondoDefectItemData = {
      id: defectId,
      defectCode: dCode,
      defectType: ARCH_DEFECT_TYPES[0],
      screeningCategory: ARCH_SCREENING_CATEGORIES[0],
      widthMaxMm: null,
      lengthMm: null,
      crackDirection: 'Ngang',
      activityState: 'U',
      functionalImpactE6: null,
      notes: '',
      hasScaleCard: false,
      isStructuralCritical: false,
      cuPhotoUrl: null,
      cuPhotos: [],
      cuPhotoCode: `${zone.zoneCode}-${dCode}-CU`,
      pinX: ctxPosition?.x ?? null,
      pinY: ctxPosition?.y ?? null,
    };
    const nextZones = zones.map((z) => {
      if (z.id !== zone.id) return z;
      return recomputeZoneBurland({
        ...z,
        defects: [...(z.defects || []), newDefect],
      });
    });
    onChangeZones(nextZones, `Thêm vết nứt ${dCode} vào vùng ${zone.zoneCode}`);
    if (ctxPosition) {
      onOpenPhotoAction?.({
        initialMode: 'ADD',
        category: 'DEFECT_CU',
        targetPhotoType: 'DEFECT_CU_PHOTO',
        targetPhotoId: defectId,
        defectId,
        defectCode: dCode,
        zoneCode: zone.zoneCode,
        initialPinX: ctxPosition.x,
        initialPinY: ctxPosition.y,
        photoTitle: `Khuyết tật ${dCode} (${zone.zoneCode})`,
      });
    }
  };

  const applyDefectPin = (zoneId: string, defectId: string, x: number, y: number, label: string) =>
    onChangeZones(
      zonesRef.current.map((z) =>
        z.id !== zoneId
          ? z
          : { ...z, defects: (z.defects || []).map((d) => (d.id === defectId ? { ...d, pinX: x, pinY: y } : d)) }
      ),
      label
    );

  const handleMoveDefectPin = (zone: CondoDamageZoneItemData, defectId: string, x: number, y: number) => {
    const defect = (zone.defects || []).find((d) => d.id === defectId);
    if (!defect) return;
    const { pinX, pinY, defectCode } = defect;
    undoState.pushUndo(() =>
      applyDefectPin(zone.id, defectId, Number(pinX), Number(pinY), `Hoàn tác ghim ${defectCode} (${zone.zoneCode})`)
    );
    applyDefectPin(zone.id, defectId, x, y, `Điều chỉnh ghim ${defectCode} (${zone.zoneCode})`);
  };

  const handleRotateZoneCtx = (zone: CondoDamageZoneItemData, rotationKey: string, currentRotation: number) => {
    const previousDefects = zone.defects || [];
    const restore = (defects: CondoDefectItemData[], rotation: number, label: string) => {
      pinControls.setRotation(rotationKey, rotation);
      onChangeZones(
        zonesRef.current.map((z) => (z.id === zone.id ? { ...z, defects } : z)),
        label
      );
    };
    undoState.pushUndo(() => restore(previousDefects, currentRotation, `Hoàn tác xoay CTX ${zone.zoneCode}`));
    restore(
      previousDefects.map((d) => {
        if (!d.pinX && !d.pinY) return d;
        const next = rotatePinCoords(Number(d.pinX), Number(d.pinY));
        return { ...d, pinX: next.x, pinY: next.y };
      }),
      (currentRotation + 90) % 360,
      `Xoay CTX ${zone.zoneCode} 90° và đổi tọa độ ghim D`
    );
  };

  const handleUpdateDefectField = (
    zoneId: string,
    defectId: string,
    field: keyof CondoDefectItemData,
    value: unknown,
    label: string
  ) => {
    const nextZones = zones.map((z) => {
      if (z.id !== zoneId) return z;
      const nextDefs = (z.defects || []).map((d) =>
        d.id === defectId ? { ...d, [field]: value } : d
      );
      return recomputeZoneBurland({ ...z, defects: nextDefs });
    });
    onChangeZones(nextZones, label);
  };

  const handleToggleDeleteDefect = (
    zone: CondoDamageZoneItemData,
    defect: CondoDefectItemData
  ) => {
    const nextDeleted = !defect.isDeleted;
    const nextZones = zones.map((z) => {
      if (z.id !== zone.id) return z;
      const nextDefs = (z.defects || []).map((d) =>
        d.id === defect.id ? { ...d, isDeleted: nextDeleted } : d
      );
      return recomputeZoneBurland({ ...z, defects: nextDefs });
    });
    onChangeZones(
      nextZones,
      nextDeleted
        ? `Xóa mềm khuyết tật ${defect.defectCode} (${zone.zoneCode})`
        : `Khôi phục khuyết tật ${defect.defectCode} (${zone.zoneCode})`
    );
  };

  return (
    <div className="space-y-4">
      {/* Top Toolbar */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <span className="text-xs font-black text-slate-800">
            Vùng hư hại kiến trúc (Z):{' '}
            <span className="font-mono text-sky-700">{zones.filter((z) => !z.isDeleted).length} vùng</span>
          </span>
          {deletedZonesCount > 0 && (
            <button
              type="button"
              onClick={() => setShowDeleted(!showDeleted)}
              className="px-2 py-0.5 rounded-lg text-[11px] font-bold bg-slate-100 text-slate-600 border border-slate-200 flex items-center gap-1 cursor-pointer"
            >
              <EyeOff className="w-3 h-3" />
              <span>{showDeleted ? 'Ẩn vùng đã xóa' : `Hiện vùng đã xóa (${deletedZonesCount})`}</span>
            </button>
          )}
        </div>

        {isEditMode && (
          <button
            type="button"
            onClick={() => handleAddZone()}
            className="px-3 py-1.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-2xs transition-all cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Thêm Vùng Hư Hại (Z)</span>
          </button>
        )}
      </div>

      <CondoCadPinSection
        board={zoneBoard}
        tone="zone"
        title="CAD Kiến trúc (Z)"
        activeCodes={zones.filter((z) => !z.isDeleted).map((z) => z.zoneCode)}
        isEditMode={isEditMode}
        canUndo={undoState.canUndo}
        onUndo={undoState.undo}
        onAddAt={(x, y) => handleAddZone({ x, y })}
        onSelectPin={selectZonePin}
        onOpenPhotoZoom={photoHandlers.onOpenPhotoZoom}
      />

      {visibleZones.length === 0 ? (
        <div className="p-6 rounded-2xl border border-dashed border-slate-300 bg-slate-50/70 text-center space-y-1.5">
          <CheckCircle2 className="w-7 h-7 text-emerald-500 mx-auto" />
          <div className="text-xs font-bold text-slate-700">Khảo sát không ghi nhận vùng hư hại kiến trúc (Z)</div>
        </div>
      ) : (
        <div className="space-y-4">
          {visibleZones.map((zone) => {
            const isZoneDeleted = Boolean(zone.isDeleted);
            const canEditZone = isEditMode && !isZoneDeleted;
            // Khóa theo mã vùng: ID tạm đổi thành UUID sau khi lưu nên không dùng làm khóa góc xoay
            const ctxRotationKey = `zone_f0_z${zone.zoneCode}_ctx`;
            const ctxRotation = pinControls.getRotation(ctxRotationKey, `zone_${zone.id}_ctx`);
            const hasCadPin = zoneBoard.pins.some((pin) => (pin.zoneCode || pin.zone_code) === zone.zoneCode);

            return (
              <div
                key={zone.id}
                id={`condo-zone-${zone.zoneCode}`}
                className={`scroll-mt-6 rounded-2xl p-4 sm:p-5 space-y-4 transition-all ${
                  isZoneDeleted
                    ? 'opacity-70 border border-dashed border-rose-300 bg-rose-50/20'
                    : 'bg-white border border-slate-200 shadow-2xs'
                } ${highlightedZoneCode === zone.zoneCode ? 'ring-4 ring-emerald-400' : ''}`}
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="px-2.5 py-1 rounded-lg text-xs font-mono font-black bg-sky-600 text-white">
                      {zone.zoneCode}
                    </span>
                    {hasCadPin && (
                      <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-sky-50 text-sky-700 border border-sky-200 flex items-center gap-1">
                        <MapPin className="w-3 h-3" /> Đã ghim CAD
                      </span>
                    )}
                    {isZoneDeleted && (
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-600 text-white">ĐÃ XÓA MỀM</span>
                    )}
                  </div>
                  {isEditMode && (
                    <button
                      type="button"
                      onClick={() => handleToggleDeleteZone(zone)}
                      className={`px-2 py-1 rounded-lg text-xs font-bold flex items-center gap-1 border cursor-pointer transition-colors ${
                        isZoneDeleted
                          ? 'bg-emerald-600 hover:bg-emerald-700 text-white border-emerald-600'
                          : 'bg-rose-50 hover:bg-rose-100 text-rose-700 border-rose-300'
                      }`}
                    >
                      {isZoneDeleted ? <RotateCcw className="w-3.5 h-3.5" /> : <Trash2 className="w-3.5 h-3.5" />}
                      <span>{isZoneDeleted ? 'Khôi phục Vùng' : 'Xóa Vùng'}</span>
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <AuditField
                    label="Không gian / Phòng"
                    value={zone.roomName}
                    isEditMode={canEditZone}
                    onChange={(val) =>
                      handleUpdateZoneField(zone.id, 'roomName', val, `Phòng/Vị trí vùng ${zone.zoneCode}`)
                    }
                  />
                  <AuditField
                    label="Bộ phận công trình"
                    type="select"
                    value={zone.componentType}
                    options={withCurrentOption(COMPONENT_TYPE_OPTIONS, zone.componentType)}
                    isEditMode={canEditZone}
                    onChange={(val) =>
                      handleUpdateZoneField(zone.id, 'componentType', val, `Bộ phận vùng ${zone.zoneCode}`)
                    }
                  />
                  <AuditField
                    label="Vật liệu bề mặt"
                    type="select"
                    value={zone.wallMaterial}
                    options={withCurrentOption(WALL_MATERIAL_OPTIONS, zone.wallMaterial)}
                    isEditMode={canEditZone}
                    onChange={(val) =>
                      handleUpdateZoneField(zone.id, 'wallMaterial', val, `Vật liệu vùng ${zone.zoneCode}`)
                    }
                  />
                  <AuditField
                    label="Ghi chú vùng"
                    className="md:col-span-3"
                    value={zone.notes}
                    isEditMode={canEditZone}
                    onChange={(val) => handleUpdateZoneField(zone.id, 'notes', val, `Ghi chú vùng ${zone.zoneCode}`)}
                  />
                </div>

                <CondoDefectStripSection
                  {...photoHandlers}
                  kind="zone"
                  parentId={zone.id}
                  parentCode={zone.zoneCode}
                  ctxPhotoUrl={zone.ctxPhotoUrl}
                  ctxPhotoCode={zone.ctxPhotoCode}
                  overviewPhotos={zone.overviewPhotos || []}
                  hasHistory={zone.hasHistory}
                  historyCount={zone.historyCount}
                  defects={(zone.defects || []).filter((d) => showDeleted || !d.isDeleted)}
                  canEdit={canEditZone}
                  ctxRotation={ctxRotation}
                  onRotateCtx={() => handleRotateZoneCtx(zone, ctxRotationKey, ctxRotation)}
                  onAddDefectAt={(x, y) => handleAddDefect(zone, { x, y })}
                  onMoveDefectPin={(defectId, x, y) => handleMoveDefectPin(zone, defectId, x, y)}
                  onAddDefect={() => handleAddDefect(zone)}
                  onDefectFieldChange={(defectId, field, value, label) =>
                    handleUpdateDefectField(zone.id, defectId, field, value, label)
                  }
                  onToggleDeleteDefect={(defect) => handleToggleDeleteDefect(zone, defect)}
                />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
