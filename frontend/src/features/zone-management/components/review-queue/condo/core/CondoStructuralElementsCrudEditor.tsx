import React, { useState } from 'react';
import {
  Plus,
  Trash2,
  RotateCcw,
  Camera,
  History,
  Maximize2,
  ShieldAlert,
  CheckCircle2,
  EyeOff,
} from 'lucide-react';
import type {
  AuditPhotoActionParams,
  AuditPhotoHistoryParams,
} from '../../stepwise/types';
import type {
  CondoDefectItemData,
  CondoStructuralElementItemData,
} from '../types/condo-audit.types';

interface CondoStructuralElementsCrudEditorProps {
  isEditMode: boolean;
  elements: CondoStructuralElementItemData[];
  defaultFloorName?: string;
  onChangeElements: (
    nextElements: CondoStructuralElementItemData[],
    actionLabel: string
  ) => void;
  onOpenPhotoZoom: (url: string, title?: string, photoCode?: string) => void;
  onOpenPhotoAction?: (params: AuditPhotoActionParams) => void;
  onOpenPhotoHistory?: (params: AuditPhotoHistoryParams) => void;
}

export const CondoStructuralElementsCrudEditor: React.FC<
  CondoStructuralElementsCrudEditorProps
> = ({
  isEditMode,
  elements,
  defaultFloorName = 'Tầng 1',
  onChangeElements,
  onOpenPhotoZoom,
  onOpenPhotoAction,
  onOpenPhotoHistory,
}) => {
  const [showDeleted, setShowDeleted] = useState(false);

  const visibleElements = elements.filter((el) => showDeleted || !el.isDeleted);
  const deletedElementsCount = elements.filter((el) => el.isDeleted).length;

  const handleAddElement = () => {
    const nextIdx = elements.length + 1;
    const eCode = `E-${String(nextIdx).padStart(2, '0')}`;
    const newEl: CondoStructuralElementItemData = {
      id: `elem_${Date.now()}_${nextIdx}`,
      elementCode: eCode,
      floorName: defaultFloorName,
      roomName: 'Trục kết cấu chính',
      elementType: 'Cột BTCT',
      materialType: 'BTCT',
      dimensionsText: '600x600mm',
      ctxPhotoUrl: null,
      ctxPhotoCode: `${eCode}-CTX`,
      pinX: null,
      pinY: null,
      hasDamage: false,
      defects: [],
    };
    onChangeElements([...elements, newEl], `Thêm mới cấu kiện chịu lực ${eCode}`);
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

  const handleAddElementDefect = (el: CondoStructuralElementItemData) => {
    const dIdx = (el.defects?.length || 0) + 1;
    const dCode = `D-${String(dIdx).padStart(2, '0')}`;
    const newDef: CondoDefectItemData = {
      id: `eldef_${Date.now()}_${dIdx}`,
      defectCode: dCode,
      defectType: 'CRACK_STRUCTURAL_BEAM_COLUMN',
      screeningCategory: 'CRACK_STRUCTURAL_BEAM_COLUMN',
      widthMaxMm: 0.8,
      lengthMm: 400,
      crackDirection: 'DIAGONAL',
      activityState: 'ACTIVE',
      hasScaleCard: true,
      isStructuralCritical: true,
      cuPhotoUrl: null,
      cuPhotos: [],
      cuPhotoCode: `${el.elementCode}-${dCode}-CU`,
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
          <span className="text-xs font-black text-slate-800 dark:text-slate-100">
            Cấu kiện chịu lực được kiểm tra (E):{' '}
            <span className="font-mono text-amber-600 dark:text-amber-400">
              {elements.filter((e) => !e.isDeleted).length} cấu kiện
            </span>
          </span>
          {deletedElementsCount > 0 && (
            <button
              type="button"
              onClick={() => setShowDeleted(!showDeleted)}
              className="px-2 py-0.5 rounded-lg text-[11px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 border border-slate-200 flex items-center gap-1 cursor-pointer"
            >
              <EyeOff className="w-3 h-3" />
              <span>
                {showDeleted
                  ? 'Ẩn cấu kiện đã xóa'
                  : `Hiện cấu kiện đã xóa (${deletedElementsCount})`}
              </span>
            </button>
          )}
        </div>

        {isEditMode && (
          <button
            type="button"
            onClick={handleAddElement}
            className="px-3 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-2xs transition-all cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Thêm Cấu Kiện Chịu Lực (E)</span>
          </button>
        )}
      </div>

      {visibleElements.length === 0 ? (
        <div className="p-6 rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-800/40 text-center space-y-1.5">
          <CheckCircle2 className="w-7 h-7 text-emerald-500 mx-auto" />
          <div className="text-xs font-bold text-slate-700 dark:text-slate-200">
            Chưa ghi nhận cấu kiện chịu lực (E) có bất thường trong khu vực này
          </div>
          <p className="text-[11px] text-slate-500">
            {isEditMode
              ? 'Nhấn "Thêm Cấu Kiện Chịu Lực (E)" để bổ sung Cột, Dầm, Vách cứng hoặc Lõi thang máy.'
              : 'Các cấu kiện cột, dầm, vách cứng trong phân vùng đang ở trạng thái ổn định.'}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {visibleElements.map((el) => {
            const isElDeleted = Boolean(el.isDeleted);
            const activeDefs = (el.defects || []).filter(
              (d) => showDeleted || !d.isDeleted
            );

            return (
              <div
                key={el.id}
                className={`rounded-2xl border p-4 space-y-3 ${
                  isElDeleted
                    ? 'bg-rose-50/40 border-rose-300 opacity-75'
                    : 'bg-amber-50/30 dark:bg-slate-800/40 border-amber-200/80 dark:border-slate-750'
                }`}
              >
                {/* Header */}
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2">
                    <span className="px-2.5 py-1 rounded-lg text-xs font-mono font-black bg-amber-600 text-white">
                      {el.elementCode}
                    </span>
                    <span className="text-xs font-black text-slate-800 dark:text-slate-100">
                      {el.elementType} — {el.roomName}
                    </span>
                    {el.hasDamage && (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-800 border border-rose-300 flex items-center gap-1">
                        <ShieldAlert className="w-3 h-3" /> Có hư hại kết cấu
                      </span>
                    )}
                  </div>

                  {isEditMode && (
                    <div className="flex items-center gap-2">
                      {!isElDeleted && (
                        <button
                          type="button"
                          onClick={() => handleAddElementDefect(el)}
                          className="px-2.5 py-1 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-[11px] font-bold flex items-center gap-1 cursor-pointer"
                        >
                          <Plus className="w-3 h-3" />
                          <span>Thêm Vết Nứt Kết Cấu (D)</span>
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => handleToggleDeleteElement(el)}
                        className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 flex items-center gap-1 cursor-pointer"
                      >
                        {isElDeleted ? (
                          <>
                            <RotateCcw className="w-3 h-3" />
                            <span>Khôi phục</span>
                          </>
                        ) : (
                          <>
                            <Trash2 className="w-3 h-3" />
                            <span>Xóa cấu kiện</span>
                          </>
                        )}
                      </button>
                    </div>
                  )}
                </div>

                {/* Metadata Grid */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 mb-1">
                      Loại cấu kiện chịu lực
                    </label>
                    {isEditMode && !isElDeleted ? (
                      <select
                        value={el.elementType}
                        onChange={(e) =>
                          handleUpdateElementField(
                            el.id,
                            'elementType',
                            e.target.value,
                            `Loại cấu kiện ${el.elementCode}`
                          )
                        }
                        className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs"
                      >
                        <option value="Cột BTCT">Cột chịu lực BTCT</option>
                        <option value="Dầm BTCT">Dầm chính / Dầm phụ BTCT</option>
                        <option value="Vách cứng / Lõi thang">Vách cứng / Lõi thang máy</option>
                        <option value="Sàn BTCT">Bản sàn BTCT / Sàn tầng hầm</option>
                        <option value="Tường chắn hầm">Tường vây / Tường chắn tầng hầm</option>
                      </select>
                    ) : (
                      <div className="text-xs font-bold text-slate-800 dark:text-slate-100">
                        {el.elementType}
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 mb-1">
                      Trục / Vị trí định vị
                    </label>
                    {isEditMode && !isElDeleted ? (
                      <input
                        type="text"
                        value={el.roomName}
                        onChange={(e) =>
                          handleUpdateElementField(
                            el.id,
                            'roomName',
                            e.target.value,
                            `Vị trí cấu kiện ${el.elementCode}`
                          )
                        }
                        className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs"
                      />
                    ) : (
                      <div className="text-xs font-bold text-slate-800 dark:text-slate-100">
                        {el.roomName}
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 mb-1">
                      Kích thước tiết diện (mm)
                    </label>
                    {isEditMode && !isElDeleted ? (
                      <input
                        type="text"
                        value={el.dimensionsText || ''}
                        onChange={(e) =>
                          handleUpdateElementField(
                            el.id,
                            'dimensionsText',
                            e.target.value,
                            `Tiết diện cấu kiện ${el.elementCode}`
                          )
                        }
                        placeholder="VD: 600x800mm"
                        className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs font-mono"
                      />
                    ) : (
                      <div className="text-xs font-mono font-bold text-slate-800 dark:text-slate-100">
                        {el.dimensionsText || 'Chưa ghi nhận'}
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 mb-1">
                      Ảnh cấu kiện ({el.elementCode}-CTX)
                    </label>
                    <div className="flex items-center gap-2">
                      {el.ctxPhotoUrl ? (
                        <button
                          type="button"
                          onClick={() =>
                            onOpenPhotoZoom(
                              el.ctxPhotoUrl!,
                              `Ảnh cấu kiện ${el.elementCode} (${el.elementType})`,
                              el.ctxPhotoCode || el.elementCode
                            )
                          }
                          className="relative w-14 h-10 rounded-lg overflow-hidden border border-slate-300 group cursor-pointer"
                        >
                          <img
                            src={el.ctxPhotoUrl}
                            alt={el.elementCode}
                            className="w-full h-full object-cover"
                          />
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center">
                            <Maximize2 className="w-3.5 h-3.5 text-white" />
                          </div>
                        </button>
                      ) : (
                        <span className="text-[11px] text-amber-600 font-semibold">
                          Chưa có ảnh
                        </span>
                      )}

                      {onOpenPhotoAction && (
                        <button
                          type="button"
                          onClick={() =>
                            onOpenPhotoAction({
                              initialMode: el.ctxPhotoUrl ? 'REPLACE' : 'ADD',
                              category: 'ELEMENT_CTX',
                              targetPhotoType: 'ELEMENT_CTX_PHOTO',
                              targetPhotoId: el.id,
                              zoneCode: el.elementCode,
                              currentPhotoUrl: el.ctxPhotoUrl || undefined,
                              currentPhotoCode: el.ctxPhotoCode || `${el.elementCode}-CTX`,
                              photoTitle: `Ảnh cấu kiện chịu lực ${el.elementCode}`,
                            })
                          }
                          className="px-2 py-1 rounded-lg bg-white dark:bg-slate-900 hover:bg-slate-100 text-slate-700 dark:text-slate-200 border border-slate-300 text-[11px] font-bold flex items-center gap-1 cursor-pointer"
                        >
                          <Camera className="w-3 h-3 text-amber-600" />
                          <span>{el.ctxPhotoUrl ? 'Thay ảnh' : 'Thêm ảnh'}</span>
                        </button>
                      )}

                      {onOpenPhotoHistory && (el.hasHistory || el.ctxPhotoUrl) && (
                        <button
                          type="button"
                          onClick={() =>
                            onOpenPhotoHistory({
                              photoCode: el.ctxPhotoCode || el.elementCode,
                              photoType: 'ELEMENT_CTX_PHOTO',
                              photoTitle: `Lịch sử ảnh cấu kiện ${el.elementCode}`,
                              currentPhotoUrl: el.ctxPhotoUrl || undefined,
                            })
                          }
                          className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 border border-slate-200 cursor-pointer"
                        >
                          <History className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Structural Element Defects */}
                {activeDefs.length > 0 && (
                  <div className="pt-2 border-t border-amber-200/70 space-y-2">
                    <div className="text-[11px] font-black text-amber-900 dark:text-amber-300 uppercase">
                      Khuyết tật trên cấu kiện {el.elementCode} ({activeDefs.length})
                    </div>
                    {activeDefs.map((defect) => {
                      const isDefDeleted = Boolean(defect.isDeleted);
                      const cuUrl =
                        defect.cuPhotoUrl ||
                        (Array.isArray(defect.cuPhotos) && defect.cuPhotos[0]) ||
                        null;
                      return (
                        <div
                          key={defect.id}
                          className="p-2.5 rounded-xl bg-white dark:bg-slate-900 border border-amber-200 dark:border-slate-800 grid grid-cols-1 md:grid-cols-10 gap-2 items-center text-xs"
                        >
                          <div className="md:col-span-2 font-mono font-black text-rose-700">
                            {el.elementCode}/{defect.defectCode}
                          </div>
                          <div className="md:col-span-3 flex items-center gap-2">
                            <span>W (mm):</span>
                            {isEditMode && !isDefDeleted ? (
                              <input
                                type="number"
                                step="0.1"
                                value={defect.widthMaxMm}
                                onChange={(e) =>
                                  handleUpdateElementDefectField(
                                    el.id,
                                    defect.id,
                                    'widthMaxMm',
                                    Number(e.target.value),
                                    `Bề rộng vết nứt ${el.elementCode}/${defect.defectCode}`
                                  )
                                }
                                className="w-20 px-2 py-1 rounded border border-slate-300 font-mono text-xs"
                              />
                            ) : (
                              <strong className="font-mono text-rose-600">
                                {defect.widthMaxMm} mm
                              </strong>
                            )}
                          </div>
                          <div className="md:col-span-3 flex items-center gap-2">
                            <span>L (mm):</span>
                            {isEditMode && !isDefDeleted ? (
                              <input
                                type="number"
                                step="10"
                                value={defect.lengthMm}
                                onChange={(e) =>
                                  handleUpdateElementDefectField(
                                    el.id,
                                    defect.id,
                                    'lengthMm',
                                    Number(e.target.value),
                                    `Chiều dài vết nứt ${el.elementCode}/${defect.defectCode}`
                                  )
                                }
                                className="w-24 px-2 py-1 rounded border border-slate-300 font-mono text-xs"
                              />
                            ) : (
                              <strong className="font-mono">{defect.lengthMm} mm</strong>
                            )}
                          </div>
                          <div className="md:col-span-2 flex items-center justify-end gap-1.5">
                            {cuUrl && (
                              <button
                                type="button"
                                onClick={() =>
                                  onOpenPhotoZoom(
                                    cuUrl,
                                    `Ảnh cận cảnh ${el.elementCode}/${defect.defectCode}`,
                                    defect.cuPhotoCode || defect.defectCode
                                  )
                                }
                                className="w-10 h-8 rounded overflow-hidden border border-slate-300 cursor-pointer"
                              >
                                <img
                                  src={cuUrl}
                                  alt={defect.defectCode}
                                  className="w-full h-full object-cover"
                                />
                              </button>
                            )}
                            {onOpenPhotoAction && (
                              <button
                                type="button"
                                onClick={() =>
                                  onOpenPhotoAction({
                                    initialMode: cuUrl ? 'REPLACE' : 'ADD',
                                    category: 'DEFECT_CU',
                                    targetPhotoType: 'DEFECT_CU_PHOTO',
                                    targetPhotoId: defect.id,
                                    defectId: defect.id,
                                    defectCode: defect.defectCode,
                                    zoneCode: el.elementCode,
                                    currentPhotoUrl: cuUrl || undefined,
                                    photoTitle: `Ảnh cận cảnh ${el.elementCode}/${defect.defectCode}`,
                                  })
                                }
                                className="p-1.5 rounded bg-slate-100 hover:bg-slate-200 border border-slate-200 cursor-pointer"
                              >
                                <Camera className="w-3.5 h-3.5 text-amber-600" />
                              </button>
                            )}
                            {isEditMode && (
                              <button
                                type="button"
                                onClick={() => handleToggleDeleteElementDefect(el, defect)}
                                className="p-1.5 rounded bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 cursor-pointer"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

