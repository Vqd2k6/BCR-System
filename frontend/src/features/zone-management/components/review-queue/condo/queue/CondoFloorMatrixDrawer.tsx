import React, { useState } from 'react';
import {
  X,
  Grid,
  Layers,
  DoorOpen,
  CheckCircle2,
  Clock,
  UserX,
  AlertTriangle,
  Maximize2,
  Filter,
} from 'lucide-react';
import type { CondoFloorMatrixRow } from '../types/condo-audit.types';
import { ImageZoomModal } from '../../../../../../components/common/ImageZoomModal';

interface CondoFloorMatrixDrawerProps {
  isOpen: boolean;
  towerName: string;
  towerParcelCode: string;
  floorMatrix: CondoFloorMatrixRow[];
  onClose: () => void;
  onSelectUnitReport: (reportId: string) => void;
  onFilterByFloor?: (floorNumber: number | null) => void;
}

export const CondoFloorMatrixDrawer: React.FC<CondoFloorMatrixDrawerProps> = ({
  isOpen,
  towerName,
  towerParcelCode,
  floorMatrix,
  onClose,
  onSelectUnitReport,
  onFilterByFloor,
}) => {
  const [zoomCadUrl, setZoomCadUrl] = useState<string | null>(null);
  const [zoomCadTitle, setZoomCadTitle] = useState<string>('');

  if (!isOpen) return null;

  const getCellStyle = (status: string, burlandScore: number | null) => {
    const isCritical = (burlandScore ?? 0) >= 3;
    const ringClass = isCritical ? 'ring-2 ring-rose-500' : '';
    if (status === 'APPROVED') {
      return `bg-emerald-100 dark:bg-emerald-950/70 text-emerald-900 dark:text-emerald-200 border-emerald-300 dark:border-emerald-700 ${ringClass}`;
    }
    if (status === 'POSTPONED_ABSENT_VERIFIED') {
      return `bg-purple-100 dark:bg-purple-950/70 text-purple-900 dark:text-purple-200 border-purple-300 dark:border-purple-700 ${ringClass}`;
    }
    if (status === 'POSTPONED_ABSENT') {
      return `bg-fuchsia-50 dark:bg-fuchsia-950/40 text-fuchsia-800 dark:text-fuchsia-300 border-fuchsia-300 ${ringClass}`;
    }
    if (status === 'SUBMITTED' || status === 'UNDER_REVIEW') {
      return `bg-amber-100 dark:bg-amber-950/70 text-amber-900 dark:text-amber-200 border-amber-300 dark:border-amber-700 ${ringClass}`;
    }
    if (status === 'REJECTED') {
      return `bg-rose-100 dark:bg-rose-950/70 text-rose-900 dark:text-rose-200 border-rose-300 dark:border-rose-700 ${ringClass}`;
    }
    return `bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700 ${ringClass}`;
  };

  return (
    <div className="fixed inset-0 z-[115] isolate flex justify-end bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="relative z-[116] w-full max-w-4xl bg-white dark:bg-slate-900 h-full shadow-2xl border-l border-slate-200 dark:border-slate-800 flex flex-col">
        {/* Header */}
        <div className="px-5 py-4 bg-slate-900 text-white flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-teal-500/20 border border-teal-400/30 text-teal-300">
              <Grid className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-black">
                Ma Trận Không Gian Tầng &amp; Bản Vẽ Mặt Bằng CAD ({towerName})
              </h3>
              <p className="text-xs text-slate-400 font-mono">
                Mã khối tháp: {towerParcelCode} • Nhấn vào ô căn hộ/khu vực chung để mở Studio Thẩm định
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-slate-200 cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Legend */}
        <div className="px-5 py-2.5 bg-slate-50 dark:bg-slate-800/80 border-b border-slate-200 dark:border-slate-800 flex items-center gap-4 flex-wrap text-[11px]">
          <span className="font-bold text-slate-600 dark:text-slate-300">Chú giải:</span>
          <span className="inline-flex items-center gap-1">
            <span className="w-3 h-3 rounded bg-emerald-400 inline-block" /> Đã duyệt (APPROVED)
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="w-3 h-3 rounded bg-amber-400 inline-block" /> Chờ duyệt (SUBMITTED)
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="w-3 h-3 rounded bg-purple-400 inline-block" /> Vắng mặt đã duyệt
          </span>
          <span className="inline-flex items-center gap-1">
            <span className="w-3 h-3 rounded bg-rose-400 inline-block" /> Trả về / Nứt Cấp ≥ 3
          </span>
        </div>

        {/* Floor Rows */}
        <div className="flex-1 overflow-y-auto p-5 space-y-3">
          {floorMatrix.length === 0 ? (
            <div className="py-16 text-center text-slate-400 text-xs">
              Chưa có dữ liệu phân tầng cho khối tháp này.
            </div>
          ) : (
            floorMatrix.map((floor) => (
              <div
                key={floor.floorNumber}
                className="rounded-2xl border border-slate-200 dark:border-slate-800 bg-slate-50/60 dark:bg-slate-800/40 p-3.5 flex flex-col md:flex-row gap-3 items-start"
              >
                {/* Left Floor Badge & CAD Thumbnail */}
                <div className="w-full md:w-48 shrink-0 space-y-2 border-b md:border-b-0 md:border-r border-slate-200 dark:border-slate-750 pb-2 md:pb-0 md:pr-3">
                  <div className="flex items-center justify-between">
                    <span className="px-2.5 py-1 rounded-lg bg-indigo-600 text-white font-black text-xs">
                      {floor.floorName}
                    </span>
                    {onFilterByFloor && (
                      <button
                        type="button"
                        onClick={() => {
                          onFilterByFloor(floor.floorNumber);
                          onClose();
                        }}
                        className="px-2 py-0.5 rounded bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-[10px] font-bold text-indigo-600 flex items-center gap-1 cursor-pointer"
                        title="Lọc danh sách theo tầng này"
                      >
                        <Filter className="w-2.5 h-2.5" />
                        <span>Lọc tầng</span>
                      </button>
                    )}
                  </div>

                  <div className="text-[11px] text-slate-500 space-y-0.5">
                    <div>
                      Hoàn tất:{' '}
                      <strong className="text-slate-800 dark:text-slate-200 font-mono">
                        {floor.approvedUnits}/{floor.totalUnits}
                      </strong>
                    </div>
                    {floor.criticalUnits > 0 && (
                      <div className="text-rose-600 font-bold flex items-center gap-1">
                        <AlertTriangle className="w-3 h-3" /> {floor.criticalUnits} mục Cấp ≥ 3
                      </div>
                    )}
                  </div>

                  {floor.cadPhotoUrl ? (
                    <button
                      type="button"
                      onClick={() => {
                        setZoomCadUrl(floor.cadPhotoUrl);
                        setZoomCadTitle(`Mặt bằng CAD ${floor.floorName} — ${towerName}`);
                      }}
                      className="w-full h-16 rounded-xl overflow-hidden border border-slate-300 relative group cursor-pointer block force-light bg-white"
                    >
                      <img
                        src={floor.cadPhotoUrl}
                        alt={floor.floorName}
                        className="w-full h-full object-contain"
                      />
                      <div className="absolute inset-0 bg-black/45 opacity-0 group-hover:opacity-100 flex items-center justify-center gap-1 text-white text-[10px] font-bold transition-opacity">
                        <Maximize2 className="w-3.5 h-3.5" />
                        <span>Xem CAD Tầng</span>
                      </div>
                    </button>
                  ) : (
                    <div className="text-[10px] text-slate-400 italic">
                      Chưa đính kèm mặt bằng CAD tầng
                    </div>
                  )}
                </div>

                {/* Right Units & Common Areas Grid */}
                <div className="flex-1 flex flex-wrap gap-2">
                  {floor.units.map((u) => {
                    const isArea = u.unitType === 'MASTER_AREA';
                    return (
                      <button
                        key={u.unitId}
                        type="button"
                        disabled={!u.reportId}
                        onClick={() => {
                          if (u.reportId) {
                            onClose();
                            onSelectUnitReport(u.reportId);
                          }
                        }}
                        className={`px-2.5 py-2 rounded-xl border text-left transition-all min-w-[115px] ${getCellStyle(
                          u.status,
                          u.burlandScore
                        )} ${
                          u.reportId
                            ? 'hover:scale-[1.02] hover:shadow-xs cursor-pointer'
                            : 'opacity-50 cursor-not-allowed'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-1">
                          <span className="font-mono font-black text-xs flex items-center gap-1">
                            {isArea ? (
                              <Layers className="w-3 h-3 text-indigo-600 shrink-0" />
                            ) : (
                              <DoorOpen className="w-3 h-3 text-teal-600 shrink-0" />
                            )}
                            {u.unitCode}
                          </span>
                          {u.status === 'APPROVED' ? (
                            <CheckCircle2 className="w-3 h-3 text-emerald-600 shrink-0" />
                          ) : u.status.includes('ABSENT') ? (
                            <UserX className="w-3 h-3 text-purple-600 shrink-0" />
                          ) : (
                            <Clock className="w-3 h-3 text-amber-600 shrink-0" />
                          )}
                        </div>
                        <div className="text-[10px] truncate mt-0.5 opacity-85">
                          {u.ownerName || (isArea ? 'Khu vực chung' : 'Chưa rõ chủ hộ')}
                        </div>
                        {u.burlandScore !== null && u.burlandScore > 0 && (
                          <div className="text-[9px] font-mono font-bold mt-0.5">
                            Burland Cấp {u.burlandScore}
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {zoomCadUrl && (
        <ImageZoomModal
          isOpen={Boolean(zoomCadUrl)}
          imageUrl={zoomCadUrl}
          title={zoomCadTitle}
          onClose={() => setZoomCadUrl(null)}
        />
      )}
    </div>
  );
};

