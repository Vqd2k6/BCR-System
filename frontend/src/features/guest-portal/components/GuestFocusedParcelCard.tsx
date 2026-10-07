import React from 'react';
import { GisParcel } from '../../../components/gis/shared/types';
import {
  getEffectiveParcelStatus,
  getStatusColor,
} from '../../../components/gis/sweep-map/utils/sweepMapHelpers';
import {
  getParcelBraRiskLevel,
  getBraBadgeStyle,
  maskClientName,
  maskClientPhone,
} from '../utils/guestPortalHelpers';
import {
  Building2,
  MapPin,
  User,
  Phone,
  Ruler,
  FileText,
  FileCheck,
  X,
  ShieldAlert,
} from 'lucide-react';

interface Props {
  parcel: GisParcel;
  onClose: () => void;
  onViewReportPreview?: (parcel: GisParcel) => void;
  onOpenSurveyDetail?: (parcel: GisParcel) => void;
}

export const GuestFocusedParcelCard: React.FC<Props> = ({
  parcel,
  onClose,
  onViewReportPreview,
  onOpenSurveyDetail,
}) => {
  const effStatus = getEffectiveParcelStatus(parcel);
  const statusColor = getStatusColor(effStatus);
  const braLevel = getParcelBraRiskLevel(parcel);
  const braStyle = getBraBadgeStyle(braLevel);

  return (
    <div className="bg-gradient-to-b from-sky-50/40 to-white rounded-2xl border-2 border-sky-400/80 p-4 shadow-md space-y-3 animate-in fade-in slide-in-from-bottom-2">
      {/* Top Header */}
      <div className="flex items-start justify-between gap-2 border-b border-sky-100 pb-2.5">
        <div className="flex items-center gap-2 min-w-0">
          <div className="w-8 h-8 rounded-xl bg-sky-600 text-white flex items-center justify-center shrink-0">
            <Building2 size={16} />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-mono text-sm font-black text-slate-900 truncate">
                {parcel.projectParcelCode}
              </span>
              <span
                className="px-2 py-0.5 rounded text-[10px] font-bold text-white shrink-0"
                style={{ backgroundColor: statusColor }}
              >
                {effStatus}
              </span>
            </div>
            <p className="text-xs text-slate-700 font-semibold truncate mt-0.5">
              {parcel.houseNumber ? `${parcel.houseNumber} ` : ''}
              {parcel.street}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer shrink-0"
          title="Đóng chi tiết"
        >
          <X size={15} />
        </button>
      </div>

      {/* Grid Specs */}
      <div className="grid grid-cols-2 gap-2 text-xs">
        {/* Chủ hộ đã che mờ PII */}
        <div className="p-2.5 bg-white rounded-xl border border-slate-200/80 flex items-center gap-2">
          <User size={13} className="text-slate-400 shrink-0" />
          <div className="min-w-0">
            <span className="text-[10px] text-slate-400 block">Chủ hộ (Bảo mật)</span>
            <span className="font-semibold text-slate-800 truncate block">
              {maskClientName(parcel.ownerName)}
            </span>
          </div>
        </div>

        {/* Số điện thoại đã che mờ PII */}
        <div className="p-2.5 bg-white rounded-xl border border-slate-200/80 flex items-center gap-2">
          <Phone size={13} className="text-slate-400 shrink-0" />
          <div className="min-w-0">
            <span className="text-[10px] text-slate-400 block">Liên hệ (Bảo mật)</span>
            <span className="font-mono text-slate-700 truncate block">
              {maskClientPhone(parcel.ownerPhone)}
            </span>
          </div>
        </div>

        {/* Cự ly tim hầm Metro */}
        <div className="p-2.5 bg-white rounded-xl border border-slate-200/80 flex items-center gap-2">
          <Ruler size={13} className="text-slate-400 shrink-0" />
          <div className="min-w-0">
            <span className="text-[10px] text-slate-400 block">Cự ly tim/mép hầm</span>
            <span className="font-bold text-slate-800 truncate block">
              {parcel.distanceMeters !== undefined ? `${parcel.distanceMeters.toFixed(1)} m` : 'Đang tính toán'}
            </span>
          </div>
        </div>

        {/* Cấp rủi ro BRA */}
        <div className="p-2.5 bg-white rounded-xl border border-slate-200/80 flex items-center gap-2">
          <ShieldAlert size={13} className="text-orange-500 shrink-0" />
          <div className="min-w-0">
            <span className="text-[10px] text-slate-400 block">Cấp rủi ro BRA</span>
            <span className={`text-[11px] font-bold truncate block ${braStyle.text}`}>
              {braStyle.label}
            </span>
          </div>
        </div>
      </div>

      {/* Action Button: Mở Xem Trước Báo Cáo Kỹ Thuật (View-Only) */}
      <button
        type="button"
        onClick={() => {
          if (onViewReportPreview) {
            onViewReportPreview(parcel);
          } else if (onOpenSurveyDetail) {
            onOpenSurveyDetail(parcel);
          }
        }}
        className="w-full py-2.5 px-4 rounded-xl text-xs font-bold flex items-center justify-center gap-2 bg-gradient-to-r from-sky-600 to-blue-700 hover:from-sky-700 hover:to-blue-800 text-white shadow-sm shadow-sky-600/25 transition-all cursor-pointer active:scale-[0.99]"
      >
        <FileCheck size={15} />
        <span>Xem Trước Báo Cáo Kỹ Thuật (Preview BCS Report) ➔</span>
      </button>
    </div>
  );
};
