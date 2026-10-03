import React from 'react';
import { Layers, History, ShieldAlert, FileText, Maximize2, Sparkles, AlertCircle, FileCheck, CheckCircle2 } from 'lucide-react';
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

interface Props {
  isEditMode: boolean;
  formState: Record<string, any>;
  handleFieldChange: (key: string, label: string, val: any) => void;
  handleNestedFieldChange: (parentKey: string, childKey: string, label: string, val: any) => void;
  onOpenPhotoZoom?: (url: string, title?: string, photoCode?: string) => void;
}

export const AuditStep2OwnerInterview: React.FC<Props> = ({
  isEditMode,
  formState,
  handleFieldChange,
  handleNestedFieldChange,
  onOpenPhotoZoom,
}) => {
  const hi = formState.historyInterview || {};

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
          <h3 className="text-sm sm:text-base font-black text-slate-800">
            Kết Cấu Chịu Lực, Giải Pháp Móng & 5 Câu Hỏi Phỏng Vấn Chủ Hộ
          </h3>
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
        {/* 2.1. Khảo sát kiến trúc & kết cấu nền móng */}
        <div className="space-y-4">
          <div className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center justify-between pb-2 border-b border-slate-100">
            <div className="flex items-center gap-1.5">
              <Layers className="w-4 h-4 text-emerald-600" />
              <span>2.1. Khảo Sát Kiến Trúc, Kết Cấu Nền Móng & Bản Vẽ Hoàn Công</span>
            </div>
            {isResonance && (
              <span className="text-[11px] font-bold text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-lg flex items-center gap-1">
                <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
                Cảnh báo cộng hưởng hư hại quá khứ
              </span>
            )}
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
                  {STRUCTURE_SYSTEMS.map((s: any) => (
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
                  {FOUNDATION_TYPES.map((f: any) => (
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
                Chiều sâu móng (m)
              </label>
              {isEditMode ? (
                <input
                  type="number"
                  step="0.1"
                  value={formState.foundationDepthM ?? ''}
                  onChange={(e) => handleFieldChange('foundationDepthM', 'Chiều sâu móng', e.target.value ? Number(e.target.value) : '')}
                  className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-bold"
                  placeholder="VD: 2.5"
                />
              ) : (
                <div className="text-xs font-bold text-slate-800">
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
                  value={formState.pileDimensionMm || ''}
                  onChange={(e) => handleFieldChange('pileDimensionMm', 'Kích thước cọc/móng', e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-bold"
                  placeholder="VD: 25 x 25 cm hoặc D60 cm"
                />
              ) : (
                <div className="text-xs font-bold text-slate-800">
                  {formState.pileDimensionMm || '---'}
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
                  className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-bold"
                  placeholder="VD: 0.15"
                />
              ) : (
                <div className="text-xs font-bold text-slate-800">
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
                  className="w-full px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-bold"
                  placeholder="VD: 3.2"
                />
              ) : (
                <div className="text-xs font-bold text-slate-800">
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
              <div className="p-4 bg-white/80 rounded-lg border border-dashed border-emerald-300 text-center text-xs text-slate-500">
                Công trình này không có bản vẽ hoàn công hoặc chưa được tải lên từ hiện trường.
              </div>
            )}
          </div>
        </div>

        {/* 2.2. 5 Câu hỏi phỏng vấn chuẩn hóa & Ghi chú lời khai gia chủ */}
        <div className="space-y-4 pt-4 border-t border-slate-100">
          <div className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center justify-between pb-2 border-b border-slate-100">
            <div className="flex items-center gap-1.5">
              <History className="w-4 h-4 text-sky-600" />
              <span>2.2. Lịch Sử Sửa Chữa & Biến Dạng Quá Khứ (Điểm E5 Resonance)</span>
            </div>
            <span className="text-[11px] font-bold text-slate-600">
              Tình trạng sử dụng: <strong className="text-slate-900">{hi.usageStatus || 'Đầy đủ'}</strong>
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
            {/* 1. Cơi nới tải trọng */}
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 space-y-2">
              <label className="text-[11px] font-bold text-slate-700 block">
                1. Cơi nới / Thay đổi tải trọng
              </label>
              {isEditMode ? (
                <select
                  value={hi.renovationLoad ?? 0}
                  onChange={(e) => handleNestedFieldChange('historyInterview', 'renovationLoad', 'Cơi nới tải trọng', Number(e.target.value))}
                  className="w-full p-1.5 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-800"
                >
                  {RENOVATION_OPTIONS.map((opt: any) => (
                    <option key={opt.score} value={opt.score}>
                      {opt.score}đ - {opt.label}
                    </option>
                  ))}
                </select>
              ) : (
                <div className="text-xs font-bold text-slate-800">
                  {RENOVATION_OPTIONS.find((o: any) => o.score === hi.renovationLoad)?.label || 'Không cơi nới'}
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
              <label className="text-[11px] font-bold text-slate-700 block">
                2. Sửa chữa lớn / Cải tạo kết cấu
              </label>
              {isEditMode ? (
                <select
                  value={hi.majorRepair ?? 0}
                  onChange={(e) => handleNestedFieldChange('historyInterview', 'majorRepair', 'Sửa chữa lớn', Number(e.target.value))}
                  className="w-full p-1.5 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-800"
                >
                  {MAJOR_REPAIR_OPTIONS.map((opt: any) => (
                    <option key={opt.score} value={opt.score}>
                      {opt.score}đ - {opt.label}
                    </option>
                  ))}
                </select>
              ) : (
                <div className="text-xs font-bold text-slate-800">
                  {MAJOR_REPAIR_OPTIONS.find((o: any) => o.score === hi.majorRepair)?.label || 'Không sửa chữa lớn'}
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
                  {PAST_SETTLEMENT_OPTIONS.map((opt: any) => (
                    <option key={opt.score} value={opt.score}>
                      {opt.score}đ - {opt.label}
                    </option>
                  ))}
                </select>
              ) : (
                <div className="text-xs font-bold text-slate-800">
                  {PAST_SETTLEMENT_OPTIONS.find((o: any) => o.score === hi.pastSettlement)?.label || 'Không có tiền sử lún nứt'}
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
                  {NEIGHBOR_DAMAGE_OPTIONS.map((opt: any) => (
                    <option key={opt.score} value={opt.score}>
                      {opt.score}đ - {opt.label}
                    </option>
                  ))}
                </select>
              ) : (
                <div className="text-xs font-bold text-slate-800">
                  {NEIGHBOR_DAMAGE_OPTIONS.find((o: any) => o.score === hi.neighborDamage)?.label || 'Không bị ảnh hưởng lân cận'}
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
                  {FIRE_FLOOD_OPTIONS.map((opt: any) => (
                    <option key={opt.score} value={opt.score}>
                      {opt.score}đ - {opt.label}
                    </option>
                  ))}
                </select>
              ) : (
                <div className="text-xs font-bold text-slate-800">
                  {FIRE_FLOOD_OPTIONS.find((o: any) => o.score === hi.fireFloodIncident)?.label || 'Không có sự cố'}
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
              <div className="text-[11px] text-slate-600">
                {hi.sensitiveEquipment?.has ? (
                  <span className="text-purple-900 font-semibold">
                    {hi.sensitiveEquipment?.description || 'Có thiết bị nhạy cảm (Lab, Y tế, Server...)'}
                  </span>
                ) : (
                  'Không có thiết bị chính xác hoặc máy móc nhạy cảm rung chấn.'
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

