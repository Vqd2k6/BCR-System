import React from 'react';
import {
  PenTool,
  ArrowRight,
  ArrowLeft,
  Plus,
  Trash2,
  RefreshCw,
  AlertTriangle,
  ZoomIn,
  Camera,
  CheckCircle2,
} from 'lucide-react';
import { FloorCadPinningCanvas, type CadZonePin } from '../../../../components/canvas/FloorCadPinningCanvas';
import { PhotoCaptureInput } from '../../../../components/common/PhotoCaptureInput';
import { TapToZoomThumbnail } from '../../../../components/common/TapToZoomThumbnail';
import type { DamageZoneData } from '../../../survey-phase1/types/phase1.types';
import type { MetroWatermarkOptions } from '../../../../utils/watermarkEngine';
import {
  COMMON_ROOM_NAMES,
  ARCH_COMPONENT_TYPES,
  WALL_MATERIALS,
} from '../../types/masterAreaSurvey.types';

interface Step3DamageZonesAndDefectsProps {
  unitCode: string;
  floorNumber: number;
  floorName: string;
  cadSketchPhotoUrl: string;
  onCadSketchPhotoUrlChange: (url: string) => void;
  cadZonePins: CadZonePin[];
  setCadZonePins: React.Dispatch<React.SetStateAction<CadZonePin[]>>;
  zones: DamageZoneData[];
  setZones: React.Dispatch<React.SetStateAction<DamageZoneData[]>>;
  activeZoneIndex: number;
  setActiveZoneIndex: (index: number) => void;
  activeZone: DamageZoneData;
  onUpdateActiveZone: (updater: Partial<DamageZoneData>) => void;
  onAddZone: () => void;
  onDeleteZone: (index: number) => void;
  onDeleteZoneByCode: (zoneCode: string) => void;
  onSelectZoneByCode: (zoneCode: string) => void;
  onSyncMaterialsToEntireArea: () => void;
  onUpdateOrAddZoneOverviewPhoto: (zoneIndex: number, url: string, photoCode?: string) => void;
  onRemoveZoneOverviewPhoto: (zoneIndex: number, photoIndex: number) => void;
  onTriggerPinningZone: (zoneId: string) => void;
  watermarkOptions?: MetroWatermarkOptions;
  isReadOnly?: boolean;
  onBack: () => void;
  onNext: () => void;
  onPreviewImage: (url: string) => void;
}

