import React from 'react';
import {
  ShieldAlert,
  PenTool,
  Plus,
  Trash2,
  AlertTriangle,
  RefreshCw,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  Camera,
  ZoomIn,
} from 'lucide-react';
import { FloorCadPinningCanvas, type CadZonePin } from '../../../../components/canvas/FloorCadPinningCanvas';
import { PhotoCaptureInput } from '../../../../components/common/PhotoCaptureInput';
import { TapToZoomThumbnail } from '../../../../components/common/TapToZoomThumbnail';
import type { StructuralElementData } from '../../../survey-phase1/types/phase1.types';
import type { MetroWatermarkOptions } from '../../../../utils/watermarkEngine';
import {
  STRUCTURAL_ELEMENT_TYPES,
  STRUCTURAL_MATERIALS,
} from '../../types/masterAreaSurvey.types';

interface Step4StructuralElementsAndDefectsProps {
  unitCode: string;
  floorName: string;
  floorNumber: number;
  hasStructuralElements: boolean;
  setHasStructuralElements: (has: boolean) => void;
  noStructuralElementsReason: string;
  setNoStructuralElementsReason: (reason: string) => void;
  cadSketchPhotoUrl: string;
  cadStructuralSketchPhotoUrl: string;
  onCadStructuralSketchPhotoUrlChange: (url: string) => void;
  cadElementPins: CadZonePin[];
  setCadElementPins: React.Dispatch<React.SetStateAction<CadZonePin[]>>;
  structuralElements: StructuralElementData[];
  setStructuralElements: React.Dispatch<React.SetStateAction<StructuralElementData[]>>;
  activeElementIndex: number;
  setActiveElementIndex: (index: number) => void;
  activeElement: StructuralElementData;
  onUpdateActiveElement: (updater: Partial<StructuralElementData>) => void;
  onAddElement: () => void;
  onDeleteElement: (index: number) => void;
  onDeleteElementByCode: (elementCode: string) => void;
  onSelectElementByCode: (elementCode: string) => void;
  onSyncElementsToEntireArea: () => void;
  onUpdateOrAddElementOverviewPhoto: (elemIndex: number, url: string, photoCode?: string) => void;
  onRemoveElementOverviewPhoto: (elemIndex: number, photoIndex: number) => void;
  onTriggerPinningElement: (elementId: string) => void;
  watermarkOptions?: MetroWatermarkOptions;
  isReadOnly?: boolean;
  onBack: () => void;
  onNext: () => void;
  onPreviewImage: (url: string) => void;
}

