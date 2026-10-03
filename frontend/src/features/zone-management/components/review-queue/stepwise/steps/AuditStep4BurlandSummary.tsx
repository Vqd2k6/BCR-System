import React from 'react';
import { Award, AlertTriangle, ShieldAlert, Sparkles, FileText, CheckCircle2 } from 'lucide-react';

interface Props {
  isEditMode: boolean;
  formState: Record<string, any>;
  data: any;
  handleFieldChange: (key: string, label: string, val: any) => void;
  handleNestedFieldChange: (parentKey: string, childKey: string, label: string, val: any) => void;
}

const BURLAND_GRADES = [
  { grade: 0, label: 'Cấp 0 - Không đáng kể (<0.1mm)', desc: 'Vết nứt tóc bề mặt, không ảnh hưởng kết cấu' },
  { grade: 1, label: 'Cấp 1 - Rất nhẹ (0.1 - 1.0mm)', desc: 'Nứt chân chim vữa trát, có thể sơn vá thẩm mỹ' },
  { grade: 2, label: 'Cấp 2 - Nhẹ (1.0 - 5.0mm)', desc: 'Cần trám trét lại, kẹt nhẹ khuôn cửa' },
  { grade: 3, label: 'Cấp 3 - Trung bình (5.0 - 15.0mm)', desc: 'Vết nứt xuyên tường gạch, gioăng ống nước có thể hở' },
  { grade: 4, label: 'Cấp 4 - Nặng (15.0 - 25.0mm)', desc: 'Hư hại kết cấu, tường phình vênh, nguy cơ mất an toàn' },
  { grade: 5, label: 'Cấp 5 - Rất nặng (>25.0mm)', desc: 'Nguy cơ sập cục bộ hoặc toàn phần, cần chống đỡ khẩn cấp' },
];

const STRUCTURAL_FLAG_LEVELS = [
  { value: 'NONE', label: 'None - Không có cờ kết cấu', color: 'bg-emerald-50 text-emerald-800 border-emerald-200' },
  { value: 'LOW', label: 'Low - Cờ kết cấu thấp', color: 'bg-blue-50 text-blue-800 border-blue-200' },
  { value: 'MODERATE', label: 'Moderate - Cờ kết cấu trung bình', color: 'bg-amber-50 text-amber-800 border-amber-200' },
  { value: 'HIGH', label: 'High - Cờ kết cấu cao / Nguy cơ chịu lực', color: 'bg-orange-50 text-orange-800 border-orange-200' },
  { value: 'CRITICAL', label: 'Critical - Cờ kết cấu nguy cấp / Cảnh báo sập', color: 'bg-red-50 text-red-800 border-red-200' },
];