export const Step3_DamageZonesAndDefects: React.FC<Step3DamageZonesAndDefectsProps> = ({
  unitCode,
  floorNumber,
  floorName,
  cadSketchPhotoUrl,
  onCadSketchPhotoUrlChange,
  cadZonePins,
  setCadZonePins,
  zones,
  setZones,
  activeZoneIndex,
  setActiveZoneIndex,
  activeZone,
  onUpdateActiveZone,
  onAddZone,
  onDeleteZone,
  onDeleteZoneByCode,
  onSelectZoneByCode,
  onSyncMaterialsToEntireArea,
  onUpdateOrAddZoneOverviewPhoto,
  onRemoveZoneOverviewPhoto,
  onTriggerPinningZone,
  watermarkOptions,
  isReadOnly,
  onBack,
  onNext,
  onPreviewImage,
}) => {
  const currentZonePhotos = activeZone?.overviewPhotos || [];
  const currentZoneDefects = activeZone?.defects || [];

  return (
    <div className="flex flex-col gap-4 animate-in fade-in duration-200">
      {/* Tiêu đề ngắn gọn cho KSV */}
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-2">
          <span className="px-2 py-0.5 rounded-md bg-emerald-600 text-white font-bold text-xs">
            BƯỚC 3
          </span>
          <h3 className="text-sm sm:text-base font-bold text-slate-800">
            Vùng hoàn thiện kiến trúc (Z) & Khuyết tật (D)
          </h3>
        </div>
        <span className="text-xs text-slate-500 font-mono font-medium">
          {zones.length} vùng ({zones.reduce((acc, z) => acc + (z.defects?.length || 0), 0)}D)
        </span>
      </div>

      {/* Bản vẽ CAD Z Pinning (Light Theme, không bọc max-h cưỡng bức làm lọt thỏm) */}
      <div className="bg-slate-100 rounded-2xl border border-slate-300 p-2 sm:p-3 flex flex-col gap-2 shadow-xs">
        <div className="flex items-center justify-between px-1">
          <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
            <PenTool size={13} className="text-emerald-600" />
            Định vị Vùng Z trên sơ đồ khu vực (Z-01, Z-02...):
          </span>
          <span className="text-[11px] text-slate-500 hidden sm:inline">
            Chạm vào sơ đồ để ghim hoặc chọn Vùng Z
          </span>
        </div>

        <div className="w-full rounded-xl overflow-hidden bg-white border border-slate-200">
          <FloorCadPinningCanvas
            cadPhotoUrl={cadSketchPhotoUrl}
            onCadPhotoChange={onCadSketchPhotoUrlChange}
            pins={cadZonePins}
            onChangePins={setCadZonePins}
            onDeletePin={(pin) => {
              if (pin.zoneCode) {
                onDeleteZoneByCode(pin.zoneCode);
              }
            }}
            onSelectPin={(pin) => {
              if (pin.zoneCode) {
                onSelectZoneByCode(pin.zoneCode);
              }
            }}
            onAutoCreatePin={(pin: CadZonePin) => {
              // Canvas đã cập nhật pins qua onChangePins. Chỉ tự động thêm zone mới nếu chưa có
              if (!zones.some((z) => z.zoneCode === pin.zoneCode)) {
                setZones((prev) => [
                  ...prev,
                  {
                    id: `zone_${Date.now()}_${pin.zoneCode}`,
                    zoneCode: pin.zoneCode,
                    floorName: `Tầng ${floorNumber}`,
                    roomName: pin.label || 'Vùng kiến trúc',
                    componentType: ARCH_COMPONENT_TYPES[0] || 'Tường',
                    wallMaterial: WALL_MATERIALS[0] || 'Sơn nước',
                    overviewPhotos: [],
                    notes: '',
                    defects: [],
                  },
                ]);
              }
            }}
            mode="ZONE"
            floorName={floorName}
            cadTitle={`Mặt bằng: ${unitCode}`}
            readOnly={isReadOnly}
          />
        </div>
      </div>

      {/* Quản lý danh sách Vùng Z & Form nhập liệu chi tiết */}
      <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col gap-3.5">
        {/* Tabs chuyển đổi giữa các Vùng Z */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-2 border-b border-slate-100">
          {zones.map((z, idx) => (
            <button
              key={z.id}
              type="button"
              onClick={() => setActiveZoneIndex(idx)}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all flex items-center gap-1.5 cursor-pointer ${
                activeZoneIndex === idx
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
              }`}
            >
              <span>{z.zoneCode}</span>
              <span className="opacity-80 text-[10px]">({z.roomName})</span>
              {Array.isArray(z.defects) && z.defects.length > 0 && (
                <span className="px-1.5 py-0.2 rounded-full bg-red-500 text-white text-[9px] font-mono">
                  {z.defects.length}D
                </span>
              )}
            </button>
          ))}

          {!isReadOnly && (
            <button
              type="button"
              onClick={onAddZone}
              className="px-3 py-1.5 rounded-xl border border-dashed border-emerald-400 text-emerald-700 hover:bg-emerald-50 text-xs font-bold flex items-center gap-1 shrink-0 cursor-pointer"
            >
              <Plus size={13} />
              <span>Thêm Vùng Z</span>
            </button>
          )}
        </div>

        {/* Chi tiết Vùng Z đang chọn */}
        {activeZone && (
          <div className="flex flex-col gap-4 pt-1">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 text-xs font-mono font-bold">
                  {activeZone.zoneCode}
                </span>
                <h4 className="text-xs sm:text-sm font-bold text-slate-800">
                  Vật Liệu & Ảnh Hiện Trạng Vùng {activeZone.zoneCode}
                </h4>
              </div>

              {!isReadOnly && zones.length > 1 && (
                <button
                  type="button"
                  onClick={() => onDeleteZone(activeZoneIndex)}
                  className="text-red-500 hover:text-red-700 text-xs flex items-center gap-1 cursor-pointer"
                >
                  <Trash2 size={13} />
                  <span>Xóa</span>
                </button>
              )}
            </div>

            {/* Thông số vị trí, cấu kiện, vật liệu */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-slate-700">Tên vị trí:</label>
                <select
                  value={activeZone.roomName}
                  onChange={(e) => onUpdateActiveZone({ roomName: e.target.value })}
                  className="px-3 py-2 rounded-xl bg-slate-50 border border-slate-300 text-xs text-slate-800 focus:bg-white"
                  disabled={isReadOnly}
                >
                  {COMMON_ROOM_NAMES.map((name) => (
                    <option key={name} value={name}>
                      {name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-slate-700">Loại cấu kiện:</label>
                <select
                  value={activeZone.componentType}
                  onChange={(e) => onUpdateActiveZone({ componentType: e.target.value })}
                  className="px-3 py-2 rounded-xl bg-slate-50 border border-slate-300 text-xs text-slate-800 focus:bg-white"
                  disabled={isReadOnly}
                >
                  {ARCH_COMPONENT_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex flex-col gap-1">
                <label className="text-xs font-semibold text-slate-700">Vật liệu hoàn thiện:</label>
                <select
                  value={activeZone.wallMaterial}
                  onChange={(e) => onUpdateActiveZone({ wallMaterial: e.target.value })}
                  className="px-3 py-2 rounded-xl bg-slate-50 border border-slate-300 text-xs text-slate-800 focus:bg-white"
                  disabled={isReadOnly}
                >
                  {WALL_MATERIALS.map((m) => (
                    <option key={m} value={m}>
                      {m}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Nút đồng bộ vật liệu */}
            {!isReadOnly && zones.length > 1 && (
              <div className="flex justify-end">
                <button
                  type="button"
                  onClick={onSyncMaterialsToEntireArea}
                  className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-bold text-xs flex items-center gap-1.5 transition-all shadow-xs cursor-pointer"
                  title="Áp dụng cấu kiện và vật liệu hiện tại cho tất cả các vùng Z còn lại"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Áp dụng vật liệu cho các vùng Z còn lại</span>
                </button>
              </div>
            )}

            {/* =============================================================== */}
            {/* WORKFLOW QUAN TRỌNG: ẢNH CHỤP HIỆN TRẠNG TỔNG QUAN VÙNG Z */}
            {/* =============================================================== */}
            <div className="pt-2 border-t border-slate-100 flex flex-col gap-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <Camera className="w-4 h-4 text-emerald-600" />
                  <span className="text-xs font-bold text-slate-800">
                    Ảnh chụp thực tế Vùng {activeZone.zoneCode} ({currentZonePhotos.length} ảnh)
                  </span>
                </div>
                <span className="text-[11px] text-slate-500 hidden sm:inline">
                  Chụp mảng tường / trần làm nền để chấm khuyết tật
                </span>
              </div>

              {/* Lưới ảnh tổng quan vùng Z (Tự động phân giải blob:local:// an toàn qua TapToZoomThumbnail) */}
              {currentZonePhotos.length > 0 && (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  {currentZonePhotos.map((photoUrl, zpIdx) => (
                    <div key={zpIdx} className="relative rounded-xl overflow-hidden border border-slate-200 bg-slate-100 shadow-xs">
                      <TapToZoomThumbnail
                        src={photoUrl}
                        label={`${activeZone.zoneCode} #${zpIdx + 1}`}
                        photoCode={`${activeZone.zoneCode}_OVERVIEW_${zpIdx + 1}`}
                        alt={`Ảnh thực tế ${activeZone.zoneCode} #${zpIdx + 1}`}
                        aspectClass="aspect-4/3"
                        actions={
                          !isReadOnly ? (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                onRemoveZoneOverviewPhoto(activeZoneIndex, zpIdx);
                              }}
                              className="p-1.5 bg-red-600/90 hover:bg-red-700 text-white rounded-lg shadow-xs cursor-pointer transition-colors"
                              title="Xóa ảnh này"
                            >
                              <Trash2 size={13} />
                            </button>
                          ) : null
                        }
                      />
                    </div>
                  ))}
                </div>
              )}

              {/* Ô chụp ảnh cho Vùng Z */}
              {!isReadOnly && (
                <div className="rounded-xl border border-dashed border-emerald-200 bg-emerald-50/30 p-2.5">
                  <PhotoCaptureInput
                    label={`Chụp ảnh mảng tường thực tế của Vùng ${activeZone.zoneCode}`}
                    value=""
                    onChange={(url, photoCode) =>
                      onUpdateOrAddZoneOverviewPhoto(activeZoneIndex, url, photoCode)
                    }
                    watermarkOptions={watermarkOptions}
                    photoCode={`${activeZone.zoneCode}_OVERVIEW_${currentZonePhotos.length + 1}`}
                    height="130px"
                  />
                </div>
              )}
            </div>

            {/* =============================================================== */}
            {/* WORKFLOW QUAN TRỌNG: CHẤM KHUYẾT TẬT D TRÊN ẢNH THỰC TẾ */}
            {/* =============================================================== */}
            <div className="pt-2 border-t border-slate-100 flex flex-col gap-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <AlertTriangle className="w-4 h-4 text-amber-500" />
                  <span className="text-xs font-bold text-slate-800">
                    Khuyết Tật Của {activeZone.zoneCode} ({currentZoneDefects.length} khuyết tật)
                  </span>
                </div>

                {!isReadOnly && (
                  <button
                    type="button"
                    onClick={() => {
                      if (currentZonePhotos.length === 0) {
                        const proceed = window.confirm(
                          `Bạn chưa chụp ảnh thực tế cho Vùng ${activeZone.zoneCode}.\n` +
                            `Khuyến nghị chụp ảnh mảng tường trước để chấm khuyết tật chính xác nhất.\n\n` +
                            `Bạn có muốn tiếp tục mở giao diện ghim khuyết tật không?`
                        );
                        if (!proceed) return;
                      }
                      onTriggerPinningZone(activeZone.id);
                    }}
                    className="px-3.5 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-xs cursor-pointer transition-all"
                  >
                    <PenTool size={13} />
                    <span>Ghim Khuyết Tật (D) Trên Ảnh</span>
                  </button>
                )}
              </div>

              {/* Danh sách khuyết tật đã ghim */}
              {currentZoneDefects.length > 0 ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {currentZoneDefects.map((def, dIdx) => (
                    <div
                      key={def.id || dIdx}
                      className="p-3 rounded-xl border border-slate-200 bg-slate-50 flex items-start justify-between gap-2.5 text-xs shadow-2xs"
                    >
                      <div className="flex flex-col gap-0.5 min-w-0">
                        <div className="flex items-center gap-1.5 font-bold text-slate-900">
                          <span className="px-1.5 py-0.2 rounded bg-indigo-100 text-indigo-700 text-[10px] font-mono">
                            D{dIdx + 1}
                          </span>
                          <span className="truncate">{def.defectType || 'Vết nứt / Bong tróc'}</span>
                        </div>
                        <span className="text-[11px] text-slate-500 line-clamp-1">
                          {def.notes || 'Không có ghi chú'}
                        </span>
                        {(def.widthMaxMm || def.lengthMm) && (
                          <span className="text-[10px] font-mono text-slate-600">
                            Kích thước: {def.widthMaxMm ? `W=${def.widthMaxMm}mm` : ''}{' '}
                            {def.lengthMm ? `L=${def.lengthMm}mm` : ''}
                          </span>
                        )}
                      </div>

                      {typeof def.burlandGrade === 'number' && (
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold shrink-0 ${
                            def.burlandGrade === 0
                              ? 'bg-emerald-100 text-emerald-800'
                              : def.burlandGrade <= 2
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-red-100 text-red-800'
                          }`}
                        >
                          Cấp {def.burlandGrade}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-3 bg-slate-50 rounded-xl border border-dashed border-slate-200 text-center text-slate-400 text-xs">
                  Vùng này chưa phát hiện khuyết tật nào. Bấm "Ghim Khuyết Tật (D) Trên Ảnh" nếu có nứt/bong tróc.
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Điều hướng Bước 3 */}
      <div className="flex items-center justify-between pt-1">
        <button
          type="button"
          onClick={onBack}
          className="px-4 py-2.5 rounded-xl border border-slate-300 text-xs font-bold text-slate-700 hover:bg-slate-100 flex items-center gap-1.5 cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Quay lại Bước 2</span>
        </button>

        <button
          type="button"
          onClick={onNext}
          className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs sm:text-sm flex items-center gap-2 shadow-md cursor-pointer transition-all"
        >
          <span>Sang Bước 4: Cấu Kiện Kết Cấu E</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