export const Step4_StructuralElementsAndDefects: React.FC<Step4StructuralElementsAndDefectsProps> = ({
  unitCode,
  floorName,
  floorNumber,
  hasStructuralElements,
  setHasStructuralElements,
  noStructuralElementsReason,
  setNoStructuralElementsReason,
  cadSketchPhotoUrl,
  cadStructuralSketchPhotoUrl,
  onCadStructuralSketchPhotoUrlChange,
  cadElementPins,
  setCadElementPins,
  structuralElements,
  setStructuralElements,
  activeElementIndex,
  setActiveElementIndex,
  activeElement,
  onUpdateActiveElement,
  onAddElement,
  onDeleteElement,
  onDeleteElementByCode,
  onSelectElementByCode,
  onSyncElementsToEntireArea,
  onUpdateOrAddElementOverviewPhoto,
  onRemoveElementOverviewPhoto,
  onTriggerPinningElement,
  watermarkOptions,
  isReadOnly,
  onBack,
  onNext,
  onPreviewImage,
}) => {
  const activeCadUrl = cadStructuralSketchPhotoUrl || cadSketchPhotoUrl;
  const currentElementPhotos = activeElement?.overviewPhotos || [];
  const currentElementDefects = activeElement?.defects || [];

  return (
    <div className="flex flex-col gap-4 animate-in fade-in duration-200">
      {/* Tiêu đề & Lựa chọn Có/Không khảo sát kết cấu */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 px-1">
        <div className="flex items-center gap-2">
          <span className="px-2 py-0.5 rounded-md bg-amber-600 text-white font-bold text-xs">
            BƯỚC 4
          </span>
          <h3 className="text-sm sm:text-base font-bold text-slate-800">
            Cấu kiện kết cấu chịu lực (E) & Khuyết tật (D)
          </h3>
        </div>

        {/* Lựa chọn Có / Không */}
        <div className="flex items-center gap-3 bg-white px-3 py-1.5 rounded-xl border border-slate-200 text-xs font-semibold text-slate-800 shrink-0">
          <label className="flex items-center gap-1.5 cursor-pointer">
            <input
              type="radio"
              name="hasStructural"
              checked={hasStructuralElements}
              onChange={() => setHasStructuralElements(true)}
              disabled={isReadOnly}
            />
            <span>Có cấu kiện kết cấu</span>
          </label>
          <label className="flex items-center gap-1.5 cursor-pointer">
            <input
              type="radio"
              name="hasStructural"
              checked={!hasStructuralElements}
              onChange={() => setHasStructuralElements(false)}
              disabled={isReadOnly}
            />
            <span>Không có</span>
          </label>
        </div>
      </div>

      {!hasStructuralElements ? (
        /* Trường hợp không khảo sát kết cấu */
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-xs flex flex-col gap-3">
          <div className="flex items-center gap-2 text-amber-700">
            <ShieldAlert className="w-5 h-5" />
            <h4 className="text-sm font-bold">Lý do không khảo sát cấu kiện kết cấu:</h4>
          </div>
          <textarea
            value={noStructuralElementsReason}
            onChange={(e) => setNoStructuralElementsReason(e.target.value)}
            placeholder="Ví dụ: Khu vực không lộ cột/dầm chịu lực do trần thạch cao che kín hoặc không phát hiện cấu kiện chịu lực lộ thiên..."
            rows={3}
            className="w-full p-3 rounded-xl border border-slate-300 text-xs text-slate-800 bg-slate-50 focus:bg-white"
            disabled={isReadOnly}
          />
        </div>
      ) : (
        <>
          {/* Bản vẽ CAD Element Pinning (Light Theme, không bọc max-h cưỡng bức) */}
          <div className="bg-slate-100 rounded-2xl border border-slate-300 p-2 sm:p-3 flex flex-col gap-2 shadow-xs">
            <div className="flex items-center justify-between px-1">
              <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                <PenTool size={13} className="text-amber-600" />
                Định vị Cấu kiện E trên sơ đồ (E1, E2...):
              </span>
              <span className="text-[11px] text-slate-500 hidden sm:inline">
                Chạm vào sơ đồ để ghim vị trí cột / dầm
              </span>
            </div>

            <div className="w-full rounded-xl overflow-hidden bg-white border border-slate-200">
              <FloorCadPinningCanvas
                cadPhotoUrl={activeCadUrl}
                onCadPhotoChange={onCadStructuralSketchPhotoUrlChange}
                pins={cadElementPins}
                onChangePins={setCadElementPins}
                onDeletePin={(pin) => {
                  if (pin.zoneCode) {
                    onDeleteElementByCode(pin.zoneCode);
                  }
                }}
                onSelectPin={(pin) => {
                  if (pin.zoneCode) {
                    onSelectElementByCode(pin.zoneCode);
                  }
                }}
                onAutoCreatePin={(pin: CadZonePin) => {
                  // Canvas đã cập nhật pins qua onChangePins. Chỉ tự động thêm cấu kiện mới nếu chưa có
                  if (!structuralElements.some((e) => e.elementCode === pin.zoneCode)) {
                    setStructuralElements((prev) => [
                      ...prev,
                      {
                        id: `elem_${Date.now()}_${pin.zoneCode}`,
                        elementCode: pin.zoneCode,
                        floorName: `Tầng ${floorNumber}`,
                        roomName: 'Khu vực chính',
                        elementType: pin.label || STRUCTURAL_ELEMENT_TYPES[0] || 'Cột BTCT',
                        materialType: STRUCTURAL_MATERIALS[0] || 'BTCT',
                        overviewPhotos: [],
                        notes: '',
                        defects: [],
                      },
                    ]);
                  }
                }}
                mode="STRUCTURAL"
                floorName={floorName}
                cadTitle={`Kết cấu: ${unitCode}`}
                readOnly={isReadOnly}
              />
            </div>
          </div>

          {/* Quản lý danh sách Cấu kiện E & Form nhập liệu chi tiết */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-xs flex flex-col gap-3.5">
            {/* Tabs chuyển đổi giữa các Cấu kiện E */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-2 border-b border-slate-100">
              {structuralElements.map((e, idx) => (
                <button
                  key={e.id}
                  type="button"
                  onClick={() => setActiveElementIndex(idx)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all flex items-center gap-1.5 cursor-pointer ${
                    activeElementIndex === idx
                      ? 'bg-amber-600 text-white shadow-xs'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  <span>{e.elementCode}</span>
                  <span className="opacity-80 text-[10px]">({e.elementType})</span>
                  {Array.isArray(e.defects) && e.defects.length > 0 && (
                    <span className="px-1.5 py-0.2 rounded-full bg-red-500 text-white text-[9px] font-mono">
                      {e.defects.length}D
                    </span>
                  )}
                </button>
              ))}

              {!isReadOnly && (
                <button
                  type="button"
                  onClick={onAddElement}
                  className="px-3 py-1.5 rounded-xl border border-dashed border-amber-400 text-amber-700 hover:bg-amber-50 text-xs font-bold flex items-center gap-1 shrink-0 cursor-pointer"
                >
                  <Plus size={13} />
                  <span>Thêm Cấu Kiện E</span>
                </button>
              )}
            </div>

            {/* Chi tiết Cấu kiện E đang chọn */}
            {activeElement && (
              <div className="flex flex-col gap-4 pt-1">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded-md bg-amber-100 text-amber-800 text-xs font-mono font-bold">
                      {activeElement.elementCode}
                    </span>
                    <h4 className="text-xs sm:text-sm font-bold text-slate-800">
                      Thông Số & Ảnh Hiện Trạng Cấu Kiện {activeElement.elementCode}
                    </h4>
                  </div>

                  {!isReadOnly && structuralElements.length > 1 && (
                    <button
                      type="button"
                      onClick={() => onDeleteElement(activeElementIndex)}
                      className="text-red-500 hover:text-red-700 text-xs flex items-center gap-1 cursor-pointer"
                    >
                      <Trash2 size={13} />
                      <span>Xóa</span>
                    </button>
                  )}
                </div>

                {/* Thông số loại cấu kiện & vật liệu kết cấu */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-semibold text-slate-700">Loại cấu kiện:</label>
                    <select
                      value={activeElement.elementType}
                      onChange={(e) => onUpdateActiveElement({ elementType: e.target.value })}
                      className="px-3 py-2 rounded-xl bg-slate-50 border border-slate-300 text-xs text-slate-800 focus:bg-white"
                      disabled={isReadOnly}
                    >
                      {STRUCTURAL_ELEMENT_TYPES.map((t) => (
                        <option key={t} value={t}>
                          {t}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-semibold text-slate-700">Vật liệu kết cấu:</label>
                    <select
                      value={activeElement.materialType}
                      onChange={(e) => onUpdateActiveElement({ materialType: e.target.value })}
                      className="px-3 py-2 rounded-xl bg-slate-50 border border-slate-300 text-xs text-slate-800 focus:bg-white"
                      disabled={isReadOnly}
                    >
                      {STRUCTURAL_MATERIALS.map((m) => (
                        <option key={m} value={m}>
                          {m}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Nút đồng bộ cấu kiện */}
                {!isReadOnly && structuralElements.length > 1 && (
                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={onSyncElementsToEntireArea}
                      className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-bold text-xs flex items-center gap-1.5 transition-all shadow-xs cursor-pointer"
                      title="Áp dụng loại và vật liệu của cấu kiện này cho tất cả các cấu kiện E còn lại"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                      <span>Áp dụng thông số cho các cấu kiện E còn lại</span>
                    </button>
                  </div>
                )}

                {/* =============================================================== */}
                {/* WORKFLOW QUAN TRỌNG: ẢNH CHỤP HIỆN TRẠNG TỔNG QUAN CẤU KIỆN E */}
                {/* =============================================================== */}
                <div className="pt-2 border-t border-slate-100 flex flex-col gap-2.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <Camera className="w-4 h-4 text-amber-600" />
                      <span className="text-xs font-bold text-slate-800">
                        Ảnh chụp thực tế Cấu kiện {activeElement.elementCode} ({currentElementPhotos.length} ảnh)
                      </span>
                    </div>
                    <span className="text-[11px] text-slate-500 hidden sm:inline">
                      Chụp cây cột / dầm thực tế làm nền để chấm nứt kết cấu
                    </span>
                  </div>

                  {/* Lưới ảnh tổng quan cấu kiện E (Tự động phân giải blob:local:// an toàn qua TapToZoomThumbnail) */}
                  {currentElementPhotos.length > 0 && (
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                      {currentElementPhotos.map((photoUrl, epIdx) => (
                        <div key={epIdx} className="relative rounded-xl overflow-hidden border border-slate-200 bg-slate-100 shadow-xs">
                          <TapToZoomThumbnail
                            src={photoUrl}
                            label={`${activeElement.elementCode} #${epIdx + 1}`}
                            photoCode={`${activeElement.elementCode}_OVERVIEW_${epIdx + 1}`}
                            alt={`Ảnh thực tế ${activeElement.elementCode} #${epIdx + 1}`}
                            aspectClass="aspect-4/3"
                            actions={
                              !isReadOnly ? (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onRemoveElementOverviewPhoto(activeElementIndex, epIdx);
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

                  {/* Ô chụp ảnh cho Cấu kiện E */}
                  {!isReadOnly && (
                    <div className="rounded-xl border border-dashed border-amber-200 bg-amber-50/30 p-2.5">
                      <PhotoCaptureInput
                        label={`Chụp ảnh thực tế của Cấu kiện ${activeElement.elementCode}`}
                        value=""
                        onChange={(url, photoCode) =>
                          onUpdateOrAddElementOverviewPhoto(activeElementIndex, url, photoCode)
                        }
                        watermarkOptions={watermarkOptions}
                        photoCode={`${activeElement.elementCode}_OVERVIEW_${currentElementPhotos.length + 1}`}
                        height="130px"
                      />
                    </div>
                  )}
                </div>

                {/* =============================================================== */}
                {/* WORKFLOW QUAN TRỌNG: CHẤM KHUYẾT TẬT KẾT CẤU TRÊN ẢNH THỰC TẾ */}
                {/* =============================================================== */}
                <div className="pt-2 border-t border-slate-100 flex flex-col gap-2.5">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <AlertTriangle className="w-4 h-4 text-red-500" />
                      <span className="text-xs font-bold text-slate-800">
                        Khuyết Tật Kết Cấu {activeElement.elementCode} ({currentElementDefects.length} khuyết tật)
                      </span>
                    </div>

                    {!isReadOnly && (
                      <button
                        type="button"
                        onClick={() => {
                          if (currentElementPhotos.length === 0) {
                            const proceed = window.confirm(
                              `Bạn chưa chụp ảnh thực tế cho Cấu kiện ${activeElement.elementCode}.\n` +
                                `Khuyến nghị chụp ảnh cây cột / dầm trước để chấm khuyết tật chính xác nhất.\n\n` +
                                `Bạn có muốn tiếp tục mở giao diện ghim khuyết tật không?`
                            );
                            if (!proceed) return;
                          }
                          onTriggerPinningElement(activeElement.id);
                        }}
                        className="px-3.5 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-bold flex items-center gap-1.5 shadow-xs cursor-pointer transition-all"
                      >
                        <PenTool size={13} />
                        <span>Ghim Khuyết Tật Kết Cấu Trên Ảnh</span>
                      </button>
                    )}
                  </div>

                  {/* Danh sách khuyết tật kết cấu */}
                  {currentElementDefects.length > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      {currentElementDefects.map((def, dIdx) => (
                        <div
                          key={def.id || dIdx}
                          className="p-3 rounded-xl border border-slate-200 bg-slate-50 flex items-start justify-between gap-2.5 text-xs shadow-2xs"
                        >
                          <div className="flex flex-col gap-0.5 min-w-0">
                            <div className="flex items-center gap-1.5 font-bold text-slate-900">
                              <span className="px-1.5 py-0.2 rounded bg-amber-100 text-amber-800 text-[10px] font-mono">
                                D{dIdx + 1}
                              </span>
                              <span className="truncate">{def.defectType || 'Vết nứt bê tông'}</span>
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
                      Cấu kiện này không có khuyết tật kết cấu. Bấm "Ghim Khuyết Tật Kết Cấu Trên Ảnh" nếu phát hiện nứt nẻ / biến dạng.
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {/* Điều hướng Bước 4 */}
      <div className="flex items-center justify-between pt-1">
        <button
          type="button"
          onClick={onBack}
          className="px-4 py-2.5 rounded-xl border border-slate-300 text-xs font-bold text-slate-700 hover:bg-slate-100 flex items-center gap-1.5 cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Quay lại Bước 3</span>
        </button>

        <button
          type="button"
          onClick={onNext}
          className="px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs sm:text-sm flex items-center gap-2 shadow-md cursor-pointer transition-all"
        >
          <span>Sang Bước 5: Tổng Kết & Nộp</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
