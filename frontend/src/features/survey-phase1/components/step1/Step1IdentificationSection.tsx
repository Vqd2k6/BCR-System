import React, { useState, useEffect, useRef } from 'react';
import { Card } from '../../../../core/components/ui/Card';
import { Input } from '../../../../core/components/ui/FormControls';
import { Building } from 'lucide-react';
import type { Phase1SurveyFormData } from '../../types/phase1.types';

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
  // Hàm hiển thị địa chỉ từ số nhà và tên đường
  const formatAddress = (hn?: string, st?: string) => {
    if (hn && st) {
      return `${hn}, ${st}`;
    }
    return hn || st || '';
  };

  // State cục bộ lưu chuỗi người dùng gõ vào ô địa chỉ, không bao giờ bị trim() khi đang gõ
  const [addressInput, setAddressInput] = useState<string>(() =>
    formatAddress(formData.houseNumber, formData.street)
  );

  // Ref theo dõi giá trị đã đồng bộ từ chính component này
  const lastSyncedRef = useRef({ hn: formData.houseNumber, st: formData.street });

  // Tách số nhà và tên đường từ chuỗi nhập vào
  const parseAddress = (val: string) => {
    if (!val || !val.trim()) {
      return { houseNumber: '', street: '' };
    }
    if (val.includes(',')) {
      const parts = val.split(',');
      const rawHn = parts[0].replace(/^số\s+/i, '').trim();
      const rawSt = parts.slice(1).join(',').trim();
      return { houseNumber: rawHn, street: rawSt };
    }
    // Nếu không có dấu phẩy: tự động tách số nhà ở đầu (VD: "107/4 Trường Chinh" hoặc "245A CMT8")
    const match = val.match(/^\s*(?:Số\s+)?([0-9]+[A-Za-z0-9\/\-]*)(?:\s+(.*))?$/i);
    if (match) {
      return {
        houseNumber: match[1]?.trim() || '',
        street: match[2]?.trim() || '',
      };
    }
    return { houseNumber: '', street: val.trim() };
  };

  // Đồng bộ từ ngoài vào (khi đổi thửa đất hoặc load từ database)
  useEffect(() => {
    if (
      formData.houseNumber !== lastSyncedRef.current.hn ||
      formData.street !== lastSyncedRef.current.st
    ) {
      lastSyncedRef.current = { hn: formData.houseNumber, st: formData.street };
      setAddressInput(formatAddress(formData.houseNumber, formData.street));
    }
  }, [formData.houseNumber, formData.street]);

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
          hint="Mã định danh chuẩn phân đoạn: [LOẠI]-[STT]-[B-XXXX]"
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
          value={addressInput}
          onChange={(e) => {
            const val = e.target.value;
            // Lưu nguyên văn giá trị người dùng gõ (bao gồm phím Space, dấu cách, khoảng trắng)
            setAddressInput(val);

            // Tự động phân tích và đồng bộ vào formData
            const { houseNumber, street } = parseAddress(val);
            lastSyncedRef.current = { hn: houseNumber, st: street };
            updateFormData({ houseNumber, street });
          }}
          onBlur={() => {
            // Khi rời ô nhập liệu: tự động chuẩn hóa dấu phẩy nếu người dùng nhập số nhà và tên đường
            const { houseNumber, street } = parseAddress(addressInput);
            if (houseNumber && street && !addressInput.includes(',')) {
              setAddressInput(`${houseNumber}, ${street}`);
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
