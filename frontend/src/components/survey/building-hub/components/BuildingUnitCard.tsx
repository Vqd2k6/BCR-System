import {
  CheckCircle2,
  Clock,
  AlertCircle,
  User,
  Phone,
  Check,
  ArrowRight,
  Sparkles,
  Building2,
  MapPin,
} from 'lucide-react';
import type { GisParcel } from '../../../gis/LeafletSweepMap';
import type { BuildingUnit } from '../types';

interface BuildingUnitCardProps {
  unit: BuildingUnit;
  parcel: GisParcel;
  isMasterSurveyDone: boolean;
  onClose: () => void;
  onStartUnitSurvey: (parcel: GisParcel, unit: BuildingUnit, phase?: 1 | 2) => void;
  onStartMasterAreaSurvey?: (parcel: GisParcel, unit: BuildingUnit) => void;
}

export const BuildingUnitCard: React.FC<BuildingUnitCardProps> = ({
  unit,
  parcel,
  isMasterSurveyDone,
  onClose,
  onStartUnitSurvey,
  onStartMasterAreaSurvey,
}) => {
  const isPhase1Done = unit.status === 'APPROVED' || unit.status === 'SUBMITTED' || !!unit.phase1_report_id;
  const isPhase2Done = !!unit.phase2_report_id || unit.status === 'PHASE2_COMPLETED';

  const renderUnitStatusBadge = () => {
    if (isPhase2Done) {
      return (
        <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
          <CheckCircle2 size={12} />
          Đã xong P1 & P2
        </span>
      );
    }

    if (unit.status === 'APPROVED' || (isPhase1Done && unit.status !== 'SUBMITTED')) {
      return (
        <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
          <CheckCircle2 size={12} />
          Đã duyệt P1
        </span>
      );
    }

    if (unit.status === 'SUBMITTED') {
      return (
        <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-sky-50 text-sky-700 border border-sky-200">
          <Clock size={12} />
          Chờ duyệt P1
        </span>
      );
    }

    if (unit.status === 'IN_PROGRESS') {
      return (
        <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200">
          <Clock size={12} />
          Đang làm P1
        </span>
      );
    }

    if (unit.status === 'POSTPONED_ABSENT') {
      return (
        <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-full bg-purple-50 text-purple-700 border border-purple-200">
          <AlertCircle size={12} />
          Vắng mặt
        </span>
      );
    }

    return (
      <span className="inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200">
        <Clock size={11} className="text-slate-400" />
        Chưa khảo sát
      </span>
    );
  };

  const isMaster = (unit.unit_type || unit.unitType) === 'MASTER';
  const floorNum = unit.floor_number ?? unit.floorNumber ?? 1;
  const floorLabel = floorNum < 0 ? `Hầm B${Math.abs(floorNum)}` : floorNum === 0 ? 'Trệt / Sảnh G' : `Lầu ${floorNum}`;

  return (
    <div
      className={`bg-white rounded-xl border p-4 flex flex-col justify-between gap-3 shadow-sm hover:shadow-md transition-all ${
        isPhase2Done
          ? 'border-emerald-200 bg-emerald-50/10'
          : isPhase1Done
          ? isMaster ? 'border-indigo-300 bg-indigo-50/20' : 'border-sky-200 bg-sky-50/10'
          : isMaster
          ? 'border-indigo-200 bg-indigo-50/5'
          : 'border-slate-200'
      }`}
    >
      <div>
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className={`text-sm font-black flex items-center gap-1.5 ${isMaster ? 'text-indigo-900' : 'text-slate-900'}`}>
              {isMaster ? <Building2 size={15} className="text-indigo-600" /> : null}
              {unit.unit_code}
            </span>
            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${
              isMaster ? 'bg-indigo-50 text-indigo-700 border-indigo-200' : 'bg-slate-100 text-slate-600 border border-slate-200'
            }`}>
              {floorLabel}
            </span>
          </div>
          {renderUnitStatusBadge()}
        </div>

        <div className="mt-2.5 flex flex-col gap-1 text-[11px] text-slate-600">
          {isMaster ? (
            <>
              <div className="flex items-center gap-1.5 truncate">
                <MapPin size={13} className="text-indigo-500 flex-shrink-0" />
                <span className="truncate">
                  Khu vực: <strong>{unit.unit_name || 'Dùng chung'}</strong>
                </span>
              </div>
              <div className="flex items-center gap-1.5 text-slate-500">
                <span className="text-[10px]">Định vị CAD:</span>
                {unit.cad_bbox || unit.cadBbox ? (
                  <span className="text-indigo-600 font-bold text-[10px]">✓ Đã phân chia zone</span>
                ) : (
                  <span className="text-slate-400 text-[10px]">Chưa vẽ zone</span>
                )}
              </div>
            </>
          ) : (
            <>
              <div className="flex items-center gap-1.5 truncate">
                <User size={13} className="text-slate-400 flex-shrink-0" />
                <span className="truncate">
                  Chủ hộ: <strong>{unit.owner_name || 'Chưa cập nhật'}</strong>
                </span>
              </div>
              {unit.owner_phone && (
                <div className="flex items-center gap-1.5">
                  <Phone size={13} className="text-slate-400 flex-shrink-0" />
                  <span>{unit.owner_phone}</span>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Dynamic Survey Phase Action Button */}
      {isMaster ? (
        isPhase1Done ? (
          <button
            type="button"
            onClick={() => {
              if (onStartMasterAreaSurvey) onStartMasterAreaSurvey(parcel, unit);
              else onStartUnitSurvey(parcel, unit, 1);
            }}
            className="w-full py-2 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 transition-all cursor-pointer"
          >
            <Check size={14} className="text-emerald-600" />
            <span>Xem Khảo Sát Master</span>
          </button>
        ) : unit.status === 'IN_PROGRESS' ? (
          <button
            type="button"
            onClick={() => {
              if (onStartMasterAreaSurvey) onStartMasterAreaSurvey(parcel, unit);
              else onStartUnitSurvey(parcel, unit, 1);
            }}
            className="w-full py-2 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 bg-amber-500 hover:bg-amber-600 text-white shadow-sm transition-all cursor-pointer"
          >
            <Clock size={14} />
            <span>Tiếp Tục Khảo Sát Master</span>
          </button>
        ) : (
          <button
            type="button"
            onClick={() => {
              if (onStartMasterAreaSurvey) onStartMasterAreaSurvey(parcel, unit);
              else onStartUnitSurvey(parcel, unit, 1);
            }}
            className="w-full py-2 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white shadow-sm transition-all cursor-pointer"
          >
            <Building2 size={14} />
            <span>Khảo Sát Khu Vực Master</span>
          </button>
        )
      ) : isPhase2Done ? (
        <button
          type="button"
          onClick={() => {
            onClose();
            onStartUnitSurvey(parcel, unit, 2);
          }}
          className="w-full py-2 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 btn btn-secondary text-slate-700 hover:bg-slate-100 border border-slate-300 transition-all cursor-pointer"
        >
          <Check size={14} className="text-emerald-600" />
          <span>Xem Chi Tiết / Đo Bổ Sung</span>
        </button>
      ) : isPhase1Done ? (
        <button
          type="button"
          onClick={() => {
            onClose();
            onStartUnitSurvey(parcel, unit, 2);
          }}
          className="w-full py-2 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 bg-sky-600 hover:bg-sky-700 active:bg-sky-800 text-white shadow-sm shadow-sky-600/20 transition-all cursor-pointer"
        >
          <ArrowRight size={14} />
          <span>Khảo Sát Phase 2 (Nội Thất)</span>
        </button>
      ) : unit.status === 'IN_PROGRESS' ? (
        <button
          type="button"
          onClick={() => {
            onClose();
            onStartUnitSurvey(parcel, unit, 1);
          }}
          className="w-full py-2 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 bg-amber-500 hover:bg-amber-600 text-white shadow-sm shadow-amber-500/20 transition-all cursor-pointer"
        >
          <Clock size={14} />
          <span>Tiếp Tục Phase 1</span>
        </button>
      ) : unit.status === 'POSTPONED_ABSENT' ? (
        <button
          type="button"
          onClick={() => {
            onClose();
            onStartUnitSurvey(parcel, unit, 1);
          }}
          className="w-full py-2 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 bg-purple-600 hover:bg-purple-700 text-white shadow-sm shadow-purple-600/20 transition-all cursor-pointer"
        >
          <Sparkles size={14} />
          <span>Khảo Sát Phase 1 (Hẹn lại)</span>
        </button>
      ) : (
        <button
          type="button"
          onClick={() => {
            onClose();
            onStartUnitSurvey(parcel, unit, 1);
          }}
          className="w-full py-2 px-3 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 bg-sky-600 hover:bg-sky-700 active:bg-sky-800 text-white shadow-sm shadow-sky-600/20 transition-all cursor-pointer"
        >
          <Sparkles size={14} />
          <span>Khảo Sát Phase 1</span>
        </button>
      )}
    </div>
  );
};
