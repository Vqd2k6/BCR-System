import type { FloorSurveyData, DamageZoneData, DefectItem } from '../../../../../survey-phase1/types/phase1.types';
import type { AuditStepwiseFormState, AuditStepwiseData, StepwiseBurlandSummary, PhotoReplaceParams, AuditPhotoHistoryParams } from '../types';
import React from 'react';
import { Award, AlertTriangle, ShieldAlert, Sparkles, FileText, CheckCircle2, Maximize2, BarChart2, Eye, Compass, RefreshCw, History, Navigation } from 'lucide-react';

interface Props {
  isEditMode: boolean;
  formState: AuditStepwiseFormState;
  data?: AuditStepwiseData;
  handleFieldChange?: (key: string, label: string, val: unknown) => void;
  handleNestedFieldChange: (parentKey: string, childKey: string, label: string, val: unknown) => void;
  onOpenPhotoZoom?: (url: string, title?: string, photoCode?: string) => void;
  onOpenPhotoReplace?: (params: PhotoReplaceParams) => void;
  onOpenPhotoHistory?: (params: AuditPhotoHistoryParams) => void;
  isFieldDirty?: (fieldKey: string, subKey?: string) => boolean;
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
  onOpenPhotoReplace,
  onOpenPhotoHistory,
  isFieldDirty,
}) => {
  const burland: StepwiseBurlandSummary = formState.burlandSummary || {};
  const riskCard = data?.leftPane?.riskScoreCard || {};

  const maxGrade = Number(burland.localMaxGrade ?? riskCard.e1_burland_score ?? 0);
  const predGrade = Number(burland.predominantGrade ?? (maxGrade > 1 ? maxGrade - 1 : maxGrade));
  const flagLevel = burland.structuralFlagLevel || 'NONE';
  const flagItem = STRUCTURAL_FLAG_LEVELS.find((f) => f.value === flagLevel) || STRUCTURAL_FLAG_LEVELS[0];

  // Thu thập toàn bộ vết nứt mảng tường Z để tính Histogram Burland và tìm Vết nứt khống chế (Spotlight)
  const allDefects: DefectItem[] = [];
  const availableZones: string[] = [];
  const allStructuralElements: any[] = [];
  const allStructuralDefects: any[] = [];

  if (Array.isArray(formState.floors)) {
    (formState.floors as FloorSurveyData[]).forEach((fl: FloorSurveyData) => {
      (fl.zones || []).forEach((z: DamageZoneData) => {
        const zCode = z.zoneCode || z.id;
        if (zCode && !availableZones.includes(zCode)) availableZones.push(zCode);
        (z.defects || []).forEach((d: DefectItem) => {
          allDefects.push({
            ...d,
            floorName: fl.floorName,
            zoneCode: z.zoneCode,
          });
        });
      });
      (fl.structuralElements || []).forEach((elem: any) => {
        allStructuralElements.push({
          ...elem,
          floorName: fl.floorName,
        });
        (elem.defects || []).forEach((d: DefectItem) => {
          allStructuralDefects.push({
            ...d,
            elementCode: elem.elementCode || elem.id,
            elementType: elem.elementType || 'Cột/Dầm BTCT',
            materialType: elem.materialType || 'BTCT',
            dimensions: elem.dimensions || elem.sectionDimensions,
            structuralIntegrity: elem.structuralIntegrity,
            floorName: fl.floorName,
          });
        });
      });
    });
  } else if (Array.isArray(formState.damageZones)) {
    (formState.damageZones as DamageZoneData[]).forEach((z: DamageZoneData) => {
      const zCode = z.zoneCode || z.id;
      if (zCode && !availableZones.includes(zCode)) availableZones.push(zCode);
      (z.defects || []).forEach((d: DefectItem) => {
        allDefects.push({
          ...d,
          floorName: 'Tầng khảo sát',
          zoneCode: z.zoneCode,
        });
      });
    });
  }

  if (availableZones.length === 0) availableZones.push('Z-01');

  // Đếm tần suất theo cấp Burland 0-5 (chỉ dành cho vết nứt tường gạch Z)
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
  }, null as DefectItem | null);

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
    <section id="step-5" className="scroll-mt-6 bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
      {/* Header */}
      <div className="p-4 sm:p-5 bg-slate-50/80 border-b border-slate-100 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <span className="px-2 py-0.5 rounded-lg bg-sky-600 text-white font-mono font-black text-xs">
            Bước 05
          </span>
          <div>
            <h3 className="text-sm sm:text-base font-black text-slate-800">
              Khuyết Tật Bề Mặt & Tổng Hợp Nứt Theo Chuẩn Burland 1977
            </h3>
            <p className="text-[11px] text-slate-500">
              Phân bố phổ nứt, phân loại hư hại nứt theo tiêu chuẩn quốc tế Burland (1977) & quy định cấp độ khống chế E1
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

      <div className="p-5 space-y-6">
        {/* PHẦN 4.1: VẾT NỨT TƯỜNG XÂY GẠCH THEO CHUẨN BURLAND 1977 (VÙNG Z) */}
        <div className="space-y-4">
          <div className="flex items-center justify-between border-b border-slate-200 pb-2">
            <span className="text-xs sm:text-sm font-black text-slate-800 uppercase tracking-wide flex items-center gap-2">
              <span className="px-2 py-0.5 rounded bg-sky-100 text-sky-800 font-mono text-xs">Mục 4.1</span>
              Phân Bố Vết Nứt Tường Xây Gạch Theo Chuẩn Burland 1977 (Chỉ Áp Dụng Cho Mảng Tường Z)
            </span>
            <span className="text-[11px] text-slate-500 font-mono font-bold">
              {allDefects.length} vết nứt tường gạch
            </span>
          </div>

          {/* SPOTLIGHT VẾT NỨT NẶNG NHẤT & HISTOGRAM PHÂN BỔ */}
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
                    <div className="flex items-center gap-2 pt-0.5 flex-wrap">
                      {onOpenPhotoZoom && govPhotoUrl && (
                        <button
                          type="button"
                          onClick={() => onOpenPhotoZoom(govPhotoUrl, `Vết nứt khống chế ${govCode}`, govCode)}
                          className="text-[11px] font-bold text-sky-600 hover:text-sky-800 flex items-center gap-1 cursor-pointer"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>Click soi ảnh Macro có thước đo mm</span>
                        </button>
                      )}
                      {onOpenPhotoHistory && govPhotoUrl && (
                        <button
                          type="button"
                          onClick={() =>
                            onOpenPhotoHistory({
                              photoCode: govCode,
                              photoType: 'CU',
                              photoTitle: `Vết nứt khống chế ${govCode}`,
                              currentPhotoUrl: govPhotoUrl,
                            })
                          }
                          className="text-[11px] font-bold text-slate-700 hover:text-sky-700 bg-slate-100 hover:bg-sky-50 px-2 py-0.5 rounded flex items-center gap-1 cursor-pointer border border-slate-200"
                          title="Xem lịch sử và phả hệ phiên bản của ảnh vết nứt này"
                        >
                          <History className="w-3.5 h-3.5 text-sky-600" />
                          <span>Lịch sử phiên bản</span>
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => {
                          const defectCodeOrId = governingDefect.defectCode || governingDefect.id || govCode;
                          const zCode = governingDefect.zoneCode;
                          const targetDefectEl = document.getElementById(`defect-card-${defectCodeOrId}`);
                          const targetZoneEl = zCode ? document.getElementById(`zone-card-${zCode}`) : null;
                          const target = targetDefectEl || targetZoneEl;

                          if (target) {
                            target.scrollIntoView({ behavior: 'smooth', block: 'center' });
                            target.classList.add('ring-4', 'ring-amber-400', 'animate-pulse');
                            setTimeout(() => {
                              target.classList.remove('ring-4', 'ring-amber-400', 'animate-pulse');
                            }, 3000);
                          } else {
                            const step3El = document.getElementById('step-4') || document.getElementById('step-3');
                            step3El?.scrollIntoView({ behavior: 'smooth' });
                          }
                        }}
                        className="text-[11px] font-bold text-emerald-800 hover:text-emerald-900 bg-emerald-100 hover:bg-emerald-200 px-2 py-0.5 rounded flex items-center gap-1 cursor-pointer shadow-2xs border border-emerald-300"
                        title="Chuyển tới Vùng khảo sát chứa vết nứt này ở Bước 3 để xem đầy đủ mảng tường và điều chỉnh"
                      >
                        <Navigation className="w-3.5 h-3.5 text-emerald-700" />
                        <span>📍 Chuyển tới Vùng {governingDefect.zoneCode || 'gốc'} ở Bước 3</span>
                      </button>
                      {isEditMode && onOpenPhotoReplace && govPhotoUrl && (
                        <button
                          type="button"
                          onClick={() =>
                            onOpenPhotoReplace({
                              targetPhotoType: 'DEFECT_CU',
                              defectId: governingDefect.id,
                              targetPhotoId: governingDefect.defectCode || govCode,
                              currentPhotoUrl: govPhotoUrl,
                              photoTitle: `Vết nứt khống chế ${govCode}`,
                            })
                          }
                          className="text-[11px] font-bold text-amber-700 hover:text-amber-800 bg-amber-100 hover:bg-amber-200 px-2 py-0.5 rounded flex items-center gap-1 cursor-pointer"
                          title="Thay thế ảnh khuyết tật khống chế này"
                        >
                          <RefreshCw className="w-3.5 h-3.5" />
                          <span>Thay ảnh khống chế</span>
                        </button>
                      )}
                    </div>
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
                <select
                  value={burland.governingZoneCode || availableZones[0] || 'Z-01'}
                  onChange={(e) =>
                    handleNestedFieldChange('burlandSummary', 'governingZoneCode', 'Vùng khống chế', e.target.value)
                  }
                  className="w-full p-1.5 bg-white border border-slate-300 rounded-lg text-xs font-mono font-bold text-slate-800"
                >
                  {availableZones.map((z) => (
                    <option key={z} value={z}>
                      {z}
                    </option>
                  ))}
                </select>
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
        </div>

        {/* PHẦN 4.2: BẢNG TỔNG HỢP KHUYẾT TẬT TRÊN CẤU KIỆN KẾT CẤU CHỊU LỰC (CỘT, DẦM, SÀN E) */}
        <div className="space-y-3 pt-2">
          <div className="flex items-center justify-between border-b border-slate-200 pb-2">
            <span className="text-xs sm:text-sm font-black text-amber-950 uppercase tracking-wide flex items-center gap-2">
              <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-900 font-mono text-xs">Mục 4.2</span>
              Bảng Tổng Hợp Khuyết Tật Cấu Kiện Kết Cấu Chịu Lực (Cột, Dầm, Sàn BTCT E)
            </span>
            <span className="text-[11px] text-amber-800 font-mono font-bold">
              {allStructuralElements.length} cấu kiện E &bull; {allStructuralDefects.length} khuyết tật kết cấu
            </span>
          </div>

          {allStructuralElements.length === 0 ? (
            <div className="p-4 bg-amber-50/40 rounded-xl border border-amber-200 text-center text-xs text-amber-900 italic">
              Không có cấu kiện chịu lực E riêng biệt hoặc toàn bộ khuyết tật nằm trên tường ngăn Z.
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-amber-200 bg-white">
              <table className="w-full text-xs text-left">
                <thead>
                  <tr className="bg-amber-100/70 text-amber-950 font-bold border-b border-amber-200">
                    <th className="p-2.5 w-24 text-center font-mono">Mã Cấu Kiện</th>
                    <th className="p-2.5 w-32">Vị Trí / Tầng</th>
                    <th className="p-2.5 w-40">Loại Cấu Kiện</th>
                    <th className="p-2.5 w-36">Vật Liệu / Tiết Diện</th>
                    <th className="p-2.5 w-36">Toàn Vẹn Kết Cấu</th>
                    <th className="p-2.5 text-center w-28">Số Khuyết Tật D</th>
                    <th className="p-2.5 text-center w-28">Nứt Max (mm)</th>
                    <th className="p-2.5">Đánh Giá Nguy Cơ Chịu Lực</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-amber-100">
                  {allStructuralElements.map((elem: any, idx: number) => {
                    const eCode = elem.elementCode || `E-${idx + 1}`;
                    const eDefs = Array.isArray(elem.defects) ? elem.defects : [];
                    const maxDefWidth = eDefs.reduce((max: number, d: any) => {
                      const w = Number(d.widthMaxMm ?? d.width_max_mm ?? 0);
                      return w > max ? w : max;
                    }, 0);
                    const hasCriticalDefect = eDefs.some((d: any) => d.isStructuralCritical || d.is_structural_critical);

                    return (
                      <tr key={elem.id || eCode} className="hover:bg-amber-50/50 transition-colors">
                        <td className="p-2.5 text-center font-mono font-bold text-amber-900">
                          <span className="px-2 py-0.5 rounded bg-amber-100 border border-amber-300">
                            {eCode}
                          </span>
                        </td>
                        <td className="p-2.5 font-bold text-slate-700">
                          {elem.floorName || 'Tầng khảo sát'} &bull; {elem.roomName || 'Trục kết cấu'}
                        </td>
                        <td className="p-2.5 font-semibold text-slate-800">
                          {elem.elementType || 'Cột/Dầm BTCT'}
                        </td>
                        <td className="p-2.5 text-slate-600">
                          <div>{elem.materialType || 'BTCT'}</div>
                          {elem.dimensions && <div className="text-[10px] font-mono text-slate-500">{elem.dimensions}</div>}
                        </td>
                        <td className="p-2.5 text-slate-700">
                          {elem.structuralIntegrity || 'Nguyên vẹn'}
                        </td>
                        <td className="p-2.5 text-center font-mono font-bold text-slate-800">
                          {eDefs.length}
                        </td>
                        <td className="p-2.5 text-center font-mono font-bold">
                          {maxDefWidth > 0 ? (
                            <span className={maxDefWidth >= 2.0 ? 'text-red-600' : 'text-amber-700'}>
                              {maxDefWidth} mm
                            </span>
                          ) : (
                            <span className="text-slate-400 font-normal">0 mm</span>
                          )}
                        </td>
                        <td className="p-2.5">
                          {hasCriticalDefect || maxDefWidth >= 2.0 ? (
                            <span className="px-2 py-0.5 rounded bg-red-100 text-red-800 font-bold text-[10px] inline-flex items-center gap-1">
                              <AlertTriangle className="w-3 h-3 text-red-600" />
                              Nguy cơ kết cấu chịu lực
                            </span>
                          ) : eDefs.length > 0 ? (
                            <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-800 font-bold text-[10px]">
                              Khuyết tật cục bộ nhẹ
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 font-bold text-[10px]">
                              ✓ Kết cấu an toàn
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* PHẦN 4.3: CỜ CẢNH BÁO KẾT CẤU & THẨM TRA KỸ SƯ */}
        <div className="space-y-4 pt-2">
          <div className="flex items-center justify-between border-b border-slate-200 pb-2">
            <span className="text-xs sm:text-sm font-black text-slate-800 uppercase tracking-wide flex items-center gap-2">
              <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-800 font-mono text-xs">Mục 4.3</span>
              Cờ Cảnh Báo Kết Cấu & Thẩm Tra Chuyên Môn Kỹ Sư Trưởng
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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
      </div>
    </section>
  );
};
