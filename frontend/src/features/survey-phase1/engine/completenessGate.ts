import { Phase1SurveyFormData } from '../types/phase1.types';

export interface GateVerificationResult {
  foundationInfo: { passed: boolean; label: string; score: number };
  photoMapping: {
    passed: boolean;
    label: string;
    details: string;
    countZonesZ: number;
    countElementsE: number;
    countDefectsZ: number;
    countDefectsE: number;
  };
  internalAccess: { passed: boolean; label: string };
  settlementData: { passed: boolean; label: string };
  asBuiltDrawings: { passed: boolean; label: string };
  structuralReview: { status: 'SUFFICIENT' | 'PENDING_REVIEW' | 'NA'; label: string };
  overallSuggestedDecision: 'ALLOW' | 'CONDITIONAL' | 'PENDING';
}

export function verifyDataCompletenessGate(data: Phase1SurveyFormData): GateVerificationResult {
  // 1. Móng
  const catScore = data.foundationCatScore ?? 0;
  const foundationPassed = catScore >= 1;

  // 2. Ảnh & Ghim khuyết tật - Tách riêng Vùng Kiến trúc Z và Cấu kiện Kết cấu E
  const hasP01 = Boolean(data.photoP01?.url || data.photoP01?.notApplicable);
  const hasP02 = Boolean(data.photoP02?.url || data.photoP02?.notApplicable);
  const hasP04 = Boolean(data.photoP04?.url || data.photoP04?.notApplicable);

  const countZonesZ = (data.floors || []).reduce((acc, f) => acc + (f.zones?.length || 0), 0);
  const countElementsE = (data.floors || []).reduce((acc, f) => acc + (f.structuralElements?.length || 0), 0);

  const countDefectsZ = (data.floors || []).reduce(
    (acc, f) => acc + (f.zones?.reduce((zacc, z) => zacc + (z.defects?.length || 0), 0) || 0),
    0
  );
  const countDefectsE = (data.floors || []).reduce(
    (acc, f) => acc + (f.structuralElements?.reduce((eacc, e) => eacc + (e.defects?.length || 0), 0) || 0),
    0
  );

  const photoPassed = hasP01 && hasP02 && hasP04 && countZonesZ > 0;

  // 3. Khảo sát bên trong
  const isLimited = data.accessLimitation.type !== 'FULL_100';

  // 4. Dữ liệu lún nghiêng
  const settlementPassed = !data.settlementTilt.needAdditionalMonitoring.required;

  // 5. Bản vẽ
  const hasDrawings = (data.asBuiltDrawingFiles?.length ?? 0) > 0;

  // 6. Structural Review (3 giá trị: N/A / Đủ / Pending)
  let structuralStatus: 'SUFFICIENT' | 'PENDING_REVIEW' | 'NA' = 'SUFFICIENT';
  let structuralLabel = 'Đủ';

  if (
    data.ecs.e2 >= 3 ||
    data.burlandSummary.structuralFlagLevel === 'HIGH' ||
    data.burlandSummary.structuralFlagLevel === 'CRITICAL' ||
    data.burlandSummary.needStructuralEngineerReview
  ) {
    structuralStatus = 'PENDING_REVIEW';
    structuralLabel = 'Pending';
  } else if (
    data.ecs.e2 === 0 &&
    (data.burlandSummary.structuralFlagLevel === 'NONE' || !data.burlandSummary.structuralFlagLevel)
  ) {
    structuralStatus = 'NA';
    structuralLabel = 'N/A';
  } else {
    structuralStatus = 'SUFFICIENT';
    structuralLabel = 'Đủ';
  }

  // Đề xuất
  let overallSuggestedDecision: 'ALLOW' | 'CONDITIONAL' | 'PENDING' = 'ALLOW';
  if (!foundationPassed || !photoPassed || structuralStatus === 'PENDING_REVIEW') {
    overallSuggestedDecision = 'PENDING';
  } else if (isLimited || !settlementPassed || !hasDrawings) {
    overallSuggestedDecision = 'CONDITIONAL';
  }

  return {
    foundationInfo: {
      passed: foundationPassed,
      label: foundationPassed ? `Đủ (Cat ${catScore}/5)` : 'Chưa đủ',
      score: catScore,
    },
    photoMapping: {
      passed: photoPassed,
      label: photoPassed ? 'Đủ' : 'Thiếu',
      details: `${countZonesZ} Vùng Z (${countDefectsZ} nứt) • ${countElementsE} Cấu kiện E (${countDefectsE} nứt)`,
      countZonesZ,
      countElementsE,
      countDefectsZ,
      countDefectsE,
    },
    internalAccess: {
      passed: !isLimited,
      label: isLimited ? 'Hạn chế tiếp cận' : 'Đã khảo sát 100%',
    },
    settlementData: {
      passed: settlementPassed,
      label: settlementPassed ? 'Đủ' : 'Cần đo bổ sung',
    },
    asBuiltDrawings: {
      passed: hasDrawings,
      label: hasDrawings ? 'Có bản vẽ' : 'Không có / Một phần',
    },
    structuralReview: {
      status: structuralStatus,
      label: structuralLabel,
    },
    overallSuggestedDecision,
  };
}
