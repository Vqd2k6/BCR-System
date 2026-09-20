import { Phase1SurveyFormData } from '../types/phase1.types';

export interface GateVerificationResult {
  foundationInfo: { passed: boolean; label: string; score: number };
  photoMapping: { passed: boolean; label: string; details: string };
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

  // 2. Ảnh & Ghim
  const hasP01 = Boolean(data.photoP01?.url || data.photoP01?.notApplicable);
  const hasP02 = Boolean(data.photoP02?.url || data.photoP02?.notApplicable);
  const hasP04 = Boolean(data.photoP04?.url || data.photoP04?.notApplicable);
  const totalZones = data.floors.reduce((acc, f) => acc + f.zones.length, 0);
  const totalDefects = data.floors.reduce(
    (acc, f) => acc + f.zones.reduce((zacc, z) => zacc + z.defects.length, 0),
    0
  );
  const photoPassed = hasP01 && hasP02 && hasP04 && totalZones > 0;

  // 3. Khảo sát bên trong
  const isLimited = data.accessLimitation.type !== 'FULL_100';

  // 4. Dữ liệu lún nghiêng
  const settlementPassed = !data.settlementTilt.needAdditionalMonitoring.required;

  // 5. Bản vẽ
  const hasDrawings = (data.asBuiltDrawingFiles?.length ?? 0) > 0;

  // 6. Structural Review
  let structuralStatus: 'SUFFICIENT' | 'PENDING_REVIEW' | 'NA' = 'SUFFICIENT';
  if (
    data.ecs.e2 >= 3 ||
    data.burlandSummary.structuralFlagLevel === 'HIGH' ||
    data.burlandSummary.structuralFlagLevel === 'CRITICAL'
  ) {
    structuralStatus = 'PENDING_REVIEW';
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
      details: `${totalZones} Vùng Z, ${totalDefects} Khuyết tật D`,
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
      label:
        structuralStatus === 'PENDING_REVIEW'
          ? '⚠️ Cần Kỹ sư kết cấu Review (E2 >= 3 / Cờ đỏ)'
          : 'Đủ điều kiện',
    },
    overallSuggestedDecision,
  };
}
