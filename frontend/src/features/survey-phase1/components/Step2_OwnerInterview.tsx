import React from 'react';
import { usePhase1SurveyStore } from '../store/usePhase1SurveyStore';
import { Card } from '../../../core/components/ui/Card';
import { Input, Select } from '../../../core/components/ui/FormControls';
import { Button } from '../../../core/components/ui/Button';
import { Layers, HelpCircle, History } from 'lucide-react';

const USAGE_OPTIONS = [
  'Nhà ở riêng lẻ (Townhouse)',
  'Căn hộ chung cư / Tập thể',
  'Cửa hàng dịch vụ / Buôn bán',
  'Văn phòng công ty / Chi nhánh',
  'Khách sạn / Nhà nghỉ / Lưu trú',
  'Cơ sở giáo dục / Trường học',
  'Cơ sở y tế / Bệnh viện / Phòng khám',
  'Công trình công cộng / Hành chính',
  'Cơ sở sản xuất / Nhà xưởng / Kho',
  'Công trình tôn giáo / Tín ngưỡng',
  'Khác...',
];

const STRUCTURE_SYSTEMS = [
  'Khung BTCT toàn khối + Tường gạch chèn',
  'Khung BTCT bán lắp ghép',
  'Tường gạch chịu lực (Không khung BTCT)',
  'Khung kết cấu thép + Sàn deck/panel',
  'Nhà cấp 4 (Tường gạch mái tôn/ngói)',
  'Kết cấu hỗn hợp / Khác...',
];

const FOUNDATION_TYPES = [
  'Móng cọc BTCT ép',
  'Móng cọc khoan nhồi',
  'Móng băng BTCT',
  'Móng đơn / Móng cốc',
  'Móng bè toàn diện',
  'Móng cọc cừ tràm / Nền gia cố',
  'Chưa rõ / Không có dữ liệu',
];

const CAT_SCORE_DESCRIPTIONS = [
  { score: 1, label: '1 điểm - Chỉ biết năm xây dựng (ước tính), móng chưa rõ' },
  { score: 2, label: '2 điểm - Biết năm & xác định được loại móng sơ bộ' },
  { score: 3, label: '3 điểm - Biết năm, rõ loại móng & kích thước cọc/móng' },
  { score: 4, label: '4 điểm - Đầy đủ năm, loại móng, kích thước + ảnh chụp móng' },
  { score: 5, label: '5 điểm - Có trọn vẹn bản vẽ hoàn công kết cấu móng' },
];

const HISTORY_OPTIONS = [
  { score: 0, label: '0đ - Không có' },
  { score: 1, label: '1đ - Nhẹ / Đã xử lý khắc phục' },
  { score: 2, label: '2đ - Nhiều / Chưa rõ nguyên nhân' },
  { score: 3, label: '3đ - Thay đổi lớn / Sự cố nghiêm trọng' },
];

