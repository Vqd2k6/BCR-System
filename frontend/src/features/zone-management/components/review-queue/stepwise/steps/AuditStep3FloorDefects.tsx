import type { FloorSurveyData, DamageZoneData, StructuralElementData } from '../../../../../survey-phase1/types/phase1.types';
import type { DefectItem } from '../../../../../../components/canvas/DefectPinningCanvas';
import type { CadZonePin } from '../../../../../../components/canvas/FloorCadPinningCanvas';
import type { PhotoReplaceParams } from '../../AuditPhotoReplaceModal';
import type { AuditPhotoActionParams } from '../types';
import React, { useState } from 'react';
import { Layers, Maximize2, AlertTriangle, CheckCircle2, MapPin, Eye, EyeOff, Camera, ShieldAlert, Compass, Activity, FileText, Ruler, Sparkles, RefreshCw, Plus, Trash2 } from 'lucide-react';
import { Badge } from '../../../../../../core/components/ui/Badge';

interface Props {
  isEditMode: boolean;
  formState: Record<string, unknown>;
  handleFieldChange: (key: string, label: string, val: unknown) => void;
  onOpenPhotoZoom: (url: string, title?: string, photoCode?: string) => void;
  onOpenPhotoReplace: (params: PhotoReplaceParams) => void;
  onOpenPhotoAction?: (params: AuditPhotoActionParams) => void;
  isFieldDirty?: (fieldKey: string, subKey?: string) => boolean;
}

