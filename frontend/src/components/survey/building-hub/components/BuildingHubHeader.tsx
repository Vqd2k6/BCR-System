import React from 'react';
import { ArrowLeft, Building2, Layers } from 'lucide-react';
import type { GisParcel } from '../../../gis/LeafletSweepMap';
import { useAuth } from '../../../../context/AuthContext';

interface BuildingHubHeaderProps {
  parcel: GisParcel;
  isHeaderVisible?: boolean;
  isMasterSurveyDone?: boolean;
  onClose: () => void;
  onOpenMasterView: () => void;
  onOpenCadManagement?: () => void;
}

export const BuildingHubHeader: React.FC<BuildingHubHeaderProps> = ({
  parcel,
  isHeaderVisible: _isHeaderVisible,
  isMasterSurveyDone,
  onClose,
  onOpenMasterView,
  onOpenCadManagement,
}) => {
  const { user } = useAuth();
  const isAdmin = user?.role === 'ZONE_ADMIN' || user?.role === 'SUPER_ADMIN';

  return (
    <header className="bg-white border-b border-slate-200 px-3.5 sm:px-6 py-2.5 flex items-center justify-between shadow-xs flex-shrink-0 z-50 sticky top-0">
      {/* Left: Single Back Arrow Button with 40px Touch Target */}
      <div className="flex items-center gap-2.5 min-w-0">
        <button
          type="button"
          onClick={onClose}
          className="min-h-[40px] flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 active:scale-95 text-slate-700 text-xs font-bold transition-all cursor-pointer shrink-0"
          title="Quay lại Bản đồ"
        >
          <ArrowLeft size={16} />
          <span className="hidden sm:inline">Quay lại Bản đồ</span>
        </button>

        <div className="h-5 w-px bg-slate-200 hidden sm:block shrink-0" />

        {/* Clean Title */}
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 truncate">
            <span className="text-[11px] sm:text-xs font-bold text-sky-600 shrink-0">
              {parcel.projectParcelCode || 'B-05272'}
            </span>
            <span className="text-slate-400 text-xs">•</span>
            <h1 className="text-xs sm:text-sm font-extrabold text-slate-900 truncate">
              Số {parcel.houseNumber} {parcel.street}
            </h1>
          </div>
        </div>
      </div>

      {/* Right: Actions with 40px Touch Targets */}
      <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
        {onOpenCadManagement && (
          <button
            type="button"
            onClick={onOpenCadManagement}
            className="min-h-[40px] px-2.5 sm:px-3 py-1.5 rounded-xl bg-teal-50 hover:bg-teal-100 active:bg-teal-200 border border-teal-200 text-teal-700 text-xs font-bold transition-all shadow-2xs flex items-center gap-1.5 cursor-pointer active:scale-95"
            title={
              isAdmin
                ? 'Quản lý bản vẽ CAD & Chia cắt ô căn hộ tầng (Zone Admin)'
                : 'Xem sơ đồ CAD và vị trí căn hộ trên mặt bằng (Chỉ đọc)'
            }
          >
            <Layers size={16} className="text-teal-600" />
            <span className="hidden sm:inline">
              {isAdmin ? 'Quản Lý CAD Tầng' : 'Xem Sơ Đồ CAD'}
            </span>
          </button>
        )}
        <button
          type="button"
          onClick={onOpenMasterView}
          className={`min-h-[40px] px-2.5 sm:px-3 py-1.5 rounded-xl border transition-all shadow-2xs flex items-center gap-1.5 cursor-pointer active:scale-95 ${
            isMasterSurveyDone
              ? 'bg-emerald-50 hover:bg-emerald-100 active:bg-emerald-200 border-emerald-300 text-emerald-800'
              : 'bg-sky-50 hover:bg-sky-100 active:bg-sky-200 border-sky-200 text-sky-700'
          }`}
          title="Khảo sát & Hồ sơ hạng mục dùng chung tòa nhà"
        >
          <Building2 size={16} className={isMasterSurveyDone ? 'text-emerald-600' : 'text-sky-600'} />
          <span className="hidden sm:inline text-xs font-bold">
            {isMasterSurveyDone ? 'Tòa Mẹ (Đã Khảo Sát)' : 'Tòa Mẹ'}
          </span>
        </button>
      </div>
    </header>
  );
};
