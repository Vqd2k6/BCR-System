import React, { useState } from 'react';
import { Award, ShieldCheck, CheckCircle2, AlertTriangle, Sparkles, Scale, RefreshCw, Undo2 } from 'lucide-react';
import { api } from '../../../../../../services/api';

interface Props {
  isEditMode?: boolean;
  formState?: Record<string, any>;
  data: any;
  reportId?: string;
  handleFieldChange?: (fieldKey: string, label: string, val: any) => void;
  handleNestedFieldChange?: (parentKey: string, childKey: string, label: string, val: any) => void;
  onRefresh?: () => void;
  onOpenEngineeringJudgement: () => void;
}

export const AuditStep7EcsViScores: React.FC<Props> = ({
  isEditMode = false,
  formState = {},
  data,
  reportId,
  handleFieldChange,
  handleNestedFieldChange,
  onRefresh,
  onOpenEngineeringJudgement,
}) => {
  const sJson = data?.surveyJson || data?.survey_data_json || {};
  const riskCard = data?.leftPane?.riskScoreCard || {};
  const ecs = formState.ecs || sJson.ecs || {};
  const vi = formState.vi || sJson.vi || {};

  const [isReverting, setIsReverting] = useState(false);

  // Baseline values (Tính tự động từ KSV hiện trường)
  const baselineBurland = Number(riskCard?.e1_burland_score ?? ecs.e1 ?? 0);
  const baselineTotalEcs = Number(riskCard?.total_ecs_score ?? ecs.totalEcs ?? 0);
  const baselineEcsClass = riskCard?.ecs_class || (baselineTotalEcs < 4 ? 'Rất Thấp' : baselineTotalEcs < 9 ? 'Thấp' : baselineTotalEcs < 15 ? 'Trung Bình' : baselineTotalEcs < 20 ? 'Cao' : 'Rất Cao');
  const baselineImportance = Number(riskCard?.v1_importance_score ?? vi.v1 ?? 2.0);
  const baselineAvgVi = Number(riskCard?.avg_vi_score ?? vi.avgVi ?? vi.totalVi ?? 1.0);
  const baselineViClass = riskCard?.vi_class || (baselineAvgVi < 1.75 ? 'Rất Thấp' : baselineAvgVi < 2.5 ? 'Thấp' : baselineAvgVi < 3.25 ? 'Trung Bình' : 'Cao');

  // Lớp Can thiệp chuyên gia (Overrides)
  const isOverridden = Boolean(riskCard?.is_engineering_judgement_applied);
  const effectiveBurland = (isOverridden && riskCard?.overridden_burland_grade !== null && riskCard?.overridden_burland_grade !== undefined)
    ? Number(riskCard.overridden_burland_grade)
    : baselineBurland;
  const effectiveTotalEcs = (isOverridden && riskCard?.overridden_total_ecs !== null && riskCard?.overridden_total_ecs !== undefined)
    ? Number(riskCard.overridden_total_ecs)
    : baselineTotalEcs;
  const effectiveEcsClass = (isOverridden && riskCard?.overridden_ecs_class)
    ? riskCard.overridden_ecs_class
    : baselineEcsClass;
  const effectiveImportance = (isOverridden && riskCard?.overridden_importance_score !== null && riskCard?.overridden_importance_score !== undefined)
    ? Number(riskCard.overridden_importance_score)
    : baselineImportance;
  const effectiveAvgVi = (isOverridden && riskCard?.overridden_avg_vi !== null && riskCard?.overridden_avg_vi !== undefined)
    ? Number(riskCard.overridden_avg_vi)
    : baselineAvgVi;
  const effectiveViClass = (isOverridden && riskCard?.overridden_vi_class)
    ? riskCard.overridden_vi_class
    : baselineViClass;

  // Breakdown E1..E6
  const ecsItems = [
    { code: 'E1', name: 'Cấp Nứt Burland Cực Đại', score: effectiveBurland, max: 4, desc: 'Bề rộng nứt lớn nhất', isOverridden: isOverridden && riskCard?.overridden_burland_grade !== null },
    { code: 'E2', name: 'Nguy Cơ Kết Cấu Chịu Lực', score: ecs.e2 ?? riskCard?.e2_structure_score ?? 0, max: 4, desc: 'Khuyết tật trên cột, dầm' },
    { code: 'E3', name: 'Đo Biến Dạng, Lún & Võng', score: ecs.e3 ?? 0, max: 4, desc: 'Độ nghiêng X/Y, lún lệch, võng dầm' },
    { code: 'E4', name: 'Thoái Hóa Vật Liệu & Ẩm', score: ecs.e4 ?? 0, max: 4, desc: 'Bong tróc, ẩm mốc, rỉ sét' },
    { code: 'E5', name: 'Lịch Sử Cải Tạo & Quá Khứ', score: ecs.e5 ?? 0, max: 4, desc: 'Cộng hưởng hư hại quá khứ' },
    { code: 'E6', name: 'Suy Giảm Công Năng Tổng Thể', score: ecs.e6 ?? 0, max: 4, desc: 'Ảnh hưởng vận hành sử dụng' },
  ];

  // Breakdown V1..V6
  const viItems = [
    { code: 'V1', name: 'Tầm Quan Trọng & Khoảng Cách', score: effectiveImportance, desc: 'Công năng & cự ly tới hầm', isOverridden: isOverridden && riskCard?.overridden_importance_score !== null },
    { code: 'V2', name: 'Hệ Kết Cấu Chịu Lực', score: vi.v2 ?? 1, desc: 'Độ dẻo & ổn định của khung' },
    { code: 'V3', name: 'Giải Pháp & Độ Tin Cậy Móng', score: vi.v3 ?? 1, desc: 'Phân loại CAT móng 1..5' },
    { code: 'V4', name: 'Niên Đại & Tuổi Thọ', score: vi.v4 ?? 1, desc: 'Năm xây dựng công trình' },
    { code: 'V5', name: 'Số Tầng Nổi & Tải Trọng', score: vi.v5 ?? 1, desc: 'Tầng cao và áp lực truyền móng' },
    { code: 'V6', name: 'Địa Chất & Lân Cận', score: vi.v6 ?? 1, desc: 'Ranh giáp và mức độ chèn ép' },
  ];

  // Thu thập và kiểm tra thực tế dữ liệu vết nứt có thước đo mm
  const rawFloors: any[] = Array.isArray(sJson.floors) ? sJson.floors : [];
  const rawZones: any[] = Array.isArray(sJson.damageZones) ? sJson.damageZones : [];
  const allDefectsList: any[] = [];
  rawFloors.forEach((fl: any) => {
    (fl.zones || []).forEach((z: any) => {
      (z.defects || []).forEach((d: any) => allDefectsList.push(d));
    });
  });
  rawZones.forEach((z: any) => {
    (z.defects || []).forEach((d: any) => allDefectsList.push(d));
  });

  const totalDefectsCount = allDefectsList.length;
  const defectsWithScale = allDefectsList.filter((d) => Boolean(d.hasScaleCard ?? d.has_scale_card)).length;
  const isScaleValid = totalDefectsCount === 0 || defectsWithScale === totalDefectsCount;

  // 6 Data Completeness Gate Criteria
  const gateCriteria = [
    { title: '1. Định Danh & Cự Ly Tim Hầm', valid: Boolean(data?.houseNumber || sJson.houseNumber), note: 'Đầy đủ biển số & GPS' },
    { title: '2. Ngoại Quan Mặt Tiền P-01..P-04', valid: Boolean(sJson.p01PhotoUrl && sJson.p02PhotoUrl), note: 'Đủ 4 góc chụp ngoại quan' },
    { title: '3. Phân Loại Móng CAT', valid: Boolean(sJson.foundationType && sJson.foundationCatScore !== undefined), note: `CAT ${sJson.foundationCatScore || 3}/5` },
    { title: '4. Sơ Đồ Mặt Bằng CAD Tầng', valid: Array.isArray(sJson.floors) ? sJson.floors.length > 0 : true, note: 'Khảo sát đầy đủ tầng' },
    {
      title: '5. Thước Đo Tỷ Lệ mm Khuyết Tật',
      valid: isScaleValid,
      note: totalDefectsCount === 0
        ? 'Không có vết nứt'
        : isScaleValid
        ? `100% đạt chuẩn (${defectsWithScale}/${totalDefectsCount} vết)`
        : `⚠️ ${totalDefectsCount - defectsWithScale}/${totalDefectsCount} vết thiếu thước đo`,
    },
    { title: '6. Biến Dạng, Lún Nghiêng & Võng', valid: Boolean(sJson.settlementTilt), note: 'Ghi nhận lún & nghiêng' },
  ];

  const isAllGateValid = gateCriteria.every((c) => c.valid);

  const handleRevertToBaseline = async () => {
    if (!reportId) return;
    if (!window.confirm('Bạn có chắc chắn muốn HOÀN NGUYÊN phán quyết về kết quả tính toán tự động ban đầu từ hiện trường?')) {
      return;
    }

    setIsReverting(true);
    try {
      await api.post(`/admin/reports/${reportId}/engineering-judgement`, {
        action: 'KEEP',
        reason: 'Hoàn nguyên về kết quả tính toán tự động ban đầu từ hiện trường',
      });
      alert('Đã hoàn nguyên về điểm gốc hiện trường thành công!');
      if (onRefresh) onRefresh();
    } catch (err: any) {
      alert(err.response?.data?.message || err.message || 'Lỗi khi hoàn nguyên điểm số.');
    } finally {
      setIsReverting(false);
    }
  };

  return (
    <section id="step-7" className="scroll-mt-6 bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
      {/* Header */}
      <div className="p-4 sm:p-5 bg-slate-50/80 border-b border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <span className="px-2 py-0.5 rounded-lg bg-sky-600 text-white font-mono font-black text-xs">
            Bước 07
          </span>
          <div>
            <h3 className="text-sm sm:text-base font-black text-slate-800">
              Bảng Điểm Kỹ Thuật ECS, Độ Nhạy Cảm VI & Phán Quyết Chuyên Môn
            </h3>
            <p className="text-[11px] text-slate-500">
              Tổng hợp điểm số kỹ thuật công trình, phân hạng nguy cơ và can thiệp chuyên gia kết cấu
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isOverridden ? (
            <span className="px-3 py-1.5 rounded-xl bg-purple-100 text-purple-800 border border-purple-300 text-xs font-black flex items-center gap-1.5 shadow-2xs">
              <Scale className="w-3.5 h-3.5 text-purple-700" />
              <span>ĐÃ CAN THIỆP CHUYÊN GIA</span>
            </span>
          ) : (
            <span className="px-3 py-1.5 rounded-xl bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs font-bold flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              <span>TÍNH TỰ ĐỘNG HIỆN TRƯỜNG</span>
            </span>
          )}
          <button
            type="button"
            onClick={onOpenEngineeringJudgement}
            className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition-all flex items-center gap-1.5 shadow-md shadow-indigo-600/20 cursor-pointer"
          >
            <Award className="w-3.5 h-3.5" />
            <span>{isOverridden ? 'Chỉnh Sửa Phán Quyết' : 'Áp Dụng Phán Quyết'}</span>
          </button>
        </div>
      </div>

      <div className="p-5 space-y-6">
        {/* Khối Cổng Kiểm Tra Đủ Dữ Liệu Hiện Trường (Data Completeness Gate) */}
        <div className="p-4 rounded-xl border border-sky-200 bg-sky-50/40 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-sky-700" />
              <span className="text-xs font-black text-sky-950 uppercase tracking-wide">
                Cổng Kiểm Tra Đủ Dữ Liệu Kỹ Thuật (Data Completeness Gate)
              </span>
            </div>
            {isEditMode ? (
              <div className="flex items-center gap-2">
                <label className="text-[11px] font-bold text-slate-700">Quyết định Cổng:</label>
                <select
                  value={formState.gateDecision || (isAllGateValid ? 'ALLOW' : 'CONDITIONAL')}
                  onChange={(e) => handleFieldChange && handleFieldChange('gateDecision', 'Quyết định Cổng', e.target.value)}
                  className="p-1 text-xs font-bold bg-white border border-slate-300 rounded"
                >
                  <option value="ALLOW">✓ Cho phép phê duyệt (ALLOW)</option>
                  <option value="CONDITIONAL">⚠️ Phê duyệt có điều kiện (CONDITIONAL)</option>
                  <option value="REJECT">✕ Từ chối / Yêu cầu khảo sát lại (REJECT)</option>
                </select>
              </div>
            ) : (
              <span className={`px-2.5 py-0.5 rounded-full text-[11px] font-black border flex items-center gap-1 ${
                isAllGateValid
                  ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
                  : 'bg-amber-100 text-amber-900 border-amber-300'
              }`}>
                {isAllGateValid ? (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    <span>ĐỦ ĐIỀU KIỆN PHÊ DUYỆT</span>
                  </>
                ) : (
                  <>
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                    <span>⚠️ CẦN RÀ SOÁT DỮ LIỆU</span>
                  </>
                )}
              </span>
            )}
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 pt-1">
            {gateCriteria.map((c, idx) => (
              <div key={idx} className="p-2.5 bg-white rounded-xl border border-slate-200 flex items-start gap-2">
                {c.valid ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                ) : (
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                )}
                <div className="min-w-0">
                  <div className={`text-[11px] font-bold truncate ${c.valid ? 'text-slate-800' : 'text-amber-900'}`}>{c.title}</div>
                  <div className={`text-[10px] ${c.valid ? 'text-slate-500' : 'text-amber-700 font-semibold'}`}>{c.note}</div>
                </div>
              </div>
            ))}
          </div>

          {isEditMode && (
            <div className="pt-2">
              <label className="text-[11px] font-bold text-slate-700 block mb-1">Ghi chú điều kiện / Cổng dữ liệu:</label>
              <input
                type="text"
                value={formState.gateNotes || ''}
                onChange={(e) => handleFieldChange && handleFieldChange('gateNotes', 'Ghi chú Cổng dữ liệu', e.target.value)}
                placeholder="Ghi chú điều kiện phê duyệt hoặc yêu cầu bổ sung hồ sơ..."
                className="w-full p-1.5 text-xs bg-white border border-slate-300 rounded-lg"
              />
            </div>
          )}
        </div>

        {/* 2 Khối Điểm Tổng ECS & VI (Hiển thị Effective Score + Baseline đối chứng) */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-4 bg-sky-50/70 rounded-2xl border border-sky-200 flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-sky-800 uppercase tracking-wider block">
                  Tổng Điểm Hư Hỏng Hiện Trạng (ECS)
                </span>
                {isOverridden && (
                  <span className="px-1.5 py-0.5 rounded bg-purple-200 text-purple-900 text-[10px] font-black font-mono">
                    OVERRIDDEN
                  </span>
                )}
              </div>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-3xl font-black text-sky-950">{effectiveTotalEcs}</span>
                <span className="text-xs font-bold text-sky-600">/ 24 Điểm</span>
                {isOverridden && effectiveTotalEcs !== baselineTotalEcs && (
                  <span className="text-xs font-bold text-slate-400 line-through">
                    (Gốc: {baselineTotalEcs})
                  </span>
                )}
              </div>
              <span className="text-xs font-bold text-sky-700 block mt-1">
                Phân hạng: <strong className="text-sky-950">{effectiveEcsClass}</strong>
                {isOverridden && effectiveEcsClass !== baselineEcsClass && (
                  <span className="text-slate-500 font-normal"> (Gốc: {baselineEcsClass})</span>
                )}
              </span>
            </div>
            <div className="w-14 h-14 rounded-2xl bg-sky-600 text-white flex items-center justify-center font-black text-xl shadow-md">
              ECS
            </div>
          </div>

          <div className="p-4 bg-purple-50/70 rounded-2xl border border-purple-200 flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-purple-800 uppercase tracking-wider block">
                  Chỉ Số Nhạy Cảm Công Trình (VI)
                </span>
                {isOverridden && (
                  <span className="px-1.5 py-0.5 rounded bg-purple-200 text-purple-900 text-[10px] font-black font-mono">
                    OVERRIDDEN
                  </span>
                )}
              </div>
              <div className="flex items-baseline gap-2 mt-1">
                <span className="text-3xl font-black text-purple-950">
                  {typeof effectiveAvgVi === 'number' ? effectiveAvgVi.toFixed(2) : effectiveAvgVi}
                </span>
                <span className="text-xs font-bold text-purple-600">/ 4.00</span>
                {isOverridden && effectiveAvgVi !== baselineAvgVi && (
                  <span className="text-xs font-bold text-slate-400 line-through">
                    (Gốc: {baselineAvgVi.toFixed(2)})
                  </span>
                )}
              </div>
              <span className="text-xs font-bold text-purple-700 block mt-1">
                Phân loại: <strong className="text-purple-950">{effectiveViClass}</strong>
                {isOverridden && effectiveViClass !== baselineViClass && (
                  <span className="text-slate-500 font-normal"> (Gốc: {baselineViClass})</span>
                )}
              </span>
            </div>
            <div className="w-14 h-14 rounded-2xl bg-purple-600 text-white flex items-center justify-center font-black text-xl shadow-md">
              VI
            </div>
          </div>
        </div>

        {/* HẠNG MỤC PHÁP LÝ IN-PLACE: PHÁN QUYẾT KỸ SƯ TRƯỞNG & CAN THIỆP CHUYÊN GIA */}
        <div className="p-4 rounded-2xl border border-purple-200 bg-purple-50/40 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Scale className="w-4 h-4 text-purple-700" />
              <span className="text-xs font-black text-purple-950 uppercase tracking-wide">
                Hạng Mục Pháp Lý: Phán Quyết Chuyên Gia Kết Cấu (Engineering Judgement)
              </span>
            </div>
            {isOverridden && (
              <button
                type="button"
                onClick={handleRevertToBaseline}
                disabled={isReverting}
                className="px-2.5 py-1 bg-white hover:bg-slate-100 text-slate-700 border border-slate-300 rounded-lg text-[11px] font-bold flex items-center gap-1 transition-colors cursor-pointer"
              >
                <Undo2 className="w-3 h-3 text-slate-500" />
                <span>{isReverting ? 'Đang hoàn nguyên...' : 'Hoàn nguyên điểm gốc'}</span>
              </button>
            )}
          </div>

          {isOverridden ? (
            <div className="space-y-3 pt-1">
              {/* Bảng đối soát 2 cột: Gốc vs Can thiệp */}
              <div className="overflow-x-auto bg-white rounded-xl border border-purple-200">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="bg-purple-100/70 text-purple-950 font-bold border-b border-purple-200">
                      <th className="p-2 text-left">Chỉ số kỹ thuật</th>
                      <th className="p-2 text-center">Gốc hiện trường (KSV đo)</th>
                      <th className="p-2 text-center">Sau can thiệp chuyên môn</th>
                      <th className="p-2 text-center">Biến động</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    <tr>
                      <td className="p-2 font-medium text-slate-800">Cấp nứt Burland (E1 / BRA)</td>
                      <td className="p-2 text-center font-mono text-slate-600">Cấp {baselineBurland}</td>
                      <td className="p-2 text-center font-mono font-bold text-purple-700">Cấp {effectiveBurland}</td>
                      <td className="p-2 text-center">
                        {effectiveBurland > baselineBurland ? (
                          <span className="px-1.5 py-0.5 rounded bg-red-100 text-red-800 font-bold text-[10px]">
                            +{effectiveBurland - baselineBurland} Cấp (Nâng rủi ro)
                          </span>
                        ) : effectiveBurland < baselineBurland ? (
                          <span className="px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-800 font-bold text-[10px]">
                            -{baselineBurland - effectiveBurland} Cấp (Hạ mức)
                          </span>
                        ) : (
                          <span className="text-slate-400 font-bold text-[10px]">Giữ nguyên</span>
                        )}
                      </td>
                    </tr>
                    <tr>
                      <td className="p-2 font-medium text-slate-800">Tổng điểm hư hỏng (ECS)</td>
                      <td className="p-2 text-center font-mono text-slate-600">{baselineTotalEcs}/24 ({baselineEcsClass})</td>
                      <td className="p-2 text-center font-mono font-bold text-purple-700">{effectiveTotalEcs}/24 ({effectiveEcsClass})</td>
                      <td className="p-2 text-center">
                        {effectiveTotalEcs !== baselineTotalEcs ? (
                          <span className="px-1.5 py-0.5 rounded bg-purple-100 text-purple-800 font-bold text-[10px]">
                            {effectiveTotalEcs > baselineTotalEcs ? `+${effectiveTotalEcs - baselineTotalEcs}đ` : `${effectiveTotalEcs - baselineTotalEcs}đ`}
                          </span>
                        ) : (
                          <span className="text-slate-400 font-bold text-[10px]">Giữ nguyên</span>
                        )}
                      </td>
                    </tr>
                    <tr>
                      <td className="p-2 font-medium text-slate-800">Tầm quan trọng công năng (I / V1)</td>
                      <td className="p-2 text-center font-mono text-slate-600">{baselineImportance}đ</td>
                      <td className="p-2 text-center font-mono font-bold text-purple-700">{effectiveImportance}đ</td>
                      <td className="p-2 text-center">
                        {effectiveImportance !== baselineImportance ? (
                          <span className="px-1.5 py-0.5 rounded bg-purple-100 text-purple-800 font-bold text-[10px]">
                            {effectiveImportance > baselineImportance ? `+${(effectiveImportance - baselineImportance).toFixed(1)}đ` : `${(effectiveImportance - baselineImportance).toFixed(1)}đ`}
                          </span>
                        ) : (
                          <span className="text-slate-400 font-bold text-[10px]">Giữ nguyên</span>
                        )}
                      </td>
                    </tr>
                    <tr>
                      <td className="p-2 font-medium text-slate-800">Chỉ số dễ tổn thương (VI)</td>
                      <td className="p-2 text-center font-mono text-slate-600">{baselineAvgVi.toFixed(2)} ({baselineViClass})</td>
                      <td className="p-2 text-center font-mono font-bold text-purple-700">{effectiveAvgVi.toFixed(2)} ({effectiveViClass})</td>
                      <td className="p-2 text-center">
                        {effectiveAvgVi !== baselineAvgVi ? (
                          <span className="px-1.5 py-0.5 rounded bg-purple-100 text-purple-800 font-bold text-[10px]">
                            {effectiveAvgVi > baselineAvgVi ? `+${(effectiveAvgVi - baselineAvgVi).toFixed(2)}` : `${(effectiveAvgVi - baselineAvgVi).toFixed(2)}`}
                          </span>
                        ) : (
                          <span className="text-slate-400 font-bold text-[10px]">Giữ nguyên</span>
                        )}
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>

              {/* Thông tin chứng thực và giải trình kỹ thuật */}
              <div className="p-3 bg-white rounded-xl border border-purple-200 text-xs space-y-1.5">
                <div className="flex flex-wrap items-center justify-between text-slate-600 text-[11px] gap-2">
                  <span>
                    Kỹ sư trưởng thực hiện: <strong className="text-purple-900">{riskCard.judgement_engineer_name || 'Kỹ Sư Trưởng Zone Admin'}</strong>
                  </span>
                  {riskCard.judgement_applied_at && (
                    <span>
                      Thời gian áp dụng: <strong>{new Date(riskCard.judgement_applied_at).toLocaleString('vi-VN')}</strong>
                    </span>
                  )}
                  <span className="px-2 py-0.5 rounded bg-purple-100 text-purple-800 font-bold text-[10px]">
                    Hành động: {riskCard.engineering_judgement_action}
                  </span>
                </div>
                <div className="p-2.5 bg-purple-50/50 rounded-lg border border-purple-100 text-slate-800 text-xs">
                  <span className="font-bold text-purple-900 block mb-0.5">Căn cứ & Lý giải chuyên môn:</span>
                  <p className="italic">{riskCard.engineering_judgement_reason}</p>
                </div>
              </div>
            </div>
          ) : (
            <div className="p-3 bg-white rounded-xl border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="text-xs text-slate-600">
                <span className="font-bold text-slate-800 block">Dữ liệu hoàn toàn tuân theo thuật toán tính tự động từ hiện trường.</span>
                <span className="text-[11px] text-slate-500">Chưa có can thiệp nâng/hạ cấp rủi ro từ Kỹ sư trưởng. Báo cáo xuất ra sẽ bám sát 100% số liệu đo đạc của KSV.</span>
              </div>
              <button
                type="button"
                onClick={onOpenEngineeringJudgement}
                className="px-3 py-1.5 bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-300 rounded-xl text-xs font-bold transition-colors shrink-0 flex items-center gap-1.5 cursor-pointer"
              >
                <Award className="w-3.5 h-3.5" />
                <span>Can Thiệp Chuyên Gia (Override)</span>
              </button>
            </div>
          )}
        </div>

        {/* Chi tiết Điểm Thành Phần ECS (E1..E6) */}
        <div className="space-y-3">
          <span className="text-xs font-black text-slate-800 uppercase tracking-wide block">
            Chi Tiết 6 Tiêu Chí Điểm Hư Hỏng ECS (E1 &rarr; E6):
          </span>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {ecsItems.map((item) => {
              const eKey = item.code.toLowerCase();
              return (
                <div key={item.code} className={`p-3 rounded-xl border space-y-1 ${item.isOverridden ? 'bg-purple-50/70 border-purple-300' : 'bg-slate-50 border-slate-200'}`}>
                  <div className="flex items-center justify-between">
                    <span className={`px-1.5 py-0.5 rounded font-mono font-black text-[10px] ${item.isOverridden ? 'bg-purple-200 text-purple-900' : 'bg-sky-100 text-sky-800'}`}>
                      {item.code}
                    </span>
                    {isEditMode && handleNestedFieldChange ? (
                      <input
                        type="number"
                        min={0}
                        max={4}
                        value={ecs[eKey] ?? item.score}
                        onChange={(e) =>
                          handleNestedFieldChange('ecs', eKey, `Điểm ${item.code}`, Number(e.target.value))
                        }
                        className="w-12 p-0.5 text-center font-mono font-bold text-xs bg-white border border-amber-300 rounded"
                      />
                    ) : (
                      <span className={`text-base font-black ${item.isOverridden ? 'text-purple-950 font-mono' : 'text-slate-900'}`}>
                        {item.score}/4
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] font-bold text-slate-700 truncate">{item.name}</div>
                  <div className="text-[10px] text-slate-500 line-clamp-1">{item.desc}</div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Chi tiết Điểm Thành Phần VI (V1..V6) */}
        <div className="space-y-3 pt-2 border-t border-slate-100">
          <span className="text-xs font-black text-slate-800 uppercase tracking-wide block">
            Chi Tiết 6 Tiêu Chí Độ Nhạy Cảm VI (V1 &rarr; V6):
          </span>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {viItems.map((item) => {
              const vKey = item.code.toLowerCase();
              return (
                <div key={item.code} className={`p-3 rounded-xl border space-y-1 ${item.isOverridden ? 'bg-purple-50/70 border-purple-300' : 'bg-slate-50 border-slate-200'}`}>
                  <div className="flex items-center justify-between">
                    <span className={`px-1.5 py-0.5 rounded font-mono font-black text-[10px] ${item.isOverridden ? 'bg-purple-200 text-purple-900' : 'bg-purple-100 text-purple-800'}`}>
                      {item.code}
                    </span>
                    {isEditMode && handleNestedFieldChange ? (
                      <input
                        type="number"
                        step="0.5"
                        min={0}
                        max={5}
                        value={vi[vKey] ?? item.score}
                        onChange={(e) =>
                          handleNestedFieldChange('vi', vKey, `Điểm ${item.code}`, Number(e.target.value))
                        }
                        className="w-12 p-0.5 text-center font-mono font-bold text-xs bg-white border border-amber-300 rounded"
                      />
                    ) : (
                      <span className={`text-base font-black ${item.isOverridden ? 'text-purple-950 font-mono' : 'text-purple-900'}`}>
                        {item.score}đ
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] font-bold text-slate-700 truncate">{item.name}</div>
                  <div className="text-[10px] text-slate-500 line-clamp-1">{item.desc}</div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </section>
  );
};
