import React from 'react';
import { Card } from '../../../../core/components/ui/Card';
import { Button } from '../../../../core/components/ui/Button';
import { Badge } from '../../../../core/components/ui/Badge';
import { Input, Select } from '../../../../core/components/ui/FormControls';
import { PhotoCaptureInput } from '../../../../components/common/PhotoCaptureInput';
import { FloorCadPinningCanvas, CadZonePin } from '../../../../components/canvas/FloorCadPinningCanvas';
import { FloorSurveyData, DamageZoneData } from '../../types/phase1.types';
import { COMMON_ROOM_NAMES, ARCH_COMPONENT_TYPES, WALL_MATERIALS } from './step3.constants';
import { Building, Camera, Trash2, MapPin, AlertCircle, Plus } from 'lucide-react';

interface DamageZonesSectionProps {
  currentFloor: FloorSurveyData;
  activeZoneIndex: number;
  onCadPhotoChange: (url: string) => void;
  onChangePins: (pins: CadZonePin[]) => void;
  onAutoCreatePin: (pin: CadZonePin) => void;
  onSelectZone: (index: number) => void;
  onUpdateZone: (index: number, updater: Partial<DamageZoneData>) => void;
  onDeleteZone: (index: number) => void;
  onNextZone: () => void;
  onPrevZone: () => void;
  onRequestAddNextZone: () => void;
  onOpenPinningModal: (zoneId: string) => void;
}

