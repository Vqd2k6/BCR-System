import React, { useState } from 'react';
import { usePhase1SurveyStore } from '../store/usePhase1SurveyStore';
import { Card } from '../../../core/components/ui/Card';
import { Input, Select } from '../../../core/components/ui/FormControls';
import { Button } from '../../../core/components/ui/Button';
import { PhotoCaptureInput } from '../../../components/common/PhotoCaptureInput';
import { InfoPopover } from '../../../core/components/ui/InfoPopover';
import {
  Layers,
  History,
  FileCheck,
  FileX,
  Zap,
  AlertTriangle,
} from 'lucide-react';

const USAGE_OPTIONS = [
  'Nhà ở gia đình',
  'Cửa hàng / Shop / Bách hóa',
  'Quán ăn / Nhà hàng / Cafe',
  'Văn phòng / Trụ sở cty',
  'Khách sạn / Nhà nghỉ / Căn hộ DV',
  'Bệnh viện / Y tế',
  'Trường học / Đào tạo',
  'Kho hàng / Xưởng sản xuất',
  'Cơ sở tôn giáo (Chùa, Nhà thờ)',
  'Công trình công cộng',
  'Khác (Nhập chi tiết...)',
];

const STRUCTURE_SYSTEMS = [
  'RC - BTCT (Khung bê tông cốt thép toàn khối)',
  'Steel - Khung kết cấu thép',
  'Masonry - Tường gạch chịu lực',
  'Mixed - Kết cấu hỗn hợp',
  'Other - Khác (Nhập chi tiết...)',
];

const FOUNDATION_TYPES = [
  'Shallow - Móng nông (Móng băng / Móng đơn / Móng bè)',
  'Wood - Móng cừ tràm / Nền gia cố',
  'PC - Móng cọc ép BTCT',
  'CIP - Móng cọc khoan nhồi',
  'Unknown - Không rõ thông tin móng',
];

const RENOVATION_OPTIONS = [
  { score: 0, label: 'Không' },
  { score: 1, label: 'Nhẹ - Đã xử lý ổn định' },
  { score: 2, label: 'Nhiều - Chưa rõ kết cấu' },
  { score: 3, label: 'Thay đổi lớn - Nghiêm trọng' },
];

const MAJOR_REPAIR_OPTIONS = [
  { score: 0, label: 'Không' },
  { score: 1, label: 'Nhẹ - Đã xử lý' },
  { score: 2, label: 'Nhiều - Chưa rõ hồ sơ' },
  { score: 3, label: 'Cải tạo lớn ảnh hưởng chịu lực' },
];

const PAST_SETTLEMENT_OPTIONS = [
  { score: 0, label: 'Không' },
  { score: 1, label: 'Nhẹ - Đã ổn định' },
  { score: 2, label: 'Rõ - Tiếp diễn' },
  { score: 3, label: 'Nghiêm trọng' },
];

const NEIGHBOR_DAMAGE_OPTIONS = [
  { score: 0, label: 'Không' },
  { score: 1, label: 'Nhẹ - Đã bồi thường' },
  { score: 2, label: 'Đáng kể' },
  { score: 3, label: 'Tranh chấp - Nghiêm trọng' },
];

const FIRE_FLOOD_OPTIONS = [
  { score: 0, label: 'Không' },
  { score: 1, label: 'Nhẹ - Đã khắc phục' },
  { score: 2, label: 'Trung bình - Chưa rõ mức ảnh hưởng' },
  { score: 3, label: 'Nghiêm trọng' },
];

