import React, { useState } from 'react';
import { usePhase1SurveyStore } from '../../survey-phase1/store/usePhase1SurveyStore';
import { Card } from '../../../core/components/ui/Card';
import { Button } from '../../../core/components/ui/Button';
import { Input, Select } from '../../../core/components/ui/FormControls';
import { InfoPopover } from '../../../core/components/ui/InfoPopover';
import {
  Building2,
  Layers,
  ShieldAlert,
  ArrowRight,
  Info,
  CheckCircle2,
  Users,
  Phone,
  LayoutGrid,
} from 'lucide-react';
import {
  CONDO_USAGE_FUNCTIONS,
  CONDO_FOUNDATION_TYPES,
  CONDO_STRUCTURAL_SYSTEMS,
} from '../types/condo-master.types';

export const Step2_CondoMasterInterview: React.FC = () => {
  const { formData, updateFormData, nextStep, prevStep } = usePhase1SurveyStore();
  const [customStructural, setCustomStructural] = useState(
    CONDO_STRUCTURAL_SYSTEMS.includes(formData.structureSystem as any) ? '' : formData.structureSystem
  );

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-12 animate-in fade-in">
      {/* 2.1. Công năng sử dụng tòa nhà chung cư */}
      <Card className="border-indigo-200 bg-white shadow-xs">
        <div className="flex items-center justify-between gap-2 mb-4 pb-2 border-b border-indigo-100">
          <div className="flex items-center gap-2">
            <Building2 className="w-5 h-5 text-indigo-600" />
            <h2 className="text-base sm:text-lg font-bold text-slate-800">
              2.1. Công Năng Sử Dụng Tòa Nhà Tổng Thể
            </h2>
          </div>
          <span className="text-xs bg-indigo-50 text-indigo-700 font-bold px-2.5 py-1 rounded-full border border-indigo-200">
            Quy chuẩn Chung Cư / Cao Tầng
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Select
            label="Phân loại công năng sử dụng *"
            value={formData.usageFunction}
            onChange={(e) => updateFormData({ usageFunction: e.target.value })}
            options={CONDO_USAGE_FUNCTIONS.map((f) => ({ value: f, label: f }))}
          />

          <div className="p-3 bg-indigo-50/50 rounded-xl border border-indigo-100 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-indigo-100 text-indigo-700 shrink-0">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div className="text-xs text-slate-600 leading-relaxed">
              <strong className="text-indigo-900 block font-semibold">Tự động cố định theo quy chuẩn</strong>
              Công năng được cố định cho toàn bộ khối tháp. Các căn hộ con sẽ được ghi nhận chi tiết ở biểu mẫu riêng.
            </div>
          </div>
        </div>
      </Card>

      {/* 2.2. Quy mô tầng & Số căn mỗi tầng */}
      <Card className="border-indigo-200 bg-white shadow-xs">
        <div className="flex items-center justify-between gap-2 mb-4 pb-2 border-b border-indigo-100">
          <div className="flex items-center gap-2">
            <Layers className="w-5 h-5 text-indigo-600" />
            <h2 className="text-base sm:text-lg font-bold text-slate-800">
              2.2. Quy Mô Tòa Nhà & Quản Lý Căn Hộ
            </h2>
          </div>
          <InfoPopover title="Thống kê căn hộ phục vụ kiểm soát căn con">
            <p className="text-xs leading-relaxed">
              Số căn mỗi tầng và tổng số tầng nổi là căn cứ để hệ thống tự động sinh và quản lý danh sách các Căn hộ con (Building Units) trong Hub Chung Cư.
            </p>
          </InfoPopover>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <Input
            label="Số tầng nổi *"
            type="number"
            min={1}
            value={formData.aboveFloors}
            onChange={(e) => updateFormData({ aboveFloors: Number(e.target.value) || 1 })}
          />

          <Input
            label="Số tầng hầm"
            type="number"
            min={0}
            value={formData.undergroundFloors}
            onChange={(e) => updateFormData({ undergroundFloors: Number(e.target.value) || 0 })}
          />

          <Input
            label="Số căn mỗi tầng *"
            type="number"
            min={1}
            placeholder="VD: 8 căn/tầng"
            value={formData.unitsPerFloor}
            onChange={(e) => updateFormData({ unitsPerFloor: Number(e.target.value) || '' })}
          />

          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex flex-col justify-center">
            <span className="text-[11px] font-semibold text-slate-500 flex items-center gap-1">
              <LayoutGrid className="w-3.5 h-3.5 text-indigo-600" />
              Tổng số căn ước tính
            </span>
            <span className="text-base font-bold text-indigo-700 mt-0.5">
              {formData.totalUnitsCount ? `${formData.totalUnitsCount} căn` : 'Tự động tính'}
            </span>
          </div>
        </div>
      </Card>

      {/* 2.3. Loại móng công trình cao tầng (V2) */}
      <Card className="border-indigo-200 bg-white shadow-xs">
        <div className="flex items-center justify-between gap-2 mb-4 pb-2 border-b border-indigo-100">
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-indigo-600" />
            <h2 className="text-base sm:text-lg font-bold text-slate-800">
              2.3. Loại Móng Công Trình (Chỉ số V2)
            </h2>
          </div>
          <InfoPopover title="Đánh giá mức độ tổn thương móng cao tầng (V2)">
            <p className="text-xs leading-relaxed">
              Chung cư cao tầng thường sử dụng móng cọc khoan nhồi sâu hoặc tường vây barrette vào tầng cuội sỏi, có độ ổn định cao trước rung chấn khi đào hầm Metro Line 2.
            </p>
          </InfoPopover>
        </div>

        <div className="space-y-3">
          <Select
            label="Giải pháp móng công trình *"
            value={formData.foundationType}
            onChange={(e) => updateFormData({ foundationType: e.target.value })}
            options={CONDO_FOUNDATION_TYPES.map((f) => ({ value: f, label: f }))}
          />
        </div>
      </Card>

      {/* 2.4. Hệ kết cấu chịu lực (E1) */}
      <Card className="border-indigo-200 bg-white shadow-xs">
        <div className="flex items-center justify-between gap-2 mb-4 pb-2 border-b border-indigo-100">
          <div className="flex items-center gap-2">
            <Building2 className="w-5 h-5 text-indigo-600" />
            <h2 className="text-base sm:text-lg font-bold text-slate-800">
              2.4. Hệ Kết Cấu Chịu Lực Tòa Nhà (Chỉ số E1)
            </h2>
          </div>
        </div>

        <div className="space-y-3">
          <Select
            label="Hệ kết cấu chịu lực chính *"
            value={CONDO_STRUCTURAL_SYSTEMS.includes(formData.structureSystem as any) ? formData.structureSystem : 'Khác'}
            onChange={(e) => {
              if (e.target.value === 'Khác') {
                updateFormData({ structureSystem: customStructural || 'Kết cấu đặc biệt khác' });
              } else {
                updateFormData({ structureSystem: e.target.value });
              }
            }}
            options={CONDO_STRUCTURAL_SYSTEMS.map((s) => ({ value: s, label: s }))}
          />

          {(formData.structureSystem === 'Khác' || !CONDO_STRUCTURAL_SYSTEMS.includes(formData.structureSystem as any)) && (
            <Input
              label="Mô tả chi tiết hệ kết cấu chịu lực khác *"
              placeholder="VD: Khung dầm BTCT kết hợp sàn bóng dự ứng lực..."
              value={customStructural}
              onChange={(e) => {
                setCustomStructural(e.target.value);
                updateFormData({ structureSystem: e.target.value });
              }}
            />
          )}
        </div>
      </Card>

      {/* 2.5. Đại diện Ban Quản Lý / Ban Quản Trị Tòa Nhà */}
      <Card className="border-indigo-200 bg-white shadow-xs">
        <div className="flex items-center justify-between gap-2 mb-4 pb-2 border-b border-indigo-100">
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-indigo-600" />
            <h2 className="text-base sm:text-lg font-bold text-slate-800">
              2.5. Thông Tin Ban Quản Lý / Ban Quản Trị Tòa Nhà
            </h2>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input
            label="Họ tên Trưởng Ban Quản Lý / Đại diện BQT"
            placeholder="VD: Ông Trần Văn Minh - Trưởng BQL"
            value={formData.managementContactName || ''}
            onChange={(e) => updateFormData({ managementContactName: e.target.value })}
          />

          <Input
            label="Số điện thoại liên hệ BQL / Phòng kỹ thuật"
            placeholder="VD: 028 3822 xxxx / 0903 xxx xxx"
            value={formData.managementContactPhone || ''}
            onChange={(e) => updateFormData({ managementContactPhone: e.target.value })}
          />
        </div>
      </Card>

      {/* Action Footer */}
      <div className="flex items-center justify-between gap-4 pt-4 border-t border-slate-200">
        <Button variant="secondary" size="md" onClick={prevStep}>
          ◀ Xem Lại Bước 1 (Ngoại quan toà)
        </Button>
        <Button size="lg" className="bg-indigo-600 hover:bg-indigo-700 text-white" onClick={nextStep}>
          Tiếp tục: Bước 3 (Khảo sát các vùng dùng chung) ➔
        </Button>
      </div>
    </div>
  );
};