export const AuditStep3FloorDefects: React.FC<Props> = ({
  isEditMode,
  formState,
  handleFieldChange,
  onOpenPhotoZoom,
  onOpenPhotoReplace,
  onOpenPhotoAction,
  isFieldDirty,
}) => {
  const rawFloors: FloorSurveyData[] = Array.isArray(formState.floors) ? (formState.floors as FloorSurveyData[]) : [];
  const rawDamageZones: DamageZoneData[] = Array.isArray(formState.damageZones) ? (formState.damageZones as DamageZoneData[]) : [];

  // Determine active floor
  const [activeFloorIndex, setActiveFloorIndex] = useState(0);
  const [cadViewMode, setCadViewMode] = useState<'ARCH' | 'STRUCT'>('ARCH');
  const [showCadPins, setShowCadPins] = useState(true);
  const [showCtxPins, setShowCtxPins] = useState(true);
  const [highlightedDefectId, setHighlightedDefectId] = useState<string | null>(null);

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
  const currentCadPins: CadZonePin[] = cadViewMode === 'ARCH'
    ? (Array.isArray(currentFloor.cadZonePins) ? currentFloor.cadZonePins : [])
    : (Array.isArray(currentFloor.cadElementPins) ? currentFloor.cadElementPins : []);

  const cadPhotoUrl = cadViewMode === 'ARCH'
    ? (currentFloor.cadSketchPhotoUrl || currentFloor.cad_drawing_url || '')
    : (currentFloor.cadStructuralSketchPhotoUrl || currentFloor.cad_structural_drawing_url || '');

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

  // Remove defect from a zone
  const handleRemoveDefect = (zoneId: string, defectId: string) => {
    if (!window.confirm('Bạn có chắc chắn muốn xóa khuyết tật này khỏi hồ sơ?')) return;

    if (hasFloors) {
      const updatedFloors = rawFloors.map((fl: FloorSurveyData, fi: number) => {
        if (fi !== activeFloorIndex && fl.id !== currentFloor.id) return fl;
        const zones = (fl.zones || []).map((z: DamageZoneData) => {
          if (z.id !== zoneId) return z;
          const defects = (z.defects || []).filter((d: DefectItem) => d.id !== defectId && d.defectCode !== defectId);
          return { ...z, defects };
        });
        return { ...fl, zones };
      });
      handleFieldChange('floors', `Xóa khuyết tật`, updatedFloors);
    } else {
      const updatedZones = rawDamageZones.map((z: DamageZoneData) => {
        if (z.id !== zoneId) return z;
        const defects = (z.defects || []).filter((d: DefectItem) => d.id !== defectId && d.defectCode !== defectId);
        return { ...z, defects };
      });
      handleFieldChange('damageZones', `Xóa khuyết tật`, updatedZones);
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

              {cadPhotoUrl && (
                <button
                  type="button"
                  onClick={() =>
                    onOpenPhotoZoom(
                      cadPhotoUrl,
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

              {isEditMode && cadPhotoUrl && (
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
                        currentPhotoUrl: cadPhotoUrl,
                        floorCode: currentFloor.floorName,
                        photoTitle: `Bản vẽ CAD ${currentFloor.floorName || ''}`,
                      });
                    } else if (onOpenPhotoReplace) {
                      onOpenPhotoReplace({
                        targetPhotoType: 'FLOOR_CAD',
                        targetPhotoId: currentFloor.id || String((currentFloor as any).floorNumber || (activeFloorIndex + 1)),
                        photoIndex: (currentFloor as any).floorNumber || (activeFloorIndex + 1),
                        currentPhotoUrl: cadPhotoUrl,
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
            </div>
          </div>

          {/* Vùng hiển thị ảnh CAD kèm các điểm chấm Z / E - Ôm khít ảnh để toạ độ khớp 100% */}
          {cadPhotoUrl ? (
            <div className="relative w-full max-h-[480px] min-h-[220px] bg-slate-900 rounded-xl overflow-hidden border border-slate-300 flex items-center justify-center p-2 select-none">
              <div className="relative inline-block max-w-full leading-none mx-auto">
                <img
                  src={cadPhotoUrl}
                  alt="CAD Floor Plan"
                  className="max-w-full max-h-[460px] w-auto h-auto block mx-auto pointer-events-none select-none shadow-sm"
                />

                {/* Lớp phủ các điểm ghim Z hoặc E */}
                {showCadPins &&
                  currentCadPins.map((pin: CadZonePin, pIdx: number) => {
                    const pX = Number(pin.pinX ?? pin.pin_x ?? 50);
                    const pY = Number(pin.pinY ?? pin.pin_y ?? 50);
                    const pCode = pin.zoneCode || pin.zone_code || `${cadViewMode === 'ARCH' ? 'Z' : 'E'}-${pIdx + 1}`;
                    const isStruct = cadViewMode === 'STRUCT' || pin.type === 'STRUCTURAL';

                    return (
                      <div
                        key={pin.id || pIdx}
                        style={{
                          position: 'absolute',
                          top: `${pY}%`,
                          left: `${pX}%`,
                          transform: 'translate(-50%, -100%)',
                          zIndex: 25,
                        }}
                        className="flex flex-col items-center pointer-events-auto cursor-pointer group"
                        onClick={() => {
                          const targetElem = document.getElementById(isStruct ? `element-card-${pCode}` : `zone-card-${pCode}`);
                          if (targetElem) {
                            targetElem.scrollIntoView({ behavior: 'smooth', block: 'center' });
                            targetElem.classList.add('ring-4', 'ring-sky-400');
                            setTimeout(() => targetElem.classList.remove('ring-4', 'ring-sky-400'), 2000);
                          }
                        }}
                      >
                        <div
                          className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-black shadow-lg transition-transform group-hover:scale-110 ${
                            isStruct ? 'bg-amber-600 text-white' : 'bg-emerald-600 text-white'
                          }`}
                        >
                          {pCode}
                        </div>
                        <div
                          className={`w-2.5 h-2.5 rounded-full border-2 border-white shadow-md -mt-0.5 ${
                            isStruct ? 'bg-amber-400' : 'bg-emerald-400'
                          }`}
                        />
                      </div>
                    );
                  })}
              </div>
            </div>
          ) : (
            <div className="p-8 bg-white rounded-xl border border-dashed border-slate-300 text-center text-xs text-slate-500 space-y-1">
              <Compass className="w-8 h-8 text-slate-300 mx-auto mb-1" />
              <div className="font-bold text-slate-700">Chưa có sơ đồ mặt bằng CAD cho tầng này</div>
              <div className="text-[11px] text-slate-400">
                Các điểm Vùng Z vẫn được lưu trữ và hiển thị đầy đủ chi tiết bên dưới.
              </div>
            </div>
          )}
        </div>

        {/* Khối Danh sách các Vùng Kiến Trúc Z của Tầng */}
        <div className="space-y-4">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100">
            <div className="flex items-center gap-2">
              <Layers className="w-4 h-4 text-emerald-600" />
              <span className="text-xs font-black text-slate-800 uppercase tracking-wide">
                4.2. Chi Tiết Các Vùng Kiến Trúc Z ({currentZones.length} Vùng)
              </span>
            </div>
            <button
              type="button"
              onClick={() => setShowCtxPins(!showCtxPins)}
              className="text-xs font-bold text-slate-600 hover:text-slate-900 flex items-center gap-1 cursor-pointer"
            >
              {showCtxPins ? <Eye className="w-3.5 h-3.5 text-slate-500" /> : <EyeOff className="w-3.5 h-3.5 text-amber-600" />}
              <span>{showCtxPins ? 'Ẩn ghim D trên ảnh CTX' : 'Hiện ghim D trên ảnh CTX'}</span>
            </button>
          </div>

          {currentZones.length === 0 ? (
            <div className="p-8 text-center bg-slate-50 rounded-2xl border border-slate-200 text-slate-400">
              <Layers className="w-8 h-8 mx-auto text-slate-300 mb-2" />
              <span className="font-semibold text-xs">Tầng này không có Vùng Kiến Trúc Z nào</span>
            </div>
          ) : (
            currentZones.map((z: DamageZoneData) => {
              const zCode = z.zoneCode || z.zone_code || 'Z-??';
              const defectsList: DefectItem[] = Array.isArray(z.defects)
                ? z.defects
                : typeof z.defects === 'string'
                ? JSON.parse(z.defects)
                : [];
              const ctxUrl = z.ctxPhotoUrl || z.ctx_photo_url || '';
              const ctxCode = z.ctxPhotoCode || z.ctx_photo_code || `${zCode}_CTX`;

              return (
                <div
                  key={z.id || zCode}
                  id={`zone-card-${zCode}`}
                  className="border border-slate-200 rounded-2xl p-4 bg-slate-50/40 space-y-4 transition-all"
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
                              className="p-1 text-xs border border-amber-300 bg-amber-50/50 rounded font-bold"
                            />
                            <span>&bull;</span>
                            <input
                              type="text"
                              value={z.roomName || ''}
                              onChange={(e) => handleZoneFieldChange(z.id, 'roomName', e.target.value, 'Tên phòng/không gian')}
                              placeholder="Phòng (VD: Phòng khách)"
                              className="p-1 text-xs border border-amber-300 bg-amber-50/50 rounded font-bold"
                            />
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
                              value={z.componentType || 'Tường gạch'}
                              onChange={(e) => handleZoneFieldChange(z.id, 'componentType', e.target.value, 'Loại cấu kiện')}
                              className="p-1 text-xs border border-slate-300 rounded bg-white"
                            >
                              <option value="Tường gạch">Tường gạch</option>
                              <option value="Cột BTCT">Cột BTCT</option>
                              <option value="Dầm BTCT">Dầm BTCT</option>
                              <option value="Sàn BTCT">Sàn BTCT</option>
                              <option value="Vách ngăn thạch cao">Vách ngăn thạch cao</option>
                              <option value="Lan can / Ban công">Lan can / Ban công</option>
                              <option value="Móng / Chân tường">Móng / Chân tường</option>
                            </select>

                            <label className="font-semibold text-slate-600">Vật liệu:</label>
                            <select
                              value={z.wallMaterial || 'Vữa trát xi măng'}
                              onChange={(e) => handleZoneFieldChange(z.id, 'wallMaterial', e.target.value, 'Vật liệu tường')}
                              className="p-1 text-xs border border-slate-300 rounded bg-white"
                            >
                              <option value="Vữa trát xi măng">Vữa trát xi măng</option>
                              <option value="Bê tông cốt thép">Bê tông cốt thép</option>
                              <option value="Gạch men / Ốp đá">Gạch men / Ốp đá</option>
                              <option value="Tấm thạch cao">Tấm thạch cao</option>
                              <option value="Gạch đất nung không trát">Gạch đất nung không trát</option>
                            </select>
                          </>
                        ) : (
                          <>
                            Cấu kiện: <strong>{z.componentType || z.component_type || 'Tường gạch'}</strong> &bull; Vật liệu:{' '}
                            {z.wallMaterial || z.wall_material || 'Vữa trát xi măng'}
                          </>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
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
                      <Badge variant={defectsList.length > 0 ? 'warning' : 'success'} size="sm">
                        {defectsList.length} khuyết tật nứt
                      </Badge>
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
                            <span>+ Thêm Ảnh</span>
                          </button>
                        )}
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        {z.overviewPhotos.map((ovUrl: string, ovIdx: number) => (
                          <div
                            key={ovIdx}
                            onClick={() => onOpenPhotoZoom(ovUrl, `Ảnh tổng quan Vùng ${zCode} #${ovIdx + 1}`)}
                            className="aspect-4/3 rounded-lg overflow-hidden border border-slate-200 cursor-pointer hover:shadow-md transition-shadow group relative"
                          >
                            <img src={ovUrl} alt={`Tổng quan ${ovIdx + 1}`} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                            <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white">
                              <Maximize2 className="w-4 h-4 drop-shadow-md" />
                            </div>
                            {isEditMode && onOpenPhotoAction && (
                              <div className="absolute top-1 right-1 z-10 flex items-center gap-1">
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onOpenPhotoAction({
                                      initialMode: 'REPLACE',
                                      category: 'ZONE_CTX',
                                      targetPhotoType: 'CTX',
                                      targetPhotoId: zCode,
                                      zoneCode: zCode,
                                      floorCode: currentFloor.floorName,
                                      photoIndex: ovIdx,
                                      currentPhotoUrl: ovUrl,
                                      photoTitle: `Ảnh tổng quan ${zCode} #${ovIdx + 1}`,
                                    });
                                  }}
                                  className="p-1 rounded bg-black/70 hover:bg-sky-600 text-white text-[9px]"
                                  title="Đổi ảnh này"
                                >
                                  <RefreshCw className="w-2.5 h-2.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onOpenPhotoAction({
                                      initialMode: 'DELETE',
                                      category: 'ZONE_CTX',
                                      targetPhotoType: 'CTX',
                                      targetPhotoId: zCode,
                                      zoneCode: zCode,
                                      floorCode: currentFloor.floorName,
                                      photoIndex: ovIdx,
                                      currentPhotoUrl: ovUrl,
                                      photoTitle: `Ảnh tổng quan ${zCode} #${ovIdx + 1}`,
                                    });
                                  }}
                                  className="p-1 rounded bg-black/70 hover:bg-rose-600 text-white text-[9px]"
                                  title="Xóa ảnh này"
                                >
                                  <Trash2 className="w-2.5 h-2.5" />
                                </button>
                              </div>
                            )}
                          </div>
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
                        <span className="text-[10px] text-slate-400 font-mono">
                          {defectsList.length} điểm nứt D
                        </span>
                      </div>

                      <div
                        className="flex-1 min-h-[180px] rounded-lg bg-black/5 relative cursor-pointer overflow-hidden flex items-center justify-center group"
                        onClick={() => {
                          if (ctxUrl) {
                            onOpenPhotoZoom(ctxUrl, `${zCode} - Ảnh Bối Cảnh Mảng Tường`, ctxCode);
                          }
                        }}
                      >
                        {ctxUrl ? (
                          <>
                            <img
                              src={ctxUrl}
                              alt="CTX"
                              className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                            />
                            {/* Overlay điểm ghim khuyết tật D dạng mũi kim trắc địa trên ảnh CTX */}
                            {showCtxPins &&
                              defectsList.map((d: DefectItem, dIdx: number) => {
                                const pX = Number(d.pinX ?? d.pin_x ?? 50);
                                const pY = Number(d.pinY ?? d.pin_y ?? 50);
                                const dCode = d.defectCode || d.defect_code || `D-${dIdx + 1}`;
                                const defectKey = d.id || dCode;
                                const isHighlighted = highlightedDefectId === defectKey;

                                return (
                                  <div
                                    key={defectKey}
                                    onClick={(e) => {
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
                                    style={{
                                      position: 'absolute',
                                      top: `${pY}%`,
                                      left: `${pX}%`,
                                      transform: 'translate(-50%, -100%)',
                                      zIndex: isHighlighted ? 40 : 25,
                                      cursor: 'pointer',
                                    }}
                                    className="flex flex-col items-center group/pin select-none"
                                    title={`Bấm để cuộn và xem chi tiết khuyết tật ${dCode}`}
                                  >
                                    {/* Thẻ nhãn mã đỏ viền trắng nổi cao phía trên */}
                                    <div
                                      className={`px-1.5 py-0.5 rounded font-mono font-black text-[9px] shadow-md border border-white flex items-center justify-center whitespace-nowrap transition-all ${
                                        isHighlighted
                                          ? 'bg-rose-700 text-white ring-2 ring-amber-300 scale-115'
                                          : 'bg-rose-600 text-white group-hover/pin:scale-110 group-hover/pin:bg-rose-700'
                                      }`}
                                    >
                                      {dCode}
                                    </div>

                                    {/* Mũi kim tam giác nhọn chĩa thẳng xuống tọa độ */}
                                    <div className="w-0 h-0 border-l-[3.5px] border-l-transparent border-r-[3.5px] border-r-transparent border-t-[5px] border-t-rose-600 -mt-[0.5px]" />

                                    {/* Chấm tâm ngắm đỏ rực tại đúng tọa độ (x, y) */}
                                    <div className="w-1.5 h-1.5 rounded-full bg-rose-600 border border-white -mt-[1px] shadow-xs" />
                                  </div>
                                );
                              })}
                          </>
                        ) : (
                          <span className="text-xs text-slate-400 italic">Chưa có ảnh CTX</span>
                        )}

                        {ctxUrl && (
                          <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white">
                            <Maximize2 className="w-6 h-6 drop-shadow-md" />
                          </div>
                        )}
                      </div>

                      {isEditMode && ctxUrl && (
                        <div className="mt-2 flex items-center gap-1">
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
                          {onOpenPhotoAction && (
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
                                highlightedDefectId === (d.id || dCode)
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
                                  {isEditMode ? (
                                    <div className="flex items-center gap-2">
                                      <select
                                        value={d.screeningCategory || d.defectType || 'Vết nứt tường'}
                                        onChange={(e) =>
                                          handleDefectChange(z.id, d.id || d.defectCode, 'screeningCategory', e.target.value, `${dCode} Phân loại`)
                                        }
                                        className="p-1 border border-slate-300 rounded text-xs font-bold bg-white"
                                      >
                                        <option value="Vết nứt tường">Vết nứt tường</option>
                                        <option value="Vết nứt dầm/cột">Vết nứt dầm/cột</option>
                                        <option value="Bong tróc vữa/sơn">Bong tróc vữa/sơn</option>
                                        <option value="Thấm dột ẩm mốc">Thấm dột ẩm mốc</option>
                                        <option value="Lún sụt / Nứt sàn">Lún sụt / Nứt sàn</option>
                                        <option value="Nứt tiếp giáp cấu kiện">Nứt tiếp giáp cấu kiện</option>
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

                                {/* Thông số Bề rộng & Chiều dài + Nút xóa */}
                                <div className="flex items-center gap-2">
                                  {isEditMode ? (
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
                                      <span>+ Thêm Ảnh CU</span>
                                    </button>
                                  )}
                                </div>
                                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                                  {cuPhotos.map((cuUrl: string, cuIdx: number) => (
                                    <div
                                      key={cuIdx}
                                      className="group relative h-24 rounded-lg border border-slate-200 bg-slate-100 overflow-hidden cursor-pointer flex items-center justify-center"
                                      onClick={() =>
                                        onOpenPhotoZoom(
                                          cuUrl,
                                          `${dCode} - Ảnh Cận Cảnh #${cuIdx + 1} (Rộng ${d.widthMaxMm || 0}mm)`,
                                          `${dCode}_CU_${cuIdx + 1}`
                                        )
                                      }
                                    >
                                      <img
                                        src={cuUrl}
                                        alt="CU"
                                        className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                                      />
                                      <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white">
                                        <Maximize2 className="w-4 h-4 drop-shadow-md" />
                                      </div>
                                      <div className="absolute top-1 left-1 px-1.5 py-0.2 rounded bg-black/70 text-white font-mono text-[9px]">
                                        CU #{cuIdx + 1}
                                      </div>
                                      {isEditMode && (
                                        <div className="absolute bottom-1 right-1 flex items-center gap-1 z-10">
                                          <button
                                            type="button"
                                            onClick={(e) => {
                                              e.stopPropagation();
                                              if (onOpenPhotoAction) {
                                                onOpenPhotoAction({
                                                  initialMode: 'REPLACE',
                                                  category: 'DEFECT_CU',
                                                  targetPhotoType: 'CU',
                                                  targetPhotoId: dCode,
                                                  defectId: d.id,
                                                  defectCode: dCode,
                                                  photoIndex: cuIdx,
                                                  hasMultiplePhotos: cuPhotos.length > 1,
                                                  currentPhotoUrl: cuUrl,
                                                  photoTitle: `Thay Ảnh Cận Cảnh ${dCode} (#${cuIdx + 1})`,
                                                  floorCode: currentFloor.floorName,
                                                  zoneCode: zCode,
                                                });
                                              } else if (onOpenPhotoReplace) {
                                                onOpenPhotoReplace({
                                                  targetPhotoType: 'DEFECT_CU',
                                                  targetPhotoId: dCode,
                                                  defectId: d.id,
                                                  photoIndex: cuIdx,
                                                  currentPhotoUrl: cuUrl,
                                                  photoTitle: `Thay Ảnh Cận Cảnh ${dCode} (#${cuIdx + 1})`,
                                                });
                                              }
                                            }}
                                            className="p-1 rounded-md bg-black/75 hover:bg-amber-600 text-white shadow-xs transition-colors cursor-pointer"
                                            title="Thay thế ảnh này"
                                          >
                                            <Camera className="w-3.5 h-3.5 text-amber-300" />
                                          </button>
                                          {onOpenPhotoAction && (
                                            <button
                                              type="button"
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                onOpenPhotoAction({
                                                  initialMode: 'DELETE',
                                                  category: 'DEFECT_CU',
                                                  targetPhotoType: 'CU',
                                                  targetPhotoId: dCode,
                                                  defectId: d.id,
                                                  defectCode: dCode,
                                                  photoIndex: cuIdx,
                                                  hasMultiplePhotos: cuPhotos.length > 1,
                                                  currentPhotoUrl: cuUrl,
                                                  photoTitle: `Xóa Ảnh Cận Cảnh ${dCode} (#${cuIdx + 1})`,
                                                  floorCode: currentFloor.floorName,
                                                  zoneCode: zCode,
                                                });
                                              }}
                                              className="p-1 rounded-md bg-black/75 hover:bg-rose-600 text-white shadow-xs transition-colors cursor-pointer"
                                              title="Xóa ảnh này"
                                            >
                                              <Trash2 className="w-3.5 h-3.5 text-rose-300" />
                                            </button>
                                          )}
                                        </div>
                                      )}
                                    </div>
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
                4.3. Cấu Kiện Kết Cấu Chịu Lực (Cột, Dầm, Sàn E) & Khuyết Tật D của E ({currentElements.length} Cấu Kiện)
              </span>
            </div>
            <span className="text-xs text-slate-500 font-semibold">
              {currentElements.reduce((acc, el) => acc + (el.defects?.length || 0), 0)} khuyết tật kết cấu
            </span>
          </div>

          {currentElements.length === 0 ? (
            <div className="p-4 bg-slate-50 rounded-xl border border-dashed border-slate-200 text-xs text-slate-500 flex items-center justify-between">
              <span>Tầng này không phát hiện cấu kiện chịu lực riêng lẻ bị nứt vỡ hoặc KSV gom khuyết tật theo mảng tường Vùng Z.</span>
              <span className="font-bold text-emerald-700">✓ Không có khuyết tật cấu kiện riêng lẻ</span>
            </div>
          ) : (
            <div className="space-y-4">
              {currentElements.map((elem: StructuralElementData) => {
                const eCode = elem.elementCode || 'E-??';
                const eDefects: DefectItem[] = Array.isArray(elem.defects) ? elem.defects : [];
                const overviewPhotos = Array.isArray(elem.overviewPhotos) ? elem.overviewPhotos : [];

                return (
                  <div id={`element-card-${eCode}`} key={elem.id || eCode} className="p-4 bg-amber-50/30 rounded-xl border border-amber-200 space-y-3">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <div className="flex items-center gap-2 flex-wrap flex-1">
                        <span className="px-2.5 py-0.5 rounded-lg bg-amber-700 text-white font-mono font-black text-xs">
                          {eCode}
                        </span>
                        {isEditMode ? (
                          <div className="flex items-center gap-2 flex-wrap">
                            <input
                              type="text"
                              value={elem.elementType || ''}
                              onChange={(e) => handleElementFieldChange(elem.id, 'elementType', e.target.value, 'Loại cấu kiện')}
                              placeholder="Cột/Dầm/Sàn..."
                              className="p-1 text-xs border border-amber-300 rounded font-bold bg-white"
                            />
                            <span>&bull;</span>
                            <input
                              type="text"
                              value={elem.materialType || ''}
                              onChange={(e) => handleElementFieldChange(elem.id, 'materialType', e.target.value, 'Vật liệu')}
                              placeholder="BTCT, Thép..."
                              className="p-1 text-xs border border-amber-300 rounded font-bold bg-white"
                            />
                            <span>&bull;</span>
                            <input
                              type="text"
                              value={elem.roomName || ''}
                              onChange={(e) => handleElementFieldChange(elem.id, 'roomName', e.target.value, 'Vị trí trục/phòng')}
                              placeholder="Trục toạ độ / Vị trí..."
                              className="p-1 text-xs border border-amber-300 rounded bg-white"
                            />
                          </div>
                        ) : (
                          <span className="text-xs font-bold text-slate-800">
                            {elem.elementType || 'Cột/Dầm BTCT'} &bull; {elem.materialType || 'BTCT'} &bull;{' '}
                            <span className="text-slate-500 font-normal">{elem.roomName || elem.customRoomName || 'Trục không xác định'}</span>
                          </span>
                        )}
                      </div>
                      <Badge variant={eDefects.length > 0 ? 'warning' : 'success'} size="sm">
                        {eDefects.length} khuyết tật kết cấu
                      </Badge>
                    </div>

                    {/* Ảnh bối cảnh hoặc tổng quan của cấu kiện E */}
                    {(elem.ctxPhotoUrl || overviewPhotos.length > 0) && (
                      <div className="flex items-center gap-3 overflow-x-auto pb-1">
                        {elem.ctxPhotoUrl && (
                          <div
                            onClick={() => onOpenPhotoZoom(elem.ctxPhotoUrl!, `Ảnh bối cảnh cấu kiện ${eCode}`)}
                            className="relative w-28 h-20 rounded-lg overflow-hidden border border-amber-300 cursor-pointer group shrink-0 bg-white"
                          >
                            <img src={elem.ctxPhotoUrl} alt={eCode} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                            <span className="absolute bottom-0 inset-x-0 bg-black/60 text-white text-[9px] px-1 py-0.5 truncate font-mono">
                              Bối cảnh {eCode}
                            </span>
                          </div>
                        )}
                        {overviewPhotos.map((photoUrl, pIdx) => (
                          <div
                            key={pIdx}
                            onClick={() => onOpenPhotoZoom(photoUrl, `Ảnh tổng quan ${eCode} (#${pIdx + 1})`)}
                            className="relative w-28 h-20 rounded-lg overflow-hidden border border-slate-200 cursor-pointer group shrink-0 bg-white"
                          >
                            <img src={photoUrl} alt={`${eCode}-${pIdx}`} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                            <span className="absolute bottom-0 inset-x-0 bg-black/60 text-white text-[9px] px-1 py-0.5 truncate font-mono">
                              Ảnh #{pIdx + 1}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}

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
                                {cuPhotos.length > 0 && (
                                  <div className="flex items-center gap-2 pt-1 overflow-x-auto">
                                    {cuPhotos.map((cuItem: any, cuIdx: number) => {
                                      const cuUrl = typeof cuItem === 'string' ? cuItem : cuItem?.url || cuItem?.photoUrl;
                                      if (!cuUrl) return null;
                                      return (
                                        <div
                                          key={cuIdx}
                                          onClick={() => onOpenPhotoZoom(cuUrl, `Ảnh cận cảnh ${dCode} (#${cuIdx + 1})`)}
                                          className="group relative w-16 h-12 rounded border border-slate-200 overflow-hidden cursor-pointer shrink-0"
                                        >
                                          <img src={cuUrl} alt={dCode} className="w-full h-full object-cover" />
                                          {isEditMode && onOpenPhotoAction && (
                                            <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1">
                                              <button
                                                type="button"
                                                onClick={(e) => {
                                                  e.stopPropagation();
                                                  onOpenPhotoAction({
                                                    initialMode: 'REPLACE',
                                                    category: 'DEFECT_CU',
                                                    targetPhotoType: 'CU',
                                                    targetPhotoId: dCode,
                                                    defectId: def.id,
                                                    defectCode: dCode,
                                                    photoIndex: cuIdx,
                                                    hasMultiplePhotos: cuPhotos.length > 1,
                                                    currentPhotoUrl: cuUrl,
                                                    photoTitle: `Thay Ảnh Cận Cảnh ${dCode} (#${cuIdx + 1})`,
                                                    floorCode: currentFloor.floorName,
                                                  });
                                                }}
                                                className="p-0.5 rounded bg-amber-500 hover:bg-amber-600 text-white"
                                                title="Đổi ảnh này"
                                              >
                                                <RefreshCw className="w-2.5 h-2.5" />
                                              </button>
                                              <button
                                                type="button"
                                                onClick={(e) => {
                                                  e.stopPropagation();
                                                  onOpenPhotoAction({
                                                    initialMode: 'DELETE',
                                                    category: 'DEFECT_CU',
                                                    targetPhotoType: 'CU',
                                                    targetPhotoId: dCode,
                                                    defectId: def.id,
                                                    defectCode: dCode,
                                                    photoIndex: cuIdx,
                                                    hasMultiplePhotos: cuPhotos.length > 1,
                                                    currentPhotoUrl: cuUrl,
                                                    photoTitle: `Xóa Ảnh Cận Cảnh ${dCode} (#${cuIdx + 1})`,
                                                    floorCode: currentFloor.floorName,
                                                  });
                                                }}
                                                className="p-0.5 rounded bg-rose-600 hover:bg-rose-700 text-white"
                                                title="Xóa ảnh này"
                                              >
                                                <Trash2 className="w-2.5 h-2.5" />
                                              </button>
                                            </div>
                                          )}
                                        </div>
                                      );
                                    })}
                                  </div>
                                )}
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
    </section>
  );
};

