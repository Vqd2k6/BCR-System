import React from 'react';
import { usePhase1SurveyStore } from '../../survey-phase1/store/usePhase1SurveyStore';
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
  History,
  Zap,
  Users,
} from 'lucide-react';

export const Step3_CondoMasterHistoryAndManagement: React.FC = () => {
  const { formData, updateFormData, nextStep, prevStep, isReadOnly } = usePhase1SurveyStore();
  const hi = formData.historyInterview;

  // Tính toán chỉ số cộng hưởng E5
  const qScores = [
    { name: '1. Cơi nới - thay đổi tải trọng', score: hi?.renovationLoad ?? 0 },
    { name: '2. Sửa chữa lớn - cải tạo', score: hi?.majorRepair ?? 0 },
    { name: '3. Lún - nghiêng trước đây', score: hi?.pastSettlement ?? 0 },
    { name: '4. Hư hỏng do lân cận', score: hi?.neighborDamage ?? 0 },
    { name: '5. Sự cố nghiêm trọng', score: hi?.fireFloodIncident ?? 0 },
  ];

  const maxQScore = Math.max(...qScores.map((q) => q.score));
  const countHigh = qScores.filter((q) => q.score > 2).length;
  const isResonance = countHigh >= 2;
  const calculatedE5 = isResonance ? 4 : maxQScore;

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-12 animate-in fade-in">
      {/* 3.1. Phỏng vấn lịch sử & Yếu tố nhạy cảm (E5) */}
      <Card className="border-indigo-200 bg-white shadow-xs">
        <div className="flex items-center justify-between mb-4 pb-2 border-b border-indigo-100">
          <div className="flex items-center gap-2">
            <History className="w-5 h-5 text-indigo-600" />
            <div>
              <h2 className="text-base sm:text-lg font-bold text-slate-800">
                3.1. Phỏng Vấn Lịch Sử & Yếu Tố Nhạy Cảm (Chỉ Số E5)
              </h2>
              <p className="text-xs text-slate-500">
                Ghi nhận các sự cố lịch sử của toàn bộ khối tháp tòa nhà do Ban Quản Lý / Kỹ thuật cung cấp
              </p>
            </div>
          </div>

          {/* Real-time E5 Badge */}
          <div className="flex items-center gap-2">
            <span
              className={`text-xs font-black px-3 py-1.5 rounded-xl border flex items-center gap-1.5 ${
                isResonance
                  ? 'bg-purple-100 border-purple-300 text-purple-900'
                  : 'bg-indigo-50 border-indigo-200 text-indigo-800'
              }`}
            >
              {isResonance && <Zap className="w-3.5 h-3.5 text-purple-600 fill-purple-600 animate-pulse" />}
              <span>E5 = {calculatedE5}/4</span>
            </span>
          </div>
        </div>

        {/* Risk Resonance Alert Banner */}
        {isResonance && (
          <div className="mb-4 p-3 rounded-xl bg-purple-50 border border-purple-200 text-xs text-purple-900 flex items-start gap-2 animate-in fade-in">
            <Zap className="w-4 h-4 text-purple-600 shrink-0 mt-0.5 fill-purple-600" />
            <div>
              <span className="font-bold">Cộng Hưởng Rủi Ro:</span> Có{' '}
              <strong>{countHigh} trường thông tin</strong> cùng đạt mức nghiêm trọng $\implies$ Chỉ số E5 tự động nâng lên mức <strong>4 (tối đa)</strong>.
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Select
            label="1. Cơi nới - Thay đổi tải trọng trong quá khứ"
            disabled={isReadOnly}
            value={hi?.renovationLoad ?? 0}
            onChange={(e) =>
              updateFormData({
                historyInterview: { ...hi, renovationLoad: Number(e.target.value) },
              })
            }
            options={RENOVATION_OPTIONS.map((h) => ({ value: h.score, label: h.label }))}
          />

          <Select
            label="2. Sửa chữa lớn - Cải tạo kết cấu tòa nhà"
            disabled={isReadOnly}
            value={hi?.majorRepair ?? 0}
            onChange={(e) =>
              updateFormData({
                historyInterview: { ...hi, majorRepair: Number(e.target.value) },
              })
            }
            options={MAJOR_REPAIR_OPTIONS.map((h) => ({ value: h.score, label: h.label }))}
          />

          <Select
            label="3. Lún - Nghiêng ghi nhận trước đây"
            disabled={isReadOnly}
            value={hi?.pastSettlement ?? 0}
            onChange={(e) =>
              updateFormData({
                historyInterview: { ...hi, pastSettlement: Number(e.target.value) },
              })
            }
            options={PAST_SETTLEMENT_OPTIONS.map((h) => ({ value: h.score, label: h.label }))}
          />

          <Select
            label="4. Hư hỏng do công trình lân cận gây ra"
            disabled={isReadOnly}
            value={hi?.neighborDamage ?? 0}
            onChange={(e) =>
              updateFormData({
                historyInterview: { ...hi, neighborDamage: Number(e.target.value) },
              })
            }
            options={NEIGHBOR_DAMAGE_OPTIONS.map((h) => ({ value: h.score, label: h.label }))}
          />

          <Select
            label="5. Sự cố nghiêm trọng (Hỏa hoạn - Ngập lụt - Nổ)"
            disabled={isReadOnly}
            value={hi?.fireFloodIncident ?? 0}
            onChange={(e) =>
              updateFormData({
                historyInterview: { ...hi, fireFloodIncident: Number(e.target.value) },
              })
            }
            options={FIRE_FLOOD_OPTIONS.map((h) => ({ value: h.score, label: h.label }))}
          />

          <Select
            label="Tình trạng sử dụng hiện tại (Occupancy Status)"
            disabled={isReadOnly}
            value={hi?.usageStatus || 'Đầy đủ'}
            onChange={(e) =>
              updateFormData({
                historyInterview: { ...hi, usageStatus: e.target.value },
              })
            }
            options={[
              { value: 'Đầy đủ', label: 'Đầy đủ (Đang vận hành cư dân vào ở)' },
              { value: 'Đang sử dụng một phần', label: 'Đang sử dụng một phần / Bàn giao đợt 1' },
              { value: 'Bỏ trống - Không sử dụng', label: 'Chưa vận hành / Đang nghiệm thu PCCC' },
            ]}
          />
        </div>

        {/* Thiết bị nhạy cảm rung chấn */}
        <div className="mt-4 pt-4 border-t border-slate-100 space-y-3">
          <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer select-none">
            <input
              type="checkbox"
              disabled={isReadOnly}
              checked={Boolean(hi?.sensitiveEquipment?.has)}
              onChange={(e) =>
                updateFormData({
                  historyInterview: {
                    ...hi,
                    sensitiveEquipment: {
                      has: e.target.checked,
                      description: e.target.checked ? hi?.sensitiveEquipment?.description || '' : '',
                    },
                  },
                })
              }
              className="rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer disabled:opacity-50"
            />
            <span>Có Thiết bị - Hoạt động nhạy cảm rung chấn (Server phòng IT, máy phát điện, trạm biến áp, thang máy tốc độ cao...)</span>
          </label>

          {hi?.sensitiveEquipment?.has && (
            <div className="p-3 bg-indigo-50/40 rounded-xl border border-indigo-200">
              <Input
                label="Mô tả thiết bị / khu vực kỹ thuật nhạy cảm:"
                disabled={isReadOnly}
                placeholder="VD: Phòng máy chủ trung tâm tầng hầm, hệ thống thang máy Mitshubishi, trạm biến áp 2000kVA..."
                value={hi.sensitiveEquipment.description}
                onChange={(e) =>
                  updateFormData({
                    historyInterview: {
                      ...hi,
                      sensitiveEquipment: { ...hi.sensitiveEquipment, description: e.target.value },
                    },
                  })
                }
              />
            </div>
          )}
        </div>
      </Card>

      {/* 3.2. Đại diện Ban Quản Lý / Ban Quản Trị Tòa Nhà */}
      <Card className="border-indigo-200 bg-white shadow-xs">
        <div className="flex items-center justify-between gap-2 mb-4 pb-2 border-b border-indigo-100">
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-indigo-600" />
            <h2 className="text-base sm:text-lg font-bold text-slate-800">
              3.2. Thông Tin Ban Quản Lý / Ban Quản Trị Tòa Nhà
            </h2>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input
            label="Họ tên Trưởng Ban Quản Lý / Đại diện BQT"
            disabled={isReadOnly}
            placeholder="VD: Ông Nguyễn Văn An - Trưởng BQL Savills"
            value={formData.managementContactName || ''}
            onChange={(e) => updateFormData({ managementContactName: e.target.value })}
          />

          <Input
            label="Số điện thoại liên hệ BQL / Phòng kỹ thuật"
            disabled={isReadOnly}
            placeholder="VD: 028 3822 xxxx / 0903 xxx xxx"
            value={formData.managementContactPhone || ''}
            onChange={(e) => updateFormData({ managementContactPhone: e.target.value })}
          />
        </div>
      </Card>

      {/* Action Footer */}
      <div className="flex items-center justify-between gap-4 pt-4 border-t border-slate-200">
        <Button variant="secondary" size="md" onClick={prevStep} className="cursor-pointer">
          ◀ Xem Lại Bước 2 (Quy mô & CAT)
        </Button>
        <Button size="lg" className="bg-indigo-600 hover:bg-indigo-700 text-white cursor-pointer" onClick={nextStep}>
          Tiếp tục: Bước 4 (Ranh GIS toà mẹ) ➔
        </Button>
      </div>
    </div>
  );
};
