import React from 'react';
import { AlertTriangle, Building2 } from 'lucide-react';
import type { GisParcel } from '../../../gis/LeafletSweepMap';

interface MasterWarningBannerProps {
  parcel: GisParcel;
  isMasterSurveyDone: boolean;
  onClose: () => void;
  onStartMasterSurvey: (parcel: GisParcel) => void;
}

export const MasterWarningBanner: React.FC<MasterWarningBannerProps> = ({
  parcel,
  isMasterSurveyDone,
  onClose,
  onStartMasterSurvey,
}) => {
  if (isMasterSurveyDone) return null;

  return (
    <div className="bg-amber-50/90 border-2 border-amber-300 rounded-2xl p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm animate-in fade-in">
      <div className="flex items-start gap-3.5">
        <div className="w-11 h-11 rounded-xl bg-amber-100 border border-amber-300 text-amber-800 flex items-center justify-center flex-shrink-0 mt-0.5 shadow-2xs">
          <AlertTriangle size={22} className="text-amber-600" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <h4 className="text-sm sm:text-base font-extrabold text-amber-950">
              Bạn Chưa Khảo Sát Tổng Quan Chung Cư (Khối Tháp Dùng Chung)
            </h4>
            <span className="bg-amber-200/80 text-amber-900 font-bold px-2 py-0.5 rounded text-[10px] border border-amber-300 uppercase">
              Chưa Khảo Sát
            </span>
          </div>
          <p className="text-xs text-amber-800 mt-1 leading-relaxed max-w-2xl">
            Khối tháp dùng chung có thể được khảo sát song song độc lập với các căn hộ con. Khảo sát viên có thể thực hiện <strong>Khảo sát tổng quan tòa nhà</strong> (kết cấu chịu lực, móng, bộ 4 ảnh mặt đứng P01–P04, không gian dùng chung) để hệ thống tự động liên kết khi xuất báo cáo.
          </p>
        </div>
      </div>
      <button
        type="button"
        onClick={() => {
          onClose();
          onStartMasterSurvey(parcel);
        }}
        className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl bg-amber-600 hover:bg-amber-700 active:scale-95 text-white text-xs font-bold shadow-md shadow-amber-600/20 transition-all shrink-0 cursor-pointer self-start sm:self-auto"
      >
        <Building2 size={16} />
        <span>Mở Wizard Khảo Sát Tổng Quan</span>
      </button>
    </div>
  );
};
