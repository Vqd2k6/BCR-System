import React from 'react';
import { Card } from '../../../../core/components/ui/Card';
import { Input } from '../../../../core/components/ui/FormControls';
import { Building } from 'lucide-react';
import { Phase1SurveyFormData } from '../../types/phase1.types';

interface Step1IdentificationSectionProps {
  formData: Phase1SurveyFormData;
  updateFormData: (updates: Partial<Phase1SurveyFormData>) => void;
  currentCase: string;
}

export const Step1IdentificationSection: React.FC<Step1IdentificationSectionProps> = ({
  formData,
  updateFormData,
  currentCase,
}) => {
  return (
    <Card className="border-slate-200 bg-white shadow-xs">
      <div className="flex items-center gap-2 mb-4 pb-2 border-b border-slate-100">
        <Building className="w-5 h-5 text-emerald-600" />
        <h2 className="text-base sm:text-lg font-bold text-slate-800">
          1.1. Thông Tin Nhận Diện & Định Danh Công Trình *
        </h2>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Input
          id="input-projectParcelCode"
          label="Mã Quản Lý Dự Án (Project Parcel Code) *"
          value={formData.projectParcelCode}
          disabled
          hint="Tự động cấp từ hệ thống theo lý trình"
        />
        <Input
          id="input-officialCadastralCode"
          label="Mã Địa Chính Gốc (Cadastral Code) *"
          value={formData.officialCadastralCode}
          disabled
          hint="Số tờ - Số thửa bản đồ địa chính nhà nước"
        />

        <Input
          id="input-buildingName"
          label="Tên Công Trình / Biển Hiệu Riêng (Building Name) *"
          placeholder="VD: Cửa hàng tiện lợi, Nhà thuốc, Nhà ở gia đình..."
          value={formData.buildingName}
          onChange={(e) => updateFormData({ buildingName: e.target.value })}
        />

        <Input
          id="input-address"
          label="Địa Chỉ Thực Tế Hiện Trường (Address) *"
          placeholder="Số nhà, Tên đường (Đối chiếu sơ đồ quy hoạch)"
          value={formData.houseNumber ? `${formData.houseNumber}, ${formData.street}` : (formData.street || '')}
          onChange={(e) => {
            const val = e.target.value;
            if (!val || val.trim() === '') {
              updateFormData({ houseNumber: '', street: '' });
              return;
            }
            const parts = val.split(',');
            if (parts.length > 1) {
              updateFormData({ houseNumber: parts[0].trim(), street: parts.slice(1).join(',').trim() });
            } else {
              updateFormData({ houseNumber: '', street: val });
            }
          }}
        />

        <div className="sm:col-span-2">
          <Input
            id="input-ownerName"
            label="Chủ Sở Hữu / Người Sử Dụng (Owner / User) *"
            placeholder={currentCase === 'ABSENTEE' ? 'Chủ hộ vắng mặt (nếu biết tên thì ghi)' : 'Nguyễn Văn A'}
            value={formData.ownerName}
            onChange={(e) => updateFormData({ ownerName: e.target.value })}
          />
        </div>
      </div>
    </Card>
  );
};
