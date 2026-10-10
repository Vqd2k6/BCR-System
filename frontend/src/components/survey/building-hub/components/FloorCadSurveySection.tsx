import React from 'react';
import {
  Building2,
  Home,
  CheckCircle2,
  Clock,
  AlertTriangle,
  Upload,
  Maximize2,
  Eye,
  Layers,
} from 'lucide-react';
import type { GisParcel } from '../../../gis/LeafletSweepMap';
import type { BuildingUnit } from '../types';
import type { FloorGroupData } from '../hooks/useBuildingHubState';
import { formatShortUnitDisplay } from '../../../../core/utils/codeFormattingUtils';

interface FloorCadSurveySectionProps {
  floor: FloorGroupData;
  parcel: GisParcel;
  selectedUnitId?: string | null;
  onSelectUnit: (unit: BuildingUnit) => void;
  isAdmin: boolean;
  onOpenCadManagement?: (floorNumber?: number) => void;
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

export const FloorCadSurveySection: React.FC<FloorCadSurveySectionProps> = ({
  floor,
  parcel,
  selectedUnitId,
  onSelectUnit,
  isAdmin,
  onOpenCadManagement,
  onStartUnitSurvey,
  onStartMasterAreaSurvey,
}) => {
  const percentCompleted =
    floor.totalUnits > 0 ? Math.round((floor.completedCount / floor.totalUnits) * 100) : 0;

  const renderStatusPill = (status?: string, phase2Id?: string | null) => {
    if (status === 'APPROVED' || Boolean(phase2Id)) {
      return (
        <span
          title="Đã duyệt Phase 1"
          className="px-1 py-0.5 rounded text-[9px] font-extrabold bg-emerald-600 text-white shrink-0 shadow-2xs flex items-center gap-0.5"
        >
          <CheckCircle2 size={10} />
          <span className="hidden sm:inline">Duyệt</span>
        </span>
      );
    }
    if (status === 'SUBMITTED') {
      return (
        <span
          title="Đã nộp, chờ duyệt"
          className="px-1 py-0.5 rounded text-[9px] font-extrabold bg-sky-600 text-white shrink-0 shadow-2xs flex items-center gap-0.5"
        >
          <Clock size={10} />
          <span className="hidden sm:inline">Nộp</span>
        </span>
      );
    }
    if (status === 'IN_PROGRESS') {
      return (
        <span
          title="Đang làm dở"
          className="px-1 py-0.5 rounded text-[9px] font-extrabold bg-amber-500 text-white shrink-0 shadow-2xs flex items-center gap-0.5"
        >
          <span className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />
          <span className="hidden sm:inline">Dở</span>
        </span>
      );
    }
    if (status === 'POSTPONED_ABSENT') {
      return (
        <span
          title="Vắng mặt"
          className="px-1 py-0.5 rounded text-[9px] font-extrabold bg-purple-600 text-white shrink-0 shadow-2xs flex items-center gap-0.5"
        >
          <AlertTriangle size={10} />
          <span className="hidden sm:inline">Vắng</span>
        </span>
      );
    }
    return (
      <span
        title="Chưa khảo sát"
        className="px-1 py-0.5 rounded text-[9px] font-semibold bg-slate-700/80 text-slate-200 shrink-0 shadow-2xs"
      >
        ⚪
      </span>
    );
  };

  return (
    <div
      id={`floor-section-${floor.floorNumber}`}
      className="bg-white rounded-2xl border border-slate-200/90 shadow-sm overflow-hidden flex flex-col transition-all duration-200 hover:shadow-md"
    >
      {/* 1. Header Tầng: Tên Tầng, Mã Tầng & Tiến Độ */}
      <div className="bg-slate-50/90 border-b border-slate-200 px-4 py-3 flex items-center justify-between flex-wrap gap-2.5">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-xl bg-teal-50 border border-teal-200 text-teal-700 flex items-center justify-center font-bold text-xs shrink-0 shadow-2xs">
            {floor.floorNumber}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-sm sm:text-base font-extrabold text-slate-900 truncate">
                {floor.floorLabel}
              </h3>
              <span className="text-xs font-mono font-bold px-2 py-0.5 rounded bg-teal-50 text-teal-800 border border-teal-200">
                {floor.floorCode}
              </span>
              {floor.isInherited && (
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 font-medium">
                  CAD kế thừa Tầng {floor.inheritedFromFloor}
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 text-xs text-slate-500 mt-0.5">
              <span>{floor.totalUnits} vị trí ({floor.unitCount} căn hộ, {floor.masterCount} khu master)</span>
            </div>
          </div>
        </div>

        {/* Cụm tiến độ & Nút quản lý */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-xs">
            <div className="w-20 sm:w-28 h-2 bg-slate-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-emerald-500 rounded-full transition-all duration-300"
                style={{ width: `${percentCompleted}%` }}
              />
            </div>
            <span className="font-bold text-slate-700 text-xs">
              {floor.completedCount}/{floor.totalUnits}
            </span>
          </div>

          {isAdmin && onOpenCadManagement && (
            <button
              type="button"
              onClick={() => onOpenCadManagement(floor.floorNumber)}
              className="p-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-600 text-xs font-semibold flex items-center gap-1 transition-colors cursor-pointer"
              title="Mở Quản lý CAD Mặt Bằng"
            >
              <Layers size={14} className="text-teal-600" />
              <span className="hidden sm:inline">Quản lý CAD</span>
            </button>
          )}
        </div>
      </div>

      {/* 2. Bản Vẽ CAD Mặt Bằng Tầng Có Các Ô Phân Vùng Tương Tác */}
      {floor.cadUrl ? (
        <div className="relative w-full bg-slate-100/70 border-b border-slate-200 flex items-center justify-center p-2 sm:p-4 min-h-[260px] max-h-[65vh] overflow-hidden select-none">
          {/* Ảnh CAD Mặt Bằng Toàn Tầng */}
          <div className="relative inline-block max-w-full max-h-[60vh]">
            <img
              src={floor.cadUrl}
              alt={`Mặt bằng ${floor.floorLabel}`}
              className="block max-w-full max-h-[60vh] object-contain rounded-xl bg-white shadow-md border border-slate-200 pointer-events-none select-none"
            />

            {/* Lớp phủ các ô phân chia căn hộ / vị trí master */}
            {floor.units.map((unit) => {
              const rawBbox = unit.cad_bbox || unit.cadBbox;
              const bbox = normalizeBbox(rawBbox);
              if (!bbox) return null;

              const isMaster = (unit.unit_type || unit.unitType) === 'MASTER';
              const isSelected = selectedUnitId === unit.id;
              const shortCode = formatShortUnitDisplay(unit.unit_code, isMaster ? 'MASTER' : 'UNIT');

              return (
                <div
                  key={unit.id}
                  onClick={(e) => {
                    e.stopPropagation();
                    onSelectUnit(unit);
                  }}
                  style={{
                    position: 'absolute',
                    left: `${bbox.left}%`,
                    top: `${bbox.top}%`,
                    width: `${bbox.width}%`,
                    height: `${bbox.height}%`,
                  }}
                  className={`rounded-md border-2 cursor-pointer flex flex-col justify-between p-1 transition-all overflow-hidden ${
                    isSelected
                      ? 'ring-4 ring-amber-400 border-amber-500 bg-amber-400/40 z-30 shadow-xl scale-[1.02]'
                      : isMaster
                      ? 'border-indigo-600 bg-indigo-500/25 hover:bg-indigo-500/40 text-indigo-950 z-10'
                      : 'border-teal-500 bg-teal-500/20 hover:bg-teal-500/35 text-slate-900 z-10'
                  }`}
                  title={`Chạm để khảo sát: ${isMaster ? 'Khu' : 'Căn'} ${shortCode} (Mã chuẩn: ${unit.unit_code})`}
                >
                  {/* Thanh nhãn: Icon + Mã ngắn gọn + Nhãn trạng thái */}
                  <div className="flex items-center justify-between gap-1 max-w-full overflow-hidden">
                    <span
                      className={`px-1.5 py-0.5 rounded font-mono font-black text-[10px] sm:text-xs shadow-2xs flex items-center gap-1 max-w-full truncate ${
                        isSelected
                          ? 'bg-amber-500 text-white'
                          : isMaster
                          ? 'bg-indigo-900 text-white'
                          : 'bg-white/95 text-slate-900 border border-teal-600'
                      }`}
                    >
                      {isMaster ? (
                        <Building2 size={11} className="shrink-0" />
                      ) : (
                        <Home size={11} className="shrink-0" />
                      )}
                      <span className="truncate">{shortCode}</span>
                    </span>

                    {/* Nhãn trạng thái nhỏ góc ô */}
                    {renderStatusPill(unit.status, unit.phase2_report_id)}
                  </div>

                  {/* Chân ô: Thông tin kiểm tra định vị */}
                  <div className="flex items-center justify-between text-[9px] font-semibold text-slate-600 truncate mt-0.5">
                    {unit.owner_name && (
                      <span className="truncate max-w-[85%] bg-white/70 px-1 rounded">
                        {unit.owner_name}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="p-8 text-center bg-slate-50 border-b border-slate-200 flex flex-col items-center justify-center gap-2.5">
          <Building2 className="w-8 h-8 text-slate-300" />
          <span className="text-xs text-slate-500 font-medium">
            Tầng này chưa có bản vẽ CAD mặt bằng
          </span>
          {isAdmin && onOpenCadManagement && (
            <button
              type="button"
              onClick={() => onOpenCadManagement(floor.floorNumber)}
              className="px-3 py-1.5 rounded-lg bg-teal-600 hover:bg-teal-700 text-white font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Upload size={14} />
              <span>Nạp bản vẽ CAD cho Tầng {floor.floorNumber}</span>
            </button>
          )}
        </div>
      )}

      {/* 3. Dải Nút Chip Căn Hộ Của Tầng (Quick Unit Strip Dưới Sơ Đồ) */}
      <div className="px-4 py-2.5 bg-white flex flex-wrap items-center gap-1.5 text-xs">
        <span className="text-slate-400 font-bold text-[11px] mr-1">Vị trí tầng:</span>
        {floor.units.length === 0 ? (
          <span className="text-slate-400 text-xs italic">Chưa có vị trí nào</span>
        ) : (
          floor.units.map((u) => {
            const isMaster = (u.unit_type || u.unitType) === 'MASTER';
            const isSelected = selectedUnitId === u.id;
            const shortCode = formatShortUnitDisplay(u.unit_code, isMaster ? 'MASTER' : 'UNIT');

            return (
              <button
                key={u.id}
                type="button"
                onClick={() => onSelectUnit(u)}
                className={`px-2.5 py-1 rounded-lg text-xs font-mono font-bold flex items-center gap-1.5 border transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-amber-400 text-slate-900 border-amber-500 ring-2 ring-amber-300 shadow-sm'
                    : isMaster
                    ? 'bg-indigo-50 hover:bg-indigo-100 text-indigo-800 border-indigo-200'
                    : 'bg-slate-50 hover:bg-teal-50 text-slate-800 border-slate-200 hover:border-teal-300'
                }`}
                title={`Mã chuẩn: ${u.unit_code} • Chạm để khảo sát`}
              >
                {isMaster ? <Building2 size={12} /> : <Home size={12} />}
                <span>{shortCode}</span>
                {renderStatusPill(u.status, u.phase2_report_id)}
              </button>
            );
          })
        )}
      </div>
    </div>
  );
};
