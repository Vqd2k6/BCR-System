import React from 'react';
import { ShieldCheck, FileSpreadsheet, Search, Plus, Trash2 } from 'lucide-react';
import type { EditFormData, EditFormDefectItem } from '../../../types';

interface BurlandAndDefectsSectionProps {
  editFormData: EditFormData;
  defectFilterQuery: string;
  setDefectFilterQuery: (query: string) => void;
  handleUpdateFormField: <K extends keyof EditFormData>(field: K, value: EditFormData[K]) => void;
  handleUpdateDefectField: <K extends keyof EditFormDefectItem>(defectId: string, field: K, value: EditFormDefectItem[K]) => void;
  handleAddDefect: () => void;
  handleDeleteDefect: (defectId: string) => void;
}

export const BurlandAndDefectsSection: React.FC<BurlandAndDefectsSectionProps> = ({
  editFormData,
  defectFilterQuery,
  setDefectFilterQuery,
  handleUpdateFormField,
  handleUpdateDefectField,
  handleAddDefect,
  handleDeleteDefect,
}) => {
  return (
    <>
      {/* ── Section 8: Đánh giá Burland (1977) & Cờ kết cấu chịu lực ── */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
        <h4 className="text-xs font-black uppercase text-slate-800 flex items-center gap-1.5 pb-2.5 border-b border-slate-100 mb-3">
          <ShieldCheck size={14} className="text-red-600" />
          <span>8. Đánh Giá Hư Hỏng Burland (1977) & Cờ Kết Cấu Chịu Lực</span>
        </h4>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 mb-3">
          <div>
            <label className="text-[11px] font-bold text-slate-600 block mb-1">Cấp Burland đại diện (0–5)</label>
            <select
              value={editFormData.burlandPredominantGrade}
              onChange={(e) => handleUpdateFormField('burlandPredominantGrade', e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-xs text-slate-800 focus:bg-white focus:border-sky-500 outline-none font-bold"
            >
              <option value="0">Grade 0 - Không đáng kể (&lt; 0.1mm)</option>
              <option value="1">Grade 1 - Rất nhẹ (&lt; 1mm)</option>
              <option value="2">Grade 2 - Nhẹ (&lt; 5mm)</option>
              <option value="3">Grade 3 - Trung bình (5–15mm)</option>
              <option value="4">Grade 4 - Nặng (15–25mm)</option>
              <option value="5">Grade 5 - Rất nặng (&gt; 25mm)</option>
            </select>
          </div>

          <div>
            <label className="text-[11px] font-bold text-slate-600 block mb-1">Cấp Burland cực đại (0–5)</label>
            <select
              value={editFormData.burlandLocalMaxGrade}
              onChange={(e) => handleUpdateFormField('burlandLocalMaxGrade', e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-xs text-slate-800 focus:bg-white focus:border-sky-500 outline-none font-bold text-rose-700"
            >
              <option value="0">Grade 0 - Không đáng kể</option>
              <option value="1">Grade 1 - Rất nhẹ</option>
              <option value="2">Grade 2 - Nhẹ</option>
              <option value="3">Grade 3 - Trung bình</option>
              <option value="4">Grade 4 - Nặng</option>
              <option value="5">Grade 5 - Rất nặng</option>
            </select>
          </div>

          <div>
            <label className="text-[11px] font-bold text-slate-600 block mb-1">Cờ cảnh báo kết cấu (Flag Level)</label>
            <select
              value={editFormData.burlandStructuralFlagLevel}
              onChange={(e) => handleUpdateFormField('burlandStructuralFlagLevel', e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-xs font-bold focus:bg-white focus:border-sky-500 outline-none text-rose-700"
            >
              <option value="NONE">NONE - Không có cờ kết cấu (0đ)</option>
              <option value="LOW">LOW - Cờ kết cấu thấp (1đ)</option>
              <option value="MODERATE">MODERATE - Cờ trung bình (2đ)</option>
              <option value="HIGH">HIGH - Cờ cao / Nguy cơ chịu lực (3đ)</option>
              <option value="CRITICAL">CRITICAL - Cờ nguy cấp / Cảnh báo sập (4đ)</option>
            </select>
          </div>

          <div>
            <label className="text-[11px] font-bold text-slate-600 block mb-1">Tính đại diện hư hỏng</label>
            <select
              value={editFormData.burlandRepresentativeness}
              onChange={(e) => handleUpdateFormField('burlandRepresentativeness', e.target.value)}
              className="w-full bg-slate-50 border border-slate-300 rounded-lg p-2 text-xs text-slate-800 focus:bg-white focus:border-sky-500 outline-none"
            >
              <option value="LOCAL">LOCAL - Cục bộ (Một vài vị trí)</option>
              <option value="GLOBAL">GLOBAL - Toàn công trình</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-2">
          <div>
            <label className="text-[11px] font-bold text-slate-600 block mb-1">Vùng hư hỏng khống chế & Mô tả</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={editFormData.governingZoneCode}
                onChange={(e) => handleUpdateFormField('governingZoneCode', e.target.value)}
                className="w-24 bg-slate-50 border border-slate-300 rounded-lg p-2 text-xs font-mono font-bold text-slate-800 focus:bg-white focus:border-sky-500 outline-none"
                placeholder="Z-01"
              />
              <input
                type="text"
                value={editFormData.governingZoneDescription}
                onChange={(e) => handleUpdateFormField('governingZoneDescription', e.target.value)}
                className="flex-1 bg-slate-50 border border-slate-300 rounded-lg p-2 text-xs text-slate-800 focus:bg-white focus:border-sky-500 outline-none"
                placeholder="Mô tả khuyết tật khống chế..."
              />
            </div>
          </div>

          <div className="flex flex-col justify-center">
            <label className="text-[11px] font-bold text-slate-600 block mb-1">Yêu cầu Thẩm tra Kỹ sư Kết cấu</label>
            <label className="flex items-center gap-2 p-2 bg-slate-50 border border-slate-200 rounded-lg cursor-pointer">
              <input
                type="checkbox"
                checked={editFormData.requiresStructuralReview}
                onChange={(e) => handleUpdateFormField('requiresStructuralReview', e.target.checked)}
                className="rounded text-red-600 h-4 w-4"
              />
              <span className="text-xs font-bold text-red-700">
                Cần Kỹ sư kết cấu thẩm tra riêng (Structural Engineer Review Required)
              </span>
            </label>
          </div>
        </div>
      </div>

      {/* ── Section 9: Sổ khuyết tật hiện trạng ── */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-slate-100 mb-3">
          <div>
            <h4 className="text-xs font-black uppercase text-slate-800 flex items-center gap-1.5">
              <FileSpreadsheet size={14} className="text-rose-600" />
              <span>9. Sổ Khuyết Tật Hiện Trạng (Defects Register) & Ghi Chú Vết Nứt</span>
              <span className="text-[10px] bg-rose-100 text-rose-700 font-bold px-2 py-0.5 rounded-full">
                {editFormData.defects.length} vết nứt
              </span>
            </h4>
            <p className="text-[11px] text-slate-500">
              Sửa trực tiếp các ghi chú hiện trường chưa chuẩn xác, kích thước vết nứt, bề rộng max và phân cấp nguy hại.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <div className="relative">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={defectFilterQuery}
                onChange={(e) => setDefectFilterQuery(e.target.value)}
                placeholder="Lọc mã vết nứt / tầng..."
                className="pl-8 pr-2.5 py-1 text-xs bg-slate-50 border border-slate-300 rounded-lg outline-none focus:bg-white focus:border-sky-500 w-36 sm:w-48"
              />
            </div>

            <button
              type="button"
              onClick={handleAddDefect}
              className="px-2.5 py-1 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-lg text-xs font-bold transition-colors flex items-center gap-1"
            >
              <Plus size={13} />
              <span>Thêm Vết Nứt Mới</span>
            </button>
          </div>
        </div>

        {/* Defect Cards List */}
        <div className="space-y-3 max-h-[420px] overflow-y-auto pr-1">
          {editFormData.defects
            .filter(
              (d) =>
                !defectFilterQuery ||
                d.defectCode.toLowerCase().includes(defectFilterQuery.toLowerCase()) ||
                d.floorName.toLowerCase().includes(defectFilterQuery.toLowerCase()) ||
                d.notes.toLowerCase().includes(defectFilterQuery.toLowerCase())
            )
            .map((defect) => (
              <div
                key={defect.id}
                className="bg-slate-50/80 hover:bg-white border border-slate-200 hover:border-sky-300 rounded-xl p-3 transition-all shadow-sm"
              >
                <div className="flex items-center justify-between gap-2 mb-2 pb-1.5 border-b border-slate-200/80">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-bold bg-rose-600 text-white px-2 py-0.5 rounded-md">
                      {defect.defectCode}
                    </span>
                    <span className="text-xs font-bold text-slate-700">
                      {defect.floorName} — Vùng {defect.zoneCode}
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleDeleteDefect(defect.id)}
                    className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-md transition-colors"
                    title="Xoá vết nứt này"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>

                <div className="mb-2">
                  <label className="text-[11px] font-bold text-sky-800 block mb-1">
                    Ghi chú mô tả vết nứt (Notes) - Nội dung thể hiện trên Báo cáo
                  </label>
                  <textarea
                    rows={2}
                    value={defect.notes}
                    onChange={(e) => handleUpdateDefectField(defect.id, 'notes', e.target.value)}
                    className="w-full bg-white border border-sky-300 focus:border-sky-500 focus:ring-1 focus:ring-sky-500 rounded-lg p-2 text-xs text-slate-800 outline-none"
                    placeholder="Nhập mô tả cụ thể về vết nứt..."
                  />
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-2">
                  <div>
                    <label className="text-[10px] font-bold text-slate-600 block mb-0.5">Bề rộng w (mm)</label>
                    <input
                      type="number"
                      step="0.05"
                      value={defect.widthMaxMm}
                      onChange={(e) => handleUpdateDefectField(defect.id, 'widthMaxMm', e.target.value)}
                      className="w-full bg-white border border-slate-300 rounded-md p-1.5 text-xs text-slate-800 focus:border-sky-500 outline-none font-mono"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-bold text-slate-600 block mb-0.5">Chiều dài (mm)</label>
                    <input
                      type="number"
                      value={defect.lengthMm}
                      onChange={(e) => handleUpdateDefectField(defect.id, 'lengthMm', e.target.value)}
                      className="w-full bg-white border border-slate-300 rounded-md p-1.5 text-xs text-slate-800 focus:border-sky-500 outline-none font-mono"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-bold text-slate-600 block mb-0.5">Phương nứt</label>
                    <input
                      type="text"
                      value={defect.crackDirection}
                      onChange={(e) => handleUpdateDefectField(defect.id, 'crackDirection', e.target.value)}
                      className="w-full bg-white border border-slate-300 rounded-md p-1.5 text-xs text-slate-800 focus:border-sky-500 outline-none"
                    />
                  </div>

                  <div className="col-span-2">
                    <label className="text-[10px] font-bold text-slate-600 block mb-0.5">Phân loại nứt</label>
                    <input
                      type="text"
                      value={defect.defectType}
                      onChange={(e) => handleUpdateDefectField(defect.id, 'defectType', e.target.value)}
                      className="w-full bg-white border border-slate-300 rounded-md p-1.5 text-xs text-slate-800 focus:border-sky-500 outline-none"
                    />
                  </div>

                  <div>
                    <label className="text-[10px] font-bold text-slate-600 block mb-0.5">Trạng thái nứt</label>
                    <select
                      value={defect.activityState}
                      onChange={(e) => handleUpdateDefectField(defect.id, 'activityState', e.target.value)}
                      className="w-full bg-white border border-slate-300 rounded-md p-1.5 text-xs text-slate-800 focus:border-sky-500 outline-none"
                    >
                      <option value="U">U (Chưa rõ)</option>
                      <option value="S">S (Ổn định/cũ)</option>
                      <option value="A">A (Đang phát triển)</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-[10px] font-bold text-slate-600 block mb-0.5">Cấp Burland Z</label>
                    <select
                      value={defect.burlandGrade}
                      onChange={(e) => handleUpdateDefectField(defect.id, 'burlandGrade', Number(e.target.value))}
                      className="w-full bg-white border border-slate-300 rounded-md p-1.5 text-xs text-slate-800 focus:border-sky-500 outline-none"
                    >
                      <option value="0">Grade 0</option>
                      <option value="1">Grade 1</option>
                      <option value="2">Grade 2</option>
                      <option value="3">Grade 3</option>
                      <option value="4">Grade 4</option>
                      <option value="5">Grade 5</option>
                    </select>
                  </div>
                </div>
              </div>
            ))}
        </div>
      </div>
    </>
  );
};
