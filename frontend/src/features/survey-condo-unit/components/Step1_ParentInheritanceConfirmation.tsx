import React from 'react';
import { useCondoUnitSurveyStore } from '../store/useCondoUnitSurveyStore';
import { Card } from '../../../core/components/ui/Card';
import { Button } from '../../../core/components/ui/Button';
import { PhotoCaptureInput } from '../../../components/common/PhotoCaptureInput';
import {
  Building2,
  CheckCircle2,
  ArrowRight,
  ShieldCheck,
  Camera,
  Layers,
  MapPin,
} from 'lucide-react';

export const Step1_ParentInheritanceConfirmation: React.FC = () => {
  const { formData, updateFormData, nextStep } = useCondoUnitSurveyStore();
  const parent = formData.parentInfo;

  const handleConfirm = () => {
    updateFormData({
      parentInfo: {
        ...parent,
        isConfirmed: true,
      },
    });
    nextStep();
  };

  const isStep1Valid = Boolean(
    formData.photoP01?.url || formData.photoP01?.notApplicable
  );

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-12 animate-in fade-in">
      {/* Banner Giới thiệu nguyên tắc Khảo Sát Độc Lập & Kế Thừa Dữ Liệu Tòa Nhà Mẹ */}
      <div className="p-4 bg-teal-50 border border-teal-200 rounded-2xl flex items-start gap-3 shadow-2xs">
        <div className="p-2 rounded-xl bg-teal-100 text-teal-700 shrink-0 mt-0.5">
          <ShieldCheck className="w-5 h-5" />
        </div>
        <div className="text-xs text-teal-900 leading-relaxed space-y-1">
          <p className="font-bold text-sm text-teal-950">
            Khảo Sát Độc Lập & Tự Động Liên Kết Khi Xuất Báo Cáo
          </p>
          <p>
            Căn hộ con có thể tiến hành khảo sát hiện trường độc lập ngay lập tức mà không cần chờ khảo sát khối tháp dùng chung hoàn tất. Toàn bộ thông số móng cọc, cự ly hầm Metro và bộ ảnh mặt đứng tòa nhà sẽ được hệ thống tự động truy xuất và nhúng vào báo cáo khi xuất bản (Phase 1 BCS Report).
          </p>
        </div>
      </div>

      {/* Card 1: Thông tin toà chung cư cha (Read-only) */}
      <Card className="border-slate-200 bg-white shadow-xs space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <Building2 className="w-5 h-5 text-teal-600" />
            <h2 className="text-base font-bold text-slate-800">
              1.1. Thông Tin Định Danh Tòa Nhà Chung Cư Mẹ
            </h2>
          </div>
          <span className="text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 px-2.5 py-0.5 rounded-full flex items-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5" />
            Đã đồng bộ từ GIS
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
            <span className="text-slate-500 block font-medium">Mã Quản Lý Dự Án (Parent Parcel Code)</span>
            <span className="text-sm font-bold text-teal-700 font-mono mt-0.5 block">
              {parent.projectParcelCode || 'Đang cập nhật'}
            </span>
          </div>

          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
            <span className="text-slate-500 block font-medium">Mã Địa Chính Gốc (Cadastral Code)</span>
            <span className="text-sm font-bold text-slate-800 font-mono mt-0.5 block">
              {parent.officialCadastralCode || 'Đang cập nhật'}
            </span>
          </div>

          <div className="sm:col-span-2 p-3 bg-slate-50 rounded-xl border border-slate-200">
            <span className="text-slate-500 block font-medium">Tên Công Trình / Khối Tháp Chung Cư</span>
            <span className="text-sm font-bold text-slate-800 mt-0.5 block">
              {parent.buildingName || 'Tòa Nhà Chung Cư Cao Tầng'}
            </span>
          </div>

          <div className="sm:col-span-2 p-3 bg-slate-50 rounded-xl border border-slate-200">
            <span className="text-slate-500 block font-medium">Địa Chỉ Thực Tế Toàn Tòa Nhà</span>
            <span className="text-sm font-bold text-slate-800 mt-0.5 block">
              {parent.address || 'Chưa cập nhật địa chỉ'}
            </span>
          </div>

          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
            <span className="text-slate-500 block font-medium">Lý Trình Tuyến Metro (Chainage)</span>
            <span className="text-sm font-bold text-slate-800 mt-0.5 block">
              {parent.chainage || 'Km 3+450'}
            </span>
          </div>

          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
            <span className="text-slate-500 block font-medium">Cự Ly Tới Tim Hầm Metro</span>
            <span className="text-sm font-bold text-teal-700 mt-0.5 block">
              {parent.metroOffsetDistance || '12.5m'}
            </span>
          </div>
        </div>
      </Card>

      {/* Card 2: Bộ 2 ảnh nhận diện cửa căn hộ và hành lang */}
      <Card className="border-slate-200 bg-white shadow-xs space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <Camera className="w-5 h-5 text-teal-600" />
            <div>
              <h2 className="text-base font-bold text-slate-800">
                1.2. Bộ 2 Ảnh Nhận Diện Cửa Căn Hộ & Lối Đi Hành Lang
              </h2>
              <p className="text-xs text-slate-500">
                Chụp ảnh nhận diện tiếp cận thực địa theo quy chuẩn pháp lý dự án Metro
              </p>
            </div>
          </div>
          <span className="text-xs bg-slate-100 text-slate-700 font-bold px-2 py-0.5 rounded">
            Căn {formData.unitCode} • Tầng {formData.floorNumber}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Ảnh P01: Biển số phòng trên cửa căn hộ */}
          <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <Camera className="w-4 h-4 text-teal-600" />
                Ảnh P01: Biển số phòng gắn trên cửa *
              </span>
              <label className="flex items-center gap-1 text-[11px] text-slate-500 cursor-pointer">
                <input
                  type="checkbox"
                  checked={Boolean(formData.photoP01?.notApplicable)}
                  onChange={(e) =>
                    updateFormData({
                      photoP01: { ...formData.photoP01, notApplicable: e.target.checked },
                    })
                  }
                  className="rounded text-teal-600 focus:ring-teal-500"
                />
                <span>N/A</span>
              </label>
            </div>
            <p className="text-[11px] text-slate-500">
              Đứng trước cửa căn hộ chụp cận cảnh rõ biển số phòng (VD: {formData.unitCode}) và ổ khóa cửa chính.
            </p>
            <PhotoCaptureInput
              label="Chụp / Tải ảnh P01"
              value={formData.photoP01?.url || ''}
              onChange={(url) => updateFormData({ photoP01: { ...formData.photoP01, url } })}
              watermarkText={`CONDO_P01 | Căn ${formData.unitCode} | Tầng ${formData.floorNumber}`}
              height="150px"
            />
          </div>

          {/* Ảnh P04: Tổng quan cửa căn hộ thấy rõ số nhà và lối đi hành lang */}
          <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <Camera className="w-4 h-4 text-teal-600" />
                Ảnh P04: Cửa căn hộ & Lối đi hành lang *
              </span>
              <label className="flex items-center gap-1 text-[11px] text-slate-500 cursor-pointer">
                <input
                  type="checkbox"
                  checked={Boolean(formData.photoP04?.notApplicable)}
                  onChange={(e) =>
                    updateFormData({
                      photoP04: { ...formData.photoP04, notApplicable: e.target.checked },
                    })
                  }
                  className="rounded text-teal-600 focus:ring-teal-500"
                />
                <span>N/A</span>
              </label>
            </div>
            <p className="text-[11px] text-slate-500">
              Chụp lùi xa từ hành lang chung bao quát toàn bộ cửa chính căn hộ và bối cảnh hành lang tiếp cận.
            </p>
            <PhotoCaptureInput
              label="Chụp / Tải ảnh P04"
              value={formData.photoP04?.url || ''}
              onChange={(url) => updateFormData({ photoP04: { ...formData.photoP04, url } })}
              watermarkText={`CONDO_P04 | Căn ${formData.unitCode} | Tầng ${formData.floorNumber}`}
              height="150px"
            />
          </div>
        </div>
      </Card>

      {/* Nút hành động chuyển sang Bước 2 */}
      <div className="pt-2 flex justify-end">
        <Button
          size="lg"
          className="bg-teal-600 hover:bg-teal-700 text-white w-full sm:w-auto shadow-xs"
          onClick={handleConfirm}
          disabled={!isStep1Valid}
          icon={<ArrowRight className="w-4 h-4" />}
        >
          Xác Nhận Đúng Tòa Nhà & Điền Thông Tin Căn Hộ Con ➔
        </Button>
      </div>
    </div>
  );
};
