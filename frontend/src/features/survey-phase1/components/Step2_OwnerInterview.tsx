import React, { useState } from 'react';
import { usePhase1SurveyStore } from '../store/usePhase1SurveyStore';
import { Card } from '../../../core/components/ui/Card';
import { Input, Select } from '../../../core/components/ui/FormControls';
import { Button } from '../../../core/components/ui/Button';
import { PhotoCaptureInput } from '../../../components/common/PhotoCaptureInput';
import {
  Layers,
  HelpCircle,
  History,
  FileCheck,
  FileX,
  Zap,
  CheckCircle2,
  AlertTriangle,
  UploadCloud,
} from 'lucide-react';

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

const HISTORY_OPTIONS = [
  { score: 0, label: '0đ – Không có' },
  { score: 1, label: '1đ – Nhẹ / Đã xử lý khắc phục' },
  { score: 2, label: '2đ – Nhiều / Chưa rõ nguyên nhân' },
  { score: 3, label: '3đ – Thay đổi lớn / Sự cố nghiêm trọng' },
];

export const Step2_OwnerInterview: React.FC = () => {
  const { formData, updateFormData, nextStep, prevStep } = usePhase1SurveyStore();
  const hi = formData.historyInterview;

  // State for CAT Drawing options
  const [hasDrawingOption, setHasDrawingOption] = useState<'HAS_DRAWING' | 'NO_DRAWING' | 'UNKNOWN'>(
    formData.foundationCatScore === 1 || formData.foundationCatScore === 2
      ? 'HAS_DRAWING'
      : formData.foundationCatScore === 3 || formData.foundationCatScore === 4
      ? 'NO_DRAWING'
      : 'UNKNOWN'
  );

  // E5 Resonance calculation preview
  const qScores = [
    { name: '1. Cơi nới - thay đổi tải trọng', score: hi.renovationLoad ?? 0 },
    { name: '2. Sửa chữa lớn - cải tạo', score: hi.majorRepair ?? 0 },
    { name: '3. Lún - nghiêng trước đây', score: hi.pastSettlement ?? 0 },
    { name: '4. Hư hỏng do lân cận', score: hi.neighborDamage ?? 0 },
    { name: '5. Sự cố nghiêm trọng', score: hi.fireFloodIncident ?? 0 },
  ];

  const maxQScore = Math.max(...qScores.map((q) => q.score));
  const maxQCount = qScores.filter((q) => q.score === maxQScore && q.score > 0).length;
  const isResonance = maxQScore > 0 && maxQCount >= 2;
  const calculatedE5 = isResonance ? Math.min(maxQScore + 1, 4) : maxQScore;

  // Handle CAT score selection
  const handleSelectCatScore = (score: number) => {
    updateFormData({ foundationCatScore: score });
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-12">
      {/* 2.1. Khảo sát kiến trúc & Kết cấu & CAT Móng */}
      <Card>
        <div className="flex items-center gap-2 mb-4 pb-2 border-b border-slate-100">
          <Layers className="w-5 h-5 text-emerald-600" />
          <div>
            <h2 className="text-base sm:text-lg font-bold text-slate-800">
              2.1. Khảo Sát Kiến Trúc, Kết Cấu & Đánh Giá Độ Tin Cậy Dữ Liệu Móng (CAT Móng)
            </h2>
            <p className="text-xs text-slate-500">
              Phỏng vấn chủ sở hữu và quan sát thực địa. Căn cứ tự động đánh giá chỉ số V2, V3, V4.
            </p>
          </div>
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

        {/* CƠ CHẾ ĐÁNH GIÁ CAT MÓNG THEO ĐÚNG SPEC YÊU CẦU */}
        <div className="mt-5 p-4 rounded-2xl border-2 border-emerald-200 bg-emerald-50/40 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileCheck className="w-5 h-5 text-emerald-700" />
              <h3 className="text-xs sm:text-sm font-bold text-emerald-950 uppercase tracking-wide">
                🎯 Cơ Chế Đánh Giá Mức Độ Tin Cậy Móng (CAT Score: 1 - 5 Điểm)
              </h3>
            </div>
            <span className="text-xs font-black px-3 py-1 rounded-full bg-emerald-600 text-white shadow-sm">
              CAT Móng: Mức {formData.foundationCatScore} ({formData.foundationCatScore}đ)
            </span>
          </div>

          {/* 3 Main Branches: Có bản vẽ hoàn công / Không có bản vẽ (N/A) / Không có thông tin */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            <button
              type="button"
              onClick={() => {
                setHasDrawingOption('HAS_DRAWING');
                if (formData.foundationCatScore > 2) handleSelectCatScore(1);
              }}
              className={`p-3 rounded-xl border text-left transition-all ${
                hasDrawingOption === 'HAS_DRAWING'
                  ? 'border-emerald-500 bg-white ring-2 ring-emerald-400 font-semibold text-emerald-950 shadow-sm'
                  : 'border-slate-200 bg-white/70 hover:bg-white text-slate-700'
              }`}
            >
              <div className="flex items-center gap-1.5 font-bold text-xs mb-1">
                <FileCheck className="w-4 h-4 text-emerald-600" />
                <span>Có bản vẽ hoàn công</span>
              </div>
              <p className="text-[11px] text-slate-500">Mức 1 hoặc Mức 2</p>
            </button>

            <button
              type="button"
              onClick={() => {
                setHasDrawingOption('NO_DRAWING');
                if (formData.foundationCatScore <= 2 || formData.foundationCatScore === 5) {
                  handleSelectCatScore(3);
                }
              }}
              className={`p-3 rounded-xl border text-left transition-all ${
                hasDrawingOption === 'NO_DRAWING'
                  ? 'border-emerald-500 bg-white ring-2 ring-emerald-400 font-semibold text-emerald-950 shadow-sm'
                  : 'border-slate-200 bg-white/70 hover:bg-white text-slate-700'
              }`}
            >
              <div className="flex items-center gap-1.5 font-bold text-xs mb-1">
                <FileX className="w-4 h-4 text-amber-600" />
                <span>N/A Không có bản vẽ</span>
              </div>
              <p className="text-[11px] text-slate-500">Mức 3 hoặc Mức 4</p>
            </button>

            <button
              type="button"
              onClick={() => {
                setHasDrawingOption('UNKNOWN');
                handleSelectCatScore(5);
              }}
              className={`p-3 rounded-xl border text-left transition-all ${
                hasDrawingOption === 'UNKNOWN'
                  ? 'border-red-400 bg-white ring-2 ring-red-400 font-semibold text-red-950 shadow-sm'
                  : 'border-slate-200 bg-white/70 hover:bg-white text-slate-700'
              }`}
            >
              <div className="flex items-center gap-1.5 font-bold text-xs mb-1">
                <AlertTriangle className="w-4 h-4 text-red-600" />
                <span>Không có thông tin</span>
              </div>
              <p className="text-[11px] text-slate-500">Mức 5 (Mặc định rủi ro)</p>
            </button>
          </div>

          {/* Detailed Branch Sub-Options */}
          {hasDrawingOption === 'HAS_DRAWING' && (
            <div className="p-3.5 rounded-xl bg-white border border-emerald-200 space-y-2.5 animate-in fade-in">
              <span className="text-xs font-bold text-slate-700 block">
                Nguồn gốc & Mức độ xác thực của bản vẽ hoàn công:
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => handleSelectCatScore(1)}
                  className={`p-2.5 rounded-lg border text-left transition-all ${
                    formData.foundationCatScore === 1
                      ? 'border-emerald-600 bg-emerald-50 text-emerald-900 font-bold ring-1 ring-emerald-500'
                      : 'border-slate-200 hover:bg-slate-50 text-slate-700 text-xs'
                  }`}
                >
                  <div className="text-xs font-bold">Mức 1 (1đ) - Xác nhận từ chính quyền</div>
                  <div className="text-[11px] text-slate-500 font-normal">
                    Bản vẽ hoàn công được cơ quan thẩm quyền / hồ sơ lưu trữ cấp phép phê duyệt.
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => handleSelectCatScore(2)}
                  className={`p-2.5 rounded-lg border text-left transition-all ${
                    formData.foundationCatScore === 2
                      ? 'border-emerald-600 bg-emerald-50 text-emerald-900 font-bold ring-1 ring-emerald-500'
                      : 'border-slate-200 hover:bg-slate-50 text-slate-700 text-xs'
                  }`}
                >
                  <div className="text-xs font-bold">Mức 2 (2đ) - Do chủ nhà cung cấp</div>
                  <div className="text-[11px] text-slate-500 font-normal">
                    Có bản vẽ hoàn công qua phỏng vấn chủ nhà (bản vẽ thi công riêng của gia đình).
                  </div>
                </button>
              </div>
            </div>
          )}

          {hasDrawingOption === 'NO_DRAWING' && (
            <div className="p-3.5 rounded-xl bg-white border border-amber-200 space-y-2.5 animate-in fade-in">
              <span className="text-xs font-bold text-slate-700 block">
                Phương pháp thu thập thông tin móng (Khi không có bản vẽ):
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => handleSelectCatScore(3)}
                  className={`p-2.5 rounded-lg border text-left transition-all ${
                    formData.foundationCatScore === 3
                      ? 'border-amber-600 bg-amber-50 text-amber-900 font-bold ring-1 ring-amber-500'
                      : 'border-slate-200 hover:bg-slate-50 text-slate-700 text-xs'
                  }`}
                >
                  <div className="text-xs font-bold">Mức 3 (3đ) - Phỏng vấn chủ nhà</div>
                  <div className="text-[11px] text-slate-500 font-normal">
                    Chủ nhà nhớ và cung cấp thông tin rõ ràng về loại móng, chiều dài cọc, năm thi công.
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => handleSelectCatScore(4)}
                  className={`p-2.5 rounded-lg border text-left transition-all ${
                    formData.foundationCatScore === 4
                      ? 'border-amber-600 bg-amber-50 text-amber-900 font-bold ring-1 ring-amber-500'
                      : 'border-slate-200 hover:bg-slate-50 text-slate-700 text-xs'
                  }`}
                >
                  <div className="text-xs font-bold">Mức 4 (4đ) - Suy luận từ kinh nghiệm</div>
                  <div className="text-[11px] text-slate-500 font-normal">
                    Khảo sát viên suy đoán loại móng dựa trên quy mô số tầng, kết cấu và niên đại khu vực.
                  </div>
                </button>
              </div>
            </div>
          )}

          {hasDrawingOption === 'UNKNOWN' && (
            <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-800 animate-in fade-in">
              <strong>Mức 5 (5đ) - Không có thông tin:</strong> Hoàn toàn không xác định được loại móng, kích thước cọc và không có bản vẽ. Hệ thống xếp vào nhóm rủi ro cao nhất cho chỉ số V3.
            </div>
          )}
        </div>
      </Card>

      {/* 2.2. Phỏng vấn lịch sử & Cơ chế tính E5 cộng hưởng */}
      <Card>
        <div className="flex items-center justify-between mb-4 pb-2 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <History className="w-5 h-5 text-purple-600" />
            <div>
              <h2 className="text-base sm:text-lg font-bold text-slate-800">
                2.2. Phỏng Vấn Lịch Sử Sử Dụng & Sự Cố (Tự động tính điểm E5)
              </h2>
              <p className="text-xs text-slate-500">
                Điểm E5 = Max(5 câu hỏi). Nếu có từ 2 yếu tố cùng đạt Max &gt; 0, hệ thống tự cộng hưởng +1 điểm.
              </p>
            </div>
          </div>

          {/* Real-time E5 Badge */}
          <div className="flex items-center gap-2">
            <span
              className={`text-xs font-black px-3 py-1.5 rounded-xl border flex items-center gap-1.5 ${
                isResonance
                  ? 'bg-purple-100 border-purple-300 text-purple-900'
                  : 'bg-slate-100 border-slate-200 text-slate-800'
              }`}
            >
              {isResonance && <Zap className="w-3.5 h-3.5 text-purple-600 fill-purple-600 animate-pulse" />}
              <span>E5 = {calculatedE5}/4đ</span>
            </span>
          </div>
        </div>

        {/* Risk Resonance Alert Banner */}
        {isResonance && (
          <div className="mb-4 p-3 rounded-xl bg-purple-50 border border-purple-200 text-xs text-purple-900 flex items-start gap-2 animate-in fade-in">
            <Zap className="w-4 h-4 text-purple-600 flex-shrink-0 mt-0.5 fill-purple-600" />
            <div>
              <span className="font-bold">Kích hoạt quy tắc Cộng Hưởng Rủi Ro (+1 điểm):</span> Có{' '}
              <strong>{maxQCount} yếu tố lịch sử</strong> cùng đạt mức điểm tối đa ({maxQScore}đ) $\implies$ Điểm E5
              được gia tăng lên <strong>{calculatedE5} điểm</strong> (tối đa 4).
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Select
            label="1. Cơi nới - Thay đổi tải trọng trong quá khứ"
            value={hi.renovationLoad}
            onChange={(e) =>
              updateFormData({
                historyInterview: { ...hi, renovationLoad: Number(e.target.value) },
              })
            }
            options={HISTORY_OPTIONS.map((h) => ({ value: h.score, label: h.label }))}
          />

          <Select
            label="2. Sửa chữa lớn - Cải tạo kết cấu"
            value={hi.majorRepair}
            onChange={(e) =>
              updateFormData({
                historyInterview: { ...hi, majorRepair: Number(e.target.value) },
              })
            }
            options={HISTORY_OPTIONS.map((h) => ({ value: h.score, label: h.label }))}
          />

          <Select
            label="3. Lún - Nghiêng ghi nhận trước đây"
            value={hi.pastSettlement}
            onChange={(e) =>
              updateFormData({
                historyInterview: { ...hi, pastSettlement: Number(e.target.value) },
              })
            }
            options={HISTORY_OPTIONS.map((h) => ({ value: h.score, label: h.label }))}
          />

          <Select
            label="4. Hư hỏng do công trình lân cận gây ra"
            value={hi.neighborDamage}
            onChange={(e) =>
              updateFormData({
                historyInterview: { ...hi, neighborDamage: Number(e.target.value) },
              })
            }
            options={HISTORY_OPTIONS.map((h) => ({ value: h.score, label: h.label }))}
          />

          <Select
            label="5. Sự cố nghiêm trọng (Hỏa hoạn - Ngập lụt - Nổ)"
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

        {/* Thiết bị nhạy cảm & Vận hành 24/7 (Phục vụ V6) */}
        <div className="mt-4 pt-4 border-t border-slate-100 flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
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
            <span>Có thiết bị / Máy móc nhạy cảm rung chấn (Ảnh hưởng chỉ số V6)</span>
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
            <span>Vận hành liên tục 24/7 (Y tế, máy chủ, phòng nghiên cứu...)</span>
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
