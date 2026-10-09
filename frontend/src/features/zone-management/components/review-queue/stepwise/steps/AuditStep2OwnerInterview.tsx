import React from 'react';
import { Layers, History, ShieldAlert, FileText, Maximize2, Sparkles, AlertCircle, Building, Ruler, Calendar } from 'lucide-react';
import {
  STRUCTURE_SYSTEMS,
  FOUNDATION_TYPES,
} from '../../../../../survey-phase1/constants/surveyOptionsConstants';
import {
  RENOVATION_OPTIONS,
  MAJOR_REPAIR_OPTIONS,
  PAST_SETTLEMENT_OPTIONS,
  NEIGHBOR_DAMAGE_OPTIONS,
  FIRE_FLOOD_OPTIONS,
} from '../../../../../survey-phase1/constants/historyInterviewConstants';

import type { AuditStepwiseFormState, StepwiseHistoryInterview } from '../types';

interface Props {
  isEditMode: boolean;
  formState: AuditStepwiseFormState;
  handleFieldChange: (key: string, label: string, val: unknown) => void;
  handleNestedFieldChange: (parentKey: string, childKey: string, label: string, val: unknown) => void;
  onOpenPhotoZoom?: (url: string, title?: string, photoCode?: string) => void;
}

export const AuditStep2OwnerInterview: React.FC<Props> = ({
  isEditMode,
  formState,
  handleFieldChange,
  handleNestedFieldChange,
  onOpenPhotoZoom,
}) => {
  const hi: StepwiseHistoryInterview = formState.historyInterview || {};

  // E5 Resonance score calculation
  const qScores = [
    { name: '1. Cơi nới - tải trọng', score: hi.renovationLoad ?? 0 },
    { name: '2. Sửa chữa lớn', score: hi.majorRepair ?? 0 },
    { name: '3. Lún - nghiêng quá khứ', score: hi.pastSettlement ?? 0 },
    { name: '4. Thiệt hại lân cận', score: hi.neighborDamage ?? 0 },
    { name: '5. Sự cố cháy nổ / ngập', score: hi.fireFloodIncident ?? 0 },
  ];
  const maxQScore = Math.max(...qScores.map((q) => q.score));
  const countHigh = qScores.filter((q) => q.score > 2).length;
  const isResonance = countHigh >= 2;
  const calculatedE5 = isResonance ? 4 : maxQScore;

  // As-built drawings list
  const asBuiltPhotos: Array<{ url: string; photoCode?: string; notes?: string }> =
    Array.isArray(formState.asBuiltDrawingPhotos) && formState.asBuiltDrawingPhotos.length > 0
      ? formState.asBuiltDrawingPhotos
      : formState.asBuiltDrawingPhotoUrl
      ? [{ url: formState.asBuiltDrawingPhotoUrl, photoCode: 'AS_BUILT_01', notes: 'Bản vẽ hoàn công' }]
      : [];

  const catScore = formState.foundationCatScore ?? 3;

  return (
    <section id="step-2" className="scroll-mt-6 bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
      {/* Header */}
      <div className="p-4 sm:p-5 bg-slate-50/80 border-b border-slate-100 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <span className="px-2 py-0.5 rounded-lg bg-sky-600 text-white font-mono font-black text-xs">
            Bước 02
          </span>
          <div>
            <h3 className="text-sm sm:text-base font-black text-slate-800">
              Kiến Trúc, Kết Cấu Chịu Lực, Nền Móng & Phỏng Vấn Chủ Hộ
            </h3>
            <p className="text-[11px] text-slate-500">
              Đánh giá tải trọng, độ cứng uốn, phân loại CAT móng và tiền sử cộng hưởng hư hại
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="px-2.5 py-1 rounded-xl text-xs font-black bg-emerald-100 text-emerald-800 border border-emerald-200">
            CAT Móng: Mức {catScore}
          </span>
          <span className="px-2.5 py-1 rounded-xl text-xs font-black bg-purple-100 text-purple-800 border border-purple-200 flex items-center gap-1">
            <Sparkles className="w-3.5 h-3.5 text-purple-600" />
            <span>Điểm E5 = {calculatedE5}/4</span>
          </span>
        </div>
      </div>

      <div className="p-5 space-y-6">
        {/* 2.1. HÌNH HỌC QUY MÔ KIẾN TRÚC CÔNG TRÌNH */}
        <div className="space-y-3">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100">
            <div className="flex items-center gap-1.5 text-xs font-black uppercase text-slate-800 tracking-wider">
              <Building className="w-4 h-4 text-sky-600" />
              <span>2.1. Hình Học Quy Mô Kiến Trúc Công Trình</span>
            </div>
            <span className="text-[11px] font-bold text-sky-700 bg-sky-50 px-2 py-0.5 rounded-md border border-sky-200">
              Cơ sở tính tải trọng và độ cứng uốn
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-xs">
            {/* Số tầng nổi & ngầm */}
            <div>
              <label className="text-[11px] font-bold text-slate-500 uppercase block mb-1">
                Số tầng (Nổi / Hầm) *
              </label>
              {isEditMode ? (
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min={1}
                    value={formState.aboveFloors ?? 1}
                    onChange={(e) => handleFieldChange('aboveFloors', 'Tầng nổi', Number(e.target.value))}
                    className="w-1/2 px-2.5 py-1.5 bg-amber-50/40 border border-slate-300 rounded-lg font-bold"
                    placeholder="Nổi"
                  />
                  <input
                    type="number"
                    min={0}
                    value={formState.undergroundFloors ?? 0}
                    onChange={(e) => handleFieldChange('undergroundFloors', 'Tầng hầm', Number(e.target.value))}
                    className="w-1/2 px-2.5 py-1.5 bg-amber-50/40 border border-slate-300 rounded-lg font-bold"
                    placeholder="Hầm"
                  />
                </div>
              ) : (
                <div className="p-2 bg-slate-50 rounded-lg border border-slate-200 font-bold text-slate-800">
                  {formState.aboveFloors || 1} tầng nổi {Number(formState.undergroundFloors) > 0 ? `+ ${formState.undergroundFloors} hầm` : ''}
                </div>
              )}
            </div>

            {/* Diện tích sàn xây dựng */}
            <div>
              <label className="text-[11px] font-bold text-slate-500 uppercase block mb-1">
                Diện tích sàn xây dựng (m²) *
              </label>
              {isEditMode ? (
                <input
                  type="number"
                  step="any"
                  min={0}
                  value={formState.constructionAreaM2 ?? ''}
                  onChange={(e) => handleFieldChange('constructionAreaM2', 'Diện tích sàn XD', e.target.value ? Number(e.target.value) : '')}
                  placeholder="VD: 120.5"
                  className="w-full px-2.5 py-1.5 bg-amber-50/40 border border-slate-300 rounded-lg font-bold font-mono"
                />
              ) : (
                <div className="p-2 bg-slate-50 rounded-lg border border-slate-200 font-bold text-slate-800 font-mono">
                  {formState.constructionAreaM2 ? `${formState.constructionAreaM2} m²` : '---'}
                </div>
              )}
            </div>

            {/* Chiều cao công trình */}
            <div>
              <label className="text-[11px] font-bold text-slate-500 uppercase block mb-1">
                Chiều cao công trình (m) *
              </label>
              {isEditMode ? (
                <input
                  type="number"
                  step="any"
                  min={0}
                  value={formState.buildingHeightM ?? ''}
                  onChange={(e) => handleFieldChange('buildingHeightM', 'Chiều cao công trình', e.target.value ? Number(e.target.value) : '')}
                  placeholder="VD: 12.8"
                  className="w-full px-2.5 py-1.5 bg-amber-50/40 border border-slate-300 rounded-lg font-bold font-mono"
                />
              ) : (
                <div className="p-2 bg-slate-50 rounded-lg border border-slate-200 font-bold text-slate-800 font-mono">
                  {formState.buildingHeightM ? `${formState.buildingHeightM} m` : '---'}
                </div>
              )}
            </div>

            {/* Năm xây dựng */}
            <div>
              <label className="text-[11px] font-bold text-slate-500 uppercase block mb-1">
                Năm xây dựng / Tuổi thọ
              </label>
              {isEditMode ? (
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={formState.constructionYear || ''}
                    onChange={(e) => handleFieldChange('constructionYear', 'Năm xây dựng', e.target.value)}
                    placeholder="VD: 2015"
                    className="w-2/3 px-2 py-1.5 bg-amber-50/40 border border-slate-300 rounded-lg font-bold font-mono"
                  />
                  <label className="flex items-center gap-1 text-[10px] text-slate-600 font-semibold cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={Boolean(formState.isEstimatedYear)}
                      onChange={(e) => handleFieldChange('isEstimatedYear', 'Năm ước lượng', e.target.checked)}
                      className="rounded text-sky-600"
                    />
                    <span>Ước lượng</span>
                  </label>
                </div>
              ) : (
                <div className="p-2 bg-slate-50 rounded-lg border border-slate-200 font-bold text-slate-800">
                  {formState.constructionYear || '---'} {formState.isEstimatedYear ? '(Ước lượng)' : ''}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* 2.2. HỆ KẾT CẤU CHỊU LỰC, NỀN MÓNG & BẢN VẼ HOÀN CÔNG */}
        <div className="space-y-4 pt-3 border-t border-slate-100">
          <div className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center justify-between pb-2 border-b border-slate-100">
            <div className="flex items-center gap-1.5">
              <Layers className="w-4 h-4 text-emerald-600" />
              <span>2.2. Hệ Kết Cấu Chịu Lực, Chi Tiết Nền Móng & Bản Vẽ Hoàn Công</span>
            </div>
            <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-lg">
              Phân loại CAT {catScore}/5
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {/* Kết cấu chịu lực */}
            <div>
              <label className="text-[11px] font-bold text-slate-500 uppercase block mb-1">
                Kết cấu chịu lực chính *
              </label>
              {isEditMode ? (
                <select
                  value={formState.structureSystem || ''}
                  onChange={(e) => handleFieldChange('structureSystem', 'Kết cấu chịu lực', e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-amber-50/50 border border-amber-300 rounded-xl text-xs font-bold text-slate-800"
                >
                  <option value="">--- Chọn kết cấu chịu lực ---</option>
                  {STRUCTURE_SYSTEMS.map((s: string) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              ) : (
                <div className="p-2 bg-slate-50 rounded-xl border border-slate-100 text-xs font-bold text-slate-800">
                  {formState.structureSystem || '---'}
                </div>
              )}
            </div>

            {/* Giải pháp móng */}
            <div>
              <label className="text-[11px] font-bold text-slate-500 uppercase block mb-1">
                Giải pháp móng công trình *
              </label>
              {isEditMode ? (
                <select
                  value={formState.foundationType || ''}
                  onChange={(e) => handleFieldChange('foundationType', 'Loại móng', e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-amber-50/50 border border-amber-300 rounded-xl text-xs font-bold text-slate-800"
                >
                  <option value="">--- Chọn giải pháp móng ---</option>
                  {FOUNDATION_TYPES.map((f: string) => (
                    <option key={f} value={f}>
                      {f}
                    </option>
                  ))}
                </select>
              ) : (
                <div className="p-2 bg-slate-50 rounded-xl border border-slate-100 text-xs font-bold text-slate-800">
                  {formState.foundationType || '---'}
                </div>
              )}
            </div>

            {/* Đánh giá CAT Móng */}
            <div>
              <label className="text-[11px] font-bold text-slate-500 uppercase block mb-1">
                Phân Loại CAT Móng (Độ tin cậy) *
              </label>
              {isEditMode ? (
                <select
                  value={catScore}
                  onChange={(e) => handleFieldChange('foundationCatScore', 'Phân loại CAT móng', Number(e.target.value))}
                  className="w-full px-2.5 py-1.5 bg-amber-50/50 border border-amber-300 rounded-xl text-xs font-bold text-slate-800"
                >
                  <option value={1}>CAT 1 - Có bản vẽ hoàn công phê duyệt</option>
                  <option value={2}>CAT 2 - Có bản vẽ thiết kế kết cấu chủ nhà giữ</option>
                  <option value={3}>CAT 3 - Không bản vẽ, chủ nhà nhớ và khai rõ</option>
                  <option value={4}>CAT 4 - Suy luận từ số tầng & kết cấu</option>
                  <option value={5}>CAT 5 - Hoàn toàn không có dữ liệu (Rủi ro cao)</option>
                </select>
              ) : (
                <div className="p-2 bg-slate-50 rounded-xl border border-slate-100 text-xs font-bold text-emerald-800">
                  Mức {catScore}: {
                    catScore === 1 ? 'CAT 1 (Bản vẽ hoàn công)' :
                    catScore === 2 ? 'CAT 2 (Bản vẽ thiết kế)' :
                    catScore === 3 ? 'CAT 3 (Chủ nhà nhớ khai)' :
                    catScore === 4 ? 'CAT 4 (Suy luận khảo sát)' : 'CAT 5 (Không rõ dữ liệu)'
                  }
                </div>
              )}
            </div>
          </div>

          {/* Chi tiết thông số cọc & móng */}
          <div className="p-3.5 bg-slate-50/80 rounded-xl border border-slate-200 grid grid-cols-1 sm:grid-cols-4 gap-3">
            <div>
              <label className="text-[11px] font-bold text-slate-500 uppercase block mb-1">
                Chiều sâu đáy móng (m)
              </label>
              {isEditMode ? (
                <input
                  type="number"
                  step="0.1"
                  value={formState.foundationDepthM ?? ''}
                  onChange={(e) => handleFieldChange('foundationDepthM', 'Chiều sâu móng', e.target.value ? Number(e.target.value) : '')}
                  className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-bold font-mono"
                  placeholder="VD: 2.5"
                />
              ) : (
                <div className="text-xs font-bold text-slate-800 font-mono">
                  {formState.foundationDepthM ? `${formState.foundationDepthM} m` : 'Không xác định'}
                </div>
              )}
            </div>

            <div>
              <label className="text-[11px] font-bold text-slate-500 uppercase block mb-1">
                Kích thước cọc / móng
              </label>
              {isEditMode ? (
                <input
                  type="text"
                  value={formState.pileDimensionMm || formState.pileDimensions || ''}
                  onChange={(e) => handleFieldChange('pileDimensionMm', 'Kích thước cọc/móng', e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-bold font-mono"
                  placeholder="VD: 250x250 mm hoặc D600"
                />
              ) : (
                <div className="text-xs font-bold text-slate-800 font-mono">
                  {formState.pileDimensionMm || formState.pileDimensions || (formState.pileWidthMm && formState.pileLengthMm ? `${formState.pileWidthMm}x${formState.pileLengthMm} mm` : '---')}
                </div>
              )}
            </div>

            <div>
              <label className="text-[11px] font-bold text-slate-500 uppercase block mb-1">
                Mật độ móng (SL/m²)
              </label>
              {isEditMode ? (
                <input
                  type="number"
                  step="0.01"
                  value={formState.foundationDensity ?? ''}
                  onChange={(e) => handleFieldChange('foundationDensity', 'Mật độ móng', e.target.value ? Number(e.target.value) : '')}
                  className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-bold font-mono"
                  placeholder="VD: 0.15"
                />
              ) : (
                <div className="text-xs font-bold text-slate-800 font-mono">
                  {formState.foundationDensity ? `${formState.foundationDensity} SL/m²` : '---'}
                </div>
              )}
            </div>

            <div>
              <label className="text-[11px] font-bold text-slate-500 uppercase block mb-1">
                Khoảng cách giữa móng (m)
              </label>
              {isEditMode ? (
                <input
                  type="number"
                  step="0.1"
                  value={formState.foundationSpacingM ?? ''}
                  onChange={(e) => handleFieldChange('foundationSpacingM', 'Khoảng cách giữa móng', e.target.value ? Number(e.target.value) : '')}
                  className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-bold font-mono"
                  placeholder="VD: 3.2"
                />
              ) : (
                <div className="text-xs font-bold text-slate-800 font-mono">
                  {formState.foundationSpacingM ? `${formState.foundationSpacingM} m` : '---'}
                </div>
              )}
            </div>

            <div className="sm:col-span-4 mt-1">
              <label className="text-[11px] font-bold text-slate-500 uppercase block mb-1">
                Ghi chú về nền móng & địa tầng
              </label>
              {isEditMode ? (
                <input
                  type="text"
                  value={formState.foundationNotes || ''}
                  onChange={(e) => handleFieldChange('foundationNotes', 'Ghi chú móng', e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs"
                  placeholder="Ghi chú chi tiết về tình trạng móng, cừ gia cố, lớp đất nền..."
                />
              ) : (
                <div className="text-xs text-slate-700 italic">
                  {formState.foundationNotes || 'Không có ghi chú nền móng đặc biệt.'}
                </div>
              )}
            </div>
          </div>

          {/* Bản vẽ hoàn công / sơ đồ kết cấu */}
          <div className="p-3.5 bg-emerald-50/40 rounded-xl border border-emerald-200 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <FileText className="w-4 h-4 text-emerald-700" />
                <span className="text-xs font-bold text-emerald-950 uppercase">
                  Bản Vẽ Hoàn Công / Hồ Sơ Thiết Kế ({asBuiltPhotos.length} ảnh)
                </span>
              </div>
              <span className="text-[11px] text-emerald-700 font-semibold">
                {asBuiltPhotos.length > 0 ? '✓ Đã đính kèm hồ sơ' : 'Chưa có bản vẽ hoàn công'}
              </span>
            </div>

            {isEditMode && (
              <div className="p-2.5 bg-white rounded-lg border border-emerald-300 space-y-1.5">
                <label className="text-[11px] font-bold text-emerald-900 block">
                  Đường dẫn (URL) bản vẽ hoàn công / sơ đồ kết cấu:
                </label>
                <input
                  type="text"
                  value={formState.asBuiltDrawingPhotoUrl || (asBuiltPhotos[0]?.url || '')}
                  onChange={(e) => handleFieldChange('asBuiltDrawingPhotoUrl', 'URL bản vẽ hoàn công', e.target.value)}
                  placeholder="https://... hoặc đường dẫn ảnh bản vẽ hoàn công"
                  className="w-full p-1.5 text-xs border border-emerald-300 rounded font-mono"
                />
              </div>
            )}

            {asBuiltPhotos.length > 0 ? (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
                {asBuiltPhotos.map((photo, idx) => (
                  <div
                    key={idx}
                    className="group relative rounded-xl border border-emerald-200 bg-white overflow-hidden cursor-pointer shadow-2xs hover:shadow-md transition-all"
                    onClick={() => {
                      if (onOpenPhotoZoom && photo.url) {
                        onOpenPhotoZoom(photo.url, `Bản vẽ hoàn công trang #${idx + 1}`, photo.photoCode || `AS_BUILT_${idx + 1}`);
                      }
                    }}
                  >
                    <div className="aspect-4/3 w-full bg-slate-100 flex items-center justify-center overflow-hidden">
                      <img
                        src={photo.url}
                        alt={`Bản vẽ ${idx + 1}`}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                      />
                    </div>
                    <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white">
                      <Maximize2 className="w-5 h-5 drop-shadow-md" />
                    </div>
                    <div className="p-2 bg-white border-t border-slate-100">
                      <div className="text-[11px] font-bold text-slate-800 truncate">
                        {photo.photoCode || `Bản vẽ #${idx + 1}`}
                      </div>
                      {photo.notes && (
                        <div className="text-[10px] text-slate-500 truncate">{photo.notes}</div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              !isEditMode && (
                <div className="p-4 bg-white/80 rounded-lg border border-dashed border-emerald-300 text-center text-xs text-slate-500">
                  Công trình này không có bản vẽ hoàn công hoặc chưa được tải lên từ hiện trường.
                </div>
              )
            )}
          </div>
        </div>

        {/* 2.3. LỊCH SỬ CẢI TẠO & 5 CÂU HỎI PHỎNG VẤN CHUẨN HÓA (ĐIỂM E5 RESONANCE) */}
        <div className="space-y-4 pt-4 border-t border-slate-100">
          <div className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center justify-between pb-2 border-b border-slate-100">
            <div className="flex items-center gap-1.5">
              <History className="w-4 h-4 text-sky-600" />
              <span>2.3. Lịch Sử Sửa Chữa & Biến Dạng Quá Khứ (Điểm E5 Resonance)</span>
            </div>
            {isResonance && (
              <span className="text-[11px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-lg flex items-center gap-1">
                <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
                Cảnh báo cộng hưởng hư hại quá khứ
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {/* 1. Cơi nới tải trọng */}
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-bold text-slate-700 block">
                  1. Cơi nới / Thay đổi tải trọng
                </label>
                {hi.renovationYear && (
                  <span className="text-[10px] font-bold text-slate-500 bg-white px-1.5 py-0.5 rounded border border-slate-200">
                    Năm: {hi.renovationYear}
                  </span>
                )}
              </div>
              {isEditMode ? (
                <div className="space-y-1.5">
                  <select
                    value={hi.renovationLoad ?? 0}
                    onChange={(e) => handleNestedFieldChange('historyInterview', 'renovationLoad', 'Cơi nới tải trọng', Number(e.target.value))}
                    className="w-full p-1.5 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-800"
                  >
                    {RENOVATION_OPTIONS.map((opt: { score: number; label: string }) => (
                      <option key={opt.score} value={opt.score}>
                        {opt.score}đ - {opt.label}
                      </option>
                    ))}
                  </select>
                  <input
                    type="text"
                    value={hi.renovationYear || ''}
                    onChange={(e) => handleNestedFieldChange('historyInterview', 'renovationYear', 'Năm cơi nới', e.target.value)}
                    placeholder="Năm thực hiện (VD: 2020)..."
                    className="w-full p-1 text-xs border border-slate-300 rounded font-mono"
                  />
                </div>
              ) : (
                <div className="text-xs font-bold text-slate-800">
                  {RENOVATION_OPTIONS.find((o: { score: number; label: string }) => o.score === hi.renovationLoad)?.label || 'Không cơi nới'}
                </div>
              )}
              {/* Ghi chú lời khai */}
              <div className="text-[11px] text-slate-500 bg-white p-2 rounded-lg border border-slate-200">
                <span className="font-semibold text-slate-700 block mb-0.5">Lời khai chủ hộ:</span>
                {isEditMode ? (
                  <input
                    type="text"
                    value={hi.renovationNotes || ''}
                    onChange={(e) => handleNestedFieldChange('historyInterview', 'renovationNotes', 'Ghi chú cơi nới', e.target.value)}
                    className="w-full p-1 text-xs border border-slate-300 rounded"
                    placeholder="Chi tiết cơi nới..."
                  />
                ) : (
                  <span>{hi.renovationNotes || 'Không có ghi chú thêm.'}</span>
                )}
              </div>
            </div>

            {/* 2. Sửa chữa lớn */}
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-[11px] font-bold text-slate-700 block">
                  2. Sửa chữa lớn / Cải tạo kết cấu
                </label>
                {hi.majorRepairYear && (
                  <span className="text-[10px] font-bold text-slate-500 bg-white px-1.5 py-0.5 rounded border border-slate-200">
                    Năm: {hi.majorRepairYear}
                  </span>
                )}
              </div>
              {isEditMode ? (
                <div className="space-y-1.5">
                  <select
                    value={hi.majorRepair ?? 0}
                    onChange={(e) => handleNestedFieldChange('historyInterview', 'majorRepair', 'Sửa chữa lớn', Number(e.target.value))}
                    className="w-full p-1.5 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-800"
                  >
                    {MAJOR_REPAIR_OPTIONS.map((opt: { score: number; label: string }) => (
                      <option key={opt.score} value={opt.score}>
                        {opt.score}đ - {opt.label}
                      </option>
                    ))}
                  </select>
                  <input
                    type="text"
                    value={hi.majorRepairYear || ''}
                    onChange={(e) => handleNestedFieldChange('historyInterview', 'majorRepairYear', 'Năm sửa chữa', e.target.value)}
                    placeholder="Năm sửa chữa (VD: 2018)..."
                    className="w-full p-1 text-xs border border-slate-300 rounded font-mono"
                  />
                </div>
              ) : (
                <div className="text-xs font-bold text-slate-800">
                  {MAJOR_REPAIR_OPTIONS.find((o: { score: number; label: string }) => o.score === hi.majorRepair)?.label || 'Không sửa chữa lớn'}
                </div>
              )}
              <div className="text-[11px] text-slate-500 bg-white p-2 rounded-lg border border-slate-200">
                <span className="font-semibold text-slate-700 block mb-0.5">Lời khai chủ hộ:</span>
                {isEditMode ? (
                  <input
                    type="text"
                    value={hi.repairNotes || ''}
                    onChange={(e) => handleNestedFieldChange('historyInterview', 'repairNotes', 'Ghi chú sửa chữa', e.target.value)}
                    className="w-full p-1 text-xs border border-slate-300 rounded"
                    placeholder="Chi tiết sửa chữa..."
                  />
                ) : (
                  <span>{hi.repairNotes || 'Không có ghi chú thêm.'}</span>
                )}
              </div>
            </div>

            {/* 3. Lún nứt quá khứ */}
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 space-y-2">
              <label className="text-[11px] font-bold text-slate-700 block">
                3. Lún nứt / Nghiêng trước đây
              </label>
              {isEditMode ? (
                <select
                  value={hi.pastSettlement ?? 0}
                  onChange={(e) => handleNestedFieldChange('historyInterview', 'pastSettlement', 'Lún nứt quá khứ', Number(e.target.value))}
                  className="w-full p-1.5 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-800"
                >
                  {PAST_SETTLEMENT_OPTIONS.map((opt: { score: number; label: string }) => (
                    <option key={opt.score} value={opt.score}>
                      {opt.score}đ - {opt.label}
                    </option>
                  ))}
                </select>
              ) : (
                <div className="text-xs font-bold text-slate-800">
                  {PAST_SETTLEMENT_OPTIONS.find((o: { score: number; label: string }) => o.score === hi.pastSettlement)?.label || 'Không có tiền sử lún nứt'}
                </div>
              )}
              <div className="text-[11px] text-slate-500 bg-white p-2 rounded-lg border border-slate-200">
                <span className="font-semibold text-slate-700 block mb-0.5">Lời khai chủ hộ:</span>
                {isEditMode ? (
                  <input
                    type="text"
                    value={hi.settlementNotes || ''}
                    onChange={(e) => handleNestedFieldChange('historyInterview', 'settlementNotes', 'Ghi chú lún nứt', e.target.value)}
                    className="w-full p-1 text-xs border border-slate-300 rounded"
                    placeholder="Chi tiết lún nứt trước đây..."
                  />
                ) : (
                  <span>{hi.settlementNotes || 'Không có ghi chú thêm.'}</span>
                )}
              </div>
            </div>

            {/* 4. Thiệt hại lân cận */}
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 space-y-2">
              <label className="text-[11px] font-bold text-slate-700 block">
                4. Hư hại do công trình lân cận
              </label>
              {isEditMode ? (
                <select
                  value={hi.neighborDamage ?? 0}
                  onChange={(e) => handleNestedFieldChange('historyInterview', 'neighborDamage', 'Hư hại lân cận', Number(e.target.value))}
                  className="w-full p-1.5 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-800"
                >
                  {NEIGHBOR_DAMAGE_OPTIONS.map((opt: { score: number; label: string }) => (
                    <option key={opt.score} value={opt.score}>
                      {opt.score}đ - {opt.label}
                    </option>
                  ))}
                </select>
              ) : (
                <div className="text-xs font-bold text-slate-800">
                  {NEIGHBOR_DAMAGE_OPTIONS.find((o: { score: number; label: string }) => o.score === hi.neighborDamage)?.label || 'Không bị ảnh hưởng lân cận'}
                </div>
              )}
              <div className="text-[11px] text-slate-500 bg-white p-2 rounded-lg border border-slate-200">
                <span className="font-semibold text-slate-700 block mb-0.5">Lời khai chủ hộ:</span>
                {isEditMode ? (
                  <input
                    type="text"
                    value={hi.neighborNotes || ''}
                    onChange={(e) => handleNestedFieldChange('historyInterview', 'neighborNotes', 'Ghi chú hư hại lân cận', e.target.value)}
                    className="w-full p-1 text-xs border border-slate-300 rounded"
                    placeholder="Chi tiết công trình lân cận gây hại..."
                  />
                ) : (
                  <span>{hi.neighborNotes || 'Không có ghi chú thêm.'}</span>
                )}
              </div>
            </div>

            {/* 5. Sự cố nghiêm trọng */}
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 space-y-2">
              <label className="text-[11px] font-bold text-slate-700 block">
                5. Sự cố cháy nổ / Ngập úng
              </label>
              {isEditMode ? (
                <select
                  value={hi.fireFloodIncident ?? 0}
                  onChange={(e) => handleNestedFieldChange('historyInterview', 'fireFloodIncident', 'Sự cố nghiêm trọng', Number(e.target.value))}
                  className="w-full p-1.5 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-800"
                >
                  {FIRE_FLOOD_OPTIONS.map((opt: { score: number; label: string }) => (
                    <option key={opt.score} value={opt.score}>
                      {opt.score}đ - {opt.label}
                    </option>
                  ))}
                </select>
              ) : (
                <div className="text-xs font-bold text-slate-800">
                  {FIRE_FLOOD_OPTIONS.find((o: { score: number; label: string }) => o.score === hi.fireFloodIncident)?.label || 'Không có sự cố'}
                </div>
              )}
              <div className="text-[11px] text-slate-500 bg-white p-2 rounded-lg border border-slate-200">
                <span className="font-semibold text-slate-700 block mb-0.5">Lời khai chủ hộ:</span>
                {isEditMode ? (
                  <input
                    type="text"
                    value={hi.fireFloodNotes || ''}
                    onChange={(e) => handleNestedFieldChange('historyInterview', 'fireFloodNotes', 'Ghi chú sự cố', e.target.value)}
                    className="w-full p-1 text-xs border border-slate-300 rounded"
                    placeholder="Chi tiết sự cố cháy nổ, ngập..."
                  />
                ) : (
                  <span>{hi.fireFloodNotes || 'Không có ghi chú thêm.'}</span>
                )}
              </div>
            </div>

            {/* Thiết bị nhạy cảm rung chấn */}
            <div className="p-3 bg-purple-50/50 rounded-xl border border-purple-200 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-purple-900 block">
                  Thiết Bị Nhạy Cảm Rung Chấn
                </span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-200 text-purple-900">
                  {hi.sensitiveEquipment?.has ? 'CÓ' : 'KHÔNG'}
                </span>
              </div>
              {isEditMode ? (
                <div className="space-y-1.5">
                  <label className="flex items-center gap-1.5 text-xs font-bold text-purple-900 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={Boolean(hi.sensitiveEquipment?.has)}
                      onChange={(e) =>
                        handleNestedFieldChange('historyInterview', 'sensitiveEquipment', 'Thiết bị nhạy cảm', {
                          ...hi.sensitiveEquipment,
                          has: e.target.checked,
                        })
                      }
                      className="rounded text-purple-600"
                    />
                    <span>Có thiết bị nhạy cảm</span>
                  </label>
                  {hi.sensitiveEquipment?.has && (
                    <input
                      type="text"
                      value={hi.sensitiveEquipment?.description || ''}
                      onChange={(e) =>
                        handleNestedFieldChange('historyInterview', 'sensitiveEquipment', 'Mô tả thiết bị', {
                          ...hi.sensitiveEquipment,
                          description: e.target.value,
                        })
                      }
                      placeholder="Mô tả thiết bị (VD: Máy cộng hưởng từ, kính hiển vi điện tử...)"
                      className="w-full p-1 bg-white border border-purple-300 rounded text-xs text-purple-950"
                    />
                  )}
                </div>
              ) : (
                <div className="text-[11px] text-slate-600">
                  {hi.sensitiveEquipment?.has ? (
                    <span className="text-purple-900 font-semibold">
                      {hi.sensitiveEquipment?.description || 'Có thiết bị nhạy cảm (Lab, Y tế, Server...)'}
                    </span>
                  ) : (
                    'Không có thiết bị chính xác hoặc máy móc nhạy cảm rung chấn.'
                  )}
                </div>
              )}
            </div>

            {/* Hoạt động sản xuất / Vận hành 24/7 */}
            <div className="p-3 bg-amber-50/50 rounded-xl border border-amber-200 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold text-amber-900 block">
                  Vận Hành / Sản Xuất 24/7
                </span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-200 text-amber-900">
                  {hi.continuousOperation247?.has ? 'CÓ' : 'KHÔNG'}
                </span>
              </div>
              {isEditMode ? (
                <div className="space-y-1.5">
                  <label className="flex items-center gap-1.5 text-xs font-bold text-amber-900 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={Boolean(hi.continuousOperation247?.has)}
                      onChange={(e) =>
                        handleNestedFieldChange('historyInterview', 'continuousOperation247', 'Vận hành 24/7', {
                          ...hi.continuousOperation247,
                          has: e.target.checked,
                        })
                      }
                      className="rounded text-amber-600"
                    />
                    <span>Hoạt động sản xuất liên tục 24/7</span>
                  </label>
                  {hi.continuousOperation247?.has && (
                    <input
                      type="text"
                      value={hi.continuousOperation247?.notes || ''}
                      onChange={(e) =>
                        handleNestedFieldChange('historyInterview', 'continuousOperation247', 'Ghi chú vận hành', {
                          ...hi.continuousOperation247,
                          notes: e.target.value,
                        })
                      }
                      placeholder="Chi tiết ca kíp, dây chuyền hoạt động..."
                      className="w-full p-1 bg-white border border-amber-300 rounded text-xs text-amber-950"
                    />
                  )}
                </div>
              ) : (
                <div className="text-[11px] text-slate-600">
                  {hi.continuousOperation247?.has ? (
                    <span className="text-amber-900 font-semibold">
                      {hi.continuousOperation247?.notes || 'Công trình duy trì hoạt động sản xuất hoặc phục vụ liên tục 24/7'}
                    </span>
                  ) : (
                    'Không có yêu cầu vận hành hoặc sản xuất đặc biệt 24/7.'
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};
