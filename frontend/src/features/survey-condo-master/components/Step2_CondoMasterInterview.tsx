import React, { useState } from 'react';
import { usePhase1SurveyStore } from '../../survey-phase1/store/usePhase1SurveyStore';
import { Card } from '../../../core/components/ui/Card';
import { Button } from '../../../core/components/ui/Button';
import { Input, Select } from '../../../core/components/ui/FormControls';
import { InfoPopover } from '../../../core/components/ui/InfoPopover';
import { PhotoCaptureInput } from '../../../components/common/PhotoCaptureInput';
import type { EvidencePhotoItem } from '../../survey-phase1/types/phase1.types';
import {
  USAGE_OPTIONS,
  STRUCTURE_SYSTEMS,
  FOUNDATION_TYPES,
} from '../../survey-phase1/constants/surveyOptionsConstants';
import {
  RENOVATION_OPTIONS,
  MAJOR_REPAIR_OPTIONS,
  PAST_SETTLEMENT_OPTIONS,
  NEIGHBOR_DAMAGE_OPTIONS,
  FIRE_FLOOD_OPTIONS,
} from '../../survey-phase1/constants/historyInterviewConstants';
import {
  Building2,
  Layers,
  ShieldAlert,
  Users,
  LayoutGrid,
  FileCheck,
  FileX,
  AlertTriangle,
  History,
  Zap,
  Plus,
  Trash2,
} from 'lucide-react';

