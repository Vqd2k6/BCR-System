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
  overallSuggestedDecision: 'ALLOW' | 'CONDITIONAL';
}

export function verifyDataCompletenessGate(data: Phase1SurveyFormData): GateVerificationResult {
  const isCondoUnit = data.surveyCaseType === 'APARTMENT' || Boolean(data.unitId);

  // 1. Móng (Bước 2.1): Căn hộ con kế thừa từ tòa mẹ
  const catScore = data.foundationCatScore ?? 0;
  const foundationPassed = isCondoUnit ? true : catScore >= 1;

  // 2. Ảnh & Ghim khuyết tật - Tách riêng Vùng Kiến trúc Z (Mục 3.1) và Cấu kiện Kết cấu E (Mục 3.2)
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

  // 3. Khảo sát bên trong (Bước 5)
  const isLimited = (data.accessLimitation?.type || 'FULL_100') !== 'FULL_100';

  // 4. Dữ liệu lún nghiêng (Đo nghiêng lấy theo tòa nhà mẹ)
  const settlementPassed = isCondoUnit ? true : !data.settlementTilt?.needAdditionalMonitoring?.required;

  // 5. Hồ sơ / Bản vẽ (Căn hộ con bỏ qua vì truy trong CAD giai đoạn sau, kế thừa từ toà mẹ)
  const hasDrawings = isCondoUnit
    ? true
    : Boolean(
        (data.asBuiltDrawingPhotoUrl && data.asBuiltDrawingPhotoUrl.trim() !== '') ||
        (data.asBuiltDrawingFiles && data.asBuiltDrawingFiles.length > 0)
      );

  // 6. Structural Review (Lấy trực tiếp từ Bước 4: Burland Summary 4.1 mục 5)
  const burland = data.burlandSummary || {};
  const needsReview = Boolean(
    burland.needStructuralEngineerReview ||
    burland.structuralFlagLevel === 'HIGH' ||
    burland.structuralFlagLevel === 'CRITICAL'
  );

  let structuralStatus: 'SUFFICIENT' | 'PENDING_REVIEW' = needsReview ? 'PENDING_REVIEW' : 'SUFFICIENT';
  let structuralLabel = needsReview
    ? 'Có - Cần Kỹ sư kết cấu thẩm tra chuyên sâu'
    : 'Không - Mức độ hư hỏng thông thường';

  // Đề xuất tổng quan: Chỉ còn 2 trạng thái ALLOW hoặc CONDITIONAL (Đã bỏ PENDING)
  let overallSuggestedDecision: 'ALLOW' | 'CONDITIONAL' = 'ALLOW';
  if (!foundationPassed || !photoPassed || isLimited || !settlementPassed || !hasDrawings || structuralStatus === 'PENDING_REVIEW') {
    overallSuggestedDecision = 'CONDITIONAL';
  } else {
    overallSuggestedDecision = 'ALLOW';
  }

  return {
    foundationInfo: {
      passed: foundationPassed,
      label: isCondoUnit ? 'Kế thừa từ toà mẹ' : (foundationPassed ? `Đủ (Cat ${catScore}/5)` : 'Chưa đủ'),
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
      label: isCondoUnit ? 'Kế thừa toà mẹ' : (settlementPassed ? 'Đủ' : 'Cần đo bổ sung'),
    },
    asBuiltDrawings: {
      passed: hasDrawings,
      label: isCondoUnit ? 'Kế thừa toà mẹ (Truy CAD sau)' : (hasDrawings ? 'Có' : 'Không có'),
    },
    structuralReview: {
      status: structuralStatus,
      label: structuralLabel,
    },
    overallSuggestedDecision,
  };
}
