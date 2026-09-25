import React from 'react';
import { Button } from '../../../../core/components/ui/Button';
import { CheckCircle2, Building2 } from 'lucide-react';

interface Step1SuccessModalsProps {
  showAbsenteeSuccessModal: boolean;
  onCloseAbsentee: () => void;
  showUnderConstructionSuccessModal: boolean;
  onCloseUnderConstruction: () => void;
  showApartmentSuccessModal: boolean;
  onCloseApartment: () => void;
  onOpenCondoHub: () => void;
  buildingCode: string;
}

export const Step1SuccessModals: React.FC<Step1SuccessModalsProps> = ({
  showAbsenteeSuccessModal,
  onCloseAbsentee,
  showUnderConstructionSuccessModal,
  onCloseUnderConstruction,
  showApartmentSuccessModal,
  onCloseApartment,
  onOpenCondoHub,
  buildingCode,
}) => {
  return (
    <>
      {/* Success Modal for Absentee Submission */}
      {showAbsenteeSuccessModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 text-center shadow-2xl border border-slate-200 space-y-4">
            <div className="w-12 h-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-7 h-7" />
            </div>
            <h3 className="text-lg font-bold text-slate-800">
              Đã Nộp Thành Công Báo Cáo Vắng Nhà!
            </h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              Dữ liệu ngoại quan và toàn bộ hình ảnh thực tế của công trình <strong>[{buildingCode}]</strong> đã được đồng bộ lên máy chủ.
            </p>
            <div className="pt-2">
              <Button size="md" className="w-full" onClick={onCloseAbsentee}>
                Hoàn tất khảo sát
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Success Modal for Under Construction Submission */}
      {showUnderConstructionSuccessModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 text-center shadow-2xl border border-slate-200 space-y-4">
            <div className="w-12 h-12 rounded-full bg-orange-100 text-orange-600 flex items-center justify-center mx-auto">
              <CheckCircle2 className="w-7 h-7" />
            </div>
            <h3 className="text-lg font-bold text-slate-800">
              Đã Nộp Thành Công Hồ Sơ Công Trình Đang Xây Dựng!
            </h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              Hiện trạng thi công và toàn bộ hình ảnh thực tế của công trình <strong>[{buildingCode}]</strong> đã được đồng bộ lên máy chủ.
            </p>
            <div className="pt-2">
              <Button size="md" className="w-full bg-orange-600 hover:bg-orange-700 text-white" onClick={onCloseUnderConstruction}>
                Hoàn tất khảo sát
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Success Modal for Apartment Confirmation */}
      {showApartmentSuccessModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 text-center shadow-2xl border border-slate-200 space-y-4">
            <div className="w-12 h-12 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center mx-auto">
              <Building2 className="w-7 h-7" />
            </div>
            <h3 className="text-lg font-bold text-slate-800">
              Đã Xác Nhận Quy Chuẩn Chung Cư Thành Công!
            </h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              Công trình <strong>[{buildingCode}]</strong> đã được thiết lập quy chuẩn quản lý Tòa Nhà Chung Cư / Nhiều Căn Hộ.
            </p>
            <div className="grid grid-cols-2 gap-3 pt-2">
              <Button variant="secondary" size="md" onClick={onCloseApartment}>
                Về trang chủ
              </Button>
              <Button
                size="md"
                className="bg-blue-600 hover:bg-blue-700 text-white"
                onClick={onOpenCondoHub}
                icon={<Building2 className="w-4 h-4" />}
              >
                Hub chung cư
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
