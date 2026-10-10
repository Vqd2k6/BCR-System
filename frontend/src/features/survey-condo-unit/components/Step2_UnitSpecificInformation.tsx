import React from 'react';
import { useCondoUnitSurveyStore } from '../store/useCondoUnitSurveyStore';
import { isResidentStatus } from '../types/condo-unit.types';
import { Card } from '../../../core/components/ui/Card';
import { Button } from '../../../core/components/ui/Button';
import { Input, Select } from '../../../core/components/ui/FormControls';
import {
  Home,
  User,
  Wrench,
  AlertTriangle,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  Sparkles,
  Phone,
  CreditCard,
  Building,
} from 'lucide-react';

export const Step2_UnitSpecificInformation: React.FC = () => {
  const { formData, updateFormData, nextStep, prevStep } = useCondoUnitSurveyStore();

  const isFormValid =
    Boolean(formData.unitCode?.trim()) &&
    Boolean(formData.ownerName?.trim());

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-12 animate-in fade-in">
      {/* 2.1. Định danh căn hộ con & Tình trạng cư trú */}
      <Card className="border-slate-200 bg-white shadow-xs space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <Home className="w-5 h-5 text-teal-600" />
            <div>
              <h2 className="text-base font-bold text-slate-800">
                2.1. Định Danh Căn Hộ Con & Tình Trạng Cư Trú
              </h2>
              <p className="text-xs text-slate-500">
                Quy ước mã phòng chuẩn hóa: <code className="text-teal-600 font-mono font-bold">mm.nn</code> (trong đó mm là số tầng, nn là số phòng)
              </p>
            </div>
          </div>
          <span className="text-xs font-mono font-bold bg-teal-50 text-teal-700 border border-teal-200 px-2.5 py-1 rounded-lg">
            {formData.parentInfo.projectParcelCode}-U{formData.unitCode || '---'}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <Input
              label="Mã Căn Hộ (mm.nn) *"
              placeholder="VD: 03.03, 12.04"
              value={formData.unitCode || ''}
              onChange={(e) => updateFormData({ unitCode: e.target.value })}
              hint="mm: số tầng, nn: số phòng"
            />
          </div>

          <div>
            <Input
              label="Tầng Lầu (Floor) *"
              type="number"
              min={1}
              max={99}
              value={formData.floorNumber}
              onChange={(e) => updateFormData({ floorNumber: parseInt(e.target.value, 10) || 1 })}
              hint="Tầng trệt tính là 1"
            />
          </div>

          <div>
            <Input
              label="Diện Tích Thông Thủy (m²)"
              type="number"
              step="any"
              min={0}
              placeholder="VD: 75.5"
              value={formData.unitAreaM2 === '' ? '' : formData.unitAreaM2}
              onChange={(e) =>
                updateFormData({
                  unitAreaM2: e.target.value === '' ? '' : Number(e.target.value),
                })
              }
              hint="Theo sổ hồng hoặc HĐMB"
            />
          </div>
        </div>

        <div className="pt-2">
          <Select
            label="Tình Trạng Cư Trú / Sử Dụng Hiện Tại *"
            value={formData.residentStatus}
            onChange={(e) => {
              const val = e.target.value;
              if (isResidentStatus(val)) {
                updateFormData({ residentStatus: val });
              }
            }}
            options={[
              { value: 'CHỦ_HỘ_Ở', label: 'Chủ sở hữu đang sinh sống trực tiếp' },
              { value: 'CHO_THUÊ', label: 'Cho thuê nguyên căn' },
              { value: 'BỎ_TRỐNG_CHƯA_VỀ_Ở', label: 'Căn hộ bỏ trống / Chưa về ở' },
              { value: 'VẮNG_MẶT_KHÓA_CỬA', label: 'Vắng mặt khóa cửa (Đã tiếp cận nhiều lần)' },
            ]}
          />
        </div>
      </Card>

      {/* 2.2. Thông tin chủ sở hữu / Người đại diện ký biên bản */}
      <Card className="border-slate-200 bg-white shadow-xs space-y-4">
        <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
          <User className="w-5 h-5 text-teal-600" />
          <div>
            <h2 className="text-base font-bold text-slate-800">
              2.2. Chủ Sở Hữu / Người Đại Diện Làm Việc
            </h2>
            <p className="text-xs text-slate-500">
              Thông tin người có mặt ký biên bản khảo sát hiện trạng tại căn hộ
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Input
            label="Họ và Tên Người Đại Diện *"
            placeholder="VD: Nguyễn Văn A"
            value={formData.ownerName || ''}
            onChange={(e) => updateFormData({ ownerName: e.target.value })}
          />

          <Input
            label="Số Điện Thoại Liên Hệ"
            placeholder="VD: 0901234567"
            value={formData.ownerPhone || ''}
            onChange={(e) => updateFormData({ ownerPhone: e.target.value })}
          />

          <Input
            label="Số CCCD / Hộ Chiếu"
            placeholder="VD: 079090123456"
            value={formData.ownerIdCard || ''}
            onChange={(e) => updateFormData({ ownerIdCard: e.target.value })}
          />
        </div>
      </Card>

      {/* 2.3. Lịch sử sửa chữa nội thất & Thiết bị nhạy cảm rung chấn */}
      <Card className="border-slate-200 bg-white shadow-xs space-y-4">
        <div className="flex items-center gap-2 pb-3 border-b border-slate-100">
          <Wrench className="w-5 h-5 text-teal-600" />
          <div>
            <h2 className="text-base font-bold text-slate-800">
              2.3. Lịch Sử Sửa Chữa Nội Thất & Thiết Bị Nhạy Cảm
            </h2>
            <p className="text-xs text-slate-500">
              Phân định các hư hỏng do cải tạo trước đây và ghi nhận tài sản nhạy cảm
            </p>
          </div>
        </div>

        {/* Lịch sử sửa chữa nội thất */}
        <div className="space-y-3">
          <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={formData.interiorRenovationHistory?.hasRenovated}
              onChange={(e) =>
                updateFormData({
                  interiorRenovationHistory: {
                    ...formData.interiorRenovationHistory,
                    hasRenovated: e.target.checked,
                  },
                })
              }
              className="rounded text-teal-600 focus:ring-teal-500"
            />
            <span>Căn hộ đã từng sửa chữa, đập thông tường hoặc thay đổi kết cấu nội thất</span>
          </label>

          {formData.interiorRenovationHistory?.hasRenovated && (
            <div className="p-3 bg-amber-50/60 rounded-xl border border-amber-200">
              <Input
                label="Mô tả chi tiết nội dung đã sửa chữa / cải tạo:"
                placeholder="VD: Đập thông tường phòng khách với bếp năm 2024; Lát lại toàn bộ nền gạch..."
                value={formData.interiorRenovationHistory?.description || ''}
                onChange={(e) =>
                  updateFormData({
                    interiorRenovationHistory: {
                      ...formData.interiorRenovationHistory,
                      hasRenovated: true,
                      description: e.target.value,
                    },
                  })
                }
              />
            </div>
          )}
        </div>

        {/* Thiết bị nhạy cảm rung chấn */}
        <div className="pt-3 border-t border-slate-100 space-y-3">
          <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={formData.hasSensitiveEquipment}
              onChange={(e) =>
                updateFormData({
                  hasSensitiveEquipment: e.target.checked,
                })
              }
              className="rounded text-teal-600 focus:ring-teal-500"
            />
            <span>Có Trang thiết bị - Hoạt động nhạy cảm rung chấn (Đàn piano, phòng lab, bể cá lớn...)</span>
          </label>

          {formData.hasSensitiveEquipment && (
            <div className="p-3 bg-teal-50/60 rounded-xl border border-teal-200">
              <Input
                label="Mô tả thiết bị / hoạt động nhạy cảm:"
                placeholder="VD: Đàn dương cầm Grand Piano đặt tại phòng khách; Dàn âm thanh Hi-End..."
                value={formData.sensitiveEquipmentDesc || ''}
                onChange={(e) =>
                  updateFormData({
                    sensitiveEquipmentDesc: e.target.value,
                  })
                }
              />
            </div>
          )}
        </div>
      </Card>

      {/* Action Footer */}
      <div className="flex items-center justify-between gap-4 pt-4 border-t border-slate-200">
        <Button variant="secondary" size="md" onClick={prevStep} icon={<ArrowLeft className="w-4 h-4" />}>
          Bước 1 (Kế thừa tòa mẹ)
        </Button>
        <Button
          size="lg"
          className="bg-teal-600 hover:bg-teal-700 text-white"
          disabled={!isFormValid}
          onClick={nextStep}
          icon={<ArrowRight className="w-4 h-4" />}
        >
          Tiếp tục: Bước 3 (Import CAD & Khuyết tật) ➔
        </Button>
      </div>
    </div>
  );
};
