import React from 'react';
import {
  Home,
  Building2,
  X,
  Play,
  CheckCircle2,
  Clock,
  AlertTriangle,
  ExternalLink,
  ShieldCheck,
} from 'lucide-react';
import type { GisParcel } from '../../../gis/LeafletSweepMap';
import type { BuildingUnit } from '../types';
import { formatShortUnitDisplay } from '../../../../core/utils/codeFormattingUtils';

interface UnitInspectionDrawerProps {
  unit: BuildingUnit | null;
  parcel: GisParcel;
  floorLabel?: string;
  isMasterSurveyDone: boolean;
  onClose: () => void;
  onStartUnitSurvey: (parcel: GisParcel, unit: BuildingUnit, phase?: 1 | 2) => void;
  onStartMasterAreaSurvey?: (parcel: GisParcel, unit: BuildingUnit) => void;
}

export const UnitInspectionDrawer: React.FC<UnitInspectionDrawerProps> = ({
  unit,
  parcel,
  floorLabel,
  isMasterSurveyDone,
  onClose,
  onStartUnitSurvey,
  onStartMasterAreaSurvey,
}) => {
  if (!unit) return null;

  const isMaster = (unit.unit_type || unit.unitType) === 'MASTER';
  const shortCode = formatShortUnitDisplay(unit.unit_code, isMaster ? 'MASTER' : 'UNIT');
  const isApproved = unit.status === 'APPROVED' || Boolean(unit.phase2_report_id);
  const isSubmitted = unit.status === 'SUBMITTED';
  const isInProgress = unit.status === 'IN_PROGRESS';
  const isAbsent = unit.status === 'POSTPONED_ABSENT';

  const renderStatusBadge = () => {
    if (isApproved) {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
          <CheckCircle2 size={13} className="text-emerald-600" />
          <span>Đã duyệt Phase 1</span>
        </span>
      );
    }
    if (isSubmitted) {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-sky-100 text-sky-800 border border-sky-300">
          <Clock size={13} className="text-sky-600" />
          <span>Đã nộp (Chờ duyệt)</span>
        </span>
      );
    }
    if (isInProgress) {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-amber-100 text-amber-800 border border-amber-300">
          <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
          <span>Đang làm dở</span>
        </span>
      );
    }
    if (isAbsent) {
      return (
        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-purple-100 text-purple-800 border border-purple-300">
          <AlertTriangle size={13} className="text-purple-600" />
          <span>Vắng mặt (Hoãn)</span>
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-slate-100 text-slate-700 border border-slate-300">
        <span className="w-2 h-2 rounded-full bg-slate-400" />
        <span>Chưa khảo sát</span>
      </span>
    );
  };

  const handleStartSurvey = () => {
    if (isMaster) {
      if (onStartMasterAreaSurvey) {
        onStartMasterAreaSurvey(parcel, unit);
      }
    } else {
      // Nếu đã duyệt Phase 1 thì mở Phase 2, ngược lại mở Phase 1
      const phase = isApproved ? 2 : 1;
      onStartUnitSurvey(parcel, unit, phase);
    }
  };

  return (
    <>
      {/* Backdrop mờ phía sau trên mobile: Chạm vào nền mờ để đóng */}
      <div
        onClick={onClose}
        className="sm:hidden fixed inset-0 bg-slate-900/40 backdrop-blur-2xs z-[99990] animate-in fade-in duration-150"
      />

      {/* Main Bottom Sheet trên Mobile & Float Box trên Desktop */}
      <div
        onClick={(e) => e.stopPropagation()}
        className="fixed sm:static inset-x-0 bottom-0 z-[99995] sm:z-auto bg-white/98 backdrop-blur-md rounded-t-3xl sm:rounded-2xl border-t-2 sm:border-2 border-slate-300 shadow-2xl p-4 sm:p-5 pb-8 sm:pb-5 flex flex-col gap-3.5 animate-in slide-in-from-bottom-4 duration-200 ring-2 ring-slate-900/10 max-h-[88vh] overflow-y-auto"
      >
        {/* Mobile Drag Handle Bar */}
        <div className="sm:hidden w-12 h-1.5 bg-slate-300 rounded-full mx-auto -mt-1 mb-1 shrink-0" />

        {/* 1. Thanh tiêu đề vị trí */}
        <div className="flex items-start justify-between gap-3 border-b border-slate-200/80 pb-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div
              className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 shadow-xs ${
                isMaster ? 'bg-indigo-600 text-white' : 'bg-teal-600 text-white'
              }`}
            >
              {isMaster ? <Building2 size={20} /> : <Home size={20} />}
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h4 className="text-base sm:text-lg font-black text-slate-900 truncate">
                  {isMaster ? `Khu ${shortCode}` : `Căn ${shortCode}`}
                </h4>
                <span className="text-[11px] font-mono font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-700 border border-slate-300">
                  Mã: {unit.unit_code}
                </span>
                <span
                  className={`text-[11px] font-bold px-2 py-0.5 rounded ${
                    isMaster ? 'bg-indigo-100 text-indigo-800' : 'bg-teal-100 text-teal-800'
                  }`}
                >
                  {floorLabel || `Tầng ${unit.floor_number ?? 1}`}
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5 truncate">
                {isMaster
                  ? `Khu vực dùng chung của khối tháp: ${unit.unit_name || 'Hạng mục dùng chung'}`
                  : `Căn hộ con sở hữu riêng • Tòa nhà ${parcel.projectParcelCode || parcel.officialCadastralCode || 'Metro 2'}`}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 flex items-center justify-center transition-colors cursor-pointer shrink-0"
            title="Đóng thẻ xem nhanh"
          >
            <X size={18} />
          </button>
        </div>

        {/* 2. Chi tiết sơ bộ: Chủ sở hữu / BQL & Tọa độ CAD */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
          <div className="flex flex-col gap-1.5 bg-slate-50/80 p-2.5 rounded-xl border border-slate-200">
            <div className="flex items-center justify-between">
              <span className="text-slate-500 font-medium">Trạng thái:</span>
              {renderStatusBadge()}
            </div>
            <div className="flex items-center justify-between text-slate-700 pt-1 border-t border-slate-200/60">
              <span className="text-slate-500 font-medium">Định vị mặt bằng:</span>
              <span className="font-bold text-emerald-700 flex items-center gap-1">
                <CheckCircle2 size={13} />
                <span>Đã khớp tọa độ CAD</span>
              </span>
            </div>
          </div>

          <div className="flex flex-col gap-1.5 bg-slate-50/80 p-2.5 rounded-xl border border-slate-200">
            <div className="flex items-center justify-between text-slate-700">
              <span className="text-slate-500 font-medium">{isMaster ? 'Đơn vị quản lý:' : 'Chủ căn hộ:'}</span>
              <strong className="font-bold text-slate-900 truncate max-w-[60%]">
                {isMaster ? unit.owner_name || 'BQL Tòa nhà' : unit.owner_name || 'Chưa cập nhật'}
              </strong>
            </div>
            {!isMaster && (
              <div className="flex items-center justify-between text-slate-700 pt-1 border-t border-slate-200/60">
                <span className="text-slate-500 font-medium">Số điện thoại:</span>
                <span className="font-mono text-slate-900 font-bold">
                  {unit.owner_phone || '---'}
                </span>
              </div>
            )}
            {isMaster && (
              <div className="flex items-center justify-between text-slate-700 pt-1 border-t border-slate-200/60">
                <span className="text-slate-500 font-medium">Phạm vi khảo sát:</span>
                <span className="font-semibold text-indigo-700">
                  Toàn bộ cấu kiện khu vực
                </span>
              </div>
            )}
          </div>
        </div>

        {/* 3. Nút Hành Động Khảo Sát Chính (Primary Survey CTA - Tối ưu Thumb Zone 48px) */}
        <div className="flex items-center justify-between gap-3 pt-1">
          <span className="text-[11px] text-slate-500 hidden sm:inline">
            Kiểm tra vị trí đứng trùng khớp với sơ đồ CAD trước khi bắt đầu.
          </span>

          <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end">
            <button
              type="button"
              onClick={onClose}
              className="min-h-[44px] px-4 py-2.5 rounded-xl text-xs font-bold text-slate-600 bg-slate-100 hover:bg-slate-200 transition-colors cursor-pointer shrink-0"
            >
              Đóng
            </button>

            <button
              type="button"
              onClick={handleStartSurvey}
              className={`flex-1 sm:flex-initial min-h-[48px] px-5 py-2.5 rounded-xl font-bold text-xs sm:text-sm text-white shadow-md flex items-center justify-center gap-2 transition-all cursor-pointer hover:shadow-lg active:scale-98 ${
                isMaster
                  ? 'bg-indigo-600 hover:bg-indigo-700'
                  : isApproved
                  ? 'bg-blue-600 hover:bg-blue-700'
                  : isInProgress
                  ? 'bg-amber-600 hover:bg-amber-700'
                  : 'bg-teal-600 hover:bg-teal-700'
              }`}
            >
              {isMaster ? (
                <>
                  <Building2 size={16} />
                  <span>Khảo Sát Khu Vực Này</span>
                </>
              ) : isApproved ? (
                <>
                  <ShieldCheck size={16} />
                  <span>Khảo Sát Phase 2</span>
                </>
              ) : isSubmitted ? (
                <>
                  <ExternalLink size={16} />
                  <span>Xem Hồ Sơ Đã Nộp</span>
                </>
              ) : isInProgress ? (
                <>
                  <Play size={16} className="fill-current" />
                  <span>Tiếp Tục Khảo Sát</span>
                </>
              ) : (
                <>
                  <Play size={16} className="fill-current" />
                  <span>Bắt Đầu Khảo Sát Căn Hộ</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </>
  );
};
