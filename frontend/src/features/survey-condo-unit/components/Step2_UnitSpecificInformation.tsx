import React from 'react';
import { useCondoUnitSurveyStore } from '../store/useCondoUnitSurveyStore';
import { Card } from '../../../core/components/ui/Card';
import { Button } from '../../../core/components/ui/Button';
import { Input, Select } from '../../../core/components/ui/FormControls';
import { PhotoCaptureInput } from '../../../components/common/PhotoCaptureInput';
import {
  Home,
  User,
  Phone,
  Camera,
  Activity,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  AlertCircle,
  FileBadge,
} from 'lucide-react';

export const Step2_UnitSpecificInformation: React.FC = () => {
  const { formData, updateFormData, nextStep, prevStep } = useCondoUnitSurveyStore();

  const isFormValid =
    Boolean(formData.unitCode?.trim()) &&
    Boolean(formData.ownerName?.trim()) &&
    Boolean(formData.photoP01?.url || formData.photoP01?.notApplicable) &&
    Boolean(formData.photoP04?.url || formData.photoP04?.notApplicable);

  return (
    <div className="space-y-6 max-w-3xl mx-auto pb-12 animate-in fade-in">
      {/* 2.1. Định danh căn hộ con */}
      <Card className="border-slate-200 bg-white shadow-xs">
        <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <Home className="w-5 h-5 text-teal-600" />
            <h2 className="text-base font-bold text-slate-800">
              2.1. Định Danh Căn Hộ Con (Unit Attributes)
            </h2>
          </div>
          <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded font-medium">
            Lược bỏ địa chỉ toà nhà
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <Input
            label="Mã Căn Hộ (Unit Code) *"
            placeholder="VD: P.1204, A-08"
            value={formData.unitCode}
            onChange={(e) => updateFormData({ unitCode: e.target.value })}
          />

          <Input
            label="Tầng / Lầu (Floor) *"
            type="number"
            min={1}
            value={formData.floorNumber}
            onChange={(e) => updateFormData({ floorNumber: Number(e.target.value) || 1 })}
          />

          <Input
            label="Diện tích (m²)"
            type="number"
            min={10}
            value={formData.unitAreaM2}
            onChange={(e) => updateFormData({ unitAreaM2: Number(e.target.value) || '' })}
          />

          <Select
            label="Ban công hướng Metro"
            value={formData.balconyFacingMetro}
            onChange={(e) => updateFormData({ balconyFacingMetro: e.target.value as any })}
            options={[
              { value: 'YES', label: 'Có (Nhìn về ray)' },
              { value: 'NO', label: 'Không (Hướng khác)' },
              { value: 'UNKNOWN', label: 'Không rõ' },
            ]}
          />
        </div>
      </Card>

      {/* 2.2. Thông tin chủ hộ căn hộ */}
      <Card className="border-slate-200 bg-white shadow-xs">
        <div className="flex items-center gap-2 pb-3 mb-4 border-b border-slate-100">
          <User className="w-5 h-5 text-teal-600" />
          <h2 className="text-base font-bold text-slate-800">
            2.2. Chủ Sở Hữu / Người Sử Dụng Căn Hộ
          </h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Input
            label="Họ và Tên Chủ Hộ *"
            placeholder="VD: Nguyễn Văn B"
            value={formData.ownerName}
            onChange={(e) => updateFormData({ ownerName: e.target.value })}
          />

          <Input
            label="Số Điện Thoại Liên Hệ"
            placeholder="VD: 0912 xxx xxx"
            value={formData.ownerPhone}
            onChange={(e) => updateFormData({ ownerPhone: e.target.value })}
          />

          <Input
            label="Số CCCD / CMND / Hộ Chiếu"
            placeholder="VD: 079 xxx xxx xxx"
            value={formData.ownerIdCard}
            onChange={(e) => updateFormData({ ownerIdCard: e.target.value })}
          />
        </div>
      </Card>

      {/* 2.3. Bộ 2 ảnh định danh căn hộ: Chỉ cần P01 và P04 */}
      <Card className="border-slate-200 bg-white shadow-xs">
        <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <Camera className="w-5 h-5 text-teal-600" />
            <h2 className="text-base font-bold text-slate-800">
              2.3. Bộ Ảnh Định Danh Căn Hộ (Chỉ Cần 2 Ảnh P01 & P04)
            </h2>
          </div>
          <span className="text-xs bg-teal-50 text-teal-700 font-bold px-2 py-0.5 rounded border border-teal-200">
            Quy chuẩn căn hộ con
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Ảnh P01: Cửa chính căn hộ từ hành lang */}
          <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <Camera className="w-4 h-4 text-teal-600" />
                Ảnh P01: Cửa chính từ hành lang *
              </span>
              <label className="flex items-center gap-1 text-[11px] text-slate-500 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.photoP01.notApplicable}
                  onChange={(e) =>
                    updateFormData({
                      photoP01: { ...formData.photoP01, notApplicable: e.target.checked },
                    })
                  }
                  className="rounded text-teal-600"
                />
                <span>N/A</span>
              </label>
            </div>
            <p className="text-[11px] text-slate-500">
              Chụp rõ cửa chính căn hộ cùng biển số căn (VD: {formData.unitCode || 'P.---'}) từ hành lang chung.
            </p>
            <PhotoCaptureInput
              label="Chụp / Tải ảnh P01"
              value={formData.photoP01.url}
              onChange={(url) => updateFormData({ photoP01: { ...formData.photoP01, url } })}
              watermarkText={`CONDO_P01 | ${formData.unitCode || 'UNIT'} | T${formData.floorNumber}`}
              height="160px"
            />
          </div>

          {/* Ảnh P04: Toàn cảnh nội thất phòng khách */}
          <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                <Camera className="w-4 h-4 text-teal-600" />
                Ảnh P04: Toàn cảnh phòng khách *
              </span>
              <label className="flex items-center gap-1 text-[11px] text-slate-500 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.photoP04.notApplicable}
                  onChange={(e) =>
                    updateFormData({
                      photoP04: { ...formData.photoP04, notApplicable: e.target.checked },
                    })
                  }
                  className="rounded text-teal-600"
                />
                <span>N/A</span>
              </label>
            </div>
            <p className="text-[11px] text-slate-500">
              Chụp góc rộng toàn cảnh không gian sinh hoạt chính / phòng khách bên trong căn hộ.
            </p>
            <PhotoCaptureInput
              label="Chụp / Tải ảnh P04"
              value={formData.photoP04.url}
              onChange={(url) => updateFormData({ photoP04: { ...formData.photoP04, url } })}
              watermarkText={`CONDO_P04 | ${formData.unitCode || 'UNIT'} | T${formData.floorNumber}`}
              height="160px"
            />
          </div>
        </div>
      </Card>

      {/* 2.4. Thiết bị & Hoạt động nhạy cảm riêng tại căn hộ */}
      <Card className="border-slate-200 bg-white shadow-xs">
        <div className="flex items-center gap-2 pb-3 mb-4 border-b border-slate-100">
          <Activity className="w-5 h-5 text-amber-600" />
          <h2 className="text-base font-bold text-slate-800">
            2.4. Thiết Bị & Hoạt Động Nhạy Cảm Tại Căn Hộ
          </h2>
        </div>

        <div className="space-y-3">
          <label className="flex items-start gap-2.5 cursor-pointer p-3 bg-slate-50 rounded-xl border border-slate-200 hover:bg-amber-50/50 hover:border-amber-200 transition-colors">
            <input
              type="checkbox"
              checked={formData.hasSensitiveEquipment}
              onChange={(e) => updateFormData({ hasSensitiveEquipment: e.target.checked })}
              className="mt-0.5 rounded text-amber-600 focus:ring-amber-500 w-4 h-4"
            />
            <div className="text-xs text-slate-700 leading-relaxed">
              <strong className="block text-slate-900 font-semibold mb-0.5">
                Căn hộ có thiết bị đặc biệt hoặc hoạt động nhạy cảm với rung chấn
              </strong>
              VD: Phòng thu âm cách âm, bể cá thủy sinh kích thước lớn, đàn đại dương cầm (Grand Piano), thiết bị y tế/nha khoa tại gia, máy chủ sever, phòng thí nghiệm nhỏ...
            </div>
          </label>

          {formData.hasSensitiveEquipment && (
            <div className="pt-2 animate-in fade-in">
              <Input
                label="Mô tả cụ thể loại thiết bị & vị trí đặt trong căn hộ *"
                placeholder="VD: Phòng thu âm gia đình tại phòng ngủ nhỏ; Bể cá 800L tại phòng khách..."
                value={formData.sensitiveEquipmentDesc}
                onChange={(e) => updateFormData({ sensitiveEquipmentDesc: e.target.value })}
              />
            </div>
          )}
        </div>
      </Card>

      {/* Action Footer */}
      <div className="flex items-center justify-between gap-4 pt-4 border-t border-slate-200">
        <Button variant="secondary" size="md" onClick={prevStep}>
          ◀ Bước 1 (Toà cha)
        </Button>
        <Button
          size="lg"
          className="bg-teal-600 hover:bg-teal-700 text-white"
          disabled={!isFormValid}
          onClick={nextStep}
        >
          Tiếp tục: Bước 3 (Khuyết tật & Lún nứt căn hộ) ➔
        </Button>
      </div>
    </div>
  );
};
