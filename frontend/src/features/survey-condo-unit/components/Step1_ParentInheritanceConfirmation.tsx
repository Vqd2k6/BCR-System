import React from 'react';
import { usePhase1SurveyStore } from '../../survey-phase1/store/usePhase1SurveyStore';
import { Card } from '../../../core/components/ui/Card';
import { Button } from '../../../core/components/ui/Button';
import {
  Building2,
  CheckCircle2,
  ArrowRight,
  ShieldCheck,
} from 'lucide-react';

export const Step1_ParentInheritanceConfirmation: React.FC = () => {
  const { formData, updateFormData, setCurrentStep } = usePhase1SurveyStore();
  const parent = formData.parentBuildingInfo;

  const handleConfirm = () => {
    updateFormData({
      parentBuildingInfo: {
        ...(formData.parentBuildingInfo || {
          buildingName: formData.buildingName,
          projectParcelCode: formData.projectParcelCode,
          officialCadastralCode: formData.officialCadastralCode,
          address: `${formData.houseNumber} ${formData.street}`.trim(),
          chainage: formData.chainage,
          metroOffsetDistance: formData.metroOffsetDistance,
        }),
        isConfirmed: true,
      },
    });
    setCurrentStep(2);
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-12 animate-in fade-in">
      {/* Banner Giới thiệu nguyên tắc OOP */}
      <div className="p-4 bg-teal-50 border border-teal-200 rounded-2xl flex items-start gap-3">
        <div className="p-2 rounded-xl bg-teal-100 text-teal-700 shrink-0 mt-0.5">
          <ShieldCheck className="w-5 h-5" />
        </div>
        <div className="text-xs text-teal-900 leading-relaxed space-y-1">
          <p className="font-bold text-sm text-teal-950">
            Nguyên Tắc Kế Thừa Dữ Liệu Tòa Nhà Mẹ (Parent-Child Inheritance)
          </p>
          <p>
            Căn hộ con nằm trong cùng một khối tháp chịu tác động chung về tuyến ray Metro Line 2, kết cấu móng và lý trình. Khảo sát viên chỉ cần đối soát thông tin tòa nhà mẹ và nhấn xác nhận để bắt đầu ghi nhận các thuộc tính riêng của căn hộ.
          </p>
        </div>
      </div>

      {/* Card Thông tin toà chung cư cha */}
      <Card className="border-slate-200 bg-white shadow-xs space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <Building2 className="w-5 h-5 text-teal-600" />
            <h2 className="text-base font-bold text-slate-800">
              Thông Tin Định Danh Tòa Nhà Chung Cư Mẹ
            </h2>
          </div>
          <span className="text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-full flex items-center gap-1">
            <CheckCircle2 className="w-3 h-3" />
            Đã đồng bộ từ GIS
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 text-xs">
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
            <span className="text-slate-500 block font-medium">Mã Quản Lý Dự Án (Parent Parcel Code)</span>
            <span className="text-sm font-bold text-teal-700 font-mono mt-0.5 block">
              {parent?.projectParcelCode || formData.projectParcelCode || 'Đang cập nhật'}
            </span>
          </div>

          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
            <span className="text-slate-500 block font-medium">Mã Địa Chính Gốc (Cadastral Code)</span>
            <span className="text-sm font-bold text-slate-800 font-mono mt-0.5 block">
              {parent?.officialCadastralCode || formData.officialCadastralCode || 'Đang cập nhật'}
            </span>
          </div>

          <div className="sm:col-span-2 p-3 bg-slate-50 rounded-xl border border-slate-200">
            <span className="text-slate-500 block font-medium">Tên Công Trình / Khối Tháp Chung Cư</span>
            <span className="text-sm font-bold text-slate-800 mt-0.5 block">
              {parent?.buildingName || formData.buildingName || 'Tòa Nhà Chung Cư Cao Tầng'}
            </span>
          </div>

          <div className="sm:col-span-2 p-3 bg-slate-50 rounded-xl border border-slate-200">
            <span className="text-slate-500 block font-medium">Địa Chỉ Thực Tế Toàn Tòa Nhà</span>
            <span className="text-sm font-bold text-slate-800 mt-0.5 block">
              {parent?.address || (formData.houseNumber ? `${formData.houseNumber}, ` : '') + (formData.street || 'Chưa cập nhật địa chỉ')}
            </span>
          </div>

          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
            <span className="text-slate-500 block font-medium">Lý Trình Tuyến Metro (Chainage)</span>
            <span className="text-sm font-bold text-slate-800 mt-0.5 block">
              {parent?.chainage || formData.chainage || 'Km 3+450'}
            </span>
          </div>

          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
            <span className="text-slate-500 block font-medium">Cự Ly Tới Tim Hầm Metro</span>
            <span className="text-sm font-bold text-teal-700 mt-0.5 block">
              {parent?.metroOffsetDistance || formData.metroOffsetDistance || '12.5m'}
            </span>
          </div>
        </div>
      </Card>

      {/* Nút hành động xác nhận */}
      <div className="pt-2 flex justify-end">
        <Button
          size="lg"
          className="bg-teal-600 hover:bg-teal-700 text-white w-full sm:w-auto shadow-xs"
          onClick={handleConfirm}
          icon={<ArrowRight className="w-4 h-4" />}
        >
          Xác Nhận Đúng Tòa Nhà & Điền Thông Tin Căn Hộ Con ➔
        </Button>
      </div>
    </div>
  );
};