export const DamageZonesSection: React.FC<DamageZonesSectionProps> = ({
  currentFloor,
  activeZoneIndex,
  onCadPhotoChange,
  onChangePins,
  onAutoCreatePin,
  onSelectZone,
  onUpdateZone,
  onDeleteZone,
  onNextZone,
  onPrevZone,
  onRequestAddNextZone,
  onOpenPinningModal,
}) => {
  const zones: DamageZoneData[] = currentFloor.zones || [];
  const activeZone = zones[activeZoneIndex];

  return (
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
        onCadPhotoChange={onCadPhotoChange}
        pins={currentFloor.cadZonePins || []}
        onChangePins={onChangePins}
        onAutoCreatePin={onAutoCreatePin}
        onSelectPin={(pin) => {
          const idx = zones.findIndex((z) => z.zoneCode === pin.zoneCode);
          if (idx !== -1) onSelectZone(idx);
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
                  onClick={() => onSelectZone(idx)}
                  className={`px-3 py-2 rounded-xl text-xs font-bold transition-all border flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
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
            <Button size="sm" onClick={onRequestAddNextZone}>
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
                type="button"
                onClick={() => onDeleteZone(activeZoneIndex)}
                className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
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
                  label="Tên Phòng / Không Gian *"
                  value={activeZone.roomName}
                  onChange={(e) => onUpdateZone(activeZoneIndex, { roomName: e.target.value })}
                  options={[
                    { value: '', label: '--- Chọn tên phòng / không gian ---' },
                    ...COMMON_ROOM_NAMES.map((r) => ({ value: r, label: r })),
                  ]}
                />
                {activeZone.roomName === 'Khác' && (
                  <Input
                    id="input-zone-customRoomName"
                    placeholder="Nhập tên phòng..."
                    value={activeZone.customRoomName || ''}
                    onChange={(e) =>
                      onUpdateZone(activeZoneIndex, { customRoomName: e.target.value })
                    }
                    className="mt-1.5"
                  />
                )}
              </div>

              <div>
                <Select
                  id="select-zone-componentType"
                  label="Cấu Kiện Mảng Vách Kiến Trúc *"
                  value={activeZone.componentType}
                  onChange={(e) =>
                    onUpdateZone(activeZoneIndex, { componentType: e.target.value })
                  }
                  options={[
                    { value: '', label: '--- Chọn cấu kiện vách ---' },
                    ...ARCH_COMPONENT_TYPES.map((c) => ({ value: c, label: c })),
                  ]}
                />
                {activeZone.componentType === 'Khác' && (
                  <Input
                    id="input-zone-customComponentType"
                    placeholder="Nhập loại cấu kiện..."
                    value={activeZone.customComponentType || ''}
                    onChange={(e) =>
                      onUpdateZone(activeZoneIndex, { customComponentType: e.target.value })
                    }
                    className="mt-1.5"
                  />
                )}
              </div>

              <div>
                <Select
                  id="select-zone-wallMaterial"
                  label="Vật Liệu Bề Mặt Hoàn Thiện *"
                  value={activeZone.wallMaterial}
                  onChange={(e) =>
                    onUpdateZone(activeZoneIndex, { wallMaterial: e.target.value })
                  }
                  options={[
                    { value: '', label: '--- Chọn vật liệu hoàn thiện ---' },
                    ...WALL_MATERIALS.map((w) => ({ value: w, label: w })),
                  ]}
                />
                {activeZone.wallMaterial === 'Khác' && (
                  <Input
                    id="input-zone-customWallMaterial"
                    placeholder="Nhập vật liệu..."
                    value={activeZone.customWallMaterial || ''}
                    onChange={(e) =>
                      onUpdateZone(activeZoneIndex, { customWallMaterial: e.target.value })
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
                        const deletedUrl = activeZone.overviewPhotos[pIdx];
                        const updated = activeZone.overviewPhotos.filter((_, i) => i !== pIdx);
                        const newCtx =
                          activeZone.ctxPhotoUrl === deletedUrl ? updated[0] || '' : activeZone.ctxPhotoUrl;
                        onUpdateZone(activeZoneIndex, { overviewPhotos: updated, ctxPhotoUrl: newCtx });
                      }}
                      className="absolute top-1 right-1 p-1 bg-red-600 text-white rounded-md text-xs opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
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
                      onUpdateZone(activeZoneIndex, {
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
                      onUpdateZone(activeZoneIndex, {
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
                      onClick={() => onOpenPinningModal(activeZone.id)}
                    >
                      {activeZone.defects?.length > 0
                        ? `Xem & Chỉnh sửa ${activeZone.defects.length} ghim D-xx ➔`
                        : 'Chấm điểm & Ghi sổ khuyết tật D-xx'}
                    </Button>
                  </div>

                  <PhotoCaptureInput
                    label={`Ảnh bối cảnh chính để thả ghim nứt cho ${activeZone.zoneCode}:`}
                    value={activeZone.ctxPhotoUrl || ''}
                    onChange={(url) => onUpdateZone(activeZoneIndex, { ctxPhotoUrl: url })}
                    recommendedOrientation="landscape"
                    orientationHint="Khuyến nghị: Chụp ảnh NGANG (4:3) bao quát mảng tường"
                    annotationTitle={`Vẽ & Ghi chú trên ảnh bối cảnh Vùng ${activeZone.zoneCode}`}
                    watermarkText={`CTX | ${activeZone.zoneCode}`}
                    height="130px"
                  />
                </div>
              )}
            </div>

            {/* Navigation giữa các Z */}
            <div className="flex items-center justify-between pt-2 border-t border-slate-200">
              <Button
                size="sm"
                variant="outline"
                disabled={activeZoneIndex === 0}
                onClick={onPrevZone}
              >
                ⬅️ Vùng {zones[activeZoneIndex - 1]?.zoneCode || 'trước'}
              </Button>

              <div className="flex items-center gap-2">
                {activeZoneIndex < zones.length - 1 ? (
                  <Button
                    size="sm"
                    onClick={onNextZone}
                  >
                    Tiếp theo: {zones[activeZoneIndex + 1]?.zoneCode} ➔
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    variant="outline"
                    icon={<Plus className="w-3.5 h-3.5" />}
                    onClick={onRequestAddNextZone}
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
  );
};
