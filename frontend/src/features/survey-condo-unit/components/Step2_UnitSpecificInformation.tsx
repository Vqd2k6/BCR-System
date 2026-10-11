import React from 'react';
import { useCondoUnitSurveyStore } from '../store/useCondoUnitSurveyStore';
import { isResidentStatus } from '../types/condo-unit.types';
import { Card } from '../../../core/components/ui/Card';
import { Button } from '../../../core/components/ui/Button';
import { Input, Select } from '../../../core/components/ui/FormControls';
import {
  RENOVATION_OPTIONS,
  MAJOR_REPAIR_OPTIONS,
  PAST_SETTLEMENT_OPTIONS,
  NEIGHBOR_DAMAGE_OPTIONS,
  FIRE_FLOOD_OPTIONS,
} from '../../survey-phase1/constants/historyInterviewConstants';
import {
  Home,
  User,
  History,
  Zap,
  AlertTriangle,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  Sparkles,
  Phone,
  CreditCard,
  Building,
} from 'lucide-react';
import { useSurveyReadOnly } from '../../../core/context/SurveyReadOnlyContext';

export const Step2_UnitSpecificInformation: React.FC = () => {
  const { formData, updateFormData, nextStep, prevStep, isReadOnly: storeReadOnly } = useCondoUnitSurveyStore();
  const contextReadOnly = useSurveyReadOnly();
  const isReadOnly = contextReadOnly ?? storeReadOnly;
  const hi = formData.historyInterview;

  // Real-time E5 calculation
  const qScores = [
    { name: '1. Cơi nới - Thay đổi tải trọng', score: hi.renovationLoad ?? 0 },
    { name: '2. Sửa chữa lớn - Cải tạo kết cấu', score: hi.majorRepair ?? 0 },
    { name: '3. Lún - Nghiêng ghi nhận trước đây', score: hi.pastSettlement ?? 0 },
    { name: '4. Hư hỏng do căn hộ lân cận', score: hi.neighborDamage ?? 0 },
    { name: '5. Sự cố nghiêm trọng', score: hi.fireFloodIncident ?? 0 },
  ];
  const maxQScore = Math.max(...qScores.map((q) => q.score));
  const countHigh = qScores.filter((q) => q.score > 2).length;
  const isResonance = countHigh >= 2;
  const calculatedE5 = isResonance ? 4 : maxQScore;

  const isFormValid =
    Boolean(formData.unitCode?.trim()) &&
    Boolean(formData.displayCode?.trim()) &&
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

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div id="input-displayCode">
            <Input
              label="Biển Số Thực Tế (Ảnh P01) *"
              placeholder="VD: 303, P.303, L.01"
              value={formData.displayCode || ''}
              onChange={(e) => updateFormData({ displayCode: e.target.value })}
              hint="Số phòng thực tế cư dân ký BCS"
            />
          </div>

          <div id="input-unitCode">
            <Input
              label="Mã Vị Trí CAD (mm.nn) *"
              placeholder="VD: 03.03, 12.04"
              value={formData.unitCode || ''}
              onChange={(e) => updateFormData({ unitCode: e.target.value })}
              hint="Mã quy hoạch tọa độ bản vẽ"
            />
          </div>

          <div>
            <Input
              label="Tầng Lầu (Floor) *"
              type="number"
              step="any"
              min={-4}
              max={99}
              value={formData.floorNumber}
              onChange={(e) => updateFormData({ floorNumber: parseFloat(e.target.value) || 1 })}
              hint="Trệt: 0, Lửng: 0.5, Lầu: 1, 2..."
            />
          </div>

          <div>
            <Input
              label="Diện Tích Căn Hộ (m²)"
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
          <div id="input-ownerName">
            <Input
              label="Họ và Tên Người Đại Diện *"
              placeholder="VD: Nguyễn Văn A"
              value={formData.ownerName || ''}
              onChange={(e) => updateFormData({ ownerName: e.target.value })}
            />
          </div>

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

      {/* 2.3. Lịch sử sửa chữa nội thất & Yếu tố nhạy cảm theo chuẩn Phase 1 & TCVN */}
      <Card className="border-slate-200 bg-white shadow-xs space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <History className="w-5 h-5 text-teal-600" />
            <div>
              <h2 className="text-base font-bold text-slate-800">
                2.3. Lịch Sử Căn Hộ & Yếu Tố Nhạy Cảm (TCVN & CRLG)
              </h2>
              <p className="text-xs text-slate-500">
                5 câu hỏi phỏng vấn quá khứ theo chuẩn mực TCVN và ghi nhận tài sản nhạy cảm rung chấn
              </p>
            </div>
          </div>

          {/* Real-time E5 Badge */}
          <div className="flex items-center gap-2">
            <span
              className={`text-xs font-black px-3 py-1.5 rounded-xl border flex items-center gap-1.5 transition-colors ${
                isResonance
                  ? 'bg-purple-100 border-purple-300 text-purple-900 shadow-xs'
                  : 'bg-slate-100 border-slate-200 text-slate-800'
              }`}
            >
              {isResonance && <Zap className="w-3.5 h-3.5 text-purple-600 fill-purple-600 animate-pulse" />}
              <span>E5 = {calculatedE5}/4</span>
            </span>
          </div>
        </div>

        {/* Risk Resonance Alert Banner */}
        {isResonance && (
          <div className="p-3 rounded-xl bg-purple-50 border border-purple-200 text-xs text-purple-900 flex items-start gap-2.5 animate-in fade-in">
            <Zap className="w-4 h-4 text-purple-600 flex-shrink-0 mt-0.5 fill-purple-600" />
            <div>
              <span className="font-bold">Cộng Hưởng Rủi Ro:</span> Có{' '}
              <strong>{countHigh} trường thông tin</strong> cùng đạt mức nghiêm trọng &rarr; Chỉ số E5 tự động nâng lên mức <strong>4 (tối đa)</strong>.
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Select
            label="1. Cơi nới - Thay đổi tải trọng trong quá khứ"
            value={hi.renovationLoad ?? 0}
            onChange={(e) =>
              updateFormData({
                historyInterview: { ...hi, renovationLoad: Number(e.target.value) },
              })
            }
            options={RENOVATION_OPTIONS.map((h) => ({ value: h.score, label: h.label }))}
          />

          <Select
            label="2. Sửa chữa lớn - Cải tạo kết cấu căn hộ"
            value={hi.majorRepair ?? 0}
            onChange={(e) =>
              updateFormData({
                historyInterview: { ...hi, majorRepair: Number(e.target.value) },
              })
            }
            options={MAJOR_REPAIR_OPTIONS.map((h) => ({ value: h.score, label: h.label }))}
          />

          <Select
            label="3. Lún - Nghiêng ghi nhận trước đây"
            value={hi.pastSettlement ?? 0}
            onChange={(e) =>
              updateFormData({
                historyInterview: { ...hi, pastSettlement: Number(e.target.value) },
              })
            }
            options={PAST_SETTLEMENT_OPTIONS.map((h) => ({ value: h.score, label: h.label }))}
          />

          <Select
            label="4. Hư hỏng do căn hộ / công trình lân cận"
            value={hi.neighborDamage ?? 0}
            onChange={(e) =>
              updateFormData({
                historyInterview: { ...hi, neighborDamage: Number(e.target.value) },
              })
            }
            options={NEIGHBOR_DAMAGE_OPTIONS.map((h) => ({ value: h.score, label: h.label }))}
          />

          <Select
            label="5. Sự cố nghiêm trọng (Hỏa hoạn - Ngập lụt - Nổ)"
            value={hi.fireFloodIncident ?? 0}
            onChange={(e) =>
              updateFormData({
                historyInterview: { ...hi, fireFloodIncident: Number(e.target.value) },
              })
            }
            options={FIRE_FLOOD_OPTIONS.map((h) => ({ value: h.score, label: h.label }))}
          />

          <Select
            label="Tình trạng sử dụng hiện tại (Occupancy Status)"
            value={hi.usageStatus || 'Đầy đủ'}
            onChange={(e) =>
              updateFormData({
                historyInterview: { ...hi, usageStatus: e.target.value },
              })
            }
            options={[
              { value: 'Đầy đủ', label: 'Đầy đủ' },
              { value: 'Đang sử dụng một phần', label: 'Đang sử dụng một phần' },
              { value: 'Bỏ trống - Không sử dụng', label: 'Bỏ trống - Không sử dụng' },
            ]}
          />
        </div>

        {/* Chi tiết nội dung cải tạo nếu có */}
        {(hi.renovationLoad > 0 || hi.majorRepair > 0 || formData.interiorRenovationHistory?.hasRenovated) && (
          <div className="p-3 bg-amber-50/70 rounded-xl border border-amber-200 animate-in fade-in space-y-1.5">
            <label className="text-xs font-semibold text-amber-900 block">
              Mô tả chi tiết nội dung đã sửa chữa / cải tạo nội thất:
            </label>
            <Input
              placeholder="VD: Đập thông tường phòng khách với bếp năm 2024; Lát lại sàn gạch, dời vị trí bồn rửa..."
              value={hi.renovationDescription || formData.interiorRenovationHistory?.description || ''}
              onChange={(e) => {
                const desc = e.target.value;
                updateFormData({
                  historyInterview: { ...hi, renovationDescription: desc },
                  interiorRenovationHistory: {
                    hasRenovated: true,
                    description: desc,
                  },
                });
              }}
            />
          </div>
        )}

        {/* Hoạt động vận hành liên tục 24/7 (Phục vụ tính V6) */}
        <div className="pt-3 border-t border-slate-100 space-y-2">
          <label className="flex items-start gap-2.5 text-xs font-semibold text-slate-700 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={Boolean(hi.continuousOperation247)}
              onChange={(e) =>
                updateFormData({
                  historyInterview: { ...hi, continuousOperation247: e.target.checked },
                })
              }
              className="mt-0.5 rounded text-teal-600 focus:ring-teal-500 w-4 h-4"
            />
            <div>
              <span className="font-semibold text-slate-800">Căn hộ có hoạt động hoặc thiết bị vận hành liên tục 24/7 (Căn cứ tính chỉ số rủi ro V6)</span>
              <p className="text-[11px] text-slate-500 font-normal mt-0.5">
                Ví dụ: Thiết bị y tế hỗ trợ sự sống tại gia, phòng máy chủ mini, hồ sinh vật cảnh cao cấp không thể gián đoạn nguồn cấp.
              </p>
            </div>
          </label>
        </div>

        {/* Thiết bị nhạy cảm rung chấn */}
        <div className="pt-3 border-t border-slate-100 space-y-3">
          <label className="flex items-start gap-2.5 text-xs font-semibold text-slate-700 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={Boolean(hi.sensitiveEquipment?.has ?? formData.hasSensitiveEquipment)}
              onChange={(e) => {
                const checked = e.target.checked;
                updateFormData({
                  historyInterview: {
                    ...hi,
                    sensitiveEquipment: {
                      has: checked,
                      description: checked
                        ? (hi.sensitiveEquipment?.description || formData.sensitiveEquipmentDesc || '')
                        : '',
                    },
                  },
                  hasSensitiveEquipment: checked,
                  sensitiveEquipmentDesc: checked
                    ? (hi.sensitiveEquipment?.description || formData.sensitiveEquipmentDesc || '')
                    : '',
                });
              }}
              className="mt-0.5 rounded text-teal-600 focus:ring-teal-500 w-4 h-4"
            />
            <div>
              <span className="font-semibold text-slate-800">Có Trang thiết bị - Hoạt động nhạy cảm rung chấn</span>
              <p className="text-[11px] text-slate-500 font-normal mt-0.5">
                Đàn dương cầm Grand Piano, phòng thu/phòng lab, hồ cá lớn, thiết bị âm thanh Hi-End, đồ cổ quý hiếm.
              </p>
            </div>
          </label>

          {(hi.sensitiveEquipment?.has ?? formData.hasSensitiveEquipment) && (
            <div id="input-sensitiveEquipment" className="p-3 bg-teal-50/60 rounded-xl border border-teal-200 animate-in fade-in">
              <Input
                label="Mô tả thiết bị / hoạt động nhạy cảm:"
                placeholder="VD: Đàn dương cầm Grand Piano đặt tại phòng khách; Dàn âm thanh Hi-End..."
                value={hi.sensitiveEquipment?.description || formData.sensitiveEquipmentDesc || ''}
                onChange={(e) => {
                  const desc = e.target.value;
                  updateFormData({
                    historyInterview: {
                      ...hi,
                      sensitiveEquipment: { has: true, description: desc },
                    },
                    sensitiveEquipmentDesc: desc,
                    hasSensitiveEquipment: true,
                  });
                }}
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
          disabled={!isReadOnly && !isFormValid}
          onClick={nextStep}
          icon={<ArrowRight className="w-4 h-4" />}
        >
          Tiếp tục: Bước 3 (Import CAD & Khuyết tật) ➔
        </Button>
      </div>
    </div>
  );
};
