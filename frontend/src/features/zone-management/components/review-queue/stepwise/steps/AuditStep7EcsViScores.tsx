import type { FloorSurveyData, DamageZoneData, DefectItem } from '../../../../../survey-phase1/types/phase1.types';
import type {
  AuditStepwiseFormState,
  AuditStepwiseData,
  StepwiseEcs,
  StepwiseVi,
  RiskCardData,
  PhotoActionPayload,
  StepwiseIdentificationPhotoItem,
} from '../types';
import { getErrorMessage } from '@/utils/errorUtils';
import React, { useState } from 'react';
import { Award, ShieldCheck, CheckCircle2, AlertTriangle, Scale, Undo2 } from 'lucide-react';
import { api } from '../../../../../../services/api';
import { ScoreExplanationPopover, type MetricType } from '../components/ScoreExplanationPopover';
import { resolveOptimisticPhoto, getOptimisticAddedPhotos } from '../utils/optimisticPhotoResolver';

const isSoftDeleted = (item: unknown): boolean => {
  if (!item || typeof item !== 'object') return false;
  const rec = item as Record<string, unknown>;
  return Boolean(rec.isDeleted || rec.is_deleted);
};

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
  stagedPhotoActions?: PhotoActionPayload[];
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
  stagedPhotoActions = [],
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

  // Tính toán trực tiếp E1..E6 từ formState.ecs (hoặc riskCard) để khi sửa inline sẽ cập nhật ngay Tổng điểm ECS & Hạng ECS
  const e1Val = Number(ecs.e1 ?? riskCard?.e1_burland_score ?? 0);
  const e2Val = Number(ecs.e2 ?? riskCard?.e2_structure_score ?? 0);
  const e3Val = Number(ecs.e3 ?? riskCard?.e3_deformation_score ?? 0);
  const e4Val = Number(ecs.e4 ?? riskCard?.e4_material_score ?? 0);
  const e5Val = Number(ecs.e5 ?? riskCard?.e5_history_score ?? 0);
  const e6Val = Number(ecs.e6 ?? riskCard?.e6_overall_function_score ?? 0);
  const hasInlineEcsComponents =
    ecs.e1 !== undefined ||
    ecs.e2 !== undefined ||
    ecs.e3 !== undefined ||
    ecs.e4 !== undefined ||
    ecs.e5 !== undefined ||
    ecs.e6 !== undefined;
  const computedTotalEcs = e1Val + e2Val + e3Val + e4Val + e5Val + e6Val;

  const baselineBurland = e1Val;
  const baselineTotalEcs = hasInlineEcsComponents
    ? computedTotalEcs
    : Number(ecs.totalEcs ?? riskCard?.total_ecs_score ?? computedTotalEcs);
  const derivedEcsCode =
    baselineTotalEcs <= 5 ? 'GOOD' : baselineTotalEcs <= 10 ? 'MEDIUM' : baselineTotalEcs <= 16 ? 'DEFICIENT' : 'CRITICAL';
  const baselineEcsClass = toVietnameseRiskClass(
    hasInlineEcsComponents ? derivedEcsCode : ecs.ecsClass || riskCard?.ecs_class || derivedEcsCode
  );

  // Tính toán trực tiếp V1..V6 từ formState.vi (hoặc riskCard) để khi sửa inline sẽ cập nhật ngay VI trung bình & Hạng VI
  const v1Val = Number(vi.v1 ?? riskCard?.v1_importance_score ?? 2);
  const v2Val = Number(vi.v2 ?? riskCard?.v2_structure_score ?? 2);
  const v3Val = Number(vi.v3 ?? riskCard?.v3_foundation_score ?? 2);
  const v4Val = Number(vi.v4 ?? riskCard?.v4_age_score ?? 2);
  const v5Val = Number(vi.v5 ?? riskCard?.v5_ecs_score ?? 1);
  const v6Val = Number(vi.v6 ?? riskCard?.v6_sensitivity_score ?? 1);
  const hasInlineViComponents =
    vi.v1 !== undefined ||
    vi.v2 !== undefined ||
    vi.v3 !== undefined ||
    vi.v4 !== undefined ||
    vi.v5 !== undefined ||
    vi.v6 !== undefined;
  const computedAvgVi = Number(((v1Val + v2Val + v3Val + v4Val + v5Val + v6Val) / 6).toFixed(2));

  const baselineImportance = v1Val;
  const baselineAvgVi = hasInlineViComponents
    ? computedAvgVi
    : Number(vi.viAvg ?? vi.avgVi ?? riskCard?.avg_vi_score ?? vi.totalVi ?? computedAvgVi);
  const derivedViCode =
    baselineAvgVi <= 1.5 ? 'LOW' : baselineAvgVi <= 2.5 ? 'MEDIUM' : baselineAvgVi <= 3.25 ? 'HIGH' : 'VERY_HIGH';
  const baselineViClass = toVietnameseRiskClass(
    hasInlineViComponents ? derivedViCode : vi.viClass || riskCard?.vi_class || derivedViCode
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
      score: e2Val,
      max: 4,
      standard: 'Mức độ hư hại và nứt vỡ trên các cấu kiện chịu lực chính (cột, dầm, sàn BTCT)',
      isOverridden: false,
    },
    {
      code: 'E3',
      key: 'e3',
      name: 'Đo Biến Dạng, Lún & Võng Dầm',
      score: e3Val,
      max: 4,
      standard: 'Độ nghiêng tổng thể 2 phương X/Y, đo độ chênh lún móng và độ võng dầm kết cấu',
      isOverridden: false,
    },
    {
      code: 'E4',
      key: 'e4',
      name: 'Thoái Hóa Vật Liệu & Độ Ẩm',
      score: e4Val,
      max: 4,
      standard: 'Mức độ rỉ sét cốt thép, cacbonat hóa bê tông, ẩm mốc, bong tróc vữa trát',
      isOverridden: false,
    },
    {
      code: 'E5',
      key: 'e5',
      name: 'Lịch Sử Cải Tạo & Quá Khứ',
      score: e5Val,
      max: 4,
      standard: 'Dấu vết cơi nới, nâng tầng, sửa chữa kết cấu không đồng bộ hoặc lún tích lũy',
      isOverridden: false,
    },
    {
      code: 'E6',
      key: 'e6',
      name: 'Suy Giảm Công Năng Khai Thác',
      score: e6Val,
      max: 4,
      standard: 'Mức độ ảnh hưởng đến khả năng đóng mở cửa sổ/cửa đi, an toàn sử dụng của hộ dân',
      isOverridden: false,
    },
  ];

  // Breakdown V1..V6 (VI) with complete technical definitions (Đồng bộ 100% FE Phase 1 - viCalculator.ts)
  const viItems = [
    {
      code: 'V1',
      key: 'v1',
      name: 'Công Năng & Nhóm Đối Tượng',
      score: effectiveImportance,
      max: 4,
      definition: 'Đất trống/nhà bỏ trống (0đ), Nhà ở thông thường General (2đ), Công trình Important (3đ), Critical (4đ)',
      isOverridden: isOverridden && riskCard?.overridden_importance_score !== null,
    },
    {
      code: 'V2',
      key: 'v2',
      name: 'Hệ Kết Cấu Chịu Lực Chính',
      score: v2Val,
      max: 4,
      definition: 'Khung BTCT toàn khối (1đ), Kết cấu hỗn hợp/thép (2đ), Tường gạch chịu lực (3đ), Kết cấu tạm/kém ổn định (4đ)',
      isOverridden: false,
    },
    {
      code: 'V3',
      key: 'v3',
      name: 'Loại Móng & Hồ Sơ CAT Móng',
      score: v3Val,
      max: 4,
      definition: 'Ánh xạ từ phân loại hồ sơ CAT móng: CAT 1-2 (1đ), CAT 3 (2đ), CAT 4 (3đ), CAT 5 (4đ)',
      isOverridden: false,
    },
    {
      code: 'V4',
      key: 'v4',
      name: 'Tuổi Đời Công Trình & Cơi Nới',
      score: v4Val,
      max: 4,
      definition: 'Tuổi công trình <10 năm (1đ), 10-25 năm (2đ), 26-40 năm (3đ), >40 năm hoặc có cơi nới tải trọng nặng ≥3đ (4đ)',
      isOverridden: false,
    },
    {
      code: 'V5',
      key: 'v5',
      name: 'Hiện Trạng Kỹ Thuật (Từ Hạng ECS)',
      score: v5Val,
      max: 4,
      definition: 'Tự động ánh xạ từ hạng hiện trạng kỹ thuật ECS: GOOD (1đ), MEDIUM (2đ), DEFICIENT (3đ), CRITICAL (4đ)',
      isOverridden: false,
    },
    {
      code: 'V6',
      key: 'v6',
      name: 'Thiết Bị Nhạy Cảm & Vận Hành 24/7',
      score: v6Val,
      max: 4,
      definition: 'Sinh hoạt bình thường (1đ), Có thiết bị máy móc nhạy cảm rung chấn (3đ), Vận hành liên tục 24/7 (4đ)',
      isOverridden: false,
    },
  ];

  // Kiểm tra trực tiếp dữ liệu live từ formState + stagedPhotoActions cho 6 tiêu chí Data Completeness Gate
  const extractPhotoItemUrl = (item: StepwiseIdentificationPhotoItem | string | undefined): string => {
    if (!item) return '';
    if (typeof item === 'string') return item.trim();
    return (item.url || item.photoUrl || item.raw_photo_url || item.annotated_photo_url || '').trim();
  };

  const resolveGateIdentPhoto = (slotCode: 'P-01' | 'P-02' | 'P-03' | 'P-04', rawItem: StepwiseIdentificationPhotoItem | string | undefined, fallbackUrl?: unknown): string => {
    const baseUrl = extractPhotoItemUrl(rawItem) || (typeof fallbackUrl === 'string' ? fallbackUrl.trim() : '');
    const compactCode = slotCode.replace('-', ''); // 'P01' .. 'P04'
    const slotKey = `photo${compactCode}`; // 'photoP01' .. 'photoP04'
    const resolved = resolveOptimisticPhoto(baseUrl, stagedPhotoActions, {
      category: 'IDENTIFICATION',
      targetPhotoType: compactCode,
      targetPhotoId: slotKey,
      url: baseUrl || undefined,
    });
    if (resolved.status === 'DELETED') return '';
    if (resolved.displayUrl && resolved.isStaged) return resolved.displayUrl;
    const resolvedByDashCode = resolveOptimisticPhoto(baseUrl, stagedPhotoActions, {
      targetPhotoType: slotCode,
      targetPhotoId: slotCode,
      url: baseUrl || undefined,
    });
    if (resolvedByDashCode.status === 'DELETED') return '';
    if (resolvedByDashCode.displayUrl) return resolvedByDashCode.displayUrl;
    const added = [
      ...getOptimisticAddedPhotos(stagedPhotoActions, {
        category: 'IDENTIFICATION',
        targetPhotoType: compactCode,
      }),
      ...getOptimisticAddedPhotos(stagedPhotoActions, {
        targetPhotoType: slotCode,
      }),
    ];
    return added[0]?.url || '';
  };

  const identPhotos = formState.identificationPhotos || sJson.identificationPhotos || {};
  const liveP01Url = resolveGateIdentPhoto('P-01', formState.photoP01 ?? identPhotos.photoP01 ?? identPhotos.p01 ?? sJson.photoP01, (sJson as Record<string, unknown>).p01PhotoUrl);
  const liveP02Url = resolveGateIdentPhoto('P-02', formState.photoP02 ?? identPhotos.photoP02 ?? identPhotos.p02 ?? sJson.photoP02, (sJson as Record<string, unknown>).p02PhotoUrl);
  const liveP03Url = resolveGateIdentPhoto('P-03', formState.photoP03 ?? identPhotos.photoP03 ?? identPhotos.p03 ?? sJson.photoP03, (sJson as Record<string, unknown>).p03PhotoUrl);
  const liveP04Url = resolveGateIdentPhoto('P-04', formState.photoP04 ?? identPhotos.photoP04 ?? identPhotos.p04 ?? sJson.photoP04, (sJson as Record<string, unknown>).p04PhotoUrl);
  const validIdentPhotosCount = [liveP01Url, liveP02Url, liveP03Url, liveP04Url].filter(Boolean).length;

  const liveHouseNumber = formState.houseNumber ?? data?.houseNumber ?? sJson.houseNumber;
  const liveMetroDist = formState.metroOffsetDistance ?? formState.metroDistanceM ?? data?.metroOffsetDistance ?? sJson.metroOffsetDistance;

  const liveFoundationType = formState.foundationType ?? sJson.foundationType ?? data?.buildingSpecs?.foundationCategory;
  const liveFoundationCatScore = formState.foundationCatScore ?? sJson.foundationCatScore ?? data?.buildingSpecs?.foundationCatScore;

  // Thu thập danh sách tầng hoạt động (!isDeleted) và khuyết tật hoạt động
  const rawFloorsSource: FloorSurveyData[] = Array.isArray(formState.floors)
    ? formState.floors
    : Array.isArray(sJson.floors)
    ? sJson.floors
    : [];
  const activeFloors = rawFloorsSource.filter((fl) => !isSoftDeleted(fl));
  const rawZonesSource: DamageZoneData[] = Array.isArray(formState.damageZones)
    ? formState.damageZones
    : Array.isArray(sJson.damageZones)
    ? sJson.damageZones
    : [];

  const isDefectStagedDeleted = (d: DefectItem): boolean => {
    if (!stagedPhotoActions || stagedPhotoActions.length === 0) return false;
    const dRecord = d as unknown as Record<string, unknown>;
    const dId = String(d.id || d.defectCode || dRecord.defect_code || '');
    const dCode = String(d.defectCode || dRecord.defect_code || d.id || '');
    return stagedPhotoActions.some(
      (a) =>
        Boolean(a.deleteDefectItem) &&
        ((dId && (a.defectId === dId || a.targetPhotoId === dId)) ||
          (dCode && (a.defectCode === dCode || a.defectId === dCode || a.targetPhotoId === dCode)))
    );
  };

  const allDefectsList: DefectItem[] = [];
  if (activeFloors.length > 0) {
    activeFloors.forEach((fl: FloorSurveyData) => {
      (fl.zones || []).forEach((z: DamageZoneData) => {
        if (isSoftDeleted(z)) return;
        (z.defects || []).forEach((d: DefectItem) => {
          if (!isSoftDeleted(d) && !isDefectStagedDeleted(d)) {
            allDefectsList.push(d);
          }
        });
      });
      const structElems = ((fl as unknown as Record<string, unknown>).structuralElements || []) as Array<{
        defects?: DefectItem[];
        [key: string]: unknown;
      }>;
      structElems.forEach((el) => {
        if (isSoftDeleted(el)) return;
        (el.defects || []).forEach((d: DefectItem) => {
          if (!isSoftDeleted(d) && !isDefectStagedDeleted(d)) {
            allDefectsList.push(d);
          }
        });
      });
    });
  } else {
    rawZonesSource.forEach((z: DamageZoneData) => {
      if (isSoftDeleted(z)) return;
      (z.defects || []).forEach((d: DefectItem) => {
        if (!isSoftDeleted(d) && !isDefectStagedDeleted(d)) {
          allDefectsList.push(d);
        }
      });
    });
  }

  const totalDefectsCount = allDefectsList.length;
  const defectsWithScale = allDefectsList.filter((d) => Boolean(d.hasScaleCard ?? d.has_scale_card)).length;
  const isScaleValid = totalDefectsCount === 0 || defectsWithScale === totalDefectsCount;
  const liveSettlement = formState.settlementTilt ?? sJson.settlementTilt ?? data?.deformation;

  // 6 Data Completeness Gate Criteria (Live from formState + stagedPhotoActions)
  const gateCriteria = [
    {
      title: '1. Định Danh & Cự Ly Tim Hầm',
      valid: Boolean(liveHouseNumber),
      note: liveHouseNumber ? `Số nhà ${liveHouseNumber}${liveMetroDist ? ` • ${liveMetroDist}` : ' • Đủ GPS'}` : 'Thiếu biển số nhà',
    },
    {
      title: '2. Ngoại Quan Mặt Tiền P-01..P-04',
      valid: Boolean(liveP01Url && liveP02Url),
      note: validIdentPhotosCount >= 2 ? `Đủ ${validIdentPhotosCount}/4 góc chụp ngoại quan` : `⚠️ Thiếu ảnh P-01/P-02 (${validIdentPhotosCount}/4)`,
    },
    {
      title: '3. Phân Loại Móng CAT',
      valid: Boolean(liveFoundationType && liveFoundationCatScore !== undefined && liveFoundationCatScore !== null),
      note: `CAT ${liveFoundationCatScore ?? 3}/5`,
    },
    {
      title: '4. Sơ Đồ Mặt Bằng CAD Tầng',
      valid: activeFloors.length > 0,
      note: activeFloors.length > 0 ? `Khảo sát đầy đủ (${activeFloors.length} tầng)` : 'Chưa có dữ liệu tầng hoạt động',
    },
    {
      title: '5. Thước Đo Tỷ Lệ mm Khuyết Tật',
      valid: isScaleValid,
      note:
        totalDefectsCount === 0
          ? 'Không có vết nứt'
          : isScaleValid
          ? `100% đạt chuẩn (${defectsWithScale}/${totalDefectsCount} vết)`
          : `⚠️ ${totalDefectsCount - defectsWithScale}/${totalDefectsCount} vết thiếu thước đo`,
    },
    {
      title: '6. Biến Dạng, Lún Nghiêng & Quan Trắc',
      valid: Boolean(liveSettlement),
      note: liveSettlement ? 'Đo lường độ nghiêng & lún' : 'Chưa có dữ liệu biến dạng',
    },
  ];

  const isAllGateValid = gateCriteria.every((c) => c.valid);

  // Chuẩn hóa gateDecision (hỗ trợ cả string hoặc object { decision, reason }) và gateNotes
  const normalizedGateDecision =
    typeof formState.gateDecision === 'string'
      ? formState.gateDecision
      : formState.gateDecision?.decision ||
        (typeof sJson.gateDecision === 'string' ? sJson.gateDecision : sJson.gateDecision?.decision) ||
        (isAllGateValid ? 'ALLOW' : 'CONDITIONAL');
  const normalizedGateNotes =
    formState.gateNotes ??
    (typeof formState.gateDecision === 'object' ? formState.gateDecision?.reason : undefined) ??
    (typeof sJson.gateDecision === 'object' ? sJson.gateDecision?.reason : undefined) ??
    '';

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
                  value={normalizedGateDecision}
                  onChange={(e) => handleFieldChange && handleFieldChange('gateDecision', 'Quyết định Cổng', e.target.value)}
                  className="p-1 text-xs font-bold bg-white border border-slate-300 rounded"
                >
                  <option value="ALLOW">✓ Cho phép phê duyệt (ALLOW)</option>
                  <option value="CONDITIONAL">⚠️ Phê duyệt có điều kiện (CONDITIONAL)</option>
                  <option value="REJECT">✕ Từ chối / Yêu cầu khảo sát lại (REJECT)</option>
                </select>
              </div>
            ) : (
              <span
                className={`px-2.5 py-0.5 rounded-full text-[11px] font-black border flex items-center gap-1 ${
                  normalizedGateDecision === 'ALLOW' && isAllGateValid
                    ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
                    : normalizedGateDecision === 'REJECT'
                    ? 'bg-rose-100 text-rose-800 border-rose-300'
                    : 'bg-amber-100 text-amber-900 border-amber-300'
                }`}
              >
                {normalizedGateDecision === 'ALLOW' && isAllGateValid ? (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                    <span>ĐỦ ĐIỀU KIỆN PHÊ DUYỆT</span>
                  </>
                ) : normalizedGateDecision === 'REJECT' ? (
                  <>
                    <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
                    <span>TỪ CHỐI / YÊU CẦU KHẢO SÁT LẠI</span>
                  </>
                ) : (
                  <>
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                    <span>⚠️ CẦN RÀ SOÁT / PHÊ DUYỆT CÓ ĐIỀU KIỆN</span>
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

          {isEditMode ? (
            <div className="pt-2">
              <label className="text-[11px] font-bold text-slate-700 block mb-1">Ghi chú điều kiện / Cổng dữ liệu:</label>
              <input
                type="text"
                value={normalizedGateNotes}
                onChange={(e) => handleFieldChange && handleFieldChange('gateNotes', 'Ghi chú Cổng dữ liệu', e.target.value)}
                placeholder="Ghi chú điều kiện phê duyệt hoặc yêu cầu bổ sung hồ sơ..."
                className="w-full p-1.5 text-xs bg-white border border-slate-300 rounded-lg"
              />
            </div>
          ) : normalizedGateNotes ? (
            <div className="pt-2 border-t border-sky-200/60 text-xs text-slate-700">
              <span className="font-bold text-sky-900">Ghi chú Cổng dữ liệu: </span>
              <span className="italic">{normalizedGateNotes}</span>
            </div>
          ) : null}
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
                        <div className="flex items-center gap-1.5">
                          <span>{item.name}</span>
                          <ScoreExplanationPopover metric={item.code as MetricType} />
                        </div>
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
                              step="1"
                              min={0}
                              max={item.max}
                              value={Number(ecs[eKey] ?? item.score)}
                              onChange={(e) => {
                                const clampedVal = Math.max(0, Math.min(item.max, Math.round(Number(e.target.value) || 0)));
                                const nextScores: Record<string, number> = {
                                  e1: e1Val,
                                  e2: e2Val,
                                  e3: e3Val,
                                  e4: e4Val,
                                  e5: e5Val,
                                  e6: e6Val,
                                  [eKey]: clampedVal,
                                };
                                const nextTotal =
                                  nextScores.e1 +
                                  nextScores.e2 +
                                  nextScores.e3 +
                                  nextScores.e4 +
                                  nextScores.e5 +
                                  nextScores.e6;
                                const nextClass =
                                  nextTotal <= 5
                                    ? 'GOOD'
                                    : nextTotal <= 10
                                    ? 'MEDIUM'
                                    : nextTotal <= 16
                                    ? 'DEFICIENT'
                                    : 'CRITICAL';
                                handleNestedFieldChange('ecs', eKey, `Điểm ${item.code}`, clampedVal);
                                handleNestedFieldChange('ecs', 'totalEcs', 'Tổng điểm ECS', nextTotal);
                                handleNestedFieldChange('ecs', 'ecsClass', 'Phân hạng ECS', nextClass);
                              }}
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
                        <div className="flex items-center gap-1.5">
                          <span>{item.name}</span>
                          <ScoreExplanationPopover metric={item.code as MetricType} />
                        </div>
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
                        1 &rarr; {item.max}
                      </td>
                      <td className="p-3 text-center">
                        {isEditMode && handleNestedFieldChange ? (
                          <div className="flex items-center justify-center gap-1">
                            <input
                              type="number"
                              step="1"
                              min={1}
                              max={item.max}
                              value={Math.round(Number(vi[vKey] ?? item.score))}
                              onChange={(e) => {
                                const clampedVal = Math.max(1, Math.min(item.max, Math.round(Number(e.target.value) || 1)));
                                const nextScores: Record<string, number> = {
                                  v1: v1Val,
                                  v2: v2Val,
                                  v3: v3Val,
                                  v4: v4Val,
                                  v5: v5Val,
                                  v6: v6Val,
                                  [vKey]: clampedVal,
                                };
                                const nextAvg = Number(
                                  (
                                    (nextScores.v1 +
                                      nextScores.v2 +
                                      nextScores.v3 +
                                      nextScores.v4 +
                                      nextScores.v5 +
                                      nextScores.v6) /
                                    6
                                  ).toFixed(2)
                                );
                                const nextClass =
                                  nextAvg <= 1.5
                                    ? 'LOW'
                                    : nextAvg <= 2.5
                                    ? 'MEDIUM'
                                    : nextAvg <= 3.25
                                    ? 'HIGH'
                                    : 'VERY_HIGH';
                                handleNestedFieldChange('vi', vKey, `Điểm ${item.code}`, clampedVal);
                                handleNestedFieldChange('vi', 'avgVi', 'Chỉ số VI trung bình', nextAvg);
                                handleNestedFieldChange('vi', 'viAvg', 'Chỉ số VI trung bình', nextAvg);
                                handleNestedFieldChange('vi', 'viClass', 'Phân hạng VI', nextClass);
                              }}
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
                              {Math.round(Number(item.score))} đ
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
                      <td className="p-2.5 font-medium text-slate-800">Điểm Hư Hỏng Hiện Trạng (ECS)</td>
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
                      <td className="p-2.5 font-medium text-slate-800">Chỉ Số Dễ Bị Tổn Thương (VI)</td>
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