export const AuditStep4BurlandSummary: React.FC<Props> = ({
  isEditMode,
  formState,
  data,
  handleNestedFieldChange,
}) => {
  const burland = formState.burlandSummary || {};
  const riskCard = data?.leftPane?.riskScoreCard || {};

  const maxGrade = burland.localMaxGrade ?? riskCard.e1_burland_score ?? 0;
  const predGrade = burland.predominantGrade ?? (maxGrade > 1 ? maxGrade - 1 : maxGrade);
  const flagLevel = burland.structuralFlagLevel || 'NONE';
  const flagItem = STRUCTURAL_FLAG_LEVELS.find((f) => f.value === flagLevel) || STRUCTURAL_FLAG_LEVELS[0];

  return (
    <section id="step-4" className="scroll-mt-6 bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
      {/* Header */}
      <div className="p-4 sm:p-5 bg-slate-50/80 border-b border-slate-100 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <span className="px-2 py-0.5 rounded-lg bg-sky-600 text-white font-mono font-black text-xs">
            Bước 04
          </span>
          <h3 className="text-sm sm:text-base font-black text-slate-800">
            Tổng Hợp & Đánh Giá Nứt Theo Chuẩn Burland 1977
          </h3>
        </div>
        <div className="flex items-center gap-2">
          <span className={`px-2.5 py-1 rounded-xl text-xs font-black border ${flagItem.color}`}>
            Cờ kết cấu: {flagLevel}
          </span>
          <span className="px-2.5 py-1 rounded-xl text-xs font-black bg-red-100 text-red-800 border border-red-200">
            Burland Max: Cấp {maxGrade}
          </span>
        </div>
      </div>

      <div className="p-5 space-y-5">
        {/* 4 Chỉ số cốt lõi */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {/* Cấp cực đại */}
          <div className="p-3.5 bg-red-50/60 rounded-xl border border-red-200 space-y-1">
            <span className="text-[11px] font-bold text-red-900 block">Cấp Độ Khống Chế Lớn Nhất (E1):</span>
            {isEditMode ? (
              <select
                value={maxGrade}
                onChange={(e) =>
                  handleNestedFieldChange('burlandSummary', 'localMaxGrade', 'Cấp Burland cực đại', Number(e.target.value))
                }
                className="w-full p-1.5 bg-white border border-red-300 rounded-lg text-xs font-black text-red-700"
              >
                {BURLAND_GRADES.map((bg) => (
                  <option key={bg.grade} value={bg.grade}>
                    {bg.label}
                  </option>
                ))}
              </select>
            ) : (
              <div>
                <span className="text-xl font-black text-red-600">Cấp {maxGrade}</span>
                <span className="text-[10px] text-red-700 block">{BURLAND_GRADES[maxGrade]?.desc}</span>
              </div>
            )}
          </div>

          {/* Cấp chủ đạo */}
          <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
            <span className="text-[11px] font-bold text-slate-600 block">Cấp Độ Nứt Chủ Đạo:</span>
            {isEditMode ? (
              <select
                value={predGrade}
                onChange={(e) =>
                  handleNestedFieldChange('burlandSummary', 'predominantGrade', 'Cấp nứt chủ đạo', Number(e.target.value))
                }
                className="w-full p-1.5 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-800"
              >
                {BURLAND_GRADES.map((bg) => (
                  <option key={bg.grade} value={bg.grade}>
                    {bg.label}
                  </option>
                ))}
              </select>
            ) : (
              <div>
                <span className="text-xl font-black text-slate-800">Cấp {predGrade}</span>
                <span className="text-[10px] text-slate-500 block">{BURLAND_GRADES[predGrade]?.desc}</span>
              </div>
            )}
          </div>

          {/* Vùng khống chế */}
          <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
            <span className="text-[11px] font-bold text-slate-600 block">Vùng Khống Chế Nguy Cơ:</span>
            {isEditMode ? (
              <input
                type="text"
                value={burland.governingZoneCode || 'Z-01'}
                onChange={(e) =>
                  handleNestedFieldChange('burlandSummary', 'governingZoneCode', 'Vùng khống chế', e.target.value)
                }
                className="w-full p-1.5 bg-white border border-slate-300 rounded-lg text-xs font-mono font-bold text-slate-800"
                placeholder="VD: Z-01"
              />
            ) : (
              <div>
                <span className="text-base font-black font-mono text-sky-700">
                  {burland.governingZoneCode || 'Z-01'}
                </span>
                <span className="text-[10px] text-slate-500 block">Vùng chịu hư hại nặng nhất</span>
              </div>
            )}
          </div>

          {/* Tính đại diện */}
          <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-1">
            <span className="text-[11px] font-bold text-slate-600 block">Tính Đại Diện Khảo Sát:</span>
            {isEditMode ? (
              <select
                value={burland.representativeness || 'GLOBAL'}
                onChange={(e) =>
                  handleNestedFieldChange('burlandSummary', 'representativeness', 'Tính đại diện Burland', e.target.value)
                }
                className="w-full p-1.5 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-800"
              >
                <option value="GLOBAL">GLOBAL - Đại diện toàn bộ</option>
                <option value="LOCAL">LOCAL - Cục bộ không gian</option>
              </select>
            ) : (
              <div>
                <span className="text-sm font-bold text-slate-800">
                  {burland.representativeness === 'LOCAL' ? 'LOCAL (Cục bộ)' : 'GLOBAL (Toàn thể)'}
                </span>
                <span className="text-[10px] text-slate-500 block">Phạm vi ứng xử biến dạng</span>
              </div>
            )}
          </div>
        </div>

        {/* Cờ cảnh báo kết cấu & Thẩm tra kỹ sư */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
          {/* Cờ kết cấu */}
          <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
            <label className="text-[11px] font-bold text-slate-700 block">
              Mức Độ Cờ Cảnh Báo Kết Cấu (Structural Flag):
            </label>
            {isEditMode ? (
              <select
                value={flagLevel}
                onChange={(e) =>
                  handleNestedFieldChange('burlandSummary', 'structuralFlagLevel', 'Cờ kết cấu', e.target.value)
                }
                className="w-full p-2 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-800"
              >
                {STRUCTURAL_FLAG_LEVELS.map((fl) => (
                  <option key={fl.value} value={fl.value}>
                    {fl.label}
                  </option>
                ))}
              </select>
            ) : (
              <div className={`p-2.5 rounded-xl border text-xs font-bold flex items-center gap-2 ${flagItem.color}`}>
                <ShieldAlert className="w-4 h-4 shrink-0" />
                <span>{flagItem.label}</span>
              </div>
            )}
          </div>

          {/* Yêu cầu kỹ sư kết cấu thẩm tra */}
          <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
            <label className="text-[11px] font-bold text-slate-700 block">
              Yêu Cầu Kỹ Sư Kết Cấu Thẩm Tra Chuyên Môn:
            </label>
            {isEditMode ? (
              <label className="flex items-center gap-2 text-xs font-bold text-slate-800 cursor-pointer pt-2">
                <input
                  type="checkbox"
                  checked={Boolean(burland.needStructuralEngineerReview)}
                  onChange={(e) =>
                    handleNestedFieldChange(
                      'burlandSummary',
                      'needStructuralEngineerReview',
                      'Yêu cầu kỹ sư kết cấu',
                      e.target.checked
                    )
                  }
                  className="rounded text-sky-600 focus:ring-sky-500"
                />
                <span>Cần kỹ sư kết cấu thẩm tra độc lập tại hiện trường</span>
              </label>
            ) : (
              <div className={`p-2.5 rounded-xl border text-xs font-bold flex items-center gap-2 ${
                burland.needStructuralEngineerReview
                  ? 'bg-amber-50 text-amber-900 border-amber-300'
                  : 'bg-slate-100 text-slate-600 border-slate-200'
              }`}>
                {burland.needStructuralEngineerReview ? (
                  <>
                    <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                    <span>⚠️ BẮT BUỘC: Yêu cầu Kỹ sư Kết cấu thẩm tra chuyên sâu</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>Không yêu cầu thẩm tra bổ sung từ kỹ sư kết cấu</span>
                  </>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Ghi chú đánh giá Burland & Ý kiến kỹ sư */}
        <div className="space-y-3 pt-2">
          <div>
            <label className="text-[11px] font-bold text-slate-500 uppercase block mb-1">
              Ghi Chú Đánh Giá Burland Tổng Thể Hiện Trường
            </label>
            {isEditMode ? (
              <textarea
                rows={2}
                value={burland.evaluationNotes || ''}
                onChange={(e) =>
                  handleNestedFieldChange('burlandSummary', 'evaluationNotes', 'Ghi chú đánh giá Burland', e.target.value)
                }
                className="w-full p-2.5 bg-amber-50/40 border border-amber-300 rounded-xl text-xs text-slate-800"
                placeholder="Ghi chú tổng hợp tình hình nứt theo Burland..."
              />
            ) : (
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 text-xs text-slate-700 italic">
                {burland.evaluationNotes || 'Không có ghi chú đánh giá Burland bổ sung.'}
              </div>
            )}
          </div>

          {burland.needStructuralEngineerReview && (
            <div>
              <label className="text-[11px] font-bold text-amber-800 uppercase block mb-1">
                Ý Kiến Đề Xuất Của Kỹ Sư Kết Cấu Thẩm Tra
              </label>
              {isEditMode ? (
                <textarea
                  rows={2}
                  value={burland.engineerReviewNotes || ''}
                  onChange={(e) =>
                    handleNestedFieldChange('burlandSummary', 'engineerReviewNotes', 'Ý kiến kỹ sư kết cấu', e.target.value)
                  }
                  className="w-full p-2.5 bg-amber-50/40 border border-amber-300 rounded-xl text-xs text-slate-800"
                  placeholder="Ghi nhận đánh giá chuyên sâu của kỹ sư..."
                />
              ) : (
                <div className="p-3 bg-amber-50/50 rounded-xl border border-amber-200 text-xs text-amber-950">
                  {burland.engineerReviewNotes || 'Chờ kỹ sư kết cấu ghi nhận kết luận thẩm tra.'}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </section>
  );
};

