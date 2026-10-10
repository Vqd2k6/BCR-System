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
  Building2,
  Layers,
  LayoutGrid,
  FileCheck,
  FileX,
  AlertTriangle,
  Plus,
  Trash2,
} from 'lucide-react';

export const Step2_CondoMasterScaleAndCat: React.FC = () => {
  const { formData, updateFormData, nextStep, prevStep, isReadOnly } = usePhase1SurveyStore();

  React.useEffect(() => {
    if (!formData.usageFunction) {
      updateFormData({ usageFunction: 'Chung cư / Toà nhiều căn hộ' });
    }
  }, []);

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
    if (isReadOnly) return;
    updateFormData({ foundationCatScore: score });
  };

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
            TÒA CHUNG CƯ
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <Select
              label="Công Năng Sử Dụng (Use) *"
              disabled={isReadOnly}
              value={isCustomUsage ? 'Khác' : formData.usageFunction || 'Chung cư / Toà nhiều căn hộ'}
              onChange={(e) => {
                if (e.target.value === 'Khác') {
                  updateFormData({ usageFunction: '' });
                } else {
                  updateFormData({ usageFunction: e.target.value });
                }
              }}
              options={USAGE_OPTIONS.map((u) => ({ value: u, label: u }))}
            />
            {isCustomUsage && (
              <Input
                label="Công năng chi tiết khác:"
                disabled={isReadOnly}
                className="mt-2"
                placeholder="Nhập công năng tòa nhà..."
                value={formData.usageFunction || ''}
                onChange={(e) => updateFormData({ usageFunction: e.target.value })}
              />
            )}
          </div>

          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <label className="text-xs font-semibold text-slate-700">Năm Xây Dựng / Hoàn Công</label>
              <label className="flex items-center gap-1.5 text-xs text-slate-500 cursor-pointer select-none">
                <input
                  type="checkbox"
                  disabled={isReadOnly}
                  checked={Boolean(formData.isEstimatedYear)}
                  onChange={(e) => updateFormData({ isEstimatedYear: e.target.checked })}
                  className="rounded text-indigo-600 focus:ring-indigo-500 disabled:opacity-50"
                />
                <span>Ước tính</span>
              </label>
            </div>
            <Input
              type="number"
              disabled={isReadOnly}
              placeholder="VD: 2018"
              value={formData.constructionYear || ''}
              onChange={(e) =>
                updateFormData({
                  constructionYear: e.target.value === '' ? undefined : Number(e.target.value),
                })
              }
            />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-4">
          <Input
            label="Số Tầng Nổi (Above Floors) *"
            disabled={isReadOnly}
            type="number"
            min={1}
            placeholder="VD: 25"
            value={formData.aboveFloors ?? ''}
            onChange={(e) => handleAboveFloorsChange(e.target.value)}
          />

          <Input
            label="Số Tầng Hầm (Basements) *"
            disabled={isReadOnly}
            type="number"
            min={0}
            placeholder="VD: 2"
            value={formData.undergroundFloors ?? ''}
            onChange={(e) =>
              updateFormData({
                undergroundFloors: e.target.value === '' ? '' : Number(e.target.value),
              })
            }
          />

          <Input
            label="Số Căn / Tầng (Trung bình) *"
            disabled={isReadOnly}
            type="number"
            min={1}
            placeholder="VD: 12"
            value={formData.unitsPerFloor ?? ''}
            onChange={(e) => handleUnitsPerFloorChange(e.target.value)}
          />
        </div>

        {/* Live Calculation Banner for Condo Units */}
        <div className="mt-4 p-3.5 bg-indigo-50/70 border border-indigo-200 rounded-xl flex flex-wrap items-center justify-between gap-3 text-xs text-indigo-900">
          <div className="flex items-center gap-2">
            <LayoutGrid className="w-4 h-4 text-indigo-600" />
            <span>
              Quy mô ước tính: <strong>{formData.aboveFloors || 0} tầng nổi</strong> ×{' '}
              <strong>{formData.unitsPerFloor || 0} căn/tầng</strong>
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-600">Tổng số căn hộ toàn toà:</span>
            <span className="font-black text-sm text-indigo-700 bg-white px-2.5 py-0.5 rounded-lg border border-indigo-300 shadow-2xs">
              {displayTotalUnits} CĂN HỘ
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4">
          <Input
            label="Tổng Diện Tích Sàn Xây Dựng (m²) *"
            disabled={isReadOnly}
            type="number"
            placeholder="VD: 32000"
            value={formData.constructionAreaM2 ?? ''}
            onChange={(e) =>
              updateFormData({
                constructionAreaM2: e.target.value === '' ? '' : Number(e.target.value),
              })
            }
          />

          <Input
            label="Chiều Cao Công Trình (m) *"
            disabled={isReadOnly}
            type="number"
            step="0.1"
            placeholder="VD: 85.5"
            value={formData.buildingHeightM ?? ''}
            onChange={(e) =>
              updateFormData({
                buildingHeightM: e.target.value === '' ? '' : Number(e.target.value),
              })
            }
          />
        </div>
      </Card>

      {/* 2.2. Kết cấu chịu lực & Khảo sát móng chi tiết */}
      <Card className="border-indigo-200 bg-white shadow-xs">
        <div className="flex items-center justify-between gap-2 mb-4 pb-2 border-b border-indigo-100">
          <div className="flex items-center gap-2">
            <Layers className="w-5 h-5 text-indigo-600" />
            <h2 className="text-base sm:text-lg font-bold text-slate-800">
              2.2. Kết Cấu Chịu Lực (E1) & Khảo Sát Móng Chi Tiết (V2)
            </h2>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <Select
              id="input-structureSystem"
              label="Hệ Kết Cấu Chịu Lực Chính (E1) *"
              disabled={isReadOnly}
              value={isCustomStructure ? 'Khác' : formData.structureSystem || ''}
              onChange={(e) => {
                if (e.target.value === 'Khác') {
                  updateFormData({ structureSystem: '' });
                } else {
                  updateFormData({ structureSystem: e.target.value });
                }
              }}
              options={STRUCTURE_SYSTEMS.map((s) => ({ value: s, label: s }))}
            />
            {isCustomStructure && (
              <Input
                label="Hệ kết cấu chi tiết khác:"
                disabled={isReadOnly}
                className="mt-2"
                placeholder="Nhập hệ kết cấu toà nhà..."
                value={formData.structureSystem || ''}
                onChange={(e) => updateFormData({ structureSystem: e.target.value })}
              />
            )}
          </div>

          <div>
            <Select
              id="input-foundationType"
              label="Giải Pháp Kết Cấu Móng (V2) *"
              disabled={isReadOnly}
              value={formData.foundationType || ''}
              onChange={(e) => updateFormData({ foundationType: e.target.value })}
              options={FOUNDATION_TYPES.map((f) => ({ value: f, label: f }))}
            />
          </div>

          <div>
            <Select
              id="input-foundationSource"
              label="Nguồn Thông Tin Xác Định Móng"
              disabled={isReadOnly}
              value={formData.foundationSource || 'Bản vẽ hoàn công'}
              onChange={(e) => updateFormData({ foundationSource: e.target.value })}
              options={[
                { value: 'Bản vẽ hoàn công', label: 'Bản vẽ hoàn công' },
                { value: 'Hồ sơ thiết kế kết cấu', label: 'Hồ sơ thiết kế kết cấu' },
                { value: 'Ban Quản Lý / CĐT cung cấp', label: 'Ban Quản Lý / CĐT cung cấp' },
                { value: 'Quan sát hiện trường / Suy đoán', label: 'Quan sát hiện trường / Suy đoán' },
                { value: 'Không rõ thông tin', label: 'Không rõ thông tin' },
              ]}
            />
          </div>

          <div>
            <label className="text-xs font-bold text-slate-700 block mb-1">
              Kích Thước Cọc / Móng / Tường Vây (Dài x Rộng)
            </label>
            <div className="flex items-center gap-1.5">
              <Input
                type="number"
                disabled={isReadOnly}
                placeholder="Rộng"
                value={formData.pileWidthMm === '' || formData.pileWidthMm === undefined ? '' : formData.pileWidthMm}
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
                disabled={isReadOnly}
                placeholder="Dài / Sâu"
                value={formData.pileLengthMm === '' || formData.pileLengthMm === undefined ? '' : formData.pileLengthMm}
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
            <span className="text-[11px] text-slate-400 italic">
              VD: Cọc khoan nhồi D1000 mm (100 cm), barrette 80 x 280 cm (để trống nếu không rõ)
            </span>
          </div>

          {/* Thông số móng bổ sung */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:col-span-2 p-3.5 bg-slate-50/80 rounded-xl border border-slate-200">
            <div>
              <Input
                id="input-foundationDepthM"
                label="Chiều Sâu Đáy Móng / Hầm (m)"
                disabled={isReadOnly}
                type="number"
                step="any"
                min={0}
                placeholder="VD: 18.5"
                value={formData.foundationDepthM === '' || formData.foundationDepthM === undefined ? '' : formData.foundationDepthM}
                onChange={(e) =>
                  updateFormData({ foundationDepthM: e.target.value === '' ? '' : Number(e.target.value) })
                }
                hint="Chiều sâu đáy đài móng / sàn hầm"
              />
            </div>
            <div>
              <Input
                id="input-foundationDensity"
                label="Mật Độ Cọc / Móng (SL/m²)"
                disabled={isReadOnly}
                type="number"
                step="any"
                min={0}
                placeholder="VD: 0.08"
                value={formData.foundationDensity === '' || formData.foundationDensity === undefined ? '' : formData.foundationDensity}
                onChange={(e) =>
                  updateFormData({ foundationDensity: e.target.value === '' ? '' : Number(e.target.value) })
                }
                hint="Số lượng cọc/đài trên m²"
              />
            </div>
            <div>
              <Input
                id="input-foundationSpacingM"
                label="Khoảng Cách Giữa Móng (m)"
                disabled={isReadOnly}
                type="number"
                step="any"
                min={0}
                placeholder="VD: 3.5"
                value={formData.foundationSpacingM === '' || formData.foundationSpacingM === undefined ? '' : formData.foundationSpacingM}
                onChange={(e) =>
                  updateFormData({ foundationSpacingM: e.target.value === '' ? '' : Number(e.target.value) })
                }
                hint="Khoảng cách tim cọc hoặc bước móng (m)"
              />
            </div>
            <div className="sm:col-span-3 mt-1">
              <Input
                id="input-foundationNotes"
                label="Ghi Chú Về Móng & Địa Tầng"
                disabled={isReadOnly}
                placeholder="Ghi chú chi tiết về cọc khoan nhồi, tầng cát cuội sỏi, biện pháp thi công hầm, đài móng toà nhà..."
                value={formData.foundationNotes || ''}
                onChange={(e) => updateFormData({ foundationNotes: e.target.value })}
              />
            </div>
          </div>
        </div>
      </Card>

      {/* 2.3. Hồ sơ bản vẽ hoàn công / Kết cấu (Đánh giá CAT Móng - V3) */}
      <Card className="border-indigo-200 bg-white shadow-xs">
        <div className="flex items-center justify-between gap-2 mb-2 pb-2 border-b border-indigo-100">
          <div className="flex items-center gap-2">
            <FileCheck className="w-5 h-5 text-indigo-600" />
            <div>
              <h2 className="text-base sm:text-lg font-bold text-slate-800">
                2.3. Đánh Giá CAT
              </h2>
              <p className="text-xs text-slate-500">
                Đánh giá mức độ am hiểu hồ sơ địa kỹ thuật móng toà nhà phục vụ xếp hạng rủi ro V3
              </p>
            </div>
          </div>
          <InfoPopover title="Đánh giá CAT (V3)">
            Phân cấp từ 1 đến 5 theo tài liệu quy chuẩn kỹ thuật: Trường hợp A (Có bản vẽ CAT 1..2), Trường hợp B (Không có bản vẽ CAT 3..4), Trường hợp C (Không rõ CAT 5).
          </InfoPopover>
        </div>

        {/* 3 Lựa Chọn Tình Trạng Bản Vẽ */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
          <button
            type="button"
            disabled={isReadOnly}
            onClick={() => {
              if (isReadOnly) return;
              setHasDrawingOption('HAS_DRAWING');
              handleSelectCatScore(1);
            }}
            className={`p-3 rounded-xl border text-left transition-all flex flex-col gap-1 ${
              isReadOnly ? 'cursor-default' : 'cursor-pointer'
            } ${
              hasDrawingOption === 'HAS_DRAWING'
                ? 'bg-emerald-50 border-emerald-400 text-emerald-900 ring-2 ring-emerald-500/20 shadow-xs'
                : 'border-slate-200 hover:bg-slate-50 text-slate-700'
            }`}
          >
            <div className="flex items-center gap-2 font-bold text-xs">
              <FileCheck className="w-4 h-4 text-emerald-600 shrink-0" />
              <span>A. Có bản vẽ</span>
            </div>
            <span className="text-[11px] text-slate-500">
              Có hồ sơ hoàn công / bản vẽ kết cấu móng tòa nhà
            </span>
          </button>

          <button
            type="button"
            disabled={isReadOnly}
            onClick={() => {
              if (isReadOnly) return;
              setHasDrawingOption('NO_DRAWING');
              handleSelectCatScore(3);
            }}
            className={`p-3 rounded-xl border text-left transition-all flex flex-col gap-1 ${
              isReadOnly ? 'cursor-default' : 'cursor-pointer'
            } ${
              hasDrawingOption === 'NO_DRAWING'
                ? 'bg-amber-50 border-amber-400 text-amber-900 ring-2 ring-amber-500/20 shadow-xs'
                : 'border-slate-200 hover:bg-slate-50 text-slate-700'
            }`}
          >
            <div className="flex items-center gap-2 font-bold text-xs">
              <FileX className="w-4 h-4 text-amber-600 shrink-0" />
              <span>B. Không có bản vẽ</span>
            </div>
            <span className="text-[11px] text-slate-500">
              Chỉ khảo sát hiện trạng thực tế, BQL không lưu bản vẽ móng
            </span>
          </button>

          <button
            type="button"
            disabled={isReadOnly}
            onClick={() => {
              if (isReadOnly) return;
              setHasDrawingOption('UNKNOWN');
              handleSelectCatScore(5);
            }}
            className={`p-3 rounded-xl border text-left transition-all flex flex-col gap-1 ${
              isReadOnly ? 'cursor-default' : 'cursor-pointer'
            } ${
              hasDrawingOption === 'UNKNOWN'
                ? 'bg-red-50 border-red-400 text-red-900 ring-2 ring-red-500/20 shadow-xs'
                : 'border-slate-200 hover:bg-slate-50 text-slate-700'
            }`}
          >
            <div className="flex items-center gap-2 font-bold text-xs">
              <AlertTriangle className="w-4 h-4 text-red-600 shrink-0" />
              <span>C. Không rõ thông tin</span>
            </div>
            <span className="text-[11px] text-slate-500">
              Mất liên lạc BQL hoặc không có bất kỳ dữ liệu nào
            </span>
          </button>
        </div>

        {/* Chi tiết Trường hợp A: Có bản vẽ */}
        {hasDrawingOption === 'HAS_DRAWING' && (
          <div className="mt-4 p-3.5 rounded-xl bg-emerald-50/60 border border-emerald-200 space-y-3 animate-in fade-in">
            <span className="text-xs font-bold text-emerald-900 block">
              Chọn mức độ chi tiết của bản vẽ móng tòa nhà:
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <button
                type="button"
                disabled={isReadOnly}
                onClick={() => handleSelectCatScore(1)}
                className={`p-2.5 rounded-lg border text-left transition-all ${
                  isReadOnly ? 'cursor-default' : 'cursor-pointer'
                } ${
                  formData.foundationCatScore === 1
                    ? 'bg-white border-emerald-500 text-emerald-950 shadow-xs font-bold'
                    : 'bg-white/80 border-emerald-200 text-slate-700 hover:bg-white'
                }`}
              >
                <div className="text-xs">Mức 1 (CAT = 1) - Bản vẽ Đầy Đủ Chi Tiết</div>
                <div className="text-[11px] font-normal text-slate-500 mt-0.5">
                  Có đầy đủ cao độ mũi cọc, sức chịu tải thiết kế, mặt cắt địa chất
                </div>
              </button>

              <button
                type="button"
                disabled={isReadOnly}
                onClick={() => handleSelectCatScore(2)}
                className={`p-2.5 rounded-lg border text-left transition-all ${
                  isReadOnly ? 'cursor-default' : 'cursor-pointer'
                } ${
                  formData.foundationCatScore === 2
                    ? 'bg-white border-emerald-500 text-emerald-950 shadow-xs font-bold'
                    : 'bg-white/80 border-emerald-200 text-slate-700 hover:bg-white'
                }`}
              >
                <div className="text-xs">Mức 2 (CAT = 2) - Bản vẽ Sơ Bộ / Tương Đối</div>
                <div className="text-[11px] font-normal text-slate-500 mt-0.5">
                  Có mặt bằng bố trí đài cọc/móng nhưng thiếu thông số địa chất sâu
                </div>
              </button>
            </div>

            {/* Upload Ảnh Bản Vẽ Hoàn Công */}
            <div className="pt-2">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-slate-700">
                  Ảnh chụp bản vẽ hoàn công / kết cấu móng tòa nhà:
                </span>
                {!isReadOnly && (
                  <Button
                    size="sm"
                    variant="outline"
                    icon={<Plus className="w-3.5 h-3.5" />}
                    onClick={() => {
                      const current = formData.asBuiltDrawingPhotos || [];
                      updateFormData({
                        asBuiltDrawingPhotos: [
                          ...current,
                          {
                            url: '',
                            notes: `Bản vẽ móng trang ${current.length + 1}`,
                          },
                        ],
                      });
                    }}
                  >
                    Thêm Trang Bản Vẽ
                  </Button>
                )}
              </div>

              {/* Danh sách ảnh chụp bản vẽ */}
              {(!formData.asBuiltDrawingPhotos || formData.asBuiltDrawingPhotos.length === 0) && (
                <div className="p-3 bg-white rounded-lg border border-dashed border-emerald-300 text-center">
                  <PhotoCaptureInput
                    label="Chụp / Tải lên bản vẽ hoàn công trang 1"
                    value={formData.asBuiltDrawingPhotoUrl || ''}
                    readOnly={isReadOnly}
                    watermarkOptions={{
                      parcelCode: formData.projectParcelCode || 'GENERAL',
                      buildingCode: formData.projectParcelCode || 'GENERAL',
                      floor: 'FOUND',
                      photoType: 'DRAWING',
                      photoIndex: 1,
                      areaType: 'GENERAL_TOWER',
                      category: 'foundation-drawings',
                    }}
                    onChange={(url: string, code?: string) => {
                      updateFormData({
                        asBuiltDrawingPhotoUrl: url,
                        asBuiltDrawingPhotos: [
                          {
                            url,
                            photoCode: code,
                            notes: 'Bản vẽ móng toà nhà - Trang 1',
                          },
                        ],
                      });
                    }}
                  />
                </div>
              )}

              {formData.asBuiltDrawingPhotos && formData.asBuiltDrawingPhotos.length > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {formData.asBuiltDrawingPhotos.map((photo, idx) => (
                    <div key={idx} className="p-3 bg-white rounded-xl border border-emerald-200 relative space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-emerald-800">Trang {idx + 1}</span>
                        {!isReadOnly && (
                          <button
                            type="button"
                            onClick={() => {
                              const updated = (formData.asBuiltDrawingPhotos || []).filter((_, i) => i !== idx);
                              updateFormData({ asBuiltDrawingPhotos: updated });
                            }}
                            className="text-red-500 hover:text-red-700 p-1 cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                      <PhotoCaptureInput
                        label={`Bản vẽ trang ${idx + 1}`}
                        value={photo.url}
                        photoCode={photo.photoCode}
                        readOnly={isReadOnly}
                        watermarkOptions={{
                          parcelCode: formData.projectParcelCode || 'GENERAL',
                          buildingCode: formData.projectParcelCode || 'GENERAL',
                          floor: 'FOUND',
                          photoType: 'DRAWING',
                          photoIndex: idx + 1,
                          areaType: 'GENERAL_TOWER',
                          category: 'foundation-drawings',
                        }}
                        onChange={(url: string, code?: string) => {
                          const updated = [...(formData.asBuiltDrawingPhotos || [])];
                          updated[idx] = { ...updated[idx], url, photoCode: code };
                          updateFormData({ asBuiltDrawingPhotos: updated });
                        }}
                      />
                      <Input
                        placeholder="Mô tả bản vẽ (VD: Mặt bằng đài cọc tầng hầm B2)"
                        disabled={isReadOnly}
                        value={photo.notes || ''}
                        onChange={(e) => {
                          const updated = [...(formData.asBuiltDrawingPhotos || [])];
                          updated[idx] = { ...updated[idx], notes: e.target.value };
                          updateFormData({ asBuiltDrawingPhotos: updated });
                        }}
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Chi tiết Trường hợp B: Không có bản vẽ */}
        {hasDrawingOption === 'NO_DRAWING' && (
          <div className="mt-4 p-3.5 rounded-xl bg-amber-50/60 border border-amber-200 space-y-2.5 animate-in fade-in">
            <span className="text-xs font-bold text-amber-900 block">
              Ước lượng giải pháp móng dựa trên quy mô công trình:
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <button
                type="button"
                onClick={() => handleSelectCatScore(3)}
                className={`p-2.5 rounded-lg border text-left transition-all cursor-pointer ${
                  formData.foundationCatScore === 3
                    ? 'bg-white border-amber-500 text-amber-950 shadow-xs font-bold'
                    : 'bg-white/80 border-amber-200 text-slate-700 hover:bg-white'
                }`}
              >
                <div className="text-xs">Mức 3 (CAT = 3) - Có thể suy đoán cọc khoan nhồi / barrette</div>
                <div className="text-[11px] font-normal text-slate-500 mt-0.5">
                  Tòa nhà cao tầng hiện đại (&gt; 10 tầng), chắc chắn sử dụng cọc sâu chịu lực
                </div>
              </button>

              <button
                type="button"
                onClick={() => handleSelectCatScore(4)}
                className={`p-2.5 rounded-lg border text-left transition-all cursor-pointer ${
                  formData.foundationCatScore === 4
                    ? 'bg-white border-amber-500 text-amber-950 shadow-xs font-bold'
                    : 'bg-white/80 border-amber-200 text-slate-700 hover:bg-white'
                }`}
              >
                <div className="text-xs">Mức 4 (CAT = 4) - Khó suy đoán / Móng hỗn hợp</div>
                <div className="text-[11px] font-normal text-slate-500 mt-0.5">
                  Chung cư cũ, chung cư mini hoặc cơi nới không rõ móng
                </div>
              </button>
            </div>
          </div>
        )}

        {/* Chi tiết Trường hợp C: Không rõ */}
        {hasDrawingOption === 'UNKNOWN' && (
          <div className="mt-4 p-3 rounded-xl bg-red-50 border border-red-200 text-xs text-red-800 animate-in fade-in">
            Không rõ thông tin móng (Mặc định xếp mức rủi ro CAT = 5).
          </div>
        )}
      </Card>

      {/* Action Footer */}
      <div className="flex items-center justify-between gap-4 pt-4 border-t border-slate-200">
        <Button variant="secondary" size="md" onClick={prevStep} className="cursor-pointer">
          ◀ Xem Lại Bước 1 (Ngoại quan toà)
        </Button>
        <Button size="lg" className="bg-indigo-600 hover:bg-indigo-700 text-white cursor-pointer" onClick={nextStep}>
          Tiếp tục: Bước 3 (Lịch sử & BQL) ➔
        </Button>
      </div>
    </div>
  );
};