export const Step2_OwnerInterview: React.FC = () => {
  const { formData, updateFormData, nextStep, prevStep } = usePhase1SurveyStore();
  const hi = formData.historyInterview;

  const isCustomUsage =
    formData.usageFunction &&
    !USAGE_OPTIONS.slice(0, 10).includes(formData.usageFunction);

  const isCustomStructure =
    Boolean(formData.structureSystem) &&
    !STRUCTURE_SYSTEMS.slice(0, 4).includes(formData.structureSystem);

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
  const countHigh = qScores.filter((q) => q.score > 2).length;
  const isResonance = countHigh >= 2;
  const calculatedE5 = isResonance ? 4 : maxQScore;

  const handleSelectCatScore = (score: number) => {
    updateFormData({ foundationCatScore: score });
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-12">
      {/* 2.1. Khảo sát kiến trúc, kết cấu nền */}
      <Card>
        <div className="flex items-center justify-between gap-2 mb-4 pb-2 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <Layers className="w-5 h-5 text-emerald-600" />
            <h2 className="text-base sm:text-lg font-bold text-slate-800">
              2.1. Khảo Sát Kiến Trúc, Kết Cấu Nền
            </h2>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Select
              id="input-usageFunction"
              label="Công Năng Sử Dụng (Use) *"
              value={isCustomUsage ? 'Khác (Nhập chi tiết...)' : formData.usageFunction}
              onChange={(e) => {
                if (e.target.value === 'Khác (Nhập chi tiết...)') {
                  updateFormData({ usageFunction: 'Khác: ' });
                } else {
                  updateFormData({ usageFunction: e.target.value });
                }
              }}
              options={[
                { value: '', label: '--- Chọn công năng sử dụng ---' },
                ...USAGE_OPTIONS.map((u) => ({ value: u, label: u })),
              ]}
            />
            {isCustomUsage && (
              <Input
                placeholder="Nhập chi tiết công năng sử dụng thực tế..."
                value={formData.usageFunction}
                onChange={(e) => updateFormData({ usageFunction: e.target.value })}
              />
            )}
          </div>

          <div className="grid grid-cols-2 gap-2">
            <Input
              id="input-aboveFloors"
              label="Số Tầng Nổi *"
              type="number"
              min={0}
              value={formData.aboveFloors === '' || formData.aboveFloors === undefined ? '' : formData.aboveFloors}
              onChange={(e) =>
                updateFormData({ aboveFloors: e.target.value === '' ? '' : Number(e.target.value) })
              }
              hint="Tầng trệt tính là 1"
            />
            <Input
              id="input-undergroundFloors"
              label="Số Tầng Hầm"
              type="number"
              min={0}
              value={formData.undergroundFloors === '' || formData.undergroundFloors === undefined ? '' : formData.undergroundFloors}
              onChange={(e) =>
                updateFormData({ undergroundFloors: e.target.value === '' ? '' : Number(e.target.value) })
              }
            />
          </div>

          <div className="flex items-end gap-3">
            <div className="flex-1">
              <Input
                label="Năm Xây Dựng / Tuổi Thọ"
                type="number"
                placeholder="2026"
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

          <div>
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-700 block mb-1">
                Hệ Kết Cấu Chịu Lực (Structural System) *
              </label>
              <InfoPopover title="Hướng dẫn nhận diện hệ kết cấu chịu lực (V2)">
                <ul className="list-disc pl-4 space-y-1">
                  <li><strong>RC - BTCT (1đ):</strong> Khung cột, dầm, sàn bê tông cốt thép toàn khối. Độ dẻo và phân bố ứng suất tốt.</li>
                  <li><strong>Steel (2đ):</strong> Khung thép, nhà tiền chế hoặc khung BTCT chèn tường gạch.</li>
                  <li><strong>Masonry (3đ):</strong> Tường gạch chịu lực dày 20-30cm, không có khung cột BTCT.</li>
                  <li><strong>Other / Kém ổn định (4đ):</strong> Tường không giằng, kết cấu cơi nới gỗ tạm, tường nứt tách.</li>
                </ul>
              </InfoPopover>
            </div>
            <Select
              id="input-structureSystem"
              value={isCustomStructure ? 'Other - Khác (Nhập chi tiết...)' : formData.structureSystem}
              onChange={(e) => {
                if (e.target.value === 'Other - Khác (Nhập chi tiết...)') {
                  updateFormData({ structureSystem: 'Khác: ' });
                } else {
                  updateFormData({ structureSystem: e.target.value });
                }
              }}
              options={[
                { value: '', label: '--- Chọn hệ kết cấu chịu lực ---' },
                ...STRUCTURE_SYSTEMS.map((s) => ({ value: s, label: s })),
              ]}
            />
            {isCustomStructure && (
              <Input
                placeholder="Nhập chi tiết hệ kết cấu chịu lực thực tế..."
                value={formData.structureSystem}
                onChange={(e) => updateFormData({ structureSystem: e.target.value })}
              />
            )}
          </div>

          <Select
            id="input-foundationType"
            label="Loại Móng (Foundation Type) *"
            value={formData.foundationType}
            onChange={(e) => updateFormData({ foundationType: e.target.value })}
            options={[
              { value: '', label: '--- Chọn loại móng công trình ---' },
              ...FOUNDATION_TYPES.map((f) => ({ value: f, label: f })),
            ]}
          />

          <div>
            <label className="text-xs font-bold text-slate-700 block mb-1">
              Kích Thước Cọc / Móng (Dài x Rộng)
            </label>
            <div className="flex items-center gap-1.5">
              <Input
                type="number"
                placeholder="Rộng"
                value={formData.pileWidthMm === '' || formData.pileWidthMm === undefined ? '' : formData.pileWidthMm}
                onChange={(e) => {
                  const val = e.target.value === '' ? '' : Number(e.target.value);
                  const other = formData.pileLengthMm ?? '';
                  updateFormData({
                    pileWidthMm: val,
                    pileDimensionMm: val && other ? `${val} x ${other} mm` : val ? `${val} mm` : '',
                  });
                }}
              />
              <span className="text-slate-400 font-bold px-1">✕</span>
              <Input
                type="number"
                placeholder="Dài / Sâu"
                value={formData.pileLengthMm === '' || formData.pileLengthMm === undefined ? '' : formData.pileLengthMm}
                onChange={(e) => {
                  const val = e.target.value === '' ? '' : Number(e.target.value);
                  const other = formData.pileWidthMm ?? '';
                  updateFormData({
                    pileLengthMm: val,
                    pileDimensionMm: other && val ? `${other} x ${val} mm` : val ? `${val} mm` : '',
                  });
                }}
              />
              <span className="text-xs font-bold text-slate-500 whitespace-nowrap pl-1">mm</span>
            </div>
            <span className="text-[11px] text-slate-400 italic">VD: 250 x 250 mm hoặc D600 mm (để trống nếu không rõ)</span>
          </div>
        </div>

        {/* ĐÁNH GIÁ CAT MÓNG */}
        <div className="mt-5 p-4 rounded-2xl border-2 border-emerald-200 bg-emerald-50/40 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileCheck className="w-5 h-5 text-emerald-700" />
              <h3 className="text-xs sm:text-sm font-bold text-emerald-950 uppercase tracking-wide">
                Đánh Giá CAT
              </h3>
            </div>
            <div className="flex items-center gap-2">
              <InfoPopover title="Quy tắc phân loại CAT Móng (Phục vụ V3)">
                <p className="mb-2">Thang điểm CAT Foundation (1 - 5) phản ánh độ tin cậy của thông tin móng công trình:</p>
                <ul className="list-disc pl-4 space-y-1 text-[11px]">
                  <li><strong>Cat 1:</strong> Có bản vẽ hoàn công xác nhận từ cơ quan chức năng / chủ đầu tư.</li>
                  <li><strong>Cat 2:</strong> Có bản vẽ thiết kế kết cấu do chủ nhà lưu giữ.</li>
                  <li><strong>Cat 3:</strong> Không có bản vẽ, chủ nhà nhớ và khai rõ thông tin cọc/móng.</li>
                  <li><strong>Cat 4:</strong> Tự suy luận từ kinh nghiệm hiện trường (số tầng, kết cấu, niên đại).</li>
                  <li><strong>Cat 5:</strong> Hoàn toàn không có dữ liệu, mặc định xếp mức rủi ro cao nhất ($V_3 = 4$đ).</li>
                </ul>
              </InfoPopover>
              <span className="text-xs font-black px-3 py-1 rounded-full bg-emerald-600 text-white shadow-sm">
                CAT Móng: Mức {formData.foundationCatScore}
              </span>
            </div>
          </div>

          {/* 3 Main Branches */}
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
              <div className="flex items-center gap-1.5 font-bold text-xs">
                <FileCheck className="w-4 h-4 text-emerald-600" />
                <span>Trường hợp A: Có bản vẽ</span>
              </div>
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
              <div className="flex items-center gap-1.5 font-bold text-xs">
                <FileX className="w-4 h-4 text-amber-600" />
                <span>Trường hợp B: Không có bản vẽ</span>
              </div>
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
              <div className="flex items-center gap-1.5 font-bold text-xs">
                <AlertTriangle className="w-4 h-4 text-red-600" />
                <span>Trường hợp C: Hoàn toàn không rõ</span>
              </div>
            </button>
          </div>

          {/* Detailed Sub-Options */}
          {hasDrawingOption === 'HAS_DRAWING' && (
            <div className="p-3.5 rounded-xl bg-white border border-emerald-200 space-y-3 animate-in fade-in">
              <PhotoCaptureInput
                label="Chụp ảnh / Tải lên bản vẽ hoàn công / kết cấu:"
                value={formData.asBuiltDrawingPhotoUrl || ''}
                onChange={(url) => updateFormData({ asBuiltDrawingPhotoUrl: url })}
                watermarkText="BẢN VẼ HOÀN CÔNG"
              />

              <span className="text-xs font-bold text-slate-700 block">
                Nguồn gốc của bản vẽ:
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
                  <div className="text-xs font-bold">Xác nhận từ Chính quyền / Đơn vị thiết kế</div>
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
                  <div className="text-xs font-bold">Bản vẽ do chủ nhà lưu giữ</div>
                </button>
              </div>
            </div>
          )}

          {hasDrawingOption === 'NO_DRAWING' && (
            <div className="p-3.5 rounded-xl bg-white border border-amber-200 space-y-2.5 animate-in fade-in">
              <span className="text-xs font-bold text-slate-700 block">
                Nguồn xác định dữ liệu móng:
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
                  <div className="text-xs font-bold">Phỏng vấn chủ hộ</div>
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
                  <div className="text-xs font-bold">Tự suy luận từ kinh nghiệm hiện trường</div>
                </button>
              </div>
            </div>
          )}

          {hasDrawingOption === 'UNKNOWN' && (
            <div className="p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-800 animate-in fade-in">
              Không rõ thông tin móng (Mặc định mức rủi ro 5).
            </div>
          )}
        </div>
      </Card>

      {/* 2.2. Lịch sử & Yếu tố nhạy cảm */}
      <Card>
        <div className="flex items-center justify-between mb-4 pb-2 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <History className="w-5 h-5 text-purple-600" />
            <div>
              <h2 className="text-base sm:text-lg font-bold text-slate-800">
                2.2. Lịch Sử & Yếu Tố Nhạy Cảm
              </h2>
              <p className="text-xs text-slate-500">
                Các câu hỏi phỏng vấn quá khứ do chủ nhà cung cấp. Hư hỏng hiện trạng của công trình trong lịch sử
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
              <span>E5 = {calculatedE5}/4</span>
            </span>
          </div>
        </div>

        {/* Risk Resonance Alert Banner */}
        {isResonance && (
          <div className="mb-4 p-3 rounded-xl bg-purple-50 border border-purple-200 text-xs text-purple-900 flex items-start gap-2 animate-in fade-in">
            <Zap className="w-4 h-4 text-purple-600 flex-shrink-0 mt-0.5 fill-purple-600" />
            <div>
              <span className="font-bold">Cộng Hưởng Rủi Ro:</span> Có{' '}
              <strong>{countHigh} trường thông tin</strong> cùng đạt mức nghiêm trọng $\implies$ Chỉ số E5 tự động nâng lên mức <strong>4 (tối đa)</strong>.
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
            options={RENOVATION_OPTIONS.map((h) => ({ value: h.score, label: h.label }))}
          />

          <Select
            label="2. Sửa chữa lớn - Cải tạo kết cấu"
            value={hi.majorRepair}
            onChange={(e) =>
              updateFormData({
                historyInterview: { ...hi, majorRepair: Number(e.target.value) },
              })
            }
            options={MAJOR_REPAIR_OPTIONS.map((h) => ({ value: h.score, label: h.label }))}
          />

          <Select
            label="3. Lún - Nghiêng ghi nhận trước đây"
            value={hi.pastSettlement}
            onChange={(e) =>
              updateFormData({
                historyInterview: { ...hi, pastSettlement: Number(e.target.value) },
              })
            }
            options={PAST_SETTLEMENT_OPTIONS.map((h) => ({ value: h.score, label: h.label }))}
          />

          <Select
            label="4. Hư hỏng do công trình lân cận gây ra"
            value={hi.neighborDamage}
            onChange={(e) =>
              updateFormData({
                historyInterview: { ...hi, neighborDamage: Number(e.target.value) },
              })
            }
            options={NEIGHBOR_DAMAGE_OPTIONS.map((h) => ({ value: h.score, label: h.label }))}
          />

          <Select
            label="5. Sự cố nghiêm trọng (Hỏa hoạn - Ngập lụt - Nổ)"
            value={hi.fireFloodIncident}
            onChange={(e) =>
              updateFormData({
                historyInterview: { ...hi, fireFloodIncident: Number(e.target.value) },
              })
            }
            options={FIRE_FLOOD_OPTIONS.map((h) => ({ value: h.score, label: h.label }))}
          />

          <Select
            label="Tình trạng sử dụng hiện tại (Occupancy Status)"
            value={hi.usageStatus}
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

        {/* Thiết bị nhạy cảm rung chấn */}
        <div className="mt-4 pt-4 border-t border-slate-100 space-y-3">
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
            <span>Có Thiết bị - Hoạt động nhạy cảm rung chấn (Y tế, Lab, Thiết bị chính xác...)</span>
          </label>

          {hi.sensitiveEquipment.has && (
            <div className="p-3 bg-purple-50/50 rounded-xl border border-purple-200">
              <Input
                label="Mô tả thiết bị / hoạt động nhạy cảm:"
                placeholder="VD: Phòng lab xét nghiệm, máy siêu âm/X-quang, server dữ liệu, đồ cổ quý hiếm..."
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
