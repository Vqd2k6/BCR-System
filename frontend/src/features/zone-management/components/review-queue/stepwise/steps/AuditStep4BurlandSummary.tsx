import React from 'react';
import { Award, AlertTriangle, ShieldAlert, Sparkles, FileText, CheckCircle2, Maximize2, BarChart2, Eye, Compass } from 'lucide-react';

interface Props {
  isEditMode: boolean;
  formState: Record<string, any>;
  data: any;
  handleFieldChange: (key: string, label: string, val: any) => void;
  handleNestedFieldChange: (parentKey: string, childKey: string, label: string, val: any) => void;
  onOpenPhotoZoom?: (url: string, title?: string, photoCode?: string) => void;
}

const BURLAND_GRADES = [
  { grade: 0, label: 'Cấp 0 - Không đáng kể (<0.1mm)', desc: 'Vết nứt tóc bề mặt, không ảnh hưởng kết cấu', color: 'bg-emerald-500' },
  { grade: 1, label: 'Cấp 1 - Rất nhẹ (0.1 - 1.0mm)', desc: 'Nứt chân chim vữa trát, có thể sơn vá thẩm mỹ', color: 'bg-teal-500' },
  { grade: 2, label: 'Cấp 2 - Nhẹ (1.0 - 5.0mm)', desc: 'Cần trám trét lại, kẹt nhẹ khuôn cửa', color: 'bg-amber-500' },
  { grade: 3, label: 'Cấp 3 - Trung bình (5.0 - 15.0mm)', desc: 'Vết nứt xuyên tường gạch, gioăng ống nước có thể hở', color: 'bg-orange-500' },
  { grade: 4, label: 'Cấp 4 - Nặng (15.0 - 25.0mm)', desc: 'Hư hại kết cấu, tường phình vênh, nguy cơ mất an toàn', color: 'bg-red-500' },
  { grade: 5, label: 'Cấp 5 - Rất nặng (>25.0mm)', desc: 'Nguy cơ sập cục bộ hoặc toàn phần, cần chống đỡ khẩn cấp', color: 'bg-rose-900' },
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
  onOpenPhotoZoom,
}) => {
  const burland = formState.burlandSummary || {};
  const riskCard = data?.leftPane?.riskScoreCard || {};

  const maxGrade = burland.localMaxGrade ?? riskCard.e1_burland_score ?? 0;
  const predGrade = burland.predominantGrade ?? (maxGrade > 1 ? maxGrade - 1 : maxGrade);
  const flagLevel = burland.structuralFlagLevel || 'NONE';
  const flagItem = STRUCTURAL_FLAG_LEVELS.find((f) => f.value === flagLevel) || STRUCTURAL_FLAG_LEVELS[0];

  // Thu thập toàn bộ vết nứt để tính Histogram và tìm Vết nứt khống chế (Spotlight)
  const allDefects: any[] = [];
  if (Array.isArray(formState.floors)) {
    formState.floors.forEach((fl: any) => {
      (fl.zones || []).forEach((z: any) => {
        (z.defects || []).forEach((d: any) => {
          allDefects.push({
            ...d,
            floorName: fl.floorName,
            zoneCode: z.zoneCode,
          });
        });
      });
    });
  } else if (Array.isArray(formState.damageZones)) {
    formState.damageZones.forEach((z: any) => {
      (z.defects || []).forEach((d: any) => {
        allDefects.push({
          ...d,
          floorName: 'Tầng khảo sát',
          zoneCode: z.zoneCode,
        });
      });
    });
  }

  // Đếm tần suất theo cấp Burland 0-5
  const gradeCounts = [0, 0, 0, 0, 0, 0];
  allDefects.forEach((d) => {
    const g = Number(d.burlandGrade ?? d.burland_grade ?? 0);
    if (g >= 0 && g <= 5) gradeCounts[g]++;
  });

  // Tìm vết nứt đại diện nặng nhất (Governing Defect)
  const governingDefect = allDefects.reduce((maxD, curr) => {
    const currGrade = Number(curr.burlandGrade ?? curr.burland_grade ?? 0);
    const maxGradeVal = maxD ? Number(maxD.burlandGrade ?? maxD.burland_grade ?? 0) : -1;
    return currGrade > maxGradeVal ? curr : maxD;
  }, null as any);

  const govPhotoUrl =
    governingDefect?.cuPhotoUrl ||
    governingDefect?.cu_photo_url ||
    governingDefect?.cuPhotos?.[0] ||
    governingDefect?.macroPhotoUrl ||
    governingDefect?.macro_photo_url ||
    governingDefect?.photoUrl ||
    '';
  const govCode = governingDefect?.defectCode || governingDefect?.defect_code || 'D-??';
  const govWidth = governingDefect?.widthMaxMm ?? governingDefect?.width_max_mm ?? 0;

  return (
    <section id="step-4" className="scroll-mt-6 bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
      {/* Header */}
      <div className="p-4 sm:p-5 bg-slate-50/80 border-b border-slate-100 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <span className="px-2 py-0.5 rounded-lg bg-sky-600 text-white font-mono font-black text-xs">
            Bước 04
          </span>
          <div>
            <h3 className="text-sm sm:text-base font-black text-slate-800">
              Tổng Hợp & Đánh Giá Nứt Theo Chuẩn Burland 1977
            </h3>
            <p className="text-[11px] text-slate-500">
              Phân loại hư hại nứt theo tiêu chuẩn quốc tế Burland (1977) & quy định cấp độ khống chế E1
            </p>
          </div>
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
        {/* ĐIỂM MỚI 2: SPOTLIGHT VẾT NỨT NẶNG NHẤT & HISTOGRAM PHÂN BỔ */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {/* 1. Thẻ Spotlight Vết Nứt Khống Chế Nguy Cơ Nhất */}
          <div className="p-4 rounded-xl bg-red-50/60 border border-red-200 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-black uppercase text-red-950 flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-red-600" />
                <span>Vết Nứt Đại Diện Khống Chế Nguy Cơ (Governing Crack)</span>
              </span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-red-200 text-red-900 font-mono">
                Cấp {maxGrade}
              </span>
            </div>

            {governingDefect ? (
              <div className="flex items-center gap-3 bg-white p-3 rounded-xl border border-red-200">
                <div
                  className="w-24 h-20 rounded-lg overflow-hidden bg-slate-100 border border-slate-200 relative group cursor-pointer shrink-0"
                  onClick={() => {
                    if (onOpenPhotoZoom && govPhotoUrl) {
                      onOpenPhotoZoom(govPhotoUrl, `Vết nứt khống chế ${govCode} (Rộng ${govWidth}mm)`, govCode);
                    }
                  }}
                >
                  {govPhotoUrl ? (
                    <>
                      <img src={govPhotoUrl} alt={govCode} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                      <div className="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white">
                        <Maximize2 className="w-4 h-4 drop-shadow-md" />
                      </div>
                    </>
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-[10px] text-slate-400 italic">
                      Chưa có ảnh
                    </div>
                  )}
                </div>

                <div className="min-w-0 flex-1 text-xs space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-mono font-black text-sm text-red-700">{govCode}</span>
                    <span className="text-[11px] font-bold text-slate-700 font-mono">
                      Bề rộng: <strong className="text-red-600 text-xs">{govWidth} mm</strong>
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-600 truncate">
                    Vị trí: <strong>{governingDefect.floorName} &bull; {governingDefect.zoneCode}</strong>
                  </div>
                  <div className="text-[10px] text-slate-500 italic truncate">
                    {governingDefect.notes || 'Vết nứt có bề rộng lớn nhất khống chế chỉ số E1 của toàn bộ công trình.'}
                  </div>
                  {onOpenPhotoZoom && govPhotoUrl && (
                    <button
                      type="button"
                      onClick={() => onOpenPhotoZoom(govPhotoUrl, `Vết nứt khống chế ${govCode}`, govCode)}
                      className="text-[11px] font-bold text-sky-600 hover:text-sky-800 flex items-center gap-1 cursor-pointer pt-0.5"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>Click soi ảnh Macro có thước đo mm</span>
                    </button>
                  )}
                </div>
              </div>
            ) : (
              <div className="p-3 bg-white rounded-xl border border-red-100 text-xs text-slate-500 italic text-center">
                Không ghi nhận khuyết tật nứt nào trong hồ sơ.
              </div>
            )}
          </div>

          {/* 2. Biểu Đồ Phân Bổ Vết Nứt Theo Cấp Burland (Histogram) */}
          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-black uppercase text-slate-800 flex items-center gap-1.5">
                <BarChart2 className="w-4 h-4 text-sky-600" />
                <span>Phân Bổ Cấp Nứt Burland ({allDefects.length} vết nứt ghi nhận)</span>
              </span>
              <span className="text-[10px] text-slate-500">Tỷ lệ theo cấp 0 &rarr; 5</span>
            </div>

            <div className="space-y-1.5 pt-1">
              {BURLAND_GRADES.map((bg) => {
                const count = gradeCounts[bg.grade];
                const pct = allDefects.length > 0 ? Math.round((count / allDefects.length) * 100) : 0;
                const isMax = bg.grade === maxGrade;

                return (
                  <div key={bg.grade} className="flex items-center gap-2 text-xs">
                    <span className={`w-14 font-mono font-bold text-[11px] ${isMax ? 'text-red-700 font-black' : 'text-slate-600'}`}>
                      Cấp {bg.grade} {isMax ? '🎯' : ''}
                    </span>
                    <div className="flex-1 h-3 rounded-full bg-slate-200 overflow-hidden relative">
                      <div
                        className={`h-full rounded-full transition-all ${bg.color}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="w-16 text-right font-mono text-[11px] font-bold text-slate-700">
                      {count} ({pct}%)
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

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
