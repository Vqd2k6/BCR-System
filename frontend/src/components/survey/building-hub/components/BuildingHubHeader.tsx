import React from 'react';
import { ArrowLeft, Building2 } from 'lucide-react';
import { GisParcel } from '../../../gis/LeafletSweepMap';

interface BuildingHubHeaderProps {
  parcel: GisParcel;
  isHeaderVisible: boolean;
  onClose: () => void;
  onOpenMasterView: () => void;
}

export const BuildingHubHeader: React.FC<BuildingHubHeaderProps> = ({
  parcel,
  isHeaderVisible,
  onClose,
  onOpenMasterView,
}) => {
  return (
    <header
      className={`bg-white border-b border-slate-200 px-3.5 sm:px-6 py-2.5 flex items-center justify-between shadow-sm flex-shrink-0 transition-all duration-300 ease-in-out z-50 ${
        isHeaderVisible
          ? 'translate-y-0 opacity-100'
          : '-translate-y-full opacity-0 pointer-events-none h-0 py-0 overflow-hidden border-b-0'
      }`}
    >
      {/* Left: Single Back Arrow Button */}
      <div className="flex items-center gap-2.5 min-w-0">
        <button
          type="button"
          onClick={onClose}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-700 text-xs font-bold transition-colors cursor-pointer"
        >
          <ArrowLeft size={16} />
          <span className="hidden sm:inline">Quay lại Bản đồ</span>
        </button>

        <div className="h-5 w-px bg-slate-200 hidden sm:block" />

        {/* Clean Title */}
        <div className="min-w-0">
          <div className="flex items-center gap-2 truncate">
            <span className="text-xs font-bold text-sky-600">
              Mã: {parcel.projectParcelCode || 'B-05272'}
            </span>
            <span className="text-slate-400 text-xs">•</span>
            <h1 className="text-xs sm:text-sm font-extrabold text-slate-900 truncate">
              Số {parcel.houseNumber} {parcel.street}
            </h1>
          </div>
        </div>
      </div>

      {/* Right: Icon-only "Hạng mục chung" Button */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={onOpenMasterView}
          className="p-2 rounded-lg bg-sky-50 hover:bg-sky-100 active:bg-sky-200 border border-sky-200 text-sky-700 transition-all shadow-2xs flex items-center justify-center cursor-pointer"
          title="Khảo sát & Hồ sơ hạng mục dùng chung tòa nhà"
        >
          <Building2 size={18} className="text-sky-600" />
        </button>
      </div>
    </header>
  );
};
