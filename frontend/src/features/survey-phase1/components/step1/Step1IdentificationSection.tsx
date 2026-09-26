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
          placeholder="VD: 107/4, Trường Chinh hoặc 245A Cách Mạng Tháng 8"
          value={
            formData.houseNumber && formData.street
              ? `${formData.houseNumber}, ${formData.street}`
              : (formData.houseNumber || formData.street || '')
          }
          onChange={(e) => {
            const val = e.target.value;
            if (!val || val.trim() === '') {
              updateFormData({ houseNumber: '', street: '' });
              return;
            }
            if (val.includes(',')) {
              const parts = val.split(',');
              const rawHn = parts[0].replace(/^số\s+/i, '').trim();
              const rawSt = parts.slice(1).join(',').trim();
              updateFormData({ houseNumber: rawHn, street: rawSt });
            } else {
              // Nhận diện tự động nếu người dùng gõ số nhà và tên đường không có dấu phẩy
              const match = val.trim().match(/^(?:Số\s+)?([0-9]+[A-Za-z0-9\/\-]*)\s+(.+)$/i);
              if (match) {
                updateFormData({ houseNumber: match[1].trim(), street: match[2].trim() });
              } else {
                updateFormData({ houseNumber: '', street: val.trim() });
              }
            }
          }}
          hint="Nhập số nhà và tên đường thực tế đối chiếu tại hiện trường"
        />

        <Input
          id="input-ownerName"
          label="Chủ Sở Hữu / Người Sử Dụng (Owner / User) *"
          placeholder={currentCase === 'ABSENTEE' ? 'Chủ hộ vắng mặt (nếu biết tên thì ghi)' : 'Nguyễn Văn A'}
          value={formData.ownerName || ''}
          onChange={(e) => updateFormData({ ownerName: e.target.value })}
          hint="Tên chủ sở hữu hoặc người đang trực tiếp sử dụng công trình"
        />

        <Input
          id="input-ownerPhone"
          label="Số Điện Thoại Liên Hệ (Owner Phone)"
          type="tel"
          placeholder="VD: 0912 345 678"
          value={formData.ownerPhone || ''}
          onChange={(e) => updateFormData({ ownerPhone: e.target.value })}
          hint="Số điện thoại của chủ hộ hoặc người đang trực tiếp sử dụng"
        />
      </div>
    </Card>
  );
};
