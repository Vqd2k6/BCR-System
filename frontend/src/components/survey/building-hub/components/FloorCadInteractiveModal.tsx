import React, { useState } from 'react';
import {
  X,
  Building2,
  Home,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Play,
  ShieldCheck,
  ExternalLink,
} from 'lucide-react';
import type { GisParcel } from '../../../gis/LeafletSweepMap';
import type { BuildingUnit } from '../types';
import type { FloorGroupData } from '../hooks/useBuildingHubState';
import { formatShortUnitDisplay } from '../../../../core/utils/codeFormattingUtils';
import { useInteractiveCanvasZoom } from '../../../canvas/useInteractiveCanvasZoom';
import { CanvasZoomToolbar } from '../../../canvas/CanvasZoomToolbar';

interface FloorCadInteractiveModalProps {
  floor: FloorGroupData;
  parcel: GisParcel;
  selectedUnitId?: string | null;
  onClose: () => void;
  onSelectUnit: (unit: BuildingUnit) => void;
  onStartUnitSurvey: (parcel: GisParcel, unit: BuildingUnit, phase?: 1 | 2) => void;
  onStartMasterAreaSurvey?: (parcel: GisParcel, unit: BuildingUnit) => void;
}

function normalizeBbox(
  raw?: [number, number, number, number] | { x: number; y: number; width: number; height: number } | null
): { left: number; top: number; width: number; height: number } | null {
  if (!raw) return null;
  if (Array.isArray(raw)) {
    const [x1, y1, x2, y2] = raw;
    return {
      left: Math.min(x1, x2),
      top: Math.min(y1, y2),
      width: Math.abs(x2 - x1),
      height: Math.abs(y2 - y1),
    };
  }
  return {
    left: raw.x,
    top: raw.y,
    width: raw.width,
    height: raw.height,
  };
}

