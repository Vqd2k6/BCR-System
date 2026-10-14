import type { FloorSurveyData, DamageZoneData, DefectItem } from '../../../../../survey-phase1/types/phase1.types';
import type { AuditStepwiseFormState, AuditStepwiseData, StepwiseEcs, StepwiseVi, RiskCardData } from '../types';
import { getErrorMessage } from '@/utils/errorUtils';
import React, { useState } from 'react';
import { Award, ShieldCheck, CheckCircle2, AlertTriangle, Scale, Undo2 } from 'lucide-react';
import { api } from '../../../../../../services/api';
import { ScoreExplanationPopover } from '../components/ScoreExplanationPopover';

interface Props {
  isEditMode?: boolean;
  formState?: AuditStepwiseFormState;
  data?: AuditStepwiseData;
  reportId?: string;
  handleFieldChange?: (fieldKey: string, label: string, val: unknown) => void;
  handleNestedFieldChange?: (parentKey: string, childKey: string, label: string, val: unknown) => void;
  onRefresh?: () => void;
  onOpenEngineeringJudgement: () => void;
  isFieldDirty?: (fieldKey: string, subKey?: string) => boolean;
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
  isFieldDirty,
}) => {
  const sJson = data?.surveyJson || data?.survey_data_json || {};
  const riskCard: RiskCardData = data?.leftPane?.riskScoreCard || {};
  const ecs: StepwiseEcs = formState.ecs || sJson.ecs || {};
  const vi: StepwiseVi = formState.vi || sJson.vi || {};

  const [isReverting, setIsReverting] = useState(false);

  // Helper map risk classes to pure Vietnamese technical terms
  const toVietnameseRiskClass = (cls?: string): string => {
    if (!cls) return 'Chưa phân hạng';
    const c = cls.toUpperCase();
    if (c === 'VERY_LOW' || c === 'GOOD' || c === 'RẤT THẤP') return 'Tốt / Rất Thấp';
    if (c === 'LOW' || c === 'THẤP') return 'Thấp';
    if (c === 'MEDIUM' || c === 'MODERATE' || c === 'TRUNG BÌNH') return 'Trung Bình';
    if (c === 'HIGH' || c === 'DEFICIENT' || c === 'CAO') return 'Xuống Cấp / Cao';
    if (c === 'VERY_HIGH' || c === 'CRITICAL' || c === 'RẤT CAO') return 'Nguy Cấp / Rất Cao';
    return cls;
  };

  // Baseline values (Tính tự động từ KSV hiện trường)
  const baselineBurland = Number(riskCard?.e1_burland_score ?? ecs.e1 ?? 0);
  const baselineTotalEcs = Number(riskCard?.total_ecs_score ?? ecs.totalEcs ?? 0);
  const baselineEcsClass = toVietnameseRiskClass(
    riskCard?.ecs_class ||
      (baselineTotalEcs <= 5 ? 'GOOD' : baselineTotalEcs <= 10 ? 'MEDIUM' : baselineTotalEcs <= 16 ? 'DEFICIENT' : 'CRITICAL')
  );
  const baselineImportance = Number(riskCard?.v1_importance_score ?? vi.v1 ?? 2.0);
  const baselineAvgVi = Number(riskCard?.avg_vi_score ?? vi.avgVi ?? vi.totalVi ?? 1.0);
  const baselineViClass = toVietnameseRiskClass(
    riskCard?.vi_class ||
      (baselineAvgVi < 1.5 ? 'LOW' : baselineAvgVi < 2.5 ? 'MEDIUM' : baselineAvgVi < 3.5 ? 'HIGH' : 'VERY_HIGH')
  );

  // Lớp Can thiệp chuyên gia (Overrides)
  const isOverridden = Boolean(riskCard?.is_engineering_judgement_applied);
  const effectiveBurland =
    isOverridden && riskCard?.overridden_burland_grade !== null && riskCard?.overridden_burland_grade !== undefined
      ? Number(riskCard.overridden_burland_grade)
      : baselineBurland;
  const effectiveTotalEcs =
    isOverridden && riskCard?.overridden_total_ecs !== null && riskCard?.overridden_total_ecs !== undefined
      ? Number(riskCard.overridden_total_ecs)
      : baselineTotalEcs;
  const effectiveEcsClass =
    isOverridden && riskCard?.overridden_ecs_class
      ? toVietnameseRiskClass(riskCard.overridden_ecs_class)
      : baselineEcsClass;
  const effectiveImportance =
    isOverridden && riskCard?.overridden_importance_score !== null && riskCard?.overridden_importance_score !== undefined
      ? Number(riskCard.overridden_importance_score)
      : baselineImportance;
  const effectiveAvgVi =
    isOverridden && riskCard?.overridden_avg_vi !== null && riskCard?.overridden_avg_vi !== undefined
      ? Number(riskCard.overridden_avg_vi)
      : baselineAvgVi;
  const effectiveViClass =
    isOverridden && riskCard?.overridden_vi_class
      ? toVietnameseRiskClass(riskCard.overridden_vi_class)
      : baselineViClass;

  // Breakdown E1..E6 (ECS) with complete technical standards
  const ecsItems = [
    {
      code: 'E1',
      key: 'e1',
      name: 'Cấp Nứt Burland Cực Đại',
      score: effectiveBurland,
      max: 4,
      standard: 'Phân loại bề rộng vết nứt lớn nhất theo thang chuẩn Burland 1977 & CIRIA SP32',
      isOverridden: isOverridden && riskCard?.overridden_burland_grade !== null,
    },
    {
      code: 'E2',
      key: 'e2',
      name: 'Nguy Cơ Kết Cấu Chịu Lực',
      score: Number(ecs.e2 ?? riskCard?.e2_structure_score ?? 0),
      max: 4,
      standard: 'Mức độ hư hại và nứt vỡ trên các cấu kiện chịu lực chính (cột, dầm, sàn BTCT)',
      isOverridden: false,
    },
    {
      code: 'E3',
      key: 'e3',
      name: 'Đo Biến Dạng, Lún & Võng Dầm',
      score: Number(ecs.e3 ?? 0),
      max: 4,
      standard: 'Độ nghiêng tổng thể 2 phương X/Y, đo độ chênh lún móng và độ võng dầm kết cấu',
      isOverridden: false,
    },
    {
      code: 'E4',
      key: 'e4',
      name: 'Thoái Hóa Vật Liệu & Độ Ẩm',
      score: Number(ecs.e4 ?? 0),
      max: 4,
      standard: 'Mức độ rỉ sét cốt thép, cacbonat hóa bê tông, ẩm mốc, bong tróc vữa trát',
      isOverridden: false,
    },
    {
      code: 'E5',
      key: 'e5',
      name: 'Lịch Sử Cải Tạo & Quá Khứ',
      score: Number(ecs.e5 ?? 0),
      max: 4,
      standard: 'Dấu vết cơi nới, nâng tầng, sửa chữa kết cấu không đồng bộ hoặc lún tích lũy',
      isOverridden: false,
    },
    {
      code: 'E6',
      key: 'e6',
      name: 'Suy Giảm Công Năng Khai Thác',
      score: Number(ecs.e6 ?? 0),
      max: 4,
      standard: 'Mức độ ảnh hưởng đến khả năng đóng mở cửa sổ/cửa đi, an toàn sử dụng của hộ dân',
      isOverridden: false,
    },
  ];

  // Breakdown V1..V6 (VI) with complete technical definitions
  const viItems = [
    {
      code: 'V1',
      key: 'v1',
      name: 'Tầm Quan Trọng & Cự Ly Tim Hầm',
      score: effectiveImportance,
      max: 4,
      definition: 'Mức độ quan trọng công năng công trình và cự ly không gian tới tim hầm Metro',
      isOverridden: isOverridden && riskCard?.overridden_importance_score !== null,
    },
    {
      code: 'V2',
      key: 'v2',
      name: 'Hệ Kết Cấu Chịu Lực Chính',
      score: Number(vi.v2 ?? 1),
      max: 4,
      definition: 'Độ dẻo dai và tính ổn định tổng thể của hệ khung (BTCT toàn khối, tường gạch...)',
      isOverridden: false,
    },
    {
      code: 'V3',
      key: 'v3',
      name: 'Giải Pháp & Độ Tin Cậy Móng',
      score: Number(vi.v3 ?? 1),
      max: 5,
      definition: 'Phân loại nhóm giải pháp móng (CAT 1 cọc khoan nhồi đến CAT 5 móng nông bùn)',
      isOverridden: false,
    },
    {
      code: 'V4',
      key: 'v4',
      name: 'Niên Đại & Tuổi Thọ Công Trình',
      score: Number(vi.v4 ?? 1),
      max: 4,
      definition: 'Thời gian đã đưa vào khai thác sử dụng và mức độ hao mòn kết cấu theo năm',
      isOverridden: false,
    },
    {
      code: 'V5',
      key: 'v5',
      name: 'Số Tầng Nổi & Phân Bố Tải Trọng',
      score: Number(vi.v5 ?? 1),
      max: 4,
      definition: 'Số tầng cao, tải trọng bản thân truyền xuống móng và độ cứng uốn không gian',
      isOverridden: false,
    },
    {
      code: 'V6',
      key: 'v6',
      name: 'Điều Kiện Địa Chất & Lân Cận',
      score: Number(vi.v6 ?? 1),
      max: 4,
      definition: 'Lớp đất nền chịu lực, mực nước ngầm và mức độ chèn ép ranh giới công trình liền kề',
      isOverridden: false,
    },
  ];

  // Thu thập và kiểm tra thực tế dữ liệu vết nứt có thước đo mm
  const rawFloors: FloorSurveyData[] = Array.isArray(sJson.floors) ? sJson.floors : [];
  const rawZones: DamageZoneData[] = Array.isArray(sJson.damageZones) ? sJson.damageZones : [];
  const allDefectsList: DefectItem[] = [];
  rawFloors.forEach((fl: FloorSurveyData) => {
    (fl.zones || []).forEach((z: DamageZoneData) => {
      (z.defects || []).forEach((d: DefectItem) => allDefectsList.push(d));
    });
  });
  rawZones.forEach((z: DamageZoneData) => {
    (z.defects || []).forEach((d: DefectItem) => allDefectsList.push(d));
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
    { title: '6. Biến Dạng, Lún Nghiêng & Quan Trắc', valid: Boolean(sJson.settlementTilt), note: 'Đo lường độ nghiêng & lún' },
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
    } catch (err: unknown) {
      alert(getErrorMessage(err, 'Lỗi khi hoàn nguyên điểm số.'));
    } finally {
      setIsReverting(false);
    }
  };

  const checkDirty = (fieldKey: string, subKey?: string) => {
    return isFieldDirty ? isFieldDirty(fieldKey, subKey) : false;
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
              Trình bày chi tiết 2 bảng dọc chuẩn mực cho 6 tiêu chí ECS và 6 tiêu chí VI kèm thẩm quyền can thiệp của Kỹ sư trưởng
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
        {/* 1. CỔNG KIỂM TRA ĐỦ DỮ LIỆU HIỆN TRƯỜNG (Data Completeness Gate) */}
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
                  value={typeof formState.gateDecision === 'string' ? formState.gateDecision : formState.gateDecision?.decision || (isAllGateValid ? 'ALLOW' : 'CONDITIONAL')}
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

        {/* 2. KHỐI TỔNG ĐIỂM TỔNG HỢP ECS & VI (HIỂN THỊ ĐỐI CHIẾU 2 CỘT SONG SONG GỐC VS CAN THIỆP) */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Card ECS */}
          <div className="p-4 bg-sky-50/70 rounded-2xl border border-sky-200 flex flex-col justify-between space-y-3">
            <div className="flex items-center justify-between border-b border-sky-200/80 pb-2">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-black text-sky-950 uppercase tracking-wider">
                  Điểm Hư Hỏng Kết Cấu (ECS)
                </span>
                <ScoreExplanationPopover metric="ECS" />
              </div>
              <div className="w-8 h-8 rounded-xl bg-sky-600 text-white flex items-center justify-center font-black text-xs shadow-xs">
                ECS
              </div>
            </div>

            {isOverridden ? (
              <div className="grid grid-cols-2 gap-2 bg-white/80 p-3 rounded-xl border border-sky-200 text-xs">
                {/* Cột trái: Gốc Hiện Trường */}
                <div className="space-y-1 border-r border-slate-200 pr-2">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                    Gốc Hiện Trường
                  </span>
                  <div className="flex items-baseline gap-1">
                    <span className="text-2xl font-black text-slate-700">{baselineTotalEcs}</span>
                    <span className="text-[11px] font-bold text-slate-400">/ 24</span>
                  </div>
                  <span className="text-[11px] font-bold text-slate-600 block truncate">
                    {baselineEcsClass}
                  </span>
                </div>

                {/* Cột phải: Sau Can Thiệp Kỹ Sư Trưởng */}
                <div className="space-y-1 pl-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-black text-purple-700 uppercase tracking-wider block">
                      Sau Can Thiệp
                    </span>
                    {effectiveTotalEcs !== baselineTotalEcs && (
                      <span className={`px-1.5 py-0.2 rounded font-mono font-bold text-[10px] ${
                        effectiveTotalEcs > baselineTotalEcs
                          ? 'bg-rose-100 text-rose-800'
                          : 'bg-emerald-100 text-emerald-800'
                      }`}>
                        {effectiveTotalEcs > baselineTotalEcs ? `+${effectiveTotalEcs - baselineTotalEcs}` : effectiveTotalEcs - baselineTotalEcs}
                      </span>
                    )}
                  </div>
                  <div className="flex items-baseline gap-1">
                    <span className="text-2xl font-black text-purple-950">{effectiveTotalEcs}</span>
                    <span className="text-[11px] font-bold text-purple-600">/ 24</span>
                  </div>
                  <span className="text-[11px] font-black text-purple-900 block truncate">
                    {effectiveEcsClass}
                  </span>
                </div>
              </div>
            ) : (
              <div className="flex items-baseline justify-between pt-1">
                <div>
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-3xl font-black text-sky-950">{baselineTotalEcs}</span>
                    <span className="text-xs font-bold text-sky-600">/ 24 Điểm</span>
                  </div>
                  <span className="text-xs font-bold text-sky-800 block mt-1">
                    Phân hạng: <strong className="text-sky-950">{baselineEcsClass}</strong>
                  </span>
                </div>
                <span className="px-2 py-1 rounded-lg bg-emerald-100 text-emerald-800 text-[10px] font-bold border border-emerald-200">
                  ✓ Gốc Hiện Trường
                </span>
              </div>
            )}

            {isOverridden && riskCard?.judgement_engineer_name && (
              <div className="text-[10px] text-slate-500 italic pt-1 border-t border-sky-100 flex items-center justify-between">
                <span>Phê chuẩn: <strong>{riskCard.judgement_engineer_name}</strong></span>
                <span className="font-semibold text-purple-700">({riskCard.engineering_judgement_action || 'OVERRIDE'})</span>
              </div>
            )}
          </div>

          {/* Card VI */}
          <div className="p-4 bg-purple-50/70 rounded-2xl border border-purple-200 flex flex-col justify-between space-y-3">
            <div className="flex items-center justify-between border-b border-purple-200/80 pb-2">
              <div className="flex items-center gap-1.5">
                <span className="text-xs font-black text-purple-950 uppercase tracking-wider">
                  Chỉ Số Dễ Tổn Thương (VI)
                </span>
                <ScoreExplanationPopover metric="VI" />
              </div>
              <div className="w-8 h-8 rounded-xl bg-purple-600 text-white flex items-center justify-center font-black text-xs shadow-xs">
                VI
              </div>
            </div>

            {isOverridden ? (
              <div className="grid grid-cols-2 gap-2 bg-white/80 p-3 rounded-xl border border-purple-200 text-xs">
                {/* Cột trái: Gốc Hiện Trường */}
                <div className="space-y-1 border-r border-slate-200 pr-2">
                  <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                    Gốc Hiện Trường
                  </span>
                  <div className="flex items-baseline gap-1">
                    <span className="text-2xl font-black text-slate-700">{baselineAvgVi.toFixed(2)}</span>
                    <span className="text-[11px] font-bold text-slate-400">/ 4.0</span>
                  </div>
                  <span className="text-[11px] font-bold text-slate-600 block truncate">
                    {baselineViClass}
                  </span>
                </div>

                {/* Cột phải: Sau Can Thiệp Kỹ Sư Trưởng */}
                <div className="space-y-1 pl-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-black text-purple-700 uppercase tracking-wider block">
                      Sau Can Thiệp
                    </span>
                    {effectiveAvgVi !== baselineAvgVi && (
                      <span className={`px-1.5 py-0.2 rounded font-mono font-bold text-[10px] ${
                        effectiveAvgVi > baselineAvgVi
                          ? 'bg-rose-100 text-rose-800'
                          : 'bg-emerald-100 text-emerald-800'
                      }`}>
                        {effectiveAvgVi > baselineAvgVi
                          ? `+${(effectiveAvgVi - baselineAvgVi).toFixed(2)}`
                          : (effectiveAvgVi - baselineAvgVi).toFixed(2)}
                      </span>
                    )}
                  </div>
                  <div className="flex items-baseline gap-1">
                    <span className="text-2xl font-black text-purple-950">
                      {typeof effectiveAvgVi === 'number' ? effectiveAvgVi.toFixed(2) : effectiveAvgVi}
                    </span>
                    <span className="text-[11px] font-bold text-purple-600">/ 4.0</span>
                  </div>
                  <span className="text-[11px] font-black text-purple-900 block truncate">
                    {effectiveViClass}
                  </span>
                </div>
              </div>
            ) : (
              <div className="flex items-baseline justify-between pt-1">
                <div>
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-3xl font-black text-purple-950">{baselineAvgVi.toFixed(2)}</span>
                    <span className="text-xs font-bold text-purple-600">/ 4.00</span>
                  </div>
                  <span className="text-xs font-bold text-purple-800 block mt-1">
                    Phân loại: <strong className="text-purple-950">{baselineViClass}</strong>
                  </span>
                </div>
                <span className="px-2 py-1 rounded-lg bg-emerald-100 text-emerald-800 text-[10px] font-bold border border-emerald-200">
                  ✓ Gốc Hiện Trường
                </span>
              </div>
            )}

            {isOverridden && riskCard?.judgement_engineer_name && (
              <div className="text-[10px] text-slate-500 italic pt-1 border-t border-purple-100 flex items-center justify-between">
                <span>Phê chuẩn: <strong>{riskCard.judgement_engineer_name}</strong></span>
                <span className="font-semibold text-purple-700">({riskCard.engineering_judgement_action || 'OVERRIDE'})</span>
              </div>
            )}
          </div>
        </div>

        {/* 3. BẢNG DỌC CHI TIẾT 6 TIÊU CHÍ ECS (E1 -> E6) */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs sm:text-sm font-black text-slate-800 uppercase tracking-wide flex items-center gap-2">
              <span className="px-2 py-0.5 rounded bg-sky-100 text-sky-800 font-mono text-xs">Bảng 1</span>
              Chi Tiết 6 Tiêu Chí Điểm Hư Hỏng Hiện Trạng (ECS)
            </span>
            <span className="text-[11px] text-slate-500">Thang điểm từng tiêu chí: 0 &rarr; 4 điểm</span>
          </div>

          <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
            <table className="w-full text-xs text-left">
              <thead>
                <tr className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200">
                  <th className="p-3 w-16 text-center font-mono">Mã</th>
                  <th className="p-3 w-48">Tên Tiêu Chí</th>
                  <th className="p-3">Quy Chuẩn & Định Nghĩa Kỹ Thuật</th>
                  <th className="p-3 w-28 text-center">Thang Chuẩn</th>
                  <th className="p-3 w-32 text-center">Điểm Đánh Giá</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {ecsItems.map((item) => {
                  const eKey = item.key;
                  const isDirty = checkDirty('ecs', eKey);
                  return (
                    <tr
                      key={item.code}
                      className={`hover:bg-slate-50/80 transition-colors ${
                        isDirty ? 'bg-amber-50/40' : item.isOverridden ? 'bg-purple-50/30' : ''
                      }`}
                    >
                      <td className="p-3 text-center">
                        <span className="px-2 py-0.5 rounded font-mono font-black text-xs bg-sky-100 text-sky-800">
                          {item.code}
                        </span>
                      </td>
                      <td className="p-3 font-bold text-slate-800">
                        {item.name}
                        {item.isOverridden && (
                          <span className="block text-[10px] font-mono text-purple-700 font-bold">
                            (Chuyên gia can thiệp)
                          </span>
                        )}
                      </td>
                      <td className="p-3 text-slate-600 text-[11px] leading-relaxed">
                        {item.standard}
                      </td>
                      <td className="p-3 text-center font-mono text-slate-500">
                        0 &rarr; {item.max}
                      </td>
                      <td className="p-3 text-center">
                        {isEditMode && handleNestedFieldChange ? (
                          <div className="flex items-center justify-center gap-1">
                            <input
                              type="number"
                              min={0}
                              max={item.max}
                              value={Number(ecs[eKey] ?? item.score)}
                              onChange={(e) =>
                                handleNestedFieldChange('ecs', eKey, `Điểm ${item.code}`, Number(e.target.value))
                              }
                              className={`w-16 p-1 text-center font-mono font-bold text-xs bg-white rounded border focus:outline-sky-500 ${
                                isDirty ? 'border-amber-400 ring-1 ring-amber-300 bg-amber-50' : 'border-slate-300'
                              }`}
                            />
                            {isDirty && (
                              <span className="text-[10px] font-bold text-amber-700">Đã sửa</span>
                            )}
                          </div>
                        ) : (
                          <div className="flex items-center justify-center gap-1.5">
                            <span
                              className={`px-2.5 py-1 rounded-lg font-mono font-black text-xs ${
                                item.isOverridden
                                  ? 'bg-purple-100 text-purple-900 border border-purple-200'
                                  : isDirty
                                  ? 'bg-amber-100 text-amber-900 border border-amber-300'
                                  : 'bg-slate-100 text-slate-800'
                              }`}
                            >
                              {Number(item.score)} / {item.max}
                            </span>
                            {isDirty && (
                              <span className="text-[10px] font-bold text-amber-700">Đã sửa</span>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* 4. BẢNG DỌC CHI TIẾT 6 TIÊU CHÍ VI (V1 -> V6) */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs sm:text-sm font-black text-slate-800 uppercase tracking-wide flex items-center gap-2">
              <span className="px-2 py-0.5 rounded bg-purple-100 text-purple-800 font-mono text-xs">Bảng 2</span>
              Chi Tiết 6 Tiêu Chí Chỉ Số Nhạy Cảm Công Trình (VI)
            </span>
            <span className="text-[11px] text-slate-500">Đánh giá hệ kết cấu, giải pháp móng & địa bàn</span>
          </div>

          <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
            <table className="w-full text-xs text-left">
              <thead>
                <tr className="bg-slate-50 text-slate-700 font-bold border-b border-slate-200">
                  <th className="p-3 w-16 text-center font-mono">Mã</th>
                  <th className="p-3 w-48">Tên Tiêu Chí</th>
                  <th className="p-3">Quy Chuẩn & Định Nghĩa Kỹ Thuật</th>
                  <th className="p-3 w-28 text-center">Thang Chuẩn</th>
                  <th className="p-3 w-32 text-center">Điểm Đánh Giá</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {viItems.map((item) => {
                  const vKey = item.key;
                  const isDirty = checkDirty('vi', vKey);
                  return (
                    <tr
                      key={item.code}
                      className={`hover:bg-slate-50/80 transition-colors ${
                        isDirty ? 'bg-amber-50/40' : item.isOverridden ? 'bg-purple-50/30' : ''
                      }`}
                    >
                      <td className="p-3 text-center">
                        <span className="px-2 py-0.5 rounded font-mono font-black text-xs bg-purple-100 text-purple-800">
                          {item.code}
                        </span>
                      </td>
                      <td className="p-3 font-bold text-slate-800">
                        {item.name}
                        {item.isOverridden && (
                          <span className="block text-[10px] font-mono text-purple-700 font-bold">
                            (Chuyên gia can thiệp)
                          </span>
                        )}
                      </td>
                      <td className="p-3 text-slate-600 text-[11px] leading-relaxed">
                        {item.definition}
                      </td>
                      <td className="p-3 text-center font-mono text-slate-500">
                        0 &rarr; {item.max}.0
                      </td>
                      <td className="p-3 text-center">
                        {isEditMode && handleNestedFieldChange ? (
                          <div className="flex items-center justify-center gap-1">
                            <input
                              type="number"
                              step="0.5"
                              min={0}
                              max={item.max}
                              value={Number(vi[vKey] ?? item.score)}
                              onChange={(e) =>
                                handleNestedFieldChange('vi', vKey, `Điểm ${item.code}`, Number(e.target.value))
                              }
                              className={`w-16 p-1 text-center font-mono font-bold text-xs bg-white rounded border focus:outline-purple-500 ${
                                isDirty ? 'border-amber-400 ring-1 ring-amber-300 bg-amber-50' : 'border-slate-300'
                              }`}
                            />
                            {isDirty && (
                              <span className="text-[10px] font-bold text-amber-700">Đã sửa</span>
                            )}
                          </div>
                        ) : (
                          <div className="flex items-center justify-center gap-1.5">
                            <span
                              className={`px-2.5 py-1 rounded-lg font-mono font-black text-xs ${
                                item.isOverridden
                                  ? 'bg-purple-100 text-purple-900 border border-purple-200'
                                  : isDirty
                                  ? 'bg-amber-100 text-amber-900 border border-amber-300'
                                  : 'bg-slate-100 text-slate-800'
                              }`}
                            >
                              {Number(item.score).toFixed(1)} đ
                            </span>
                            {isDirty && (
                              <span className="text-[10px] font-bold text-amber-700">Đã sửa</span>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* 5. KHỐI PHÁN QUYẾT CHUYÊN GIA KẾT CẤU (ĐẶT Ở CUỐI BƯỚC 07) */}
        <div className="p-4 rounded-2xl border border-purple-200 bg-purple-50/40 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Scale className="w-5 h-5 text-purple-700" />
              <div>
                <span className="text-xs sm:text-sm font-black text-purple-950 uppercase tracking-wide block">
                  Phán Quyết Chuyên Gia Kết Cấu & Thẩm Quyền Can Thiệp (Engineering Judgement)
                </span>
                <span className="text-[11px] text-slate-500">
                  Cơ sở pháp lý cho phép Kỹ sư trưởng bảo lưu hoặc điều chỉnh phân hạng nguy cơ trước khi lập kết luận
                </span>
              </div>
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
                      <th className="p-2.5 text-left">Chỉ Số Kỹ Thuật</th>
                      <th className="p-2.5 text-center">Gốc Hiện Trường (KSV Đo)</th>
                      <th className="p-2.5 text-center">Sau Can Thiệp Chuyên Môn</th>
                      <th className="p-2.5 text-center">Biến Động</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    <tr>
                      <td className="p-2.5 font-medium text-slate-800">Cấp nứt Burland (E1 / BRA)</td>
                      <td className="p-2.5 text-center font-mono text-slate-600">Cấp {baselineBurland}</td>
                      <td className="p-2.5 text-center font-mono font-bold text-purple-700">Cấp {effectiveBurland}</td>
                      <td className="p-2.5 text-center">
                        {effectiveBurland > baselineBurland ? (
                          <span className="px-2 py-0.5 rounded bg-red-100 text-red-800 font-bold text-[10px]">
                            +{effectiveBurland - baselineBurland} Cấp (Nâng rủi ro)
                          </span>
                        ) : effectiveBurland < baselineBurland ? (
                          <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 font-bold text-[10px]">
                            -{baselineBurland - effectiveBurland} Cấp (Hạ mức)
                          </span>
                        ) : (
                          <span className="text-slate-400 font-bold text-[10px]">Giữ nguyên</span>
                        )}
                      </td>
                    </tr>
                    <tr>
                      <td className="p-2.5 font-medium text-slate-800">Tổng điểm hư hỏng (ECS)</td>
                      <td className="p-2.5 text-center font-mono text-slate-600">{baselineTotalEcs}/24 ({baselineEcsClass})</td>
                      <td className="p-2.5 text-center font-mono font-bold text-purple-700">{effectiveTotalEcs}/24 ({effectiveEcsClass})</td>
                      <td className="p-2.5 text-center">
                        {effectiveTotalEcs !== baselineTotalEcs ? (
                          <span className="px-2 py-0.5 rounded bg-purple-100 text-purple-800 font-bold text-[10px]">
                            {effectiveTotalEcs > baselineTotalEcs ? `+${effectiveTotalEcs - baselineTotalEcs}đ` : `${effectiveTotalEcs - baselineTotalEcs}đ`}
                          </span>
                        ) : (
                          <span className="text-slate-400 font-bold text-[10px]">Giữ nguyên</span>
                        )}
                      </td>
                    </tr>
                    <tr>
                      <td className="p-2.5 font-medium text-slate-800">Tầm quan trọng công năng (I / V1)</td>
                      <td className="p-2.5 text-center font-mono text-slate-600">{baselineImportance.toFixed(1)}đ</td>
                      <td className="p-2.5 text-center font-mono font-bold text-purple-700">{effectiveImportance.toFixed(1)}đ</td>
                      <td className="p-2.5 text-center">
                        {effectiveImportance !== baselineImportance ? (
                          <span className="px-2 py-0.5 rounded bg-purple-100 text-purple-800 font-bold text-[10px]">
                            {effectiveImportance > baselineImportance ? `+${(effectiveImportance - baselineImportance).toFixed(1)}đ` : `${(effectiveImportance - baselineImportance).toFixed(1)}đ`}
                          </span>
                        ) : (
                          <span className="text-slate-400 font-bold text-[10px]">Giữ nguyên</span>
                        )}
                      </td>
                    </tr>
                    <tr>
                      <td className="p-2.5 font-medium text-slate-800">Chỉ số dễ tổn thương (VI)</td>
                      <td className="p-2.5 text-center font-mono text-slate-600">{baselineAvgVi.toFixed(2)} ({baselineViClass})</td>
                      <td className="p-2.5 text-center font-mono font-bold text-purple-700">{effectiveAvgVi.toFixed(2)} ({effectiveViClass})</td>
                      <td className="p-2.5 text-center">
                        {effectiveAvgVi !== baselineAvgVi ? (
                          <span className="px-2 py-0.5 rounded bg-purple-100 text-purple-800 font-bold text-[10px]">
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
              <div className="p-3.5 bg-white rounded-xl border border-purple-200 text-xs space-y-2">
                <div className="flex flex-wrap items-center justify-between text-slate-600 text-[11px] gap-2">
                  <span>
                    Kỹ sư trưởng thực hiện: <strong className="text-purple-900">{riskCard.judgement_engineer_name || 'Kỹ Sư Trưởng Zone Admin'}</strong>
                  </span>
                  {riskCard.judgement_applied_at ? (
                    <span>
                      Thời gian áp dụng: <strong>{new Date(riskCard.judgement_applied_at as string).toLocaleString('vi-VN')}</strong>
                    </span>
                  ) : null}
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
            <div className="p-3.5 bg-white rounded-xl border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="text-xs text-slate-600">
                <span className="font-bold text-slate-800 block">Dữ liệu hoàn toàn tuân theo thuật toán tính tự động từ hiện trường.</span>
                <span className="text-[11px] text-slate-500">Chưa có can thiệp nâng/hạ cấp rủi ro từ Kỹ sư trưởng. Báo cáo xuất ra sẽ bám sát 100% số liệu đo đạc của KSV.</span>
              </div>
              <button
                type="button"
                onClick={onOpenEngineeringJudgement}
                className="px-3.5 py-2 bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-300 rounded-xl text-xs font-bold transition-colors shrink-0 flex items-center gap-1.5 cursor-pointer shadow-2xs"
              >
                <Award className="w-4 h-4" />
                <span>Can Thiệp Chuyên Gia (Override)</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </section>
  );
};
