import React, { useState } from 'react';
import {
  Plus,
  Trash2,
  RotateCcw,
  Camera,
  History,
  Maximize2,
  AlertTriangle,
  CheckCircle2,
  MapPin,
  EyeOff,
} from 'lucide-react';
import type {
  AuditPhotoActionParams,
  AuditPhotoHistoryParams,
} from '../../stepwise/types';
import type {
  CondoDamageZoneItemData,
  CondoDefectItemData,
} from '../types/condo-audit.types';

interface CondoZonesDefectsCrudEditorProps {
  isEditMode: boolean;
  zones: CondoDamageZoneItemData[];
  defaultFloorName?: string;
  onChangeZones: (nextZones: CondoDamageZoneItemData[], actionLabel: string) => void;
  onOpenPhotoZoom: (url: string, title?: string, photoCode?: string) => void;
  onOpenPhotoAction?: (params: AuditPhotoActionParams) => void;
  onOpenPhotoHistory?: (params: AuditPhotoHistoryParams) => void;
}

export function calcBurlandGradeFromWidthFrontend(
  widthMm: number,
  isStructuralCritical?: boolean
): number {
  if (isStructuralCritical && widthMm >= 3) return 4;
  if (widthMm <= 0) return 0;
  if (widthMm <= 1.0) return 1;
  if (widthMm <= 5.0) return 2;
  if (widthMm <= 15.0) return 3;
  if (widthMm <= 25.0) return 4;
  return 5;
}