export const FloorCadInteractiveModal: React.FC<FloorCadInteractiveModalProps> = ({
  floor,
  parcel,
  selectedUnitId,
  onClose,
  onSelectUnit,
  onStartUnitSurvey,
  onStartMasterAreaSurvey,
}) => {
  const [activeUnit, setActiveUnit] = useState<BuildingUnit | null>(() => {
    if (selectedUnitId) {
      return floor.units.find((u) => u.id === selectedUnitId) || null;
    }
    return null;
  });

  const {
    zoomScale,
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
    handleZoomIn,
    handleZoomOut,
    handleResetZoom,
    handleSetZoomPreset,
  } = useInteractiveCanvasZoom({ minZoom: 1.0, maxZoom: 5.0, initialZoom: 1.0 });

  const renderStatusPill = (status?: string, phase2Id?: string | null) => {
    if (status === 'APPROVED' || Boolean(phase2Id)) {
      return (
        <span className="px-1.5 py-0.5 rounded text-[10px] font-extrabold bg-emerald-600 text-white shadow-2xs flex items-center gap-0.5">
          <CheckCircle2 size={11} />
          <span>Duyệt</span>
        </span>
      );
    }
    if (status === 'SUBMITTED') {
      return (
        <span className="px-1.5 py-0.5 rounded text-[10px] font-extrabold bg-sky-600 text-white shadow-2xs flex items-center gap-0.5">
          <Clock size={11} />
          <span>Nộp</span>
        </span>
      );
    }
    if (status === 'IN_PROGRESS') {
      return (
        <span className="px-1.5 py-0.5 rounded text-[10px] font-extrabold bg-amber-500 text-white shadow-2xs flex items-center gap-0.5">
          <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
          <span>Dở</span>
        </span>
      );
    }
    if (status === 'POSTPONED_ABSENT') {
      return (
        <span className="px-1.5 py-0.5 rounded text-[10px] font-extrabold bg-purple-600 text-white shadow-2xs flex items-center gap-0.5">
          <AlertTriangle size={11} />
          <span>Vắng</span>
        </span>
      );
    }
    return (
      <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-slate-700/80 text-slate-200 shadow-2xs">
        Chưa KS
      </span>
    );
  };

  const handleUnitClick = (unit: BuildingUnit, e: React.MouseEvent) => {
    e.stopPropagation();
    setActiveUnit(unit);
    onSelectUnit(unit);
  };

  const handleStartSurvey = () => {
    if (!activeUnit) return;
    const isMaster = (activeUnit.unit_type || activeUnit.unitType) === 'MASTER';
    const isApproved = activeUnit.status === 'APPROVED' || Boolean(activeUnit.phase2_report_id);

    if (isMaster) {
      if (onStartMasterAreaSurvey) {
        onStartMasterAreaSurvey(parcel, activeUnit);
      }
    } else {
      const phase = isApproved ? 2 : 1;
      onStartUnitSurvey(parcel, activeUnit, phase);
    }
    onClose();
  };

  const isMaster = activeUnit ? (activeUnit.unit_type || activeUnit.unitType) === 'MASTER' : false;
  const isApproved = activeUnit ? activeUnit.status === 'APPROVED' || Boolean(activeUnit.phase2_report_id) : false;
  const isSubmitted = activeUnit?.status === 'SUBMITTED';

  return (
    <div className="fixed inset-0 z-[100000] bg-slate-900/95 backdrop-blur-md flex flex-col w-full h-full select-none animate-in fade-in duration-200">
      {/* Top Header Bar */}
      <div className="px-4 py-3 bg-slate-800/90 border-b border-slate-700 flex items-center justify-between text-white shrink-0">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-teal-500/20 text-teal-300 font-mono font-bold text-xs flex items-center justify-center border border-teal-500/30">
            {floor.floorCode || floor.floorNumber}
          </div>
          <div className="min-w-0">
            <h3 className="text-sm sm:text-base font-bold truncate">
              Bản Vẽ {floor.floorName || floor.floorLabel}
            </h3>
            <p className="text-[11px] text-slate-400 truncate">
              Chụm 2 ngón tay hoặc con lăn chuột để phóng to/thu nhỏ • Chạm ô để khảo sát
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="w-10 h-10 rounded-xl bg-slate-700/80 hover:bg-slate-700 text-slate-300 hover:text-white flex items-center justify-center transition-colors cursor-pointer shrink-0"
          title="Đóng bản vẽ CAD"
        >
          <X size={20} />
        </button>
      </div>

      {/* Main Touch Canvas Area */}
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
        className="flex-1 relative overflow-hidden flex items-center justify-center cursor-grab active:cursor-grabbing bg-slate-950/60"
      >
        <div
          ref={tightBoxRef}
          style={transformStyle}
          className="relative inline-block max-w-full max-h-full transition-transform duration-75 origin-center"
        >
          {/* Ảnh CAD Mặt Bằng */}
          <img
            src={floor.cadUrl}
            alt={`Mặt bằng ${floor.floorName || floor.floorLabel}`}
            draggable={false}
            className="block max-w-[92vw] max-h-[75vh] object-contain rounded-lg bg-white shadow-2xl border border-slate-700 select-none pointer-events-none"
          />

          {/* Lớp các ô phân chia vị trí có thể chạm */}
          {floor.units.map((unit) => {
            const rawBbox = unit.cad_bbox || unit.cadBbox;
            const bbox = normalizeBbox(rawBbox);
            if (!bbox) return null;

            const unitIsMaster = (unit.unit_type || unit.unitType) === 'MASTER';
            const isSelected = activeUnit?.id === unit.id;
            const shortCode = formatShortUnitDisplay(unit.unit_code, unitIsMaster ? 'MASTER' : 'UNIT');

            return (
              <div
                key={unit.id}
                onClick={(e) => handleUnitClick(unit, e)}
                style={{
                  position: 'absolute',
                  left: `${bbox.left}%`,
                  top: `${bbox.top}%`,
                  width: `${bbox.width}%`,
                  height: `${bbox.height}%`,
                }}
                className={`rounded border-2 cursor-pointer flex flex-col justify-between p-1 transition-all overflow-hidden ${
                  isSelected
                    ? 'ring-4 ring-amber-400 border-amber-500 bg-amber-400/40 z-30 shadow-2xl scale-[1.02]'
                    : unitIsMaster
                    ? 'border-indigo-500 bg-indigo-500/25 hover:bg-indigo-500/40 text-indigo-100 z-10'
                    : 'border-teal-400 bg-teal-500/20 hover:bg-teal-500/35 text-white z-10'
                }`}
                title={`Chạm để chọn: ${unitIsMaster ? 'Khu' : 'Căn'} ${shortCode}`}
              >
                <div className="flex items-center justify-between gap-1 max-w-full overflow-hidden">
                  <span
                    className={`px-1.5 py-0.5 rounded font-mono font-black text-[10px] sm:text-xs shadow-sm flex items-center gap-1 max-w-full truncate ${
                      isSelected
                        ? 'bg-amber-500 text-white'
                        : unitIsMaster
                        ? 'bg-indigo-900 text-white'
                        : 'bg-white text-slate-900 border border-teal-600'
                    }`}
                  >
                    {unitIsMaster ? <Building2 size={11} className="shrink-0" /> : <Home size={11} className="shrink-0" />}
                    <span className="truncate">{shortCode}</span>
                  </span>

                  {renderStatusPill(unit.status, unit.phase2_report_id)}
                </div>
              </div>
            );
          })}
        </div>

        {/* Floating Zoom Toolbar */}
        <div className="absolute bottom-5 right-4 z-40">
          <CanvasZoomToolbar
            zoomScale={zoomScale}
            onZoomIn={handleZoomIn}
            onZoomOut={handleZoomOut}
            onResetZoom={handleResetZoom}
            onSelectPreset={handleSetZoomPreset}
          />
        </div>
      </div>

      {/* Bottom Floating Action Card when Unit Selected */}
      {activeUnit && (
        <div className="p-3.5 bg-slate-900 border-t border-slate-800 flex items-center justify-between gap-3 text-white shrink-0 animate-in slide-in-from-bottom-2 duration-150">
          <div className="flex items-center gap-2.5 min-w-0">
            <div
              className={`w-9 h-9 rounded-xl flex items-center justify-center font-bold text-white shrink-0 ${
                isMaster ? 'bg-indigo-600' : 'bg-teal-600'
              }`}
            >
              {isMaster ? <Building2 size={18} /> : <Home size={18} />}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-sm sm:text-base truncate">
                  {isMaster ? `Khu ${activeUnit.unit_code}` : `Căn ${formatShortUnitDisplay(activeUnit.unit_code, 'UNIT')}`}
                </span>
                {renderStatusPill(activeUnit.status, activeUnit.phase2_report_id)}
              </div>
              <p className="text-[11px] text-slate-400 truncate">
                {activeUnit.owner_name ? `Chủ hộ: ${activeUnit.owner_name}` : 'Chưa cập nhật chủ hộ'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={handleStartSurvey}
              className={`px-4 py-2.5 rounded-xl font-bold text-xs sm:text-sm text-white shadow-md flex items-center gap-1.5 transition-all cursor-pointer active:scale-95 ${
                isMaster
                  ? 'bg-indigo-600 hover:bg-indigo-700'
                  : isApproved
                  ? 'bg-blue-600 hover:bg-blue-700'
                  : 'bg-teal-600 hover:bg-teal-700'
              }`}
            >
              {isMaster ? (
                <>
                  <Building2 size={15} />
                  <span>Khảo Sát Khu Này</span>
                </>
              ) : isApproved ? (
                <>
                  <ShieldCheck size={15} />
                  <span>Phase 2</span>
                </>
              ) : isSubmitted ? (
                <>
                  <ExternalLink size={15} />
                  <span>Xem Hồ Sơ</span>
                </>
              ) : (
                <>
                  <Play size={15} className="fill-current" />
                  <span>Khảo Sát Căn Hộ</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
