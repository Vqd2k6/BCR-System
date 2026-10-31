import React, { useRef, useState } from 'react';
import { getNextAvailablePinCode } from '../../../../../../components/canvas/FloorCadPinningCanvas';
import { Plus, Trash2, RotateCcw, ShieldAlert, CheckCircle2, EyeOff } from 'lucide-react';
import {
  STRUCT_DEFECT_TYPES,
  STRUCT_SCREENING_CATEGORIES,
} from '../../stepwise/constants/defect-taxonomy';
import { rotatePinCoords } from '../../stepwise/utils/pinCoordinates';
import { AuditField, withCurrentOption } from '../../stepwise/ui/AuditField';
import type {
  CondoDefectItemData,
  CondoStructuralElementItemData,
} from '../types/condo-audit.types';
import { CondoCadPinSection } from './CondoCadPinSection';
import { CondoDefectStripSection } from './CondoDefectStripSection';
import type { CondoCadPinControls } from './useCondoCadPins';
import type { CondoPhotoHandlers } from './CondoPhotoCard';

const ELEMENT_TYPE_OPTIONS = [
  { value: 'Cột BTCT', label: 'Cột chịu lực BTCT' },
  { value: 'Dầm BTCT', label: 'Dầm chính / Dầm phụ BTCT' },
  { value: 'Vách cứng / Lõi thang', label: 'Vách cứng / Lõi thang máy' },
  { value: 'Sàn BTCT', label: 'Bản sàn BTCT / Sàn tầng hầm' },
  { value: 'Tường chắn hầm', label: 'Tường vây / Tường chắn tầng hầm' },
];

interface CondoStructuralElementsCrudEditorProps extends CondoPhotoHandlers {
  elements: CondoStructuralElementItemData[];
  defaultFloorName?: string;
  pinControls: CondoCadPinControls;
  onChangeElements: (
    nextElements: CondoStructuralElementItemData[],
    actionLabel: string
  ) => void;
}

export const CondoStructuralElementsCrudEditor: React.FC<
  CondoStructuralElementsCrudEditorProps
