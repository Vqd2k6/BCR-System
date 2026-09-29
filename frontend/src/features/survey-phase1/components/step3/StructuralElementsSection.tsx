import React from 'react';
import { Card } from '../../../../core/components/ui/Card';
import { Button } from '../../../../core/components/ui/Button';
import { Badge } from '../../../../core/components/ui/Badge';
import { Input, Select } from '../../../../core/components/ui/FormControls';
import { PhotoCaptureInput } from '../../../../components/common/PhotoCaptureInput';
import { FloorCadPinningCanvas, CadZonePin } from '../../../../components/canvas/FloorCadPinningCanvas';
import { FloorSurveyData, StructuralElementData } from '../../types/phase1.types';
import { COMMON_ROOM_NAMES, STRUCTURAL_ELEMENT_TYPES, STRUCTURAL_MATERIALS } from './step3.constants';
import { Hammer, Camera, Trash2, MapPin, Plus, CheckCircle2, ShieldAlert, AlertCircle, Info } from 'lucide-react';

interface StructuralElementsSectionProps {
  currentFloor: FloorSurveyData;
  activeElementIndex: number;
  projectParcelCode?: string;
  onCadPhotoChange: (url: string) => void;
  onChangePins: (pins: CadZonePin[]) => void;
  onAutoCreatePin: (pin: CadZonePin) => void;
  onDeletePin?: (pin: CadZonePin, index: number) => void;
  onRenamePin?: (oldCode: string, newCode: string, updatedPin: CadZonePin) => void;
  onSelectElement: (index: number) => void;
  onUpdateElement: (index: number, updater: Partial<StructuralElementData>) => void;
  onDeleteElement: (index: number) => void;
  onNextElement: () => void;
  onPrevElement: () => void;
  onRequestAddNextElement: () => void;
  onOpenPinningModal: (elementId: string) => void;
  onToggleHasStructuralElements?: (hasElements: boolean, reason?: string) => void;
}