export const CondoZonesDefectsCrudEditor: React.FC<CondoZonesDefectsCrudEditorProps> = ({
  isEditMode,
  zones,
  defaultFloorName = 'Tầng 1',
  onChangeZones,
  onOpenPhotoZoom,
  onOpenPhotoAction,
  onOpenPhotoHistory,
}) => {
  const [showDeleted, setShowDeleted] = useState(false);

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

  const handleAddZone = () => {
    const nextIdx = zones.length + 1;
    const zCode = `Z-${String(nextIdx).padStart(2, '0')}`;
    const newZone: CondoDamageZoneItemData = {
      id: `zone_${Date.now()}_${nextIdx}`,
      zoneCode: zCode,
      floorName: defaultFloorName,
      roomName: 'Phòng khách / Không gian chính',
      componentType: 'Tường',
      wallMaterial: 'Vữa trát',
      ctxPhotoUrl: null,
      ctxPhotoCode: `${zCode}-CTX`,
      burlandGrade: 0,
      functionalImpactRepairNeeded: false,
      pinX: null,
      pinY: null,
      defects: [],
    };
    onChangeZones([...zones, newZone], `Thêm mới vùng hư hại ${zCode}`);
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

  const handleAddDefect = (zone: CondoDamageZoneItemData) => {
    const dIdx = (zone.defects?.length || 0) + 1;
    const dCode = `D-${String(dIdx).padStart(2, '0')}`;
    const newDefect: CondoDefectItemData = {
      id: `def_${Date.now()}_${dIdx}`,
      defectCode: dCode,
      defectType: 'CRACK_PLASTER_SHRINKAGE',
      screeningCategory: 'CRACK_PLASTER_SHRINKAGE',
      widthMaxMm: 0.5,
      lengthMm: 500,
      crackDirection: 'DIAGONAL',
      activityState: 'STABLE',
      hasScaleCard: true,
      isStructuralCritical: false,
      cuPhotoUrl: null,
      cuPhotos: [],
      cuPhotoCode: `${zone.zoneCode}-${dCode}-CU`,
    };
    const nextZones = zones.map((z) => {
      if (z.id !== zone.id) return z;
      return recomputeZoneBurland({
        ...z,
        defects: [...(z.defects || []), newDefect],
      });
    });
    onChangeZones(nextZones, `Thêm vết nứt ${dCode} vào vùng ${zone.zoneCode}`);
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
          <span className="text-xs font-black text-slate-800 dark:text-slate-100">
            Danh sách Vùng hư hại Kiến trúc (Z):{' '}
            <span className="font-mono text-indigo-600 dark:text-indigo-400">
              {zones.filter((z) => !z.isDeleted).length} vùng hoạt động
            </span>
          </span>
          {deletedZonesCount > 0 && (
            <button
              type="button"
              onClick={() => setShowDeleted(!showDeleted)}
              className="px-2 py-0.5 rounded-lg text-[11px] font-bold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border border-slate-200 dark:border-slate-700 flex items-center gap-1 cursor-pointer"
            >
              <EyeOff className="w-3 h-3" />
              <span>
                {showDeleted ? 'Ẩn vùng đã xóa' : `Hiện vùng đã xóa (${deletedZonesCount})`}
              </span>
            </button>
          )}
        </div>

        {isEditMode && (
          <button
            type="button"
            onClick={handleAddZone}
            className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-2xs transition-all cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Thêm Vùng Hư Hại Mới (Z)</span>
          </button>
        )}
      </div>

      {/* Empty State */}
      {visibleZones.length === 0 ? (
        <div className="p-6 rounded-2xl border border-dashed border-slate-300 dark:border-slate-700 bg-slate-50/70 dark:bg-slate-800/40 text-center space-y-1.5">
          <CheckCircle2 className="w-7 h-7 text-emerald-500 mx-auto" />
          <div className="text-xs font-bold text-slate-700 dark:text-slate-200">
            Không ghi nhận vùng hư hại kiến trúc (Grade 0 - Nguyên vẹn)
          </div>
          <p className="text-[11px] text-slate-500">
            {isEditMode
              ? 'Nhấn "Thêm Vùng Hư Hại Mới (Z)" ở góc phải nếu cần bổ sung phát hiện mới khi thẩm định.'
              : 'Bật Chế độ chỉnh sửa nếu cần thêm bổ sung vùng hư hại (Z) hoặc vết nứt (D).'}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {visibleZones.map((zone) => {
            const isZoneDeleted = Boolean(zone.isDeleted);
            const activeDefects = (zone.defects || []).filter(
              (d) => showDeleted || !d.isDeleted
            );

            return (
              <div
                key={zone.id}
                className={`rounded-2xl border p-4 space-y-3 transition-all ${
                  isZoneDeleted
                    ? 'bg-rose-50/40 dark:bg-rose-950/20 border-rose-300 dark:border-rose-800 opacity-75'
                    : 'bg-slate-50/60 dark:bg-slate-800/40 border-slate-200 dark:border-slate-750'
                }`}
              >
                {/* Zone Header */}
                <div className="flex items-start justify-between gap-3 flex-wrap">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="px-2.5 py-1 rounded-lg text-xs font-mono font-black bg-indigo-600 text-white">
                      {zone.zoneCode}
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded-full text-[11px] font-bold border ${
                        zone.burlandGrade >= 3
                          ? 'bg-rose-100 text-rose-800 border-rose-300'
                          : zone.burlandGrade >= 1
                            ? 'bg-amber-100 text-amber-800 border-amber-300'
                            : 'bg-emerald-100 text-emerald-800 border-emerald-300'
                      }`}
                    >
                      Burland Cấp {zone.burlandGrade}
                    </span>
                    {zone.pinX !== null && zone.pinX !== undefined && (
                      <span className="px-2 py-0.5 rounded text-[10px] font-mono bg-sky-50 text-sky-700 border border-sky-200 flex items-center gap-1">
                        <MapPin className="w-3 h-3" />
                        CAD ({Number(zone.pinX).toFixed(1)}%, {Number(zone.pinY || 0).toFixed(1)}%)
                      </span>
                    )}
                    {isZoneDeleted && (
                      <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-rose-600 text-white">
                        ĐÃ XÓA MỀM (SOFT-DELETED)
                      </span>
                    )}
                  </div>

                  {isEditMode && (
                    <div className="flex items-center gap-2">
                      {!isZoneDeleted && (
                        <button
                          type="button"
                          onClick={() => handleAddDefect(zone)}
                          className="px-2.5 py-1 rounded-lg bg-teal-600 hover:bg-teal-700 text-white text-[11px] font-bold flex items-center gap-1 cursor-pointer"
                        >
                          <Plus className="w-3 h-3" />
                          <span>Thêm Vết Nứt (D)</span>
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => handleToggleDeleteZone(zone)}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-bold flex items-center gap-1 border cursor-pointer ${
                          isZoneDeleted
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                            : 'bg-rose-50 hover:bg-rose-100 text-rose-700 border-rose-200'
                        }`}
                      >
                        {isZoneDeleted ? (
                          <>
                            <RotateCcw className="w-3 h-3" />
                            <span>Khôi phục vùng</span>
                          </>
                        ) : (
                          <>
                            <Trash2 className="w-3 h-3" />
                            <span>Xóa vùng</span>
                          </>
                        )}
                      </button>
                    </div>
                  )}
                </div>

                {/* Zone Metadata Form Grid */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 mb-1">
                      Không gian / Phòng
                    </label>
                    {isEditMode && !isZoneDeleted ? (
                      <input
                        type="text"
                        value={zone.roomName}
                        onChange={(e) =>
                          handleUpdateZoneField(
                            zone.id,
                            'roomName',
                            e.target.value,
                            `Phòng/Vị trí vùng ${zone.zoneCode}`
                          )
                        }
                        className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs text-slate-900 dark:text-slate-100"
                      />
                    ) : (
                      <div className="text-xs font-bold text-slate-800 dark:text-slate-100">
                        {zone.roomName || 'Không gian chính'}
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 mb-1">
                      Bộ phận công trình
                    </label>
                    {isEditMode && !isZoneDeleted ? (
                      <select
                        value={zone.componentType}
                        onChange={(e) =>
                          handleUpdateZoneField(
                            zone.id,
                            'componentType',
                            e.target.value,
                            `Bộ phận vùng ${zone.zoneCode}`
                          )
                        }
                        className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs text-slate-900 dark:text-slate-100"
                      >
                        <option value="Tường">Tường ngăn / Tường bao</option>
                        <option value="Trần">Trần căn hộ / hành lang</option>
                        <option value="Sàn">Sàn gạch / Sàn gỗ</option>
                        <option value="Cột">Cột kiến trúc</option>
                        <option value="Dầm">Dầm trần</option>
                        <option value="Khung cửa">Khung cửa sổ / Cửa đi</option>
                      </select>
                    ) : (
                      <div className="text-xs font-bold text-slate-800 dark:text-slate-100">
                        {zone.componentType}
                      </div>
                    )}
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 mb-1">
                      Vật liệu bề mặt
                    </label>
                    {isEditMode && !isZoneDeleted ? (
                      <select
                        value={zone.wallMaterial}
                        onChange={(e) =>
                          handleUpdateZoneField(
                            zone.id,
                            'wallMaterial',
                            e.target.value,
                            `Vật liệu vùng ${zone.zoneCode}`
                          )
                        }
                        className="w-full px-2.5 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 text-xs text-slate-900 dark:text-slate-100"
                      >
                        <option value="Vữa trát">Vữa trát sơn nước</option>
                        <option value="Gạch xây">Tường gạch xây</option>
                        <option value="BTCT">Bê tông cốt thép (BTCT)</option>
                        <option value="Thạch cao">Trần thạch cao</option>
                        <option value="Gạch ốp lát">Gạch Ceramic / Đá ốp</option>
                      </select>
                    ) : (
                      <div className="text-xs font-bold text-slate-800 dark:text-slate-100">
                        {zone.wallMaterial}
                      </div>
                    )}
                  </div>

                  {/* Zone Context Photo (CTX) */}
                  <div>
                    <label className="block text-[11px] font-bold text-slate-500 mb-1">
                      Ảnh toàn cảnh vùng ({zone.zoneCode}-CTX)
                    </label>
                    <div className="flex items-center gap-2">
                      {zone.ctxPhotoUrl ? (
                        <button
                          type="button"
                          onClick={() =>
                            onOpenPhotoZoom(
                              zone.ctxPhotoUrl!,
                              `Ảnh toàn cảnh ${zone.zoneCode} - ${zone.roomName}`,
                              zone.ctxPhotoCode || zone.zoneCode
                            )
                          }
                          className="relative w-14 h-10 rounded-lg overflow-hidden border border-slate-300 group cursor-pointer shrink-0"
                        >
                          <img
                            src={zone.ctxPhotoUrl}
                            alt={zone.zoneCode}
                            className="w-full h-full object-cover"
                          />
                          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity">
                            <Maximize2 className="w-3.5 h-3.5 text-white" />
                          </div>
                        </button>
                      ) : (
                        <span className="text-[11px] text-amber-600 font-semibold">
                          Chưa có ảnh CTX
                        </span>
                      )}

                      {onOpenPhotoAction && (
                        <button
                          type="button"
                          onClick={() =>
                            onOpenPhotoAction({
                              initialMode: zone.ctxPhotoUrl ? 'REPLACE' : 'ADD',
                              category: 'ZONE_CTX',
                              targetPhotoType: 'ZONE_CTX_PHOTO',
                              targetPhotoId: zone.id,
                              zoneCode: zone.zoneCode,
                              currentPhotoUrl: zone.ctxPhotoUrl || undefined,
                              currentPhotoCode: zone.ctxPhotoCode || `${zone.zoneCode}-CTX`,
                              photoTitle: `Ảnh toàn cảnh ${zone.zoneCode} (${zone.roomName})`,
                            })
                          }
                          className="px-2 py-1 rounded-lg bg-white dark:bg-slate-900 hover:bg-slate-100 text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-700 text-[11px] font-bold flex items-center gap-1 cursor-pointer"
                        >
                          <Camera className="w-3 h-3 text-indigo-600" />
                          <span>{zone.ctxPhotoUrl ? 'Thay ảnh' : 'Thêm ảnh'}</span>
                        </button>
                      )}

                      {onOpenPhotoHistory && (zone.hasHistory || zone.ctxPhotoUrl) && (
                        <button
                          type="button"
                          onClick={() =>
                            onOpenPhotoHistory({
                              photoCode: zone.ctxPhotoCode || zone.zoneCode,
                              photoType: 'ZONE_CTX_PHOTO',
                              photoTitle: `Lịch sử ảnh vùng ${zone.zoneCode}`,
                              currentPhotoUrl: zone.ctxPhotoUrl || undefined,
                            })
                          }
                          className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 border border-slate-200 cursor-pointer"
                          title="Xem phả hệ ảnh vùng (Lineage)"
                        >
                          <History className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                {/* Defects Table inside Zone */}
                <div className="pt-2 border-t border-slate-200/80 dark:border-slate-700/70 space-y-2">
                  <div className="text-[11px] font-black text-slate-600 dark:text-slate-300 uppercase tracking-wider">
                    Danh mục Khuyết tật / Vết nứt chi tiết (D) trong vùng {zone.zoneCode} ({activeDefects.length})
                  </div>

                  {activeDefects.length === 0 ? (
                    <div className="text-xs text-slate-400 italic py-1">
                      Chưa có vết nứt (D) nào trong vùng này.
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {activeDefects.map((defect) => {
                        const isDefDeleted = Boolean(defect.isDeleted);
                        const cuUrl =
                          defect.cuPhotoUrl ||
                          (Array.isArray(defect.cuPhotos) && defect.cuPhotos[0]) ||
                          null;

                        return (
                          <div
                            key={defect.id}
                            className={`p-3 rounded-xl border grid grid-cols-1 md:grid-cols-12 gap-2.5 items-center text-xs ${
                              isDefDeleted
                                ? 'bg-rose-50/50 border-rose-300 opacity-70'
                                : 'bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800'
                            }`}
                          >
                            {/* Defect Code & Critical Flag */}
                            <div className="md:col-span-2 flex items-center gap-1.5 flex-wrap">
                              <span className="px-2 py-0.5 rounded font-mono font-black text-[11px] bg-slate-800 text-white">
                                {defect.defectCode}
                              </span>
                              {defect.isStructuralCritical && (
                                <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-700 border border-rose-300 flex items-center gap-0.5">
                                  <AlertTriangle className="w-3 h-3" /> Kết cấu
                                </span>
                              )}
                            </div>

                            {/* Defect Type */}
                            <div className="md:col-span-3">
                              {isEditMode && !isDefDeleted ? (
                                <select
                                  value={defect.defectType || 'CRACK_PLASTER_SHRINKAGE'}
                                  onChange={(e) =>
                                    handleUpdateDefectField(
                                      zone.id,
                                      defect.id,
                                      'defectType',
                                      e.target.value,
                                      `Loại khuyết tật ${defect.defectCode} (${zone.zoneCode})`
                                    )
                                  }
                                  className="w-full px-2 py-1 rounded border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-xs"
                                >
                                  <option value="CRACK_PLASTER_SHRINKAGE">Nứt co ngót vữa trát</option>
                                  <option value="CRACK_WALL_DIAGONAL">Nứt xiên tường xây</option>
                                  <option value="CRACK_WALL_HORIZONTAL">Nứt ngang tường</option>
                                  <option value="CRACK_WALL_VERTICAL">Nứt đứng tường</option>
                                  <option value="CRACK_STRUCTURAL_BEAM_COLUMN">Nứt cấu kiện Dầm/Cột</option>
                                  <option value="WATER_SEEPAGE_DAMP">Thấm ẩm / Bong tróc sơn</option>
                                  <option value="SPALLING_CONCRETE">Bong bật bê tông / Lộ cốt thép</option>
                                </select>
                              ) : (
                                <span className="font-semibold text-slate-700 dark:text-slate-200">
                                  {defect.defectType || defect.screeningCategory || 'Nứt bề mặt'}
                                </span>
                              )}
                            </div>

                            {/* Width (mm) & Length (mm) */}
                            <div className="md:col-span-3 flex items-center gap-2">
                              <div className="flex-1">
                                <span className="text-[10px] text-slate-400 block">Bề rộng W (mm)</span>
                                {isEditMode && !isDefDeleted ? (
                                  <input
                                    type="number"
                                    step="0.1"
                                    min="0"
                                    value={defect.widthMaxMm}
                                    onChange={(e) =>
                                      handleUpdateDefectField(
                                        zone.id,
                                        defect.id,
                                        'widthMaxMm',
                                        Number(e.target.value),
                                        `Bề rộng vết nứt ${defect.defectCode} (${zone.zoneCode})`
                                      )
                                    }
                                    className="w-full px-2 py-1 rounded border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-mono text-xs font-bold"
                                  />
                                ) : (
                                  <span className="font-mono font-black text-rose-600">
                                    {defect.widthMaxMm} mm
                                  </span>
                                )}
                              </div>

                              <div className="flex-1">
                                <span className="text-[10px] text-slate-400 block">Chiều dài L (mm)</span>
                                {isEditMode && !isDefDeleted ? (
                                  <input
                                    type="number"
                                    step="10"
                                    min="0"
                                    value={defect.lengthMm}
                                    onChange={(e) =>
                                      handleUpdateDefectField(
                                        zone.id,
                                        defect.id,
                                        'lengthMm',
                                        Number(e.target.value),
                                        `Chiều dài vết nứt ${defect.defectCode} (${zone.zoneCode})`
                                      )
                                    }
                                    className="w-full px-2 py-1 rounded border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 font-mono text-xs"
                                  />
                                ) : (
                                  <span className="font-mono text-slate-700 dark:text-slate-300">
                                    {defect.lengthMm} mm
                                  </span>
                                )}
                              </div>
                            </div>

                            {/* Scale card & Structural Critical checkboxes */}
                            <div className="md:col-span-2 flex flex-col gap-1">
                              <label className="inline-flex items-center gap-1.5 text-[11px] cursor-pointer">
                                <input
                                  type="checkbox"
                                  disabled={!isEditMode || isDefDeleted}
                                  checked={Boolean(defect.hasScaleCard)}
                                  onChange={(e) =>
                                    handleUpdateDefectField(
                                      zone.id,
                                      defect.id,
                                      'hasScaleCard',
                                      e.target.checked,
                                      `Thước đo tỉ lệ ${defect.defectCode}`
                                    )
                                  }
                                />
                                <span>Có thước đo</span>
                              </label>
                              <label className="inline-flex items-center gap-1.5 text-[11px] text-rose-700 dark:text-rose-400 font-semibold cursor-pointer">
                                <input
                                  type="checkbox"
                                  disabled={!isEditMode || isDefDeleted}
                                  checked={Boolean(defect.isStructuralCritical)}
                                  onChange={(e) =>
                                    handleUpdateDefectField(
                                      zone.id,
                                      defect.id,
                                      'isStructuralCritical',
                                      e.target.checked,
                                      `Cờ nguy hiểm kết cấu ${defect.defectCode}`
                                    )
                                  }
                                />
                                <span>Nứt kết cấu</span>
                              </label>
                            </div>

                            {/* Close-up Photo (CU) & Delete Action */}
                            <div className="md:col-span-2 flex items-center justify-end gap-1.5">
                              {cuUrl ? (
                                <button
                                  type="button"
                                  onClick={() =>
                                    onOpenPhotoZoom(
                                      cuUrl,
                                      `Ảnh cận cảnh ${zone.zoneCode} - ${defect.defectCode} (W=${defect.widthMaxMm}mm)`,
                                      defect.cuPhotoCode || defect.defectCode
                                    )
                                  }
                                  className="relative w-11 h-9 rounded overflow-hidden border border-slate-300 group cursor-pointer shrink-0"
                                >
                                  <img
                                    src={cuUrl}
                                    alt={defect.defectCode}
                                    className="w-full h-full object-cover"
                                  />
                                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 flex items-center justify-center">
                                    <Maximize2 className="w-3 h-3 text-white" />
                                  </div>
                                </button>
                              ) : (
                                <span className="text-[10px] text-amber-600 font-semibold">
                                  Thiếu ảnh CU
                                </span>
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
                                      zoneCode: zone.zoneCode,
                                      currentPhotoUrl: cuUrl || undefined,
                                      currentPhotoCode:
                                        defect.cuPhotoCode || `${zone.zoneCode}-${defect.defectCode}-CU`,
                                      photoTitle: `Ảnh cận cảnh thước đo ${zone.zoneCode} / ${defect.defectCode}`,
                                    })
                                  }
                                  className="p-1.5 rounded bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 text-slate-700 dark:text-slate-200 border border-slate-200 cursor-pointer"
                                  title="Thêm / Thay thế ảnh cận cảnh (CU)"
                                >
                                  <Camera className="w-3.5 h-3.5 text-indigo-600" />
                                </button>
                              )}

                              {onOpenPhotoHistory && (defect.hasHistory || cuUrl) && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    onOpenPhotoHistory({
                                      photoCode: defect.cuPhotoCode || defect.defectCode,
                                      photoType: 'DEFECT_CU_PHOTO',
                                      photoTitle: `Lịch sử ảnh khuyết tật ${defect.defectCode}`,
                                      currentPhotoUrl: cuUrl || undefined,
                                    })
                                  }
                                  className="p-1.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-600 border border-slate-200 cursor-pointer"
                                  title="Xem lịch sử phả hệ ảnh CU"
                                >
                                  <History className="w-3.5 h-3.5" />
                                </button>
                              )}

                              {isEditMode && (
                                <button
                                  type="button"
                                  onClick={() => handleToggleDeleteDefect(zone, defect)}
                                  className={`p-1.5 rounded border cursor-pointer ${
                                    isDefDeleted
                                      ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                                      : 'bg-rose-50 hover:bg-rose-100 text-rose-600 border-rose-200'
                                  }`}
                                  title={isDefDeleted ? 'Khôi phục vết nứt' : 'Xóa mềm vết nứt'}
                                >
                                  {isDefDeleted ? (
                                    <RotateCcw className="w-3.5 h-3.5" />
                                  ) : (
                                    <Trash2 className="w-3.5 h-3.5" />
                                  )}
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