> = ({
  elements,
  defaultFloorName = '',
  pinControls,
  onChangeElements,
  ...photoHandlers
}) => {
  const { isEditMode, onOpenPhotoAction } = photoHandlers;
  const { elementBoard, undoState } = pinControls;
  const [showDeleted, setShowDeleted] = useState(false);
  const [highlightedElementCode, setHighlightedElementCode] = useState<string | null>(null);
  const elementsRef = useRef(elements);
  elementsRef.current = elements;

  const visibleElements = elements.filter((el) => showDeleted || !el.isDeleted);
  const deletedElementsCount = elements.filter((el) => el.isDeleted).length;

  const handleAddElement = (cadPosition?: { x: number; y: number }) => {
    const eCode = getNextAvailablePinCode(
      elementBoard.pins,
      'E',
      elements.map((el) => el.elementCode)
    );
    const newEl: CondoStructuralElementItemData = {
      id: `elem_${Date.now()}_${eCode}`,
      elementCode: eCode,
      floorName: defaultFloorName,
      roomName: '',
      elementType: '',
      materialType: '',
      dimensionsText: '',
      ctxPhotoUrl: null,
      ctxPhotoCode: `${eCode}-CTX`,
      hasDamage: false,
      overviewPhotos: [],
      notes: '',
      defects: [],
    };
    onChangeElements([...elements, newEl], `Thêm mới cấu kiện chịu lực ${eCode}`);
    if (cadPosition) elementBoard.addCadPin(eCode, cadPosition.x, cadPosition.y);
  };

  const selectElementPin = (code: string) => {
    setHighlightedElementCode(code);
    document.getElementById(`condo-element-${code}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  const handleUpdateElementField = (
    elementId: string,
    field: keyof CondoStructuralElementItemData,
    value: unknown,
    label: string
  ) => {
    const next = elements.map((el) =>
      el.id === elementId ? { ...el, [field]: value } : el
    );
    onChangeElements(next, label);
  };

  const handleToggleDeleteElement = (el: CondoStructuralElementItemData) => {
    const nextDeleted = !el.isDeleted;
    const next = elements.map((item) =>
      item.id === el.id ? { ...item, isDeleted: nextDeleted } : item
    );
    onChangeElements(
      next,
      nextDeleted
        ? `Xóa mềm cấu kiện chịu lực ${el.elementCode}`
        : `Khôi phục cấu kiện chịu lực ${el.elementCode}`
    );
  };

  const handleAddElementDefect = (el: CondoStructuralElementItemData, ctxPosition?: { x: number; y: number }) => {
    const defectCodes = (el.defects || []).map((d) => d.defectCode);
    const dCode = getNextAvailablePinCode(
      defectCodes.map((code) => ({ defectCode: code })),
      'D',
      defectCodes
    );
    const defectId = `eldef_${Date.now()}_${dCode}`;
    const newDef: CondoDefectItemData = {
      id: defectId,
      defectCode: dCode,
      defectType: STRUCT_DEFECT_TYPES[0],
      screeningCategory: STRUCT_SCREENING_CATEGORIES[0],
      widthMaxMm: null,
      lengthMm: null,
      crackDirection: 'Ngang',
      activityState: 'U',
      structuralSignificanceE2: null,
      materialDegradationE4: null,
      notes: '',
      hasScaleCard: false,
      isStructuralCritical: true,
      cuPhotoUrl: null,
      cuPhotos: [],
      cuPhotoCode: `${el.elementCode}-${dCode}-CU`,
      pinX: ctxPosition?.x ?? null,
      pinY: ctxPosition?.y ?? null,
    };
    const next = elements.map((item) =>
      item.id === el.id
        ? {
            ...item,
            hasDamage: true,
            defects: [...(item.defects || []), newDef],
          }
        : item
    );
    onChangeElements(
      next,
      `Thêm khuyết tật ${dCode} trên cấu kiện ${el.elementCode}`
    );
    if (ctxPosition) {
      onOpenPhotoAction?.({
        initialMode: 'ADD',
        category: 'DEFECT_CU',
        targetPhotoType: 'DEFECT_CU_PHOTO',
        targetPhotoId: defectId,
        defectId,
        defectCode: dCode,
        zoneCode: el.elementCode,
        initialPinX: ctxPosition.x,
        initialPinY: ctxPosition.y,
        photoTitle: `Khuyết tật ${dCode} (${el.elementCode})`,
      });
    }
  };

  const applyDefectPin = (elementId: string, defectId: string, x: number, y: number, label: string) =>
    onChangeElements(
      elementsRef.current.map((el) =>
        el.id !== elementId
          ? el
          : { ...el, defects: (el.defects || []).map((d) => (d.id === defectId ? { ...d, pinX: x, pinY: y } : d)) }
      ),
      label
    );

  const handleMoveDefectPin = (el: CondoStructuralElementItemData, defectId: string, x: number, y: number) => {
    const defect = (el.defects || []).find((d) => d.id === defectId);
    if (!defect) return;
    const { pinX, pinY, defectCode } = defect;
    undoState.pushUndo(() =>
      applyDefectPin(el.id, defectId, Number(pinX), Number(pinY), `Hoàn tác ghim ${defectCode} (${el.elementCode})`)
    );
    applyDefectPin(el.id, defectId, x, y, `Điều chỉnh ghim ${defectCode} (${el.elementCode})`);
  };

  const handleRotateElementCtx = (
    el: CondoStructuralElementItemData,
    rotationKey: string,
    currentRotation: number
  ) => {
    const previousDefects = el.defects || [];
    const restore = (defects: CondoDefectItemData[], rotation: number, label: string) => {
      pinControls.setRotation(rotationKey, rotation);
      onChangeElements(
        elementsRef.current.map((item) => (item.id === el.id ? { ...item, defects } : item)),
        label
      );
    };
    undoState.pushUndo(() => restore(previousDefects, currentRotation, `Hoàn tác xoay CTX ${el.elementCode}`));
    restore(
      previousDefects.map((d) => {
        if (!d.pinX && !d.pinY) return d;
        const next = rotatePinCoords(Number(d.pinX), Number(d.pinY));
        return { ...d, pinX: next.x, pinY: next.y };
      }),
      (currentRotation + 90) % 360,
      `Xoay CTX ${el.elementCode} 90° và đổi tọa độ ghim D`
    );
  };

  const handleUpdateElementDefectField = (
    elementId: string,
    defectId: string,
    field: keyof CondoDefectItemData,
    value: unknown,
    label: string
  ) => {
    const next = elements.map((el) => {
      if (el.id !== elementId) return el;
      const nextDefs = (el.defects || []).map((d) =>
        d.id === defectId ? { ...d, [field]: value } : d
      );
      return {
        ...el,
        hasDamage: nextDefs.some((d) => !d.isDeleted),
        defects: nextDefs,
      };
    });
    onChangeElements(next, label);
  };

  const handleToggleDeleteElementDefect = (
    el: CondoStructuralElementItemData,
    defect: CondoDefectItemData
  ) => {
    const nextDeleted = !defect.isDeleted;
    const next = elements.map((item) => {
      if (item.id !== el.id) return item;
      const nextDefs = (item.defects || []).map((d) =>
        d.id === defect.id ? { ...d, isDeleted: nextDeleted } : d
      );
      return {
        ...item,
        hasDamage: nextDefs.some((d) => !d.isDeleted),
        defects: nextDefs,
      };
    });
    onChangeElements(
      next,
      nextDeleted
        ? `Xóa mềm vết nứt ${defect.defectCode} trên cấu kiện ${el.elementCode}`
        : `Khôi phục vết nứt ${defect.defectCode} trên cấu kiện ${el.elementCode}`
    );
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <span className="text-xs font-black text-slate-800">
            Cấu kiện chịu lực (E):{' '}
            <span className="font-mono text-amber-700">{elements.filter((e) => !e.isDeleted).length} cấu kiện</span>
          </span>
          {deletedElementsCount > 0 && (
            <button
              type="button"
              onClick={() => setShowDeleted(!showDeleted)}
              className="px-2 py-0.5 rounded-lg text-[11px] font-bold bg-slate-100 text-slate-600 border border-slate-200 flex items-center gap-1 cursor-pointer"
            >
              <EyeOff className="w-3 h-3" />
              <span>{showDeleted ? 'Ẩn cấu kiện đã xóa' : `Hiện cấu kiện đã xóa (${deletedElementsCount})`}</span>
            </button>
          )}
        </div>

        {isEditMode && (
          <button
            type="button"
            onClick={() => handleAddElement()}
            className="px-3 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-2xs transition-all cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Thêm Cấu Kiện (E)</span>
          </button>
        )}
      </div>

      <CondoCadPinSection
        board={elementBoard}
        tone="element"
        title="CAD Kết cấu (E)"
        activeCodes={elements.filter((el) => !el.isDeleted).map((el) => el.elementCode)}
        isEditMode={isEditMode}
        canUndo={undoState.canUndo}
        onUndo={undoState.undo}
        onAddAt={(x, y) => handleAddElement({ x, y })}
        onSelectPin={selectElementPin}
        onOpenPhotoZoom={photoHandlers.onOpenPhotoZoom}
      />

      {visibleElements.length === 0 ? (
        <div className="p-6 rounded-2xl border border-dashed border-slate-300 bg-slate-50/70 text-center space-y-1.5">
          <CheckCircle2 className="w-7 h-7 text-emerald-500 mx-auto" />
          <div className="text-xs font-bold text-slate-700">Khảo sát không ghi nhận cấu kiện chịu lực (E)</div>
        </div>
      ) : (
        <div className="space-y-4">
          {visibleElements.map((el) => {
            const isElDeleted = Boolean(el.isDeleted);
            const canEditElement = isEditMode && !isElDeleted;
            const ctxRotationKey = `element_f0_e${el.elementCode}_ctx`;
            const ctxRotation = pinControls.getRotation(ctxRotationKey);

            return (
              <div
                key={el.id}
                id={`condo-element-${el.elementCode}`}
                className={`scroll-mt-6 rounded-2xl p-4 sm:p-5 space-y-4 transition-all ${
                  isElDeleted
                    ? 'opacity-70 border border-dashed border-rose-300 bg-rose-50/20'
                    : 'bg-white border border-slate-200 shadow-2xs'
                } ${highlightedElementCode === el.elementCode ? 'ring-4 ring-amber-400' : ''}`}
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="px-2.5 py-1 rounded-lg text-xs font-mono font-black bg-amber-600 text-white">
                      {el.elementCode}
                    </span>
                    {el.hasDamage && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-300 flex items-center gap-1">
                        <ShieldAlert className="w-3 h-3" /> Có hư hại kết cấu
                      </span>
                    )}
                    {isElDeleted && (
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-600 text-white">ĐÃ XÓA MỀM</span>
                    )}
                  </div>
                  {isEditMode && (
                    <button
                      type="button"
                      onClick={() => handleToggleDeleteElement(el)}
                      className={`px-2 py-1 rounded-lg text-xs font-bold flex items-center gap-1 border cursor-pointer transition-colors ${
                        isElDeleted
                          ? 'bg-emerald-600 hover:bg-emerald-700 text-white border-emerald-600'
                          : 'bg-rose-50 hover:bg-rose-100 text-rose-700 border-rose-300'
                      }`}
                    >
                      {isElDeleted ? <RotateCcw className="w-3.5 h-3.5" /> : <Trash2 className="w-3.5 h-3.5" />}
                      <span>{isElDeleted ? 'Khôi phục Cấu Kiện' : 'Xóa Cấu Kiện'}</span>
                    </button>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                  <AuditField
                    label="Loại cấu kiện"
                    type="select"
                    value={el.elementType}
                    options={withCurrentOption(ELEMENT_TYPE_OPTIONS, el.elementType)}
                    isEditMode={canEditElement}
                    onChange={(val) =>
                      handleUpdateElementField(el.id, 'elementType', val, `Loại cấu kiện ${el.elementCode}`)
                    }
                  />
                  <AuditField
                    label="Vị trí / Trục"
                    value={el.roomName}
                    isEditMode={canEditElement}
                    onChange={(val) =>
                      handleUpdateElementField(el.id, 'roomName', val, `Vị trí cấu kiện ${el.elementCode}`)
                    }
                  />
                  <AuditField
                    label="Vật liệu"
                    value={el.materialType}
                    isEditMode={canEditElement}
                    onChange={(val) =>
                      handleUpdateElementField(el.id, 'materialType', val, `Vật liệu cấu kiện ${el.elementCode}`)
                    }
                  />
                  <AuditField
                    label="Tiết diện / Kích thước"
                    value={el.dimensionsText}
                    mono
                    isEditMode={canEditElement}
                    onChange={(val) =>
                      handleUpdateElementField(el.id, 'dimensionsText', val, `Kích thước cấu kiện ${el.elementCode}`)
                    }
                  />
                  <AuditField
                    label="Ghi chú cấu kiện"
                    className="md:col-span-4"
                    value={el.notes}
                    isEditMode={canEditElement}
                    onChange={(val) => handleUpdateElementField(el.id, 'notes', val, `Ghi chú cấu kiện ${el.elementCode}`)}
                  />
                </div>

                <CondoDefectStripSection
                  {...photoHandlers}
                  kind="element"
                  parentId={el.id}
                  parentCode={el.elementCode}
                  ctxPhotoUrl={el.ctxPhotoUrl}
                  ctxPhotoCode={el.ctxPhotoCode}
                  overviewPhotos={el.overviewPhotos || []}
                  hasHistory={el.hasHistory}
                  historyCount={el.historyCount}
                  defects={(el.defects || []).filter((d) => showDeleted || !d.isDeleted)}
                  canEdit={canEditElement}
                  ctxRotation={ctxRotation}
                  onRotateCtx={() => handleRotateElementCtx(el, ctxRotationKey, ctxRotation)}
                  onAddDefectAt={(x, y) => handleAddElementDefect(el, { x, y })}
                  onMoveDefectPin={(defectId, x, y) => handleMoveDefectPin(el, defectId, x, y)}
                  onAddDefect={() => handleAddElementDefect(el)}
                  onDefectFieldChange={(defectId, field, value, label) =>
                    handleUpdateElementDefectField(el.id, defectId, field, value, label)
                  }
                  onToggleDeleteDefect={(defect) => handleToggleDeleteElementDefect(el, defect)}
                />
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