export const StructuralElementsSection: React.FC<StructuralElementsSectionProps> = ({
  currentFloor,
  activeElementIndex,
  projectParcelCode,
  onCadPhotoChange,
  onChangePins,
  onAutoCreatePin,
  onDeletePin,
  onRenamePin,
  onSelectElement,
  onUpdateElement,
  onDeleteElement,
  onNextElement,
  onPrevElement,
  onRequestAddNextElement,
  onOpenPinningModal,
  onToggleHasStructuralElements,
}) => {
  const structuralElements: StructuralElementData[] = currentFloor.structuralElements || [];
  const activeElement = structuralElements[activeElementIndex];
  const hasStructuralElements = currentFloor.hasStructuralElements !== false;

  return (
    <Card id="step3-structure-cad-section" className="border-amber-200 bg-white space-y-4 shadow-xs">
      {/* Header CAD_02 */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-amber-100">
        <div className="flex items-center gap-2">
          <Hammer className="w-5 h-5 text-amber-700" />
          <div>
            <h3 className="text-sm font-bold text-slate-800 flex items-center gap-2">
              <span>3.2. Sơ Đồ CAD_02 & Khảo Sát Kết Cấu Chịu Lực (Vùng E)</span>
              {hasStructuralElements && (
                <span className="px-2 py-0.5 rounded-full text-[11px] font-mono bg-amber-50 text-amber-800 border border-amber-200">
                  {structuralElements.length} Vùng E đã tạo
                </span>
              )}
            </h3>
            <p className="text-xs text-slate-500">
              Đánh dấu vị trí Cột, Dầm, Bản sàn chịu lực trực tiếp trên sơ đồ CAD_02 và ghi sổ khuyết tật kết cấu
            </p>
          </div>
        </div>
      </div>

      {/* 3.2.1 Tùy chọn Linh hoạt: Có cấu kiện chịu lực riêng hay không */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-3 bg-slate-50 border border-slate-200 rounded-xl">
        <div className="space-y-0.5">
          <div className="text-xs font-bold text-slate-800 flex items-center gap-2 flex-wrap">
            <span>Khảo sát kết cấu chịu lực trên {currentFloor.floorName}:</span>
            {hasStructuralElements ? (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-900 border border-amber-300">
                Bắt buộc sơ đồ CAD_02 & Phần E
              </span>
            ) : (
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-900 border border-emerald-300 flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                Miễn khảo sát kết cấu CAD_02
              </span>
            )}
          </div>
          <p className="text-[11px] text-slate-500">
            Chuyển sang "Miễn khảo sát" đối với tầng mái, sân thượng, tum thang hoặc mái tôn không có hệ khung dầm cột chịu lực riêng biệt.
          </p>
        </div>

        <div className="flex items-center gap-1.5 bg-white p-1 rounded-lg border border-slate-300 shadow-2xs shrink-0">
          <button
            type="button"
            onClick={() => onToggleHasStructuralElements?.(true)}
            className={`px-3 py-1.5 rounded-md font-bold text-xs flex items-center gap-1.5 transition-all ${
              hasStructuralElements
                ? 'bg-amber-600 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Có kết cấu</span>
          </button>

          <button
            type="button"
            onClick={() => onToggleHasStructuralElements?.(false, currentFloor.noStructuralElementsReason || 'Tầng mái / Sân thượng không có cấu kiện chịu lực riêng')}
            className={`px-3 py-1.5 rounded-md font-bold text-xs flex items-center gap-1.5 transition-all ${
              !hasStructuralElements
                ? 'bg-slate-800 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <ShieldAlert className="w-3.5 h-3.5" />
            <span>Không có (Miễn)</span>
          </button>
        </div>
      </div>

      {!hasStructuralElements ? (
        /* Giao diện khi Miễn khảo sát kết cấu chịu lực */
        <div className="p-4 bg-emerald-50/70 border border-emerald-200 rounded-xl space-y-3">
          <div className="flex items-start gap-3">
            <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <h4 className="text-xs font-bold text-emerald-900">
                Đã xác nhận miễn khảo sát kết cấu chịu lực (CAD_02 & Vùng E) cho {currentFloor.floorName}
              </h4>
              <p className="text-xs text-emerald-700">
                Hệ thống sẽ không yêu cầu tải sơ đồ CAD_02 và không bắt buộc chấm điểm cấu kiện chịu lực cho tầng này. Hồ sơ khảo sát sẽ hợp lệ và không bị chặn khi nộp.
              </p>
            </div>
          </div>

          <div className="pt-2 border-t border-emerald-200/60 space-y-2">
            <label className="text-[11px] font-bold text-slate-700 block">
              Lý do kỹ thuật / Hiện trạng công trình:
            </label>
            <div className="flex flex-wrap gap-1.5">
              {[
                'Tầng mái / Sân thượng không có cấu kiện riêng',
                'Mái tôn / Khung sắt nhẹ tiền chế',
                'Thuộc hệ khung dầm sàn của tầng bên dưới',
                'Tum thang / Mái ngói không có cột dầm bê tông riêng',
              ].map((reason) => (
                <button
                  key={reason}
                  type="button"
                  onClick={() => onToggleHasStructuralElements?.(false, reason)}
                  className={`px-2.5 py-1 rounded-lg text-xs font-medium border transition-all ${
                    currentFloor.noStructuralElementsReason === reason
                      ? 'bg-emerald-600 text-white border-emerald-700 font-bold shadow-2xs'
                      : 'bg-white text-slate-700 border-slate-200 hover:bg-emerald-50 hover:border-emerald-300'
                  }`}
                >
                  {reason}
                </button>
              ))}
            </div>

            <input
              type="text"
              placeholder="Hoặc nhập diễn giải kỹ thuật khác..."
              value={currentFloor.noStructuralElementsReason || ''}
              onChange={(e) => onToggleHasStructuralElements?.(false, e.target.value)}
              className="w-full mt-1 px-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:ring-1 focus:ring-emerald-500"
            />
          </div>
        </div>
      ) : (
        <>
          {/* CAD_02 Inline Interactive Canvas */}
          <FloorCadPinningCanvas
            cadPhotoUrl={currentFloor.cadStructuralSketchPhotoUrl || ''}
            onCadPhotoChange={onCadPhotoChange}
            pins={currentFloor.cadElementPins || []}
            onChangePins={onChangePins}
            onAutoCreatePin={onAutoCreatePin}
            onDeletePin={onDeletePin}
            onRenamePin={onRenamePin}
            onSelectPin={(pin) => {
              const idx = structuralElements.findIndex((e) => e.elementCode === pin.zoneCode);
              if (idx !== -1) onSelectElement(idx);
            }}
            mode="STRUCTURAL"
            floorName={currentFloor.floorName}
            parcelCode={projectParcelCode}
            cadTitle={`Tải lên hoặc chụp sơ đồ mặt bằng kết cấu CAD_02 (${currentFloor.floorName}):`}
          />

          {/* Stepper danh sách các Vùng Kết Cấu E */}
          <div className="space-y-3 pt-2">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <span className="text-xs font-bold text-amber-900 uppercase tracking-wider">
                Danh sách Cấu kiện Kết cấu ({structuralElements.length} Vùng E)
              </span>
            </div>

        {structuralElements.length > 0 && (
          <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
            {structuralElements.map((el, idx) => {
              const isSelected = activeElementIndex === idx;
              const hasDefects = el.defects && el.defects.length > 0;

              return (
                <button
                  key={el.id || idx}
                  type="button"
                  onClick={() => onSelectElement(idx)}
                  className={`px-3 py-2 rounded-xl text-xs font-bold transition-all border flex items-center gap-1.5 whitespace-nowrap cursor-pointer ${
                    isSelected
                      ? 'bg-amber-700 text-white border-amber-700 shadow-xs ring-2 ring-amber-500/20'
                      : 'bg-amber-50/60 text-slate-700 border-amber-200 hover:bg-amber-100/60'
                  }`}
                >
                  <span className="font-mono">{el.elementCode}</span>
                  <span className="text-[11px] opacity-90">• {el.elementType}</span>
                  {hasDefects ? (
                    <span className="px-1.5 py-0.2 rounded bg-red-500 text-white text-[9px] font-mono font-bold">
                      {el.defects.length} D
                    </span>
                  ) : el.isCompleted ? (
                    <span className="text-emerald-500 text-[10px] font-bold">✓</span>
                  ) : null}
                </button>
              );
            })}
          </div>
        )}

        {/* Form chi tiết Vùng Kết Cấu E đang chọn */}
        {structuralElements.length === 0 ? (
          <div className="p-6 text-center bg-amber-50/30 rounded-xl border border-dashed border-amber-300 space-y-2">
            <Hammer className="w-7 h-7 text-amber-500 mx-auto" />
            <p className="text-xs sm:text-sm font-semibold text-slate-800">
              Chưa có Cấu kiện kết cấu chịu lực (E) nào ở {currentFloor.floorName}
            </p>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              Bấm mở Sơ đồ CAD_02 để chạm chấm các Vùng E (Cột BTCT, Dầm, Bản sàn...) trên sơ đồ kết cấu.
            </p>
            <Button
              size="sm"
              className="bg-amber-600 hover:bg-amber-700 text-white"
              onClick={onRequestAddNextElement}
            >
              Chấm Cấu kiện E trên sơ đồ CAD
            </Button>
          </div>
        ) : activeElement ? (
          <div id="step3-active-element-card" className="p-4 bg-amber-50/30 rounded-xl border border-amber-200 space-y-4">
            {/* Header card E */}
            <div className="flex items-center justify-between pb-2 border-b border-amber-200">
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1">
                  <input
                    type="text"
                    value={activeElement.elementCode}
                    onChange={(e) => {
                      const newCode = e.target.value.toUpperCase();
                      const oldCode = activeElement.elementCode;
                      onUpdateElement(activeElementIndex, { elementCode: newCode });
                      if (onRenamePin) {
                        const matchingPin = (currentFloor.cadElementPins || []).find((p) => p.zoneCode === oldCode);
                        if (matchingPin) {
                          onRenamePin(oldCode, newCode, { ...matchingPin, zoneCode: newCode });
                        }
                      }
                    }}
                    className="px-2 py-0.5 rounded-lg bg-amber-700 text-white font-mono text-xs font-extrabold w-20 border border-amber-500 uppercase focus:ring-1 focus:ring-amber-300"
                    title="Mã Vùng E (đồng bộ với ghim trên sơ đồ CAD)"
                  />
                </div>
                <span className="text-sm font-bold text-slate-800">
                  Khảo Sát Kết Cấu: {activeElement.elementType} ({activeElement.roomName})
                </span>
                {activeElement.defects && activeElement.defects.length > 0 ? (
                  <Badge variant="danger">
                    {activeElement.defects.length} khuyết tật kết cấu D
                  </Badge>
                ) : (
                  <Badge variant="success">Kết cấu ổn định • Nguyên vẹn</Badge>
                )}
              </div>

              <button
                type="button"
                onClick={() => onDeleteElement(activeElementIndex)}
                className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                title="Xóa Vùng E"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>

            {/* Thuộc tính cấu kiện chịu lực */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <Select
                  id="select-el-roomName"
                  label="Vị Trí / Thuộc Không Gian"
                  value={activeElement.roomName}
                  onChange={(e) =>
                    onUpdateElement(activeElementIndex, { roomName: e.target.value })
                  }
                  options={COMMON_ROOM_NAMES.map((r) => ({ value: r, label: r }))}
                />
                {activeElement.roomName === 'Khác' && (
                  <Input
                    id="input-el-customRoomName"
                    placeholder="Nhập vị trí..."
                    value={activeElement.customRoomName || ''}
                    onChange={(e) =>
                      onUpdateElement(activeElementIndex, { customRoomName: e.target.value })
                    }
                    className="mt-1.5"
                  />
                )}
              </div>

              <div>
                <Select
                  id="select-el-elementType"
                  label="Loại Cấu Kiện Chịu Lực"
                  value={activeElement.elementType}
                  onChange={(e) =>
                    onUpdateElement(activeElementIndex, { elementType: e.target.value })
                  }
                  options={STRUCTURAL_ELEMENT_TYPES.map((t) => ({ value: t, label: t }))}
                />
                {activeElement.elementType === 'Khác' && (
                  <Input
                    id="input-el-customElementType"
                    placeholder="Nhập loại cấu kiện..."
                    value={activeElement.customElementType || ''}
                    onChange={(e) =>
                      onUpdateElement(activeElementIndex, {
                        customElementType: e.target.value,
                      })
                    }
                    className="mt-1.5"
                  />
                )}
              </div>

              <div>
                <Select
                  id="select-el-materialType"
                  label="Loại Vật Liệu Kết Cấu"
                  value={activeElement.materialType}
                  onChange={(e) =>
                    onUpdateElement(activeElementIndex, { materialType: e.target.value })
                  }
                  options={STRUCTURAL_MATERIALS.map((m) => ({ value: m, label: m }))}
                />
                {activeElement.materialType === 'Khác' && (
                  <Input
                    id="input-el-customMaterialType"
                    placeholder="Nhập vật liệu kết cấu..."
                    value={activeElement.customMaterialType || ''}
                    onChange={(e) =>
                      onUpdateElement(activeElementIndex, {
                        customMaterialType: e.target.value,
                      })
                    }
                    className="mt-1.5"
                  />
                )}
              </div>
            </div>

            {/* Chụp nhiều ảnh tổng quan cấu kiện E */}
            <div className="p-3 bg-white rounded-xl border border-slate-200 space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Camera className="w-4 h-4 text-amber-700" />
                  <span className="text-xs font-bold text-slate-800">
                    Ảnh Tổng Quan Cấu Kiện ({activeElement.elementCode} - {activeElement.elementType})
                  </span>
                </div>
                <span className="text-[11px] text-slate-500">
                  Đã chụp: {activeElement.overviewPhotos?.length || 0} ảnh
                </span>
              </div>

              {/* Grid ảnh */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {activeElement.overviewPhotos?.map((photoUrl, pIdx) => (
                  <div
                    key={pIdx}
                    className="relative rounded-lg overflow-hidden border border-slate-300 aspect-video group"
                  >
                    <img src={photoUrl} alt={`El Overview ${pIdx}`} className="w-full h-full object-cover" />
                    <button
                      type="button"
                      onClick={() => {
                        const deletedUrl = activeElement.overviewPhotos[pIdx];
                        const updated = activeElement.overviewPhotos.filter((_, i) => i !== pIdx);
                        const newCtx =
                          activeElement.ctxPhotoUrl === deletedUrl ? updated[0] || '' : activeElement.ctxPhotoUrl;
                        onUpdateElement(activeElementIndex, { overviewPhotos: updated, ctxPhotoUrl: newCtx });
                      }}
                      className="absolute top-1 right-1 p-1 bg-red-600 text-white rounded-md text-xs opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                      title="Xóa ảnh"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                ))}

                <PhotoCaptureInput
                  label="Thêm ảnh cấu kiện"
                  value=""
                  onChange={(url) => {
                    if (url) {
                      const updated = [...(activeElement.overviewPhotos || []), url];
                      onUpdateElement(activeElementIndex, {
                        overviewPhotos: updated,
                        ctxPhotoUrl: activeElement.ctxPhotoUrl || url,
                      });
                    }
                  }}
                  watermarkOptions={{
                    parcelCode: projectParcelCode,
                    floor: currentFloor.floorName,
                    zoneOrRoom: activeElement.elementCode,
                    photoType: 'CTX',
                    photoIndex: (activeElement.overviewPhotos?.length || 0) + 1,
                  }}
                  height="85px"
                />
              </div>
            </div>

            {/* Tùy chọn Có hư hỏng khuyết tật kết cấu */}
            <div className="p-3 bg-white rounded-xl border border-slate-200 space-y-3">
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={
                      activeElement.hasDamage ||
                      (activeElement.defects && activeElement.defects.length > 0)
                    }
                    onChange={(e) => {
                      const checked = e.target.checked;
                      onUpdateElement(activeElementIndex, {
                        hasDamage: checked,
                        ctxPhotoUrl:
                          activeElement.ctxPhotoUrl || activeElement.overviewPhotos?.[0] || '',
                      });
                    }}
                    className="rounded text-red-600 focus:ring-red-500"
                  />
                  <span className="text-xs font-bold text-red-700">
                    Cấu kiện {activeElement.elementCode} CÓ nứt kết cấu / trơ thép / võng cần ghi sổ D-xx
                  </span>
                </label>
              </div>

              {/* Nếu CÓ hư hỏng kết cấu: Hiển thị Canvas ghim */}
              {(activeElement.hasDamage ||
                (activeElement.defects && activeElement.defects.length > 0)) && (
                <div className="p-3 bg-red-50/50 rounded-xl border border-red-200 space-y-2.5">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                      <span className="text-xs font-bold text-slate-800 block">
                        Ảnh Bối Cảnh Cấu Kiện & Thả Ghim Khuyết Tật Kết Cấu
                      </span>
                      <span className="text-[11px] text-slate-600">
                        Đã ghim: <strong className="text-red-700 font-bold">{activeElement.defects?.length || 0} khuyết tật kết cấu D</strong>
                      </span>
                    </div>

                    <Button
                      size="sm"
                      variant="danger"
                      icon={<MapPin className="w-3.5 h-3.5" />}
                      onClick={() => onOpenPinningModal(activeElement.id)}
                    >
                      {activeElement.defects?.length > 0
                        ? `Xem & Chỉnh sửa ${activeElement.defects.length} ghim kết cấu ➔`
                        : 'Chấm điểm khuyết tật kết cấu D-xx'}
                    </Button>
                  </div>

                  <PhotoCaptureInput
                    label={`Ảnh bối cảnh cấu kiện để thả ghim cho ${activeElement.elementCode}:`}
                    value={activeElement.ctxPhotoUrl || ''}
                    onChange={(url) =>
                      onUpdateElement(activeElementIndex, { ctxPhotoUrl: url })
                    }
                    recommendedOrientation="landscape"
                    orientationHint="Khuyến nghị: Chụp ảnh bao quát toàn bộ cấu kiện chịu lực"
                    annotationTitle={`Vẽ & Ghi chú trên ảnh bối cảnh Cấu kiện ${activeElement.elementCode}`}
                    watermarkText={`STRUCTURAL | ${activeElement.elementCode}`}
                    height="130px"
                  />
                </div>
              )}
            </div>

            {/* Navigation giữa các E */}
            <div className="flex items-center justify-between pt-2 border-t border-amber-200">
              <Button
                size="sm"
                variant="outline"
                disabled={activeElementIndex === 0}
                onClick={onPrevElement}
              >
                ⬅️ Kết cấu {structuralElements[activeElementIndex - 1]?.elementCode || 'trước'}
              </Button>

              <div className="flex items-center gap-2">
                {activeElementIndex < structuralElements.length - 1 ? (
                  <Button
                    size="sm"
                    className="bg-amber-600 hover:bg-amber-700 text-white cursor-pointer"
                    onClick={onNextElement}
                  >
                    Tiếp theo: {structuralElements[activeElementIndex + 1]?.elementCode} ➔
                  </Button>
                ) : (
                  <Button
                    size="sm"
                    variant="outline"
                    icon={<Plus className="w-3.5 h-3.5" />}
                    onClick={onRequestAddNextElement}
                  >
                    Thêm Kết Cấu E tiếp theo
                  </Button>
                )}
              </div>
            </div>
          </div>
        ) : null}
      </div>
      </>
      )}
    </Card>
  );
};