export const Step2_CondoMasterInterview: React.FC = () => {
  const { formData, updateFormData, nextStep, prevStep } = usePhase1SurveyStore();
  const hi = formData.historyInterview;

  const isCustomUsage =
    Boolean(formData.usageFunction) &&
    !USAGE_OPTIONS.slice(0, USAGE_OPTIONS.length - 1).includes(formData.usageFunction);

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

  const handleSelectCatScore = (score: number) => {
    updateFormData({ foundationCatScore: score });
  };

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

  // Tính toán live tổng số căn
  const handleAboveFloorsChange = (valStr: string) => {
    const above = valStr === '' ? '' : Number(valStr);
    const unitsPerFloor = formData.unitsPerFloor ?? '';
    const numAbove = typeof above === 'number' ? above : 0;
    const numUnits = typeof unitsPerFloor === 'number' ? unitsPerFloor : 0;
    const total = numAbove > 0 && numUnits > 0 ? numAbove * numUnits : undefined;
    updateFormData({
      aboveFloors: above,
      totalUnitsCount: total ?? formData.totalUnitsCount,
    });
  };

  const handleUnitsPerFloorChange = (valStr: string) => {
    const units = valStr === '' ? '' : Number(valStr);
    const aboveFloors = formData.aboveFloors ?? '';
    const numAbove = typeof aboveFloors === 'number' ? aboveFloors : 0;
    const numUnits = typeof units === 'number' ? units : 0;
    const total = numAbove > 0 && numUnits > 0 ? numAbove * numUnits : undefined;
    updateFormData({
      unitsPerFloor: units,
      totalUnitsCount: total ?? formData.totalUnitsCount,
    });
  };

  const displayTotalUnits =
    formData.totalUnitsCount ||
    ((Number(formData.aboveFloors) || 0) * (Number(formData.unitsPerFloor) || 0)) ||
    0;

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-12 animate-in fade-in">
      {/* 2.1. Quy mô công trình & Quản lý căn hộ */}
      <Card className="border-indigo-200 bg-white shadow-xs">
        <div className="flex items-center justify-between gap-2 mb-4 pb-2 border-b border-indigo-100">
          <div className="flex items-center gap-2">
            <Building2 className="w-5 h-5 text-indigo-600" />
            <h2 className="text-base sm:text-lg font-bold text-slate-800">
              2.1. Công Năng & Quy Mô Tòa Nhà Chung Cư
            </h2>
          </div>
          <span className="text-xs bg-indigo-50 text-indigo-700 font-bold px-2.5 py-1 rounded-full border border-indigo-200">
            Quy chuẩn Chung Cư / Cao Tầng
          </span>
        </div>

        <div className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Select
                id="input-usageFunction"
                label="Công Năng Sử Dụng (Use) *"
                value={isCustomUsage ? 'Khác (Nhập chi tiết...)' : (formData.usageFunction || 'Chung cư / Toà nhiều căn hộ')}
                onChange={(e) => {
                  if (e.target.value === 'Khác (Nhập chi tiết...)') {
                    updateFormData({ usageFunction: 'Khác: ' });
                  } else {
                    updateFormData({ usageFunction: e.target.value });
                  }
                }}
                options={USAGE_OPTIONS.map((u) => ({ value: u, label: u }))}
              />
              {isCustomUsage && (
                <Input
                  placeholder="Nhập chi tiết công năng sử dụng thực tế..."
                  value={formData.usageFunction}
                  onChange={(e) => updateFormData({ usageFunction: e.target.value })}
                />
              )}
            </div>

            <div className="p-3 bg-indigo-50/50 rounded-xl border border-indigo-100 flex items-center gap-3">
              <div className="p-2 rounded-lg bg-indigo-100 text-indigo-700 shrink-0">
                <Layers className="w-5 h-5" />
              </div>
              <div className="text-xs text-slate-600 leading-relaxed">
                <strong className="text-indigo-900 block font-semibold">Tự động đồng bộ sang Hub Căn Hộ</strong>
                Số tầng nổi và số căn mỗi tầng là cơ sở để hệ thống khởi tạo danh sách căn hộ con cho Surveyor.
              </div>
            </div>
          </div>

          {/* Grid thông số tầng & căn hộ */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-2 border-t border-slate-100">
            <Input
              id="input-aboveFloors"
              label="Số tầng nổi *"
              type="number"
              min={1}
              value={formData.aboveFloors ?? ''}
              onChange={(e) => handleAboveFloorsChange(e.target.value)}
              hint="Tầng trệt tính là 1"
            />

            <Input
              id="input-undergroundFloors"
              label="Số tầng hầm"
              type="number"
              min={0}
              value={formData.undergroundFloors ?? ''}
              onChange={(e) =>
                updateFormData({
                  undergroundFloors: e.target.value === '' ? '' : Number(e.target.value),
                })
              }
            />

            <Input
              id="input-unitsPerFloor"
              label="Số căn mỗi tầng *"
              type="number"
              min={1}
              placeholder="VD: 8"
              value={formData.unitsPerFloor ?? ''}
              onChange={(e) => handleUnitsPerFloorChange(e.target.value)}
              hint="Số căn trung bình/tầng"
            />

            <div className="p-3 bg-indigo-50/70 rounded-xl border border-indigo-200 flex flex-col justify-center">
              <span className="text-[11px] font-semibold text-indigo-950 flex items-center gap-1">
                <LayoutGrid className="w-3.5 h-3.5 text-indigo-600" />
                Tổng số căn ước tính
              </span>
              <span className="text-base font-bold text-indigo-700 mt-0.5">
                {displayTotalUnits > 0 ? `${displayTotalUnits} căn` : 'Tự động tính'}
              </span>
            </div>
          </div>

          {/* Grid thông số diện tích, chiều cao, năm xây dựng */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2 border-t border-slate-100">
            <Input
              id="input-constructionAreaM2"
              label="Diện Tích Sàn Xây Dựng (m²) *"
              type="number"
              step="any"
              min={0}
              placeholder="VD: 2500"
              value={formData.constructionAreaM2 ?? ''}
              onChange={(e) =>
                updateFormData({
                  constructionAreaM2: e.target.value === '' ? '' : Number(e.target.value),
                })
              }
              hint="Tổng diện tích sàn toàn toà"
            />

            <Input
              id="input-buildingHeightM"
              label="Chiều Cao Công Trình (m) *"
              type="number"
              step="any"
              min={0}
              placeholder="VD: 45.5"
              value={formData.buildingHeightM ?? ''}
              onChange={(e) =>
                updateFormData({
                  buildingHeightM: e.target.value === '' ? '' : Number(e.target.value),
                })
              }
              hint="Chiều cao đo đạc thực tế"
            />

            <div className="flex items-end gap-3">
              <div className="flex-1">
                <Input
                  id="input-constructionYear"
                  label="Năm Xây Dựng / Hoàn Công"
                  type="number"
                  placeholder="VD: 2018"
                  value={formData.constructionYear ?? ''}
                  onChange={(e) =>
                    updateFormData({
                      constructionYear: e.target.value ? Number(e.target.value) : '',
                    })
                  }
                />
              </div>
              <label className="flex items-center gap-1.5 text-xs text-slate-600 mb-3 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={Boolean(formData.isEstimatedYear)}
                  onChange={(e) => updateFormData({ isEstimatedYear: e.target.checked })}
                  className="rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                />
                <span>Ước tính</span>
              </label>
            </div>
          </div>
        </div>
      </Card>

      {/* 2.2. Kết cấu chịu lực & Loại móng */}
      <Card className="border-indigo-200 bg-white shadow-xs">
        <div className="flex items-center justify-between gap-2 mb-4 pb-2 border-b border-indigo-100">
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-indigo-600" />
            <h2 className="text-base sm:text-lg font-bold text-slate-800">
              2.2. Kết Cấu Chịu Lực (E1) & Loại Móng (V2)
            </h2>
          </div>
          <InfoPopover title="Đánh giá kết cấu cao tầng (E1/V2)">
            <p className="text-xs leading-relaxed">
              Tòa nhà chung cư cao tầng thường kết hợp khung vách lõi bê tông cốt thép toàn khối và móng cọc khoan nhồi / tường vây ngàm tầng cuội sỏi sâu, có độ cứng và khả năng chống rung chấn cao.
            </p>
          </InfoPopover>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-700 block">
              Hệ Kết Cấu Chịu Lực (Structural System) *
            </label>
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

          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-700 block">
              Loại Móng Công Trình (Foundation Type) *
            </label>
            <Select
              id="input-foundationType"
              value={formData.foundationType}
              onChange={(e) => updateFormData({ foundationType: e.target.value })}
              options={[
                { value: '', label: '--- Chọn loại móng công trình ---' },
                ...FOUNDATION_TYPES.map((f) => ({ value: f, label: f })),
              ]}
            />
          </div>

          <div className="sm:col-span-2">
            <label className="text-xs font-bold text-slate-700 block mb-1">
              Kích Thước Cọc / Móng / Tường Vây (Dài x Rộng)
            </label>
            <div className="flex items-center gap-1.5">
              <Input
                type="number"
                placeholder="Rộng"
                value={formData.pileWidthMm ?? ''}
                onChange={(e) => {
                  const val = e.target.value === '' ? '' : Number(e.target.value);
                  const other = formData.pileLengthMm ?? '';
                  updateFormData({
                    pileWidthMm: val,
                    pileDimensionMm: val && other ? `${val} x ${other} cm` : val ? `${val} cm` : '',
                  });
                }}
              />
              <span className="text-slate-400 font-bold px-1">✕</span>
              <Input
                type="number"
                placeholder="Dài / Sâu"
                value={formData.pileLengthMm ?? ''}
                onChange={(e) => {
                  const val = e.target.value === '' ? '' : Number(e.target.value);
                  const other = formData.pileWidthMm ?? '';
                  updateFormData({
                    pileLengthMm: val,
                    pileDimensionMm: other && val ? `${other} x ${val} cm` : val ? `${val} cm` : '',
                  });
                }}
              />
              <span className="text-xs font-bold text-slate-500 whitespace-nowrap pl-1">cm</span>
            </div>
            <span className="text-[11px] text-slate-400 italic">VD: D1000 mm (100 cm) hoặc tường vây 80 cm</span>
          </div>

          {/* Thông số móng bổ sung */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:col-span-2 p-3.5 bg-slate-50/80 rounded-xl border border-slate-200">
            <div>
              <Input
                id="input-foundationDepthM"
                label="Chiều Sâu Đáy Móng (m)"
                type="number"
                step="any"
                min={0}
                placeholder="VD: 18.5"
                value={formData.foundationDepthM ?? ''}
                onChange={(e) =>
                  updateFormData({
                    foundationDepthM: e.target.value === '' ? '' : Number(e.target.value),
                  })
                }
                hint="Chiều sâu đáy đài/hầm"
              />
            </div>
            <div>
              <Input
                id="input-foundationDensity"
                label="Mật Độ Cọc (SL/m²)"
                type="number"
                step="any"
                min={0}
                placeholder="VD: 0.08"
                value={formData.foundationDensity ?? ''}
                onChange={(e) =>
                  updateFormData({
                    foundationDensity: e.target.value === '' ? '' : Number(e.target.value),
                  })
                }
                hint="Số lượng cọc trên m²"
              />
            </div>
            <div>
              <Input
                id="input-foundationSpacingM"
                label="Khoảng Cách Cọc (m)"
                type="number"
                step="any"
                min={0}
                placeholder="VD: 3.5"
                value={formData.foundationSpacingM ?? ''}
                onChange={(e) =>
                  updateFormData({
                    foundationSpacingM: e.target.value === '' ? '' : Number(e.target.value),
                  })
                }
                hint="Khoảng cách tim cọc (m)"
              />
            </div>
            <div className="sm:col-span-3 mt-1">
              <Input
                id="input-foundationNotes"
                label="Ghi Chú Về Móng & Địa Tầng"
                placeholder="Ghi chú chi tiết về cọc khoan nhồi, tầng cát cuội sỏi, biện pháp thi công hầm..."
                value={formData.foundationNotes || ''}
                onChange={(e) => updateFormData({ foundationNotes: e.target.value })}
              />
            </div>
          </div>
        </div>
      </Card>

      {/* 2.3. Hồ sơ bản vẽ hoàn công / Kết cấu (Đánh giá CAT Móng - V3) */}
      <Card className="border-indigo-200 bg-white shadow-xs">
        <div className="flex items-center justify-between gap-2 mb-4 pb-2 border-b border-indigo-100">
          <div className="flex items-center gap-2">
            <FileCheck className="w-5 h-5 text-indigo-600" />
            <h2 className="text-base sm:text-lg font-bold text-slate-800">
              2.3. Bản Vẽ Hoàn Công / Kết Cấu Móng (Chỉ Số V3)
            </h2>
          </div>
          <div className="flex items-center gap-2">
            <InfoPopover title="Quy tắc phân loại CAT Móng cao tầng (V3)">
              <ul className="list-disc pl-4 space-y-1 text-[11px]">
                <li><strong>Cat 1:</strong> Có bản vẽ hoàn công phê duyệt từ CĐT / Sở Xây dựng.</li>
                <li><strong>Cat 2:</strong> Có bản vẽ thiết kế kết cấu do BQL toà nhà lưu giữ.</li>
                <li><strong>Cat 3:</strong> Không có bản vẽ, phỏng vấn Ban Quản Lý / Kỹ thuật toà nhà.</li>
                <li><strong>Cat 4:</strong> Tự suy luận từ quy mô chiều cao và số tầng hầm.</li>
                <li><strong>Cat 5:</strong> Hoàn toàn không có dữ liệu móng.</li>
              </ul>
            </InfoPopover>
            <span className="text-xs font-black px-3 py-1 rounded-full bg-indigo-600 text-white shadow-xs">
              CAT Móng: Mức {formData.foundationCatScore || 1}
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
            className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
              hasDrawingOption === 'HAS_DRAWING'
                ? 'border-indigo-600 bg-indigo-50/50 ring-2 ring-indigo-400 font-semibold text-indigo-950 shadow-xs'
                : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-700'
            }`}
          >
            <div className="flex items-center gap-1.5 font-bold text-xs">
              <FileCheck className="w-4 h-4 text-indigo-600" />
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
            className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
              hasDrawingOption === 'NO_DRAWING'
                ? 'border-amber-500 bg-amber-50/50 ring-2 ring-amber-400 font-semibold text-amber-950 shadow-xs'
                : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-700'
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
            className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
              hasDrawingOption === 'UNKNOWN'
                ? 'border-red-400 bg-red-50/50 ring-2 ring-red-400 font-semibold text-red-950 shadow-xs'
                : 'border-slate-200 bg-white hover:bg-slate-50 text-slate-700'
            }`}
          >
            <div className="flex items-center gap-1.5 font-bold text-xs">
              <AlertTriangle className="w-4 h-4 text-red-600" />
              <span>Trường hợp C: Hoàn toàn không rõ</span>
            </div>
          </button>
        </div>

        {/* Detailed Drawing Upload Section */}
        {hasDrawingOption === 'HAS_DRAWING' && (
          <div id="as-built-drawing-section" className="mt-4 p-3.5 rounded-xl bg-slate-50/80 border border-indigo-200 space-y-3 animate-in fade-in">
            <span className="text-xs font-bold text-slate-800 block">
              Chụp ảnh / Tải lên bản vẽ hoàn công móng / kết cấu toà nhà: * (Có thể tải nhiều trang)
            </span>
            {(() => {
              const asBuiltPhotos: EvidencePhotoItem[] =
                formData.asBuiltDrawingPhotos && formData.asBuiltDrawingPhotos.length > 0
                  ? formData.asBuiltDrawingPhotos
                  : formData.asBuiltDrawingPhotoUrl
                  ? [{ url: formData.asBuiltDrawingPhotoUrl, photoCode: '', notes: '' }]
                  : [{ url: '', photoCode: '', notes: '' }];

              const handleUpdateDrawing = (idx: number, url: string, code?: string, notes?: string) => {
                const next = [...asBuiltPhotos];
                next[idx] = {
                  ...next[idx],
                  url,
                  photoCode: code !== undefined ? code : next[idx]?.photoCode,
                  notes: notes !== undefined ? notes : next[idx]?.notes,
                };
                updateFormData({
                  asBuiltDrawingPhotos: next,
                  asBuiltDrawingPhotoUrl: next[0]?.url || '',
                });
              };

              const handleAddDrawing = () => {
                const next = [...asBuiltPhotos, { url: '', photoCode: '', notes: '' }];
                updateFormData({
                  asBuiltDrawingPhotos: next,
                  asBuiltDrawingPhotoUrl: next[0]?.url || '',
                });
              };

              const handleRemoveDrawing = (idx: number) => {
                const next = asBuiltPhotos.filter((_, i) => i !== idx);
                const finalNext = next.length > 0 ? next : [{ url: '', photoCode: '', notes: '' }];
                updateFormData({
                  asBuiltDrawingPhotos: finalNext,
                  asBuiltDrawingPhotoUrl: finalNext[0]?.url || '',
                });
              };

              return (
                <div className="space-y-3">
                  {asBuiltPhotos.map((item, idx) => (
                    <div key={idx} className="p-3 bg-white rounded-xl border border-slate-200 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-indigo-900">
                          {idx === 0 ? 'Bản vẽ 1 (Trang chính):' : `Bản vẽ ${idx + 1} (Bổ sung):`}
                        </span>
                        {idx > 0 && (
                          <button
                            type="button"
                            onClick={() => handleRemoveDrawing(idx)}
                            className="text-red-500 hover:text-red-700 p-1 rounded hover:bg-red-50 transition-colors cursor-pointer"
                            title="Xóa trang bản vẽ này"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                      <PhotoCaptureInput
                        value={item.url}
                        photoCode={item.photoCode}
                        onChange={(url, code) => handleUpdateDrawing(idx, url, code)}
                        watermarkOptions={{
                          parcelCode: formData.projectParcelCode,
                          floor: 'DOC',
                          zoneOrRoom: 'HOANCONG',
                          photoType: 'DRAWING',
                          photoIndex: idx + 1,
                        }}
                        height="130px"
                      />
                      <Input
                        placeholder="Ghi chú nội dung trang (VD: Mặt bằng cọc khoan nhồi / Chi tiết đài móng / Tường vây)..."
                        value={item.notes || ''}
                        onChange={(e) => handleUpdateDrawing(idx, item.url, item.photoCode, e.target.value)}
                      />
                    </div>
                  ))}
                  <button
                    type="button"
                    onClick={handleAddDrawing}
                    className="w-full py-2 px-3 border border-dashed border-indigo-400 bg-indigo-50/50 hover:bg-indigo-50 text-indigo-700 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5 text-indigo-600" />
                    <span>Thêm trang / ảnh bản vẽ khác</span>
                  </button>
                </div>
              );
            })()}

            <span className="text-xs font-bold text-slate-700 block pt-2">
              Nguồn gốc của bản vẽ:
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => handleSelectCatScore(1)}
                className={`p-2.5 rounded-lg border text-left transition-all cursor-pointer ${
                  formData.foundationCatScore === 1
                    ? 'border-indigo-600 bg-indigo-50 text-indigo-900 font-bold ring-1 ring-indigo-500'
                    : 'border-slate-200 hover:bg-slate-50 text-slate-700 text-xs'
                }`}
              >
                <div className="text-xs font-bold">Xác nhận từ Chủ Đầu Tư / Đơn vị thiết kế / CQ Chức năng</div>
              </button>

              <button
                type="button"
                onClick={() => handleSelectCatScore(2)}
                className={`p-2.5 rounded-lg border text-left transition-all cursor-pointer ${
                  formData.foundationCatScore === 2
                    ? 'border-indigo-600 bg-indigo-50 text-indigo-900 font-bold ring-1 ring-indigo-500'
                    : 'border-slate-200 hover:bg-slate-50 text-slate-700 text-xs'
                }`}
              >
                <div className="text-xs font-bold">Bản vẽ do Ban Quản Lý / Kỹ thuật toà nhà lưu giữ</div>
              </button>
            </div>
          </div>
        )}

        {hasDrawingOption === 'NO_DRAWING' && (
          <div className="mt-4 p-3.5 rounded-xl bg-amber-50/60 border border-amber-200 space-y-2.5 animate-in fade-in">
            <span className="text-xs font-bold text-slate-700 block">
              Nguồn xác định dữ liệu móng:
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => handleSelectCatScore(3)}
                className={`p-2.5 rounded-lg border text-left transition-all cursor-pointer ${
                  formData.foundationCatScore === 3
                    ? 'border-amber-600 bg-amber-50 text-amber-900 font-bold ring-1 ring-amber-500'
                    : 'border-slate-200 hover:bg-slate-50 text-slate-700 text-xs'
                }`}
              >
                <div className="text-xs font-bold">Phỏng vấn Ban Quản Lý / Phòng kỹ thuật tòa nhà</div>
              </button>

              <button
                type="button"
                onClick={() => handleSelectCatScore(4)}
                className={`p-2.5 rounded-lg border text-left transition-all cursor-pointer ${
                  formData.foundationCatScore === 4
                    ? 'border-amber-600 bg-amber-50 text-amber-900 font-bold ring-1 ring-amber-500'
                    : 'border-slate-200 hover:bg-slate-50 text-slate-700 text-xs'
                }`}
              >
                <div className="text-xs font-bold">Tự suy luận từ quy mô chiều cao và niên đại công trình</div>
              </button>
            </div>
          </div>
        )}

        {hasDrawingOption === 'UNKNOWN' && (
          <div className="mt-4 p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-800 animate-in fade-in">
            Không rõ thông tin móng (Mặc định xếp mức rủi ro CAT = 5).
          </div>
        )}
      </Card>

      {/* 2.4. Phỏng vấn lịch sử & Yếu tố nhạy cảm (E5) */}
      <Card className="border-indigo-200 bg-white shadow-xs">
        <div className="flex items-center justify-between mb-4 pb-2 border-b border-indigo-100">
          <div className="flex items-center gap-2">
            <History className="w-5 h-5 text-indigo-600" />
            <div>
              <h2 className="text-base sm:text-lg font-bold text-slate-800">
                2.4. Phỏng Vấn Lịch Sử & Yếu Tố Nhạy Cảm (Chỉ Số E5)
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
              className="rounded text-indigo-600 focus:ring-indigo-500 cursor-pointer"
            />
            <span>Có Thiết bị - Hoạt động nhạy cảm rung chấn (Server phòng IT, máy phát điện, trạm biến áp, thang máy tốc độ cao...)</span>
          </label>

          {hi?.sensitiveEquipment?.has && (
            <div className="p-3 bg-indigo-50/40 rounded-xl border border-indigo-200">
              <Input
                label="Mô tả thiết bị / khu vực kỹ thuật nhạy cảm:"
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
            placeholder="VD: Ông Nguyễn Văn An - Trưởng BQL Savills"
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
        <Button variant="secondary" size="md" onClick={prevStep} className="cursor-pointer">
          ◀ Xem Lại Bước 1 (Ngoại quan toà)
        </Button>
        <Button size="lg" className="bg-indigo-600 hover:bg-indigo-700 text-white cursor-pointer" onClick={nextStep}>
          Tiếp tục: Bước 3 (Không gian dùng chung) ➔
        </Button>
      </div>
    </div>
  );
};
