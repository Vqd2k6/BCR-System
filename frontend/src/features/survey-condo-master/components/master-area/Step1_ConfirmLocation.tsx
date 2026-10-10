import React from 'react';
import { MapPin, ArrowRight, Loader2, AlertTriangle } from 'lucide-react';
import { useInteractiveCanvasZoom } from '../../../../components/canvas/useInteractiveCanvasZoom';
import { CanvasZoomToolbar } from '../../../../components/canvas/CanvasZoomToolbar';
import { formatShortUnitDisplay } from '../../../../core/utils/codeFormattingUtils';
import { type FloorPlanResponse, type NormalizedBbox, normalizeBbox } from '../../types/masterAreaSurvey.types';

interface Step1ConfirmLocationProps {
  floorPlanData: FloorPlanResponse | null;
  isLoadingCad: boolean;
  floorName: string;
  unitId: string;
  unitCode: string;
  activeBbox: NormalizedBbox | null;
  onConfirmNext: () => void;
}

export const Step1_ConfirmLocation: React.FC<Step1ConfirmLocationProps> = ({
  floorPlanData,
  isLoadingCad,
  floorName,
  unitId,
  unitCode,
  activeBbox,
  onConfirmNext,
}) => {
  const {
    zoomScale,
    handleZoomIn,
    handleZoomOut,
    handleResetZoom,
    handleSetZoomPreset,
    containerRef,
    tightBoxRef,
    transformStyle,
    handleWheel,
    handleTouchStart,
    handleTouchMove,
    handleTouchEnd,
    startPan,
    updatePan,
    endPan,
  } = useInteractiveCanvasZoom({ minZoom: 0.5, maxZoom: 4.0, initialZoom: 1.0 });

  return (
    <div className="flex flex-col gap-3.5 animate-in fade-in duration-200">
      {/* Tiêu đề ngắn gọn cho KSV */}
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-2">
          <span className="px-2 py-0.5 rounded-md bg-amber-500 text-white font-bold text-xs">
            BƯỚC 1
          </span>
          <h3 className="text-sm sm:text-base font-bold text-slate-800">
            Vị trí khu vực trên sơ đồ {floorName}
          </h3>
        </div>
        {activeBbox && (
          <span className="text-[11px] font-mono text-slate-600 bg-white border border-slate-200 px-2 py-0.5 rounded-md hidden sm:inline shadow-2xs">
            Toạ độ: [{activeBbox.x}%, {activeBbox.y}%, {activeBbox.width}%, {activeBbox.height}%]
          </span>
        )}
      </div>

      {/* Sơ đồ CAD Tầng Mẹ có Zoom/Pan (Light Theme, hiển thị 100% diện tích không co hẹp) */}
      <div className="relative bg-slate-100 rounded-2xl border border-slate-300 overflow-hidden flex items-center justify-center min-h-[340px] sm:min-h-[460px] shadow-xs">
        {isLoadingCad ? (
          <div className="flex flex-col items-center justify-center gap-2 text-slate-500 py-16">
            <Loader2 className="w-8 h-8 animate-spin text-indigo-600" />
            <span className="text-xs font-medium">Đang tải bản vẽ mặt bằng {floorName}...</span>
          </div>
        ) : !floorPlanData?.plan?.cad_photo_url ? (
          <div className="text-center p-12 text-slate-500">
            <AlertTriangle className="w-8 h-8 text-amber-500 mx-auto mb-2" />
            <p className="text-xs">Tầng này chưa có bản vẽ CAD mặt bằng.</p>
          </div>
        ) : (
          <div
            ref={containerRef}
            onWheel={handleWheel}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            onMouseDown={(e) => startPan(e.clientX, e.clientY)}
            onMouseMove={(e) => updatePan(e.clientX, e.clientY)}
            onMouseUp={endPan}
            onMouseLeave={endPan}
            className="w-full h-full flex items-center justify-center p-3 sm:p-5 cursor-grab active:cursor-grabbing overflow-hidden"
          >
            <div ref={tightBoxRef} style={transformStyle} className="relative inline-block select-none bg-white p-1 rounded-xl border border-slate-200 shadow-md">
              <img
                src={floorPlanData.plan.cad_photo_url}
                alt="CAD Tầng"
                className="block max-w-full max-h-[65vh] object-contain rounded-lg pointer-events-none"
                draggable={false}
              />

              {/* Các zone khác trên tầng (dim 30%) */}
              {floorPlanData.units &&
                floorPlanData.units.map((part) => {
                  const partBbox = normalizeBbox(part.cad_bbox);
                  if (!partBbox) return null;
                  const isActive = part.id === unitId || part.unit_code === unitCode;
                  if (isActive) return null;
                  return (
                    <div
                      key={part.id}
                      style={{
                        left: `${partBbox.x}%`,
                        top: `${partBbox.y}%`,
                        width: `${partBbox.width}%`,
                        height: `${partBbox.height}%`,
                      }}
                      className="absolute rounded border border-dashed border-slate-400 bg-slate-500/10 opacity-40 pointer-events-none flex items-center justify-center"
                    >
                      <span className="text-[9px] font-mono text-slate-600 font-semibold px-1 rounded bg-white/80 shadow-2xs">
                        {formatShortUnitDisplay(part.unit_code)}
                      </span>
                    </div>
                  );
                })}

              {/* VÙNG MASTER ĐANG KHẢO SÁT (HIGHLIGHT NỔI BẬT) */}
              {activeBbox && (
                <div
                  style={{
                    left: `${activeBbox.x}%`,
                    top: `${activeBbox.y}%`,
                    width: `${activeBbox.width}%`,
                    height: `${activeBbox.height}%`,
                  }}
                  className="absolute rounded-lg border-3 border-amber-500 bg-amber-400/35 ring-4 ring-amber-400/40 shadow-xl pointer-events-none flex flex-col justify-between p-1.5"
                >
                  <div className="self-start px-2 py-0.5 bg-amber-500 text-white rounded-md text-[11px] font-bold shadow-md flex items-center gap-1">
                    <MapPin size={11} />
                    <span>{unitCode}</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Thanh công cụ Zoom góc dưới trái */}
        {floorPlanData?.plan?.cad_photo_url && (
          <div className="absolute bottom-3 left-3 z-10">
            <CanvasZoomToolbar
              zoomScale={zoomScale}
              onZoomIn={handleZoomIn}
              onZoomOut={handleZoomOut}
              onResetZoom={handleResetZoom}
              onSelectPreset={handleSetZoomPreset}
            />
          </div>
        )}
      </div>

      {/* Nút xác nhận chuyển sang Bước 2 */}
      <div className="flex justify-end pt-1">
        <button
          type="button"
          onClick={onConfirmNext}
          className="w-full sm:w-auto px-6 py-3 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-md cursor-pointer transition-all active:scale-[0.98]"
        >
          <span>Tôi đang đứng ở đây — Sang Bước 2</span>
          <ArrowRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