export const Step2_OwnerInterview: React.FC = () => {
  const { formData, updateFormData, nextStep, prevStep } = usePhase1SurveyStore();
  const hi = formData.historyInterview;

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-12">
      {/* 2.1. Khảo sát kiến trúc & Kết cấu */}
      <Card>
        <div className="flex items-center gap-2 mb-4 pb-2 border-b border-slate-100">
          <Layers className="w-5 h-5 text-emerald-600" />
          <h2 className="text-base sm:text-lg font-bold text-slate-800">
            2.1. Khảo Sát Kiến Trúc, Kết Cấu & Đánh Giá Móng (CAT Score)
          </h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Select
            label="Công Năng Sử Dụng Thực Tế"
            value={formData.usageFunction}
            onChange={(e) => updateFormData({ usageFunction: e.target.value })}
            options={USAGE_OPTIONS.map((u) => ({ value: u, label: u }))}
          />

          <div className="grid grid-cols-2 gap-2">
            <Input
              label="Số Tầng Nổi"
              type="number"
              min={1}
              value={formData.aboveFloors}
              onChange={(e) => updateFormData({ aboveFloors: Number(e.target.value) || 1 })}
              hint="Trệt tính là 1"
            />
            <Input
              label="Số Tầng Ngầm / Hầm"
              type="number"
              min={0}
              value={formData.undergroundFloors}
              onChange={(e) => updateFormData({ undergroundFloors: Number(e.target.value) || 0 })}
            />
          </div>

          <div className="flex items-end gap-3">
            <div className="flex-1">
              <Input
                label="Năm Xây Dựng (Hoàn công)"
                type="number"
                placeholder="VD: 2012"
                value={formData.constructionYear}
                onChange={(e) =>
                  updateFormData({ constructionYear: e.target.value ? Number(e.target.value) : '' })
                }
              />
            </div>
            <label className="flex items-center gap-1.5 text-xs text-slate-600 mb-3 cursor-pointer select-none">
              <input
                type="checkbox"
                checked={formData.isEstimatedYear}
                onChange={(e) => updateFormData({ isEstimatedYear: e.target.checked })}
                className="rounded text-emerald-600 focus:ring-emerald-500"
              />
              <span>Ước tính</span>
            </label>
          </div>

          <Select
            label="Hệ Kết Cấu Chịu Lực Chính"
            value={formData.structureSystem}
            onChange={(e) => updateFormData({ structureSystem: e.target.value })}
            options={STRUCTURE_SYSTEMS.map((s) => ({ value: s, label: s }))}
          />

          <Select
            label="Loại Móng Công Trình"
            value={formData.foundationType}
            onChange={(e) => updateFormData({ foundationType: e.target.value })}
            options={FOUNDATION_TYPES.map((f) => ({ value: f, label: f }))}
          />

          <Input
            label="Kích Thước Móng / Tiết Diện Cọc (mm)"
            placeholder="VD: 250 (nếu cọc 250x250mm)"
            value={formData.pileDimensionMm}
            onChange={(e) =>
              updateFormData({ pileDimensionMm: e.target.value ? Number(e.target.value) : '' })
            }
          />
        </div>

        {/* CAT Móng 1 - 5 Điểm */}
        <div className="mt-5 p-4 rounded-xl border border-emerald-200 bg-emerald-50/40">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-emerald-900 uppercase tracking-wide">
              🎯 Đánh Giá Độ Tin Cậy Dữ Liệu Móng (CAT Móng: 1 - 5 Điểm)
            </span>
            <span className="text-xs font-extrabold text-emerald-700 px-2 py-0.5 rounded bg-emerald-100 border border-emerald-200">
              Điểm: {formData.foundationCatScore}/5
            </span>
          </div>

          <div className="space-y-1.5 mt-2">
            {CAT_SCORE_DESCRIPTIONS.map((cat) => (
              <label
                key={cat.score}
                className={`flex items-center gap-2 p-2.5 rounded-lg border text-xs cursor-pointer transition-all ${
                  formData.foundationCatScore === cat.score
                    ? 'border-emerald-500 bg-white font-semibold text-emerald-900 shadow-sm'
                    : 'border-emerald-100/80 bg-white/60 text-slate-700 hover:bg-white'
                }`}
              >
                <input
                  type="radio"
                  name="foundationCatScore"
                  checked={formData.foundationCatScore === cat.score}
                  onChange={() => updateFormData({ foundationCatScore: cat.score })}
                  className="text-emerald-600 focus:ring-emerald-500"
                />
                <span>{cat.label}</span>
              </label>
            ))}
          </div>
        </div>
      </Card>

      {/* 2.2. Phỏng vấn lịch sử phục vụ riêng tính E5 */}
      <Card>
        <div className="flex items-center gap-2 mb-3 pb-2 border-b border-slate-100">
          <History className="w-5 h-5 text-purple-600" />
          <h2 className="text-base sm:text-lg font-bold text-slate-800">
            2.2. Phỏng Vấn Lịch Sử Sử Dụng & Sự Cố (Phục vụ tự động tính điểm E5)
          </h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Select
            label="1. Cơi nới - Thay đổi tải trọng kết cấu"
            value={hi.renovationLoad}
            onChange={(e) =>
              updateFormData({
                historyInterview: { ...hi, renovationLoad: Number(e.target.value) },
              })
            }
            options={HISTORY_OPTIONS.map((h) => ({ value: h.score, label: h.label }))}
          />

          <Select
            label="2. Sửa chữa lớn - Cải tạo nâng tầng"
            value={hi.majorRepair}
            onChange={(e) =>
              updateFormData({
                historyInterview: { ...hi, majorRepair: Number(e.target.value) },
              })
            }
            options={HISTORY_OPTIONS.map((h) => ({ value: h.score, label: h.label }))}
          />

          <Select
            label="3. Lún - Nghiêng từng xảy ra trước đây"
            value={hi.pastSettlement}
            onChange={(e) =>
              updateFormData({
                historyInterview: { ...hi, pastSettlement: Number(e.target.value) },
              })
            }
            options={HISTORY_OPTIONS.map((h) => ({ value: h.score, label: h.label }))}
          />

          <Select
            label="4. Hư hỏng do công trình láng giềng thi công"
            value={hi.neighborDamage}
            onChange={(e) =>
              updateFormData({
                historyInterview: { ...hi, neighborDamage: Number(e.target.value) },
              })
            }
            options={HISTORY_OPTIONS.map((h) => ({ value: h.score, label: h.label }))}
          />

          <Select
            label="5. Sự cố hỏa hoạn - Ngập lụt nghiêm trọng"
            value={hi.fireFloodIncident}
            onChange={(e) =>
              updateFormData({
                historyInterview: { ...hi, fireFloodIncident: Number(e.target.value) },
              })
            }
            options={HISTORY_OPTIONS.map((h) => ({ value: h.score, label: h.label }))}
          />

          <Select
            label="6. Tình trạng sử dụng hiện tại"
            value={hi.usageStatus}
            onChange={(e) =>
              updateFormData({
                historyInterview: { ...hi, usageStatus: e.target.value },
              })
            }
            options={[
              { value: 'Đầy đủ 100%', label: 'Đang sử dụng đầy đủ 100%' },
              { value: 'Một phần', label: 'Sử dụng một phần (có phòng bỏ trống)' },
              { value: 'Bỏ trống', label: 'Toàn bộ nhà đang bỏ trống / Chờ sửa' },
            ]}
          />
        </div>

        {/* Thiết bị nhạy cảm & 24/7 */}
        <div className="mt-4 pt-3 border-t border-slate-100 flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
          <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={hi.sensitiveEquipment.has}
              onChange={(e) =>
                updateFormData({
                  historyInterview: {
                    ...hi,
                    sensitiveEquipment: { ...hi.sensitiveEquipment, has: e.target.checked },
                  },
                })
              }
              className="rounded text-purple-600 focus:ring-purple-500"
            />
            <span>Có thiết bị / Máy móc nhạy cảm rung chấn</span>
          </label>

          <label className="flex items-center gap-2 text-xs font-semibold text-slate-700 cursor-pointer select-none">
            <input
              type="checkbox"
              checked={hi.continuousOperation247}
              onChange={(e) =>
                updateFormData({
                  historyInterview: { ...hi, continuousOperation247: e.target.checked },
                })
              }
              className="rounded text-purple-600 focus:ring-purple-500"
            />
            <span>Vận hành liên tục 24/7 (Y tế, máy chủ, nghiên cứu...)</span>
          </label>
        </div>
      </Card>

      {/* Navigation Buttons */}
      <div className="flex justify-between pt-4">
        <Button variant="outline" onClick={prevStep}>
          ⬅️ Quay lại Bước 1
        </Button>
        <Button onClick={nextStep}>
          Tiếp tục: Bước 3 (Khảo sát các tầng) ➔
        </Button>
      </div>
    </div>
  );
};
